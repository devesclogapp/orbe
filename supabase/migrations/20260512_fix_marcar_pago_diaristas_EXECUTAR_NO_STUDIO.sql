-- ============================================================
-- EXECUTAR NO SUPABASE STUDIO > SQL EDITOR
-- Corrige: paid_at / paid_by na tabela diaristas_lotes_fechamento
-- ============================================================

-- 1. Adicionar colunas de pagamento (IF NOT EXISTS = seguro re-executar)
ALTER TABLE public.diaristas_lotes_fechamento
  ADD COLUMN IF NOT EXISTS paid_by      UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS paid_by_nome TEXT,
  ADD COLUMN IF NOT EXISTS paid_at      TIMESTAMPTZ;

-- 2. Ampliar check constraint de status (aceitar PAGO, cnab_gerado, AGUARDANDO_PAGAMENTO)
ALTER TABLE public.diaristas_lotes_fechamento
  DROP CONSTRAINT IF EXISTS diaristas_lotes_fechamento_status_check;

ALTER TABLE public.diaristas_lotes_fechamento
  ADD CONSTRAINT diaristas_lotes_fechamento_status_check CHECK (
    status IN (
      'em_aberto',
      'EM_ABERTO',
      'AGUARDANDO_VALIDACAO_RH',
      'VALIDADO_RH',
      'FECHADO_FINANCEIRO',
      'AGUARDANDO_PAGAMENTO',
      'PAGO',
      'pago',
      'cnab_gerado',
      'CANCELADO'
    )
  );

-- 3. Ampliar check constraint de lancamentos_diaristas (mesmo conjunto)
ALTER TABLE public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS lancamentos_diaristas_status_check;

ALTER TABLE public.lancamentos_diaristas
  ADD CONSTRAINT lancamentos_diaristas_status_check CHECK (
    status IN (
      'em_aberto',
      'EM_ABERTO',  
      'AGUARDANDO_VALIDACAO_RH',
      'VALIDADO_RH',
      'FECHADO_FINANCEIRO',
      'AGUARDANDO_PAGAMENTO',
      'PAGO',
      'pago',
      'cnab_gerado',
      'CANCELADO',
      'ausente'
    )
  );

-- 4. RPC marcar_como_pago_diaristas (SECURITY DEFINER para bypass de RLS)
CREATE OR REPLACE FUNCTION public.marcar_como_pago_diaristas(
  p_lote_id    UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id    UUID;
  v_periodo_inicio DATE;
  v_periodo_fim    DATE;
  v_tenant_id      UUID;
BEGIN
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id
    INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
    FROM public.diaristas_lotes_fechamento
   WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % não encontrado', p_lote_id;
  END IF;

  -- Atualiza o lote
  UPDATE public.diaristas_lotes_fechamento
     SET status        = 'PAGO',
         paid_by       = p_usuario_id,
         paid_by_nome  = p_usuario_nome,
         paid_at       = now(),
         updated_at    = now()
   WHERE id = p_lote_id;

  -- Sincroniza os lançamentos
  UPDATE public.lancamentos_diaristas
     SET status      = 'PAGO',
         updated_at  = now()
   WHERE lote_fechamento_id = p_lote_id;

  -- Fallback: lançamentos sem lote_fechamento_id (lotes antigos)
  UPDATE public.lancamentos_diaristas
     SET status      = 'PAGO',
         updated_at  = now()
   WHERE empresa_id      = v_empresa_id
     AND data_lancamento >= v_periodo_inicio
     AND data_lancamento <= v_periodo_fim
     AND status NOT IN ('PAGO', 'pago', 'CANCELADO');

  -- Log de auditoria
  INSERT INTO public.diaristas_logs_fechamento
    (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES
    (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, 'financeiro', 'MARCOU_PAGO', v_periodo_inicio, v_periodo_fim);
END;
$$;

-- 5. Verificação final
SELECT
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   = 'diaristas_lotes_fechamento'
  AND column_name  IN ('paid_by', 'paid_by_nome', 'paid_at', 'status')
ORDER BY column_name;
