-- =============================================================
-- Migration: REPARO TOTAL - Serviços Extras Operacionais
-- Objetivo: Garantir que a tabela e TODAS as colunas necessárias existam.
-- Use esta migração se encontrar erros de "Could not find column".
-- =============================================================

-- 1. Garantir que a tabela base existe
CREATE TABLE IF NOT EXISTS public.servicos_extras_operacionais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- 2. Garantir que colunas fundamentais existem
ALTER TABLE public.servicos_extras_operacionais
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS empresa_nome TEXT,
ADD COLUMN IF NOT EXISTS data DATE NOT NULL DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS tipo_servico_id UUID REFERENCES public.tipos_servico_operacional(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS tipo_servico TEXT,
ADD COLUMN IF NOT EXISTS descricao_servico TEXT,
ADD COLUMN IF NOT EXISTS descricao TEXT;

-- Garantir que não existe constraint NOT NULL em descricao ou descricao_servico
ALTER TABLE public.servicos_extras_operacionais ALTER COLUMN descricao_servico DROP NOT NULL;
ALTER TABLE public.servicos_extras_operacionais ALTER COLUMN descricao DROP NOT NULL;

-- 3. Garantir colunas de valores e configuração
ALTER TABLE public.servicos_extras_operacionais
ADD COLUMN IF NOT EXISTS quantidade NUMERIC(15, 2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS forma_pagamento TEXT,
ADD COLUMN IF NOT EXISTS forma_pagamento_id UUID REFERENCES public.formas_pagamento_operacional(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS modalidade_financeira TEXT DEFAULT 'DEPOSITO_IMEDIATO',
ADD COLUMN IF NOT EXISTS status_pagamento TEXT DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS pipeline_status TEXT DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT,
ADD COLUMN IF NOT EXISTS observacao TEXT,
ADD COLUMN IF NOT EXISTS criado_por UUID DEFAULT auth.uid(),
ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ DEFAULT now();

-- 4. Garantir colunas avançadas do "Power Form"
ALTER TABLE public.servicos_extras_operacionais
ADD COLUMN IF NOT EXISTS quantidade_colaboradores INTEGER,
ADD COLUMN IF NOT EXISTS iss_percentual NUMERIC(5, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_iss NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS materiais_snapshot JSONB,
ADD COLUMN IF NOT EXISTS custo_materiais NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS regra_id UUID REFERENCES public.servicos_especificos_regras(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS emite_nf BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS nf_numero TEXT,
ADD COLUMN IF NOT EXISTS transportadora_id UUID REFERENCES public.transportadoras_clientes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS valor_unitario_snapshot NUMERIC(15, 2),
ADD COLUMN IF NOT EXISTS tipo_calculo_snapshot TEXT,
ADD COLUMN IF NOT EXISTS unidade_cobranca_snapshot TEXT;

-- 5. Garantir RLS básico
ALTER TABLE public.servicos_extras_operacionais ENABLE ROW LEVEL SECURITY;

-- 6. Atualizar Check Constraint de Modalidade Financeira (Garantir que DEPOSITO_IMEDIATO é permitido)
DO $$
BEGIN
    -- Tenta remover a constraint pelo nome exato do erro ou pelo nome padrão
    ALTER TABLE public.servicos_extras_operacionais DROP CONSTRAINT IF EXISTS servicos_extras_operacionais_modalidade_financeir_a_check;
    ALTER TABLE public.servicos_extras_operacionais DROP CONSTRAINT IF EXISTS servicos_extras_operacionais_modalidade_financeira_check;
    
    -- Tenta remover a constraint de tipo_servico que está causando erro
    ALTER TABLE public.servicos_extras_operacionais DROP CONSTRAINT IF EXISTS servicos_extras_operacionais_tipo_servico_check;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.servicos_extras_operacionais ADD CONSTRAINT servicos_extras_operacionais_modalidade_financeira_check 
  CHECK (modalidade_financeira IN ('CAIXA_IMEDIATO', 'DEPOSITO_IMEDIATO', 'CAIXA_ADMINISTRATIVO', 'DUPLICATA_FORNECEDOR', 'FECHAMENTO_MENSAL_EMPRESA'));

DROP POLICY IF EXISTS "select_servicos_extras_autenticado_repair" ON public.servicos_extras_operacionais;
CREATE POLICY "select_servicos_extras_autenticado_repair"
  ON public.servicos_extras_operacionais FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_servicos_extras_autenticado_repair" ON public.servicos_extras_operacionais;
CREATE POLICY "insert_servicos_extras_autenticado_repair"
  ON public.servicos_extras_operacionais FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "update_servicos_extras_autenticado_repair" ON public.servicos_extras_operacionais;
CREATE POLICY "update_servicos_extras_autenticado_repair"
  ON public.servicos_extras_operacionais FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
