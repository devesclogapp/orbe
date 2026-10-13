-- ==============================================================================
-- PROCEDIMENTO DE CONTINGÊNCIA SEGURA: CONTINGENCIA-FIX-SEC-01
-- Localização: docs/procedimentos/contingencia_fix_sec_01.sql
-- NOTA CRÍTICA DE SEGURANÇA:
--   Este script NUNCA reativa permissões para o perfil 'anon' nem desativa RLS.
--   Ele resolve potenciais bloqueios operacionais de usuários legítimos ('authenticated')
--   mantendo 100% do isolamento de tenant e a blindagem contra acessos anônimos.
-- ==============================================================================

BEGIN;

-- 1. MANTER REVOGAÇÃO ANÔNIMA EM TODOS OS OBJETOS (INVIOLÁVEL)
REVOKE ALL ON public.lancamentos_diaristas FROM anon;
REVOKE ALL ON public.diaristas_lotes_fechamento FROM anon;
REVOKE ALL ON public.materiais_operacionais FROM anon;
REVOKE ALL ON public.operacao_producao_materiais FROM anon;
REVOKE ALL ON public.regras_financeiras_versoes FROM anon;
REVOKE ALL ON public.financeiro_consolidados_snapshots FROM anon;
REVOKE ALL ON public.documentos_anexos FROM anon;
REVOKE ALL ON public.equipes FROM anon;
REVOKE ALL ON public.vw_audit_timeline_operacional FROM anon;
REVOKE ALL ON public.vw_operacoes_producao_resumo_dia FROM anon;
REVOKE ALL ON public.vw_aprovacoes_rh FROM anon;

-- 2. REAFIRMAR GRANTS PLENOS PARA USUÁRIOS AUTENTICADOS (DIARISTAS, RH, ENCARREGADO)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lancamentos_diaristas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diaristas_lotes_fechamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materiais_operacionais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operacao_producao_materiais TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.regras_financeiras_versoes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_consolidados_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documentos_anexos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipes TO authenticated;
GRANT SELECT ON public.audit_log TO authenticated;
GRANT SELECT ON public.operacoes_producao TO authenticated;
GRANT SELECT ON public.vw_audit_timeline_operacional TO authenticated;
GRANT SELECT ON public.vw_operacoes_producao_resumo_dia TO authenticated;
GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;

-- 3. REAFIRMAR TRIGGERS AUTO-TENANT (GARANTE QUE NENHUM INSERT FALHE POR FALTA DE TENANT_ID)
DROP TRIGGER IF EXISTS trg_auto_tenant_lancamentos_diaristas ON public.lancamentos_diaristas;
CREATE TRIGGER trg_auto_tenant_lancamentos_diaristas
  BEFORE INSERT ON public.lancamentos_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_diaristas_lotes ON public.diaristas_lotes_fechamento;
CREATE TRIGGER trg_auto_tenant_diaristas_lotes
  BEFORE INSERT ON public.diaristas_lotes_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_materiais_operacionais ON public.materiais_operacionais;
CREATE TRIGGER trg_auto_tenant_materiais_operacionais
  BEFORE INSERT ON public.materiais_operacionais
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- 4. CONTINGÊNCIA DE VIEWS CASO HAJA INCOMPATIBILIDADE DE SECURITY INVOKER NO ENGINE
-- Se o engine do PostgreSQL encontrar limitação de permissão de subqueries no invoker,
-- recria as views em modo DEFINER SEGURO (com filtro estrito de tenant_id injetado no SELECT),
-- impedindo vazamento de dados entre empresas mesmo sem invoker.
CREATE OR REPLACE VIEW public.vw_audit_timeline_operacional AS
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
FROM public.audit_log a
WHERE a.tenant_id = public.current_tenant_id()
ORDER BY a.created_at DESC;

CREATE OR REPLACE VIEW public.vw_operacoes_producao_resumo_dia AS
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
WHERE op.tenant_id = public.current_tenant_id()
GROUP BY op.empresa_id, op.unidade_id, op.data_operacao, op.tenant_id;

CREATE OR REPLACE VIEW public.vw_aprovacoes_rh AS
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
    WHERE p.tenant_id = public.current_tenant_id()

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
    WHERE op.tenant_id = public.current_tenant_id()

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
    WHERE ce.tenant_id = public.current_tenant_id()

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
    WHERE se.tenant_id = public.current_tenant_id()

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
    WHERE d.tenant_id = public.current_tenant_id()

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
    WHERE il.tenant_id = public.current_tenant_id()
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

NOTIFY pgrst, 'reload schema';

