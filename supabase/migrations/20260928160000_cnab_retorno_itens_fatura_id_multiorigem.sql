-- ==============================================================================
-- MIGRATION: 20260928160000_cnab_retorno_itens_fatura_id_multiorigem.sql
-- OBJETIVO: Corrigir semântica de fatura_id no retorno CNAB multiorigem.
--           - fatura_id passa a ser preenchido estritamente para origem_tipo = 'FATURA'
--           - Para DIARISTA, INTERMITENTE e CLT, fatura_id permanece NULL
--           - Preserva a constraint física cnab_retorno_itens_fatura_id_fkey intacta
--           - Preserva a baixa operacional via origem_tipo + origem_id
--
-- ATENÇÃO CRÍTICA:
-- Conforme diretriz do usuário, esta migration NÃO DEVE SER APLICADA AUTOMATICAMENTE.
-- Ela deve ser revisada e executada manualmente pelo operador via Supabase SQL Editor.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_aplicar_cnab_retorno(
    p_empresa_id UUID,
    p_conta_bancaria_id UUID,
    p_banco_codigo TEXT,
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_itens JSONB
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
    
    -- Variáveis de validação e tipagem relacional por domínio
    v_origem_tipo TEXT;
    v_origem_id UUID;
    v_lote_id UUID;
    v_diaristas_lote_id UUID;
    v_intermitentes_lote_id UUID;
    v_fatura_id UUID;

    v_final_lote_id UUID;
    v_final_diaristas_lote_id UUID;
    v_final_intermitentes_lote_id UUID;
    v_final_fatura_id UUID;
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
    IF p_conta_bancaria_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.contas_bancarias_empresa 
            WHERE id = p_conta_bancaria_id 
              AND empresa_id = p_empresa_id 
              AND tenant_id = v_tenant_id 
              AND ativo = true
        ) THEN
            RAISE EXCEPTION 'Falha de Segurança: Conta Bancária % (Empresa %) não vinculada de forma válida.', p_conta_bancaria_id, p_empresa_id;
        END IF;
    END IF;

    -- 3. Registrar Cabeçalho do Retorno na tabela de Idempotência
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

        -- Extrair discriminadores e identificadores
        v_origem_tipo := COALESCE(v_item->>'origem_tipo', 'FATURA');
        v_origem_id := NULLIF(v_item->>'origem_id', '')::UUID;
        v_lote_id := NULLIF(v_item->>'lote_id', '')::UUID;
        v_diaristas_lote_id := NULLIF(v_item->>'diaristas_lote_id', '')::UUID;
        v_intermitentes_lote_id := NULLIF(v_item->>'intermitentes_lote_id', '')::UUID;
        v_fatura_id := NULLIF(v_item->>'fatura_id', '')::UUID;

        -- 4.1 Validação defensiva estrita: segregação absoluta de fatura_id e lotes por domínio
        IF v_origem_tipo = 'FATURA' THEN
            IF v_origem_id IS NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: origem_id é obrigatório para origem_tipo FATURA.';
            END IF;
            IF v_diaristas_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: diaristas_lote_id (%) não é permitido para origem_tipo FATURA.', v_diaristas_lote_id;
            END IF;
            IF v_intermitentes_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: intermitentes_lote_id (%) não é permitido para origem_tipo FATURA.', v_intermitentes_lote_id;
            END IF;
            v_final_lote_id := v_lote_id;
            v_final_diaristas_lote_id := NULL;
            v_final_intermitentes_lote_id := NULL;
            v_final_fatura_id := COALESCE(v_fatura_id, v_origem_id);

        ELSIF v_origem_tipo = 'DIARISTA' THEN
            IF v_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: lote_id (%) não é permitido para origem_tipo DIARISTA. Use diaristas_lote_id.', v_lote_id;
            END IF;
            IF v_intermitentes_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: intermitentes_lote_id (%) não é permitido para origem_tipo DIARISTA.', v_intermitentes_lote_id;
            END IF;
            IF v_fatura_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: fatura_id (%) não é permitido para origem_tipo DIARISTA. Deve ser NULL.', v_fatura_id;
            END IF;
            v_final_lote_id := NULL;
            v_final_diaristas_lote_id := v_diaristas_lote_id;
            v_final_intermitentes_lote_id := NULL;
            v_final_fatura_id := NULL;

        ELSIF v_origem_tipo = 'INTERMITENTE' THEN
            IF v_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: lote_id (%) não é permitido para origem_tipo INTERMITENTE. Use intermitentes_lote_id.', v_lote_id;
            END IF;
            IF v_diaristas_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: diaristas_lote_id (%) não é permitido para origem_tipo INTERMITENTE.', v_diaristas_lote_id;
            END IF;
            IF v_fatura_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: fatura_id (%) não é permitido para origem_tipo INTERMITENTE. Deve ser NULL.', v_fatura_id;
            END IF;
            v_final_lote_id := NULL;
            v_final_diaristas_lote_id := NULL;
            v_final_intermitentes_lote_id := v_intermitentes_lote_id;
            v_final_fatura_id := NULL;

        ELSIF v_origem_tipo = 'CLT' THEN
            IF v_diaristas_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: diaristas_lote_id (%) não é permitido para origem_tipo CLT.', v_diaristas_lote_id;
            END IF;
            IF v_intermitentes_lote_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: intermitentes_lote_id (%) não é permitido para origem_tipo CLT.', v_intermitentes_lote_id;
            END IF;
            IF v_fatura_id IS NOT NULL THEN
                RAISE EXCEPTION 'Payload inconsistente: fatura_id (%) não é permitido para origem_tipo CLT. Deve ser NULL.', v_fatura_id;
            END IF;
            v_final_lote_id := v_lote_id;
            v_final_diaristas_lote_id := NULL;
            v_final_intermitentes_lote_id := NULL;
            v_final_fatura_id := NULL;

        ELSE
            v_final_lote_id := v_lote_id;
            v_final_diaristas_lote_id := NULL;
            v_final_intermitentes_lote_id := NULL;
            v_final_fatura_id := NULL;
        END IF;

        -- 4.2 Inserir registro detalhado na cnab_retorno_itens com semântica estrita
        INSERT INTO public.cnab_retorno_itens (
            tenant_id, retorno_arquivo_id, remessa_arquivo_id, remessa_item_id,
            lote_id, diaristas_lote_id, intermitentes_lote_id,
            fatura_id, colaborador_id, nome_favorecido, documento_favorecido,
            status, status_conciliacao, codigo_ocorrencia, descricao_ocorrencia, 
            valor_esperado, valor_retornado, linha_original, 
            data_ocorrencia, parsed_json, origem_tipo
        ) VALUES (
            v_tenant_id, v_retorno_id, NULLIF(v_item->>'remessa_id', '')::UUID, NULLIF(v_item->>'remessa_item_id', '')::UUID,
            v_final_lote_id, v_final_diaristas_lote_id, v_final_intermitentes_lote_id,
            v_final_fatura_id, NULLIF(v_item->>'colaborador_id', '')::UUID,
            v_item->>'nome_favorecido', v_item->>'documento_favorecido',
            v_item->>'status', COALESCE(v_item->>'status_conciliacao', CASE WHEN (v_item->>'status') = 'pago' THEN 'conciliado' WHEN (v_item->>'status') = 'rejeitado' THEN 'rejeitado_banco' ELSE 'aguardando_conciliacao' END),
            v_item->>'codigo_ocorrencia', v_item->>'descricao_ocorrencia',
            (v_item->>'valor_esperado')::NUMERIC, (v_item->>'valor_pago')::NUMERIC, v_item->>'linha_original',
            NULLIF(v_item->>'data_ocorrencia', '')::DATE,
            COALESCE((v_item->'parsed_json'), '{}'::jsonb),
            v_origem_tipo
        );

        -- 4.3 Lógica de Baixa Baseada em Status (utiliza estritamente origem_tipo + origem_id)
        IF (v_item->>'status') = 'pago' AND (v_item->>'origem_id') IS NOT NULL AND (v_item->>'origem_id') <> '' THEN
            v_linhas_afetadas := 0;

            -- OCC Constraint: Atualizar APENAS SE o alvo pertencer ao tenant atual
            IF v_origem_tipo = 'CLT' OR v_origem_tipo = 'INTERMITENTE' THEN
                WITH updated AS (
                    UPDATE public.rh_financeiro_lote_itens
                    SET status = 'PAGO', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND tenant_id = v_tenant_id
                      AND status IN ('AGUARDANDO_RETORNO', 'PROCESSADO', 'ENVIADO') 
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;
                
            ELSIF v_origem_tipo = 'FATURA' THEN
                WITH updated AS (
                    UPDATE public.faturas
                    SET status = 'paga', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND tenant_id = v_tenant_id
                      AND status IN ('remetida_ao_banco') 
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;

            ELSIF v_origem_tipo = 'DIARISTA' THEN
                WITH updated AS (
                    UPDATE public.lancamentos_diaristas
                    SET status = 'PAGO', updated_at = now()
                    WHERE id = (v_item->>'origem_id')::UUID 
                      AND status IN ('AGUARDANDO_PAGAMENTO', 'fechado_para_pagamento', 'VALIDADO_RH', 'FECHADO_FINANCEIRO', 'PAGO')
                    RETURNING id
                )
                SELECT COUNT(*) INTO v_linhas_afetadas FROM updated;
            END IF;
            
            v_afetados_totais := v_afetados_totais + v_linhas_afetadas;
        END IF;

        -- 4.4 Marcar o item da remessa subjacente estrito
        IF (v_item->>'remessa_item_id') IS NOT NULL AND (v_item->>'remessa_item_id') <> '' THEN
             UPDATE public.cnab_remessa_itens
             SET status = CASE WHEN (v_item->>'status') = 'pago' THEN 'conciliado' ELSE (v_item->>'status') END,
                 updated_at = now()
             WHERE id = (v_item->>'remessa_item_id')::UUID
               AND tenant_id = v_tenant_id;
        END IF;

    END LOOP;

    -- 5. Auditoria de integridade
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, NULL, NULL, 'processamento_retorno', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'RETORNO_BANCARIO_ATOMICAMENTE_1N',
            'banco_codigo', p_banco_codigo,
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
