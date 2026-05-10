-- Migration: cria tabela diaristas_lotes_fechamento
-- Necessária pelo LoteFechamentoDiaristaService (base.service.ts)
-- A migration anterior criou lote_pagamento_diaristas com nome diferente.

CREATE TABLE IF NOT EXISTS public.diaristas_lotes_fechamento (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID        NOT NULL REFERENCES public.empresas(id),
  periodo_inicio      DATE        NOT NULL,
  periodo_fim         DATE        NOT NULL,
  mes_referencia      TEXT        NOT NULL, -- formato YYYY-MM
  total_registros     INTEGER     NOT NULL DEFAULT 0,
  valor_total         NUMERIC(12,2) NOT NULL DEFAULT 0,
  status              TEXT        NOT NULL DEFAULT 'fechado_para_pagamento'
                                  CHECK (status IN ('fechado_para_pagamento', 'enviado_financeiro', 'pago', 'cancelado')),
  fechado_por         UUID        REFERENCES auth.users(id),
  fechado_por_nome    TEXT,
  fechado_em          TIMESTAMPTZ,
  observacoes         TEXT,
  tenant_id           UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_empresa
  ON public.diaristas_lotes_fechamento (empresa_id);

CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_mes
  ON public.diaristas_lotes_fechamento (empresa_id, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_periodo
  ON public.diaristas_lotes_fechamento (empresa_id, periodo_inicio, periodo_fim);

CREATE INDEX IF NOT EXISTS idx_diaristas_lotes_status
  ON public.diaristas_lotes_fechamento (status);

-- RLS
ALTER TABLE public.diaristas_lotes_fechamento ENABLE ROW LEVEL SECURITY;

-- Política: acesso completo para autenticados (isolamento por empresa_id na camada de aplicação)
-- Padrão consistente com lote_pagamento_diaristas, ciclos_diaristas, etc.
CREATE POLICY "full_access_diaristas_lotes_fechamento"
  ON public.diaristas_lotes_fechamento
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_diaristas_lotes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_diaristas_lotes_updated_at
  BEFORE UPDATE ON public.diaristas_lotes_fechamento
  FOR EACH ROW EXECUTE FUNCTION public.set_diaristas_lotes_updated_at();
