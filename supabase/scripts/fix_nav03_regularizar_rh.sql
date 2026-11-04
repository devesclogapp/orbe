-- ==============================================================================
-- FIX NAV-03: REGULARIZAÇÃO ATÔMICA DO ACESSO RH (ESC LOG)
-- Alvo: flaviocarvalhoficial+2@gmail.com
-- UUID Alvo: d7f91912-f12e-42ba-8b69-7313dc748fd2
-- Tenant Destino: 09ccafb6-2cf2-4c83-ac3d-a2913947693c (ESC LOG)
-- Tenant Origem:  8aac34d4-a67d-4a51-b76c-19dbaa6d8a89
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. VERIFICAÇÃO ESTRITA DE PRÉ-CONDIÇÕES (ABORTARÁ SE O ESTADO NÃO FOR EXATO)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_prof_count INTEGER;
  v_perm_count INTEGER;
  v_current_profile RECORD;
  v_current_perm RECORD;
BEGIN
  -- 1.1 Validar que existe EXATAMENTE 1 registro em public.profiles
  SELECT count(*) INTO v_prof_count
  FROM public.profiles
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2';

  IF v_prof_count <> 1 THEN
    RAISE EXCEPTION '[ABORTADO] Contagem inesperada em profiles: esperado 1, encontrado %', v_prof_count;
  END IF;

  SELECT id, user_id, tenant_id, role, full_name, onboarding_completed
  INTO v_current_profile
  FROM public.profiles
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2';

  IF v_current_profile.tenant_id <> '8aac34d4-a67d-4a51-b76c-19dbaa6d8a89' THEN
    RAISE EXCEPTION '[ABORTADO] Tenant de origem inesperado em profiles: esperado 8aac34d4-a67d-4a51-b76c-19dbaa6d8a89, encontrado %', v_current_profile.tenant_id;
  END IF;

  IF v_current_profile.role <> 'user' THEN
    RAISE EXCEPTION '[ABORTADO] Papel de origem inesperado em profiles: esperado user, encontrado %', v_current_profile.role;
  END IF;

  -- 1.2 Validar que existe EXATAMENTE 1 registro em public.user_permissions
  SELECT count(*) INTO v_perm_count
  FROM public.user_permissions
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2';

  IF v_perm_count <> 1 THEN
    RAISE EXCEPTION '[ABORTADO] Contagem inesperada em user_permissions: esperado 1, encontrado %', v_perm_count;
  END IF;

  SELECT id, user_id, tenant_id, role, status, permissions
  INTO v_current_perm
  FROM public.user_permissions
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2';

  IF v_current_perm.tenant_id <> '8aac34d4-a67d-4a51-b76c-19dbaa6d8a89' THEN
    RAISE EXCEPTION '[ABORTADO] Tenant de origem inesperado em user_permissions: esperado 8aac34d4-a67d-4a51-b76c-19dbaa6d8a89, encontrado %', v_current_perm.tenant_id;
  END IF;

  IF v_current_perm.role <> 'user' THEN
    RAISE EXCEPTION '[ABORTADO] Papel de origem inesperado em user_permissions: esperado user, encontrado %', v_current_perm.role;
  END IF;

  IF v_current_perm.permissions <> '{}'::jsonb THEN
    RAISE EXCEPTION '[ABORTADO] Permissões de origem não estão vazias: esperado {}, encontrado %', v_current_perm.permissions;
  END IF;

  RAISE NOTICE '>>> [PASS] Pré-condições validadas: Usuário d7f91912 é USER no tenant 8aac34d4 com permissões vazias. Prosseguindo com o update.';
END $$;

-- ------------------------------------------------------------------------------
-- 2. ATUALIZAÇÃO ATÔMICA EXCLUSIVA
-- ------------------------------------------------------------------------------

-- 2.1 Desabilitar temporariamente a trigger de imutabilidade do tenant_id para esta transação administrativa
ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_sensitive_fields;

DO $$
DECLARE
  v_rows_prof INTEGER;
  v_rows_perm INTEGER;
BEGIN
  -- 2.2 Atualizar perfil (preservando nome Reis Carvalho e UUID original)
  UPDATE public.profiles
  SET
    tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
    role = 'rh',
    onboarding_completed = true
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2'
    AND tenant_id = '8aac34d4-a67d-4a51-b76c-19dbaa6d8a89'
    AND role = 'user';

  GET DIAGNOSTICS v_rows_prof = ROW_COUNT;
  IF v_rows_prof <> 1 THEN
    RAISE EXCEPTION '[ABORTADO] Falha no UPDATE profiles: esperado atualizar exatamente 1 linha, atualizado %', v_rows_prof;
  END IF;

  -- 2.3 Atualizar user_permissions (matriz restrita de RH com aprovar = false)
  UPDATE public.user_permissions
  SET
    tenant_id = '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
    role = 'rh',
    status = 'ativo',
    permissions = '{
      "processamento_rh": {"ver": true, "aprovar": false, "processar": true, "exportar": true},
      "cadastro_de_diaristas": {"ver": true, "criar": true, "editar": true, "exportar": true},
      "pontos_recebidos": {"ver": true, "exportar": true, "importar": true},
      "fechamento_mensal": {"ver": true, "fechar": true, "reabrir": false, "processar": true},
      "banco_de_horas": {"ver": true, "criar": true, "editar": true, "exportar": true},
      "regras_de_banco": {"ver": true, "criar": false, "editar": false}
    }'::jsonb,
    updated_at = NOW()
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2'
    AND tenant_id = '8aac34d4-a67d-4a51-b76c-19dbaa6d8a89'
    AND role = 'user';

  GET DIAGNOSTICS v_rows_perm = ROW_COUNT;
  IF v_rows_perm <> 1 THEN
    RAISE EXCEPTION '[ABORTADO] Falha no UPDATE user_permissions: esperado atualizar exatamente 1 linha, atualizado %', v_rows_perm;
  END IF;

  RAISE NOTICE '>>> [PASS] Atualizações executadas: exatamente 1 perfil e 1 permissão alterados.';
END $$;

-- 2.4 Reabilitar imediatamente a trigger de proteção
ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_sensitive_fields;

-- ------------------------------------------------------------------------------
-- 3. ASSERÇÃO ESTRITA DE PÓS-CONDIÇÕES E GOVERNANÇA (SEC-03)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
  v_updated_profile RECORD;
  v_updated_perm RECORD;
BEGIN
  -- 3.1 Validar perfil pós-update
  SELECT id, user_id, tenant_id, role, full_name, onboarding_completed
  INTO v_updated_profile
  FROM public.profiles
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2';

  IF v_updated_profile.tenant_id <> '09ccafb6-2cf2-4c83-ac3d-a2913947693c' OR v_updated_profile.role <> 'rh' THEN
    RAISE EXCEPTION '[FALHA PÓS-CONDIÇÃO] Perfil não vinculado corretamente à ESC LOG ou papel RH.';
  END IF;

  -- 3.2 Validar user_permissions pós-update
  SELECT id, user_id, tenant_id, role, status, permissions
  INTO v_updated_perm
  FROM public.user_permissions
  WHERE user_id = 'd7f91912-f12e-42ba-8b69-7313dc748fd2';

  IF v_updated_perm.tenant_id <> '09ccafb6-2cf2-4c83-ac3d-a2913947693c' OR v_updated_perm.role <> 'rh' THEN
    RAISE EXCEPTION '[FALHA PÓS-CONDIÇÃO] Permissão não vinculada corretamente à ESC LOG ou papel RH.';
  END IF;

  IF (v_updated_perm.permissions->'processamento_rh'->>'aprovar')::boolean IS NOT FALSE THEN
    RAISE EXCEPTION '[FALHA DE SEGURANÇA] processamento_rh:aprovar deve ser estritamente false!';
  END IF;

  RAISE NOTICE '>>> [PASS] Pós-condições validadas com sucesso: perfil RH habilitado, tenant ESC LOG confirmado e aprovar = false.';
END $$;

COMMIT;
