-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 SETUP (PREPARAÇÃO DE CONCORRÊNCIA REAL)
-- ==============================================================================
-- Objetivo: Provisionar massa sintética dedicada para testes multissessão
--           entre admin_delete_tenant_invitation(UUID) e accept_tenant_invitation(token).
-- Executado exclusivamente no container Docker 'supabase_db_sec02_hml'.
-- ==============================================================================

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_tenant_conc UUID := '16000000-0000-0000-0000-000000000001'::uuid;
  v_admin_conc  UUID := '16000000-0000-0000-0000-000000000002'::uuid;
  v_user_c1     UUID := '16000000-0000-0000-0000-000000000003'::uuid;
  v_user_c2     UUID := '16000000-0000-0000-0000-000000000004'::uuid;

  v_invite_c1   UUID := '16000000-0000-0000-0000-000000000011'::uuid;
  v_invite_c2   UUID := '16000000-0000-0000-0000-000000000012'::uuid;
BEGIN
  -- 1. Verificação Estrita Anti-Produção no Banco Local
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('colaboradores', 'empresas', 'operacoes', 'lancamentos_diaristas', 'registros_ponto')
  ) THEN
    RAISE EXCEPTION '[ABORT FATAL] Tabelas reais do ERP detectadas! Proibido executar em ambiente com dados de negocio.';
  END IF;

  -- 2. Limpeza prévia de resíduos com os mesmos IDs determinísticos
  DELETE FROM public.tenant_invitations WHERE id IN (v_invite_c1, v_invite_c2);
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant_conc;
  DELETE FROM public.user_permissions WHERE tenant_id = v_tenant_conc;
  DELETE FROM public.profiles WHERE tenant_id = v_tenant_conc OR user_id IN (v_admin_conc, v_user_c1, v_user_c2);
  DELETE FROM public.tenants WHERE id = v_tenant_conc;
  DELETE FROM auth.users WHERE id IN (v_admin_conc, v_user_c1, v_user_c2);

  -- 3. Inserir Tenant Sintético de Concorrência
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'name') THEN
    INSERT INTO public.tenants (id, name) VALUES (v_tenant_conc, 'Empresa Concorrencia Local');
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'nome') THEN
    INSERT INTO public.tenants (id, nome) VALUES (v_tenant_conc, 'Empresa Concorrencia Local');
  ELSE
    INSERT INTO public.tenants (id) VALUES (v_tenant_conc);
  END IF;

  -- 4. Inserir Usuários em auth.users
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'aud') THEN
    INSERT INTO auth.users (id, email, aud, role) VALUES
      (v_admin_conc, 'admin_conc@esc.com',      'authenticated', 'authenticated'),
      (v_user_c1,    'convidado1_conc@esc.com', 'authenticated', 'authenticated'),
      (v_user_c2,    'convidado2_conc@esc.com', 'authenticated', 'authenticated');
  ELSE
    INSERT INTO auth.users (id, email) VALUES
      (v_admin_conc, 'admin_conc@esc.com'),
      (v_user_c1,    'convidado1_conc@esc.com'),
      (v_user_c2,    'convidado2_conc@esc.com');
  END IF;

  -- 5. Inserir Perfil do Administrador
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
  VALUES (v_admin_conc, v_tenant_conc, 'Admin Concorrencia', 'admin');

  -- 6. Inserir Permissões Ativas do Administrador
  INSERT INTO public.user_permissions (tenant_id, user_id, full_name, role, status, permissions)
  VALUES (v_tenant_conc, v_admin_conc, 'Admin Concorrencia', 'admin', 'ativo', '{}'::jsonb);

  -- 7. Inserir Convites Pendentes
  -- Convite 1: Cenário Exclusão Vence vs Aceite Bloqueado
  INSERT INTO public.tenant_invitations (
    id, tenant_id, email, role, status, expires_at, token
  ) VALUES (
    v_invite_c1, v_tenant_conc, 'convidado1_conc@esc.com', 'user', 'pendente', NOW() + INTERVAL '1 day', 'tok_conc_cenario_01_delete_wins'
  );

  -- Convite 2: Cenário Aceite Vence vs Exclusão Bloqueada
  INSERT INTO public.tenant_invitations (
    id, tenant_id, email, role, status, expires_at, token
  ) VALUES (
    v_invite_c2, v_tenant_conc, 'convidado2_conc@esc.com', 'rh', 'pendente', NOW() + INTERVAL '1 day', 'tok_conc_cenario_02_accept_wins'
  );

  RAISE NOTICE '[OK] SETUP SEC-16.9: Massa sintetica de concorrencia provisionada com sucesso.';
END $$;
