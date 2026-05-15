-- Entrega oficial do RH para o Financeiro via lotes por competencia.

CREATE TABLE IF NOT EXISTS public.rh_financeiro_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  competencia VARCHAR(7) NOT NULL,
  origem TEXT NOT NULL DEFAULT 'RH',
  tipo TEXT NOT NULL CHECK (tipo IN ('BANCO_HORAS', 'FOLHA_VARIAVEL')),
  status TEXT NOT NULL DEFAULT 'AGUARDANDO_FINANCEIRO' CHECK (status IN ('AGUARDANDO_FINANCEIRO', 'EM_ANALISE', 'CONCLUIDO', 'CANCELADO')),
  total_colaboradores INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  criado_por UUID NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT rh_financeiro_lotes_competencia_origem_unq UNIQUE (tenant_id, empresa_id, competencia, origem, tipo)
);

CREATE TABLE IF NOT EXISTS public.rh_financeiro_lote_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES public.rh_financeiro_lotes(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  colaborador_id UUID NULL REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  nome_colaborador TEXT NOT NULL,
  tipo_evento TEXT NOT NULL,
  minutos INTEGER NULL,
  horas NUMERIC(10,2) NULL,
  valor_calculado NUMERIC(14,2) NOT NULL DEFAULT 0,
  origem_evento TEXT NOT NULL,
  referencia_evento_id UUID NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANALISE', 'APROVADO', 'REJEITADO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lotes_tenant_status
  ON public.rh_financeiro_lotes (tenant_id, status, competencia DESC);

CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lotes_empresa_competencia
  ON public.rh_financeiro_lotes (empresa_id, competencia DESC);

CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lote_itens_lote
  ON public.rh_financeiro_lote_itens (lote_id, status);

CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lote_itens_tenant_colaborador
  ON public.rh_financeiro_lote_itens (tenant_id, colaborador_id);

ALTER TABLE public.rh_financeiro_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rh_financeiro_lote_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_financeiro_lotes_tenant_all" ON public.rh_financeiro_lotes;
CREATE POLICY "rh_financeiro_lotes_tenant_all"
ON public.rh_financeiro_lotes
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "rh_financeiro_lote_itens_tenant_all" ON public.rh_financeiro_lote_itens;
CREATE POLICY "rh_financeiro_lote_itens_tenant_all"
ON public.rh_financeiro_lote_itens
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_rh_financeiro_lotes ON public.rh_financeiro_lotes;
CREATE TRIGGER trg_auto_tenant_rh_financeiro_lotes
  BEFORE INSERT ON public.rh_financeiro_lotes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_rh_financeiro_lote_itens ON public.rh_financeiro_lote_itens;
CREATE TRIGGER trg_auto_tenant_rh_financeiro_lote_itens
  BEFORE INSERT ON public.rh_financeiro_lote_itens
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE OR REPLACE FUNCTION public.set_rh_financeiro_lotes_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_financeiro_lotes_updated_at ON public.rh_financeiro_lotes;
CREATE TRIGGER trg_rh_financeiro_lotes_updated_at
  BEFORE UPDATE ON public.rh_financeiro_lotes
  FOR EACH ROW EXECUTE FUNCTION public.set_rh_financeiro_lotes_updated_at();

COMMENT ON TABLE public.rh_financeiro_lotes IS 'Lotes entregues oficialmente pelo RH para tratamento do Financeiro por competencia';
COMMENT ON TABLE public.rh_financeiro_lote_itens IS 'Itens auditaveis que compoem cada lote RH -> Financeiro';

NOTIFY pgrst, 'reload schema';
