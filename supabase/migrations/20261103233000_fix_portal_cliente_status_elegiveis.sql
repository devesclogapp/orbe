-- ==============================================================================
-- MIGRATION: 20261103233000_fix_portal_cliente_status_elegiveis.sql
-- DOMÍNIO: Portal do Cliente — Compatibilização de Status Operacionais Elegíveis
-- OBJETIVO:
--   1. Corrigir o filtro de status em get_portal_cliente_operacoes e get_portal_cliente_stats
--      para aceitar os status canônicos em UPPERCASE gravados pelo motor operacional:
--      'RECEBIDO', 'AGUARDANDO_FATURAMENTO', 'FATURADO', 'CONCLUIDO', 'FECHADO', 'RECEBIDO_FINANCEIRO'.
--   2. Bloquear rigorosamente status em inconsistência ou cancelados ('EM_RESTRICAO', 'INCONSISTENTE', 'CANCELADO').
--   3. Preservar integralmente o isolamento por tenant, empresa contratante e deleted_at IS NULL.
--   4. Preservar o mascaramento estrito de custos, valores unitários, diárias e colaboradores.
-- STATUS: INCREMENTAL — PREPARADA LOCALMENTE (NÃO APLICADA AUTOMATICAMENTE EM PRODUÇÃO).
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ATUALIZAÇÃO DA RPC CANÔNICA DE LEITURA OPERACIONAL: get_portal_cliente_operacoes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_cliente_operacoes(
  p_data_inicio DATE DEFAULT NULL,
  p_data_fim DATE DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_tipo_servico_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  data_operacao DATE,
  empresa_nome TEXT,
  transportadora_nome TEXT,
  fornecedor_nome TEXT,
  tipo_servico_nome TEXT,
  produto_nome TEXT,
  quantidade NUMERIC,
  placa TEXT,
  nf_numero TEXT,
  ctrc TEXT,
  horario_inicio TIME,
  horario_fim TIME,
  status_operacional TEXT,
  observacao TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_empresa_id UUID;
  v_limit INT;
  v_offset INT;
BEGIN
  -- 1. Obter usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN; -- Fail-closed para requisições anônimas
  END IF;

  -- 2. Resolver o vínculo ativo da empresa contratante autorizada para este usuário
  SELECT pcu.tenant_id, pcu.empresa_id
    INTO v_tenant_id, v_empresa_id
    FROM public.portal_cliente_usuarios pcu
   WHERE pcu.user_id = v_user_id
     AND pcu.ativo = true
   LIMIT 1;

  -- Fail-closed se o usuário não possuir vínculo ativo com a empresa contratante
  IF v_tenant_id IS NULL OR v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  -- Sanitização rigorosa de paginação para evitar DoS
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset := GREATEST(COALESCE(p_offset, 0), 0);

  -- 3. Retornar dados hermeticamente filtrados pela EMPRESA CONTRATANTE
  RETURN QUERY
  WITH filtered_ops AS (
    SELECT
      op.id,
      op.data_operacao,
      emp.nome AS empresa_nome,
      COALESCE(tc.nome, '-') AS transportadora_nome,
      COALESCE(forn.nome, '-') AS fornecedor_nome,
      COALESCE(ts.nome, 'Operação Padrão') AS tipo_servico_nome,
      COALESCE(pc.nome, 'Geral') AS produto_nome,
      op.quantidade,
      COALESCE(op.placa, '-') AS placa,
      COALESCE(op.nf_numero, '-') AS nf_numero,
      COALESCE(op.ctrc, '-') AS ctrc,
      op.entrada_ponto AS horario_inicio,
      op.saida_ponto AS horario_fim,
      CASE
        WHEN UPPER(op.status) IN ('CONCLUIDO', 'FECHADO', 'RECEBIDO_FINANCEIRO') THEN 'Concluído'
        WHEN UPPER(op.status) = 'FATURADO' THEN 'Faturado'
        WHEN UPPER(op.status) = 'AGUARDANDO_FATURAMENTO' THEN 'Concluído'
        WHEN UPPER(op.status) = 'RECEBIDO' THEN 'Recebido'
        ELSE 'Em conferência'
      END AS status_operacional,
      COALESCE(op.observacao, '') AS observacao
    FROM public.operacoes_producao op
    JOIN public.empresas emp ON emp.id = op.empresa_id
    LEFT JOIN public.transportadoras_clientes tc ON tc.id = op.transportadora_id
    LEFT JOIN public.fornecedores forn ON forn.id = op.fornecedor_id
    LEFT JOIN public.tipos_servico_operacional ts ON ts.id = op.tipo_servico_id
    LEFT JOIN public.produtos_carga pc ON pc.id = op.produto_carga_id
    WHERE op.tenant_id = v_tenant_id
      AND op.empresa_id = v_empresa_id -- ISOLAMENTO ESTRITO POR EMPRESA CONTRATANTE
      AND op.deleted_at IS NULL
      -- Apenas operações com serviços efetivamente executados e autorizados
      AND UPPER(op.status) IN ('RECEBIDO', 'AGUARDANDO_FATURAMENTO', 'FATURADO', 'CONCLUIDO', 'FECHADO', 'RECEBIDO_FINANCEIRO')
      -- Filtros opcionais seguros
      AND (p_data_inicio IS NULL OR op.data_operacao >= p_data_inicio)
      AND (p_data_fim IS NULL OR op.data_operacao <= p_data_fim)
      AND (p_status IS NULL OR UPPER(op.status) = UPPER(p_status))
      AND (p_tipo_servico_id IS NULL OR op.tipo_servico_id = p_tipo_servico_id)
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered_ops
  )
  SELECT
    f.id,
    f.data_operacao,
    f.empresa_nome,
    f.transportadora_nome,
    f.fornecedor_nome,
    f.tipo_servico_nome,
    f.produto_nome,
    f.quantidade,
    f.placa,
    f.nf_numero,
    f.ctrc,
    f.horario_inicio,
    f.horario_fim,
    f.status_operacional,
    f.observacao,
    c.total AS total_count
  FROM filtered_ops f
  CROSS JOIN counted c
  ORDER BY f.data_operacao DESC, f.horario_inicio DESC NULLS LAST
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. ATUALIZAÇÃO DA RPC CANÔNICA DE KPIS AGREGADOS: get_portal_cliente_stats
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_portal_cliente_stats(
  p_competencia TEXT DEFAULT NULL -- Formato 'YYYY-MM'
)
RETURNS TABLE (
  total_operacoes BIGINT,
  volume_total NUMERIC,
  operacoes_hoje BIGINT,
  empresa_nome TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_empresa_id UUID;
  v_empresa_nome TEXT;
  v_comp TEXT;
  v_inicio_mes DATE;
  v_fim_mes DATE;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN;
  END IF;

  SELECT pcu.tenant_id, pcu.empresa_id
    INTO v_tenant_id, v_empresa_id
    FROM public.portal_cliente_usuarios pcu
   WHERE pcu.user_id = v_user_id
     AND pcu.ativo = true
   LIMIT 1;

  IF v_tenant_id IS NULL OR v_empresa_id IS NULL THEN
    RETURN;
  END IF;

  -- Resolver nome canônico da empresa contratante
  SELECT emp.nome INTO v_empresa_nome
    FROM public.empresas emp
   WHERE emp.id = v_empresa_id;

  v_comp := COALESCE(p_competencia, TO_CHAR(CURRENT_DATE, 'YYYY-MM'));
  v_inicio_mes := TO_DATE(v_comp || '-01', 'YYYY-MM-DD');
  v_fim_mes := (v_inicio_mes + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_operacoes,
    COALESCE(SUM(op.quantidade), 0)::NUMERIC AS volume_total,
    COUNT(*) FILTER (WHERE op.data_operacao = CURRENT_DATE)::BIGINT AS operacoes_hoje,
    COALESCE(v_empresa_nome, 'Empresa Contratante') AS empresa_nome
  FROM public.operacoes_producao op
  WHERE op.tenant_id = v_tenant_id
    AND op.empresa_id = v_empresa_id -- ISOLAMENTO ESTRITO POR EMPRESA CONTRATANTE
    AND op.deleted_at IS NULL
    AND UPPER(op.status) IN ('RECEBIDO', 'AGUARDANDO_FATURAMENTO', 'FATURADO', 'CONCLUIDO', 'FECHADO', 'RECEBIDO_FINANCEIRO')
    AND op.data_operacao >= v_inicio_mes
    AND op.data_operacao <= v_fim_mes;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. GARANTIA DE PRIVILÉGIOS (LEAST PRIVILEGE)
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_portal_cliente_operacoes FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_operacoes TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_operacoes TO service_role;

REVOKE ALL ON FUNCTION public.get_portal_cliente_stats FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_portal_cliente_stats TO service_role;

COMMIT;
