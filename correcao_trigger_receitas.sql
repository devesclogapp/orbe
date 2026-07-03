-- 1. CORREÇÃO DA TRIGGER DE GERAÇÃO AUTOMÁTICA
-- Resolve o problema da trigger continuar inserindo lançamentos antigos ("pendente") 
-- batendo de frente com as regras da nova constraint do Financeiro Receitas.

CREATE OR REPLACE FUNCTION public.fn_gerar_receita_operacional_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita_id UUID;
    v_forma_pgto_nome TEXT;
    v_modalidade TEXT := 'DUPLICATA';
    v_status_inicial TEXT := 'pendente_cobranca';
    v_existente BOOLEAN;
BEGIN
    -- Só prossegue se o status for atualizado para alguma etapa de faturamento/recebimento
    IF NEW.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO') AND (OLD.status IS DISTINCT FROM NEW.status OR OLD.status IS NULL) THEN
        
        -- Verifica se o item já foi gerado na receitas_operacionais_itens para evitar duplicação (Idempotência)
        SELECT EXISTS (
            SELECT 1 FROM public.receitas_operacionais_itens 
            WHERE operacao_id = NEW.id
        ) INTO v_existente;

        IF NOT v_existente THEN
            -- Busca o nome da forma de pagamento atrelada (se houver) para deduzir a modalidade
            IF NEW.forma_pagamento_id IS NOT NULL THEN
                SELECT upper(nome) INTO v_forma_pgto_nome 
                FROM public.formas_pagamento_operacional 
                WHERE id = NEW.forma_pagamento_id;

                IF v_forma_pgto_nome LIKE '%CART%' THEN
                    v_modalidade := 'CAIXA_IMEDIATO';
                    v_status_inicial := 'pendente_recebimento';
                ELSIF v_forma_pgto_nome LIKE '%FATURAMENTO%' OR v_forma_pgto_nome LIKE '%MENSAL%' THEN
                    v_modalidade := 'FATURAMENTO_MENSAL';
                    v_status_inicial := 'aguardando_fechamento';
                ELSIF v_forma_pgto_nome LIKE '%DINHEIRO%' OR v_forma_pgto_nome LIKE '%PIX%' THEN
                    v_modalidade := 'CAIXA_IMEDIATO';
                    v_status_inicial := 'pendente_recebimento';
                END IF;
            END IF;

            -- 1. Inserir a 'Receita Raiz'
            INSERT INTO public.receitas_operacionais (
                tenant_id,
                empresa_id,
                unidade_id,
                modalidade,
                valor_total,
                status
            ) VALUES (
                NEW.tenant_id,
                NEW.empresa_id,
                NEW.unidade_id,
                v_modalidade,
                NEW.valor_total,
                v_status_inicial
            ) RETURNING id INTO v_receita_id;

            -- 2. Inserir o 'Item da Receita' (vínculo real com a operação)
            INSERT INTO public.receitas_operacionais_itens (
                tenant_id,
                receita_id,
                operacao_id,
                valor_item
            ) VALUES (
                NEW.tenant_id,
                v_receita_id,
                NEW.id,
                NEW.valor_total
            );

        END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- 2. NORMALIZAÇÃO / BACKFILL DOS DADOS E CORREÇÃO DE CONSTRAINT
-- Removemos a constraint antiga PRIMEIRO, para permitir que o update injete
-- os novos valores sem falhar.

DO $$ 
DECLARE
  con_name varchar;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.receitas_operacionais'::regclass
  AND contype = 'c'
  AND (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.receitas_operacionais'::regclass AND attname = 'status') = ANY(conkey);
  
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.receitas_operacionais DROP CONSTRAINT IF EXISTS ' || con_name;
  END IF;
  
  -- Remover também caso a constraint tenha o nome explícito
  ALTER TABLE public.receitas_operacionais DROP CONSTRAINT IF EXISTS receitas_operacionais_status_check;
END $$;

-- Agora, com a constraint solta, podemos jogar os dados velhos/errados para as nomenclaturas novas.
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

-- Atualizar valor padrao
ALTER TABLE public.receitas_operacionais ALTER COLUMN status SET DEFAULT 'pendente_recebimento';

-- Recriar a constraint atualizada
ALTER TABLE public.receitas_operacionais 
ADD CONSTRAINT receitas_operacionais_status_check 
CHECK (status IN ('pendente_recebimento', 'pendente_cobranca', 'aguardando_fechamento', 'cobranca_enviada', 'recebido', 'cancelado'));
