-- Corrigir colunas faltantes na tabela empresas

-- Adicionar coluna convenios_bancario se não existir
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS convenios_bancario TEXT;

-- Adicionar outras colunas que podem estar faltando
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS codigo_empresa_banco TEXT,
ADD COLUMN IF NOT EXISTS nome_empresa_banco TEXT;

-- Atualizar cache do Supabase
NOTIFY supabase_schema_cache, 'reload';