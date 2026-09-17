-- ==============================================================================
-- Migration: FIX CORRETIVO — Serviços Extras / Trigger Financeira Multitenant
-- Arquivo: 20260917120000_fix_servicos_extras_trigger_multitenant.sql
--
-- Contexto:
-- A migration anterior (20260917110000_fix_servicos_extras_pipeline_financeiro.sql)
-- foi executada manualmente e introduziu:
-- 1. Trigger escutando AFTER INSERT que disparava na criação de Serviços Extras PENDENTES.
-- 2. Tentativa de resolver tenant_id via claims JWT (request.jwt.claims), que não existem
--    no token JWT padrão do Supabase neste projeto.
--
-- Esta migration corretiva incremental:
-- 1. Recria trg_gerar_receita_servico_extra_automatica para operar estritamente
--    AFTER UPDATE OF pipeline_status, forma_pagamento_id, total, com cláusula WHEN
--    filtrando apenas estágios financeiros relevantes ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO').
-- 2. Adiciona Early Return obrigatório na linha 1 de fn_gerar_receita_servico_extra_automatica()
--    bloqueando qualquer processamento se NEW.pipeline_status não estiver nesses estágios.
-- 3. Remove completamente a leitura de request.jwt.claims e substitui pela fonte canônica
--    do ORBE: public.current_tenant_id() com fallback em public.profiles.
-- 4. Mantém segurança fail-closed estrita: se a sessão for autenticada (auth.uid() IS NOT NULL)
--    e o usuário não tiver tenant em profiles ou o tenant divergir de NEW.tenant_id, aborta com exceção.
-- 5. Preserva integralmente todas as regras financeiras homologadas (DUPLICATA, FATURAMENTO_MENSAL,
--    CAIXA_IMEDIATO, ON DELETE RESTRICT, idempotência).
-- ==============================================================================

-- 1. Atualizar Função Trigger com Early Return e Fonte Canônica de Tenant (profiles/current_tenant_id)
CREATE OR REPLACE FUNCTION public.fn_gerar_receita_servico_extra_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    v_prazo_dias INTEGER;
    v_user_tenant_id UUID;
BEGIN
    -- 1. GUARDA IMEDIATA DE PIPELINE (EARLY RETURN)
    -- Serviços extras em análise (PENDENTE, EM_VALIDACAO, REJEITADO) NUNCA acionam o pipeline financeiro
    IF NEW.pipeline_status NOT IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO') THEN
        RETURN NEW;
    END IF;

    -- Proteção contra UPDATE sem alteração relevante de negócio
    IF TG_OP = 'UPDATE' THEN
        IF OLD.pipeline_status IS NOT DISTINCT FROM NEW.pipeline_status 
           AND OLD.forma_pagamento_id IS NOT DISTINCT FROM NEW.forma_pagamento_id 
           AND OLD.total IS NOT DISTINCT FROM NEW.total THEN
            RETURN NEW;
        END IF;
    END IF;

    -- 2. VALIDAÇÃO MULTITENANT ESTRITA E FAIL-CLOSED
    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'VIOLACAO_DADOS: tenant_id é obrigatório para geração de receita de serviço extra.';
    END IF;

    IF NEW.empresa_id IS NULL THEN
        RAISE EXCEPTION 'VIOLACAO_DADOS: empresa_id é obrigatório para geração de receita de serviço extra.';
    END IF;

    -- Se a transação estiver no contexto de um usuário autenticado (auth.uid() IS NOT NULL)
    IF auth.uid() IS NOT NULL THEN
        -- 2.1 Fonte Canônica do ORBE: public.current_tenant_id()
        v_user_tenant_id := public.current_tenant_id();

        -- 2.2 Fallback seguro em public.profiles
        IF v_user_tenant_id IS NULL THEN
            SELECT tenant_id INTO v_user_tenant_id
            FROM public.profiles
            WHERE user_id = auth.uid() OR id = auth.uid()
            LIMIT 1;
        END IF;

        -- 2.3 Fail-Closed: usuário autenticado sem tenant em profiles é bloqueado
        IF v_user_tenant_id IS NULL THEN
            RAISE EXCEPTION 'VIOLACAO_SEGURANCA_MULTITENANT: Usuário autenticado (%) sem vínculo de tenant identificado em profiles. Operação abortada.', auth.uid();
        END IF;

        -- 2.4 Fail-Closed: bloqueio de divergência de tenant (cross-tenant leak)
        IF v_user_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
            RAISE EXCEPTION 'VIOLACAO_SEGURANCA_MULTITENANT: Tenant autenticado (%) diverge do tenant_id do serviço extra (%). Operação abortada.', v_user_tenant_id, NEW.tenant_id;
        END IF;
    END IF;

    -- 3. GERAÇÃO / ATUALIZAÇÃO DA RECEITA OPERACIONAL
    -- Verificação de idempotência lógica
    SELECT EXISTS (
        SELECT 1 FROM public.receitas_operacionais_itens
        WHERE servico_extra_id = NEW.id
    ) INTO v_existente;

    IF NOT v_existente THEN
        -- Classificação canônica da modalidade pela forma de pagamento
        IF NEW.forma_pagamento_id IS NOT NULL THEN
            SELECT upper(trim(nome)), upper(trim(coalesce(modalidade, ''))) 
            INTO v_forma_pgto_nome, v_forma_pgto_modalidade
            FROM public.formas_pagamento_operacional 
            WHERE id = NEW.forma_pagamento_id;

            -- Prioridade 1: FATURAMENTO MENSAL
            IF v_forma_pgto_nome LIKE '%FATURAMENTO%' OR v_forma_pgto_nome LIKE '%MENSAL%' OR v_forma_pgto_modalidade = 'FATURAMENTO_MENSAL' THEN
                v_modalidade := 'FATURAMENTO_MENSAL';

            -- Prioridade 2: CAIXA IMEDIATO
            ELSIF v_forma_pgto_nome LIKE '%DINHEIRO%' OR v_forma_pgto_nome LIKE '%PIX%' OR v_forma_pgto_nome LIKE '%CART%' OR v_forma_pgto_nome LIKE '%DEBITO%' OR v_forma_pgto_nome LIKE '%DÉBITO%' OR v_forma_pgto_modalidade = 'CAIXA_IMEDIATO' THEN
                v_modalidade := 'CAIXA_IMEDIATO';

            -- Prioridade 3: Modalidade explícita cadastrada (se válida e diferente de AMBOS/vazia)
            ELSIF v_forma_pgto_modalidade IS NOT NULL AND v_forma_pgto_modalidade NOT IN ('', 'AMBOS') THEN
                v_modalidade := v_forma_pgto_modalidade;

            -- Prioridade 4: Fallback padrão DUPLICATA
            ELSE
                v_modalidade := 'DUPLICATA';
            END IF;
        ELSE
            -- Fallback se forma_pagamento_id não informada
            IF NEW.modalidade_financeira IN ('CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL') THEN
                v_modalidade := NEW.modalidade_financeira;
            ELSE
                v_modalidade := 'DUPLICATA';
            END IF;
        END IF;

        -- Competência no formato YYYY-MM
        IF NEW.data IS NOT NULL THEN
            v_competencia := to_char(NEW.data, 'YYYY-MM');
        ELSE
            v_competencia := to_char(CURRENT_DATE, 'YYYY-MM');
        END IF;

        -- ==================================================================
        -- FLUXO A: FATURAMENTO MENSAL (Consolidação Real na mesma Receita do Cliente)
        -- ==================================================================
        IF v_modalidade = 'FATURAMENTO_MENSAL' THEN
            -- Vencimento no último dia civil da competência (Regra Canônica FIX 14)
            IF NEW.data IS NOT NULL THEN
                v_vencimento := (date_trunc('month', NEW.data) + INTERVAL '1 month' - INTERVAL '1 day')::date;
            ELSE
                v_vencimento := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
            END IF;

            -- Localizar Receita mensal aberta para esta Empresa/Competência (Lock Transacional)
            SELECT id INTO v_receita_id
            FROM public.receitas_operacionais
            WHERE tenant_id = NEW.tenant_id
              AND empresa_id = NEW.empresa_id
              AND competencia = v_competencia
              AND modalidade = 'FATURAMENTO_MENSAL'
              AND status = 'aguardando_fechamento'
            FOR UPDATE;

            IF v_receita_id IS NOT NULL THEN
                -- CASO 1: Anexar item à Receita mensal existente
                INSERT INTO public.receitas_operacionais_itens (
                    tenant_id,
                    receita_id,
                    servico_extra_id,
                    valor_item
                ) VALUES (
                    NEW.tenant_id,
                    v_receita_id,
                    NEW.id,
                    NEW.total
                );

                -- Recalcular valor_total da Receita como soma exata de todos os itens
                UPDATE public.receitas_operacionais
                SET valor_total = (
                    SELECT COALESCE(SUM(valor_item), 0)
                    FROM public.receitas_operacionais_itens
                    WHERE receita_id = v_receita_id
                ),
                updated_at = clock_timestamp()
                WHERE id = v_receita_id;

            ELSE
                -- CASO 2: Verificar se a competência já foi fechada
                SELECT EXISTS (
                    SELECT 1 FROM public.receitas_operacionais
                    WHERE tenant_id = NEW.tenant_id
                      AND empresa_id = NEW.empresa_id
                      AND competencia = v_competencia
                      AND modalidade = 'FATURAMENTO_MENSAL'
                      AND status != 'aguardando_fechamento'
                ) INTO v_fechada_existente;

                IF v_fechada_existente THEN
                    -- Alerta em aprovacao_json sem quebrar a transação
                    UPDATE public.servicos_extras_operacionais
                    SET aprovacao_json = jsonb_set(
                        COALESCE(aprovacao_json, '{}'::jsonb),
                        '{alerta_faturamento}',
                        to_jsonb('COMPETENCIA_JA_FECHADA: Serviço Extra aprovado após fechamento da Receita Mensal da competência ' || v_competencia)
                    )
                    WHERE id = NEW.id;
                ELSE
                    -- CASO 3: Primeiro item do ciclo -> Criar nova Receita mensal aberta
                    INSERT INTO public.receitas_operacionais (
                        tenant_id,
                        empresa_id,
                        modalidade,
                        valor_total,
                        status,
                        competencia,
                        vencimento
                    ) VALUES (
                        NEW.tenant_id,
                        NEW.empresa_id,
                        'FATURAMENTO_MENSAL',
                        NEW.total,
                        'aguardando_fechamento',
                        v_competencia,
                        v_vencimento
                    ) RETURNING id INTO v_receita_id;

                    INSERT INTO public.receitas_operacionais_itens (
                        tenant_id,
                        receita_id,
                        servico_extra_id,
                        valor_item
                    ) VALUES (
                        NEW.tenant_id,
                        v_receita_id,
                        NEW.id,
                        NEW.total
                    );
                END IF;
            END IF;

        -- ==================================================================
        -- FLUXO B: DUPLICATA OU CAIXA_IMEDIATO (Receita Individual por Serviço Extra)
        -- ==================================================================
        ELSE
            IF v_modalidade = 'CAIXA_IMEDIATO' THEN
                v_status := 'pendente_recebimento';
                v_vencimento := COALESCE(NEW.data_vencimento, NEW.data);
            ELSE
                v_status := 'pendente_cobranca';
                IF NEW.data_vencimento IS NOT NULL THEN
                    v_vencimento := NEW.data_vencimento;
                ELSE
                    -- Resolução via tabela oficial public.regras_financeiras
                    -- Compatível com registros existentes: 'DUPLICATA' e 'DUPLICATA_FORNECEDOR'
                    SELECT prazo_dias INTO v_prazo_dias
                    FROM public.regras_financeiras
                    WHERE tenant_id = NEW.tenant_id
                      AND ativo = true
                      AND modalidade_financeira IN ('DUPLICATA', 'DUPLICATA_FORNECEDOR')
                      AND (empresa_id = NEW.empresa_id OR empresa_id IS NULL)
                    ORDER BY empresa_id NULLS LAST
                    LIMIT 1;

                    IF v_prazo_dias IS NOT NULL AND v_prazo_dias > 0 THEN
                        v_vencimento := (NEW.data + (v_prazo_dias || ' days')::INTERVAL)::date;
                    ELSE
                        -- Sem fallback arbitrário: data da prestação do serviço
                        v_vencimento := NEW.data;
                    END IF;
                END IF;
            END IF;

            INSERT INTO public.receitas_operacionais (
                tenant_id,
                empresa_id,
                modalidade,
                valor_total,
                status,
                competencia,
                vencimento
            ) VALUES (
                NEW.tenant_id,
                NEW.empresa_id,
                v_modalidade,
                NEW.total,
                v_status,
                v_competencia,
                v_vencimento
            ) RETURNING id INTO v_receita_id;

            INSERT INTO public.receitas_operacionais_itens (
                tenant_id,
                receita_id,
                servico_extra_id,
                valor_item
            ) VALUES (
                NEW.tenant_id,
                v_receita_id,
                NEW.id,
                NEW.total
            );
        END IF;

    ELSE
        -- Atualização de receita já existente quando alterada antes do faturamento/baixa
        SELECT receita_id INTO v_receita_id
        FROM public.receitas_operacionais_itens
        WHERE servico_extra_id = NEW.id
        LIMIT 1;

        IF v_receita_id IS NOT NULL THEN
            UPDATE public.receitas_operacionais_itens
            SET valor_item = NEW.total
            WHERE servico_extra_id = NEW.id;

            -- Recalcula o valor total da receita operacional se não estiver liquidada
            UPDATE public.receitas_operacionais
            SET valor_total = (
                SELECT COALESCE(SUM(valor_item), 0)
                FROM public.receitas_operacionais_itens
                WHERE receita_id = v_receita_id
            ),
            updated_at = clock_timestamp()
            WHERE id = v_receita_id
              AND status IN ('pendente_cobranca', 'aguardando_fechamento', 'pendente_recebimento');
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 2. Recriar Trigger sem INSERT, restrita a UPDATE relevante com WHEN
DROP TRIGGER IF EXISTS trg_gerar_receita_servico_extra_automatica ON public.servicos_extras_operacionais;

CREATE TRIGGER trg_gerar_receita_servico_extra_automatica
AFTER UPDATE OF pipeline_status, forma_pagamento_id, total
ON public.servicos_extras_operacionais
FOR EACH ROW
WHEN (NEW.pipeline_status IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO'))
EXECUTE FUNCTION public.fn_gerar_receita_servico_extra_automatica();

-- 3. Governança e Permissões Restritas
REVOKE ALL ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() TO authenticated, service_role;
