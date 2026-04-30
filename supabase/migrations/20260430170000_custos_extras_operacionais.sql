CREATE TABLE IF NOT EXISTS public.custos_extras_operacionais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data DATE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  empresa_nome TEXT,
  categoria_custo TEXT NOT NULL
    CHECK (categoria_custo IN ('MERENDA', 'ADMINISTRATIVO', 'OPERACIONAL', 'FORNECEDOR')),
  descricao TEXT NOT NULL,
  valor_unitario NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  quantidade NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  total NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  forma_pagamento TEXT,
  data_vencimento DATE,
  status_pagamento TEXT
    CHECK (status_pagamento IN ('PENDENTE', 'ATRASADO', 'RECEBIDO')),
  operacao_id UUID REFERENCES public.operacoes_producao(id) ON DELETE SET NULL,
  tipo_lancamento TEXT NOT NULL DEFAULT 'DESPESA'
    CHECK (tipo_lancamento IN ('DESPESA')),
  avaliacao_json JSONB,
  origem_dado TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem_dado IN ('manual', 'importacao', 'ajuste')),
  criado_por UUID DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custos_extras_operacionais_empresa_data
  ON public.custos_extras_operacionais (empresa_id, data);

CREATE INDEX IF NOT EXISTS idx_custos_extras_operacionais_categoria
  ON public.custos_extras_operacionais (categoria_custo);

CREATE INDEX IF NOT EXISTS idx_custos_extras_operacionais_status
  ON public.custos_extras_operacionais (status_pagamento);

COMMENT ON TABLE public.custos_extras_operacionais IS 'Despesas extras operacionais importadas ou lancadas manualmente, separadas da base de faturamento.';
COMMENT ON COLUMN public.custos_extras_operacionais.empresa_nome IS 'Nome livre da empresa quando nao houver vinculo direto com o cadastro.';
COMMENT ON COLUMN public.custos_extras_operacionais.operacao_id IS 'Vinculo opcional com a operacao principal.';
COMMENT ON COLUMN public.custos_extras_operacionais.tipo_lancamento IS 'Mantido como DESPESA para distinguir da base operacional.';

CREATE OR REPLACE FUNCTION public.calcular_total_custo_extra_operacional()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := COALESCE(NEW.quantidade, 0) * COALESCE(NEW.valor_unitario, 0);
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_total_custo_extra_operacional ON public.custos_extras_operacionais;
CREATE TRIGGER trg_calcular_total_custo_extra_operacional
BEFORE INSERT OR UPDATE OF quantidade, valor_unitario
ON public.custos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.calcular_total_custo_extra_operacional();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'update_updated_at_column'
      AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_custos_extras_operacionais_updated_at') THEN
      CREATE TRIGGER update_custos_extras_operacionais_updated_at
      BEFORE UPDATE ON public.custos_extras_operacionais
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
  END IF;
END $$;

ALTER TABLE public.custos_extras_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso leitura autenticado custos_extras_operacionais"
  ON public.custos_extras_operacionais FOR SELECT TO authenticated USING (true);

CREATE POLICY "Acesso insert autenticado custos_extras_operacionais"
  ON public.custos_extras_operacionais FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Acesso update autenticado custos_extras_operacionais"
  ON public.custos_extras_operacionais FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Acesso delete autenticado custos_extras_operacionais"
  ON public.custos_extras_operacionais FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.replace_imported_custos_extras_operacionais(
  p_empresa_id UUID,
  p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted_count INTEGER := 0;
BEGIN
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa e obrigatoria para reimportacao de custos extras.';
  END IF;

  DELETE FROM public.custos_extras_operacionais
  WHERE empresa_id = p_empresa_id
    AND origem_dado = 'importacao';

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.custos_extras_operacionais (
    data,
    empresa_id,
    empresa_nome,
    categoria_custo,
    descricao,
    valor_unitario,
    quantidade,
    total,
    forma_pagamento,
    data_vencimento,
    status_pagamento,
    operacao_id,
    tipo_lancamento,
    avaliacao_json,
    origem_dado
  )
  SELECT
    NULLIF(item->>'data', '')::date,
    p_empresa_id,
    NULLIF(item->>'empresa_nome', ''),
    COALESCE(NULLIF(item->>'categoria_custo', ''), 'OPERACIONAL'),
    COALESCE(NULLIF(item->>'descricao', ''), 'Sem descricao'),
    COALESCE((item->>'valor_unitario')::numeric, 0),
    COALESCE((item->>'quantidade')::numeric, 0),
    COALESCE((item->>'total')::numeric, 0),
    NULLIF(item->>'forma_pagamento', ''),
    NULLIF(item->>'data_vencimento', '')::date,
    NULLIF(item->>'status_pagamento', ''),
    NULLIF(item->>'operacao_id', '')::uuid,
    COALESCE(NULLIF(item->>'tipo_lancamento', ''), 'DESPESA'),
    item->'avaliacao_json',
    COALESCE(NULLIF(item->>'origem_dado', ''), 'importacao')
  FROM jsonb_array_elements(p_items) AS item;

  GET DIAGNOSTICS v_inserted_count = ROW_COUNT;
  RETURN v_inserted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_imported_custos_extras_operacionais(UUID, JSONB) TO authenticated;
