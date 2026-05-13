-- Migration para adicionar colunas de auditoria na edição administrativa
ALTER TABLE public.lancamentos_diaristas ADD COLUMN IF NOT EXISTS editado_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.lancamentos_diaristas ADD COLUMN IF NOT EXISTS editado_por UUID REFERENCES auth.users(id);
ALTER TABLE public.lancamentos_diaristas ADD COLUMN IF NOT EXISTS editado_em TIMESTAMPTZ;
ALTER TABLE public.lancamentos_diaristas ADD COLUMN IF NOT EXISTS motivo_edicao TEXT;
