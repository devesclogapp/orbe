
-- 1. Routines
SELECT
  routine_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'rpc_registrar_cnab_remessa',
    'rpc_aplicar_cnab_retorno'
  );

-- 2. Tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'cnab_remessas_arquivos',
    'cnab_remessa_itens',
    'cnab_retorno_arquivos',
    'cnab_retorno_itens'
  );

-- 3. Columns
SELECT
  table_name,
  column_name,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'cnab_remessas_arquivos',
    'cnab_remessa_itens',
    'cnab_retorno_arquivos'
  )
  AND column_name IN (
    'tenant_id',
    'empresa_id',
    'hash_arquivo',
    'conta_bancaria_id'
  )
ORDER BY table_name, column_name;

-- 4. Indexes
SELECT
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    tablename LIKE 'cnab_%'
    OR indexname LIKE '%cnab%'
  )
ORDER BY tablename, indexname;

-- 5. RPC Security
SELECT
  n.nspname AS schema_name,
  p.proname AS function_name,
  p.prosecdef AS security_definer,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'rpc_registrar_cnab_remessa',
    'rpc_aplicar_cnab_retorno'
  );
