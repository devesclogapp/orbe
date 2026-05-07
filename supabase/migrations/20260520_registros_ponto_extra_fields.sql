-- Migration: Adicionar campos extras para registros_ponto (dados brutos da planilha)
ALTER TABLE public.registros_ponto 
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES empresas(id),
  ADD COLUMN IF NOT EXISTS nome_colaborador TEXT,
  ADD COLUMN IF NOT EXISTS matricula_colaborador TEXT,
  ADD COLUMN IF NOT EXISTS cpf_colaborador TEXT,
  ADD COLUMN IF NOT EXISTS cargo_colaborador TEXT,
  ADD COLUMN IF NOT EXISTS horas_trabalhadas TEXT,
  ADD COLUMN IF NOT EXISTS hora_extra TEXT,
  ADD COLUMN IF NOT EXISTS falta TEXT,
  ADD COLUMN IF NOT EXISTS atraso TEXT,
  ADD COLUMN IF NOT EXISTS observacoes TEXT,
  ADD COLUMN IF NOT EXISTS valor_dia NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'importacao';

COMMENT ON COLUMN public.registros_ponto.nome_colaborador IS 'Nome do colaborador importado da planilha';
COMMENT ON COLUMN public.registros_ponto.matricula_colaborador IS 'Matrícula do colaborador importada da planilha';
COMMENT ON COLUMN public.registros_ponto.cpf_colaborador IS 'CPF do colaborador importado da planilha';
COMMENT ON COLUMN public.registros_ponto.cargo_colaborador IS 'Cargo do colaborador importado da planilha';
COMMENT ON COLUMN public.registros_ponto.horas_trabalhadas IS 'Horas trabalhadas conforme planilha';
COMMENT ON COLUMN public.registros_ponto.hora_extra IS 'Hora extra conforme planilha';
COMMENT ON COLUMN public.registros_ponto.falta IS 'Falta conforme planilha';
COMMENT ON COLUMN public.registros_ponto.atraso IS 'Atraso conforme planilha';
COMMENT ON COLUMN public.registros_ponto.observacoes IS 'Observações da planilha';
COMMENT ON COLUMN public.registros_ponto.valor_dia IS 'Valor do dia calculado';
COMMENT ON COLUMN public.registros_ponto.origem IS 'Origem do registro: importacao, manual, biometrico';