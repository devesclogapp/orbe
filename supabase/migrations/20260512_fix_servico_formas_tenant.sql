-- ============================================================
-- FIX: Isolar tipos_servico_operacional e formas_pagamento_operacional
--      por tenant_id (não são catálogos globais — são dados do tenant)
-- Data: 2026-05-12
-- ============================================================

DO $$
DECLARE
  v_flavio_id     UUID;
  v_flavio_tenant UUID;
BEGIN

  -- Localizar tenant do flavio (dono dos dados reais)
  SELECT id INTO v_flavio_id
  FROM auth.users
  WHERE email = 'flaviocarvalhoficial@gmail.com'
  LIMIT 1;

  SELECT tenant_id INTO v_flavio_tenant
  FROM public.profiles
  WHERE user_id = v_flavio_id
  LIMIT 1;

  IF v_flavio_tenant IS NULL THEN
    RAISE EXCEPTION 'tenant do flavio não encontrado. Execute 20260512_fix_tenant_swap.sql primeiro.';
  END IF;

  RAISE NOTICE 'Tenant ESC Log: %', v_flavio_tenant;

  -- --------------------------------------------------------
  -- 1. tipos_servico_operacional → isolar por tenant
  -- --------------------------------------------------------
  ALTER TABLE public.tipos_servico_operacional
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

  -- Todos os registros existentes pertencem ao flavio
  UPDATE public.tipos_servico_operacional
  SET tenant_id = v_flavio_tenant
  WHERE tenant_id IS NULL;

  RAISE NOTICE 'tipos_servico_operacional: tenant_id populado.';

  -- --------------------------------------------------------
  -- 2. formas_pagamento_operacional → isolar por tenant
  -- --------------------------------------------------------
  ALTER TABLE public.formas_pagamento_operacional
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

  UPDATE public.formas_pagamento_operacional
  SET tenant_id = v_flavio_tenant
  WHERE tenant_id IS NULL;

  RAISE NOTICE 'formas_pagamento_operacional: tenant_id populado.';

  -- --------------------------------------------------------
  -- 3. Corrigir policies: remover acesso global, aplicar tenant
  -- --------------------------------------------------------

  -- tipos_servico_operacional
  DROP POLICY IF EXISTS "tso_authenticated_access"  ON public.tipos_servico_operacional;
  DROP POLICY IF EXISTS "tso_tenant_isolation"       ON public.tipos_servico_operacional;
  DROP POLICY IF EXISTS "tipos_servico_tenant_all"   ON public.tipos_servico_operacional;

  CREATE POLICY "tipos_servico_tenant_all" ON public.tipos_servico_operacional
    FOR ALL TO authenticated
    USING  (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

  RAISE NOTICE 'Policy tipos_servico_operacional: OK';

  -- formas_pagamento_operacional
  DROP POLICY IF EXISTS "fpo_authenticated_access"    ON public.formas_pagamento_operacional;
  DROP POLICY IF EXISTS "fpo_tenant_isolation"        ON public.formas_pagamento_operacional;
  DROP POLICY IF EXISTS "formas_pagamento_tenant_all" ON public.formas_pagamento_operacional;

  CREATE POLICY "formas_pagamento_tenant_all" ON public.formas_pagamento_operacional
    FOR ALL TO authenticated
    USING  (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

  RAISE NOTICE 'Policy formas_pagamento_operacional: OK';

  RAISE NOTICE '✅ Isolamento de tipos_servico e formas_pagamento concluído.';
END $$;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_tipos_servico_tenant_id
  ON public.tipos_servico_operacional(tenant_id);

CREATE INDEX IF NOT EXISTS idx_formas_pagamento_tenant_id
  ON public.formas_pagamento_operacional(tenant_id);

-- Verificação
SELECT
  'tipos_servico_operacional' AS tabela,
  COUNT(*) AS total,
  COUNT(tenant_id) AS com_tenant,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant
FROM public.tipos_servico_operacional

UNION ALL

SELECT
  'formas_pagamento_operacional',
  COUNT(*),
  COUNT(tenant_id),
  COUNT(*) FILTER (WHERE tenant_id IS NULL)
FROM public.formas_pagamento_operacional;
