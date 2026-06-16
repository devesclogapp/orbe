-- Migration: Criacao de lancamentos_intermitentes exclusiva para dados do Tio Digital

DROP TABLE IF EXISTS public.lancamentos_intermitentes CASCADE;

CREATE TABLE public.lancamentos_intermitentes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    
    nome_colaborador TEXT NOT NULL,
    cargo TEXT,
    departamento TEXT,
    
    data_referencia DATE NOT NULL,
    competencia TEXT NOT NULL,
    convocacao TEXT,
    
    horas_trabalhadas NUMERIC(10,2) DEFAULT 0,
    horas_normais NUMERIC(10,2) DEFAULT 0,
    he_50 NUMERIC(10,2) DEFAULT 0,
    he_100 NUMERIC(10,2) DEFAULT 0,
    hora_noturna NUMERIC(10,2) DEFAULT 0,
    total NUMERIC(10,2) DEFAULT 0,
    
    origem TEXT DEFAULT 'tio_digital',
    arquivo_origem TEXT,
    status_pipeline TEXT DEFAULT 'RECEBIDO' CHECK (status_pipeline IN ('RECEBIDO', 'EM_ANALISE_RH', 'APROVADO_RH', 'DEVOLVIDO', 'ENVIADO_FINANCEIRO')),
    importacao_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Config
ALTER TABLE public.lancamentos_intermitentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total autenticado para lancamentos_intermitentes" 
ON public.lancamentos_intermitentes FOR ALL TO authenticated USING (true);

-- Trigger Update Time
CREATE TRIGGER update_lancamentos_intermitentes_updated_at 
BEFORE UPDATE ON public.lancamentos_intermitentes 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Unicidade Condicional para evitar duplicacao
CREATE UNIQUE INDEX unique_intermitente_com_colab 
ON public.lancamentos_intermitentes (tenant_id, colaborador_id, data_referencia, convocacao) 
WHERE colaborador_id IS NOT NULL;

CREATE UNIQUE INDEX unique_intermitente_sem_colab 
ON public.lancamentos_intermitentes (tenant_id, nome_colaborador, data_referencia, convocacao) 
WHERE colaborador_id IS NULL;
