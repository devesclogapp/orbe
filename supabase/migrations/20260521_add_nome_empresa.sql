-- Migration: Adicionar campo nome_empresa em registros_ponto
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS nome_empresa TEXT;

COMMENT ON COLUMN public.registros_ponto.nome_empresa IS 'Nome da empresa importado da planilha';