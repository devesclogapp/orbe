-- Migration to create diaristas table

CREATE TABLE IF NOT EXISTS public.diaristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  cpf TEXT,
  valor_diaria NUMERIC(10,2),
  banco_codigo TEXT,
  agencia TEXT,
  conta TEXT,
  banco_digito TEXT,
  agencia_digito TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable row level security
ALTER TABLE public.diaristas ENABLE ROW LEVEL SECURITY;