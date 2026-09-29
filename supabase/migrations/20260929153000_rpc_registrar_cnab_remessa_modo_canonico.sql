-- ==============================================================================
-- MIGRAÇÃO DE DEFESA: MODO CANÔNICO CNAB (HOMOLOGAÇÃO × PRODUÇÃO)
-- Arquivo: 20260929153000_rpc_registrar_cnab_remessa_modo_canonico.sql
-- Objetivo: Garantir que a RPC rpc_registrar_cnab_remessa consulte a autoridade
--           canônica empresas.is_teste e determine internamente o modo da remessa:
--             is_teste IS TRUE  -> 'homologacao'
--             is_teste IS NOT TRUE -> 'producao'
--           O banco de dados ignora/sobrescreve qualquer p_modo incompatível
--           injetado pela UI ou callers externos, blindando o sistema fail-safe.
-- NOTA: NÃO EXECUTAR AUTOMATICAMENTE. Arquivo preparado para revisão e aplicação controlada.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(
    p_conta_bancaria_id UUID,
    p_lote_id UUID,
    p_empresa_id UUID,
    p_modo TEXT, -- parâmetro mantido na assinatura para compatibilidade retroativa
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_total_valor NUMERIC,
    p_total_registros INTEGER,
    p_itens JSONB -- Array de JSON contendo {origem_tipo, origem_id, fatura_id, lote_item_id, valor}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_is_teste BOOLEAN;
    v_modo TEXT;
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

    -- 2. Validar Empresa e Tenant, obtendo a autoridade canônica is_teste
    SELECT is_teste INTO v_is_teste
    FROM public.empresas 
    WHERE id = p_empresa_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Falha de Segurança: Empresa % não pertence ao Tenant %', p_empresa_id, v_tenant_id;
    END IF;

    -- Resolução canônica de modo estritamente fail-closed via empresas.is_teste
    IF v_is_teste IS TRUE THEN
        v_modo := 'homologacao';
    ELSIF v_is_teste IS FALSE THEN
        v_modo := 'producao';
    ELSE
        RAISE EXCEPTION 'Falha de Integridade: Empresa % possui classificação de ambiente indefinida (is_teste is null).', p_empresa_id;
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

    -- 6. Inserir cnab_remessas_arquivos com banco_codigo, banco_nome e modo canônico persistidos
    INSERT INTO public.cnab_remessas_arquivos (
        tenant_id, empresa_id, lote_id, conta_bancaria_id, nome_arquivo,
        sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, data_geracao,
        banco_codigo, banco_nome
    ) VALUES (
        v_tenant_id, p_empresa_id, p_lote_id, p_conta_bancaria_id, p_nome_arquivo,
        v_sequencial, p_hash_arquivo, p_total_registros, p_total_valor,
        v_modo, 'gerado', v_user_id, timezone('utc', now()),
        v_banco_codigo, v_banco_nome
    ) RETURNING id INTO v_remessa_id;

    -- 7. Inserir cnab_remessa_itens e atualizar origens conforme o domínio estrito
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
        
        -- Segregação estrita por domínio:
        IF (v_item->>'origem_tipo') = 'CLT' THEN
             -- CLT: atualiza status de rh_financeiro_lote_itens sem referenciar updated_at inexistente
             UPDATE public.rh_financeiro_lote_itens
             SET status = 'AGUARDANDO_RETORNO'
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        ELSIF (v_item->>'origem_tipo') = 'INTERMITENTE' THEN
             -- INTERMITENTE: NÃO toca rh_financeiro_lote_itens e NÃO antecipa liquidação.
             -- Os lançamentos permanecem em seu ciclo canônico (ENVIADO_FINANCEIRO)
             -- e a promoção do lote operacional é orquestrada pela camada de domínio.
             NULL;
        ELSIF (v_item->>'origem_tipo') = 'FATURA' THEN
             UPDATE public.faturas
             SET status = 'remetida_ao_banco', updated_at = now()
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        ELSIF (v_item->>'origem_tipo') = 'DIARISTA' THEN
             -- DIARISTA: os lançamentos permanecem em FECHADO_FINANCEIRO / AGUARDANDO_PAGAMENTO
             -- e serão liquidados apenas na conciliação do retorno bancário
             NULL;
        END IF;

    END LOOP;

    -- 8. Auditoria Bancária com o modo canônico registrado
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
            'modo', v_modo,
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
        'linhas_afetadas', v_item_count,
        'modo', v_modo
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_registrar_cnab_remessa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_cnab_remessa TO authenticated;
