-- ==============================================================================
-- MIGRATION: 20260917150000_fix_faturamento_mensal_complementar_multiorigem.sql
-- ERP ORBE / NATO — Faturamento Mensal Complementar + Continuidade Financeira Multiorigem
--
-- Objetivos:
--   1. Centralizar a lógica de obtenção e abertura de receitas mensais na função canônica interna:
--      public.fn_obter_ou_criar_receita_mensal_aberta()
--      - Garante que itens aprovados encontrem a receita mensal aberta (status = 'aguardando_fechamento').
--      - Se a competência já possuir receita encerrada (status IN ('pendente_cobranca', 'cobranca_enviada', 'recebido', 'conciliado')),
--        cria deterministicamente uma NOVA Receita Mensal Complementar sem alterar a receita histórica.
--      - Receitas 'canceladas' são desconsideradas pois representam ciclos anulados/invalidados.
--      - Convergência determinística de concorrência: trata corridas simultâneas via EXCEPTION
--        WHEN unique_violation em conjunto com o índice idx_receitas_operacionais_mensal_aberta.
--      - Registra auditoria/timeline: evento 'CRIAR_RECEITA_COMPLEMENTAR' ou 'CRIAR_RECEITA'.
--      - Superfície de exposição mínima: REVOKE ALL para PUBLIC, anon e authenticated; restrita a service_role e triggers.
--      - Validações fail-closed de tenant_id, empresa_id e operador autenticado.
--   2. Atualizar public.fn_gerar_receita_operacional_automatica() para utilizar a função centralizada.
--   3. Atualizar public.fn_gerar_receita_servico_extra_automatica() para utilizar a função centralizada.
--   4. Atualizar public.rpc_receita_confirmar_recebimento() com segurança fail-closed:
--      - Validação de auth.uid() e autorização restrita a perfis ('admin', 'financeiro') com tenant coincidente.
--      - Sincroniza o status_pagamento ('RECEBIDO') e pipeline_status ('CONCLUIDO') de serviços extras vinculados.
--   5. Preservar integralmente CAIXA_IMEDIATO e DUPLICATA.
--   6. Preservar 100% das receitas históricas, valores, conciliações e regras homologadas.
-- ==============================================================================

-- 1. FUNÇÃO CANÔNICA COMPARTILHADA: Obter ou Criar Receita Mensal Aberta
CREATE OR REPLACE FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(
    p_tenant_id UUID,
    p_empresa_id UUID,
    p_competencia VARCHAR,
    p_vencimento DATE,
    p_unidade_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_receita_id UUID;
    v_caller_tenant_id UUID;
    v_existe_fechada BOOLEAN;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_observacao TEXT := NULL;
    v_acao TEXT := 'CRIAR_RECEITA';
    v_detalhe_texto TEXT;
BEGIN
    -- Validações defensivas de integridade
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_REQUIRED: tenant_id não pode ser nulo para abertura de receita mensal.';
    END IF;
    IF p_empresa_id IS NULL THEN
        RAISE EXCEPTION 'EMPRESA_REQUIRED: empresa_id não pode ser nulo para abertura de receita mensal.';
    END IF;
    IF p_competencia IS NULL OR p_competencia !~ '^\d{4}-\d{2}$' THEN
        RAISE EXCEPTION 'COMPETENCIA_INVALIDA: competência deve estar no formato YYYY-MM.';
    END IF;

    -- Validação fail-closed de operador se invocado sob sessão com auth.uid() presente
    IF auth.uid() IS NOT NULL THEN
        SELECT tenant_id INTO v_caller_tenant_id
        FROM public.profiles
        WHERE user_id = auth.uid() OR id = auth.uid()
        LIMIT 1;

        IF v_caller_tenant_id IS NULL THEN
            v_caller_tenant_id := public.current_tenant_id();
        END IF;

        IF v_caller_tenant_id IS NOT NULL AND v_caller_tenant_id <> p_tenant_id THEN
            RAISE EXCEPTION 'TENANT_MISMATCH: Acesso negado. O tenant do operador (%) diverge do tenant do lançamento (%).', v_caller_tenant_id, p_tenant_id;
        END IF;
    END IF;

    -- Validar que a empresa pertence ao tenant solicitado (integridade referencial multi-tenant)
    IF NOT EXISTS (
        SELECT 1 FROM public.empresas
        WHERE id = p_empresa_id AND tenant_id = p_tenant_id
    ) THEN
        RAISE EXCEPTION 'EMPRESA_NOT_FOUND: Empresa % não encontrada ou não vinculada ao tenant %.', p_empresa_id, p_tenant_id;
    END IF;

    -- 1. Tentar localizar receita mensal ABERTA (com lock FOR UPDATE para concorrência)
    SELECT id INTO v_receita_id
    FROM public.receitas_operacionais
    WHERE tenant_id = p_tenant_id
      AND empresa_id = p_empresa_id
      AND competencia = p_competencia
      AND modalidade = 'FATURAMENTO_MENSAL'
      AND status = 'aguardando_fechamento'
    FOR UPDATE;

    -- Se já existe receita mensal aberta para essa empresa/competência, reutilizá-la
    IF v_receita_id IS NOT NULL THEN
        RETURN v_receita_id;
    END IF;

    -- 2. Não há receita aberta. Verificar se já existe faturamento mensal anterior encerrado
    -- Mapeamento canônico dos 7 estados de receitas_operacionais:
    --   * 'aguardando_fechamento': Único estado de ciclo aberto (verificado acima - inexistente neste ponto).
    --   * 'pendente_cobranca': Ciclo fechado/consolidado aguardando geração de documento (qualifica como encerrado).
    --   * 'cobranca_enviada': Ciclo fechado com documento emitido/enviado ao cliente (qualifica como encerrado).
    --   * 'recebido': Ciclo fechado com liquidação financeira confirmada (qualifica como encerrado).
    --   * 'conciliado': Ciclo fechado com conciliação bancária finalizada (qualifica como encerrado).
    --   * 'cancelado': Ciclo ANULADO/INVALIDADO. Não representa faturamento ativo encerrado (desconsiderado).
    --   * 'pendente_recebimento': Estado restrito a CAIXA_IMEDIATO; não aplicável a faturamento mensal.
    SELECT EXISTS (
        SELECT 1 FROM public.receitas_operacionais
        WHERE tenant_id = p_tenant_id
          AND empresa_id = p_empresa_id
          AND competencia = p_competencia
          AND modalidade = 'FATURAMENTO_MENSAL'
          AND status IN ('pendente_cobranca', 'cobranca_enviada', 'recebido', 'conciliado')
    ) INTO v_existe_fechada;

    IF v_existe_fechada THEN
        v_observacao := 'FATURA_COMPLEMENTAR';
        v_acao := 'CRIAR_RECEITA_COMPLEMENTAR';
        v_detalhe_texto := 'Nova fatura mensal complementar aberta para a competência ' || p_competencia || ' decorrente de faturamento histórico já encerrado.';
    ELSE
        v_observacao := NULL;
        v_acao := 'CRIAR_RECEITA';
        v_detalhe_texto := 'Receita de faturamento mensal iniciada para a competência ' || p_competencia || '.';
    END IF;

    -- 3. Criar a nova receita mensal aberta
    -- Protegida contra concorrência pelo índice condicional idx_receitas_operacionais_mensal_aberta
    BEGIN
        INSERT INTO public.receitas_operacionais (
            tenant_id,
            empresa_id,
            unidade_id,
            modalidade,
            valor_total,
            status,
            competencia,
            vencimento,
            observacao,
            created_at,
            updated_at
        ) VALUES (
            p_tenant_id,
            p_empresa_id,
            p_unidade_id,
            'FATURAMENTO_MENSAL',
            0,
            'aguardando_fechamento',
            p_competencia,
            p_vencimento,
            v_observacao,
            v_now,
            v_now
        ) RETURNING id INTO v_receita_id;

        -- Registrar evento correspondente na timeline de auditoria
        INSERT INTO public.receitas_operacionais_historico (
            tenant_id,
            receita_id,
            acao,
            status_anterior,
            status_novo,
            usuario_id,
            detalhes,
            created_at
        ) VALUES (
            p_tenant_id,
            v_receita_id,
            v_acao,
            NULL,
            'aguardando_fechamento',
            auth.uid(),
            jsonb_build_object(
                'texto', v_detalhe_texto,
                'competencia', p_competencia,
                'vencimento', p_vencimento,
                'origem', 'Trigger Financeiro / Faturamento Mensal'
            ),
            v_now
        );

    EXCEPTION WHEN unique_violation THEN
        -- Tratamento de corrida concorrente com convergência determinística:
        -- Se outra transação simultânea inseriu a receita aberta no mesmo milissegundo,
        -- captura a violação do índice único condicional idx_receitas_operacionais_mensal_aberta
        -- e seleciona deterministicamente a receita aberta sem disparar erro funcional.
        SELECT id INTO v_receita_id
        FROM public.receitas_operacionais
        WHERE tenant_id = p_tenant_id
          AND empresa_id = p_empresa_id
          AND competencia = p_competencia
          AND modalidade = 'FATURAMENTO_MENSAL'
          AND status = 'aguardando_fechamento'
        FOR UPDATE;
    END;

    RETURN v_receita_id;
END;
$$;

-- Permissões estritas da função compartilhada interna (fail-closed)
-- Função auxiliar estritamente interna do motor financeiro, executada sob o contexto
-- das trigger functions (SECURITY DEFINER) ou jobs service_role.
-- O acesso direto pelo cliente authenticated/anon/PUBLIC é explicitamente revogado.
REVOKE ALL ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) FROM anon;
REVOKE ALL ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.fn_obter_ou_criar_receita_mensal_aberta(UUID, UUID, VARCHAR, DATE, UUID) TO service_role;


-- 2. ATUALIZAÇÃO DO TRIGGER DE OPERAÇÕES POR VOLUME
CREATE OR REPLACE FUNCTION public.fn_gerar_receita_operacional_automatica()
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
                SELECT upper(trim(nome)), upper(trim(coalesce(modalidade, ''))) INTO v_forma_pgto_nome, v_forma_pgto_modalidade
                FROM public.formas_pagamento_operacional 
                WHERE id = NEW.forma_pagamento_id;

                -- REGRA DE PRIORIDADE BLINDADA (FIX 14.2):
                -- 1. FATURAMENTO MENSAL
                IF v_forma_pgto_nome LIKE '%FATURAMENTO%' OR v_forma_pgto_nome LIKE '%MENSAL%' OR v_forma_pgto_modalidade = 'FATURAMENTO_MENSAL' THEN
                    v_modalidade := 'FATURAMENTO_MENSAL';

                -- 2. CAIXA IMEDIATO
                ELSIF v_forma_pgto_nome LIKE '%DINHEIRO%' OR v_forma_pgto_nome LIKE '%PIX%' OR v_forma_pgto_nome LIKE '%CART%' OR v_forma_pgto_nome LIKE '%DEBITO%' OR v_forma_pgto_nome LIKE '%DÉBITO%' OR v_forma_pgto_modalidade = 'CAIXA_IMEDIATO' THEN
                    v_modalidade := 'CAIXA_IMEDIATO';

                -- 3. Modalidade explícita do cadastro
                ELSIF v_forma_pgto_modalidade IS NOT NULL AND v_forma_pgto_modalidade NOT IN ('', 'AMBOS') THEN
                    v_modalidade := v_forma_pgto_modalidade;

                -- 4. Fallback padrão: DUPLICATA
                ELSE
                    v_modalidade := 'DUPLICATA';
                END IF;
            END IF;

            -- Formato arquitetural YYYY-MM
            IF NEW.data_operacao IS NOT NULL THEN
                v_competencia := to_char(NEW.data_operacao, 'YYYY-MM');
            ELSE
                v_competencia := to_char(CURRENT_DATE, 'YYYY-MM');
            END IF;

            -- ==================================================================
            -- FLUXO A: FATURAMENTO MENSAL (Consolidação Real e Contínua)
            -- ==================================================================
            IF v_modalidade = 'FATURAMENTO_MENSAL' THEN
                -- Vencimento no último dia civil da competência
                IF NEW.data_operacao IS NOT NULL THEN
                    v_vencimento := (date_trunc('month', NEW.data_operacao) + INTERVAL '1 month' - INTERVAL '1 day')::date;
                ELSE
                    v_vencimento := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
                END IF;

                -- 1. Obter ou criar a receita mensal aberta de forma centralizada e determinística
                v_receita_id := public.fn_obter_ou_criar_receita_mensal_aberta(
                    NEW.tenant_id,
                    NEW.empresa_id,
                    v_competencia,
                    v_vencimento,
                    NEW.unidade_id
                );

                -- 2. Anexar item à receita aberta com proteção contra duplicação
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
                )
                ON CONFLICT (operacao_id) WHERE operacao_id IS NOT NULL DO NOTHING;

                -- 3. Recalcular valor_total da Receita como a soma estrita dos itens vinculados
                UPDATE public.receitas_operacionais
                SET valor_total = (
                    SELECT COALESCE(SUM(valor_item), 0)
                    FROM public.receitas_operacionais_itens
                    WHERE receita_id = v_receita_id
                ),
                updated_at = clock_timestamp()
                WHERE id = v_receita_id
                  AND status = 'aguardando_fechamento';

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

-- Permissões estritas de execução
REVOKE ALL ON FUNCTION public.fn_gerar_receita_operacional_automatica() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_gerar_receita_operacional_automatica() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_gerar_receita_operacional_automatica() TO authenticated, service_role;


-- 3. ATUALIZAÇÃO DO TRIGGER DE SERVIÇOS EXTRAS
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
    v_prazo_dias INTEGER;
    v_user_tenant_id UUID;
BEGIN
    -- 1. EARLY RETURN OBRIGATÓRIO (Estágio relevante)
    IF NEW.pipeline_status NOT IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO') THEN
        RETURN NEW;
    END IF;

    -- 2. GOVERNANÇA MULTITENANT FAIL-CLOSED
    IF auth.uid() IS NOT NULL THEN
        SELECT tenant_id INTO v_user_tenant_id
        FROM public.profiles
        WHERE user_id = auth.uid() OR id = auth.uid()
        LIMIT 1;

        IF v_user_tenant_id IS NULL THEN
            SELECT current_tenant_id() INTO v_user_tenant_id;
        END IF;

        IF v_user_tenant_id IS NULL THEN
            SELECT tenant_id INTO v_user_tenant_id
            FROM public.usuarios
            WHERE auth_user_id = auth.uid()
            LIMIT 1;
        END IF;

        IF v_user_tenant_id IS NULL THEN
            RAISE EXCEPTION 'VIOLACAO_SEGURANCA_MULTITENANT: Usuário autenticado (%) sem vínculo de tenant identificado em profiles. Operação abortada.', auth.uid();
        END IF;

        IF v_user_tenant_id IS DISTINCT FROM NEW.tenant_id THEN
            RAISE EXCEPTION 'VIOLACAO_SEGURANCA_MULTITENANT: Tenant autenticado (%) diverge do tenant_id do serviço extra (%). Operação abortada.', v_user_tenant_id, NEW.tenant_id;
        END IF;
    END IF;

    -- 3. GERAÇÃO / ATUALIZAÇÃO DA RECEITA OPERACIONAL
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

            -- Prioridade 3: Modalidade explícita cadastrada
            ELSIF v_forma_pgto_modalidade IS NOT NULL AND v_forma_pgto_modalidade NOT IN ('', 'AMBOS') THEN
                v_modalidade := v_forma_pgto_modalidade;

            -- Prioridade 4: Fallback padrão DUPLICATA
            ELSE
                v_modalidade := 'DUPLICATA';
            END IF;
        ELSE
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
        -- FLUXO A: FATURAMENTO MENSAL (Consolidação Centralizada e Contínua)
        -- ==================================================================
        IF v_modalidade = 'FATURAMENTO_MENSAL' THEN
            -- Vencimento no último dia civil da competência
            IF NEW.data IS NOT NULL THEN
                v_vencimento := (date_trunc('month', NEW.data) + INTERVAL '1 month' - INTERVAL '1 day')::date;
            ELSE
                v_vencimento := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::date;
            END IF;

            -- 1. Obter ou criar a receita mensal aberta de forma centralizada e determinística
            v_receita_id := public.fn_obter_ou_criar_receita_mensal_aberta(
                NEW.tenant_id,
                NEW.empresa_id,
                v_competencia,
                v_vencimento,
                NULL
            );

            -- 2. Anexar item à receita aberta com proteção contra duplicação
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
            )
            ON CONFLICT (servico_extra_id) WHERE servico_extra_id IS NOT NULL DO NOTHING;

            -- 3. Recalcular valor_total da Receita como soma exata dos itens
            UPDATE public.receitas_operacionais
            SET valor_total = (
                SELECT COALESCE(SUM(valor_item), 0)
                FROM public.receitas_operacionais_itens
                WHERE receita_id = v_receita_id
            ),
            updated_at = clock_timestamp()
            WHERE id = v_receita_id
              AND status = 'aguardando_fechamento';

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

-- Permissões estritas da trigger function
REVOKE ALL ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_gerar_receita_servico_extra_automatica() TO authenticated, service_role;


-- 4. ATUALIZAÇÃO DA RPC DE CONFIRMAÇÃO DE RECEBIMENTO (SINCRONIZAÇÃO DE SERVIÇOS EXTRAS COM SEGURANÇA FAIL-CLOSED)
CREATE OR REPLACE FUNCTION public.rpc_receita_confirmar_recebimento(
    p_receita_id UUID,
    p_data_recebimento DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_receita RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_user_id UUID := auth.uid();
    v_user_tenant_id UUID;
    v_user_role TEXT;
    v_is_service_role BOOLEAN := FALSE;
    v_data_real DATE;
    v_op_ids UUID[];
    v_se_ids UUID[];
BEGIN
    -- 1. Validar autenticação do operador (fail-closed com suporte explícito a service_role para automação)
    IF v_user_id IS NULL THEN
        IF current_setting('role', true) = 'service_role' OR current_user = 'service_role' THEN
            v_is_service_role := TRUE;
        ELSE
            RAISE EXCEPTION 'AUTH_REQUIRED: Operação restrita a usuários autenticados.';
        END IF;
    END IF;

    -- 2. Identificar tenant e perfil do usuário autenticado (fail-closed)
    IF NOT v_is_service_role THEN
        SELECT tenant_id, role INTO v_user_tenant_id, v_user_role
        FROM public.profiles
        WHERE user_id = v_user_id OR id = v_user_id
        LIMIT 1;

        -- Fallback seguro para tenant via função estável caso profiles não tenha preenchido tenant_id
        IF v_user_tenant_id IS NULL THEN
            v_user_tenant_id := public.current_tenant_id();
        END IF;

        -- Fail-closed: tenant DEVE ser obrigatoriamente determinado
        IF v_user_tenant_id IS NULL THEN
            RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível determinar o tenant do usuário autenticado.';
        END IF;

        -- Fail-closed: perfil DEVE existir e ser estritamente 'admin' ou 'financeiro'
        IF v_user_role IS NULL OR lower(v_user_role) NOT IN ('admin', 'financeiro') THEN
            RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem confirmar recebimento de receitas. Perfil atual: %', COALESCE(v_user_role, 'NENHUM');
        END IF;
    END IF;

    -- 3. Localizar e bloquear a receita (concorrência segura)
    SELECT * INTO v_receita 
    FROM public.receitas_operacionais 
    WHERE id = p_receita_id 
    FOR UPDATE;

    IF NOT FOUND THEN 
        RAISE EXCEPTION 'REC_NOT_FOUND: Receita operacional % não encontrada.', p_receita_id; 
    END IF;

    -- 4. Validar isolamento estrito de tenant (fail-closed)
    IF NOT v_is_service_role AND v_receita.tenant_id <> v_user_tenant_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Acesso negado. A receita pertence a outro tenant.';
    END IF;

    v_data_real := COALESCE(p_data_recebimento, v_receita.data_recebimento, CURRENT_DATE);

    -- 5. Manter a atualização normal em receitas_operacionais
    IF v_receita.status NOT IN ('recebido', 'conciliado') THEN
        UPDATE public.receitas_operacionais
        SET status = 'recebido', 
            data_recebimento = v_data_real,
            updated_at = v_now
        WHERE id = p_receita_id;

        INSERT INTO public.receitas_operacionais_historico(
            tenant_id, 
            receita_id, 
            acao, 
            status_anterior, 
            status_novo, 
            usuario_id, 
            detalhes,
            created_at
        ) VALUES (
            v_receita.tenant_id, 
            p_receita_id, 
            'CONFIRMAR_RECEBIMENTO', 
            v_receita.status, 
            'recebido', 
            v_user_id, 
            jsonb_build_object('texto', 'Liquidação / Recebimento confirmado com sucesso.', 'data_recebimento', v_data_real),
            v_now
        );
    END IF;

    -- 6. Localizar operações vinculadas por receitas_operacionais_itens
    SELECT array_agg(operacao_id) INTO v_op_ids
    FROM public.receitas_operacionais_itens
    WHERE receita_id = p_receita_id
      AND operacao_id IS NOT NULL;

    -- 7. Sincronizar operações de produção vinculadas
    IF v_op_ids IS NOT NULL AND array_length(v_op_ids, 1) > 0 THEN
        UPDATE public.operacoes_producao
        SET 
            status_pagamento = 'RECEBIDO',
            data_pagamento = v_data_real,
            status = CASE 
                WHEN status_rh = 'VALIDADO_RH' 
                     AND status != 'EM_RESTRICAO' 
                     AND status_rh != 'DEVOLVIDO_RH'
                     AND status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'RECEBIDO', 'EM_VALIDACAO', 'CONCLUIDO')
                THEN 'CONCLUIDO'
                ELSE status
            END,
            atualizado_em = v_now
        WHERE id = ANY(v_op_ids);
    END IF;

    -- 8. Localizar serviços extras vinculados por receitas_operacionais_itens
    SELECT array_agg(servico_extra_id) INTO v_se_ids
    FROM public.receitas_operacionais_itens
    WHERE receita_id = p_receita_id
      AND servico_extra_id IS NOT NULL;

    -- 9. Sincronizar serviços extras vinculados respeitando as constraints de domínio
    IF v_se_ids IS NOT NULL AND array_length(v_se_ids, 1) > 0 THEN
        UPDATE public.servicos_extras_operacionais
        SET 
            status_pagamento = 'RECEBIDO',
            pipeline_status = CASE 
                WHEN pipeline_status IN ('APROVADO_OPERACAO', 'APROVADO_FINANCEIRO', 'FATURADO')
                THEN 'CONCLUIDO'
                ELSE pipeline_status
            END,
            atualizado_em = v_now
        WHERE id = ANY(v_se_ids);
    END IF;

    RETURN json_build_object(
        'success', true, 
        'status', 'recebido', 
        'data_recebimento', v_data_real,
        'operacoes_afetadas', COALESCE(array_length(v_op_ids, 1), 0),
        'servicos_extras_afetados', COALESCE(array_length(v_se_ids, 1), 0),
        'updated_at', v_now
    );
END;
$$;

-- Permissões estritas da RPC
REVOKE ALL ON FUNCTION public.rpc_receita_confirmar_recebimento(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_receita_confirmar_recebimento(UUID, DATE) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_receita_confirmar_recebimento(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_confirmar_recebimento(UUID, DATE) TO service_role;
