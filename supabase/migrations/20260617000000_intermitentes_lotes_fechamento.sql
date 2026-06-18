-- Tabela Isolada de Lotes para Intermitentes
CREATE TABLE IF NOT EXISTS public.intermitentes_lotes_fechamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  empresa_id UUID NULL REFERENCES public.empresas(id) ON DELETE SET NULL,
  competencia VARCHAR(7) NOT NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  quantidade_registros INTEGER NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'AGUARDANDO_VALIDACAO_RH' CHECK (status IN ('AGUARDANDO_VALIDACAO_RH', 'VALIDADO_RH', 'DEVOLVIDO', 'CANCELADO', 'FECHADO_FINANCEIRO', 'CNAB_GERADO', 'PAGO')),
  observacoes TEXT NULL,
  created_by UUID NULL REFERENCES auth.users(id),
  validated_by UUID NULL REFERENCES auth.users(id),
  validated_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intermitentes_lotes_fechamento_tenant_empresa ON public.intermitentes_lotes_fechamento(tenant_id, empresa_id);
CREATE INDEX IF NOT EXISTS idx_intermitentes_lotes_fechamento_competencia ON public.intermitentes_lotes_fechamento(competencia);

ALTER TABLE public.intermitentes_lotes_fechamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "intermitentes_lotes_fechamento_tenant_all" ON public.intermitentes_lotes_fechamento;
CREATE POLICY "intermitentes_lotes_fechamento_tenant_all"
ON public.intermitentes_lotes_fechamento
FOR ALL TO authenticated
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

DROP TRIGGER IF EXISTS trg_intermitentes_lotes_fechamento_updated_at ON public.intermitentes_lotes_fechamento;
CREATE TRIGGER trg_intermitentes_lotes_fechamento_updated_at
  BEFORE UPDATE ON public.intermitentes_lotes_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_auto_tenant_intermitentes_lotes_fechamento ON public.intermitentes_lotes_fechamento;
CREATE TRIGGER trg_auto_tenant_intermitentes_lotes_fechamento
  BEFORE INSERT ON public.intermitentes_lotes_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

-- Adicionar FK na tabela de lançamentos
ALTER TABLE public.lancamentos_intermitentes 
  ADD COLUMN IF NOT EXISTS lote_fechamento_id UUID NULL REFERENCES public.intermitentes_lotes_fechamento(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_lancamentos_intermitentes_lote_id ON public.lancamentos_intermitentes(lote_fechamento_id);

NOTIFY pgrst, 'reload schema';
