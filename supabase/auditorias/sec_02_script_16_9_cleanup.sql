-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 - LIMPEZA SEGURA E ESTRITA (CLEANUP)
-- ==============================================================================
-- Objetivo: Remoção cirúrgica e controlada exclusivamente dos registros sintéticos
--           do teste SEC-16.9.
-- Garantias:
--   - Não utiliza CASCADE.
--   - Não toca em tabelas ou registros fora das fixtures de concorrência.
--   - Valida que todas as tabelas voltam a ter zero registros dos IDs de teste.
-- ==============================================================================

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_tenant_conc UUID := '16000000-0000-0000-0000-000000000001'::uuid;
  v_admin_conc  UUID := '16000000-0000-0000-0000-000000000002'::uuid;
  v_user_c1     UUID := '16000000-0000-0000-0000-000000000003'::uuid;
  v_user_c2     UUID := '16000000-0000-0000-0000-000000000004'::uuid;

  v_invite_c1   UUID := '16000000-0000-0000-0000-000000000011'::uuid;
  v_invite_c2   UUID := '16000000-0000-0000-0000-000000000012'::uuid;

  v_count INT;
BEGIN
  -- 1. Remoção restrita aos IDs sintéticos de teste
  DELETE FROM public.tenant_invitations WHERE id IN (v_invite_c1, v_invite_c2);
  DELETE FROM public.audit_log WHERE tenant_id = v_tenant_conc;
  DELETE FROM public.user_permissions WHERE tenant_id = v_tenant_conc;
  DELETE FROM public.profiles WHERE tenant_id = v_tenant_conc OR user_id IN (v_admin_conc, v_user_c1, v_user_c2);
  DELETE FROM public.tenants WHERE id = v_tenant_conc;
  DELETE FROM auth.users WHERE id IN (v_admin_conc, v_user_c1, v_user_c2);

  -- 2. Comprovação de zero resíduos sintéticos
  SELECT 
    (SELECT COUNT(*) FROM public.tenant_invitations WHERE id IN (v_invite_c1, v_invite_c2)) +
    (SELECT COUNT(*) FROM public.profiles WHERE tenant_id = v_tenant_conc OR user_id IN (v_admin_conc, v_user_c1, v_user_c2)) +
    (SELECT COUNT(*) FROM public.user_permissions WHERE tenant_id = v_tenant_conc) +
    (SELECT COUNT(*) FROM public.audit_log WHERE tenant_id = v_tenant_conc) +
    (SELECT COUNT(*) FROM public.tenants WHERE id = v_tenant_conc) +
    (SELECT COUNT(*) FROM auth.users WHERE id IN (v_admin_conc, v_user_c1, v_user_c2))
  INTO v_count;

  IF v_count <> 0 THEN
    RAISE EXCEPTION '[FAIL] SEC-16.9 Cleanup: Resíduos sintéticos detectados após limpeza (Count: %)!', v_count;
  END IF;

  RAISE NOTICE '[PASS] SEC-16.9 Cleanup: Zero resíduos sintéticos confirmado com sucesso.';
END $$;
