-- ==============================================================================
-- ROLLBACK FIX NAV-03: REVERSÃO DA REGULARIZAÇÃO RH
-- Alvo: flaviocarvalhoficial+2@gmail.com
-- UUID Alvo: d7f91912-f12e-42ba-8b69-7313dc748fd2
-- ==============================================================================

BEGIN;

ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_sensitive_fields;

DO $$
DECLARE
  v_rows_prof INTEGER;
  v_rows_perm INTEGER;
BEGIN
  UPDATE public.profiles
  SET
    tenant_id = '8aac34d4-a67d-4a51-b76c-19dbaa6d8a89',
    role = 'user',
    onboarding_completed = false
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2'
    AND tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c'
    AND role = 'rh';

  GET DIAGNOSTICS v_rows_prof = ROW_COUNT;
  IF v_rows_prof <> 1 THEN
    RAISE EXCEPTION '[ROLLBACK ABORTADO] Falha ao reverter profiles: esperado 1 linha, afetado %', v_rows_prof;
  END IF;

  UPDATE public.user_permissions
  SET
    tenant_id = '8aac34d4-a67d-4a51-b76c-19dbaa6d8a89',
    role = 'user',
    status = 'ativo',
    permissions = '{}'::jsonb,
    updated_at = NOW()
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2'
    AND tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c'
    AND role = 'rh';

  GET DIAGNOSTICS v_rows_perm = ROW_COUNT;
  IF v_rows_perm <> 1 THEN
    RAISE EXCEPTION '[ROLLBACK ABORTADO] Falha ao reverter user_permissions: esperado 1 linha, afetado %', v_rows_perm;
  END IF;

  RAISE NOTICE '>>> [PASS] Rollback concluído: perfil e permissões restaurados aos valores originais.';
END $$;

ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_sensitive_fields;

COMMIT;
