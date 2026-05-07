-- Migration: Create ciclos_operacionais and update records
CREATE TABLE IF NOT EXISTS public.ciclos_operacionais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    competencia VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    semana_operacional INTEGER NOT NULL,
    data_inicio DATE NOT NULL,
    data_fim DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'processando', 'validacao', 'fechado', 'enviado_financeiro')),
    total_registros INTEGER DEFAULT 0,
    total_processados INTEGER DEFAULT 0,
    total_inconsistencias INTEGER DEFAULT 0,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fechado_em TIMESTAMP WITH TIME ZONE,
    fechado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_ciclos_operacionais_tenant_id ON public.ciclos_operacionais(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ciclos_operacionais_competencia ON public.ciclos_operacionais(competencia);
CREATE UNIQUE INDEX IF NOT EXISTS unq_ciclo_tenant_compet_sem ON public.ciclos_operacionais(tenant_id, competencia, semana_operacional);

-- Update registros_ponto to link to cycle
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS ciclo_id UUID REFERENCES public.ciclos_operacionais(id) ON DELETE SET NULL;
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS competencia VARCHAR(7);
ALTER TABLE public.registros_ponto ADD COLUMN IF NOT EXISTS semana_operacional INTEGER;

-- Enable RLS and Policies for ciclos_operacionais
ALTER TABLE public.ciclos_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable ALL for users based on tenant_id" ON public.ciclos_operacionais
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
