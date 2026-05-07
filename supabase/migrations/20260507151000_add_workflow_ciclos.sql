-- Migration: Add workflow fields to ciclos_operacionais and create auditoria_workflow_ciclos

-- 1. Add workflow statuses to ciclos_operacionais
ALTER TABLE public.ciclos_operacionais 
ADD COLUMN IF NOT EXISTS status_rh VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status_rh IN ('pendente', 'validado_rh', 'rejeitado_rh')),
ADD COLUMN IF NOT EXISTS status_financeiro VARCHAR(50) NOT NULL DEFAULT 'pendente' CHECK (status_financeiro IN ('pendente', 'validado_financeiro', 'rejeitado_financeiro')),
ADD COLUMN IF NOT EXISTS status_remessa VARCHAR(50) NOT NULL DEFAULT 'nao_gerada' CHECK (status_remessa IN ('nao_gerada', 'pronta', 'remetida', 'retornada')),
ADD COLUMN IF NOT EXISTS valor_operacional NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_faturavel NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_folha NUMERIC(15,2) DEFAULT 0;

-- 2. Create auditoria_workflow_ciclos
CREATE TABLE IF NOT EXISTS public.auditoria_workflow_ciclos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ciclo_id UUID NOT NULL REFERENCES public.ciclos_operacionais(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    etapa VARCHAR(50) NOT NULL CHECK (etapa IN ('OPERACIONAL', 'RH', 'FINANCEIRO', 'REMESSA')),
    acao VARCHAR(50) NOT NULL CHECK (acao IN ('APROVAR', 'REJEITAR', 'REABRIR', 'GERAR')),
    observacao TEXT,
    criado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for the new table
CREATE INDEX IF NOT EXISTS idx_auditoria_workflow_tenant ON public.auditoria_workflow_ciclos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_workflow_ciclo ON public.auditoria_workflow_ciclos(ciclo_id);

-- Enable RLS
ALTER TABLE public.auditoria_workflow_ciclos ENABLE ROW LEVEL SECURITY;

-- Policies for auditoria
CREATE POLICY "Enable ALL for users based on tenant_id" ON public.auditoria_workflow_ciclos
    FOR ALL
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());
