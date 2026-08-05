-- ============================================================
-- BLOCO 4: ETAPAS 8 & 9 — MIGRATION G (RPC CONCILIAÇÃO CNAB)
-- ============================================================

DROP FUNCTION IF EXISTS public.rpc_aplicar_cnab_retorno(UUID, UUID, UUID, TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_aplicar_cnab_retorno(
    p_empresa_id UUID,
    p_conta_bancaria_id UUID,
    p_banco_codigo TEXT,
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_itens JSONB -- Array of JSON containing {remessa_id, remessa_item_id, origem_tipo, origem_id, status, data_ocorrencia, codigo_ocorrencia, descricao_ocorrencia, valor_pago}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_retorno_id UUID;
    v_item JSONB;
    v_item_count INTEGER := 0;
    v_linhas_afetadas INTEGER := 0;
    v_afetados_totais INTEGER := 0;
BEGIN
    -- 1. Identificar contexto
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Tenant indisponível para o contexto atual.';
    END IF;

    -- 2. Validar Empresa e Banco
    IF NOT EXISTS (
        SELECT 1 FROM public.contas_bancarias_empresa 
        WHERE id = p_conta_bancaria_id 
          AND empresa_id = p_empresa_id 
          AND tenant_id = v_tenant_id 
          AND ativo = true
    ) THEN
        RAISE EXCEPTION 'Falha de Segurança: Conta Bancária % (Empresa %) não vinculada de forma válida.', p_conta_bancaria_id, p_empresa_id;
    END IF;

    -- 3. Registrar Cabeçalho do Retorno na tabela de Idempotência
    -- O índice unique idx_cnab_retorno_arquivos_hash abortará a transação automaticamente 
    -- se o hash_arquivo já foi processado neste tenant/banco.
    INSERT INTO public.cnab_retorno_arquivos (
        tenant_id, nome_arquivo, hash_arquivo, banco_codigo,
        status, usuario_processamento, data_processamento
    ) VALUES (
        v_tenant_id, p_nome_arquivo, p_hash_arquivo, p_banco_codigo,
        'processado', v_user_id, timezone('utc', now())
    ) RETURNING id INTO v_retorno_id;

    -- 4. Iterar sobre todos os itens detalhados no retorno
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_count := v_item_count + 1;

        -- 4.1 Inserir registro detalhado na cnab_retorno_itens
        INSERT INTO public.cnab_retorno_itens (
            tenant_id, retorno_arquivo_id, remessa_arquivo_id, 
            status, codigo_ocorrencia, descricao_ocorrencia, 
            valor_esperado, valor_retornado, linha_original, 
            data_ocorrencia
        ) VALUES (
            v_tenant_id, v_retorno_id, NULLIF(v_item->>'remessa_id', '')::UUID,
            v_item->>'status', v_item->>'codigo_ocorrencia', v_item->>'descricao_ocorrencia',
            (v_item->>'valor_esperado')::NUMERIC, (v_item->>'valor_pago')::NUMERIC, v_item->>'linha_original',
            NULLIF(v_item->>'data_ocorrencia', '')::DATE
        );

        -- 4.2 Lógica de Baixa Baseada em Status
        IF (v_item->>'status') = 'pago' THEN
            v_linhas_afetadas := 0;

            -- OCC Constraint: Atualizar APENAS SE o alvo pertencer ao tenant atual (Hard-Bounded)
            -- e o status não estiver cancelado.
            IF (v_item->>'origem_tipo') = 'CLT' OR (v_item->>'origem_tipo') = 'INTERMITENTE' THEN
                WITH updated AS (
                    UPDATE public.rh_financeiro_lote_itens
                    SET status = 'PAGO', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND tenant_id = v_tenant_id
                      AND status IN ('AGUARDANDO_RETORNO', 'PROCESSADO', 'ENVIADO') 
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;
                
            ELSIF (v_item->>'origem_tipo') = 'FATURA' THEN
                WITH updated AS (
                    UPDATE public.faturas
                    SET status = 'paga', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND tenant_id = v_tenant_id
                      AND status IN ('remetida_ao_banco') 
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;
            END IF;

            -- 4.3 Confirmação Estrutural OCC (Row Parity Check)
            -- Se v_linhas_afetadas for menor que 1, significa que o registro não foi 
            -- elegível (violou ambiente, tenant, ou já estava concialiado), forçando um Rollback integral.
            IF v_linhas_afetadas <> 1 THEN
                RAISE EXCEPTION 'Divergência Crítica: Tentativa de baixa de Origem ID % (TIPO %) falhou! Conta não elegível ou Tenant Violado. ROLLBACK ativado.', 
                    v_item->>'origem_id', v_item->>'origem_tipo';
            END IF;
            
            v_afetados_totais := v_afetados_totais + v_linhas_afetadas;
        END IF;

        -- Marcar o item da remessa subjacente
        IF (v_item->>'remessa_item_id') IS NOT NULL AND (v_item->>'remessa_item_id') <> '' THEN
             UPDATE public.cnab_remessa_itens
             SET status = (v_item->>'status')
             WHERE id = (v_item->>'remessa_item_id')::UUID
               AND tenant_id = v_tenant_id
               AND status = 'remetido';
        END IF;

    END LOOP;

    -- Auditoria
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, NULL, NULL, 'processamento_retorno', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'RETORNO_BANCARIO_ATOMICAMENTE',
            'hash', p_hash_arquivo,
            'linhas_recebidas', v_item_count,
            'baixas_realizadas', v_afetados_totais
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'retorno_arquivo_id', v_retorno_id,
        'linhas_recebidas', v_item_count,
        'baixas_efetuadas', v_afetados_totais
    );

END;
$$;

REVOKE ALL ON FUNCTION public.rpc_aplicar_cnab_retorno FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_cnab_retorno TO authenticated;
