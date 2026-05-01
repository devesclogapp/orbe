ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN empresa_id DROP NOT NULL,
  ALTER COLUMN fornecedor_id DROP NOT NULL,
  ALTER COLUMN tipo_servico_id DROP NOT NULL;

DROP INDEX IF EXISTS public.fornecedor_valores_servico_regra_ativa_unique;

CREATE UNIQUE INDEX IF NOT EXISTS fornecedor_valores_servico_regra_ativa_unique
  ON public.fornecedor_valores_servico (
    COALESCE(fornecedor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(tipo_servico_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(transportadora_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(produto_carga_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vigencia_inicio
  );

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
      EXISTS (SELECT 1 FROM regras_base) AS encontrou_alguma_regra,
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
    false AS produto_obrigatorio,
    ru.forma_pagamento_id
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
    false,
    NULL::UUID
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
    true,
    NULL::UUID
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
    'Nenhuma regra operacional ativa foi encontrada para esta combinação.'::TEXT,
    'not_found'::TEXT,
    false,
    NULL::UUID
  FROM resumo r
  WHERE r.total_regras_escolhidas = 0
    AND NOT r.existe_regra_com_produto;
$$;
