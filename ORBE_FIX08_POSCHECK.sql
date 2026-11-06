-- ==============================================================================
-- ORBE ERP - FIX-OCORRÊNCIAS-08: POSCHECK (SOMENTE LEITURA / TABELA ÚNICA)
-- Arquivo: ORBE_FIX08_POSCHECK.sql
-- Execute APÓS ORBE_FIX08_APLICAR.sql. Compare a volumetria com o PRECHECK.
-- Resultados possíveis: PRESENTE | OK | BLOQUEADO
-- ==============================================================================

WITH
alvo AS (
  SELECT unnest(ARRAY['infracoes_operacionais_catalogo','operacoes_ocorrencias_decisoes',
                      'operacoes_ocorrencias_eventos_financeiros']) AS t
),
-- 1. RLS ativo
p1 AS (
  SELECT '01. RLS ativo'::text AS verificacao, 'public.' || cl.relname AS objeto,
         CASE WHEN cl.relrowsecurity THEN 'OK' ELSE 'BLOQUEADO' END AS resultado,
         'relrowsecurity=' || cl.relrowsecurity::text AS detalhes
  FROM pg_class cl JOIN alvo a ON a.t = cl.relname
  WHERE cl.relnamespace = 'public'::regnamespace
),
-- 2. Conjunto canônico de políticas (11 esperadas)
p2 AS (
  SELECT '02. Políticas canônicas'::text, e.tbl || ' -> ' || e.pol,
         CASE WHEN pp.policyname IS NOT NULL
               AND pp.cmd = e.cmd
               AND pp.permissive = e.tipo THEN 'OK' ELSE 'BLOQUEADO' END,
         'esperado cmd=' || e.cmd || ' tipo=' || e.tipo
           || ' | encontrado cmd=' || coalesce(pp.cmd,'(ausente)') || ' tipo=' || coalesce(pp.permissive,'-')
  FROM (VALUES
    ('infracoes_operacionais_catalogo','fix08_catalogo_select','SELECT','PERMISSIVE'),
    ('infracoes_operacionais_catalogo','fix08_catalogo_insert','INSERT','PERMISSIVE'),
    ('infracoes_operacionais_catalogo','fix08_catalogo_update','UPDATE','PERMISSIVE'),
    ('infracoes_operacionais_catalogo','fix08_catalogo_no_delete','DELETE','RESTRICTIVE'),
    ('operacoes_ocorrencias_decisoes','fix08_decisoes_select','SELECT','PERMISSIVE'),
    ('operacoes_ocorrencias_decisoes','fix08_decisoes_insert','INSERT','PERMISSIVE'),
    ('operacoes_ocorrencias_decisoes','fix08_decisoes_update','UPDATE','PERMISSIVE'),
    ('operacoes_ocorrencias_decisoes','fix08_decisoes_no_delete','DELETE','RESTRICTIVE'),
    ('operacoes_ocorrencias_eventos_financeiros','fix08_eventos_select','SELECT','PERMISSIVE'),
    ('operacoes_ocorrencias_eventos_financeiros','fix08_eventos_insert','INSERT','PERMISSIVE'),
    ('operacoes_ocorrencias_eventos_financeiros','fix08_eventos_update','UPDATE','PERMISSIVE'),
    ('operacoes_ocorrencias_eventos_financeiros','fix08_eventos_no_delete','DELETE','RESTRICTIVE')
  ) AS e(tbl, pol, cmd, tipo)
  LEFT JOIN pg_policies pp
    ON pp.schemaname='public' AND pp.tablename=e.tbl AND pp.policyname=e.pol
),
-- 3. Nenhuma política extra / FOR ALL / permissiva de DELETE / dependente de JWT
p3 AS (
  SELECT '03. Políticas indevidas'::text, 'FOR ALL ou DELETE permissiva',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' encontrada(s) (esperado: 0)'
  FROM pg_policies
  WHERE schemaname='public' AND tablename IN (SELECT t FROM alvo)
    AND (cmd = 'ALL' OR (cmd = 'DELETE' AND permissive = 'PERMISSIVE'))
  UNION ALL
  SELECT '03. Políticas indevidas', 'Dependência de claim JWT',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' encontrada(s) (esperado: 0)'
  FROM pg_policies
  WHERE schemaname='public' AND tablename IN (SELECT t FROM alvo)
    AND (coalesce(qual,'') ILIKE '%jwt%' OR coalesce(with_check,'') ILIKE '%jwt%')
  UNION ALL
  SELECT '03. Políticas indevidas', 'Políticas fora do conjunto fix08_*',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' encontrada(s) (esperado: 0)'
  FROM pg_policies
  WHERE schemaname='public' AND tablename IN (SELECT t FROM alvo)
    AND policyname NOT LIKE 'fix08\_%'
),
-- 4. Funções auxiliares e permissões de execução
p4 AS (
  SELECT '04. Funções FIX08'::text, 'public.' || t.n || '(' || t.args || ')',
         CASE WHEN pr.oid IS NOT NULL AND pr.prosecdef THEN 'PRESENTE' ELSE 'BLOQUEADO' END,
         CASE WHEN pr.oid IS NULL THEN 'ausente'
              ELSE 'security_definer=' || pr.prosecdef::text
                   || ' | authenticated_execute=' || has_function_privilege('authenticated', pr.oid, 'EXECUTE')::text
                   || ' | anon_execute=' || has_function_privilege('anon', pr.oid, 'EXECUTE')::text END
  FROM (VALUES ('fn_ocorrencias_perfil_gestao','uuid'),
               ('fn_ocorrencias_perfil_financeiro','uuid'),
               ('fn_ocorrencias_validar_tenant_catalogo',''),
               ('fn_ocorrencias_validar_tenant_decisao',''),
               ('fn_ocorrencias_validar_tenant_evento','')) AS t(n, args)
  LEFT JOIN LATERAL (
    SELECT x.* FROM pg_proc x JOIN pg_namespace ns ON ns.oid = x.pronamespace
    WHERE ns.nspname='public' AND x.proname = t.n LIMIT 1
  ) pr ON true
),
-- 5. Triggers de integridade entre tenants
p5 AS (
  SELECT '05. Triggers de tenant'::text, t.n,
         CASE WHEN tg.tgname IS NOT NULL AND tg.tgenabled <> 'D' THEN 'PRESENTE' ELSE 'BLOQUEADO' END,
         'tabela=' || coalesce(tg.tgrelid::regclass::text,'(ausente)')
  FROM (VALUES ('trg_fix08_catalogo_tenant'),('trg_fix08_decisoes_tenant'),('trg_fix08_eventos_tenant')) AS t(n)
  LEFT JOIN pg_trigger tg ON tg.tgname = t.n AND NOT tg.tgisinternal
),
-- 6. Privilégios de tabela
p6 AS (
  SELECT '06. Privilégios'::text, 'public.' || a.t,
         CASE WHEN has_table_privilege('authenticated','public.'||a.t,'DELETE')
                OR has_table_privilege('anon','public.'||a.t,'SELECT') THEN 'BLOQUEADO' ELSE 'OK' END,
         'authenticated_delete=' || has_table_privilege('authenticated','public.'||a.t,'DELETE')::text
           || ' | anon_select=' || has_table_privilege('anon','public.'||a.t,'SELECT')::text
  FROM alvo a
),
-- 7. Integridade dos dados existentes
p7 AS (
  SELECT '07. Integridade: decisões'::text, 'operacoes_ocorrencias_decisoes',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' vínculo(s) cruzado(s) (esperado: 0)'
  FROM public.operacoes_ocorrencias_decisoes d
  LEFT JOIN public.empresas e ON e.id = d.empresa_id
  LEFT JOIN public.operacoes_producao o ON o.id = d.operacao_id
  LEFT JOIN public.colaboradores c ON c.id = d.collaborator_id
  WHERE e.tenant_id IS DISTINCT FROM d.tenant_id
     OR o.tenant_id IS DISTINCT FROM d.tenant_id
     OR o.empresa_id IS DISTINCT FROM d.empresa_id
     OR c.tenant_id IS DISTINCT FROM d.tenant_id
  UNION ALL
  SELECT '07. Integridade: eventos', 'operacoes_ocorrencias_eventos_financeiros',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' vínculo(s) cruzado(s) (esperado: 0)'
  FROM public.operacoes_ocorrencias_eventos_financeiros ev
  LEFT JOIN public.operacoes_ocorrencias_decisoes d ON d.id = ev.decisao_id
  WHERE d.tenant_id IS DISTINCT FROM ev.tenant_id
     OR d.empresa_id IS DISTINCT FROM ev.empresa_id
     OR d.collaborator_id IS DISTINCT FROM ev.collaborator_id
  UNION ALL
  SELECT '07. Integridade: status canônico', 'operacoes_ocorrencias_eventos_financeiros.status',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' evento(s) com status fora de PENDENTE_APLICACAO/APLICADO/CANCELADO/ESTORNADO (esperado: 0)'
  FROM public.operacoes_ocorrencias_eventos_financeiros
  WHERE status NOT IN ('PENDENTE_APLICACAO','APLICADO','CANCELADO','ESTORNADO')
  UNION ALL
  SELECT '07. Integridade: duplicidade', 'eventos ativos por decisão',
         CASE WHEN count(*) = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         count(*)::text || ' decisão(ões) com mais de 1 evento ativo (esperado: 0)'
  FROM (
    SELECT decisao_id FROM public.operacoes_ocorrencias_eventos_financeiros
    WHERE status IN ('PENDENTE_APLICACAO','APLICADO')
    GROUP BY decisao_id HAVING count(*) > 1
  ) dup
),
-- 8. Volumetria (deve ser IDÊNTICA ao baseline do PRECHECK)
p8 AS (
  SELECT '08. Volumetria (comparar com PRECHECK)'::text, 'public.infracoes_operacionais_catalogo', 'OK',
         'total=' || count(*)::text FROM public.infracoes_operacionais_catalogo
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.operacoes_ocorrencias_decisoes', 'OK',
         'total=' || count(*)::text FROM public.operacoes_ocorrencias_decisoes
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.operacoes_ocorrencias_eventos_financeiros', 'OK',
         'total=' || count(*)::text FROM public.operacoes_ocorrencias_eventos_financeiros
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.operacoes_producao', 'OK',
         'total=' || count(*)::text FROM public.operacoes_producao
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.production_entry_collaborators', 'OK',
         'total=' || count(*)::text FROM public.production_entry_collaborators
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.colaboradores', 'OK',
         'total=' || count(*)::text FROM public.colaboradores
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.rh_financeiro_lotes', 'OK',
         'total=' || count(*)::text FROM public.rh_financeiro_lotes
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.lancamentos_diaristas', 'OK',
         'total=' || count(*)::text FROM public.lancamentos_diaristas
  UNION ALL
  SELECT '08. Volumetria (comparar com PRECHECK)', 'public.lancamentos_intermitentes', 'OK',
         'total=' || count(*)::text FROM public.lancamentos_intermitentes
),
todas AS (
  SELECT * FROM p1 UNION ALL SELECT * FROM p2 UNION ALL SELECT * FROM p3 UNION ALL SELECT * FROM p4
  UNION ALL SELECT * FROM p5 UNION ALL SELECT * FROM p6 UNION ALL SELECT * FROM p7 UNION ALL SELECT * FROM p8
)
SELECT verificacao AS "Verificação", objeto AS "Objeto", resultado AS "Resultado", detalhes AS "Detalhes"
FROM (
  SELECT * FROM todas
  UNION ALL
  SELECT '99. VEREDITO'::text, 'FIX08 estrutura e segurança',
         CASE WHEN count(*) FILTER (WHERE resultado = 'BLOQUEADO') = 0 THEN 'OK' ELSE 'BLOQUEADO' END,
         CASE WHEN count(*) FILTER (WHERE resultado = 'BLOQUEADO') = 0
              THEN 'Estrutura validada. Execute o roteiro autenticado (ORBE_FIX08_ROTEIRO_TESTES_RLS.md) para homologar permissões.'
              ELSE count(*)::text || ' item(ns) BLOQUEADO(S). Investigar antes de homologar.' END
  FROM todas
) AS r
ORDER BY "Verificação", "Objeto";
