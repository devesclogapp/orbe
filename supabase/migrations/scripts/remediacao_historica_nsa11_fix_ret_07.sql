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
-- ==============================================================================

DO $$
DECLARE
  v_retorno_id UUID := '853f93c9-0027-4607-b5de-16a557211243';
  v_remessa_id UUID := '46391aad-6417-48cf-ac78-03a2a9dd8b22';
  v_lote_diaristas_id UUID := '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  v_hash_esperado TEXT := '63d7676370e65fa1212132912b79b96ccffaab2384273b868fc5df4303171627';
  
  v_chk_retorno RECORD;
  v_chk_remessa RECORD;
  v_chk_lote RECORD;
  v_itens_atualizados INT := 0;
  v_soma_retornada NUMERIC := 0;
BEGIN
  -- 1. PRE-CHECK 1: Cabeçalho do Retorno Processado
  SELECT id, nome_arquivo, hash_arquivo, status, total_sucesso, remessa_arquivo_id, tenant_id
  INTO v_chk_retorno
  FROM public.cnab_retorno_arquivos
  WHERE id = v_retorno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Arquivo de retorno % não encontrado.', v_retorno_id;
  END IF;

  IF v_chk_retorno.hash_arquivo <> v_hash_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Hash do arquivo (%) diverge do hash oficial registrado (%).', v_chk_retorno.hash_arquivo, v_hash_esperado;
  END IF;

  IF v_chk_retorno.remessa_arquivo_id <> v_remessa_id THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Vínculo de remessa incorreto no cabeçalho do retorno.';
  END IF;

  -- 2. PRE-CHECK 2: Remessa NSA 11
  SELECT id, modo, total_valor, total_registros, diaristas_lote_id
  INTO v_chk_remessa
  FROM public.cnab_remessas_arquivos
  WHERE id = v_remessa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Remessa NSA 11 (%) não encontrada.', v_remessa_id;
  END IF;

  IF round(v_chk_remessa.total_valor, 2) <> 350.00 OR v_chk_remessa.total_registros <> 3 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Remessa possui valores divergentes do padrão homologado (R$ 350,00 / 3 itens).';
  END IF;

  -- 3. PRE-CHECK 3: Lote de Diaristas
  SELECT id, status, status_conciliacao, valor_total
  INTO v_chk_lote
  FROM public.diaristas_lotes_fechamento
  WHERE id = v_lote_diaristas_id;

  IF NOT FOUND OR v_chk_lote.status <> 'PAGO' OR v_chk_lote.status_conciliacao <> 'conciliado' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Lote de diaristas % não está no estado PAGO/conciliado esperado.', v_lote_diaristas_id;
  END IF;

  -- 4. PRE-CHECK 4: Verificação dos 3 itens específicos com valor_retornado IS NULL
  PERFORM 1
  FROM public.cnab_retorno_itens
  WHERE id IN (
    '1e94a70f-0591-44fb-9541-fb0bc4c6c644',
    '685d7146-f315-4f6a-9609-de6dabbe554e',
    '88f71013-09a6-48a8-9446-179930134950'
  )
  AND retorno_arquivo_id = v_retorno_id
  AND remessa_arquivo_id = v_remessa_id
  AND status = 'pago'
  AND status_conciliacao = 'conciliado'
  AND valor_retornado IS NULL;

  -- 5. ATUALIZAÇÃO CIRÚRGICA DOS 3 ITENS
  UPDATE public.cnab_retorno_itens
  SET valor_retornado = valor_esperado
  WHERE id IN (
    '1e94a70f-0591-44fb-9541-fb0bc4c6c644',
    '685d7146-f315-4f6a-9609-de6dabbe554e',
    '88f71013-09a6-48a8-9446-179930134950'
  )
  AND retorno_arquivo_id = v_retorno_id
  AND remessa_arquivo_id = v_remessa_id
  AND status = 'pago'
  AND valor_retornado IS NULL;

  GET DIAGNOSTICS v_itens_atualizados = ROW_COUNT;

  IF v_itens_atualizados <> 3 THEN
    RAISE EXCEPTION 'SANEAMENTO ABORTADO: Esperava atualizar exatamente 3 itens, mas afetou % itens.', v_itens_atualizados;
  END IF;

  -- 6. PÓS-CONFERÊNCIA DE CONSISTÊNCIA
  SELECT COALESCE(SUM(valor_retornado), 0)
  INTO v_soma_retornada
  FROM public.cnab_retorno_itens
  WHERE retorno_arquivo_id = v_retorno_id;

  IF round(v_soma_retornada, 2) <> 350.00 THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Soma dos valores retornados (%) difere de R$ 350,00.', v_soma_retornada;
  END IF;

  -- 7. AUDITORIA DA CORREÇÃO
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
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::UUID),
    'SISTEMA (FIX-RET-07)',
    'SANEAMENTO_HISTORICO_VALOR_RETORNADO_NSA11',
    jsonb_build_object(
      'retorno_arquivo_id', v_retorno_id,
      'remessa_id', v_remessa_id,
      'diaristas_lote_id', v_lote_diaristas_id,
      'itens_atualizados', v_itens_atualizados,
      'soma_total_retornada', v_soma_retornada,
      'motivo', 'FIX-RET-07: Regularização de valor_retornado NULL para alinhamento com Dashboard Consolidado e DRE'
    ),
    '127.0.0.1'
  );

  RAISE NOTICE 'Saneamento Histórico FIX-RET-07 concluído com sucesso: 3 itens atualizados para um total de R$ 350,00.';
END;
$$;
