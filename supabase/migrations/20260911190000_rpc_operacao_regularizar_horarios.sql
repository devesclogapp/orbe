-- ==============================================================================
-- MIGRATION: 20260911190000_rpc_operacao_regularizar_horarios.sql
-- FIX 06.2: Ação Específica Canônica de Regularização Operacional de Horários
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_operacao_regularizar_horarios(
    p_operacao_id UUID,
    p_horario_inicio TEXT,
    p_horario_fim TEXT,
    p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
    v_tenant_id uuid;
    v_avaliacao jsonb;
    v_novo_status text;
    v_novo_status_rh text;
    v_has_outra_restricao boolean := false;
    v_old_inicio text;
    v_old_fim text;
    v_usuario_nome text;
BEGIN
    -- 1. Validação estrita dos parâmetros de horário
    IF p_horario_inicio IS NULL OR trim(p_horario_inicio) = '' OR
       p_horario_fim IS NULL OR trim(p_horario_fim) = '' THEN
        RAISE EXCEPTION 'HORARIOS_INVALIDOS: Horário de início e término são obrigatórios.';
    END IF;

    -- 2. Lock pessimista no registro da operação
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    v_tenant_id := v_operacao.tenant_id;
    v_old_inicio := v_operacao.entrada_ponto;
    v_old_fim := v_operacao.saida_ponto;

    -- 3. Saneamento do avaliacao_json: remover estritamente a restrição de horário
    IF v_operacao.avaliacao_json IS NOT NULL THEN
        v_avaliacao := v_operacao.avaliacao_json;
        IF v_avaliacao->>'motivo_restricao' = 'Horário de início e/ou término não informado' THEN
            v_avaliacao := v_avaliacao - 'motivo_restricao';
        END IF;
    ELSE
        v_avaliacao := '{}'::jsonb;
    END IF;

    -- 4. Verificar se existe outra restrição remanescente que impeça a liberação
    IF (v_avaliacao->>'motivo_restricao' IS NOT NULL AND v_avaliacao->>'motivo_restricao' != '') OR
       (v_avaliacao->>'motivo_devolucao_rh' IS NOT NULL AND v_avaliacao->>'motivo_devolucao_rh' != '') OR
       v_operacao.status_rh = 'DEVOLVIDO_RH' THEN
        v_has_outra_restricao := true;
    END IF;

    -- 5. Determinação de status com regra estrita de preservação do fluxo
    -- Se status atual for EM_RESTRICAO e não houver outra restrição: transita para RECEBIDO
    -- Se status atual já estiver em estágio posterior (AGUARDANDO_FATURAMENTO, FATURADO, RECEBIDO_FINANCEIRO): PRESERVA status atual
    IF v_has_outra_restricao THEN
        v_novo_status := 'EM_RESTRICAO';
        v_novo_status_rh := COALESCE(v_operacao.status_rh, 'PENDENTE_RH');
    ELSIF v_operacao.status = 'EM_RESTRICAO' THEN
        v_novo_status := 'RECEBIDO';
        v_novo_status_rh := COALESCE(v_operacao.status_rh, 'PENDENTE_RH');
    ELSE
        v_novo_status := v_operacao.status;
        v_novo_status_rh := COALESCE(v_operacao.status_rh, 'PENDENTE_RH');
    END IF;

    -- 6. Atualização atômica exclusiva dos campos autorizados
    UPDATE public.operacoes_producao
    SET entrada_ponto = trim(p_horario_inicio),
        saida_ponto = trim(p_horario_fim),
        justificativa_retroativa = COALESCE(p_justificativa, justificativa_retroativa),
        avaliacao_json = v_avaliacao,
        status = v_novo_status,
        status_rh = v_novo_status_rh,
        atualizado_em = v_now
    WHERE id = p_operacao_id;

    -- 7. Registro de auditoria institucional
    BEGIN
        SELECT nome INTO v_usuario_nome FROM public.perfis_usuarios WHERE user_id = v_user_id LIMIT 1;
        INSERT INTO public.audit_log (
            tenant_id,
            empresa_id,
            usuario_id,
            usuario_nome,
            acao,
            entidade,
            registro_id,
            descricao,
            valor_anterior,
            valor_novo,
            origem
        ) VALUES (
            v_tenant_id,
            v_operacao.empresa_id,
            v_user_id,
            v_usuario_nome,
            'REGULARIZACAO_HORARIOS',
            'operacoes_producao',
            p_operacao_id,
            COALESCE(p_justificativa, 'Regularização operacional de horários de início e término.'),
            jsonb_build_object(
                'entrada_ponto', v_old_inicio,
                'saida_ponto', v_old_fim,
                'status', v_operacao.status,
                'avaliacao_json', v_operacao.avaliacao_json
            ),
            jsonb_build_object(
                'entrada_ponto', trim(p_horario_inicio),
                'saida_ponto', trim(p_horario_fim),
                'status', v_novo_status,
                'avaliacao_json', v_avaliacao
            ),
            'OPERACIONAL_MODAL'
        );
    EXCEPTION WHEN OTHERS THEN
        -- Fallback: o trigger nativo da tabela operacoes_producao já registra a auditoria
    END;

    RETURN jsonb_build_object(
        'success', true,
        'operacao_id', p_operacao_id,
        'entrada_ponto', trim(p_horario_inicio),
        'saida_ponto', trim(p_horario_fim),
        'status', v_novo_status,
        'status_rh', v_novo_status_rh,
        'updated_at', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_operacao_regularizar_horarios(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;
