-- ==============================================================================
-- MIGRATION: 20260916230000_fix14_5_fechamento_competencia_mensal.sql
-- FIX 14.5: Fechamento Atômico da Competência no Faturamento Mensal
--
-- Objetivos:
--   1. Validar operador autenticado (auth.uid() IS NOT NULL)
--   2. Validar tenant e perfil do operador (admin ou financeiro)
--   3. Carregar e bloquear a receita operacional (FOR UPDATE)
--   4. Validar isolamento estrito de tenant (receita.tenant_id = user.tenant_id)
--   5. Validar modalidade: apenas FATURAMENTO_MENSAL
--   6. Validar transição de status: apenas aguardando_fechamento -> pendente_cobranca
--   7. Idempotência: se já fechada (pendente_cobranca, cobranca_gerada, cobranca_enviada,
--      recebido, conciliado), retorna sucesso sem duplicar histórico nem efeitos financeiros
--   8. Persistir o vencimento informado (ou preservar o existente se nulo)
--   9. Preservar valor_total, competência, empresa, modalidade e itens vinculados
--  10. Registrar atomicamente em receitas_operacionais_historico (auditoria atômica)
--  11. Bloquear acesso de anon e PUBLIC; permitir apenas authenticated e service_role
--  12. Preservar a regra COMPETENCIA_JA_FECHADA do trigger fn_gerar_receita_operacional_automatica()
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_receita_fechar_competencia_mensal(
    p_receita_id UUID,
    p_vencimento DATE DEFAULT NULL
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
    v_vencimento_final DATE;
BEGIN
    -- 1. Validar autenticação do operador (fail-closed)
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTH_REQUIRED: Operação restrita a usuários autenticados.';
    END IF;

    -- 2. Identificar tenant e perfil do usuário autenticado
    SELECT tenant_id, role INTO v_user_tenant_id, v_user_role
    FROM public.profiles
    WHERE user_id = v_user_id OR id = v_user_id
    LIMIT 1;

    -- Fallback seguro para tenant via função estável
    IF v_user_tenant_id IS NULL THEN
        v_user_tenant_id := public.current_tenant_id();
    END IF;

    -- Validação de tenant obrigatório
    IF v_user_tenant_id IS NULL THEN
        RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível determinar o tenant do usuário autenticado.';
    END IF;

    -- Validação de perfil autorizado: estritamente admin ou financeiro
    IF v_user_role IS NULL OR lower(v_user_role) NOT IN ('admin', 'financeiro') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem fechar competências. Perfil atual: %', COALESCE(v_user_role, 'NENHUM');
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

    -- 5. Validar modalidade estrita: apenas FATURAMENTO_MENSAL
    IF v_receita.modalidade <> 'FATURAMENTO_MENSAL' THEN
        RAISE EXCEPTION 'MODALIDADE_INVALIDA: Apenas receitas na modalidade FATURAMENTO_MENSAL podem ser fechadas nesta rotina. Modalidade atual: %', v_receita.modalidade;
    END IF;

    -- 6. Idempotência: se já fechada, retorna sucesso sem duplicar histórico nem efeitos colaterais
    IF v_receita.status IN ('pendente_cobranca', 'cobranca_gerada', 'cobranca_enviada', 'recebido', 'conciliado') THEN
        RETURN json_build_object(
            'success', true,
            'idempotent', true,
            'status', v_receita.status,
            'vencimento', v_receita.vencimento,
            'message', 'Competência já se encontra fechada previamente. (Idempotente)',
            'updated_at', v_receita.updated_at
        );
    END IF;

    -- 7. Validação estrita de máquina de estados: apenas aguardando_fechamento pode ser fechada
    IF v_receita.status <> 'aguardando_fechamento' THEN
        RAISE EXCEPTION 'STATUS_INVALIDO: Apenas receitas em status AGUARDANDO_FECHAMENTO podem ser fechadas. Status atual: %', v_receita.status;
    END IF;

    -- 8. Definir vencimento final (prioriza o informado pelo usuário, senão preserva o existente)
    v_vencimento_final := COALESCE(p_vencimento, v_receita.vencimento);

    -- 9. Atualização atômica exclusiva de status e vencimento em receitas_operacionais
    -- (valor_total, competencia, empresa_id, modalidade permanecem estritamente intactos)
    UPDATE public.receitas_operacionais
    SET 
        status = 'pendente_cobranca',
        vencimento = v_vencimento_final,
        updated_at = v_now
    WHERE id = p_receita_id;

    -- 10. Registro atômico na trilha de auditoria (Timeline da Receita)
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
        'FECHAR_COMPETENCIA',
        'aguardando_fechamento',
        'pendente_cobranca',
        v_user_id,
        jsonb_build_object(
            'texto', 'Competência mensal consolidada e fechada com sucesso. Pronta para cobrança.',
            'vencimento', v_vencimento_final,
            'competencia', v_receita.competencia,
            'origem', 'Financeiro / Faturamento Mensal'
        ),
        v_now
    );

    -- 11. Retorno transacional
    RETURN json_build_object(
        'success', true,
        'idempotent', false,
        'status', 'pendente_cobranca',
        'vencimento', v_vencimento_final,
        'message', 'Competência consolidada e fechada com sucesso.',
        'updated_at', v_now
    );
END;
$$;

-- Permissões de execução — fail-closed
REVOKE ALL ON FUNCTION public.rpc_receita_fechar_competencia_mensal(UUID, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_receita_fechar_competencia_mensal(UUID, DATE) FROM anon;

GRANT EXECUTE ON FUNCTION public.rpc_receita_fechar_competencia_mensal(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_receita_fechar_competencia_mensal(UUID, DATE) TO service_role;
