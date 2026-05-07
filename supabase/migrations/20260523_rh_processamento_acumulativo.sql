-- Motor de Processamento RH diário e acumulativo

CREATE TABLE IF NOT EXISTS public.banco_horas_saldos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  empresa_id UUID REFERENCES public.empresas(id),
  colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
  saldo_atual_minutos INTEGER NOT NULL DEFAULT 0,
  horas_positivas_minutos INTEGER NOT NULL DEFAULT 0,
  horas_negativas_minutos INTEGER NOT NULL DEFAULT 0,
  ultima_atualizacao TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, colaborador_id)
);

CREATE INDEX IF NOT EXISTS idx_banco_horas_saldos_tenant ON public.banco_horas_saldos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_banco_horas_saldos_empresa ON public.banco_horas_saldos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_banco_horas_saldos_colaborador ON public.banco_horas_saldos(colaborador_id);

ALTER TABLE public.banco_horas_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bh_saldos_tenant_all" ON public.banco_horas_saldos;
CREATE POLICY "bh_saldos_tenant_all" ON public.banco_horas_saldos
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id())
  WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_auto_tenant_bh_saldos ON public.banco_horas_saldos;
CREATE TRIGGER trg_auto_tenant_bh_saldos
  BEFORE INSERT ON public.banco_horas_saldos
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS saldo_acumulado_minutos INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.processamento_rh_logs
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id),
  ADD COLUMN IF NOT EXISTS duracao_ms INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bh_eventos_proc_registro
  ON public.banco_horas_eventos(registro_ponto_id, origem)
  WHERE registro_ponto_id IS NOT NULL AND origem = 'processamento_rh';

CREATE UNIQUE INDEX IF NOT EXISTS idx_fechamento_mensal_periodo_colaborador
  ON public.fechamento_mensal(tenant_id, colaborador_id, mes, ano);

INSERT INTO public.banco_horas_saldos (
  tenant_id,
  empresa_id,
  colaborador_id,
  saldo_atual_minutos,
  horas_positivas_minutos,
  horas_negativas_minutos,
  ultima_atualizacao
)
SELECT
  bhe.tenant_id,
  (ARRAY_AGG(bhe.empresa_id) FILTER (WHERE bhe.empresa_id IS NOT NULL))[1] AS empresa_id,
  bhe.colaborador_id,
  COALESCE(SUM(bhe.quantidade_minutos), 0) AS saldo_atual_minutos,
  COALESCE(SUM(CASE WHEN bhe.quantidade_minutos > 0 THEN bhe.quantidade_minutos ELSE 0 END), 0) AS horas_positivas_minutos,
  COALESCE(ABS(SUM(CASE WHEN bhe.quantidade_minutos < 0 THEN bhe.quantidade_minutos ELSE 0 END)), 0) AS horas_negativas_minutos,
  MAX(COALESCE(bhe.created_at, now())) AS ultima_atualizacao
FROM public.banco_horas_eventos bhe
WHERE bhe.colaborador_id IS NOT NULL
  AND bhe.tenant_id IS NOT NULL
GROUP BY bhe.tenant_id, bhe.colaborador_id
ON CONFLICT (tenant_id, colaborador_id) DO UPDATE
SET
  empresa_id = EXCLUDED.empresa_id,
  saldo_atual_minutos = EXCLUDED.saldo_atual_minutos,
  horas_positivas_minutos = EXCLUDED.horas_positivas_minutos,
  horas_negativas_minutos = EXCLUDED.horas_negativas_minutos,
  ultima_atualizacao = EXCLUDED.ultima_atualizacao,
  updated_at = now();

COMMENT ON TABLE public.banco_horas_saldos IS 'Saldo acumulado de banco de horas por colaborador';
COMMENT ON COLUMN public.registros_ponto.saldo_acumulado_minutos IS 'Saldo acumulado do colaborador após o processamento do dia';
COMMENT ON COLUMN public.processamento_rh_logs.duracao_ms IS 'Duração da execução do processamento RH em milissegundos';
