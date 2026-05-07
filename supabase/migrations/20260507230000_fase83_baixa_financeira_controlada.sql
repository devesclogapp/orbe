-- ============================================================
-- FASE 8.3 - Baixa financeira controlada e auditavel
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_financeiro_conciliacao_role()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() IN ('Admin', 'Financeiro');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

ALTER TABLE public.cnab_auditoria_bancaria
  DROP CONSTRAINT IF EXISTS cnab_auditoria_bancaria_acao_check;

ALTER TABLE public.cnab_auditoria_bancaria
  ADD CONSTRAINT cnab_auditoria_bancaria_acao_check
  CHECK (
    acao IN (
      'geracao',
      'download',
      'envio_manual',
      'homologacao',
      'erro_homologacao',
      'validacao',
      'upload_retorno',
      'processamento_retorno',
      'erro_retorno',
      'divergencia_retorno',
      'conciliacao_aprovada',
      'conciliacao_rejeitada',
      'conciliacao_divergente',
      'conciliacao_revertida',
      'conciliacao_observacao'
    )
  );

ALTER TABLE public.cnab_retorno_itens
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS observacao_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS conciliado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revertido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revertido_por UUID REFERENCES auth.users(id);

UPDATE public.cnab_retorno_itens
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.cnab_retorno_itens
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.cnab_retorno_itens
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.cnab_retorno_itens
  DROP CONSTRAINT IF EXISTS cnab_retorno_itens_status_conciliacao_check;

ALTER TABLE public.cnab_retorno_itens
  ADD CONSTRAINT cnab_retorno_itens_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS conciliado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revertido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revertido_por UUID REFERENCES auth.users(id);

UPDATE public.faturas
SET status_conciliacao = COALESCE(
  status_conciliacao,
  CASE
    WHEN status = 'pago' THEN 'conciliado'
    ELSE 'aguardando_conciliacao'
  END
);

ALTER TABLE public.faturas
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.faturas
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.faturas
  DROP CONSTRAINT IF EXISTS faturas_status_conciliacao_check;

ALTER TABLE public.faturas
  ADD CONSTRAINT faturas_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.financeiro_consolidados_cliente
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT;

UPDATE public.financeiro_consolidados_cliente
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.financeiro_consolidados_cliente
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.financeiro_consolidados_cliente
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.financeiro_consolidados_cliente
  DROP CONSTRAINT IF EXISTS financeiro_consolidados_cliente_status_conciliacao_check;

ALTER TABLE public.financeiro_consolidados_cliente
  ADD CONSTRAINT financeiro_consolidados_cliente_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.financeiro_consolidados_colaborador
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT;

UPDATE public.financeiro_consolidados_colaborador
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.financeiro_consolidados_colaborador
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.financeiro_consolidados_colaborador
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.financeiro_consolidados_colaborador
  DROP CONSTRAINT IF EXISTS financeiro_consolidados_colaborador_status_conciliacao_check;

ALTER TABLE public.financeiro_consolidados_colaborador
  ADD CONSTRAINT financeiro_consolidados_colaborador_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.lotes_remessa
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT;

UPDATE public.lotes_remessa
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.lotes_remessa
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.lotes_remessa
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.lotes_remessa
  DROP CONSTRAINT IF EXISTS lotes_remessa_status_conciliacao_check;

ALTER TABLE public.lotes_remessa
  ADD CONSTRAINT lotes_remessa_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

CREATE TABLE IF NOT EXISTS public.financeiro_conciliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  retorno_item_id UUID NOT NULL REFERENCES public.cnab_retorno_itens(id) ON DELETE CASCADE,
  remessa_arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id) ON DELETE SET NULL,
  lote_id UUID REFERENCES public.lotes_remessa(id) ON DELETE SET NULL,
  fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  valor_original NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_conciliado NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_conciliacao',
  status_anterior TEXT,
  usuario_conciliacao UUID REFERENCES auth.users(id),
  data_conciliacao TIMESTAMPTZ,
  observacao TEXT,
  reversivel BOOLEAN NOT NULL DEFAULT TRUE,
  revertido_em TIMESTAMPTZ,
  revertido_por UUID REFERENCES auth.users(id),
  motivo_reversao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.financeiro_conciliacoes
  ADD COLUMN IF NOT EXISTS status_anterior TEXT,
  ADD COLUMN IF NOT EXISTS motivo_reversao TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

UPDATE public.financeiro_conciliacoes
SET tenant_id = itens.tenant_id
FROM public.cnab_retorno_itens itens
WHERE public.financeiro_conciliacoes.tenant_id IS NULL
  AND itens.id = public.financeiro_conciliacoes.retorno_item_id;

ALTER TABLE public.financeiro_conciliacoes
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.financeiro_conciliacoes
  DROP CONSTRAINT IF EXISTS financeiro_conciliacoes_status_check;

ALTER TABLE public.financeiro_conciliacoes
  ADD CONSTRAINT financeiro_conciliacoes_status_check
  CHECK (status IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.financeiro_conciliacoes
  DROP CONSTRAINT IF EXISTS financeiro_conciliacoes_status_anterior_check;

ALTER TABLE public.financeiro_conciliacoes
  ADD CONSTRAINT financeiro_conciliacoes_status_anterior_check
  CHECK (
    status_anterior IS NULL OR
    status_anterior IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido')
  );

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_status_conciliacao
  ON public.cnab_retorno_itens (tenant_id, status_conciliacao, retorno_arquivo_id);

CREATE INDEX IF NOT EXISTS idx_faturas_status_conciliacao
  ON public.faturas (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_financeiro_consolidados_cliente_status_conciliacao
  ON public.financeiro_consolidados_cliente (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_financeiro_consolidados_colab_status_conciliacao
  ON public.financeiro_consolidados_colaborador (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_lotes_remessa_status_conciliacao
  ON public.lotes_remessa (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_financeiro_conciliacoes_tenant_status
  ON public.financeiro_conciliacoes (tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financeiro_conciliacoes_retorno_item_ativo
  ON public.financeiro_conciliacoes (retorno_item_id)
  WHERE status <> 'revertido';

ALTER TABLE public.financeiro_conciliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_conciliacoes_select" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "tenant_isolation_conciliacoes_insert" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "tenant_isolation_conciliacoes_update" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "financeiro_conciliacoes_select" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "financeiro_conciliacoes_insert" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "financeiro_conciliacoes_update" ON public.financeiro_conciliacoes;

CREATE POLICY "financeiro_conciliacoes_select"
  ON public.financeiro_conciliacoes
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "financeiro_conciliacoes_insert"
  ON public.financeiro_conciliacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_financeiro_conciliacao_role()
  );

CREATE POLICY "financeiro_conciliacoes_update"
  ON public.financeiro_conciliacoes
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_financeiro_conciliacao_role()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_financeiro_conciliacao_role()
  );

CREATE OR REPLACE FUNCTION public.set_financeiro_conciliacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financeiro_conciliacoes_updated_at ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_financeiro_conciliacoes_updated_at
  BEFORE INSERT OR UPDATE ON public.financeiro_conciliacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_financeiro_conciliacoes_updated_at();

CREATE OR REPLACE FUNCTION public.calcular_status_conciliacao_agrupado(
  p_total INTEGER,
  p_conciliado INTEGER,
  p_divergente INTEGER,
  p_rejeitado INTEGER,
  p_revertido INTEGER
)
RETURNS TEXT AS $$
BEGIN
  IF COALESCE(p_total, 0) = 0 THEN
    RETURN 'aguardando_conciliacao';
  END IF;

  IF COALESCE(p_conciliado, 0) = p_total THEN
    RETURN 'conciliado';
  END IF;

  IF COALESCE(p_divergente, 0) > 0 THEN
    RETURN 'divergente';
  END IF;

  IF COALESCE(p_rejeitado, 0) = p_total THEN
    RETURN 'rejeitado_banco';
  END IF;

  IF COALESCE(p_revertido, 0) = p_total THEN
    RETURN 'revertido';
  END IF;

  RETURN 'aguardando_conciliacao';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.validate_admin_override()
RETURNS TRIGGER AS $$
DECLARE
  v_justificativa TEXT;
  v_user_role TEXT;
BEGIN
  v_user_role := public.get_user_role();

  IF (
    TG_TABLE_NAME = 'faturas'
    AND OLD.status = 'pago'
    AND NEW.status = 'pendente'
    AND COALESCE(NEW.status_conciliacao, '') = 'revertido'
    AND public.is_financeiro_conciliacao_role()
  ) THEN
    RETURN NEW;
  END IF;

  IF (OLD.status IN ('pago', 'processado', 'fechado', 'consolidado')) THEN
    IF v_user_role IS NULL OR v_user_role != 'Admin' THEN
      RAISE EXCEPTION 'Registro bloqueado por status de imutabilidade (%). Alteração não permitida para seu perfil.', OLD.status;
    END IF;

    BEGIN
      v_justificativa := current_setting('app.override_justification', true);
    EXCEPTION WHEN OTHERS THEN
      v_justificativa := NULL;
    END;

    IF (v_justificativa IS NULL OR v_justificativa = '' OR v_justificativa = 'null') THEN
      RAISE EXCEPTION 'Justificativa obrigatória para alterar registro travado (status: %). Utilize o mecanismo de override.', OLD.status;
    END IF;

    INSERT INTO audit.overrides (
      table_name, record_id, empresa_id, justificativa, dados_anteriores, dados_novos, user_id
    )
    VALUES (
      TG_TABLE_NAME, OLD.id, OLD.empresa_id, v_justificativa, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_financeiro_conciliacao_context(
  p_fatura_id UUID,
  p_lote_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_total INTEGER;
  v_conciliado INTEGER;
  v_divergente INTEGER;
  v_rejeitado INTEGER;
  v_revertido INTEGER;
  v_status TEXT;
  v_lote_id UUID;
BEGIN
  IF p_fatura_id IS NOT NULL THEN
    SELECT *
    INTO v_fatura
    FROM public.faturas
    WHERE id = p_fatura_id;

    IF FOUND THEN
      IF v_fatura.colaborador_id IS NOT NULL THEN
        SELECT
          COUNT(*),
          COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'revertido')
        INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido
        FROM public.faturas
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND colaborador_id = v_fatura.colaborador_id;

        v_status := public.calcular_status_conciliacao_agrupado(v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido);

        UPDATE public.financeiro_consolidados_colaborador
        SET status_conciliacao = v_status
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND colaborador_id = v_fatura.colaborador_id;
      END IF;

      IF v_fatura.cliente_id IS NOT NULL THEN
        SELECT
          COUNT(*),
          COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'revertido')
        INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido
        FROM public.faturas
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND cliente_id = v_fatura.cliente_id;

        v_status := public.calcular_status_conciliacao_agrupado(v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido);

        UPDATE public.financeiro_consolidados_cliente
        SET status_conciliacao = v_status
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND cliente_id = v_fatura.cliente_id;
      END IF;

      v_lote_id := COALESCE(p_lote_id, v_fatura.lote_remessa_id);
    ELSE
      v_lote_id := p_lote_id;
    END IF;
  ELSE
    v_lote_id := p_lote_id;
  END IF;

  IF v_lote_id IS NOT NULL THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
      COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
      COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
      COUNT(*) FILTER (WHERE status_conciliacao = 'revertido')
    INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido
    FROM public.faturas
    WHERE lote_remessa_id = v_lote_id;

    v_status := public.calcular_status_conciliacao_agrupado(v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido);

    UPDATE public.lotes_remessa
    SET status_conciliacao = v_status
    WHERE id = v_lote_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.guard_cnab_retorno_item_conciliacao()
RETURNS TRIGGER AS $$
DECLARE
  v_is_allowed BOOLEAN;
BEGIN
  v_is_allowed := public.is_financeiro_conciliacao_role();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'O status bancario do retorno nao pode ser alterado manualmente.';
  END IF;

  IF (
    NEW.status_conciliacao IS DISTINCT FROM OLD.status_conciliacao OR
    COALESCE(NEW.observacao_conciliacao, '') IS DISTINCT FROM COALESCE(OLD.observacao_conciliacao, '') OR
    NEW.conciliado_em IS DISTINCT FROM OLD.conciliado_em OR
    NEW.conciliado_por IS DISTINCT FROM OLD.conciliado_por OR
    NEW.revertido_em IS DISTINCT FROM OLD.revertido_em OR
    NEW.revertido_por IS DISTINCT FROM OLD.revertido_por
  ) AND NOT v_is_allowed THEN
    RAISE EXCEPTION 'Usuario sem permissao para alterar a conciliacao.';
  END IF;

  IF OLD.status_conciliacao = 'conciliado' AND NEW.status_conciliacao NOT IN ('conciliado', 'revertido') THEN
    RAISE EXCEPTION 'Item conciliado nao pode ser alterado sem reversao autorizada.';
  END IF;

  IF OLD.status_conciliacao = 'conciliado' AND (
    NEW.valor_esperado IS DISTINCT FROM OLD.valor_esperado OR
    NEW.valor_retornado IS DISTINCT FROM OLD.valor_retornado
  ) THEN
    RAISE EXCEPTION 'Valores de item conciliado nao podem ser alterados silenciosamente.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_cnab_retorno_item_conciliacao ON public.cnab_retorno_itens;
CREATE TRIGGER trg_guard_cnab_retorno_item_conciliacao
  BEFORE UPDATE ON public.cnab_retorno_itens
  FOR EACH ROW EXECUTE FUNCTION public.guard_cnab_retorno_item_conciliacao();

CREATE OR REPLACE FUNCTION public.guard_financeiro_conciliacoes_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'revertido' THEN
    RAISE EXCEPTION 'Conciliacoes revertidas sao imutaveis.';
  END IF;

  IF (
    NEW.retorno_item_id IS DISTINCT FROM OLD.retorno_item_id OR
    NEW.remessa_arquivo_id IS DISTINCT FROM OLD.remessa_arquivo_id OR
    NEW.lote_id IS DISTINCT FROM OLD.lote_id OR
    NEW.fatura_id IS DISTINCT FROM OLD.fatura_id OR
    NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id OR
    NEW.valor_original IS DISTINCT FROM OLD.valor_original OR
    NEW.valor_pago IS DISTINCT FROM OLD.valor_pago OR
    NEW.valor_conciliado IS DISTINCT FROM OLD.valor_conciliado OR
    COALESCE(NEW.observacao, '') IS DISTINCT FROM COALESCE(OLD.observacao, '')
  ) AND NEW.status <> 'revertido' THEN
    RAISE EXCEPTION 'A conciliacao e append-only e nao aceita alteracao silenciosa de valores.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'revertido' THEN
    RAISE EXCEPTION 'A conciliacao so pode mudar de status via reversao autorizada.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_financeiro_conciliacoes_update ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_guard_financeiro_conciliacoes_update
  BEFORE UPDATE ON public.financeiro_conciliacoes
  FOR EACH ROW EXECUTE FUNCTION public.guard_financeiro_conciliacoes_update();

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
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para conciliar baixa financeira.';
  END IF;

  IF p_status_conciliacao NOT IN ('conciliado', 'divergente', 'rejeitado_banco') THEN
    RAISE EXCEPTION 'Status de conciliacao invalido: %', p_status_conciliacao;
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = p_retorno_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de retorno nao encontrado.';
  END IF;

  IF v_item.status_conciliacao = 'conciliado' THEN
    RAISE EXCEPTION 'Item ja conciliado. Use a reversao autorizada antes de nova conciliacao.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_conciliacoes fc
    WHERE fc.retorno_item_id = p_retorno_item_id
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
    NULLIF(BTRIM(COALESCE(p_observacao, '')), ''),
    TRUE
  )
  RETURNING *
  INTO v_conciliacao;

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = p_status_conciliacao,
    observacao_conciliacao = NULLIF(BTRIM(COALESCE(p_observacao, '')), ''),
    conciliado_em = timezone('utc', now()),
    conciliado_por = v_user_id,
    revertido_em = NULL,
    revertido_por = NULL
  WHERE id = v_item.id;

  IF v_item.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN 'pago'
        ELSE 'pendente'
      END,
      status_conciliacao = p_status_conciliacao,
      motivo_rejeicao = CASE
        WHEN p_status_conciliacao = 'rejeitado_banco' THEN NULLIF(BTRIM(COALESCE(p_observacao, '')), '')
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
    WHERE id = v_item.fatura_id;
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
      'observacao', NULLIF(BTRIM(COALESCE(p_observacao, '')), '')
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = v_conciliacao.id;
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
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para reverter conciliacao.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo da reversao e obrigatorio.';
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_conciliacao
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliacao nao encontrada.';
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
  FOR UPDATE;

  UPDATE public.financeiro_conciliacoes
  SET
    status_anterior = v_conciliacao.status,
    status = 'revertido',
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id,
    motivo_reversao = NULLIF(BTRIM(COALESCE(p_motivo, '')), ''),
    observacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao, '')), '') IS NULL THEN NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
      ELSE observacao || ' | Reversao: ' || NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
    END
  WHERE id = p_conciliacao_id;

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = 'revertido',
    observacao_conciliacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao_conciliacao, '')), '') IS NULL THEN NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
      ELSE observacao_conciliacao || ' | Reversao: ' || NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
    END,
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id
  WHERE id = v_conciliacao.retorno_item_id;

  IF v_conciliacao.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = 'pendente',
      status_conciliacao = 'revertido',
      data_pagamento = NULL,
      revertido_em = timezone('utc', now()),
      revertido_por = v_user_id
    WHERE id = v_conciliacao.fatura_id;
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(v_conciliacao.fatura_id, COALESCE(v_conciliacao.lote_id, v_item.lote_id));

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
      'motivo', NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.conciliar_retorno_item(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverter_conciliacao_financeira(UUID, TEXT) TO authenticated;
