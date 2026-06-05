
-- Migration: Fix regras_modulos to support global modules for system features
-- Date: 2026-06-05

-- 1. Move existing system modules to global scope (tenant_id = NULL)
-- This ensures they are visible to all tenants and don't conflict with global unique constraint on slug.
UPDATE public.regras_modulos 
SET tenant_id = NULL 
WHERE slug IN ('meios_pagamento', 'meios-pagamento', 'taxas_impostos', 'taxas-impostos');

-- 2. Update RLS policies to allow reading and creating global modules (tenant_id IS NULL)
DO $$
BEGIN
    -- DROP existing policy
    DROP POLICY IF EXISTS "regras_modulos_tenant_all" ON public.regras_modulos;
    
    -- CREATE updated policy that allows tenant_id IS NULL in both USING and WITH CHECK
    CREATE POLICY "regras_modulos_tenant_all" ON public.regras_modulos
        FOR ALL TO authenticated
        USING (tenant_id = public.current_tenant_id() OR tenant_id IS NULL)
        WITH CHECK (tenant_id = public.current_tenant_id() OR tenant_id IS NULL);
        
    RAISE NOTICE 'regras_modulos: RLS policy updated to support global modules.';
END $$;
