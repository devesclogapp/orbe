-- ============================================================
-- HARDENING FINAL: Cadastros e Regras
-- Data: 2026-05-18
-- Objetivo:
--   1. Consolidar o estado final esperado das tabelas de regras
--   2. Neutralizar policies permissivas recriadas por migrations antigas
--   3. Garantir tenant_id, triggers e RLS coerentes para cadastros
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT p.role
  INTO v_role
  FROM public.profiles p
  WHERE p.user_id = v_user_id
  LIMIT 1;

  IF v_role IS NULL THEN
    BEGIN
      SELECT
        CASE
          WHEN EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'perfis_usuarios'
              AND column_name = 'role'
          ) THEN (
            SELECT pu.role
            FROM public.perfis_usuarios pu
            WHERE pu.user_id = v_user_id
            LIMIT 1
          )
          ELSE NULL
        END
      INTO v_role;
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      v_role := NULL;
    END;
  END IF;

  RETURN CASE LOWER(COALESCE(v_role, ''))
    WHEN 'admin' THEN 'Admin'
    WHEN 'financeiro' THEN 'Financeiro'
    WHEN 'rh' THEN 'RH'
    WHEN 'encarregado' THEN 'Encarregado'
    WHEN 'user' THEN 'User'
    ELSE v_role
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.auto_set_tenant_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE public.fornecedor_valores_servico
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN empresa_id DROP NOT NULL;

ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN fornecedor_id DROP NOT NULL;

ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN tipo_servico_id DROP NOT NULL;

UPDATE public.fornecedor_valores_servico
SET tipo_calculo = 'operation'
WHERE tipo_calculo = 'fixo';

ALTER TABLE public.fornecedor_valores_servico
DROP CONSTRAINT IF EXISTS fornecedor_valores_servico_tipo_calculo_check;

ALTER TABLE public.fornecedor_valores_servico
ADD CONSTRAINT fornecedor_valores_servico_tipo_calculo_check
CHECK (tipo_calculo IN ('volume', 'daily', 'operation', 'colaborador'));

UPDATE public.operacoes_producao
SET tipo_calculo_snapshot = 'operation'
WHERE tipo_calculo_snapshot = 'fixo';

ALTER TABLE public.operacoes_producao
DROP CONSTRAINT IF EXISTS operacoes_producao_tipo_calculo_snapshot_check;

ALTER TABLE public.operacoes_producao
ADD CONSTRAINT operacoes_producao_tipo_calculo_snapshot_check
CHECK (tipo_calculo_snapshot IN ('volume', 'daily', 'operation', 'colaborador'));

UPDATE public.fornecedor_valores_servico fvs
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE fvs.empresa_id = e.id
  AND fvs.tenant_id IS NULL
  AND e.tenant_id IS NOT NULL;

UPDATE public.fornecedor_valores_servico fvs
SET tenant_id = f.tenant_id
FROM public.fornecedores f
WHERE fvs.fornecedor_id = f.id
  AND fvs.tenant_id IS NULL
  AND f.tenant_id IS NOT NULL;

DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedor_valores_servico"     ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso update Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso delete Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_select"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_insert"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_update"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_delete"                               ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_select"                                         ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_insert"                                         ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_update"                                         ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_delete"                                         ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "rf_tenant_isolation"                                       ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fornecedor_valores_tenant_all"                             ON public.fornecedor_valores_servico;

ALTER TABLE public.fornecedor_valores_servico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fornecedor_valores_tenant_all" ON public.fornecedor_valores_servico
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS set_tenant_id_on_insert_fvs ON public.fornecedor_valores_servico;
DROP TRIGGER IF EXISTS trg_auto_tenant_fornecedor_valores_servico ON public.fornecedor_valores_servico;

CREATE TRIGGER trg_auto_tenant_fornecedor_valores_servico
  BEFORE INSERT ON public.fornecedor_valores_servico
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_fvs_tenant_id
  ON public.fornecedor_valores_servico(tenant_id);

ALTER TABLE public.regras_modulos ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.regras_campos  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.regras_dados   ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE public.regras_campos rc
SET tenant_id = rm.tenant_id
FROM public.regras_modulos rm
WHERE rc.modulo_id = rm.id
  AND rc.tenant_id IS NULL
  AND rm.tenant_id IS NOT NULL;

UPDATE public.regras_dados rd
SET tenant_id = rm.tenant_id
FROM public.regras_modulos rm
WHERE rd.modulo_id = rm.id
  AND rd.tenant_id IS NULL
  AND rm.tenant_id IS NOT NULL;

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  JOIN public.empresas e ON e.tenant_id = t.id
  GROUP BY t.id
  ORDER BY COUNT(e.id) DESC
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.regras_modulos SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.regras_campos  SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.regras_dados   SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Allow read access to authenticated users"   ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "regras_modulos_authenticated"               ON public.regras_modulos;
DROP POLICY IF EXISTS "regras_modulos_tenant_all"                  ON public.regras_modulos;

DROP POLICY IF EXISTS "Allow read access to authenticated users"   ON public.regras_campos;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "regras_campos_authenticated"                ON public.regras_campos;
DROP POLICY IF EXISTS "regras_campos_tenant_all"                   ON public.regras_campos;

DROP POLICY IF EXISTS "Allow read access to authenticated users"   ON public.regras_dados;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "regras_dados_authenticated"                 ON public.regras_dados;
DROP POLICY IF EXISTS "regras_dados_tenant_all"                    ON public.regras_dados;

ALTER TABLE public.regras_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_campos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_dados   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_modulos_tenant_all" ON public.regras_modulos
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "regras_campos_tenant_all" ON public.regras_campos
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "regras_dados_tenant_all" ON public.regras_dados
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_regras_modulos ON public.regras_modulos;
DROP TRIGGER IF EXISTS trg_auto_tenant_regras_campos  ON public.regras_campos;
DROP TRIGGER IF EXISTS trg_auto_tenant_regras_dados   ON public.regras_dados;

CREATE TRIGGER trg_auto_tenant_regras_modulos
  BEFORE INSERT ON public.regras_modulos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER trg_auto_tenant_regras_campos
  BEFORE INSERT ON public.regras_campos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER trg_auto_tenant_regras_dados
  BEFORE INSERT ON public.regras_dados
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_regras_modulos_tenant_id ON public.regras_modulos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regras_campos_tenant_id  ON public.regras_campos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regras_dados_tenant_id   ON public.regras_dados(tenant_id);

ALTER TABLE public.tipos_servico_operacional    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.formas_pagamento_operacional ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
ALTER TABLE public.tipos_regra_operacional      ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT t.id INTO v_tenant_id
  FROM public.tenants t
  JOIN public.empresas e ON e.tenant_id = t.id
  GROUP BY t.id
  ORDER BY COUNT(e.id) DESC
  LIMIT 1;

  IF v_tenant_id IS NOT NULL THEN
    UPDATE public.tipos_servico_operacional SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.formas_pagamento_operacional SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
    UPDATE public.tipos_regra_operacional SET tenant_id = v_tenant_id WHERE tenant_id IS NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "Acesso leitura autenticado tipos_servico_operacional"    ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Allow delete tipos_servico_operacional"                  ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Allow update tipos_servico_operacional"                  ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tso_tenant_isolation"                                    ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tso_authenticated_access"                                ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tipos_servico_tenant_all"                                ON public.tipos_servico_operacional;

DROP POLICY IF EXISTS "Acesso leitura autenticado formas_pagamento_operacional" ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "fpo_tenant_isolation"                                    ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "fpo_authenticated_access"                                ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "formas_pagamento_tenant_all"                             ON public.formas_pagamento_operacional;

DROP POLICY IF EXISTS "tipos_regra_operacional_select" ON public.tipos_regra_operacional;
DROP POLICY IF EXISTS "tipos_regra_tenant_all"         ON public.tipos_regra_operacional;

ALTER TABLE public.tipos_servico_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_regra_operacional ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_servico_tenant_all" ON public.tipos_servico_operacional
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "formas_pagamento_tenant_all" ON public.formas_pagamento_operacional
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tipos_regra_tenant_all" ON public.tipos_regra_operacional
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_tipos_servico_operacional ON public.tipos_servico_operacional;
DROP TRIGGER IF EXISTS trg_auto_tenant_formas_pagamento          ON public.formas_pagamento_operacional;
DROP TRIGGER IF EXISTS trg_auto_tenant_tipos_regra              ON public.tipos_regra_operacional;

CREATE TRIGGER trg_auto_tenant_tipos_servico_operacional
  BEFORE INSERT ON public.tipos_servico_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER trg_auto_tenant_formas_pagamento
  BEFORE INSERT ON public.formas_pagamento_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE TRIGGER trg_auto_tenant_tipos_regra
  BEFORE INSERT ON public.tipos_regra_operacional
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_tipos_servico_tenant_id    ON public.tipos_servico_operacional(tenant_id);
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_tenant_id ON public.formas_pagamento_operacional(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tipos_regra_tenant_id      ON public.tipos_regra_operacional(tenant_id);

ALTER TABLE public.regras_financeiras
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE public.regras_financeiras rf
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE rf.empresa_id = e.id
  AND rf.tenant_id IS NULL
  AND e.tenant_id IS NOT NULL;

DROP POLICY IF EXISTS "regras_financeiras_all_authenticated" ON public.regras_financeiras;
DROP POLICY IF EXISTS "rf_tenant_isolation"                  ON public.regras_financeiras;
DROP POLICY IF EXISTS "rf_tenant_all"                        ON public.regras_financeiras;

ALTER TABLE public.regras_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rf_tenant_all" ON public.regras_financeiras
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);

DROP TRIGGER IF EXISTS trg_auto_tenant_regras_financeiras ON public.regras_financeiras;

CREATE TRIGGER trg_auto_tenant_regras_financeiras
  BEFORE INSERT ON public.regras_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_regras_financeiras_tenant_id
  ON public.regras_financeiras(tenant_id)
  WHERE tenant_id IS NOT NULL;

ALTER TABLE public.produtos_carga
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE public.produtos_carga pc
SET tenant_id = f.tenant_id
FROM public.fornecedores f
WHERE pc.fornecedor_id = f.id
  AND pc.tenant_id IS NULL
  AND f.tenant_id IS NOT NULL;

DROP POLICY IF EXISTS "Acesso leitura autenticado produtos_carga"               ON public.produtos_carga;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro produtos_carga"           ON public.produtos_carga;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro Encarregado produtos_carga" ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_select"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_insert"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_update"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_delete"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_all"                               ON public.produtos_carga;

ALTER TABLE public.produtos_carga ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produtos_carga_tenant_all" ON public.produtos_carga
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_produtos_carga ON public.produtos_carga;

CREATE TRIGGER trg_auto_tenant_produtos_carga
  BEFORE INSERT ON public.produtos_carga
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_produtos_carga_tenant_id
  ON public.produtos_carga(tenant_id);

ALTER TABLE public.banco_horas_regras
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE public.banco_horas_regras bhr
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE bhr.empresa_id = e.id
  AND bhr.tenant_id IS NULL
  AND e.tenant_id IS NOT NULL;

DROP POLICY IF EXISTS "bh_regras_tenant_all" ON public.banco_horas_regras;
ALTER TABLE public.banco_horas_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bh_regras_tenant_all" ON public.banco_horas_regras
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_bh_regras ON public.banco_horas_regras;

CREATE TRIGGER trg_auto_tenant_bh_regras
  BEFORE INSERT ON public.banco_horas_regras
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_bh_regras_tenant_id ON public.banco_horas_regras(tenant_id);

ALTER TABLE public.regras_marcacao_diaristas
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

UPDATE public.regras_marcacao_diaristas rmd
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE rmd.empresa_id = e.id
  AND rmd.tenant_id IS NULL
  AND e.tenant_id IS NOT NULL;

DO $$
BEGIN
  -- Regras globais antigas (empresa_id NULL) criadas antes do corte multi-tenant
  -- nao possuem proveniencia segura. Nesses casos, preferimos ocultar por RLS
  -- a correr o risco de exibir dados de outro tenant.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'regras_marcacao_diaristas'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE $sql$
      UPDATE public.regras_marcacao_diaristas
      SET tenant_id = NULL
      WHERE empresa_id IS NULL
        AND tenant_id IS NOT NULL
        AND created_at < TIMESTAMPTZ '2026-05-05 00:00:00+00'
    $sql$;
  END IF;
END $$;

DROP POLICY IF EXISTS "regras_diaristas_select"                            ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "regras_diaristas_insert_update"                     ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "Full access regras_marcacao_diaristas"              ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "Acesso total autenticado regras_marcacao_diaristas" ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "regras_marcacao_all"                                ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "Allow full access regras_marcacao_diaristas"        ON public.regras_marcacao_diaristas;
DROP POLICY IF EXISTS "regras_marcacao_tenant_all"                         ON public.regras_marcacao_diaristas;

ALTER TABLE public.regras_marcacao_diaristas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "regras_marcacao_tenant_all" ON public.regras_marcacao_diaristas
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_regras_marcacao ON public.regras_marcacao_diaristas;

CREATE TRIGGER trg_auto_tenant_regras_marcacao
  BEFORE INSERT ON public.regras_marcacao_diaristas
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_regras_marcacao_tenant_id
  ON public.regras_marcacao_diaristas(tenant_id);

-- A constraint antiga estava global demais e impedia tenants diferentes
-- de usarem os mesmos codigos operacionais (ex.: P, MP, HE).
DROP INDEX IF EXISTS public.idx_regras_diar_uni_codigo;
DROP INDEX IF EXISTS public.idx_regras_marcacao_diaristas_codigo_unique;
DROP INDEX IF EXISTS public.regras_marcacao_diaristas_codigo_key;

DO $$
DECLARE
  v_constraint RECORD;
  v_index RECORD;
BEGIN
  FOR v_constraint IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.regras_marcacao_diaristas'::regclass
      AND con.contype = 'u'
      AND pg_get_constraintdef(con.oid) ILIKE '%codigo%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%tenant_id%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.regras_marcacao_diaristas DROP CONSTRAINT IF EXISTS %I',
      v_constraint.conname
    );
  END LOOP;

  FOR v_index IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'regras_marcacao_diaristas'
      AND indexdef ILIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%codigo%'
      AND indexdef NOT ILIKE '%tenant_id%'
      AND indexname <> 'idx_regras_diar_tenant_empresa_codigo_uni'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', v_index.indexname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_regras_diar_tenant_empresa_codigo_uni
  ON public.regras_marcacao_diaristas (
    tenant_id,
    COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid),
    upper(btrim(codigo))
  )
  WHERE tenant_id IS NOT NULL;
