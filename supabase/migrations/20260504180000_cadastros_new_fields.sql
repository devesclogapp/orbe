-- Adiciona empresa_id à tabela tipos_servico_operacional para permitir filtragem por empresa
ALTER TABLE public.tipos_servico_operacional
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Adiciona campos de contato à tabela transportadoras_clientes
ALTER TABLE public.transportadoras_clientes
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT;

-- Adiciona campos de contato à tabela fornecedores
ALTER TABLE public.fornecedores
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS endereco TEXT;

-- Cria índice para empresa_id em tipos_servico_operacional
CREATE INDEX IF NOT EXISTS idx_tipos_servico_operacional_empresa_id
ON public.tipos_servico_operacional(empresa_id);

-- Atualiza dados existentes para manter ativo como true (caso seja null)
UPDATE public.tipos_servico_operacional SET ativo = true WHERE ativo IS NULL;
UPDATE public.transportadoras_clientes SET ativo = true WHERE ativo IS NULL;
UPDATE public.fornecedores SET ativo = true WHERE ativo IS NULL;

-- Altera para NOT NULL após atualizar
ALTER TABLE public.tipos_servico_operacional ALTER COLUMN ativo SET NOT NULL;
ALTER TABLE public.transportadoras_clientes ALTER COLUMN ativo SET NOT NULL;
ALTER TABLE public.fornecedores ALTER COLUMN ativo SET NOT NULL;