-- ============================================================
-- REPAIR: restaurar usuários convidados aceitos na listagem admin
-- Data: 2026-05-24
-- Objetivo:
--   1. Reidratar user_permissions a partir de profiles + convites aceitos
--   2. Fazer a listagem admin nascer de profiles para não "sumir" usuário
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_user_permissions_from_profiles(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
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
    COALESCE(up.status, 'ativo'),
    COALESCE(up.permissions, inv.permissions, '{}'::jsonb),
    COALESCE(up.invited_at, inv.created_at),
    COALESCE(up.accepted_at, inv.accepted_at, NOW())
  FROM public.profiles p
  JOIN auth.users au
    ON au.id = p.user_id
  LEFT JOIN public.user_permissions up
    ON up.user_id = p.user_id
   AND up.tenant_id = p.tenant_id
  LEFT JOIN LATERAL (
    SELECT ti.*
    FROM public.tenant_invitations ti
    WHERE ti.tenant_id = p.tenant_id
      AND lower(ti.email) = lower(au.email)
    ORDER BY ti.accepted_at DESC NULLS LAST, ti.created_at DESC
    LIMIT 1
  ) inv ON TRUE
  WHERE p.tenant_id IS NOT NULL
    AND (p_tenant_id IS NULL OR p.tenant_id = p_tenant_id)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET
    full_name = COALESCE(EXCLUDED.full_name, public.user_permissions.full_name),
    phone = COALESCE(EXCLUDED.phone, public.user_permissions.phone),
    role = EXCLUDED.role,
    status = COALESCE(public.user_permissions.status, EXCLUDED.status, 'ativo'),
    permissions = COALESCE(
      NULLIF(public.user_permissions.permissions, '{}'::jsonb),
      EXCLUDED.permissions,
      '{}'::jsonb
    ),
    invited_at = COALESCE(public.user_permissions.invited_at, EXCLUDED.invited_at),
    accepted_at = COALESCE(public.user_permissions.accepted_at, EXCLUDED.accepted_at),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

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

  PERFORM public.sync_user_permissions_from_profiles(v_tenant_id);

  RETURN QUERY
  WITH latest_invites AS (
    SELECT DISTINCT ON (lower(ti.email))
      ti.id,
      ti.tenant_id,
      lower(ti.email) AS email_key,
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
    ORDER BY lower(ti.email), ti.accepted_at DESC NULLS LAST, ti.created_at DESC
  ),
  tenant_users AS (
    SELECT
      p.id AS profile_id,
      p.user_id,
      p.tenant_id,
      p.full_name AS profile_name,
      p.role AS profile_role,
      au.email,
      au.last_sign_in_at,
      up.id AS user_permissions_id,
      up.full_name AS permissions_name,
      up.phone,
      up.role AS permissions_role,
      up.status AS permissions_status,
      up.permissions,
      up.invited_at,
      up.accepted_at,
      li.id AS invite_id,
      li.full_name AS invite_name,
      li.phone AS invite_phone,
      li.role AS invite_role,
      li.permissions AS invite_permissions,
      li.created_at AS invite_created_at,
      li.accepted_at AS invite_accepted_at,
      li.expires_at AS invite_expires_at
    FROM public.profiles p
    JOIN auth.users au
      ON au.id = p.user_id
    LEFT JOIN public.user_permissions up
      ON up.user_id = p.user_id
     AND up.tenant_id = p.tenant_id
    LEFT JOIN latest_invites li
      ON li.email_key = lower(au.email)
    WHERE p.tenant_id = v_tenant_id
  )
  SELECT
    'user'::TEXT AS record_type,
    COALESCE(tu.user_permissions_id, tu.profile_id) AS record_id,
    tu.user_id,
    tu.invite_id,
    COALESCE(
      NULLIF(tu.profile_name, ''),
      NULLIF(tu.permissions_name, ''),
      NULLIF(tu.invite_name, ''),
      split_part(tu.email, '@', 1)
    )::TEXT AS full_name,
    tu.email::TEXT AS email,
    COALESCE(tu.phone, tu.invite_phone)::TEXT AS phone,
    COALESCE(NULLIF(tu.permissions_role, ''), NULLIF(tu.profile_role, ''), tu.invite_role, 'user')::TEXT AS role,
    COALESCE(NULLIF(tu.permissions_status, ''), 'ativo')::TEXT AS status,
    COALESCE(tu.permissions, tu.invite_permissions, '{}'::jsonb) AS permissions,
    COALESCE(tu.invited_at, tu.invite_created_at) AS invited_at,
    COALESCE(tu.accepted_at, tu.invite_accepted_at) AS accepted_at,
    tu.invite_expires_at AS expires_at,
    tu.last_sign_in_at AS last_access_at,
    NULL::TEXT AS token
  FROM tenant_users tu

  UNION ALL

  SELECT
    'invite'::TEXT AS record_type,
    ti.id AS record_id,
    NULL::UUID AS user_id,
    ti.id AS invite_id,
    ti.full_name::TEXT,
    ti.email::TEXT,
    ti.phone::TEXT,
    ti.role::TEXT,
    CASE
      WHEN ti.status = 'bloqueado' THEN 'bloqueado'
      WHEN ti.expires_at <= NOW() THEN 'convite_expirado'
      ELSE 'pendente'
    END::TEXT AS status,
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
