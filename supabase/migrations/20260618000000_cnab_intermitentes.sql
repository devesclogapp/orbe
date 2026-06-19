-- Adicionar coluna intermitentes_lote_id em cnab_remessas_arquivos
ALTER TABLE public.cnab_remessas_arquivos
  ADD COLUMN IF NOT EXISTS intermitentes_lote_id UUID NULL REFERENCES public.intermitentes_lotes_fechamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cnab_remessas_intermitentes_lote_id ON public.cnab_remessas_arquivos(intermitentes_lote_id);

NOTIFY pgrst, 'reload schema';
