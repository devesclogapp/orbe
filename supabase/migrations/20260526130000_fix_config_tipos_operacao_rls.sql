-- Corrige isolamento e permissões da tela "Tipos de Operação"
-- Objetivos:
-- 1. Garantir tenant_id no insert
-- 2. Validar auth.uid() no acesso autenticado
-- 3. Permitir CRUD somente ao tenant autenticado
-- 4. Preservar leitura de registros legados sem tenant_id

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.config_tipos_operacao
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

DO $$
DECLARE
  v_single_tenant UUID;
  v_tenant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_tenant_count FROM public.tenants;

  IF v_tenant_count = 1 THEN
    SELECT id INTO v_single_tenant FROM public.tenants LIMIT 1;

    UPDATE public.config_tipos_operacao
    SET tenant_id = v_single_tenant
    WHERE tenant_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.config_tipos_operacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read on config_tipos_operacao" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_op_read" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_operacao_select" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_operacao_insert" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_operacao_update" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_operacao_delete" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_operacao_tenant_all" ON public.config_tipos_operacao;

CREATE POLICY "config_tipos_operacao_select"
ON public.config_tipos_operacao
FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND (
    tenant_id = public.current_tenant_id()
    OR tenant_id IS NULL
  )
);

CREATE POLICY "config_tipos_operacao_insert"
ON public.config_tipos_operacao
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "config_tipos_operacao_update"
ON public.config_tipos_operacao
FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND tenant_id = public.current_tenant_id()
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND tenant_id = public.current_tenant_id()
);

CREATE POLICY "config_tipos_operacao_delete"
ON public.config_tipos_operacao
FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND tenant_id = public.current_tenant_id()
);

DROP TRIGGER IF EXISTS trg_auto_tenant_config_tipos_operacao ON public.config_tipos_operacao;
CREATE TRIGGER trg_auto_tenant_config_tipos_operacao
  BEFORE INSERT ON public.config_tipos_operacao
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_config_tipos_operacao_tenant_id
  ON public.config_tipos_operacao (tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_config_tipos_operacao_tenant_codigo
  ON public.config_tipos_operacao (tenant_id, upper(btrim(codigo)))
  WHERE tenant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_config_tipos_operacao_tenant_nome
  ON public.config_tipos_operacao (tenant_id, upper(btrim(nome)))
  WHERE tenant_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
