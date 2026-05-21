-- y:\2026\ERP ESC LOG\Orbe\supabase\migrations\20260529_reprocessing_safe_system.sql

-- 1. Enhance historico_importacoes with reprocessing metadata
ALTER TABLE public.historico_importacoes
  ADD COLUMN IF NOT EXISTS parent_importacao_id UUID REFERENCES public.historico_importacoes(id),
  ADD COLUMN IF NOT EXISTS execution_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS reprocessado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS reprocessado_por UUID REFERENCES auth.users(id);

-- 2. Update status constraint to include reprocessing states
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
      'CANCELADO',
      'REPROCESSANDO',
      'REPROCESSADO'
    ));
END $$;

-- 3. Enhance registros_ponto for multi-execution safety
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS execution_id UUID,
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.historico_importacoes(id);

-- 4. Create specialized indexes
CREATE INDEX IF NOT EXISTS idx_hist_import_parent ON public.historico_importacoes(parent_importacao_id);
CREATE INDEX IF NOT EXISTS idx_hist_import_execution ON public.historico_importacoes(execution_id);
CREATE INDEX IF NOT EXISTS idx_reg_ponto_execution ON public.registros_ponto(execution_id);
CREATE INDEX IF NOT EXISTS idx_reg_ponto_superseded ON public.registros_ponto(superseded_by);

-- 5. Helper function for reprocessing safety
-- This function marks old records as superseded when a new execution starts
CREATE OR REPLACE FUNCTION public.mark_old_import_records_superseded(
  p_importacao_id UUID,
  p_new_importacao_id UUID
) RETURNS VOID AS $$
BEGIN
  -- Mark all records from the old import chain as superseded
  UPDATE public.registros_ponto
  SET superseded_by = p_new_importacao_id,
      status = 'CANCELADO'
  WHERE importacao_id = p_importacao_id
     OR importacao_id IN (
       SELECT id FROM public.historico_importacoes 
       WHERE parent_importacao_id = p_importacao_id
     );
     
  -- Also mark the old import metadata as REPROCESSADO
  UPDATE public.historico_importacoes
  SET status = 'REPROCESSADO'
  WHERE id = p_importacao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Audit Comments
COMMENT ON COLUMN public.historico_importacoes.parent_importacao_id IS 'Referência para a importação original que foi reprocessada';
COMMENT ON COLUMN public.historico_importacoes.execution_id IS 'ID único da execução atual para idempotência';
COMMENT ON COLUMN public.historico_importacoes.version IS 'Versão da importação (incrementado a cada reprocessamento)';
COMMENT ON COLUMN public.registros_ponto.superseded_by IS 'Referência para a nova importação que substituiu este registro';
