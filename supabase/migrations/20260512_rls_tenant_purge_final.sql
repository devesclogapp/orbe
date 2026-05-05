-- ============================================================
-- RLS TENANT PURGE FINAL v2 — ERP Orbe
-- Data: 2026-05-12
-- Estratégia: 100% defensivo
--   1. Garante que tenants e current_tenant_id() existem
--   2. ADD COLUMN IF NOT EXISTS tenant_id em TODA tabela operacional
--   3. Popula tenant_id nos dados legados (via empresa_id)
--   4. DROP de TODAS as policies históricas (qualquer nome)
--   5. CREATE de UMA única policy FOR ALL por tabela
--
-- REGRA ABSOLUTA:
--   tenant_id = public.current_tenant_id()
--   NUNCA empresa_id, joins, perfis, is_admin, fallback IS NULL
-- ============================================================

-- ============================================================
-- FASE 0: Infraestrutura obrigatória
-- ============================================================

-- Garantir tabela tenants
CREATE TABLE IF NOT EXISTS public.tenants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir tenant_id no profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Função de lookup do tenant do usuário logado (idempotente)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Garantir tenant_id em empresas (ponto de origem dos dados operacionais)
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- ============================================================
-- FASE 1: Garantir coluna tenant_id em TODAS as tabelas operacionais
-- ============================================================

ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.unidades
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.transportadoras_clientes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.fornecedores
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.fornecedor_valores_servico
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.operacoes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.operacoes_producao
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.custos_extras_operacionais
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.lancamentos_financeiros
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.regras_financeiras
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Tabelas de diaristas
ALTER TABLE public.ciclos_diaristas
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.lote_pagamento_diaristas
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.lote_pagamento_itens
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.lancamentos_adicionais_diaristas
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

ALTER TABLE public.regras_fechamento
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

-- Tabelas auxiliares (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos_carga') THEN
    EXECUTE 'ALTER TABLE public.produtos_carga ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='resultados_processamento') THEN
    EXECUTE 'ALTER TABLE public.resultados_processamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='logs_sincronizacao') THEN
    EXECUTE 'ALTER TABLE public.logs_sincronizacao ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='coletores') THEN
    EXECUTE 'ALTER TABLE public.coletores ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cnab_geracoes') THEN
    EXECUTE 'ALTER TABLE public.cnab_geracoes ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ponto') THEN
    EXECUTE 'ALTER TABLE public.ponto ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id)';
  END IF;
END $$;

-- ============================================================
-- FASE 2: Popular tenant_id nos dados legados
--         Propaga via empresa_id → empresas.tenant_id
-- ============================================================

-- colaboradores
UPDATE public.colaboradores c
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  c.empresa_id = e.id
  AND  c.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- unidades
UPDATE public.unidades u
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  u.empresa_id = e.id
  AND  u.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- transportadoras_clientes
UPDATE public.transportadoras_clientes tc
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  tc.empresa_id = e.id
  AND  tc.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- fornecedores
UPDATE public.fornecedores f
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  f.empresa_id = e.id
  AND  f.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- fornecedor_valores_servico (via fornecedor)
UPDATE public.fornecedor_valores_servico fvs
SET    tenant_id = f.tenant_id
FROM   public.fornecedores f
WHERE  fvs.fornecedor_id = f.id
  AND  fvs.tenant_id IS NULL
  AND  f.tenant_id IS NOT NULL;

-- operacoes
UPDATE public.operacoes op
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  op.empresa_id = e.id
  AND  op.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- operacoes_producao
UPDATE public.operacoes_producao op
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  op.empresa_id = e.id
  AND  op.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- custos_extras_operacionais
UPDATE public.custos_extras_operacionais ceo
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  ceo.empresa_id = e.id
  AND  ceo.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- lancamentos_financeiros
UPDATE public.lancamentos_financeiros lf
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  lf.empresa_id = e.id
  AND  lf.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- regras_financeiras
UPDATE public.regras_financeiras rf
SET    tenant_id = e.tenant_id
FROM   public.empresas e
WHERE  rf.empresa_id = e.id
  AND  rf.tenant_id IS NULL
  AND  e.tenant_id IS NOT NULL;

-- ciclos_diaristas (via empresa_id se existir, senão usa primeiro tenant)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='ciclos_diaristas' AND column_name='empresa_id') THEN
    UPDATE public.ciclos_diaristas cd SET tenant_id = e.tenant_id
    FROM public.empresas e
    WHERE cd.empresa_id = e.id AND cd.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  END IF;
END $$;

-- lote_pagamento_diaristas (via empresa_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lote_pagamento_diaristas' AND column_name='empresa_id') THEN
    UPDATE public.lote_pagamento_diaristas l SET tenant_id = e.tenant_id
    FROM public.empresas e
    WHERE l.empresa_id = e.id AND l.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  END IF;
END $$;

-- lote_pagamento_itens (via lote)
UPDATE public.lote_pagamento_itens li
SET    tenant_id = l.tenant_id
FROM   public.lote_pagamento_diaristas l
WHERE  li.lote_id = l.id
  AND  li.tenant_id IS NULL
  AND  l.tenant_id IS NOT NULL;

-- lancamentos_adicionais_diaristas (via ciclo)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='lancamentos_adicionais_diaristas' AND column_name='ciclo_id') THEN
    UPDATE public.lancamentos_adicionais_diaristas lad SET tenant_id = cd.tenant_id
    FROM public.ciclos_diaristas cd
    WHERE lad.ciclo_id = cd.id AND lad.tenant_id IS NULL AND cd.tenant_id IS NOT NULL;
  END IF;
END $$;

-- regras_fechamento (empresa ou tenant direto)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='regras_fechamento' AND column_name='empresa_id') THEN
    UPDATE public.regras_fechamento rf SET tenant_id = e.tenant_id
    FROM public.empresas e
    WHERE rf.empresa_id = e.id AND rf.tenant_id IS NULL AND e.tenant_id IS NOT NULL;
  END IF;
END $$;

-- ============================================================
-- FASE 3: DROP de TODAS as policies históricas
-- ============================================================

-- empresas
DROP POLICY IF EXISTS "Leitura aberta para empresas"                            ON public.empresas;
DROP POLICY IF EXISTS "Acesso total autenticado para empresas"                  ON public.empresas;
DROP POLICY IF EXISTS "Users see only their tenant companies"                   ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_select"                                  ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_insert"                                  ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_update"                                  ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_delete"                                  ON public.empresas;
DROP POLICY IF EXISTS "empresas_tenant_all"                                     ON public.empresas;

-- colaboradores
DROP POLICY IF EXISTS "Acesso total autenticado para colaboradores"             ON public.colaboradores;
DROP POLICY IF EXISTS "Users can only see their tenant data"                    ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_select"                             ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_insert"                             ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_update"                             ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_delete"                             ON public.colaboradores;
DROP POLICY IF EXISTS "colaboradores_tenant_all"                                ON public.colaboradores;

-- unidades
DROP POLICY IF EXISTS "Acesso leitura autenticado unidades"                     ON public.unidades;
DROP POLICY IF EXISTS "Users can only see their tenant data"                    ON public.unidades;
DROP POLICY IF EXISTS "unidades_tenant_select"                                  ON public.unidades;
DROP POLICY IF EXISTS "unidades_tenant_insert"                                  ON public.unidades;
DROP POLICY IF EXISTS "unidades_tenant_update"                                  ON public.unidades;
DROP POLICY IF EXISTS "unidades_tenant_delete"                                  ON public.unidades;
DROP POLICY IF EXISTS "unidades_tenant_all"                                     ON public.unidades;

-- operacoes
DROP POLICY IF EXISTS "Acesso total autenticado para operacoes"                 ON public.operacoes;
DROP POLICY IF EXISTS "Users can only see their tenant data"                    ON public.operacoes;
DROP POLICY IF EXISTS "operacoes_tenant_select"                                 ON public.operacoes;
DROP POLICY IF EXISTS "operacoes_tenant_insert"                                 ON public.operacoes;
DROP POLICY IF EXISTS "operacoes_tenant_update"                                 ON public.operacoes;
DROP POLICY IF EXISTS "operacoes_tenant_delete"                                 ON public.operacoes;
DROP POLICY IF EXISTS "operacoes_tenant_all"                                    ON public.operacoes;

-- operacoes_producao
DROP POLICY IF EXISTS "Acesso leitura autenticado operacoes_producao"           ON public.operacoes_producao;
DROP POLICY IF EXISTS "Acesso insert autenticado operacoes_producao"            ON public.operacoes_producao;
DROP POLICY IF EXISTS "Acesso update autenticado operacoes_producao"            ON public.operacoes_producao;
DROP POLICY IF EXISTS "Users can only see their tenant data"                    ON public.operacoes_producao;
DROP POLICY IF EXISTS "op_tenant_select"                                        ON public.operacoes_producao;
DROP POLICY IF EXISTS "op_tenant_insert"                                        ON public.operacoes_producao;
DROP POLICY IF EXISTS "op_tenant_update"                                        ON public.operacoes_producao;
DROP POLICY IF EXISTS "op_tenant_delete"                                        ON public.operacoes_producao;
DROP POLICY IF EXISTS "operacoes_producao_tenant_all"                           ON public.operacoes_producao;

-- custos_extras_operacionais
DROP POLICY IF EXISTS "Acesso leitura autenticado custos_extras_operacionais"   ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "Acesso update autenticado custos_extras_operacionais"    ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "Acesso delete autenticado custos_extras_operacionais"    ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "Users can only see their tenant data"                    ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "ceo_tenant_select"                                       ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "ceo_tenant_insert"                                       ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "ceo_tenant_update"                                       ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "ceo_tenant_delete"                                       ON public.custos_extras_operacionais;
DROP POLICY IF EXISTS "custos_extras_tenant_all"                                ON public.custos_extras_operacionais;

-- lancamentos_financeiros
DROP POLICY IF EXISTS "Lancamentos Financeiros Select"                          ON public.lancamentos_financeiros;
DROP POLICY IF EXISTS "Lancamentos Financeiros Update"                          ON public.lancamentos_financeiros;
DROP POLICY IF EXISTS "lancamentos_financeiros_tenant_all"                      ON public.lancamentos_financeiros;

-- transportadoras_clientes
DROP POLICY IF EXISTS "Acesso leitura autenticado transportadoras_clientes"     ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "Allow delete transportadoras_clientes"                   ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "Allow update transportadoras_clientes"                   ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_select"                              ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_insert"                              ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_update"                              ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_isolation_delete"                              ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_select"                                        ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_insert"                                        ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_update"                                        ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "tc_tenant_delete"                                        ON public.transportadoras_clientes;
DROP POLICY IF EXISTS "transportadoras_tenant_all"                              ON public.transportadoras_clientes;

-- fornecedores
DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedores"                 ON public.fornecedores;
DROP POLICY IF EXISTS "Allow delete fornecedores"                               ON public.fornecedores;
DROP POLICY IF EXISTS "Allow update fornecedores"                               ON public.fornecedores;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedores"             ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_select"                      ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_insert"                      ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_update"                      ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_isolation_delete"                      ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_select"                                ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_insert"                                ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_update"                                ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedor_tenant_delete"                                ON public.fornecedores;
DROP POLICY IF EXISTS "fornecedores_tenant_all"                                 ON public.fornecedores;

-- fornecedor_valores_servico
DROP POLICY IF EXISTS "Acesso leitura autenticado fornecedor_valores_servico"   ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso insert Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "Acesso update Admin Financeiro fornecedor_valores_servico" ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_select"                             ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_insert"                             ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_update"                             ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_isolation_delete"                             ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_select"                                       ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_insert"                                       ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_update"                                       ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fvs_tenant_delete"                                       ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "rf_tenant_isolation"                                     ON public.fornecedor_valores_servico;
DROP POLICY IF EXISTS "fornecedor_valores_tenant_all"                           ON public.fornecedor_valores_servico;

-- produtos_carga
DROP POLICY IF EXISTS "Acesso leitura autenticado produtos_carga"               ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_select"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_insert"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_update"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_delete"                            ON public.produtos_carga;
DROP POLICY IF EXISTS "produtos_carga_tenant_all"                               ON public.produtos_carga;

-- production_entry_collaborators
DROP POLICY IF EXISTS "Acesso leitura autenticado production_entry_collaborators" ON public.production_entry_collaborators;
DROP POLICY IF EXISTS "pec_tenant_all"                                          ON public.production_entry_collaborators;

-- ciclos_diaristas
DROP POLICY IF EXISTS "Full access ciclos_diaristas"                            ON public.ciclos_diaristas;
DROP POLICY IF EXISTS "ciclos_tenant_all"                                       ON public.ciclos_diaristas;

-- lote_pagamento_diaristas
DROP POLICY IF EXISTS "Full access lote_pagamento_diaristas"                    ON public.lote_pagamento_diaristas;
DROP POLICY IF EXISTS "lotes_tenant_all"                                        ON public.lote_pagamento_diaristas;

-- lote_pagamento_itens
DROP POLICY IF EXISTS "Full access lote_pagamento_itens"                        ON public.lote_pagamento_itens;
DROP POLICY IF EXISTS "lote_itens_tenant_all"                                   ON public.lote_pagamento_itens;

-- lancamentos_adicionais_diaristas
DROP POLICY IF EXISTS "Full access lancamentos_adicionais_diaristas"            ON public.lancamentos_adicionais_diaristas;
DROP POLICY IF EXISTS "lancamentos_ad_tenant_all"                               ON public.lancamentos_adicionais_diaristas;

-- regras_fechamento
DROP POLICY IF EXISTS "Full access regras_fechamento"                           ON public.regras_fechamento;
DROP POLICY IF EXISTS "regras_fech_tenant_all"                                  ON public.regras_fechamento;

-- regras_financeiras
DROP POLICY IF EXISTS "regras_financeiras_all_authenticated"                    ON public.regras_financeiras;
DROP POLICY IF EXISTS "rf_tenant_isolation"                                     ON public.regras_financeiras;
DROP POLICY IF EXISTS "rf_tenant_all"                                           ON public.regras_financeiras;

-- resultados_processamento
DROP POLICY IF EXISTS "resultados_tenant_all"                                   ON public.resultados_processamento;

-- logs_sincronizacao
DROP POLICY IF EXISTS "logs_sinc_tenant_all"                                    ON public.logs_sincronizacao;

-- coletores
DROP POLICY IF EXISTS "coletores_tenant_all"                                    ON public.coletores;

-- profiles
DROP POLICY IF EXISTS "profiles_own_select"                                     ON public.profiles;
DROP POLICY IF EXISTS "profiles_own_update"                                     ON public.profiles;
DROP POLICY IF EXISTS "Read access for authenticated"                           ON public.profiles;

-- tenants
DROP POLICY IF EXISTS "Tenants visíveis para membros"                           ON public.tenants;
DROP POLICY IF EXISTS "tenants_own_select"                                      ON public.tenants;

-- catálogos globais
DROP POLICY IF EXISTS "Allow authenticated read on config_tipos_operacao"       ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "config_tipos_op_read"                                    ON public.config_tipos_operacao;
DROP POLICY IF EXISTS "Allow authenticated read on config_produtos"             ON public.config_produtos;
DROP POLICY IF EXISTS "config_produtos_read"                                    ON public.config_produtos;
DROP POLICY IF EXISTS "Allow authenticated read on config_tipos_dia"            ON public.config_tipos_dia;
DROP POLICY IF EXISTS "config_tipos_dia_read"                                   ON public.config_tipos_dia;
DROP POLICY IF EXISTS "Allow delete tipos_servico_operacional"                  ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Allow update tipos_servico_operacional"                  ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado tipos_servico_operacional"    ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tso_tenant_isolation"                                    ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "tso_authenticated_access"                                ON public.tipos_servico_operacional;
DROP POLICY IF EXISTS "fpo_tenant_isolation"                                    ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "Acesso leitura autenticado formas_pagamento_operacional" ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "fpo_authenticated_access"                                ON public.formas_pagamento_operacional;
DROP POLICY IF EXISTS "Allow read access to authenticated users"                ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow insert access to authenticated users"              ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow update access to authenticated users"              ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users"              ON public.regras_modulos;
DROP POLICY IF EXISTS "regras_modulos_authenticated"                            ON public.regras_modulos;
DROP POLICY IF EXISTS "Allow read access to authenticated users"                ON public.regras_campos;
DROP POLICY IF EXISTS "Allow update access to authenticated users"              ON public.regras_campos;
DROP POLICY IF EXISTS "Allow delete access to authenticated users"              ON public.regras_campos;
DROP POLICY IF EXISTS "regras_campos_authenticated"                             ON public.regras_campos;
DROP POLICY IF EXISTS "Allow read access to authenticated users"                ON public.regras_dados;
DROP POLICY IF EXISTS "Allow update access to authenticated users"              ON public.regras_dados;
DROP POLICY IF EXISTS "Allow delete access to authenticated users"              ON public.regras_dados;
DROP POLICY IF EXISTS "regras_dados_authenticated"                              ON public.regras_dados;

-- ============================================================
-- FASE 4: ENABLE RLS + CREATE POLICY — uma por tabela
-- ============================================================

-- 1. empresas
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresas_tenant_all" ON public.empresas
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 2. colaboradores
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "colaboradores_tenant_all" ON public.colaboradores
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 3. unidades
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unidades_tenant_all" ON public.unidades
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 4. operacoes
ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operacoes_tenant_all" ON public.operacoes
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 5. operacoes_producao
ALTER TABLE public.operacoes_producao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operacoes_producao_tenant_all" ON public.operacoes_producao
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 6. custos_extras_operacionais
ALTER TABLE public.custos_extras_operacionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custos_extras_tenant_all" ON public.custos_extras_operacionais
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 7. lancamentos_financeiros
ALTER TABLE public.lancamentos_financeiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_financeiros_tenant_all" ON public.lancamentos_financeiros
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 8. transportadoras_clientes
ALTER TABLE public.transportadoras_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transportadoras_tenant_all" ON public.transportadoras_clientes
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 9. fornecedores
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedores_tenant_all" ON public.fornecedores
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 10. fornecedor_valores_servico
ALTER TABLE public.fornecedor_valores_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fornecedor_valores_tenant_all" ON public.fornecedor_valores_servico
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 11. produtos_carga (condicional — tabela pode não existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='produtos_carga') THEN
    EXECUTE 'ALTER TABLE public.produtos_carga ENABLE ROW LEVEL SECURITY';
    EXECUTE '
      CREATE POLICY "produtos_carga_tenant_all" ON public.produtos_carga
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
  END IF;
END $$;

-- 12. production_entry_collaborators
--     Não tem tenant_id próprio: isola via operacoes_producao
ALTER TABLE public.production_entry_collaborators ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pec_tenant_all" ON public.production_entry_collaborators
  FOR ALL TO authenticated
  USING (
    entry_id IN (
      SELECT id FROM public.operacoes_producao
      WHERE tenant_id = public.current_tenant_id()
    )
  )
  WITH CHECK (
    entry_id IN (
      SELECT id FROM public.operacoes_producao
      WHERE tenant_id = public.current_tenant_id()
    )
  );

-- 13. ciclos_diaristas
ALTER TABLE public.ciclos_diaristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ciclos_tenant_all" ON public.ciclos_diaristas
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 14. lote_pagamento_diaristas
ALTER TABLE public.lote_pagamento_diaristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lotes_tenant_all" ON public.lote_pagamento_diaristas
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 15. lote_pagamento_itens
ALTER TABLE public.lote_pagamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lote_itens_tenant_all" ON public.lote_pagamento_itens
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 16. lancamentos_adicionais_diaristas
ALTER TABLE public.lancamentos_adicionais_diaristas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lancamentos_ad_tenant_all" ON public.lancamentos_adicionais_diaristas
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 17. regras_fechamento
ALTER TABLE public.regras_fechamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras_fech_tenant_all" ON public.regras_fechamento
  FOR ALL TO authenticated
  USING  (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

-- 18. regras_financeiras (permite NULL para regras globais de sistema)
ALTER TABLE public.regras_financeiras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rf_tenant_all" ON public.regras_financeiras
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
  WITH CHECK (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);

-- 19-21. Tabelas auxiliares (condicionais)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='resultados_processamento') THEN
    EXECUTE 'ALTER TABLE public.resultados_processamento ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "resultados_tenant_all" ON public.resultados_processamento';
    EXECUTE '
      CREATE POLICY "resultados_tenant_all" ON public.resultados_processamento
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='logs_sincronizacao') THEN
    EXECUTE 'ALTER TABLE public.logs_sincronizacao ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "logs_sinc_tenant_all" ON public.logs_sincronizacao';
    EXECUTE '
      CREATE POLICY "logs_sinc_tenant_all" ON public.logs_sincronizacao
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='coletores') THEN
    EXECUTE 'ALTER TABLE public.coletores ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "coletores_tenant_all" ON public.coletores';
    EXECUTE '
      CREATE POLICY "coletores_tenant_all" ON public.coletores
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='cnab_geracoes') THEN
    EXECUTE 'ALTER TABLE public.cnab_geracoes ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "cnab_tenant_all" ON public.cnab_geracoes';
    EXECUTE '
      CREATE POLICY "cnab_tenant_all" ON public.cnab_geracoes
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='ponto' AND column_name='tenant_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.ponto ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "ponto_tenant_all" ON public.ponto';
    EXECUTE '
      CREATE POLICY "ponto_tenant_all" ON public.ponto
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tipos_regra_operacional') THEN
    EXECUTE 'ALTER TABLE public.tipos_regra_operacional ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "tipos_regra_operacional_select" ON public.tipos_regra_operacional';
    EXECUTE 'CREATE POLICY "tipos_regra_operacional_select" ON public.tipos_regra_operacional FOR ALL TO authenticated USING (true)';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='tenant_invitations') THEN
    EXECUTE 'ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "invitations_tenant_all" ON public.tenant_invitations';
    EXECUTE '
      CREATE POLICY "invitations_tenant_all" ON public.tenant_invitations
        FOR ALL TO authenticated
        USING  (tenant_id = public.current_tenant_id())
        WITH CHECK (tenant_id = public.current_tenant_id())
    ';

    -- Permitir que usuário não autenticado acesse seu token de convite
    EXECUTE 'DROP POLICY IF EXISTS "invitations_public_read" ON public.tenant_invitations';
    EXECUTE '
      CREATE POLICY "invitations_public_read" ON public.tenant_invitations
        FOR SELECT TO anon
        USING (expires_at > NOW() AND accepted_at IS NULL)
    ';
  END IF;
END $$;

-- ============================================================
-- FASE 5: CATÁLOGOS GLOBAIS (sem isolamento por tenant)
-- ============================================================

ALTER TABLE public.config_tipos_operacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_tipos_op_read" ON public.config_tipos_operacao
  FOR ALL TO authenticated USING (true);

ALTER TABLE public.config_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_produtos_read" ON public.config_produtos
  FOR ALL TO authenticated USING (true);

ALTER TABLE public.config_tipos_dia ENABLE ROW LEVEL SECURITY;
CREATE POLICY "config_tipos_dia_read" ON public.config_tipos_dia
  FOR ALL TO authenticated USING (true);

ALTER TABLE public.tipos_servico_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tso_authenticated_access" ON public.tipos_servico_operacional
  FOR ALL TO authenticated USING (true);

ALTER TABLE public.formas_pagamento_operacional ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fpo_authenticated_access" ON public.formas_pagamento_operacional
  FOR ALL TO authenticated USING (true);

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
-- FASE 6: PROFILES e TENANTS
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own_select" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "profiles_own_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants_own_select" ON public.tenants
  FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

-- ============================================================
-- FASE 7: ÍNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id              ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id            ON public.profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_empresas_tenant_id            ON public.empresas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_tenant_id       ON public.colaboradores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_unidades_tenant_id            ON public.unidades(tenant_id);
CREATE INDEX IF NOT EXISTS idx_operacoes_tenant_id           ON public.operacoes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_op_producao_tenant_id         ON public.operacoes_producao(tenant_id);
CREATE INDEX IF NOT EXISTS idx_custos_extras_tenant_id       ON public.custos_extras_operacionais(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_fin_tenant_id     ON public.lancamentos_financeiros(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transportadoras_tenant_id     ON public.transportadoras_clientes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fornecedores_tenant_id        ON public.fornecedores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fvs_tenant_id                 ON public.fornecedor_valores_servico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ciclos_diaristas_tenant_id    ON public.ciclos_diaristas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lotes_diaristas_tenant_id     ON public.lote_pagamento_diaristas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lote_itens_tenant_id          ON public.lote_pagamento_itens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lanc_ad_diaristas_tenant_id   ON public.lancamentos_adicionais_diaristas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regras_fechamento_tenant_id   ON public.regras_fechamento(tenant_id);
CREATE INDEX IF NOT EXISTS idx_regras_financeiras_tenant_id  ON public.regras_financeiras(tenant_id) WHERE tenant_id IS NOT NULL;

-- ============================================================
-- VERIFICAÇÃO FINAL
-- Execute este SELECT após aplicar para confirmar isolamento
-- ESPERADO: toda tabela operacional deve ter qual contendo
--           "current_tenant_id()" — NUNCA apenas "true"
-- ============================================================

SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'empresas', 'colaboradores', 'unidades',
    'operacoes', 'operacoes_producao', 'custos_extras_operacionais',
    'lancamentos_financeiros', 'transportadoras_clientes',
    'fornecedores', 'fornecedor_valores_servico',
    'ciclos_diaristas', 'lote_pagamento_diaristas', 'lote_pagamento_itens',
    'lancamentos_adicionais_diaristas', 'regras_fechamento', 'regras_financeiras'
  )
ORDER BY tablename, policyname;
