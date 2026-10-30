-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 - VALIDAÇÃO DE INTEGRIDADE RELACIONAL
-- ==============================================================================
-- Objetivo: Auditar integridade relacional pós-concorrência em todas as tabelas
--           (tenant_invitations, profiles, user_permissions, audit_log).
-- Nota: A limpeza física final é executada de forma desacoplada via cleanup.sql.
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

  v_count INT;
  v_status TEXT;
  v_accepted_at TIMESTAMPTZ;
  v_role TEXT;
BEGIN
  -- ============================================================================
  -- 1. VALIDAÇÃO DE INTEGRIDADE: CENÁRIO 1 (EXCLUSÃO VENCE / ACEITE REJEITADO)
  -- ============================================================================

  -- 1.1. O convite C1 foi fisicamente excluído pela Sessão 1
  SELECT COUNT(*) INTO v_count FROM public.tenant_invitations WHERE id = v_invite_c1;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Convite C1 ainda existe após exclusão concorrente vencedora!';
  END IF;

  -- 1.2. Nenhum perfil foi provisionado ou alterado para o Convidado C1
  SELECT COUNT(*) INTO v_count FROM public.profiles WHERE user_id = v_user_c1;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Perfil foi provisionado indevidamente para Convidado C1!';
  END IF;

  -- 1.3. Nenhuma permissão foi concedida em user_permissions para C1
  SELECT COUNT(*) INTO v_count FROM public.user_permissions WHERE user_id = v_user_c1;
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Permissões foram concedidas indevidamente para Convidado C1!';
  END IF;

  -- 1.4. Audit Log registrou a exclusão transacional com token saneado
  SELECT COUNT(*) INTO v_count
  FROM public.audit_log
  WHERE entidade = 'tenant_invitations'
    AND registro_id = v_invite_c1
    AND acao = 'DELETE'
    AND valor_anterior->>'token' IS NULL;

  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Registro em audit_log da exclusão C1 ausente ou token vazado!';
  END IF;

  RAISE NOTICE '[PASS] SEC-16.9 Integridade Cenario 1: Exclusão persistida, convite removido, zero vazamento relacional.';

  -- ============================================================================
  -- 2. VALIDAÇÃO DE INTEGRIDADE: CENÁRIO 2 (ACEITE VENCE / EXCLUSÃO REJEITADA)
  -- ============================================================================

  -- 2.1. O convite C2 foi preservado com status 'aceito' e accepted_at definido
  SELECT status, accepted_at INTO v_status, v_accepted_at
  FROM public.tenant_invitations
  WHERE id = v_invite_c2;

  IF v_status <> 'aceito' OR v_accepted_at IS NULL THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Convite C2 não está com status aceito (Status: %, AcceptedAt: %)',
      v_status, v_accepted_at;
  END IF;

  -- 2.2. Perfil para Convidado C2 foi provisionado com a role 'rh'
  SELECT role INTO v_role FROM public.profiles WHERE user_id = v_user_c2 AND tenant_id = v_tenant_conc;
  IF v_role <> 'rh' THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Perfil de C2 não foi promovido para role rh (Role: %)', v_role;
  END IF;

  -- 2.3. Permissões de C2 sincronizadas em user_permissions com status 'ativo'
  SELECT COUNT(*) INTO v_count
  FROM public.user_permissions
  WHERE user_id = v_user_c2 AND tenant_id = v_tenant_conc AND role = 'rh' AND status = 'ativo';

  IF v_count <> 1 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: user_permissions de C2 não sincronizado como rh ativo!';
  END IF;

  -- 2.4. Nenhum registro de exclusão DELETE foi gravado em audit_log para C2
  SELECT COUNT(*) INTO v_count
  FROM public.audit_log
  WHERE entidade = 'tenant_invitations' AND registro_id = v_invite_c2 AND acao = 'DELETE';

  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Integridade: Registro indevido de DELETE em audit_log para convite aceito C2!';
  END IF;

  RAISE NOTICE '[PASS] SEC-16.9 Integridade Cenario 2: Aceite persistido integralmente, convite protegido contra exclusão.';
END $$;
