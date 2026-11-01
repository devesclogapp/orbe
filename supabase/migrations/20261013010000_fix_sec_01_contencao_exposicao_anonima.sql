-- ==============================================================================
-- MIGRATION PREPARADA: FIX-SEC-01 — CONTENÇÃO P0 DE EXPOSIÇÃO ANÔNIMA NO SUPABASE
-- Arquivo: 20261013010000_fix_sec_01_contencao_exposicao_anonima.sql
-- Classificação: P0 — SEGURANÇA E CONFORMIDADE MULTI-TENANT (LGPD)
-- Contexto:
--   Saneamento definitivo dos 10 erros do Supabase Security Advisor:
--   1. Ativação de RLS e arquitetura dual de policies (AS RESTRICTIVE + PERMISSIVE)
--      em todas as 8 tabelas do escopo para SELECT, INSERT, UPDATE e DELETE.
--   2. Conversão das views para WITH (security_invoker = on) e revogação de anon.
--   3. Bloqueio irrestrito de acessos anônimos aos dados confidenciais de RH,
--      auditoria, diaristas, insumos e operações.
--   4. Garantia de grants das tabelas subjacentes para authenticated (evita erro 42501).
--
-- NOTA DE GOVERNANÇA:
--   Preparada para revisão técnica antes da implantação.
--   NÃO EXECUTA OPERAÇÕES DESTRUTIVAS DE DADOS (apenas DDL de segurança).
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. TABELAS OPERACIONAIS DE DIARISTAS
-- ==============================================================================

-- 1.1 public.lancamentos_diaristas
ALTER TABLE public.lancamentos_diaristas ENABLE ROW LEVEL SECURITY;

-- Revogar qualquer privilégio concedido ao perfil anônimo
REVOKE ALL ON public.lancamentos_diaristas FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_diaristas TO authenticated;

-- Limpar policies permissivas legadas
DROP POLICY IF EXISTS "full_access_lancamentos_diaristas" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "restrictive_tenant_isolation_lancamentos_diaristas" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "tenant_isolation_lancamentos_diaristas" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "authenticated_access_lancamentos_diaristas" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "lancamentos_diaristas_select" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "lancamentos_diaristas_insert" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "lancamentos_diaristas_update" ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "lancamentos_diaristas_delete" ON public.lancamentos_diaristas;

-- 1. Policy Restritiva (AND obrigatório em qualquer query)
CREATE POLICY "tenant_isolation_lancamentos_diaristas"
  ON public.lancamentos_diaristas
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 2. Policy Permissiva (concede autorização operacional para SELECT, INSERT, UPDATE, DELETE)
CREATE POLICY "authenticated_access_lancamentos_diaristas"
  ON public.lancamentos_diaristas
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Garantir trigger auto-tenant no INSERT como fallback de segurança
DROP TRIGGER IF EXISTS trg_auto_tenant_lancamentos_diaristas ON public.lancamentos_diaristas;
CREATE TRIGGER trg_auto_tenant_lancamentos_diaristas
  BEFORE INSERT ON public.lancamentos_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();


-- 1.2 public.diaristas_lotes_fechamento
ALTER TABLE public.diaristas_lotes_fechamento ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.diaristas_lotes_fechamento FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas_lotes_fechamento TO authenticated;

DROP POLICY IF EXISTS "full_access_diaristas_lotes_fechamento" ON public.diaristas_lotes_fechamento;
DROP POLICY IF EXISTS "restrictive_tenant_isolation_diaristas_lotes_fechamento" ON public.diaristas_lotes_fechamento;
DROP POLICY IF EXISTS "tenant_isolation_diaristas_lotes_fechamento" ON public.diaristas_lotes_fechamento;
DROP POLICY IF EXISTS "authenticated_access_diaristas_lotes_fechamento" ON public.diaristas_lotes_fechamento;
DROP POLICY IF EXISTS "diaristas_lotes_select" ON public.diaristas_lotes_fechamento;
DROP POLICY IF EXISTS "diaristas_lotes_insert" ON public.diaristas_lotes_fechamento;
DROP POLICY IF EXISTS "diaristas_lotes_update" ON public.diaristas_lotes_fechamento;

CREATE POLICY "tenant_isolation_diaristas_lotes_fechamento"
  ON public.diaristas_lotes_fechamento
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "authenticated_access_diaristas_lotes_fechamento"
  ON public.diaristas_lotes_fechamento
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_diaristas_lotes ON public.diaristas_lotes_fechamento;
CREATE TRIGGER trg_auto_tenant_diaristas_lotes
  BEFORE INSERT ON public.diaristas_lotes_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();


-- ==============================================================================
-- 2. TABELAS DE INSUMOS E MATERIAIS OPERACIONAIS
-- ==============================================================================

-- 2.1 public.materiais_operacionais
ALTER TABLE public.materiais_operacionais ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.materiais_operacionais FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_operacionais TO authenticated;

DROP POLICY IF EXISTS "Acesso leitura autenticado materiais_operacionais" ON public.materiais_operacionais;
DROP POLICY IF EXISTS "Acesso total admin materiais_operacionais" ON public.materiais_operacionais;
DROP POLICY IF EXISTS "tenant_isolation_materiais_operacionais" ON public.materiais_operacionais;
DROP POLICY IF EXISTS "authenticated_access_materiais_operacionais" ON public.materiais_operacionais;

CREATE POLICY "tenant_isolation_materiais_operacionais"
  ON public.materiais_operacionais
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "authenticated_access_materiais_operacionais"
  ON public.materiais_operacionais
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_materiais_operacionais ON public.materiais_operacionais;
CREATE TRIGGER trg_auto_tenant_materiais_operacionais
  BEFORE INSERT ON public.materiais_operacionais
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();


-- 2.2 public.operacao_producao_materiais
ALTER TABLE public.operacao_producao_materiais ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.operacao_producao_materiais FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacao_producao_materiais TO authenticated;

DROP POLICY IF EXISTS "Acesso leitura autenticado operacao_producao_materiais" ON public.operacao_producao_materiais;
DROP POLICY IF EXISTS "Acesso insert autenticado operacao_producao_materiais" ON public.operacao_producao_materiais;
DROP POLICY IF EXISTS "tenant_isolation_operacao_producao_materiais" ON public.operacao_producao_materiais;
DROP POLICY IF EXISTS "authenticated_access_operacao_producao_materiais" ON public.operacao_producao_materiais;

CREATE POLICY "tenant_isolation_operacao_producao_materiais"
  ON public.operacao_producao_materiais
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (EXISTS (
      SELECT 1 FROM public.operacoes_producao op
      WHERE op.id = operacao_producao_materiais.operacao_id
      AND op.tenant_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
      SELECT 1 FROM public.operacoes_producao op
      WHERE op.id = operacao_producao_materiais.operacao_id
      AND op.tenant_id = public.current_tenant_id()
  ));

CREATE POLICY "authenticated_access_operacao_producao_materiais"
  ON public.operacao_producao_materiais
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (EXISTS (
      SELECT 1 FROM public.operacoes_producao op
      WHERE op.id = operacao_producao_materiais.operacao_id
      AND op.tenant_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
      SELECT 1 FROM public.operacoes_producao op
      WHERE op.id = operacao_producao_materiais.operacao_id
      AND op.tenant_id = public.current_tenant_id()
  ));


-- ==============================================================================
-- 3. TABELAS ARQUITETURAIS DA FASE 10 (SANEAMENTO PREVENTIVO)
-- ==============================================================================

-- 3.1 public.regras_financeiras_versoes
ALTER TABLE public.regras_financeiras_versoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.regras_financeiras_versoes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_financeiras_versoes TO authenticated;

DROP POLICY IF EXISTS "tenant_isolation_regras_financeiras_versoes" ON public.regras_financeiras_versoes;
DROP POLICY IF EXISTS "authenticated_access_regras_financeiras_versoes" ON public.regras_financeiras_versoes;

CREATE POLICY "tenant_isolation_regras_financeiras_versoes"
  ON public.regras_financeiras_versoes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "authenticated_access_regras_financeiras_versoes"
  ON public.regras_financeiras_versoes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_regras_financeiras_versoes ON public.regras_financeiras_versoes;
CREATE TRIGGER trg_auto_tenant_regras_financeiras_versoes
  BEFORE INSERT ON public.regras_financeiras_versoes
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();


-- 3.2 public.financeiro_consolidados_snapshots
ALTER TABLE public.financeiro_consolidados_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.financeiro_consolidados_snapshots FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_consolidados_snapshots TO authenticated;

DROP POLICY IF EXISTS "tenant_isolation_financeiro_consolidados_snapshots" ON public.financeiro_consolidados_snapshots;
DROP POLICY IF EXISTS "authenticated_access_financeiro_snapshots" ON public.financeiro_consolidados_snapshots;

CREATE POLICY "tenant_isolation_financeiro_consolidados_snapshots"
  ON public.financeiro_consolidados_snapshots
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "authenticated_access_financeiro_snapshots"
  ON public.financeiro_consolidados_snapshots
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_financeiro_snapshots ON public.financeiro_consolidados_snapshots;
CREATE TRIGGER trg_auto_tenant_financeiro_snapshots
  BEFORE INSERT ON public.financeiro_consolidados_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();


-- 3.3 public.documentos_anexos
ALTER TABLE public.documentos_anexos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.documentos_anexos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_anexos TO authenticated;

DROP POLICY IF EXISTS "tenant_isolation_documentos_anexos" ON public.documentos_anexos;
DROP POLICY IF EXISTS "authenticated_access_documentos_anexos" ON public.documentos_anexos;

CREATE POLICY "tenant_isolation_documentos_anexos"
  ON public.documentos_anexos
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "authenticated_access_documentos_anexos"
  ON public.documentos_anexos
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_documentos_anexos ON public.documentos_anexos;
CREATE TRIGGER trg_auto_tenant_documentos_anexos
  BEFORE INSERT ON public.documentos_anexos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();


-- 3.4 public.equipes
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equipes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO authenticated;

DROP POLICY IF EXISTS "tenant_isolation_equipes" ON public.equipes;
DROP POLICY IF EXISTS "authenticated_access_equipes" ON public.equipes;

CREATE POLICY "tenant_isolation_equipes"
  ON public.equipes
  AS RESTRICTIVE
  FOR ALL
  TO authenticated
  USING (EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = equipes.empresa_id
      AND e.tenant_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = equipes.empresa_id
      AND e.tenant_id = public.current_tenant_id()
  ));

CREATE POLICY "authenticated_access_equipes"
  ON public.equipes
  AS PERMISSIVE
  FOR ALL
  TO authenticated
  USING (EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = equipes.empresa_id
      AND e.tenant_id = public.current_tenant_id()
  ))
  WITH CHECK (EXISTS (
      SELECT 1 FROM public.empresas e
      WHERE e.id = equipes.empresa_id
      AND e.tenant_id = public.current_tenant_id()
  ));

-- Remover trigger caso tenha existido (equipes isola via empresa_id, não possui coluna tenant_id direta)
DROP TRIGGER IF EXISTS trg_auto_tenant_equipes ON public.equipes;



-- ==============================================================================
-- 4. GARANTIA DE GRANTS DAS TABELAS SUBJACENTES PARA SECURITY INVOKER
-- ==============================================================================
-- Quando views utilizam WITH (security_invoker = on), o PostgreSQL exige que a role
-- 'authenticated' possua privilégio de SELECT em todas as tabelas referenciadas.
-- RLS ativo em cada tabela garante o isolamento; o GRANT garante que não ocorra erro 42501.

GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT ON public.operacoes_producao TO authenticated;
GRANT SELECT ON public.registros_ponto TO authenticated;
GRANT SELECT ON public.colaboradores TO authenticated;
GRANT SELECT ON public.empresas TO authenticated;
GRANT SELECT ON public.tipos_servico_operacional TO authenticated;
GRANT SELECT ON public.custos_extras_operacionais TO authenticated;
GRANT SELECT ON public.servicos_extras_operacionais TO authenticated;
GRANT SELECT ON public.intermitentes_lotes_fechamento TO authenticated;


-- ==============================================================================
-- 5. VIEWS REESTRUTURADAS COM SECURITY INVOKER
-- ==============================================================================

-- 5.1 public.vw_audit_timeline_operacional
REVOKE ALL ON public.vw_audit_timeline_operacional FROM anon;
GRANT SELECT ON public.vw_audit_timeline_operacional TO authenticated;

CREATE OR REPLACE VIEW public.vw_audit_timeline_operacional
WITH (security_invoker = on)
AS
SELECT 
    a.id AS log_id,
    a.registro_id,
    a.entidade,
    a.acao,
    a.descricao,
    a.usuario_nome,
    a.perfil_usuario,
    a.created_at AS data_hora,
    CASE 
        WHEN a.acao = 'INSERT' THEN 'Criado'
        WHEN a.acao = 'UPDATE' AND (a.valor_novo->>'status') IS DISTINCT FROM (a.valor_anterior->>'status') THEN 'Status: ' || COALESCE(a.valor_novo->>'status', 'Atualizado')
        WHEN a.acao = 'UPDATE' AND (a.valor_novo->>'pipeline_status') IS DISTINCT FROM (a.valor_anterior->>'pipeline_status') THEN 'Pipeline: ' || COALESCE(a.valor_novo->>'pipeline_status', 'Atualizado')
        WHEN a.acao = 'DELETE' THEN 'Excluído'
        ELSE 'Atualização'
    END AS evento_resumido,
    a.valor_anterior,
    a.valor_novo,
    a.tenant_id,
    a.empresa_id
FROM 
    public.audit_log a
ORDER BY 
    a.created_at DESC;


-- 5.2 public.vw_operacoes_producao_resumo_dia
REVOKE ALL ON public.vw_operacoes_producao_resumo_dia FROM anon;
GRANT SELECT ON public.vw_operacoes_producao_resumo_dia TO authenticated;

CREATE OR REPLACE VIEW public.vw_operacoes_producao_resumo_dia
WITH (security_invoker = on)
AS
SELECT
  op.empresa_id,
  op.unidade_id,
  op.data_operacao,
  COUNT(*) AS total_lancamentos,
  COUNT(DISTINCT op.colaborador_id) AS total_colaboradores,
  COALESCE(SUM(op.quantidade), 0) AS total_quantidade,
  COALESCE(SUM(op.valor_total), 0) AS valor_total_produzido,
  COUNT(*) FILTER (WHERE op.status IN ('pendente', 'aguardando_validacao')) AS pendencias,
  COUNT(*) FILTER (WHERE op.status = 'com_alerta') AS alertas,
  op.tenant_id
FROM public.operacoes_producao op
GROUP BY op.empresa_id, op.unidade_id, op.data_operacao, op.tenant_id;


-- 5.3 public.vw_aprovacoes_rh
REVOKE ALL ON public.vw_aprovacoes_rh FROM anon;
GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;

CREATE OR REPLACE VIEW public.vw_aprovacoes_rh
WITH (security_invoker = on)
AS
WITH combined AS (
    -- 1. PONTOS CLT
    SELECT 
        p.id,
        'PONTO' AS tipo,
        'Ponto ' || substring(p.id::text, 1, 6) AS referencia,
        COALESCE(c.nome, 'Colaborador') AS colaborador,
        'Apontamento de horas' AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        COALESCE(c.cargo, '—') AS operacao,
        0::numeric AS valor,
        COALESCE(NULLIF(p.jornada_calculada::text, ''), '—') || CASE WHEN p.jornada_calculada IS NOT NULL THEN 'h' ELSE '' END AS horas,
        COALESCE(p.competencia, to_char(p.data, 'YYYY-MM')) AS competencia,
        COALESCE(p.created_at, p.updated_at) AS data_recebimento,
        COALESCE(p.status_processamento, p.status) AS raw_status,
        c.empresa_id AS empresa_id,
        p.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM public.registros_ponto p
    LEFT JOIN public.colaboradores c ON c.id = p.colaborador_id
    LEFT JOIN public.empresas e ON e.id = c.empresa_id

    UNION ALL

    -- 2. OPERAÇÕES POR VOLUME
    SELECT 
        op.id,
        'OPERAÇÃO' AS tipo,
        'Op ' || substring(op.id::text, 1, 6) AS referencia,
        COALESCE(e.nome, c.nome, '—') AS colaborador,
        COALESCE(ts.nome, 'Operação') AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        COALESCE(ts.nome, '—') AS operacao,
        COALESCE(op.valor_total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(op.data_operacao, 'YYYY-MM') AS competencia,
        op.criado_em AS data_recebimento,
        COALESCE(op.status_rh, 'PENDENTE_RH') AS raw_status,
        op.empresa_id AS empresa_id,
        op.data_operacao AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM public.operacoes_producao op
    LEFT JOIN public.empresas e ON e.id = op.empresa_id
    LEFT JOIN public.colaboradores c ON c.id = op.colaborador_id
    LEFT JOIN public.tipos_servico_operacional ts ON ts.id = op.tipo_servico_id

    UNION ALL

    -- 3. CUSTOS EXTRAS
    SELECT 
        ce.id,
        'CUSTO EXTRA' AS tipo,
        'CE ' || substring(ce.id::text, 1, 6) AS referencia,
        COALESCE(ce.descricao, 'Custo Extra') AS colaborador,
        COALESCE(ce.categoria_custo, 'Custo operacional') AS descricao,
        COALESCE(e.nome, ce.empresa_nome, '—') AS empresa,
        COALESCE(ce.categoria_custo, '—') AS operacao,
        COALESCE(ce.total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(ce.data, 'YYYY-MM') AS competencia,
        ce.criado_em AS data_recebimento,
        ce.status_pagamento AS raw_status,
        ce.empresa_id AS empresa_id,
        ce.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM public.custos_extras_operacionais ce
    LEFT JOIN public.empresas e ON e.id = ce.empresa_id

    UNION ALL

    -- 4. SERVIÇOS EXTRAS
    SELECT 
        se.id,
        'SERVIÇO EXTRA' AS tipo,
        'SE ' || substring(se.id::text, 1, 6) AS referencia,
        COALESCE(se.descricao_servico, se.descricao, 'Serviço Extra') AS colaborador,
        COALESCE(ts.nome, se.tipo_servico, 'Serviço extraordinário') AS descricao,
        COALESCE(e.nome, se.empresa_nome, '—') AS empresa,
        COALESCE(ts.nome, se.tipo_servico, '—') AS operacao,
        COALESCE(se.total, 0)::numeric AS valor,
        '—' AS horas,
        to_char(se.data, 'YYYY-MM') AS competencia,
        se.criado_em AS data_recebimento,
        se.pipeline_status AS raw_status,
        se.empresa_id AS empresa_id,
        se.data AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM public.servicos_extras_operacionais se
    LEFT JOIN public.empresas e ON e.id = se.empresa_id
    LEFT JOIN public.tipos_servico_operacional ts ON ts.id = se.tipo_servico_id

    UNION ALL

    -- 5. DIARISTAS
    SELECT 
        d.id,
        'DIARISTA' AS tipo,
        COALESCE('Lote ' || substring(d.lote_fechamento_id::text, 1, 6), 'Diária ' || substring(d.id::text, 1, 6)) AS referencia,
        COALESCE(c.nome, d.nome_colaborador, 'Diarista') AS colaborador,
        'Lançamento de diária' AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        COALESCE(c.cargo, d.funcao_colaborador, '—') AS operacao,
        COALESCE(d.valor_calculado, 0)::numeric AS valor,
        COALESCE(d.quantidade_diaria::text || ' diária(s)', '—') AS horas,
        to_char(d.data_lancamento, 'YYYY-MM') AS competencia,
        COALESCE(d.created_at, d.data_lancamento::timestamp) AS data_recebimento,
        d.status AS raw_status,
        d.empresa_id AS empresa_id,
        d.data_lancamento AS filter_data,
        d.lote_fechamento_id AS raw_lote_id
    FROM public.lancamentos_diaristas d
    LEFT JOIN public.empresas e ON e.id = d.empresa_id
    LEFT JOIN public.colaboradores c ON c.id = d.diarista_id

    UNION ALL

    -- 6. INTERMITENTES
    SELECT 
        il.id,
        'INTERMITENTE' AS tipo,
        'Lote ' || substring(il.id::text, 1, 6) AS referencia,
        'Lote com ' || COALESCE(il.quantidade_registros, 0) || ' registros' AS colaborador,
        'Fechamento Intermitentes' AS descricao,
        COALESCE(e.nome, '—') AS empresa,
        'Folha Intermitente' AS operacao,
        COALESCE(il.valor_total, 0)::numeric AS valor,
        '-' AS horas,
        il.competencia AS competencia,
        il.created_at AS data_recebimento,
        il.status AS raw_status,
        il.empresa_id AS empresa_id,
        il.periodo_inicio AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM public.intermitentes_lotes_fechamento il
    LEFT JOIN public.empresas e ON e.id = il.empresa_id
)
SELECT 
    c.*,
    CASE
        WHEN upper(c.raw_status) IN (
            'EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 
            'DETALHADO', 'REGISTRADO', 'PENDENTE_RH', 'EM_ANALISE_RH', 'EM_VALIDACAO'
        ) THEN 'Em análise'

        WHEN upper(c.raw_status) IN (
            'APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 
            'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 
            'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO'
        ) THEN 'Aprovado'

        WHEN upper(c.raw_status) IN (
            'DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO', 
            'RECUSADO', 'REPROVADO', 'DEVOLVIDO_RH'
        ) THEN 'Devolvido'

        ELSE 'Em análise'
    END AS situacao
FROM combined c;

COMMIT;

-- Atualizar cache do PostgREST
NOTIFY pgrst, 'reload schema';
