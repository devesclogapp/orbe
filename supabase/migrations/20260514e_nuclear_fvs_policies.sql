-- ============================================================
-- FIX NUCLEAR: fornecedor_valores_servico — limpar TODAS as policies
-- e criar apenas UMA baseada em tenant_id
-- Problema: 5 policies conflitantes sobreviveram — OR logic = tudo passa
--   - fvs_tenant_isolation_insert (qual = NULL = sem restrição)
--   - fvs_tenant_isolation_select (via empresa_id join)
--   - fvs_tenant_isolation_update (via empresa_id join)
--   - fvs_tenant_isolation_delete (via empresa_id join)
--   - Acesso delete Admin Financeiro fornecedor_valores_servico (role only)
-- ============================================================

-- Dropar TODAS as policies existentes (qualquer nome)
DROP POLICY IF EXISTS "fvs_tenant_isolation_select"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_insert"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_update"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_delete"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso delete Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedor_valores_servico"     ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso update Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fornecedor_valores_tenant_all"                             ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "rf_tenant_isolation"                                       ON public.fornecedor_valores_servico;

-- Criar UMA única policy baseada em tenant_id
ALTER TABLE public.fornecedor_valores_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedor_valores_tenant_all" ON public.fornecedor_valores_servico
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- Verificação — deve aparecer SOMENTE a policy criada acima
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'fornecedor_valores_servico'
ORDER BY policyname;
