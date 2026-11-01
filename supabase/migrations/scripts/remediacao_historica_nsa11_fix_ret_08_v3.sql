-- ==============================================================================
-- ERP ORBE — SCRIPT TRANSACIONAL DE RETIFICAÇÃO HISTÓRICA: NSA 11 (FIX-RET-08 v3)
-- VERSÃO: HARDENING FINAL PRÉ-EXECUÇÃO (V3 - LIMITES TRANSACIONAIS E RASTREABILIDADE)
-- ARQUITETURA: TRANSAÇÃO ÚNICA COM RESTAURAÇÃO EXATA VIA pg_get_functiondef
-- ATENÇÃO: NÃO EXECUTAR NO SUPABASE OFICIAL SEM HOMOLOGAÇÃO E AUTORIZAÇÃO EXPRESSA.
-- ==============================================================================
-- Objetivo:
--   Regularizar exclusivamente os três registros históricos de retorno vinculados
--   à remessa NSA 11 (Retorno ID: 853f93c9-0027-4607-b5de-16a557211243),
--   preenchendo a coluna valor_retornado (R$ 140,00, R$ 70,00 e R$ 140,00).
--
-- Princípios de Segurança e Governança:
--   1. Transação única (BEGIN ... COMMIT): qualquer falha aborta via ROLLBACK total.
--   2. Limites transacionais conservadores: lock_timeout = 5s e statement_timeout = 60s.
--   3. A trigger trg_guard_cnab_retorno_item_conciliacao permanece 100% ATIVA em toda
--      a execução (nenhum DISABLE TRIGGER ou DROP TRIGGER).
--   4. Concorrência: LOCK TABLE em EXCLUSIVE MODE e Advisory Lock garantem que
--      nenhuma operação concorrente (com ou sem advisory lock) possa escrever na
--      tabela cnab_retorno_itens durante a transação.
--   5. Captura dinâmica da definição exata instalada via pg_get_functiondef() e
--      restauração byte a byte com conferência de hash SHA-256 antes do COMMIT.
--   6. Exceção estritamente limitada: permite unicamente NEW.valor_retornado = OLD.valor_esperado
--      nos 3 IDs auditados, exigindo imutabilidade absoluta de todos os outros campos
--      através da comparação (to_jsonb(NEW) - 'valor_retornado') = (to_jsonb(OLD) - 'valor_retornado').
--   7. Auditoria com resolução segura de usuario_id (validado contra auth.users),
--      ip_address NULL conforme schema auditado e rastreabilidade administrativa via JSONB.
--   8. Nenhuma escrita destrutiva ou teste simulado contra a base de produção.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. LIMITES TRANSACIONAIS DE SEGURANÇA E CONCORRÊNCIA (HARDENING V3)
-- ------------------------------------------------------------------------------
-- Evita contenção prolongada de lock ou execução demorada
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ------------------------------------------------------------------------------
-- 0.1 PROTEÇÃO CONTRA EXECUÇÃO CONCORRENTE: ADVISORY LOCK + LOCK TABLE EXCLUSIVO
-- ------------------------------------------------------------------------------
-- 0.1.1 Lock consultivo de transação
SELECT pg_advisory_xact_lock(hashtext('orbe_saneamento_nsa11_fix_ret_08'));

-- 0.1.2 Bloqueio de tabela contra escrita concorrente:
--     Bloqueia qualquer INSERT, UPDATE, DELETE concorrente na tabela cnab_retorno_itens
--     enquanto a transação estiver aberta, inclusive operações sem advisory lock.
LOCK TABLE public.cnab_retorno_itens IN EXCLUSIVE MODE;

-- ------------------------------------------------------------------------------
-- 1. PRÉ-VALIDAÇÕES E CAPTURA DINÂMICA DA DEFINIÇÃO EXATA DA FUNÇÃO CANÔNICA
-- ------------------------------------------------------------------------------
-- Criamos uma tabela temporária de transação para persistir a definição exata e o hash
CREATE TEMP TABLE IF NOT EXISTS _fix_ret_08_canonical_backup (
  original_functiondef TEXT NOT NULL,
  original_hash TEXT NOT NULL
) ON COMMIT DROP;

TRUNCATE TABLE _fix_ret_08_canonical_backup;

DO $$
DECLARE
  v_tenant_id_esperado UUID := '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
  v_empresa_id_esperada UUID := '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  v_retorno_id UUID := '853f93c9-0027-4607-b5de-16a557211243';
  v_remessa_id UUID := '46391aad-6417-48cf-ac78-03a2a9dd8b22';
  v_lote_diaristas_id UUID := '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  v_hash_esperado TEXT := '63d7676370e65fa1212132912b79b96ccffaab2384273b868fc5df4303171627';

  -- IDs dos três itens e seus respectivos valores unitários comprovados
  v_item1_id UUID := '1e94a70f-0591-44fb-9541-fb0bc4c6c644';
  v_item1_remessa_item_id UUID := 'c877c3af-f6d0-459e-927e-b9fd58d32f59';
  v_item1_valor NUMERIC := 140.00;

  v_item2_id UUID := '685d7146-f315-4f6a-9609-de6dabbe554e';
  v_item2_remessa_item_id UUID := '3a185f8a-bfab-46db-b8bf-ede7f5c14c0f';
  v_item2_valor NUMERIC := 70.00;

  v_item3_id UUID := '88f71013-09a6-48a8-9446-179930134950';
  v_item3_remessa_item_id UUID := '63d410ec-c27f-4b4a-9a07-655c4b00e926';
  v_item3_valor NUMERIC := 140.00;

  v_chk_retorno RECORD;
  v_chk_remessa RECORD;
  v_chk_lote RECORD;
  v_itens_validos_count INT := 0;
  v_trigger_ativa BOOLEAN := FALSE;
  v_fn_def TEXT;
  v_fn_hash TEXT;
BEGIN
  -- 1.1 Captura dinâmica da definição exata da função no catálogo via pg_get_functiondef
  BEGIN
    v_fn_def := pg_get_functiondef('public.guard_cnab_retorno_item_conciliacao'::regproc);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Falha ao obter definição de public.guard_cnab_retorno_item_conciliacao(): %', SQLERRM;
  END;

  IF v_fn_def IS NULL OR length(trim(v_fn_def)) = 0 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Função public.guard_cnab_retorno_item_conciliacao() não encontrada no catálogo.';
  END IF;

  -- Validação das regras fundamentais da definição atual
  IF v_fn_def NOT LIKE '%Valores de item conciliado nao podem ser alterados silenciosamente.%' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Definição atual da função não contém a cláusula canônica de proteção.';
  END IF;

  IF v_fn_def LIKE '%FIX_RET_08%' OR v_fn_def LIKE '%v_is_retificacao_nsa11%' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Função já contém código residual de retificação. Estado inconsistente.';
  END IF;

  v_fn_hash := encode(digest(v_fn_def, 'sha256'), 'hex');

  -- Salva no backup temporário da transação para uso na restauração
  INSERT INTO _fix_ret_08_canonical_backup (original_functiondef, original_hash)
  VALUES (v_fn_def, v_fn_hash);

  -- 1.2 Conferência da trigger ativa em cnab_retorno_itens
  SELECT (tgenabled = 'O') INTO v_trigger_ativa
  FROM pg_trigger
  WHERE tgname = 'trg_guard_cnab_retorno_item_conciliacao'
    AND tgrelid = 'public.cnab_retorno_itens'::regclass;

  IF NOT COALESCE(v_trigger_ativa, FALSE) THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Trigger trg_guard_cnab_retorno_item_conciliacao não está ativa em cnab_retorno_itens.';
  END IF;

  -- 1.3 Cabeçalho do Retorno Processado
  SELECT id, nome_arquivo, hash_arquivo, status, modo, total_sucesso, total_linhas,
         remessa_arquivo_id, empresa_id, tenant_id, usuario_processamento
  INTO v_chk_retorno
  FROM public.cnab_retorno_arquivos
  WHERE id = v_retorno_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Arquivo de retorno % não encontrado.', v_retorno_id;
  END IF;

  IF v_chk_retorno.tenant_id <> v_tenant_id_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Tenant do retorno (%) diverge do tenant esperado (%).', v_chk_retorno.tenant_id, v_tenant_id_esperado;
  END IF;

  IF v_chk_retorno.empresa_id <> v_empresa_id_esperada THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Empresa do retorno (%) diverge da empresa esperada (%).', v_chk_retorno.empresa_id, v_empresa_id_esperada;
  END IF;

  IF v_chk_retorno.modo <> 'homologacao' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Modo do retorno (%) não é homologação.', v_chk_retorno.modo;
  END IF;

  IF v_chk_retorno.status <> 'processado' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Status do retorno (%) não é processado.', v_chk_retorno.status;
  END IF;

  IF v_chk_retorno.remessa_arquivo_id <> v_remessa_id THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Vínculo de remessa (%) diverge da remessa esperada (%).', v_chk_retorno.remessa_arquivo_id, v_remessa_id;
  END IF;

  IF v_chk_retorno.hash_arquivo <> v_hash_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Hash do arquivo (%) diverge do hash oficial registrado (%).', v_chk_retorno.hash_arquivo, v_hash_esperado;
  END IF;

  -- 1.4 Remessa NSA 11
  SELECT id, modo, sequencial_arquivo, total_valor, total_registros, diaristas_lote_id,
         empresa_id, tenant_id
  INTO v_chk_remessa
  FROM public.cnab_remessas_arquivos
  WHERE id = v_remessa_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Remessa NSA 11 (%) não encontrada.', v_remessa_id;
  END IF;

  IF v_chk_remessa.tenant_id <> v_tenant_id_esperado THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Tenant da remessa diverge do tenant esperado.';
  END IF;

  IF v_chk_remessa.empresa_id <> v_empresa_id_esperada THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Empresa da remessa diverge da empresa esperada.';
  END IF;

  IF v_chk_remessa.modo <> 'homologacao' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Modo da remessa (%) não é homologacao.', v_chk_remessa.modo;
  END IF;

  IF v_chk_remessa.sequencial_arquivo <> 11 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Sequencial da remessa (%) diverge da NSA 11.', v_chk_remessa.sequencial_arquivo;
  END IF;

  IF v_chk_remessa.diaristas_lote_id <> v_lote_diaristas_id THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Vínculo de lote de diaristas na remessa diverge do lote esperado.';
  END IF;

  IF round(v_chk_remessa.total_valor, 2) <> 350.00 OR v_chk_remessa.total_registros <> 3 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Remessa possui valores divergentes do padrão homologado (R$ 350,00 / 3 itens).';
  END IF;

  -- 1.5 Lote de Diaristas
  SELECT id, status, status_conciliacao, valor_total, empresa_id, tenant_id
  INTO v_chk_lote
  FROM public.diaristas_lotes_fechamento
  WHERE id = v_lote_diaristas_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Lote de diaristas % não encontrado.', v_lote_diaristas_id;
  END IF;

  IF v_chk_lote.tenant_id <> v_tenant_id_esperado OR v_chk_lote.empresa_id <> v_empresa_id_esperada THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Tenant ou empresa do lote de diaristas divergem dos dados oficiais.';
  END IF;

  IF v_chk_lote.status <> 'PAGO' OR v_chk_lote.status_conciliacao <> 'conciliado' THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Lote de diaristas % não está no estado PAGO/conciliado esperado.', v_lote_diaristas_id;
  END IF;

  IF round(v_chk_lote.valor_total, 2) <> 350.00 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Valor do lote de diaristas diverge de R$ 350,00.';
  END IF;

  -- 1.6 Validação e bloqueio a nível de linha (FOR UPDATE) dos 3 Itens Conhecidos
  SELECT COUNT(*)
  INTO v_itens_validos_count
  FROM public.cnab_retorno_itens
  WHERE id IN (v_item1_id, v_item2_id, v_item3_id)
    AND retorno_arquivo_id = v_retorno_id
    AND remessa_arquivo_id = v_remessa_id
    AND diaristas_lote_id = v_lote_diaristas_id
    AND tenant_id = v_tenant_id_esperado
    AND status = 'pago'
    AND status_conciliacao = 'conciliado'
    AND valor_retornado IS NULL;

  IF v_itens_validos_count <> 3 THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Esperava exatamente 3 itens elegíveis em cnab_retorno_itens com valor_retornado NULL, mas encontrou %.', v_itens_validos_count;
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens
  WHERE id = v_item1_id AND remessa_item_id = v_item1_remessa_item_id AND round(valor_esperado, 2) = v_item1_valor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Item 1 (%) não confere com remessa_item_id ou valor esperado (R$ 140,00).', v_item1_id;
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens
  WHERE id = v_item2_id AND remessa_item_id = v_item2_remessa_item_id AND round(valor_esperado, 2) = v_item2_valor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Item 2 (%) não confere com remessa_item_id ou valor esperado (R$ 70,00).', v_item2_id;
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens
  WHERE id = v_item3_id AND remessa_item_id = v_item3_remessa_item_id AND round(valor_esperado, 2) = v_item3_valor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PRÉ-CONDIÇÃO FALHOU: Item 3 (%) não confere com remessa_item_id ou valor esperado (R$ 140,00).', v_item3_id;
  END IF;

  RAISE NOTICE 'PRÉ-VALIDAÇÕES CONCLUÍDAS COM SUCESSO. DEFINIÇÃO CANÔNICA SALVA. PROSSEGUINDO.';
END;
$$;

-- ------------------------------------------------------------------------------
-- 2. ALTERAÇÃO TEMPORÁRIA DA FUNÇÃO GUARD COM EXCEÇÃO ESTREITA E BLINDADA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_cnab_retorno_item_conciliacao()
RETURNS TRIGGER AS $$
DECLARE
  v_is_allowed BOOLEAN;
  v_is_retificacao_nsa11 BOOLEAN := FALSE;
BEGIN
  v_is_allowed := public.is_financeiro_conciliacao_role();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'O status bancario do retorno nao pode ser alterado manualmente.';
  END IF;

  IF (
    NEW.status_conciliacao IS DISTINCT FROM OLD.status_conciliacao OR
    COALESCE(NEW.observacao_conciliacao, '') IS DISTINCT FROM COALESCE(OLD.observacao_conciliacao, '') OR
    NEW.conciliado_em IS DISTINCT FROM OLD.conciliado_em OR
    NEW.conciliado_por IS DISTINCT FROM OLD.conciliado_por OR
    NEW.revertido_em IS DISTINCT FROM OLD.revertido_em OR
    NEW.revertido_por IS DISTINCT FROM OLD.revertido_por
  ) AND NOT v_is_allowed THEN
    RAISE EXCEPTION 'Usuario sem permissao para alterar a conciliacao.';
  END IF;

  IF OLD.status_conciliacao = 'conciliado' AND NEW.status_conciliacao NOT IN ('conciliado', 'revertido') THEN
    RAISE EXCEPTION 'Item conciliado nao pode ser alterado sem reversao autorizada.';
  END IF;

  -- ============================================================================
  -- CLÁUSULA EXCEPCIONAL CONTROLADA: FIX-RET-08-V3
  -- Exige simultaneamente:
  --   1. Um dos 3 UUIDs históricos auditados
  --   2. Vínculos exatos de retorno, remessa, lote e tenant
  --   3. status = 'pago' e status_conciliacao = 'conciliado'
  --   4. OLD.valor_retornado IS NULL e NEW.valor_retornado = OLD.valor_esperado
  --   5. IMUTABILIDADE ABSOLUTA DE TODOS OS DEMAIS CAMPOS (via to_jsonb - 'valor_retornado')
  -- ============================================================================
  IF OLD.status_conciliacao = 'conciliado'
     AND OLD.id IN (
       '1e94a70f-0591-44fb-9541-fb0bc4c6c644'::UUID,
       '685d7146-f315-4f6a-9609-de6dabbe554e'::UUID,
       '88f71013-09a6-48a8-9446-179930134950'::UUID
     )
     AND OLD.retorno_arquivo_id = '853f93c9-0027-4607-b5de-16a557211243'::UUID
     AND OLD.remessa_arquivo_id = '46391aad-6417-48cf-ac78-03a2a9dd8b22'::UUID
     AND OLD.diaristas_lote_id = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a'::UUID
     AND OLD.tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c'::UUID
     AND OLD.status = 'pago'
     AND OLD.valor_retornado IS NULL
     AND NEW.valor_retornado = OLD.valor_esperado
     AND NEW.valor_retornado IS NOT NULL
     AND (to_jsonb(NEW) - 'valor_retornado') = (to_jsonb(OLD) - 'valor_retornado')
  THEN
    v_is_retificacao_nsa11 := TRUE;
  END IF;

  IF OLD.status_conciliacao = 'conciliado' AND (
    NEW.valor_esperado IS DISTINCT FROM OLD.valor_esperado OR
    NEW.valor_retornado IS DISTINCT FROM OLD.valor_retornado
  ) AND NOT v_is_retificacao_nsa11 THEN
    RAISE EXCEPTION 'Valores de item conciliado nao podem ser alterados silenciosamente.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. EXECUÇÃO DO SANEAMENTO E AUDITORIA BANCÁRIA
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant_id_esperado UUID := '09ccafb6-2cf2-4c83-ac3d-a2913947693c';
  v_retorno_id UUID := '853f93c9-0027-4607-b5de-16a557211243';
  v_remessa_id UUID := '46391aad-6417-48cf-ac78-03a2a9dd8b22';
  v_lote_diaristas_id UUID := '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';

  v_item1_id UUID := '1e94a70f-0591-44fb-9541-fb0bc4c6c644';
  v_item2_id UUID := '685d7146-f315-4f6a-9609-de6dabbe554e';
  v_item3_id UUID := '88f71013-09a6-48a8-9446-179930134950';

  v_itens_atualizados INT := 0;
  v_usuario_proc UUID;
  v_usuario_auditoria UUID;
BEGIN
  -- 3.1 Execução do UPDATE estrito dos 3 registros
  UPDATE public.cnab_retorno_itens
  SET valor_retornado = valor_esperado
  WHERE id IN (v_item1_id, v_item2_id, v_item3_id)
    AND retorno_arquivo_id = v_retorno_id
    AND remessa_arquivo_id = v_remessa_id
    AND diaristas_lote_id = v_lote_diaristas_id
    AND tenant_id = v_tenant_id_esperado
    AND status = 'pago'
    AND status_conciliacao = 'conciliado'
    AND valor_retornado IS NULL;

  GET DIAGNOSTICS v_itens_atualizados = ROW_COUNT;

  IF v_itens_atualizados <> 3 THEN
    RAISE EXCEPTION 'SANEAMENTO ABORTADO: Esperava atualizar exatamente 3 itens, mas afetou % itens.', v_itens_atualizados;
  END IF;

  -- 3.2 Resolução de usuário com validação de existência na FK auth.users
  SELECT usuario_processamento INTO v_usuario_proc
  FROM public.cnab_retorno_arquivos
  WHERE id = v_retorno_id;

  SELECT id INTO v_usuario_auditoria
  FROM auth.users
  WHERE id = COALESCE(auth.uid(), v_usuario_proc);

  -- 3.3 Gravação do registro de auditoria bancária
  --     lote_id é NULL para respeitar FK cnab_auditoria_bancaria_lote_id_fkey -> lotes_remessa(id)
  --     diaristas_lote_id é preservado dentro do payload JSONB detalhes (FIX-RET-05)
  --     ip_address é NULL conforme schema auditado (TEXT nullable) e rastreabilidade v3
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
    v_tenant_id_esperado,
    v_remessa_id,
    NULL,
    v_usuario_auditoria,
    'SISTEMA (FIX-RET-08-V3)',
    'conciliacao_observacao',
    jsonb_build_object(
      'tipo_ajuste', 'SANEAMENTO_HISTORICO_VALOR_RETORNADO_NSA11',
      'protocolo', 'FIX-RET-08-V3',
      'origem_execucao', 'SQL_EDITOR_ADMINISTRATIVO',
      'tipo_execucao', 'RETIFICACAO_HISTORICA_CONTROLADA',
      'ip_nao_coletado', true,
      'retorno_arquivo_id', v_retorno_id,
      'remessa_id', v_remessa_id,
      'diaristas_lote_id', v_lote_diaristas_id,
      'itens_atualizados', v_itens_atualizados,
      'soma_total_retornada', 350.00,
      'motivo', 'FIX-RET-08 v3: Regularização de valor_retornado NULL para conferência no Dashboard Financeiro e DRE',
      'origem', 'Arquivo sintético retorno NSA 11 com Segmento A único de R$ 350,00 rateado em 140, 70 e 140'
    ),
    NULL
  );

  RAISE NOTICE 'SANEAMENTO EXECUTADO: 3 itens atualizados e auditoria registrada.';
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. RESTAURAÇÃO EXATA DA DEFINIÇÃO ORIGINAL DA FUNÇÃO VIA BACKUP DINÂMICO
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_original_def TEXT;
BEGIN
  SELECT original_functiondef INTO v_original_def
  FROM _fix_ret_08_canonical_backup
  LIMIT 1;

  IF v_original_def IS NULL OR length(trim(v_original_def)) = 0 THEN
    RAISE EXCEPTION 'CRÍTICO: Backup da definição original da função não encontrado na sessão temporária!';
  END IF;

  -- Executa exatamente a string DDL capturada dinamicamente no início da transação
  EXECUTE v_original_def;

  RAISE NOTICE 'RESTAURAÇÃO EXECUTADA: Definição canônica original da função guard reaplicada.';
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. PÓS-VALIDAÇÕES NÃO-DESTRUTIVAS E VERIFICAÇÃO CRIPTOGRÁFICA DA RESTAURAÇÃO
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_retorno_id UUID := '853f93c9-0027-4607-b5de-16a557211243';
  v_item1_id UUID := '1e94a70f-0591-44fb-9541-fb0bc4c6c644';
  v_item2_id UUID := '685d7146-f315-4f6a-9609-de6dabbe554e';
  v_item3_id UUID := '88f71013-09a6-48a8-9446-179930134950';

  v_soma_retornada NUMERIC := 0;
  v_null_count INT := 0;
  v_restored_def TEXT;
  v_restored_hash TEXT;
  v_original_def TEXT;
  v_original_hash TEXT;
  v_trigger_ativa BOOLEAN := FALSE;
BEGIN
  -- 5.1 Conferência dos valores persistidos em cnab_retorno_itens
  SELECT COALESCE(SUM(valor_retornado), 0)
  INTO v_soma_retornada
  FROM public.cnab_retorno_itens
  WHERE retorno_arquivo_id = v_retorno_id
    AND id IN (v_item1_id, v_item2_id, v_item3_id);

  IF round(v_soma_retornada, 2) <> 350.00 THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Soma dos valores retornados (%) diverge de R$ 350,00.', v_soma_retornada;
  END IF;

  -- 5.2 Garantia de que nenhum dos 3 itens permaneceu NULL
  SELECT COUNT(*)
  INTO v_null_count
  FROM public.cnab_retorno_itens
  WHERE retorno_arquivo_id = v_retorno_id
    AND id IN (v_item1_id, v_item2_id, v_item3_id)
    AND valor_retornado IS NULL;

  IF v_null_count <> 0 THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Ainda existem % itens com valor_retornado NULL.', v_null_count;
  END IF;

  -- 5.3 Validação individual dos valores retificados
  PERFORM 1 FROM public.cnab_retorno_itens WHERE id = v_item1_id AND round(valor_retornado, 2) = 140.00;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Item 1 não possui valor_retornado = 140.00.';
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens WHERE id = v_item2_id AND round(valor_retornado, 2) = 70.00;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Item 2 não possui valor_retornado = 70.00.';
  END IF;

  PERFORM 1 FROM public.cnab_retorno_itens WHERE id = v_item3_id AND round(valor_retornado, 2) = 140.00;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Item 3 não possui valor_retornado = 140.00.';
  END IF;

  -- 5.4 Conferência criptográfica da restauração da função no catálogo pg_proc
  SELECT original_functiondef, original_hash INTO v_original_def, v_original_hash
  FROM _fix_ret_08_canonical_backup
  LIMIT 1;

  v_restored_def := pg_get_functiondef('public.guard_cnab_retorno_item_conciliacao'::regproc);
  v_restored_hash := encode(digest(v_restored_def, 'sha256'), 'hex');

  IF v_restored_def IS DISTINCT FROM v_original_def THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA CRÍTICA FALHOU: DDL restaurado difere caractere a caractere da definição original!';
  END IF;

  IF v_restored_hash IS DISTINCT FROM v_original_hash THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA CRÍTICA FALHOU: Hash SHA-256 do DDL restaurado (%) diverge do original (%)!', v_restored_hash, v_original_hash;
  END IF;

  IF v_restored_def LIKE '%FIX_RET_08%' OR v_restored_def LIKE '%v_is_retificacao_nsa11%' OR v_restored_def LIKE '%1e94a70f%' THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA CRÍTICA FALHOU: A função restaurada ainda contém código residual de exceção!';
  END IF;

  -- 5.5 Conferência de que a trigger trg_guard_cnab_retorno_item_conciliacao permanece ativa
  SELECT (tgenabled = 'O') INTO v_trigger_ativa
  FROM pg_trigger
  WHERE tgname = 'trg_guard_cnab_retorno_item_conciliacao'
    AND tgrelid = 'public.cnab_retorno_itens'::regclass;

  IF NOT COALESCE(v_trigger_ativa, FALSE) THEN
    RAISE EXCEPTION 'PÓS-CONFERÊNCIA FALHOU: Trigger trg_guard_cnab_retorno_item_conciliacao não está ativa!';
  END IF;

  RAISE NOTICE 'PÓS-VALIDAÇÃO CONCLUÍDA COM SUCESSO: 3 itens regularizados (total R$ 350,00), função canônica restaurada com 100%% de paridade hash e trigger validada ativa.';
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. EFETIVAÇÃO DA TRANSAÇÃO
-- ------------------------------------------------------------------------------
COMMIT;
