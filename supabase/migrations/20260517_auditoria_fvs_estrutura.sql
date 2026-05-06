-- ============================================================
-- AUDITORIA: Estrutura atual de fornecedor_valores_servico
-- ============================================================

-- 1. Listar todas as colunas da tabela
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'fornecedor_valores_servico'
ORDER BY ordinal_position;

-- 2. Listar foreign keys
SELECT
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name = 'fornecedor_valores_servico'
  AND tc.constraint_type = 'FOREIGN KEY';

-- 3. Listar unique indexes
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'fornecedor_valores_servico'
  AND schemaname = 'public'
  AND indexname LIKE '%unique%';

-- 4. Listar RLS policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'fornecedor_valores_servico';

-- 5. Contagem de linhas por tenant
SELECT 
    tenant_id,
    COUNT(*) AS total_regras
FROM fornecedor_valores_servico
GROUP BY tenant_id
ORDER BY tenant_id;