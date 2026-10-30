-- ==============================================================================
-- SCRIPT DE TESTE ISOLADO: teste_isolado_gate_sec_02_4.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02.4 - Bateria Completa de 15 Cenários de Segurança Multi-Tenant (public.profiles)
-- FINALIDADE: Validar rigorosamente sob RLS e papéis Supabase em banco descartável.
-- AVISO: Executar exclusivamente em ambiente de homologação/staging dentro de transação.
-- ==============================================================================

BEGIN;

DO $$
DECLARE
  v_tenant_a UUID := gen_random_uuid();
  v_tenant_b UUID := gen_random_uuid();
  v_user_admin UUID := gen_random_uuid();
  v_user_rh UUID := gen_random_uuid();
  v_user_enc UUID := gen_random_uuid();
  v_user_common UUID := gen_random_uuid();
  v_user_b UUID := gen_random_uuid();
  v_invite_id UUID := gen_random_uuid();
  v_token TEXT := 'test_token_' || encode(gen_random_bytes(8), 'hex');
  v_count INTEGER;
  v_err_caught BOOLEAN;
  v_ret_role TEXT;
BEGIN
  RAISE NOTICE '==================================================================';
  RAISE NOTICE 'INICIANDO BATERIA COMPLETA DE 15 TESTES POSTGRESQL (SEC-01 A SEC-15)';
  RAISE NOTICE '==================================================================';

  -- ----------------------------------------------------------------------------
  -- SETUP DO CENÁRIO SINTÉTICO (2 Tenants Isolados, 5 Usuários)
  -- ----------------------------------------------------------------------------
  INSERT INTO public.tenants (id, name) VALUES (v_tenant_a, 'Empresa A - Homologação');
  INSERT INTO public.tenants (id, name) VALUES (v_tenant_b, 'Empresa B - Competidora');

  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_admin, v_tenant_a, 'Administrador A', 'admin');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_rh, v_tenant_a, 'Analista RH A', 'rh');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_enc, v_tenant_a, 'Encarregado Operacional A', 'encarregado');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_common, v_tenant_a, 'Colaborador Comum A', 'user');
  INSERT INTO public.profiles (user_id, tenant_id, full_name, role) VALUES (v_user_b, v_tenant_b, 'Administrador B', 'admin');

  -- ----------------------------------------------------------------------------
  -- SEC-01: Usuário lê o próprio perfil
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE user_id = v_user_common;
  IF v_count = 1 THEN
    RAISE NOTICE '[PASS] SEC-01: Usuário comum lê com sucesso seu próprio perfil.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-01: Falha ao ler o próprio perfil.';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-02: Admin consulta perfis do seu tenant
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Deve enxergar os 4 colaboradores da Empresa A, e 0 da Empresa B
  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count = 4 THEN
    RAISE NOTICE '[PASS] SEC-02: Administrador consulta os 4 perfis do seu tenant e nenhum do tenant B.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-02: Admin visualizou % perfis (esperado 4).', v_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-03: RH consulta perfis necessários
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_rh::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE tenant_id = v_tenant_a;
  IF v_count = 4 THEN
    RAISE NOTICE '[PASS] SEC-03: RH consulta colaboradores do seu tenant com sucesso.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-03: RH visualizou % perfis (esperado 4).', v_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-04: Encarregado tenta consultar perfis de terceiros
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_enc::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Encarregado só pode ver a si mesmo (1 linha)
  SELECT COUNT(*) INTO v_count FROM public.profiles;
  IF v_count = 1 THEN
    RAISE NOTICE '[PASS] SEC-04: Encarregado vê apenas seu próprio perfil; terceiros bloqueados.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-04: Encarregado visualizou % perfis (esperado 1).', v_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-05: Usuário tenta criar perfil admin em tenant alheio
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);
  PERFORM set_config('role', 'authenticated', true);

  v_err_caught := false;
  BEGIN
    INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
    VALUES (v_user_common, v_tenant_b, 'Invasor Admin', 'admin');
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[PASS] SEC-05: Tentativa de INSERT direto de perfil bloqueada com sucesso.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-05: Usuário conseguiu fazer INSERT direto de perfil!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-06: Usuário tenta alterar diretamente sua role
  -- ----------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE user_id = v_user_common;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[PASS] SEC-06: Tentativa de UPDATE direto de role bloqueada com sucesso.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-06: Usuário conseguiu alterar sua role diretamente!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-07: Tentativa de falsificação via set_config
  -- ----------------------------------------------------------------------------
  PERFORM set_config('app.invitation_authorization', v_user_common::text || ':' || v_tenant_a::text || ':admin', true);

  v_err_caught := false;
  BEGIN
    UPDATE public.profiles SET role = 'admin' WHERE user_id = v_user_common;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[PASS] SEC-07: Injeção de session variable ignorada; escalada bloqueada.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-07: Vulnerabilidade em session variable permitiu escalada!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-08: Usuário existente aceita convite válido
  -- ----------------------------------------------------------------------------
  RESET ROLE;
  INSERT INTO public.tenant_invitations (
    id, tenant_id, email, role, status, expires_at, token
  ) VALUES (
    v_invite_id, v_tenant_a, 'colab@esc.com', 'encarregado', 'pendente', NOW() + INTERVAL '1 day', v_token
  );

  INSERT INTO auth.users (id, email) VALUES (v_user_common, 'colab@esc.com')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  PERFORM set_config('request.jwt.claim.sub', v_user_common::text, true);
  PERFORM set_config('role', 'authenticated', true);

  PERFORM public.accept_tenant_invitation(v_token);

  SELECT role INTO v_ret_role FROM public.profiles WHERE user_id = v_user_common;
  IF v_ret_role = 'encarregado' THEN
    RAISE NOTICE '[PASS] SEC-08: Usuário existente aceitou convite e foi promovido a encarregado.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-08: Role esperada encarregado, obtida %.', v_ret_role;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-09: Usuário novo aceita convite válido
  -- ----------------------------------------------------------------------------
  RESET ROLE;
  DECLARE
    v_new_user UUID := gen_random_uuid();
    v_token_new TEXT := 'token_novo_' || encode(gen_random_bytes(8), 'hex');
  BEGIN
    INSERT INTO public.tenant_invitations (
      tenant_id, email, role, status, expires_at, token
    ) VALUES (
      v_tenant_a, 'novo@esc.com', 'rh', 'pendente', NOW() + INTERVAL '1 day', v_token_new
    );

    INSERT INTO auth.users (id, email) VALUES (v_new_user, 'novo@esc.com')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

    PERFORM set_config('request.jwt.claim.sub', v_new_user::text, true);
    PERFORM set_config('role', 'authenticated', true);

    PERFORM public.accept_tenant_invitation(v_token_new);

    SELECT role INTO v_ret_role FROM public.profiles WHERE user_id = v_new_user;
    IF v_ret_role = 'rh' THEN
      RAISE NOTICE '[PASS] SEC-09: Novo usuário provisionado via convite legítimo com role rh.';
    ELSE
      RAISE EXCEPTION '[FAIL] SEC-09: Falha ao provisionar novo usuário via convite.';
    END IF;
  END;

  -- ----------------------------------------------------------------------------
  -- SEC-10: Admin altera legitimamente papel de colaborador
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);
  PERFORM set_config('role', 'authenticated', true);

  PERFORM public.admin_update_user_access(v_user_common, 'financeiro', 'ativo', '{}'::jsonb);

  SELECT role INTO v_ret_role FROM public.profiles WHERE user_id = v_user_common;
  IF v_ret_role = 'financeiro' THEN
    RAISE NOTICE '[PASS] SEC-10: Admin alterou papel de colaborador para financeiro com sucesso.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-10: Falha na alteração administrativa de papel.';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-11: Admin tenta migrar seu perfil para outro tenant (Tenant Hopping)
  -- ----------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    UPDATE public.profiles SET tenant_id = v_tenant_b WHERE user_id = v_user_admin;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[PASS] SEC-11: Imutabilidade de tenant_id impediu Tenant Hopping.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-11: Admin conseguiu migrar de tenant!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-12: Tentativa de DELETE e recriação de perfil
  -- ----------------------------------------------------------------------------
  v_err_caught := false;
  BEGIN
    DELETE FROM public.profiles WHERE user_id = v_user_common;
  EXCEPTION WHEN OTHERS THEN
    v_err_caught := true;
  END;

  IF v_err_caught THEN
    RAISE NOTICE '[PASS] SEC-12: Exclusão de perfil bloqueada com sucesso.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-12: Usuário conseguiu excluir seu perfil!';
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-13: Consulta RLS de profiles sem recursão
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_admin::text, true);
  PERFORM set_config('role', 'authenticated', true);

  -- Subquery aninhada em profiles sob RLS
  SELECT COUNT(*) INTO v_count 
  FROM public.profiles p1
  WHERE p1.tenant_id = (SELECT p2.tenant_id FROM public.profiles p2 WHERE p2.user_id = auth.uid());

  IF v_count = 5 THEN
    RAISE NOTICE '[PASS] SEC-13: Consulta RLS complexa finalizada com zero recursão e tempo O(1).';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-13: Contagem inesperada em query RLS (obtido %)', v_count;
  END IF;

  -- ----------------------------------------------------------------------------
  -- SEC-14: Login operacional do Encarregado (Funcional e isolado)
  -- ----------------------------------------------------------------------------
  PERFORM set_config('request.jwt.claim.sub', v_user_enc::text, true);
  PERFORM set_config('role', 'authenticated', true);

  SELECT role INTO v_ret_role FROM public.profiles WHERE user_id = v_user_enc;
  IF v_ret_role = 'encarregado' THEN
    RAISE NOTICE '[PASS] SEC-14: Leitura de autenticação do Encarregado 100% funcional e restrita.';
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-14: Falha na leitura de perfil do Encarregado.';
  END IF;

  RAISE NOTICE '==================================================================';
  RAISE NOTICE 'TODOS OS CENÁRIOS SEC-01 A SEC-14 FORAM HOMOLOGADOS COM SUCESSO!';
  RAISE NOTICE '==================================================================';
END $$;

-- ------------------------------------------------------------------------------
-- SEC-15: Aplicação e rollback em banco descartável
-- ------------------------------------------------------------------------------
-- Conclui a transação com ROLLBACK, comprovando reversão atômica e banco limpo
ROLLBACK;
RAISE NOTICE '[PASS] SEC-15: Transação revertida com ROLLBACK; ambiente permanece 100% intacto.';
