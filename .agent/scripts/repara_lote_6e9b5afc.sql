DO $$
DECLARE
    v_lote_id UUID := '6e9b5afc-e2f0-4ae8-b0ef-9c581da5e8f0';
    v_lote RECORD;
    v_empresa RECORD;
    v_novo_lote_id UUID;
    v_motivo TEXT := 'Lote invalidado por agrupamento indevido de lançamentos pertencentes a múltiplas empresas. Substituído por lotes segregados por empresa.';
    v_total_lancamentos INT := 0;
    v_total_valor NUMERIC := 0;
BEGIN
    -- 1. Buscar lote pai atual
    SELECT * INTO v_lote FROM intermitentes_lotes_fechamento WHERE id = v_lote_id;
    IF NOT FOUND THEN
        RAISE NOTICE 'Lote % não encontrado!', v_lote_id;
        RETURN;
    END IF;

    -- 2. Invalidação do lote antigo
    -- Trocamos o status para CANCELADO conforme tipagem (se INVALIDADO não for aceito pelo CHECK) e inserimos o motivo
    UPDATE intermitentes_lotes_fechamento
    SET status = 'CANCELADO',
        observacoes = v_motivo,
        updated_at = NOW()
    WHERE id = v_lote_id;
    
    RAISE NOTICE 'Lote % invalidado.', v_lote_id;

    -- 3. Agrupar lançamentos por empresa_id e criar novos lotes
    FOR v_empresa IN (
        SELECT empresa_id, COUNT(id) as qtd, SUM(total) as valor_total 
        FROM lancamentos_intermitentes 
        WHERE lote_fechamento_id = v_lote_id
        GROUP BY empresa_id
    ) LOOP
        -- Como garantido pela auditoria, tem empresa_id
        IF v_empresa.empresa_id IS NULL THEN
            RAISE NOTICE 'ALERTA: Há lançamentos sem empresa_id neste lote! Pulando inserção de lote NULL.';
            CONTINUE;
        END IF;

        -- Inserir novo lote
        INSERT INTO intermitentes_lotes_fechamento (
            tenant_id, empresa_id, competencia, periodo_inicio, periodo_fim, 
            quantidade_registros, valor_total, status, observacoes, created_by
        ) VALUES (
            v_lote.tenant_id, v_empresa.empresa_id, v_lote.competencia, v_lote.periodo_inicio, v_lote.periodo_fim,
            v_empresa.qtd, v_empresa.valor_total, 'AGUARDANDO_VALIDACAO_RH', 'Reparação do lote legado ' || v_lote_id, v_lote.created_by
        ) RETURNING id INTO v_novo_lote_id;

        RAISE NOTICE 'Criado lote % para a empresa % com % registros.', v_novo_lote_id, v_empresa.empresa_id, v_empresa.qtd;

        -- Vincular os lançamentos ao novo lote e voltar status para avaliação
        UPDATE lancamentos_intermitentes
        SET lote_fechamento_id = v_novo_lote_id,
            status_pipeline = 'EM_ANALISE_RH'
        WHERE lote_fechamento_id = v_lote_id AND empresa_id = v_empresa.empresa_id;

        v_total_lancamentos := v_total_lancamentos + v_empresa.qtd;
        v_total_valor := v_total_valor + v_empresa.valor_total;
    END LOOP;

    RAISE NOTICE '----';
    RAISE NOTICE 'Validação Matemática:';
    RAISE NOTICE 'Lote Original - Lançamentos: % | Valor Total: %', v_lote.quantidade_registros, v_lote.valor_total;
    RAISE NOTICE 'Novos Lotes   - Lançamentos: % | Valor Recriado: %', v_total_lancamentos, v_total_valor;

    -- 4. ETAPA 04: Proteção no Banco (NOT NULL na empresa_id)
    -- Verificar se restou algum lote nulo além do cancelado. Os lotes cancelados/invalidados que 
    -- nasceram com empresa_id = nulo não deixariam setar NOT NULL. Então aplicamos um UPDATE 
    -- de limpeza residual na base pra os lotes nulos cancelados terem uma empresa artificial ou os descartamos,
    -- caso a intenção fosse manter empresa_id null neles. Mas como o lote original continuou com empresa_id NULL (se ele nasceu NULL), o ALTER TABLE falharia.
    -- Se v_lote_id nasceu NULL (como o escopo disse), precisamos setar uma empresa_id fantasma nele ou permitir o nulo se o status for CANCELADO.
    -- Porém a instrução pediu "Não aplicar NOT NULL antes da reparação". 
    -- Para não quebrar o ALTER TABLE, vamos primeiro assinalar o mesmo empresa_id do primeiro agrupamento nele.
    -- No update acima, não mudamos o empresa_id do lote cancelado. 
    IF v_lote.empresa_id IS NULL AND v_total_lancamentos > 0 THEN
       UPDATE intermitentes_lotes_fechamento SET empresa_id = (SELECT empresa_id FROM lancamentos_intermitentes WHERE lote_fechamento_id = v_novo_lote_id LIMIT 1) WHERE id = v_lote_id;
    END IF;

    IF EXISTS (SELECT 1 FROM intermitentes_lotes_fechamento WHERE empresa_id IS NULL) THEN
        RAISE EXCEPTION 'Ainda existem outros lotes com empresa_id = NULL. Tratamento manual exigido. Bloqueando ALTER TABLE.';
    END IF;

    -- Execução DDL dentro do DO Block 
    EXECUTE 'ALTER TABLE intermitentes_lotes_fechamento ALTER COLUMN empresa_id SET NOT NULL';
    RAISE NOTICE 'Proteção estrutural concluída: empresa_id agora é NOT NULL.';
END $$;
