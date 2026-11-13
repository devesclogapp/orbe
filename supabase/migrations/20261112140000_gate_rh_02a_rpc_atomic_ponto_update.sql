-- ==============================================================================
-- MIGRATION: 20261112140000_gate_rh_02a_rpc_atomic_ponto_update.sql
-- ERP ORBE — GATE-RH-02A: RPC Transacional com Sincronização por Tenant, Empresa e Competência
--
-- Objetivos:
--   1. Eliminar condição de corrida entre atualização de pontos CLT e fechamento/aprovação
--   2. Implementar lock transacional determinístico compartilhado via pg_advisory_xact_lock
--      tanto na atualização de pontos quanto no fechamento de lotes/competências:
--      Key: fn_rh_competencia_lock_key(p_tenant_id, p_empresa_id, p_competencia)
--   3. Trigger BEFORE INSERT/UPDATE em rh_financeiro_lotes para garantir que qualquer fechamento
--      adquira exatamente o mesmo lock transacional.
--   4. Verificar dentro da mesma transação atômica protegida pelo lock:
--      - Status da competência em rh_financeiro_lotes (não cancelados/devolvidos)
--      - Status da competência em fechamento_mensal
--      - Status do registro individual (não permitindo transição de PROCESSADO ou FECHADO)
--   5. Executar UPDATE de forma atômica se e somente se a competência estiver aberta
--   6. Segurança & Princípio do Menor Privilégio:
--      - Exigir auth.uid() IS NOT NULL (ou service_role)
--      - Validar tenant do operador contra p_tenant_id (bloquear spoofing)
--      - Validar papel autorizado (admin, rh, financeiro ou service_role)
--      - Bloquear usuários comuns / anon
-- ==============================================================================

-- 1. Função auxiliar estável para geração determinística da chave de lock de competência
CREATE OR REPLACE FUNCTION public.fn_rh_competencia_lock_key(
    p_tenant_id UUID,
    p_empresa_id UUID,
    p_competencia TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    RETURN ('x' || substr(md5('rh_comp_lock_' || coalesce(p_tenant_id::text, '00000000-0000-0000-0000-000000000000') || '_' || coalesce(p_empresa_id::text, 'null') || '_' || trim(coalesce(p_competencia, ''))), 1, 16))::bit(64)::bigint;
END;
$$;

-- 2. Triggers para garantir sincronização bidirecional no fechamento (rh_financeiro_lotes e fechamento_mensal)
CREATE OR REPLACE FUNCTION public.trg_rh_financeiro_lotes_sync_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_lock_key BIGINT;
BEGIN
    -- Se o lote for de origem RH e status ativo (fechamento/aprovação), adquire o lock transacional
    IF NEW.tenant_id IS NOT NULL AND NEW.empresa_id IS NOT NULL AND NEW.competencia IS NOT NULL THEN
        IF upper(coalesce(NEW.status, '')) NOT IN ('CANCELADO', 'DEVOLVIDO_RH') THEN
            v_lock_key := public.fn_rh_competencia_lock_key(NEW.tenant_id, NEW.empresa_id, NEW.competencia);
            PERFORM pg_advisory_xact_lock(v_lock_key);
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_financeiro_lotes_sync_lock ON public.rh_financeiro_lotes;
CREATE TRIGGER trg_rh_financeiro_lotes_sync_lock
    BEFORE INSERT OR UPDATE ON public.rh_financeiro_lotes
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_rh_financeiro_lotes_sync_lock();

CREATE OR REPLACE FUNCTION public.trg_fechamento_mensal_sync_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_lock_key BIGINT;
    v_comp TEXT;
BEGIN
    -- Sincroniza fechamento_mensal com o mesmo lock determinístico da competência
    IF NEW.tenant_id IS NOT NULL AND NEW.empresa_id IS NOT NULL AND NEW.ano IS NOT NULL AND NEW.mes IS NOT NULL THEN
        v_comp := to_char(NEW.ano, 'FM0000') || '-' || to_char(NEW.mes, 'FM00');
        v_lock_key := public.fn_rh_competencia_lock_key(NEW.tenant_id, NEW.empresa_id, v_comp);
        PERFORM pg_advisory_xact_lock(v_lock_key);
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fechamento_mensal_sync_lock ON public.fechamento_mensal;
CREATE TRIGGER trg_fechamento_mensal_sync_lock
    BEFORE INSERT OR UPDATE ON public.fechamento_mensal
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_fechamento_mensal_sync_lock();

-- 3. RPC Transacional de Atualização Protegida de Pontos
CREATE OR REPLACE FUNCTION public.rpc_atualizar_ponto_se_competencia_aberta(
    p_tenant_id UUID,
    p_registro_id UUID,
    p_empresa_id UUID,
    p_competencia TEXT,
    p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_user_tenant_id UUID;
    v_lock_key BIGINT;
    v_comp_fechada BOOLEAN := FALSE;
    v_ponto RECORD;
    v_updated RECORD;
    v_comp_clean TEXT;
    v_ano INT;
    v_mes INT;
BEGIN
    -- 3.1 Validações de Identidade, Tenant e Menor Privilégio
    v_user_id := auth.uid();
    v_user_role := lower(trim(coalesce(public.get_user_role(), '')));

    -- Usuários autenticados exigem validação estrita de tenant e permissão de perfil
    IF v_user_id IS NOT NULL THEN
        v_user_tenant_id := public.current_tenant_id();

        -- Rejeitar se operador autenticado não possuir tenant válido ou se houver divergência com p_tenant_id
        IF v_user_tenant_id IS NULL OR v_user_tenant_id <> p_tenant_id THEN
            RETURN jsonb_build_object(
                'status', 'FALHA_AUTORIZACAO',
                'message', 'Acesso negado: operador sem tenant válido ou tenant divergente do informado.'
            );
        END IF;

        IF v_user_role NOT IN ('admin', 'super_admin', 'rh', 'financeiro', 'service_role') THEN
            RETURN jsonb_build_object(
                'status', 'FALHA_AUTORIZACAO',
                'message', 'Acesso negado: perfil do usuário não autorizado para alterar registros de ponto.'
            );
        END IF;
    END IF;

    -- 3.2 Validação de Parâmetros Obrigatórios e Modo de Suspensão Operacional
    IF p_tenant_id IS NULL OR p_registro_id IS NULL THEN
        RETURN jsonb_build_object(
            'status', 'ERRO_PARAMETROS',
            'message', 'tenant_id e registro_id são obrigatórios.'
        );
    END IF;

    -- FIX 02: Suporte a suspensão emergencial controlada (fail-closed sem rollback destrutivo)
    IF current_setting('orbe.suspender_ingestao_pontos', true) = 'on' THEN
        RETURN jsonb_build_object(
            'status', 'INGESTAO_SUSPENSA',
            'message', 'A ingestão e atualização de pontos está temporariamente suspensa pelo administrador.'
        );
    END IF;

    -- 3.3 Carregar e bloquear o registro existente PRIMEIRO para validar a chave real
    SELECT * INTO v_ponto
    FROM public.registros_ponto
    WHERE id = p_registro_id
      AND tenant_id = p_tenant_id
    FOR NO KEY UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'REGISTRO_NAO_ENCONTRADO',
            'message', 'Registro de ponto não encontrado no tenant informado.'
        );
    END IF;

    -- 3.4 Garantir que empresa e competência verificadas correspondam obrigatoriamente ao registro real
    -- Se p_empresa_id ou p_competencia forem informados, devem coincidir com o ponto ou com a resolução autorizada
    IF p_empresa_id IS NOT NULL AND v_ponto.empresa_id IS NOT NULL AND v_ponto.empresa_id <> p_empresa_id THEN
        RETURN jsonb_build_object(
            'status', 'DIVERGENCIA_EMPRESA',
            'message', 'A empresa informada difere da empresa registrada no ponto.'
        );
    END IF;

    -- Competência real: prioriza a do registro existente ou derivada da data real do ponto
    v_comp_clean := trim(coalesce(v_ponto.competencia, to_char(v_ponto.data, 'YYYY-MM'), ''));
    IF p_competencia IS NOT NULL AND trim(p_competencia) <> '' AND v_comp_clean <> '' AND trim(p_competencia) <> v_comp_clean THEN
        RETURN jsonb_build_object(
            'status', 'DIVERGENCIA_COMPETENCIA',
            'message', 'A competência informada difere da competência do ponto.'
        );
    END IF;

    -- Empresa efetiva a ser verificada no fechamento
    IF v_ponto.empresa_id IS NOT NULL THEN
        p_empresa_id := v_ponto.empresa_id;
    END IF;

    -- Formatar competência (YYYY-MM)
    IF v_comp_clean ~ '^\d{4}-\d{2}$' THEN
        v_ano := split_part(v_comp_clean, '-', 1)::INT;
        v_mes := split_part(v_comp_clean, '-', 2)::INT;
    ELSE
        v_ano := NULL;
        v_mes := NULL;
    END IF;

    -- 3.5 Sincronização Transacional Determinística sobre a empresa e competência REAIS do registro
    v_lock_key := public.fn_rh_competencia_lock_key(p_tenant_id, p_empresa_id, v_comp_clean);
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- 3.6 Verificar se a competência está fechada em rh_financeiro_lotes
    IF p_empresa_id IS NOT NULL AND v_comp_clean <> '' THEN
        IF EXISTS (
            SELECT 1
            FROM public.rh_financeiro_lotes
            WHERE tenant_id = p_tenant_id
              AND empresa_id = p_empresa_id
              AND competencia = v_comp_clean
              AND upper(coalesce(status, '')) NOT IN ('CANCELADO', 'DEVOLVIDO_RH')
        ) THEN
            v_comp_fechada := TRUE;
        END IF;

        -- Verificar também fechamento_mensal
        IF NOT v_comp_fechada AND v_ano IS NOT NULL AND v_mes IS NOT NULL THEN
            IF EXISTS (
                SELECT 1
                FROM public.fechamento_mensal
                WHERE tenant_id = p_tenant_id
                  AND empresa_id = p_empresa_id
                  AND ano = v_ano
                  AND mes = v_mes
                  AND lower(coalesce(situacao, '')) IN ('fechado', 'concluido', 'processado')
            ) THEN
                v_comp_fechada := TRUE;
            END IF;
        END IF;
    END IF;

    IF v_comp_fechada THEN
        RETURN jsonb_build_object(
            'status', 'COMPETENCIA_FECHADA',
            'message', 'Competência já fechada ou aprovada financeiramente para esta empresa.'
        );
    END IF;

    -- 3.7 Guarda de status individual do ponto
    IF upper(coalesce(v_ponto.status_processamento, '')) IN ('PROCESSADO', 'FECHADO')
       OR upper(coalesce(v_ponto.status, '')) IN ('PROCESSADO', 'FECHADO') THEN
        RETURN jsonb_build_object(
            'status', 'STATUS_INVALIDO',
            'message', 'Ponto já foi processado ou fechado pelo motor RH.',
            'status_processamento', v_ponto.status_processamento,
            'status_individual', v_ponto.status
        );
    END IF;

    -- 3.8 Validação de Imutabilidade Estrutural: o payload NÃO pode contornar a proteção alterando empresa, colaborador, data ou competência
    IF p_payload ? 'empresa_id' AND (p_payload->>'empresa_id')::UUID IS DISTINCT FROM v_ponto.empresa_id THEN
        RETURN jsonb_build_object(
            'status', 'MUTACAO_ESTRUTURAL_INVALIDA',
            'message', 'A alteração de empresa_id em ponto existente não é permitida por esta operação.'
        );
    END IF;

    IF p_payload ? 'colaborador_id' AND (p_payload->>'colaborador_id')::UUID IS DISTINCT FROM v_ponto.colaborador_id THEN
        RETURN jsonb_build_object(
            'status', 'MUTACAO_ESTRUTURAL_INVALIDA',
            'message', 'A alteração de colaborador_id em ponto existente não é permitida por esta operação.'
        );
    END IF;

    IF p_payload ? 'data' AND (p_payload->>'data')::DATE IS DISTINCT FROM v_ponto.data THEN
        RETURN jsonb_build_object(
            'status', 'MUTACAO_ESTRUTURAL_INVALIDA',
            'message', 'A alteração da data em ponto existente não é permitida por esta operação.'
        );
    END IF;

    IF p_payload ? 'competencia' AND (p_payload->>'competencia') IS DISTINCT FROM v_ponto.competencia THEN
        RETURN jsonb_build_object(
            'status', 'MUTACAO_ESTRUTURAL_INVALIDA',
            'message', 'A alteração de competência em ponto existente não é permitida por esta operação.'
        );
    END IF;

    -- 3.9 Executar UPDATE atômico aplicando exclusivamente os campos operacionais permitidos
    UPDATE public.registros_ponto
    SET
        entrada = CASE WHEN p_payload ? 'entrada' THEN p_payload->>'entrada' ELSE registros_ponto.entrada END,
        saida_almoco = CASE WHEN p_payload ? 'saida_almoco' THEN p_payload->>'saida_almoco' ELSE registros_ponto.saida_almoco END,
        retorno_almoco = CASE WHEN p_payload ? 'retorno_almoco' THEN p_payload->>'retorno_almoco' ELSE registros_ponto.retorno_almoco END,
        saida = CASE WHEN p_payload ? 'saida' THEN p_payload->>'saida' ELSE registros_ponto.saida END,
        total_horas = CASE WHEN p_payload ? 'total_horas' THEN p_payload->>'total_horas' ELSE registros_ponto.total_horas END,
        horas_trabalhadas = CASE WHEN p_payload ? 'horas_trabalhadas' THEN p_payload->>'horas_trabalhadas' ELSE registros_ponto.horas_trabalhadas END,
        horas_extras = CASE WHEN p_payload ? 'horas_extras' THEN p_payload->>'horas_extras' ELSE registros_ponto.horas_extras END,
        horas_faltas = CASE WHEN p_payload ? 'horas_faltas' THEN p_payload->>'horas_faltas' ELSE registros_ponto.horas_faltas END,
        status = coalesce(p_payload->>'status', registros_ponto.status),
        status_processamento = coalesce(p_payload->>'status_processamento', registros_ponto.status_processamento),
        origem = coalesce(p_payload->>'origem', registros_ponto.origem),
        importacao_id = coalesce((p_payload->>'importacao_id')::UUID, registros_ponto.importacao_id),
        chave_importacao = coalesce(p_payload->>'chave_importacao', registros_ponto.chave_importacao),
        observacoes = coalesce(p_payload->>'observacoes', registros_ponto.observacoes),
        updated_at = now()
    WHERE id = p_registro_id
      AND tenant_id = p_tenant_id
      AND upper(coalesce(status_processamento, '')) NOT IN ('PROCESSADO', 'FECHADO')
      AND upper(coalesce(status, '')) NOT IN ('PROCESSADO', 'FECHADO')
    RETURNING * INTO v_updated;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'status', 'CONCORRENCIA_DETECTADA',
            'message', 'Ponto sofreu transição concorrente no momento do update.'
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'ATUALIZADO',
        'id', v_updated.id,
        'status_processamento', v_updated.status_processamento,
        'updated_at', v_updated.updated_at
    );
END;
$$;

-- 4. Permissões estritas: Menor Privilégio
REVOKE ALL ON FUNCTION public.fn_rh_competencia_lock_key(UUID, UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_rh_competencia_lock_key(UUID, UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_rh_competencia_lock_key(UUID, UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_atualizar_ponto_se_competencia_aberta(UUID, UUID, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_atualizar_ponto_se_competencia_aberta(UUID, UUID, UUID, TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_atualizar_ponto_se_competencia_aberta(UUID, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_atualizar_ponto_se_competencia_aberta(UUID, UUID, UUID, TEXT, JSONB) TO service_role;
