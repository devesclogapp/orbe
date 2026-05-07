-- Migration: Criar tabela de logs de processamento RH
CREATE TABLE IF NOT EXISTS public.processamento_rh_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  usuario_id UUID REFERENCES auth.users(id),
  periodo_mes INTEGER NOT NULL,
  periodo_ano INTEGER NOT NULL,
  total_registros INTEGER DEFAULT 0,
  total_processados INTEGER DEFAULT 0,
  total_inconsistencias INTEGER DEFAULT 0,
  total_horas_positivas INTEGER DEFAULT 0,
  total_horas_negativas INTEGER DEFAULT 0,
  executado_em TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Adicionar colunas extras em registros_ponto se ainda não existirem
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS status_processamento TEXT DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS processado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS horas_calculadas TEXT,
  ADD COLUMN IF NOT EXISTS saldo_dia INTEGER,
  ADD COLUMN IF NOT EXISTS inconsistencias_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inconsistencias TEXT;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_registros_ponto_status_processamento ON public.registros_ponto(status_processamento);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_data ON public.registros_ponto(data);
CREATE INDEX IF NOT EXISTS idx_processamento_rh_logs_periodo ON public.processamento_rh_logs(periodo_mes, periodo_ano);

COMMENT ON TABLE public.processamento_rh_logs IS 'Log de execuções do processamento RH';
COMMENT ON COLUMN public.registros_ponto.status_processamento IS 'Status do processamento: pendente, processado, inconsistente';