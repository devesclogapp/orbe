-- Migration: Adicionar suporte ao Pipeline (Master Flow) para Custos Extras
ALTER TABLE public.custos_extras_operacionais 
ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'PENDENTE' 
  CHECK (pipeline_status IN ('PENDENTE', 'EM_VALIDACAO', 'APROVADO_OPERACAO', 'CONSOLIDADO_FINANCEIRO', 'CONCLUIDO')),
ADD COLUMN IF NOT EXISTS justificativa_devolucao TEXT,
ADD COLUMN IF NOT EXISTS centro_custo_nome TEXT;

COMMENT ON COLUMN public.custos_extras_operacionais.pipeline_status IS 'Status do fluxo de aprovacao (Master Flow).';
COMMENT ON COLUMN public.custos_extras_operacionais.justificativa_devolucao IS 'Justificativa preenchida em caso de devolucao operacional/financeira.';
COMMENT ON COLUMN public.custos_extras_operacionais.centro_custo_nome IS 'Nome do centro de custo relacionado (placeholder para futura tabela oficial).';
