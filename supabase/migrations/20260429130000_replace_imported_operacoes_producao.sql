CREATE OR REPLACE FUNCTION public.replace_imported_operacoes_producao(
  p_empresa_id UUID,
  p_items JSONB
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dates DATE[];
  v_count INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa é obrigatória para reimportação.';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN 0;
  END IF;

  SELECT array_agg(DISTINCT (item->>'data_operacao')::date)
    INTO v_dates
  FROM jsonb_array_elements(p_items) AS item
  WHERE COALESCE(item->>'data_operacao', '') <> '';

  IF v_dates IS NULL OR array_length(v_dates, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhuma data válida encontrada na importação.';
  END IF;

  DELETE FROM public.operacoes_producao
  WHERE empresa_id = p_empresa_id
    AND origem_dado = 'importacao'
    AND data_operacao = ANY(v_dates);

  INSERT INTO public.operacoes_producao (
    empresa_id,
    data_operacao,
    tipo_servico_id,
    fornecedor_id,
    transportadora_id,
    entrada_ponto,
    saida_ponto,
    tipo_calculo_snapshot,
    valor_unitario_snapshot,
    quantidade,
    quantidade_colaboradores,
    valor_total,
    placa,
    nf_numero,
    ctrc,
    percentual_iss,
    valor_descarga,
    custo_com_iss,
    valor_unitario_filme,
    quantidade_filme,
    valor_total_filme,
    valor_faturamento_nf,
    avaliacao_json,
    status,
    origem_dado
  )
  SELECT
    p_empresa_id,
    (item->>'data_operacao')::date,
    NULLIF(item->>'tipo_servico_id', '')::uuid,
    NULLIF(item->>'fornecedor_id', '')::uuid,
    NULLIF(item->>'transportadora_id', '')::uuid,
    NULLIF(item->>'entrada_ponto', '')::time,
    NULLIF(item->>'saida_ponto', '')::time,
    COALESCE(item->>'tipo_calculo_snapshot', 'volume'),
    COALESCE((item->>'valor_unitario_snapshot')::numeric, 0),
    COALESCE((item->>'quantidade')::numeric, 0),
    COALESCE((item->>'quantidade_colaboradores')::integer, 1),
    COALESCE((item->>'valor_total')::numeric, 0),
    NULLIF(item->>'placa', ''),
    NULLIF(item->>'nf_numero', ''),
    NULLIF(item->>'ctrc', ''),
    COALESCE((item->>'percentual_iss')::numeric, 0),
    COALESCE((item->>'valor_descarga')::numeric, 0),
    COALESCE((item->>'custo_com_iss')::numeric, 0),
    COALESCE((item->>'valor_unitario_filme')::numeric, 0),
    COALESCE((item->>'quantidade_filme')::numeric, 0),
    COALESCE((item->>'valor_total_filme')::numeric, 0),
    COALESCE((item->>'valor_faturamento_nf')::numeric, 0),
    COALESCE(item->'avaliacao_json', '{}'::jsonb),
    COALESCE(item->>'status', 'pendente'),
    COALESCE(item->>'origem_dado', 'importacao')
  FROM jsonb_array_elements(p_items) AS item;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_imported_operacoes_producao(UUID, JSONB) TO authenticated;
