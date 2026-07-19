DO $$ 
DECLARE 
  r_lote RECORD;
  r_lanc RECORD;
  v_rh_lote_id UUID;
BEGIN
  FOR r_lote IN 
    SELECT * FROM intermitentes_lotes_fechamento WHERE status = 'FECHADO_FINANCEIRO' 
  LOOP
    -- Verify if structurally we already have a batch for (empresa_id, competencia)
    SELECT id INTO v_rh_lote_id FROM rh_financeiro_lotes 
    WHERE tenant_id = r_lote.tenant_id AND empresa_id = r_lote.empresa_id 
      AND competencia = r_lote.competencia AND origem = 'OPERACIONAL' AND tipo = 'INTERMITENTES';
      
    IF v_rh_lote_id IS NULL THEN
      -- Create the batch explicitly since it doesn't exist
      INSERT INTO rh_financeiro_lotes (
        tenant_id, empresa_id, competencia, origem, tipo, 
        total_colaboradores, valor_total, status, created_at, updated_at
      ) VALUES (
        r_lote.tenant_id, r_lote.empresa_id, r_lote.competencia, 'OPERACIONAL', 'INTERMITENTES',
        0, 0, 'AGUARDANDO_PAGAMENTO', now(), now()
      ) RETURNING id INTO v_rh_lote_id;
    END IF;

    -- Delete items specific to this operational batch to ensure idempotency for re-runs
    DELETE FROM rh_financeiro_lote_itens 
    WHERE lote_id = v_rh_lote_id AND origem_evento = 'lancamentos_intermitentes' 
      AND referencia_evento_id IN (SELECT id FROM lancamentos_intermitentes WHERE lote_fechamento_id = r_lote.id);
    
    FOR r_lanc IN 
        SELECT * FROM lancamentos_intermitentes WHERE lote_fechamento_id = r_lote.id
    LOOP
      INSERT INTO rh_financeiro_lote_itens (
        lote_id, tenant_id, colaborador_id, nome_colaborador, tipo_evento,
        horas, minutos, valor_calculado, origem_evento, referencia_evento_id, status
      ) VALUES (
        v_rh_lote_id, r_lote.tenant_id, r_lanc.colaborador_id, r_lanc.nome_colaborador, 'LANCAMENTO_INTERMITENTE',
        coalesce(r_lanc.horas_trabalhadas, 0), 
        round(coalesce(r_lanc.horas_trabalhadas, 0) * 60), 
        coalesce(r_lanc.total, 0), 'lancamentos_intermitentes', r_lanc.id, 'PENDENTE'
      );
    END LOOP;
    
    -- Recalculate aggregation for this target structural batch
    UPDATE rh_financeiro_lotes 
    SET 
      valor_total = (SELECT coalesce(sum(valor_calculado), 0) FROM rh_financeiro_lote_itens WHERE lote_id = v_rh_lote_id),
      total_colaboradores = (SELECT count(DISTINCT coalesce(colaborador_id::varchar, nome_colaborador)) FROM rh_financeiro_lote_itens WHERE lote_id = v_rh_lote_id)
    WHERE id = v_rh_lote_id;
      
    RAISE NOTICE 'Processed lote % into rh_lote %', r_lote.id, v_rh_lote_id;
  END LOOP;
END $$;
