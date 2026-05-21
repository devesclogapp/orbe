-- Migration: Standardize Operational Status
-- Objective: Create a unified lifecycle for imports and point records.

-- 1. Create or Update Enum (using text with check constraint for flexibility if preferred, but enum is safer for ERP)
-- However, given the existing 'status' column in historico_importacoes is TEXT, I will update the check constraint.

-- Update historico_importacoes
ALTER TABLE public.historico_importacoes DROP CONSTRAINT IF EXISTS historico_importacoes_status_check;

ALTER TABLE public.historico_importacoes ADD CONSTRAINT historico_importacoes_status_check 
  CHECK (status IN (
    'RECEBIDO', 
    'VALIDANDO', 
    'INCONSISTENTE', 
    'PENDENTE_PROCESSAMENTO', 
    'PROCESSADO', 
    'FECHADO', 
    'ERRO', 
    'CANCELADO'
  ));

-- Initialize missing data in historico_importacoes
UPDATE public.historico_importacoes SET status = 'PROCESSADO' WHERE status = 'sucesso';
UPDATE public.historico_importacoes SET status = 'ERRO' WHERE status = 'erro';
UPDATE public.historico_importacoes SET status = 'VALIDANDO' WHERE status = 'processando';
UPDATE public.historico_importacoes SET status = 'RECEBIDO' WHERE status = 'recebido';

-- 2. Update registros_ponto status_processamento
ALTER TABLE public.registros_ponto DROP CONSTRAINT IF EXISTS registros_ponto_status_processamento_check;

ALTER TABLE public.registros_ponto ADD CONSTRAINT registros_ponto_status_processamento_check 
  CHECK (status_processamento IN (
    'RECEBIDO', 
    'VALIDANDO', 
    'INCONSISTENTE', 
    'PENDENTE_PROCESSAMENTO', 
    'PROCESSADO', 
    'FECHADO', 
    'ERRO', 
    'CANCELADO'
  ));

-- Backfill registros_ponto status_processamento
UPDATE public.registros_ponto SET status_processamento = 'PROCESSADO' WHERE status_processamento = 'processado';
UPDATE public.registros_ponto SET status_processamento = 'INCONSISTENTE' WHERE status_processamento = 'inconsistente';
UPDATE public.registros_ponto SET status_processamento = 'PENDENTE_PROCESSAMENTO' WHERE status_processamento = 'pendente';

-- Add comment for documentation
COMMENT ON COLUMN public.historico_importacoes.status IS 'Life cycle status of the import batch';
COMMENT ON COLUMN public.registros_ponto.status_processamento IS 'Life cycle status of the point record in the RH pipeline';
