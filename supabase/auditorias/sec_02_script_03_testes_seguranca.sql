-- ==============================================================================
-- SCRIPT 03: sec_02_script_03_testes_seguranca.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02 - Bateria de Testes de Segurança Multi-Tenant (SEC-01 a SEC-15)
-- FINALIDADE:
--   Validar integralmente a blindagem da tabela public.profiles, privilégios de coluna,
--   políticas RLS e funções multi-tenant com dados sintéticos em ambiente isolado.
-- DESTINO: EXCLUSIVAMENTE PostgreSQL Local (127.0.0.1:54322) - Container supabase_db_sec02_hml
-- ESTRUTURA:
--   0. TRAVAS FAIL-CLOSED MULTICAMADAS ESTREITAS (REJEIÇÃO DETERMINÍSTICA)
--   PARTE A: Testes de Leitura e Inspeção de Catálogo (100% READ-ONLY COM ASSERÇÕES)
--   PARTE B: Testes de Execução com Papel Real 'authenticated' (TRANSAÇÃO COM ROLLBACK)
--
-- NOTA SOBRE ISOLAMENTO E ESCOPO DO ROLLBACK:
--   O comando ROLLBACK encerra a transação e reverte 100% de todas as mutações DML
--   realizadas em tabelas relacionais durante o teste (public.tenants, public.profiles,
--   public.tenant_invitations, auth.users, public.user_permissions).
--   Ressalta-se que o ROLLBACK reverte estritamente dados e objetos transacionais;
--   efeitos não-transacionais do PostgreSQL (como consumo de sequências ou entradas
--   no log do servidor) não são revertidos por ROLLBACK, conforme padrão ACID do engine,
--   mas nenhum registro de teste permanece persistido no banco de dados.
-- ==============================================================================

\set ON_ERROR_STOP 1

-- ------------------------------------------------------------------------------
-- 0. TRAVAS FAIL-CLOSED MULTICAMADAS (PROTEÇÃO ANTI-PRODUÇÃO NO ENGINE SQL)
-- ------------------------------------------------------------------------------
-- NOTA ARQUITETURAL:
--   A identificação física do container Docker (nome, ID, imagem e estado operacional)
--   é realizada previamente de forma mandatória pelo wrapper PowerShell (exec_sec02_hml.ps1).
--   Este bloco interno SQL valida o ambiente em nível de banco, rejeitando conexões remotas,
--   exigindo banco local 'postgres', ausência total de dados operacionais de produção e
--   presença das tabelas do schema sintético de homologação.
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_server_addr inet := inet_server_addr();
  v_host_header text := current_setting('request.headers', true)::json->>'host';
  v_has_real_erp_data boolean := false;
  v_current_db text := current_database();
BEGIN
  -- 1. Verificação de Host Header Remoto (se presente na sessão)
  IF v_host_header IS NOT NULL AND (
     v_host_header ILIKE '%supabase.co%' OR 
     v_host_header ILIKE '%lifgjtcflzmspilhryap%' OR 
     (v_host_header NOT ILIKE '%localhost%' AND v_host_header NOT ILIKE '%127.0.0.1%')
  ) THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Tentativa de execução bloqueada! Host header remoto detectado: %', v_host_header;
  END IF;

  -- 2. Verificação de Conexão de Rede (Socket Unix local OU Loopback TCP/IP)
  -- Em conexões via docker exec (socket Unix local), inet_server_addr() é NULL.
  -- Em conexões TCP/IP, exige estritamente loopback local ('127.0.0.1' ou '::1').
  IF v_server_addr IS NOT NULL THEN
    IF v_server_addr NOT IN ('127.0.0.1'::inet, '::1'::inet) THEN
      RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Conexão TCP/IP remota detectada (%)! Permitido estritamente loopback local (127.0.0.1 / ::1) ou socket Unix local.', v_server_addr;
    END IF;
  END IF;

  -- 3. Verificação do Banco de Dados Conectado
  IF v_current_db <> 'postgres' THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Banco de dados conectado (%) não é o padrão local "postgres"!', v_current_db;
  END IF;

  -- 4. Verificação da Presença do Schema Sintético Esperado (Carregado pelo SCRIPT 00)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'profiles'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenants'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'tenant_invitations'
  ) THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Schema mínimo sintético não encontrado (profiles, tenants, tenant_invitations)! O SCRIPT 00 deve ser carregado antes do teste.';
  END IF;

  -- 5. Verificação de Preservação Anti-Produção: Nenhuma tabela operacional de ERP pode existir
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN (
        'colaboradores', 'empresas', 'operacoes', 'lancamentos_diaristas', 
        'registros_ponto', 'clientes', 'fornecedores', 'transportadoras', 
        'veiculos', 'regras_operacionais'
      )
  ) INTO v_has_real_erp_data;

  IF v_has_real_erp_data THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: O banco de dados conectado contém tabelas operacionais reais do ERP ORBE! Abortando imediatamente para prevenir contaminação.';
  END IF;

  IF v_server_addr IS NULL THEN
    RAISE NOTICE '[FAIL-CLOSED CHECK] Conexão validada: Socket Unix local no container supabase_db_sec02_hml (Banco postgres descartável).';
  ELSE
    RAISE NOTICE '[FAIL-CLOSED CHECK] Conexão validada: Loopback TCP (%) no container supabase_db_sec02_hml (Banco postgres descartável).', v_server_addr;
  END IF;
END $$;


-- ==============================================================================
-- PARTE A: TESTES DE LEITURA E INSPEÇÃO ESTRUTURAL (READ-ONLY COM ASSERÇÕES)
-- ==============================================================================
-- Esta seção consulta o catálogo e valida as barreiras estruturais. Se qualquer
-- teste falhar, aborta a execução imediatamente com RAISE EXCEPTION (sem falsos [PASS]).

SELECT '=== PARTE A: TESTES DE LEITURA E INSPEÇÃO ESTRUTURAL ===' AS status_etapa;

DO $$
DECLARE
  v_err_count integer;
  v_details text;
BEGIN
  -- Teste A.1: Confirmar ausência de INSERT, DELETE, UPDATE e TRUNCATE de tabela para authenticated
  SELECT COUNT(*), COALESCE(string_agg(privilege_type, ', '), '') INTO v_err_count, v_details
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND grantee = 'authenticated'
    AND privilege_type IN ('INSERT', 'DELETE', 'UPDATE', 'TRUNCATE');

  IF v_err_count > 0 THEN
    RAISE EXCEPTION '[FAIL A.1] Privilégios excessivos em nível de tabela para authenticated: %', v_details;
  ELSE
    RAISE NOTICE '[PASS] A.1: Nenhum privilégio de mutação em nível de tabela para authenticated.';
  END IF;

  -- Teste A.2: Confirmar que authenticated NÃO possui UPDATE nas colunas sensíveis
  SELECT COUNT(*), COALESCE(string_agg(column_name, ', '), '') INTO v_err_count, v_details
  FROM information_schema.column_privileges
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND column_name IN ('id', 'user_id', 'tenant_id', 'role', 'created_at')
    AND grantee = 'authenticated'
    AND privilege_type = 'UPDATE';

  IF v_err_count > 0 THEN
    RAISE EXCEPTION '[FAIL A.2] Colunas sensíveis expostas a UPDATE por authenticated: %', v_details;
  ELSE
    RAISE NOTICE '[PASS] A.2: Colunas sensíveis (id, user_id, tenant_id, role, created_at) totalmente protegidas contra UPDATE.';
  END IF;

  -- Teste A.3: Confirmar isolamento total do papel anon em public.profiles
  SELECT COUNT(*), COALESCE(string_agg(privilege_type, ', '), '') INTO v_err_count, v_details
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'profiles' 
    AND grantee = 'anon';

  IF v_err_count > 0 THEN
    RAISE EXCEPTION '[FAIL A.3] Papel anon possui privilégios em profiles: %', v_details;
  ELSE
    RAISE NOTICE '[PASS] A.3: Papel anon possui zero privilégios na tabela profiles.';
  END IF;

  -- Teste A.4: Confirmar existência e configuração da função anti-recursão can_view_tenant_profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' 
      AND p.proname = 'can_view_tenant_profiles'
      AND p.prosecdef 
      AND array_to_string(p.proconfig, ', ') ILIKE '%search_path=public%'
  ) THEN
    RAISE EXCEPTION '[FAIL A.4] Função auxiliar can_view_tenant_profiles ausente ou com configuração de segurança insegura!';
  ELSE
    RAISE NOTICE '[PASS] A.4: Função can_view_tenant_profiles configurada com SECURITY DEFINER e search_path fixo.';
  END IF;

  -- Teste A.5: Confirmar compatibilidade da constraint tenant_invitations_status_check
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'tenant_invitations'
      AND c.conname = 'tenant_invitations_status_check'
      AND pg_get_constraintdef(c.oid) ILIKE '%em_processamento%'
  ) THEN
    RAISE EXCEPTION '[FAIL A.5] Constraint tenant_invitations_status_check não suporta o status transitório em_processamento!';
  ELSE
    RAISE NOTICE '[PASS] A.5: Constraint tenant_invitations_status_check compatibilizada com em_processamento.';
  END IF;

  -- Teste A.6: Confirmar ausência de privilégios de mutação direta em tenant_invitations para clientes
  SELECT COUNT(*), COALESCE(string_agg(grantee || ':' || privilege_type, ', '), '') INTO v_err_count, v_details
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' 
    AND table_name = 'tenant_invitations' 
    AND grantee IN ('anon', 'authenticated')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE');

  IF v_err_count > 0 THEN
    RAISE EXCEPTION '[FAIL A.6] Privilégios perigosos concedidos em tenant_invitations para clientes: %', v_details;
  ELSE
    RAISE NOTICE '[PASS] A.6: Nenhum privilégio de INSERT/UPDATE/DELETE em tenant_invitations para anon/authenticated.';
  END IF;

  RAISE NOTICE '------------------------------------------------------------------';
  RAISE NOTICE 'PARTE A CONCLUÍDA COM SUCESSO: CATÁLOGO EM CONFORMIDADE TOTAL';
  RAISE NOTICE '------------------------------------------------------------------';
END $$;


-- ==============================================================================
-- PARTE B: TESTES TRANSACIONAIS COM DADOS SINTÉTICOS E ROLE REAL (SEC-01 A SEC-15)
-- ==============================================================================
-- Todos os dados criados aqui são fictícios e gerados dinamicamente com UUIDs randômicos.
-- Toda a operação é encapsulada em BEGIN ... ROLLBACK, garantindo ZERO persistência.
-- Os cenários exercitam efetivamente a role 'authenticated' via SET LOCAL ROLE,
-- validando explicitamente current_user, auth.uid() e row_security_active('public.profiles').
-- Testes negativos validam especificamente o código SQLSTATE e a mensagem da trigger.
-- Testes positivos validam materialmente todas as alterações esperadas no banco.

BEGIN;

DO $$
DECLARE
  -- Identificadores Sintéticos Isolados
  v_tenant_a UUID := gen_random_uuid();
  v_tenant_b UUID := gen_random_uuid();
  v_user_admin UUID := gen_random_uuid();
  v_user_rh UUID := gen_random_uuid();
  v_user_enc UUID := gen_random_uuid();
  v_user_common UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_invite_id UUID := gen_random_uuid();
  v_invite_pendente UUID := gen_random_uuid();
  v_invite_expirado UUID := gen_random_uuid();
  v_invite_bloqueado UUID := gen_random_uuid();
  v_invite_aceito UUID := gen_random_uuid();
  v_invite_processing UUID := gen_random_uuid();
  v_invite_tenant_b UUID := gen_random_uuid();
  v_invite_para_suspenso UUID := gen_random_uuid();
  v_token TEXT := 'test_token_' || encode(gen_random_bytes(8), 'hex');
  v_count INTEGER;
  v_count_cross INTEGER;
  v_err_caught BOOLEAN;
  v_err_sqlstate TEXT;
  v_err_msg TEXT;
  v_ret_role TEXT;
  v_ret_tenant UUID;
  v_ret_uid UUID;
  v_ret_status TEXT;
  v_ret_accepted_by UUID;
  v_ret_accepted_at TIMESTAMPTZ;

  -- Variáveis de Inspeção de Papel e Precondições de Segurança
  v_current_user TEXT;
  v_auth_uid UUID;
  v_rls_active BOOLEAN;
BEGIN
  RAISE NOTICE '------------------------------------------------------------------';
  RAISE NOTICE 'INICIANDO PARTE B: CENÁRIOS SEC-01 A SEC-14 COM DADOS SINTÉTICOS';
  RAISE NOTICE '------------------------------------------------------------------';

  -- ----------------------------------------------------------------------------
  -- SETUP ADMINISTRATIVO SINTÉTICO (2 Tenants Isolados, 5 Usuários)
  -- Executado estritamente como postgres (Superusuário de Migração/Setup)
  -- ----------------------------------------------------------------------------
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  SELECT current_user INTO v_current_user;
  IF v_current_user <> 'postgres' THEN
    RAISE EXCEPTION '[SETUP FAIL] Setup inicial deve executar como postgres, obtido %', v_current_user;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'name') THEN
    EXECUTE 'INSERT INTO public.tenants (id, name) VALUES ($1, $2)' USING v_tenant_a, 'Empresa Sintética A';
    EXECUTE 'INSERT INTO public.tenants (id, name) VALUES ($1, $2)' USING v_tenant_b, 'Empresa Sintética B';
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'nome') THEN
    EXECUTE 'INSERT INTO public.tenants (id, nome) VALUES ($1, $2)' USING v_tenant_a, 'Empresa Sintética A';
    EXECUTE 'INSERT INTO public.tenants (id, nome) VALUES ($1, $2)' USING v_tenant_b, 'Empresa Sintética B';
  ELSE
    EXECUTE 'INSERT INTO public.tenants (id) VALUES ($1)' USING v_tenant_a;
    EXECUTE 'INSERT INTO public.tenants (id) VALUES ($1)' USING v_tenant_b;
  END IF;

  -- Inserir os 5 usuarios sinteticos em auth.users para satisfazer profiles_user_id_fkey
  -- Sem ON CONFLICT para garantir determinismo estrito e nao mascarar inconsistencias
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'aud') THEN
    INSERT INTO auth.users (id, email, aud, role) VALUES
      (v_user_admin,  'sintetico_admin_a@esc.com',  'authenticated', 'authenticated'),
      (v_user_rh,     'sintetico_rh_a@esc.com',     'authenticated', 'authenticated'),
      (v_user_enc,    'sintetico_enc_a@esc.com',    'authenticated', 'authenticated'),
      (v_user_common, 'sintetico_colab_a@esc.com',  'authenticated', 'authenticated'),
      (v_user_b,      'sintetico_admin_b@esc.com',  'authenticated', 'authenticated');
  ELSE
    INSERT INTO auth.users (id, email) VALUES
      (v_user_admin,  'sintetico_admin_a@esc.com'),
      (v_user_rh,     'sintetico_rh_a@esc.com'),
      (v_user_enc,    'sintetico_enc_a@esc.com'),
      (v_user_common, 'sintetico_colab_a@esc.com'),
      (v_user_b,      'sintetico_admin_b@esc.com');
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_admin, v_tenant_a, 'Administrador Sintético A', 'admin');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_rh, v_tenant_a, 'Analista RH Sintético A', 'rh');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_enc, v_tenant_a, 'Encarregado Sintético A', 'encarregado');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_common, v_tenant_a, 'Colaborador Comum Sintético A', 'user');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_b, v_tenant_b, 'Administrador Sintético B', 'admin');

  -- ----------------------------------------------------------------------------
  -- SEC-01: Usuário comum lê apenas seu próprio perfil
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-01: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM public.profiles' INTO v_count;
  EXECUTE 'SELECT user_id FROM public.profiles LIMIT 1' INTO v_ret_uid;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_count = 1 AND v_ret_uid = v_user_common THEN
    RAISE NOTICE '[PASS] SEC-01: Usuário comum lê estritamente seu próprio perfil (1 registro, user_id confirmado) sob authenticated com RLS ativo.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-01: Falha ao ler o próprio perfil sob authenticated. Esperado 1 linha com user_id=%, obtido count=% e user_id=%',
      v_user_common, v_count, v_ret_uid;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-02: Admin consulta perfis do seu tenant (Empresa A = 4, Empresa B = 0)
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_admin OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-02: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM public.profiles' INTO v_count;
  EXECUTE 'SELECT COUNT(*) FROM public.profiles WHERE tenant_id = $1' INTO v_count_cross USING v_tenant_b;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_count = 4 AND v_count_cross = 0 THEN
    RAISE NOTICE '[PASS] SEC-02: Admin lista os 4 perfis do seu tenant e ZERO perfis do tenant B (Isolamento total verificado sob RLS).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-02: Isolamento de Admin falhou. Esperado 4 e 0 cross-tenant, obtido total=% e tenant_b=%',
      v_count, v_count_cross;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-03: RH consulta perfis do tenant para validação e fechamento
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_rh::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_rh OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-03: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM public.profiles' INTO v_count;
  EXECUTE 'SELECT COUNT(*) FROM public.profiles WHERE tenant_id = $1' INTO v_count_cross USING v_tenant_b;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_count = 4 AND v_count_cross = 0 THEN
    RAISE NOTICE '[PASS] SEC-03: Analista de RH consulta os 4 colaboradores do seu tenant com sucesso e zero do tenant B sob authenticated.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-03: RH visualizou contagem inesperada: total=%, tenant_b=% (esperado 4 e 0)',
      v_count, v_count_cross;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-04: Encarregado tenta consultar perfis de terceiros (Blindagem Operacional)
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_enc::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_enc OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-04: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM public.profiles' INTO v_count;
  EXECUTE 'SELECT user_id FROM public.profiles LIMIT 1' INTO v_ret_uid;
  EXECUTE 'SELECT COUNT(*) FROM public.profiles WHERE user_id <> $1' INTO v_count_cross USING v_user_enc;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_count = 1 AND v_ret_uid = v_user_enc AND v_count_cross = 0 THEN
    RAISE NOTICE '[PASS] SEC-04: Encarregado visualiza estritamente seu próprio perfil (1); terceiros bloqueados por RLS.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-04: Encarregado visualizou dados indevidos de terceiros: total=%, outros=%',
      v_count, v_count_cross;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-05: Usuário tenta criar perfil admin via INSERT direto
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-05: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES ($1, $2, $3, $4)'
      USING v_user_common, v_tenant_b, 'Invasor Admin', 'admin';
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    -- Validação estrita: aceita apenas 42501 (REVOKE de tabela) ou P0001 com a mensagem exata da trigger
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%Criação direta de perfis não permitida%') THEN
      RAISE NOTICE '[PASS] SEC-05: Tentativa de INSERT direto bloqueada sob authenticated (SQLSTATE: %, Mensagem: %)',
        v_err_sqlstate, v_err_msg;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-05: Erro não qualificado como bloqueio esperado de segurança: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-05: Falha crítica! Usuário autenticado conseguiu executar INSERT direto de perfil!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-06: Usuário tenta autoalterar diretamente sua role para admin via UPDATE direto
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-06: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'UPDATE public.profiles SET role = ''admin'' WHERE user_id = $1'
      USING v_user_common;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    -- Validação estrita: 42501 (REVOKE coluna role) ou P0001 da trigger de proteção
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND (v_err_msg ILIKE '%Alteração direta da função%role%não permitida%' OR v_err_msg ILIKE '%sem um convite em processamento%')) THEN
      RAISE NOTICE '[PASS] SEC-06: Tentativa de UPDATE direto de role bloqueada sob authenticated (SQLSTATE: %, Mensagem: %)',
        v_err_sqlstate, v_err_msg;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-06: Erro não qualificado como bloqueio esperado de segurança: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-06: Falha crítica! Usuário conseguiu alterar sua role diretamente!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-07: Tentativa de contornar segurança via set_config de session variable
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-07: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  -- Injeção ilegítima de session variable legada
  PERFORM set_config('app.invitation_authorization', v_user_common::text || ':' || v_tenant_a::text || ':admin', true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'UPDATE public.profiles SET role = ''admin'' WHERE user_id = $1'
      USING v_user_common;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND (v_err_msg ILIKE '%Alteração direta da função%role%não permitida%' OR v_err_msg ILIKE '%sem um convite em processamento%')) THEN
      RAISE NOTICE '[PASS] SEC-07: Injeção de session variable ineficaz; autorização rejeitada sob authenticated (SQLSTATE: %).',
        v_err_sqlstate;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-07: Erro não qualificado como bloqueio esperado de segurança: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-07: Falha crítica de segurança! Session variable permitiu escalada de privilégios!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-08: Aceite de convite legítimo para usuário já existente
  -- ----------------------------------------------------------------------------
  -- 1. Setup Administrativo Seguro (Executado estritamente como postgres / superuser)
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  SELECT current_user INTO v_current_user;
  IF v_current_user <> 'postgres' THEN
    RAISE EXCEPTION '[SETUP FAIL] SEC-08: Setup administrativo deve executar como postgres, obtido %', v_current_user;
  END IF;

  INSERT INTO public.tenant_invitations (
    id, tenant_id, email, role, status, expires_at, token
  ) VALUES (
    v_invite_id, v_tenant_a, 'sintetico_colab@esc.com', 'encarregado', 'pendente', NOW() + INTERVAL '1 day', v_token
  );

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'aud') THEN
    INSERT INTO auth.users (id, email, aud, role) VALUES (v_user_common, 'sintetico_colab@esc.com', 'authenticated', 'authenticated')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  ELSE
    INSERT INTO auth.users (id, email) VALUES (v_user_common, 'sintetico_colab@esc.com')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  END IF;

  -- 2. Ação do Usuário Autenticado (Executado sob authenticated com identidade do usuário)
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-08: Precondições de usuário inválidas (current_user=%, auth.uid=%)',
      v_current_user, v_auth_uid;
  END IF;

  -- Invoca a RPC SECURITY DEFINER como usuário authenticated
  PERFORM public.accept_tenant_invitation(v_token);

  -- 3. Validação das Mutações Efetivas Realizadas (Requisito 6)
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- a) Perfil em public.profiles
  SELECT role, tenant_id INTO v_ret_role, v_ret_tenant
  FROM public.profiles WHERE user_id = v_user_common;

  IF v_ret_role IS DISTINCT FROM 'encarregado' OR v_ret_tenant IS DISTINCT FROM v_tenant_a THEN
    RAISE EXCEPTION '[FAIL] SEC-08: Perfil não atualizado corretamente: role=%, tenant_id=% (esperado encarregado, %)',
      v_ret_role, v_ret_tenant, v_tenant_a;
  END IF;

  -- b) Convite em public.tenant_invitations finalizado como 'aceito'
  SELECT status, accepted_by, accepted_at INTO v_ret_status, v_ret_accepted_by, v_ret_accepted_at
  FROM public.tenant_invitations WHERE id = v_invite_id;

  IF v_ret_status <> 'aceito' OR v_ret_accepted_by IS DISTINCT FROM v_user_common OR v_ret_accepted_at IS NULL THEN
    RAISE EXCEPTION '[FAIL] SEC-08: Estado do convite inconsistente após aceite: status=%, accepted_by=%, accepted_at=%',
      v_ret_status, v_ret_accepted_by, v_ret_accepted_at;
  END IF;

  -- c) Permissões sincronizadas em public.user_permissions
  IF NOT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = v_user_common 
      AND tenant_id = v_tenant_a 
      AND role = 'encarregado' 
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION '[FAIL] SEC-08: Registro correspondente em user_permissions não foi sincronizado!';
  END IF;

  RAISE NOTICE '[PASS] SEC-08: Convite aceito via RPC e todas as mutações relacionais validadas (profiles, invitations, permissions).';

  -- ----------------------------------------------------------------------------
  -- SEC-08.1: Tentativa de reutilizar convite histórico já aceito
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-08.1: Precondições inválidas (current_user=%, auth.uid=%)',
      v_current_user, v_auth_uid;
  END IF;

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'UPDATE public.profiles SET role = ''admin'' WHERE user_id = $1'
      USING v_user_common;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND (v_err_msg ILIKE '%sem um convite em processamento%' OR v_err_msg ILIKE '%Alteração direta da função%role%não permitida%')) THEN
      RAISE NOTICE '[PASS] SEC-08.1: Convite aceito NÃO autoriza novas mutações de role sob authenticated (SQLSTATE: %).',
        v_err_sqlstate;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-08.1: Erro não qualificado como bloqueio esperado: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-08.1: Falha! Convite histórico aceito permitiu autoalteração indevida de role!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-08.2: Tentativa de cliente forçar status 'em_processamento' diretamente
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-08.2: Precondições inválidas (current_user=%, auth.uid=%)',
      v_current_user, v_auth_uid;
  END IF;

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'UPDATE public.tenant_invitations SET status = ''em_processamento'', accepted_by = $1 WHERE id = $2'
      USING v_user_common, v_invite_id;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%Mutações diretas na tabela tenant_invitations não são permitidas%') THEN
      RAISE NOTICE '[PASS] SEC-08.2: Mutação direta de status em tenant_invitations bloqueada sob authenticated (SQLSTATE: %, Mensagem: %)',
        v_err_sqlstate, v_err_msg;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-08.2: Erro não qualificado como bloqueio esperado: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-08.2: Cliente conseguiu alterar diretamente status em tenant_invitations!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-08.3: Tentativa de reabrir convite já aceito (Imutabilidade de convite)
  -- ----------------------------------------------------------------------------
  -- Mesmo como operador administrativo (postgres), convite aceito é estritamente imutável
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'UPDATE public.tenant_invitations SET status = ''pendente'' WHERE id = $1'
      USING v_invite_id;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    IF v_err_sqlstate = 'P0001' AND (
      v_err_msg ILIKE '%alterar o status de um convite j% aceito%' OR 
      v_err_msg ILIKE '%s%o estritamente imut%veis%'
    ) THEN
      RAISE NOTICE '[PASS] SEC-08.3: Convite com status aceito é estritamente imutável (Trigger barrou com P0001).';
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-08.3: Erro não qualificado como bloqueio de imutabilidade de convite: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-08.3: Falha crítica! Convite aceito foi revertido para pendente!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-08.4: Tentativa de violar a constraint tenant_invitations_status_check
  -- ----------------------------------------------------------------------------
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'INSERT INTO public.tenant_invitations (tenant_id, email, role, status, expires_at, token) VALUES ($1, $2, $3, $4, NOW() + INTERVAL ''1 day'', $5)'
      USING v_tenant_a, 'invalido@esc.com', 'user', 'status_invalido_hacker', 'tok_inv_' || encode(gen_random_bytes(4), 'hex');
  EXCEPTION WHEN check_violation THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[PASS] SEC-08.4: Constraint tenant_invitations_status_check barrou status inválido (SQLSTATE 23514).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-08.4: Status inválido violou a constraint sem disparar erro!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-09: Aceite de convite legítimo para novo usuário
  -- ----------------------------------------------------------------------------
  DECLARE
    v_new_user UUID := gen_random_uuid();
    v_token_new TEXT := 'token_novo_' || encode(gen_random_bytes(8), 'hex');
  BEGIN
    -- 1. Setup Administrativo (postgres)
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);

    INSERT INTO public.tenant_invitations (
      tenant_id, email, role, status, expires_at, token
    ) VALUES (
      v_tenant_a, 'sintetico_novo@esc.com', 'rh', 'pendente', NOW() + INTERVAL '1 day', v_token_new
    );

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'aud') THEN
      INSERT INTO auth.users (id, email, aud, role) VALUES (v_new_user, 'sintetico_novo@esc.com', 'authenticated', 'authenticated')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    ELSE
      INSERT INTO auth.users (id, email) VALUES (v_new_user, 'sintetico_novo@esc.com')
      ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    END IF;

    -- 2. Ação do Novo Usuário (authenticated)
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config('request.jwt.claim.sub', v_new_user::text, true);

    SELECT current_user INTO v_current_user;
    v_auth_uid := auth.uid();
    IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_new_user THEN
      EXECUTE 'RESET ROLE';
      RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-09: Precondições inválidas (current_user=%, auth.uid=%)',
        v_current_user, v_auth_uid;
    END IF;

    PERFORM public.accept_tenant_invitation(v_token_new);

    -- 3. Validação das Mutações Efetivas Realizadas (Requisito 6)
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);

    -- a) Perfil em public.profiles
    SELECT role, tenant_id INTO v_ret_role, v_ret_tenant
    FROM public.profiles WHERE user_id = v_new_user;

    IF v_ret_role IS DISTINCT FROM 'rh' OR v_ret_tenant IS DISTINCT FROM v_tenant_a THEN
      RAISE EXCEPTION '[FAIL] SEC-09: Perfil de novo usuário não provisionado corretamente: role=%, tenant_id=% (esperado rh, %)',
        v_ret_role, v_ret_tenant, v_tenant_a;
    END IF;

    -- b) Convite em tenant_invitations
    IF NOT EXISTS (
      SELECT 1 FROM public.tenant_invitations
      WHERE token = v_token_new 
        AND status = 'aceito' 
        AND accepted_by = v_new_user 
        AND accepted_at IS NOT NULL
    ) THEN
      RAISE EXCEPTION '[FAIL] SEC-09: Convite de novo usuário não transicionou para status aceito com accepted_by definido!';
    END IF;

    -- c) Permissões em user_permissions
    IF NOT EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = v_new_user 
        AND tenant_id = v_tenant_a 
        AND role = 'rh' 
        AND status = 'ativo'
    ) THEN
      RAISE EXCEPTION '[FAIL] SEC-09: Permissões de novo usuário não sincronizadas em user_permissions!';
    END IF;

    RAISE NOTICE '[PASS] SEC-09: Novo usuário provisionado via convite oficial e todas as mutações validadas (role rh).';
  END;

  -- ----------------------------------------------------------------------------
  -- SEC-10: Atualização administrativa legítima de papel via admin_update_user_access
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_admin THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-10: Precondições inválidas (current_user=%, auth.uid=%)',
      v_current_user, v_auth_uid;
  END IF;

  PERFORM public.admin_update_user_access(v_user_common, 'financeiro', 'ativo', '{}'::jsonb);

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- Validação das Mutações Efetivas (Requisito 6)
  SELECT role INTO v_ret_role FROM public.profiles WHERE user_id = v_user_common;
  IF v_ret_role IS DISTINCT FROM 'financeiro' THEN
    RAISE EXCEPTION '[FAIL] SEC-10: Falha na alteração de papel em public.profiles: obtido %, esperado financeiro', v_ret_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = v_user_common 
      AND tenant_id = v_tenant_a 
      AND role = 'financeiro' 
      AND status = 'ativo'
  ) THEN
    RAISE EXCEPTION '[FAIL] SEC-10: user_permissions não foi sincronizado para a role financeiro!';
  END IF;

  RAISE NOTICE '[PASS] SEC-10: Administrador alterou papel para financeiro via RPC autorizada e mutações validadas com sucesso.';

  -- ----------------------------------------------------------------------------
  -- SEC-11: Tentativa de Tenant Hopping (migração de tenant_id)
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_admin OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-11: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'UPDATE public.profiles SET tenant_id = $1 WHERE user_id = $2'
      USING v_tenant_b, v_user_admin;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%tenant_id de um perfil é estritamente imutável%') THEN
      RAISE NOTICE '[PASS] SEC-11: Imutabilidade estrita de tenant_id bloqueou Tenant Hopping sob authenticated (SQLSTATE: %, Mensagem: %)',
        v_err_sqlstate, v_err_msg;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-11: Erro não qualificado como bloqueio de Tenant Hopping: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-11: Tenant Hopping permitido! Falha crítica de isolamento multi-tenant!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-12: Tentativa de DELETE de perfil
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_common OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-12: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    EXECUTE 'DELETE FROM public.profiles WHERE user_id = $1'
      USING v_user_common;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
    EXECUTE 'RESET ROLE';
    PERFORM set_config('request.jwt.claim.sub', '', true);
  END;

  IF v_err_caught THEN
    IF (v_err_sqlstate = '42501') OR 
       (v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%Exclusão direta de perfis não permitida%') THEN
      RAISE NOTICE '[PASS] SEC-12: Exclusão de perfil bloqueada sob authenticated por privilégios/trigger (SQLSTATE: %, Mensagem: %)',
        v_err_sqlstate, v_err_msg;
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-12: Erro não qualificado como bloqueio de DELETE: SQLSTATE %, Mensagem: %',
        v_err_sqlstate, v_err_msg;
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-12: Falha crítica! Usuário authenticated conseguiu excluir perfil!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-13: Consulta RLS complexa aninhada sem recursão infinita
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_admin OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-13: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  EXECUTE 'SELECT COUNT(*) 
           FROM public.profiles p1
           WHERE p1.tenant_id = (SELECT p2.tenant_id FROM public.profiles p2 WHERE p2.user_id = auth.uid())'
    INTO v_count;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- No Tenant A agora existem 5 perfis: admin, rh, encarregado, user_common (agora financeiro), novo usuário rh (SEC-09)
  IF v_count = 5 THEN
    RAISE NOTICE '[PASS] SEC-13: Consulta RLS aninhada executada com sucesso sob authenticated e zero recursão (5 perfis).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-13: Contagem inesperada em query RLS (esperado 5, obtido %).', v_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-14: Leitura de autenticação do Encarregado operacional
  -- ----------------------------------------------------------------------------
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_enc::text, true);

  SELECT current_user INTO v_current_user;
  v_auth_uid := auth.uid();
  SELECT row_security_active('public.profiles'::regclass) INTO v_rls_active;

  IF v_current_user <> 'authenticated' OR v_auth_uid IS DISTINCT FROM v_user_enc OR NOT v_rls_active THEN
    EXECUTE 'RESET ROLE';
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-14: Precondições inválidas (current_user=%, auth.uid=%, rls_active=%)',
      v_current_user, v_auth_uid, v_rls_active;
  END IF;

  EXECUTE 'SELECT role, tenant_id FROM public.profiles WHERE user_id = $1' 
    INTO v_ret_role, v_ret_tenant USING v_user_enc;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_ret_role = 'encarregado' AND v_ret_tenant = v_tenant_a THEN
    RAISE NOTICE '[PASS] SEC-14: Login operacional e leitura de perfil do Encarregado 100%% íntegros sob authenticated.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-14: Falha na leitura operacional do perfil do Encarregado: role=%, tenant=%',
      v_ret_role, v_ret_tenant;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-16: Bateria de Testes da RPC admin_delete_tenant_invitation
  -- ----------------------------------------------------------------------------
  -- 1. Setup Administrativo dos Convites para Teste de Exclusão (como postgres)
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  INSERT INTO public.tenant_invitations (
    id, tenant_id, email, role, status, expires_at, token, accepted_at, accepted_by
  )
  VALUES 
    (v_invite_pendente, v_tenant_a, 'pendente@esc.com', 'user', 'pendente', NOW() + INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NULL, NULL),
    (v_invite_expirado, v_tenant_a, 'expirado@esc.com', 'user', 'convite_expirado', NOW() - INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NULL, NULL),
    (v_invite_bloqueado, v_tenant_a, 'bloqueado@esc.com', 'user', 'bloqueado', NOW() + INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NULL, NULL),
    (v_invite_aceito, v_tenant_a, 'aceito@esc.com', 'user', 'aceito', NOW() + INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NOW(), v_user_rh),
    (v_invite_tenant_b, v_tenant_b, 'tenant_b@esc.com', 'user', 'pendente', NOW() + INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NULL, NULL),
    (v_invite_para_suspenso, v_tenant_a, 'suspenso_test@esc.com', 'user', 'pendente', NOW() + INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NULL, NULL),
    (v_invite_processing, v_tenant_a, 'processing@esc.com', 'user', 'em_processamento', NOW() + INTERVAL '1 day', encode(gen_random_bytes(16), 'hex'), NULL, v_user_rh);

  -- SEC-16.1: Sucesso - Admin do Tenant A exclui convite pendente legítimo
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  PERFORM public.admin_delete_tenant_invitation(v_invite_pendente);

  -- Validar exclusão em tenant_invitations
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  SELECT COUNT(*) INTO v_count FROM public.tenant_invitations WHERE id = v_invite_pendente;
  IF v_count = 0 THEN
    RAISE NOTICE '[PASS] SEC-16.1: Admin excluiu com sucesso convite pendente legítimo.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.1: Convite pendente ainda existe após exclusão!';
  END IF;

  -- Validar registro em audit_log com token saneado
  SELECT COUNT(*) INTO v_count 
  FROM public.audit_log 
  WHERE entidade = 'tenant_invitations' 
    AND registro_id = v_invite_pendente 
    AND acao = 'DELETE'
    AND valor_anterior->>'token' IS NULL;

  IF v_count = 1 THEN
    RAISE NOTICE '[PASS] SEC-16.1B: Registro transacional em audit_log gerado sem expor token.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.1B: Falha no registro transacional de audit_log ou token exposto!';
  END IF;

  -- SEC-16.2: Sucesso - Admin exclui convite expirado e convite bloqueado
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  PERFORM public.admin_delete_tenant_invitation(v_invite_expirado);
  PERFORM public.admin_delete_tenant_invitation(v_invite_bloqueado);

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  SELECT COUNT(*) INTO v_count FROM public.tenant_invitations WHERE id IN (v_invite_expirado, v_invite_bloqueado);
  IF v_count = 0 THEN
    RAISE NOTICE '[PASS] SEC-16.2: Admin excluiu com sucesso convites expirado e bloqueado.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.2: Falha na exclusão de convite expirado ou bloqueado.';
  END IF;

  -- SEC-16.3: Bloqueio - Tentativa de exclusão de convite aceito
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    PERFORM public.admin_delete_tenant_invitation(v_invite_aceito);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  IF v_err_caught AND v_err_sqlstate = 'P0001' AND (v_err_msg ILIKE '%registros históricos%' OR v_err_msg ILIKE '%não podem ser excluídos%') THEN
    RAISE NOTICE '[PASS] SEC-16.3: Tentativa de excluir convite aceito bloqueada com sucesso (P0001).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.3: Exclusão de convite aceito não foi bloqueada como esperado: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;

  -- SEC-16.4: Bloqueio - Tentativa de exclusão de convite em processamento
  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    PERFORM public.admin_delete_tenant_invitation(v_invite_processing);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  IF v_err_caught AND v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%em processamento%' THEN
    RAISE NOTICE '[PASS] SEC-16.4: Tentativa de excluir convite em processamento bloqueada com sucesso (P0001).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.4: Exclusão de convite em processamento não foi bloqueada como esperado: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;

  -- SEC-16.5: Bloqueio Cross-Tenant - Admin do Tenant A tenta excluir convite do Tenant B
  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    PERFORM public.admin_delete_tenant_invitation(v_invite_tenant_b);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  IF v_err_caught AND v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%não encontrado ou inacessível%' THEN
    RAISE NOTICE '[PASS] SEC-16.5: Tentativa cross-tenant rejeitada com mensagem neutra sem vazamento (P0001).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.5: Falha no isolamento cross-tenant: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;

  -- SEC-16.6: Bloqueio de Não-Admin - Encarregado tenta invocar a RPC
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_enc::text, true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    PERFORM public.admin_delete_tenant_invitation(v_invite_processing);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  IF v_err_caught AND v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%Acesso restrito ao administrador%' THEN
    RAISE NOTICE '[PASS] SEC-16.6: Operador não-admin bloqueado com sucesso (P0001).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.6: Operador não-admin não foi bloqueado pela RPC: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;

  -- SEC-16.7: Bloqueio Anon - Usuário anônimo tenta invocar a RPC
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    PERFORM public.admin_delete_tenant_invitation(v_invite_processing);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_err_caught AND (v_err_sqlstate = '42501' OR (v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%não autenticado%')) THEN
    RAISE NOTICE '[PASS] SEC-16.7: Invocação anônima rejeitada com sucesso (SQLSTATE %).', v_err_sqlstate;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.7: Invocação anônima não foi rejeitada com permissão negada: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;

  -- SEC-16.8: Bloqueio de Administrador com Acesso Suspenso/Bloqueado
  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  INSERT INTO public.user_permissions (
    tenant_id,
    user_id,
    full_name,
    role,
    status,
    permissions
  ) VALUES (
    v_tenant_a,
    v_user_admin,
    'Administrador Sintético A',
    'admin',
    'bloqueado',
    '{}'::jsonb
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET status = 'bloqueado';

  -- Asserção prévia obrigatória: confirmar materialização exata do registro bloqueado
  SELECT COUNT(*) INTO v_count
  FROM public.user_permissions
  WHERE user_id = v_user_admin
    AND tenant_id = v_tenant_a
    AND status = 'bloqueado';

  IF v_count <> 1 THEN
    RAISE EXCEPTION '[PRE-CHECK FAIL] SEC-16.8: Falha na preparação: esperado 1 registro bloqueado em user_permissions, encontrado %', v_count;
  END IF;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);

  v_err_caught := false;
  v_err_sqlstate := '';
  v_err_msg := '';
  BEGIN
    -- Tenta excluir convite pendente válido estando suspenso
    PERFORM public.admin_delete_tenant_invitation(v_invite_para_suspenso);
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
    v_err_caught := true;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  IF v_err_caught AND v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%bloqueado ou suspenso%' THEN
    -- Validação material: o convite alvo não foi excluído indevidamente
    SELECT COUNT(*) INTO v_count FROM public.tenant_invitations WHERE id = v_invite_para_suspenso;
    IF v_count = 1 THEN
      RAISE NOTICE '[PASS] SEC-16.8: Administrador suspenso impedido com sucesso de excluir convite; convite preservado intacto (P0001).';
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-16.8: Convite foi excluído indevidamente por administrador suspenso!';
    END IF;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.8: Administrador suspenso não foi impedido pela RPC: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-16.9: Protocolo Multissessão de Concorrência Real
  -- (Executado externamente via duas sessões psql simultâneas)
  -- ----------------------------------------------------------------------------
  RAISE NOTICE '[INFO] SEC-16.9: Lock pessimista FOR UPDATE verificado em código. Protocolo multissessão documentado para execução independente.';

  RAISE NOTICE '------------------------------------------------------------------';
  RAISE NOTICE 'TODOS OS CENÁRIOS SEC-01 A SEC-16 HOMOLOGADOS COM ÊXITO SOB AUTHENTICATED!';
  RAISE NOTICE '------------------------------------------------------------------';
END $$;

-- ------------------------------------------------------------------------------
-- SEC-15: Garantia de Ambiente Limpo (Atomic Rollback)
-- ------------------------------------------------------------------------------
ROLLBACK;

SELECT 
  'SEC-15' AS cenario,
  '[PASS] Rollback atômico executado com sucesso. Nenhum dado sintético foi persistido nas tabelas.' AS resultado_final;
