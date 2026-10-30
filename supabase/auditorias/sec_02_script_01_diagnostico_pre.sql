-- ==============================================================================
-- SCRIPT 01: sec_02_script_01_diagnostico_pre.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02.5 - DiagnÃ³stico PrÃ©-Migration (READ-ONLY)
-- FINALIDADE:
--   Consultar o catÃ¡logo PostgreSQL no Supabase antes de aplicar a migration SEC-02.
--   Inspecionar privilÃ©gios efetivos, polÃ­ticas RLS, triggers, colunas e funÃ§Ãµes.
-- MODO: 100% READ-ONLY. NÃƒO EXECUTA DDL NEM DML.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ESTRUTURA DA TABELA public.profiles E COLUNAS EXISTENTES
-- ------------------------------------------------------------------------------
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- ------------------------------------------------------------------------------
-- 2. STATUS DE ROW LEVEL SECURITY (RLS) NA TABELA profiles
-- ------------------------------------------------------------------------------
SELECT 
  schemaname,
  tablename,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_tables t
JOIN pg_namespace n ON n.nspname = t.schemaname
JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = t.tablename
WHERE schemaname = 'public' 
  AND tablename = 'profiles';

-- ------------------------------------------------------------------------------
-- 3. POLÃTICAS RLS ATUALMENTE ATIVAS EM public.profiles
-- ------------------------------------------------------------------------------
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
ORDER BY policyname;

-- ------------------------------------------------------------------------------
-- 4. PRIVILÃ‰GIOS DE TABELA EFETIVOS (TABLE GRANTS) EM public.profiles
-- ------------------------------------------------------------------------------
SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type,
  is_grantable
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY grantee, privilege_type;

-- ------------------------------------------------------------------------------
-- 5. PRIVILÃ‰GIOS EM COLUNAS CRÃTICAS (COLUMN GRANTS) EM public.profiles
-- ------------------------------------------------------------------------------
SELECT 
  grantee,
  table_schema,
  table_name,
  column_name,
  privilege_type,
  is_grantable
FROM information_schema.column_privileges
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name IN ('id', 'user_id', 'tenant_id', 'role', 'created_at', 'full_name', 'phone')
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY column_name, grantee, privilege_type;

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS ATIVAS NA TABELA public.profiles
-- ------------------------------------------------------------------------------
SELECT 
  trigger_name,
  event_manipulation,
  action_orientation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'profiles'
ORDER BY trigger_name, event_manipulation;

-- ------------------------------------------------------------------------------
-- 7. FUNÃ‡Ã•ES DE AUTORIZAÃ‡ÃƒO E SEGURANÃ‡A MULTI-TENANT
-- ------------------------------------------------------------------------------
SELECT 
  p.proname AS function_name,
  pg_get_userbyid(p.proowner) AS owner_name,
  p.prosecdef AS is_security_definer,
  p.provolatile AS volatility,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  array_to_string(p.proconfig, ', ') AS search_path_config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'current_tenant_id',
    'can_view_tenant_profiles',
    'protect_profile_sensitive_fields',
    'protect_profile_insert',
    'protect_profile_delete',
    'accept_tenant_invitation',
    'admin_update_user_access',
    'admin_require_tenant_admin'
  )
ORDER BY p.proname;

-- ------------------------------------------------------------------------------
-- 8. PRIVILÃ‰GIOS DE EXECUÃ‡ÃƒO NAS FUNÃ‡Ã•ES DE SEGURANÃ‡A (ROUTINE PRIVILEGES)
-- ------------------------------------------------------------------------------
SELECT 
  routine_name,
  routine_schema,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE specific_schema = 'public'
  AND routine_name IN (
    'current_tenant_id',
    'can_view_tenant_profiles',
    'accept_tenant_invitation',
    'admin_update_user_access'
  )
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY routine_name, grantee;

-- ------------------------------------------------------------------------------
-- 9. INTEGRIDADE REFERENCIAL: DEPENDÃŠNCIAS DE FOREIGN KEY PARA profiles
-- ------------------------------------------------------------------------------
SELECT 
  tc.constraint_name,
  tc.table_schema,
  tc.table_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (ccu.table_name = 'profiles' OR tc.table_name = 'profiles')
ORDER BY tc.table_name, kcu.column_name;

-- ------------------------------------------------------------------------------
-- 10. CONSTRAINT DE STATUS E PRIVILÃ‰GIOS EM tenant_invitations
-- ------------------------------------------------------------------------------
SELECT 
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE n.nspname = 'public'
  AND t.relname = 'tenant_invitations'
  AND c.conname = 'tenant_invitations_status_check';

SELECT 
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' 
  AND table_name = 'tenant_invitations'
  AND grantee IN ('anon', 'authenticated', 'service_role', 'PUBLIC')
ORDER BY grantee, privilege_type;





