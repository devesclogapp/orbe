-- ============================================================
-- FASE 8.3 - Hardening de homologacao
-- Objetivo:
--   1. Fechar bypass cross-tenant nas RPCs SECURITY DEFINER
--   2. Exigir observacao tambem no backend para divergencia/rejeicao
-- ============================================================

CREATE OR REPLACE FUNCTION public.conciliar_retorno_item(
  p_retorno_item_id UUID,
  p_status_conciliacao TEXT,
  p_valor_conciliado NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS SETOF public.financeiro_conciliacoes AS $$
DECLARE
  v_item public.cnab_retorno_itens%ROWTYPE;
  v_conciliacao public.financeiro_conciliacoes%ROWTYPE;
  v_user_id UUID;
  v_acao TEXT;
  v_observacao_limpa TEXT;
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para conciliar baixa financeira.';
  END IF;

  IF p_status_conciliacao NOT IN ('conciliado', 'divergente', 'rejeitado_banco') THEN
    RAISE EXCEPTION 'Status de conciliacao invalido: %', p_status_conciliacao;
  END IF;

  v_observacao_limpa := NULLIF(BTRIM(COALESCE(p_observacao, '')), '');

  IF p_status_conciliacao IN ('divergente', 'rejeitado_banco')
    AND v_observacao_limpa IS NULL THEN
    RAISE EXCEPTION 'Observacao obrigatoria para divergencia ou rejeicao bancaria.';
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = p_retorno_item_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de retorno nao encontrado para o tenant atual.';
  END IF;

  IF v_item.status_conciliacao = 'conciliado' THEN
    RAISE EXCEPTION 'Item ja conciliado. Use a reversao autorizada antes de nova conciliacao.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_conciliacoes fc
    WHERE fc.retorno_item_id = p_retorno_item_id
      AND fc.tenant_id = public.current_tenant_id()
      AND fc.status <> 'revertido'
  ) THEN
    RAISE EXCEPTION 'Ja existe conciliacao ativa para este item.';
  END IF;

  INSERT INTO public.financeiro_conciliacoes (
    tenant_id,
    retorno_item_id,
    remessa_arquivo_id,
    lote_id,
    fatura_id,
    colaborador_id,
    valor_original,
    valor_pago,
    valor_conciliado,
    status,
    status_anterior,
    usuario_conciliacao,
    data_conciliacao,
    observacao,
    reversivel
  )
  VALUES (
    v_item.tenant_id,
    v_item.id,
    v_item.remessa_arquivo_id,
    v_item.lote_id,
    v_item.fatura_id,
    v_item.colaborador_id,
    COALESCE(v_item.valor_esperado, 0),
    COALESCE(v_item.valor_retornado, 0),
    COALESCE(p_valor_conciliado, v_item.valor_retornado, 0),
    p_status_conciliacao,
    v_item.status_conciliacao,
    v_user_id,
    timezone('utc', now()),
    v_observacao_limpa,
    TRUE
  )
  RETURNING *
  INTO v_conciliacao;

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = p_status_conciliacao,
    observacao_conciliacao = v_observacao_limpa,
    conciliado_em = timezone('utc', now()),
    conciliado_por = v_user_id,
    revertido_em = NULL,
    revertido_por = NULL
  WHERE id = v_item.id
    AND tenant_id = public.current_tenant_id();

  IF v_item.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN 'pago'
        ELSE 'pendente'
      END,
      status_conciliacao = p_status_conciliacao,
      motivo_rejeicao = CASE
        WHEN p_status_conciliacao = 'rejeitado_banco' THEN v_observacao_limpa
        ELSE motivo_rejeicao
      END,
      data_pagamento = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN COALESCE(v_item.data_ocorrencia, CURRENT_DATE)
        ELSE NULL
      END,
      conciliado_em = timezone('utc', now()),
      conciliado_por = v_user_id,
      revertido_em = NULL,
      revertido_por = NULL
    WHERE id = v_item.fatura_id
      AND tenant_id = public.current_tenant_id();
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(v_item.fatura_id, v_item.lote_id);

  v_acao := CASE p_status_conciliacao
    WHEN 'conciliado' THEN 'conciliacao_aprovada'
    WHEN 'divergente' THEN 'conciliacao_divergente'
    ELSE 'conciliacao_rejeitada'
  END;

  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    acao,
    usuario_id,
    detalhes
  )
  VALUES (
    v_item.tenant_id,
    v_item.remessa_arquivo_id,
    v_item.lote_id,
    v_acao,
    v_user_id,
    jsonb_build_object(
      'retorno_item_id', v_item.id,
      'fatura_id', v_item.fatura_id,
      'status_banco', v_item.status,
      'status_conciliacao', p_status_conciliacao,
      'valor_original', COALESCE(v_item.valor_esperado, 0),
      'valor_pago', COALESCE(v_item.valor_retornado, 0),
      'valor_conciliado', COALESCE(p_valor_conciliado, v_item.valor_retornado, 0),
      'observacao', v_observacao_limpa
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = v_conciliacao.id
    AND tenant_id = public.current_tenant_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reverter_conciliacao_financeira(
  p_conciliacao_id UUID,
  p_motivo TEXT
)
RETURNS SETOF public.financeiro_conciliacoes AS $$
DECLARE
  v_conciliacao public.financeiro_conciliacoes%ROWTYPE;
  v_item public.cnab_retorno_itens%ROWTYPE;
  v_user_id UUID;
  v_motivo_limpo TEXT;
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para reverter conciliacao.';
  END IF;

  v_motivo_limpo := NULLIF(BTRIM(COALESCE(p_motivo, '')), '');

  IF v_motivo_limpo IS NULL THEN
    RAISE EXCEPTION 'Motivo da reversao e obrigatorio.';
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_conciliacao
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliacao nao encontrada para o tenant atual.';
  END IF;

  IF NOT COALESCE(v_conciliacao.reversivel, FALSE) THEN
    RAISE EXCEPTION 'Esta conciliacao nao e reversivel.';
  END IF;

  IF v_conciliacao.status = 'revertido' THEN
    RAISE EXCEPTION 'Esta conciliacao ja foi revertida.';
  END IF;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = v_conciliacao.retorno_item_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de retorno associado nao encontrado para o tenant atual.';
  END IF;

  UPDATE public.financeiro_conciliacoes
  SET
    status_anterior = v_conciliacao.status,
    status = 'revertido',
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id,
    motivo_reversao = v_motivo_limpo,
    observacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao, '')), '') IS NULL THEN v_motivo_limpo
      ELSE observacao || ' | Reversao: ' || v_motivo_limpo
    END
  WHERE id = p_conciliacao_id
    AND tenant_id = public.current_tenant_id();

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = 'revertido',
    observacao_conciliacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao_conciliacao, '')), '') IS NULL THEN v_motivo_limpo
      ELSE observacao_conciliacao || ' | Reversao: ' || v_motivo_limpo
    END,
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id
  WHERE id = v_conciliacao.retorno_item_id
    AND tenant_id = public.current_tenant_id();

  IF v_conciliacao.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = 'pendente',
      status_conciliacao = 'revertido',
      data_pagamento = NULL,
      revertido_em = timezone('utc', now()),
      revertido_por = v_user_id
    WHERE id = v_conciliacao.fatura_id
      AND tenant_id = public.current_tenant_id();
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(
    v_conciliacao.fatura_id,
    COALESCE(v_conciliacao.lote_id, v_item.lote_id)
  );

  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    acao,
    usuario_id,
    detalhes
  )
  VALUES (
    v_conciliacao.tenant_id,
    v_conciliacao.remessa_arquivo_id,
    COALESCE(v_conciliacao.lote_id, v_item.lote_id),
    'conciliacao_revertida',
    v_user_id,
    jsonb_build_object(
      'conciliacao_id', v_conciliacao.id,
      'retorno_item_id', v_conciliacao.retorno_item_id,
      'status_anterior', v_conciliacao.status,
      'motivo', v_motivo_limpo
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id
    AND tenant_id = public.current_tenant_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.conciliar_retorno_item(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverter_conciliacao_financeira(UUID, TEXT) TO authenticated;
