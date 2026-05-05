-- Corrigir RLS para transportadoras_clientes e fornecedores

-- 1. Transportadoras/Clientes
ALTER TABLE public.transportadoras_clientes 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

DROP POLICY IF EXISTS "transportadoras_tenant_all" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_select" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_insert" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_update" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_delete" ON public.transportadoras_clientes;

CREATE POLICY "tc_tenant_select" ON public.transportadoras_clientes
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "tc_tenant_insert" ON public.transportadoras_clientes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "tc_tenant_update" ON public.transportadoras_clientes
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "tc_tenant_delete" ON public.transportadoras_clientes
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

-- 2. Fornecedores
ALTER TABLE public.fornecedores 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

DROP POLICY IF EXISTS "fornecedores_tenant_all" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_tenant_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_tenant_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_tenant_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_tenant_delete" ON public.fornecedores;

CREATE POLICY "fornecedores_tenant_select" ON public.fornecedores
  FOR SELECT TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "fornecedores_tenant_insert" ON public.fornecedores
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "fornecedores_tenant_update" ON public.fornecedores
  FOR UPDATE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "fornecedores_tenant_delete" ON public.fornecedores
  FOR DELETE TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid()));