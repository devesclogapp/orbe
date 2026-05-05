-- ============================================================
-- FIX: Correção de inversão de tenant (v2 — defensivo)
-- Data: 2026-05-12
--
-- Verifica coluna tenant_id antes de cada UPDATE
-- Se a coluna não existir, adiciona antes de migrar
-- ============================================================

DO $$
DECLARE
  v_flavio_id      UUID;
  v_suport_id      UUID;
  v_flavio_tenant  UUID;
  v_suport_tenant  UUID;

  -- helper: adiciona tenant_id e migra dados em uma tabela
  -- chamado como: PERFORM migrate_table('nome_tabela', v_suport, v_flavio)
BEGIN

  -- --------------------------------------------------------
  -- 1. Localizar user_ids
  -- --------------------------------------------------------
  SELECT id INTO v_flavio_id
  FROM auth.users
  WHERE email = 'flaviocarvalhoficial@gmail.com'
  LIMIT 1;

  SELECT id INTO v_suport_id
  FROM auth.users
  WHERE email = 'suport.orbitalabs@gmail.com'
  LIMIT 1;

  IF v_flavio_id IS NULL THEN
    RAISE EXCEPTION 'flaviocarvalhoficial@gmail.com não encontrado em auth.users';
  END IF;

  RAISE NOTICE 'flavio  user_id: %', v_flavio_id;
  RAISE NOTICE 'suport  user_id: %', v_suport_id;

  -- --------------------------------------------------------
  -- 2. Localizar tenant_ids atuais
  -- --------------------------------------------------------
  SELECT tenant_id INTO v_flavio_tenant
  FROM public.profiles
  WHERE user_id = v_flavio_id
  LIMIT 1;

  SELECT tenant_id INTO v_suport_tenant
  FROM public.profiles
  WHERE user_id = v_suport_id
  LIMIT 1;

  RAISE NOTICE 'flavio  tenant: %', v_flavio_tenant;
  RAISE NOTICE 'suport  tenant: %', v_suport_tenant;

  -- --------------------------------------------------------
  -- 3. Criar tenant do Flavio se não existir
  -- --------------------------------------------------------
  IF v_flavio_tenant IS NULL THEN
    v_flavio_tenant := gen_random_uuid();

    INSERT INTO public.tenants (id, name, created_by)
    VALUES (v_flavio_tenant, 'ESC Log', v_flavio_id)
    ON CONFLICT DO NOTHING;

    INSERT INTO public.profiles (user_id, tenant_id, role)
    VALUES (v_flavio_id, v_flavio_tenant, 'admin')
    ON CONFLICT (user_id) DO UPDATE
      SET tenant_id = v_flavio_tenant, role = 'admin';

    RAISE NOTICE 'Novo tenant criado para flavio: %', v_flavio_tenant;
  END IF;

  -- --------------------------------------------------------
  -- 4. Garantir profile do flavio correto
  -- --------------------------------------------------------
  UPDATE public.profiles
  SET tenant_id = v_flavio_tenant, role = 'admin'
  WHERE user_id = v_flavio_id;

  -- --------------------------------------------------------
  -- 5. Migrar dados: para cada tabela, garante coluna e migra
  -- Macro interna: ADD COLUMN IF NOT EXISTS + UPDATE
  -- --------------------------------------------------------

  IF v_suport_tenant IS NULL OR v_suport_tenant = v_flavio_tenant THEN
    RAISE NOTICE '⚠️ Suport sem tenant ou tenants iguais. Nada a migrar.';
    RETURN;
  END IF;

  -- Função interna de migração defensiva por tabela
  -- Formato: (table_name, fk_col_name_for_populate, parent_table, parent_col)

  -- ---- empresas ----
  ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.empresas SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.empresas SET tenant_id = v_flavio_tenant WHERE tenant_id IS NULL;
  RAISE NOTICE 'empresas OK';

  -- ---- colaboradores ----
  ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.colaboradores SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'colaboradores OK';

  -- ---- unidades ----
  ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.unidades SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'unidades OK';

  -- ---- transportadoras_clientes ----
  ALTER TABLE public.transportadoras_clientes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.transportadoras_clientes SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.transportadoras_clientes tc
  SET tenant_id = v_flavio_tenant
  FROM public.empresas e
  WHERE tc.empresa_id = e.id AND tc.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  RAISE NOTICE 'transportadoras_clientes OK';

  -- ---- fornecedores ----
  ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.fornecedores SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.fornecedores f
  SET tenant_id = v_flavio_tenant
  FROM public.empresas e
  WHERE f.empresa_id = e.id AND f.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  RAISE NOTICE 'fornecedores OK';

  -- ---- fornecedor_valores_servico ----
  ALTER TABLE public.fornecedor_valores_servico ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.fornecedor_valores_servico SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.fornecedor_valores_servico fvs
  SET tenant_id = v_flavio_tenant
  FROM public.fornecedores f
  WHERE fvs.fornecedor_id = f.id AND fvs.tenant_id IS NULL AND f.tenant_id IS NOT NULL;
  RAISE NOTICE 'fornecedor_valores_servico OK';

  -- ---- operacoes ----
  ALTER TABLE public.operacoes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.operacoes SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.operacoes op
  SET tenant_id = v_flavio_tenant
  FROM public.empresas e
  WHERE op.empresa_id = e.id AND op.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  RAISE NOTICE 'operacoes OK';

  -- ---- operacoes_producao ----
  ALTER TABLE public.operacoes_producao ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.operacoes_producao SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.operacoes_producao op
  SET tenant_id = v_flavio_tenant
  FROM public.empresas e
  WHERE op.empresa_id = e.id AND op.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  RAISE NOTICE 'operacoes_producao OK';

  -- ---- custos_extras_operacionais ----
  ALTER TABLE public.custos_extras_operacionais ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.custos_extras_operacionais SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.custos_extras_operacionais ceo
  SET tenant_id = v_flavio_tenant
  FROM public.empresas e
  WHERE ceo.empresa_id = e.id AND ceo.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  RAISE NOTICE 'custos_extras_operacionais OK';

  -- ---- lancamentos_financeiros ----
  ALTER TABLE public.lancamentos_financeiros ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.lancamentos_financeiros SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.lancamentos_financeiros lf
  SET tenant_id = v_flavio_tenant
  FROM public.empresas e
  WHERE lf.empresa_id = e.id AND lf.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  RAISE NOTICE 'lancamentos_financeiros OK';

  -- ---- regras_financeiras ----
  ALTER TABLE public.regras_financeiras ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.regras_financeiras SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'regras_financeiras OK';

  -- ---- ciclos_diaristas ----
  ALTER TABLE public.ciclos_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.ciclos_diaristas SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'ciclos_diaristas OK';

  -- ---- lote_pagamento_diaristas ----
  ALTER TABLE public.lote_pagamento_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.lote_pagamento_diaristas SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'lote_pagamento_diaristas OK';

  -- ---- lote_pagamento_itens ----
  ALTER TABLE public.lote_pagamento_itens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.lote_pagamento_itens SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  UPDATE public.lote_pagamento_itens li
  SET tenant_id = v_flavio_tenant
  FROM public.lote_pagamento_diaristas l
  WHERE li.lote_id = l.id AND li.tenant_id IS NULL AND l.tenant_id IS NOT NULL;
  RAISE NOTICE 'lote_pagamento_itens OK';

  -- ---- lancamentos_adicionais_diaristas ----
  ALTER TABLE public.lancamentos_adicionais_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.lancamentos_adicionais_diaristas SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'lancamentos_adicionais_diaristas OK';

  -- ---- regras_fechamento ----
  ALTER TABLE public.regras_fechamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
  UPDATE public.regras_fechamento SET tenant_id = v_flavio_tenant WHERE tenant_id = v_suport_tenant;
  RAISE NOTICE 'regras_fechamento OK';

  -- ---- tabelas opcionais (via EXECUTE dinâmico) ----
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos_carga') THEN
    EXECUTE 'ALTER TABLE public.produtos_carga ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE format('UPDATE public.produtos_carga SET tenant_id = %L WHERE tenant_id = %L', v_flavio_tenant, v_suport_tenant);
    RAISE NOTICE 'produtos_carga OK';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='resultados_processamento') THEN
    EXECUTE 'ALTER TABLE public.resultados_processamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE format('UPDATE public.resultados_processamento SET tenant_id = %L WHERE tenant_id = %L', v_flavio_tenant, v_suport_tenant);
    RAISE NOTICE 'resultados_processamento OK';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='logs_sincronizacao') THEN
    EXECUTE 'ALTER TABLE public.logs_sincronizacao ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE format('UPDATE public.logs_sincronizacao SET tenant_id = %L WHERE tenant_id = %L', v_flavio_tenant, v_suport_tenant);
    RAISE NOTICE 'logs_sincronizacao OK';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='coletores') THEN
    EXECUTE 'ALTER TABLE public.coletores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE format('UPDATE public.coletores SET tenant_id = %L WHERE tenant_id = %L', v_flavio_tenant, v_suport_tenant);
    RAISE NOTICE 'coletores OK';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cnab_geracoes') THEN
    EXECUTE 'ALTER TABLE public.cnab_geracoes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE format('UPDATE public.cnab_geracoes SET tenant_id = %L WHERE tenant_id = %L', v_flavio_tenant, v_suport_tenant);
    RAISE NOTICE 'cnab_geracoes OK';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ponto') THEN
    EXECUTE 'ALTER TABLE public.ponto ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
    EXECUTE format('UPDATE public.ponto SET tenant_id = %L WHERE tenant_id = %L', v_flavio_tenant, v_suport_tenant);
    EXECUTE format(
      'UPDATE public.ponto p SET tenant_id = %L FROM public.empresas e WHERE p.empresa_id = e.id AND p.tenant_id IS NULL AND e.tenant_id IS NOT NULL',
      v_flavio_tenant
    );
    RAISE NOTICE 'ponto OK';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ MIGRAÇÃO CONCLUÍDA';
  RAISE NOTICE '   Todos os dados operacionais agora pertencem ao tenant do flavio: %', v_flavio_tenant;
  RAISE NOTICE '   Tenant do suport isolado (sem dados): %', v_suport_tenant;

END $$;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================

SELECT
  t.name                                                              AS tenant_nome,
  t.id                                                                AS tenant_id,
  (SELECT COUNT(*) FROM public.empresas           WHERE tenant_id = t.id) AS empresas,
  (SELECT COUNT(*) FROM public.colaboradores      WHERE tenant_id = t.id) AS colaboradores,
  (SELECT COUNT(*) FROM public.operacoes_producao WHERE tenant_id = t.id) AS operacoes_producao,
  (SELECT COUNT(*) FROM public.ciclos_diaristas   WHERE tenant_id = t.id) AS ciclos
FROM public.tenants t
ORDER BY t.created_at;
