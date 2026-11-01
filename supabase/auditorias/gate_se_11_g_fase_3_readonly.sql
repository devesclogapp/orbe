-- ==============================================================================
-- ORBE ERP — GATE SE-11-G | FASE 3.1
-- Auditoria do catálogo PostgreSQL e isolamento multi-tenant (Revisão Preventiva)
-- MODO: ESTRITAMENTE READ-ONLY (somente SELECT). Não aplica migration.
-- Execução: SQL Editor do Supabase, papel postgres. Rodar cada bloco (A..G)
-- separadamente e copiar o resultado de cada um.
-- ==============================================================================


-- ==============================================================================
-- BLOCO A — Identificação do ambiente
-- ==============================================================================
SELECT
    current_database()               AS banco_dados,
    current_user                     AS usuario_efetivo,
    session_user                     AS usuario_sessao,
    current_schema()                 AS schema_ativo,
    current_setting('search_path')   AS search_path_sessao,
    clock_timestamp()                AS data_hora_execucao,
    current_setting('server_version') AS versao_postgresql,
    (SELECT count(*) FROM pg_namespace WHERE nspname = 'supabase_migrations') AS possui_schema_supabase_migrations;


-- ==============================================================================
-- BLOCO B — Triggers não internas de public.servicos_extras_operacionais
-- ==============================================================================
SELECT
    t.tgname                         AS trigger_nome,
    c.relname                        AS tabela,
    pn.nspname || '.' || p.proname   AS funcao_associada,
    CASE t.tgenabled
        WHEN 'O' THEN 'HABILITADA'
        WHEN 'D' THEN 'DESABILITADA'
        WHEN 'R' THEN 'SOMENTE_REPLICA'
        WHEN 'A' THEN 'SEMPRE'
        ELSE t.tgenabled::text
    END                              AS estado,
    CASE
        WHEN (t.tgtype & 64) = 64 THEN 'INSTEAD OF'
        WHEN (t.tgtype & 2)  = 2  THEN 'BEFORE'
        ELSE 'AFTER'
    END                              AS momento,
    CASE WHEN (t.tgtype & 1) = 1 THEN 'ROW' ELSE 'STATEMENT' END AS nivel,
    concat_ws(', ',
        CASE WHEN (t.tgtype & 4)  = 4  THEN 'INSERT' END,
        CASE WHEN (t.tgtype & 8)  = 8  THEN 'DELETE' END,
        CASE WHEN (t.tgtype & 16) = 16 THEN 'UPDATE' END,
        CASE WHEN (t.tgtype & 32) = 32 THEN 'TRUNCATE' END
    )                                AS eventos,
    pg_get_triggerdef(t.oid, true)   AS definicao_completa
FROM pg_trigger t
JOIN pg_class c      ON c.oid = t.tgrelid
JOIN pg_namespace n  ON n.oid = c.relnamespace
JOIN pg_proc p       ON p.oid = t.tgfoid
JOIN pg_namespace pn ON pn.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND c.relname = 'servicos_extras_operacionais'
  AND NOT t.tgisinternal
ORDER BY CASE WHEN (t.tgtype & 2) = 2 THEN 0 ELSE 1 END, t.tgname;


-- ==============================================================================
-- BLOCO C — Função public.check_imutabilidade_servico_extra()
-- ==============================================================================
-- C.1 Atributos e definição ativa
SELECT
    p.oid::regprocedure              AS assinatura,
    pg_get_userbyid(p.proowner)      AS proprietario,
    CASE WHEN p.prosecdef THEN 'SECURITY DEFINER' ELSE 'SECURITY INVOKER' END AS modelo_seguranca,
    COALESCE(array_to_string(p.proconfig, ' | '), '(sem configuração; herda a sessão)') AS config_funcao_search_path,
    pg_get_functiondef(p.oid)        AS definicao_ativa
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'check_imutabilidade_servico_extra';

-- C.2 Triggers (em qualquer tabela) que dependem desta função
SELECT
    t.tgname                         AS trigger_nome,
    t.tgrelid::regclass              AS tabela,
    CASE t.tgenabled WHEN 'D' THEN 'DESABILITADA' ELSE 'HABILITADA' END AS estado
FROM pg_trigger t
JOIN pg_proc p ON p.oid = t.tgfoid
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'check_imutabilidade_servico_extra'
  AND NOT t.tgisinternal;


-- ==============================================================================
-- BLOCO D — Segurança RLS e Políticas em servicos_extras_operacionais
-- NOTA DE SEGURANÇA:
-- No PostgreSQL, múltiplas políticas do tipo PERMISSIVE aplicadas ao mesmo
-- comando (ex: UPDATE) para o mesmo papel operam com lógica disjuntiva (OR).
-- Consequentemente, se existir uma política permissiva com USING (true), o acesso
-- é concedido mesmo que outra política possua restrições por tenant_id.
-- A avaliação de conformidade exige a análise conjunta de todas as políticas ativas.
-- ==============================================================================
-- D.1 Estado de RLS e FORCE RLS
SELECT
    c.oid::regclass                  AS tabela,
    c.relrowsecurity                 AS rls_habilitada,
    c.relforcerowsecurity            AS force_rls,
    pg_get_userbyid(c.relowner)      AS proprietario_tabela
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'servicos_extras_operacionais';

-- D.2 Todas as políticas ativas (SELECT, INSERT, UPDATE, DELETE, ALL)
SELECT
    policyname                       AS politica,
    cmd                              AS comando,
    permissive                       AS tipo_politica,
    roles                            AS papeis_aplicados,
    qual                             AS expressao_using,
    with_check                       AS expressao_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'servicos_extras_operacionais'
ORDER BY cmd, policyname;

-- D.3 Verificação específica da política histórica 'update_servicos_extras_autenticado_repair'
SELECT
    count(*) AS qtd_politica_repair_instalada,
    CASE WHEN count(*) = 0
         THEN 'NÃO INSTALADA'
         ELSE 'INSTALADA (Atenção: Conferir expressão USING em D.2)'
    END AS situacao_politica_repair
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename  = 'servicos_extras_operacionais'
  AND policyname = 'update_servicos_extras_autenticado_repair';


-- ==============================================================================
-- BLOCO E — Privilégios (GRANT) efetivos na tabela
-- ==============================================================================
-- E.1 Privilégios por papel, lidos de pg_class.relacl
SELECT
    CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS papel,
    a.privilege_type                 AS privilegio,
    a.is_grantable                   AS pode_repassar
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
CROSS JOIN LATERAL aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a
WHERE n.nspname = 'public'
  AND c.relname = 'servicos_extras_operacionais'
ORDER BY 1, 2;

-- E.2 Resumo: papéis com UPDATE x políticas UPDATE/ALL existentes
SELECT
    r.rolname                        AS papel,
    has_table_privilege(r.oid, 'public.servicos_extras_operacionais', 'UPDATE') AS tem_update,
    has_table_privilege(r.oid, 'public.servicos_extras_operacionais', 'INSERT') AS tem_insert,
    has_table_privilege(r.oid, 'public.servicos_extras_operacionais', 'DELETE') AS tem_delete,
    r.rolbypassrls                   AS bypass_rls,
    (SELECT count(*) FROM pg_policies pp
      WHERE pp.schemaname = 'public'
        AND pp.tablename  = 'servicos_extras_operacionais'
        AND pp.cmd IN ('UPDATE', 'ALL')
        AND (pp.roles @> ARRAY[r.rolname::name] OR pp.roles @> ARRAY['public'::name])
    )                                AS politicas_update_aplicaveis
FROM pg_roles r
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY r.rolname;


-- ==============================================================================
-- ==============================================================================
-- BLOCO F — Histórico de migrations aplicadas
-- ==============================================================================
-- F.1 Verificar se a tabela de migrations existe e quais colunas ela possui
SELECT 
    table_schema,
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'supabase_migrations' 
  AND table_name = 'schema_migrations'
ORDER BY ordinal_position;

-- ATENÇÃO OPERACIONAL PARA F.2 E F.3:
-- Caso a consulta F.1 retorne 0 linhas (indicando que a tabela de histórico não
-- existe ou utiliza outro padrão), NÃO execute as consultas F.2 e F.3 abaixo.
-- Caso F.1 retorne colunas, execute as consultas diretas:

-- F.2 Verificar especificamente se a migration 20261024171000 já consta como aplicada
SELECT 
    version
FROM supabase_migrations.schema_migrations
WHERE version LIKE '%20261024171000%';

-- F.3 Listar as 15 migrations mais recentes registradas no banco
SELECT 
    version
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 15;


-- ==============================================================================
-- BLOCO G — Integridade financeira do registro add948f0-... (somente leitura)
-- ==============================================================================
SELECT
    se.id                            AS servico_extra_id,
    se.pipeline_status               AS status_operacional,
    se.status_pagamento              AS status_pagamento_operacional,
    se.modalidade_financeira         AS modalidade_operacional,
    se.quantidade,
    se.valor_unitario,
    se.custo_materiais,
    se.total                         AS total_operacional,
    se.tenant_id                     AS tenant_servico,
    ri.id                            AS item_receita_id,
    ri.valor_item                    AS valor_item,
    ri.tenant_id                     AS tenant_item,
    ro.id                            AS receita_id,
    ro.status                        AS status_receita,
    ro.valor_total                   AS valor_total_receita,
    ro.modalidade                    AS modalidade_receita,
    ro.competencia,
    ro.data_recebimento,
    ro.tenant_id                     AS tenant_receita,
    (se.total = ri.valor_item AND ri.valor_item = ro.valor_total) AS valores_conferem,
    (se.tenant_id = ri.tenant_id AND ri.tenant_id = ro.tenant_id) AS tenants_conferem,
    (SELECT count(*) FROM public.receitas_operacionais_itens x
      WHERE x.servico_extra_id = se.id)                           AS qtd_itens_vinculados,
    'Status "recebido" NAO comprova conciliacao bancaria; exige evidencia de extrato/retorno.' AS observacao_conciliacao
FROM public.servicos_extras_operacionais se
LEFT JOIN public.receitas_operacionais_itens ri ON ri.servico_extra_id = se.id
LEFT JOIN public.receitas_operacionais ro       ON ro.id = ri.receita_id
WHERE se.id = 'add948f0-1674-49e1-8c62-65541da9f1fe';
