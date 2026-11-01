-- ==============================================================================
-- ORBE ERP — FIX-CNAB-04: MIGRATION CONSOLIDADA E BLINDADA
-- Objetivo: Vínculo Atômico de Remessas CNAB para Intermitentes e Diaristas,
--           Eliminação de Sobrecargas Ambíguas (PGRST202), Proteção Anti-Duplicidade
--           em Concorrência, Resolução Prévia de Lotes e Validação Estrita de Segurança.
-- Data: 2026-10-14
-- Status: PREPARADA LOCALMENTE — NÃO APLICAR NO SUPABASE OFICIAL SEM AUTORIZAÇÃO
-- ==============================================================================

BEGIN;

-- 1. PRESERVAÇÃO INTEGRAL DA TRIGGER DE IMUTABILIDADE
-- A trigger check_cnab_remessa_imutabilidade é mantida 100% rígida e estrita.
-- Todos os metadados, texto do arquivo e vínculos relacionais são gravados
-- no momento do INSERT inicial pela RPC, sem necessidade de UPDATEs posteriores.

-- 2. GARANTIA DE COLUNAS RELACIONAIS (IDEMPOTÊNCIA ESTRITA)
ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS intermitentes_lote_id UUID NULL REFERENCES public.intermitentes_lotes_fechamento(id) ON DELETE SET NULL;

ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS diaristas_lote_id UUID NULL REFERENCES public.diaristas_lotes_fechamento(id) ON DELETE SET NULL;

ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS conteudo_arquivo TEXT NULL;

ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS competencia VARCHAR(7) NULL;

ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS observacoes TEXT NULL;

-- 3. ÍNDICES ÚNICOS DEFENSIVOS CONTRA CONCORRÊNCIA E DUPLICIDADE
-- Impedem que transações concorrentes criem mais de uma remessa ativa para o mesmo lote.
-- Remessas com status 'cancelado' ou 'erro' são ignoradas pelos índices parciais.

CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessas_intermitentes_ativo 
ON public.cnab_remessas_arquivos (tenant_id, intermitentes_lote_id) 
WHERE intermitentes_lote_id IS NOT NULL AND status NOT IN ('cancelado', 'erro');

CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessas_diaristas_ativo 
ON public.cnab_remessas_arquivos (tenant_id, diaristas_lote_id) 
WHERE diaristas_lote_id IS NOT NULL AND status NOT IN ('cancelado', 'erro');

CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessas_lote_clt_ativo 
ON public.cnab_remessas_arquivos (tenant_id, lote_id) 
WHERE lote_id IS NOT NULL AND diaristas_lote_id IS NULL AND intermitentes_lote_id IS NULL AND status NOT IN ('cancelado', 'erro');

-- 4. REMOÇÃO DE ASSINATURAS ANTERIORES PARA EVITAR AMBIGUIDADE NO POSTGREST (PGRST202)
DROP FUNCTION IF EXISTS public.rpc_registrar_cnab_remessa(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, JSONB);
DROP FUNCTION IF EXISTS public.rpc_registrar_cnab_remessa(UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, INTEGER, JSONB, UUID, UUID, TEXT, TEXT, TEXT);

-- 5. RPC CANÔNICA, 100% ATÔMICA E PROTEGIDA CONTRA RACE CONDITIONS
CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(
    p_conta_bancaria_id UUID,
    p_lote_id UUID,
    p_empresa_id UUID,
    p_modo TEXT,
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_total_valor NUMERIC,
    p_total_registros INTEGER,
    p_itens JSONB,
    p_diaristas_lote_id UUID DEFAULT NULL,
    p_intermitentes_lote_id UUID DEFAULT NULL,
    p_conteudo_arquivo TEXT DEFAULT NULL,
    p_competencia TEXT DEFAULT NULL,
    p_observacoes TEXT DEFAULT NULL
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
    v_item_origem_tipo TEXT;
    v_item_origem_id UUID;
    v_item_is_teste BOOLEAN;
    v_item_empresa_id UUID;
    v_item_tenant_id UUID;
    v_item_lote_id UUID;
    v_intermitentes_lote_id UUID := p_intermitentes_lote_id;
    v_diaristas_lote_id UUID := p_diaristas_lote_id;
    v_lote_empresa_id UUID;
    v_lote_status TEXT;
    v_linhas_arr TEXT[];
    v_num_linhas INTEGER;
    v_seq_declarado INTEGER;
    v_hash_calculado TEXT;
    i INTEGER;
BEGIN
    -- 5.1 Autenticação e Contexto de Tenant
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Tenant indisponível para o contexto atual.';
    END IF;

    -- 5.2 Validação Canônica da Empresa Pagadora (Autoridade is_teste)
    SELECT is_teste INTO v_is_teste
    FROM public.empresas 
    WHERE id = p_empresa_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Falha de Segurança: Empresa % não encontrada ou não pertence ao Tenant %.', p_empresa_id, v_tenant_id;
    END IF;

    IF v_is_teste IS TRUE THEN
        v_modo := 'homologacao';
    ELSIF v_is_teste IS FALSE THEN
        v_modo := 'producao';
    ELSE
        RAISE EXCEPTION 'Falha de Integridade: Empresa % possui classificação de ambiente indefinida (is_teste is null).', p_empresa_id;
    END IF;

    IF p_modo IS NOT NULL AND (p_modo IS DISTINCT FROM v_modo) THEN
        RAISE EXCEPTION 'Falha de Conformidade: Modo informado (%) incompatível com classificação da empresa (%).', p_modo, v_modo;
    END IF;

    -- 5.3 Validação Estrita da Conta Bancária Pagadora
    -- Deve pertencer exatamente à empresa p_empresa_id e ao tenant autenticado
    SELECT banco_codigo, banco_nome 
    INTO v_banco_codigo, v_banco_nome
    FROM public.contas_bancarias_empresa 
    WHERE id = p_conta_bancaria_id 
      AND empresa_id = p_empresa_id 
      AND tenant_id = v_tenant_id 
      AND ativo IS TRUE;

    IF v_banco_codigo IS NULL THEN
        RAISE EXCEPTION 'Falha de Segurança: Conta Bancária % inválida, inativa ou não pertence à empresa % no tenant %.', p_conta_bancaria_id, p_empresa_id, v_tenant_id;
    END IF;

    -- 5.4 Deduplicação por Hash Global
    IF EXISTS (
        SELECT 1 FROM public.cnab_remessas_arquivos
        WHERE tenant_id = v_tenant_id 
          AND hash_arquivo = p_hash_arquivo
          AND status NOT IN ('cancelado', 'erro')
    ) THEN
        RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Arquivo com hash % já foi registrado anteriormente.', p_hash_arquivo;
    END IF;

    -- 5.5 Resolução Prévia de Lotes a partir dos Itens (Elimina Inferência Tardia)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_origem_tipo := v_item->>'origem_tipo';
        v_item_origem_id := NULLIF(v_item->>'origem_id', '')::UUID;

        IF v_item_origem_tipo = 'INTERMITENTE' THEN
            SELECT li.lote_fechamento_id, li.empresa_id, li.tenant_id
            INTO v_item_lote_id, v_item_empresa_id, v_item_tenant_id
            FROM public.lancamentos_intermitentes li
            WHERE li.id = v_item_origem_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento intermitente % não encontrado.', v_item_origem_id;
            END IF;

            IF v_item_tenant_id IS DISTINCT FROM v_tenant_id THEN
                RAISE EXCEPTION 'Falha de Segurança: Lançamento intermitente % pertence a outro tenant.', v_item_origem_id;
            END IF;

            IF v_item_empresa_id IS DISTINCT FROM p_empresa_id THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento intermitente % pertence a outra empresa (%).', v_item_origem_id, v_item_empresa_id;
            END IF;

            IF v_intermitentes_lote_id IS NULL THEN
                v_intermitentes_lote_id := v_item_lote_id;
            ELSIF v_intermitentes_lote_id IS DISTINCT FROM v_item_lote_id THEN
                RAISE EXCEPTION 'Falha de Integridade: Itens de intermitentes pertencem a múltiplos lotes distintos (% e %).', v_intermitentes_lote_id, v_item_lote_id;
            END IF;

        ELSIF v_item_origem_tipo IN ('DIARISTA', 'DIARISTAS') THEN
            SELECT ld.lote_fechamento_id, ld.empresa_id, ld.tenant_id
            INTO v_item_lote_id, v_item_empresa_id, v_item_tenant_id
            FROM public.lancamentos_diaristas ld
            WHERE ld.id = v_item_origem_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento de diarista % não encontrado.', v_item_origem_id;
            END IF;

            IF v_item_tenant_id IS DISTINCT FROM v_tenant_id THEN
                RAISE EXCEPTION 'Falha de Segurança: Lançamento de diarista % pertence a outro tenant.', v_item_origem_id;
            END IF;

            IF v_item_empresa_id IS DISTINCT FROM p_empresa_id THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento de diarista % pertence a outra empresa (%).', v_item_origem_id, v_item_empresa_id;
            END IF;

            IF v_diaristas_lote_id IS NULL THEN
                v_diaristas_lote_id := v_item_lote_id;
            ELSIF v_diaristas_lote_id IS DISTINCT FROM v_item_lote_id THEN
                RAISE EXCEPTION 'Falha de Integridade: Itens de diaristas pertencem a múltiplos lotes distintos (% e %).', v_diaristas_lote_id, v_item_lote_id;
            END IF;
        END IF;
    END LOOP;

    -- 5.6 Validação Estrita do Contrato Estrutural de Homologação (ORBE_SIMULACAO_CNAB_V1)
    IF v_modo = 'homologacao' THEN
        -- Em homologação, o relatório de simulação estruturado é OBRIGATÓRIO (não permite NULL)
        IF p_conteudo_arquivo IS NULL OR length(trim(p_conteudo_arquivo)) = 0 THEN
            RAISE EXCEPTION 'Falha de Integridade: Em ambiente de homologação, é obrigatório fornecer o conteúdo do relatório de simulação estruturado.';
        END IF;

        -- 1. Separar o arquivo em linhas e higienizar quebras de linha
        SELECT array_agg(rtrim(l, E'\r'))
        INTO v_linhas_arr
        FROM regexp_split_to_table(p_conteudo_arquivo, E'\n') AS l;

        -- Remover linhas em branco no final (trailing empty lines)
        WHILE array_length(v_linhas_arr, 1) > 0 AND length(trim(v_linhas_arr[array_length(v_linhas_arr, 1)])) = 0 LOOP
            v_linhas_arr := v_linhas_arr[1:array_length(v_linhas_arr, 1) - 1];
        END LOOP;

        v_num_linhas := coalesce(array_length(v_linhas_arr, 1), 0);
        IF v_num_linhas < 19 THEN
            RAISE EXCEPTION 'Falha de Integridade: Relatório de simulação incompleto (possui % linhas, mínimo requerido é 19).', v_num_linhas;
        END IF;

        -- Varredura Global Prioritária: Bloqueio estrito contra qualquer registro FEBRABAN posicional (240 caracteres)
        FOR i IN 1..v_num_linhas LOOP
            IF length(v_linhas_arr[i]) = 240 AND v_linhas_arr[i] ~ '^[0-9]{3}' THEN
                RAISE EXCEPTION 'Falha de Segurança Bancária: O arquivo contém registros bancários posicionais FEBRABAN de 240 caracteres, estritamente proibidos em homologação.';
            END IF;
        END LOOP;

        -- 2. Verificação posicional linha a linha do cabeçalho canônico (linhas 1 a 16)
        IF v_linhas_arr[1] <> 'ORBE_SIMULACAO_CNAB_V1' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 1 deve ser obrigatoriamente "ORBE_SIMULACAO_CNAB_V1".';
        END IF;

        IF v_linhas_arr[2] !~ '^={10,80}$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 2 deve ser separador de cabeçalho (=).';
        END IF;

        IF v_linhas_arr[3] <> 'ORBE ERP — RELATÓRIO DE SIMULAÇÃO DE REMESSA CNAB (AMBIENTE DE HOMOLOGAÇÃO)' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 3 inválida para o cabeçalho do relatório.';
        END IF;

        IF v_linhas_arr[4] <> 'TIPO: SIMULACAO_NAO_BANCARIA' THEN
            RAISE EXCEPTION 'Falha de Segurança Bancária: Linha 4 deve ser "TIPO: SIMULACAO_NAO_BANCARIA".';
        END IF;

        IF v_linhas_arr[5] <> 'SIMULAÇÃO DE HOMOLOGAÇÃO — ARQUIVO NÃO BANCÁRIO' THEN
            RAISE EXCEPTION 'Falha de Segurança Bancária: Linha 5 deve declarar arquivo não bancário.';
        END IF;

        IF v_linhas_arr[6] <> 'ESTE ARQUIVO NÃO É UM ARQUIVO POSICIONAL FEBRABAN E NÃO PODE SER TRANSMITIDO AO BANCO' THEN
            RAISE EXCEPTION 'Falha de Segurança Bancária: Linha 6 deve declarar expressamente a proibição de transmissão.';
        END IF;

        IF v_linhas_arr[7] !~ '^={10,80}$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 7 deve ser separador de cabeçalho (=).';
        END IF;

        IF v_linhas_arr[8] <> 'VERSAO_FORMATO: 1.0' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Versão de formato do relatório de simulação não suportada (requer "VERSAO_FORMATO: 1.0").';
        END IF;

        IF v_linhas_arr[9] !~ '^MODALIDADE: (CLT|INTERMITENTES|DIARISTAS|FATURA)$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 9 possui formato inválido de modalidade.';
        END IF;

        -- 3. Correspondência Exata da Modalidade contra o Lote / Entidade Resolvida
        IF v_intermitentes_lote_id IS NOT NULL THEN
            IF v_linhas_arr[9] <> 'MODALIDADE: INTERMITENTES' THEN
                RAISE EXCEPTION 'Falha de Integridade: Relatório de simulação com modalidade divergente para remessa de Intermitentes (esperado "MODALIDADE: INTERMITENTES", recebido "%").', v_linhas_arr[9];
            END IF;
        ELSIF v_diaristas_lote_id IS NOT NULL THEN
            IF v_linhas_arr[9] <> 'MODALIDADE: DIARISTAS' THEN
                RAISE EXCEPTION 'Falha de Integridade: Relatório de simulação com modalidade divergente para remessa de Diaristas (esperado "MODALIDADE: DIARISTAS", recebido "%").', v_linhas_arr[9];
            END IF;
        ELSIF p_lote_id IS NOT NULL THEN
            IF v_linhas_arr[9] NOT IN ('MODALIDADE: CLT', 'MODALIDADE: FATURA') THEN
                RAISE EXCEPTION 'Falha de Integridade: Relatório de simulação com modalidade divergente para remessa CLT/Fatura (esperado "MODALIDADE: CLT" ou "MODALIDADE: FATURA", recebido "%").', v_linhas_arr[9];
            END IF;
        END IF;

        IF v_linhas_arr[10] !~ '^EMPRESA: .+$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 10 deve declarar a empresa ("EMPRESA: ...").';
        END IF;

        IF v_linhas_arr[11] !~ '^BANCO: .+$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 11 deve declarar o banco ("BANCO: ...").';
        END IF;

        IF v_linhas_arr[12] !~ '^DATA_GERACAO: .+$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 12 deve conter a data de geração.';
        END IF;

        IF v_linhas_arr[13] !~ '^SEQUENCIAL_SIMULADO: [0-9]{1,6}$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 13 deve conter o sequencial simulado ("SEQUENCIAL_SIMULADO: ...").';
        END IF;

        IF v_linhas_arr[14] !~ '^TOTAL_REGISTROS: [0-9]+$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 14 deve conter o total de registros.';
        END IF;

        IF v_linhas_arr[15] !~ '^TOTAL_VALOR: R\$ [0-9]+([.,][0-9]{2})?$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 15 deve conter o valor total formatado ("TOTAL_VALOR: R$ ...").';
        END IF;

        IF v_linhas_arr[16] !~ '^-{10,80}$' THEN
            RAISE EXCEPTION 'Falha de Conformidade: Linha 16 deve ser separador de seção (-).';
        END IF;

        -- 4. Verificação Estrutural do Corpo e Trailer de Encerramento (Rejeição de Conteúdo Extra)
        IF v_linhas_arr[17] = 'STATUS: SIMULAÇÃO CONCLUÍDA — ARQUIVO BANCÁRIO DE TRANSMISSÃO BLOQUEADO' THEN
            IF v_num_linhas <> 19 THEN
                RAISE EXCEPTION 'Falha de Segurança Bancária: Conteúdo adicional não permitido após o trailer de encerramento do relatório.';
            END IF;
            IF v_linhas_arr[18] <> 'FIM_RELATORIO_SIMULACAO' THEN
                RAISE EXCEPTION 'Falha de Integridade: Linha 18 deve ser "FIM_RELATORIO_SIMULACAO".';
            END IF;
            IF v_linhas_arr[19] !~ '^={10,80}$' THEN
                RAISE EXCEPTION 'Falha de Integridade: Linha 19 deve ser fechamento de relatório (=).';
            END IF;

        ELSIF v_linhas_arr[17] IN ('RELAÇÃO DE FAVORECIDOS / LANÇAMENTOS SIMULADOS:', 'FAVORECIDOS_SIMULADOS:') THEN
            IF v_num_linhas < 22 THEN
                RAISE EXCEPTION 'Falha de Integridade: Seção de favorecidos incompleta.';
            END IF;
            -- Validar cada item de favorecido
            FOR i IN 18..(v_num_linhas - 4) LOOP
                IF v_linhas_arr[i] !~ '^\[[0-9]{1,6}\] [^—\r\n]+ — R\$ [0-9.,]+$' THEN
                    RAISE EXCEPTION 'Falha de Segurança Bancária: Linha % fora da estrutura permitida de favorecido: "%"', i, left(v_linhas_arr[i], 60);
                END IF;
            END LOOP;

            IF v_linhas_arr[v_num_linhas - 3] !~ '^-{10,80}$' THEN
                RAISE EXCEPTION 'Falha de Integridade: Separador de encerramento de favorecidos ausente.';
            END IF;
            IF v_linhas_arr[v_num_linhas - 2] <> 'STATUS: SIMULAÇÃO CONCLUÍDA — ARQUIVO BANCÁRIO DE TRANSMISSÃO BLOQUEADO' THEN
                RAISE EXCEPTION 'Falha de Integridade: Status de simulação ausente antes do fechamento.';
            END IF;
            IF v_linhas_arr[v_num_linhas - 1] <> 'FIM_RELATORIO_SIMULACAO' THEN
                RAISE EXCEPTION 'Falha de Integridade: Identificador de fim de relatório ausente.';
            END IF;
            IF v_linhas_arr[v_num_linhas] !~ '^={10,80}$' THEN
                RAISE EXCEPTION 'Falha de Integridade: Linha final deve ser fechamento de relatório (=).';
            END IF;
        ELSE
            RAISE EXCEPTION 'Falha de Segurança Bancária: Conteúdo contém linha inválida fora da estrutura permitida na linha 17: "%"', left(v_linhas_arr[17], 60);
        END IF;
    END IF;

    -- 5.7 Bloqueio Concorrente e Validação Prévia de Status/Duplicidade de Lotes Resolvidos
    IF v_intermitentes_lote_id IS NOT NULL THEN
        SELECT empresa_id, status INTO v_lote_empresa_id, v_lote_status
        FROM public.intermitentes_lotes_fechamento
        WHERE id = v_intermitentes_lote_id AND tenant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Falha de Integridade: Lote de intermitentes % não encontrado no Tenant.', v_intermitentes_lote_id;
        END IF;

        IF v_lote_empresa_id IS DISTINCT FROM p_empresa_id THEN
            RAISE EXCEPTION 'Falha de Segurança: Lote de intermitentes % pertence a outra empresa (%).', v_intermitentes_lote_id, v_lote_empresa_id;
        END IF;

        IF v_lote_status NOT IN ('FECHADO_FINANCEIRO', 'PRONTO_BANCO', 'APROVADO_FINANCEIRO', 'aguardando_pagamento') THEN
            RAISE EXCEPTION 'Geração bloqueada: Lote de intermitentes % está com status "%" (requer aprovação financeira).', v_intermitentes_lote_id, v_lote_status;
        END IF;

        -- Anti-duplicidade direta
        IF EXISTS (
            SELECT 1 FROM public.cnab_remessas_arquivos 
            WHERE intermitentes_lote_id = v_intermitentes_lote_id 
              AND status NOT IN ('cancelado', 'erro')
        ) THEN
            RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Lote de intermitentes % já possui remessa CNAB registrada.', v_intermitentes_lote_id;
        END IF;

        -- Anti-duplicidade indireta (itens vinculados a remessa anterior através de cnab_remessa_itens)
        IF EXISTS (
            SELECT 1 
            FROM public.cnab_remessa_itens cri
            JOIN public.cnab_remessas_arquivos cra ON cra.id = cri.remessa_id
            JOIN public.lancamentos_intermitentes li ON li.id = cri.origem_id
            WHERE li.lote_fechamento_id = v_intermitentes_lote_id
              AND cra.status NOT IN ('cancelado', 'erro')
        ) THEN
            RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Lote de intermitentes % possui lançamentos já vinculados a outra remessa CNAB ativa.', v_intermitentes_lote_id;
        END IF;
    END IF;

    IF v_diaristas_lote_id IS NOT NULL THEN
        SELECT empresa_id, status INTO v_lote_empresa_id, v_lote_status
        FROM public.diaristas_lotes_fechamento
        WHERE id = v_diaristas_lote_id AND tenant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Falha de Integridade: Lote de diaristas % não encontrado no Tenant.', v_diaristas_lote_id;
        END IF;

        IF v_lote_empresa_id IS DISTINCT FROM p_empresa_id THEN
            RAISE EXCEPTION 'Falha de Segurança: Lote de diaristas % pertence a outra empresa (%).', v_diaristas_lote_id, v_lote_empresa_id;
        END IF;

        IF v_lote_status NOT IN ('FECHADO_FINANCEIRO', 'VALIDADO_RH', 'aguardando_pagamento') THEN
            RAISE EXCEPTION 'Geração bloqueada: Lote de diaristas % está com status "%" (requer aprovação financeira).', v_diaristas_lote_id, v_lote_status;
        END IF;

        -- Anti-duplicidade direta
        IF EXISTS (
            SELECT 1 FROM public.cnab_remessas_arquivos 
            WHERE diaristas_lote_id = v_diaristas_lote_id 
              AND status NOT IN ('cancelado', 'erro')
        ) THEN
            RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Lote de diaristas % já possui remessa CNAB registrada.', v_diaristas_lote_id;
        END IF;

        -- Anti-duplicidade indireta
        IF EXISTS (
            SELECT 1 
            FROM public.cnab_remessa_itens cri
            JOIN public.cnab_remessas_arquivos cra ON cra.id = cri.remessa_id
            JOIN public.lancamentos_diaristas ld ON ld.id = cri.origem_id
            WHERE ld.lote_fechamento_id = v_diaristas_lote_id
              AND cra.status NOT IN ('cancelado', 'erro')
        ) THEN
            RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Lote de diaristas % possui lançamentos já vinculados a outra remessa CNAB ativa.', v_diaristas_lote_id;
        END IF;
    END IF;

    IF p_lote_id IS NOT NULL THEN
        SELECT status, empresa_id INTO v_lote_status, v_lote_empresa_id
        FROM public.lotes_remessa
        WHERE id = p_lote_id AND tenant_id = v_tenant_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Falha de Integridade: Lote CLT % não encontrado no tenant.', p_lote_id;
        END IF;

        IF v_lote_empresa_id IS DISTINCT FROM p_empresa_id THEN
            RAISE EXCEPTION 'Falha de Segurança: Lote CLT % pertence a outra empresa.', p_lote_id;
        END IF;

        IF EXISTS (
            SELECT 1 FROM public.cnab_remessas_arquivos
            WHERE lote_id = p_lote_id
              AND diaristas_lote_id IS NULL 
              AND intermitentes_lote_id IS NULL
              AND status NOT IN ('cancelado', 'erro')
        ) THEN
            RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Lote CLT % já possui remessa CNAB registrada.', p_lote_id;
        END IF;
    END IF;

    -- 5.8 Validação Estrita de Existência, Tenant, Empresa e Ambiente de TODOS os Itens
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_count := v_item_count + 1;
        v_item_sum := v_item_sum + (v_item->>'valor')::NUMERIC;
        v_item_origem_tipo := v_item->>'origem_tipo';
        v_item_origem_id := NULLIF(v_item->>'origem_id', '')::UUID;

        IF v_item_origem_tipo IS NULL OR v_item_origem_id IS NULL THEN
            RAISE EXCEPTION 'Falha de Integridade: Item % possui origem_tipo ou origem_id ausente/inválido.', v_item_count;
        END IF;

        -- Proteção contra reaproveitamento de item em múltiplas remessas
        IF EXISTS (
            SELECT 1 
            FROM public.cnab_remessa_itens cri
            JOIN public.cnab_remessas_arquivos cra ON cra.id = cri.remessa_id
            WHERE cri.origem_id = v_item_origem_id
              AND cra.tenant_id = v_tenant_id
              AND cra.status NOT IN ('cancelado', 'erro')
        ) THEN
            RAISE EXCEPTION 'BLOQUEIO_DUPLICIDADE_CNAB: Item % (%) já possui remessa CNAB ativa vinculada.',
                v_item_origem_id, v_item_origem_tipo;
        END IF;

        -- Validação por modalidade com checagem obrigatória de existência (Fail-Closed)
        IF v_item_origem_tipo = 'FATURA' THEN
            SELECT e.is_teste INTO v_item_is_teste
            FROM public.faturas f
            JOIN public.empresas e ON e.id = f.empresa_id AND e.tenant_id = v_tenant_id
            WHERE f.id = v_item_origem_id 
              AND f.tenant_id = v_tenant_id 
              AND f.empresa_id = p_empresa_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha de Integridade: Fatura % não existe, pertence a outra empresa ou outro tenant.', v_item_origem_id;
            END IF;

            IF v_item_is_teste IS NULL OR v_item_is_teste IS DISTINCT FROM v_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_SEGURANCA_CNAB: Fatura % possui classificação de ambiente incompatível com a remessa (%).',
                    v_item_origem_id, v_modo;
            END IF;

        ELSIF v_item_origem_tipo = 'CLT' THEN
            SELECT c.is_teste INTO v_item_is_teste
            FROM public.rh_financeiro_lote_itens rli
            JOIN public.colaboradores c ON c.id = rli.colaborador_id AND c.tenant_id = v_tenant_id
            JOIN public.rh_financeiro_lotes rfl ON rfl.id = rli.lote_id AND rfl.tenant_id = v_tenant_id
            WHERE rli.id = v_item_origem_id 
              AND rli.tenant_id = v_tenant_id
              AND rfl.empresa_id = p_empresa_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha de Integridade: Item CLT % não existe, pertence a outra empresa ou outro tenant.', v_item_origem_id;
            END IF;

            IF v_item_is_teste IS NULL OR v_item_is_teste IS DISTINCT FROM v_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_SEGURANCA_CNAB: Colaborador do item CLT % possui classificação incompatível com a remessa (%).',
                    v_item_origem_id, v_modo;
            END IF;

        ELSIF v_item_origem_tipo = 'INTERMITENTE' THEN
            SELECT c.is_teste, li.lote_fechamento_id INTO v_item_is_teste, v_item_lote_id
            FROM public.lancamentos_intermitentes li
            JOIN public.colaboradores c ON c.id = li.colaborador_id AND c.tenant_id = v_tenant_id
            WHERE li.id = v_item_origem_id 
              AND li.tenant_id = v_tenant_id
              AND li.empresa_id = p_empresa_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento intermitente % não existe, pertence a outra empresa ou outro tenant.', v_item_origem_id;
            END IF;

            IF v_intermitentes_lote_id IS NOT NULL AND v_item_lote_id IS DISTINCT FROM v_intermitentes_lote_id THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento intermitente % pertence ao lote %, divergente da remessa (%).',
                    v_item_origem_id, v_item_lote_id, v_intermitentes_lote_id;
            END IF;

            IF v_item_is_teste IS NULL OR v_item_is_teste IS DISTINCT FROM v_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_SEGURANCA_CNAB: Colaborador do item Intermitente % possui classificação incompatível com a remessa (%).',
                    v_item_origem_id, v_modo;
            END IF;

        ELSIF v_item_origem_tipo IN ('DIARISTA', 'DIARISTAS') THEN
            SELECT e.is_teste, ld.lote_fechamento_id INTO v_item_is_teste, v_item_lote_id
            FROM public.lancamentos_diaristas ld
            JOIN public.empresas e ON e.id = ld.empresa_id AND e.tenant_id = v_tenant_id
            WHERE ld.id = v_item_origem_id 
              AND ld.tenant_id = v_tenant_id
              AND ld.empresa_id = p_empresa_id;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento de diarista % não encontrado para a empresa e tenant.', v_item_origem_id;
            END IF;

            IF v_diaristas_lote_id IS NOT NULL AND v_item_lote_id IS DISTINCT FROM v_diaristas_lote_id THEN
                RAISE EXCEPTION 'Falha de Integridade: Lançamento de diarista % pertence ao lote %, divergente da remessa (%).',
                    v_item_origem_id, v_item_lote_id, v_diaristas_lote_id;
            END IF;

            IF v_item_is_teste IS NULL OR v_item_is_teste IS DISTINCT FROM v_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_SEGURANCA_CNAB: Lançamento de diarista % possui classificação incompatível com a remessa (%).',
                    v_item_origem_id, v_modo;
            END IF;

        ELSE
            RAISE EXCEPTION 'Falha de Integridade: origem_tipo "%" não é reconhecido pelo motor CNAB.', v_item_origem_tipo;
        END IF;
    END LOOP;

    -- 5.9 Conferência Estrita de Totalizadores
    IF v_item_count <> p_total_registros THEN
        RAISE EXCEPTION 'Divergência: Total de registros declarados (%) difere do payload (%)', p_total_registros, v_item_count;
    END IF;

    IF v_item_sum <> p_total_valor THEN
        RAISE EXCEPTION 'Divergência: Valor total declarado (%) difere da soma real dos itens (%)', p_total_valor, v_item_sum;
    END IF;

    -- 5.10 Obtenção Atômica do Próximo Sequencial Bancário (NSA)
    v_sequencial := public.get_next_cnab_sequencial(v_tenant_id, p_conta_bancaria_id, v_banco_codigo);

    -- 5.10.1 Sincronização Estrita de NSA e Prevenção de Divergência Concorrente
    IF v_modo = 'homologacao' THEN
        v_seq_declarado := (regexp_match(v_linhas_arr[13], '^SEQUENCIAL_SIMULADO: ([0-9]+)$'))[1]::INTEGER;
        IF v_seq_declarado IS DISTINCT FROM v_sequencial THEN
            -- Sincronizar o sequencial na linha 13 para garantir correspondência idêntica com o sequencial_arquivo
            p_conteudo_arquivo := regexp_replace(
                p_conteudo_arquivo,
                '(\r?\n)SEQUENCIAL_SIMULADO: [0-9]+(\r?\n)',
                '\1SEQUENCIAL_SIMULADO: ' || lpad(v_sequencial::text, 6, '0') || '\2'
            );
            IF p_nome_arquivo ~ '_SEQ[0-9]{6}\.txt$' THEN
                p_nome_arquivo := regexp_replace(
                    p_nome_arquivo,
                    '_SEQ[0-9]{6}\.txt$',
                    '_SEQ' || lpad(v_sequencial::text, 6, '0') || '.txt'
                );
            END IF;
        END IF;
    END IF;

    -- 5.10.2 Integridade Criptográfica do Hash do Arquivo Persistido
    IF p_conteudo_arquivo IS NOT NULL AND length(p_conteudo_arquivo) > 0 THEN
        -- Recalcular o hash oficial SHA-256 sobre o conteúdo efetivamente registrado
        v_hash_calculado := encode(sha256(convert_to(p_conteudo_arquivo, 'UTF8')), 'hex');
        p_hash_arquivo := v_hash_calculado;
    ELSIF p_hash_arquivo IS NULL OR length(trim(p_hash_arquivo)) = 0 THEN
        RAISE EXCEPTION 'Falha de Integridade: O hash do arquivo CNAB é obrigatório.';
    END IF;

    -- 5.11 Inserção Completa e Atômica da Remessa (Cabeçalho com Chaves Canônicas Preenchidas)
    INSERT INTO public.cnab_remessas_arquivos (
        tenant_id, empresa_id, lote_id, diaristas_lote_id, intermitentes_lote_id,
        conta_bancaria_id, nome_arquivo, conteudo_arquivo, competencia, observacoes,
        sequencial_arquivo, hash_arquivo, total_registros, total_valor,
        modo, status, usuario_geracao, data_geracao,
        banco_codigo, banco_nome
    ) VALUES (
        v_tenant_id, p_empresa_id, p_lote_id, v_diaristas_lote_id, v_intermitentes_lote_id,
        p_conta_bancaria_id, p_nome_arquivo, p_conteudo_arquivo, p_competencia, p_observacoes,
        v_sequencial, p_hash_arquivo, p_total_registros, p_total_valor,
        v_modo, 'gerado', v_user_id, timezone('utc', now()),
        v_banco_codigo, v_banco_nome
    ) RETURNING id INTO v_remessa_id;

    -- 5.12 Inserção dos Itens da Remessa e Transição Homologada de Itens Físicos
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

        -- Transição restrita a entidades com ciclo homologado de conciliação
        IF (v_item->>'origem_tipo') = 'CLT' THEN
             UPDATE public.rh_financeiro_lote_itens
             SET status = 'AGUARDANDO_RETORNO'
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        ELSIF (v_item->>'origem_tipo') = 'FATURA' THEN
             UPDATE public.faturas
             SET status = 'remetida_ao_banco', updated_at = now()
             WHERE id = (v_item->>'origem_id')::UUID 
               AND tenant_id = v_tenant_id;
        END IF;
    END LOOP;

    -- 5.13 Transição Atômica de Status dos Lotes Pai (Dentro da Mesma Transação)
    IF v_intermitentes_lote_id IS NOT NULL THEN
        UPDATE public.intermitentes_lotes_fechamento
        SET status = 'CNAB_GERADO',
            updated_at = now()
        WHERE id = v_intermitentes_lote_id AND tenant_id = v_tenant_id;
    END IF;

    IF v_diaristas_lote_id IS NOT NULL THEN
        UPDATE public.diaristas_lotes_fechamento
        SET status = 'cnab_gerado',
            status_conciliacao = 'aguardando_conciliacao',
            updated_at = now()
        WHERE id = v_diaristas_lote_id AND tenant_id = v_tenant_id;
    END IF;

    IF p_lote_id IS NOT NULL THEN
        UPDATE public.lotes_remessa
        SET status = 'gerado',
            updated_at = now()
        WHERE id = p_lote_id AND tenant_id = v_tenant_id;
    END IF;

    -- 5.14 Registro de Auditoria Bancária
    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, arquivo_id, lote_id, acao, usuario_id,
        usuario_nome, detalhes, ip_address
    ) VALUES (
        v_tenant_id, v_remessa_id, p_lote_id, 'geracao', v_user_id,
        'SISTEMA (RPC)', 
        jsonb_build_object(
            'evento', 'REMESSA_GERADA_COM_BLINDAGEM',
            'banco_codigo', v_banco_codigo,
            'banco_nome', v_banco_nome,
            'modo', v_modo,
            'intermitentes_lote_id', v_intermitentes_lote_id,
            'diaristas_lote_id', v_diaristas_lote_id,
            'registros', p_total_registros,
            'hash', p_hash_arquivo
        ),
        '127.0.0.1'
    );

    RETURN jsonb_build_object(
        'sucesso', true,
        'remessa_id', v_remessa_id,
        'id', v_remessa_id,
        'banco_codigo', v_banco_codigo,
        'sequencial', v_sequencial,
        'nome_arquivo', p_nome_arquivo,
        'hash', p_hash_arquivo,
        'conteudo_arquivo', p_conteudo_arquivo,
        'linhas_afetadas', v_item_count,
        'modo', v_modo
    );
END;
$$;

-- 6. PERMISSÕES DE EXECUÇÃO
REVOKE ALL ON FUNCTION public.rpc_registrar_cnab_remessa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_cnab_remessa TO authenticated;

COMMIT;
