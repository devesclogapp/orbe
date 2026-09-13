-- ==============================================================================
-- HOTFIX: Restaurar public.fn_gerar_receita_operacional_automatica()
-- Compatibilidade Estrita com Schema Real de receitas_operacionais e receitas_operacionais_itens
--
-- Base Homologada: supabase/migrations/20260705000001_fix_receita_trigger_modalidade.sql (Commit a92f6ae)
-- Incremento FIX 09:
--   - public.receitas_operacionais.competencia = to_char(NEW.data_operacao, 'YYYY-MM')
--   - public.receitas_operacionais.vencimento = NEW.data_vencimento (para DUPLICATA)
-- ==============================================================================

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
    v_status TEXT := 'pendente_cobranca';
    v_vencimento DATE := NULL;
    v_competencia VARCHAR(7) := NULL;
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

            -- Definir o status inicial de acordo com a modalidade para satisfazer check_constraint financeira
            -- e definir o vencimento herdado da operacao (Source of Truth)
            IF v_modalidade = 'CAIXA_IMEDIATO' THEN
                v_status := 'pendente_recebimento';
                v_vencimento := COALESCE(NEW.data_vencimento, NEW.data_operacao);
            ELSIF v_modalidade = 'FATURAMENTO_MENSAL' THEN
                v_status := 'aguardando_fechamento';
                v_vencimento := NEW.data_vencimento;
            ELSE
                v_status := 'pendente_cobranca';
                v_vencimento := NEW.data_vencimento;
            END IF;

            -- Formato arquitetural YYYY-MM
            IF NEW.data_operacao IS NOT NULL THEN
                v_competencia := to_char(NEW.data_operacao, 'YYYY-MM');
            ELSE
                v_competencia := to_char(CURRENT_DATE, 'YYYY-MM');
            END IF;

            -- 1. Inserir a 'Receita Raiz' usando estritamente as colunas do schema real
            INSERT INTO public.receitas_operacionais (
                tenant_id,
                empresa_id,
                unidade_id,
                modalidade,
                valor_total,
                status,
                competencia,
                vencimento
            ) VALUES (
                NEW.tenant_id,
                NEW.empresa_id,
                NEW.unidade_id,
                v_modalidade,
                NEW.valor_total,
                v_status,
                v_competencia,
                v_vencimento
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
