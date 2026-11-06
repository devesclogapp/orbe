-- ==============================================================================
-- ORBE ERP - FIX-OCORRÊNCIAS-08: PRECHECK (SOMENTE LEITURA / TABELA ÚNICA)
-- Arquivo: ORBE_FIX08_PRECHECK.sql
-- Execute ANTES de ORBE_FIX08_APLICAR.sql. Nenhum objeto é criado/alterado.
-- Regra: se QUALQUER linha vier com Resultado = 'BLOQUEADO', NÃO aplique.
-- Resultados possíveis: PRESENTE | LIVRE | OK | BLOQUEADO
-- ==============================================================================

WITH
-- 1. Tabelas da migration original (devem existir)
c1 AS (
  SELECT '01. Tabelas do módulo'::text AS verificacao,
         'public.' || t.n AS objeto,
         CASE WHEN to_regclass('public.' || t.n) IS NOT NULL THEN 'PRESENTE' ELSE 'BLOQUEADO' END AS resultado,
         CASE WHEN to_regclass('public.' || t.n) IS NOT NULL
              THEN 'Tabela da migration 20261105220000 encontrada.'
              ELSE 'Migration original não aplicada. FIX08 é incremental.' END AS detalhes
  FROM (VALUES ('infracoes_operacionais_catalogo'),
               ('operacoes_ocorrencias_decisoes'),
               ('operacoes_ocorrencias_eventos_financeiros')) AS t(n)
),
-- 2. Tabelas pai e coluna tenant_id
c2 AS (
  SELECT '02. Tabelas pai / tenant_id'::text,
         'public.' || t.n || '.tenant_id',
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema='public' AND table_name=t.n AND column_name='tenant_id')
              THEN 'OK' ELSE 'BLOQUEADO' END,
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema='public' AND table_name=t.n AND column_name='tenant_id')
              THEN 'Coluna tenant_id disponível para validação cruzada.'
              ELSE 'Coluna tenant_id ausente: validação de tenant impossível.' END
  FROM (VALUES ('empresas'),('colaboradores'),('operacoes_producao'),
               ('user_permissions'),('profiles')) AS t(n)
),
-- 3. current_tenant_id(): implementação real
c3 AS (
  SELECT '03. current_tenant_id()'::text,
         'public.current_tenant_id()',
         CASE WHEN p.oid IS NULL THEN 'BLOQUEADO'
              WHEN p.prorettype <> 'uuid'::regtype THEN 'BLOQUEADO'
              WHEN NOT p.prosecdef THEN 'BLOQUEADO'
              WHEN p.prosrc !~* 'profiles' THEN 'BLOQUEADO'
              WHEN NOT has_function_privilege('authenticated', p.oid, 'EXECUTE') THEN 'BLOQUEADO'
              ELSE 'OK' END,
         CASE WHEN p.oid IS NULL THEN 'Função ausente.'
              ELSE 'retorno=' || p.prorettype::regtype::text
                   || ' | security_definer=' || p.prosecdef::text
                   || ' | deriva_de_profiles=' || (p.prosrc ~* 'profiles')::text
                   || ' | execute_authenticated=' || has_function_privilege('authenticated', p.oid, 'EXECUTE')::text
                   || ' | anon_execute=' || has_function_privilege('anon', p.oid, 'EXECUTE')::text END
  FROM (SELECT 1) AS base
  LEFT JOIN LATERAL (
    SELECT pr.* FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
    WHERE n.nspname='public' AND pr.proname='current_tenant_id' AND pr.pronargs=0 LIMIT 1
  ) p ON true
),
-- 4. get_user_role()
c4 AS (
  SELECT '04. get_user_role()'::text,
         'public.get_user_role()',
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
                           WHERE n.nspname='public' AND pr.proname='get_user_role'
                             AND pr.pronargs=0 AND pr.prorettype='text'::regtype)
              THEN 'OK' ELSE 'BLOQUEADO' END,
         'Exigida pelas funções de perfil (retorno text, sem argumentos).'
),
-- 5. Colunas de user_permissions usadas pelas funções de perfil
c5 AS (
  SELECT '05. user_permissions (colunas)'::text,
         'user_permissions.' || t.n,
         CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema='public' AND table_name='user_permissions' AND column_name=t.n)
              THEN 'OK' ELSE 'BLOQUEADO' END,
         'Coluna usada na checagem de perfil por tenant.'
  FROM (VALUES ('user_id'),('tenant_id'),('role'),('status')) AS t(n)
),
-- 6. RLS habilitado
c6 AS (
  SELECT '06. RLS habilitado'::text,
         'public.' || cl.relname,
         CASE WHEN cl.relrowsecurity THEN 'OK' ELSE 'BLOQUEADO' END,
         'relrowsecurity=' || cl.relrowsecurity::text
  FROM pg_class cl
  WHERE cl.relnamespace='public'::regnamespace
    AND cl.relname IN ('infracoes_operacionais_catalogo','operacoes_ocorrencias_decisoes','operacoes_ocorrencias_eventos_financeiros')
),
-- 7. Políticas atuais (informativo: serão substituídas)
c7 AS (
  SELECT '07. Políticas atuais (serão substituídas)'::text,
         pp.tablename || ' -> ' || pp.policyname,
         'OK',
         'cmd=' || pp.cmd || ' | tipo=' || pp.permissive
           || ' | usa_jwt=' || (coalesce(pp.qual,'') ILIKE '%jwt%' OR coalesce(pp.with_check,'') ILIKE '%jwt%')::text
  FROM pg_policies pp
  WHERE pp.schemaname='public'
    AND pp.tablename IN ('infracoes_operacionais_catalogo','operacoes_ocorrencias_decisoes','operacoes_ocorrencias_eventos_financeiros')
),
-- 8. Objetos novos do FIX08 (LIVRE = primeira aplicação; PRESENTE = reexecução segura)
c8 AS (
  SELECT '08. Objetos do FIX08'::text,
         t.n,
         CASE WHEN EXISTS (SELECT 1 FROM pg_proc pr JOIN pg_namespace n ON n.oid=pr.pronamespace
                           WHERE n.nspname='public' AND pr.proname=t.n)
              THEN 'PRESENTE' ELSE 'LIVRE' END,
         'Função: CREATE OR REPLACE (reexecução segura).'
  FROM (VALUES ('fn_ocorrencias_perfil_gestao'),('fn_ocorrencias_perfil_financeiro'),
               ('fn_ocorrencias_validar_tenant_catalogo'),
               ('fn_ocorrencias_validar_tenant_decisao'),
               ('fn_ocorrencias_validar_tenant_evento')) AS t(n)
  UNION ALL
  SELECT '08. Objetos do FIX08',
         t.n,
         CASE WHEN EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgname=t.n AND NOT tg.tgisinternal)
              THEN 'PRESENTE' ELSE 'LIVRE' END,
         'Trigger: DROP IF EXISTS + CREATE (reexecução segura).'
  FROM (VALUES ('trg_fix08_catalogo_tenant'),('trg_fix08_decisoes_tenant'),('trg_fix08_eventos_tenant')) AS t(n)
),
-- 9. Compatibilidade dos DADOS EXISTENTES (0 inconsistências exigido)
c9 AS (
  SELECT '09. Dados existentes: decisões'::text,
         'operacoes_ocorrencias_decisoes',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' decisão(ões) com vínculo cruzado/divergente (esperado: 0).'
  FROM public.operacoes_ocorrencias_decisoes d
  LEFT JOIN public.empresas e ON e.id = d.empresa_id
  LEFT JOIN public.operacoes_producao o ON o.id = d.operacao_id
  LEFT JOIN public.colaboradores c ON c.id = d.collaborator_id
  LEFT JOIN public.infracoes_operacionais_catalogo i ON i.id = d.infracao_id
  LEFT JOIN public.operacoes_ocorrencias_decisoes r ON r.id = d.revisado_de_id
  WHERE e.tenant_id IS DISTINCT FROM d.tenant_id
     OR o.tenant_id IS DISTINCT FROM d.tenant_id
     OR o.empresa_id IS DISTINCT FROM d.empresa_id
     OR c.tenant_id IS DISTINCT FROM d.tenant_id
     OR (d.infracao_id IS NOT NULL AND i.tenant_id IS DISTINCT FROM d.tenant_id)
     OR (d.revisado_de_id IS NOT NULL AND r.tenant_id IS DISTINCT FROM d.tenant_id)
),
c10 AS (
  SELECT '10. Dados existentes: eventos'::text,
         'operacoes_ocorrencias_eventos_financeiros',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' evento(s) com vínculo cruzado/divergente (esperado: 0).'
  FROM public.operacoes_ocorrencias_eventos_financeiros ev
  LEFT JOIN public.operacoes_ocorrencias_decisoes d ON d.id = ev.decisao_id
  LEFT JOIN public.empresas e ON e.id = ev.empresa_id
  LEFT JOIN public.colaboradores c ON c.id = ev.collaborator_id
  WHERE d.tenant_id IS DISTINCT FROM ev.tenant_id
     OR d.empresa_id IS DISTINCT FROM ev.empresa_id
     OR d.collaborator_id IS DISTINCT FROM ev.collaborator_id
     OR e.tenant_id IS DISTINCT FROM ev.tenant_id
     OR c.tenant_id IS DISTINCT FROM ev.tenant_id
),
-- 11. Privilégio DELETE concedido a authenticated (informativo; FIX08 revoga)
c11 AS (
  SELECT '11. Privilégio DELETE (authenticated)'::text,
         'public.' || t.n,
         'OK',
         'has_delete=' || has_table_privilege('authenticated', 'public.' || t.n, 'DELETE')::text
           || ' (FIX08 revoga e adiciona política RESTRICTIVE)'
  FROM (VALUES ('infracoes_operacionais_catalogo'),('operacoes_ocorrencias_decisoes'),
               ('operacoes_ocorrencias_eventos_financeiros')) AS t(n)
),
-- 12. Baseline de volumetria (comparar com o POSCHECK)
c12 AS (
  SELECT '12. Baseline de volumetria'::text, 'public.infracoes_operacionais_catalogo', 'OK',
         'total=' || count(*)::text FROM public.infracoes_operacionais_catalogo
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.operacoes_ocorrencias_decisoes', 'OK',
         'total=' || count(*)::text FROM public.operacoes_ocorrencias_decisoes
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.operacoes_ocorrencias_eventos_financeiros', 'OK',
         'total=' || count(*)::text FROM public.operacoes_ocorrencias_eventos_financeiros
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.operacoes_producao', 'OK',
         'total=' || count(*)::text FROM public.operacoes_producao
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.production_entry_collaborators', 'OK',
         'total=' || count(*)::text FROM public.production_entry_collaborators
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.colaboradores', 'OK',
         'total=' || count(*)::text FROM public.colaboradores
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.rh_financeiro_lotes', 'OK',
         'total=' || count(*)::text FROM public.rh_financeiro_lotes
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.lancamentos_diaristas', 'OK',
         'total=' || count(*)::text FROM public.lancamentos_diaristas
  UNION ALL
  SELECT '12. Baseline de volumetria', 'public.lancamentos_intermitentes', 'OK',
         'total=' || count(*)::text FROM public.lancamentos_intermitentes
),
-- 13. Veredito
todas AS (
  SELECT * FROM c1 UNION ALL SELECT * FROM c2 UNION ALL SELECT * FROM c3 UNION ALL SELECT * FROM c4
  UNION ALL SELECT * FROM c5 UNION ALL SELECT * FROM c6 UNION ALL SELECT * FROM c7 UNION ALL SELECT * FROM c8
  UNION ALL SELECT * FROM c9 UNION ALL SELECT * FROM c10 UNION ALL SELECT * FROM c11 UNION ALL SELECT * FROM c12
)
SELECT verificacao AS "Verificação", objeto AS "Objeto", resultado AS "Resultado", detalhes AS "Detalhes"
FROM (
  SELECT * FROM todas
  UNION ALL
  SELECT '99. VEREDITO'::text,
         'FIX08 pode ser aplicado?',
         CASE WHEN count(*) FILTER (WHERE resultado = 'BLOQUEADO') = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         CASE WHEN count(*) FILTER (WHERE resultado = 'BLOQUEADO') = 0
              THEN 'Nenhum bloqueio. Pode executar ORBE_FIX08_APLICAR.sql.'
              ELSE count(*) FILTER (WHERE resultado = 'BLOQUEADO')::text || ' bloqueio(s). NÃO aplicar.' END
  FROM todas
) AS r
ORDER BY "Verificação", "Objeto";
