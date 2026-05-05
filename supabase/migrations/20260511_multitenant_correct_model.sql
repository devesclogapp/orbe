-- ============================================================
-- MULTITENANT CORRECT MODEL — ERP Orbe
-- Data: 2026-05-11
-- Objetivo: Separar definitivamente tenant / empresa / user
--
-- tenant  = organização que usa o SaaS (ESC Log, etc.)
-- empresa = cadastro operacional do tenant (cliente, fornecedor...)
-- profiles = vínculo user ↔ tenant com role
--
-- REGRA: isolamento sempre por tenant_id = current_tenant_id()
--        diretamente na tabela operacional.
--        NUNCA via empresa_id → empresas → tenant_id
-- ============================================================

-- ============================================================
-- PASSO 1: Garantir infra de tenants existe
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants visíveis para membros" ON public.tenants;
CREATE POLICY "Tenants visíveis para membros" ON public.tenants
  FOR SELECT USING (
    id = public.current_tenant_id()
  );

-- Função de lookup do tenant do usuário logado
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- PASSO 2: Criar tenant e profile para flaviocarvalhoficial@gmail.com
-- ============================================================

DO $$
DECLARE
  v_user_id   UUID;
  v_tenant_id UUID;
  v_has_profile BOOLEAN;
BEGIN
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'flaviocarvalhoficial@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'Usuário flaviocarvalhoficial não encontrado.';
    RETURN;
  END IF;

  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = v_user_id) INTO v_has_profile;

  IF v_has_profile THEN
    -- Verificar se já tem tenant vinculado
    SELECT tenant_id INTO v_tenant_id FROM profiles WHERE user_id = v_user_id LIMIT 1;
    IF v_tenant_id IS NOT NULL THEN
      RAISE NOTICE 'flavio já tem tenant: %', v_tenant_id;
      RETURN;
    END IF;
  END IF;

  -- Criar tenant da organização do flavio
  v_tenant_id := gen_random_uuid();
  INSERT INTO public.tenants (id, name, created_by)
  VALUES (v_tenant_id, 'ESC Log', v_user_id)
  ON CONFLICT DO NOTHING;

  IF v_has_profile THEN
    UPDATE profiles SET tenant_id = v_tenant_id, role = 'admin'
    WHERE user_id = v_user_id;
  ELSE
    INSERT INTO profiles (user_id, tenant_id, role)
    VALUES (v_user_id, v_tenant_id, 'admin');
  END IF;

  -- Vincular empresas sem tenant ao tenant do flavio
  -- (dados já cadastrados antes do multi-tenant ser implementado)
  UPDATE public.empresas
  SET tenant_id = v_tenant_id
  WHERE tenant_id IS NULL;

  RAISE NOTICE 'Tenant criado para flavio: %', v_tenant_id;
END $$;

-- ============================================================
-- PASSO 3: Adicionar tenant_id nas tabelas operacionais
--          (isolamento direto, sem passar por empresas)
-- ============================================================

-- colaboradores
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- unidades
ALTER TABLE public.unidades ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- transportadoras_clientes
ALTER TABLE public.transportadoras_clientes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- fornecedores
ALTER TABLE public.fornecedores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- fornecedor_valores_servico
ALTER TABLE public.fornecedor_valores_servico ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- produtos_carga
ALTER TABLE public.produtos_carga ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- operacoes (legado)
ALTER TABLE public.operacoes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- operacoes_producao
ALTER TABLE public.operacoes_producao ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- custos_extras_operacionais
ALTER TABLE public.custos_extras_operacionais ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- resultados_processamento
ALTER TABLE public.resultados_processamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- logs_sincronizacao
ALTER TABLE public.logs_sincronizacao ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- coletores
ALTER TABLE public.coletores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- ============================================================
-- PASSO 4: Popular tenant_id nas tabelas operacionais
--          a partir do tenant das empresas já vinculadas
-- ============================================================

UPDATE public.colaboradores c
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE c.empresa_id = e.id AND c.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.unidades u
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE u.empresa_id = e.id AND u.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.transportadoras_clientes tc
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE tc.empresa_id = e.id AND tc.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.fornecedores f
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE f.empresa_id = e.id AND f.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.fornecedor_valores_servico fvs
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE fvs.empresa_id = e.id AND fvs.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.produtos_carga pc
SET tenant_id = f.tenant_id
FROM public.fornecedores f
WHERE pc.fornecedor_id = f.id AND pc.tenant_id IS NULL AND f.tenant_id IS NOT NULL;

UPDATE public.operacoes op
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE op.empresa_id = e.id AND op.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.operacoes_producao op
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE op.empresa_id = e.id AND op.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.custos_extras_operacionais ceo
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE ceo.empresa_id = e.id AND ceo.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.resultados_processamento rp
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE rp.empresa_id = e.id AND rp.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.logs_sincronizacao ls
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE ls.empresa_id = e.id AND ls.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

UPDATE public.coletores co
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE co.empresa_id = e.id AND co.tenant_id IS NULL AND e.tenant_id IS NOT NULL;

-- ============================================================
-- PASSO 5: Trigger universal para auto-popular tenant_id
--          em tabelas com empresa_id na hora do INSERT
-- ============================================================

CREATE OR REPLACE FUNCTION public.auto_set_tenant_from_empresa()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não veio tenant_id mas veio empresa_id, resolve via empresas
  IF NEW.tenant_id IS NULL AND NEW.empresa_id IS NOT NULL THEN
    NEW.tenant_id := (
      SELECT tenant_id FROM public.empresas WHERE id = NEW.empresa_id LIMIT 1
    );
  END IF;
  -- Se ainda NULL, usa o tenant do usuário logado
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger nas tabelas operacionais
DO $$
DECLARE
  tbl TEXT;
  tbls TEXT[] := ARRAY[
    'colaboradores', 'unidades', 'transportadoras_clientes',
    'fornecedores', 'fornecedor_valores_servico', 'operacoes',
    'operacoes_producao', 'custos_extras_operacionais',
    'resultados_processamento', 'logs_sincronizacao', 'coletores'
  ];
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_auto_tenant_%s ON public.%s', tbl, tbl);
    EXECUTE format('
      CREATE TRIGGER trg_auto_tenant_%s
        BEFORE INSERT ON public.%s
        FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_from_empresa()
    ', tbl, tbl);
  END LOOP;
END $$;

-- Trigger especial para produtos_carga (link via fornecedor)
CREATE OR REPLACE FUNCTION public.auto_set_tenant_from_fornecedor()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.fornecedor_id IS NOT NULL THEN
    NEW.tenant_id := (
      SELECT tenant_id FROM public.fornecedores WHERE id = NEW.fornecedor_id LIMIT 1
    );
  END IF;
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_tenant_produtos_carga ON public.produtos_carga;
CREATE TRIGGER trg_auto_tenant_produtos_carga
  BEFORE INSERT ON public.produtos_carga
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_from_fornecedor();

-- ============================================================
-- PASSO 6: DESTRUIR TODAS AS POLICIES PERMISSIVAS ANTIGAS
--          (as 37 que abrem dados para qualquer autenticado)
-- ============================================================

-- empresas
DROP POLICY IF EXISTS "Leitura aberta para empresas" ON public.empresas;
DROP POLICY IF EXISTS "Acesso total autenticado para empresas" ON public.empresas;

-- operacoes_producao
DROP POLICY IF EXISTS "Acesso leitura autenticado operacoes_producao" ON public.operacoes_producao;
DROP POLICY IF EXISTS "Acesso insert autenticado operacoes_producao" ON public.operacoes_producao;
DROP POLICY IF EXISTS "Acesso update autenticado operacoes_producao" ON public.operacoes_producao;
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.operacoes_producao;

-- custos_extras_operacionais
DROP POLICY IF EXISTS "Acesso leitura autenticado custos_extras_operacionais" ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "Acesso update autenticado custos_extras_operacionais" ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "Acesso delete autenticado custos_extras_operacionais" ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.custos_extras_operacionais;

-- colaboradores
DROP POLICY IF EXISTS "Acesso total autenticado para colaboradores" ON public.colaboradores;
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.colaboradores;

-- unidades
DROP POLICY IF EXISTS "Acesso leitura autenticado unidades" ON public.unidades;

-- produtos_carga
DROP POLICY IF EXISTS "Acesso leitura autenticado produtos_carga" ON public.produtos_carga;

-- operacoes (legado)
DROP POLICY IF EXISTS "Acesso total autenticado para operacoes" ON public.operacoes;
DROP POLICY IF EXISTS "Users can only see their tenant data" ON public.operacoes;

-- lancamentos_financeiros
DROP POLICY IF EXISTS "Lancamentos Financeiros Select" ON public.lancamentos_financeiros;
DROP POLICY IF EXISTS "Lancamentos Financeiros Update" ON public.lancamentos_financeiros;

-- production_entry_collaborators
DROP POLICY IF EXISTS "Acesso leitura autenticado production_entry_collaborators" ON public.production_entry_collaborators;

-- ciclos_diaristas
DROP POLICY IF EXISTS "Full access ciclos_diaristas" ON public.ciclos_diaristas;

-- lote_pagamento_diaristas
DROP POLICY IF EXISTS "Full access lote_pagamento_diaristas" ON public.lote_pagamento_diaristas;

-- lote_pagamento_itens
DROP POLICY IF EXISTS "Full access lote_pagamento_itens" ON public.lote_pagamento_itens;

-- lancamentos_adicionais_diaristas
DROP POLICY IF EXISTS "Full access lancamentos_adicionais_diaristas" ON public.lancamentos_adicionais_diaristas;

-- regras_fechamento
DROP POLICY IF EXISTS "Full access regras_fechamento" ON public.regras_fechamento;

-- regras_modulos (config global — manter mas com nome limpo)
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow insert access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_modulos;

-- regras_campos
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_campos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_campos;

-- regras_dados
DROP POLICY IF EXISTS "Allow read access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "Allow update access to authenticated users" ON public.regras_dados;
DROP POLICY IF EXISTS "Allow delete access to authenticated users" ON public.regras_dados;

-- config tables (globais — manter abertas para autenticados, são catálogos)
DROP POLICY IF EXISTS "Allow authenticated read on config_tipos_operacao" ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "Allow authenticated read on config_produtos" ON public.config_produtos;
DROP POLICY IF EXISTS "Allow authenticated read on config_tipos_dia" ON public.config_tipos_dia;

-- relatorios_catalogo
DROP POLICY IF EXISTS "Read access for authenticated" ON public.relatorios_catalogo;

-- perfis
DROP POLICY IF EXISTS "Read access for authenticated" ON public.perfis;

-- demo_lotes
DROP POLICY IF EXISTS "demo_lotes_admin_all" ON public.demo_lotes;

-- tipos_regra_operacional
DROP POLICY IF EXISTS "tipos_regra_operacional_select" ON public.tipos_regra_operacional;

-- tipos_servico_operacional (remover duplicatas, manter tso_authenticated_access)
DROP POLICY IF EXISTS "Allow delete tipos_servico_operacional" ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Allow update tipos_servico_operacional" ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado tipos_servico_operacional" ON public.tipos_servico_operacional;

-- ============================================================
-- PASSO 7: CRIAR POLICIES CORRETAS — tenant_id direto
-- ============================================================

-- MACRO: tabelas com tenant_id direto = isolamento puro
-- empresas (cadastros operacionais do tenant)
DROP POLICY IF EXISTS "empresas_tenant_select" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_insert" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_update" ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_delete" ON public.empresas;

CREATE POLICY "empresas_tenant_select" ON public.empresas
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "empresas_tenant_insert" ON public.empresas
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "empresas_tenant_update" ON public.empresas
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "empresas_tenant_delete" ON public.empresas
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- colaboradores
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colaboradores_tenant_select" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_insert" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_update" ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_delete" ON public.colaboradores;
CREATE POLICY "colaboradores_tenant_select" ON public.colaboradores
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "colaboradores_tenant_insert" ON public.colaboradores
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "colaboradores_tenant_update" ON public.colaboradores
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "colaboradores_tenant_delete" ON public.colaboradores
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- unidades
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "unidades_tenant_select" ON public.unidades;
CREATE POLICY "unidades_tenant_select" ON public.unidades
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "unidades_tenant_insert" ON public.unidades
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "unidades_tenant_update" ON public.unidades
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
DROP POLICY IF EXISTS "unidades_tenant_insert" ON public.unidades;
DROP POLICY IF EXISTS "unidades_tenant_update" ON public.unidades;

-- transportadoras_clientes
DROP POLICY IF EXISTS "tc_tenant_isolation_select" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_insert" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_update" ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_delete" ON public.transportadoras_clientes;
CREATE POLICY "tc_tenant_select" ON public.transportadoras_clientes
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tc_tenant_insert" ON public.transportadoras_clientes
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "tc_tenant_update" ON public.transportadoras_clientes
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "tc_tenant_delete" ON public.transportadoras_clientes
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- fornecedores
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_select" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_insert" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_update" ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_delete" ON public.fornecedores;
CREATE POLICY "fornecedor_tenant_select" ON public.fornecedores
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "fornecedor_tenant_insert" ON public.fornecedores
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "fornecedor_tenant_update" ON public.fornecedores
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "fornecedor_tenant_delete" ON public.fornecedores
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- fornecedor_valores_servico
DROP POLICY IF EXISTS "fvs_tenant_isolation_select" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_insert" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_update" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_delete" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "rf_tenant_isolation" ON public.fornecedor_valores_servico;
CREATE POLICY "fvs_tenant_select" ON public.fornecedor_valores_servico
  FOR SELECT USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);
CREATE POLICY "fvs_tenant_insert" ON public.fornecedor_valores_servico
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "fvs_tenant_update" ON public.fornecedor_valores_servico
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "fvs_tenant_delete" ON public.fornecedor_valores_servico
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- produtos_carga
ALTER TABLE public.produtos_carga ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_carga_tenant_select" ON public.produtos_carga
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "produtos_carga_tenant_insert" ON public.produtos_carga
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "produtos_carga_tenant_update" ON public.produtos_carga
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "produtos_carga_tenant_delete" ON public.produtos_carga
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- operacoes (legado)
ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operacoes_tenant_select" ON public.operacoes
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "operacoes_tenant_insert" ON public.operacoes
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "operacoes_tenant_update" ON public.operacoes
  FOR UPDATE USING (tenant_id = public.current_tenant_id());

-- operacoes_producao
ALTER TABLE public.operacoes_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "op_tenant_select" ON public.operacoes_producao
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "op_tenant_insert" ON public.operacoes_producao
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "op_tenant_update" ON public.operacoes_producao
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "op_tenant_delete" ON public.operacoes_producao
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- custos_extras_operacionais
ALTER TABLE public.custos_extras_operacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ceo_tenant_select" ON public.custos_extras_operacionais
  FOR SELECT USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ceo_tenant_insert" ON public.custos_extras_operacionais
  FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());
CREATE POLICY "ceo_tenant_update" ON public.custos_extras_operacionais
  FOR UPDATE USING (tenant_id = public.current_tenant_id());
CREATE POLICY "ceo_tenant_delete" ON public.custos_extras_operacionais
  FOR DELETE USING (tenant_id = public.current_tenant_id());

-- diaristas: ciclos, lotes, lancamentos (já têm tenant_id)
DROP POLICY IF EXISTS "Full access ciclos_diaristas" ON public.ciclos_diaristas;
CREATE POLICY "ciclos_tenant_all" ON public.ciclos_diaristas
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Full access lote_pagamento_diaristas" ON public.lote_pagamento_diaristas;
CREATE POLICY "lotes_tenant_all" ON public.lote_pagamento_diaristas
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Full access lote_pagamento_itens" ON public.lote_pagamento_itens;
ALTER TABLE public.lote_pagamento_itens ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);
-- Populate via lote
UPDATE public.lote_pagamento_itens li
SET tenant_id = l.tenant_id
FROM public.lote_pagamento_diaristas l
WHERE li.lote_id = l.id AND li.tenant_id IS NULL AND l.tenant_id IS NOT NULL;
CREATE POLICY "lote_itens_tenant_all" ON public.lote_pagamento_itens
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Full access lancamentos_adicionais_diaristas" ON public.lancamentos_adicionais_diaristas;
CREATE POLICY "lancamentos_ad_tenant_all" ON public.lancamentos_adicionais_diaristas
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "Full access regras_fechamento" ON public.regras_fechamento;
CREATE POLICY "regras_fech_tenant_all" ON public.regras_fechamento
  FOR ALL TO authenticated USING (tenant_id = public.current_tenant_id());

-- regras_financeiras (já tem tenant_id)
DROP POLICY IF EXISTS "rf_tenant_isolation" ON public.regras_financeiras;
CREATE POLICY "rf_tenant_all" ON public.regras_financeiras
  FOR ALL TO authenticated USING (
    tenant_id = public.current_tenant_id()
    OR tenant_id IS NULL  -- regras globais do sistema
  );

-- ============================================================
-- PASSO 8: Tabelas de catálogo global (sem isolamento por tenant)
--          config, tipos, formas — todos autenticados podem ler
-- ============================================================

ALTER TABLE public.config_tipos_operacao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_tipos_op_read" ON public.config_tipos_operacao;
CREATE POLICY "config_tipos_op_read" ON public.config_tipos_operacao
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.config_produtos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_produtos_read" ON public.config_produtos;
CREATE POLICY "config_produtos_read" ON public.config_produtos
  FOR SELECT TO authenticated USING (true);

ALTER TABLE public.config_tipos_dia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "config_tipos_dia_read" ON public.config_tipos_dia;
CREATE POLICY "config_tipos_dia_read" ON public.config_tipos_dia
  FOR SELECT TO authenticated USING (true);

-- Manter tipos_servico_operacional e formas_pagamento_operacional como globais
-- (já têm policies corretas: tso_authenticated_access, fpo_authenticated_access)

-- regras_modulos, regras_campos, regras_dados — catálogo de sistema, global
ALTER TABLE public.regras_modulos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_modulos_authenticated" ON public.regras_modulos
  FOR ALL TO authenticated USING (true);

ALTER TABLE public.regras_campos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_campos_authenticated" ON public.regras_campos
  FOR ALL TO authenticated USING (true);

ALTER TABLE public.regras_dados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_dados_authenticated" ON public.regras_dados
  FOR ALL TO authenticated USING (true);

-- ============================================================
-- PASSO 9: Índices de performance para lookup direto por tenant_id
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_empresas_tenant ON public.empresas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_tenant ON public.colaboradores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unidades_tenant ON public.unidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tc_tenant ON public.transportadoras_clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant ON public.fornecedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fvs_tenant ON public.fornecedor_valores_servico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_produtos_carga_tenant ON public.produtos_carga(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_tenant ON public.operacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_op_producao_tenant ON public.operacoes_producao(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custos_tenant ON public.custos_extras_operacionais(tenant_id);

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT
  schemaname,
  tablename,
  policyname,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR qual LIKE '%current_tenant_id%')
ORDER BY tablename, policyname;
