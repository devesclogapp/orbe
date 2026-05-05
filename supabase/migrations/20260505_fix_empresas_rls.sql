-- Corrigir RLS da tabela empresas
-- Remove políticas existentes e cria novas políticas seguras

-- 1. Verificar/adicionar tenant_id
ALTER TABLE public.empresas 
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id);

-- 2. Remover políticas inseguras existentes
DROP POLICY IF EXISTS "empresas_tenant_all" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_update" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_delete" ON public.empresas;
DROP POLICY IF EXISTS "Acesso total autenticado para empresas" ON public.empresas;

-- 3. Criar políticas seguras
CREATE POLICY "empresas_tenant_select" ON public.empresas
  FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "empresas_tenant_insert" ON public.empresas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "empresas_tenant_update" ON public.empresas
  FOR UPDATE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

CREATE POLICY "empresas_tenant_delete" ON public.empresas
  FOR DELETE TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid())
  );

-- 4. Atualizar empresas existentes sem tenant_id (se necessário)
-- Marque esta linha se quiser popular tenant_id para empresas órfãs
-- UPDATE public.empresas SET tenant_id = (SELECT tenant_id FROM public.profiles LIMIT 1) WHERE tenant_id IS NULL;