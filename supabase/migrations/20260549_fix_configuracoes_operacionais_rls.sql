-- Corrige RLS da tabela configuracoes_operacionais, que nao possui tenant_id
-- e deve ser isolada pela empresa vinculada ao tenant do usuario autenticado.

ALTER TABLE public.configuracoes_operacionais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "configuracoes_operacionais_select" ON public.configuracoes_operacionais;
DROP POLICY IF EXISTS "configuracoes_operacionais_insert" ON public.configuracoes_operacionais;
DROP POLICY IF EXISTS "configuracoes_operacionais_update" ON public.configuracoes_operacionais;
DROP POLICY IF EXISTS "configuracoes_operacionais_delete" ON public.configuracoes_operacionais;
DROP POLICY IF EXISTS "configuracoes_operacionais_tenant_all" ON public.configuracoes_operacionais;

CREATE POLICY "configuracoes_operacionais_select"
ON public.configuracoes_operacionais
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND empresa_id IN (
    SELECT e.id
    FROM public.empresas e
    WHERE e.tenant_id = auth.current_tenant_id()
  )
);

CREATE POLICY "configuracoes_operacionais_insert"
ON public.configuracoes_operacionais
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id IN (
    SELECT e.id
    FROM public.empresas e
    WHERE e.tenant_id = auth.current_tenant_id()
  )
);

CREATE POLICY "configuracoes_operacionais_update"
ON public.configuracoes_operacionais
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND empresa_id IN (
    SELECT e.id
    FROM public.empresas e
    WHERE e.tenant_id = auth.current_tenant_id()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND empresa_id IN (
    SELECT e.id
    FROM public.empresas e
    WHERE e.tenant_id = auth.current_tenant_id()
  )
);

CREATE POLICY "configuracoes_operacionais_delete"
ON public.configuracoes_operacionais
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND empresa_id IN (
    SELECT e.id
    FROM public.empresas e
    WHERE e.tenant_id = auth.current_tenant_id()
  )
);

NOTIFY pgrst, 'reload schema';
