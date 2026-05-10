-- Auto-generated migration to create lancamentos_diaristas table with relationships
-- Added by OpenCode to resolve relationship missing error

-- Create table if it does not exist
CREATE TABLE IF NOT EXISTS public.lancamentos_diaristas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID NOT NULL REFERENCES public.empresas(id),
  diarista_id UUID NOT NULL REFERENCES public.diaristas(id),
  nome_colaborador TEXT NOT NULL,
  cpf_colaborador TEXT,
  funcao_colaborador TEXT,
  data_lancamento DATE NOT NULL,
  tipo_lancamento TEXT NOT NULL DEFAULT 'diarista',
  codigo_marcacao TEXT NOT NULL CHECK (codigo_marcacao IN ('P', 'MP')),
  quantidade_diaria NUMERIC(3,1) NOT NULL CHECK (quantidade_diaria IN (1, 0.5)),
  valor_diaria_base NUMERIC(10,2) NOT NULL,
  valor_calculado NUMERIC(10,2) NOT NULL,
  cliente_unidade TEXT,
  operacao_servico TEXT,
  encarregado_id UUID REFERENCES auth.users(id),
  encarregado_nome TEXT,
  status TEXT NOT NULL DEFAULT 'em_aberto' CHECK (status IN ('em_aberto', 'fechado_para_pagamento', 'pago', 'cancelado')),
  lote_fechamento_id UUID,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Ensure foreign key relationship exists
ALTER TABLE IF EXISTS public.lancamentos_diaristas
  DROP CONSTRAINT IF EXISTS fk_lancamentos_diaristas_diarista_id;
ALTER TABLE IF EXISTS public.lancamentos_diaristas
  ADD CONSTRAINT fk_lancamentos_diaristas_diarista_id FOREIGN KEY (diarista_id) REFERENCES public.diaristas(id);

-- Enable row level security
ALTER TABLE public.lancamentos_diaristas ENABLE ROW LEVEL SECURITY;
