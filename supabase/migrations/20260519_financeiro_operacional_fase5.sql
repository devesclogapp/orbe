-- Migration Fase 5: Consolidacao Financeira Operacional
-- Tabelas base para rastrear a memoria de calculo e fechar a faturacao

-- 1. Cria a tabela de Memoria de Calculo, caso nao exista
CREATE TABLE IF NOT EXISTS public.financeiro_calculos_memoria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    operacao_id UUID, -- Relacionamento flexivel com operacoes_producao ou operacoes
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    competencia VARCHAR(7) NOT NULL, -- Ex: "2026-05"
    tipo_calculo VARCHAR(50) NOT NULL, -- 'FATURAMENTO', 'PAGAMENTO'
    valor_base NUMERIC(15,2) DEFAULT 0,
    valor_final NUMERIC(15,2) DEFAULT 0,
    memoria_detalhada JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- RLS Para Memoria
ALTER TABLE public.financeiro_calculos_memoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_financeiro_calculos_memoria" ON public.financeiro_calculos_memoria;
CREATE POLICY "tenant_isolation_financeiro_calculos_memoria" ON public.financeiro_calculos_memoria
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY IF EXISTS "financeiro_calculos_memoria_crud_policy" ON public.financeiro_calculos_memoria;
CREATE POLICY "financeiro_calculos_memoria_crud_policy" ON public.financeiro_calculos_memoria
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios pu
            WHERE pu.user_id = auth.uid() 
            AND pu.tenant_id = financeiro_calculos_memoria.tenant_id
        )
    );

-- 2. Garantir existências nas tabelas de consolidados
CREATE TABLE IF NOT EXISTS public.financeiro_consolidados_cliente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    competencia VARCHAR(7) NOT NULL,
    valor_base NUMERIC(15,2) DEFAULT 0,
    valor_regras NUMERIC(15,2) DEFAULT 0,
    valor_total NUMERIC(15,2) DEFAULT 0,
    quantidade_operacoes INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.financeiro_consolidados_cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_financeiro_consolidados_cliente" ON public.financeiro_consolidados_cliente;
CREATE POLICY "tenant_isolation_financeiro_consolidados_cliente" ON public.financeiro_consolidados_cliente
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY IF EXISTS "financeiro_consolidados_cliente_crud_policy" ON public.financeiro_consolidados_cliente;
CREATE POLICY "financeiro_consolidados_cliente_crud_policy" ON public.financeiro_consolidados_cliente
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios pu
            WHERE pu.user_id = auth.uid() 
            AND pu.tenant_id = financeiro_consolidados_cliente.tenant_id
        )
    );

CREATE TABLE IF NOT EXISTS public.financeiro_consolidados_colaborador (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE CASCADE,
    competencia VARCHAR(7) NOT NULL,
    valor_total NUMERIC(15,2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pendente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.financeiro_consolidados_colaborador ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_financeiro_consolidados_colaborador" ON public.financeiro_consolidados_colaborador;
CREATE POLICY "tenant_isolation_financeiro_consolidados_colaborador" ON public.financeiro_consolidados_colaborador
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY IF EXISTS "financeiro_consolidados_colaborador_crud_policy" ON public.financeiro_consolidados_colaborador;
CREATE POLICY "financeiro_consolidados_colaborador_crud_policy" ON public.financeiro_consolidados_colaborador
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios pu
            WHERE pu.user_id = auth.uid() 
            AND pu.tenant_id = financeiro_consolidados_colaborador.tenant_id
        )
    );

-- 3. Garantir a tabela de faturas
CREATE TABLE IF NOT EXISTS public.faturas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    lote_remessa_id UUID, -- Chave estrangeira deixada leve caso precise apontar p/ table lotes_remessa 
    competencia VARCHAR(7) NOT NULL,
    valor NUMERIC(15,2) NOT NULL DEFAULT 0,
    vencimento DATE,
    nosso_numero VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pendente',
    motivo_rejeicao TEXT,
    data_pagamento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.faturas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_faturas" ON public.faturas;
CREATE POLICY "tenant_isolation_faturas" ON public.faturas
    AS RESTRICTIVE FOR ALL
    USING (tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::uuid));

DROP POLICY IF EXISTS "faturas_crud_policy" ON public.faturas;
CREATE POLICY "faturas_crud_policy" ON public.faturas
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.perfis_usuarios pu
            WHERE pu.user_id = auth.uid() 
            AND pu.tenant_id = faturas.tenant_id
        )
    );
