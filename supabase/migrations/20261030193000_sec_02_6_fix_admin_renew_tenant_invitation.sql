-- ==============================================================================
-- ORBE — FIX SEC-02.6: Correção de Qualificação de Schema em admin_renew_tenant_invitation
-- Data: 2026-10-30
-- Descrição: Qualifica explicitamente a função extensions.gen_random_bytes(16)
--            dentro de public.admin_renew_tenant_invitation para compatibilidade
--            com o search_path restritivo (search_path = public) em ambiente Supabase Cloud.
-- Idempotente e Incremental. Preserva contratos, validações e isolamento multitenant.
-- ==============================================================================

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
    token = encode(extensions.gen_random_bytes(16), 'hex'),
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

COMMENT ON FUNCTION public.admin_renew_tenant_invitation(UUID, TIMESTAMPTZ) IS
  'SEC-02.6: Renova token e expiração de convite pendente com qualificação explícita extensions.gen_random_bytes e search_path restrito.';

REVOKE ALL ON FUNCTION public.admin_renew_tenant_invitation(UUID, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_renew_tenant_invitation(UUID, TIMESTAMPTZ) TO authenticated;

