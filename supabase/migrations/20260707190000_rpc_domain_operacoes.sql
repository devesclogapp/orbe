-- Migration: Fase 5 Domain Hardening - Etapa 01 (Operacoes RPCs)
-- Substitui chamadas diretas client-side por RPCs seguras com controle de Concorrência e Imutabilidade.

-- 1. RPC para Aprovação Segura (Validar e Aprovar)
CREATE OR REPLACE FUNCTION public.rpc_operacao_validar_aprovar(
    p_operacao_id UUID,
    p_updated_at_frontend TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
BEGIN
    -- 1. Row Lock (Prevenir Race Conditions)
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    -- 2. Concorrência Mandatória (OCC)
    IF p_updated_at_frontend IS NULL OR v_operacao.updated_at != p_updated_at_frontend THEN
        RAISE EXCEPTION 'CONCURRENCY_CONFLICT: O registro de operação % alterou na base desde a sua última leitura.', p_operacao_id;
    END IF;

    -- 3. Imutabilidade
    IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO', 'RECEBIDO_FINANCEIRO', 'CONCILIADO') THEN
        RAISE EXCEPTION 'ESTADO_FECHADO: Operação já vinculada ao fluxo financeiro não pode ser aprovada novamente.';
    END IF;

    -- 4. Efetivar Atualização do Status Operacional
    UPDATE public.operacoes_producao
    SET status = 'AGUARDANDO_FATURAMENTO',
        updated_at = v_now,
        atualizado_por = v_user_id
    WHERE id = p_operacao_id;
    
    -- Nota: A tabela operacoes_producao já possui a trigger 'trg_gerar_receita_operacional_automatica' 
    -- acoplada, logo o update para AGUARDANDO_FATURAMENTO gerará a Receita no backend nativamente 
    -- com os cálculos travados do banco.

    RETURN json_build_object('success', true, 'operacao_id', p_operacao_id, 'updated_at', v_now);
END;
$$;


-- 2. RPC para Exclusão Segura
CREATE OR REPLACE FUNCTION public.rpc_operacao_excluir_segura(
    p_operacao_id UUID,
    p_updated_at_frontend TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operacao record;
BEGIN
    SELECT * INTO v_operacao FROM public.operacoes_producao WHERE id = p_operacao_id FOR UPDATE;
    IF NOT FOUND THEN RETURN json_build_object('success', true); END IF;

    IF p_updated_at_frontend IS NULL OR v_operacao.updated_at != p_updated_at_frontend THEN
        RAISE EXCEPTION 'CONCURRENCY_CONFLICT: O registro foi iterado. Atualize para o estado mais recente antes de excluir.';
    END IF;

    -- Imutabilidade
    IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO', 'RECEBIDO_FINANCEIRO', 'CONCILIADO') THEN
        RAISE EXCEPTION 'ESTADO_FECHADO: Operação não pode ser excluída pois o faturamento já foi consolidado. Contate C-Level para reabertura/estorno.';
    END IF;

    DELETE FROM public.operacoes_producao WHERE id = p_operacao_id;

    RETURN json_build_object('success', true, 'deleted_id', p_operacao_id);
END;
$$;


-- 3. RPC para Edição Segura (Mantendo dinâmica de update)
CREATE OR REPLACE FUNCTION public.rpc_operacao_editar_segura(
    p_operacao_id UUID,
    p_updated_at_frontend TIMESTAMPTZ,
    p_payload JSONB
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_status_blocked text[] := ARRAY['AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO', 'RECEBIDO_FINANCEIRO', 'CONCILIADO'];
BEGIN
    SELECT * INTO v_operacao FROM public.operacoes_producao WHERE id = p_operacao_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'OP_NOT_FOUND.'; END IF;

    IF p_updated_at_frontend IS NULL OR v_operacao.updated_at != p_updated_at_frontend THEN
        RAISE EXCEPTION 'CONCURRENCY_CONFLICT.';
    END IF;

    IF v_operacao.status = ANY(v_status_blocked) THEN
        RAISE EXCEPTION 'ESTADO_FECHADO: Operação já faturada/recebida não aceita edições abertas.';
    END IF;

    -- Não permitir bypass de status via payload. Apenas fluxos oficiais alteram status de Workflow.
    IF p_payload ? 'status' THEN
        -- Como "Edição" é de dados e não de transição de pipeline, limpamos status fraudulento
        p_payload := p_payload - 'status'; 
    END IF;

    -- Inject updatedAt
    p_payload := p_payload || jsonb_build_object('updated_at', v_now, 'atualizado_por', auth.uid());

    -- Dynamic Update usando ROW type populate
    UPDATE public.operacoes_producao 
    SET 
        empresa_id = COALESCE((p_payload->>'empresa_id')::uuid, empresa_id),
        unidade_id = COALESCE((p_payload->>'unidade_id')::uuid, unidade_id),
        data_operacao = COALESCE((p_payload->>'data_operacao')::date, data_operacao),
        tipo_operacao = COALESCE((p_payload->>'tipo_operacao')::varchar, tipo_operacao),
        tipo_calculo = COALESCE((p_payload->>'tipo_calculo')::varchar, tipo_calculo),
        volume = COALESCE((p_payload->>'volume')::numeric, volume),
        quantidade = COALESCE((p_payload->>'quantidade')::numeric, quantidade),
        valor_unitario = COALESCE((p_payload->>'valor_unitario')::numeric, valor_unitario),
        -- Campos financeiros sensíveis também serão recalculados pela trigger "trg_calcular_valor_total_operacao_producao"
        horario_inicio = COALESCE((p_payload->>'horario_inicio')::time, horario_inicio),
        horario_fim = COALESCE((p_payload->>'horario_fim')::time, horario_fim),
        placa = COALESCE((p_payload->>'placa')::varchar, placa),
        nf_numero = COALESCE((p_payload->>'nf_numero')::varchar, nf_numero),
        nf_emissao = COALESCE((p_payload->>'nf_emissao')::boolean, nf_emissao),
        observacao = COALESCE((p_payload->>'observacao')::text, observacao),
        updated_at = v_now,
        atualizado_por = auth.uid()
    WHERE id = p_operacao_id;

    RETURN json_build_object('success', true, 'updated_at', v_now);
END;
$$;
