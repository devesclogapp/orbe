-- Migration 20260725200500_intermitentes_lotes_idempotency.sql
-- Enforces idempotent batch closures for intermitentes preventing concurrent creations
-- of the same period/company.

CREATE UNIQUE INDEX IF NOT EXISTS intermitentes_lotes_fechamento_idempotency_idx 
ON intermitentes_lotes_fechamento (tenant_id, empresa_id, competencia) 
WHERE status NOT IN ('CANCELADO', 'DEVOLVIDO');
