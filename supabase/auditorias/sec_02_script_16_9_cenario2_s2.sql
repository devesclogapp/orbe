-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 - CENÁRIO 2: SESSÃO 2 (ADMIN / EXCLUSÃO BLOQUEADA)
-- ==============================================================================
-- Papel: Administrador do Tenant
-- Ação:  Tenta excluir o convite concorrentemente enquanto a Sessão 1 o aceita.
--        Deve ficar bloqueado no lock da tupla e, após o COMMIT da Sessão 1,
--        rejeitar com P0001 (convite já aceito é histórico e imutável).
-- ==============================================================================

\set ON_ERROR_STOP on

SET application_name = 'sec16_9_s2';
SET lock_timeout = '8s';

-- 1. Aguardar Sessão 1 travar a linha do convite e liberar a barreira
SELECT pg_advisory_lock(16902) AS wait_s1_lock;
SELECT pg_advisory_unlock(16902) AS release_wait;

DO $$
DECLARE
  v_err_sqlstate TEXT := '';
  v_err_msg TEXT := '';
  v_res BOOLEAN;
BEGIN
  -- 2. Configurar contexto de execução como Administrador Autenticado
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);

  -- 3. Tentar excluir o convite C2 concorrente (Fica em espera no lock da tupla)
  BEGIN
    v_res := public.admin_delete_tenant_invitation('16000000-0000-0000-0000-000000000012'::uuid);
    RAISE EXCEPTION '[FAIL] SEC-16.9 Cenário 2: Exclusão administrativa concluiu indevidamente sobre convite aceito!';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 4. Asserção estrita do bloqueio
  IF v_err_sqlstate = 'P0001' AND (v_err_msg ILIKE '%registros históricos%' OR v_err_msg ILIKE '%não podem ser excluídos%') THEN
    RAISE NOTICE '[PASS] SEC-16.9 Cenário 2 / Sessão 2: Exclusão bloqueada com sucesso (P0001: %)', v_err_msg;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.9 Cenário 2 / Sessão 2: Erro inesperado: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;
END $$;
