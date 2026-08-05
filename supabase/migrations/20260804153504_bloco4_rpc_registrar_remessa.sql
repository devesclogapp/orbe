-- ============================================================
-- BLOCO 4: ETAPA 6 — MIGRATION E — RPC DE GERAÇÃO (TRANSAÇÃO ATÔMICA)
-- ============================================================

-- Remover função anterior, se existir
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
    v_conta_valida BOOLEAN;
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

    -- Obter o tenant correspondente ao contexto/usuário (ou via RLS config)
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

    -- 3. Validar Conta Bancária
    SELECT EXISTS (
        SELECT 1 FROM public.contas_bancarias_empresa 
        WHERE id = p_conta_bancaria_id 
          AND empresa_id = p_empresa_id 
          AND tenant_id = v_tenant_id 
          AND ativo = true
    ) INTO v_conta_valida;

    IF NOT v_conta_valida THEN
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

    -- 5. Criar a Remessa Fisicamente (O Banco vai rejeitar automático se o Hash já existir)
    -- O sequencial pode ser obtido atômico através da func `get_next_cnab_sequencial`
    v_sequencial := public.get_next_cnab_sequencial(v_tenant_id, p_conta_bancaria_id, '000'); -- Assumindo '000' ou buscar de configuracoes, aqui simplificado

    INSERT INTO public.cnab_remessas_arquivos (
        tenant_id, empresa_id, lote_id, conta_bancaria_id, nome_arquivo,
        sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, data_geracao
    ) VALUES (
        v_tenant_id, p_empresa_id, p_lote_id, p_conta_bancaria_id, p_nome_arquivo,
        v_sequencial, p_hash_arquivo, p_total_registros, p_total_valor,
        p_modo, 'gerado', v_user_id, timezone('utc', now())
    ) RETURNING id INTO v_remessa_id;

    -- 6. Inserir cnab_remessa_itens (Vínculo individual e Idempotência NATIVA de iten)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        -- Se o item_id e origem_tipo existirem e já estiverem faturados, 
        -- a UNIQUE KEY criada na Etapa 2 vai disparar uma FK Error ou Unique Violation que ativará ROLLBACK automático.
        INSERT INTO public.cnab_remessa_itens (
            remessa_id, tenant_id, empresa_id, origem_tipo, origem_id, 
            fatura_id, lote_item_id, valor, status, criado_por
        ) VALUES (
            v_remessa_id, v_tenant_id, p_empresa_id, 
            v_item->>'origem_tipo', (v_item->>'origem_id')::UUID,
            NULLIF(v_item->>'fatura_id', '')::UUID, NULLIF(v_item->>'lote_item_id', '')::UUID,
            (v_item->>'valor')::NUMERIC, 'remetido', v_user_id
        );
        
        -- Marcar origem como remetida / aguardando retorno
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
        END IF;

    END LOOP;

    -- 7. Gravação de Auditoria (Append Only)
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, v_remessa_id, p_lote_id, 'geracao', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'REMESSA_GERADA_ATOMICAMENTE',
            'modo', p_modo,
            'registros', p_total_registros,
            'hash', p_hash_arquivo
        ),
        '127.0.0.1'
    );

    -- Se chegou aqui sem Exceptions (ex: violacoes UNIQUE não detectadas), submeterá COMMIT.
    RETURN jsonb_build_object(
        'sucesso', true,
        'remessa_id', v_remessa_id,
        'sequencial', v_sequencial,
        'linhas_afetadas', v_item_count
    );

END;
$$;

-- Restrição de Segurança: Somente usuários logados podem tentar executar
REVOKE ALL ON FUNCTION public.rpc_registrar_cnab_remessa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_cnab_remessa TO authenticated;
