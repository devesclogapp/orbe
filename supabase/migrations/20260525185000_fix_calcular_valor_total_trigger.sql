-- ============================================================
-- FIX: Trigger calcular_valor_total_operacao_producao
-- 
-- Problema: o trigger sobrescreve SEMPRE o valor_total calculando
-- apenas (quantidade * valor_unitario_snapshot), ignorando ISS e filme.
-- 
-- O frontend envia valor_total = totalFinal (correto: inclui ISS e filme).
-- O trigger substitui esse valor por um cálculo parcial.
-- 
-- Solução: se o frontend já forneceu valor_total > 0, respeitar esse valor.
-- Calcular automaticamente somente quando valor_total não for informado (= 0 ou NULL).
-- ============================================================

CREATE OR REPLACE FUNCTION public.calcular_valor_total_operacao_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se o frontend já enviou um valor_total > 0, preservar.
  -- O frontend calcula o total completo inclui ISS, filme e demais acréscimos.
  -- O cálculo automático é apenas um fallback para casos sem ISS/filme.
  IF COALESCE(NEW.valor_total, 0) <= 0 THEN
    NEW.valor_total :=
      CASE
        WHEN NEW.tipo_calculo_snapshot = 'colaborador'
          THEN COALESCE(NEW.quantidade_colaboradores, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
        ELSE
          COALESCE(NEW.quantidade, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
      END;
  END IF;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

-- Recriar o trigger (a função já foi atualizada, o trigger permanece o mesmo)
DROP TRIGGER IF EXISTS trg_calcular_valor_total_operacao_producao ON public.operacoes_producao;
CREATE TRIGGER trg_calcular_valor_total_operacao_producao
BEFORE INSERT OR UPDATE OF quantidade, quantidade_colaboradores, valor_unitario_snapshot, tipo_calculo_snapshot
ON public.operacoes_producao
FOR EACH ROW
EXECUTE FUNCTION public.calcular_valor_total_operacao_producao();

NOTIFY pgrst, 'reload schema';
