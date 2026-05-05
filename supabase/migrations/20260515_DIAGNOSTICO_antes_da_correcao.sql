-- ============================================================
-- DIAGNÓSTICO: Execute este script ANTES da correção
-- para ver o estado atual das policies e dados
-- ============================================================

-- 1. Ver policies atuais nas 3 tabelas
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('regras_modulos', 'regras_campos', 'regras_dados')
ORDER BY tablename, policyname;

-- 2. Verificar tenant_id nos registros
SELECT 'regras_modulos' AS tabela,
       COUNT(*) AS total,
       COUNT(tenant_id) AS com_tenant,
       COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant
FROM public.regras_modulos
UNION ALL
SELECT 'regras_campos',
       COUNT(*), COUNT(tenant_id), COUNT(*) FILTER (WHERE tenant_id IS NULL)
FROM public.regras_campos
UNION ALL
SELECT 'regras_dados',
       COUNT(*), COUNT(tenant_id), COUNT(*) FILTER (WHERE tenant_id IS NULL)
FROM public.regras_dados;

-- 3. Ver distribuição dos dados por tenant (identificar quais estão vazados)
SELECT
  t.name AS tenant_nome,
  COUNT(rd.id) AS total_regras_dados
FROM public.regras_dados rd
LEFT JOIN public.tenants t ON t.id = rd.tenant_id
GROUP BY t.name
ORDER BY total_regras_dados DESC;

-- 4. Ver modulos existentes e seus tenants
SELECT rm.id, rm.nome, rm.slug, t.name AS tenant_nome
FROM public.regras_modulos rm
LEFT JOIN public.tenants t ON t.id = rm.tenant_id
ORDER BY tenant_nome, rm.nome;
