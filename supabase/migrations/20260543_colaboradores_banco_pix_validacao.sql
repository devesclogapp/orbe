ALTER TABLE public.colaboradores
  ADD COLUMN IF NOT EXISTS chave_pix TEXT,
  ADD COLUMN IF NOT EXISTS banco_validado BOOLEAN DEFAULT false;

UPDATE public.colaboradores
SET banco_validado = false
WHERE banco_validado IS NULL;

ALTER TABLE public.colaboradores
  ALTER COLUMN banco_validado SET DEFAULT false;

COMMENT ON COLUMN public.colaboradores.chave_pix IS
  'Chave Pix do colaborador para conferência operacional e bancária';

COMMENT ON COLUMN public.colaboradores.banco_validado IS
  'Indica se os dados bancários do colaborador já foram conferidos manualmente';
