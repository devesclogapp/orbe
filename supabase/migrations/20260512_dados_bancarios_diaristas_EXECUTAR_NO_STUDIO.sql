-- ============================================================
-- EXECUTAR NO SUPABASE STUDIO > SQL EDITOR
-- URL: https://supabase.com/dashboard/project/[seu-projeto]/sql
-- ============================================================
-- Migration: Dados Bancários de Diaristas
-- Objetivo: Adicionar colunas bancárias à tabela colaboradores
-- para viabilizar geração de CNAB240 com dados reais.
-- ============================================================

-- 1. Adicionar colunas (IF NOT EXISTS = idempotente, seguro re-executar)
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS banco_codigo    TEXT,
  ADD COLUMN IF NOT EXISTS agencia         TEXT,
  ADD COLUMN IF NOT EXISTS agencia_digito  TEXT,
  ADD COLUMN IF NOT EXISTS conta           TEXT,
  ADD COLUMN IF NOT EXISTS digito_conta    TEXT,
  ADD COLUMN IF NOT EXISTS tipo_conta      TEXT DEFAULT 'corrente',
  ADD COLUMN IF NOT EXISTS nome_completo   TEXT,
  ADD COLUMN IF NOT EXISTS observacoes     TEXT;

-- 2. Índice de performance para busca de diaristas com banco
CREATE INDEX IF NOT EXISTS idx_colaboradores_banco_codigo
  ON public.colaboradores (empresa_id, banco_codigo)
  WHERE tipo_colaborador = 'DIARISTA' AND deleted_at IS NULL;

-- 3. Comentários das colunas
COMMENT ON COLUMN public.colaboradores.banco_codigo   IS 'Código do banco FEBRABAN (ex: 341=Itaú, 033=Santander, 756=Sicoob)';
COMMENT ON COLUMN public.colaboradores.agencia        IS 'Número da agência (sem dígito)';
COMMENT ON COLUMN public.colaboradores.agencia_digito IS 'Dígito verificador da agência';
COMMENT ON COLUMN public.colaboradores.conta          IS 'Número da conta corrente/poupança (sem dígito)';
COMMENT ON COLUMN public.colaboradores.digito_conta   IS 'Dígito verificador da conta';
COMMENT ON COLUMN public.colaboradores.tipo_conta     IS 'Tipo: corrente ou poupanca';
COMMENT ON COLUMN public.colaboradores.nome_completo  IS 'Nome completo como consta na conta bancária (para CNAB)';
COMMENT ON COLUMN public.colaboradores.observacoes    IS 'Observações internas sobre o colaborador';

-- 4. Verificação — deve retornar as colunas criadas
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'colaboradores'
  AND column_name IN ('banco_codigo','agencia','agencia_digito','conta','digito_conta','tipo_conta','nome_completo','observacoes')
ORDER BY column_name;
