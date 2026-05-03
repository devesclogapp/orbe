-- Migration to create ponto table
-- Should be applied after migrations up to 20260430.

CREATE TABLE IF NOT EXISTS public.ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid REFERENCES public.colaboradores(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresa(id) ON DELETE CASCADE,
  entrada timestamp with time zone NOT NULL,
  saida timestamp with time zone NOT NULL,
  jornada int NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Optional indexes
CREATE INDEX IF NOT EXISTS idx_ponto_colaborador ON public.ponto(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ponto_empresa ON public.ponto(empresa_id);

-- Ensure permissions – read/write only for owner and admin
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ponto TO public;
