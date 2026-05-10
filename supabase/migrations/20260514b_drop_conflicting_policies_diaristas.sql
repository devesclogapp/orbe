-- ============================================================
-- FIX: Remover policies conflitantes que vazam dados entre tenants
-- Data: 2026-05-14
-- Causa: policies antigas com USING baseado em perfis_usuarios ou
--        get_user_role() sem filtro de tenant_id sobreviveram ao
--        DROP anterior. Em PostgreSQL, policies PERMISSIVE fazem OR:
--        basta uma liberar para a linha ser visivel.
-- ============================================================

-- lancamentos_diaristas: remover todas as policies antigas
DROP POLICY IF EXISTS "lancamentos_diaristas_insert"  ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "lancamentos_diaristas_select"  ON public.lancamentos_diaristas;
DROP POLICY IF EXISTS "lancamentos_diaristas_update"  ON public.lancamentos_diaristas;

-- regras_marcacao_diaristas: remover todas as policies antigas
DROP POLICY IF EXISTS "regras_diaristas_select"        ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "regras_diaristas_insert_update" ON public.regras_marcacao_diaristas;

-- formas_pagamento_operacional: remover policy duplicada
DROP POLICY IF EXISTS "fpo_tenant_all" ON public.formas_pagamento_operacional;

-- ============================================================
-- VERIFICACAO FINAL
-- Todas as linhas do resultado devem ter:
--   qual = (tenant_id = current_tenant_id())
-- Não deve aparecer nada com NULL, perfis_usuarios ou get_user_role()
-- ============================================================
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'regras_marcacao_diaristas',
    'lancamentos_diaristas',
    'diaristas_lotes_fechamento',
    'formas_pagamento_operacional'
  )
ORDER BY tablename, policyname;
