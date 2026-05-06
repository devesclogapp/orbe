-- ============================================================
-- FIX: Aceite de convite para usuario ja vinculado ao mesmo tenant
-- Data: 2026-05-18
-- Objetivo:
--   1. Permitir convite de encarregado para usuario ja existente
--   2. Atualizar role quando o usuario ja pertence ao mesmo tenant
--   3. Bloquear apenas troca entre tenants diferentes
-- ============================================================

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
    AND expires_at > NOW()
    AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  IF invitation.email != (SELECT email FROM auth.users WHERE id = p_user_id) THEN
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
      role = invitation.role,
      full_name = COALESCE(
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
      (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id),
      invitation.role
    )
    RETURNING id INTO profile_id;
  END IF;

  UPDATE public.tenant_invitations
  SET accepted_at = NOW()
  WHERE id = invitation.id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
