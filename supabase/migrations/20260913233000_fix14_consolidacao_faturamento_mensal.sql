-- ==============================================================================
-- MIGRATION: FIX 14 — CONSOLIDAÇÃO REAL DO FATURAMENTO MENSAL
-- Data de Criação: 2026-09-13
--
-- Objetivos:
-- 1. Assegurar que operações com modalidade FATURAMENTO_MENSAL da mesma empresa,
--    mesmo tenant e mesma competência consolidem em uma ÚNICA Receita Operacional.
-- 2. Recalcular o valor_total da Receita como a soma de seus itens vinculados.
-- 3. Proteger contra concorrência via UNIQUE INDEX condicional e SELECT FOR UPDATE.
-- 4. Preservar o vencimento no último dia civil da competência.
-- 5. Se a Receita da competência já estiver fechada (status != 'aguardando_fechamento'),
--    impedir consolidação silenciosa e registrar alerta explícito.
-- 6. Preservar DUPLICATA e CAIXA_IMEDIATO 100% inalterados (receita por operação).
-- 7. Garantir que uma operação nunca seja vinculada duas vezes (índice único em itens).
-- ==============================================================================

-- 1. Índice único condicional para garantir atomicidade de 1 única Receita mensal aberta por cliente/competência
CREATE UNIQUE INDEX IF NOT EXISTS idx_receitas_operacionais_mensal_aberta
ON public.receitas_operacionais (tenant_id, empresa_id, competencia, modalidade)
WHERE modalidade = 'FATURAMENTO_MENSAL' AND status = 'aguardando_fechamento';

-- 2. Índice único para garantir que uma operação jamais seja vinculada mais de uma vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_receitas_operacionais_itens_operacao_id
ON public.receitas_operacionais_itens (operacao_id)
WHERE operacao_id IS NOT NULL;

-- 3. Função Trigger Autônoma Atualizada com Consolidação Real de FATURAMENTO_MENSAL
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
    v_fechada_existente BOOLEAN;
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

            -- Formato arquitetural YYYY-MM
            IF NEW.data_operacao IS NOT NULL THEN
                v_competencia := to_char(NEW.data_operacao, 'YYYY-MM');
            ELSE
                v_competencia := to_char(CURRENT_DATE, 'YYYY-MM');
            END IF;

            -- ==================================================================
            -- FLUXO A: FATURAMENTO MENSAL (Consolidação Real por Cliente/Competência)
            -- ==================================================================
            IF v_modalidade = 'FATURAMENTO_MENSAL' THEN
                -- Vencimento no último dia civil da competência
                IF NEW.data_operacao IS NOT NULL THEN
                    v_vencimento := (date_trunc('month', NEW.data_operacao) + INTERVAL '1 month' - INTERVAL '1 day')::date;
                ELSE
                    v_vencimento := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
                END IF;

                -- 1. Buscar se já existe uma Receita mensal aberta para esta Empresa nesta Competência (com Lock Transacional)
                SELECT id INTO v_receita_id
                FROM public.receitas_operacionais
                WHERE tenant_id = NEW.tenant_id
                  AND empresa_id = NEW.empresa_id
                  AND competencia = v_competencia
                  AND modalidade = 'FATURAMENTO_MENSAL'
                  AND status = 'aguardando_fechamento'
                FOR UPDATE;

                IF v_receita_id IS NOT NULL THEN
                    -- CASO 2: Receita aberta existente -> Anexar item e recalcular valor_total da receita
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

                    -- Recalcular valor_total da Receita como a soma estrita dos itens
                    UPDATE public.receitas_operacionais
                    SET valor_total = (
                        SELECT COALESCE(SUM(valor_item), 0)
                        FROM public.receitas_operacionais_itens
                        WHERE receita_id = v_receita_id
                    ),
                    updated_at = now()
                    WHERE id = v_receita_id;

                ELSE
                    -- Verificar se já existe uma receita desta competência que já foi fechada
                    SELECT EXISTS (
                        SELECT 1 FROM public.receitas_operacionais
                        WHERE tenant_id = NEW.tenant_id
                          AND empresa_id = NEW.empresa_id
                          AND competencia = v_competencia
                          AND modalidade = 'FATURAMENTO_MENSAL'
                          AND status != 'aguardando_fechamento'
                    ) INTO v_fechada_existente;

                    IF v_fechada_existente THEN
                        -- CASO 3: Competência já foi fechada. Não anexar silenciosamente.
                        -- Registrar condição explícita no avaliacao_json da operação para intervenção gerencial.
                        UPDATE public.operacoes_producao
                        SET avaliacao_json = jsonb_set(
                            COALESCE(avaliacao_json, '{}'::jsonb),
                            '{alerta_faturamento}',
                            to_jsonb('COMPETENCIA_JA_FECHADA: Operação validada após fechamento da Receita Mensal da competência ' || v_competencia)
                        )
                        WHERE id = NEW.id;

                    ELSE
                        -- CASO 1: Primeira operação do ciclo -> Criar nova Receita mensal aberta
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
                            'FATURAMENTO_MENSAL',
                            NEW.valor_total,
                            'aguardando_fechamento',
                            v_competencia,
                            v_vencimento
                        ) RETURNING id INTO v_receita_id;

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

            -- ==================================================================
            -- FLUXO B: DUPLICATA OU CAIXA_IMEDIATO (Receita Individual por Operação)
            -- ==================================================================
            ELSE
                IF v_modalidade = 'CAIXA_IMEDIATO' THEN
                    v_status := 'pendente_recebimento';
                    v_vencimento := COALESCE(NEW.data_vencimento, NEW.data_operacao);
                ELSE
                    v_status := 'pendente_cobranca';
                    v_vencimento := NEW.data_vencimento;
                END IF;

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
    END IF;

    RETURN NEW;
END;
$$;

-- 4. Permissões estritas de segurança (Security Hardening)
REVOKE ALL ON FUNCTION public.fn_gerar_receita_operacional_automatica() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_gerar_receita_operacional_automatica() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_gerar_receita_operacional_automatica() TO authenticated, service_role;
