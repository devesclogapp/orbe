CREATE OR REPLACE VIEW public.vw_aprovacoes_rh AS

WITH combined AS (
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
    FROM registros_ponto p
    LEFT JOIN colaboradores c ON c.id = p.colaborador_id
    LEFT JOIN empresas e ON e.id = c.empresa_id

    UNION ALL

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
        op.status AS raw_status,
        op.empresa_id AS empresa_id,
        op.data_operacao AS filter_data,
        NULL::uuid AS raw_lote_id
    FROM operacoes_producao op
    LEFT JOIN empresas e ON e.id = op.empresa_id
    LEFT JOIN colaboradores c ON c.id = op.colaborador_id
    LEFT JOIN tipos_servico_operacional ts ON ts.id = op.tipo_servico_id

    UNION ALL

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
    FROM custos_extras_operacionais ce
    LEFT JOIN empresas e ON e.id = ce.empresa_id

    UNION ALL

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
    FROM servicos_extras_operacionais se
    LEFT JOIN empresas e ON e.id = se.empresa_id
    LEFT JOIN tipos_servico_operacional ts ON ts.id = se.tipo_servico_id

    UNION ALL

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
    FROM lancamentos_diaristas d
    LEFT JOIN empresas e ON e.id = d.empresa_id
    LEFT JOIN colaboradores c ON c.id = d.diarista_id

    UNION ALL

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
    FROM intermitentes_lotes_fechamento il
    LEFT JOIN empresas e ON e.id = il.empresa_id
)
SELECT 
    c.*,
    CASE
        WHEN upper(c.raw_status) IN ('EM_ABERTO', 'PENDENTE', 'AGUARDANDO_VALIDACAO_RH', 'EM_ANALISE', 'DETALHADO', 'REGISTRADO') THEN 'Em análise'
        WHEN upper(c.raw_status) IN ('APROVADO', 'VALIDADO_RH', 'VALIDADO', 'FECHADO_FINANCEIRO', 'PAGO', 'PROCESSADO', 'CNAB_GERADO', 'AGUARDANDO_PAGAMENTO', 'CONCLUIDO', 'FINALIZADO', 'FECHADO', 'APROVADO_OPERACAO', 'EM_VALIDACAO') THEN 'Aprovado'
        WHEN upper(c.raw_status) IN ('DEVOLVIDO', 'CANCELADO', 'CANCELADO_RH', 'RETORNADO', 'RECUSADO', 'REPROVADO') THEN 'Devolvido'
        ELSE 'Em análise'
    END AS situacao
FROM combined c;

-- Grant access to authenticated users
GRANT SELECT ON public.vw_aprovacoes_rh TO authenticated;
