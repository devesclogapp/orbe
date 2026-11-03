-- ==============================================================================
-- CONSULTAS DE VALIDAÇÃO PÓS-APLICAÇÃO — P0-02 (SOMENTE LEITURA)
-- ==============================================================================

-- 1. Confirma existência da coluna lote_devolvido_origem_id
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'lancamentos_intermitentes' 
  AND column_name = 'lote_devolvido_origem_id';

-- 2. Confirma existência das RPCs no catálogo
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('rpc_rh_retificar_intermitente', 'rpc_rh_revalidar_lote_devolvido');

-- 3. Confirma existência dos Triggers Guardiões
SELECT trigger_name, event_manipulation, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'trg_guard_lancamentos_intermitentes',
    'trg_guard_lancamentos_intermitentes_delete',
    'trg_guard_intermitentes_lotes_delete'
  );

-- 4. Confirma registro no histórico de migrations
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20261012120000';

