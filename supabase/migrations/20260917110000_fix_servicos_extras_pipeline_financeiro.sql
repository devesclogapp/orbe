-- ==============================================================================
-- MIGRATION: 20260917110000_fix_servicos_extras_pipeline_financeiro.sql
-- FIX: Pipeline de Receitas Operacionais para Serviços Extras
--
-- Objetivos:
--   1. Adicionar integridade referencial entre receitas_operacionais_itens.servico_extra_id
--      e a tabela public.servicos_extras_operacionais com política ON DELETE RESTRICT
--      (preserva imutabilidade e rastreabilidade financeira).
--   2. Validação defensiva de duplicidade antes do índice UNIQUE: se houver dados
--      duplicados, a migration falha explicitamente sem destruição ou consolidação arbitrária.
--   3. Criar índice UNIQUE parcial para garantia absoluta de idempotência estrutural
--      em receitas_operacionais_itens (servico_extra_id WHERE servico_extra_id IS NOT NULL).
--   4. Atualizar a check constraint de servicos_extras_operacionais.modalidade_financeira
--      para suportar os domínios canônicos ('DUPLICATA', 'FATURAMENTO_MENSAL', 'CAIXA_IMEDIATO').
--   5. Criar a função trigger autônoma e desacoplada:
--      public.fn_gerar_receita_servico_extra_automatica()
--      - Acionada quando pipeline_status IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO')
--      - Resolve a modalidade canônica a partir de formas_pagamento_operacional
--      - Vencimento DUPLICATA: data informada -> regras_financeiras ('DUPLICATA' / 'DUPLICATA_FORNECEDOR') -> data do serviço (sem D+7/D+15 arbitrário)
--      - Vencimento FATURAMENTO_MENSAL: último dia civil da competência
--      - Vencimento CAIXA_IMEDIATO: data da operação/serviço
--      - FATURAMENTO_MENSAL: anexa na Receita mensal aberta da empresa/competência
--      - DUPLICATA / CAIXA_IMEDIATO: gera Receita avulsa seguindo a máquina de estados existente
--      - Idempotência lógica + bloqueio transacional (FOR UPDATE)
--   6. Segurança multitenant estrita e FAIL-CLOSED: dados ausentes ou divergência
--      entre tenant autenticado e tenant do registro abortam com RAISE EXCEPTION.
--   7. NÃO ALTERAR nem interferir na trigger ou pipeline de Operações por Volume.
-- ==============================================================================

-- 1. Garantir Foreign Key entre receitas_operacionais_itens e servicos_extras_operacionais (ON DELETE RESTRICT)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_receitas_itens_servico_extra'
          AND table_name = 'receitas_operacionais_itens'
    ) THEN
        ALTER TABLE public.receitas_operacionais_itens
        DROP CONSTRAINT fk_receitas_itens_servico_extra;
    END IF;

    ALTER TABLE public.receitas_operacionais_itens
    ADD CONSTRAINT fk_receitas_itens_servico_extra
    FOREIGN KEY (servico_extra_id) REFERENCES public.servicos_extras_operacionais(id)
    ON DELETE RESTRICT;
END $$;

-- 2. Validação defensiva de duplicidade pré-índice
DO $$
DECLARE
    v_qtd_duplicados INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_qtd_duplicados
    FROM (
        SELECT servico_extra_id
        FROM public.receitas_operacionais_itens
        WHERE servico_extra_id IS NOT NULL
        GROUP BY servico_extra_id
        HAVING COUNT(*) > 1
    ) sub;

    IF v_qtd_duplicados > 0 THEN
        RAISE EXCEPTION 'MIGRATION_ABORTADA: Detectados % servico_extra_id duplicados em receitas_operacionais_itens. Não é seguro criar índice UNIQUE sem auditoria e saneamento manual prévio.', v_qtd_duplicados;
    END IF;
END $$;

-- 3. Índice UNIQUE parcial para idempotência estrutural de Serviços Extras
CREATE UNIQUE INDEX IF NOT EXISTS uk_receitas_itens_servico_extra 
ON public.receitas_operacionais_itens (servico_extra_id) 
WHERE servico_extra_id IS NOT NULL;

-- 4. Atualizar constraint de modalidade_financeira em servicos_extras_operacionais
DO $$
BEGIN
    ALTER TABLE public.servicos_extras_operacionais 
    DROP CONSTRAINT IF EXISTS servicos_extras_operacionais_modalidade_financeira_check;
    
    ALTER TABLE public.servicos_extras_operacionais 
    DROP CONSTRAINT IF EXISTS servicos_extras_operacionais_modalidade_financeir_a_check;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.servicos_extras_operacionais 
ADD CONSTRAINT servicos_extras_operacionais_modalidade_financeira_check 
CHECK (modalidade_financeira IN (
    'CAIXA_IMEDIATO', 
    'DEPOSITO_IMEDIATO', 
    'CAIXA_ADMINISTRATIVO', 
    'DUPLICATA_FORNECEDOR', 
    'FECHAMENTO_MENSAL_EMPRESA',
    'DUPLICATA',
    'FATURAMENTO_MENSAL'
));

-- 5. Função Trigger Autônoma: Integração de Serviços Extras com Receitas Operacionais
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
    v_jwt_tenant_id UUID;
BEGIN
    -- 1. Validação Multitenant Estrita e Fail-Closed
    IF NEW.tenant_id IS NULL THEN
        RAISE EXCEPTION 'VIOLACAO_DADOS: tenant_id é obrigatório para geração de receita de serviço extra.';
    END IF;

    IF NEW.empresa_id IS NULL THEN
        RAISE EXCEPTION 'VIOLACAO_DADOS: empresa_id é obrigatório para geração de receita de serviço extra.';
    END IF;

    -- Se a transação estiver no contexto de uma sessão autenticada (JWT), o tenant da sessão DEVE ser idêntico ao do registro
    IF auth.uid() IS NOT NULL THEN
        BEGIN
            v_jwt_tenant_id := NULLIF(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'tenant_id', '')::UUID;
            IF v_jwt_tenant_id IS NULL THEN
                v_jwt_tenant_id := NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'tenant_id', '')::UUID;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                v_jwt_tenant_id := NULL;
        END;

        -- Fail-Closed: sessão autenticada sem tenant_id identificado no token JWT é bloqueada
        IF v_jwt_tenant_id IS NULL THEN
            RAISE EXCEPTION 'VIOLACAO_SEGURANCA_MULTITENANT: Sessão autenticada sem tenant_id identificado no token JWT. Operação abortada.';
        END IF;

        -- Bloqueio de divergência de tenant (cross-tenant leak)
        IF v_jwt_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
            RAISE EXCEPTION 'VIOLACAO_SEGURANCA_MULTITENANT: Tenant autenticado (%) diverge do tenant_id do serviço extra (%). Operação abortada.', v_jwt_tenant_id, NEW.tenant_id;
        END IF;
    END IF;

    -- 2. Dispara quando o serviço extra atinge o estágio aprovado/financeiro
    IF NEW.pipeline_status IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO')
       AND (OLD.pipeline_status IS DISTINCT FROM NEW.pipeline_status 
            OR OLD.pipeline_status IS NULL 
            OR OLD.forma_pagamento_id IS DISTINCT FROM NEW.forma_pagamento_id 
            OR OLD.total IS DISTINCT FROM NEW.total) THEN

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

        END IF;
    END IF;

    RETURN NEW;
END;
$$;

-- 6. Trigger em public.servicos_extras_operacionais
DROP TRIGGER IF EXISTS trg_gerar_receita_servico_extra_automatica ON public.servicos_extras_operacionais;

CREATE TRIGGER trg_gerar_receita_servico_extra_automatica
AFTER INSERT OR UPDATE OF pipeline_status, forma_pagamento_id, total
ON public.servicos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.fn_gerar_receita_servico_extra_automatica();

-- 7. Governança e Permissões Restritas
REVOKE ALL ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() TO authenticated, service_role;
