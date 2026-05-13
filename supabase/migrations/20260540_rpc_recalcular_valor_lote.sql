-- ============================================================
-- RPC: recalcular_valor_lote
-- Recalcula o valor_total do lote somando todos os lançamentos
-- vinculados (por lote_fechamento_id OU por empresa+período).
-- SECURITY DEFINER garante bypass de RLS independente do papel.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalcular_valor_lote(p_lote_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote          RECORD;
  v_total_por_lote  NUMERIC(12,2) := 0;
  v_total_por_periodo NUMERIC(12,2) := 0;
  v_total_final   NUMERIC(12,2) := 0;
  v_count_lote    INTEGER := 0;
  v_count_periodo INTEGER := 0;
BEGIN
  -- 1. Buscar dados do lote
  SELECT id, empresa_id, periodo_inicio, periodo_fim, valor_total
  INTO v_lote
  FROM public.diaristas_lotes_fechamento
  WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Lote não encontrado: ' || p_lote_id::text
    );
  END IF;

  -- 2. Estratégia 1: soma por lote_fechamento_id (link direto)
  SELECT
    COALESCE(SUM(valor_calculado), 0),
    COUNT(*)
  INTO v_total_por_lote, v_count_lote
  FROM public.lancamentos_diaristas
  WHERE lote_fechamento_id = p_lote_id;

  -- 3. Estratégia 2: soma por empresa + período (captura sem FK)
  SELECT
    COALESCE(SUM(valor_calculado), 0),
    COUNT(*)
  INTO v_total_por_periodo, v_count_periodo
  FROM public.lancamentos_diaristas
  WHERE empresa_id = v_lote.empresa_id
    AND data_lancamento >= v_lote.periodo_inicio
    AND data_lancamento <= v_lote.periodo_fim;

  -- 4. Usa o maior total como fonte de verdade
  --    (por período cobre mais lançamentos quando não há FK)
  v_total_final := GREATEST(v_total_por_lote, v_total_por_periodo);

  -- 5. Atualiza o lote
  UPDATE public.diaristas_lotes_fechamento
  SET
    valor_total = v_total_final,
    updated_at  = now()
  WHERE id = p_lote_id;

  RETURN jsonb_build_object(
    'success',           true,
    'lote_id',           p_lote_id,
    'valor_anterior',    v_lote.valor_total,
    'valor_novo',        v_total_final,
    'total_por_lote_id', v_total_por_lote,
    'count_por_lote_id', v_count_lote,
    'total_por_periodo', v_total_por_periodo,
    'count_por_periodo', v_count_periodo
  );
END;
$$;

-- Garante que usuários autenticados podem chamar a função
GRANT EXECUTE ON FUNCTION public.recalcular_valor_lote(UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.recalcular_valor_lote IS
  'Recalcula valor_total do lote diaristas usando SECURITY DEFINER para bypasear RLS.';
