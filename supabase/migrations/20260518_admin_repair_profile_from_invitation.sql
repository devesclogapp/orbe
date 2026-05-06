-- ============================================================
-- ADMIN REPAIR: Reconciliar profile a partir do convite
-- Data: 2026-05-18
-- Objetivo:
--   1. Corrigir casos em que o convite nao marcou accepted_at
--   2. Permitir reparo manual de role/tenant por email
--   3. Restringir execucao a administradores autenticados
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_repair_profile_from_invitation(
  p_email TEXT
)
RETURNS TABLE (
  user_id UUID,
  tenant_id UUID,
  role TEXT,
  invitation_id UUID,
  accepted_at TIMESTAMPTZ
) AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_actor_role TEXT;
  v_actor_tenant UUID;
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
  v_user auth.users%ROWTYPE;
  v_invitation public.tenant_invitations%ROWTYPE;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT p.role, p.tenant_id
  INTO v_actor_role, v_actor_tenant
  FROM public.profiles p
  WHERE p.user_id = v_actor_id
  LIMIT 1;

  IF lower(COALESCE(v_actor_role, '')) <> 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem executar este reparo';
  END IF;

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  SELECT *
  INTO v_user
  FROM auth.users
  WHERE lower(email) = v_email
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuário não encontrado em auth.users';
  END IF;

  SELECT *
  INTO v_invitation
  FROM public.tenant_invitations ti
  WHERE lower(ti.email) = v_email
    AND ti.tenant_id = v_actor_tenant
  ORDER BY COALESCE(ti.accepted_at, ti.created_at) DESC, ti.created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum convite encontrado para este e-mail no tenant atual';
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
  VALUES (
    v_user.id,
    v_invitation.tenant_id,
    COALESCE(v_user.raw_user_meta_data->>'full_name', split_part(v_email, '@', 1)),
    v_invitation.role
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    tenant_id = EXCLUDED.tenant_id,
    role = EXCLUDED.role,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  UPDATE public.tenant_invitations
  SET accepted_at = COALESCE(accepted_at, NOW())
  WHERE id = v_invitation.id;

  RETURN QUERY
  SELECT
    v_user.id,
    v_invitation.tenant_id,
    v_invitation.role,
    v_invitation.id,
    COALESCE(v_invitation.accepted_at, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
