-- ============================================================
-- MIGRATION: CNAB MULTIBANCO FASE 2 — RETORNO E CONCILIAÇÃO
-- ARQUIVO: 20260928130000_cnab_multibanco_fase2_retorno.sql
-- MOTIVO: 
--   1. Corrigir rpc_registrar_cnab_remessa para persistir banco_codigo e banco_nome
--      extraídos da conta_bancaria pagadora selecionada.
--   2. Atualizar rpc_aplicar_cnab_retorno para suportar baixa atômica de DIARISTA.
--   3. Ampliar status_conciliacao para suportar 'conciliacao_parcial'.
-- IMPORTANTE: NÃO EXECUTAR AUTOMATICAMENTE. APLICAÇÃO MANUAL PELO USUÁRIO.
-- ============================================================

-- 1. Ampliar check constraints de status_conciliacao para suportar 'conciliacao_parcial'
ALTER TABLE public.diaristas_lotes_fechamento 
  DROP CONSTRAINT IF EXISTS diaristas_lotes_fechamento_status_conciliacao_check;

ALTER TABLE public.diaristas_lotes_fechamento 
  ADD CONSTRAINT diaristas_lotes_fechamento_status_conciliacao_check 
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'conciliacao_parcial', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.cnab_retorno_itens 
  DROP CONSTRAINT IF EXISTS cnab_retorno_itens_status_conciliacao_check;

ALTER TABLE public.cnab_retorno_itens 
  ADD CONSTRAINT cnab_retorno_itens_status_conciliacao_check 
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'conciliacao_parcial', 'divergente', 'rejeitado_banco', 'revertido'));

-- 2. Atualizar rpc_registrar_cnab_remessa para persistir banco_codigo e banco_nome
DROP FUNCTION IF EXISTS public.rpc_registrar_cnab_remessa(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.rpc_registrar_cnab_remessa(UUID, UUID, UUID, UUID, TEXT, TEXT, NUMERIC, INTEGER, JSONB);

CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(
    p_conta_bancaria_id UUID,
    p_lote_id UUID,
    p_empresa_id UUID,
    p_modo TEXT, -- 'producao' ou 'homologacao'
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_total_valor NUMERIC,
    p_total_registros INTEGER,
    p_itens JSONB -- Array of JSON containing {origem_tipo, origem_id, fatura_id, lote_item_id, valor}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_empresa_valida BOOLEAN;
    v_banco_codigo TEXT;
    v_banco_nome TEXT;
    v_remessa_id UUID;
    v_sequencial INTEGER;
    v_item JSONB;
    v_item_count INTEGER := 0;
    v_item_sum NUMERIC := 0;
BEGIN
    -- 1. Obter e validar o usuário e o Tenant atrelado
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Tenant indisponível para o contexto atual.';
    END IF;

    -- 2. Validar Empresa e Tenant
    SELECT EXISTS (
        SELECT 1 FROM public.empresas 
        WHERE id = p_empresa_id AND tenant_id = v_tenant_id
    ) INTO v_empresa_valida;

    IF NOT v_empresa_valida THEN
        RAISE EXCEPTION 'Falha de Segurança: Empresa % não pertence ao Tenant %', p_empresa_id, v_tenant_id;
    END IF;

    -- 3. Validar Conta Bancária e extrair banco_codigo e banco_nome da conta pagadora
    SELECT banco_codigo, banco_nome 
    INTO v_banco_codigo, v_banco_nome
    FROM public.contas_bancarias_empresa 
    WHERE id = p_conta_bancaria_id 
      AND empresa_id = p_empresa_id 
      AND tenant_id = v_tenant_id 
      AND ativo = true;

    IF v_banco_codigo IS NULL THEN
        RAISE EXCEPTION 'Falha de Segurança: Conta Bancária inválida, inativa ou pertencente a outra empresa/tenant.';
    END IF;

    -- 4. Validar Identidade contra o JSON de Itens (Sum verification)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_count := v_item_count + 1;
        v_item_sum := v_item_sum + (v_item->>'valor')::NUMERIC;
    END LOOP;

    IF v_item_count <> p_total_registros THEN
        RAISE EXCEPTION 'Divergência: Total de registros declarados (%) difere do payload (%)', p_total_registros, v_item_count;
    END IF;

    IF v_item_sum <> p_total_valor THEN
        RAISE EXCEPTION 'Divergência: Valor total declarado (%) difere da soma real dos itens (%)', p_total_valor, v_item_sum;
    END IF;

    -- 5. Obter sequencial da conta pagadora
    v_sequencial := public.get_next_cnab_sequencial(v_tenant_id, p_conta_bancaria_id, v_banco_codigo);

    -- 6. Inserir cnab_remessas_arquivos com banco_codigo e banco_nome persistidos
    INSERT INTO public.cnab_remessas_arquivos (
        tenant_id, empresa_id, lote_id, conta_bancaria_id, nome_arquivo,
        sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, data_geracao,
        banco_codigo, banco_nome
    ) VALUES (
        v_tenant_id, p_empresa_id, p_lote_id, p_conta_bancaria_id, p_nome_arquivo,
        v_sequencial, p_hash_arquivo, p_total_registros, p_total_valor,
        p_modo, 'gerado', v_user_id, timezone('utc', now()),
        v_banco_codigo, v_banco_nome
    ) RETURNING id INTO v_remessa_id;

    -- 7. Inserir cnab_remessa_itens
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        INSERT INTO public.cnab_remessa_itens (
            remessa_id, tenant_id, empresa_id, origem_tipo, origem_id, 
            fatura_id, lote_item_id, valor, status, criado_por
        ) VALUES (
            v_remessa_id, v_tenant_id, p_empresa_id, 
            v_item->>'origem_tipo', (v_item->>'origem_id')::UUID,
            NULLIF(v_item->>'fatura_id', '')::UUID, NULLIF(v_item->>'lote_item_id', '')::UUID,
            (v_item->>'valor')::NUMERIC, 'remetido', v_user_id
        );
        
        -- Marcar origem como remetida / aguardando retorno conforme o tipo
        IF (v_item->>'origem_tipo') = 'CLT' OR (v_item->>'origem_tipo') = 'INTERMITENTE' THEN
             UPDATE public.rh_financeiro_lote_itens
             SET status = 'AGUARDANDO_RETORNO', updated_at = now()
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        ELSIF (v_item->>'origem_tipo') = 'FATURA' THEN
             UPDATE public.faturas
             SET status = 'remetida_ao_banco', updated_at = now()
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        ELSIF (v_item->>'origem_tipo') = 'DIARISTA' THEN
             -- Para Diaristas, os lançamentos permanecem em FECHADO_FINANCEIRO / AGUARDANDO_PAGAMENTO
             -- e serão liquidados apenas na conciliação do retorno bancário
             NULL;
        END IF;

    END LOOP;

    -- 8. Auditoria Bancária
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, v_remessa_id, p_lote_id, 'geracao', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'REMESSA_GERADA_ATOMICAMENTE',
            'banco_codigo', v_banco_codigo,
            'banco_nome', v_banco_nome,
            'modo', p_modo,
            'registros', p_total_registros,
            'hash', p_hash_arquivo
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'remessa_id', v_remessa_id,
        'banco_codigo', v_banco_codigo,
        'sequencial', v_sequencial,
        'linhas_afetadas', v_item_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_cnab_remessa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_cnab_remessa TO authenticated;


-- 3. Atualizar rpc_aplicar_cnab_retorno para suportar 'DIARISTA'
DROP FUNCTION IF EXISTS public.rpc_aplicar_cnab_retorno(UUID, UUID, TEXT, TEXT, TEXT, JSONB);
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
        IF (v_item->>'status') = 'pago' AND (v_item->>'origem_id') IS NOT NULL AND (v_item->>'origem_id') <> '' THEN
            v_linhas_afetadas := 0;

            -- OCC Constraint: Atualizar APENAS SE o alvo pertencer ao tenant atual
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

            ELSIF (v_item->>'origem_tipo') = 'DIARISTA' THEN
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

        -- Marcar o item da remessa subjacente
        IF (v_item->>'remessa_item_id') IS NOT NULL AND (v_item->>'remessa_item_id') <> '' THEN
             UPDATE public.cnab_remessa_itens
             SET status = CASE WHEN (v_item->>'status') = 'pago' THEN 'conciliado' ELSE (v_item->>'status') END,
                 updated_at = now()
             WHERE id = (v_item->>'remessa_item_id')::UUID
               AND tenant_id = v_tenant_id;
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
