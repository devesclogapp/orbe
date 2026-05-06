-- ============================================================
-- FIX: Trigger auto-preenchimento tenant_id em fornecedor_valores_servico
-- Problema: Inserções falham por RLS ao não ter tenant_id
-- Solução: Trigger que seta tenant_id automaticamente se NULL
-- ============================================================

-- Verificar se a função já existe
DROP TRIGGER IF EXISTS set_tenant_id_on_insert_fvs ON public.fornecedor_valores_servico;

-- Criar função de trigger
CREATE OR REPLACE FUNCTION public.set_tenant_id_fornecedor_valores_servico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL OR NEW.tenant_id = '' THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
CREATE TRIGGER set_tenant_id_on_insert_fvs
  BEFORE INSERT ON public.fornecedor_valores_servico
  FOR EACH ROW
  EXECUTE FUNCTION public.set_tenant_id_fornecedor_valores_servico();

-- Verificar
DO $$
BEGIN
  RAISE NOTICE 'Trigger set_tenant_id_on_insert_fvs criado para fornecedor_valores_servico';
END $$;