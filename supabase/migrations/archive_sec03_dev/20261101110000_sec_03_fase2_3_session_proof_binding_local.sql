-- ==============================================================================
-- ORBE ERP — SEC-03 FASE 02.3: SESSION PROOF BINDING (AMARRACÃO DE SESSÃO DO OTP)
-- Migration Incremental Local: 20261101110000_sec_03_fase2_3_session_proof_binding_local.sql
-- Objetivo: Vincular criptograficamente a validação do código de ativação à
-- operação de ativação da conta, impedindo que sessões concorrentes ou não
-- autenticadas aproveitem um desafio que esteja no estado 'verificado'.
-- ==============================================================================

-- 1. Coluna de prova de verificação na tabela de desafios
ALTER TABLE public.tenant_invitation_challenges
ADD COLUMN IF NOT EXISTS verification_proof TEXT;

-- 2. Atualização de sec03_verify_invitation_activation_code com geração de proof
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
  v_verification_proof TEXT;
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
        'success', true,
        'verified', true,
        'challenge_id', v_challenge.id,
        'verification_proof', v_challenge.verification_proof,
        'message', 'Código de ativação já validado anteriormente. Prossiga para a definição de senha.'
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_ACTIVE_CHALLENGE',
      'message', 'Nenhum código de ativação pendente para este convite. Solicite o envio ao administrador.',
      'remaining_attempts', 0,
      'blocked', false
    );
  END IF;

  -- 4. Verificar expiração
  IF v_challenge.expires_at < NOW() THEN
    UPDATE public.tenant_invitation_challenges
    SET status = 'expirado', updated_at = NOW()
    WHERE id = v_challenge.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'CODE_EXPIRED',
      'message', 'O código de ativação expirou. Solicite um novo código ao administrador.',
      'remaining_attempts', 0,
      'blocked', true
    );
  END IF;

  -- 5. Verificar bloqueio por tentativas
  IF v_challenge.attempts >= v_challenge.max_attempts THEN
    UPDATE public.tenant_invitation_challenges
    SET status = 'bloqueado_tentativas', updated_at = NOW()
    WHERE id = v_challenge.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'MAX_ATTEMPTS_EXCEEDED',
      'message', 'Limite de tentativas excedido para este código. Solicite um novo código ao administrador.',
      'remaining_attempts', 0,
      'blocked', true
    );
  END IF;

  -- 6. Calcular HMAC do código informado (suporta formato com e sem invitation.id)
  v_expected_hmac := encode(
    extensions.hmac(
      v_clean_code || ':' || v_invitation.id::TEXT || ':' || v_challenge.salt,
      p_server_secret,
      'sha256'
    ),
    'hex'
  );

  IF v_expected_hmac <> v_challenge.code_hash THEN
    IF v_challenge.code_hash = encode(extensions.hmac(v_clean_code || v_challenge.salt, p_server_secret, 'sha256'), 'hex') THEN
      v_expected_hmac := v_challenge.code_hash;
    END IF;
  END IF;

  IF v_expected_hmac <> v_challenge.code_hash THEN
    v_remaining := v_challenge.max_attempts - (v_challenge.attempts + 1);

    UPDATE public.tenant_invitation_challenges
    SET
      attempts = attempts + 1,
      status = CASE WHEN v_remaining <= 0 THEN 'bloqueado_tentativas' ELSE 'pendente' END,
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

  -- 7. Sucesso: Gerar Prova Criptográfica de Sessão (32 bytes aleatórios)
  v_verification_proof := encode(extensions.gen_random_bytes(32), 'hex');

  UPDATE public.tenant_invitation_challenges
  SET
    status = 'verificado',
    verified_at = NOW(),
    verification_proof = v_verification_proof,
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
    'verification_proof', v_verification_proof,
    'message', 'Código de ativação validado com sucesso. Prossiga para a definição de senha.'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 3. Atualização de accept_tenant_invitation com validação do verification_proof
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
  p_token TEXT,
  p_user_id UUID,
  p_verification_proof TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  invitation public.tenant_invitations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  v_verified_challenge public.tenant_invitation_challenges%ROWTYPE;
  profile_id UUID;
BEGIN
  -- 1. Validar e travar o convite
  SELECT *
  INTO invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND status IN ('pendente', 'em_processamento')
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido, revogado ou expirado';
  END IF;

  -- 2. Validar que existe desafio verificado recente (< 15 minutos)
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

  -- 2.1 Validação de Session Proof Binding (impede reaproveitamento por sessão divergente)
  IF v_verified_challenge.verification_proof IS NOT NULL THEN
    IF p_verification_proof IS NULL OR btrim(p_verification_proof) <> v_verified_challenge.verification_proof THEN
      RAISE EXCEPTION 'Prova de verificação de código inválida ou divergente da sessão que validou o OTP.';
    END IF;
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
  ON CONFLICT (tenant_id, user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    permissions = EXCLUDED.permissions,
    status = 'ativo',
    accepted_at = NOW(),
    updated_at = NOW();

  -- 7. Concluir convite
  UPDATE public.tenant_invitations
  SET
    status = 'aceito',
    accepted_at = NOW(),
    accepted_by = p_user_id,
    updated_at = NOW()
  WHERE id = invitation.id;

  -- 8. Consumir atômica e irreversivelmente o desafio OTP
  UPDATE public.tenant_invitation_challenges
  SET
    status = 'consumido',
    consumed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_verified_challenge.id;

  -- 9. Registrar auditoria do aceite
  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    usuario_id,
    descricao,
    origem
  ) VALUES (
    invitation.tenant_id,
    'INVITATION_ACCEPTED',
    'tenant_invitations',
    invitation.id,
    p_user_id,
    format('Convite aceito com sucesso para o usuário %s (role: %s)', invitation.email, invitation.role),
    'ONBOARDING_SEC03'
  );

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

-- 4. Remover sobrecarga redundante de 2 parâmetros para evitar erro de ambiguidade no PostgreSQL
DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT, UUID);

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID, TEXT) TO service_role;

-- 5. Helper get_user_role para ClientContext
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated, service_role;

-- 6. Hardening de Isolamento RLS em tenant_invitations: somente Administradores do Tenant podem ler
DROP POLICY IF EXISTS tenant_invitations_select ON public.tenant_invitations;
CREATE POLICY tenant_invitations_select ON public.tenant_invitations
FOR SELECT TO authenticated
USING (
  tenant_id IN (
    SELECT p.tenant_id 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND lower(p.role) = 'admin'
  )
);
