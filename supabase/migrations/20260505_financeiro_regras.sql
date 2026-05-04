-- Tabela de regras financeiras centralizadas
CREATE TABLE IF NOT EXISTS public.financeiro_regras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    modalidade_financeira TEXT NOT NULL CHECK (modalidade_financeira IN (
        'CAIXA_IMEDIATO',
        'DUPLICATA_FORNECEDOR',
        'FECHAMENTO_MENSAL_EMPRESA',
        'CUSTO_DESPESA'
    )),
    prazo_dias INTEGER,
    tipo_liquidacao TEXT NOT NULL CHECK (tipo_liquidacao IN ('imediata', 'futura', 'mensal')),
    gera_conta_receber BOOLEAN DEFAULT false,
    entra_caixa_imediato BOOLEAN DEFAULT false,
    agrupa_faturamento BOOLEAN DEFAULT false,
    formas_pagamento_permitidas JSONB DEFAULT '[]'::jsonb,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(empresa_id, modalidade_financeira, ativo)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_empresa ON public.financeiro_regras(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_modalidade ON public.financeiro_regras(modalidade_financeira);
CREATE INDEX IF NOT EXISTS idx_financeiro_regras_ativo ON public.financeiro_regras(ativo);

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_financeiro_regras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar timestamp
DROP TRIGGER IF EXISTS trigger_update_financeiro_regras_updated_at ON public.financeiro_regras;
CREATE TRIGGER trigger_update_financeiro_regras_updated_at
    BEFORE UPDATE ON public.financeiro_regras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_financeiro_regras_updated_at();

-- Inserir regras padrão (globais - empresa_id null)
INSERT INTO public.financeiro_regras (nome, modalidade_financeira, prazo_dias, tipo_liquidacao, gera_conta_receber, entra_caixa_imediato, agrupa_faturamento, formas_pagamento_permitidas)
VALUES
(
    'Pagamento à Vista (Caixa)',
    'CAIXA_IMEDIATO',
    0,
    'imediata',
    false,
    true,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário", "Cartão de Débito", "Cartão de Crédito"]'::jsonb
),
(
    'Pagamento a Prazo (Boleto)',
    'DUPLICATA_FORNECEDOR',
    7,
    'futura',
    true,
    false,
    false,
    '["Boleto Bancário", "Duplicata"]'::jsonb
),
(
    'Faturamento Mensal',
    'FECHAMENTO_MENSAL_EMPRESA',
    NULL,
    'mensal',
    true,
    false,
    true,
    '["Faturamento Mensal"]'::jsonb
),
(
    'Serviços Operacionais Extras',
    'CAIXA_IMEDIATO',
    0,
    'imediata',
    false,
    true,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário"]'::jsonb
),
(
    'Lançamento de Custos',
    'CUSTO_DESPESA',
    0,
    'imediata',
    false,
    false,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário"]'::jsonb
)
ON CONFLICT (empresa_id, modalidade_financeira, ativo) DO NOTHING;

-- Função para classificar financeiro de uma operação
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
    -- Primeiro tenta encontrar regra específica da empresa
    SELECT * INTO v_regra
    FROM public.financeiro_regras
    WHERE empresa_id = p_empresa_id
      AND modalidade_financeira = p_modalidade_financeira
      AND ativo = true
    ORDER BY created_at DESC
    LIMIT 1;

    -- Se não encontrou, busca regra global
    IF v_regra IS NULL THEN
        SELECT * INTO v_regra
        FROM public.financeiro_regras
        WHERE empresa_id IS NULL
          AND modalidade_financeira = p_modalidade_financeira
          AND ativo = true
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- Se encontrou regra, calcula vencimento
    IF v_regra IS NOT NULL THEN
        -- Calcula data de vencimento
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

    -- Se nenhuma regra encontrada, retorna NULLs
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

-- Função para obter formas de pagamento permitidas por modalidade
CREATE OR REPLACE FUNCTION public.get_formas_pagamento_permitidas(
    p_modalidade_financeira TEXT,
    p_empresa_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_formas JSONB;
BEGIN
    -- Primeiro tenta regra específica da empresa
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

-- Habilitar RLS
ALTER TABLE public.financeiro_regras ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "financeiro_regras_all_authenticated" ON public.financeiro_regras;
CREATE POLICY "financeiro_regras_all_authenticated" ON public.financeiro_regras
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON TABLE public.financeiro_regras IS 'Tabela centralizada de regras financeiras - controla modalidade, prazo, formas de pagamento e comportamento de geração de contas a receber';
COMMENT ON COLUMN public.financeiro_regras.modalidade_financeira IS 'Modalidade: CAIXA_IMEDIATO, DUPLICATA_FORNECEDOR, FECHAMENTO_MENSAL_EMPRESA, CUSTO_DESPESA';
COMMENT ON COLUMN public.financeiro_regras.tipo_liquidacao IS 'Tipo: imediata (caixa), futura (boleto), mensal (faturamento)';