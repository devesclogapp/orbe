-- ==============================================================================
-- Migration: FIX 07 — Ajuste Final de Escopo em rpc_receita_confirmar_recebimento
-- Objetivo:
-- Ao confirmar uma receita recebida:
-- 1. Manter a atualização normal em receitas_operacionais;
-- 2. Localizar operações vinculadas por receitas_operacionais_itens;
-- 3. Atualizar somente: status_pagamento = 'RECEBIDO', data_pagamento = data real do recebimento;
-- 4. Se status_rh = 'VALIDADO_RH' e sem restrição ativa e status compatível: status = 'CONCLUIDO';
-- 5. Preservar: valor_total, quantidade, forma_pagamento, modalidade, colaboradores, receita, status_rh;
-- 6. DUPLICATA e FATURAMENTO_MENSAL ainda não recebidos permanecem inalterados;
-- 7. Nenhuma alteração em rpc_operacao_validar_aprovar, rpc_rh_aprovar_operacao, fn_gerar_receita_operacional_automatica, MotorFinanceiro, financeiro_consolidados_cliente, RLS.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_receita_confirmar_recebimento(
    p_receita_id UUID,
    p_data_recebimento DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
    v_data_real DATE;
    v_op_ids uuid[];
BEGIN
    SELECT * INTO v_receita FROM public.receitas_operacionais WHERE id = p_receita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REC_NOT_FOUND.'; END IF;

    v_data_real := COALESCE(p_data_recebimento, v_receita.data_recebimento, CURRENT_DATE);

    -- 1. Manter a atualização normal em receitas_operacionais
    IF v_receita.status NOT IN ('recebido', 'conciliado') THEN
        UPDATE public.receitas_operacionais
        SET status = 'recebido', 
            data_recebimento = v_data_real,
            updated_at = v_now
        WHERE id = p_receita_id;

        INSERT INTO public.receitas_operacionais_historico(tenant_id, receita_id, acao, status_anterior, status_novo, usuario_id, detalhes)
        VALUES (
            v_receita.tenant_id, 
            p_receita_id, 
            'CONFIRMAR_RECEBIMENTO', 
            v_receita.status, 
            'recebido', 
            v_user_id, 
            json_build_object('texto', 'Liquidação / Recebimento confirmado com sucesso.', 'data_recebimento', v_data_real)
        );
    END IF;

    -- 2. Localizar operações vinculadas por receitas_operacionais_itens
    SELECT array_agg(operacao_id) INTO v_op_ids
    FROM public.receitas_operacionais_itens
    WHERE receita_id = p_receita_id
      AND operacao_id IS NOT NULL;

    -- 3, 4 e 5. Atualizar operações vinculadas preservando demais campos
    IF v_op_ids IS NOT NULL AND array_length(v_op_ids, 1) > 0 THEN
        UPDATE public.operacoes_producao
        SET 
            status_pagamento = 'RECEBIDO',
            data_pagamento = v_data_real,
            status = CASE 
                WHEN status_rh = 'VALIDADO_RH' 
                     AND status != 'EM_RESTRICAO' 
                     AND status_rh != 'DEVOLVIDO_RH'
                     AND status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'RECEBIDO', 'EM_VALIDACAO', 'CONCLUIDO')
                THEN 'CONCLUIDO'
                ELSE status
            END,
            atualizado_em = v_now
        WHERE id = ANY(v_op_ids);
    END IF;

    RETURN json_build_object(
        'success', true, 
        'status', 'recebido', 
        'data_recebimento', v_data_real,
        'operacoes_afetadas', COALESCE(array_length(v_op_ids, 1), 0),
        'updated_at', v_now
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_receita_confirmar_recebimento(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_confirmar_recebimento(UUID, DATE) TO service_role;
