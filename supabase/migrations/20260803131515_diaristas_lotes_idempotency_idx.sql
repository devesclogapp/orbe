-- Idempotency constraint ensuring that only one active closing batch can exist per company and period combination.
CREATE UNIQUE INDEX IF NOT EXISTS
  uq_diaristas_lote_ativo_periodo
ON diaristas_lotes_fechamento (
  tenant_id,
  empresa_id,
  periodo_inicio,
  periodo_fim
)
WHERE cancelado_em IS NULL;
