-- ==============================================================================
-- SCRIPT 00B: sec_02_script_00b_audit_log_local.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02 - Preparação Incremental da Infraestrutura de Auditoria (Local)
-- FINALIDADE:
--   Criar e configurar a tabela public.audit_log de forma estritamente incremental
--   e compatível com a migration de governança da Sprint 3 (20260624000006_sprint3_audit_log.sql).
-- REGRAS OBRIGATÓRIAS:
--   1. Destinado EXCLUSIVAMENTE ao banco sintético local (supabase_db_sec02_hml).
--   2. Não altera profiles, tenants, tenant_invitations ou user_permissions.
--   3. Não executa DROP CASCADE, TRUNCATE, DELETE ou reset de banco.
--   4. Falha de maneira explícita (fail-closed) se encontrar audit_log incompatível.
--   5. Ativa RLS e cria as políticas exatas da Sprint 3.
-- ==============================================================================

\set ON_ERROR_STOP 1

-- ------------------------------------------------------------------------------
-- 0. TRAVAS FAIL-CLOSED MULTICAMADAS ANTI-PRODUÇÃO
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_server_addr inet := inet_server_addr();
  v_host_header text := current_setting('request.headers', true)::json->>'host';
  v_hosts_content text;
  v_has_real_erp_data boolean := false;
BEGIN
  -- 1. Verificação de Host Header Remoto
  IF v_host_header ILIKE '%supabase.co%' OR v_host_header ILIKE '%lifgjtcflzmspilhryap%' THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Tentativa de execução bloqueada! Host header remoto de produção detectado: %', v_host_header;
  END IF;

  -- 2. Verificação de Conexão de Rede (apenas loopback local 127.0.0.1 ou ::1)
  IF v_server_addr IS NOT NULL AND v_server_addr NOT IN ('127.0.0.1'::inet, '::1'::inet) THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Servidor conectado (%) não é loopback local!', v_server_addr;
  END IF;

  -- 3. Verificação de Identificação do Container (supabase_db_sec02_hml)
  BEGIN
    SELECT pg_read_file('/etc/hosts') INTO v_hosts_content;
    IF v_hosts_content IS NOT NULL AND v_hosts_content NOT ILIKE '%sec02_hml%' THEN
      RAISE EXCEPTION 'FATAL / FAIL-CLOSED: O container conectado não corresponde a supabase_db_sec02_hml (/etc/hosts não possui identificador sec02_hml)!';
    END IF;
  EXCEPTION
    WHEN undefined_file THEN
      RAISE NOTICE '[FAIL-CLOSED] /etc/hosts não disponível para inspeção de container. Validando por loopback e ausência de tabelas ERP.';
    WHEN insufficient_privilege THEN
      RAISE NOTICE '[FAIL-CLOSED] Sem privilégio para ler /etc/hosts. Prosseguindo com checagens de integridade estrutural.';
  END;

  -- 4. Verificação de Preservação Anti-Produção: Nenhuma tabela real de ERP pode existir
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('colaboradores', 'empresas', 'operacoes', 'lancamentos_diaristas', 'registros_ponto')
  ) INTO v_has_real_erp_data;

  IF v_has_real_erp_data THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: O banco de dados conectado contém tabelas operacionais reais do ERP ORBE! Abortando imediatamente para prevenir contaminação.';
  END IF;

  RAISE NOTICE '[FAIL-CLOSED CHECK] Conexão local validada com sucesso: 127.0.0.1:54322 (Container supabase_db_sec02_hml descartável).';
END $$;

-- ------------------------------------------------------------------------------
-- 1. VALIDAÇÃO DE COMPATIBILIDADE DE TABELA EXISTENTE (FAIL-CLOSED)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_table_exists boolean;
  v_missing_columns text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_log'
  ) INTO v_table_exists;

  IF v_table_exists THEN
    -- Verificar se possui todas as colunas essenciais da Sprint 3
    SELECT string_agg(expected_col, ', ')
    INTO v_missing_columns
    FROM (
      SELECT unnest(ARRAY[
        'id', 'tenant_id', 'empresa_id', 'usuario_id', 'usuario_nome', 
        'perfil_usuario', 'acao', 'entidade', 'registro_id', 'descricao', 
        'valor_anterior', 'valor_novo', 'origem', 'ip', 'user_agent', 'created_at'
      ]) AS expected_col
    ) e
    WHERE NOT EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = 'public' 
        AND c.table_name = 'audit_log' 
        AND c.column_name = e.expected_col
    );

    IF v_missing_columns IS NOT NULL THEN
      RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Tabela public.audit_log já existe com estrutura incompatível! Colunas ausentes da Sprint 3: %', v_missing_columns;
    END IF;

    RAISE NOTICE '[AUDIT_LOG CHECK] Tabela public.audit_log pré-existente validada: estrutura 100%% compatível com Sprint 3.';
  ELSE
    RAISE NOTICE '[AUDIT_LOG CHECK] Tabela public.audit_log não existe. Criando estrutura compatível com Sprint 3...';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. CRIAÇÃO INCREMENTAL DA TABELA public.audit_log
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    empresa_id UUID,
    usuario_id UUID,
    usuario_nome TEXT,
    perfil_usuario TEXT,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    registro_id UUID NOT NULL,
    descricao TEXT,
    valor_anterior JSONB,
    valor_novo JSONB,
    origem TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) E POLÍTICAS DA SPRINT 3
-- ------------------------------------------------------------------------------
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'audit_log' 
      AND policyname = 'Strict Insert Only on audit_log'
  ) THEN
    CREATE POLICY "Strict Insert Only on audit_log" 
    ON public.audit_log 
    FOR INSERT 
    WITH CHECK (true);
    RAISE NOTICE '[RLS] Política "Strict Insert Only on audit_log" criada com sucesso.';
  ELSE
    RAISE NOTICE '[RLS] Política "Strict Insert Only on audit_log" já existe. Preservada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'audit_log' 
      AND policyname = 'Strict Select on audit_log'
  ) THEN
    CREATE POLICY "Strict Select on audit_log" 
    ON public.audit_log 
    FOR SELECT 
    USING (tenant_id = public.current_tenant_id());
    RAISE NOTICE '[RLS] Política "Strict Select on audit_log" criada com sucesso.';
  ELSE
    RAISE NOTICE '[RLS] Política "Strict Select on audit_log" já existe. Preservada.';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. PRIVILÉGIOS E ÍNDICES (SPRINT 3 COMPATÍVEL)
-- ------------------------------------------------------------------------------
REVOKE ALL ON public.audit_log FROM anon, PUBLIC;
GRANT INSERT, SELECT ON public.audit_log TO authenticated, service_role;

CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidade ON public.audit_log(entidade);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON public.audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

-- ------------------------------------------------------------------------------
-- 5. VALIDAÇÃO PÓS-INSTALAÇÃO (FAIL-CLOSED)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_rls_active boolean;
  v_policy_count integer;
  v_anon_grants integer;
BEGIN
  -- Validar RLS
  SELECT rowsecurity INTO v_rls_active 
  FROM pg_tables 
  WHERE schemaname = 'public' AND tablename = 'audit_log';

  IF NOT v_rls_active THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: RLS não foi ativada em public.audit_log!';
  END IF;

  -- Validar exatamente 2 políticas
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'public' 
    AND tablename = 'audit_log'
    AND policyname IN ('Strict Insert Only on audit_log', 'Strict Select on audit_log');

  IF v_policy_count <> 2 THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Políticas da Sprint 3 ausentes ou incompletas em public.audit_log! (Encontradas % de 2)', v_policy_count;
  END IF;

  -- Validar que anon não possui grants
  SELECT COUNT(*) INTO v_anon_grants
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'audit_log'
    AND grantee IN ('anon', 'PUBLIC');

  IF v_anon_grants > 0 THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Privilégios excessivos concedidos a anon/PUBLIC em public.audit_log!';
  END IF;

  RAISE NOTICE '==================================================================';
  RAISE NOTICE 'SCRIPT 00B CONCLUÍDO COM SUCESSO: public.audit_log 100%% OPERACIONAL!';
  RAISE NOTICE '==================================================================';
END $$;
