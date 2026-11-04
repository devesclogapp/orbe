-- ==============================================================================
-- SCRIPT DE ROLLBACK — P0-02
-- Reversão da migration: 20261012120000_etapa05b_retificacao_intermitentes_rh.sql
-- ==============================================================================

BEGIN;

-- 1. Remove Triggers Guardiões
DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes ON public.lancamentos_intermitentes;
DROP TRIGGER IF EXISTS trg_guard_lancamentos_intermitentes_delete ON public.lancamentos_intermitentes;
DROP TRIGGER IF EXISTS trg_guard_intermitentes_lotes_delete ON public.intermitentes_lotes_fechamento;

-- 2. Remove Funções Guardiãs
DROP FUNCTION IF EXISTS public.fn_guard_lancamentos_intermitentes_update();
DROP FUNCTION IF EXISTS public.fn_guard_lancamentos_intermitentes_delete();
DROP FUNCTION IF EXISTS public.fn_guard_intermitentes_lotes_delete();

-- 3. Remove RPCs Transacionais
DROP FUNCTION IF EXISTS public.rpc_rh_retificar_intermitente(UUID, UUID, NUMERIC, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS public.rpc_rh_revalidar_lote_devolvido(UUID, TEXT);

-- 4. Remove Índice e Coluna
DROP INDEX IF EXISTS public.idx_lancamentos_intermitentes_lote_devolvido_origem;
ALTER TABLE public.lancamentos_intermitentes DROP COLUMN IF EXISTS lote_devolvido_origem_id;

-- 5. Remove Registro no Histórico de Migrations
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20261012120000';

COMMIT;

