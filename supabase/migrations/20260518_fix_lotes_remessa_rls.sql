
-- Fix RLS lotes_remessa
ALTER TABLE public.lotes_remessa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lotes_remessa_tenant_all" ON public.lotes_remessa;
CREATE POLICY "lotes_remessa_tenant_all"
ON public.lotes_remessa
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_lotes_remessa ON public.lotes_remessa;
CREATE TRIGGER trg_auto_tenant_lotes_remessa
  BEFORE INSERT ON public.lotes_remessa
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

NOTIFY pgrst, 'reload schema';

