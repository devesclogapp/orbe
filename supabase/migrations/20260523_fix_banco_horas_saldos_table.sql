-- Corrige e padroniza a tabela de saldos acumulados do banco de horas

CREATE TABLE IF NOT EXISTS public.banco_horas_saldos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  empresa_id UUID NULL,
  colaborador_id UUID NOT NULL,
  saldo_atual_minutos INTEGER DEFAULT 0,
  horas_positivas_minutos INTEGER DEFAULT 0,
  horas_negativas_minutos INTEGER DEFAULT 0,
  ultima_movimentacao TIMESTAMP NULL,
  ultima_atualizacao TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE public.banco_horas_saldos
  ADD COLUMN IF NOT EXISTS tenant_id UUID,
  ADD COLUMN IF NOT EXISTS empresa_id UUID NULL,
  ADD COLUMN IF NOT EXISTS colaborador_id UUID,
  ADD COLUMN IF NOT EXISTS saldo_atual_minutos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_positivas_minutos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS horas_negativas_minutos INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_movimentacao TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS ultima_atualizacao TIMESTAMP DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'banco_horas_saldos'
      AND column_name = 'horas_positivas'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'banco_horas_saldos'
      AND column_name = 'horas_positivas_minutos'
  ) THEN
    ALTER TABLE public.banco_horas_saldos
      RENAME COLUMN horas_positivas TO horas_positivas_minutos;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'banco_horas_saldos'
      AND column_name = 'horas_negativas'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'banco_horas_saldos'
      AND column_name = 'horas_negativas_minutos'
  ) THEN
    ALTER TABLE public.banco_horas_saldos
      RENAME COLUMN horas_negativas TO horas_negativas_minutos;
  END IF;
END $$;

UPDATE public.banco_horas_saldos
SET
  saldo_atual_minutos = COALESCE(saldo_atual_minutos, 0),
  horas_positivas_minutos = COALESCE(horas_positivas_minutos, 0),
  horas_negativas_minutos = COALESCE(horas_negativas_minutos, 0),
  ultima_atualizacao = COALESCE(ultima_atualizacao, now()),
  created_at = COALESCE(created_at, now()),
  updated_at = COALESCE(updated_at, now());

ALTER TABLE public.banco_horas_saldos
  ALTER COLUMN tenant_id SET NOT NULL,
  ALTER COLUMN colaborador_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'banco_horas_saldos_unique'
  ) THEN
    ALTER TABLE public.banco_horas_saldos
      ADD CONSTRAINT banco_horas_saldos_unique
      UNIQUE (tenant_id, colaborador_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_banco_horas_saldos_tenant
  ON public.banco_horas_saldos (tenant_id);

CREATE INDEX IF NOT EXISTS idx_banco_horas_saldos_colaborador
  ON public.banco_horas_saldos (colaborador_id);

ALTER TABLE public.banco_horas_saldos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access_banco_horas_saldos" ON public.banco_horas_saldos;
CREATE POLICY "tenant_access_banco_horas_saldos"
ON public.banco_horas_saldos
FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id = (
    SELECT tenant_id
    FROM public.profiles
    WHERE user_id = auth.uid()
  )
);

COMMENT ON TABLE public.banco_horas_saldos IS 'Saldo acumulado do banco de horas por colaborador';
COMMENT ON COLUMN public.banco_horas_saldos.saldo_atual_minutos IS 'Saldo acumulado atual em minutos';
COMMENT ON COLUMN public.banco_horas_saldos.horas_positivas_minutos IS 'Total histórico de créditos em minutos';
COMMENT ON COLUMN public.banco_horas_saldos.horas_negativas_minutos IS 'Total histórico de débitos em minutos';

NOTIFY pgrst, 'reload schema';
