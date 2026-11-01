-- ==============================================================================
-- Migration: 20260913_fix13_rpc_receita_conciliar.sql
-- Objetivo: Criar RPC atômica para Conciliação Manual Declaratória de Receitas
-- Regras:
--   1. Validação de autenticação e tenant interno (public.current_tenant_id())
--   2. Validação de perfil (admin ou financeiro)
--   3. Validação de status anterior ('recebido')
--   4. Idempotência se já estiver 'conciliado'
--   5. Atualização atômica em receitas_operacionais (status = 'conciliado')
--   6. Registro atômico em receitas_operacionais_historico ('CONCILIAR_RECEITA')
--   7. Não altera operacoes_producao, valores, competência ou vencimento
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_receita_conciliar(
    p_receita_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_tenant_id UUID;
    v_user_role TEXT;
    v_receita RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    -- 1. Validar autenticação do operador
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Operação restrita a usuários autenticados.';
    END IF;

    -- 2. Identificar tenant e role do usuário autenticado (fail-closed)
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
    IF v_user_role IS NULL OR v_user_role NOT IN ('admin', 'financeiro') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem conciliar receitas. Perfil atual: %', COALESCE(v_user_role, 'NENHUM');
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
    IF v_receita.tenant_id <> v_user_tenant_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Acesso negado. A receita pertence a outro tenant.';
    END IF;

    -- 6. Idempotência: se já conciliada, retorna sucesso sem duplicar histórico
    IF v_receita.status = 'conciliado' THEN
        RETURN json_build_object(
            'success', true,
            'idempotent', true,
            'status', 'conciliado',
            'message', 'Receita já se encontra conciliada.',
            'updated_at', v_receita.updated_at
        );
    END IF;

    -- 7. Validação estrita de máquina de estados: apenas 'recebido' pode ser conciliado
    IF v_receita.status <> 'recebido' THEN
        RAISE EXCEPTION 'STATUS_INVALIDO: Apenas receitas em status RECEBIDO podem ser conciliadas. Status atual: %', v_receita.status;
    END IF;

    -- 8. Atualização atômica do status em receitas_operacionais
    UPDATE public.receitas_operacionais
    SET 
        status = 'conciliado',
        updated_at = v_now
    WHERE id = p_receita_id;

    -- 9. Registro atômico na trilha de auditoria (Timeline da Receita)
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
        v_receita.tenant_id,
        p_receita_id,
        'CONCILIAR_RECEITA',
        'recebido',
        'conciliado',
        v_user_id,
        jsonb_build_object(
            'texto', 'Receita conciliada após conferência manual do extrato bancário.',
            'origem', 'Financeiro -> Central de Conciliações'
        ),
        v_now
    );

    -- 10. Retorno transacional
    RETURN json_build_object(
        'success', true,
        'idempotent', false,
        'status', 'conciliado',
        'message', 'Receita conciliada com sucesso após conferência manual do extrato bancário.',
        'updated_at', v_now
    );
END;
$$;

-- Permissões de execução — fail-closed
REVOKE ALL ON FUNCTION public.rpc_receita_conciliar(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_receita_conciliar(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION public.rpc_receita_conciliar(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_conciliar(UUID) TO service_role;
