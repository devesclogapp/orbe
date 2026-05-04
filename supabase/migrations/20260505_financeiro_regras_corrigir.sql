-- Verificar se a coluna já existe, se não existir adicionar
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'financeiro_regras' AND column_name = 'modalidade_financeira') THEN
        -- Adicionar novas colunas
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS nome TEXT;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS modalidade_financeira TEXT CHECK (modalidade_financeira IN (
            'CAIXA_IMEDIATO',
            'DUPLICATA_FORNECEDOR',
            'FECHAMENTO_MENSAL_EMPRESA',
            'CUSTO_DESPESA'
        ));
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS prazo_dias INTEGER;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS tipo_liquidacao TEXT CHECK (tipo_liquidacao IN ('imediata', 'futura', 'mensal'));
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS gera_conta_receber BOOLEAN DEFAULT false;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS entra_caixa_imediato BOOLEAN DEFAULT false;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS agrupa_faturamento BOOLEAN DEFAULT false;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS formas_pagamento_permitidas JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT true;
        ALTER TABLE public.financeiro_regras ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
    END IF;
END $$;

-- Remover dados existentes se a tabela já tinha outros dados
DELETE FROM public.financeiro_regras;

-- Inserir regras padrão
INSERT INTO public.financeiro_regras (nome, modalidade_financeira, prazo_dias, tipo_liquidacao, gera_conta_receber, entra_caixa_imediato, agrupa_faturamento, formas_pagamento_permitidas, ativo)
VALUES
(
    'Pagamento à Vista (Caixa)',
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
    'CUSTO_DESPESA',
    0,
    'imediata',
    false,
    false,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário"]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- Recriar índices
DROP INDEX IF EXISTS idx_financeiro_regras_empresa;
DROP INDEX IF EXISTS idx_financeiro_regras_modalidade;
DROP INDEX IF EXISTS idx_financeiro_regras_ativo;

CREATE INDEX IF NOT EXISTS idx_financeiro_regras_empresa ON public.financeiro_regras(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_modalidade ON public.financeiro_regras(modalidade_financeira);
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_ativo ON public.financeiro_regras(ativo);

-- Recriar função de update timestamp
CREATE OR REPLACE FUNCTION public.update_financeiro_regras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_update_financeiro_regras_updated_at ON public.financeiro_regras;
CREATE TRIGGER trigger_update_financeiro_regras_updated_at
    BEFORE UPDATE ON public.financeiro_regras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_financeiro_regras_updated_at();

-- Recriar função classificar_financeiro_operacao
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

-- Recriar função get_formas_pagamento_permitidas
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