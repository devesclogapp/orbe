-- ==============================================================================
-- Migration: 20261016210000_fix_lote2_operacoes_volume_rpcs.sql
-- LOTE 2: Correção Consolidada e Blindagem de Segurança das RPCs de Operações
-- 
-- Objetivos Canônicos e Ajustes Finais de Segurança:
-- 1. ISOLAMENTO MULTITENANT & AUTORIZAÇÃO FAIL-CLOSED:
--    - Rejeita chamadas sem identidade autenticada (AUTH_REQUIRED), exceto service_role
--    - Rejeita usuários sem perfil ativo ou sem tenant_id resolvido (AUTH_PROFILE_INVALID)
--    - Rejeita acesso entre tenants distintos (CROSS_TENANT_ACCESS_DENIED)
--    - Valida permissão RBAC estrita por perfil para cada ação específica (PERMISSION_DENIED)
--    - Não confia em nenhum tenant_id enviado pelo cliente
-- 
-- 2. FIX C2: Bloqueio defensivo na aprovação operacional (rpc_operacao_validar_aprovar)
--    - Impede aprovação caso o registro esteja em EM_RESTRICAO
--    - Impede aprovação caso entrada_ponto ou saida_ponto estejam nulos/vazios
--    - Compatível com turnos noturnos legítimos (travessia de meia-noite, ex: 22:00 -> 05:00)
--    - Preserva verificação de concorrência OCC e bloqueio de estado fechado
-- 
-- 3. FIX C5: Conclusão simétrica RH / Financeiro (rpc_rh_aprovar_operacao)
--    - Promove a operação para 'CONCLUIDO' quando o RH validar e o pagamento
--      já tiver sido confirmado/liquidado pelo Financeiro (status_pagamento = 'RECEBIDO')
--    - Impede conclusão antecipada se apenas uma das etapas estiver concluída
--    - Bloqueia aprovação se a operação estiver em restrição ativa
-- ==============================================================================

-- 1. RPC DE VALIDAÇÃO E APROVAÇÃO OPERACIONAL (FIX C2 + FAIL-CLOSED)
CREATE OR REPLACE FUNCTION public.rpc_operacao_validar_aprovar(
    p_operacao_id UUID,
    p_updated_at_frontend TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_tenant_id uuid;
    v_user_role text;
BEGIN
    -- 1.1 Busca da operação para bloqueio e conferência
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    -- 1.2 Autenticação, Isolamento Multitenant e RBAC FAIL-CLOSED
    IF auth.role() = 'service_role' THEN
        -- Contrato interno legítimo autorizado (ex.: jobs em background/migrations)
        NULL;
    ELSE
        -- Exige usuário autenticado
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'AUTH_REQUIRED: Chamada sem identidade autenticada.';
        END IF;

        -- Resolve perfil e tenant oficial no banco
        SELECT tenant_id, lower(COALESCE(role, '')) INTO v_user_tenant_id, v_user_role 
        FROM public.profiles 
        WHERE user_id = auth.uid() OR id = auth.uid()
        LIMIT 1;

        IF NOT FOUND OR v_user_tenant_id IS NULL OR v_user_role IS NULL OR trim(v_user_role) = '' THEN
            RAISE EXCEPTION 'AUTH_PROFILE_INVALID: Usuário não possui perfil ativo, role válida ou tenant configurado.';
        END IF;

        -- Isolamento estrito de tenant (Fail-Closed)
        IF v_operacao.tenant_id IS NULL OR v_operacao.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
            RAISE EXCEPTION 'CROSS_TENANT_ACCESS_DENIED: Operação não pertence ao tenant autenticado.';
        END IF;

        -- Validação de perfil (RBAC canônico): apenas governança e financeiro/gestor operacional
        IF v_user_role NOT IN ('admin', 'super_admin', 'gestor', 'financeiro') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: Perfil "%" não possui autorização para validar ou aprovar operações.', v_user_role;
        END IF;
    END IF;

    -- 1.3 Proteção de concorrência otimista (OCC)
    IF p_updated_at_frontend IS NULL OR v_operacao.atualizado_em != p_updated_at_frontend THEN
        RAISE EXCEPTION 'CONCURRENCY_CONFLICT: O registro de operação % alterou na base desde a sua última leitura.', p_operacao_id;
    END IF;

    -- 1.4 FIX C2: Defesa de integridade - Operação com pendência/restrição não pode ser aprovada
    IF v_operacao.status = 'EM_RESTRICAO' OR v_operacao.status_rh = 'DEVOLVIDO_RH' THEN
        RAISE EXCEPTION 'OPERACAO_EM_RESTRICAO: Operação possui restrições pendentes e não pode ser aprovada.';
    END IF;

    -- 1.5 FIX C2: Defesa de integridade - Horários de ponto obrigatórios e validação de formato
    -- Suporta formatos HH:MM e HH:MM:SS, preservando turnos noturnos legítimos (ex: 22:00 -> 05:00)
    IF v_operacao.entrada_ponto IS NULL OR v_operacao.saida_ponto IS NULL 
       OR trim(v_operacao.entrada_ponto::text) = '' OR trim(v_operacao.saida_ponto::text) = '' THEN
        RAISE EXCEPTION 'HORARIOS_OBRIGATORIOS_AUSENTES: Operação não possui horário de entrada e saída válidos.';
    END IF;

    IF v_operacao.entrada_ponto::text !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' 
       OR v_operacao.saida_ponto::text !~ '^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' THEN
        RAISE EXCEPTION 'HORARIOS_INVALIDOS: Formato de horário de entrada ou saída malformado (esperado HH:MM ou HH:MM:SS).';
    END IF;

    -- 1.6 Defesa de integridade - Estado terminal/fechado
    IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO') THEN
        RAISE EXCEPTION 'ESTADO_FECHADO: Operação já vinculada ao fluxo financeiro não pode ser aprovada novamente.';
    END IF;

    -- 1.7 Atualiza status operacional para iniciar pipeline de receitas e submete ao RH
    UPDATE public.operacoes_producao
    SET status = 'AGUARDANDO_FATURAMENTO',
        status_rh = 'PENDENTE_RH',
        atualizado_em = v_now
    WHERE id = p_operacao_id;
    
    RETURN json_build_object(
        'success', true, 
        'operacao_id', p_operacao_id, 
        'status', 'AGUARDANDO_FATURAMENTO',
        'status_rh', 'PENDENTE_RH',
        'updated_at', v_now
    );
END;
$$;


-- 2. RPC DE APROVAÇÃO PELO RH (FIX C5 + FAIL-CLOSED)
CREATE OR REPLACE FUNCTION public.rpc_rh_aprovar_operacao(
    p_operacao_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_tenant_id uuid;
    v_user_role text;
    v_novo_status text;
BEGIN
    -- 2.1 Busca da operação para bloqueio e conferência
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    -- 2.2 Autenticação, Isolamento Multitenant e RBAC FAIL-CLOSED
    IF auth.role() = 'service_role' THEN
        -- Contrato interno legítimo autorizado
        NULL;
    ELSE
        -- Exige usuário autenticado
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'AUTH_REQUIRED: Chamada sem identidade autenticada.';
        END IF;

        -- Resolve perfil e tenant oficial no banco
        SELECT tenant_id, lower(COALESCE(role, '')) INTO v_user_tenant_id, v_user_role 
        FROM public.profiles 
        WHERE user_id = auth.uid() OR id = auth.uid()
        LIMIT 1;

        IF NOT FOUND OR v_user_tenant_id IS NULL OR v_user_role IS NULL OR trim(v_user_role) = '' THEN
            RAISE EXCEPTION 'AUTH_PROFILE_INVALID: Usuário não possui perfil ativo, role válida ou tenant configurado.';
        END IF;

        -- Isolamento estrito de tenant (Fail-Closed)
        IF v_operacao.tenant_id IS NULL OR v_operacao.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
            RAISE EXCEPTION 'CROSS_TENANT_ACCESS_DENIED: Operação não pertence ao tenant autenticado.';
        END IF;

        -- Validação de perfil (RBAC canônico para RH): apenas RH e governança
        IF v_user_role NOT IN ('rh', 'admin', 'super_admin', 'gestor') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: Perfil "%" não possui autorização para validação RH de operações.', v_user_role;
        END IF;
    END IF;

    -- 2.3 Defesa: Não permitir aprovação de operação com restrição ativa ou devolvida
    IF v_operacao.status = 'EM_RESTRICAO' OR v_operacao.status_rh = 'DEVOLVIDO_RH' THEN
        RAISE EXCEPTION 'OPERACAO_EM_RESTRICAO: Não é permitido aprovar pelo RH operação com restrições ativas ou devolvida.';
    END IF;

    -- 2.4 Defesa: Bloqueia operações já validadas pelo RH ou já concluídas
    IF v_operacao.status_rh = 'VALIDADO_RH' OR v_operacao.status = 'CONCLUIDO' THEN
        RAISE EXCEPTION 'ESTADO_FECHADO: Operação já validada pelo RH ou já concluída.';
    END IF;

    -- 2.5 Defesa: Exige que a operação tenha alcançado a etapa RH canônica
    IF v_operacao.status_rh NOT IN ('PENDENTE_RH', 'EM_ANALISE_RH') 
       OR v_operacao.status NOT IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO') THEN
        RAISE EXCEPTION 'ETAPA_RH_INVALIDA: Operação ainda não alcançou a etapa de validação pelo RH (status: %, status_rh: %).', v_operacao.status, v_operacao.status_rh;
    END IF;

    -- 2.6 FIX C5: Conclusão simétrica RH / Financeiro
    -- Promove para CONCLUIDO somente quando ambas as condições forem satisfeitas:
    -- (RH aprovando agora e pagamento já recebido/liquidado no financeiro)
    IF (v_operacao.status_pagamento = 'RECEBIDO' OR v_operacao.status = 'RECEBIDO_FINANCEIRO')
       AND v_operacao.status != 'EM_RESTRICAO' 
       AND v_operacao.status_rh != 'DEVOLVIDO_RH'
       AND v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'RECEBIDO', 'EM_VALIDACAO', 'CONCLUIDO') THEN
        v_novo_status := 'CONCLUIDO';
    ELSE
        v_novo_status := v_operacao.status;
    END IF;

    UPDATE public.operacoes_producao
    SET status_rh = 'VALIDADO_RH',
        status = v_novo_status,
        atualizado_em = v_now
    WHERE id = p_operacao_id;
    
    RETURN json_build_object(
        'success', true, 
        'operacao_id', p_operacao_id, 
        'status_rh', 'VALIDADO_RH',
        'status', v_novo_status,
        'updated_at', v_now
    );
END;
$$;


-- 3. REVISÃO ESTATUTÁRIA DE PRIVILÉGIOS (REVOKE DE PUBLIC/ANON E GRANT ESTRITO)
REVOKE EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) FROM PUBLIC;

DO $$ 
BEGIN 
    -- Revoga expressamente de anon caso a role exista no catálogo
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN 
        REVOKE EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) FROM anon;
        REVOKE EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) FROM anon;
    END IF;

    -- Concede estritamente aos papéis autenticado e serviço interno
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN 
        GRANT EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO authenticated;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN 
        GRANT EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) TO service_role;
        GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO service_role;
    END IF;
END $$;
