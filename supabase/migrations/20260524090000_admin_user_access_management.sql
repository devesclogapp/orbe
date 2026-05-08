-- ============================================================
-- Gestão de Usuários e Acessos
-- Data: 2026-05-24
-- Objetivo:
--   1. Restaurar a gestão administrativa de usuários, convites e permissões
--   2. Consolidar o fluxo multi-tenant por convite
--   3. Impedir troca manual de tenant/role pelo usuário convidado
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user'));

ALTER TABLE public.tenant_invitations
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS accepted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_invitations_role_check'
      AND conrelid = 'public.tenant_invitations'::regclass
  ) THEN
    ALTER TABLE public.tenant_invitations DROP CONSTRAINT tenant_invitations_role_check;
  END IF;
END $$;

ALTER TABLE public.tenant_invitations
  ADD CONSTRAINT tenant_invitations_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tenant_invitations_status_check'
      AND conrelid = 'public.tenant_invitations'::regclass
  ) THEN
    ALTER TABLE public.tenant_invitations DROP CONSTRAINT tenant_invitations_status_check;
  END IF;
END $$;

ALTER TABLE public.tenant_invitations
  ADD CONSTRAINT tenant_invitations_status_check
  CHECK (status IN ('pendente', 'aceito', 'convite_expirado', 'bloqueado'));

UPDATE public.tenant_invitations
SET status = CASE
  WHEN accepted_at IS NOT NULL THEN 'aceito'
  WHEN expires_at <= NOW() THEN 'convite_expirado'
  ELSE 'pendente'
END
WHERE status IS DISTINCT FROM CASE
  WHEN accepted_at IS NOT NULL THEN 'aceito'
  WHEN expires_at <= NOW() THEN 'convite_expirado'
  ELSE 'pendente'
END;

CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'ativo',
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, tenant_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_permissions_role_check'
      AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_role_check;
  END IF;
END $$;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_role_check
  CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user'));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'user_permissions_status_check'
      AND conrelid = 'public.user_permissions'::regclass
  ) THEN
    ALTER TABLE public.user_permissions DROP CONSTRAINT user_permissions_status_check;
  END IF;
END $$;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_status_check
  CHECK (status IN ('ativo', 'bloqueado'));

CREATE INDEX IF NOT EXISTS idx_tenant_invitations_tenant_status
  ON public.tenant_invitations (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_permissions_tenant_status
  ON public.user_permissions (tenant_id, status, updated_at DESC);

CREATE OR REPLACE FUNCTION public.touch_admin_access_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_tenant_invitations_updated_at ON public.tenant_invitations;
CREATE TRIGGER trg_touch_tenant_invitations_updated_at
BEFORE UPDATE ON public.tenant_invitations
FOR EACH ROW
EXECUTE FUNCTION public.touch_admin_access_updated_at();

DROP TRIGGER IF EXISTS trg_touch_user_permissions_updated_at ON public.user_permissions;
CREATE TRIGGER trg_touch_user_permissions_updated_at
BEFORE UPDATE ON public.user_permissions
FOR EACH ROW
EXECUTE FUNCTION public.touch_admin_access_updated_at();

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
)
SELECT
  p.tenant_id,
  p.user_id,
  p.full_name,
  inv.phone,
  p.role,
  'ativo',
  COALESCE(inv.permissions, '{}'::jsonb),
  inv.created_at,
  inv.accepted_at
FROM public.profiles p
LEFT JOIN LATERAL (
  SELECT ti.*
  FROM public.tenant_invitations ti
  JOIN auth.users au
    ON lower(au.email) = lower(ti.email)
  WHERE au.id = p.user_id
    AND ti.tenant_id = p.tenant_id
    AND ti.accepted_at IS NOT NULL
  ORDER BY ti.accepted_at DESC NULLS LAST, ti.created_at DESC
  LIMIT 1
) inv ON TRUE
ON CONFLICT (user_id, tenant_id) DO UPDATE
SET
  full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
  phone = COALESCE(EXCLUDED.phone, public.user_permissions.phone),
  role = EXCLUDED.role,
  accepted_at = COALESCE(EXCLUDED.accepted_at, public.user_permissions.accepted_at),
  invited_at = COALESCE(EXCLUDED.invited_at, public.user_permissions.invited_at);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_permissions_select" ON public.user_permissions;
CREATE POLICY "user_permissions_select" ON public.user_permissions
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = user_permissions.tenant_id
  )
);

DROP POLICY IF EXISTS "user_permissions_admin_insert" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_insert" ON public.user_permissions
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = user_permissions.tenant_id
  )
);

DROP POLICY IF EXISTS "user_permissions_admin_update" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_update" ON public.user_permissions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = user_permissions.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = user_permissions.tenant_id
  )
);

DROP POLICY IF EXISTS "user_permissions_admin_delete" ON public.user_permissions;
CREATE POLICY "user_permissions_admin_delete" ON public.user_permissions
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = user_permissions.tenant_id
  )
);

DROP POLICY IF EXISTS "Convites visíveis para admins do tenant" ON public.tenant_invitations;
DROP POLICY IF EXISTS "invitations_tenant_all" ON public.tenant_invitations;
DROP POLICY IF EXISTS "tenant_invitations_admin_select" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_admin_select" ON public.tenant_invitations
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = tenant_invitations.tenant_id
  )
);

DROP POLICY IF EXISTS "tenant_invitations_admin_insert" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_admin_insert" ON public.tenant_invitations
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = tenant_invitations.tenant_id
  )
);

DROP POLICY IF EXISTS "tenant_invitations_admin_update" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_admin_update" ON public.tenant_invitations
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = tenant_invitations.tenant_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = tenant_invitations.tenant_id
  )
);

DROP POLICY IF EXISTS "tenant_invitations_admin_delete" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_admin_delete" ON public.tenant_invitations
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.role = 'admin'
      AND p.tenant_id = tenant_invitations.tenant_id
  )
);

CREATE OR REPLACE FUNCTION public.admin_require_tenant_admin()
RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_role TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT p.tenant_id, lower(p.role)
  INTO v_tenant_id, v_role
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant do usuário não identificado';
  END IF;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador da conta.';
  END IF;

  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR lower(COALESCE(NEW.role, '')) IS DISTINCT FROM lower(COALESCE(OLD.role, '')) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.role = 'admin'
        AND p.tenant_id = OLD.tenant_id
    ) THEN
      RAISE EXCEPTION 'Role e tenant do usuário só podem ser alterados pelo administrador.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.role
  INTO v_role
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    BEGIN
      SELECT pu.role
      INTO v_role
      FROM public.perfis_usuarios pu
      WHERE pu.user_id = v_user_id
      LIMIT 1;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      v_role := NULL;
    END;
  END IF;

  RETURN CASE lower(COALESCE(v_role, ''))
    WHEN 'admin' THEN 'Admin'
    WHEN 'financeiro' THEN 'Financeiro'
    WHEN 'rh' THEN 'RH'
    WHEN 'encarregado' THEN 'Encarregado'
    WHEN 'gestor' THEN 'Gestor'
    WHEN 'user' THEN 'User'
    ELSE v_role
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.validate_invitation_token(TEXT);
CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
RETURNS TABLE(
  id UUID,
  tenant_id UUID,
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
  WHERE ti.token = p_token
    AND ti.accepted_at IS NULL
    AND ti.status <> 'bloqueado'
    AND ti.expires_at > NOW();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_list_user_access_overview()
RETURNS TABLE (
  record_type TEXT,
  record_id UUID,
  user_id UUID,
  invite_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  permissions JSONB,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_access_at TIMESTAMPTZ,
  token TEXT
) AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  RETURN QUERY
  WITH latest_invites AS (
    SELECT DISTINCT ON (ti.email)
      ti.id,
      ti.tenant_id,
      ti.email,
      ti.full_name,
      ti.phone,
      ti.role,
      ti.permissions,
      ti.status,
      ti.accepted_at,
      ti.expires_at,
      ti.created_at,
      ti.token
    FROM public.tenant_invitations ti
    WHERE ti.tenant_id = v_tenant_id
    ORDER BY ti.email, ti.created_at DESC
  )
  SELECT
    'user'::TEXT AS record_type,
    up.id AS record_id,
    up.user_id,
    li.id AS invite_id,
    COALESCE(p.full_name, up.full_name, li.full_name, split_part(au.email, '@', 1)) AS full_name,
    au.email,
    COALESCE(up.phone, li.phone) AS phone,
    COALESCE(up.role, p.role) AS role,
    COALESCE(NULLIF(up.status, ''), 'ativo') AS status,
    COALESCE(up.permissions, '{}'::jsonb) AS permissions,
    COALESCE(up.invited_at, li.created_at) AS invited_at,
    COALESCE(up.accepted_at, li.accepted_at) AS accepted_at,
    li.expires_at,
    au.last_sign_in_at AS last_access_at,
    NULL::TEXT AS token
  FROM public.user_permissions up
  JOIN public.profiles p
    ON p.user_id = up.user_id
   AND p.tenant_id = up.tenant_id
  JOIN auth.users au
    ON au.id = up.user_id
  LEFT JOIN latest_invites li
    ON lower(li.email) = lower(au.email)
  WHERE up.tenant_id = v_tenant_id

  UNION ALL

  SELECT
    'invite'::TEXT AS record_type,
    ti.id AS record_id,
    NULL::UUID AS user_id,
    ti.id AS invite_id,
    ti.full_name,
    ti.email,
    ti.phone,
    ti.role,
    CASE
      WHEN ti.status = 'bloqueado' THEN 'bloqueado'
      WHEN ti.expires_at <= NOW() THEN 'convite_expirado'
      ELSE 'pendente'
    END AS status,
    COALESCE(ti.permissions, '{}'::jsonb) AS permissions,
    ti.created_at AS invited_at,
    ti.accepted_at,
    ti.expires_at,
    NULL::TIMESTAMPTZ AS last_access_at,
    ti.token
  FROM public.tenant_invitations ti
  WHERE ti.tenant_id = v_tenant_id
    AND ti.accepted_at IS NULL
  ORDER BY invited_at DESC NULLS LAST, email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.admin_create_tenant_invitation(
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
  v_user_id UUID := auth.uid();
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_invitation public.tenant_invitations;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
    RAISE EXCEPTION 'Perfil de usuário inválido';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Defina uma validade futura para o convite';
  END IF;

  UPDATE public.tenant_invitations
  SET
    status = 'convite_expirado',
    expires_at = NOW()
  WHERE tenant_id = v_tenant_id
    AND lower(email) = v_email
    AND accepted_at IS NULL
    AND status = 'pendente';

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
  )
  VALUES (
    v_tenant_id,
    v_email,
    NULLIF(btrim(COALESCE(p_full_name, '')), ''),
    NULLIF(btrim(COALESCE(p_phone, '')), ''),
    lower(p_role),
    COALESCE(p_permissions, '{}'::jsonb),
    v_user_id,
    'pendente',
    p_expires_at
  )
  RETURNING * INTO v_invitation;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP FUNCTION IF EXISTS public.update_tenant_invitation(UUID, TEXT, TEXT);
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

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
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

CREATE OR REPLACE FUNCTION public.admin_renew_tenant_invitation(
  p_invitation_id UUID,
  p_expires_at TIMESTAMPTZ
)
RETURNS public.tenant_invitations AS $$
DECLARE
  v_tenant_id UUID;
  v_invitation public.tenant_invitations;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  IF p_expires_at IS NULL OR p_expires_at <= NOW() THEN
    RAISE EXCEPTION 'Defina uma validade futura para o convite';
  END IF;

  UPDATE public.tenant_invitations ti
  SET
    token = encode(gen_random_bytes(16), 'hex'),
    expires_at = p_expires_at,
    status = 'pendente'
  WHERE ti.id = p_invitation_id
    AND ti.tenant_id = v_tenant_id
    AND ti.accepted_at IS NULL
  RETURNING * INTO v_invitation;

  IF v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado para renovação';
  END IF;

  RETURN v_invitation;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
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

CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  p_user_id UUID := auth.uid();
  invitation public.tenant_invitations%ROWTYPE;
  existing_profile public.profiles%ROWTYPE;
  profile_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND status <> 'bloqueado'
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  IF lower(invitation.email) <> lower((SELECT email FROM auth.users WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
  END IF;

  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    IF existing_profile.tenant_id IS DISTINCT FROM invitation.tenant_id THEN
      RAISE EXCEPTION 'Usuário já possui vínculo com outro tenant';
    END IF;

    UPDATE public.profiles
    SET
      tenant_id = invitation.tenant_id,
      role = invitation.role,
      full_name = COALESCE(
        NULLIF(invitation.full_name, ''),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id),
        existing_profile.full_name
      )
    WHERE id = existing_profile.id
    RETURNING id INTO profile_id;
  ELSE
    INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
    VALUES (
      p_user_id,
      invitation.tenant_id,
      COALESCE(
        NULLIF(invitation.full_name, ''),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)
      ),
      invitation.role
    )
    RETURNING id INTO profile_id;
  END IF;

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
  )
  VALUES (
    invitation.tenant_id,
    p_user_id,
    COALESCE(
      NULLIF(invitation.full_name, ''),
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)
    ),
    invitation.phone,
    invitation.role,
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
    invited_at = COALESCE(public.user_permissions.invited_at, EXCLUDED.invited_at),
    accepted_at = EXCLUDED.accepted_at,
    updated_at = NOW();

  UPDATE public.tenant_invitations
  SET
    accepted_at = NOW(),
    accepted_by = p_user_id,
    status = 'aceito'
  WHERE id = invitation.id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
