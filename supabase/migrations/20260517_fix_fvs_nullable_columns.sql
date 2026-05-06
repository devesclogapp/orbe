-- ============================================================
-- CORREÇÃO: Tornar colunas de fornecedor_valores_servico opcionais (NULL)
-- Problema: Campos com NOT NULL impedem inserts de regras globais
-- ============================================================

-- Verificar estado atual das colunas
SELECT 
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'fornecedor_valores_servico'
  AND column_name IN ('empresa_id', 'fornecedor_id', 'tipo_servico_id');

-- Tornar colunas opcionais se ainda estiverem NOT NULL
ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN empresa_id DROP NOT NULL;

ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN fornecedor_id DROP NOT NULL;

ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN tipo_servico_id DROP NOT NULL;

-- Verificar resultado
SELECT 
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'fornecedor_valores_servico'
  AND column_name IN ('empresa_id', 'fornecedor_id', 'tipo_servico_id');

DO $$
BEGIN
  RAISE NOTICE 'Colunas fornecedor_valores_servico agora sao NULL';
END $$;