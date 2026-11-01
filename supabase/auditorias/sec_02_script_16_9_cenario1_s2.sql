-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 - CENÁRIO 1: SESSÃO 2 (CONVIDADO / ACEITE BLOQUEADO)
-- ==============================================================================
-- Papel: Usuário Convidado (C1)
-- Ação:  Tenta aceitar o convite concorrentemente enquanto a Sessão 1 o exclui.
--        Deve ficar bloqueado no lock da tupla e, após o COMMIT da Sessão 1,
--        rejeitar com P0001 (convite não encontrado/inválido).
-- ==============================================================================

\set ON_ERROR_STOP on

SET application_name = 'sec16_9_s2';
SET lock_timeout = '8s';

-- 1. Aguardar Sessão 1 travar a linha do convite e liberar a barreira
SELECT pg_advisory_lock(16901) AS wait_s1_lock;
SELECT pg_advisory_unlock(16901) AS release_wait;

DO $$
DECLARE
  v_err_sqlstate TEXT := '';
  v_err_msg TEXT := '';
  v_res UUID;
BEGIN
  -- 2. Configurar contexto de execução como Convidado C1 Autenticado
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000003', true);

  -- 3. Tentar aceitar o convite C1 concorrente (Fica em espera no lock da tupla)
  BEGIN
    v_res := public.accept_tenant_invitation('tok_conc_cenario_01_delete_wins');
    RAISE EXCEPTION '[FAIL] SEC-16.9 Cenário 1: Aceite concluiu indevidamente após exclusão concorrente!';
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS
      v_err_sqlstate = RETURNED_SQLSTATE,
      v_err_msg = MESSAGE_TEXT;
  END;

  EXECUTE 'RESET ROLE';
  PERFORM set_config('request.jwt.claim.sub', '', true);

  -- 4. Asserção estrita do bloqueio
  IF v_err_sqlstate = 'P0001' AND v_err_msg ILIKE '%inválido, bloqueado ou expirado%' THEN
    RAISE NOTICE '[PASS] SEC-16.9 Cenário 1 / Sessão 2: Aceite bloqueado com sucesso (P0001: %)', v_err_msg;
  ELSE
    RAISE EXCEPTION '[FAIL] SEC-16.9 Cenário 1 / Sessão 2: Erro inesperado: SQLSTATE %, Msg %',
      v_err_sqlstate, v_err_msg;
  END IF;
END $$;
