-- ==============================================================================
-- CORREÇÃO DA REABERTURA DE PERÍODO DE DIARISTAS
-- ==============================================================================
-- Garante que o lote retorne a 'EM_ABERTO', limpa informações de pagamento,
-- remove lançamentos financeiros criados na aprovação, e reverte os lançamentos
-- operacionais para que possam ser agrupados novamente.

CREATE OR REPLACE FUNCTION public.reabrir_periodo_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT,
  p_motivo TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_periodo_inicio DATE;
  v_periodo_fim DATE;
  v_tenant_id UUID;
  v_competencia TEXT;
  v_row RECORD;
BEGIN
  -- 1. Obter informações do lote
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  v_competencia := to_char(v_periodo_inicio, 'YYYY-MM');

  -- 2. Reverter os registros financeiros (Faturas e Consolidados)
  -- Para cada diarista no lote, revertemos o consolidado e deletamos a fatura gerada
  FOR v_row IN (
    SELECT 
      diarista_id, 
      SUM(valor_calculado) as total_valor
    FROM public.lancamentos_diaristas
    WHERE lote_fechamento_id = p_lote_id
    GROUP BY diarista_id
  ) LOOP
    
    -- Deleta a fatura criada para este diarista neste período
    DELETE FROM public.faturas
    WHERE empresa_id = v_empresa_id
      AND colaborador_id = v_row.diarista_id
      AND competencia = v_competencia
      AND vencimento = v_periodo_fim
      AND status = 'pendente'; -- Apenas faturas pendentes, p/ segurança

    -- Subtrai o valor do consolidado
    UPDATE public.financeiro_consolidados_colaborador
    SET valor_total = valor_total - v_row.total_valor
    WHERE empresa_id = v_empresa_id
      AND colaborador_id = v_row.diarista_id
      AND competencia = v_competencia;
      
    -- Remove o consolidado se o valor ficar zerado (ou menor)
    DELETE FROM public.financeiro_consolidados_colaborador
    WHERE empresa_id = v_empresa_id
      AND colaborador_id = v_row.diarista_id
      AND competencia = v_competencia
      AND valor_total <= 0;

  END LOOP;

  -- 3. Reverter os Lançamentos Diaristas para EM_ABERTO e soltar do Lote
  UPDATE public.lancamentos_diaristas
  SET 
    status = 'EM_ABERTO', 
    lote_fechamento_id = NULL, 
    updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  -- 4. Reverter o Lote Fechamento Diarista
  -- Volta para EM_ABERTO e remove rastros de pagamento
  UPDATE public.diaristas_lotes_fechamento
  SET 
    status = 'EM_ABERTO',
    paid_by = NULL,
    paid_by_nome = NULL,
    paid_at = NULL,
    updated_at = now()
  WHERE id = p_lote_id;

  -- 5. Registrar log de governança (REABRIU)
  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim, motivo)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'REABRIU', v_periodo_inicio, v_periodo_fim, p_motivo);

END;
$$;
