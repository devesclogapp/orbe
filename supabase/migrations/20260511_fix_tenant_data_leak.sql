-- ============================================================
-- FIX: Corrigir vazamento de dados entre tenants
-- Data: 2026-05-11
-- Causa: fallback OR public.current_tenant_id() IS NULL
--        permite acesso total a usuários sem tenant_id no profile
-- ============================================================

-- ============================================================
-- 1. REMOVER fallback perigoso na policy de empresas
-- ============================================================

DROP POLICY IF EXISTS "Users see only their tenant companies" ON public.empresas;
DROP POLICY IF EXISTS "Acesso total autenticado para empresas" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_select" ON public.empresas;

-- Usuário SÓ VÊ empresas do seu tenant (sem fallback NULL)
CREATE POLICY "empresas_tenant_select" ON public.empresas
  FOR SELECT USING (
    tenant_id = public.current_tenant_id()
  );

-- Usuário só pode criar empresa no seu tenant
DROP POLICY IF EXISTS "empresas_tenant_insert" ON public.empresas;
CREATE POLICY "empresas_tenant_insert" ON public.empresas
  FOR INSERT WITH CHECK (
    tenant_id = public.current_tenant_id()
  );

-- Usuário só pode atualizar empresa do seu tenant
DROP POLICY IF EXISTS "empresas_tenant_update" ON public.empresas;
CREATE POLICY "empresas_tenant_update" ON public.empresas
  FOR UPDATE USING (
    tenant_id = public.current_tenant_id()
  );

-- Usuário só pode deletar empresa do seu tenant
DROP POLICY IF EXISTS "empresas_tenant_delete" ON public.empresas;
CREATE POLICY "empresas_tenant_delete" ON public.empresas
  FOR DELETE USING (
    tenant_id = public.current_tenant_id()
  );

-- ============================================================
-- 2. REMOVER fallback perigoso nas policies de dados
-- ============================================================

-- transportadoras_clientes
DROP POLICY IF EXISTS "tc_tenant_isolation_select" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_insert" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_update" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_delete" ON public.transportadoras_clientes;

CREATE POLICY "tc_tenant_isolation_select" ON public.transportadoras_clientes
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );
CREATE POLICY "tc_tenant_isolation_insert" ON public.transportadoras_clientes
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );
CREATE POLICY "tc_tenant_isolation_update" ON public.transportadoras_clientes
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );
CREATE POLICY "tc_tenant_isolation_delete" ON public.transportadoras_clientes
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );

-- fornecedores
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_delete" ON public.fornecedores;

CREATE POLICY "fornecedor_tenant_isolation_select" ON public.fornecedores
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );
CREATE POLICY "fornecedor_tenant_isolation_insert" ON public.fornecedores
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );
CREATE POLICY "fornecedor_tenant_isolation_update" ON public.fornecedores
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );
CREATE POLICY "fornecedor_tenant_isolation_delete" ON public.fornecedores
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );

-- regras_financeiras
DROP POLICY IF EXISTS "rf_tenant_isolation" ON public.regras_financeiras;
CREATE POLICY "rf_tenant_isolation" ON public.regras_financeiras
  FOR ALL TO authenticated USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL  -- regras globais do sistema (sem tenant)
  );

-- fornecedor_valores_servico
DROP POLICY IF EXISTS "fvs_tenant_isolation_select" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_insert" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_update" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_delete" ON public.fornecedor_valores_servico;

CREATE POLICY "fvs_tenant_isolation_select" ON public.fornecedor_valores_servico
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
  );
CREATE POLICY "fvs_tenant_isolation_insert" ON public.fornecedor_valores_servico
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
  );
CREATE POLICY "fvs_tenant_isolation_update" ON public.fornecedor_valores_servico
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
  );
CREATE POLICY "fvs_tenant_isolation_delete" ON public.fornecedor_valores_servico
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
  );

-- operacoes (policy de select existente via 20260505010000 também tem fallback)
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.operacoes;
CREATE POLICY "Users can only see their tenant data" ON public.operacoes
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );

-- operacoes_producao
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.operacoes_producao;
CREATE POLICY "Users can only see their tenant data" ON public.operacoes_producao
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );

-- colaboradores
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.colaboradores;
CREATE POLICY "Users can only see their tenant data" ON public.colaboradores
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );

-- custos_extras_operacionais
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.custos_extras_operacionais;
CREATE POLICY "Users can only see their tenant data" ON public.custos_extras_operacionais
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
  );

-- ============================================================
-- 3. GARANTIR que o admin suport.orbitalabs@gmail.com tem tenant
-- Verificar se profile já tem tenant_id. Se não, criar tenant e vincular.
-- ============================================================

DO $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_tenant_id UUID;
  v_tenant_exists UUID;
BEGIN
  -- Buscar user_id do admin
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'suport.orbitalabs@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário suport.orbitalabs@gmail.com não encontrado em auth.users';
    RETURN;
  END IF;

  -- Verificar se profile tem tenant_id
  SELECT id, tenant_id INTO v_profile_id, v_tenant_exists
  FROM profiles
  WHERE user_id = v_user_id
  LIMIT 1;

  IF v_tenant_exists IS NOT NULL THEN
    RAISE NOTICE 'Profile já tem tenant_id: %', v_tenant_exists;
    RETURN;
  END IF;

  -- Criar tenant para o admin
  v_tenant_id := gen_random_uuid();
  INSERT INTO tenants (id, name, created_by)
  VALUES (v_tenant_id, 'Orbital Labs', v_user_id);

  -- Vincular tenant ao profile
  IF v_profile_id IS NOT NULL THEN
    UPDATE profiles SET tenant_id = v_tenant_id WHERE id = v_profile_id;
    RAISE NOTICE 'Tenant criado e vinculado ao profile existente: %', v_tenant_id;
  ELSE
    -- Criar profile se não existir
    INSERT INTO profiles (user_id, tenant_id, role)
    VALUES (v_user_id, v_tenant_id, 'admin');
    RAISE NOTICE 'Profile criado com tenant_id: %', v_tenant_id;
  END IF;

  -- Vincular empresas existentes sem tenant ao novo tenant do admin
  UPDATE public.empresas
  SET tenant_id = v_tenant_id
  WHERE tenant_id IS NULL;

  RAISE NOTICE 'Empresas sem tenant vinculadas ao tenant do admin.';
END $$;
