-- ==============================================================================
-- ORBE ERP — GATE SE-11-G (Fase 2): MIGRATION FINAL DE HARDENING (NÃO APLICADA)
-- Objetivo: Reforçar o trigger de imutabilidade de Serviços Extras para cobrir
--           o estágio 'APROVADO_OPERACAO' e proteger todos os campos financeiros,
--           materiais, multiplicadores, formas de pagamento e snapshots.
--           Bloqueio universal sem exceções de papel administrativo.
-- ATENÇÃO: NÃO EXECUTAR ESTA MIGRATION SEM AUTORIZAÇÃO EXPRESSA.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.check_imutabilidade_servico_extra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se o serviço já se encontra em APROVADO_OPERACAO, APROVADO_FINANCEIRO, FATURADO ou CONCLUIDO
    IF OLD.pipeline_status IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO', 'CONCLUIDO') THEN
        -- Bloquear qualquer tentativa de modificar campos que definem o valor financeiro ou identificação
        IF NEW.valor_unitario IS DISTINCT FROM OLD.valor_unitario 
           OR NEW.quantidade IS DISTINCT FROM OLD.quantidade 
           OR NEW.total IS DISTINCT FROM OLD.total
           OR NEW.custo_materiais IS DISTINCT FROM OLD.custo_materiais
           OR NEW.materiais_snapshot IS DISTINCT FROM OLD.materiais_snapshot
           OR NEW.empresa_id IS DISTINCT FROM OLD.empresa_id 
           OR NEW.tipo_servico_id IS DISTINCT FROM OLD.tipo_servico_id
           OR NEW.modalidade_financeira IS DISTINCT FROM OLD.modalidade_financeira
           OR NEW.forma_pagamento_id IS DISTINCT FROM OLD.forma_pagamento_id
           OR NEW.regra_id IS DISTINCT FROM OLD.regra_id
           OR NEW.valor_unitario_snapshot IS DISTINCT FROM OLD.valor_unitario_snapshot THEN
            
            -- Bloqueio universal e incondicional contra mutação financeira pós-aprovação
            RAISE EXCEPTION 'REGISTRO_BLOQUEADO: Não é permitido alterar valores, materiais ou dados de cobrança de um serviço extra que já se encontra no estágio %, sob risco de inconsistência com as receitas operacionais geradas.', OLD.pipeline_status;
        END IF;
    END IF;

    -- Permite transições legítimas de status do pipeline, liquidação e carimbo de atualização
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_imutabilidade_servico_extra ON public.servicos_extras_operacionais;
CREATE TRIGGER trg_check_imutabilidade_servico_extra
BEFORE UPDATE ON public.servicos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.check_imutabilidade_servico_extra();

COMMENT ON FUNCTION public.check_imutabilidade_servico_extra() IS 'Hardening transacional fail-closed: Impede alteração de campos financeiros de serviços extras a partir do estágio APROVADO_OPERACAO.';
