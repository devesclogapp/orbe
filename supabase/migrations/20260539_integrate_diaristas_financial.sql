-- Migration: Integrate Diaristas Closing with Real Financial
-- Adds AGUARDANDO_PAGAMENTO status, missing columns and updates aprovar_financeiro_diaristas RPC

-- 1. Add missing columns for payment tracking
ALTER TABLE public.diaristas_lotes_fechamento ADD COLUMN IF NOT EXISTS paid_by UUID REFERENCES auth.users(id);
ALTER TABLE public.diaristas_lotes_fechamento ADD COLUMN IF NOT EXISTS paid_by_nome TEXT;
ALTER TABLE public.diaristas_lotes_fechamento ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 2. Update status constraints
ALTER TABLE public.lancamentos_diaristas DROP CONSTRAINT IF EXISTS lancamentos_diaristas_status_check;
ALTER TABLE public.lancamentos_diaristas ADD CONSTRAINT lancamentos_diaristas_status_check CHECK (
  status IN ('EM_ABERTO', 'AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'CANCELADO', 'ausente')
);

ALTER TABLE public.diaristas_lotes_fechamento DROP CONSTRAINT IF EXISTS diaristas_lotes_fechamento_status_check;
ALTER TABLE public.diaristas_lotes_fechamento ADD CONSTRAINT diaristas_lotes_fechamento_status_check CHECK (
  status IN ('EM_ABERTO', 'AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'FECHADO_FINANCEIRO', 'AGUARDANDO_PAGAMENTO', 'PAGO', 'CANCELADO')
);

-- 3. Ensure unique constraint on financeiro_consolidados_colaborador for ON CONFLICT support
CREATE UNIQUE INDEX IF NOT EXISTS idx_financeiro_consolidados_colab_unique 
ON public.financeiro_consolidados_colaborador (colaborador_id, competencia);

-- 4. Update aprovar_financeiro_diaristas RPC
CREATE OR REPLACE FUNCTION public.aprovar_financeiro_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT
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

  -- 2. Atualizar status para AGUARDANDO_PAGAMENTO
  UPDATE public.lancamentos_diaristas
  SET 
    status = 'AGUARDANDO_PAGAMENTO', 
    updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  UPDATE public.diaristas_lotes_fechamento
  SET 
    status = 'AGUARDANDO_PAGAMENTO', 
    updated_at = now()
  WHERE id = p_lote_id;

  -- 3. Criar faturas e consolidados para cada diarista
  FOR v_row IN (
    SELECT 
      diarista_id, 
      nome_colaborador,
      SUM(valor_calculado) as total_valor
    FROM public.lancamentos_diaristas
    WHERE lote_fechamento_id = p_lote_id
    GROUP BY diarista_id, nome_colaborador
  ) LOOP
    
    -- Inserir Título em Faturas (Conta a Pagar)
    INSERT INTO public.faturas (
      tenant_id,
      empresa_id,
      colaborador_id,
      competencia,
      valor,
      vencimento,
      status,
      created_at
    ) VALUES (
      v_tenant_id,
      v_empresa_id,
      v_row.diarista_id,
      v_competencia,
      v_row.total_valor,
      v_periodo_fim,
      'pendente',
      now()
    );

    -- Atualizar Consolidado do Colaborador
    INSERT INTO public.financeiro_consolidados_colaborador (
      tenant_id,
      empresa_id,
      colaborador_id,
      competencia,
      valor_total,
      status,
      created_at
    ) VALUES (
      v_tenant_id,
      v_empresa_id,
      v_row.diarista_id,
      v_competencia,
      v_row.total_valor,
      'pendente',
      now()
    )
    ON CONFLICT (colaborador_id, competencia) DO UPDATE 
    SET 
      valor_total = public.financeiro_consolidados_colaborador.valor_total + EXCLUDED.valor_total;
      
  END LOOP;

  -- 4. Registrar log de governança
  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'APROVOU_FINANCEIRO', v_periodo_inicio, v_periodo_fim);

END;
$$;
