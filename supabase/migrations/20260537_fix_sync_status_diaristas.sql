-- Migration: 20260537_fix_sync_status_diaristas
-- Objetivo: Garantir que as funções RPC sincronizem o status dos lançamentos individuais

-- 1. Atualizar função de fechamento
CREATE OR REPLACE FUNCTION public.fechar_periodo_diaristas(
  p_empresa_id UUID,
  p_periodo_inicio DATE,
  p_periodo_fim DATE,
  p_lote_id UUID,
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Atualiza os lançamentos para o status de 'AGUARDANDO_VALIDACAO_RH'
  UPDATE public.lancamentos_diaristas
  SET 
    status = 'AGUARDANDO_VALIDACAO_RH',
    lote_fechamento_id = p_lote_id,
    updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND data_lancamento >= p_periodo_inicio
    AND data_lancamento <= p_periodo_fim
    AND (status = 'EM_ABERTO' OR status = 'em_aberto');

  -- Atualiza o status do lote
  UPDATE public.diaristas_lotes_fechamento
  SET status = 'AGUARDANDO_VALIDACAO_RH', updated_at = now()
  WHERE id = p_lote_id;

  -- Insere o log de governança
  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES 
  (p_empresa_id, p_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'FECHOU', p_periodo_inicio, p_periodo_fim);
END;
$$;

-- 2. Atualizar função de validação
CREATE OR REPLACE FUNCTION public.validar_periodo_diaristas(
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
BEGIN
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  -- SINCRONIZAÇÃO EM CASCATA: Lançamentos -> VALIDADO_RH
  UPDATE public.lancamentos_diaristas
  SET status = 'VALIDADO_RH', updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  UPDATE public.diaristas_lotes_fechamento
  SET status = 'VALIDADO_RH', updated_at = now()
  WHERE id = p_lote_id;

  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'VALIDOU', v_periodo_inicio, v_periodo_fim);
END;
$$;

-- 3. Atualizar função de aprovação financeira
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
BEGIN
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  -- SINCRONIZAÇÃO EM CASCATA: Lançamentos -> FECHADO_FINANCEIRO
  UPDATE public.lancamentos_diaristas
  SET status = 'FECHADO_FINANCEIRO', updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  UPDATE public.diaristas_lotes_fechamento
  SET status = 'FECHADO_FINANCEIRO', updated_at = now()
  WHERE id = p_lote_id;

  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'APROVOU', v_periodo_inicio, v_periodo_fim);
END;
$$;
