-- Migration: RPCs para aprovação e devolução de operações pelo RH

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


CREATE OR REPLACE FUNCTION public.rpc_rh_devolver_operacao(
    p_operacao_id UUID,
    p_motivo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.operacoes_producao
    SET status_rh = 'DEVOLVIDO_RH',
        status = 'EM_RESTRICAO',
        avaliacao_json = CASE 
            WHEN p_motivo IS NOT NULL THEN COALESCE(avaliacao_json, '{}'::jsonb) || jsonb_build_object('motivo_devolucao_rh', p_motivo, 'data_devolucao_rh', now())
            ELSE avaliacao_json
        END,
        atualizado_em = now()
    WHERE id = p_operacao_id;
    
    RETURN json_build_object('success', true);
END;
$$;
