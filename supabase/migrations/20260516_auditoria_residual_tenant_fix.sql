-- ============================================================
-- AUDITORIA RESIDUAL TENANT FIX — ERP Orbe
-- Data: 2026-05-16
-- Objetivo: Corrigir os últimos vazamentos identificados na
--           auditoria completa de tenant isolation.
--
-- ITENS CORRIGIDOS:
--   1. tipos_servico_operacional  — tenant_id + policy estrita
--   2. formas_pagamento_operacional — tenant_id + policy estrita
--   3. tipos_regra_operacional    — verificar se precisa tenant
--   4. regras_marcacao_diaristas  — tenant_id + policy estrita
--   5. Triggers para novos registros nas tabelas acima
-- ============================================================

-- ============================================================
-- PARTE 1: tipos_servico_operacional
-- Problema: RLS com USING(true) — sem isolamento de tenant
-- ============================================================

-- 1a. Adicionar coluna tenant_id
ALTER TABLE public.tipos_servico_operacional
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 1b. Popular tenant_id via empresa_id (se existir) ou via "tenant com mais empresas"
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Tenta via empresa_id primeiro
  UPDATE public.tipos_servico_operacional tso
  SET    tenant_id = e.tenant_id
  FROM   public.empresas e
  WHERE  tso.empresa_id = e.id
    AND  tso.tenant_id IS NULL
    AND  e.tenant_id IS NOT NULL;

  -- Para registros sem empresa_id, usa tenant com mais empresas (heurística)
  SELECT t.id INTO v_tenant_id
  FROM   public.tenants t
  JOIN   public.empresas e ON e.tenant_id = t.id
  GROUP  BY t.id
  ORDER  BY COUNT(e.id) DESC
  LIMIT  1;

  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.tipos_servico_operacional
    SET    tenant_id = v_tenant_id
    WHERE  tenant_id IS NULL;
    RAISE NOTICE 'tipos_servico_operacional: % registros atualizados com tenant %',
      (SELECT COUNT(*) FROM public.tipos_servico_operacional WHERE tenant_id = v_tenant_id),
      v_tenant_id;
  END IF;
END $$;

-- 1c. Dropar policies permissivas
DROP POLICY IF EXISTS "tso_authenticated_access"                        ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado tipos_servico_operacional" ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tso_tenant_isolation"                            ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Allow delete tipos_servico_operacional"          ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Allow update tipos_servico_operacional"          ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tipos_servico_tenant_all"                        ON public.tipos_servico_operacional;

-- 1d. Criar policy estrita com tenant_id
ALTER TABLE public.tipos_servico_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tipos_servico_tenant_all" ON public.tipos_servico_operacional
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 1e. Trigger para auto-set tenant_id em novos registros
DROP TRIGGER IF EXISTS trg_auto_tenant_tipos_servico_operacional ON public.tipos_servico_operacional;
CREATE TRIGGER trg_auto_tenant_tipos_servico_operacional
  BEFORE INSERT ON public.tipos_servico_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- 1f. Índice de performance
CREATE INDEX IF NOT EXISTS idx_tipos_servico_tenant_id ON public.tipos_servico_operacional(tenant_id);

-- ============================================================
-- PARTE 2: formas_pagamento_operacional
-- Problema: RLS com USING(true) — sem isolamento de tenant
-- ============================================================

-- 2a. Adicionar coluna tenant_id
ALTER TABLE public.formas_pagamento_operacional
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- 2b. Popular tenant_id
DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Tenta via empresa_id se existir na tabela
  BEGIN
    UPDATE public.formas_pagamento_operacional fpo
    SET    tenant_id = e.tenant_id
    FROM   public.empresas e
    WHERE  fpo.empresa_id = e.id
      AND  fpo.tenant_id IS NULL
      AND  e.tenant_id IS NOT NULL;
  EXCEPTION WHEN undefined_column THEN
    -- empresa_id não existe, continua
    RAISE NOTICE 'formas_pagamento_operacional: sem coluna empresa_id, usando heurística';
  END;

  -- Para registros sem tenant_id, usa tenant com mais empresas
  SELECT t.id INTO v_tenant_id
  FROM   public.tenants t
  JOIN   public.empresas e ON e.tenant_id = t.id
  GROUP  BY t.id
  ORDER  BY COUNT(e.id) DESC
  LIMIT  1;

  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.formas_pagamento_operacional
    SET    tenant_id = v_tenant_id
    WHERE  tenant_id IS NULL;
  END IF;
END $$;

-- 2c. Dropar policies permissivas
DROP POLICY IF EXISTS "fpo_authenticated_access"                              ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado formas_pagamento_operacional" ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "fpo_tenant_isolation"                                  ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "formas_pagamento_tenant_all"                           ON public.formas_pagamento_operacional;

-- 2d. Criar policy estrita
ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "formas_pagamento_tenant_all" ON public.formas_pagamento_operacional
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 2e. Trigger
DROP TRIGGER IF EXISTS trg_auto_tenant_formas_pagamento ON public.formas_pagamento_operacional;
CREATE TRIGGER trg_auto_tenant_formas_pagamento
  BEFORE INSERT ON public.formas_pagamento_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- 2f. Índice
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_tenant_id ON public.formas_pagamento_operacional(tenant_id);

-- ============================================================
-- PARTE 3: tipos_regra_operacional
-- Problema: RLS com USING(true) — dados por tenant sem isolamento
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE  table_schema = 'public' AND table_name = 'tipos_regra_operacional'
  ) THEN
    -- Adicionar tenant_id
    EXECUTE 'ALTER TABLE public.tipos_regra_operacional ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

    -- Popular
    EXECUTE '
      DO $inner$
      DECLARE v UUID;
      BEGIN
        SELECT t.id INTO v FROM public.tenants t
        JOIN public.empresas e ON e.tenant_id = t.id
        GROUP BY t.id ORDER BY COUNT(e.id) DESC LIMIT 1;
        IF v IS NOT NULL THEN
          UPDATE public.tipos_regra_operacional SET tenant_id = v WHERE tenant_id IS NULL;
        END IF;
      END $inner$
    ';

    -- Dropar policies permissivas
    EXECUTE 'DROP POLICY IF EXISTS "tipos_regra_operacional_select" ON public.tipos_regra_operacional';

    -- Criar policy estrita
    EXECUTE 'ALTER TABLE public.tipos_regra_operacional ENABLE ROW LEVEL SECURITY';
    EXECUTE '
      CREATE POLICY "tipos_regra_tenant_all" ON public.tipos_regra_operacional
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';

    -- Trigger
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_tipos_regra ON public.tipos_regra_operacional';
    EXECUTE '
      CREATE TRIGGER trg_auto_tenant_tipos_regra
        BEFORE INSERT ON public.tipos_regra_operacional
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
    ';

    -- Índice
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_tipos_regra_tenant_id ON public.tipos_regra_operacional(tenant_id)';

    RAISE NOTICE 'tipos_regra_operacional: tenant isolation aplicado.';
  END IF;
END $$;

-- ============================================================
-- PARTE 4: regras_marcacao_diaristas
-- Problema: Sem tenant_id verificado / RLS desconhecida
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE  table_schema = 'public' AND table_name = 'regras_marcacao_diaristas'
  ) THEN
    -- Adicionar tenant_id
    EXECUTE 'ALTER TABLE public.regras_marcacao_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

    -- Popular via empresa_id
    EXECUTE '
      UPDATE public.regras_marcacao_diaristas rmd
      SET    tenant_id = e.tenant_id
      FROM   public.empresas e
      WHERE  rmd.empresa_id = e.id
        AND  rmd.tenant_id IS NULL
        AND  e.tenant_id IS NOT NULL
    ';

    -- Popular registros globais (empresa_id IS NULL) com tenant principal
    EXECUTE '
      DO $inner$
      DECLARE v UUID;
      BEGIN
        SELECT t.id INTO v FROM public.tenants t
        JOIN public.empresas e ON e.tenant_id = t.id
        GROUP BY t.id ORDER BY COUNT(e.id) DESC LIMIT 1;
        IF v IS NOT NULL THEN
          UPDATE public.regras_marcacao_diaristas
          SET    tenant_id = v
          WHERE  tenant_id IS NULL;
        END IF;
      END $inner$
    ';

    -- Dropar policies permissivas conhecidas
    EXECUTE 'DROP POLICY IF EXISTS "regras_marcacao_all" ON public.regras_marcacao_diaristas';
    EXECUTE 'DROP POLICY IF EXISTS "Allow full access regras_marcacao_diaristas" ON public.regras_marcacao_diaristas';
    EXECUTE 'DROP POLICY IF EXISTS "regras_marcacao_tenant_all" ON public.regras_marcacao_diaristas';

    -- Criar policy estrita
    EXECUTE 'ALTER TABLE public.regras_marcacao_diaristas ENABLE ROW LEVEL SECURITY';
    EXECUTE '
      CREATE POLICY "regras_marcacao_tenant_all" ON public.regras_marcacao_diaristas
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';

    -- Trigger
    EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_regras_marcacao ON public.regras_marcacao_diaristas';
    EXECUTE '
      CREATE TRIGGER trg_auto_tenant_regras_marcacao
        BEFORE INSERT ON public.regras_marcacao_diaristas
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
    ';

    -- Índice
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_regras_marcacao_tenant_id ON public.regras_marcacao_diaristas(tenant_id)';

    RAISE NOTICE 'regras_marcacao_diaristas: tenant isolation aplicado.';
  END IF;
END $$;

-- ============================================================
-- PARTE 5: Garantir trigger em ciclos_diaristas
-- (criados via DiaristaCicloService sem tenant_id no payload)
-- ============================================================

DROP TRIGGER IF EXISTS trg_auto_tenant_ciclos_diaristas ON public.ciclos_diaristas;
CREATE TRIGGER trg_auto_tenant_ciclos_diaristas
  BEFORE INSERT ON public.ciclos_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lote_pagamento ON public.lote_pagamento_diaristas;
CREATE TRIGGER trg_auto_tenant_lote_pagamento
  BEFORE INSERT ON public.lote_pagamento_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lote_itens ON public.lote_pagamento_itens;
CREATE TRIGGER trg_auto_tenant_lote_itens
  BEFORE INSERT ON public.lote_pagamento_itens
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_lancamentos_ad ON public.lancamentos_adicionais_diaristas;
CREATE TRIGGER trg_auto_tenant_lancamentos_ad
  BEFORE INSERT ON public.lancamentos_adicionais_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_regras_fechamento ON public.regras_fechamento;
CREATE TRIGGER trg_auto_tenant_regras_fechamento
  BEFORE INSERT ON public.regras_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'tipos_servico_operacional',
    'formas_pagamento_operacional',
    'tipos_regra_operacional',
    'regras_marcacao_diaristas',
    'ciclos_diaristas',
    'lote_pagamento_diaristas'
  )
ORDER BY tablename, policyname;

-- Confirmar que não há registros sem tenant_id nas tabelas corrigidas
SELECT 'tipos_servico_operacional'  AS tabela, COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant, COUNT(*) AS total FROM public.tipos_servico_operacional
UNION ALL
SELECT 'formas_pagamento_operacional', COUNT(*) FILTER (WHERE tenant_id IS NULL), COUNT(*) FROM public.formas_pagamento_operacional
UNION ALL
SELECT 'regras_marcacao_diaristas',    COUNT(*) FILTER (WHERE tenant_id IS NULL), COUNT(*) FROM public.regras_marcacao_diaristas
UNION ALL
SELECT 'ciclos_diaristas',             COUNT(*) FILTER (WHERE tenant_id IS NULL), COUNT(*) FROM public.ciclos_diaristas
UNION ALL
SELECT 'lote_pagamento_diaristas',     COUNT(*) FILTER (WHERE tenant_id IS NULL), COUNT(*) FROM public.lote_pagamento_diaristas;
