-- ==============================================================================
-- MIGRATION: 20261103210000_fix_sec02_profiles_role_cliente.sql
-- DOMÍNIO: Governança / Onboarding / Portal do Cliente
-- OBJETIVO: 
--   Atualizar as funções de validação de gatilho do SEC-02 para reconhecer o papel
--   'cliente' nas tabelas public.profiles e public.user_permissions.
-- 
-- CAUSA RAIZ:
--   A migration 20261103180000 atualizou as constraints de CHECK (profiles_role_check, etc.)
--   para incluir 'cliente', porém o gatilho BEFORE INSERT ON public.profiles
--   (função public.protect_profile_insert) e a RPC public.admin_update_user_access
--   mantinham uma checagem restrita que disparava:
--   RAISE EXCEPTION 'Função (role) de usuário inválida.';
--   impedindo o aceite de convite de clientes na tela de ativação de conta.
-- ==============================================================================

BEGIN;

-- 1. ATUALIZAR GATILHO DE PROTEÇÃO DE INSERT EM public.profiles
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

  -- Permitir formalmente o papel 'cliente' ao lado dos demais papéis institucionais
  IF NEW.role IS NULL OR lower(NEW.role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente') THEN
    RAISE EXCEPTION 'Função (role) de usuário inválida.';
  END IF;

  NEW.role := lower(NEW.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 2. ATUALIZAR RPC DE GESTÃO DE ACESSOS PELO ADMINISTRADOR (PRESERVANDO RETURNS public.user_permissions)
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

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user', 'cliente') THEN
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

COMMIT;
