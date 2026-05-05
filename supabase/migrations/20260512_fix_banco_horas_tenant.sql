-- ============================================================
-- FIX: Isolar Banco de Horas por tenant (v3 — colunas corretas)
-- Data: 2026-05-12
--
-- Colunas reais de banco_horas_eventos:
--   id, colaborador_id, data, quantidade_minutos, tipo,
--   origem, descricao, created_at, empresa_id,
--   data_vencimento, is_teste, lote_id
-- ============================================================

DO $$
DECLARE
  v_flavio_id     UUID;
  v_flavio_tenant UUID;
BEGIN

  SELECT id INTO v_flavio_id
  FROM auth.users
  WHERE email = 'flaviocarvalhoficial@gmail.com'
  LIMIT 1;

  SELECT tenant_id INTO v_flavio_tenant
  FROM public.profiles
  WHERE user_id = v_flavio_id
  LIMIT 1;

  IF v_flavio_tenant IS NULL THEN
    RAISE EXCEPTION 'Tenant do flavio não encontrado.';
  END IF;

  RAISE NOTICE 'Tenant ESC Log: %', v_flavio_tenant;

  -- --------------------------------------------------------
  -- 1. banco_horas_regras
  -- --------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='banco_horas_regras') THEN

    ALTER TABLE public.banco_horas_regras
      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

    UPDATE public.banco_horas_regras bhr
    SET tenant_id = e.tenant_id
    FROM public.empresas e
    WHERE bhr.empresa_id = e.id AND bhr.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

    UPDATE public.banco_horas_regras
    SET tenant_id = v_flavio_tenant
    WHERE tenant_id IS NULL;

    ALTER TABLE public.banco_horas_regras ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "bh_regras_tenant_all" ON public.banco_horas_regras;
    CREATE POLICY "bh_regras_tenant_all" ON public.banco_horas_regras
      FOR ALL TO authenticated
      USING  (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());

    DROP TRIGGER IF EXISTS trg_auto_tenant_bh_regras ON public.banco_horas_regras;
    CREATE TRIGGER trg_auto_tenant_bh_regras
      BEFORE INSERT ON public.banco_horas_regras
      FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

    CREATE INDEX IF NOT EXISTS idx_bh_regras_tenant_id ON public.banco_horas_regras(tenant_id);
    RAISE NOTICE 'banco_horas_regras: OK';
  END IF;

  -- --------------------------------------------------------
  -- 2. banco_horas_eventos
  --    Tem empresa_id diretamente → propagar via empresa
  -- --------------------------------------------------------
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='banco_horas_eventos') THEN

    ALTER TABLE public.banco_horas_eventos
      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

    -- Propagar via empresa_id (existe na tabela)
    UPDATE public.banco_horas_eventos bhe
    SET tenant_id = e.tenant_id
    FROM public.empresas e
    WHERE bhe.empresa_id = e.id AND bhe.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

    -- Fallback via colaborador
    UPDATE public.banco_horas_eventos bhe
    SET tenant_id = c.tenant_id
    FROM public.colaboradores c
    WHERE bhe.colaborador_id = c.id AND bhe.tenant_id IS NULL AND c.tenant_id IS NOT NULL;

    -- Fallback final
    UPDATE public.banco_horas_eventos
    SET tenant_id = v_flavio_tenant
    WHERE tenant_id IS NULL;

    ALTER TABLE public.banco_horas_eventos ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "bh_eventos_tenant_all" ON public.banco_horas_eventos;
    CREATE POLICY "bh_eventos_tenant_all" ON public.banco_horas_eventos
      FOR ALL TO authenticated
      USING  (tenant_id = public.current_tenant_id())
      WITH CHECK (tenant_id = public.current_tenant_id());

    DROP TRIGGER IF EXISTS trg_auto_tenant_bh_eventos ON public.banco_horas_eventos;
    CREATE TRIGGER trg_auto_tenant_bh_eventos
      BEFORE INSERT ON public.banco_horas_eventos
      FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

    CREATE INDEX IF NOT EXISTS idx_bh_eventos_tenant_id       ON public.banco_horas_eventos(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_bh_eventos_colaborador_id  ON public.banco_horas_eventos(colaborador_id);
    RAISE NOTICE 'banco_horas_eventos: OK';
  END IF;

  RAISE NOTICE '✅ Banco de Horas isolado por tenant.';
END $$;

-- ============================================================
-- 3. Recriar get_bh_saldos_gerais com colunas corretas + tenant
-- ============================================================

DROP FUNCTION IF EXISTS public.get_bh_saldos_gerais();

CREATE OR REPLACE FUNCTION public.get_bh_saldos_gerais()
RETURNS TABLE (
  id                   UUID,
  nome                 TEXT,
  matricula            TEXT,
  empresa_id           UUID,
  empresa_nome         TEXT,
  saldo_minutos        BIGINT,
  minutos_vencidos     BIGINT,
  minutos_a_vencer_30d BIGINT,
  status               TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    c.id,
    c.nome,
    c.matricula,
    c.empresa_id,
    e.nome                                              AS empresa_nome,

    -- Saldo total (quantidade_minutos pode ser negativo para débitos)
    COALESCE(SUM(bhe.quantidade_minutos), 0)::BIGINT   AS saldo_minutos,

    -- Minutos já vencidos (positivos com vencimento no passado)
    COALESCE(SUM(
      CASE
        WHEN bhe.data_vencimento IS NOT NULL
          AND bhe.data_vencimento < CURRENT_DATE
          AND bhe.quantidade_minutos > 0
        THEN bhe.quantidade_minutos
        ELSE 0
      END
    ), 0)::BIGINT                                       AS minutos_vencidos,

    -- Minutos prestes a vencer nos próximos 30 dias
    COALESCE(SUM(
      CASE
        WHEN bhe.data_vencimento IS NOT NULL
          AND bhe.data_vencimento >= CURRENT_DATE
          AND bhe.data_vencimento <= CURRENT_DATE + INTERVAL '30 days'
          AND bhe.quantidade_minutos > 0
        THEN bhe.quantidade_minutos
        ELSE 0
      END
    ), 0)::BIGINT                                       AS minutos_a_vencer_30d,

    CASE
      WHEN COALESCE(SUM(bhe.quantidade_minutos), 0) < -120 THEN 'crítico'
      WHEN COALESCE(SUM(bhe.quantidade_minutos), 0) > 0    THEN 'positivo'
      ELSE 'ok'
    END                                                 AS status

  FROM public.colaboradores c
  LEFT JOIN public.empresas e
    ON e.id = c.empresa_id
  LEFT JOIN public.banco_horas_eventos bhe
    ON  bhe.colaborador_id = c.id
    AND bhe.tenant_id      = public.current_tenant_id()
    AND (bhe.is_teste IS NULL OR bhe.is_teste = false)
  WHERE
    c.tenant_id = public.current_tenant_id()
  GROUP BY c.id, c.nome, c.matricula, c.empresa_id, e.nome
  ORDER BY c.nome;
$$;

REVOKE ALL ON FUNCTION public.get_bh_saldos_gerais() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_bh_saldos_gerais() TO authenticated;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  'banco_horas_regras'  AS tabela,
  COUNT(*)              AS total,
  COUNT(tenant_id)      AS com_tenant,
  COUNT(*) FILTER (WHERE tenant_id IS NULL) AS sem_tenant
FROM public.banco_horas_regras

UNION ALL

SELECT
  'banco_horas_eventos',
  COUNT(*),
  COUNT(tenant_id),
  COUNT(*) FILTER (WHERE tenant_id IS NULL)
FROM public.banco_horas_eventos;
