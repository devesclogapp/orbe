-- y:\2026\ERP ESC LOG\Orbe\supabase\migrations\20260528_enhance_historico_importacoes.sql

ALTER TABLE public.historico_importacoes
  ADD COLUMN IF NOT EXISTS duracao_ms INTEGER,
  ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]'::jsonb;

-- Update the status check constraint to match operationalStatus.ts if it hasn't been updated yet
-- This assumes standardizing statuses was done or is expected.
-- The previous standardizing migration 20260527 might have done this for registros_ponto,
-- but let's ensure it for historico_importacoes too.

DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'historico_importacoes' 
        AND column_name = 'status' 
        AND constraint_name = 'historico_importacoes_status_check'
    ) THEN
        ALTER TABLE public.historico_importacoes DROP CONSTRAINT historico_importacoes_status_check;
    END IF;

    ALTER TABLE public.historico_importacoes 
    ADD CONSTRAINT historico_importacoes_status_check 
    CHECK (status IN (
      'RECEBIDO', 
      'VALIDANDO', 
      'INCONSISTENTE', 
      'PENDENTE_PROCESSAMENTO', 
      'PROCESSADO', 
      'FECHADO', 
      'ERRO', 
      'CANCELADO'
    ));
END $$;

COMMENT ON COLUMN public.historico_importacoes.duracao_ms IS 'Duração do processamento em milissegundos';
COMMENT ON COLUMN public.historico_importacoes.logs IS 'Timeline de eventos da importação (status transitions e detalhes)';
