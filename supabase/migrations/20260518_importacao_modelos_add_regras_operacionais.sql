ALTER TABLE IF EXISTS public.importacao_modelos
  DROP CONSTRAINT IF EXISTS importacao_modelos_modulo_check;

ALTER TABLE IF EXISTS public.importacao_modelos
  ADD CONSTRAINT importacao_modelos_modulo_check CHECK (
    modulo IN (
      'colaboradores',
      'empresas',
      'coletores',
      'transportadoras',
      'fornecedores',
      'servicos',
      'parametros',
      'regras_operacionais'
    )
  );
