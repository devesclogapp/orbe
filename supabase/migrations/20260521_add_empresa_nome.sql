-- Migration: Adicionar campo empresa_nome em registros_ponto
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS empresa_nome TEXT;

COMMENT ON COLUMN public.registros_ponto.empresa_nome IS 'Nome da empresa importado da planilha';