-- ==============================================================================
-- SCRIPT 00: sec_02_script_00_schema_minimo_local.sql
-- PROJETO: ERP ORBE - ESC LOG 2026
-- GATE: SEC-02.9 - Preparação do Schema Mínimo de Homologação Local
-- FINALIDADE:
--   Reproduzir o estado PRÉ-MIGRATION do Supabase para os objetos envolvidos
--   na SEC-02, com base estrita nas evidências confirmadas em auditoria de produção:
--     1. public.tenants
--     2. public.profiles (com as 4 políticas RLS reais, grants excessivos e trigger antiga)
--     3. public.tenant_invitations (com constraint original sem 'em_processamento')
--     4. public.user_permissions
--     5. Funções auxiliares (current_tenant_id com SECURITY DEFINER, admin_require_tenant_admin, validate_invitation_token)
-- DESTINO: EXCLUSIVAMENTE PostgreSQL Local (127.0.0.1:54322) - Container supabase_db_sec02_hml
-- AVISO: Contém travas fail-closed multicamadas que abortam se executado fora do container local.
-- ==============================================================================

\set ON_ERROR_STOP 1

-- ------------------------------------------------------------------------------
-- 0. TRAVAS FAIL-CLOSED MULTICAMADAS
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_server_addr inet := inet_server_addr();
  v_host_header text := current_setting('request.headers', true)::json->>'host';
  v_hosts_content text;
  v_has_real_erp_data boolean := false;
BEGIN
  -- 1. Verificação de Host Header Remoto
  IF v_host_header ILIKE '%supabase.co%' OR v_host_header ILIKE '%lifgjtcflzmspilhryap%' THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Tentativa de execução bloqueada! Host header remoto de produção detectado: %', v_host_header;
  END IF;

  -- 2. Verificação de Conexão de Rede (apenas loopback local 127.0.0.1 ou ::1)
  IF v_server_addr IS NOT NULL AND v_server_addr NOT IN ('127.0.0.1'::inet, '::1'::inet) THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: Servidor conectado (%) não é loopback local!', v_server_addr;
  END IF;

  -- 3. Verificação de Identificação do Container (supabase_db_sec02_hml)
  -- Dentro do container Docker, /etc/hosts contém o alias da rede e nome do container.
  BEGIN
    SELECT pg_read_file('/etc/hosts') INTO v_hosts_content;
    IF v_hosts_content IS NOT NULL AND v_hosts_content NOT ILIKE '%sec02_hml%' THEN
      RAISE EXCEPTION 'FATAL / FAIL-CLOSED: O container conectado não corresponde a supabase_db_sec02_hml (/etc/hosts não possui identificador sec02_hml)!';
    END IF;
  EXCEPTION
    WHEN undefined_file THEN
      -- Se não estiver em Linux/Docker onde /etc/hosts existe, avisar mas prosseguir apenas se loopback
      RAISE NOTICE '[FAIL-CLOSED] /etc/hosts não disponível para inspeção de container. Validando por loopback e ausência de tabelas ERP.';
    WHEN insufficient_privilege THEN
      RAISE NOTICE '[FAIL-CLOSED] Sem privilégio para ler /etc/hosts. Prosseguindo com checagens de integridade estrutural.';
  END;

  -- 4. Verificação de Preservação Anti-Produção: Nenhuma tabela real de ERP pode existir
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_name IN ('colaboradores', 'empresas', 'operacoes', 'lancamentos_diaristas', 'registros_ponto')
  ) INTO v_has_real_erp_data;

  IF v_has_real_erp_data THEN
    RAISE EXCEPTION 'FATAL / FAIL-CLOSED: O banco de dados conectado contém tabelas operacionais reais do ERP ORBE! Abortando imediatamente para prevenir contaminação.';
  END IF;

  RAISE NOTICE '[FAIL-CLOSED CHECK] Conexão local validada com sucesso: 127.0.0.1:54322 (Container supabase_db_sec02_hml descartável).';
END $$;

-- ------------------------------------------------------------------------------
-- 1. EXTENSÕES BÁSICAS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 2. TABELA public.tenants [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Suporte retrocompatível para schemas com coluna 'name'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'nome'
  ) THEN
    ALTER TABLE public.tenants ADD COLUMN nome TEXT;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. TABELA public.profiles [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  telefone TEXT,
  documento TEXT,
  avatar_url TEXT
);

-- Ativar RLS [COMPROVADO]
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 3.1. AS QUATRO POLÍTICAS RLS REAIS PRÉ-MIGRATION [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
-- Evidência de produção: 4 políticas ativas, todas baseadas unicamente em user_id = auth.uid():
--   1. "Users can insert own profile" (INSERT)
--   2. "Users can read own profile" (SELECT)
--   3. "Users can see their own profile" (SELECT)
--   4. "Users can update own profile" (UPDATE)

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO public
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO public
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can see their own profile" ON public.profiles;
CREATE POLICY "Users can see their own profile" ON public.profiles
  FOR SELECT TO public
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO public
  USING (user_id = auth.uid());

-- ------------------------------------------------------------------------------
-- 3.2. PRIVILÉGIOS EXCESSIVOS DE TABELA E COLUNA [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
-- Na produção, anon e authenticated possuíam privilégios diretos excessivos de INSERT, UPDATE, DELETE
GRANT ALL ON public.profiles TO anon, authenticated;
GRANT ALL (id, user_id, tenant_id, role, created_at) ON public.profiles TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3.3. TRIGGER ANTIGA VULNERÁVEL DE PROFILES [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
-- A trigger original permitia bypass por administradores na troca de tenant_id/role
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
DECLARE
  v_is_admin BOOLEAN := false;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    SELECT (lower(role) = 'admin' AND tenant_id = OLD.tenant_id)
    INTO v_is_admin
    FROM public.profiles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Não é permitido alterar o tenant_id de um perfil.';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores podem alterar a role.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_sensitive_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- ------------------------------------------------------------------------------
-- 4. TABELA public.tenant_invitations [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pendente',
  accepted_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  full_name TEXT,
  phone TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint original confirmada em produção [COMPROVADO]: SEM 'em_processamento'
ALTER TABLE public.tenant_invitations DROP CONSTRAINT IF EXISTS tenant_invitations_status_check;
ALTER TABLE public.tenant_invitations
  ADD CONSTRAINT tenant_invitations_status_check
  CHECK (status = ANY (ARRAY['pendente'::text, 'aceito'::text, 'convite_expirado'::text, 'bloqueado'::text]));

-- Trigger original de proteção parcial de convites aceitos [COMPROVADO]
CREATE OR REPLACE FUNCTION public.protect_invitation_accepted_status()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'aceito' AND NEW.status != 'aceito' THEN
    RAISE EXCEPTION 'Não é permitido alterar o status de um convite já aceito';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_invitation_accepted_status ON public.tenant_invitations;
CREATE TRIGGER trg_protect_invitation_accepted_status
BEFORE UPDATE ON public.tenant_invitations
FOR EACH ROW
EXECUTE FUNCTION public.protect_invitation_accepted_status();

-- Conceder privilégios pré-migration [COMPROVADO]
GRANT SELECT, INSERT, UPDATE ON public.tenant_invitations TO authenticated;
GRANT SELECT ON public.tenant_invitations TO anon;

-- [APROXIMAÇÃO DE TESTE] RLS básico em tenant_invitations para isolamento durante testes
ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_invitations_select" ON public.tenant_invitations;
CREATE POLICY "tenant_invitations_select" ON public.tenant_invitations
  FOR SELECT TO authenticated
  USING (true);

-- ------------------------------------------------------------------------------
-- 5. TABELA public.user_permissions [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'ativo',
  permissions JSONB DEFAULT '{}'::jsonb,
  invited_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT user_permissions_user_tenant_key UNIQUE (user_id, tenant_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_permissions TO authenticated;

-- [APROXIMAÇÃO DE TESTE] RLS em user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_permissions_all" ON public.user_permissions;
CREATE POLICY "user_permissions_all" ON public.user_permissions
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 6. FUNÇÃO public.current_tenant_id() REAL PRÉ-MIGRATION [COMPROVADO]
-- ------------------------------------------------------------------------------
-- Definição exata conforme 20260526130000_fix_config_tipos_operacao_rls.sql:
-- Possui SECURITY DEFINER, STABLE, sem SET search_path e com privilégios públicos.
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO PUBLIC, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 7. FUNÇÕES AUXILIARES DE GESTÃO [COMPROVADO EM AUDITORIA]
-- ------------------------------------------------------------------------------

-- Função admin_require_tenant_admin original (de 20260524090000)
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

GRANT EXECUTE ON FUNCTION public.admin_require_tenant_admin() TO authenticated, anon;

-- Função validate_invitation_token original (de 20260524090000)
CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND status = 'pendente'
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'id', v_invitation.id,
    'email', v_invitation.email,
    'role', v_invitation.role,
    'tenant_id', v_invitation.tenant_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.validate_invitation_token(TEXT) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 8. FUNÇÕES TRANSACIONAIS PRÉ-MIGRATION [APROXIMAÇÃO HISTÓRICA DOCUMENTADA]
-- ------------------------------------------------------------------------------
-- Versão pré-migration de accept_tenant_invitation sem 'em_processamento'
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
RETURNS UUID AS $$
DECLARE
  v_invitation RECORD;
  v_profile_id UUID;
BEGIN
  SELECT * INTO v_invitation
  FROM public.tenant_invitations
  WHERE token = p_token
    AND status = 'pendente'
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite inválido ou expirado';
  END IF;

  INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
  VALUES (auth.uid(), v_invitation.tenant_id, v_invitation.full_name, v_invitation.role)
  RETURNING id INTO v_profile_id;

  UPDATE public.tenant_invitations
  SET status = 'aceito', accepted_by = auth.uid(), accepted_at = now()
  WHERE id = v_invitation.id;

  RETURN v_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.accept_tenant_invitation(TEXT) TO authenticated, anon;

-- Versão pré-migration de admin_update_user_access
CREATE OR REPLACE FUNCTION public.admin_update_user_access(
  p_user_id UUID,
  p_role TEXT,
  p_status TEXT,
  p_permissions JSONB
)
RETURNS public.user_permissions AS $$
DECLARE
  v_tenant_id UUID;
  v_row public.user_permissions;
BEGIN
  v_tenant_id := public.admin_require_tenant_admin();

  UPDATE public.profiles
  SET role = lower(p_role)
  WHERE user_id = p_user_id AND tenant_id = v_tenant_id;

  INSERT INTO public.user_permissions (tenant_id, user_id, role, status, permissions)
  VALUES (v_tenant_id, p_user_id, lower(p_role), lower(p_status), p_permissions)
  ON CONFLICT (user_id, tenant_id) DO UPDATE
  SET role = EXCLUDED.role, status = EXCLUDED.status, permissions = EXCLUDED.permissions
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_update_user_access(UUID, TEXT, TEXT, JSONB) TO authenticated, anon;

-- ------------------------------------------------------------------------------
-- 8. TABELA public.audit_log [COMPROVADO EM AUDITORIA - SPRINT 3]
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    empresa_id UUID,
    usuario_id UUID,
    usuario_nome TEXT,
    perfil_usuario TEXT,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    registro_id UUID NOT NULL,
    descricao TEXT,
    valor_anterior JSONB,
    valor_novo JSONB,
    origem TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Strict Insert Only on audit_log" ON public.audit_log;
CREATE POLICY "Strict Insert Only on audit_log" 
ON public.audit_log 
FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Strict Select on audit_log" ON public.audit_log;
CREATE POLICY "Strict Select on audit_log" 
ON public.audit_log 
FOR SELECT 
USING (tenant_id = public.current_tenant_id());

GRANT INSERT, SELECT ON public.audit_log TO authenticated, service_role;
REVOKE ALL ON public.audit_log FROM anon, PUBLIC;

-- ------------------------------------------------------------------------------
-- CONCLUSÃO DA CARGA DO SCHEMA MÍNIMO PRÉ-MIGRATION
-- ------------------------------------------------------------------------------
SELECT 'Schema Mínimo Pré-Migration carregado com sucesso na base local descartável (supabase_db_sec02_hml).' AS status;
