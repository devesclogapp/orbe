-- ============================================================
-- FIX: Isolar regras_modulos, regras_campos e regras_dados por tenant
-- Data: 2026-05-14
-- Problema: tabelas tratadas como catálogos globais (USING true)
--   mas contêm dados específicos de cada tenant (meios de pagamento,
--   regras financeiras, etc.)
-- ============================================================

-- ============================================================
-- 1. regras_modulos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regras_modulos'
  ) THEN
    EXECUTE 'ALTER TABLE public.regras_modulos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE 'ALTER TABLE public.regras_modulos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "regras_modulos_authenticated" ON public.regras_modulos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.regras_modulos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_modulos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_modulos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_modulos';
    EXECUTE 'DROP POLICY IF EXISTS "regras_modulos_tenant_all" ON public.regras_modulos';
    EXECUTE '
      CREATE POLICY "regras_modulos_tenant_all" ON public.regras_modulos
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
    RAISE NOTICE 'regras_modulos: policy por tenant aplicada.';
  END IF;
END $$;

-- Trigger auto-tenant em regras_modulos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regras_modulos'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_regras_modulos ON public.regras_modulos';
    EXECUTE '
      CREATE TRIGGER trg_auto_tenant_regras_modulos
        BEFORE INSERT ON public.regras_modulos
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
    ';
  END IF;
END $$;

-- Popular tenant_id em registros existentes de regras_modulos
-- (associar ao tenant do usuário que tem mais registros, ou ao primeiro tenant ativo)
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'regras_modulos' AND column_name = 'tenant_id'
  ) THEN
    -- Pega o tenant com mais empresas (presumivelmente o tenant principal)
    SELECT t.id INTO v_tenant_id
    FROM public.tenants t
    JOIN public.empresas e ON e.tenant_id = t.id
    GROUP BY t.id
    ORDER BY COUNT(e.id) DESC
    LIMIT 1;

    IF v_tenant_id IS NOT NULL THEN
      UPDATE public.regras_modulos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
      RAISE NOTICE 'regras_modulos: tenant_id populado com %', v_tenant_id;
    END IF;
  END IF;
END $$;

-- ============================================================
-- 2. regras_campos
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regras_campos'
  ) THEN
    EXECUTE 'ALTER TABLE public.regras_campos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE 'ALTER TABLE public.regras_campos ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "regras_campos_authenticated" ON public.regras_campos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.regras_campos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_campos';
    EXECUTE 'DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_campos';
    EXECUTE 'DROP POLICY IF EXISTS "regras_campos_tenant_all" ON public.regras_campos';
    EXECUTE '
      CREATE POLICY "regras_campos_tenant_all" ON public.regras_campos
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
    RAISE NOTICE 'regras_campos: policy por tenant aplicada.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regras_campos'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_regras_campos ON public.regras_campos';
    EXECUTE '
      CREATE TRIGGER trg_auto_tenant_regras_campos
        BEFORE INSERT ON public.regras_campos
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
    ';
  END IF;
END $$;

-- Popular tenant_id em regras_campos via regras_modulos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'regras_campos' AND column_name = 'tenant_id'
  ) THEN
    UPDATE public.regras_campos rc
    SET    tenant_id = rm.tenant_id
    FROM   public.regras_modulos rm
    WHERE  rc.modulo_id = rm.id
      AND  rc.tenant_id IS NULL
      AND  rm.tenant_id IS NOT NULL;
    RAISE NOTICE 'regras_campos: tenant_id populado.';
  END IF;
END $$;

-- ============================================================
-- 3. regras_dados
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regras_dados'
  ) THEN
    EXECUTE 'ALTER TABLE public.regras_dados ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE 'ALTER TABLE public.regras_dados ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "regras_dados_authenticated" ON public.regras_dados';
    EXECUTE 'DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.regras_dados';
    EXECUTE 'DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_dados';
    EXECUTE 'DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_dados';
    EXECUTE 'DROP POLICY IF EXISTS "regras_dados_tenant_all" ON public.regras_dados';
    EXECUTE '
      CREATE POLICY "regras_dados_tenant_all" ON public.regras_dados
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
    RAISE NOTICE 'regras_dados: policy por tenant aplicada.';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'regras_dados'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_regras_dados ON public.regras_dados';
    EXECUTE '
      CREATE TRIGGER trg_auto_tenant_regras_dados
        BEFORE INSERT ON public.regras_dados
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
    ';
  END IF;
END $$;

-- Popular tenant_id em regras_dados via modulo_id -> regras_modulos
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'regras_dados' AND column_name = 'tenant_id'
  ) THEN
    UPDATE public.regras_dados rd
    SET    tenant_id = rm.tenant_id
    FROM   public.regras_modulos rm
    WHERE  rd.modulo_id = rm.id
      AND  rd.tenant_id IS NULL
      AND  rm.tenant_id IS NOT NULL;
    RAISE NOTICE 'regras_dados: tenant_id populado.';
  END IF;
END $$;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('regras_modulos', 'regras_campos', 'regras_dados')
ORDER BY tablename, policyname;
