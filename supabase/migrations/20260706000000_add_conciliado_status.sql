-- Migration: 20260706000000_add_conciliado_status.sql
-- Objetivo: Incluir o status 'conciliado' nas regras do banco para as Faturas Operacionais

DO $$ 
DECLARE
  con_name varchar;
BEGIN
  -- Procurando a constraint de check atual
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.receitas_operacionais'::regclass
  AND contype = 'c'
  AND (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.receitas_operacionais'::regclass AND attname = 'status') = ANY(conkey);
  
  -- Removendo constraint existente
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.receitas_operacionais DROP CONSTRAINT ' || con_name;
  END IF;
END $$;

-- Adicionar nova check rule com o conciliado incluso
ALTER TABLE public.receitas_operacionais 
ADD CONSTRAINT receitas_operacionais_status_check 
CHECK (status IN ('pendente_recebimento', 'pendente_cobranca', 'aguardando_fechamento', 'cobranca_enviada', 'recebido', 'conciliado', 'cancelado'));
