-- ==============================================================================
-- MIGRATION: Corrigir schema de lancamentos_diaristas
-- Problemas:
--   1. FK diarista_id → public.diaristas, mas o frontend envia IDs de public.colaboradores
--   2. CHECK codigo_marcacao IN ('P','MP') — bloqueia 'F','AUSENTE' e regras dinâmicas
--   3. CHECK quantidade_diaria IN (1, 0.5) — bloqueia valores de multiplicadores dinâmicos
--   4. Colunas unidade_id, local_id, tipo_registro não existem na tabela
--   5. DEFAULT status 'em_aberto' conflita com CHECK uppercase 'EM_ABERTO'
-- ==============================================================================

-- 1. DROPAR FK para public.diaristas (os IDs na prática são de public.colaboradores)
ALTER TABLE public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS fk_lancamentos_diaristas_diarista_id;
ALTER TABLE public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS lancamentos_diaristas_diarista_id_fkey;

-- 2. DROPAR CHECK obsoleto de codigo_marcacao (era limitado a P, MP)
ALTER TABLE public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS lancamentos_diaristas_codigo_marcacao_check;

-- 3. DROPAR CHECK obsoleto de quantidade_diaria (era limitado a 1, 0.5)
ALTER TABLE public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS lancamentos_diaristas_quantidade_diaria_check;

-- 4. Adicionar colunas faltantes na tabela
ALTER TABLE public.lancamentos_diaristas
  ADD COLUMN IF NOT EXISTS unidade_id UUID,
  ADD COLUMN IF NOT EXISTS local_id UUID,
  ADD COLUMN IF NOT EXISTS tipo_registro TEXT DEFAULT 'lancamento',
  ADD COLUMN IF NOT EXISTS referencia_lancamento_id UUID,
  ADD COLUMN IF NOT EXISTS motivo_ajuste TEXT,
  ADD COLUMN IF NOT EXISTS adjusted_by UUID,
  ADD COLUMN IF NOT EXISTS adjusted_by_nome TEXT,
  ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ;

-- 5. Corrigir DEFAULT do status para ficar alinhado com o CHECK da migration 20260539
-- O CHECK exige 'EM_ABERTO' (uppercase), mas o default era 'em_aberto' (lowercase).
-- Vamos manter o default como 'EM_ABERTO' para novos inserts.
ALTER TABLE public.lancamentos_diaristas
  ALTER COLUMN status SET DEFAULT 'EM_ABERTO';

-- 6. Normalizar registros existentes com status lowercase p/ uppercase
UPDATE public.lancamentos_diaristas
SET status = 'EM_ABERTO'
WHERE status = 'em_aberto';

UPDATE public.lancamentos_diaristas
SET status = 'CANCELADO'
WHERE status = 'cancelado';

-- 7. Refazer o CHECK de status para incluir 'em_aberto' como fallback
-- (o frontend e o banco podem ter registros legados com lowercase)
ALTER TABLE public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS lancamentos_diaristas_status_check;

ALTER TABLE public.lancamentos_diaristas
  ADD CONSTRAINT lancamentos_diaristas_status_check CHECK (
    status IN (
      'em_aberto', 'EM_ABERTO',
      'AGUARDANDO_VALIDACAO_RH',
      'VALIDADO_RH',
      'FECHADO_FINANCEIRO',
      'AGUARDANDO_PAGAMENTO',
      'PAGO',
      'cancelado', 'CANCELADO',
      'ausente',
      'cnab_gerado',
      'retorno_conciliado',
      'fechado_para_pagamento',
      'fechado'
    )
  );

-- 8. Garantir que diarista_id aceita qualquer UUID (sem FK restritiva)
-- Não adicionamos nova FK pois o ID pode vir de `colaboradores` ou `diaristas`
-- dependendo do fluxo. A integridade é garantida pelo frontend/service.

COMMENT ON COLUMN public.lancamentos_diaristas.diarista_id IS 'ID do colaborador (tabela colaboradores) que realizou o trabalho diário';
COMMENT ON COLUMN public.lancamentos_diaristas.unidade_id IS 'Referência à unidade operacional (opcional)';
COMMENT ON COLUMN public.lancamentos_diaristas.local_id IS 'Referência ao local operacional (opcional)';
COMMENT ON COLUMN public.lancamentos_diaristas.tipo_registro IS 'Tipo de registro: lancamento (padrão) ou ajuste';

-- ==============================================================================
-- 9. CORRIGIR RPC fechar_periodo_diaristas
-- A RPC original só fazia WHERE status = 'EM_ABERTO' (uppercase)
-- mas o DEFAULT da coluna é 'em_aberto' (lowercase).
-- Resultado: a RPC NUNCA atualizava os lançamentos!
-- ==============================================================================

-- Remove todas as versões da função
DROP FUNCTION IF EXISTS public.fechar_periodo_diaristas(UUID, DATE, DATE, UUID, UUID);
DROP FUNCTION IF EXISTS public.fechar_periodo_diaristas(UUID, DATE, DATE, UUID, UUID, UUID, TEXT, TEXT);

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
  -- Atualiza os lançamentos para o status de 'aguardando validação'
  -- CORRIGIDO: aceita tanto 'em_aberto' (lowercase) quanto 'EM_ABERTO' (uppercase)
  UPDATE public.lancamentos_diaristas
  SET 
    status = 'AGUARDANDO_VALIDACAO_RH',
    lote_fechamento_id = p_lote_id,
    updated_at = now()
  WHERE empresa_id = p_empresa_id
    AND data_lancamento >= p_periodo_inicio
    AND data_lancamento <= p_periodo_fim
    AND status IN ('em_aberto', 'EM_ABERTO');

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

-- ==============================================================================
-- 10. RECONCILIAÇÃO: Corrigir lançamentos órfãos
-- Lançamentos que ficaram em 'em_aberto' mas cujo lote já avançou.
-- Isso ocorreu porque a RPC antiga não os atualizava.
-- ==============================================================================
UPDATE public.lancamentos_diaristas l
SET 
  status = lf.status,
  lote_fechamento_id = lf.id,
  updated_at = now()
FROM public.diaristas_lotes_fechamento lf
WHERE l.empresa_id = lf.empresa_id
  AND l.data_lancamento >= lf.periodo_inicio
  AND l.data_lancamento <= lf.periodo_fim
  AND l.status IN ('em_aberto', 'EM_ABERTO')
  AND lf.status != 'EM_ABERTO';
