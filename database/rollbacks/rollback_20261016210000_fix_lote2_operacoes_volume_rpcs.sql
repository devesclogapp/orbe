-- ==============================================================================
-- Rollback Seguro: rollback_20261016210000_fix_lote2_operacoes_volume_rpcs.sql
-- Localização: database/rollbacks/ (FORA da esteira automática de migrations)
-- 
-- Restaura integralmente as definições vigentes confirmadas no Supabase oficial
-- ==============================================================================

-- 1. Restaura public.rpc_operacao_validar_aprovar
CREATE OR REPLACE FUNCTION public.rpc_operacao_validar_aprovar(
    p_operacao_id UUID,
    p_updated_at_frontend TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    IF p_updated_at_frontend IS NULL OR v_operacao.atualizado_em != p_updated_at_frontend THEN
        RAISE EXCEPTION 'CONCURRENCY_CONFLICT: O registro de operação % alterou na base desde a sua última leitura.', p_operacao_id;
    END IF;

    IF v_operacao.status IN ('AGUARDANDO_FATURAMENTO', 'FATURADO', 'RECEBIDO_FINANCEIRO', 'CONCLUIDO') THEN
        RAISE EXCEPTION 'ESTADO_FECHADO: Operação já vinculada ao fluxo financeiro não pode ser aprovada novamente.';
    END IF;

    -- Update operational status to generate billing, and reset HR status for re-evaluation
    UPDATE public.operacoes_producao
    SET status = 'AGUARDANDO_FATURAMENTO',
        status_rh = 'PENDENTE_RH',
        atualizado_em = v_now
    WHERE id = p_operacao_id;
    
    RETURN json_build_object('success', true, 'operacao_id', p_operacao_id, 'updated_at', v_now);
END;
$$;


-- 2. Restaura public.rpc_rh_aprovar_operacao
CREATE OR REPLACE FUNCTION public.rpc_rh_aprovar_operacao(p_operacao_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.operacoes_producao
    SET status_rh = 'VALIDADO_RH',
        atualizado_em = now()
    WHERE id = p_operacao_id;
    
    RETURN json_build_object('success', true);
END;
$$;


-- 3. Restaura privilégios originais (PUBLIC, anon, authenticated, service_role)
GRANT EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO PUBLIC;

DO $$ 
BEGIN 
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN 
        GRANT EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) TO anon;
        GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO anon;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN 
        GRANT EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) TO authenticated;
        GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO authenticated;
    END IF;
    IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN 
        GRANT EXECUTE ON FUNCTION public.rpc_operacao_validar_aprovar(UUID, TIMESTAMPTZ) TO service_role;
        GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO service_role;
    END IF;
END $$;
