-- ==============================================================================
-- SCRIPT DEFINITIVO DE IMPLANTAÇÃO MANUAL: SEC-02
-- ARQUIVO: supabase/auditorias/sec_02_script_definitivo_execucao_manual.sql
-- PROJETO: ERP ORBE - ESC LOG (Supabase Cloud: lifgjtcflzmspilhryap)
-- MOTOR: PostgreSQL 17.6
-- MODO: TRANSAÇÃO ATÔMICA ÚNICA COM TIMEOUTS DE SEGURANÇA
-- INSTRUÇÃO: Copiar este arquivo integralmente e colar no SQL Editor do Supabase.
-- ==============================================================================

BEGIN;

-- Timeouts de proteção transacional:
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

-- ==============================================================================
-- MIGRATION: 20261025110000_sec_02_hardening_profiles_multitenant.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02.5 - Hardening Definitivo de Segurança Multi-Tenant (public.profiles)
-- OBJETIVO:
--   1. Eliminar risco de Privilege Escalation e Tenant Takeover via public.profiles
--   2. Revogar privilégios diretos excessivos de INSERT, DELETE e UPDATE para anon/authenticated
--   3. Conceder UPDATE estritamente em colunas cadastrais/onboarding não críticas
--   4. Garantir imutabilidade estrita de tenant_id e user_id
--   5. Eliminar qualquer session variable ou dependência de timestamp volátil
--   6. Centralizar alterações de role em RPCs autenticadas com validação relacional estrita
--   7. Eliminar recursão RLS em profiles usando função auxiliar STABLE SECURITY DEFINER
--   8. Preservar isolamento de Encarregados e suporte operacional a RH/Financeiro/Admin
--   9. Aplicar SET search_path = public e controle de EXECUTE em current_tenant_id()
-- MODO: LOCAL / PRONTO PARA APLICAÇÃO MANUAL NO SQL EDITOR DO SUPABASE DE HOMOLOGAÇÃO
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDENING DE CURRENT_TENANT_ID (Função Base de RLS Multi-Tenant)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.current_tenant_id() IS 
  'Retorna o tenant_id do usuário autenticado a partir de public.profiles de forma segura e determinística.';

REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO AUXILIAR NÃO-RECURSIVA PARA VERIFICAÇÃO DE ACESSO DE GESTÃO
-- ------------------------------------------------------------------------------
-- Executa com SECURITY DEFINER (owner postgres) para ler a role do usuário sem
-- acionar RLS na tabela profiles, eliminando qualquer risco de recursão infinita.
CREATE OR REPLACE FUNCTION public.can_view_tenant_profiles()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = auth.uid()
      AND lower(role) IN ('admin', 'rh', 'financeiro')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.can_view_tenant_profiles() IS
  'Função auxiliar de segurança para políticas RLS; verifica se o usuário autenticado possui perfil de gestão sem disparar recursão.';

REVOKE ALL ON FUNCTION public.can_view_tenant_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_tenant_profiles() TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. REVOGAÇÃO DE PRIVILÉGIOS EXCESSIVOS (TABELA E COLUNAS)
-- ------------------------------------------------------------------------------
-- Revogar TODOS os privilégios em nível de tabela para anon, authenticated e PUBLIC
REVOKE ALL ON public.profiles FROM anon, authenticated, PUBLIC;

-- Revogar explicitamente privilégios diretos em colunas sensíveis (prevenção contra resíduos)
REVOKE ALL (id, user_id, tenant_id, role, created_at) ON public.profiles FROM anon, authenticated, PUBLIC;

-- Conceder permissão de SELECT para authenticated
GRANT SELECT ON public.profiles TO authenticated;

-- Conceder UPDATE estritamente nas colunas cadastrais e operacionais legítimas do usuário final
DO $$
DECLARE
  v_col text;
  v_allowed_cols text[] := ARRAY[
    'full_name',
    'phone',
    'avatar_url',
    'updated_at',
    'onboarding_completed',
    'onboarding_step',
    'onboarding_completed_steps'
  ];
BEGIN
  FOREACH v_col IN ARRAY v_allowed_cols LOOP
    IF EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'profiles' 
        AND column_name = v_col
    ) THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated;', v_col);
    END IF;
  END LOOP;
END $$;

-- ------------------------------------------------------------------------------
-- 4. POLÍTICAS RLS (ROW LEVEL SECURITY) LIVRES DE RECURSÃO
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Limpeza de políticas legadas ou inseguras
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_insert" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update" ON public.profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_delete" ON public.profiles;
DROP POLICY IF EXISTS "Read access for authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- Política de Leitura Granular (Livre de Recursão):
-- 1. Qualquer usuário autenticado lê seu próprio perfil (user_id = auth.uid()) de forma imediata
-- 2. Perfis de terceiros no mesmo tenant são visíveis EXCLUSIVAMENTE para papéis de gestão ('admin', 'rh', 'financeiro')
--    utilizando a função auxiliar can_view_tenant_profiles() para não autorreferenciar a tabela na policy.
-- 3. Encarregados e usuários operacionais permanecem estritamente isolados aos seus próprios perfis.
CREATE POLICY "profiles_select_policy" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() 
    OR (
      tenant_id = public.current_tenant_id()
      AND public.can_view_tenant_profiles()
    )
  );

-- Política de Atualização: Usuário atualiza exclusivamente seu próprio perfil (nas colunas permitidas pelo GRANT)
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- NOTA: Nenhuma política de INSERT ou DELETE é concedida para authenticated ou anon.
-- Apenas service_role (Edge Functions) e SECURITY DEFINER (RPCs autorizadas) realizam INSERT/DELETE.

-- ------------------------------------------------------------------------------
-- 4.1. COMPATIBILIZAÇÃO DA CONSTRAINT DE STATUS DE CONVITES (tenant_invitations_status_check)
-- ------------------------------------------------------------------------------
-- A constraint original em produção restringe os status a:
-- ('pendente', 'aceito', 'convite_expirado', 'bloqueado').
-- Para garantir integridade relacional sem falha de violação de constraint durante a transição
-- atômica do aceite, a constraint é atualizada para incluir 'em_processamento'.
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
  CHECK (status IN ('pendente', 'em_processamento', 'aceito', 'convite_expirado', 'bloqueado'));

COMMENT ON CONSTRAINT tenant_invitations_status_check ON public.tenant_invitations IS
  'Restringe os status permitidos de convite, suportando o estado transitório atômico em_processamento.';

-- ------------------------------------------------------------------------------
-- 4.2. TRIGGER DE PROTEÇÃO DE TRANSIÇÃO DE ESTADO DE CONVITES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_tenant_invitations_state()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Bloqueio em operações de exclusão
  IF TG_OP = 'DELETE' THEN
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Exclusão direta na tabela tenant_invitations não é permitida. Utilize as operações administrativas.';
    END IF;
    IF OLD.status = 'aceito' THEN
      RAISE EXCEPTION 'Convites com status aceito são registros históricos de auditoria e não podem ser excluídos.';
    END IF;
    RETURN OLD;
  END IF;

  -- 2. Rejeitar qualquer mutação direta disparada por clientes (anon / authenticated)
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Mutações diretas na tabela tenant_invitations não são permitidas. Utilize as RPCs oficiais.';
  END IF;

  -- 3. Imutabilidade integral de convites aceitos: nenhum campo pode ser modificado após o aceite
  IF OLD.status = 'aceito' THEN
    RAISE EXCEPTION 'Convites com status aceito são estritamente imutáveis em todos os seus campos e não podem sofrer alterações.';
  END IF;

  -- 4. Validação estrita para o estado transitório 'em_processamento'
  IF NEW.status = 'em_processamento' THEN
    IF OLD.status IS DISTINCT FROM 'pendente' THEN
      RAISE EXCEPTION 'Apenas convites no status pendente podem entrar em processamento.';
    END IF;
    IF NEW.accepted_by IS NULL THEN
      RAISE EXCEPTION 'Convite em processamento requer indicação do usuário autenticado (accepted_by).';
    END IF;
    IF NEW.accepted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Convite em processamento não pode possuir accepted_at definido.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_tenant_invitations_state ON public.tenant_invitations;
CREATE TRIGGER trg_protect_tenant_invitations_state
BEFORE UPDATE OR DELETE ON public.tenant_invitations
FOR EACH ROW
EXECUTE FUNCTION public.protect_tenant_invitations_state();

-- ------------------------------------------------------------------------------
-- 5. FLUXO TRANSACIONAL PRIVILEGIADO: accept_tenant_invitation
-- ------------------------------------------------------------------------------
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

  -- 1. Buscar e travar o convite para evitar concorrência (FOR UPDATE)
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

  -- 2. Validar correspondência estrita de e-mail do usuário autenticado
  IF lower(invitation.email) <> lower((SELECT email FROM auth.users WHERE id = p_user_id)) THEN
    RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
  END IF;

  -- 3. Transicionar status do convite para 'em_processamento' exclusivamente durante esta transação
  UPDATE public.tenant_invitations
  SET
    status = 'em_processamento',
    accepted_by = p_user_id
  WHERE id = invitation.id;

  -- 4. Verificar se o perfil já existe para o usuário
  SELECT *
  INTO existing_profile
  FROM public.profiles
  WHERE user_id = p_user_id
  LIMIT 1;

  IF FOUND THEN
    -- Impedir associação cruzada com múltiplos tenants
    IF existing_profile.tenant_id IS DISTINCT FROM invitation.tenant_id THEN
      RAISE EXCEPTION 'Usuário já possui vínculo com outro tenant';
    END IF;

    -- Atualizar o perfil com o papel autorizado pelo convite
    UPDATE public.profiles
    SET
      role = lower(invitation.role),
      full_name = COALESCE(
        NULLIF(invitation.full_name, ''),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id),
        existing_profile.full_name
      )
    WHERE id = existing_profile.id
    RETURNING id INTO profile_id;
  ELSE
    -- Inserir novo perfil para o usuário no tenant do convite
    INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
    VALUES (
      p_user_id,
      invitation.tenant_id,
      COALESCE(
        NULLIF(invitation.full_name, ''),
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id)
      ),
      lower(invitation.role)
    )
    RETURNING id INTO profile_id;
  END IF;

  -- 5. Sincronizar permissões detalhadas em user_permissions
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
    invited_at = COALESCE(public.user_permissions.invited_at, EXCLUDED.invited_at),
    accepted_at = EXCLUDED.accepted_at,
    updated_at = NOW();

  -- 6. Finalizar o ciclo do convite marcando como 'aceito' definitivo
  UPDATE public.tenant_invitations
  SET
    status = 'aceito',
    accepted_at = NOW()
  WHERE id = invitation.id;

  RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 6. TRIGGERS DE PROTEÇÃO E DEFESA EM PROFUNDIDADE
-- ------------------------------------------------------------------------------

-- Trigger 6.1: Bloqueio absoluto de INSERT direto por clientes
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

  IF NEW.role IS NULL OR lower(NEW.role) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
    RAISE EXCEPTION 'Função (role) de usuário inválida.';
  END IF;

  NEW.role := lower(NEW.role);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_insert ON public.profiles;
CREATE TRIGGER trg_protect_profile_insert
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_insert();

-- Trigger 6.2: Bloqueio absoluto de DELETE direto por clientes
CREATE OR REPLACE FUNCTION public.protect_profile_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    RAISE EXCEPTION 'Exclusão direta de perfis não permitida.';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_delete ON public.profiles;
CREATE TRIGGER trg_protect_profile_delete
BEFORE DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_delete();

-- Trigger 6.3: Blindagem de UPDATE (Imutabilidade de id/tenant_id/user_id e autorização relacional de role)
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- 1. Imutabilidade absoluta de id
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'O id de um perfil é estritamente imutável.';
  END IF;

  -- 2. Imutabilidade absoluta de tenant_id (Prevenção total contra Tenant Hopping e bypass de admin)
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'O tenant_id de um perfil é estritamente imutável.';
  END IF;

  -- 3. Imutabilidade absoluta de user_id
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'O user_id de um perfil é estritamente imutável.';
  END IF;

  -- 4. Proteção e auditoria para alteração de role
  IF lower(COALESCE(NEW.role, '')) IS DISTINCT FROM lower(COALESCE(OLD.role, '')) THEN
    -- Bloqueio absoluto de alteração de role originada diretamente de papéis de cliente
    IF current_user IN ('authenticated', 'anon') THEN
      RAISE EXCEPTION 'Alteração direta da função (role) não permitida. Utilize as operações administrativas autorizadas.';
    END IF;

    -- Se o próprio usuário está tendo o papel alterado (fluxo accept_tenant_invitation):
    -- Exige comprovação relacional estrita e verificação de todos os invariantes do convite em processamento
    IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.tenant_invitations ti
        WHERE ti.accepted_by = OLD.user_id
          AND ti.tenant_id = OLD.tenant_id
          AND lower(ti.role) = lower(NEW.role)
          AND ti.status = 'em_processamento'
          AND ti.accepted_at IS NULL
          AND ti.expires_at > NOW()
          AND lower(ti.email) = lower((SELECT email FROM auth.users WHERE id = OLD.user_id))
      ) THEN
        RAISE EXCEPTION 'Não é permitido alterar a própria função/perfil de acesso sem um convite em processamento ativo, válido e tempestivo.';
      END IF;
    ELSIF auth.uid() IS NOT NULL THEN
      -- Se a alteração for em outro colaborador (fluxo admin_update_user_access):
      -- O operador deve ser administrador ativo do MESMO tenant
      IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND lower(p.role) = 'admin'
          AND p.tenant_id = OLD.tenant_id
      ) THEN
        RAISE EXCEPTION 'Apenas o administrador do mesmo tenant pode alterar a função de um colaborador.';
      END IF;
    ELSE
      -- Chamada interna sem JWT (auth.uid nulo): se for tentada por cliente, aborta
      IF current_user IN ('authenticated', 'anon') THEN
        RAISE EXCEPTION 'Operação anônima não autorizada para alterar papel de usuário.';
      END IF;
    END IF;

    NEW.role := lower(NEW.role);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- ------------------------------------------------------------------------------
-- 7. REFORÇO DE ADMINISTRAÇÃO DE ACESSOS: admin_update_user_access
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

  -- Bloquear expressamente que um administrador altere seu próprio acesso por este fluxo
  IF p_user_id = v_current_user THEN
    RAISE EXCEPTION 'O administrador não pode alterar o próprio acesso por esta tela.';
  END IF;

  IF lower(COALESCE(p_role, '')) NOT IN ('admin', 'rh', 'financeiro', 'encarregado', 'gestor', 'user') THEN
    RAISE EXCEPTION 'Perfil de usuário inválido';
  END IF;

  IF lower(COALESCE(p_status, '')) NOT IN ('ativo', 'bloqueado') THEN
    RAISE EXCEPTION 'Status de usuário inválido';
  END IF;

  -- Validar estritamente que o usuário alvo pertence ao mesmo tenant do administrador
  SELECT *
  INTO v_profile
  FROM public.profiles p
  WHERE p.user_id = p_user_id
    AND p.tenant_id = v_tenant_id
  LIMIT 1;

  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'Usuário não pertence ao tenant do administrador';
  END IF;

  -- Atualizar a role no perfil (autorizado pela trigger pois auth.uid é admin do mesmo tenant)
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
-- 7.2. EXCLUSÃO ADMINISTRATIVA DE CONVITES NÃO ACEITOS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_delete_tenant_invitation(
  p_invitation_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID := auth.uid();
  v_invitation public.tenant_invitations%ROWTYPE;
  v_admin_nome TEXT;
  v_admin_role TEXT;
BEGIN
  -- 1. Autenticação e autorização estrita (Admin do Tenant via auth.uid())
  v_tenant_id := public.admin_require_tenant_admin();

  -- 1.1. Bloqueio de Administrador com Acesso Suspenso ou Não-Ativo (Domain Hardening)
  IF EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = v_user_id
      AND up.tenant_id = v_tenant_id
      AND lower(COALESCE(up.status, 'ativo')) <> 'ativo'
  ) THEN
    RAISE EXCEPTION 'Administrador com acesso bloqueado ou suspenso';
  END IF;

  IF p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Identificador de convite inválido';
  END IF;

  -- 2. Localizar o convite com bloqueio pessimista (FOR UPDATE)
  -- Garante isolamento estrito de tenant e previne concorrência com accept_tenant_invitation
  SELECT *
  INTO v_invitation
  FROM public.tenant_invitations
  WHERE id = p_invitation_id
    AND tenant_id = v_tenant_id
  FOR UPDATE;

  -- 3. Resposta neutra para inexistência ou pertença a outro tenant (Zero Data Leak)
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado ou inacessível';
  END IF;

  -- 4. Validação estrita de integridade e imutabilidade de estados
  IF v_invitation.accepted_at IS NOT NULL OR v_invitation.status = 'aceito' THEN
    RAISE EXCEPTION 'Convites aceitos são registros históricos e não podem ser excluídos.';
  END IF;

  IF v_invitation.status = 'em_processamento' THEN
    RAISE EXCEPTION 'Convite em processamento de aceite não pode ser excluído.';
  END IF;

  IF v_invitation.status NOT IN ('pendente', 'convite_expirado', 'bloqueado') THEN
    RAISE EXCEPTION 'Estado de convite inválido ou não elegível para exclusão: %', v_invitation.status;
  END IF;

  -- 5. Obter dados do perfil do administrador executor para rastreabilidade
  SELECT full_name, role
  INTO v_admin_nome, v_admin_role
  FROM public.profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  -- 6. Gravação transacional obrigatória em audit_log (sem expor o segredo token)
  INSERT INTO public.audit_log (
    tenant_id,
    empresa_id,
    usuario_id,
    usuario_nome,
    perfil_usuario,
    acao,
    entidade,
    registro_id,
    descricao,
    valor_anterior,
    origem
  ) VALUES (
    v_tenant_id,
    NULL,
    v_user_id,
    v_admin_nome,
    v_admin_role,
    'DELETE',
    'tenant_invitations',
    v_invitation.id,
    format('Exclusão de convite administrativo para o e-mail: %s (função: %s)', v_invitation.email, v_invitation.role),
    to_jsonb(v_invitation) - 'token',
    'admin_delete_tenant_invitation'
  );

  -- 7. Exclusão física do convite (autorizada pela trigger pois current_user é SECURITY DEFINER)
  DELETE FROM public.tenant_invitations
  WHERE id = v_invitation.id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------------------------
-- 8. BLINDAGEM DE EXECUTE E PROTEÇÃO DE CONVITES
-- ------------------------------------------------------------------------------
-- Impedir que clientes alterem convites diretamente na tabela
REVOKE INSERT, UPDATE, DELETE ON public.tenant_invitations FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.tenant_invitations TO authenticated;

REVOKE ALL ON FUNCTION public.admin_require_tenant_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_require_tenant_admin() TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_update_user_access(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_access(UUID, TEXT, TEXT, JSONB) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.admin_delete_tenant_invitation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_tenant_invitation(UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.accept_tenant_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.validate_invitation_token(TEXT) TO anon, authenticated, service_role;


-- ------------------------------------------------------------------------------
-- CONFIRMAÇÃO ATÔMICA DA TRANSAÇÃO
-- ------------------------------------------------------------------------------
COMMIT;
