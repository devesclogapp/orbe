-- ==============================================================================
-- MIGRATION: 20260930140000_banco_horas_regras_vigencia_e_adicional.sql
-- DOMÍNIO: RH / CLT - FIX CP04.10: REGRAS DE BANCO DE HORAS (GATE 3)
-- OBJETIVO: Adicionar vigência temporal (vigencia_inicio, vigencia_fim) e
--           percentual de adicional de hora extra (adicional_hora_extra_percentual)
--           à entidade existente banco_horas_regras.
-- ==============================================================================

ALTER TABLE public.banco_horas_regras
  ADD COLUMN IF NOT EXISTS vigencia_inicio DATE NOT NULL DEFAULT '2026-01-01',
  ADD COLUMN IF NOT EXISTS vigencia_fim DATE,
  ADD COLUMN IF NOT EXISTS adicional_hora_extra_percentual NUMERIC(5,2) NOT NULL DEFAULT 50.00;

COMMENT ON COLUMN public.banco_horas_regras.vigencia_inicio IS 'Início da vigência da política de banco de horas (inclusive)';
COMMENT ON COLUMN public.banco_horas_regras.vigencia_fim IS 'Término da vigência da política (inclusive). Null = vigência indeterminada/vigente';
COMMENT ON COLUMN public.banco_horas_regras.adicional_hora_extra_percentual IS 'Percentual do adicional de horas extras (ex: 50.00 para 50%, 100.00 para 100%)';

-- 1. Validação de consistência temporal da vigência
ALTER TABLE public.banco_horas_regras
  DROP CONSTRAINT IF EXISTS chk_bh_regras_vigencia,
  ADD CONSTRAINT chk_bh_regras_vigencia CHECK (vigencia_fim IS NULL OR vigencia_fim >= vigencia_inicio);

-- 2. Validação do percentual de adicional (não-negativo)
ALTER TABLE public.banco_horas_regras
  DROP CONSTRAINT IF EXISTS chk_bh_regras_adicional_he,
  ADD CONSTRAINT chk_bh_regras_adicional_he CHECK (adicional_hora_extra_percentual >= 0);

-- 3. Índice composto para aceleração de resolução temporal por escopo
CREATE INDEX IF NOT EXISTS idx_bh_regras_vigencia_busca
  ON public.banco_horas_regras (tenant_id, empresa_id, vigencia_inicio, vigencia_fim);
