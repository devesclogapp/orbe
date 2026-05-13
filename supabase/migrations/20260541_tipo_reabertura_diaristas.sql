-- ============================================================
-- Migration: 20260541_tipo_reabertura_diaristas
-- Objetivo: Adicionar suporte a Tipo de Reabertura no módulo diaristas.
--
-- Tipos:
--   'operacional'   → comportamento atual (encarregado retoma ownership)
--   'administrativa' → RH/Admin assume, encarregado bloqueado
--
-- Retrocompatibilidade: NULL assumido como 'operacional'
-- ============================================================

-- 1. Adicionar coluna no lote
ALTER TABLE public.diaristas_lotes_fechamento
  ADD COLUMN IF NOT EXISTS tipo_reabertura TEXT
    DEFAULT NULL
    CHECK (tipo_reabertura IS NULL OR tipo_reabertura IN ('operacional', 'administrativa'));

-- 2. Atualizar RPC reabrir_periodo_diaristas para aceitar e salvar tipo_reabertura
CREATE OR REPLACE FUNCTION public.reabrir_periodo_diaristas(
  p_lote_id        UUID,
  p_usuario_id     UUID,
  p_usuario_nome   TEXT,
  p_usuario_role   TEXT,
  p_motivo         TEXT,
  p_tipo_reabertura TEXT DEFAULT 'operacional'   -- 'operacional' | 'administrativa'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id     UUID;
  v_periodo_inicio DATE;
  v_periodo_fim    DATE;
  v_tenant_id      UUID;
  v_tipo           TEXT;
BEGIN
  -- Valida o tipo
  v_tipo := COALESCE(p_tipo_reabertura, 'operacional');
  IF v_tipo NOT IN ('operacional', 'administrativa') THEN
    RAISE EXCEPTION 'tipo_reabertura inválido: %. Use operacional ou administrativa.', v_tipo;
  END IF;

  -- Busca dados do lote
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento
  WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado: %', p_lote_id;
  END IF;

  -- ── Reabertura OPERACIONAL ──────────────────────────────────────
  -- Comportamento original: lançamentos voltam a EM_ABERTO,
  -- vínculo com lote é desfeito, encarregado retoma ownership.
  IF v_tipo = 'operacional' THEN
    UPDATE public.lancamentos_diaristas
    SET
      status            = 'EM_ABERTO',
      lote_fechamento_id = NULL,
      updated_at        = now()
    WHERE lote_fechamento_id = p_lote_id;

    UPDATE public.diaristas_lotes_fechamento
    SET
      status           = 'EM_ABERTO',
      tipo_reabertura  = 'operacional',
      updated_at       = now()
    WHERE id = p_lote_id;

  -- ── Reabertura ADMINISTRATIVA ───────────────────────────────────
  -- Lançamentos voltam mas MANTÊM o lote_fechamento_id vinculado.
  -- Status especial: AGUARDANDO_VALIDACAO_RH.
  -- Encarregado não vê o botão "Fechar período" (lote ainda ativo).
  -- RH/Admin edita e revalida diretamente.
  ELSIF v_tipo = 'administrativa' THEN
    UPDATE public.lancamentos_diaristas
    SET
      status     = 'AGUARDANDO_VALIDACAO_RH',
      updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    UPDATE public.diaristas_lotes_fechamento
    SET
      status          = 'AGUARDANDO_VALIDACAO_RH',
      tipo_reabertura = 'administrativa',
      updated_at      = now()
    WHERE id = p_lote_id;
  END IF;

  -- Log de governança
  INSERT INTO public.diaristas_logs_fechamento
    (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role,
     acao, periodo_inicio, periodo_fim, motivo)
  VALUES
    (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role,
     'REABRIU', v_periodo_inicio, v_periodo_fim,
     '[' || UPPER(v_tipo) || '] ' || COALESCE(p_motivo, 'Não informado'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.reabrir_periodo_diaristas(UUID,UUID,TEXT,TEXT,TEXT,TEXT) TO authenticated;

COMMENT ON FUNCTION public.reabrir_periodo_diaristas(UUID,UUID,TEXT,TEXT,TEXT,TEXT) IS
  'Reabre um lote de diaristas. Tipo operacional: comportamento original.
   Tipo administrativa: mantém lote vinculado, bloqueia encarregado, RH/Admin assume.';

-- 3. Garantir que o status 'AGUARDANDO_VALIDACAO_RH' é reconhecido (sem constraint rígida)
-- O campo status usa TEXT sem CHECK constraint restritiva nas migrations anteriores — OK.

-- 4. Índice para filtrar rapidamente lotes em reabertura administrativa
CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_tipo_reabertura
  ON public.diaristas_lotes_fechamento (tipo_reabertura)
  WHERE tipo_reabertura = 'administrativa';

