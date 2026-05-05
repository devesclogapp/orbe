-- ============================================================
-- STEP 1 SECURITY FIXES - Correções Críticas Multi-Tenant
-- Data: 2026-05-11
-- Ref: AUDITORIA_STEP1_CORRECOES.md
-- Status: 🔴 CRÍTICO - Corrige vazamento de dados entre tenants
-- ============================================================

-- ============================================================
-- PRÉ-REQUISITO: Garantir que empresas.tenant_id existe
-- (a migration 20260505010000 pode não ter sido aplicada)
-- ============================================================

-- Garantir tabela tenants existe antes de tudo
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar tenant_id em empresas se não existir
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Adicionar tenant_id em profiles se não existir
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Criar função public.current_tenant_id() (auth schema sem permissão no SQL Editor)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Criar índice para a lookup do tenant em empresas
CREATE INDEX IF NOT EXISTS idx_empresas_tenant_id ON public.empresas(tenant_id);

-- ============================================================
-- 1. CORRIGIR RLS transportadoras_clientes (CRÍTICO)
-- ============================================================

DROP POLICY IF EXISTS "Acesso leitura autenticado transportadoras_clientes" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "Allow delete transportadoras_clientes" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "Allow update transportadoras_clientes" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_select" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_insert" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_update" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_delete" ON public.transportadoras_clientes;

ALTER TABLE public.transportadoras_clientes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tc_tenant_isolation_select" ON public.transportadoras_clientes
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "tc_tenant_isolation_insert" ON public.transportadoras_clientes
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "tc_tenant_isolation_update" ON public.transportadoras_clientes
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "tc_tenant_isolation_delete" ON public.transportadoras_clientes
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

-- ============================================================
-- 2. CORRIGIR RLS fornecedores
-- ============================================================

DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow delete fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Allow update fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedores" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_delete" ON public.fornecedores;

ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedor_tenant_isolation_select" ON public.fornecedores
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "fornecedor_tenant_isolation_insert" ON public.fornecedores
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "fornecedor_tenant_isolation_update" ON public.fornecedores
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "fornecedor_tenant_isolation_delete" ON public.fornecedores
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR public.current_tenant_id() IS NULL
  );

-- ============================================================
-- 3. CORRIGIR RLS regras_financeiras
-- ============================================================

-- Garantir tenant_id existe na tabela (adicionado por 20260505010000)
ALTER TABLE public.regras_financeiras ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

DROP POLICY IF EXISTS "regras_financeiras_all_authenticated" ON public.regras_financeiras;
DROP POLICY IF EXISTS "rf_tenant_isolation" ON public.regras_financeiras;

ALTER TABLE public.regras_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rf_tenant_isolation" ON public.regras_financeiras
  FOR ALL TO authenticated USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL  -- permite regras globais do sistema
    OR public.current_tenant_id() IS NULL
  );

-- ============================================================
-- 4. CORRIGIR RLS fornecedor_valores_servico
-- ============================================================

DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso update Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_select" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_insert" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_update" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_delete" ON public.fornecedor_valores_servico;

ALTER TABLE public.fornecedor_valores_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fvs_tenant_isolation_select" ON public.fornecedor_valores_servico
  FOR SELECT USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "fvs_tenant_isolation_insert" ON public.fornecedor_valores_servico
  FOR INSERT WITH CHECK (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "fvs_tenant_isolation_update" ON public.fornecedor_valores_servico
  FOR UPDATE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
    OR public.current_tenant_id() IS NULL
  );

CREATE POLICY "fvs_tenant_isolation_delete" ON public.fornecedor_valores_servico
  FOR DELETE USING (
    empresa_id IN (SELECT id FROM empresas WHERE tenant_id = public.current_tenant_id())
    OR empresa_id IS NULL
    OR public.current_tenant_id() IS NULL
  );

-- ============================================================
-- 5. HABILITAR RLS tipos_servico_operacional (tabela global)
-- ============================================================

ALTER TABLE public.tipos_servico_operacional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tso_tenant_isolation" ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado tipos_servico_operacional" ON public.tipos_servico_operacional;

CREATE POLICY "tso_authenticated_access" ON public.tipos_servico_operacional
  FOR ALL TO authenticated USING (true);

-- ============================================================
-- 6. HABILITAR RLS formas_pagamento_operacional (tabela global)
-- ============================================================

ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fpo_tenant_isolation" ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado formas_pagamento_operacional" ON public.formas_pagamento_operacional;

CREATE POLICY "fpo_authenticated_access" ON public.formas_pagamento_operacional
  FOR ALL TO authenticated USING (true);

-- ============================================================
-- 7. CORRIGIR FK incorreta na tabela ponto (empresa → empresas)
-- ============================================================

DO $$
BEGIN
  -- Remover constraint incorreta se existir
  ALTER TABLE public.ponto DROP CONSTRAINT IF EXISTS ponto_empresa_id_fkey;
EXCEPTION
  WHEN undefined_object THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;

-- Adicionar constraint correta (só se a tabela existir e a constraint não existir)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ponto'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'ponto'
      AND constraint_name = 'ponto_empresa_id_fkey'
  ) THEN
    ALTER TABLE public.ponto
      ADD CONSTRAINT ponto_empresa_id_fkey
      FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 8. ÍNDICES DE PERFORMANCE PARA QUERIES COM TENANT ISOLATION
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tc_empresa_id ON public.transportadoras_clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_empresa_id ON public.fornecedores(empresa_id);
CREATE INDEX IF NOT EXISTS idx_regras_financeiras_empresa_id ON public.regras_financeiras(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fvs_empresa_id ON public.fornecedor_valores_servico(empresa_id) WHERE empresa_id IS NOT NULL;
