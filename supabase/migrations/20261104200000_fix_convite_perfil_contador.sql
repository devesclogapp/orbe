-- ==============================================================================
-- ORBE ERP ESC LOG 2026 — FASE FINAL DE HOMOLOGAÇÃO
-- Módulo: GOVERNANÇA / USUÁRIOS / CONVITES (CONT-07.5)
-- Descrição: Habilitação do Perfil Contador Interno no Mecanismo Oficial de Convites
-- Arquivo: supabase/migrations/20261104200000_fix_convite_perfil_contador.sql
-- Status: PREPARADA PARA APLICAÇÃO INCREMENTAL (AGUARDANDO AUTORIZAÇÃO)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. ATUALIZAÇÃO SEGURA DAS CONSTRAINTS DE PAPEL (CHECK CONSTRAINTS)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  -- 1.1 Atualizar profiles_role_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'profiles_role_check'
       AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;

  -- 1.2 Atualizar tenant_invitations_role_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'tenant_invitations_role_check'
       AND conrelid = 'public.tenant_invitations'::regclass
  ) THEN
    ALTER TABLE public.tenant_invitations DROP CONSTRAINT tenant_invitations_role_check;
  END IF;

  -- 1.3 Atualizar user_permissions_role_check
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'user_permissions_role_check'
       AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_role_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador'));

ALTER TABLE public.tenant_invitations
  ADD CONSTRAINT tenant_invitations_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador'));

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador'));


-- ------------------------------------------------------------------------------
-- 2. ATUALIZAR GATILHO DE PROTEÇÃO DE INSERT EM public.profiles
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Rejeitar se a operação partir de papéis de cliente direto
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Criação direta de perfis não permitida. Utilize o fluxo oficial de onboarding ou aceite de convite.';
  END IF;

  -- Validações de integridade estrutural
  IF NEW.tenant_id IS NULL THEN
    RAISE EXCEPTION 'Todo perfil deve possuir um tenant_id válido.';
  END IF;

  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'Todo perfil deve possuir um user_id válido.';
  END IF;

  -- Permitir formalmente o papel 'contador' e 'cliente' ao lado dos demais papéis institucionais
  IF NEW.role IS NULL OR lower(NEW.role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador') THEN
    RAISE EXCEPTION 'Função (role) de usuário inválida.';
  END IF;

  NEW.role := lower(NEW.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;


-- ------------------------------------------------------------------------------
-- 3. ATUALIZAR RPC DE GESTÃO DE ACESSOS PELO ADMINISTRADOR
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_user_access(
  p_user_id UUID,
  p_role TEXT,
  p_status TEXT,
  p_permissions JSONB
)
RETURNS public.user_permissions AS $$
DECLARE
  v_tenant_id UUID;
  v_current_user UUID := auth.uid();
  v_profile public.profiles%ROWTYPE;
  v_row public.user_permissions;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário inválido';
  END IF;

  IF p_user_id = v_current_user THEN
    RAISE EXCEPTION 'O administrador não pode alterar o próprio acesso por esta tela.';
  END IF;

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador') THEN
    RAISE EXCEPTION 'Perfil de usuário inválido';
  END IF;

  IF lower(COALESCE(p_status, '')) NOT IN ('ativo', 'bloqueado') THEN
    RAISE EXCEPTION 'Status de usuário inválido';
  END IF;

  SELECT *
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id
    AND p.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant do administrador';
  END IF;

  UPDATE public.profiles
  SET role = lower(p_role)
  WHERE id = v_profile.id;

  INSERT INTO public.user_permissions (
    tenant_id,
    user_id,
    full_name,
    role,
    status,
    permissions,
    invited_at,
    accepted_at
  )
  VALUES (
    v_tenant_id,
    p_user_id,
    v_profile.full_name,
    lower(p_role),
    lower(p_status),
    COALESCE(p_permissions, '{}'::jsonb),
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    permissions = EXCLUDED.permissions,
    updated_at = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------------------------
-- 4. ATUALIZAR RPC DE EDIÇÃO DE CONVITE PENDENTE PELO ADMINISTRADOR
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tenant_invitation(
  p_invitation_id UUID,
  p_full_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_permissions JSONB,
  p_expires_at TIMESTAMPTZ
)
RETURNS public.tenant_invitations AS $$
DECLARE
  v_tenant_id UUID;
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_invitation public.tenant_invitations;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador') THEN
    RAISE EXCEPTION 'Perfil de usuário inválido';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Defina uma validade futura para o convite';
  END IF;

  UPDATE public.tenant_invitations ti
  SET
    full_name = NULLIF(btrim(COALESCE(p_full_name, '')), ''),
    email = v_email,
    phone = NULLIF(btrim(COALESCE(p_phone, '')), ''),
    role = lower(p_role),
    permissions = COALESCE(p_permissions, '{}'::jsonb),
    expires_at = p_expires_at,
    status = CASE WHEN p_expires_at <= NOW() THEN 'convite_expirado' ELSE 'pendente' END
  WHERE ti.id = p_invitation_id
    AND ti.tenant_id = v_tenant_id
    AND ti.accepted_at IS NULL
  RETURNING * INTO v_invitation;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite pendente não encontrado para este tenant';
  END IF;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------------------------
-- 5. ATUALIZAR RPC CANÔNICA: admin_create_invitation_with_activation_code (8 PARAMS)
-- ------------------------------------------------------------------------------
-- Habilita 'contador' como perfil interno válido no mecanismo oficial de convites
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
  v_empresa_id UUID;
BEGIN
  -- 1. Autorização estrita de Administrador de Tenant (SEC-02)
  v_tenant_id := public.admin_require_tenant_admin();

  -- 2. Validações de entrada
  IF v_email = '' OR position('@' in v_email) = 0 THEN
    RAISE EXCEPTION 'E-mail corporativo inválido';
  END IF;

  -- 2.1 Validação de Função / Papel institucional (incluindo 'contador' e 'cliente')
  IF v_role NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente', 'contador') THEN
    RAISE EXCEPTION 'Função/Papel inválido: %', v_role;
  END IF;

  -- 2.2 Validação específica para usuários do Portal do Cliente
  IF v_role = 'cliente' THEN
    IF p_permissions IS NULL OR (p_permissions -> 'cliente_context' ->> 'empresa_id') IS NULL THEN
      RAISE EXCEPTION 'Para usuários do Portal do Cliente, é obrigatório selecionar uma empresa contratante válida.';
    END IF;

    BEGIN
      v_empresa_id := (p_permissions -> 'cliente_context' ->> 'empresa_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Identificador da empresa contratante inválido (deve ser UUID).';
    END;

    IF NOT EXISTS (
      SELECT 1 FROM public.empresas
       WHERE id = v_empresa_id
         AND tenant_id = v_tenant_id
    ) THEN
      RAISE EXCEPTION 'A empresa contratante informada não existe ou não pertence a este tenant.';
    END IF;
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
    E'Olá, %s!

Você foi convidado para acessar a plataforma ORBE pela empresa %s.

Para ativar sua conta com segurança, siga os passos abaixo:

1. Acesse o link de ativação:
/cadastro?token=%s

2. Informe o seu Código de Ativação temporário:
%s

3. Crie sua senha de acesso pessoal.

Atenção: Por razões de segurança, este código expira em 10 minutos. Caso você não reconheça este convite, desconsidere esta mensagem.',
    COALESCE(NULLIF(btrim(p_full_name), ''), 'Usuário'),
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
    'INVITATION_CREATED_WITH_CODE',
    'tenant_invitations',
    v_invitation.id,
    v_user_id,
    format('Convite com código de ativação emitido para %s com função %s.', v_email, v_role),
    'ONBOARDING_SEC03'
  );

  RETURN jsonb_build_object(
    'success', true,
    'invitation_id', v_invitation.id,
    'token', v_token,
    'code', v_code,
    'expires_at', v_challenge_expires_at,
    'invitation_message', v_formatted_message,
    'role', v_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions, pg_temp;

REVOKE ALL ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation_with_activation_code(TEXT, TEXT, TEXT, TEXT, JSONB, TIMESTAMPTZ, TEXT, TEXT) TO service_role;

COMMIT;

