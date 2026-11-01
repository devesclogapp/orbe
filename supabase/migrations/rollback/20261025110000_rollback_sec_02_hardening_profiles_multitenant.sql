-- ==============================================================================
-- ROLLBACK: 20261025110000_rollback_sec_02_hardening_profiles_multitenant.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02.6 - Reversão Estrutural da Migration de Hardening de Profiles
-- FINALIDADE: Restaurar fielmente o catálogo e o estado pré-existente identificado na auditoria
-- ------------------------------------------------------------------------------
-- ⚠️ AVISO CRÍTICO DE RISCO DE SEGURANÇA:
--   Executar este script restaura as configurações originais que foram auditadas e
--   comprovadas como vulneráveis no banco real:
--   1. Reintroduz privilégios diretos de INSERT/UPDATE em id, user_id, tenant_id e role para anon/authenticated.
--   2. Restaura a trigger legada (20260524090000) que possui a falha onde 'p.tenant_id = OLD.tenant_id'
--      permite que um administrador altere o tenant_id de qualquer perfil sem autorização no tenant destino.
--   3. Reintroduz políticas RLS fracas baseadas somente em 'user_id = auth.uid()'.
--   DISTINÇÃO MANDATÓRIA: Este script é uma reversão estrutural de catálogo (DDL).
--   Não confundir com o ROLLBACK transacional de descarte de dados sintéticos de teste (Script 03).
-- ==============================================================================

-- 1. Remoção das triggers e funções adicionadas na migration
DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_insert();

DROP TRIGGER IF EXISTS trg_protect_profile_delete ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_delete();

DROP FUNCTION IF EXISTS public.admin_delete_tenant_invitation(UUID);

-- 2. Restauração da trigger e função anterior de proteção de campos sensíveis (versão 20260524090000)
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

-- 3. Restauração de accept_tenant_invitation para a versão anterior (20260524090000)
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

-- 4. Restauração das políticas RLS anteriores de profiles (4 políticas reais confirmadas em auditoria)
-- Primeiro removemos as políticas novas para liberar dependências de funções
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_select" ON public.profiles;

-- Agora é seguro remover a função auxiliar anti-recursão can_view_tenant_profiles
DROP FUNCTION IF EXISTS public.can_view_tenant_profiles();

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO public
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can see their own profile" ON public.profiles
  FOR SELECT TO public
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public
  USING (user_id = auth.uid());

-- 5. Restauração dos privilégios anteriores exatos
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL (id, user_id, tenant_id, role, created_at) ON public.profiles TO anon, authenticated;

-- 6. Restauração de current_tenant_id() sem restrição de EXECUTE
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO PUBLIC, anon, authenticated;

-- 7. Restauração segura da constraint original de tenant_invitations e remoção de trigger
DROP TRIGGER IF EXISTS trg_protect_tenant_invitations_state ON public.tenant_invitations;
DROP FUNCTION IF EXISTS public.protect_tenant_invitations_state();

DO $$
DECLARE
  v_count_processing INTEGER;
  r RECORD;
BEGIN
  -- 1. Diagnóstico de integridade pré-reversão de constraint
  SELECT COUNT(*) INTO v_count_processing
  FROM public.tenant_invitations
  WHERE status = 'em_processamento';

  IF v_count_processing > 0 THEN
    RAISE NOTICE '⚠️ ATENÇÃO: Identificados % convite(s) com status em_processamento durante o rollback.', v_count_processing;
    FOR r IN (
      SELECT id, email, tenant_id, role, accepted_by 
      FROM public.tenant_invitations 
      WHERE status = 'em_processamento'
    ) LOOP
      RAISE NOTICE '   Auditoria: Convite ID %, Email %, Tenant %, Role %, Accepted_by %', 
        r.id, r.email, r.tenant_id, r.role, r.accepted_by;
      
      -- Se o perfil correspondente já foi criado/atualizado com este papel, consolidar para 'aceito'
      IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = r.accepted_by 
          AND tenant_id = r.tenant_id 
          AND lower(role) = lower(r.role)
      ) THEN
        UPDATE public.tenant_invitations
        SET status = 'aceito', accepted_at = NOW()
        WHERE id = r.id;
        RAISE NOTICE '   -> Recuperação: Convite % consolidado para aceito (perfil correspondente já ativo).', r.id;
      ELSE
        -- Caso contrário, restabelece com segurança para 'pendente' liberando novo aceite
        UPDATE public.tenant_invitations
        SET status = 'pendente', accepted_by = NULL
        WHERE id = r.id;
        RAISE NOTICE '   -> Recuperação: Convite % retornado para pendente (perfil não modificado).', r.id;
      END IF;
    END LOOP;
  ELSE
    RAISE NOTICE '✔ Diagnóstico pré-rollback: Zero registros em status em_processamento. Catálogo limpo.';
  END IF;

  -- 2. Restauração estrita da constraint original
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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_invitations TO authenticated;
