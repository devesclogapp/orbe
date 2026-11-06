-- ==============================================================================
-- ORBE ERP - FIX-OCORRÊNCIAS-08: CORREÇÃO INCREMENTAL DE SEGURANÇA (RLS / TENANT)
-- Arquivo: supabase/migrations/20261105233000_fix_ocorrencias_08_seguranca_rls_tenant.sql
--
-- PRÉ-REQUISITO: migration 20261105220000 JÁ APLICADA (não recria tabelas).
--
-- O que esta migration faz (apenas aditivo / substitutivo de POLÍTICAS):
--   1. Falha explicitamente se o ambiente for incompatível (verificações prévias).
--   2. Tenant com UMA única fonte de autoridade: public.current_tenant_id()
--      (profiles). O claim JWT 'tenant_id' deixa de ser usado. Sem fallback com OR.
--   3. Substitui as políticas FOR ALL por políticas separadas SELECT/INSERT/UPDATE,
--      escopando a role ao MESMO tenant da linha.
--   4. DELETE físico bloqueado por política AS RESTRICTIVE (nenhuma política
--      permissiva consegue contornar).
--   5. Triggers impedem associação entre tenants diferentes (decisões, eventos,
--      catálogo) e alteração de tenant_id. Dados históricos NÃO são alterados.
--
-- NÃO faz: DROP TABLE, TRUNCATE, DELETE/UPDATE de dados, alteração de colunas,
--          alteração de regras financeiras, alteração de tabelas de outros módulos.
-- Reexecução segura: funções com CREATE OR REPLACE; triggers/políticas recriados.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. VERIFICAÇÕES PRÉVIAS (falha explícita => ROLLBACK de toda a transação)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_tbl TEXT;
  v_inconsistentes BIGINT;
  v_fn RECORD;
BEGIN
  -- 0.1 Tabelas da migration original e tabelas pai
  FOREACH v_tbl IN ARRAY ARRAY[
    'infracoes_operacionais_catalogo',
    'operacoes_ocorrencias_decisoes',
    'operacoes_ocorrencias_eventos_financeiros',
    'tenants', 'empresas', 'colaboradores', 'operacoes_producao',
    'user_permissions', 'profiles'
  ] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      RAISE EXCEPTION 'FIX08 BLOQUEADO: tabela public.% ausente. Aplique antes a migration 20261105220000.', v_tbl;
    END IF;
  END LOOP;

  -- 0.2 tenant_id obrigatório nas tabelas pai
  FOREACH v_tbl IN ARRAY ARRAY['empresas', 'colaboradores', 'operacoes_producao'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'tenant_id'
    ) THEN
      RAISE EXCEPTION 'FIX08 BLOQUEADO: public.%.tenant_id inexistente.', v_tbl;
    END IF;
  END LOOP;

  -- 0.3 current_tenant_id(): schema public, 0 args, retorno uuid, SECURITY DEFINER,
  --     lê public.profiles e executável por authenticated
  SELECT p.oid, p.prosecdef, p.prosrc, p.prorettype
    INTO v_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'current_tenant_id' AND p.pronargs = 0;

  IF v_fn.oid IS NULL THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: public.current_tenant_id() inexistente.';
  END IF;
  IF v_fn.prorettype <> 'uuid'::regtype THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: public.current_tenant_id() não retorna uuid.';
  END IF;
  IF NOT v_fn.prosecdef THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: public.current_tenant_id() não é SECURITY DEFINER (RLS de profiles pode interferir).';
  END IF;
  IF v_fn.prosrc !~* 'profiles' THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: public.current_tenant_id() não deriva o tenant de public.profiles.';
  END IF;
  IF NOT has_function_privilege('authenticated', v_fn.oid, 'EXECUTE') THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: role authenticated sem EXECUTE em public.current_tenant_id().';
  END IF;

  -- 0.4 get_user_role(): public, 0 args, retorno text
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'get_user_role'
      AND p.pronargs = 0 AND p.prorettype = 'text'::regtype
  ) THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: public.get_user_role() ausente ou incompatível.';
  END IF;

  -- 0.5 Compatibilidade dos dados existentes com as novas regras (somente leitura)
  SELECT count(*) INTO v_inconsistentes
  FROM public.operacoes_ocorrencias_decisoes d
  LEFT JOIN public.empresas e ON e.id = d.empresa_id
  LEFT JOIN public.operacoes_producao o ON o.id = d.operacao_id
  LEFT JOIN public.colaboradores c ON c.id = d.collaborator_id
  LEFT JOIN public.infracoes_operacionais_catalogo i ON i.id = d.infracao_id
  LEFT JOIN public.operacoes_ocorrencias_decisoes r ON r.id = d.revisado_de_id
  WHERE e.tenant_id IS DISTINCT FROM d.tenant_id
     OR o.tenant_id IS DISTINCT FROM d.tenant_id
     OR o.empresa_id IS DISTINCT FROM d.empresa_id
     OR c.tenant_id IS DISTINCT FROM d.tenant_id
     OR (d.infracao_id IS NOT NULL AND i.tenant_id IS DISTINCT FROM d.tenant_id)
     OR (d.revisado_de_id IS NOT NULL AND r.tenant_id IS DISTINCT FROM d.tenant_id);
  IF v_inconsistentes > 0 THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: % decisão(ões) existente(s) com vínculo entre tenants/empresas divergentes. Corrija manualmente antes (nenhum dado é alterado automaticamente).', v_inconsistentes;
  END IF;

  SELECT count(*) INTO v_inconsistentes
  FROM public.operacoes_ocorrencias_eventos_financeiros ev
  LEFT JOIN public.operacoes_ocorrencias_decisoes d ON d.id = ev.decisao_id
  LEFT JOIN public.empresas e ON e.id = ev.empresa_id
  LEFT JOIN public.colaboradores c ON c.id = ev.collaborator_id
  WHERE d.tenant_id IS DISTINCT FROM ev.tenant_id
     OR d.empresa_id IS DISTINCT FROM ev.empresa_id
     OR d.collaborator_id IS DISTINCT FROM ev.collaborator_id
     OR e.tenant_id IS DISTINCT FROM ev.tenant_id
     OR c.tenant_id IS DISTINCT FROM ev.tenant_id;
  IF v_inconsistentes > 0 THEN
    RAISE EXCEPTION 'FIX08 BLOQUEADO: % evento(s) financeiro(s) existente(s) com vínculo entre tenants/decisões divergentes. Corrija manualmente antes.', v_inconsistentes;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 1. FUNÇÕES AUXILIARES DE PERFIL (escopadas ao tenant informado)
--    SECURITY DEFINER para ler user_permissions/profiles sem recursão de RLS.
--    Só retornam TRUE se p_tenant_id for o tenant do usuário (current_tenant_id).
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ocorrencias_perfil_gestao(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_tenant_id IS NOT NULL
    AND p_tenant_id = public.current_tenant_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.user_permissions up
        WHERE up.user_id = auth.uid()
          AND up.tenant_id = p_tenant_id
          AND up.status = 'ativo'
          AND up.role IN ('admin', 'super_admin', 'gestor', 'rh')
      )
      OR public.get_user_role() IN ('admin', 'super_admin', 'gestor', 'rh')
    );
$$;

CREATE OR REPLACE FUNCTION public.fn_ocorrencias_perfil_financeiro(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.fn_ocorrencias_perfil_gestao(p_tenant_id)
    OR (
      p_tenant_id IS NOT NULL
      AND p_tenant_id = public.current_tenant_id()
      AND (
        EXISTS (
          SELECT 1 FROM public.user_permissions up
          WHERE up.user_id = auth.uid()
            AND up.tenant_id = p_tenant_id
            AND up.status = 'ativo'
            AND up.role = 'financeiro'
        )
        OR public.get_user_role() = 'financeiro'
      )
    );
$$;

REVOKE ALL ON FUNCTION public.fn_ocorrencias_perfil_gestao(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_ocorrencias_perfil_financeiro(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_ocorrencias_perfil_gestao(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_ocorrencias_perfil_financeiro(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. RLS: estado determinístico (remove QUALQUER política existente nas 3 tabelas
--    e recria o conjunto canônico). Políticas não contêm dados.
-- ------------------------------------------------------------------------------
ALTER TABLE public.infracoes_operacionais_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_ocorrencias_decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes_ocorrencias_eventos_financeiros ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  v_pol RECORD;
BEGIN
  FOR v_pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'infracoes_operacionais_catalogo',
        'operacoes_ocorrencias_decisoes',
        'operacoes_ocorrencias_eventos_financeiros'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', v_pol.policyname, v_pol.schemaname, v_pol.tablename);
  END LOOP;
END $$;

-- 2.1 CATÁLOGO ---------------------------------------------------------------
-- Encarregado (e demais perfis) leem somente itens ativos do próprio tenant;
-- gestão enxerga também os inativos.
CREATE POLICY fix08_catalogo_select
  ON public.infracoes_operacionais_catalogo
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND (ativo = true OR public.fn_ocorrencias_perfil_gestao(tenant_id))
  );

CREATE POLICY fix08_catalogo_insert
  ON public.infracoes_operacionais_catalogo
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_gestao(tenant_id)
  );

CREATE POLICY fix08_catalogo_update
  ON public.infracoes_operacionais_catalogo
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_gestao(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_gestao(tenant_id)
  );

CREATE POLICY fix08_catalogo_no_delete
  ON public.infracoes_operacionais_catalogo
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- 2.2 DECISÕES ADMINISTRATIVAS -----------------------------------------------
-- Leitura: gestão + financeiro. Escrita: somente gestão (Admin/RH). Encarregado: nada.
CREATE POLICY fix08_decisoes_select
  ON public.operacoes_ocorrencias_decisoes
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_financeiro(tenant_id)
  );

CREATE POLICY fix08_decisoes_insert
  ON public.operacoes_ocorrencias_decisoes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_gestao(tenant_id)
  );

CREATE POLICY fix08_decisoes_update
  ON public.operacoes_ocorrencias_decisoes
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_gestao(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_gestao(tenant_id)
  );

CREATE POLICY fix08_decisoes_no_delete
  ON public.operacoes_ocorrencias_decisoes
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- 2.3 EVENTOS FINANCEIROS ----------------------------------------------------
-- Leitura e escrita: gestão + financeiro (mesma regra da migration original).
CREATE POLICY fix08_eventos_select
  ON public.operacoes_ocorrencias_eventos_financeiros
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_financeiro(tenant_id)
  );

CREATE POLICY fix08_eventos_insert
  ON public.operacoes_ocorrencias_eventos_financeiros
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_financeiro(tenant_id)
  );

CREATE POLICY fix08_eventos_update
  ON public.operacoes_ocorrencias_eventos_financeiros
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_financeiro(tenant_id)
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.fn_ocorrencias_perfil_financeiro(tenant_id)
  );

CREATE POLICY fix08_eventos_no_delete
  ON public.operacoes_ocorrencias_eventos_financeiros
  AS RESTRICTIVE
  FOR DELETE
  USING (false);

-- 2.4 GRANTS: authenticated sem DELETE (defesa em profundidade)
REVOKE ALL ON public.infracoes_operacionais_catalogo FROM anon;
REVOKE ALL ON public.operacoes_ocorrencias_decisoes FROM anon;
REVOKE ALL ON public.operacoes_ocorrencias_eventos_financeiros FROM anon;

REVOKE DELETE ON public.infracoes_operacionais_catalogo FROM authenticated;
REVOKE DELETE ON public.operacoes_ocorrencias_decisoes FROM authenticated;
REVOKE DELETE ON public.operacoes_ocorrencias_eventos_financeiros FROM authenticated;

-- ------------------------------------------------------------------------------
-- 3. INTEGRIDADE ENTRE TENANTS (triggers; sem alterar tabelas de outros módulos)
--    Validam apenas novas escritas. Registros históricos permanecem intactos.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_ocorrencias_validar_tenant_catalogo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id é imutável em infracoes_operacionais_catalogo.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_ocorrencias_validar_tenant_decisao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_empresa UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id é imutável em operacoes_ocorrencias_decisoes.' USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.empresas WHERE id = NEW.empresa_id;
  IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Empresa % não pertence ao tenant da decisão.', NEW.empresa_id USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id, empresa_id INTO v_tenant, v_empresa
  FROM public.operacoes_producao WHERE id = NEW.operacao_id;
  IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Operação % não pertence ao tenant da decisão.', NEW.operacao_id USING ERRCODE = '23514';
  END IF;
  IF v_empresa IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Operação % não pertence à empresa informada na decisão.', NEW.operacao_id USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.colaboradores WHERE id = NEW.collaborator_id;
  IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Colaborador % não pertence ao tenant da decisão.', NEW.collaborator_id USING ERRCODE = '23514';
  END IF;

  IF NEW.infracao_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.infracoes_operacionais_catalogo WHERE id = NEW.infracao_id;
    IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Infração % não pertence ao tenant da decisão.', NEW.infracao_id USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.revisado_de_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant FROM public.operacoes_ocorrencias_decisoes WHERE id = NEW.revisado_de_id;
    IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
      RAISE EXCEPTION 'Decisão revisada % não pertence ao tenant da decisão.', NEW.revisado_de_id USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_ocorrencias_validar_tenant_evento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant UUID;
  v_dec RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    RAISE EXCEPTION 'tenant_id é imutável em operacoes_ocorrencias_eventos_financeiros.' USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id, empresa_id, collaborator_id INTO v_dec
  FROM public.operacoes_ocorrencias_decisoes WHERE id = NEW.decisao_id;
  IF v_dec.tenant_id IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Decisão % não pertence ao tenant do evento financeiro.', NEW.decisao_id USING ERRCODE = '23514';
  END IF;
  IF v_dec.empresa_id IS DISTINCT FROM NEW.empresa_id THEN
    RAISE EXCEPTION 'Empresa do evento diverge da empresa da decisão %.', NEW.decisao_id USING ERRCODE = '23514';
  END IF;
  IF v_dec.collaborator_id IS DISTINCT FROM NEW.collaborator_id THEN
    RAISE EXCEPTION 'Colaborador do evento diverge do colaborador da decisão %.', NEW.decisao_id USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.empresas WHERE id = NEW.empresa_id;
  IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Empresa % não pertence ao tenant do evento financeiro.', NEW.empresa_id USING ERRCODE = '23514';
  END IF;

  SELECT tenant_id INTO v_tenant FROM public.colaboradores WHERE id = NEW.collaborator_id;
  IF v_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'Colaborador % não pertence ao tenant do evento financeiro.', NEW.collaborator_id USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_ocorrencias_validar_tenant_catalogo() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ocorrencias_validar_tenant_decisao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_ocorrencias_validar_tenant_evento() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_fix08_catalogo_tenant ON public.infracoes_operacionais_catalogo;
CREATE TRIGGER trg_fix08_catalogo_tenant
  BEFORE INSERT OR UPDATE ON public.infracoes_operacionais_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocorrencias_validar_tenant_catalogo();

DROP TRIGGER IF EXISTS trg_fix08_decisoes_tenant ON public.operacoes_ocorrencias_decisoes;
CREATE TRIGGER trg_fix08_decisoes_tenant
  BEFORE INSERT OR UPDATE ON public.operacoes_ocorrencias_decisoes
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocorrencias_validar_tenant_decisao();

DROP TRIGGER IF EXISTS trg_fix08_eventos_tenant ON public.operacoes_ocorrencias_eventos_financeiros;
CREATE TRIGGER trg_fix08_eventos_tenant
  BEFORE INSERT OR UPDATE ON public.operacoes_ocorrencias_eventos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.fn_ocorrencias_validar_tenant_evento();

-- ------------------------------------------------------------------------------
-- 4. AUTO-VERIFICAÇÃO FINAL (falha => ROLLBACK)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_n INTEGER;
BEGIN
  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('infracoes_operacionais_catalogo','operacoes_ocorrencias_decisoes','operacoes_ocorrencias_eventos_financeiros')
    AND (coalesce(qual, '') ILIKE '%jwt%' OR coalesce(with_check, '') ILIKE '%jwt%');
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FIX08 FALHA: % política(s) ainda dependem de claim JWT.', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('infracoes_operacionais_catalogo','operacoes_ocorrencias_decisoes','operacoes_ocorrencias_eventos_financeiros')
    AND cmd = 'DELETE' AND permissive = 'RESTRICTIVE';
  IF v_n <> 3 THEN
    RAISE EXCEPTION 'FIX08 FALHA: esperadas 3 políticas RESTRICTIVE de DELETE, encontradas %.', v_n;
  END IF;

  SELECT count(*) INTO v_n FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('infracoes_operacionais_catalogo','operacoes_ocorrencias_decisoes','operacoes_ocorrencias_eventos_financeiros')
    AND (cmd = 'ALL' OR (cmd = 'DELETE' AND permissive = 'PERMISSIVE'));
  IF v_n > 0 THEN
    RAISE EXCEPTION 'FIX08 FALHA: restaram % política(s) FOR ALL/DELETE permissivas.', v_n;
  END IF;
END $$;

COMMIT;

