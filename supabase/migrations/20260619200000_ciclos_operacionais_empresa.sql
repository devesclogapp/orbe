-- Migration: Add empresa_id to ciclos_operacionais

alter table public.ciclos_operacionais
add column if not exists empresa_id uuid references public.empresas(id);

-- Check se existe risco com constraint unica, dropar se existir e recriar com empresa_id para permitir as duas empresas
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'unq_ciclo_tenant_compet_sem' AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.ciclos_operacionais DROP CONSTRAINT IF EXISTS unq_ciclo_tenant_compet_sem;
    DROP INDEX IF EXISTS public.unq_ciclo_tenant_compet_sem;
    CREATE UNIQUE INDEX unq_ciclo_tenant_compet_sem_empresa ON public.ciclos_operacionais (tenant_id, empresa_id, competencia, semana_operacional) NULLS NOT DISTINCT;
  END IF;
END $$;
