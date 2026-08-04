BEGIN;

ALTER TABLE public.diaristas_lotes_fechamento
ALTER COLUMN tenant_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
  uq_diaristas_lote_periodo
ON public.diaristas_lotes_fechamento (
  tenant_id,
  empresa_id,
  periodo_inicio,
  periodo_fim
);

COMMIT;
