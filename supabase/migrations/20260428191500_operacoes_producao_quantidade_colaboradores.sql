ALTER TABLE public.operacoes_producao
ADD COLUMN IF NOT EXISTS quantidade_colaboradores INTEGER NOT NULL DEFAULT 1 CHECK (quantidade_colaboradores > 0);

CREATE OR REPLACE FUNCTION public.calcular_valor_total_operacao_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.valor_total :=
    CASE
      WHEN NEW.tipo_calculo_snapshot = 'fixo' THEN COALESCE(NEW.valor_unitario_snapshot, 0)
      WHEN NEW.tipo_calculo_snapshot = 'colaborador' THEN COALESCE(NEW.quantidade_colaboradores, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
      ELSE COALESCE(NEW.quantidade, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
    END;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_valor_total_operacao_producao ON public.operacoes_producao;
CREATE TRIGGER trg_calcular_valor_total_operacao_producao
BEFORE INSERT OR UPDATE OF quantidade, quantidade_colaboradores, valor_unitario_snapshot, tipo_calculo_snapshot
ON public.operacoes_producao
FOR EACH ROW
EXECUTE FUNCTION public.calcular_valor_total_operacao_producao();
