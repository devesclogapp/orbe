-- Migration: Fase 5 Domain Hardening - Etapa 02/03 (Financeiro RPCs)
-- Blinda transições de status das receitas e recebimentos nativos no DB (Atomicidade e ODC).

-- 1. RPC para Gerar Cobrança (Emitir NF/Boleto representativo)
CREATE OR REPLACE FUNCTION public.rpc_receita_gerar_cobranca(
    p_receita_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_receita FROM public.receitas_operacionais WHERE id = p_receita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REC_NOT_FOUND.'; END IF;

    IF v_receita.status IN ('cobranca_gerada', 'cobranca_enviada', 'recebido', 'conciliado') THEN
        RETURN json_build_object('success', true, 'message', 'Cobrança já gerada previamente. (Idempotente)');
    END IF;

    -- Update financeiro
    UPDATE public.receitas_operacionais
    SET status = 'cobranca_gerada', updated_at = v_now
    WHERE id = p_receita_id;

    -- Auditoria atômica (dispensa logEvent do react)
    INSERT INTO public.receitas_operacionais_historico(tenant_id, receita_id, acao, status_anterior, status_novo, usuario_id, detalhes)
    VALUES (v_receita.tenant_id, p_receita_id, 'GERAR_COBRANCA', v_receita.status, 'cobranca_gerada', v_user_id, json_build_object('texto', 'A cobrança foi processada/gerada pelo servidor.'));

    RETURN json_build_object('success', true, 'status', 'cobranca_gerada', 'updated_at', v_now);
END;
$$;

-- 2. RPC para Registrar Envio de Cobrança
CREATE OR REPLACE FUNCTION public.rpc_receita_registrar_envio(
    p_receita_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_receita FROM public.receitas_operacionais WHERE id = p_receita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REC_NOT_FOUND.'; END IF;

    IF v_receita.status IN ('cobranca_enviada', 'recebido', 'conciliado') THEN
        RETURN json_build_object('success', true, 'message', 'Cobrança já consta como enviada. (Idempotente)');
    END IF;

    UPDATE public.receitas_operacionais
    SET status = 'cobranca_enviada', updated_at = v_now
    WHERE id = p_receita_id;

    INSERT INTO public.receitas_operacionais_historico(tenant_id, receita_id, acao, status_anterior, status_novo, usuario_id, detalhes)
    VALUES (v_receita.tenant_id, p_receita_id, 'ENVIO_COBRANCA', v_receita.status, 'cobranca_enviada', v_user_id, json_build_object('texto', 'A cobrança foi registrada como enviada ao cliente.'));

    RETURN json_build_object('success', true, 'status', 'cobranca_enviada', 'updated_at', v_now);
END;
$$;


-- 3. RPC para Confirmar Recebimento Financeiro
CREATE OR REPLACE FUNCTION public.rpc_receita_confirmar_recebimento(
    p_receita_id UUID,
    p_data_recebimento DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
    v_data_real DATE;
BEGIN
    SELECT * INTO v_receita FROM public.receitas_operacionais WHERE id = p_receita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REC_NOT_FOUND.'; END IF;

    IF v_receita.status IN ('recebido', 'conciliado') THEN
        RETURN json_build_object('success', true, 'message', 'O recebimento já estava confirmado. (Idempotente)');
    END IF;

    v_data_real := COALESCE(p_data_recebimento, CURRENT_DATE);

    UPDATE public.receitas_operacionais
    SET status = 'recebido', 
        data_recebimento = v_data_real,
        updated_at = v_now
    WHERE id = p_receita_id;

    INSERT INTO public.receitas_operacionais_historico(tenant_id, receita_id, acao, status_anterior, status_novo, usuario_id, detalhes)
    VALUES (v_receita.tenant_id, p_receita_id, 'CONFIRMAR_RECEBIMENTO', v_receita.status, 'recebido', v_user_id, json_build_object('texto', 'Liquidação / Recebimento confirmado com sucesso.', 'data_recebimento', v_data_real));

    RETURN json_build_object('success', true, 'status', 'recebido', 'updated_at', v_now);
END;
$$;


-- 4. RPC para Estorno / Cancelamento de Receita
CREATE OR REPLACE FUNCTION public.rpc_receita_cancelar_ou_estornar(
    p_receita_id UUID,
    p_motivo TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receita record;
    v_now timestamptz := now();
    v_user_id uuid := auth.uid();
BEGIN
    SELECT * INTO v_receita FROM public.receitas_operacionais WHERE id = p_receita_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'REC_NOT_FOUND.'; END IF;

    IF v_receita.status = 'conciliado' THEN
        RAISE EXCEPTION 'COBRANCA_CONCILIADA: Registros conciliados estritamente não podem ser retroagidos sem o módulo C-Level Admin.';
    END IF;

    IF v_receita.status = 'cancelado' THEN
        RETURN json_build_object('success', true, 'message', 'A receita já se encontra cancelada.');
    END IF;

    UPDATE public.receitas_operacionais
    SET status = 'cancelado', updated_at = v_now
    WHERE id = p_receita_id;

    INSERT INTO public.receitas_operacionais_historico(tenant_id, receita_id, acao, status_anterior, status_novo, usuario_id, detalhes)
    VALUES (v_receita.tenant_id, p_receita_id, 'CANCELAMENTO_FINANCEIRO', v_receita.status, 'cancelado', v_user_id, json_build_object('motivo', p_motivo));

    -- NOTA: Opcionalmente poderíamos estornar o status da 'operacoes_producao' para 'CONCLUIDO' se cancelarmos a receita.

    RETURN json_build_object('success', true, 'status', 'cancelado', 'updated_at', v_now);
END;
$$;
