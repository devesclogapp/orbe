-- ==============================================================================
-- MIGRATION PREPARADA: FIX-HML-02 — BLINDAGEM FINANCEIRA, CNAB E ENCERRAMENTO SEGURO
-- Arquivo: 20261013000000_fix_hml_02_blindagem_financeira_e_cnab.sql
-- NOTA DE GOVERNANÇA:
--   Preparada para revisão técnica e homologação controlada.
--   NÃO APLICAR DIRETAMENTE EM PRODUÇÃO SEM AUTORIZAÇÃO FORMAL.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TRIGGER DE DEFESA ANTI-MISTURA: receitas_operacionais_itens
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_anti_mistura_receitas_operacionais_itens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec_empresa_id UUID;
    v_rec_tenant_id UUID;
    v_rec_is_teste BOOLEAN;
    v_item_is_teste BOOLEAN;
    v_item_tenant_id UUID;
BEGIN
    -- Obter a empresa e o ambiente da receita destino
    SELECT r.empresa_id, r.tenant_id, e.is_teste
    INTO v_rec_empresa_id, v_rec_tenant_id, v_rec_is_teste
    FROM public.receitas_operacionais r
    JOIN public.empresas e ON e.id = r.empresa_id
    WHERE r.id = NEW.receita_id;

    IF v_rec_empresa_id IS NULL THEN
        RAISE EXCEPTION 'RECEITA_NOT_FOUND: Receita operacional % não encontrada.', NEW.receita_id;
    END IF;

    -- Validar isolamento de tenant
    IF NEW.tenant_id <> v_rec_tenant_id THEN
        RAISE EXCEPTION 'TENANT_MISMATCH: Tentativa de vincular item de tenant % à receita de tenant %.', NEW.tenant_id, v_rec_tenant_id;
    END IF;

    -- Caso de Operação por Volume
    IF NEW.operacao_id IS NOT NULL THEN
        SELECT op.tenant_id, e.is_teste
        INTO v_item_tenant_id, v_item_is_teste
        FROM public.operacoes_producao op
        JOIN public.empresas e ON e.id = op.empresa_id
        WHERE op.id = NEW.operacao_id;

        IF v_item_tenant_id IS NOT NULL THEN
            IF v_item_tenant_id <> v_rec_tenant_id THEN
                RAISE EXCEPTION 'TENANT_MISMATCH: Operação % pertence a outro tenant.', NEW.operacao_id;
            END IF;

            IF v_item_is_teste IS DISTINCT FROM v_rec_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_ANTI_MISTURA: Não é permitido vincular Operação (%) com classificação de ambiente diferente da Receita (%).',
                    CASE WHEN v_item_is_teste THEN 'HOMOLOGAÇÃO' ELSE 'PRODUÇÃO' END,
                    CASE WHEN v_rec_is_teste THEN 'HOMOLOGAÇÃO' ELSE 'PRODUÇÃO' END;
            END IF;
        END IF;
    END IF;

    -- Caso de Serviço Extra
    IF NEW.servico_extra_id IS NOT NULL THEN
        SELECT se.tenant_id, e.is_teste
        INTO v_item_tenant_id, v_item_is_teste
        FROM public.servicos_extras_operacionais se
        JOIN public.empresas e ON e.id = se.empresa_id
        WHERE se.id = NEW.servico_extra_id;

        IF v_item_tenant_id IS NOT NULL THEN
            IF v_item_tenant_id <> v_rec_tenant_id THEN
                RAISE EXCEPTION 'TENANT_MISMATCH: Serviço extra % pertence a outro tenant.', NEW.servico_extra_id;
            END IF;

            IF v_item_is_teste IS DISTINCT FROM v_rec_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_ANTI_MISTURA: Não é permitido vincular Serviço Extra (%) com classificação de ambiente diferente da Receita (%).',
                    CASE WHEN v_item_is_teste THEN 'HOMOLOGAÇÃO' ELSE 'PRODUÇÃO' END,
                    CASE WHEN v_rec_is_teste THEN 'HOMOLOGAÇÃO' ELSE 'PRODUÇÃO' END;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anti_mistura_receitas_operacionais_itens ON public.receitas_operacionais_itens;
CREATE TRIGGER trg_anti_mistura_receitas_operacionais_itens
BEFORE INSERT OR UPDATE ON public.receitas_operacionais_itens
FOR EACH ROW
EXECUTE FUNCTION public.fn_anti_mistura_receitas_operacionais_itens();

-- ------------------------------------------------------------------------------
-- 2. TRIGGER DE DEFESA ANTI-MISTURA: faturas
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_anti_mistura_faturas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_emp_is_teste BOOLEAN;
    v_colab_is_teste BOOLEAN;
    v_colab_tenant_id UUID;
BEGIN
    SELECT is_teste INTO v_emp_is_teste
    FROM public.empresas
    WHERE id = NEW.empresa_id AND tenant_id = NEW.tenant_id;

    IF v_emp_is_teste IS NULL THEN
        RAISE EXCEPTION 'EMPRESA_NOT_FOUND: Empresa % não encontrada ou não vinculada ao tenant %.', NEW.empresa_id, NEW.tenant_id;
    END IF;

    -- Se a fatura tiver colaborador vinculado (ex: pagamento de diarista)
    IF NEW.colaborador_id IS NOT NULL THEN
        SELECT tenant_id, is_teste INTO v_colab_tenant_id, v_colab_is_teste
        FROM public.colaboradores
        WHERE id = NEW.colaborador_id;

        IF v_colab_tenant_id IS NOT NULL THEN
            IF v_colab_tenant_id <> NEW.tenant_id THEN
                RAISE EXCEPTION 'TENANT_MISMATCH: Colaborador % pertence a outro tenant.', NEW.colaborador_id;
            END IF;

            IF v_colab_is_teste IS DISTINCT FROM v_emp_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_ANTI_MISTURA: Colaborador (%) não pode ter fatura gerada para empresa (%).',
                    CASE WHEN v_colab_is_teste THEN 'HOMOLOGAÇÃO' ELSE 'PRODUÇÃO' END,
                    CASE WHEN v_emp_is_teste THEN 'HOMOLOGAÇÃO' ELSE 'PRODUÇÃO' END;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anti_mistura_faturas ON public.faturas;
CREATE TRIGGER trg_anti_mistura_faturas
BEFORE INSERT OR UPDATE ON public.faturas
FOR EACH ROW
EXECUTE FUNCTION public.fn_anti_mistura_faturas();

-- ------------------------------------------------------------------------------
-- 3. BLINDAGEM DE BACKEND CNAB: rpc_registrar_cnab_remessa (COM INSPEÇÃO DOS ITENS)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_registrar_cnab_remessa(
    p_conta_bancaria_id UUID,
    p_lote_id UUID,
    p_empresa_id UUID,
    p_modo TEXT,
    p_nome_arquivo TEXT,
    p_hash_arquivo TEXT,
    p_total_valor NUMERIC,
    p_total_registros INTEGER,
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
    v_is_teste BOOLEAN;
    v_modo TEXT;
    v_banco_codigo TEXT;
    v_banco_nome TEXT;
    v_remessa_id UUID;
    v_sequencial INTEGER;
    v_item JSONB;
    v_item_count INTEGER := 0;
    v_item_sum NUMERIC := 0;
    v_item_is_teste BOOLEAN;
BEGIN
    -- 1. Obter e validar o usuário e o Tenant
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

    IF v_is_teste IS TRUE THEN
        v_modo := 'homologacao';
    ELSIF v_is_teste IS FALSE THEN
        v_modo := 'producao';
    ELSE
        RAISE EXCEPTION 'Falha de Integridade: Empresa % possui classificação de ambiente indefinida (is_teste is null).', p_empresa_id;
    END IF;

    -- 3. Validar Conta Bancária
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

    -- 4. Validar Identidade e Integridade de Ambiente dos Itens
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
    LOOP
        v_item_count := v_item_count + 1;
        v_item_sum := v_item_sum + (v_item->>'valor')::NUMERIC;

        -- Validação de Contaminação Cruzada nos Itens da Remessa
        IF (v_item->>'origem_tipo') = 'FATURA' THEN
            SELECT e.is_teste INTO v_item_is_teste
            FROM public.faturas f
            JOIN public.empresas e ON e.id = f.empresa_id
            WHERE f.id = (v_item->>'origem_id')::UUID AND f.tenant_id = v_tenant_id;

            IF v_item_is_teste IS NOT NULL AND v_item_is_teste IS DISTINCT FROM v_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_SEGURANCA_CNAB: Item % (origem FATURA) possui classificação de ambiente (%) divergente da remessa (%). Geração abortada.',
                    v_item->>'origem_id',
                    CASE WHEN v_item_is_teste THEN 'HOMOLOGACAO' ELSE 'PRODUCAO' END,
                    v_modo;
            END IF;

        ELSIF (v_item->>'origem_tipo') = 'CLT' THEN
            SELECT c.is_teste INTO v_item_is_teste
            FROM public.rh_financeiro_lote_itens rli
            JOIN public.colaboradores c ON c.id = rli.colaborador_id
            WHERE rli.id = (v_item->>'origem_id')::UUID AND rli.tenant_id = v_tenant_id;

            IF v_item_is_teste IS NOT NULL AND v_item_is_teste IS DISTINCT FROM v_is_teste THEN
                RAISE EXCEPTION 'BLOQUEIO_SEGURANCA_CNAB: Colaborador do item CLT % (%) diverge da classificação da remessa (%). Geração abortada.',
                    v_item->>'origem_id',
                    CASE WHEN v_item_is_teste THEN 'HOMOLOGACAO' ELSE 'PRODUCAO' END,
                    v_modo;
            END IF;
        END IF;
    END LOOP;

    IF v_item_count <> p_total_registros THEN
        RAISE EXCEPTION 'Divergência: Total de registros declarados (%) difere do payload (%)', p_total_registros, v_item_count;
    END IF;

    IF v_item_sum <> p_total_valor THEN
        RAISE EXCEPTION 'Divergência: Valor total declarado (%) difere da soma real dos itens (%)', p_total_valor, v_item_sum;
    END IF;

    -- 5. Obter sequencial da conta pagadora
    v_sequencial := public.get_next_cnab_sequencial(v_tenant_id, p_conta_bancaria_id, v_banco_codigo);

    -- 6. Inserir cnab_remessas_arquivos
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

    -- 7. Inserir itens
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

    -- 8. Auditoria Bancária
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

-- ------------------------------------------------------------------------------
-- 4. RPC DE ENCERRAMENTO LÓGICO SEGURO DE HOMOLOGAÇÃO
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_encerrar_homologacao_empresa(
    p_empresa_id UUID,
    p_justificativa TEXT,
    p_competencia VARCHAR(7) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_user_role TEXT;
    v_empresa RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_closure_note TEXT;
    v_totais JSONB;
    v_cnt_ops INT := 0;
    v_cnt_se INT := 0;
    v_cnt_ce INT := 0;
    v_cnt_dia INT := 0;
    v_cnt_lotes_dia INT := 0;
    v_cnt_lotes_int INT := 0;
    v_cnt_lotes_rh INT := 0;
    v_cnt_rec INT := 0;
    v_cnt_fat INT := 0;
    v_cnt_ccli INT := 0;
    v_cnt_ccol INT := 0;
BEGIN
    -- 1. Validar autenticação
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    v_tenant_id := public.current_tenant_id();
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Tenant indisponível para o contexto.';
    END IF;

    -- Validar perfil administrativo ou financeiro
    SELECT role INTO v_user_role
    FROM public.profiles
    WHERE user_id = v_user_id OR id = v_user_id
    LIMIT 1;

    IF v_user_role IS NULL OR lower(v_user_role) NOT IN ('admin', 'financeiro') THEN
        RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas administradores ou financeiro podem encerrar ciclos de homologação.';
    END IF;

    -- 2. Validar que a empresa pertence ao tenant e é ESTRITAMENTE de teste
    SELECT * INTO v_empresa
    FROM public.empresas
    WHERE id = p_empresa_id AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'EMPRESA_NOT_FOUND: Empresa % não encontrada no tenant atual.', p_empresa_id;
    END IF;

    IF v_empresa.is_teste IS NOT TRUE THEN
        RAISE EXCEPTION 'BLOQUEIO_SEGURANCA: A empresa % (%) é de Produção real. O encerramento seguro é restrito a empresas de homologação (is_teste = true).',
            v_empresa.nome, p_empresa_id;
    END IF;

    -- 3. Validar justificativa
    IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 10 THEN
        RAISE EXCEPTION 'JUSTIFICATIVA_INVALIDA: A justificativa é obrigatória e deve conter no mínimo 10 caracteres.';
    END IF;

    v_closure_note := ' [ENCERRAMENTO_HOMOLOGACAO: ' || trim(p_justificativa) || ']';

    -- 4. Transições Lógicas (Respeitando Status e Constraints Nativos de Cada Tabela)
    -- 4.1 Operações Produção: Soft Delete Auditável e Status Restrito (Zero Faturamento / DRE / Reativação)
    WITH updated AS (
        UPDATE public.operacoes_producao
        SET deleted_at = v_now,
            deleted_by = v_user_id,
            motivo_exclusao = 'HOMOLOGAÇÃO ENCERRADA: ' || trim(p_justificativa),
            status = 'EM_RESTRICAO',
            status_rh = 'DEVOLVIDO_RH',
            updated_at = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND deleted_at IS NULL
          AND status IN ('RECEBIDO', 'EM_VALIDACAO', 'EM_RESTRICAO', 'AGUARDANDO_FATURAMENTO')
          AND (p_competencia IS NULL OR to_char(data_operacao, 'YYYY-MM') = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_ops FROM updated;

    -- 4.2 Serviços Extras: 'DEVOLVIDO' (Respeita constraints reais de pipeline_status)
    WITH updated AS (
        UPDATE public.servicos_extras_operacionais
        SET pipeline_status = 'DEVOLVIDO',
            justificativa_devolucao = 'HOMOLOGAÇÃO ENCERRADA: ' || trim(p_justificativa),
            status_pagamento = 'CANCELADO',
            atualizado_em = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND pipeline_status IN ('PENDENTE', 'EM_VALIDACAO', 'APROVADO_OPERACAO', 'APROVADO_FINANCEIRO')
          AND (p_competencia IS NULL OR to_char(data, 'YYYY-MM') = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_se FROM updated;

    -- 4.3 Custos Extras: 'REPROVADO' e Soft Delete (Respeita constraints reais de pipeline_status e status_pagamento)
    WITH updated AS (
        UPDATE public.custos_extras_operacionais
        SET pipeline_status = 'REPROVADO',
            status_pagamento = 'CANCELADO',
            deleted_at = v_now,
            observacoes = coalesce(observacoes, '') || v_closure_note,
            atualizado_em = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND deleted_at IS NULL
          AND pipeline_status IN ('RECEBIDO', 'EM_VALIDACAO', 'APROVADO_OPERACAO')
          AND (p_competencia IS NULL OR to_char(data, 'YYYY-MM') = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_ce FROM updated;

    -- 4.4 Lançamentos Diaristas: 'CANCELADO'
    WITH updated AS (
        UPDATE public.lancamentos_diaristas
        SET status = 'CANCELADO'
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status IN ('PENDENTE', 'EM_ABERTO', 'VALIDADO_RH', 'AGUARDANDO_PAGAMENTO')
          AND (p_competencia IS NULL OR to_char(data_lancamento, 'YYYY-MM') = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_dia FROM updated;

    -- 4.5 Lotes Diaristas: 'CANCELADO'
    WITH updated AS (
        UPDATE public.diaristas_lotes_fechamento
        SET status = 'CANCELADO',
            updated_at = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status IN ('ABERTO', 'AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'AGUARDANDO_PAGAMENTO', 'ENVIADO_FINANCEIRO')
          AND (p_competencia IS NULL OR mes_referencia = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_lotes_dia FROM updated;

    -- 4.6 Lotes Intermitentes: 'CANCELADO' (Coluna real de competência = 'competencia')
    WITH updated AS (
        UPDATE public.intermitentes_lotes_fechamento
        SET status = 'CANCELADO',
            updated_at = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status IN ('ABERTO', 'AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'AGUARDANDO_PAGAMENTO', 'ENVIADO_FINANCEIRO')
          AND (p_competencia IS NULL OR competencia = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_lotes_int FROM updated;

    -- 4.7 Lotes RH: 'CANCELADO'
    WITH updated AS (
        UPDATE public.rh_financeiro_lotes
        SET status = 'CANCELADO',
            updated_at = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status IN ('AGUARDANDO_FINANCEIRO', 'EM_ANALISE_FINANCEIRA', 'AGUARDANDO_PAGAMENTO')
          AND (p_competencia IS NULL OR competencia = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_lotes_rh FROM updated;

    -- 4.8 Receitas Operacionais: 'cancelado'
    WITH updated AS (
        UPDATE public.receitas_operacionais
        SET status = 'cancelado',
            observacao = coalesce(observacao, '') || v_closure_note,
            updated_at = v_now
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status IN ('aguardando_fechamento', 'pendente_cobranca', 'cobranca_gerada', 'cobranca_enviada', 'pendente_recebimento')
          AND (p_competencia IS NULL OR competencia = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_rec FROM updated;

    -- 4.9 Faturas: 'cancelada'
    WITH updated AS (
        UPDATE public.faturas
        SET status = 'cancelada',
            motivo_rejeicao = 'HOMOLOGAÇÃO ENCERRADA: ' || trim(p_justificativa)
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status = 'pendente'
          AND (p_competencia IS NULL OR competencia = p_competencia)
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_fat FROM updated;

    -- 4.10 Consolidados Cliente: 'cancelado'
    WITH updated AS (
        UPDATE public.financeiro_consolidados_cliente
        SET status = 'cancelado'
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status = 'pendente'
          AND (p_competencia IS NULL OR competencia = p_competencia || '-01')
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_ccli FROM updated;

    -- 4.11 Consolidados Colaborador: 'cancelado'
    WITH updated AS (
        UPDATE public.financeiro_consolidados_colaborador
        SET status = 'cancelado'
        WHERE empresa_id = p_empresa_id
          AND tenant_id = v_tenant_id
          AND status = 'pendente'
          AND (p_competencia IS NULL OR competencia = p_competencia || '-01')
        RETURNING id
    )
    SELECT count(*) INTO v_cnt_ccol FROM updated;

    -- 5. Registrar Auditoria
    v_totais := jsonb_build_object(
        'operacoesProducao', v_cnt_ops,
        'servicosExtras', v_cnt_se,
        'custosExtras', v_cnt_ce,
        'lancamentosDiaristas', v_cnt_dia,
        'lotesDiaristas', v_cnt_lotes_dia,
        'lotesIntermitentes', v_cnt_lotes_int,
        'lotesRh', v_cnt_lotes_rh,
        'receitasOperacionais', v_cnt_rec,
        'faturas', v_cnt_fat,
        'consolidadosCliente', v_cnt_ccli,
        'consolidadosColaborador', v_cnt_ccol
    );

    INSERT INTO public.cnab_auditoria_bancaria (
        tenant_id, acao, usuario_id, usuario_nome, detalhes
    ) VALUES (
        v_tenant_id, 'homologacao', v_user_id,
        'Operador (RPC Encerramento)',
        jsonb_build_object(
            'evento', 'ENCERRAMENTO_LOGICO_HOMOLOGACAO',
            'empresa_id', p_empresa_id,
            'empresa_nome', v_empresa.nome,
            'justificativa', trim(p_justificativa),
            'competencia', p_competencia,
            'totais', v_totais,
            'timestamp', v_now
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'empresaId', p_empresa_id,
        'empresaNome', v_empresa.nome,
        'usuarioId', v_user_id,
        'dataEncerramento', v_now,
        'justificativa', trim(p_justificativa),
        'competencia', p_competencia,
        'totaisEncerrados', v_totais
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_encerrar_homologacao_empresa FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_encerrar_homologacao_empresa TO authenticated;
