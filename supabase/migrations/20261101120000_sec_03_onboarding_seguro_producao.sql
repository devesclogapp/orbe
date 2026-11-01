-- ==============================================================================
-- ORBE ERP — SEC-03: ONBOARDING SEGURO DE USUÁRIOS (MIGRATION CONSOLIDADA PRODUÇÃO)
-- Arquivo: 20261101120000_sec_03_onboarding_seguro_producao.sql
-- Data de Criação: 01/11/2026
-- 
-- OBJETIVO ARQUITETURAL:
--   Consolidação atômica, idempotente e definitiva da SEC-03 para o Supabase Cloud,
--   incorporando:
--     1. Tabela de desafios temporários (tenant_invitation_challenges) com HMAC-SHA256,
--        limite de 5 tentativas, expiração em 10 min e Session Proof Binding (32 bytes).
--     2. Schema isolado 'private' e tabela 'sec03_settings' para custódia do segredo HMAC.
--     3. Atualização de validate_invitation_token utilizando estritamente a coluna
--        oficial de produção 'tenants.name' (sem risco de drift de schema).
--     4. RPCs administrativas de criação e reemissão de convites protegidas por
--        admin_require_tenant_admin() e formatadas para compartilhamento via botão "Copiar convite".
--     5. RPC de verificação HMAC-SHA256 (sec03_verify_invitation_activation_code)
--        com desempate determinístico e emissão de verification_proof.
--     6. Atualização canônica de accept_tenant_invitation com amarração do verification_proof,
--        compatibilidade estrita com profiles (sem coluna legada telefone) e restrição
--        de execução exclusiva ao service_role (Edge Function).
--     7. Trigger de sincronização e cancelamento em cascata de desafios.
--     8. Hardening de política RLS em tenant_invitations (leitura restrita a admins do tenant).
--     9. Helper get_user_role() para o contexto de autenticação do frontend.
--
-- COMPATIBILIDADE:
--   - 100% compatível com PostgreSQL 17 (Cloud) e Docker local.
--   - Preserva usuários ativos, convites pré-existentes, sessões e permissões.
--   - Totalmente desacoplado de regras de negócio de RH e Financeiro.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSÕES OBRIGATÓRIAS
-- ------------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ------------------------------------------------------------------------------
-- 2. SCHEMA PRIVADO E TABELA DE CONFIGURAÇÃO DE SEGREDOS BACKEND
-- ------------------------------------------------------------------------------
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

-- Chave HMAC mestre provisionada dinamicamente via CSPRNG (256 bits / 32 bytes hex)
-- Sem segredos fixos ou hardcoded. Caso já exista uma chave configurada, ela é preservada.
INSERT INTO private.sec03_settings (key, value)
VALUES ('hmac_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 3. TABELA DE DESAFIOS TEMPORÁRIOS DE ATIVAÇÃO (tenant_invitation_challenges)
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
    verification_proof TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assegurar colunas adicionais para idempotência caso a tabela já existisse
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

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tenant_invitation_challenges' AND column_name = 'verification_proof'
  ) THEN
    ALTER TABLE public.tenant_invitation_challenges ADD COLUMN verification_proof TEXT;
  END IF;
END $$;

-- Índices de busca e unicidade condicional (1 desafio ativo por convite)
CREATE INDEX IF NOT EXISTS idx_invitation_challenges_invite_status 
    ON public.tenant_invitation_challenges(invitation_id, status);

CREATE INDEX IF NOT EXISTS idx_invitation_challenges_tenant_id 
    ON public.tenant_invitation_challenges(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_challenge_per_invite 
    ON public.tenant_invitation_challenges (invitation_id) 
    WHERE (status IN ('pendente', 'verificado'));

-- Isolamento RLS estrito: somente service_role e postgres
ALTER TABLE public.tenant_invitation_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_invitation_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.tenant_invitation_challenges TO service_role, postgres;

DROP POLICY IF EXISTS "tenant_invitation_challenges_service_role" ON public.tenant_invitation_challenges;
CREATE POLICY "tenant_invitation_challenges_service_role" ON public.tenant_invitation_challenges
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. FUNÇÃO AUXILIAR: MASCARAMENTO DE E-MAIL
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sec03_mask_email(p_email TEXT)
RETURNS TEXT AS $$
DECLARE
  v_user TEXT;
  v_domain TEXT;
  v_len INTEGER;
BEGIN
  IF p_email IS NULL OR position('@' in p_email) = 0 THEN
    RETURN '***';
  END IF;
  
  v_user := split_part(p_email, '@', 1);
  v_domain := split_part(p_email, '@', 2);
  v_len := length(v_user);
  
  IF v_len <= 2 THEN
    RETURN substr(v_user, 1, 1) || '***@' || v_domain;
  ELSE
    RETURN substr(v_user, 1, 2) || repeat('*', v_len - 2) || '@' || v_domain;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SET search_path = public;

REVOKE ALL ON FUNCTION public.sec03_mask_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sec03_mask_email(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4.1 HELPER DE LOOKUP: sec03_get_auth_user_by_email
--     Busca O(1) segura em auth.users para a Edge Function sem risco de paginação
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sec03_get_auth_user_by_email(p_email TEXT)
RETURNS TABLE (id UUID, email VARCHAR, raw_user_meta_data JSONB) AS $$
  SELECT u.id, u.email::VARCHAR, u.raw_user_meta_data
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = auth, pg_temp;

REVOKE ALL ON FUNCTION public.sec03_get_auth_user_by_email(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec03_get_auth_user_by_email(TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 5. RPC PÚBLICA DE LEITURA: validate_invitation_token
--    Retorna metadados seguros do convite com tenant_name oficial (tenants.name)
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
    t.name AS tenant_name,
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
    AND ti.status = 'pendente'
    AND ti.expires_at > NOW();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.validate_invitation_token(TEXT) IS
  'SEC-03: Valida token de convite e retorna metadados incluindo o nome oficial da empresa (tenants.name).';

REVOKE ALL ON FUNCTION public.validate_invitation_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_invitation_token(TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. RPC ADMINISTRATIVA: admin_create_invitation_with_activation_code (BASE 8 ARGS)
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
  v_token TEXT;
  v_expires_at TIMESTAMPTZ;
  v_challenge_expires_at TIMESTAMPTZ;
  v_formatted_message TEXT;
BEGIN
  -- 1. Autorização estrita de Administrador de Tenant (SEC-02)
  v_tenant_id := public.admin_require_tenant_admin();

  -- 2. Validações de entrada
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'E-mail corporativo inválido';
  END IF;

  IF v_role NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'user') THEN
    RAISE EXCEPTION 'Função/Papel inválido: %', v_role;
  END IF;

  IF p_server_secret IS NULL OR length(btrim(p_server_secret)) < 32 THEN
    RAISE EXCEPTION 'Chave secreta do servidor inválida.';
  END IF;

  -- 3. Obter Razão Social oficial do tenant (tenants.name)
  SELECT name INTO v_tenant_nome FROM public.tenants WHERE id = v_tenant_id;
  IF v_tenant_nome IS NULL THEN
    v_tenant_nome := 'ORBE Logística';
  END IF;

  -- 4. Definir validade do convite
  IF p_expires_at IS NOT NULL AND p_expires_at > NOW() THEN
    v_expires_at := p_expires_at;
  ELSE
    v_expires_at := NOW() + INTERVAL '7 days';
  END IF;

  -- 5. Cancelar convites pendentes pré-existentes para o mesmo e-mail no tenant
  UPDATE public.tenant_invitations
  SET status = 'bloqueado', updated_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND email = v_email
    AND status = 'pendente';

  -- 6. Gerar token criptográfico único para URL
  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  -- 7. Inserir registro canônico de convite
  INSERT INTO public.tenant_invitations (
    tenant_id,
    email,
    full_name,
    phone,
    role,
    permissions,
    token,
    status,
    expires_at,
    invited_by
  ) VALUES (
    v_tenant_id,
    v_email,
    NULLIF(btrim(p_full_name), ''),
    NULLIF(btrim(p_phone), ''),
    v_role,
    COALESCE(p_permissions, '{}'::jsonb),
    v_token,
    'pendente',
    v_expires_at,
    v_user_id
  )
  RETURNING * INTO v_invitation;

  -- 8. Gerar Código de Ativação Temporário Criptograficamente Seguro (CSPRNG 6 dígitos) e Salt
  v_code := lpad(((((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000) + 100000)::text)), 6, '0');
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');

  -- 9. Computar HMAC-SHA-256 com amarração de invitation_id
  v_hmac := encode(extensions.hmac(v_code || ':' || v_invitation.id::TEXT || ':' || v_salt, p_server_secret, 'sha256'), 'hex');
  v_challenge_expires_at := NOW() + INTERVAL '10 minutes';

  -- 10. Persistir Desafio de Ativação
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
    v_challenge_expires_at,
    NOW() + INTERVAL '60 seconds'
  )
  RETURNING id INTO v_challenge_id;

  -- 11. Montar Mensagem Pronta de Convite Institucional
  v_formatted_message := format(
    E'Olá, %s!\n\nVocê foi convidado para acessar a plataforma ORBE pela empresa %s.\n\nPara ativar sua conta com segurança, siga os passos abaixo:\n\n1. Acesse o link de ativação:\n/cadastro?token=%s\n\n2. Informe o seu Código de Ativação temporário:\n%s\n\n3. Crie sua senha de acesso pessoal.\n\nAtenção: Por razões de segurança, este código expira em 10 minutos. Caso você não reconheça este convite, desconsidere esta mensagem.',
    COALESCE(NULLIF(btrim(p_full_name), ''), 'Colaborador'),
    v_tenant_nome,
    v_token,
    v_code
  );

  -- 12. Auditoria transacional
  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    usuario_id,
    descricao,
    origem
  ) VALUES (
    v_tenant_id,
    'INVITATION_CREATED_WITH_ACTIVATION_CODE',
    'tenant_invitations',
    v_invitation.id,
    v_user_id,
    format('Convite com código de ativação gerado para %s (role: %s).', v_email, v_role),
    'ONBOARDING_SEC03'
  );

  -- 13. Retornar dados com o código em texto claro exclusivamente nesta resposta
  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'token', v_token,
    'code', v_code,
    'expires_at', v_challenge_expires_at,
    'invitation_message', v_formatted_message,
    'email_masked', public.sec03_mask_email(v_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. OVERLOAD ADMINISTRATIVO: admin_create_invitation_with_activation_code (6 ARGS)
--    Lê o segredo HMAC do schema private; seguro para frontend autenticado
-- ------------------------------------------------------------------------------
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
  IF v_secret IS NULL OR length(btrim(v_secret)) < 32 THEN
    RAISE EXCEPTION 'Segredo HMAC não configurado no backend seguro (private.sec03_settings).';
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

-- ------------------------------------------------------------------------------
-- 8. RPC ADMINISTRATIVA: admin_issue_new_activation_code (BASE 3 ARGS)
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
  v_challenge_id UUID;
  v_code TEXT;
  v_salt TEXT;
  v_hmac TEXT;
  v_last_challenge public.tenant_invitation_challenges%ROWTYPE;
  v_count_24h INTEGER;
  v_challenge_expires_at TIMESTAMPTZ;
  v_formatted_message TEXT;
BEGIN
  -- 1. Autorização estrita de Administrador de Tenant (SEC-02)
  v_tenant_id := public.admin_require_tenant_admin();

  IF p_server_secret IS NULL OR length(btrim(p_server_secret)) < 32 THEN
    RAISE EXCEPTION 'Chave secreta do servidor inválida.';
  END IF;

  -- 2. Localizar o convite pertencente ao tenant do administrador
  SELECT *
  INTO v_invitation
  FROM public.tenant_invitations
  WHERE id = p_invitation_id
    AND tenant_id = v_tenant_id
    AND accepted_at IS NULL
    AND status = 'pendente'
    AND expires_at > NOW()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado, já aceito ou expirado.';
  END IF;

  -- 3. Obter Razão Social oficial do tenant (tenants.name)
  SELECT name INTO v_tenant_nome FROM public.tenants WHERE id = v_tenant_id;
  IF v_tenant_nome IS NULL THEN
    v_tenant_nome := 'ORBE Logística';
  END IF;

  -- 4. Verificar taxa limite de emissão (máximo 10 códigos em 24 horas por convite)
  SELECT count(*)
  INTO v_count_24h
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_count_24h >= 10 THEN
    RAISE EXCEPTION 'Limite diário de emissão de códigos excedido para este colaborador (máximo 10 em 24h).';
  END IF;

  -- 5. Verificar cooldown de reemissão (60 segundos)
  SELECT *
  INTO v_last_challenge
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND AND v_last_challenge.cooldown_until > NOW() THEN
    RAISE EXCEPTION 'Aguarde % segundos antes de gerar um novo código de ativação.',
      GREATEST(1, EXTRACT(SECOND FROM (v_last_challenge.cooldown_until - NOW()))::INTEGER);
  END IF;

  -- 6. Cancelar desafios anteriores ativos ('pendente' ou 'verificado')
  UPDATE public.tenant_invitation_challenges
  SET status = 'cancelado_reenvio', updated_at = NOW()
  WHERE invitation_id = v_invitation.id
    AND status IN ('pendente', 'verificado');

  -- 7. Gerar Novo Código de 6 Dígitos Criptograficamente Seguro (CSPRNG) e Salt
  v_code := lpad(((((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 900000) + 100000)::text)), 6, '0');
  v_salt := encode(extensions.gen_random_bytes(16), 'hex');
  v_hmac := encode(extensions.hmac(v_code || ':' || v_invitation.id::TEXT || ':' || v_salt, p_server_secret, 'sha256'), 'hex');
  v_challenge_expires_at := NOW() + INTERVAL '10 minutes';

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
    v_challenge_expires_at,
    NOW() + INTERVAL '60 seconds'
  )
  RETURNING id INTO v_challenge_id;

  -- 9. Montar Mensagem Pronta de Convite Atualizada
  v_formatted_message := format(
    E'Olá, %s!\n\nVocê recebeu um novo Código de Ativação da empresa %s no ERP ORBE.\n\nPara ativar sua conta:\n\n1. Acesse o link de ativação:\n/cadastro?token=%s\n\n2. Informe o novo Código de Ativação:\n%s\n\n3. Crie sua senha de acesso pessoal.\n\nAtenção: Este código expira em 10 minutos. O código anterior foi cancelado.',
    COALESCE(NULLIF(btrim(v_invitation.full_name), ''), 'Colaborador'),
    v_tenant_nome,
    v_invitation.token,
    v_code
  );

  -- 10. Auditoria transacional
  INSERT INTO public.audit_log (
    tenant_id,
    acao,
    entidade,
    registro_id,
    usuario_id,
    descricao,
    origem
  ) VALUES (
    v_tenant_id,
    'ACTIVATION_CODE_REISSUED',
    'tenant_invitations',
    v_invitation.id,
    v_user_id,
    format('Novo código de ativação emitido para o convite %s.', v_invitation.id),
    'ONBOARDING_SEC03'
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'code', v_code,
    'expires_at', v_challenge_expires_at,
    'invitation_message', v_formatted_message,
    'email_masked', public.sec03_mask_email(v_invitation.email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_issue_new_activation_code(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_issue_new_activation_code(UUID, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 9. OVERLOAD ADMINISTRATIVO: admin_issue_new_activation_code (1 ARG)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_issue_new_activation_code(
  p_invitation_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM private.sec03_settings WHERE key = 'hmac_secret';
  IF v_secret IS NULL OR length(btrim(v_secret)) < 32 THEN
    RAISE EXCEPTION 'Segredo HMAC não configurado no backend seguro (private.sec03_settings).';
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

-- ------------------------------------------------------------------------------
-- 10. RPC DE VERIFICAÇÃO HMAC: sec03_verify_invitation_activation_code
--     Emite verification_proof (32 bytes aleatórios) na validação bem-sucedida
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.sec03_verify_invitation_activation_code(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT);

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
    UPDATE public.tenant_invitations
    SET status = 'bloqueado', updated_at = NOW()
    WHERE id = v_invitation.id;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'RATE_LIMIT_EXCEEDED',
      'message', 'Limite diário de tentativas excedido para este convite. O convite foi bloqueado por segurança.',
      'blocked', true
    );
  END IF;

  -- 3. Localizar o desafio ativo mais recente para este convite com bloqueio pessimista
  SELECT *
  INTO v_challenge
  FROM public.tenant_invitation_challenges
  WHERE invitation_id = v_invitation.id
    AND status IN ('pendente', 'bloqueado_tentativas')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'NO_ACTIVE_CHALLENGE',
      'message', 'Nenhum código ativo encontrado para este convite. Solicite um novo código ao administrador.',
      'remaining_attempts', 0,
      'blocked', false
    );
  END IF;

  -- 4. Verificar se o código expirou (10 minutos)
  IF v_challenge.expires_at <= NOW() THEN
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

  -- 5. Verificar limite de tentativas do desafio individual (5 tentativas)
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

  -- 6. Validar HMAC-SHA-256 (compatibilidade com binding de invitation_id e formato legado)
  v_expected_hmac := encode(extensions.hmac(v_clean_code || ':' || v_invitation.id::TEXT || ':' || v_challenge.salt, p_server_secret, 'sha256'), 'hex');

  IF v_challenge.code_hash <> v_expected_hmac THEN
    v_expected_hmac := encode(extensions.hmac(v_clean_code || v_challenge.salt, p_server_secret, 'sha256'), 'hex');
  END IF;

  IF v_challenge.code_hash <> v_expected_hmac THEN
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

REVOKE ALL ON FUNCTION public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sec03_verify_invitation_activation_code(TEXT, TEXT, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 10.1 OVERLOAD DE VERIFICAÇÃO (2 ARGS): sec03_verify_invitation_activation_code
--      Permite verificação direta pelo frontend autenticado ou anônimo,
--      lendo o segredo HMAC exclusivamente do schema private no backend.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sec03_verify_invitation_activation_code(
  p_token TEXT,
  p_code TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_secret TEXT;
BEGIN
  SELECT value INTO v_secret FROM private.sec03_settings WHERE key = 'hmac_secret';
  IF v_secret IS NULL OR length(btrim(v_secret)) < 32 THEN
    RAISE EXCEPTION 'Segredo HMAC não configurado no backend seguro (private.sec03_settings).';
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

-- ------------------------------------------------------------------------------
-- 11. RPC DE ACEITE TRANSACIONAL: accept_tenant_invitation
--     Exige Session Proof Binding criptográfico; restrita a service_role
-- ------------------------------------------------------------------------------
-- Remover sobrecargas legadas ou ambíguas para evitar conflito no PostgREST
DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT);
DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT, UUID);
DROP FUNCTION IF EXISTS public.accept_tenant_invitation(TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(
  p_token TEXT,
  p_user_id UUID,
  p_verification_proof TEXT
)
RETURNS UUID AS $$
DECLARE
  invitation public.tenant_invitations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  v_verified_challenge public.tenant_invitation_challenges%ROWTYPE;
  profile_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_verification_proof IS NULL OR btrim(p_verification_proof) = '' THEN
    RAISE EXCEPTION 'Prova de verificação de código obrigatória.';
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

  -- 3. VALIDAR PROVA CRIPTOGRÁFICA DE SESSÃO (SESSION PROOF BINDING ESTRITO)
  IF v_verified_challenge.verification_proof IS NULL OR length(btrim(v_verified_challenge.verification_proof)) < 32 THEN
    RAISE EXCEPTION 'Desafio sem prova de verificação válida. Repita a verificação do código.';
  END IF;

  IF p_verification_proof <> v_verified_challenge.verification_proof THEN
    RAISE EXCEPTION 'Prova de verificação de código inválida ou divergente da sessão que validou o OTP.';
  END IF;

  -- 4. Validar correspondência estrita de e-mail do usuário autenticado
  IF lower(invitation.email) <> lower((SELECT email FROM auth.users WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
  END IF;

  -- 5. Transicionar status do convite
  UPDATE public.tenant_invitations
  SET
    status = 'em_processamento',
    accepted_by = p_user_id
  WHERE id = invitation.id;

  -- 6. Verificar e associar perfil (schema canônico do Cloud: user_id, tenant_id, role, full_name)
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
      updated_at = NOW()
    WHERE user_id = p_user_id;
    profile_id := existing_profile.id;
  ELSE
    INSERT INTO public.profiles (
      user_id,
      tenant_id,
      role,
      full_name
    ) VALUES (
      p_user_id,
      invitation.tenant_id,
      lower(invitation.role),
      NULLIF(invitation.full_name, '')
    ) RETURNING id INTO profile_id;
  END IF;

  -- 7. Sincronizar permissões detalhadas (o telefone do colaborador é gravado aqui em phone)
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

  -- 8. Concluir convite
  UPDATE public.tenant_invitations
  SET
    status = 'aceito',
    accepted_at = NOW(),
    accepted_by = p_user_id,
    updated_at = NOW()
  WHERE id = invitation.id;

  -- 9. Consumir atômica e irreversivelmente o desafio OTP
  UPDATE public.tenant_invitation_challenges
  SET
    status = 'consumido',
    consumed_at = NOW(),
    updated_at = NOW()
  WHERE id = v_verified_challenge.id;

  -- 10. Registrar auditoria do aceite
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

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT, UUID, TEXT) TO service_role;

-- ------------------------------------------------------------------------------
-- 12. TRIGGER DE INVALIDAÇÃO EM CASCATA DE DESAFIOS ATIVOS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sec03_trg_sync_invitation_challenges()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('aceito', 'bloqueado', 'cancelado') OR NEW.token <> OLD.token THEN
    UPDATE public.tenant_invitation_challenges
    SET 
      status = CASE 
        WHEN NEW.status = 'aceito' THEN 'consumido'
        WHEN NEW.status = 'bloqueado' THEN 'cancelado_reenvio'
        ELSE 'cancelado_reenvio'
      END,
      updated_at = NOW()
    WHERE invitation_id = NEW.id
      AND status IN ('pendente', 'verificado');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_sec03_sync_invitation_challenges ON public.tenant_invitations;
CREATE TRIGGER trg_sec03_sync_invitation_challenges
  AFTER UPDATE OF status, token ON public.tenant_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.sec03_trg_sync_invitation_challenges();

-- ------------------------------------------------------------------------------
-- 13. AUDITORIA E HARDENING COMPLETO DE RLS EM tenant_invitations
-- ------------------------------------------------------------------------------
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Limpar todas as políticas legadas de migrations anteriores para evitar permissividade cumulativa
DROP POLICY IF EXISTS "Convites visíveis para admins do tenant" ON public.tenant_invitations;
DROP POLICY IF EXISTS "invitations_tenant_all" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_admin_select" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_admin_insert" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_admin_update" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_admin_delete" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_select" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_insert" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_update" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_delete" ON public.tenant_invitations;

-- SELECT: Administradores autenticados visualizam apenas convites de seu próprio tenant
CREATE POLICY tenant_invitations_admin_select ON public.tenant_invitations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND lower(p.role) = 'admin'
      AND p.tenant_id = public.tenant_invitations.tenant_id
  )
);

-- INSERT: Administradores autenticados podem inserir convites apenas para seu próprio tenant
CREATE POLICY tenant_invitations_admin_insert ON public.tenant_invitations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND lower(p.role) = 'admin'
      AND p.tenant_id = public.tenant_invitations.tenant_id
  )
);

-- UPDATE: Administradores autenticados podem atualizar convites apenas de seu próprio tenant
CREATE POLICY tenant_invitations_admin_update ON public.tenant_invitations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND lower(p.role) = 'admin'
      AND p.tenant_id = public.tenant_invitations.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND lower(p.role) = 'admin'
      AND p.tenant_id = public.tenant_invitations.tenant_id
  )
);

-- DELETE: Administradores autenticados podem deletar convites apenas de seu próprio tenant
CREATE POLICY tenant_invitations_admin_delete ON public.tenant_invitations
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
      AND lower(p.role) = 'admin'
      AND p.tenant_id = public.tenant_invitations.tenant_id
  )
);

-- ------------------------------------------------------------------------------
-- 14. HELPER PARA CLIENT CONTEXT: get_user_role()
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon, authenticated, service_role;

COMMIT;
