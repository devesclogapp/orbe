-- RPC para Validação de RH com Encerramento Automático (Bypass Financeiro)
-- Garante atomicidade: Lote + Lançamentos + Log em uma única transação.

CREATE OR REPLACE FUNCTION public.validar_e_encerrar_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT,
  p_target_status TEXT -- 'FECHADO_FINANCEIRO' ou 'PAGO'
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
  v_acao TEXT;
BEGIN
  -- Validar status destino
  IF p_target_status NOT IN ('FECHADO_FINANCEIRO', 'PAGO') THEN
    RAISE EXCEPTION 'Status de encerramento inválido: %. Use FECHADO_FINANCEIRO ou PAGO.', p_target_status;
  END IF;

  -- Buscar metadados do lote
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote % não encontrado.', p_lote_id;
  END IF;

  -- 1. Atualizar todos os lançamentos vinculados ao lote
  UPDATE public.lancamentos_diaristas
  SET 
    status = p_target_status, 
    updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  -- 2. Atualizar o lote
  UPDATE public.diaristas_lotes_fechamento
  SET 
    status = p_target_status, 
    updated_at = now()
  WHERE id = p_lote_id;

  -- 3. Definir a ação para o log
  v_acao := CASE WHEN p_target_status = 'PAGO' THEN 'ENCERROU_AUTO' ELSE 'APROVOU_PARA_FINANCEIRO' END;

  -- 4. Inserir log de auditoria
  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim, motivo)
  VALUES 
  (
    v_empresa_id, 
    v_tenant_id, 
    p_usuario_id, 
    p_usuario_nome, 
    p_usuario_role, 
    v_acao, 
    v_periodo_inicio, 
    v_periodo_fim, 
    'Validação RH com encerramento automático (Configuração)'
  );
END;
$$;
