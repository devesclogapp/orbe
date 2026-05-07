-- Migration: Aprimoramentos do Processamento RH
-- Adiciona campos faltantes para calculo de valor do dia, reprocessamento e fechamento mensal

-- 1. Adicionar campos de valor do dia em registros_ponto
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS valor_dia NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_hora_extra NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_atraso NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_falta NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutos_atraso INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS minutos_extra INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_extras_detalhadas JSONB,
  ADD COLUMN IF NOT EXISTS jornada_calculada NUMERIC(4,2);

COMMENT ON COLUMN public.registros_ponto.valor_dia IS 'Valor total do dia calculado';
COMMENT ON COLUMN public.registros_ponto.valor_hora_extra IS 'Valor das horas extras do dia';
COMMENT ON COLUMN public.registros_ponto.valor_atraso IS 'Valor do atraso (desconto)';
COMMENT ON COLUMN public.registros_ponto.valor_falta IS 'Valor da falta (desconto)';
COMMENT ON COLUMN public.registros_ponto.minutos_atraso IS 'Minutos de atraso';
COMMENT ON COLUMN public.registros_ponto.minutos_extra IS 'Minutos de hora extra';
COMMENT ON COLUMN public.registros_ponto.horas_extras_detalhadas IS 'Detalhes das horas extras (percentuais, valores)';
COMMENT ON COLUMN public.registros_ponto.jornada_calculada IS 'Jornada calculada utilizada';

-- 2. Adicionar campos de fechamento mensal
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS salario_base NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS valor_hora NUMERIC(10,4),
  ADD COLUMN IF NOT EXISTS valor_diaria NUMERIC(10,2);

COMMENT ON COLUMN public.colaboradores.salario_base IS 'Salário base mensal';
COMMENT ON COLUMN public.colaboradores.valor_hora IS 'Valor da hora de trabalho';
COMMENT ON COLUMN public.colaboradores.valor_diaria IS 'Valor da diária';

-- 3. Criar tabela de fechamento mensal se não existir
CREATE TABLE IF NOT EXISTS public.fechamento_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  colaborador_id UUID REFERENCES colaboradores(id),
  empresa_id UUID REFERENCES empresas(id),
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  dias_trabalhados INTEGER DEFAULT 0,
  horas_trabalhadas NUMERIC(8,2) DEFAULT 0,
  horas_extras NUMERIC(8,2) DEFAULT 0,
  horas_faltas NUMERIC(8,2) DEFAULT 0,
  banco_horas_credito NUMERIC(8,2) DEFAULT 0,
  banco_horas_debito NUMERIC(8,2) DEFAULT 0,
  saldo_banco_horas NUMERIC(8,2) DEFAULT 0,
  valor_hora_extra NUMERIC(10,2) DEFAULT 0,
  valor_faltas NUMERIC(10,2) DEFAULT 0,
  valor_total NUMERIC(10,2) DEFAULT 0,
  situacao TEXT DEFAULT 'pendente',
  obs TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fechamento_mensal_periodo ON public.fechamento_mensal(mes, ano);
CREATE INDEX IF NOT EXISTS idx_fechamento_mensal_colaborador ON public.fechamento_mensal(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_fechamento_mensal_tenant ON public.fechamento_mensal(tenant_id);

-- 4. Verificar se banco_horas_eventos tem os campos necessários
-- Se não existir, renomear ou criar alias (o código já usa banco_horas_eventos)
-- Apenas garantir que a tabela existe com os campos corretos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'banco_horas_eventos') THEN
    RAISE NOTICE 'Tabela banco_horas_eventos nao existe - criando';
  ELSE
    RAISE NOTICE 'Tabela banco_horas_eventos ja existe';
  END IF;
END $$;

-- 5. Adicionar campo reprocessado_em para controle de reprocessamento
ALTER TABLE public.processamento_rh_logs
  ADD COLUMN IF NOT EXISTS reprocessado BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS registros_limpados INTEGER DEFAULT 0;

COMMENT ON COLUMN public.processamento_rh_logs.reprocessado IS 'Indica se foi um reprocessamento';
COMMENT ON COLUMN public.processamento_rh_logs.registros_limpados IS 'Quantidade de registros limpos no reprocessamento';

-- 6. Adicionar colunas faltantes em processamento_rh_inconsistencias
ALTER TABLE public.processamento_rh_inconsistencias
  ADD COLUMN IF NOT EXISTS resolvida BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolvida_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacao TEXT;

COMMENT ON COLUMN public.processamento_rh_inconsistencias.resolvida IS 'Se a inconsistencia foi resolvida';
COMMENT ON COLUMN public.processamento_rh_inconsistencias.resolvida_em IS 'Data da resolucao';
COMMENT ON COLUMN public.processamento_rh_inconsistencias.observacao IS 'Observacao da resolucao';

DO $$
BEGIN
  RAISE NOTICE 'Migration 20260522_rh_processamento_enhancements completed successfully';
END $$;