-- ==============================================================================
-- MIGRATION: 20261112120000_gate_rh_02a_registros_ponto_idempotencia.sql
-- DEMANDA: GATE-RH-02A — Integridade e Idempotência de Pontos CLT
-- STATUS: PENDENTE DE AUTORIZAÇÃO (NÃO EXECUTADA EM PRODUÇÃO)
--
-- JUSTIFICATIVA:
--   A migration 20260709215000 criou `uix_registros_ponto_chave_importacao_tenant`
--   como índice único parcial (`WHERE chave_importacao IS NOT NULL`), o que
--   inviabiliza `ON CONFLICT (tenant_id, chave_importacao)` no PostgreSQL/PostgREST
--   (erro 42P10). Uma constraint UNIQUE padrão em `(tenant_id, chave_importacao)`
--   continua permitindo múltiplos registros legados com `chave_importacao IS NULL`
--   (NULLs são distintos em UNIQUE no PostgreSQL) e blinda contra race conditions
--   em inserções simultâneas.
--
-- IMPACTO:
--   - Não altera fórmulas, status ou dados existentes.
--   - Requer verificação prévia de inexistência de duplicatas não-nulas de
--     `(tenant_id, chave_importacao)` antes da aplicação.
-- ==============================================================================

BEGIN;

-- 1. Índice de suporte para lookup lógico na ingestão controlada
CREATE INDEX IF NOT EXISTS idx_registros_ponto_tenant_emp_colab_data
  ON public.registros_ponto (tenant_id, empresa_id, colaborador_id, data);

-- 2. Substituir índice único parcial por constraint UNIQUE não-parcial
--    (preserva múltiplos NULLs para registros legados sem chave_importacao)
DROP INDEX IF EXISTS public.uix_registros_ponto_chave_importacao_tenant;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_registros_ponto_tenant_chave_importacao'
      AND conrelid = 'public.registros_ponto'::regclass
  ) THEN
    ALTER TABLE public.registros_ponto
      ADD CONSTRAINT uq_registros_ponto_tenant_chave_importacao
      UNIQUE (tenant_id, chave_importacao);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;

