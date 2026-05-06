-- ============================================================
-- FIX: Edicao segura de convites por tenant
-- Data: 2026-05-18
-- Objetivo:
--   1. Evitar falhas de update por drift de RLS em tenant_invitations
--   2. Permitir que admins editem email e perfil de convites pendentes
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_tenant_invitation(
  p_invitation_id UUID,
  p_email TEXT,
  p_role TEXT
)
RETURNS TABLE (
  id UUID,
  email TEXT,
  role TEXT
) AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_tenant_id UUID;
  v_role TEXT;
  v_email TEXT := lower(btrim(COALESCE(p_email, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT p.tenant_id, p.role
  INTO v_tenant_id, v_role
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant do usuário não identificado';
  END IF;

  IF lower(COALESCE(v_role, '')) <> 'admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem editar convites';
  END IF;

  IF v_email = '' OR position('@' IN v_email) = 0 THEN
    RAISE EXCEPTION 'Informe um e-mail válido';
  END IF;

  IF p_role NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'user') THEN
    RAISE EXCEPTION 'Perfil de convite inválido';
  END IF;

  RETURN QUERY
  UPDATE public.tenant_invitations ti
  SET
    email = v_email,
    role = p_role
  WHERE ti.id = p_invitation_id
    AND ti.tenant_id = v_tenant_id
    AND ti.accepted_at IS NULL
    AND ti.expires_at > NOW()
  RETURNING ti.id, ti.email, ti.role;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite pendente não encontrado para este tenant';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
