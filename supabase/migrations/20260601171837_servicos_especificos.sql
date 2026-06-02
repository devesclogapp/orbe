-- Migração para Criação das Tabelas de Serviços Específicos

-- ==================================================
-- 1. TABELA PARAMÉTRICA (REGRAS DE SERVIÇOS ESPECÍFICOS)
-- ==================================================
CREATE TABLE IF NOT EXISTS public.servicos_especificos_regras (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    codigo text NOT NULL,
    descricao text NOT NULL,
    periodo text, -- N1, N2, DIA, INTEGRAL, etc.
    quantidade_colaboradores integer NOT NULL DEFAULT 1,
    valor_padrao numeric NOT NULL DEFAULT 0.00,
    empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
    tenant_id uuid NOT NULL DEFAULT auth.uid(),
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    unique(codigo, periodo, empresa_id)
);

ALTER TABLE public.servicos_especificos_regras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable Read access for all users of the tenant" ON public.servicos_especificos_regras;
CREATE POLICY "Enable Read access for all users of the tenant"
    ON public.servicos_especificos_regras FOR SELECT
    USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Enable Update access for all users of the tenant" ON public.servicos_especificos_regras;
CREATE POLICY "Enable Update access for all users of the tenant"
    ON public.servicos_especificos_regras FOR UPDATE
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Enable Insert access for all users of the tenant" ON public.servicos_especificos_regras;
CREATE POLICY "Enable Insert access for all users of the tenant"
    ON public.servicos_especificos_regras FOR INSERT
    WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Enable Delete access for all users of the tenant" ON public.servicos_especificos_regras;
CREATE POLICY "Enable Delete access for all users of the tenant"
    ON public.servicos_especificos_regras FOR DELETE
    USING (tenant_id = auth.uid());

-- ==================================================
-- 2. TABELA DE LANÇAMENTOS (SERVIÇOS EXECUTADOS)
-- ==================================================
CREATE TABLE IF NOT EXISTS public.servicos_especificos_lancamentos (
    id uuid NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
    regra_id uuid REFERENCES public.servicos_especificos_regras(id) ON DELETE RESTRICT,
    empresa_id uuid REFERENCES public.empresas(id) ON DELETE RESTRICT,
    unidade_id uuid REFERENCES public.unidades(id) ON DELETE SET NULL,
    data_operacao date NOT NULL DEFAULT CURRENT_DATE,
    quantidade integer NOT NULL DEFAULT 1,
    valor_unitario numeric NOT NULL DEFAULT 0.00,
    valor_total numeric NOT NULL DEFAULT 0.00,
    
    colaboradores_vinculados jsonb DEFAULT '[]'::jsonb,
    
    observacao text,
    forma_pagamento_id uuid REFERENCES public.formas_pagamento_operacional(id) ON DELETE SET NULL,
    
    encarregado_nome text,
    status text NOT NULL DEFAULT 'RECEBIDO', -- RECEBIDO, CONCLUIDO, CANCELADO
    tenant_id uuid NOT NULL DEFAULT auth.uid(),
    usuario_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.servicos_especificos_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable Read access for all users of the tenant" ON public.servicos_especificos_lancamentos;
CREATE POLICY "Enable Read access for all users of the tenant"
    ON public.servicos_especificos_lancamentos FOR SELECT
    USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Enable Insert access for all users of the tenant" ON public.servicos_especificos_lancamentos;
CREATE POLICY "Enable Insert access for all users of the tenant"
    ON public.servicos_especificos_lancamentos FOR INSERT
    WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Enable Update access for all users of the tenant" ON public.servicos_especificos_lancamentos;
CREATE POLICY "Enable Update access for all users of the tenant"
    ON public.servicos_especificos_lancamentos FOR UPDATE
    USING (tenant_id = auth.uid())
    WITH CHECK (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Enable Delete access for all users of the tenant" ON public.servicos_especificos_lancamentos;
CREATE POLICY "Enable Delete access for all users of the tenant"
    ON public.servicos_especificos_lancamentos FOR DELETE
    USING (tenant_id = auth.uid());
