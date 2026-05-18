-- ============================================================
-- Migration: 20260547_sync_colaboradores_schema_pre_cadastro.sql
-- Data: 2026-05-17
-- Objetivo: Sincronizar schema da tabela colaboradores com a
--           lógica de pré-cadastro inteligente do motor de pontos.
--
-- Campos adicionados:
--   gera_faturamento BOOLEAN DEFAULT true
--
-- Constraints atualizadas:
--   tipo_contrato CHECK expandido para aceitar valores lowercase
--   usados pelo motor automático de pré-cadastro
-- ============================================================

-- 1. Adicionar coluna gera_faturamento
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS gera_faturamento BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.colaboradores.gera_faturamento IS
  'Indica se o colaborador gera faturamento para o cliente. Default true para CLT, pode ser desativado por RH.';

-- 2. Expandir CHECK de tipo_contrato para aceitar valores do motor automático
-- O motor de pré-cadastro usa lowercase: "mensal", "diaria"
-- O cadastro manual usa capitalizado: "Mensal", "Hora", "Operação"
-- Precisamos aceitar ambos sem quebrar registros existentes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'colaboradores_tipo_contrato_check'
    AND table_name = 'colaboradores'
  ) THEN
    ALTER TABLE public.colaboradores DROP CONSTRAINT colaboradores_tipo_contrato_check;
  END IF;
END $$;

-- Não recriar CHECK restritivo — o campo é livre para aceitar
-- valores do motor automático (mensal, diaria, horista, producao)
-- e do formulário manual (Mensal, Hora, Operação).
-- A validação semântica fica na camada de aplicação.

-- 3. Backfill: garantir que todos os colaboradores existentes tenham gera_faturamento = true
-- (o DEFAULT já cuida, mas para registros que possam ter sido inseridos com NULL via bypass)
UPDATE public.colaboradores
SET gera_faturamento = true
WHERE gera_faturamento IS NULL;

-- 4. Índice para consultas financeiras que filtram por gera_faturamento
CREATE INDEX IF NOT EXISTS idx_colaboradores_gera_faturamento
  ON public.colaboradores (tenant_id, gera_faturamento)
  WHERE gera_faturamento = true;

-- 5. Recarregar schema do PostgREST
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260547_sync_colaboradores_schema_pre_cadastro completed successfully';
END $$;
