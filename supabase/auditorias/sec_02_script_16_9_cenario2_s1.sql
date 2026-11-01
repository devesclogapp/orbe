-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 - CENÁRIO 2: SESSÃO 1 (CONVIDADO / ACEITE VENCE)
-- ==============================================================================
-- Papel: Usuário Convidado (C2)
-- Ação:  Aceita o convite dentro de uma transação aberta, retendo o lock exclusivo
--        da linha atualizada até comitar, forçando a Sessão 2 (Exclusão) a esperar.
-- ==============================================================================

\set ON_ERROR_STOP on

SET application_name = 'sec16_9_s1';
SET lock_timeout = '6s';

-- 1. Barreira de Sincronização: Sessão 1 adquire advisory lock de coordenação
SELECT pg_advisory_lock(16902) AS coord_lock_acquired;

BEGIN;

-- 2. Configurar contexto de execução como Convidado C2 Autenticado
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000004', true);

-- 3. Executar aceite do convite C2 (Transiciona para 'aceito', provisiona perfil e retém lock)
SELECT public.accept_tenant_invitation('tok_conc_cenario_02_accept_wins') AS profile_id;

-- 4. Liberar Barreira para a Sessão 2 tentar a exclusão administrativa concorrente
SELECT pg_advisory_unlock(16902) AS coord_lock_released;

-- 5. Pausar para garantir que a Sessão 2 entra na fila de lock exclusivo da tupla
-- e permite a observação explícita de bloqueio via pg_stat_activity/pg_blocking_pids
SELECT pg_sleep(3.0);

-- 6. Comitar a transação de aceite (libera o lock da tupla aceita e comita os dados)
COMMIT;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
BEGIN
  RAISE NOTICE '[PASS] SEC-16.9 Cenário 2 / Sessão 1: Aceite comitado com sucesso com retenção de lock.';
END $$;
