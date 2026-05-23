-- =============================================================================
-- Migration: Add tenant_id to historico_importacoes
-- Data: 2026-05-23
-- =============================================================================

-- O erro anterior provou que a tabela local NÃO tem a coluna tenant_id. 
-- Como o sistema ERP inteiro é multi-tenant, vamos adicioná-la com segurança agora.
ALTER TABLE public.historico_importacoes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_hist_import_tenant ON public.historico_importacoes(tenant_id);

-- Agora podemos aplicar o RLS corretamente
DROP POLICY IF EXISTS "Enable read access for authenticated users with same tenant" ON public.historico_importacoes;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.historico_importacoes;
DROP POLICY IF EXISTS "historico_importacoes_tenant_select" ON public.historico_importacoes;
DROP POLICY IF EXISTS "historico_importacoes_tenant_insert" ON public.historico_importacoes;
DROP POLICY IF EXISTS "historico_importacoes_tenant_all" ON public.historico_importacoes;

CREATE POLICY "historico_importacoes_tenant_all"
  ON public.historico_importacoes
  FOR ALL
  TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Forçar um update para preencher o tenant_id baseado na empresa_id caso existam registros soltos antigos
UPDATE public.historico_importacoes hi
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE hi.empresa_id = e.id AND hi.tenant_id IS NULL;

NOTIFY pgrst, 'reload schema';
