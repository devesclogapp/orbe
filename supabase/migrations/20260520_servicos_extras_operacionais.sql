-- =============================================================
-- Migration: Serviços Extras Operacionais — Tabela Dedicada
-- Pipeline: Lançamento → Validação → Aprovação → Financeiro → Faturamento → Concluído
-- =============================================================

CREATE TABLE IF NOT EXISTS public.servicos_extras_operacionais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
  empresa_nome TEXT,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo_servico_id UUID REFERENCES public.tipos_servico_operacional(id) ON DELETE SET NULL,
  descricao_servico TEXT NOT NULL,
  quantidade NUMERIC(15, 2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_unitario NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  total NUMERIC(15, 2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT,
  modalidade_financeira TEXT DEFAULT 'CAIXA_IMEDIATO'
    CHECK (modalidade_financeira IN ('CAIXA_IMEDIATO', 'DUPLICATA_FORNECEDOR', 'FECHAMENTO_MENSAL_EMPRESA')),
  data_vencimento DATE,
  status_pagamento TEXT DEFAULT 'PENDENTE'
    CHECK (status_pagamento IN ('PENDENTE', 'RECEBIDO', 'ATRASADO')),
  pipeline_status TEXT DEFAULT 'PENDENTE'
    CHECK (pipeline_status IN (
      'PENDENTE',
      'EM_VALIDACAO',
      'APROVADO_OPERACAO',
      'APROVADO_FINANCEIRO',
      'FATURADO',
      'CONCLUIDO',
      'DEVOLVIDO'
    )),
  justificativa_devolucao TEXT,
  aprovacao_json JSONB,
  nf_numero TEXT,
  responsavel_nome TEXT,
  observacao TEXT,
  operacao_id UUID REFERENCES public.operacoes_producao(id) ON DELETE SET NULL,
  origem_dado TEXT NOT NULL DEFAULT 'manual'
    CHECK (origem_dado IN ('manual', 'importacao', 'ajuste')),
  criado_por UUID DEFAULT auth.uid(),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices estratégicos
CREATE INDEX IF NOT EXISTS idx_servicos_extras_empresa_data
  ON public.servicos_extras_operacionais (empresa_id, data);

CREATE INDEX IF NOT EXISTS idx_servicos_extras_pipeline_status
  ON public.servicos_extras_operacionais (pipeline_status);

CREATE INDEX IF NOT EXISTS idx_servicos_extras_status_pagamento
  ON public.servicos_extras_operacionais (status_pagamento);

CREATE INDEX IF NOT EXISTS idx_servicos_extras_tenant
  ON public.servicos_extras_operacionais (tenant_id);

-- Comments
COMMENT ON TABLE public.servicos_extras_operacionais IS
  'Serviços extras operacionais (lavagem, paletização, carga extra etc.) com pipeline de aprovação completo.';
COMMENT ON COLUMN public.servicos_extras_operacionais.pipeline_status IS
  'Estado atual do fluxo de aprovação: PENDENTE → EM_VALIDACAO → APROVADO_OPERACAO → APROVADO_FINANCEIRO → FATURADO → CONCLUIDO.';
COMMENT ON COLUMN public.servicos_extras_operacionais.justificativa_devolucao IS
  'Justificativa obrigatória em caso de devolução operacional ou financeira.';

-- =============================================================
-- TRIGGER: calcular total automaticamente
-- =============================================================
CREATE OR REPLACE FUNCTION public.calcular_total_servico_extra()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.total := COALESCE(NEW.quantidade, 1) * COALESCE(NEW.valor_unitario, 0);
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_calcular_total_servico_extra ON public.servicos_extras_operacionais;
CREATE TRIGGER trg_calcular_total_servico_extra
BEFORE INSERT OR UPDATE OF quantidade, valor_unitario
ON public.servicos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.calcular_total_servico_extra();

-- TRIGGER: atualizar atualizado_em em qualquer UPDATE
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'update_updated_at_column' AND pg_function_is_visible(oid)
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'update_servicos_extras_operacionais_updated_at'
    ) THEN
      CREATE TRIGGER update_servicos_extras_operacionais_updated_at
      BEFORE UPDATE ON public.servicos_extras_operacionais
      FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
    END IF;
  END IF;
END $$;

-- TRIGGER: auto-set tenant_id
CREATE OR REPLACE FUNCTION public.set_tenant_id_servicos_extras()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NEW.tenant_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.tenant_id INTO v_tenant_id
  FROM public.profiles p
  WHERE p.user_id = auth.uid()
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    NEW.tenant_id := v_tenant_id;
  ELSIF NEW.empresa_id IS NOT NULL THEN
    SELECT e.tenant_id INTO v_tenant_id
    FROM public.empresas e WHERE e.id = NEW.empresa_id LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN
      NEW.tenant_id := v_tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_tenant_id_servicos_extras ON public.servicos_extras_operacionais;
CREATE TRIGGER trg_set_tenant_id_servicos_extras
BEFORE INSERT ON public.servicos_extras_operacionais
FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id_servicos_extras();

-- =============================================================
-- ROW LEVEL SECURITY
-- =============================================================
ALTER TABLE public.servicos_extras_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_servicos_extras_autenticado"
  ON public.servicos_extras_operacionais FOR SELECT TO authenticated USING (true);

CREATE POLICY "insert_servicos_extras_autenticado"
  ON public.servicos_extras_operacionais FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "update_servicos_extras_autenticado"
  ON public.servicos_extras_operacionais FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "delete_servicos_extras_autenticado"
  ON public.servicos_extras_operacionais FOR DELETE TO authenticated
  USING (true);
