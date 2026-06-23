-- Migration: Strict RLS Tenant Isolation (Sprint 1)
-- OVERRIDE all `USING (true)` bypasses with an impenetrable AND condition ensuring tenant encapsulation.

DO $$
DECLARE
    target_tables text[] := ARRAY[
        'empresas', 'colaboradores', 'contratos', 'unidades', 'fornecedores', 
        'transportadoras', 'operacoes_producao', 'servicos_extras_operacionais', 
        'custos_extras', 'lancamentos_diaristas', 'diaristas_lotes_fechamento', 
        'lancamentos_intermitentes', 'financeiro_competencias', 
        'financeiro_consolidados_cliente', 'financeiro_consolidados_colaborador', 
        'financeiro_lotes', 'remessas_cnab', 'retornos_bancarios'
    ];
    t_name text;
    pol_name text;
BEGIN
    FOR t_name IN SELECT unnest(target_tables)
    LOOP
        -- Check if table exists AND has tenant_id column
        IF EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = t_name 
              AND column_name = 'tenant_id'
        ) THEN
            pol_name := 'restrictive_tenant_isolation_' || t_name;
            
            -- Drop if it already existed to make migration idempotent
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol_name, t_name);
            
            -- Create the AS RESTRICTIVE policy
            -- This acts as a global AND on all permissive policies. Even if a permissive policy says USING(true), 
            -- this forces the row's tenant_id to match the user's current valid tenant_id.
            EXECUTE format('
                CREATE POLICY %I ON public.%I
                AS RESTRICTIVE FOR ALL
                TO authenticated
                USING (tenant_id = public.current_tenant_id())
                WITH CHECK (tenant_id = public.current_tenant_id());
            ', pol_name, t_name);
        END IF;
    END LOOP;
END $$;
