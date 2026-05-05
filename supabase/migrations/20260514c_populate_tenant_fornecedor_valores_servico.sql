-- ============================================================
-- FIX: Popular tenant_id em dados legados de fornecedor_valores_servico
-- Data: 2026-05-14
-- Problema: registros antigos com tenant_id NULL ficam invisíveis para
--           todos via RLS (ou visíveis se a policy permite NULL).
--           Registros criados antes do tenant_id existir precisam ser
--           associados ao tenant correto via empresa_id.
-- ============================================================

-- 1. Popular tenant_id via empresa_id → empresas.tenant_id
UPDATE public.fornecedor_valores_servico fvs
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  fvs.empresa_id = e.id
  AND  fvs.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- 2. Para registros globais (empresa_id NULL, ex: ISS global),
--    tentar popular via fornecedor_id → fornecedores.tenant_id
UPDATE public.fornecedor_valores_servico fvs
SET    tenant_id = f.tenant_id
FROM   public.fornecedores f
WHERE  fvs.fornecedor_id = f.id
  AND  fvs.tenant_id IS NULL
  AND  f.tenant_id IS NOT NULL;

-- 3. Verificação — deve retornar 0 linhas sem tenant_id
--    (se retornar alguma, verificar manualmente)
SELECT
  COUNT(*) AS total,
  COUNT(tenant_id) AS com_tenant,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant
FROM public.fornecedor_valores_servico;

-- 4. Ver distribuição por tenant (confirmar que dados estão isolados)
SELECT
  t.name AS tenant_nome,
  COUNT(fvs.id) AS total_regras
FROM public.fornecedor_valores_servico fvs
LEFT JOIN public.tenants t ON t.id = fvs.tenant_id
GROUP BY t.name
ORDER BY total_regras DESC;
