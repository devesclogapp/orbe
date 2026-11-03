-- ==============================================================================
-- HOTFIX COMPLEMENTAR P0-02: Alinhamento de schema da tabela profiles (full_name)
-- ==============================================================================

BEGIN;

-- 1. RPC: rpc_rh_retificar_intermitente
CREATE OR REPLACE FUNCTION public.rpc_rh_retificar_intermitente(
    p_lancamento_id UUID,
    p_nova_empresa_id UUID,
    p_novas_horas NUMERIC DEFAULT NULL,
    p_justificativa TEXT DEFAULT NULL,
    p_updated_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_role TEXT;
    v_user_nome TEXT;
    v_lanc RECORD;
    v_lote_atual RECORD;
    v_lote_id UUID;
    v_cnab_count INTEGER;
    v_desvincular_lote BOOLEAN := false;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível resolver o tenant da sessão.' USING ERRCODE = '42501';
    END IF;

    v_role := lower(trim(coalesce(public.get_user_role(), '')));
    IF v_role NOT IN ('admin', 'super_admin', 'rh') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas analistas de RH ou Administradores podem retificar intermitentes. Perfil atual: %', v_role
        USING ERRCODE = '42501';
    END IF;

    -- Ajustado: coluna real da tabela profiles é full_name
    SELECT coalesce(full_name, 'Analista RH') INTO v_user_nome
    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

    IF p_nova_empresa_id IS NULL THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A nova empresa vinculada é obrigatória.' USING ERRCODE = '22023';
    END IF;

    IF p_justificativa IS NULL OR trim(p_justificativa) = '' OR length(trim(p_justificativa)) < 10 THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A justificativa formal do RH é obrigatória (mínimo 10 caracteres).' USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_nova_empresa_id AND tenant_id = v_tenant_id) THEN
        RAISE EXCEPTION 'EMPRESA_NOT_FOUND: A empresa informada não existe ou pertence a outro tenant.' USING ERRCODE = '23503';
    END IF;

    SELECT lote_fechamento_id INTO v_lote_id
    FROM public.lancamentos_intermitentes
    WHERE id = p_lancamento_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REGISTRO_NOT_FOUND: Lançamento intermitente % não encontrado no tenant atual.', p_lancamento_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_lote_id IS NOT NULL THEN
        SELECT * INTO v_lote_atual
        FROM public.intermitentes_lotes_fechamento
        WHERE id = v_lote_id AND tenant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'LOTE_NOT_FOUND: Lote associado não encontrado.' USING ERRCODE = 'P0002';
        END IF;

        IF v_lote_atual.status NOT IN ('AGUARDANDO_VALIDACAO_RH', 'DEVOLVIDO') THEN
            RAISE EXCEPTION 'ESTADO_INVALIDO: Lote operacional em status % impede retificação de lançamentos.', v_lote_atual.status
            USING ERRCODE = '55000';
        END IF;

        SELECT count(*) INTO v_cnab_count
        FROM public.cnab_remessas_arquivos
        WHERE intermitentes_lote_id = v_lote_atual.id;

        IF v_cnab_count > 0 THEN
            RAISE EXCEPTION 'VINCULO_BANCARIO: Lote já possui remessa CNAB gerada no Financeiro.' USING ERRCODE = '55000';
        END IF;
    END IF;

    SELECT * INTO v_lanc
    FROM public.lancamentos_intermitentes
    WHERE id = p_lancamento_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF p_updated_at IS NOT NULL AND v_lanc.updated_at IS DISTINCT FROM p_updated_at THEN
        RAISE EXCEPTION 'CONCORRENCIA: O lançamento foi alterado por outro usuário. Recarregue a página.'
        USING ERRCODE = '40001';
    END IF;

    IF v_lanc.status_pipeline NOT IN ('RECEBIDO', 'EM_ANALISE_RH', 'DEVOLVIDO') THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Lançamento em status % não permite retificação.', v_lanc.status_pipeline
        USING ERRCODE = '55000';
    END IF;

    IF p_novas_horas IS NOT NULL AND p_novas_horas <> v_lanc.horas_trabalhadas THEN
        RAISE EXCEPTION 'OPERACAO_BLOQUEADA: O recálculo de remuneração intermitente exige reprocessamento pelo motor oficial de convocação. Não é permitido alterar horas sem motor oficial homologado.'
        USING ERRCODE = '0A000';
    END IF;

    PERFORM set_config('orbe.in_rpc_retificacao', 'true', true);

    IF v_lote_id IS NOT NULL THEN
        IF v_lote_atual.empresa_id <> p_nova_empresa_id THEN
            v_desvincular_lote := true;
        END IF;
    END IF;

    IF v_desvincular_lote THEN
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            lote_fechamento_id = NULL,
            lote_devolvido_origem_id = v_lanc.lote_fechamento_id,
            status_pipeline = 'RECEBIDO',
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;

        UPDATE public.intermitentes_lotes_fechamento
        SET
            quantidade_registros = quantidade_registros - 1,
            valor_total = valor_total - v_lanc.total,
            status = CASE WHEN (quantidade_registros - 1) <= 0 THEN 'CANCELADO' ELSE status END,
            updated_at = now()
        WHERE id = v_lote_atual.id;
    ELSE
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;
    END IF;

    PERFORM set_config('orbe.in_rpc_retificacao', 'false', true);

    INSERT INTO public.audit_log (
        tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
        acao, entidade, registro_id, descricao, valor_anterior, valor_novo, origem
    ) VALUES (
        v_tenant_id,
        p_nova_empresa_id,
        v_user_id,
        v_user_nome,
        v_role,
        'RETIFICAR_INTERMITENTE_RH',
        'lancamentos_intermitentes',
        p_lancamento_id,
        format('Retificação pelo RH. Justificativa: %s', trim(p_justificativa)),
        jsonb_build_object(
            'empresa_id', v_lanc.empresa_id,
            'horas_trabalhadas', v_lanc.horas_trabalhadas,
            'total', v_lanc.total,
            'lote_fechamento_id', v_lanc.lote_fechamento_id,
            'status_pipeline', v_lanc.status_pipeline
        ),
        jsonb_build_object(
            'empresa_id', p_nova_empresa_id,
            'horas_trabalhadas', v_lanc.horas_trabalhadas,
            'total', v_lanc.total,
            'lote_fechamento_id', CASE WHEN v_desvincular_lote THEN NULL ELSE v_lanc.lote_fechamento_id END,
            'status_pipeline', CASE WHEN v_desvincular_lote THEN 'RECEBIDO' ELSE v_lanc.status_pipeline END
        ),
        'RPC_RH_RETIFICAR_INTERMITENTE'
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', p_lancamento_id,
        'empresa_id', p_nova_empresa_id,
        'total', v_lanc.total,
        'lote_anterior_id', v_lote_id,
        'desvinculado_por_empresa_divergente', v_desvincular_lote
    );
END;
$$;

-- 2. RPC: rpc_rh_revalidar_lote_devolvido
CREATE OR REPLACE FUNCTION public.rpc_rh_revalidar_lote_devolvido(
    p_lote_id UUID,
    p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_role TEXT;
    v_user_nome TEXT;
    v_lote RECORD;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Usuário não autenticado.' USING ERRCODE = '42501';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível resolver o tenant da sessão.' USING ERRCODE = '42501';
    END IF;

    v_role := lower(trim(coalesce(public.get_user_role(), '')));
    IF v_role NOT IN ('admin', 'super_admin', 'rh') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas analistas de RH ou Administradores podem revalidar lotes devolvidos.'
        USING ERRCODE = '42501';
    END IF;

    IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A justificativa para revalidação do lote é obrigatória.' USING ERRCODE = '22023';
    END IF;

    -- Ajustado: coluna real da tabela profiles é full_name
    SELECT coalesce(full_name, 'Analista RH') INTO v_user_nome
    FROM public.profiles WHERE user_id = v_user_id LIMIT 1;

    SELECT * INTO v_lote
    FROM public.intermitentes_lotes_fechamento
    WHERE id = p_lote_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'LOTE_NOT_FOUND: Lote % não encontrado no tenant atual.', p_lote_id USING ERRCODE = 'P0002';
    END IF;

    IF v_lote.status <> 'DEVOLVIDO' THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Apenas lotes com status DEVOLVIDO podem ser revalidados. Status atual: %', v_lote.status
        USING ERRCODE = '55000';
    END IF;

    UPDATE public.intermitentes_lotes_fechamento
    SET
        status = 'AGUARDANDO_VALIDACAO_RH',
        observacoes = format('Revalidado pelo RH após saneamento. Motivo: %s', trim(p_justificativa)),
        updated_at = now()
    WHERE id = p_lote_id;

    UPDATE public.lancamentos_intermitentes
    SET
        status_pipeline = 'EM_ANALISE_RH',
        updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    INSERT INTO public.audit_log (
        tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
        acao, entidade, registro_id, descricao, valor_anterior, valor_novo, origem
    ) VALUES (
        v_tenant_id,
        v_lote.empresa_id,
        v_user_id,
        v_user_nome,
        v_role,
        'REVALIDAR_LOTE_DEVOLVIDO_RH',
        'intermitentes_lotes_fechamento',
        p_lote_id,
        format('Lote revalidado pelo RH. Justificativa: %s', trim(p_justificativa)),
        jsonb_build_object('status', 'DEVOLVIDO'),
        jsonb_build_object('status', 'AGUARDANDO_VALIDACAO_RH'),
        'RPC_RH_REVALIDAR_LOTE'
    );

    RETURN jsonb_build_object(
        'success', true,
        'lote_id', p_lote_id,
        'novo_status', 'AGUARDANDO_VALIDACAO_RH'
    );
END;
$$;

COMMIT;

