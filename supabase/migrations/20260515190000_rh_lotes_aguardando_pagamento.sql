-- Etapa incremental: preparar lotes RH aprovados para a fila bancaria/CNAB
-- Permite o status AGUARDANDO_PAGAMENTO em rh_financeiro_lotes.

ALTER TABLE public.rh_financeiro_lotes
  DROP CONSTRAINT IF EXISTS rh_financeiro_lotes_status_check;

ALTER TABLE public.rh_financeiro_lotes
  ADD CONSTRAINT rh_financeiro_lotes_status_check
  CHECK (status IN (
    'AGUARDANDO_FINANCEIRO',
    'EM_ANALISE_FINANCEIRA',
    'APROVADO_FINANCEIRO',
    'AGUARDANDO_PAGAMENTO',
    'DEVOLVIDO_RH',
    'CANCELADO'
  ));

CREATE INDEX IF NOT EXISTS idx_rh_financeiro_lotes_status_pagamento
  ON public.rh_financeiro_lotes (tenant_id, status, updated_at DESC)
  WHERE status = 'AGUARDANDO_PAGAMENTO';

COMMENT ON COLUMN public.rh_financeiro_lotes.status IS 'Workflow RH->Financeiro->Bancario: inclui AGUARDANDO_PAGAMENTO para fila CNAB';

NOTIFY pgrst, 'reload schema';
