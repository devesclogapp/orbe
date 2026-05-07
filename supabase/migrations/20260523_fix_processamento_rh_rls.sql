-- Corrige RLS das tabelas do módulo Processamento RH

ALTER TABLE public.processamento_rh_inconsistencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processamento_rh_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fechamento_mensal ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "processamento_rh_inconsistencias_tenant_all" ON public.processamento_rh_inconsistencias;
CREATE POLICY "processamento_rh_inconsistencias_tenant_all"
ON public.processamento_rh_inconsistencias
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "processamento_rh_logs_tenant_all" ON public.processamento_rh_logs;
CREATE POLICY "processamento_rh_logs_tenant_all"
ON public.processamento_rh_logs
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP POLICY IF EXISTS "fechamento_mensal_tenant_all" ON public.fechamento_mensal;
CREATE POLICY "fechamento_mensal_tenant_all"
ON public.fechamento_mensal
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_processamento_rh_inconsistencias ON public.processamento_rh_inconsistencias;
CREATE TRIGGER trg_auto_tenant_processamento_rh_inconsistencias
  BEFORE INSERT ON public.processamento_rh_inconsistencias
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_processamento_rh_logs ON public.processamento_rh_logs;
CREATE TRIGGER trg_auto_tenant_processamento_rh_logs
  BEFORE INSERT ON public.processamento_rh_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

DROP TRIGGER IF EXISTS trg_auto_tenant_fechamento_mensal ON public.fechamento_mensal;
CREATE TRIGGER trg_auto_tenant_fechamento_mensal
  BEFORE INSERT ON public.fechamento_mensal
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

CREATE INDEX IF NOT EXISTS idx_processamento_rh_logs_tenant_id
  ON public.processamento_rh_logs (tenant_id);

CREATE INDEX IF NOT EXISTS idx_fechamento_mensal_tenant_colaborador
  ON public.fechamento_mensal (tenant_id, colaborador_id);

NOTIFY pgrst, 'reload schema';
