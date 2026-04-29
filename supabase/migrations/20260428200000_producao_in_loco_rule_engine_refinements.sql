ALTER TABLE public.fornecedor_valores_servico
DROP CONSTRAINT IF EXISTS fornecedor_valores_servico_tipo_calculo_check;

ALTER TABLE public.fornecedor_valores_servico
ADD CONSTRAINT fornecedor_valores_servico_tipo_calculo_check
CHECK (tipo_calculo IN ('volume', 'daily', 'operation', 'colaborador'));

ALTER TABLE public.operacoes_producao
DROP CONSTRAINT IF EXISTS operacoes_producao_tipo_calculo_snapshot_check;

ALTER TABLE public.operacoes_producao
ADD CONSTRAINT operacoes_producao_tipo_calculo_snapshot_check
CHECK (tipo_calculo_snapshot IN ('volume', 'daily', 'operation', 'colaborador'));

UPDATE public.fornecedor_valores_servico
SET tipo_calculo = 'operation'
WHERE tipo_calculo = 'fixo';

UPDATE public.operacoes_producao
SET tipo_calculo_snapshot = 'operation'
WHERE tipo_calculo_snapshot = 'fixo';

CREATE OR REPLACE FUNCTION public.resolver_valor_operacao(
  p_empresa_id UUID,
  p_unidade_id UUID,
  p_tipo_servico_id UUID,
  p_fornecedor_id UUID,
  p_transportadora_id UUID DEFAULT NULL,
  p_produto_carga_id UUID DEFAULT NULL,
  p_data_operacao DATE DEFAULT current_date
)
RETURNS TABLE (
  regra_id UUID,
  valor_unitario NUMERIC,
  tipo_calculo TEXT,
  regra_encontrada BOOLEAN,
  mensagem_bloqueio TEXT,
  status_regra TEXT,
  produto_obrigatorio BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  WITH regras_base AS (
    SELECT
      fvs.*,
      (
        CASE WHEN fvs.unidade_id IS NOT NULL THEN 8 ELSE 0 END +
        CASE WHEN fvs.transportadora_id IS NOT NULL THEN 4 ELSE 0 END +
        CASE WHEN fvs.produto_carga_id IS NOT NULL THEN 2 ELSE 0 END
      ) AS prioridade
    FROM public.fornecedor_valores_servico fvs
    WHERE fvs.empresa_id = p_empresa_id
      AND fvs.fornecedor_id = p_fornecedor_id
      AND fvs.tipo_servico_id = p_tipo_servico_id
      AND fvs.ativo = true
      AND (fvs.unidade_id IS NULL OR fvs.unidade_id = p_unidade_id)
      AND (fvs.transportadora_id IS NULL OR fvs.transportadora_id = p_transportadora_id)
      AND (fvs.produto_carga_id IS NULL OR fvs.produto_carga_id = p_produto_carga_id)
      AND fvs.vigencia_inicio <= COALESCE(p_data_operacao, current_date)
      AND (fvs.vigencia_fim IS NULL OR fvs.vigencia_fim >= COALESCE(p_data_operacao, current_date))
  ),
  prioridade_maxima AS (
    SELECT MAX(prioridade) AS prioridade
    FROM regras_base
  ),
  regras_escolhidas AS (
    SELECT rb.*
    FROM regras_base rb
    CROSS JOIN prioridade_maxima pm
    WHERE rb.prioridade = pm.prioridade
  ),
  regra_unica AS (
    SELECT *
    FROM regras_escolhidas
    ORDER BY vigencia_inicio DESC, created_at DESC, id DESC
    LIMIT 1
  ),
  resumo AS (
    SELECT
      EXISTS (SELECT 1 FROM regras_base) AS encontrou_alguma_regra,
      EXISTS (
        SELECT 1
        FROM public.fornecedor_valores_servico fvs
        WHERE fvs.empresa_id = p_empresa_id
          AND fvs.fornecedor_id = p_fornecedor_id
          AND fvs.tipo_servico_id = p_tipo_servico_id
          AND fvs.ativo = true
          AND (fvs.unidade_id IS NULL OR fvs.unidade_id = p_unidade_id)
          AND (fvs.transportadora_id IS NULL OR fvs.transportadora_id = p_transportadora_id)
          AND fvs.produto_carga_id IS NOT NULL
          AND fvs.vigencia_inicio <= COALESCE(p_data_operacao, current_date)
          AND (fvs.vigencia_fim IS NULL OR fvs.vigencia_fim >= COALESCE(p_data_operacao, current_date))
      ) AS existe_regra_com_produto,
      (SELECT COUNT(*) FROM regras_escolhidas) AS total_regras_escolhidas
  )
  SELECT
    ru.id AS regra_id,
    ru.valor_unitario,
    ru.tipo_calculo,
    true AS regra_encontrada,
    NULL::TEXT AS mensagem_bloqueio,
    'found'::TEXT AS status_regra,
    false AS produto_obrigatorio
  FROM regra_unica ru
  CROSS JOIN resumo r
  WHERE r.total_regras_escolhidas = 1

  UNION ALL

  SELECT
    NULL::UUID,
    NULL::NUMERIC,
    NULL::TEXT,
    false,
    'Existem regras duplicadas para esta combinação. Solicite revisão ao Financeiro.'::TEXT,
    'duplicate'::TEXT,
    false
  FROM resumo r
  WHERE r.total_regras_escolhidas > 1

  UNION ALL

  SELECT
    NULL::UUID,
    NULL::NUMERIC,
    NULL::TEXT,
    false,
    'Selecione o produto/carga para localizar a regra operacional.'::TEXT,
    'needs_product'::TEXT,
    true
  FROM resumo r
  WHERE r.total_regras_escolhidas = 0
    AND r.existe_regra_com_produto
    AND p_produto_carga_id IS NULL

  UNION ALL

  SELECT
    NULL::UUID,
    NULL::NUMERIC,
    NULL::TEXT,
    false,
    'Fornecedor sem valor cadastrado. Solicite ao Admin ou Financeiro o cadastro da regra operacional.'::TEXT,
    'missing'::TEXT,
    false
  FROM resumo r
  WHERE r.total_regras_escolhidas = 0
    AND NOT (r.existe_regra_com_produto AND p_produto_carga_id IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.calcular_valor_total_operacao_producao()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.valor_total :=
    CASE
      WHEN NEW.tipo_calculo_snapshot = 'operation' THEN COALESCE(NEW.valor_unitario_snapshot, 0)
      WHEN NEW.tipo_calculo_snapshot = 'colaborador' THEN COALESCE(NEW.quantidade_colaboradores, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
      ELSE COALESCE(NEW.quantidade, 0) * COALESCE(NEW.valor_unitario_snapshot, 0)
    END;

  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;
