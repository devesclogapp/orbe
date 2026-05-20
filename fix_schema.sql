ALTER TABLE public.servicos_extras_operacionais DROP COLUMN IF EXISTS tipo_servico;
ALTER TABLE public.servicos_extras_operacionais ADD COLUMN IF NOT EXISTS tipo_servico_id UUID REFERENCES public.tipos_servico_operacional(id) ON DELETE SET NULL;
ALTER TABLE public.servicos_extras_operacionais ADD COLUMN IF NOT EXISTS descricao_servico TEXT;
