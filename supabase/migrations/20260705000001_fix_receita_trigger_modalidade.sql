-- Migration: Correção de Trigger Autônoma para Geração de Receitas (Mapeamento de Modalidade)
-- Objetivo: Incluir reconhecimento de "Débito" para Caixa Imediato e priorizar a modalidade cadastrada.

CREATE OR REPLACE FUNCTION public.fn_gerar_receita_operacional_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita_id UUID;
    v_forma_pgto_nome TEXT;
    v_forma_pgto_modalidade TEXT;
    v_modalidade TEXT := 'DUPLICATA';
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
            -- Busca o nome e modalidade da forma de pagamento atrelada (se houver) para definir a modalidade correta
            IF NEW.forma_pagamento_id IS NOT NULL THEN
                SELECT upper(nome), modalidade INTO v_forma_pgto_nome, v_forma_pgto_modalidade
                FROM public.formas_pagamento_operacional 
                WHERE id = NEW.forma_pagamento_id;

                -- Priorizar a modalidade que já vem do cadastro, a menos que seja AMBOS ou nula
                IF v_forma_pgto_modalidade IS NOT NULL AND v_forma_pgto_modalidade != 'AMBOS' THEN
                    v_modalidade := v_forma_pgto_modalidade;
                ELSE
                    -- Fallback heurístico
                    IF v_forma_pgto_nome LIKE '%CART%' OR v_forma_pgto_nome LIKE '%DEBITO%' OR v_forma_pgto_nome LIKE '%DÉBITO%' THEN
                        v_modalidade := 'CAIXA_IMEDIATO';
                    ELSIF v_forma_pgto_nome LIKE '%FATURAMENTO%' OR v_forma_pgto_nome LIKE '%MENSAL%' THEN
                        v_modalidade := 'FATURAMENTO_MENSAL';
                    ELSIF v_forma_pgto_nome LIKE '%DINHEIRO%' OR v_forma_pgto_nome LIKE '%PIX%' THEN
                        v_modalidade := 'CAIXA_IMEDIATO';
                    END IF;
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
                'pendente'
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
