-- ============================================================
-- Etapa 2: Financeiro analisa e aprova/devolve lote do RH
-- ============================================================

-- 1. Ampliar o CHECK de status em rh_financeiro_lotes
ALTER TABLE public.rh_financeiro_lotes
  DROP CONSTRAINT IF EXISTS rh_financeiro_lotes_status_check;

ALTER TABLE public.rh_financeiro_lotes
  ADD CONSTRAINT rh_financeiro_lotes_status_check
  CHECK (status IN (
    'AGUARDANDO_FINANCEIRO',
    'EM_ANALISE_FINANCEIRA',
    'APROVADO_FINANCEIRO',
    'DEVOLVIDO_RH',
    'CANCELADO'
  ));

-- 2. Adicionar campos de rastreio de aprovação / devolução
ALTER TABLE public.rh_financeiro_lotes
  ADD COLUMN IF NOT EXISTS analisado_por      UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS analisado_em       TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS aprovado_por       UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS aprovado_em        TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS devolvido_por      UUID NULL REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS devolvido_em       TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS motivo_devolucao   TEXT NULL,
  ADD COLUMN IF NOT EXISTS observacao_financeiro TEXT NULL;

-- 3. Tabela de histórico / log imutável das transições de status
CREATE TABLE IF NOT EXISTS public.rh_financeiro_lote_historico (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lote_id         UUID NOT NULL REFERENCES public.rh_financeiro_lotes(id) ON DELETE CASCADE,
  usuario_id      UUID NULL REFERENCES auth.users(id),
  usuario_nome    TEXT NULL,
  acao            TEXT NOT NULL,              -- INICIOU_ANALISE | APROVOU | DEVOLVEU | CANCELOU
  status_anterior TEXT NULL,
  status_novo     TEXT NOT NULL,
  observacao      TEXT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de performance no log
CREATE INDEX IF NOT EXISTS idx_rh_historico_lote
  ON public.rh_financeiro_lote_historico (lote_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rh_historico_tenant
  ON public.rh_financeiro_lote_historico (tenant_id, created_at DESC);

-- 4. RLS no historico — somente do próprio tenant, append-only
ALTER TABLE public.rh_financeiro_lote_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rh_lote_historico_tenant_select" ON public.rh_financeiro_lote_historico;
CREATE POLICY "rh_lote_historico_tenant_select"
  ON public.rh_financeiro_lote_historico
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "rh_lote_historico_tenant_insert" ON public.rh_financeiro_lote_historico;
CREATE POLICY "rh_lote_historico_tenant_insert"
  ON public.rh_financeiro_lote_historico
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Negar UPDATE e DELETE (log imutável)
DROP POLICY IF EXISTS "rh_lote_historico_no_update" ON public.rh_financeiro_lote_historico;
DROP POLICY IF EXISTS "rh_lote_historico_no_delete" ON public.rh_financeiro_lote_historico;

-- 5. Auto-tenant trigger no historico
DROP TRIGGER IF EXISTS trg_auto_tenant_rh_historico ON public.rh_financeiro_lote_historico;
CREATE TRIGGER trg_auto_tenant_rh_historico
  BEFORE INSERT ON public.rh_financeiro_lote_historico
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- 6. Índice adicional nos lotes para busca por status no financeiro
CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lotes_status_analise
  ON public.rh_financeiro_lotes (tenant_id, status)
  WHERE status IN ('AGUARDANDO_FINANCEIRO', 'EM_ANALISE_FINANCEIRA', 'DEVOLVIDO_RH');

COMMENT ON TABLE public.rh_financeiro_lote_historico IS 'Log imutavel de transicoes de status dos lotes RH->Financeiro. Append-only.';
COMMENT ON COLUMN public.rh_financeiro_lotes.motivo_devolucao IS 'Motivo obrigatorio quando Financeiro devolve lote ao RH';
COMMENT ON COLUMN public.rh_financeiro_lotes.observacao_financeiro IS 'Observacao opcional do analista financeiro ao aprovar';

NOTIFY pgrst, 'reload schema';
