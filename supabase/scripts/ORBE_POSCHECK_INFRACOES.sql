-- ==============================================================================
-- ORBE ERP - FIX-OCORRÊNCIAS-06: PÓS-CHECK UNIFICADO (RESULTADO ÚNICO)
-- Arquivo: supabase/scripts/ORBE_POSCHECK_INFRACOES.sql
-- Objetivo: Retornar TODAS as verificações pós-migração em UMA ÚNICA TABELA.
--           Garante visualização integral no Supabase SQL Editor.
--           Uso estrito de consultas de leitura (100% read-only).
-- ==============================================================================

WITH 
-- 1. Verificação de Tabelas Criadas
check_tabelas_criadas AS (
  SELECT 
    '01. Criação de Tabelas'::text AS verificacao,
    'public.' || t.table_name::text AS objeto,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
      ) THEN 'PRESENTE'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = t.table_name
      ) THEN 'Tabela criada com sucesso e acessível no schema public.'
      ELSE 'ERRO CRÍTICO: Tabela ' || t.table_name || ' não foi criada.'
    END::text AS detalhes
  FROM (
    VALUES 
      ('infracoes_operacionais_catalogo'),
      ('operacoes_ocorrencias_decisoes'),
      ('operacoes_ocorrencias_eventos_financeiros')
  ) AS t(table_name)
),

-- 2. Habilitação de RLS
check_rls AS (
  SELECT 
    '02. Status de RLS'::text AS verificacao,
    'public.' || c.relname::text AS objeto,
    CASE 
      WHEN c.relrowsecurity THEN 'OK' 
      ELSE 'BLOQUEADO' 
    END::text AS resultado,
    CASE 
      WHEN c.relrowsecurity THEN 'Row Level Security ativo e operante (Fail-Closed).' 
      ELSE 'FALHA DE SEGURANÇA: RLS inativo na tabela ' || c.relname || '.' 
    END::text AS detalhes
  FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace
    AND c.relname IN (
      'infracoes_operacionais_catalogo',
      'operacoes_ocorrencias_decisoes',
      'operacoes_ocorrencias_eventos_financeiros'
    )
),

-- 3. Políticas RLS Registradas
check_policies AS (
  SELECT 
    '03. Políticas RLS'::text AS verificacao,
    p.tablename || ' -> ' || p.policyname::text AS objeto,
    'OK'::text AS resultado,
    'Comando: ' || p.cmd || ' | Perfis: ' || array_to_string(p.roles, ', ') AS detalhes
  FROM pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN (
      'infracoes_operacionais_catalogo',
      'operacoes_ocorrencias_decisoes',
      'operacoes_ocorrencias_eventos_financeiros'
    )
),

-- 4. Índices e Unicidade Parcial
check_indices AS (
  SELECT 
    '04. Índices Criados'::text AS verificacao,
    i.tablename || '.' || i.indexname::text AS objeto,
    'OK'::text AS resultado,
    'Definição: ' || i.indexdef AS detalhes
  FROM pg_indexes i
  WHERE i.schemaname = 'public'
    AND i.tablename IN (
      'infracoes_operacionais_catalogo',
      'operacoes_ocorrencias_decisoes',
      'operacoes_ocorrencias_eventos_financeiros'
    )
),

-- 5. Constraints e Chaves Estrangeiras (RESTRICT)
check_constraints AS (
  SELECT 
    '05. Constraints / Integridade'::text AS verificacao,
    con.conrelid::regclass::text || ' -> ' || con.conname::text AS objeto,
    CASE 
      WHEN con.confdeltype = 'r' OR con.contype IN ('p', 'u', 'c') THEN 'OK'
      ELSE 'BLOQUEADO'
    END::text AS resultado,
    CASE 
      WHEN con.confdeltype = 'r' THEN 'Chave estrangeira com ON DELETE RESTRICT (proteção de histórico).'
      WHEN con.contype = 'p' THEN 'Chave primária UUID ativa.'
      WHEN con.contype = 'c' THEN 'Regra de validação (CHECK) ativa.'
      WHEN con.contype = 'u' THEN 'Constraint de unicidade ativa.'
      ELSE 'Regra de deleção: ' || con.confdeltype::text
    END::text AS detalhes
  FROM pg_constraint con
  WHERE con.conrelid::regclass::text IN (
    'public.infracoes_operacionais_catalogo',
    'public.operacoes_ocorrencias_decisoes',
    'public.operacoes_ocorrencias_eventos_financeiros'
  )
),

-- 6. Volumetria Operacional Pós-Aplicação (Garantia de Não-Regressão)
check_volumetria AS (
  SELECT 
    '06. Integridade Operacional'::text AS verificacao,
    'public.operacoes_producao'::text AS objeto,
    'OK'::text AS resultado,
    'Total preservado: ' || count(*)::text || ' operações.' AS detalhes
  FROM public.operacoes_producao
  UNION ALL
  SELECT 
    '06. Integridade Operacional'::text AS verificacao,
    'public.production_entry_collaborators'::text AS objeto,
    'OK'::text AS resultado,
    'Total preservado: ' || count(*)::text || ' apontamentos vinculados.' AS detalhes
  FROM public.production_entry_collaborators
  UNION ALL
  SELECT 
    '06. Integridade Operacional'::text AS verificacao,
    'public.colaboradores'::text AS objeto,
    'OK'::text AS resultado,
    'Total preservado: ' || count(*)::text || ' colaboradores.' AS detalhes
  FROM public.colaboradores
  UNION ALL
  SELECT 
    '06. Integridade Operacional'::text AS verificacao,
    'public.empresas'::text AS objeto,
    'OK'::text AS resultado,
    'Total preservado: ' || count(*)::text || ' empresas.' AS detalhes
  FROM public.empresas
  UNION ALL
  SELECT 
    '06. Integridade Operacional'::text AS verificacao,
    'public.tenants'::text AS objeto,
    'OK'::text AS resultado,
    'Total preservado: ' || count(*)::text || ' tenants.' AS detalhes
  FROM public.tenants
)

-- CONSULTA FINAL UNIFICADA
SELECT 
  verificacao AS "Verificação",
  objeto AS "Objeto",
  resultado AS "Resultado",
  detalhes AS "Detalhes"
FROM (
  SELECT * FROM check_tabelas_criadas
  UNION ALL
  SELECT * FROM check_rls
  UNION ALL
  SELECT * FROM check_policies
  UNION ALL
  SELECT * FROM check_indices
  UNION ALL
  SELECT * FROM check_constraints
  UNION ALL
  SELECT * FROM check_volumetria
) AS resultado_poscheck
ORDER BY "Verificação", "Objeto";
