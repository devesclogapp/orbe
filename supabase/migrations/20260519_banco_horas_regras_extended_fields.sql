-- Migration: Adicionar campos estendidos para banco_horas_regras
-- Objetivo: Suportar regras detalhadas de banco de horas para processamento RH

ALTER TABLE public.banco_horas_regras
  ADD COLUMN IF NOT EXISTS carga_horaria_diaria NUMERIC(4,2) DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS tolerancia_atraso INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS tolerancia_hora_extra INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_diario_banco INTEGER DEFAULT 480,
  ADD COLUMN IF NOT EXISTS validade_horas INTEGER DEFAULT 60,
  ADD COLUMN IF NOT EXISTS regra_compensacao TEXT DEFAULT 'automatico',
  ADD COLUMN IF NOT EXISTS regra_vencimento TEXT DEFAULT 'acumula',
  ADD COLUMN IF NOT EXISTS bh_ativo BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS jornada_contratada NUMERIC(4,2) DEFAULT 8.00,
  ADD COLUMN IF NOT EXISTS origem_ponto TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.banco_horas_regras.carga_horaria_diaria IS 'Carga horária diária contratada em horas';
COMMENT ON COLUMN public.banco_horas_regras.tolerancia_atraso IS 'Tolerância de atraso em minutos';
COMMENT ON COLUMN public.banco_horas_regras.tolerancia_hora_extra IS 'Tolerância de hora extra em minutos';
COMMENT ON COLUMN public.banco_horas_regras.limite_diario_banco IS 'Limite diário de banco de horas em minutos';
COMMENT ON COLUMN public.banco_horas_regras.validade_horas IS 'Validade das horas em dias';
COMMENT ON COLUMN public.banco_horas_regras.regra_compensacao IS 'Regra de compensação: automatico, manual, transferencia';
COMMENT ON COLUMN public.banco_horas_regras.regra_vencimento IS 'Regra de vencimento: acumula, zera, expira';
COMMENT ON COLUMN public.banco_horas_regras.bh_ativo IS 'Se o banco de horas está ativo';
COMMENT ON COLUMN public.banco_horas_regras.jornada_contratada IS 'Jornada contratada em horas';
COMMENT ON COLUMN public.banco_horas_regras.origem_ponto IS 'Origem do ponto: manual, biometrico, app, importacao';

-- Adicionar coluna bh_ativo na tabela colaboradores se não existir
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS bh_ativo BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.colaboradores.bh_ativo IS 'Se o colaborador tem banco de horas ativo';

-- Adicionar coluna jornada_contratada na tabela colaboradores se não existir
ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS jornada_contratada NUMERIC(4,2) DEFAULT 8.00;

COMMENT ON COLUMN public.colaboradores.jornada_contratada IS 'Jornada contratada do colaborador em horas';

-- Adicionar coluna origem na tabela registros_ponto
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual';

COMMENT ON COLUMN public.registros_ponto.origem IS 'Origem do registro de ponto: manual, biometrico, app, importacao';

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_bh_regras_bh_ativo ON public.banco_horas_regras(bh_ativo);
CREATE INDEX IF NOT EXISTS idx_colaboradores_bh_ativo ON public.colaboradores(bh_ativo);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_origem ON public.registros_ponto(origem);

-- Atualizar registros existentes com valores padrão
UPDATE public.banco_horas_regras SET carga_horaria_diaria = 8.00 WHERE carga_horaria_diaria IS NULL;
UPDATE public.banco_horas_regras SET tolerancia_atraso = 5 WHERE tolerancia_atraso IS NULL;
UPDATE public.banco_horas_regras SET limite_diario_banco = 480 WHERE limite_diario_banco IS NULL;
UPDATE public.banco_horas_regras SET validade_horas = 60 WHERE validade_horas IS NULL;
UPDATE public.banco_horas_regras SET regra_compensacao = 'automatico' WHERE regra_compensacao IS NULL;
UPDATE public.banco_horas_regras SET regra_vencimento = 'acumula' WHERE regra_vencimento IS NULL;
UPDATE public.banco_horas_regras SET bh_ativo = true WHERE bh_ativo IS NULL;
UPDATE public.banco_horas_regras SET jornada_contratada = 8.00 WHERE jornada_contratada IS NULL;
UPDATE public.colaboradores SET bh_ativo = true WHERE bh_ativo IS NULL;
UPDATE public.colaboradores SET jornada_contratada = 8.00 WHERE jornada_contratada IS NULL;
UPDATE public.registros_ponto SET origem = 'manual' WHERE origem IS NULL;

DO $$
BEGIN
  RAISE NOTICE 'Migration banco_horas_regras_extended_fields completed successfully';
END $$;