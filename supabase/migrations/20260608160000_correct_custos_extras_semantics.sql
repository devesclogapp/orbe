-- Migration: Corrigir Semântica Financeira - Custos Extras
-- Objetivo: Separar Pipeline Operacional de Status Financeiro.

-- 1. Atualizar constraint de pipeline_status
ALTER TABLE public.custos_extras_operacionais 
DROP CONSTRAINT IF EXISTS custos_extras_operacionais_pipeline_status_check;

-- Migrar dados do pipeline para a nova semântica ANTES de travar a constraint
UPDATE public.custos_extras_operacionais
SET pipeline_status = CASE 
    WHEN pipeline_status = 'PENDENTE' THEN 'RECEBIDO'
    WHEN pipeline_status = 'EM_VALIDACAO' THEN 'EM_VALIDACAO'
    WHEN pipeline_status = 'APROVADO_OPERACAO' THEN 'APROVADO_OPERACAO'
    WHEN pipeline_status = 'CONSOLIDADO_FINANCEIRO' THEN 'ENVIADO_FINANCEIRO'
    WHEN pipeline_status = 'CONCLUIDO' THEN 'FINALIZADO'
    ELSE 'RECEBIDO'
END;

ALTER TABLE public.custos_extras_operacionais 
ADD CONSTRAINT custos_extras_operacionais_pipeline_status_check 
CHECK (pipeline_status IN ('RECEBIDO', 'EM_VALIDACAO', 'APROVADO_OPERACAO', 'REPROVADO', 'ENVIADO_FINANCEIRO', 'FINALIZADO'));

-- 2. Atualizar constraint de status_pagamento
ALTER TABLE public.custos_extras_operacionais 
DROP CONSTRAINT IF EXISTS custos_extras_operacionais_status_pagamento_check;

-- Migrar dados financeiros para a nova semântica
UPDATE public.custos_extras_operacionais
SET status_pagamento = CASE 
    WHEN status_pagamento = 'PENDENTE' THEN 'A_PAGAR'
    WHEN status_pagamento = 'RECEBIDO' THEN 'PAGO'
    WHEN status_pagamento = 'PAGO' THEN 'PAGO'
    WHEN status_pagamento = 'ATRASADO' THEN 'ATRASADO'
    ELSE 'A_PAGAR'
END;

ALTER TABLE public.custos_extras_operacionais 
ADD CONSTRAINT custos_extras_operacionais_status_pagamento_check 
CHECK (status_pagamento IN ('A_PAGAR', 'PAGO', 'ATRASADO', 'CANCELADO'));

-- 3. Garantir defaults corretos (Note: default is only for new rows)
ALTER TABLE public.custos_extras_operacionais ALTER COLUMN pipeline_status SET DEFAULT 'RECEBIDO';
ALTER TABLE public.custos_extras_operacionais ALTER COLUMN status_pagamento SET DEFAULT 'A_PAGAR';

COMMENT ON COLUMN public.custos_extras_operacionais.status_pagamento IS 'Status financeiro: A_PAGAR, PAGO, ATRASADO, CANCELADO';
COMMENT ON COLUMN public.custos_extras_operacionais.pipeline_status IS 'Status do pipeline: RECEBIDO, EM_VALIDACAO, APROVADO_OPERACAO, REPROVADO, ENVIADO_FINANCEIRO, FINALIZADO';
