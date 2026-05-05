-- ============================================================
-- DIAGNÓSTICO: fornecedor_valores_servico
-- Execute no Supabase SQL Editor para entender o estado exato
-- ============================================================

-- 1. Policies ativas na tabela
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'fornecedor_valores_servico'
ORDER BY policyname;

-- 2. Distribuição de tenant_id (NULL = dados sem isolamento)
SELECT
  tenant_id,
  COUNT(*) AS total
FROM public.fornecedor_valores_servico
GROUP BY tenant_id
ORDER BY total DESC;

-- 3. Contagem total
SELECT
  COUNT(*) AS total,
  COUNT(tenant_id) AS com_tenant,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant
FROM public.fornecedor_valores_servico;
