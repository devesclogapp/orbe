-- Correções e Funções de Governança
-- Cria/Atualiza as funções de fechamento para governança de Diaristas

CREATE OR REPLACE FUNCTION public.fechar_periodo_diaristas(
  p_empresa_id UUID,
  p_periodo_inicio DATE,
  p_periodo_fim DATE,
  p_lote_id UUID,
  p_tenant_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.lancamentos_diaristas
  SET 
    status = 'AGUARDANDO_VALIDACAO_RH',
    lote_fechamento_id = p_lote_id,
    updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND data_lancamento >= p_periodo_inicio
    AND data_lancamento <= p_periodo_fim
    AND status = 'EM_ABERTO';

  UPDATE public.diaristas_lotes_fechamento
  SET status = 'AGUARDANDO_VALIDACAO_RH', updated_at = now()
  WHERE id = p_lote_id;
END;
$$;


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


CREATE OR REPLACE FUNCTION public.reabrir_periodo_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT,
  p_motivo TEXT
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

  UPDATE public.lancamentos_diaristas
  SET status = 'EM_ABERTO', lote_fechamento_id = NULL, updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  UPDATE public.diaristas_lotes_fechamento
  SET status = 'CANCELADO', updated_at = now()
  WHERE id = p_lote_id;

  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim, motivo)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'REABRIU', v_periodo_inicio, v_periodo_fim, p_motivo);
END;
$$;


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
