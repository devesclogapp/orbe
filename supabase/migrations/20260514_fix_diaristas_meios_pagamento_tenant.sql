    -- ============================================================
    -- FIX: Isolamento multi-tenant para tabelas de Diaristas e Meios de Pagamento
    -- Data: 2026-05-14
    -- CORREÇÃO v2: todos CREATE INDEX dentro de DO $$ com IF EXISTS
    --   tabelas afetadas:
    --   - regras_marcacao_diaristas
    --   - lancamentos_diaristas
    --   - diaristas_lotes_fechamento
    --   - formas_pagamento_operacional
    -- ============================================================

    -- Garantir que a função auto_set_tenant_id existe
    CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
    RETURNS TRIGGER AS $$
    BEGIN
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := public.current_tenant_id();
    END IF;
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- ============================================================
    -- 1. regras_marcacao_diaristas
    -- ============================================================
    DO $$
    BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'regras_marcacao_diaristas'
    ) THEN
        EXECUTE 'ALTER TABLE public.regras_marcacao_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

        IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'regras_marcacao_diaristas' AND column_name = 'empresa_id'
        ) THEN
        UPDATE public.regras_marcacao_diaristas r
        SET    tenant_id = e.tenant_id
        FROM   public.empresas e
        WHERE  r.empresa_id = e.id
            AND  r.tenant_id IS NULL
            AND  e.tenant_id IS NOT NULL;
        END IF;

        EXECUTE 'ALTER TABLE public.regras_marcacao_diaristas ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Full access regras_marcacao_diaristas" ON public.regras_marcacao_diaristas';
        EXECUTE 'DROP POLICY IF EXISTS "regras_marcacao_tenant_all" ON public.regras_marcacao_diaristas';
        EXECUTE 'DROP POLICY IF EXISTS "Acesso total autenticado regras_marcacao_diaristas" ON public.regras_marcacao_diaristas';
        EXECUTE '
        CREATE POLICY "regras_marcacao_tenant_all" ON public.regras_marcacao_diaristas
            FOR ALL TO authenticated
            USING  (tenant_id = public.current_tenant_id())
            WITH CHECK (tenant_id = public.current_tenant_id())
        ';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_regras_marcacao ON public.regras_marcacao_diaristas';
        EXECUTE '
        CREATE TRIGGER trg_auto_tenant_regras_marcacao
            BEFORE INSERT ON public.regras_marcacao_diaristas
            FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
        ';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_regras_marcacao_diaristas_tenant_id ON public.regras_marcacao_diaristas(tenant_id)';
        RAISE NOTICE 'regras_marcacao_diaristas: isolamento aplicado.';
    ELSE
        RAISE NOTICE 'regras_marcacao_diaristas: tabela nao existe, pulando.';
    END IF;
    END $$;

    -- ============================================================
    -- 2. lancamentos_diaristas
    -- ============================================================
    DO $$
    BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'lancamentos_diaristas'
    ) THEN
        EXECUTE 'ALTER TABLE public.lancamentos_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

        IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'lancamentos_diaristas' AND column_name = 'empresa_id'
        ) THEN
        UPDATE public.lancamentos_diaristas l
        SET    tenant_id = e.tenant_id
        FROM   public.empresas e
        WHERE  l.empresa_id = e.id
            AND  l.tenant_id IS NULL
            AND  e.tenant_id IS NOT NULL;
        END IF;

        EXECUTE 'ALTER TABLE public.lancamentos_diaristas ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Full access lancamentos_diaristas" ON public.lancamentos_diaristas';
        EXECUTE 'DROP POLICY IF EXISTS "lancamentos_diaristas_tenant_all" ON public.lancamentos_diaristas';
        EXECUTE 'DROP POLICY IF EXISTS "Acesso total autenticado lancamentos_diaristas" ON public.lancamentos_diaristas';
        EXECUTE '
        CREATE POLICY "lancamentos_diaristas_tenant_all" ON public.lancamentos_diaristas
            FOR ALL TO authenticated
            USING  (tenant_id = public.current_tenant_id())
            WITH CHECK (tenant_id = public.current_tenant_id())
        ';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_lancamentos_diaristas ON public.lancamentos_diaristas';
        EXECUTE '
        CREATE TRIGGER trg_auto_tenant_lancamentos_diaristas
            BEFORE INSERT ON public.lancamentos_diaristas
            FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
        ';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_lancamentos_diaristas_tenant_id ON public.lancamentos_diaristas(tenant_id)';
        RAISE NOTICE 'lancamentos_diaristas: isolamento aplicado.';
    ELSE
        RAISE NOTICE 'lancamentos_diaristas: tabela nao existe, pulando.';
    END IF;
    END $$;

    -- ============================================================
    -- 3. diaristas_lotes_fechamento
    -- ============================================================
    DO $$
    BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'diaristas_lotes_fechamento'
    ) THEN
        EXECUTE 'ALTER TABLE public.diaristas_lotes_fechamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

        IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'diaristas_lotes_fechamento' AND column_name = 'empresa_id'
        ) THEN
        UPDATE public.diaristas_lotes_fechamento d
        SET    tenant_id = e.tenant_id
        FROM   public.empresas e
        WHERE  d.empresa_id = e.id
            AND  d.tenant_id IS NULL
            AND  e.tenant_id IS NOT NULL;
        END IF;

        EXECUTE 'ALTER TABLE public.diaristas_lotes_fechamento ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "Full access diaristas_lotes_fechamento" ON public.diaristas_lotes_fechamento';
        EXECUTE 'DROP POLICY IF EXISTS "diaristas_lotes_fechamento_tenant_all" ON public.diaristas_lotes_fechamento';
        EXECUTE 'DROP POLICY IF EXISTS "Acesso total autenticado diaristas_lotes_fechamento" ON public.diaristas_lotes_fechamento';
        EXECUTE '
        CREATE POLICY "diaristas_lotes_fechamento_tenant_all" ON public.diaristas_lotes_fechamento
            FOR ALL TO authenticated
            USING  (tenant_id = public.current_tenant_id())
            WITH CHECK (tenant_id = public.current_tenant_id())
        ';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_diaristas_lotes ON public.diaristas_lotes_fechamento';
        EXECUTE '
        CREATE TRIGGER trg_auto_tenant_diaristas_lotes
            BEFORE INSERT ON public.diaristas_lotes_fechamento
            FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
        ';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_fechamento_tenant_id ON public.diaristas_lotes_fechamento(tenant_id)';
        RAISE NOTICE 'diaristas_lotes_fechamento: isolamento aplicado.';
    ELSE
        RAISE NOTICE 'diaristas_lotes_fechamento: tabela nao existe, pulando.';
    END IF;
    END $$;

    -- ============================================================
    -- 4. formas_pagamento_operacional — reforco de isolamento
    -- ============================================================
    DO $$
    BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'formas_pagamento_operacional'
    ) THEN
        EXECUTE 'ALTER TABLE public.formas_pagamento_operacional ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';

        IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'formas_pagamento_operacional' AND column_name = 'empresa_id'
        ) THEN
        UPDATE public.formas_pagamento_operacional f
        SET    tenant_id = e.tenant_id
        FROM   public.empresas e
        WHERE  f.empresa_id = e.id
            AND  f.tenant_id IS NULL
            AND  e.tenant_id IS NOT NULL;
        END IF;

        EXECUTE 'ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY';
        EXECUTE 'DROP POLICY IF EXISTS "fpo_authenticated_access"    ON public.formas_pagamento_operacional';
        EXECUTE 'DROP POLICY IF EXISTS "fpo_tenant_isolation"        ON public.formas_pagamento_operacional';
        EXECUTE 'DROP POLICY IF EXISTS "formas_pagamento_tenant_all" ON public.formas_pagamento_operacional';
        EXECUTE 'DROP POLICY IF EXISTS "Acesso insert Admin Financeiro formas_pagamento_operacional" ON public.formas_pagamento_operacional';
        EXECUTE 'DROP POLICY IF EXISTS "Acesso leitura autenticado formas_pagamento_operacional" ON public.formas_pagamento_operacional';
        EXECUTE '
        CREATE POLICY "formas_pagamento_tenant_all" ON public.formas_pagamento_operacional
            FOR ALL TO authenticated
            USING  (tenant_id = public.current_tenant_id())
            WITH CHECK (tenant_id = public.current_tenant_id())
        ';
        EXECUTE 'DROP TRIGGER IF EXISTS trg_auto_tenant_formas_pagamento ON public.formas_pagamento_operacional';
        EXECUTE '
        CREATE TRIGGER trg_auto_tenant_formas_pagamento
            BEFORE INSERT ON public.formas_pagamento_operacional
            FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id()
        ';
        EXECUTE 'CREATE INDEX IF NOT EXISTS idx_formas_pagamento_tenant_id ON public.formas_pagamento_operacional(tenant_id)';
        RAISE NOTICE 'formas_pagamento_operacional: isolamento reforcado.';
    ELSE
        RAISE NOTICE 'formas_pagamento_operacional: tabela nao existe, pulando.';
    END IF;
    END $$;

    -- ============================================================
    -- VERIFICACAO — execute apos aplicar a migracao no Supabase
    -- Cada tabela deve ter policy com current_tenant_id()
    -- ============================================================
    SELECT
    tablename,
    policyname,
    cmd,
    qual
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename IN (
        'regras_marcacao_diaristas',
        'lancamentos_diaristas',
        'diaristas_lotes_fechamento',
        'formas_pagamento_operacional'
    )
    ORDER BY tablename, policyname;
