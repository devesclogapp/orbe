-- Migration para corrigir a tabela financeiro_regras existente

-- 1. Remover NOT NULL da coluna valor
ALTER TABLE public.financeiro_regras ALTER COLUMN valor DROP NOT NULL;

-- 2. Verificar e adicionar colunas ausentes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'nome') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN nome TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'modalidade_financeira') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN modalidade_financeira TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'prazo_dias') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN prazo_dias INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'tipo_liquidacao') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN tipo_liquidacao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'gera_conta_receber') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN gera_conta_receber BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'entra_caixa_imediato') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN entra_caixa_imediato BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'agrupa_faturamento') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN agrupa_faturamento BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'formas_pagamento_permitidas') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN formas_pagamento_permitidas JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'ativo') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN ativo BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'updated_at') THEN
        ALTER TABLE public.financeiro_regras ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- 3. Deletar todas as regras existentes
DELETE FROM public.financeiro_regras;

-- 4. Inserir as 5 regras financeiras padrão
INSERT INTO public.financeiro_regras (nome, tipo, vinculo, valor, modalidade_financeira, prazo_dias, tipo_liquidacao, gera_conta_receber, entra_caixa_imediato, agrupa_faturamento, formas_pagamento_permitidas, ativo)
VALUES
(
    'Pagamento à Vista (Caixa)',
    'pagamento',
    'financeiro',
    NULL,
    'CAIXA_IMEDIATO',
    0,
    'imediata',
    false,
    true,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário", "Cartão de Débito", "Cartão de Crédito"]'::jsonb,
    true
),
(
    'Pagamento a Prazo (Boleto)',
    'pagamento',
    'financeiro',
    NULL,
    'DUPLICATA_FORNECEDOR',
    7,
    'futura',
    true,
    false,
    false,
    '["Boleto Bancário", "Duplicata"]'::jsonb,
    true
),
(
    'Faturamento Mensal',
    'pagamento',
    'financeiro',
    NULL,
    'FECHAMENTO_MENSAL_EMPRESA',
    NULL,
    'mensal',
    true,
    false,
    true,
    '["Faturamento Mensal"]'::jsonb,
    true
),
(
    'Serviços Operacionais Extras',
    'pagamento',
    'financeiro',
    NULL,
    'CAIXA_IMEDIATO',
    0,
    'imediata',
    false,
    true,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário"]'::jsonb,
    true
),
(
    'Lançamento de Custos',
    'pagamento',
    'financeiro',
    NULL,
    'CUSTO_DESPESA',
    0,
    'imediata',
    false,
    false,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário"]'::jsonb,
    true
);

-- 5. Recriar índices
DROP INDEX IF EXISTS idx_financeiro_regras_empresa;
DROP INDEX IF EXISTS idx_financeiro_regras_modalidade;
DROP INDEX IF EXISTS idx_financeiro_regras_ativo;

CREATE INDEX IF NOT EXISTS idx_financeiro_regras_empresa ON public.financeiro_regras(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_modalidade ON public.financeiro_regras(modalidade_financeira);
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_ativo ON public.financeiro_regras(ativo);

-- 6. Recriar funções
CREATE OR REPLACE FUNCTION public.update_financeiro_regras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_financeiro_regras_updated_at ON public.financeiro_regras;
CREATE TRIGGER trigger_update_financeiro_regras_updated_at
    BEFORE UPDATE ON public.financeiro_regras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_financeiro_regras_updated_at();

CREATE OR REPLACE FUNCTION public.classificar_financeiro_operacao(
    p_data_operacao DATE,
    p_modalidade_financeira TEXT,
    p_empresa_id UUID DEFAULT NULL
)
RETURNS TABLE (
    data_vencimento DATE,
    gera_conta_receber BOOLEAN,
    entra_caixa_imediato BOOLEAN,
    tipo_liquidacao TEXT,
    agrupa_faturamento BOOLEAN,
    prazo_dias INTEGER,
    regra_encontrada BOOLEAN
) LANGUAGE plpgsql AS $$
DECLARE
    v_regra RECORD;
    v_data_vencimento DATE;
BEGIN
    SELECT * INTO v_regra
    FROM public.financeiro_regras
    WHERE empresa_id = p_empresa_id
      AND modalidade_financeira = p_modalidade_financeira
      AND ativo = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_regra IS NULL THEN
        SELECT * INTO v_regra
        FROM public.financeiro_regras
        WHERE empresa_id IS NULL
          AND modalidade_financeira = p_modalidade_financeira
          AND ativo = true
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    IF v_regra IS NOT NULL THEN
        IF v_regra.tipo_liquidacao = 'mensal' THEN
            v_data_vencimento := date_trunc('month', p_data_operacao) + INTERVAL '1 month' - INTERVAL '1 day';
        ELSIF v_regra.prazo_dias IS NOT NULL THEN
            v_data_vencimento := p_data_operacao + (v_regra.prazo_dias || ' days')::interval;
        ELSE
            v_data_vencimento := p_data_operacao;
        END IF;

        RETURN QUERY SELECT
            v_data_vencimento,
            v_regra.gera_conta_receber,
            v_regra.entra_caixa_imediato,
            v_regra.tipo_liquidacao,
            v_regra.agrupa_faturamento,
            v_regra.prazo_dias,
            true;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        NULL::DATE,
        false,
        false,
        NULL::TEXT,
        false,
        NULL::INTEGER,
        false;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_formas_pagamento_permitidas(
    p_modalidade_financeira TEXT,
    p_empresa_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_formas JSONB;
BEGIN
    SELECT formas_pagamento_permitidas INTO v_formas
    FROM public.financeiro_regras
    WHERE (empresa_id = p_empresa_id OR empresa_id IS NULL)
      AND modalidade_financeira = p_modalidade_financeira
      AND ativo = true
    ORDER BY empresa_id DESC NULLS LAST
    LIMIT 1;

    RETURN COALESCE(v_formas, '[]'::jsonb);
END;
$$;