-- ============================================================
-- Diaristas: promover PAGO/CONCILIADO somente a partir do
-- retorno bancario conciliado
-- ============================================================

ALTER TABLE public.cnab_remessas_arquivos
  ADD COLUMN IF NOT EXISTS diaristas_lote_id UUID REFERENCES public.diaristas_lotes_fechamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_diaristas_lote
  ON public.cnab_remessas_arquivos (diaristas_lote_id);

ALTER TABLE public.cnab_retorno_itens
  ADD COLUMN IF NOT EXISTS diaristas_lote_id UUID REFERENCES public.diaristas_lotes_fechamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_diaristas_lote
  ON public.cnab_retorno_itens (diaristas_lote_id, status_conciliacao);

ALTER TABLE public.financeiro_conciliacoes
  ADD COLUMN IF NOT EXISTS diaristas_lote_id UUID REFERENCES public.diaristas_lotes_fechamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_financeiro_conciliacoes_diaristas_lote
  ON public.financeiro_conciliacoes (diaristas_lote_id, status, created_at DESC);

ALTER TABLE public.diaristas_lotes_fechamento
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS conciliado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revertido_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revertido_por UUID REFERENCES auth.users(id);

UPDATE public.diaristas_lotes_fechamento
SET status_conciliacao = COALESCE(
  status_conciliacao,
  CASE
    WHEN status IN ('PAGO', 'pago') THEN 'conciliado'
    ELSE 'aguardando_conciliacao'
  END
);

ALTER TABLE public.diaristas_lotes_fechamento
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.diaristas_lotes_fechamento
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.diaristas_lotes_fechamento
  DROP CONSTRAINT IF EXISTS diaristas_lotes_fechamento_status_conciliacao_check;

ALTER TABLE public.diaristas_lotes_fechamento
  ADD CONSTRAINT diaristas_lotes_fechamento_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_status_conciliacao
  ON public.diaristas_lotes_fechamento (tenant_id, status_conciliacao, status);

CREATE OR REPLACE FUNCTION public.sync_diaristas_lote_conciliacao_context(
  p_diaristas_lote_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_lote public.diaristas_lotes_fechamento%ROWTYPE;
  v_total INTEGER := 0;
  v_conciliado INTEGER := 0;
  v_divergente INTEGER := 0;
  v_rejeitado INTEGER := 0;
  v_revertido INTEGER := 0;
  v_status TEXT := 'aguardando_conciliacao';
  v_pago_em TIMESTAMPTZ;
  v_user_id UUID;
  v_user_nome TEXT;
  v_novo_status_lote TEXT;
  v_acao_log TEXT;
  v_motivo_log TEXT;
BEGIN
  IF p_diaristas_lote_id IS NULL THEN
    RETURN;
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT full_name
  INTO v_user_nome
  FROM public.profiles
  WHERE user_id = v_user_id;

  SELECT *
  INTO v_lote
  FROM public.diaristas_lotes_fechamento
  WHERE id = p_diaristas_lote_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
    COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
    COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
    COUNT(*) FILTER (WHERE status_conciliacao = 'revertido'),
    MAX(data_ocorrencia)::timestamptz
  INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido, v_pago_em
  FROM public.cnab_retorno_itens
  WHERE tenant_id = v_lote.tenant_id
    AND diaristas_lote_id = p_diaristas_lote_id;

  v_status := public.calcular_status_conciliacao_agrupado(
    v_total,
    v_conciliado,
    v_divergente,
    v_rejeitado,
    v_revertido
  );

  v_novo_status_lote := CASE
    WHEN v_status = 'conciliado' THEN 'PAGO'
    WHEN v_lote.status IN ('PAGO', 'pago') THEN 'cnab_gerado'
    ELSE v_lote.status
  END;

  UPDATE public.diaristas_lotes_fechamento
  SET
    status = v_novo_status_lote,
    status_conciliacao = v_status,
    paid_at = CASE
      WHEN v_status = 'conciliado' THEN COALESCE(v_pago_em, timezone('utc', now()))
      WHEN v_lote.status IN ('PAGO', 'pago') THEN NULL
      ELSE paid_at
    END,
    paid_by = CASE
      WHEN v_status = 'conciliado' THEN v_user_id
      WHEN v_lote.status IN ('PAGO', 'pago') THEN NULL
      ELSE paid_by
    END,
    paid_by_nome = CASE
      WHEN v_status = 'conciliado' THEN COALESCE(v_user_nome, paid_by_nome)
      WHEN v_lote.status IN ('PAGO', 'pago') THEN NULL
      ELSE paid_by_nome
    END,
    conciliado_at = CASE
      WHEN v_status = 'conciliado' THEN timezone('utc', now())
      WHEN v_status = 'revertido' THEN NULL
      ELSE conciliado_at
    END,
    conciliado_por = CASE
      WHEN v_status = 'conciliado' THEN v_user_id
      WHEN v_status = 'revertido' THEN NULL
      ELSE conciliado_por
    END,
    revertido_at = CASE
      WHEN v_status = 'revertido' THEN timezone('utc', now())
      ELSE NULL
    END,
    revertido_por = CASE
      WHEN v_status = 'revertido' THEN v_user_id
      ELSE NULL
    END,
    updated_at = timezone('utc', now())
  WHERE id = p_diaristas_lote_id;

  IF v_status = 'conciliado' THEN
    UPDATE public.lancamentos_diaristas
    SET
      status = 'PAGO',
      updated_at = timezone('utc', now())
    WHERE lote_fechamento_id = p_diaristas_lote_id
      AND status NOT IN ('PAGO', 'CANCELADO', 'ausente');
  ELSIF v_lote.status IN ('PAGO', 'pago') THEN
    UPDATE public.lancamentos_diaristas
    SET
      status = 'AGUARDANDO_PAGAMENTO',
      updated_at = timezone('utc', now())
    WHERE lote_fechamento_id = p_diaristas_lote_id
      AND status = 'PAGO';
  END IF;

  IF v_lote.status IS DISTINCT FROM v_novo_status_lote
    OR v_lote.status_conciliacao IS DISTINCT FROM v_status THEN
    v_acao_log := CASE
      WHEN v_status = 'conciliado' THEN 'CONCILIACAO_BANCARIA_TOTAL'
      WHEN v_status = 'revertido' THEN 'REVERSAO_CONCILIACAO_BANCARIA'
      ELSE 'CONCILIACAO_BANCARIA_PENDENTE'
    END;

    v_motivo_log := format(
      'Status conciliação: %s | Itens: %s | Conciliados: %s | Divergentes: %s | Rejeitados: %s | Revertidos: %s | Status lote: %s',
      v_status,
      v_total,
      v_conciliado,
      v_divergente,
      v_rejeitado,
      v_revertido,
      v_novo_status_lote
    );

    INSERT INTO public.diaristas_logs_fechamento (
      empresa_id,
      tenant_id,
      usuario_id,
      usuario_nome,
      usuario_role,
      acao,
      periodo_inicio,
      periodo_fim,
      motivo
    )
    VALUES (
      v_lote.empresa_id,
      v_lote.tenant_id,
      v_user_id,
      COALESCE(v_user_nome, 'Sistema'),
      'financeiro',
      v_acao_log,
      v_lote.periodo_inicio,
      v_lote.periodo_fim,
      v_motivo_log
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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
    diaristas_lote_id,
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
    v_item.diaristas_lote_id,
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
  PERFORM public.sync_diaristas_lote_conciliacao_context(v_item.diaristas_lote_id);

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
      'diaristas_lote_id', v_item.diaristas_lote_id,
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
  PERFORM public.sync_diaristas_lote_conciliacao_context(
    COALESCE(v_conciliacao.diaristas_lote_id, v_item.diaristas_lote_id)
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
      'diaristas_lote_id', COALESCE(v_conciliacao.diaristas_lote_id, v_item.diaristas_lote_id),
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

GRANT EXECUTE ON FUNCTION public.sync_diaristas_lote_conciliacao_context(UUID) TO authenticated;
