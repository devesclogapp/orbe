-- Migration: 20260701140500_update_status_receitas.sql
-- Objetivo: Atualizar o campo status da tabela receitas_operacionais
-- Criar status independentes para as diferentes modalidades.

-- Atualizar registros existentes (mapping)
UPDATE public.receitas_operacionais
SET status = CASE
    WHEN status = 'pendente' AND modalidade = 'CAIXA_IMEDIATO' THEN 'pendente_recebimento'
    WHEN status = 'pendente' AND modalidade = 'DUPLICATA' THEN 'pendente_cobranca'
    WHEN status = 'pendente' AND modalidade = 'FATURAMENTO_MENSAL' THEN 'aguardando_fechamento'
    WHEN status = 'aguardando_faturamento' AND modalidade = 'DUPLICATA' THEN 'pendente_cobranca'
    WHEN status = 'aguardando_faturamento' AND modalidade = 'FATURAMENTO_MENSAL' THEN 'aguardando_fechamento'
    WHEN status = 'faturado' THEN 'cobranca_enviada'
    WHEN status = 'pago' THEN 'recebido'
    ELSE status
END;

-- Remover a check constraint de status
DO $$ 
DECLARE
  con_name varchar;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.receitas_operacionais'::regclass
  AND contype = 'c'
  AND unnest(conkey) = (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.receitas_operacionais'::regclass AND attname = 'status');
  
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.receitas_operacionais DROP CONSTRAINT ' || con_name;
  END IF;
END $$;

-- Atualizar valor padrao
ALTER TABLE public.receitas_operacionais ALTER COLUMN status SET DEFAULT 'pendente_recebimento';

-- Adicionar nova check constraint
ALTER TABLE public.receitas_operacionais 
ADD CONSTRAINT receitas_operacionais_status_check 
CHECK (status IN ('pendente_recebimento', 'pendente_cobranca', 'aguardando_fechamento', 'cobranca_enviada', 'recebido', 'cancelado'));
