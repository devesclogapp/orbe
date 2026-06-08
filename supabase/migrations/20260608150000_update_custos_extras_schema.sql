-- Migration: Atualizar e Consolidar Custos Extras (FULL SETUP)
-- Objetivo: Garantir que todas as colunas necessárias existam e os dados estejam normalizados para o novo formulário.

-- 1. Garantir que as colunas estruturais e de Pipeline existam
DO $$
BEGIN
    -- Coluna de Tenant (Crítica para RLS)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='tenant_id') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN tenant_id UUID;
    END IF;

    -- Coluna de Unidade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='unidade_id') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN unidade_id UUID REFERENCES public.unidades(id) ON DELETE SET NULL;
    END IF;

    -- Coluna de Observação
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='observacao') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN observacao TEXT;
    END IF;

    -- Colunas de Pipeline
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='pipeline_status') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN pipeline_status TEXT DEFAULT 'PENDENTE';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='justificativa_devolucao') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN justificativa_devolucao TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='centro_custo_nome') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN centro_custo_nome TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='origem_lancamento') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN origem_lancamento TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='responsavel_id') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN responsavel_id UUID REFERENCES auth.users(id);
    END IF;

    -- Garantir que formas_pagamento_operacional tenha tenant_id e modalidade
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='formas_pagamento_operacional' AND column_name='tenant_id') THEN
        ALTER TABLE public.formas_pagamento_operacional ADD COLUMN tenant_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='formas_pagamento_operacional' AND column_name='modalidade') THEN
        ALTER TABLE public.formas_pagamento_operacional ADD COLUMN modalidade TEXT DEFAULT 'AMBOS';
    END IF;
END $$;

-- 2. Remover a constraint atual para permitir limpeza
ALTER TABLE public.custos_extras_operacionais 
DROP CONSTRAINT IF EXISTS custos_extras_operacionais_categoria_custo_check;

-- 3. Normalizar dados de forma agressiva
UPDATE public.custos_extras_operacionais
SET categoria_custo = UPPER(TRIM(categoria_custo));

UPDATE public.custos_extras_operacionais
SET categoria_custo = 'MERENDA/LANCHE'
WHERE categoria_custo IN ('MERENDA', 'LANCHE', 'MERENDA / LANCHE', 'MERENDA/ LANCHE', 'MERENDA /LANCHE');

UPDATE public.custos_extras_operacionais
SET categoria_custo = 'OUTROS'
WHERE categoria_custo NOT IN ('OPERACIONAL', 'ADMINISTRATIVO', 'MERENDA/LANCHE', 'MANUTENCAO', 'TRANSPORTE', 'COMUNICACAO', 'OUTROS');

-- 4. Reaplicar constraints de categoria
ALTER TABLE public.custos_extras_operacionais 
ADD CONSTRAINT custos_extras_operacionais_categoria_custo_check 
CHECK (categoria_custo IN ('OPERACIONAL', 'ADMINISTRATIVO', 'MERENDA/LANCHE', 'MANUTENCAO', 'TRANSPORTE', 'COMUNICACAO', 'OUTROS'));

-- 5. Normalizar e aplicar constraint de pipeline_status
UPDATE public.custos_extras_operacionais
SET pipeline_status = 'PENDENTE'
WHERE pipeline_status IS NULL OR pipeline_status = '' OR pipeline_status NOT IN ('PENDENTE', 'EM_VALIDACAO', 'APROVADO_OPERACAO', 'CONSOLIDADO_FINANCEIRO', 'CONCLUIDO');

ALTER TABLE public.custos_extras_operacionais 
DROP CONSTRAINT IF EXISTS custos_extras_operacionais_pipeline_status_check;

ALTER TABLE public.custos_extras_operacionais 
ADD CONSTRAINT custos_extras_operacionais_pipeline_status_check 
CHECK (pipeline_status IN ('PENDENTE', 'EM_VALIDACAO', 'APROVADO_OPERACAO', 'CONSOLIDADO_FINANCEIRO', 'CONCLUIDO'));

-- 6. Adicionar coluna para forma_pagamento_id
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='custos_extras_operacionais' AND column_name='forma_pagamento_id') THEN
        ALTER TABLE public.custos_extras_operacionais ADD COLUMN forma_pagamento_id UUID REFERENCES public.formas_pagamento_operacional(id) ON DELETE SET NULL;
    END IF;
END $$;

COMMENT ON COLUMN public.custos_extras_operacionais.pipeline_status IS 'Status do fluxo de aprovacao (Master Flow).';
COMMENT ON COLUMN public.custos_extras_operacionais.categoria_custo IS 'Categorias atualizadas: OPERACIONAL, ADMINISTRATIVO, MERENDA/LANCHE, MANUTENCAO, TRANSPORTE, COMUNICACAO, OUTROS';
