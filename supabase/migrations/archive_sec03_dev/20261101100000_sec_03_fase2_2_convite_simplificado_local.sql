-- ==============================================================================
-- ORBE — SEC-03: FASE 02.2 — Onboarding Local & Convite Manual Simplificado
-- Data: 2026-11-01
-- Descrição:
--   1. Schema seguro 'private' e tabela 'private.sec03_settings' para segredo HMAC backend.
--   2. Overload administrativo: admin_create_invitation_with_activation_code (sem segredo do cliente).
--   3. Overload administrativo: admin_issue_new_activation_code (sem segredo do cliente).
--   4. Hardening de sec03_verify_invitation_activation_code com desempate determinístico.
--   5. Fix e overload de aceite: accept_tenant_invitation(token) e accept_tenant_invitation(token, user_id).
-- ==============================================================================

BEGIN;

-- 1. Schema privado inacessível por anon e authenticated
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT ALL ON SCHEMA private TO service_role, postgres;

CREATE TABLE IF NOT EXISTS private.sec03_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE private.sec03_settings FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.sec03_settings TO service_role, postgres;

-- Inserir chave HMAC do backend se não existir
INSERT INTO private.sec03_settings (key, value)
VALUES ('hmac_secret', 'backend_super_secret_master_key_for_hmac_sha256_orbe_2026')
ON CONFLICT (key) DO NOTHING;

-- 2. RPC Administrativa de Criação (6 argumentos - sem segredo no frontend)
CREATE OR REPLACE FUNCTION public.admin_create_invitation_with_activation_code(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_permissions JSONB,
  p_expires_at TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM private.sec03_settings WHERE key = 'hmac_secret';
  IF v_secret IS NULL THEN
    v_secret := 'backend_super_secret_master_key_for_hmac_sha256_orbe_2026';
  END IF;

  RETURN public.admin_create_invitation_with_activation_code(
    p_full_name,
    p_email,
    p_phone,
    p_role,
    p_permissions,
    p_expires_at,
    v_secret,
    'v1'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO authenticated, service_role;

-- 3. RPC Administrativa de Reemissão (1 argumento - sem segredo no frontend)
CREATE OR REPLACE FUNCTION public.admin_issue_new_activation_code(
  p_invitation_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM private.sec03_settings WHERE key = 'hmac_secret';
  IF v_secret IS NULL THEN
    v_secret := 'backend_super_secret_master_key_for_hmac_sha256_orbe_2026';
  END IF;

  RETURN public.admin_issue_new_activation_code(
    p_invitation_id,
    v_secret,
    'v1'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_issue_new_activation_code(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_new_activation_code(UUID) TO authenticated, service_role;

-- 4. Hardening de sec03_verify_invitation_activation_code (3 argumentos) com ordenação determinística
CREATE OR REPLACE FUNCTION public.sec03_verify_invitation_activation_code(
  p_token TEXT,
  p_code TEXT,
  p_server_secret TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_invitation public.tenant_invitations%ROWTYPE;
  v_challenge public.tenant_invitation_challenges%ROWTYPE;
  v_expected_hmac TEXT;
  v_clean_code TEXT;
  v_remaining INTEGER;
  v_total_attempts INTEGER;
BEGIN
  v_clean_code := btrim(COALESCE(p_code, ''));

  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Token de convite inválido';
  END IF;

  IF length(v_clean_code) <> 6 OR v_clean_code !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'O código de ativação deve conter exatamente 6 dígitos numéricos.';
  END IF;

  IF p_server_secret IS NULL OR length(btrim(p_server_secret)) < 32 THEN
    RAISE EXCEPTION 'Chave secreta do servidor inválida.';
  END IF;

  -- 1. Validar e travar o convite
  SELECT *
  INTO v_invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND status = 'pendente'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, revogado ou expirado';
  END IF;

  -- 2. Limite cumulativo de tentativas do convite nas últimas 24h
  SELECT COALESCE(sum(attempts), 0)
  INTO v_total_attempts
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_total_attempts >= 15 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'MAX_GLOBAL_ATTEMPTS_EXCEEDED',
      'message', 'Convite bloqueado por excesso de tentativas incorretas. Contate o administrador.',
      'remaining_attempts', 0,
      'blocked', true
    );
  END IF;

  -- 3. Localizar desafio pendente com lock pessimista
  SELECT *
  INTO v_challenge
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
    AND status = 'pendente'
  ORDER BY updated_at DESC, created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT *
    INTO v_challenge
    FROM public.tenant_invitation_challenges
    WHERE invitation_id = v_invitation.id
      AND status IN ('bloqueado_tentativas', 'verificado')
    ORDER BY updated_at DESC, created_at DESC, id DESC
    LIMIT 1;

    IF FOUND AND v_challenge.status = 'bloqueado_tentativas' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'MAX_ATTEMPTS_EXCEEDED',
        'message', 'Limite de tentativas excedido para este código. Solicite um novo código ao administrador.',
        'remaining_attempts', 0,
        'blocked', true
      );
    ELSIF FOUND AND v_challenge.status = 'verificado' THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'ALREADY_VERIFIED',
        'message', 'Este código de ativação já foi validado. Prossiga para a criação de senha.',
        'remaining_attempts', 0,
        'blocked', false
      );
    ELSE
      RETURN jsonb_build_object(
        'success', false,
        'error', 'NO_ACTIVE_CHALLENGE',
        'message', 'Nenhum código de ativação ativo encontrado. Solicite um novo código.',
        'remaining_attempts', 0,
        'blocked', false
      );
    END IF;
  END IF;

  -- 4. Verificar expiração temporal (10 minutos)
  IF v_challenge.expires_at <= NOW() THEN
    UPDATE public.tenant_invitation_challenges
    SET status = 'expirado', updated_at = NOW()
    WHERE id = v_challenge.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'EXPIRED_CODE',
      'message', 'O código de ativação expirou. Solicite um novo código ao administrador.',
      'remaining_attempts', 0,
      'blocked', false
    );
  END IF;

  -- 5. Verificar limite de tentativas do desafio individual (5 tentativas)
  IF v_challenge.attempts >= v_challenge.max_attempts THEN
    UPDATE public.tenant_invitation_challenges
    SET status = 'bloqueado_tentativas', updated_at = NOW()
    WHERE id = v_challenge.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'MAX_ATTEMPTS_EXCEEDED',
      'message', 'Limite de tentativas excedido para este código.',
      'remaining_attempts', 0,
      'blocked', true
    );
  END IF;

  -- 6. Validar HMAC-SHA-256
  v_expected_hmac := encode(extensions.hmac(v_clean_code || ':' || v_invitation.id::TEXT || ':' || v_challenge.salt, p_server_secret, 'sha256'), 'hex');

  IF v_challenge.code_hash <> v_expected_hmac THEN
    UPDATE public.tenant_invitation_challenges
    SET
      attempts = attempts + 1,
      updated_at = NOW(),
      status = CASE WHEN attempts + 1 >= max_attempts THEN 'bloqueado_tentativas' ELSE 'pendente' END
    WHERE id = v_challenge.id;

    v_remaining := v_challenge.max_attempts - (v_challenge.attempts + 1);

    INSERT INTO public.audit_log (
      tenant_id,
      acao,
      entidade,
      registro_id,
      descricao,
      origem
    ) VALUES (
      v_invitation.tenant_id,
      'ACTIVATION_CODE_FAILED_ATTEMPT',
      'tenant_invitations',
      v_invitation.id,
      format('Tentativa incorreta de código de ativação para convite %s (restam %s tentativas).', v_invitation.id, GREATEST(0, v_remaining)),
      'ONBOARDING_SEC03'
    );

    RETURN jsonb_build_object(
      'success', false,
      'error', CASE WHEN v_remaining <= 0 THEN 'MAX_ATTEMPTS_EXCEEDED' ELSE 'INVALID_CODE' END,
      'message', CASE 
        WHEN v_remaining <= 0 THEN 'Código incorreto. Limite máximo de tentativas atingido. Solicite um novo código.'
        ELSE format('Código incorreto. Você possui mais %s tentativa(s).', v_remaining)
      END,
      'remaining_attempts', GREATEST(0, v_remaining),
      'blocked', (v_remaining <= 0)
    );
  END IF;

  -- 7. Sucesso: Marcar desafio como verificado
  UPDATE public.tenant_invitation_challenges
  SET
    status = 'verificado',
    verified_at = NOW(),
    updated_at = NOW()
  WHERE id = v_challenge.id;

  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    descricao,
    origem
  ) VALUES (
    v_invitation.tenant_id,
    'ACTIVATION_CODE_VERIFIED_SUCCESS',
    'tenant_invitations',
    v_invitation.id,
    format('Código de ativação validado com sucesso para o convite %s.', v_invitation.id),
    'ONBOARDING_SEC03'
  );

  RETURN jsonb_build_object(
    'success', true,
    'verified', true,
    'challenge_id', v_challenge.id,
    'message', 'Código de ativação validado com sucesso. Prossiga para a definição de senha.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT) TO service_role;

-- Overload de sec03_verify_invitation_activation_code (2 argumentos)
CREATE OR REPLACE FUNCTION public.sec03_verify_invitation_activation_code(
  p_token TEXT,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM private.sec03_settings WHERE key = 'hmac_secret';
  IF v_secret IS NULL THEN
    v_secret := 'backend_super_secret_master_key_for_hmac_sha256_orbe_2026';
  END IF;

  RETURN public.sec03_verify_invitation_activation_code(
    p_token,
    p_code,
    v_secret
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.sec03_verify_invitation_activation_code(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec03_verify_invitation_activation_code(TEXT, TEXT) TO anon, authenticated, service_role;

-- 5. Fix de accept_tenant_invitation(TEXT) usando coluna 'telefone' em profiles
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  p_user_id UUID := auth.uid();
  invitation public.tenant_invitations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  v_verified_challenge public.tenant_invitation_challenges%ROWTYPE;
  profile_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- 1. Buscar e travar o convite
  SELECT *
  INTO invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND status = 'pendente'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, bloqueado ou expirado';
  END IF;

  -- 2. BLOQUEIO DE BYPASS (SEC-03): Exigir desafio no estado 'verificado' há menos de 15 minutos
  SELECT *
  INTO v_verified_challenge
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = invitation.id
    AND status = 'verificado'
    AND verified_at > NOW() - INTERVAL '15 minutes'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A ativação requer a validação prévia do código de ativação temporário.';
  END IF;

  -- 3. Validar correspondência estrita de e-mail do usuário autenticado
  IF lower(invitation.email) <> lower((SELECT email FROM auth.users WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
  END IF;

  -- 4. Transicionar status do convite
  UPDATE public.tenant_invitations
  SET
    status = 'em_processamento',
    accepted_by = p_user_id
  WHERE id = invitation.id;

  -- 5. Verificar e associar perfil
  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF FOUND THEN
    IF existing_profile.tenant_id IS NOT NULL AND existing_profile.tenant_id <> invitation.tenant_id THEN
      RAISE EXCEPTION 'Este usuário já possui vínculo com outra empresa.';
    END IF;

    UPDATE public.profiles
    SET
      tenant_id = invitation.tenant_id,
      role = lower(invitation.role),
      full_name = COALESCE(NULLIF(invitation.full_name, ''), existing_profile.full_name),
      telefone = COALESCE(NULLIF(invitation.phone, ''), existing_profile.telefone),
      updated_at = NOW()
    WHERE user_id = p_user_id;
    profile_id := existing_profile.id;
  ELSE
    INSERT INTO public.profiles (
      user_id,
      tenant_id,
      role,
      full_name,
      telefone
    ) VALUES (
      p_user_id,
      invitation.tenant_id,
      lower(invitation.role),
      NULLIF(invitation.full_name, ''),
      NULLIF(invitation.phone, '')
    ) RETURNING id INTO profile_id;
  END IF;

  -- 6. Sincronizar permissões detalhadas
  INSERT INTO public.user_permissions (
    tenant_id,
    user_id,
    full_name,
    phone,
    role,
    status,
    permissions,
    invited_at,
    accepted_at
  ) VALUES (
    invitation.tenant_id,
    p_user_id,
    COALESCE(NULLIF(invitation.full_name, ''), (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)),
    invitation.phone,
    lower(invitation.role),
    'ativo',
    COALESCE(invitation.permissions, '{}'::jsonb),
    invitation.created_at,
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
    phone = COALESCE(EXCLUDED.phone, public.user_permissions.phone),
    role = EXCLUDED.role,
    status = 'ativo',
    permissions = EXCLUDED.permissions,
    accepted_at = EXCLUDED.accepted_at,
    updated_at = NOW();

  -- 7. Consumir definitivamente o desafio temporário
  UPDATE public.tenant_invitation_challenges
  SET
    status = 'consumido',
    consumed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_verified_challenge.id;

  -- 8. Finalizar o ciclo do convite
  UPDATE public.tenant_invitations
  SET
    status = 'aceito',
    accepted_at = NOW()
  WHERE id = invitation.id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated, service_role;

-- 6. Overload de accept_tenant_invitation(TEXT, UUID) exclusivo para service_role
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
  p_token TEXT,
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  invitation public.tenant_invitations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  v_verified_challenge public.tenant_invitation_challenges%ROWTYPE;
  profile_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não especificado';
  END IF;

  -- 1. Buscar e travar o convite
  SELECT *
  INTO invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND status = 'pendente'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, bloqueado ou expirado';
  END IF;

  -- 2. BLOQUEIO DE BYPASS (SEC-03): Exigir desafio no estado 'verificado' há menos de 15 minutos
  SELECT *
  INTO v_verified_challenge
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = invitation.id
    AND status = 'verificado'
    AND verified_at > NOW() - INTERVAL '15 minutes'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'A ativação requer a validação prévia do código de ativação temporário.';
  END IF;

  -- 3. Validar correspondência estrita de e-mail do usuário
  IF lower(invitation.email) <> lower((SELECT email FROM auth.users WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
  END IF;

  -- 4. Transicionar status do convite
  UPDATE public.tenant_invitations
  SET
    status = 'em_processamento',
    accepted_by = p_user_id
  WHERE id = invitation.id;

  -- 5. Verificar e associar perfil
  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF FOUND THEN
    IF existing_profile.tenant_id IS NOT NULL AND existing_profile.tenant_id <> invitation.tenant_id THEN
      RAISE EXCEPTION 'Este usuário já possui vínculo com outra empresa.';
    END IF;

    UPDATE public.profiles
    SET
      tenant_id = invitation.tenant_id,
      role = lower(invitation.role),
      full_name = COALESCE(NULLIF(invitation.full_name, ''), existing_profile.full_name),
      telefone = COALESCE(NULLIF(invitation.phone, ''), existing_profile.telefone),
      updated_at = NOW()
    WHERE user_id = p_user_id;
    profile_id := existing_profile.id;
  ELSE
    INSERT INTO public.profiles (
      user_id,
      tenant_id,
      role,
      full_name,
      telefone
    ) VALUES (
      p_user_id,
      invitation.tenant_id,
      lower(invitation.role),
      NULLIF(invitation.full_name, ''),
      NULLIF(invitation.phone, '')
    ) RETURNING id INTO profile_id;
  END IF;

  -- 6. Sincronizar permissões detalhadas
  INSERT INTO public.user_permissions (
    tenant_id,
    user_id,
    full_name,
    phone,
    role,
    status,
    permissions,
    invited_at,
    accepted_at
  ) VALUES (
    invitation.tenant_id,
    p_user_id,
    COALESCE(NULLIF(invitation.full_name, ''), (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)),
    invitation.phone,
    lower(invitation.role),
    'ativo',
    COALESCE(invitation.permissions, '{}'::jsonb),
    invitation.created_at,
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
    phone = COALESCE(EXCLUDED.phone, public.user_permissions.phone),
    role = EXCLUDED.role,
    status = 'ativo',
    permissions = EXCLUDED.permissions,
    accepted_at = EXCLUDED.accepted_at,
    updated_at = NOW();

  -- 7. Consumir definitivamente o desafio temporário
  UPDATE public.tenant_invitation_challenges
  SET
    status = 'consumido',
    consumed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_verified_challenge.id;

  -- 8. Finalizar o ciclo do convite
  UPDATE public.tenant_invitations
  SET
    status = 'aceito',
    accepted_at = NOW()
  WHERE id = invitation.id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID) TO service_role;

COMMIT;
