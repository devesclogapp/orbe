-- ==============================================================================
-- SCRIPT 05: sec_02_script_05_auditoria_pos.sql (VERSÃO DEFINITIVA CONSOLIDADA)
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02.5 - Auditoria Pós-Migration (READ-ONLY)
-- FINALIDADE:
--   Comprovar formalmente a aplicação da migration SEC-02 no PostgreSQL 17.
--   Audita os 13 critérios em uma ÚNICA consulta tabular autônoma no Supabase Studio.
-- MODO: 100% READ-ONLY. NÃO CRIA TABELAS TEMPORÁRIAS. SEM DEPENDÊNCIAS DE SESSÃO.
-- ==============================================================================

WITH audit_checks AS (
  -- Check 1: RLS habilitada
  SELECT 
    1 AS ordem,
    '1. RLS em public.profiles' AS item,
    'Habilitada' AS esperado,
    CASE 
      WHEN COUNT(*) = 0 THEN 'TABELA NÃO ENCONTRADA'
      WHEN bool_and(rowsecurity) THEN 'Habilitada' 
      ELSE 'DESABILITADA' 
    END AS obtido,
    (COUNT(*) > 0 AND bool_and(rowsecurity = true)) AS conforme
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename = 'profiles'

  UNION ALL

  -- Check 2: Ausência de privilégios de tabela perigosos para authenticated
  SELECT 
    2,
    '2. Privilégios de Tabela para authenticated',
    'Apenas SELECT',
    COALESCE(string_agg(privilege_type, ', ' ORDER BY privilege_type), 'Nenhum'),
    (COALESCE(string_agg(privilege_type, ', ' ORDER BY privilege_type), '') = 'SELECT')
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND grantee = 'authenticated'

  UNION ALL

  -- Check 3: Zero privilégios de tabela para anon
  SELECT 
    3,
    '3. Privilégios de Tabela para anon',
    'Nenhum',
    COALESCE(string_agg(privilege_type, ', ' ORDER BY privilege_type), 'Nenhum'),
    (COUNT(*) = 0)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND grantee = 'anon'

  UNION ALL

  -- Check 4: Coluna role sem privilégio de UPDATE para authenticated
  SELECT 
    4,
    '4. UPDATE na coluna role para authenticated',
    'Bloqueado (0 grants)',
    CASE WHEN COUNT(*) = 0 THEN 'Bloqueado (0 grants)' ELSE 'VULNERÁVEL (' || COUNT(*) || ' grants)' END,
    (COUNT(*) = 0)
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'role'
    AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE'

  UNION ALL

  -- Check 5: Coluna tenant_id sem privilégio de UPDATE para authenticated
  SELECT 
    5,
    '5. UPDATE na coluna tenant_id para authenticated',
    'Bloqueado (0 grants)',
    CASE WHEN COUNT(*) = 0 THEN 'Bloqueado (0 grants)' ELSE 'VULNERÁVEL (' || COUNT(*) || ' grants)' END,
    (COUNT(*) = 0)
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name = 'tenant_id'
    AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE'

  UNION ALL

  -- Check 6: Triggers de segurança instaladas em profiles
  SELECT 
    6,
    '6. Triggers de Proteção de Profiles',
    '3 triggers (insert, delete, sensitive_fields)',
    COUNT(*)::text || ' triggers ativas',
    (COUNT(*) = 3)
  FROM information_schema.triggers
  WHERE event_object_schema = 'public' 
    AND event_object_table = 'profiles'
    AND trigger_name IN (
      'trg_protect_profile_insert',
      'trg_protect_profile_delete',
      'trg_protect_profile_sensitive_fields'
    )

  UNION ALL

  -- Check 7: Políticas RLS ativas em profiles
  SELECT 
    7,
    '7. Políticas RLS em profiles',
    'Exatamente profiles_select_policy e profiles_update_own',
    COALESCE(string_agg(policyname, ', ' ORDER BY policyname), 'Nenhuma'),
    (
      COUNT(*) = 2 
      AND bool_and(policyname IN ('profiles_select_policy', 'profiles_update_own'))
    )
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'profiles'

  UNION ALL

  -- Check 8: Função can_view_tenant_profiles existe e é SECURITY DEFINER
  SELECT 
    8,
    '8. Função can_view_tenant_profiles (Anti-Recursão)',
    'Existe, SECURITY DEFINER, search_path = public',
    CASE 
      WHEN COUNT(*) = 0 THEN 'NÃO ENCONTRADA'
      WHEN bool_and(p.prosecdef AND array_to_string(p.proconfig, ', ') ILIKE '%search_path=public%')
        THEN 'Existe, SECURITY DEFINER, search_path = public'
      ELSE 'Incompleta ou insegura'
    END,
    (COUNT(*) > 0 AND bool_and(p.prosecdef AND array_to_string(p.proconfig, ', ') ILIKE '%search_path=public%'))
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'can_view_tenant_profiles'

  UNION ALL

  -- Check 9: current_tenant_id restrita a authenticated/service_role
  SELECT 
    9,
    '9. current_tenant_id restrita a authenticated/service_role',
    'Sem acesso para anon/PUBLIC',
    CASE WHEN COUNT(*) = 0 THEN 'Sem acesso para anon/PUBLIC' ELSE 'VULNERÁVEL (' || COUNT(*) || ' grants)' END,
    (COUNT(*) = 0)
  FROM information_schema.routine_privileges
  WHERE specific_schema = 'public'
    AND routine_name = 'current_tenant_id'
    AND grantee IN ('anon', 'PUBLIC')

  UNION ALL

  -- Check 10: tenant_invitations sem UPDATE/INSERT direto para anon/authenticated
  SELECT 
    10,
    '10. tenant_invitations sem mutação direta por clientes',
    'Apenas SELECT para authenticated (0 mutações)',
    CASE WHEN COUNT(*) = 0 THEN 'Apenas SELECT para authenticated (0 mutações)' ELSE 'VULNERÁVEL (' || COUNT(*) || ' grants)' END,
    (COUNT(*) = 0)
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'tenant_invitations' 
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')

  UNION ALL

  -- Check 11: Constraint tenant_invitations_status_check inclui 'em_processamento'
  SELECT 
    11,
    '11. Constraint tenant_invitations_status_check',
    'Inclui em_processamento no conjunto permitido',
    CASE 
      WHEN COUNT(*) = 0 THEN 'NÃO ENCONTRADA'
      WHEN bool_and(pg_get_constraintdef(c.oid) ILIKE '%em_processamento%') THEN 'Atualizada com em_processamento'
      ELSE 'INCOMPATÍVEL / BLOQUEANTE'
    END,
    (COUNT(*) > 0 AND bool_and(pg_get_constraintdef(c.oid) ILIKE '%em_processamento%'))
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'tenant_invitations'
    AND c.conname = 'tenant_invitations_status_check'

  UNION ALL

  -- Check 12: Trigger trg_protect_tenant_invitations_state instalada e ativa (UPDATE e DELETE)
  SELECT 
    12,
    '12. Trigger trg_protect_tenant_invitations_state',
    'Ativa (O), não-interna, eventos UPDATE e DELETE',
    CASE 
      WHEN COUNT(*) = 1 AND bool_and(tg.tgenabled = 'O' AND NOT tg.tgisinternal AND (tg.tgtype::integer & 16) <> 0 AND (tg.tgtype::integer & 8) <> 0)
        THEN 'Ativa (O), eventos UPDATE e DELETE confirmados'
      WHEN COUNT(*) = 0 THEN 'NÃO ENCONTRADA'
      ELSE 'CONFIGURAÇÃO INCOMPLETA (' || COUNT(*)::text || ' encontrada, status=' || COALESCE(max(tg.tgenabled), 'NULL') || ')'
    END,
    (
      COUNT(*) = 1 
      AND bool_and(tg.tgenabled = 'O' AND NOT tg.tgisinternal AND (tg.tgtype::integer & 16) <> 0 AND (tg.tgtype::integer & 8) <> 0)
    )
  FROM pg_trigger tg
  JOIN pg_class c ON tg.tgrelid = c.oid
  JOIN pg_namespace n ON c.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND c.relname = 'tenant_invitations'
    AND tg.tgname = 'trg_protect_tenant_invitations_state'

  UNION ALL

  -- Check 13: Função admin_delete_tenant_invitation existe, é SECURITY DEFINER, search_path=public, sem acesso anon/PUBLIC
  SELECT 
    13,
    '13. Função admin_delete_tenant_invitation',
    'Existe, SECURITY DEFINER, search_path=public, restrita',
    CASE 
      WHEN COUNT(*) = 0 THEN 'NÃO ENCONTRADA'
      WHEN bool_and(
        p.prosecdef 
        AND array_to_string(p.proconfig, ', ') ILIKE '%search_path=public%'
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.routine_privileges 
          WHERE specific_schema = 'public' AND routine_name = 'admin_delete_tenant_invitation' AND grantee IN ('anon', 'PUBLIC')
        )
      ) THEN 'Existe, SECURITY DEFINER, search_path=public, restrita'
      ELSE 'CONFIGURAÇÃO INSEGURA OU INCOMPLETA'
    END,
    (
      COUNT(*) > 0 AND bool_and(
        p.prosecdef 
        AND array_to_string(p.proconfig, ', ') ILIKE '%search_path=public%'
        AND NOT EXISTS (
          SELECT 1 FROM information_schema.routine_privileges 
          WHERE specific_schema = 'public' AND routine_name = 'admin_delete_tenant_invitation' AND grantee IN ('anon', 'PUBLIC')
        )
      )
    )
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'admin_delete_tenant_invitation'
),
scorecard AS (
  SELECT 
    ordem,
    item,
    esperado,
    obtido,
    conforme,
    CASE WHEN conforme THEN 'APROVADO [PASS]' ELSE 'REPROVADO [FAIL]' END AS status_final
  FROM audit_checks
),
resumo AS (
  SELECT 
    14 AS ordem,
    '14. TOTAL DE CRITÉRIOS APROVADOS' AS item,
    '13 de 13 (100%)' AS esperado,
    count(*) FILTER (WHERE conforme)::text || ' de 13 aprovados' AS obtido,
    (count(*) FILTER (WHERE conforme) = 13) AS conforme,
    CASE 
      WHEN count(*) FILTER (WHERE conforme) = 13 THEN 'APROVADO [PASS]'
      ELSE 'REPROVADO [FAIL]'
    END AS status_final
  FROM scorecard

  UNION ALL

  SELECT 
    15 AS ordem,
    '15. TOTAL DE CRITÉRIOS REPROVADOS' AS item,
    '0 (Zero)' AS esperado,
    count(*) FILTER (WHERE NOT conforme)::text || ' reprovado(s)' AS obtido,
    (count(*) FILTER (WHERE NOT conforme) = 0) AS conforme,
    CASE 
      WHEN count(*) FILTER (WHERE NOT conforme) = 0 THEN 'APROVADO [PASS]'
      ELSE 'BLOQUEANTE [FAIL]'
    END AS status_final
  FROM scorecard

  UNION ALL

  SELECT 
    16 AS ordem,
    '=== PARECER FINAL DE HOMOLOGAÇÃO ===' AS item,
    'TODOS OS 13 CRITÉRIOS APROVADOS' AS esperado,
    count(*) FILTER (WHERE conforme)::text || ' Aprovados / ' || count(*) FILTER (WHERE NOT conforme)::text || ' Reprovados' AS obtido,
    bool_and(conforme) AS conforme,
    CASE 
      WHEN bool_and(conforme) THEN 'HOMOLOGADO [APTO]'
      ELSE 'NÃO HOMOLOGADO [BLOQUEANTE]'
    END AS status_final
  FROM scorecard
)
SELECT 
  item,
  esperado,
  obtido,
  status_final
FROM (
  SELECT ordem, item, esperado, obtido, status_final FROM scorecard
  UNION ALL
  SELECT ordem, item, esperado, obtido, status_final FROM resumo
) final_result
ORDER BY ordem;
