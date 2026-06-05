-- Tornar o resolver_iss_operacao dinâmico buscando regras cadastradas pelo admin
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
  WITH iss_rule_types AS (
    SELECT id
    FROM public.tipos_regra_operacional
    WHERE UPPER(COALESCE(nome, '') || ' ' || COALESCE(coluna_planilha, '')) LIKE '%ISS%'
  ),
  regra_ativa AS (
    SELECT 
      fvs.id,
      fvs.valor_unitario as percentual_iss
    FROM public.fornecedor_valores_servico fvs
    JOIN iss_rule_types irt ON irt.id = fvs.tipo_regra_id
    WHERE fvs.ativo = true
      AND (fvs.empresa_id IS NULL OR fvs.empresa_id = p_empresa_id)
      AND fvs.vigencia_inicio <= COALESCE(p_data_operacao, current_date)
      AND (fvs.vigencia_fim IS NULL OR fvs.vigencia_fim >= COALESCE(p_data_operacao, current_date))
    ORDER BY (fvs.empresa_id IS NOT NULL) DESC, fvs.created_at DESC
    LIMIT 1
  )
  SELECT 
    COALESCE((SELECT id FROM regra_ativa), NULL::UUID) AS regra_id,
    COALESCE((SELECT percentual_iss FROM regra_ativa), 0.05::NUMERIC) AS percentual_iss,
    true::BOOLEAN AS regra_encontrada;
$$;
