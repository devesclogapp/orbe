-- Recriar função resolver_valor_operacao
CREATE OR REPLACE FUNCTION public.resolver_valor_operacao(
  p_empresa_id UUID,
  p_unidade_id UUID,
  p_tipo_servico_id UUID,
  p_fornecedor_id UUID DEFAULT NULL,
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
  produto_obrigatorio BOOLEAN,
  forma_pagamento_id UUID
)
LANGUAGE sql
STABLE
AS $$
  WITH regras_base AS (
    SELECT
      fvs.*,
      (
        CASE WHEN fvs.empresa_id IS NOT NULL THEN 32 ELSE 0 END +
        CASE WHEN fvs.tipo_servico_id IS NOT NULL THEN 16 ELSE 0 END +
        CASE WHEN fvs.fornecedor_id IS NOT NULL THEN 8 ELSE 0 END +
        CASE WHEN fvs.unidade_id IS NOT NULL THEN 4 ELSE 0 END +
        CASE WHEN fvs.transportadora_id IS NOT NULL THEN 2 ELSE 0 END +
        CASE WHEN fvs.produto_carga_id IS NOT NULL THEN 1 ELSE 0 END
      ) AS prioridade
    FROM public.fornecedor_valores_servico fvs
    WHERE (fvs.empresa_id IS NULL OR fvs.empresa_id = p_empresa_id)
      AND (fvs.fornecedor_id IS NULL OR fvs.fornecedor_id = p_fornecedor_id)
      AND (fvs.tipo_servico_id IS NULL OR fvs.tipo_servico_id = p_tipo_servico_id)
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
      EXISTS (SELECT 1 FROM regras_base) AS obteve_alguma_regra,
      EXISTS (
        SELECT 1
        FROM public.fornecedor_valores_servico fvs
        WHERE (fvs.empresa_id IS NULL OR fvs.empresa_id = p_empresa_id)
          AND (fvs.fornecedor_id IS NULL OR fvs.fornecedor_id = p_fornecedor_id)
          AND (fvs.tipo_servico_id IS NULL OR fvs.tipo_servico_id = p_tipo_servico_id)
          AND fvs.ativo = true
          AND (fvs.unidade_id IS NULL OR fvs.unidade_id = p_unidade_id)
          AND (fvs.transportadora_id IS NULL OR fvs.transportadora_id = p_transportadora_id)
          AND fvs.produto_carga_id IS NOT NULL
          AND fvs.vigencia_inicio <= COALESCE(p_data_operacao, current_date)
          AND (fvs.vigencia_fim IS NULL OR fvs.vigencia_fim >= COALESCE(p_data_operacao, current_date))
      ) AS tem_regra_com_produto
  )
  SELECT
    ru.id AS regra_id,
    ru.valor_unitario,
    COALESCE(ru.tipo_calculo, 'volume') AS tipo_calculo,
    CASE WHEN ru.id IS NOT NULL THEN true ELSE false END AS regra_encontrada,
    CASE
      WHEN ru.id IS NULL AND (SELECT obteve_alguma_regra FROM resumo) = true AND p_produto_carga_id IS NULL THEN 'needs_product'
      WHEN ru.id IS NULL AND (SELECT tem_regra_com_produto FROM resumo) = true AND p_produto_carga_id IS NOT NULL THEN 'duplicate'
      WHEN ru.id IS NULL THEN 'missing'
      ELSE 'found'
    END AS status_regra,
    NULL::TEXT AS mensagem_bloqueio,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.fornecedor_valores_servico fvs
        WHERE (fvs.empresa_id IS NULL OR fvs.empresa_id = p_empresa_id)
          AND (fvs.fornecedor_id IS NULL OR fvs.fornecedor_id = p_fornecedor_id)
          AND (fvs.tipo_servico_id IS NULL OR fvs.tipo_servico_id = p_tipo_servico_id)
          AND fvs.ativo = true
          AND fvs.produto_carga_id IS NOT NULL
          AND fvs.vigencia_inicio <= COALESCE(p_data_operacao, current_date)
          AND (fvs.vigencia_fim IS NULL OR fvs.vigencia_fim >= COALESCE(p_data_operacao, current_date))
      ) THEN true
      ELSE false
    END AS produto_obrigatorio,
    ru.forma_pagamento_id
  FROM regra_unica ru;
$$;

-- Recriar função resolver_iss_operacao
-- Retorna ISS padrão de 5% quando há nota fiscal
CREATE OR REPLACE FUNCTION public.resolver_iss_operacao(
  p_empresa_id UUID,
  p_tipo_servico_id UUID DEFAULT NULL,
  p_data_operacao DATE DEFAULT current_date
)
RETURNS TABLE (
  regra_id UUID,
  percentual_iss NUMERIC,
  regra_encontrada BOOLEAN
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    NULL::UUID AS regra_id,
    0.05::NUMERIC AS percentual_iss,
    true::BOOLEAN AS regra_encontrada;
$$;