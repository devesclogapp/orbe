CREATE TABLE IF NOT EXISTS public.importacao_modelos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.current_tenant_id(),
  modulo TEXT NOT NULL,
  nome_arquivo TEXT,
  drive_url TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT importacao_modelos_modulo_check CHECK (
    modulo IN (
      'colaboradores',
      'empresas',
      'coletores',
      'transportadoras',
      'fornecedores',
      'servicos',
      'parametros'
    )
  ),
  CONSTRAINT importacao_modelos_drive_url_check CHECK (
    drive_url ~* '^https?://'
  ),
  CONSTRAINT importacao_modelos_tenant_modulo_key UNIQUE (tenant_id, modulo)
);

ALTER TABLE public.importacao_modelos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS importacao_modelos_select_policy ON public.importacao_modelos;
CREATE POLICY importacao_modelos_select_policy
  ON public.importacao_modelos
  FOR SELECT
  USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS importacao_modelos_insert_policy ON public.importacao_modelos;
CREATE POLICY importacao_modelos_insert_policy
  ON public.importacao_modelos
  FOR INSERT
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS importacao_modelos_update_policy ON public.importacao_modelos;
CREATE POLICY importacao_modelos_update_policy
  ON public.importacao_modelos
  FOR UPDATE
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS importacao_modelos_delete_policy ON public.importacao_modelos;
CREATE POLICY importacao_modelos_delete_policy
  ON public.importacao_modelos
  FOR DELETE
  USING (tenant_id = public.current_tenant_id());

CREATE INDEX IF NOT EXISTS idx_importacao_modelos_tenant_modulo
  ON public.importacao_modelos (tenant_id, modulo);
