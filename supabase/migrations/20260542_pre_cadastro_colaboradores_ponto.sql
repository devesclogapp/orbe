  -- Etapa 1: preparar pre-cadastro de colaboradores vindos de Pontos Recebidos

  ALTER TABLE public.colaboradores
    ADD COLUMN IF NOT EXISTS status_cadastro TEXT DEFAULT 'completo',
    ADD COLUMN IF NOT EXISTS origem_cadastro TEXT DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS origem_detalhe TEXT;

  UPDATE public.colaboradores
  SET status_cadastro = 'pendente_complemento'
  WHERE cadastro_provisorio = true
    AND COALESCE(status_cadastro, 'completo') <> 'pendente_complemento';

  UPDATE public.colaboradores
  SET origem_cadastro = 'ponto_importado'
  WHERE origem = 'importacao_ponto'
    AND COALESCE(origem_cadastro, 'manual') = 'manual';

  ALTER TABLE public.colaboradores
    ALTER COLUMN status_cadastro SET DEFAULT 'completo';

  ALTER TABLE public.colaboradores
    ALTER COLUMN origem_cadastro SET DEFAULT 'manual';

  ALTER TABLE public.colaboradores
    ALTER COLUMN tipo_contrato DROP NOT NULL,
    ALTER COLUMN tipo_contrato DROP DEFAULT;

  CREATE INDEX IF NOT EXISTS idx_colaboradores_status_cadastro
    ON public.colaboradores (tenant_id, status_cadastro);

  CREATE INDEX IF NOT EXISTS idx_colaboradores_origem_cadastro
    ON public.colaboradores (tenant_id, origem_cadastro);

  COMMENT ON COLUMN public.colaboradores.status_cadastro IS
    'Situacao do cadastro: completo, pendente_complemento';

  COMMENT ON COLUMN public.colaboradores.origem_cadastro IS
    'Origem funcional do cadastro: manual, ponto_importado, api';

  COMMENT ON COLUMN public.colaboradores.origem_detalhe IS
    'Detalhe da origem: planilha, coletor, integracao, etc.';

  NOTIFY pgrst, 'reload schema';
