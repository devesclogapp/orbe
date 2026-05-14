-- Ajustes de Processamento RH para regra aplicada e tipo de execucao

ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS regra_aplicada TEXT;

COMMENT ON COLUMN public.registros_ponto.regra_aplicada IS
  'Nome da regra resolvida e aplicada no processamento RH do dia';

ALTER TABLE public.processamento_rh_logs
  ADD COLUMN IF NOT EXISTS tipo_execucao TEXT NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN public.processamento_rh_logs.tipo_execucao IS
  'Origem da execucao do processamento RH: manual ou automatica';
