-- ==============================================================================
-- ERP ORBE — SCRIPT SEPARADO DE SANEAMENTO HISTÓRICO: NSA 11 (FIX-RET-07)
-- ATENÇÃO: NÃO EXECUTAR SEM AUTORIZAÇÃO EXPRESSA DO USUÁRIO.
-- ==============================================================================
-- Objetivo:
--   Saneamento auditável e cirúrgico dos três registros de retorno vinculados
--   à remessa NSA 11 (Retorno ID: 853f93c9-0027-4607-b5de-16a557211243),
--   preenchendo a coluna valor_retornado com base na correspondência comprovada
--   do arquivo sintético original (350,00 total = 140,00 + 70,00 + 140,00).
--
-- Restrições:
--   - Não reimporta arquivos de retorno.
--   - Não altera status_conciliacao ou status (permanecem 'conciliado' e 'pago').
--   - Não executa nova baixa ou repetição de liquidação financeira.
--   - Aplica-se estritamente aos 3 IDs validados.
--   - Transação atômica fail-closed: qualquer divergência aborta sem persistir dados.
-- ==============================================================================

DO $$
DECLARE
  v_tenant_id_esperado UUID := '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
  v_empresa_id_esperada UUID := '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  v_retorno_id UUID := '853f93c9-0027-4607-b5de-16a557211243';
  v_remessa_id UUID := '46391aad-6417-48cf-ac78-03a2a9dd8b22';
  v_lote_diaristas_id UUID := '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  v_hash_esperado TEXT := '63d7676370e65fa1212132912b79b96ccffaab2384273b868fc5df4303171627';

  -- IDs dos três itens e seus respectivos valores unitários comprovados
  v_item1_id UUID := '1e94a70f-0591-44fb-9541-fb0bc4c6c644';
  v_item1_remessa_item_id UUID := 'c877c3af-f6d0-459e-927e-b9fd58d32f59';
  v_item1_valor NUMERIC := 140.00;

  v_item2_id UUID := '685d7146-f315-4f6a-9609-de6dabbe554e';
  v_item2_remessa_item_id UUID := '3a185f8a-bfab-46db-b8bf-ede7f5c14c0f';
  v_item2_valor NUMERIC := 70.00;

  v_item3_id UUID := '88f71013-09a6-48a8-9446-179930134950';
  v_item3_remessa_item_id UUID := '63d410ec-c27f-4b4a-9a07-655c4b00e926';
  v_item3_valor NUMERIC := 140.00;

  v_chk_retorno RECORD;
  v_chk_remessa RECORD;
  v_chk_lote RECORD;
  v_itens_validos_count INT := 0;
  v_itens_atualizados INT := 0;
  v_soma_retornada NUMERIC := 0;
  v_usuario_auditoria UUID;
BEGIN
  -- ============================================================================
  -- 1. PRE-CHECK 1: Cabeçalho do Retorno Processado
  -- ============================================================================
  SELECT id, nome_arquivo, hash_arquivo, status, modo, total_sucesso, total_linhas,
         remessa_arquivo_id, empresa_id, tenant_id, usuario_processamento
  INTO v_chk_retorno
  FROM public.cnab_retorno_arquivos
  WHERE id = v_retorno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Arquivo de retorno % não encontrado.', v_retorno_id;
  END IF;

  IF v_chk_retorno.tenant_id <> v_tenant_id_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Tenant do retorno (%) diverge do tenant esperado (%).', v_chk_retorno.tenant_id, v_tenant_id_esperado;
  END IF;

  IF v_chk_retorno.empresa_id <> v_empresa_id_esperada THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Empresa do retorno (%) diverge da empresa esperada (%).', v_chk_retorno.empresa_id, v_empresa_id_esperada;
  END IF;

  IF v_chk_retorno.modo <> 'homologacao' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Modo do retorno (%) não é homologação.', v_chk_retorno.modo;
  END IF;

  IF v_chk_retorno.status <> 'processado' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Status do retorno (%) não é processado.', v_chk_retorno.status;
  END IF;

  IF v_chk_retorno.remessa_arquivo_id <> v_remessa_id THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Vínculo de remessa (%) diverge da remessa esperada (%).', v_chk_retorno.remessa_arquivo_id, v_remessa_id;
  END IF;

  IF v_chk_retorno.hash_arquivo <> v_hash_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Hash do arquivo (%) diverge do hash oficial registrado (%).', v_chk_retorno.hash_arquivo, v_hash_esperado;
  END IF;

  -- ============================================================================
  -- 2. PRE-CHECK 2: Remessa NSA 11
  -- ============================================================================
  SELECT id, modo, sequencial_arquivo, total_valor, total_registros, diaristas_lote_id,
         empresa_id, tenant_id
  INTO v_chk_remessa
  FROM public.cnab_remessas_arquivos
  WHERE id = v_remessa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Remessa NSA 11 (%) não encontrada.', v_remessa_id;
  END IF;

  IF v_chk_remessa.tenant_id <> v_tenant_id_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Tenant da remessa diverge do tenant esperado.';
  END IF;

  IF v_chk_remessa.empresa_id <> v_empresa_id_esperada THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Empresa da remessa diverge da empresa esperada.';
  END IF;

  IF v_chk_remessa.modo <> 'homologacao' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Modo da remessa (%) não é homologacao.', v_chk_remessa.modo;
  END IF;

  IF v_chk_remessa.sequencial_arquivo <> 11 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Sequencial da remessa (%) diverge da NSA 11.', v_chk_remessa.sequencial_arquivo;
  END IF;

  IF v_chk_remessa.diaristas_lote_id <> v_lote_diaristas_id THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Vínculo de lote de diaristas na remessa diverge do lote esperado.';
  END IF;

  IF round(v_chk_remessa.total_valor, 2) <> 350.00 OR v_chk_remessa.total_registros <> 3 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Remessa possui valores divergentes do padrão homologado (R$ 350,00 / 3 itens).';
  END IF;

  -- ============================================================================
  -- 3. PRE-CHECK 3: Lote de Diaristas
  -- ============================================================================
  SELECT id, status, status_conciliacao, valor_total, empresa_id, tenant_id
  INTO v_chk_lote
  FROM public.diaristas_lotes_fechamento
  WHERE id = v_lote_diaristas_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Lote de diaristas % não encontrado.', v_lote_diaristas_id;
  END IF;

  IF v_chk_lote.tenant_id <> v_tenant_id_esperado OR v_chk_lote.empresa_id <> v_empresa_id_esperada THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Tenant ou empresa do lote de diaristas divergem dos dados oficiais.';
  END IF;

  IF v_chk_lote.status <> 'PAGO' OR v_chk_lote.status_conciliacao <> 'conciliado' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Lote de diaristas % não está no estado PAGO/conciliado esperado.', v_lote_diaristas_id;
  END IF;

  IF round(v_chk_lote.valor_total, 2) <> 350.00 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Valor do lote de diaristas diverge de R$ 350,00.';
  END IF;

  -- ============================================================================
  -- 4. PRE-CHECK 4: Validação Efetiva e Estrita dos 3 Itens Conhecidos
  -- ============================================================================
  SELECT COUNT(*)
  INTO v_itens_validos_count
  FROM public.cnab_retorno_itens
  WHERE id IN (v_item1_id, v_item2_id, v_item3_id)
    AND retorno_arquivo_id = v_retorno_id
    AND remessa_arquivo_id = v_remessa_id
    AND diaristas_lote_id = v_lote_diaristas_id
    AND tenant_id = v_tenant_id_esperado
    AND status = 'pago'
    AND status_conciliacao = 'conciliado'
    AND valor_retornado IS NULL;

  IF v_itens_validos_count <> 3 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Esperava exatamente 3 itens elegíveis em cnab_retorno_itens, mas encontrou %.', v_itens_validos_count;
  END IF;

  -- Verificação individual de cada item comprovando remessa_item_id e valor_esperado
  PERFORM 1 FROM public.cnab_retorno_itens
  WHERE id = v_item1_id AND remessa_item_id = v_item1_remessa_item_id AND round(valor_esperado, 2) = v_item1_valor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Item 1 (%) não confere com remessa_item_id ou valor esperado (R$ 140,00).', v_item1_id;
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens
  WHERE id = v_item2_id AND remessa_item_id = v_item2_remessa_item_id AND round(valor_esperado, 2) = v_item2_valor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Item 2 (%) não confere com remessa_item_id ou valor esperado (R$ 70,00).', v_item2_id;
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens
  WHERE id = v_item3_id AND remessa_item_id = v_item3_remessa_item_id AND round(valor_esperado, 2) = v_item3_valor;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Item 3 (%) não confere com remessa_item_id ou valor esperado (R$ 140,00).', v_item3_id;
  END IF;

  -- ============================================================================
  -- 5. ATUALIZAÇÃO CIRÚRGICA DOS 3 ITENS
  -- ============================================================================
  UPDATE public.cnab_retorno_itens
  SET valor_retornado = valor_esperado
  WHERE id IN (v_item1_id, v_item2_id, v_item3_id)
    AND retorno_arquivo_id = v_retorno_id
    AND remessa_arquivo_id = v_remessa_id
    AND diaristas_lote_id = v_lote_diaristas_id
    AND tenant_id = v_tenant_id_esperado
    AND status = 'pago'
    AND status_conciliacao = 'conciliado'
    AND valor_retornado IS NULL;

  GET DIAGNOSTICS v_itens_atualizados = ROW_COUNT;

  IF v_itens_atualizados <> 3 THEN
    RAISE EXCEPTION 'SANEAMENTO ABORTADO: Esperava atualizar exatamente 3 itens, mas afetou % itens.', v_itens_atualizados;
  END IF;

  -- ============================================================================
  -- 6. PÓS-CONFERÊNCIA DE CONSISTÊNCIA
  -- ============================================================================
  SELECT COALESCE(SUM(valor_retornado), 0)
  INTO v_soma_retornada
  FROM public.cnab_retorno_itens
  WHERE retorno_arquivo_id = v_retorno_id
    AND id IN (v_item1_id, v_item2_id, v_item3_id);

  IF round(v_soma_retornada, 2) <> 350.00 THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Soma dos valores retornados (%) difere de R$ 350,00.', v_soma_retornada;
  END IF;

  -- ============================================================================
  -- 7. AUDITORIA BANCÁRIA DA CORREÇÃO
  -- ============================================================================
  -- Resolução segura de usuario_id: utiliza o usuário autenticado ou o autor legítimo do processamento
  v_usuario_auditoria := COALESCE(auth.uid(), v_chk_retorno.usuario_processamento);

  -- Ação compatível com a check constraint cnab_auditoria_bancaria_acao_check ('conciliacao_observacao')
  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    usuario_id,
    usuario_nome,
    acao,
    detalhes,
    ip_address
  ) VALUES (
    v_chk_retorno.tenant_id,
    v_remessa_id,
    NULL,
    v_usuario_auditoria,
    'SISTEMA (FIX-RET-07)',
    'conciliacao_observacao',
    jsonb_build_object(
      'tipo_ajuste', 'SANEAMENTO_HISTORICO_VALOR_RETORNADO_NSA11',
      'retorno_arquivo_id', v_retorno_id,
      'remessa_id', v_remessa_id,
      'diaristas_lote_id', v_lote_diaristas_id,
      'itens_atualizados', v_itens_atualizados,
      'soma_total_retornada', v_soma_retornada,
      'motivo', 'FIX-RET-07: Regularização de valor_retornado NULL para alinhamento com Dashboard Consolidado e DRE',
      'comprovacao_origem', 'Arquivo sintético retorno NSA 11 com Segmento A único de R$ 350,00 desdobrado nos itens de 140, 70 e 140'
    ),
    '127.0.0.1'
  );

  RAISE NOTICE 'Saneamento Histórico FIX-RET-07 concluído com sucesso: 3 itens atualizados para um total de R$ 350,00.';
END;
$$;
