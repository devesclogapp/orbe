-- ==============================================================================
-- ERP ORBE — SEC-02 | SCRIPT 16.9 - CENÁRIO 1: SESSÃO 1 (ADMIN / EXCLUSÃO VENCE)
-- ==============================================================================
-- Papel: Administrador do Tenant
-- Ação:  Exclui o convite dentro de uma transação aberta, retendo o lock exclusivo
--        da linha até comitar, forçando a Sessão 2 (Aceite) a esperar.
-- ==============================================================================

\set ON_ERROR_STOP on

SET application_name = 'sec16_9_s1';
SET lock_timeout = '6s';

-- 1. Barreira de Sincronização: Sessão 1 adquire advisory lock de coordenação
SELECT pg_advisory_lock(16901) AS coord_lock_acquired;

BEGIN;

-- 2. Configurar contexto de execução como Administrador Autenticado
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000002', true);

-- 3. Executar exclusão administrativa do convite C1 (Adquire FOR UPDATE e DELETE da tupla)
SELECT public.admin_delete_tenant_invitation('16000000-0000-0000-0000-000000000011'::uuid) AS deleted;

-- 4. Liberar Barreira para a Sessão 2 tentar o aceite concorrente na mesma linha
SELECT pg_advisory_unlock(16901) AS coord_lock_released;

-- 5. Pausar para garantir que a Sessão 2 entra na fila de lock exclusivo da tupla
-- e permite a observação explícita de bloqueio via pg_stat_activity/pg_blocking_pids
SELECT pg_sleep(3.0);

-- 6. Comitar a transação de exclusão (libera o lock da tupla excluída)
COMMIT;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

DO $$
BEGIN
  RAISE NOTICE '[PASS] SEC-16.9 Cenário 1 / Sessão 1: Exclusão comitada com sucesso com retenção de lock.';
END $$;
