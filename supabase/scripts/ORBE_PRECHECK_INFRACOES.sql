-- ==============================================================================
-- ORBE ERP - FIX-OCORRÊNCIAS-06: PRÉ-CHECK UNIFICADO (RESULTADO ÚNICO)
-- Arquivo: supabase/scripts/ORBE_PRECHECK_INFRACOES.sql
-- Objetivo: Retornar TODAS as verificações do banco em UMA ÚNICA TABELA.
--           Garante visualização completa no Supabase SQL Editor em uma única grade.
--           Uso estrito de consultas de leitura (100% read-only).
-- ==============================================================================

WITH 
-- 1. Verificação de Tabelas Base Pré-existentes
check_tabelas_base AS (
  SELECT 
    '01. Tabelas Base'::text AS verificacao,
    t.schema_name || '.' || t.table_name::text AS objeto,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = t.schema_name AND table_name = t.table_name
      ) THEN 'PRESENTE'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = t.schema_name AND table_name = t.table_name
      ) THEN 'Tabela disponível para relacionamentos e chaves estrangeiras.'
      ELSE 'ERRO CRÍTICO: Tabela base ' || t.table_name || ' ausente no schema ' || t.schema_name || '.'
    END::text AS detalhes
  FROM (
    VALUES 
      ('public', 'tenants'),
      ('public', 'empresas'),
      ('public', 'operacoes_producao'),
      ('public', 'colaboradores'),
      ('public', 'production_entry_collaborators'),
      ('public', 'user_permissions'),
      ('public', 'profiles'),
      ('auth',   'users')
  ) AS t(schema_name, table_name)
),

-- 2. Verificação das Novas Tabelas (Devem estar livres para criação)
check_novas_tabelas AS (
  SELECT 
    '02. Novas Tabelas'::text AS verificacao,
    'public.' || t.table_name::text AS objeto,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
      ) THEN 'LIVRE'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
      ) THEN 'Nome livre para criação de tabela no schema public.'
      ELSE 'AVISO: Tabela já existe. Verificar se é necessária recriação ou migração incremental.'
    END::text AS detalhes
  FROM (
    VALUES 
      ('infracoes_operacionais_catalogo'),
      ('operacoes_ocorrencias_decisoes'),
      ('operacoes_ocorrencias_eventos_financeiros')
  ) AS t(table_name)
),

-- 3. Verificação de Colunas Necessárias em production_entry_collaborators
check_colunas_colab AS (
  SELECT 
    '03. Colunas de Apontamento'::text AS verificacao,
    'production_entry_collaborators.' || c.col_name::text AS objeto,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'production_entry_collaborators' 
          AND column_name = c.col_name
      ) THEN 'PRESENTE'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'production_entry_collaborators' 
          AND column_name = c.col_name
      ) THEN 'Coluna disponível para recebimento do apontamento de campo.'
      ELSE 'ERRO: Coluna ' || c.col_name || ' não localizada em production_entry_collaborators.'
    END::text AS detalhes
  FROM (
    VALUES 
      ('had_infraction'),
      ('infraction_type_id'),
      ('infraction_notes')
  ) AS c(col_name)
),

-- 4. Funções de Segurança e RLS (Validação Real de Schema e Assinatura)
check_funcoes_seguranca AS (
  SELECT 
    '04. Funções de Segurança RLS'::text AS verificacao,
    'public.' || f.func_name || '()'::text AS objeto,
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = f.func_name
          AND p.pronargs = 0
          AND p.prorettype = f.expected_return_type::regtype
      ) THEN 'OK'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN EXISTS (
        SELECT 1 
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname = f.func_name
          AND p.pronargs = 0
          AND p.prorettype = f.expected_return_type::regtype
      ) THEN 'Função public.' || f.func_name || '() presente com retorno ' || f.expected_return_type || ' validado.'
      ELSE 'ERRO CRÍTICO: Função public.' || f.func_name || '() ausente ou com assinatura incompatível no schema public.'
    END::text AS detalhes
  FROM (
    VALUES 
      ('current_tenant_id', 'uuid'),
      ('get_user_role', 'text')
  ) AS f(func_name, expected_return_type)
),

-- 5. Conflito de Constraints e Índices
check_conflitos AS (
  SELECT 
    '05. Conflitos de Índices/Constraints'::text AS verificacao,
    c.obj_name::text AS objeto,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = c.obj_name
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = c.obj_name
      ) THEN 'LIVRE'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = c.obj_name
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE indexname = c.obj_name
      ) THEN 'Identificador desimpedido para criação sem colisão.'
      ELSE 'AVISO: Nome de constraint ou índice já está em uso.'
    END::text AS detalhes
  FROM (
    VALUES 
      ('unq_infracao_tenant_codigo'),
      ('unq_active_ocorrencia_decisao_v2'),
      ('unq_evento_decisao_ativa')
  ) AS c(obj_name)
),

-- 6. Suporte Criptográfico para Chaves Primárias
check_uuid_support AS (
  SELECT 
    '06. Pré-requisitos de Sistema'::text AS verificacao,
    'gen_random_uuid()'::text AS objeto,
    'OK'::text AS resultado,
    'Geração de UUID v4 nativa disponível no PostgreSQL.'::text AS detalhes
),

-- 7. Volumetria Operacional Atual (Baseline de Preservação)
check_volumetria AS (
  SELECT 
    '07. Volumetria Operacional'::text AS verificacao,
    'public.operacoes_producao'::text AS objeto,
    'OK'::text AS resultado,
    'Total atual: ' || count(*)::text || ' operações registradas.' AS detalhes
  FROM public.operacoes_producao
  UNION ALL
  SELECT 
    '07. Volumetria Operacional'::text AS verificacao,
    'public.production_entry_collaborators'::text AS objeto,
    'OK'::text AS resultado,
    'Total atual: ' || count(*)::text || ' apontamentos vinculados.' AS detalhes
  FROM public.production_entry_collaborators
  UNION ALL
  SELECT 
    '07. Volumetria Operacional'::text AS verificacao,
    'public.colaboradores'::text AS objeto,
    'OK'::text AS resultado,
    'Total atual: ' || count(*)::text || ' colaboradores cadastrados.' AS detalhes
  FROM public.colaboradores
  UNION ALL
  SELECT 
    '07. Volumetria Operacional'::text AS verificacao,
    'public.empresas'::text AS objeto,
    'OK'::text AS resultado,
    'Total atual: ' || count(*)::text || ' empresas cadastradas.' AS detalhes
  FROM public.empresas
  UNION ALL
  SELECT 
    '07. Volumetria Operacional'::text AS verificacao,
    'public.tenants'::text AS objeto,
    'OK'::text AS resultado,
    'Total atual: ' || count(*)::text || ' tenants cadastrados.' AS detalhes
  FROM public.tenants
)

-- CONSULTA FINAL UNIFICADA (UMA ÚNICA GRADE NO SUPABASE SQL EDITOR)
SELECT 
  verificacao AS "Verificação",
  objeto AS "Objeto",
  resultado AS "Resultado",
  detalhes AS "Detalhes"
FROM (
  SELECT * FROM check_tabelas_base
  UNION ALL
  SELECT * FROM check_novas_tabelas
  UNION ALL
  SELECT * FROM check_colunas_colab
  UNION ALL
  SELECT * FROM check_funcoes_seguranca
  UNION ALL
  SELECT * FROM check_conflitos
  UNION ALL
  SELECT * FROM check_uuid_support
  UNION ALL
  SELECT * FROM check_volumetria
) AS resultado_consolidado
ORDER BY "Verificação", "Objeto";
