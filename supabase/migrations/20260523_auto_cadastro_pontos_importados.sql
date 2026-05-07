-- Auto-cadastro mestre a partir dos pontos importados

ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cadastro_provisorio BOOLEAN DEFAULT false;

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS cadastro_provisorio BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_empresas_cadastro_provisorio
  ON public.empresas (tenant_id, cadastro_provisorio);

CREATE INDEX IF NOT EXISTS idx_colaboradores_cadastro_provisorio
  ON public.colaboradores (tenant_id, cadastro_provisorio);

COMMENT ON COLUMN public.empresas.origem IS 'Origem do cadastro: manual, importacao_ponto, importacao, api';
COMMENT ON COLUMN public.empresas.cadastro_provisorio IS 'Indica se a empresa foi criada automaticamente e aguarda validação';
COMMENT ON COLUMN public.colaboradores.origem IS 'Origem do cadastro: manual, importacao_ponto, importacao, api';
COMMENT ON COLUMN public.colaboradores.cadastro_provisorio IS 'Indica se o colaborador foi criado automaticamente e aguarda validação';

NOTIFY pgrst, 'reload schema';
