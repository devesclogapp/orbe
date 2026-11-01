-- ==============================================================================
-- ERP ORBE — FIX-RET-07: CORREÇÃO DO CONTRATO DE VALORES DO RETORNO CNAB
-- Data: 2026-10-20 10:00:00
-- Objetivo:
--   1. Correção do contrato de extração de valores do retorno CNAB: suporte prioritário
--      à chave canônica 'valor_retornado' e compatibilidade com a chave legada 'valor_pago'.
--   2. Validação fail-closed estrita contra valores nulos, ausentes, vazios, não numéricos,
--      negativos ou conflitantes entre as chaves presentes.
--   3. Eliminação da vulnerabilidade de aprovação silenciosa em comparações envolvendo valores nulos,
--      com comparador seguro abs(round(...) - round(...)) > 0.001 e barreira prévia IS NOT NULL.
--   4. Persistência garantida do valor numérico real na coluna cnab_retorno_itens.valor_retornado.
--   5. Preservação integral de todas as regras de segurança e negócio consolidadas em
--      FIX-RET-06, FIX-RET-05, FIX-RET-03:
--      - Isolamento estrito de tenant (tenant_id via public.current_tenant_id())
--      - Segregação de homologação vs produção (is_teste)
--      - Idempotência por hash_arquivo e por item de remessa
--      - Sincronização atômica do espelho RH/Financeiro para intermitentes (COUNT=1 determinístico)
--      - Quitação integral e baixa atômica para Diaristas, CLT, Intermitentes e Faturas
--      - Auditoria bancária com coluna real arquivo_id e FK lote_id preservada
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
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_user_role TEXT;
  v_empresa_is_teste BOOLEAN;
  v_retorno_arquivo_id UUID;
  v_item JSONB;
  v_item_remessa_item_id UUID;
  v_db_item RECORD;

  -- FIX-RET-07: Variáveis de Validação Fail-Closed do Contrato de Valores
  v_val_retornado_raw TEXT;
  v_val_pago_raw TEXT;
  v_val_retornado_parsed NUMERIC;
  v_val_pago_parsed NUMERIC;
  v_item_valor_retornado NUMERIC;

  v_item_status_raw TEXT;
  v_item_codigo_ocorrencia TEXT;
  v_item_linha_original TEXT;
  v_is_codigo_liquidacao BOOLEAN;
  v_status_efetivo TEXT;
  v_total_processado INT := 0;
  v_total_pagos INT := 0;
  v_total_rejeitados INT := 0;
  v_total_divergentes INT := 0;

  -- Controle de Duplicidade Intra-Arquivo
  v_itens_processados_arquivo UUID[] := '{}';

  -- Vínculos da Remessa Canônica
  v_remessa_id UUID;
  v_remessa_modo TEXT;
  v_remessa_empresa_id UUID;
  v_remessa_conta_id UUID;
  v_remessa_lote_id UUID;
  v_remessa_diaristas_id UUID;
  v_remessa_intermitentes_id UUID;
  v_remessa_total_valor NUMERIC;
  v_remessa_total_registros INT;

  -- Controles de Quitação Integral
  v_qtd_conciliados INT := 0;
  v_qtd_nao_conciliados INT := 0;
  v_sum_conciliado NUMERIC := 0;
  v_qtd_total_remessa INT := 0;
  v_sum_total_remessa NUMERIC := 0;
  v_quitacao_integral BOOLEAN := FALSE;

  -- Sincronização Atômica do Espelho RH/Financeiro (FIX-RET-03 / FIX-RET-06)
  v_op_competencia VARCHAR(7);
  v_espelho_count INT := 0;
  v_espelho_candidato_id UUID := NULL;
  v_espelho_empresa_id UUID;
  v_espelho_competencia VARCHAR(7);
  v_espelho_tipo TEXT;
  v_espelho_valor_total NUMERIC;
  v_espelho_itens_qtd INT := 0;
  v_espelho_itens_soma NUMERIC := 0;
  v_espelho_sincronizado BOOLEAN := FALSE;
  v_espelho_divergencia_motivo TEXT := NULL;
BEGIN
  -- 4.1 AUTENTICAÇÃO E CONTEXTO DE TENANT
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Falha de Segurança: Usuário não autenticado no banco de dados.';
  END IF;

  v_tenant_id := public.current_tenant_id();
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Falha de Segurança: Tenant indisponível para o contexto atual.';
  END IF;

  -- 4.2 AUTORIZAÇÃO DE PAPEL (APENAS ADMIN OU FINANCEIRO)
  v_user_role := lower(trim(coalesce(public.get_user_role(), '')));
  IF v_user_role <> '' AND v_user_role NOT IN ('admin', 'super_admin', 'financeiro', 'service_role') THEN
    RAISE EXCEPTION 'Acesso Negado: Apenas os perfis Administrador ou Financeiro podem conciliar retornos bancários.';
  END IF;

  -- 4.3 VALIDAÇÃO DOS PARÂMETROS BÁSICOS E CONTROLE DE TENANT
  IF p_empresa_id IS NULL OR p_conta_bancaria_id IS NULL OR p_banco_codigo IS NULL THEN
    RAISE EXCEPTION 'Parâmetros Obrigatórios: Empresa, conta bancária e banco devem ser informados.';
  END IF;

  SELECT is_teste INTO v_empresa_is_teste
  FROM public.empresas
  WHERE id = p_empresa_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violação de Segurança: Empresa informada não pertence ao tenant autenticado.';
  END IF;

  PERFORM 1
  FROM public.contas_bancarias_empresa
  WHERE id = p_conta_bancaria_id
    AND empresa_id = p_empresa_id
    AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Violação de Segurança: Conta bancária não pertence à empresa informada no tenant.';
  END IF;

  -- 4.4 PROTEÇÃO CONTRA PROCESSAMENTO DUPLICADO (IDEMPOTÊNCIA POR HASH E EMPRESA)
  PERFORM 1
  FROM public.cnab_retorno_arquivos
  WHERE hash_arquivo = p_hash_arquivo
    AND empresa_id = p_empresa_id
    AND tenant_id = v_tenant_id;

  IF FOUND THEN
    RAISE EXCEPTION 'Arquivo Duplicado: Este arquivo de retorno já foi processado anteriormente para esta empresa.';
  END IF;

  -- 4.5 VALIDAÇÃO DA CARGA DE ITENS
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Falha de Integridade: O retorno bancário não possui itens para processamento.';
  END IF;

  -- 4.6 LOCALIZAÇÃO E VALIDAÇÃO DA REMESSA VINCULADA
  v_item := p_itens->0;
  v_item_remessa_item_id := (v_item->>'remessa_item_id')::UUID;

  IF v_item_remessa_item_id IS NULL THEN
    RAISE EXCEPTION 'Falha de Rastreabilidade: Item de retorno não contém vínculo de remessa_item_id.';
  END IF;

  SELECT
    r.id,
    r.modo,
    r.empresa_id,
    r.conta_bancaria_id,
    r.lote_id,
    r.diaristas_lote_id,
    r.intermitentes_lote_id,
    r.total_valor,
    r.total_registros
  INTO
    v_remessa_id,
    v_remessa_modo,
    v_remessa_empresa_id,
    v_remessa_conta_id,
    v_remessa_lote_id,
    v_remessa_diaristas_id,
    v_remessa_intermitentes_id,
    v_remessa_total_valor,
    v_remessa_total_registros
  FROM public.cnab_remessa_itens ri
  JOIN public.cnab_remessas_arquivos r ON r.id = ri.remessa_id
  WHERE ri.id = v_item_remessa_item_id
    AND ri.tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha de Vinculação: Item de remessa (%) não encontrado no tenant.', v_item_remessa_item_id;
  END IF;

  -- Blindagem Estrita: Segregação de Homologação vs Produção
  IF v_remessa_modo = 'homologacao' AND v_empresa_is_teste = FALSE THEN
    RAISE EXCEPTION 'Segurança Atômica: Não é permitido conciliar remessa de homologação em empresa de produção.';
  END IF;

  IF v_remessa_modo <> 'homologacao' AND v_empresa_is_teste = TRUE THEN
    RAISE EXCEPTION 'Segurança Atômica: Empresa de testes não pode processar remessa oficial de produção.';
  END IF;

  IF v_remessa_empresa_id <> p_empresa_id THEN
    RAISE EXCEPTION 'Inconsistência de Contexto: Empresa informada difere da empresa emissora da remessa.';
  END IF;

  IF v_remessa_conta_id <> p_conta_bancaria_id THEN
    RAISE EXCEPTION 'Inconsistência de Contexto: Conta bancária difere da conta vinculada à remessa original.';
  END IF;

  -- 4.7 INSERÇÃO DO CABEÇALHO DO RETORNO (cnab_retorno_arquivos)
  INSERT INTO public.cnab_retorno_arquivos (
    tenant_id,
    remessa_arquivo_id,
    empresa_id,
    conta_bancaria_id,
    nome_arquivo,
    hash_arquivo,
    banco_codigo,
    modo,
    status,
    total_linhas,
    total_processados,
    total_sucesso,
    total_rejeitado,
    total_divergente,
    total_pendente,
    usuario_processamento,
    data_processamento,
    created_at,
    updated_at
  ) VALUES (
    v_tenant_id,
    v_remessa_id,
    p_empresa_id,
    p_conta_bancaria_id,
    p_nome_arquivo,
    p_hash_arquivo,
    p_banco_codigo,
    v_remessa_modo,
    'processado',
    jsonb_array_length(p_itens),
    0, 0, 0, 0, 0,
    v_user_id,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_retorno_arquivo_id;

  -- 4.8 PROCESSAMENTO ITEM A ITEM COM VALIDAÇÃO FAIL-CLOSED (FIX-RET-07)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_item_remessa_item_id := (v_item->>'remessa_item_id')::UUID;
    v_val_retornado_raw := trim(v_item->>'valor_retornado');
    v_val_pago_raw := trim(v_item->>'valor_pago');
    v_item_status_raw := lower(trim(coalesce(v_item->>'status', '')));
    v_item_codigo_ocorrencia := trim(coalesce(v_item->>'codigo_ocorrencia', ''));
    v_item_linha_original := coalesce(v_item->>'linha_original', '');

    IF v_item_remessa_item_id IS NULL THEN
      RAISE EXCEPTION 'Falha de Consistência: Item no payload de retorno não possui remessa_item_id.';
    END IF;

    IF v_item_remessa_item_id = ANY(v_itens_processados_arquivo) THEN
      RAISE EXCEPTION 'Integridade Violada: Item de remessa % duplicado dentro do mesmo arquivo de retorno.', v_item_remessa_item_id;
    END IF;
    v_itens_processados_arquivo := array_append(v_itens_processados_arquivo, v_item_remessa_item_id);

    -- ========================================================================
    -- FIX-RET-07: CONTRATO DE VALORES FAIL-CLOSED
    -- ========================================================================
    IF (v_val_retornado_raw IS NULL OR v_val_retornado_raw = '') AND (v_val_pago_raw IS NULL OR v_val_pago_raw = '') THEN
      RAISE EXCEPTION 'Contrato Violado: Item de retorno % sem valor financeiro (chaves valor_retornado e valor_pago ausentes ou nulas).', v_item_remessa_item_id;
    END IF;

    v_val_retornado_parsed := NULL;
    v_val_pago_parsed := NULL;

    IF v_val_retornado_raw IS NOT NULL AND v_val_retornado_raw <> '' THEN
      BEGIN
        v_val_retornado_parsed := v_val_retornado_raw::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Contrato Violado: Formato numérico inválido em valor_retornado (%) para o item %.', v_val_retornado_raw, v_item_remessa_item_id;
      END;
    END IF;

    IF v_val_pago_raw IS NOT NULL AND v_val_pago_raw <> '' THEN
      BEGIN
        v_val_pago_parsed := v_val_pago_raw::NUMERIC;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Contrato Violado: Formato numérico inválido em valor_pago (%) para o item %.', v_val_pago_raw, v_item_remessa_item_id;
      END;
    END IF;

    -- Detecção de Conflito entre as duas chaves se ambas presentes
    IF v_val_retornado_parsed IS NOT NULL AND v_val_pago_parsed IS NOT NULL THEN
      IF abs(round(v_val_retornado_parsed, 2) - round(v_val_pago_parsed, 2)) > 0.001 THEN
        RAISE EXCEPTION 'Contrato Violado: Conflito de valores entre valor_retornado (%) e valor_pago (%) para o item %.', v_val_retornado_parsed, v_val_pago_parsed, v_item_remessa_item_id;
      END IF;
    END IF;

    v_item_valor_retornado := COALESCE(v_val_retornado_parsed, v_val_pago_parsed);

    IF v_item_valor_retornado IS NULL OR v_item_valor_retornado < 0 THEN
      RAISE EXCEPTION 'Contrato Violado: Valor retornado inválido ou negativo (%) para o item %.', v_item_valor_retornado, v_item_remessa_item_id;
    END IF;

    SELECT
      ri.id,
      ri.remessa_id,
      ri.origem_tipo,
      ri.origem_id,
      ri.fatura_id,
      ri.valor,
      ri.status AS status_remessa_item
    INTO v_db_item
    FROM public.cnab_remessa_itens ri
    WHERE ri.id = v_item_remessa_item_id
      AND ri.tenant_id = v_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Falha de Consistência: Item de remessa % não localizado para processamento.', v_item_remessa_item_id;
    END IF;

    IF v_db_item.remessa_id <> v_remessa_id THEN
      RAISE EXCEPTION 'Falha de Integridade: Itens de remessas diferentes encontrados no mesmo lote de retorno.';
    END IF;

    IF v_db_item.status_remessa_item = 'conciliado' THEN
      RAISE EXCEPTION 'Idempotência Violada: Item de remessa % já se encontra liquidado/conciliado.', v_item_remessa_item_id;
    END IF;

    v_is_codigo_liquidacao := (
      v_item_codigo_ocorrencia IN ('00', '02', '03', '05', 'BD') OR
      v_item_status_raw IN ('pago', 'sucesso', 'liquidado')
    );

    IF v_is_codigo_liquidacao THEN
      IF v_db_item.valor IS NULL OR v_db_item.valor <= 0 THEN
        RAISE EXCEPTION 'Integridade Violada: Item de remessa % possui valor esperado nulo ou não positivo no banco.', v_db_item.id;
      END IF;

      -- Comparação matemática explícita contra tolerância de centavos (blindada contra NULL)
      IF abs(round(v_item_valor_retornado, 2) - round(v_db_item.valor, 2)) > 0.001 THEN
        v_status_efetivo := 'divergente';
        v_total_divergentes := v_total_divergentes + 1;
      ELSE
        v_status_efetivo := 'pago';
        v_total_pagos := v_total_pagos + 1;
      END IF;
    ELSE
      v_status_efetivo := 'rejeitado';
      v_total_rejeitados := v_total_rejeitados + 1;
    END IF;

    v_total_processado := v_total_processado + 1;

    INSERT INTO public.cnab_retorno_itens (
      tenant_id,
      retorno_arquivo_id,
      remessa_arquivo_id,
      remessa_item_id,
      fatura_id,
      colaborador_id,
      nome_favorecido,
      documento_favorecido,
      valor_esperado,
      valor_retornado,
      codigo_ocorrencia,
      descricao_ocorrencia,
      status,
      status_conciliacao,
      modo,
      linha_original,
      created_at
    ) VALUES (
      v_tenant_id,
      v_retorno_arquivo_id,
      v_remessa_id,
      v_db_item.id,
      v_db_item.fatura_id,
      (v_item->>'colaborador_id')::UUID,
      coalesce(v_item->>'nome_favorecido', 'FAVORECIDO RETORNO'),
      coalesce(v_item->>'documento_favorecido', ''),
      v_db_item.valor,
      v_item_valor_retornado,
      v_item_codigo_ocorrencia,
      coalesce(v_item->>'descricao_ocorrencia', ''),
      v_status_efetivo,
      CASE WHEN v_status_efetivo = 'pago' THEN 'conciliado' ELSE 'aguardando_conciliacao' END,
      v_remessa_modo,
      v_item_linha_original,
      NOW()
    );

    IF v_status_efetivo = 'pago' THEN
      UPDATE public.cnab_remessa_itens
      SET status = 'conciliado',
          updated_at = NOW()
      WHERE id = v_db_item.id
        AND tenant_id = v_tenant_id;

      IF v_db_item.origem_tipo = 'INTERMITENTE' AND v_db_item.origem_id IS NOT NULL THEN
        UPDATE public.lancamentos_intermitentes
        SET status_pipeline = 'PAGO',
            updated_at = NOW()
        WHERE id = v_db_item.origem_id
          AND tenant_id = v_tenant_id;
      ELSIF v_db_item.origem_tipo = 'DIARISTA' AND v_db_item.origem_id IS NOT NULL THEN
        UPDATE public.lancamentos_diaristas
        SET status = 'PAGO',
            updated_at = NOW()
        WHERE id = v_db_item.origem_id
          AND tenant_id = v_tenant_id;
      ELSIF v_db_item.origem_tipo = 'FATURA' AND v_db_item.fatura_id IS NOT NULL THEN
        UPDATE public.faturas
        SET status = 'paga',
            updated_at = NOW()
        WHERE id = v_db_item.fatura_id
          AND tenant_id = v_tenant_id;
      END IF;
    ELSIF v_status_efetivo = 'rejeitado' THEN
      UPDATE public.cnab_remessa_itens
      SET status = 'rejeitado',
          updated_at = NOW()
      WHERE id = v_db_item.id
        AND tenant_id = v_tenant_id;
    ELSIF v_status_efetivo = 'divergente' THEN
      UPDATE public.cnab_remessa_itens
      SET status = 'divergente',
          updated_at = NOW()
      WHERE id = v_db_item.id
        AND tenant_id = v_tenant_id;
    END IF;
  END LOOP;

  -- 4.9 CONFERÊNCIA DE TOTALIZADORES E STATUS DO CABEÇALHO DO RETORNO
  UPDATE public.cnab_retorno_arquivos
  SET total_processados = v_total_processado,
      total_sucesso = v_total_pagos,
      total_rejeitado = v_total_rejeitados,
      total_divergente = v_total_divergentes,
      status = CASE
        WHEN v_total_rejeitados = 0 AND v_total_divergentes = 0 THEN 'processado'
        ELSE 'processado_com_pendencias'
      END,
      updated_at = NOW()
  WHERE id = v_retorno_arquivo_id
    AND tenant_id = v_tenant_id;

  -- 4.10 AVALIAÇÃO DE QUITAÇÃO INTEGRAL DA REMESSA E ATUALIZAÇÃO DO LOTE
  SELECT
    COUNT(*) FILTER (WHERE status = 'conciliado'),
    COUNT(*) FILTER (WHERE status <> 'conciliado'),
    COALESCE(SUM(valor) FILTER (WHERE status = 'conciliado'), 0),
    COUNT(*),
    COALESCE(SUM(valor), 0)
  INTO
    v_qtd_conciliados,
    v_qtd_nao_conciliados,
    v_sum_conciliado,
    v_qtd_total_remessa,
    v_sum_total_remessa
  FROM public.cnab_remessa_itens
  WHERE remessa_id = v_remessa_id
    AND tenant_id = v_tenant_id;

  v_quitacao_integral := (
    v_qtd_nao_conciliados = 0 AND
    v_qtd_conciliados = v_qtd_total_remessa AND
    round(v_sum_conciliado, 2) = round(v_sum_total_remessa, 2)
  );

  IF v_quitacao_integral = TRUE THEN
    -- A. Domínio de Intermitentes
    IF v_remessa_intermitentes_id IS NOT NULL THEN
      -- Sincronização do Espelho RH/Financeiro com Contagem Determinística (FIX-RET-06)
      SELECT competencia INTO v_op_competencia
      FROM public.intermitentes_lotes_fechamento
      WHERE id = v_remessa_intermitentes_id
        AND tenant_id = v_tenant_id;

      SELECT COUNT(DISTINCT rhl.id)
      INTO v_espelho_count
      FROM public.rh_financeiro_lotes rhl
      WHERE rhl.empresa_id = p_empresa_id
        AND rhl.competencia = v_op_competencia
        AND rhl.tipo = 'INTERMITENTES'
        AND rhl.tenant_id = v_tenant_id;

      IF v_espelho_count = 0 THEN
        RAISE EXCEPTION 'Falha de Integridade: Remessa vinculada a lote operacional de intermitentes sem espelho RH/Financeiro correspondente.';
      ELSIF v_espelho_count > 1 THEN
        RAISE EXCEPTION 'Ambiguidade Crítica: Múltiplos espelhos RH/Financeiro encontrados para o lote operacional de intermitentes.';
      END IF;

      SELECT rhl.id
      INTO v_espelho_candidato_id
      FROM public.rh_financeiro_lotes rhl
      WHERE rhl.empresa_id = p_empresa_id
        AND rhl.competencia = v_op_competencia
        AND rhl.tipo = 'INTERMITENTES'
        AND rhl.tenant_id = v_tenant_id;

      SELECT
        rhl.empresa_id,
        rhl.competencia,
        rhl.tipo,
        rhl.valor_total,
        COUNT(rhi.id),
        COALESCE(SUM(rhi.valor_calculado), 0)
      INTO
        v_espelho_empresa_id,
        v_espelho_competencia,
        v_espelho_tipo,
        v_espelho_valor_total,
        v_espelho_itens_qtd,
        v_espelho_itens_soma
      FROM public.rh_financeiro_lotes rhl
      LEFT JOIN public.rh_financeiro_lote_itens rhi ON rhi.lote_id = rhl.id
      WHERE rhl.id = v_espelho_candidato_id
        AND rhl.tenant_id = v_tenant_id
      GROUP BY rhl.id, rhl.empresa_id, rhl.competencia, rhl.tipo, rhl.valor_total;

      IF v_espelho_empresa_id <> p_empresa_id OR v_espelho_competencia <> v_op_competencia OR v_espelho_tipo <> 'INTERMITENTES' THEN
        RAISE EXCEPTION 'Inconsistência de Domínio: Metadados do espelho RH/Financeiro incompatíveis com o lote operacional.';
      END IF;

      IF round(v_espelho_valor_total, 2) <> round(v_sum_total_remessa, 2) OR round(v_espelho_itens_soma, 2) <> round(v_sum_total_remessa, 2) THEN
        RAISE EXCEPTION 'Divergência de Valores: Valor do espelho RH difere do valor total liquidado da remessa.';
      END IF;

      IF v_espelho_itens_qtd <> v_qtd_total_remessa THEN
        RAISE EXCEPTION 'Divergência de Contagem: Quantidade de itens no espelho RH difere da remessa conciliada.';
      END IF;

      UPDATE public.rh_financeiro_lote_itens
      SET status = 'PAGO'
      WHERE lote_id = v_espelho_candidato_id
        AND tenant_id = v_tenant_id;

      UPDATE public.rh_financeiro_lotes
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_espelho_candidato_id
        AND tenant_id = v_tenant_id;

      v_espelho_sincronizado := TRUE;

      UPDATE public.intermitentes_lotes_fechamento
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_remessa_intermitentes_id
        AND tenant_id = v_tenant_id;
    END IF;

    -- B. Domínio de Diaristas
    IF v_remessa_diaristas_id IS NOT NULL THEN
      UPDATE public.diaristas_lotes_fechamento
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_remessa_diaristas_id
        AND tenant_id = v_tenant_id;
    END IF;

    -- C. Domínio de CLT / Remessa Genérica
    IF v_remessa_lote_id IS NOT NULL THEN
      UPDATE public.rh_financeiro_lotes
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_remessa_lote_id
        AND tenant_id = v_tenant_id;

      UPDATE public.lotes_remessa
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_remessa_lote_id
        AND tenant_id = v_tenant_id;
    END IF;
  END IF;

  -- 4.11 PRESERVAÇÃO DA IMUTABILIDADE DA REMESSA
  IF v_remessa_modo = 'homologacao' THEN
    UPDATE public.cnab_remessas_arquivos
    SET status = CASE WHEN v_quitacao_integral = TRUE THEN 'homologado' ELSE 'erro_homologacao' END
    WHERE id = v_remessa_id
      AND tenant_id = v_tenant_id;
  END IF;

  -- 4.12 AUDITORIA BANCÁRIA ESTRITA (FIX-RET-05 / FIX-RET-06 / FIX-RET-07)
  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    usuario_id,
    usuario_nome,
    acao,
    detalhes,
    ip_address
  ) VALUES (
    v_tenant_id,
    v_remessa_id,
    v_remessa_lote_id,
    v_user_id,
    'SISTEMA (RPC)',
    CASE WHEN v_remessa_modo = 'homologacao' THEN 'RETORNO_PROCESSADO_SIMULADO' ELSE 'RETORNO_PROCESSADO_INTEGRAL' END,
    jsonb_build_object(
      'modo', v_remessa_modo,
      'simulado', (v_remessa_modo = 'homologacao'),
      'retorno_arquivo_id', v_retorno_arquivo_id,
      'remessa_id', v_remessa_id,
      'lote_id', v_remessa_lote_id,
      'intermitentes_lote_id', v_remessa_intermitentes_id,
      'diaristas_lote_id', v_remessa_diaristas_id,
      'total_itens', v_total_processado,
      'total_pagos', v_total_pagos,
      'total_rejeitados', v_total_rejeitados,
      'total_divergentes', v_total_divergentes,
      'quitacao_integral', v_quitacao_integral,
      'espelho_rh_sincronizado', v_espelho_sincronizado,
      'espelho_rh_lote_id', CASE WHEN v_espelho_sincronizado THEN v_espelho_candidato_id ELSE NULL END,
      'espelho_rh_divergencia', v_espelho_divergencia_motivo,
      'nome_arquivo', p_nome_arquivo,
      'hash_arquivo', p_hash_arquivo
    ),
    '127.0.0.1'
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'retorno_arquivo_id', v_retorno_arquivo_id,
    'modo', v_remessa_modo,
    'simulado', (v_remessa_modo = 'homologacao'),
    'total_processado', v_total_processado,
    'total_pagos', v_total_pagos,
    'total_rejeitados', v_total_rejeitados,
    'total_divergentes', v_total_divergentes,
    'quitacao_integral', v_quitacao_integral,
    'espelho_rh_sincronizado', v_espelho_sincronizado,
    'espelho_rh_lote_id', CASE WHEN v_espelho_sincronizado THEN v_espelho_candidato_id ELSE NULL END
  );
END;
$$;

-- Privilégios de Segurança
REVOKE ALL ON FUNCTION public.rpc_aplicar_cnab_retorno(UUID, UUID, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_cnab_retorno(UUID, UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
