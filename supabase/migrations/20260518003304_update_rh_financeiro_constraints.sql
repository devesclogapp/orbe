ALTER TABLE public.rh_financeiro_lotes DROP CONSTRAINT IF EXISTS rh_financeiro_lotes_tipo_check;
ALTER TABLE public.rh_financeiro_lotes ADD CONSTRAINT rh_financeiro_lotes_tipo_check CHECK (tipo IN ('BANCO_HORAS', 'FOLHA_VARIAVEL', 'FOLHA_BASE'));

ALTER TABLE public.rh_financeiro_lotes DROP CONSTRAINT IF EXISTS rh_financeiro_lotes_status_check;
ALTER TABLE public.rh_financeiro_lotes ADD CONSTRAINT rh_financeiro_lotes_status_check CHECK (status IN ('AGUARDANDO_FINANCEIRO', 'EM_ANALISE_FINANCEIRA', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 'CANCELADO', 'DEVOLVIDO_RH', 'PAGO', 'ATRASADO'));
