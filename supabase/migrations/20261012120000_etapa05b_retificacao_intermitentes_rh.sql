-- ==============================================================================
-- MIGRATION: 20261012120000_etapa05b_retificacao_intermitentes_rh.sql
-- ERP ORBE — FIX-FINAL / ETAPA 05B
-- Retificação Segura de Intermitentes pelo RH (Governança, OCC e Auditoria)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ADIÇÃO DA COLUNA DE RASTREABILIDADE RELACIONAL DE ÚLTIMO CICLO
-- ------------------------------------------------------------------------------
ALTER TABLE public.lancamentos_intermitentes
ADD COLUMN IF NOT EXISTS lote_devolvido_origem_id UUID NULL 
REFERENCES public.intermitentes_lotes_fechamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_intermitentes_lote_devolvido_origem
ON public.lancamentos_intermitentes (lote_devolvido_origem_id)
WHERE lote_devolvido_origem_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER GUARDIÃO CONTRA MUTAÇÃO DIRETA VIA API CLIENT (ANTI-BYPASS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_lancamentos_intermitentes_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_stack TEXT;
BEGIN
    -- 1. Se executado pelo service_role (Edge Functions / Ingestão Tio Digital), permite
    IF auth.role() = 'service_role' THEN
        RETURN NEW;
    END IF;

    -- 2. Autorização exclusiva para retificações originadas da RPC rpc_rh_retificar_intermitente.
    -- Não depende de contexto controlável pelo cliente. Exige simultaneamente:
    -- A) Stack de execução real do motor PL/pgSQL contendo a RPC oficial (unforgeable via PG_CONTEXT)
    -- B) Contexto de execução elevado SECURITY DEFINER (current_user = 'postgres')
    -- C) Flag transacional configurada pela RPC (orbe.in_rpc_retificacao = 'true')
    -- D) Perfil autenticado comprovado de governança (RH ou Administrador)
    GET DIAGNOSTICS v_stack = PG_CONTEXT;
    IF (v_stack LIKE '%rpc_rh_retificar_intermitente%') AND
       (current_user = 'postgres') AND
       (current_setting('orbe.in_rpc_retificacao', true) = 'true') AND
       (lower(trim(coalesce(public.get_user_role(), ''))) IN ('admin', 'super_admin', 'rh')) THEN
        RETURN NEW;
    END IF;

    -- 3. Bloqueia alteração direta de colunas financeiras e horas via API client
    IF (NEW.total IS DISTINCT FROM OLD.total) OR
       (NEW.horas_trabalhadas IS DISTINCT FROM OLD.horas_trabalhadas) OR
       (NEW.horas_normais IS DISTINCT FROM OLD.horas_normais) OR
       (NEW.he_50 IS DISTINCT FROM OLD.he_50) OR
       (NEW.he_100 IS DISTINCT FROM OLD.he_100) OR
       (NEW.hora_noturna IS DISTINCT FROM OLD.hora_noturna) THEN
        RAISE EXCEPTION 'MUTACAO_PROIBIDA: Valores financeiros e horas apuradas de intermitentes são imutáveis via API client. Utilize os fluxos oficiais de governança.'
        USING ERRCODE = '42501';
    END IF;

    -- 4. Bloqueia mutação direta de lote_fechamento_id ou empresa_id quando o registro já possui lote vinculado
    IF OLD.lote_fechamento_id IS NOT NULL AND 
       ((NEW.lote_fechamento_id IS DISTINCT FROM OLD.lote_fechamento_id) OR (NEW.empresa_id IS DISTINCT FROM OLD.empresa_id)) THEN
        RAISE EXCEPTION 'VINCULO_PROTEGIDO: Lançamentos vinculados a lotes só podem ser retificados ou desvinculados através da RPC rpc_rh_retificar_intermitente.'
        USING ERRCODE = '42501';
    END IF;

    -- 5. Validação rigorosa de vinculação inicial de lote (Fechamento Operacional Oficial)
    IF OLD.lote_fechamento_id IS NULL AND NEW.lote_fechamento_id IS NOT NULL THEN
        -- A. Lançamento precisa estar no estado inicial RECEBIDO (impede reutilizar fechados ou devolvidos)
        IF OLD.status_pipeline <> 'RECEBIDO' THEN
            RAISE EXCEPTION 'ESTADO_INVALIDO: Apenas lançamentos no status RECEBIDO podem ser incluídos em novos lotes. Status atual: %', OLD.status_pipeline
            USING ERRCODE = '55000';
        END IF;

        -- B. No fechamento operacional, o status deve transitar estritamente para EM_ANALISE_RH
        IF NEW.status_pipeline <> 'EM_ANALISE_RH' THEN
            RAISE EXCEPTION 'TRANSICAO_INVALIDA: A vinculação inicial a lote exige transição para EM_ANALISE_RH. Status informado: %', NEW.status_pipeline
            USING ERRCODE = '55000';
        END IF;

        -- C. A empresa não pode ser alterada no ato do fechamento
        IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
            RAISE EXCEPTION 'DIVERGENCIA_EMPRESA: Não é permitido alterar a empresa do lançamento durante o fechamento operacional.'
            USING ERRCODE = '42501';
        END IF;

        -- D. Valida que o lote de destino existe, pertence ao mesmo tenant, à mesma empresa e está aberto
        IF NOT EXISTS (
            SELECT 1 FROM public.intermitentes_lotes_fechamento
            WHERE id = NEW.lote_fechamento_id 
              AND tenant_id = OLD.tenant_id
              AND empresa_id = OLD.empresa_id
              AND status = 'AGUARDANDO_VALIDACAO_RH'
        ) THEN
            RAISE EXCEPTION 'LOTE_INVALIDO: Vinculação permitida apenas para lotes abertos (AGUARDANDO_VALIDACAO_RH) do mesmo tenant e empresa.'
            USING ERRCODE = '55000';
        END IF;
    END IF;

    -- 6. Bloqueia alteração direta de empresa_id fora do estado inicial RECEBIDO
    IF OLD.status_pipeline <> 'RECEBIDO' AND (NEW.empresa_id IS DISTINCT FROM OLD.empresa_id) THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: A empresa vinculada só pode ser editada diretamente em lançamentos abertos com status RECEBIDO.'
        USING ERRCODE = '55000';
    END IF;

    -- 7. Bloqueia alteração direta de status terminal ou já despachado ao financeiro
    IF OLD.status_pipeline IN ('APROVADO_RH', 'PAGO', 'CNAB_GERADO', 'ENVIADO_FINANCEIRO') AND 
       NEW.status_pipeline IS DISTINCT FROM OLD.status_pipeline THEN
        -- Permite apenas conciliação bancária autorizada mudar de CNAB_GERADO para PAGO
        IF NOT (OLD.status_pipeline = 'CNAB_GERADO' AND NEW.status_pipeline = 'PAGO') THEN
            RAISE EXCEPTION 'ESTADO_IMUTAVEL: Lançamentos em status % são imutáveis via API client.', OLD.status_pipeline
            USING ERRCODE = '55000';
        END IF;
    END IF;

    -- 8. Bloqueia alteração de lançamentos devolvidos por usuários sem perfil RH/Admin
    IF OLD.status_pipeline = 'DEVOLVIDO' AND NEW.status_pipeline IS DISTINCT FROM OLD.status_pipeline THEN
        IF lower(trim(coalesce(public.get_user_role(), ''))) NOT IN ('admin', 'super_admin', 'rh') THEN
            RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Usuários operacionais não têm permissão para alterar lançamentos devolvidos pelo RH.'
            USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 9. Bloqueia retorno arbitrário de DEVOLVIDO direto para RECEBIDO sem a RPC oficial
    IF OLD.status_pipeline = 'DEVOLVIDO' AND NEW.status_pipeline = 'RECEBIDO' THEN
        RAISE EXCEPTION 'TRANSICAO_INVALIDA: Lançamentos devolvidos só podem retornar para RECEBIDO mediante retificação cadastral de empresa pelo RH via RPC.'
        USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

ALTER FUNCTION public.fn_guard_lancamentos_intermitentes_update() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_update() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes ON public.lancamentos_intermitentes;
CREATE TRIGGER trg_guard_lancamentos_intermitentes
BEFORE UPDATE ON public.lancamentos_intermitentes
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_lancamentos_intermitentes_update();

-- ------------------------------------------------------------------------------
-- 2.1 TRIGGER GUARDIÃO CONTRA DELEÇÃO DIRETA DE LANÇAMENTOS (ANTI-DATA-LOSS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_lancamentos_intermitentes_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Se executado pelo service_role (Edge Functions / Ingestão Tio Digital), permite
    IF auth.role() = 'service_role' THEN
        RETURN OLD;
    END IF;

    -- 2. Bloqueia exclusão de lançamentos vinculados a lotes operacionais
    IF OLD.lote_fechamento_id IS NOT NULL THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Lançamento vinculado ao lote % não pode ser excluído diretamente. Desvincule ou retifique através dos fluxos oficiais.', OLD.lote_fechamento_id
        USING ERRCODE = '42501';
    END IF;

    -- 3. Bloqueia exclusão de lançamentos fora do estado inicial RECEBIDO
    IF OLD.status_pipeline <> 'RECEBIDO' THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Lançamentos em status % não podem ser excluídos via API client. Apenas registros avulsos no status RECEBIDO admitem exclusão.', OLD.status_pipeline
        USING ERRCODE = '42501';
    END IF;

    RETURN OLD;
END;
$$;

ALTER FUNCTION public.fn_guard_lancamentos_intermitentes_delete() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_delete() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_delete() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_guard_lancamentos_intermitentes_delete() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes_delete ON public.lancamentos_intermitentes;
CREATE TRIGGER trg_guard_lancamentos_intermitentes_delete
BEFORE DELETE ON public.lancamentos_intermitentes
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_lancamentos_intermitentes_delete();

-- ------------------------------------------------------------------------------
-- 2.2 TRIGGER GUARDIÃO CONTRA DELEÇÃO INDEVIDA DE LOTES OPERACIONAIS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_guard_intermitentes_lotes_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Se executado pelo service_role (Edge Functions / Ingestão Tio Digital), permite
    IF auth.role() = 'service_role' THEN
        RETURN OLD;
    END IF;

    -- 2. Bloqueia exclusão de lotes com lançamentos ainda vinculados
    IF EXISTS (
        SELECT 1 FROM public.lancamentos_intermitentes
        WHERE lote_fechamento_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Não é permitido excluir lote que possui lançamentos vinculados. Reabra ou retifique os lançamentos previamente.'
        USING ERRCODE = '42501';
    END IF;

    -- 3. Bloqueia exclusão de lotes com remessa CNAB bancária vinculada
    IF EXISTS (
        SELECT 1 FROM public.cnab_remessas_arquivos
        WHERE intermitentes_lote_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Lote possui histórico bancário/remessa CNAB vinculado e é estritamente imutável.'
        USING ERRCODE = '42501';
    END IF;

    -- 4. Apenas lotes formalmente CANCELADOS podem ser excluídos via API client
    IF OLD.status <> 'CANCELADO' THEN
        RAISE EXCEPTION 'EXCLUSAO_BLOQUEADA: Lotes operacionais no status % não podem ser excluídos. Apenas lotes CANCELADOS admitem exclusão física.', OLD.status
        USING ERRCODE = '42501';
    END IF;

    RETURN OLD;
END;
$$;

ALTER FUNCTION public.fn_guard_intermitentes_lotes_delete() OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.fn_guard_intermitentes_lotes_delete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_guard_intermitentes_lotes_delete() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_guard_intermitentes_lotes_delete() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_guard_intermitentes_lotes_delete() TO service_role;

DROP TRIGGER IF EXISTS trg_guard_intermitentes_lotes_delete ON public.intermitentes_lotes_fechamento;
CREATE TRIGGER trg_guard_intermitentes_lotes_delete
BEFORE DELETE ON public.intermitentes_lotes_fechamento
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_intermitentes_lotes_delete();

-- ------------------------------------------------------------------------------
-- 3. RPC TRANSACIONAL: RETIFICAÇÃO EXCLUSIVA PELO RH
-- ------------------------------------------------------------------------------
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
BEGIN
    -- 1. IDENTIFICAÇÃO E AUTORIZAÇÃO EXCLUSIVA DE PERFIL (FAIL-CLOSED)
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

    SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome
    FROM public.profiles WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;

    -- 2. VALIDAÇÃO DE ENTRADA
    IF p_nova_empresa_id IS NULL THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A nova empresa vinculada é obrigatória.' USING ERRCODE = '22023';
    END IF;

    IF p_justificativa IS NULL OR trim(p_justificativa) = '' OR length(trim(p_justificativa)) < 10 THEN
        RAISE EXCEPTION 'DADO_INVALIDO: A justificativa formal do RH é obrigatória (mínimo 10 caracteres).' USING ERRCODE = '22023';
    END IF;

    -- 3. VALIDAÇÃO DA NOVA EMPRESA NO MESMO TENANT
    IF NOT EXISTS (SELECT 1 FROM public.empresas WHERE id = p_nova_empresa_id AND tenant_id = v_tenant_id) THEN
        RAISE EXCEPTION 'EMPRESA_NOT_FOUND: A empresa informada não existe ou pertence a outro tenant.' USING ERRCODE = '23503';
    END IF;

    -- 4. PEEK NO LANÇAMENTO PARA IDENTIFICAR LOTE PAI
    SELECT lote_fechamento_id INTO v_lote_id
    FROM public.lancamentos_intermitentes
    WHERE id = p_lancamento_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'REGISTRO_NOT_FOUND: Lançamento intermitente % não encontrado no tenant atual.', p_lancamento_id
        USING ERRCODE = 'P0002';
    END IF;

    -- 5. ORDEM DETERMINÍSTICA DE LOCKS (PAI PRIMEIRO, FILHO DEPOIS)
    IF v_lote_id IS NOT NULL THEN
        -- Lock pessimista no Lote Pai
        SELECT * INTO v_lote_atual
        FROM public.intermitentes_lotes_fechamento
        WHERE id = v_lote_id AND tenant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'LOTE_NOT_FOUND: Lote associado não encontrado.' USING ERRCODE = 'P0002';
        END IF;

        -- Lista Positiva de Estados do Lote Pai
        IF v_lote_atual.status NOT IN ('AGUARDANDO_VALIDACAO_RH', 'DEVOLVIDO') THEN
            RAISE EXCEPTION 'ESTADO_INVALIDO: Lote operacional em status % impede retificação de lançamentos.', v_lote_atual.status
            USING ERRCODE = '55000';
        END IF;

        -- Validação de CNAB: Proibido se houver arquivo gerado
        SELECT count(*) INTO v_cnab_count
        FROM public.cnab_remessas_arquivos
        WHERE intermitentes_lote_id = v_lote_atual.id;

        IF v_cnab_count > 0 THEN
            RAISE EXCEPTION 'VINCULO_BANCARIO: Lote já possui remessa CNAB gerada no Financeiro.' USING ERRCODE = '55000';
        END IF;
    END IF;

    -- Lock pessimista no Lançamento Filho
    SELECT * INTO v_lanc
    FROM public.lancamentos_intermitentes
    WHERE id = p_lancamento_id AND tenant_id = v_tenant_id
    FOR UPDATE;

    -- 6. VALIDAÇÃO DE CONCORRÊNCIA (OCC)
    IF p_updated_at IS NOT NULL AND v_lanc.updated_at IS DISTINCT FROM p_updated_at THEN
        RAISE EXCEPTION 'CONCORRENCIA: O lançamento foi alterado por outro usuário. Recarregue a página.'
        USING ERRCODE = '40001';
    END IF;

    -- 7. LISTA POSITIVA DE ESTADOS DO LANÇAMENTO
    IF v_lanc.status_pipeline NOT IN ('RECEBIDO', 'EM_ANALISE_RH', 'DEVOLVIDO') THEN
        RAISE EXCEPTION 'ESTADO_INVALIDO: Lançamento em status % não permite retificação.', v_lanc.status_pipeline
        USING ERRCODE = '55000';
    END IF;

    -- 8. FAIL-CLOSED DE HORAS: PROIBIÇÃO DE RECÁLCULO PARALELO
    IF p_novas_horas IS NOT NULL AND p_novas_horas <> v_lanc.horas_trabalhadas THEN
        RAISE EXCEPTION 'OPERACAO_BLOQUEADA: O recálculo de remuneração intermitente exige reprocessamento pelo motor oficial de convocação. Não é permitido alterar horas sem motor oficial homologado.'
        USING ERRCODE = '0A000';
    END IF;

    -- Ativa flag transacional local para passar pelo trigger guardião
    PERFORM set_config('orbe.in_rpc_retificacao', 'true', true);

    -- 9. EXECUÇÃO TRANSACIONAL DA CORREÇÃO DE EMPRESA
    IF v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN
        -- A. Desvincula do lote da Empresa A e realoca para Empresa B
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            lote_fechamento_id = NULL,
            lote_devolvido_origem_id = v_lanc.lote_fechamento_id,
            status_pipeline = 'RECEBIDO',
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;

        -- B. Decrementa lote operacional de origem no fluxo canônico
        UPDATE public.intermitentes_lotes_fechamento
        SET
            quantidade_registros = quantidade_registros - 1,
            valor_total = valor_total - v_lanc.total,
            status = CASE WHEN (quantidade_registros - 1) <= 0 THEN 'CANCELADO' ELSE status END,
            updated_at = now()
        WHERE id = v_lote_atual.id;
    ELSE
        -- Retificação interna mantendo no lote (ou lançamento avulso sem lote)
        UPDATE public.lancamentos_intermitentes
        SET
            empresa_id = p_nova_empresa_id,
            observacoes = trim(p_justificativa),
            updated_at = now()
        WHERE id = p_lancamento_id;
    END IF;

    -- Reseta imediatamente a flag transacional após conclusão das operações protegidas
    PERFORM set_config('orbe.in_rpc_retificacao', 'false', true);

    -- 10. AUDITORIA IMUTÁVEL COMPULSÓRIA (public.audit_log)
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
            'lote_fechamento_id', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN NULL ELSE v_lanc.lote_fechamento_id END,
            'status_pipeline', CASE WHEN v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id THEN 'RECEBIDO' ELSE v_lanc.status_pipeline END
        ),
        'RPC_RH_RETIFICAR_INTERMITENTE'
    );

    RETURN jsonb_build_object(
        'success', true,
        'id', p_lancamento_id,
        'empresa_id', p_nova_empresa_id,
        'total', v_lanc.total,
        'lote_anterior_id', v_lote_id,
        'desvinculado_por_empresa_divergente', (v_lote_id IS NOT NULL AND v_lote_atual.empresa_id <> p_nova_empresa_id)
    );
END;
$$;

ALTER FUNCTION public.rpc_rh_retificar_intermitente OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rh_retificar_intermitente TO service_role;

-- ------------------------------------------------------------------------------
-- 4. RPC TRANSACIONAL: REVALIDAÇÃO DE LOTE DEVOLVIDO PELO RH
-- ------------------------------------------------------------------------------
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

    SELECT coalesce(nome, email, 'Analista RH') INTO v_user_nome
    FROM public.profiles WHERE user_id = v_user_id OR id = v_user_id LIMIT 1;

    -- Lock pessimista no Lote
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

    -- 1. Transita lote operacional para AGUARDANDO_VALIDACAO_RH no fluxo canônico
    UPDATE public.intermitentes_lotes_fechamento
    SET
        status = 'AGUARDANDO_VALIDACAO_RH',
        observacoes = format('Revalidado pelo RH após saneamento. Motivo: %s', trim(p_justificativa)),
        updated_at = now()
    WHERE id = p_lote_id;

    -- 2. Transita lançamentos vinculados para EM_ANALISE_RH
    UPDATE public.lancamentos_intermitentes
    SET
        status_pipeline = 'EM_ANALISE_RH',
        updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    -- 3. Grava Auditoria
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

ALTER FUNCTION public.rpc_rh_revalidar_lote_devolvido OWNER TO postgres;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_rh_revalidar_lote_devolvido TO service_role;
