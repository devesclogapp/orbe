-- ==============================================================================
-- ORBE — SEC-03: FASE 02.1.1 — Onboarding Manual via WhatsApp + Hardening
-- Data: 2026-10-30
-- Descrição:
--   1. Tabela de desafios temporários (tenant_invitation_challenges) com HMAC-SHA-256 e segredo de backend.
--   2. Índice único condicional: no máximo 1 desafio ativo ('pendente' ou 'verificado') por convite.
--   3. RPC Administrativa: admin_create_invitation_with_activation_code (geração controlada para WhatsApp).
--   4. RPC Administrativa: admin_issue_new_activation_code (reemissão assistida com cooldown e limites).
--   5. RPC de Verificação: sec03_verify_invitation_activation_code (verificação segura HMAC-SHA-256).
--   6. Enriquecimento de validate_invitation_token com tenant_name oficial.
--   7. Proteção contra Bypass em accept_tenant_invitation: exige desafio verificado há < 15 min.
--   8. Trigger de invalidação em cascata ('pendente' e 'verificado') ao renovar/alterar convite.
-- Idempotente, incremental e 100% compatível com a SEC-02 e o FIX SEC-02.6.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TABELA DE DESAFIOS TEMPORÁRIOS DE ATIVAÇÃO (tenant_invitation_challenges)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_invitation_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    invitation_id UUID NOT NULL REFERENCES public.tenant_invitations(id) ON DELETE CASCADE,
    code_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    key_version VARCHAR(10) NOT NULL DEFAULT 'v1',
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'verificado', 'expirado', 'cancelado_reenvio', 'bloqueado_tentativas', 'consumido')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '10 minutes'),
    cooldown_until TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '60 seconds'),
    verified_at TIMESTAMPTZ,
    consumed_at TIMESTAMPTZ,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Garantir colunas necessárias caso a tabela já existisse
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tenant_invitation_challenges' AND column_name = 'salt'
  ) THEN
    ALTER TABLE public.tenant_invitation_challenges ADD COLUMN salt TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tenant_invitation_challenges' AND column_name = 'key_version'
  ) THEN
    ALTER TABLE public.tenant_invitation_challenges ADD COLUMN key_version VARCHAR(10) NOT NULL DEFAULT 'v1';
  END IF;
END $$;

-- Índices de busca e isolamento
CREATE INDEX IF NOT EXISTS idx_invitation_challenges_invite_status 
    ON public.tenant_invitation_challenges(invitation_id, status);
CREATE INDEX IF NOT EXISTS idx_invitation_challenges_tenant_id 
    ON public.tenant_invitation_challenges(tenant_id);

-- Índice Único Condicional: Impede concorrência de múltiplos desafios ativos para o mesmo convite
DROP INDEX IF EXISTS public.idx_one_active_challenge_per_invite;
CREATE UNIQUE INDEX idx_one_active_challenge_per_invite 
    ON public.tenant_invitation_challenges (invitation_id) 
    WHERE status IN ('pendente', 'verificado');

-- RLS Estrita: Nenhum acesso direto a clientes (anon ou authenticated)
ALTER TABLE public.tenant_invitation_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.tenant_invitation_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitation_challenges TO service_role;

DROP POLICY IF EXISTS "tenant_invitation_challenges_service_role" ON public.tenant_invitation_challenges;
CREATE POLICY "tenant_invitation_challenges_service_role" ON public.tenant_invitation_challenges
    FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.tenant_invitation_challenges IS
  'SEC-03: Códigos temporários de ativação de 6 dígitos com HMAC-SHA-256 e segredo de servidor. RLS restrita.';

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO UTILITÁRIA: MASCARAMENTO DE E-MAIL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sec03_mask_email(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user TEXT;
  v_domain TEXT;
  v_len INTEGER;
BEGIN
  IF p_email IS NULL OR position('@' IN p_email) = 0 THEN
    RETURN '***@***';
  END IF;

  v_user := split_part(p_email, '@', 1);
  v_domain := split_part(p_email, '@', 2);
  v_len := length(v_user);

  IF v_len <= 2 THEN
    RETURN v_user || '***@' || v_domain;
  ELSE
    RETURN substring(v_user FROM 1 FOR 1) || '***' || substring(v_user FROM v_len FOR 1) || '@' || v_domain;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, extensions, pg_temp;

-- ------------------------------------------------------------------------------
-- 3. ATUALIZAÇÃO INCREMENTAL DE validate_invitation_token (COM TENANT_NAME)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.validate_invitation_token(TEXT);
CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
RETURNS TABLE(
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  role TEXT,
  permissions JSONB,
  expires_at TIMESTAMPTZ,
  status TEXT
) AS $$
  SELECT
    ti.id,
    ti.tenant_id,
    t.nome AS tenant_name,
    ti.email,
    ti.full_name,
    ti.phone,
    ti.role,
    ti.permissions,
    ti.expires_at,
    CASE
      WHEN ti.accepted_at IS NOT NULL THEN 'aceito'
      WHEN ti.status = 'bloqueado' THEN 'bloqueado'
      WHEN ti.expires_at <= NOW() THEN 'convite_expirado'
      ELSE 'pendente'
    END AS status
  FROM public.tenant_invitations ti
  JOIN public.tenants t ON t.id = ti.tenant_id
  WHERE ti.token = p_token
    AND ti.accepted_at IS NULL
    AND ti.status <> 'bloqueado'
    AND ti.expires_at > NOW();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, extensions, pg_temp;

COMMENT ON FUNCTION public.validate_invitation_token(TEXT) IS
  'SEC-03: Valida token de convite e retorna metadados incluindo o nome oficial da empresa (tenants.nome).';

REVOKE ALL ON FUNCTION public.validate_invitation_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. REMOÇÃO DE ROTAS PÚBLICAS DESALINHADAS
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sec03_request_invitation_otp(TEXT);
DROP FUNCTION IF EXISTS public.sec03_generate_invitation_challenge_internal(TEXT);

-- ------------------------------------------------------------------------------
-- 5. RPC ADMINISTRATIVA: CRIAÇÃO DE CONVITE COM CÓDIGO DE ATIVAÇÃO (WHATSAPP)
-- Exclusiva para Administradores do tenant. Retorna código em texto claro apenas nesta resposta inicial.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_invitation_with_activation_code(
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_permissions JSONB,
  p_expires_at TIMESTAMPTZ,
  p_server_secret TEXT,
  p_key_version TEXT DEFAULT 'v1'
)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_role TEXT := lower(btrim(COALESCE(p_role, '')));
  v_tenant_nome TEXT;
  v_invitation public.tenant_invitations%ROWTYPE;
  v_challenge_id UUID;
  v_code TEXT;
  v_salt TEXT;
  v_hmac TEXT;
  v_rand_int INTEGER;
  v_invite_url TEXT;
  v_invitation_msg TEXT;
BEGIN
  -- 1. Exigir privilégio de Administrador do tenant (SEC-02)
  v_tenant_id := public.admin_require_tenant_admin();

  -- 2. Validar segredo de backend (entropia mínima de 256 bits / 32 chars)
  IF p_server_secret IS NULL OR length(btrim(p_server_secret)) < 32 THEN
    RAISE EXCEPTION 'Chave secreta do servidor inválida ou com entropia insuficiente.';
  END IF;

  -- 3. Validações de entrada
  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  IF v_role NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
    RAISE EXCEPTION 'Perfil de usuário inválido';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Defina uma validade futura para o convite';
  END IF;

  -- 4. Verificar se usuário já existe e está ativo no mesmo tenant
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE lower(u.email) = v_email AND p.tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'Este e-mail já possui cadastro ativo nesta empresa';
  END IF;

  -- 5. Cancelar convites pendentes anteriores para o mesmo e-mail no tenant
  UPDATE public.tenant_invitations
  SET status = 'cancelado', updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND lower(email) = v_email
    AND status = 'pendente';

  -- 6. Buscar nome do tenant
  SELECT nome INTO v_tenant_nome FROM public.tenants WHERE id = v_tenant_id;

  -- 7. Inserir novo convite
  INSERT INTO public.tenant_invitations (
    tenant_id,
    email,
    full_name,
    phone,
    role,
    permissions,
    invited_by,
    status,
    expires_at
  ) VALUES (
    v_tenant_id,
    v_email,
    NULLIF(btrim(COALESCE(p_full_name, '')), ''),
    NULLIF(btrim(COALESCE(p_phone, '')), ''),
    v_role,
    COALESCE(p_permissions, '{}'::jsonb),
    v_user_id,
    'pendente',
    p_expires_at
  ) RETURNING * INTO v_invitation;

  -- 8. Gerar código numérico uniforme de 6 dígitos via CSPRNG
  v_rand_int := (abs(get_byte(extensions.gen_random_bytes(4), 0) * 65536 + 
                      get_byte(extensions.gen_random_bytes(4), 1) * 256 + 
                      get_byte(extensions.gen_random_bytes(4), 2)) % 900000) + 100000;
  v_code := v_rand_int::TEXT;

  -- 9. Gerar Salt randômico de 16 bytes e assinar com HMAC-SHA-256 usando o segredo de servidor
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hmac := encode(extensions.hmac(v_code || ':' || v_invitation.id::TEXT || ':' || v_salt, p_server_secret, 'sha256'), 'hex');

  -- 10. Persistir o desafio (validade de 10 min, cooldown de 60s)
  INSERT INTO public.tenant_invitation_challenges (
    tenant_id,
    invitation_id,
    code_hash,
    salt,
    key_version,
    status,
    attempts,
    max_attempts,
    expires_at,
    cooldown_until
  ) VALUES (
    v_tenant_id,
    v_invitation.id,
    v_hmac,
    v_salt,
    COALESCE(p_key_version, 'v1'),
    'pendente',
    0,
    5,
    NOW() + INTERVAL '10 minutes',
    NOW() + INTERVAL '60 seconds'
  ) RETURNING id INTO v_challenge_id;

  -- 11. Montar template de convite pronto para cópia manual
  v_invite_url := '/cadastro?token=' || v_invitation.token;
  v_invitation_msg := format(
    'Olá, %s! Você foi convidado para acessar o ERP ORBE da empresa %s.%s%sPara ativar seu acesso:%s1. Acesse o link: %s%s2. Informe o código de ativação: %s%s3. Defina sua senha de acesso.%s%s(Este código é individual e expira em 10 minutos).',
    COALESCE(v_invitation.full_name, 'colaborador'),
    v_tenant_nome,
    E'\n', E'\n', E'\n',
    v_invite_url,
    E'\n',
    v_code,
    E'\n',
    E'\n', E'\n'
  );

  -- 12. Auditoria administrativa
  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    descricao,
    origem
  ) VALUES (
    v_tenant_id,
    'INVITATION_CREATED_WITH_ACTIVATION_CODE',
    'tenant_invitations',
    v_invitation.id,
    format('Convite com código de ativação temporário emitido para %s por admin %s.', v_email, v_user_id),
    'ADMIN_GOVERNANCE'
  );

  -- 13. Retorno estruturado (código retornado em texto claro apenas nesta resposta inicial)
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'token', v_invitation.token,
    'code', v_code,
    'expires_in_seconds', 600,
    'cooldown_seconds', 60,
    'full_name', v_invitation.full_name,
    'email', v_invitation.email,
    'phone', v_invitation.phone,
    'role', v_invitation.role,
    'tenant_name', v_tenant_nome,
    'invite_url', v_invite_url,
    'invitation_message', v_invitation_msg
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

COMMENT ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) IS
  'SEC-03: Criação de convite com código temporário de ativação para envio manual via qualquer mensageiro.';

REVOKE ALL ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC ADMINISTRATIVA: REEMISSÃO DE CÓDIGO DE ATIVAÇÃO PARA CONVITE PENDENTE
-- Exclusiva para Administradores do tenant. Invalida código anterior e gera nova credencial temporária.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_issue_new_activation_code(
  p_invitation_id UUID,
  p_server_secret TEXT,
  p_key_version TEXT DEFAULT 'v1'
)
RETURNS JSONB AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID := auth.uid();
  v_invitation public.tenant_invitations%ROWTYPE;
  v_tenant_nome TEXT;
  v_last_challenge public.tenant_invitation_challenges%ROWTYPE;
  v_challenge_id UUID;
  v_code TEXT;
  v_salt TEXT;
  v_hmac TEXT;
  v_rand_int INTEGER;
  v_cooldown_remaining INTEGER;
  v_daily_emissions INTEGER;
  v_total_attempts INTEGER;
  v_invite_url TEXT;
  v_invitation_msg TEXT;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  IF p_server_secret IS NULL OR length(btrim(p_server_secret)) < 32 THEN
    RAISE EXCEPTION 'Chave secreta do servidor inválida.';
  END IF;

  -- 1. Buscar e travar o convite pertencente ao mesmo tenant
  SELECT ti.*
  INTO v_invitation
  FROM public.tenant_invitations ti
  WHERE ti.id = p_invitation_id
    AND ti.tenant_id = v_tenant_id
    AND ti.accepted_at IS NULL
    AND ti.status = 'pendente'
    AND ti.expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado, revogado ou expirado para este tenant';
  END IF;

  SELECT nome INTO v_tenant_nome FROM public.tenants WHERE id = v_tenant_id;

  -- 2. COOLDOWN PERSISTENTE: Inspecionar emissão mais recente independente do status
  SELECT *
  INTO v_last_challenge
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND v_last_challenge.cooldown_until > NOW() THEN
    v_cooldown_remaining := GREATEST(1, EXTRACT(EPOCH FROM (v_last_challenge.cooldown_until - NOW()))::INTEGER);
    RAISE EXCEPTION 'Aguarde % segundos antes de gerar um novo código para este convite.', v_cooldown_remaining;
  END IF;

  -- 3. LIMITE CUMULATIVO DE EMISSÕES NAS ÚLTIMAS 24H (Rate Limit por convite)
  SELECT count(*)
  INTO v_daily_emissions
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_daily_emissions >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 emissões diárias de código excedido para este convite.';
  END IF;

  -- 4. LIMITE CUMULATIVO DE TENTATIVAS INCORRETAS NAS ÚLTIMAS 24H
  SELECT COALESCE(sum(attempts), 0)
  INTO v_total_attempts
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_total_attempts >= 15 THEN
    RAISE EXCEPTION 'Convite bloqueado por excesso de tentativas de verificação. Solicite renovação.';
  END IF;

  -- 5. Cancelar todos os desafios ativos anteriores ('pendente' e 'verificado')
  UPDATE public.tenant_invitation_challenges
  SET status = 'cancelado_reenvio', updated_at = NOW()
  WHERE invitation_id = v_invitation.id
    AND status IN ('pendente', 'verificado');

  -- 6. Gerar novo código de 6 dígitos via CSPRNG
  v_rand_int := (abs(get_byte(extensions.gen_random_bytes(4), 0) * 65536 + 
                      get_byte(extensions.gen_random_bytes(4), 1) * 256 + 
                      get_byte(extensions.gen_random_bytes(4), 2)) % 900000) + 100000;
  v_code := v_rand_int::TEXT;

  -- 7. Salt randômico de 16 bytes e novo HMAC-SHA-256
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hmac := encode(extensions.hmac(v_code || ':' || v_invitation.id::TEXT || ':' || v_salt, p_server_secret, 'sha256'), 'hex');

  -- 8. Inserir novo desafio
  INSERT INTO public.tenant_invitation_challenges (
    tenant_id,
    invitation_id,
    code_hash,
    salt,
    key_version,
    status,
    attempts,
    max_attempts,
    expires_at,
    cooldown_until
  ) VALUES (
    v_tenant_id,
    v_invitation.id,
    v_hmac,
    v_salt,
    COALESCE(p_key_version, 'v1'),
    'pendente',
    0,
    5,
    NOW() + INTERVAL '10 minutes',
    NOW() + INTERVAL '60 seconds'
  ) RETURNING id INTO v_challenge_id;

  -- 9. Montar template de convite pronto para cópia manual
  v_invite_url := '/cadastro?token=' || v_invitation.token;
  v_invitation_msg := format(
    'Olá, %s! Seu novo código de ativação do ERP ORBE (%s) foi gerado:%s%sCódigo: %s%sLink de ativação: %s%s(Válido por 10 minutos).',
    COALESCE(v_invitation.full_name, 'colaborador'),
    v_tenant_nome,
    E'\n', E'\n',
    v_code,
    E'\n',
    v_invite_url,
    E'\n'
  );

  -- 10. Auditoria
  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    descricao,
    origem
  ) VALUES (
    v_tenant_id,
    'NEW_ACTIVATION_CODE_ISSUED',
    'tenant_invitations',
    v_invitation.id,
    format('Novo código de ativação emitido para o convite %s por admin %s.', v_invitation.id, v_user_id),
    'ADMIN_GOVERNANCE'
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'code', v_code,
    'expires_in_seconds', 600,
    'cooldown_seconds', 60,
    'invitation_message', v_invitation_msg
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_issue_new_activation_code(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_issue_new_activation_code(UUID, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. RPC DE VERIFICAÇÃO: sec03_verify_invitation_activation_code
-- Validação segura com HMAC-SHA-256 e segredo de servidor.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.sec03_verify_invitation_otp(TEXT, TEXT, TEXT);
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
  FOR UPDATE;

  IF NOT FOUND THEN
    SELECT *
    INTO v_challenge
    FROM public.tenant_invitation_challenges
    WHERE invitation_id = v_invitation.id
    ORDER BY created_at DESC
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
      'error', 'INVALID_CODE',
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

-- ------------------------------------------------------------------------------
-- 8. PROTEÇÃO CONTRA BYPASS: ATUALIZAÇÃO SEGURA DE accept_tenant_invitation
-- Impede contornar a nova exigência de código: exige desafio verificado há < 15 minutos.
-- ------------------------------------------------------------------------------
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
    UPDATE public.profiles
    SET
      tenant_id = invitation.tenant_id,
      role = lower(invitation.role),
      full_name = COALESCE(NULLIF(invitation.full_name, ''), existing_profile.full_name),
      phone = COALESCE(NULLIF(invitation.phone, ''), existing_profile.phone),
      updated_at = NOW()
    WHERE user_id = p_user_id;
    profile_id := existing_profile.id;
  ELSE
    INSERT INTO public.profiles (
      user_id,
      tenant_id,
      role,
      full_name,
      phone
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

-- ------------------------------------------------------------------------------
-- 9. TRIGGER DE SANEAMENTO: INVALIDAÇÃO EM CASCATA DE DESAFIOS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sec03_trg_sync_invitation_challenges()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IN ('aceito', 'convite_expirado', 'bloqueado') OR NEW.token <> OLD.token THEN
      UPDATE public.tenant_invitation_challenges
      SET
        status = 'cancelado_reenvio',
        updated_at = NOW()
      WHERE invitation_id = NEW.id
        AND status IN ('pendente', 'verificado');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

DROP TRIGGER IF EXISTS trg_sec03_sync_invitation_challenges ON public.tenant_invitations;
CREATE TRIGGER trg_sec03_sync_invitation_challenges
  AFTER UPDATE OF status, token ON public.tenant_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.sec03_trg_sync_invitation_challenges();

COMMIT;
