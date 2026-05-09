CREATE TABLE IF NOT EXISTS public.formas_pagamento (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id),
  modalidade_financeira TEXT NOT NULL,
  forma_pagamento TEXT NOT NULL,
  liquidacao TEXT,
  prazo INTEGER,
  faturamento BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.taxas_impostos (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  tenant_id UUID REFERENCES public.tenants(id),
  nome_taxa TEXT NOT NULL,
  tipo_incidencia TEXT NOT NULL,
  percentual_valor NUMERIC(15,4),
  base_calculo TEXT,
  municipio TEXT,
  vigencia_inicio DATE,
  vigencia_fim DATE,
  status TEXT DEFAULT 'ativo',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.taxas_impostos ENABLE ROW LEVEL SECURITY;
