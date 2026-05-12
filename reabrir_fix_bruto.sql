-- ==============================================================================
-- CORREÇÃO DA REABERTURA DE PERÍODO DE DIARISTAS (FORÇA BRUTA)
-- ==============================================================================

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
BEGIN
  -- 1. Obter informações do lote
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado';
  END IF;

  v_competencia := to_char(v_periodo_inicio, 'YYYY-MM');

  -- 2. Limpar Financeiro: Faturas e Consolidados
  DELETE FROM public.faturas
  WHERE empresa_id = v_empresa_id
    AND competencia = v_competencia
    AND vencimento = v_periodo_fim
    AND colaborador_id IN (
      SELECT diarista_id FROM public.lancamentos_diaristas
      WHERE empresa_id = v_empresa_id
        AND data_lancamento >= v_periodo_inicio
        AND data_lancamento <= v_periodo_fim
    );

  DELETE FROM public.financeiro_consolidados_colaborador
  WHERE empresa_id = v_empresa_id
    AND competencia = v_competencia
    AND colaborador_id IN (
      SELECT diarista_id FROM public.lancamentos_diaristas
      WHERE empresa_id = v_empresa_id
        AND data_lancamento >= v_periodo_inicio
        AND data_lancamento <= v_periodo_fim
    );

  -- 3. FORÇA BRUTA: Reverter TODOS os lançamentos Diaristas Operacionais para EM_ABERTO 
  -- Se o Lote está sendo reaberto, TODO o período operacional tem que voltar a ficar aberto.
  -- Usamos ILIKE para não falhar por case sensitivity e pegamos TUDO que não seja cancelado.
  UPDATE public.lancamentos_diaristas
  SET 
    status = 'EM_ABERTO', 
    lote_fechamento_id = NULL, 
    updated_at = now()
  WHERE empresa_id = v_empresa_id
    AND data_lancamento >= v_periodo_inicio
    AND data_lancamento <= v_periodo_fim
    AND status NOT ILIKE 'cancelado';

  -- 4. Reverter o Lote Fechamento Diarista
  UPDATE public.diaristas_lotes_fechamento
  SET 
    status = 'EM_ABERTO',
    paid_by = NULL,
    paid_by_nome = NULL,
    paid_at = NULL,
    updated_at = now()
  WHERE id = p_lote_id;

  -- 5. Se houver Lotes Duplicados para o mesmo período/empresa, matamos eles para evitar fantasmas
  DELETE FROM public.diaristas_lotes_fechamento
  WHERE empresa_id = v_empresa_id
    AND periodo_inicio = v_periodo_inicio
    AND periodo_fim = v_periodo_fim
    AND id != p_lote_id
    AND status ILIKE 'em_aberto';

  -- 6. Registrar log de governança (REABRIU)
  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim, motivo)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'REABRIU', v_periodo_inicio, v_periodo_fim, p_motivo);

END;
$$;
