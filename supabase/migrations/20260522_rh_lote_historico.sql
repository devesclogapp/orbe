-- Migration: Criar tabela de histórico de lotes RH → Financeiro
-- Usada pelo RHFinanceiroService para rastrear ações de aprovação, devolução e análise

CREATE TABLE IF NOT EXISTS public.rh_financeiro_lote_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES public.rh_financeiro_lotes(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id),
  usuario_nome TEXT,
  acao TEXT NOT NULL,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rh_lote_historico_lote
  ON public.rh_financeiro_lote_historico(lote_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rh_lote_historico_tenant
  ON public.rh_financeiro_lote_historico(tenant_id, created_at DESC);

ALTER TABLE public.rh_financeiro_lote_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_lote_historico_tenant_all" ON public.rh_financeiro_lote_historico;
CREATE POLICY "rh_lote_historico_tenant_all"
  ON public.rh_financeiro_lote_historico
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_rh_lote_historico ON public.rh_financeiro_lote_historico;
CREATE TRIGGER trg_auto_tenant_rh_lote_historico
  BEFORE INSERT ON public.rh_financeiro_lote_historico
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

COMMENT ON TABLE public.rh_financeiro_lote_historico IS 'Histórico auditável de ações em lotes RH → Financeiro (aprovação, devolução, análise)';

NOTIFY pgrst, 'reload schema';
