-- =============================================================================
-- Migration: Permitir origem 'tio_digital' na tabela historico_importacoes
-- Contexto: Homologação E2E Intermitentes (Ingestão Tio Digital)
-- Arquivo: supabase/migrations/20260928183000_historico_importacoes_origem_tio_digital.sql
-- =============================================================================

-- 1. Remover constraint restritiva anterior
ALTER TABLE public.historico_importacoes
  DROP CONSTRAINT IF EXISTS historico_importacoes_origem_check;

-- 2. Recriar constraint de origem preservando todos os valores anteriores e adicionando 'tio_digital'
ALTER TABLE public.historico_importacoes
  ADD CONSTRAINT historico_importacoes_origem_check
  CHECK (origem IN ('manual', 'google_drive', 'api', 'rhid_api', 'tio_digital'));

-- 3. Atualizar documentação da constraint
COMMENT ON CONSTRAINT historico_importacoes_origem_check ON public.historico_importacoes
  IS 'Origens válidas: manual, google_drive, api, rhid_api, tio_digital';

-- 4. Notificar PostgREST para recarregar o schema cache
NOTIFY pgrst, 'reload schema';
