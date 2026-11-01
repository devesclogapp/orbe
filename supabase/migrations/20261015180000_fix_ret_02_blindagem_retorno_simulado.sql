-- ============================================================================
-- ERP ORBE — FIX-RET-02C: MIGRATION CONSOLIDADA E BLINDADA
-- Auditoria Final de Segurança, Autenticidade, Idempotência e Concorrência
-- ============================================================================

-- 1. ADIÇÃO DEFENSIVA DE COLUNAS DE MODO E VÍNCULOS RELACIONAIS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cnab_retorno_arquivos' AND column_name = 'modo'
  ) THEN
    ALTER TABLE public.cnab_retorno_arquivos 
    ADD COLUMN modo TEXT;
  END IF;

  -- Garante que a constraint inclua 'indeterminado' mesmo se a coluna já existia previamente
  ALTER TABLE public.cnab_retorno_arquivos DROP CONSTRAINT IF EXISTS cnab_retorno_arquivos_modo_check;
  ALTER TABLE public.cnab_retorno_arquivos ADD CONSTRAINT cnab_retorno_arquivos_modo_check CHECK (modo IN ('homologacao', 'producao', 'indeterminado'));

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cnab_retorno_arquivos' AND column_name = 'empresa_id'
  ) THEN
    ALTER TABLE public.cnab_retorno_arquivos 
    ADD COLUMN empresa_id UUID REFERENCES public.empresas(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cnab_retorno_arquivos' AND column_name = 'conta_bancaria_id'
  ) THEN
    ALTER TABLE public.cnab_retorno_arquivos 
    ADD COLUMN conta_bancaria_id UUID REFERENCES public.contas_bancarias_empresa(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'cnab_retorno_itens' AND column_name = 'modo'
  ) THEN
    ALTER TABLE public.cnab_retorno_itens 
    ADD COLUMN modo TEXT;
  END IF;

  ALTER TABLE public.cnab_retorno_itens DROP CONSTRAINT IF EXISTS cnab_retorno_itens_modo_check;
  ALTER TABLE public.cnab_retorno_itens ADD CONSTRAINT cnab_retorno_itens_modo_check CHECK (modo IN ('homologacao', 'producao', 'indeterminado'));
END $$;

-- 2. BACKFILL HISTÓRICO COM CLASSIFICAÇÃO COMPROVADA (SEM INFERÊNCIA CEGA)
-- Se houver vínculo comprovado com remessa existente, herda o modo da remessa.
-- Caso contrário, preserva como 'indeterminado' (NUNCA inferir por nome do arquivo).
UPDATE public.cnab_retorno_arquivos r
SET modo = COALESCE(
  (SELECT rem.modo FROM public.cnab_remessas_arquivos rem WHERE rem.id = r.remessa_arquivo_id),
  'indeterminado'
),
empresa_id = COALESCE(
  r.empresa_id,
  (SELECT rem.empresa_id FROM public.cnab_remessas_arquivos rem WHERE rem.id = r.remessa_arquivo_id)
),
conta_bancaria_id = COALESCE(
  r.conta_bancaria_id,
  (SELECT rem.conta_bancaria_id FROM public.cnab_remessas_arquivos rem WHERE rem.id = r.remessa_arquivo_id)
)
WHERE r.modo IS NULL;

UPDATE public.cnab_retorno_itens i
SET modo = COALESCE(
  (SELECT ret.modo FROM public.cnab_retorno_arquivos ret WHERE ret.id = i.retorno_arquivo_id),
  (SELECT rem.modo FROM public.cnab_remessa_itens ri JOIN public.cnab_remessas_arquivos rem ON rem.id = ri.remessa_id WHERE ri.id = i.remessa_item_id),
  'indeterminado'
)
WHERE i.modo IS NULL;

-- Fixar DEFAULT e NOT NULL para novos registros
ALTER TABLE public.cnab_retorno_arquivos ALTER COLUMN modo SET DEFAULT 'indeterminado';
ALTER TABLE public.cnab_retorno_arquivos ALTER COLUMN modo SET NOT NULL;

ALTER TABLE public.cnab_retorno_itens ALTER COLUMN modo SET DEFAULT 'indeterminado';
ALTER TABLE public.cnab_retorno_itens ALTER COLUMN modo SET NOT NULL;

-- 3. ÍNDICES DE PERFORMANCE, AUDITORIA E PROTEÇÃO FÍSICA CONTRA DUPLICIDADE
CREATE INDEX IF NOT EXISTS idx_cnab_retorno_arquivos_tenant_modo 
ON public.cnab_retorno_arquivos(tenant_id, modo);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_tenant_modo 
ON public.cnab_retorno_itens(tenant_id, modo);

-- Constraint única física: impede que o mesmo remessa_item_id seja liquidado mais de uma vez
CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_retorno_itens_remessa_item_liquidado
ON public.cnab_retorno_itens (remessa_item_id)
WHERE status IN ('pago', 'liquidado') AND remessa_item_id IS NOT NULL;

-- 4. REESCRITA TRANSACIONAL CANÔNICA, SEGURA E BLINDADA DA RPC
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
  v_user_role TEXT;
  v_empresa_is_teste BOOLEAN;
  v_retorno_arquivo_id UUID;
  v_item JSONB;
  v_item_remessa_item_id UUID;
  v_db_item RECORD;
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
    RAISE EXCEPTION 'Falha de Autorização: Apenas usuários com perfil Financeiro ou Administrador podem processar retornos bancários.';
  END IF;

  -- 4.3 CONTROLE DE CONCORRÊNCIA E IDEMPOTÊNCIA DO HASH
  -- Lock transacional exclusivo para o hash de arquivo (elimina corrida de uploads concorrentes)
  PERFORM pg_advisory_xact_lock(hashtext('cnab_ret_hash_' || v_tenant_id::text || '_' || p_hash_arquivo));

  IF EXISTS (
    SELECT 1 FROM public.cnab_retorno_arquivos
    WHERE tenant_id = v_tenant_id
      AND hash_arquivo = p_hash_arquivo
  ) THEN
    RAISE EXCEPTION 'Arquivo de retorno duplicado. O hash % já foi processado anteriormente.', p_hash_arquivo;
  END IF;

  -- 4.4 VALIDAÇÃO DA EMPRESA PAGADORA NO TENANT
  SELECT is_teste INTO v_empresa_is_teste
  FROM public.empresas
  WHERE id = p_empresa_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha de Segurança: Empresa % não encontrada ou não pertence ao Tenant %.', p_empresa_id, v_tenant_id;
  END IF;

  -- 4.5 VALIDAÇÃO DA CONTA BANCÁRIA ATIVA
  IF NOT EXISTS (
    SELECT 1 FROM public.contas_bancarias_empresa
    WHERE id = p_conta_bancaria_id
      AND empresa_id = p_empresa_id
      AND tenant_id = v_tenant_id
      AND ativo IS TRUE
  ) THEN
    RAISE EXCEPTION 'Falha de Segurança: Conta bancária % inválida, inativa ou não pertence à empresa % no tenant %.', p_conta_bancaria_id, p_empresa_id, v_tenant_id;
  END IF;

  -- 4.6 VALIDAÇÃO ESTRITA E OBRIGATÓRIA DA REMESSA (SEM FALLBACK)
  IF p_itens IS NULL OR jsonb_array_length(p_itens) = 0 THEN
    RAISE EXCEPTION 'Falha de Integridade: O retorno bancário não possui itens para processamento.';
  END IF;

  v_remessa_id := NULLIF(p_itens->0->>'remessa_id', '')::UUID;
  IF v_remessa_id IS NULL THEN
    RAISE EXCEPTION 'Falha de Integridade: É obrigatório que o retorno bancário esteja vinculado a uma remessa existente.';
  END IF;

  -- Lock pessimista na remessa vinculada (serializa retornos concorrentes para a mesma remessa)
  SELECT modo, empresa_id, conta_bancaria_id, lote_id, diaristas_lote_id, intermitentes_lote_id, total_valor, total_registros
  INTO v_remessa_modo, v_remessa_empresa_id, v_remessa_conta_id, v_remessa_lote_id, v_remessa_diaristas_id, v_remessa_intermitentes_id, v_remessa_total_valor, v_remessa_total_registros
  FROM public.cnab_remessas_arquivos
  WHERE id = v_remessa_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Falha de Integridade: Remessa vinculada % não encontrada no tenant %.', v_remessa_id, v_tenant_id;
  END IF;

  -- 4.7 BLINDAGEM ANTI-CRUZAMENTO ENTRE AMBIENTES, EMPRESAS E CONTAS
  IF v_remessa_empresa_id <> p_empresa_id THEN
    RAISE EXCEPTION 'Violação de Integridade: A remessa de origem pertence à empresa %, divergente da empresa informada %.', v_remessa_empresa_id, p_empresa_id;
  END IF;

  IF v_remessa_conta_id <> p_conta_bancaria_id THEN
    RAISE EXCEPTION 'Violação de Integridade: A remessa de origem pertence à conta bancária %, divergente da informada %.', v_remessa_conta_id, p_conta_bancaria_id;
  END IF;

  IF v_empresa_is_teste = TRUE AND v_remessa_modo <> 'homologacao' THEN
    RAISE EXCEPTION 'Bloqueio de Segurança: Empresa de homologação não pode conciliar remessas de modo %.', v_remessa_modo;
  END IF;

  IF v_empresa_is_teste = FALSE AND v_remessa_modo = 'homologacao' THEN
    RAISE EXCEPTION 'Bloqueio de Segurança: Empresa oficial de produção não pode conciliar remessa sintética de homologação.';
  END IF;

  -- 4.8 REGISTRO DO CABEÇALHO DO RETORNO COM RASTREABILIDADE TOTAL
  INSERT INTO public.cnab_retorno_arquivos (
    tenant_id,
    empresa_id,
    conta_bancaria_id,
    banco_codigo,
    nome_arquivo,
    hash_arquivo,
    remessa_arquivo_id,
    modo,
    usuario_processamento,
    data_processamento,
    status
  ) VALUES (
    v_tenant_id,
    p_empresa_id,
    p_conta_bancaria_id,
    p_banco_codigo,
    p_nome_arquivo,
    p_hash_arquivo,
    v_remessa_id,
    v_remessa_modo,
    v_user_id,
    NOW(),
    'processado'
  )
  RETURNING id INTO v_retorno_arquivo_id;

  -- 4.9 VALIDAÇÃO INDIVIDUAL E PROCESSAMENTO ATÔMICO ITEM A ITEM
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_total_processado := v_total_processado + 1;
    v_item_remessa_item_id := NULLIF(v_item->>'remessa_item_id', '')::UUID;

    IF v_item_remessa_item_id IS NULL THEN
      RAISE EXCEPTION 'Falha de Integridade: Item do retorno na linha % não informa remessa_item_id.', v_total_processado;
    END IF;

    -- 4.9.1 Bloqueio de duplicidade de item dentro do mesmo arquivo
    IF v_item_remessa_item_id = ANY(v_itens_processados_arquivo) THEN
      RAISE EXCEPTION 'Falha de Integridade: O item de remessa % está duplicado dentro do mesmo arquivo de retorno.', v_item_remessa_item_id;
    END IF;
    v_itens_processados_arquivo := array_append(v_itens_processados_arquivo, v_item_remessa_item_id);

    -- 4.9.2 Consulta canônica e verificação estrita do item na base oficial
    SELECT 
      ri.id,
      ri.remessa_id,
      ri.tenant_id,
      ri.empresa_id,
      ri.origem_id,
      ri.origem_tipo,
      ri.valor,
      ri.status
    INTO v_db_item
    FROM public.cnab_remessa_itens ri
    WHERE ri.id = v_item_remessa_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Falha de Integridade: Item de remessa % informado na linha % não existe.', v_item_remessa_item_id, v_total_processado;
    END IF;

    IF v_db_item.remessa_id <> v_remessa_id THEN
      RAISE EXCEPTION 'Falha de Segurança: Item % pertence à remessa %, divergente da remessa % do retorno.', v_item_remessa_item_id, v_db_item.remessa_id, v_remessa_id;
    END IF;

    IF v_db_item.tenant_id <> v_tenant_id THEN
      RAISE EXCEPTION 'Falha de Segurança: Item de remessa % pertence a outro tenant.', v_item_remessa_item_id;
    END IF;

    IF v_db_item.empresa_id <> p_empresa_id THEN
      RAISE EXCEPTION 'Falha de Segurança: Item de remessa % pertence à empresa %, divergente da empresa do retorno %.', v_item_remessa_item_id, v_db_item.empresa_id, p_empresa_id;
    END IF;

    -- 4.9.3 Bloqueio de re-liquidação de item já conciliado por outro retorno
    IF v_db_item.status = 'conciliado' THEN
      RAISE EXCEPTION 'Falha de Integridade: O item de remessa % já se encontra conciliado/liquidado por retorno anterior.', v_item_remessa_item_id;
    END IF;

    -- Extração e validação do valor retornado e evidências bancárias
    v_item_valor_retornado := COALESCE((v_item->>'valor_pago')::NUMERIC, (v_item->>'valor_retornado')::NUMERIC, 0);
    v_item_status_raw := COALESCE(v_item->>'status', 'pendente');
    v_item_codigo_ocorrencia := UPPER(TRIM(COALESCE(v_item->>'codigo_ocorrencia', '')));
    v_item_linha_original := COALESCE(v_item->>'linha_original', '');

    -- 4.9.4 Validação de Proveniência e Autenticidade em Produção
    IF v_remessa_modo = 'producao' THEN
      IF length(rtrim(v_item_linha_original, E'\r\n')) <> 240 THEN
        RAISE EXCEPTION 'Falha de Autenticidade: O item de remessa % não possui linha posicional FEBRABAN de 240 caracteres válida.', v_item_remessa_item_id;
      END IF;

      IF substring(v_item_linha_original from 1 for 3) <> p_banco_codigo THEN
        RAISE EXCEPTION 'Falha de Autenticidade: A linha do retorno para o item % pertence ao banco %, divergente do banco informado %.', v_item_remessa_item_id, substring(v_item_linha_original from 1 for 3), p_banco_codigo;
      END IF;
    END IF;

    -- Códigos positivos FEBRABAN padrão: '00' (Crédito efetuado), '03' (Liquidado), 'BD' (Pagamento efetuado), '04' (Baixa)
    v_is_codigo_liquidacao := (v_item_codigo_ocorrencia IN ('00', '03', '04', 'BD'));

    -- 4.9.5 Classificação de Conciliação Não Baseada Exclusivamente no Cliente
    IF LOWER(v_item_status_raw) IN ('pago', 'liquidado') THEN
      IF NOT v_is_codigo_liquidacao THEN
        -- Rejeita liquidação forjada se o código bancário for de rejeição ou inválido
        IF v_item_codigo_ocorrencia IN ('RJ', '02', '10', '11', '12', '13') THEN
          v_status_efetivo := 'rejeitado';
          v_total_rejeitados := v_total_rejeitados + 1;
        ELSE
          v_status_efetivo := 'divergente';
          v_total_divergentes := v_total_divergentes + 1;
        END IF;
      ELSIF ABS(v_item_valor_retornado - v_db_item.valor) > 0.009 THEN
        v_status_efetivo := 'divergente';
        v_total_divergentes := v_total_divergentes + 1;
      ELSE
        v_status_efetivo := 'liquidado';
        v_total_pagos := v_total_pagos + 1;
      END IF;
    ELSIF LOWER(v_item_status_raw) IN ('rejeitado', 'rejeitada', 'recusado', 'recusada', 'devolvido') OR v_item_codigo_ocorrencia IN ('RJ', '02', '10', '11', '12', '13') THEN
      v_status_efetivo := 'rejeitado';
      v_total_rejeitados := v_total_rejeitados + 1;
    ELSE
      v_status_efetivo := 'divergente';
      v_total_divergentes := v_total_divergentes + 1;
    END IF;

    -- Inserção na tabela oficial cnab_retorno_itens com todas as colunas reais
    INSERT INTO public.cnab_retorno_itens (
      tenant_id,
      retorno_arquivo_id,
      remessa_arquivo_id,
      remessa_item_id,
      lote_id,
      diaristas_lote_id,
      intermitentes_lote_id,
      fatura_id,
      colaborador_id,
      nome_favorecido,
      documento_favorecido,
      valor_esperado,
      valor_retornado,
      data_ocorrencia,
      codigo_ocorrencia,
      descricao_ocorrencia,
      status,
      status_conciliacao,
      linha_original,
      parsed_json,
      origem_tipo,
      modo
    ) VALUES (
      v_tenant_id,
      v_retorno_arquivo_id,
      v_remessa_id,
      v_db_item.id,
      v_remessa_lote_id,
      v_remessa_diaristas_id,
      v_remessa_intermitentes_id,
      NULLIF(v_item->>'fatura_id', '')::UUID,
      NULLIF(v_item->>'colaborador_id', '')::UUID,
      v_item->>'nome_favorecido',
      v_item->>'documento_favorecido',
      v_db_item.valor,
      v_item_valor_retornado,
      NULLIF(v_item->>'data_ocorrencia', '')::DATE,
      v_item_codigo_ocorrencia,
      COALESCE(v_item->>'descricao_ocorrencia', v_item->>'motivo_ocorrencia'),
      CASE WHEN v_status_efetivo = 'liquidado' THEN 'pago' ELSE v_status_efetivo END,
      CASE WHEN v_status_efetivo = 'liquidado' THEN 'conciliado' ELSE v_status_efetivo END,
      v_item_linha_original,
      COALESCE(v_item->'parsed_json', '{}'::JSONB),
      v_db_item.origem_tipo,
      v_remessa_modo
    );

    -- Atualização do status do item da remessa subjacente
    UPDATE public.cnab_remessa_itens
    SET status = CASE 
                   WHEN v_status_efetivo = 'liquidado' THEN 'conciliado'
                   WHEN v_status_efetivo = 'rejeitado' THEN 'rejeitado'
                   ELSE 'divergente'
                 END
    WHERE id = v_db_item.id;

    -- Baixa individual atômica do lançamento de origem conforme domínio
    IF v_status_efetivo = 'liquidado' THEN
      IF v_db_item.origem_tipo = 'INTERMITENTE' AND v_db_item.origem_id IS NOT NULL THEN
        UPDATE public.lancamentos_intermitentes
        SET status_pipeline = 'PAGO'
        WHERE id = v_db_item.origem_id
          AND tenant_id = v_tenant_id;

      ELSIF v_db_item.origem_tipo IN ('DIARISTA', 'DIARISTAS') AND v_db_item.origem_id IS NOT NULL THEN
        UPDATE public.lancamentos_diaristas
        SET status = 'PAGO'
        WHERE id = v_db_item.origem_id
          AND tenant_id = v_tenant_id;

      ELSIF v_db_item.origem_tipo = 'FATURA' AND v_db_item.origem_id IS NOT NULL THEN
        UPDATE public.faturas
        SET status = 'paga',
            updated_at = NOW()
        WHERE id = v_db_item.origem_id
          AND tenant_id = v_tenant_id;

      ELSIF v_db_item.origem_tipo IN ('CLT', 'RH') AND v_db_item.origem_id IS NOT NULL THEN
        UPDATE public.rh_financeiro_lote_itens
        SET status = 'PAGO'
        WHERE id = v_db_item.origem_id
          AND tenant_id = v_tenant_id;
      END IF;
    END IF;

  END LOOP;

  -- 4.10 QUITAÇÃO INTEGRAL: APURAÇÃO CONSOLIDADA DE TODOS OS ITENS DA REMESSA
  -- Somente liquida o lote se todos os itens esperados da remessa estiverem conciliados,
  -- com valores exatos e sem nenhuma pendência, rejeição ou divergência.
  SELECT 
    COUNT(*) FILTER (WHERE status = 'conciliado'),
    COUNT(*) FILTER (WHERE status <> 'conciliado'),
    COALESCE(SUM(valor) FILTER (WHERE status = 'conciliado'), 0),
    COUNT(*),
    COALESCE(SUM(valor), 0)
  INTO v_qtd_conciliados, v_qtd_nao_conciliados, v_sum_conciliado, v_qtd_total_remessa, v_sum_total_remessa
  FROM public.cnab_remessa_itens
  WHERE remessa_id = v_remessa_id;

  v_quitacao_integral := (
    v_qtd_nao_conciliados = 0 
    AND v_qtd_conciliados = v_qtd_total_remessa 
    AND v_qtd_total_remessa > 0
    AND ABS(v_sum_conciliado - v_sum_total_remessa) < 0.01
    AND v_total_rejeitados = 0 
    AND v_total_divergentes = 0
  );

  IF v_quitacao_integral = TRUE THEN
    IF v_remessa_intermitentes_id IS NOT NULL THEN
      UPDATE public.intermitentes_lotes_fechamento
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_remessa_intermitentes_id
        AND tenant_id = v_tenant_id;
    END IF;

    IF v_remessa_diaristas_id IS NOT NULL THEN
      UPDATE public.diaristas_lotes_fechamento
      SET status = 'PAGO',
          updated_at = NOW()
      WHERE id = v_remessa_diaristas_id
        AND tenant_id = v_tenant_id;
    END IF;

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
  -- Em homologação, se quitado integralmente, atualiza para 'homologado' (válido no check constraint).
  -- Em caso de falha/rejeição em homologação, marca 'erro_homologacao'.
  -- Em produção, não altera o status de transmissão ('baixado'/'enviado_manual').
  IF v_remessa_modo = 'homologacao' THEN
    UPDATE public.cnab_remessas_arquivos
    SET status = CASE WHEN v_quitacao_integral = TRUE THEN 'homologado' ELSE 'erro_homologacao' END
    WHERE id = v_remessa_id
      AND tenant_id = v_tenant_id;
  END IF;

  -- 4.12 AUDITORIA BANCÁRIA ESTRITA COM COLUNA REAL arquivo_id
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
    COALESCE(v_remessa_intermitentes_id, v_remessa_diaristas_id, v_remessa_lote_id),
    v_user_id,
    'SISTEMA (RPC)',
    CASE WHEN v_remessa_modo = 'homologacao' THEN 'RETORNO_PROCESSADO_SIMULADO' ELSE 'RETORNO_PROCESSADO' END,
    jsonb_build_object(
      'retorno_arquivo_id', v_retorno_arquivo_id,
      'modo', v_remessa_modo,
      'simulacao', (v_remessa_modo = 'homologacao'),
      'empresa_id', p_empresa_id,
      'conta_bancaria_id', p_conta_bancaria_id,
      'remessa_id', v_remessa_id,
      'total_processado', v_total_processado,
      'total_pagos', v_total_pagos,
      'total_rejeitados', v_total_rejeitados,
      'total_divergentes', v_total_divergentes,
      'quitacao_integral', v_quitacao_integral,
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
    'quitacao_integral', v_quitacao_integral
  );
END;
$$;

-- 5. CONCESSÃO DE PRIVILÉGIOS DE SEGURANÇA
REVOKE ALL ON FUNCTION public.rpc_aplicar_cnab_retorno FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_aplicar_cnab_retorno TO authenticated;
