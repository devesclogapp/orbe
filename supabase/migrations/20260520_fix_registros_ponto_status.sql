-- Migration: Corrigir constraint de status para registros_ponto
ALTER TABLE public.registros_ponto DROP CONSTRAINT IF EXISTS registros_ponto_status_check;

ALTER TABLE public.registros_ponto ADD CONSTRAINT registros_ponto_status_check 
  CHECK (status IN (
    'Presente', 'Ausente', 'Falta', 'Atestado', 'Folga', 'Férias', 
    'Banco de Horas', 'Home Office', 'Pendente', 'Processado', 'Inconsistente', 
    'ok', 'inconsistente', 'ajustado', 'incompleto'
  ));

COMMENT ON CONSTRAINT registros_ponto_status_check ON public.registros_ponto IS 'Status válidos para registro de ponto';