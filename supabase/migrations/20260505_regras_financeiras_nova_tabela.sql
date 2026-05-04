-- Nova tabela específica para regras financeiras
CREATE TABLE IF NOT EXISTS public.regras_financeiras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    modalidade_financeira TEXT NOT NULL CHECK (modalidade_financeira IN (
        'CAIXA_IMEDIATO',
        'DUPLICATA',
        'FATURAMENTO_MENSAL'
    )),
    tipo_liquidacao TEXT NOT NULL CHECK (tipo_liquidacao IN ('imediata', 'futura', 'mensal')),
    prazo_dias INTEGER DEFAULT 0,
    gera_conta_receber BOOLEAN DEFAULT false,
    entra_caixa_imediato BOOLEAN DEFAULT false,
    agrupa_faturamento BOOLEAN DEFAULT false,
    formas_pagamento_permitidas JSONB DEFAULT '[]'::jsonb,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_regras_financeiras_empresa ON public.regras_financeiras(empresa_id) WHERE empresa_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_regras_financeiras_modalidade ON public.regras_financeiras(modalidade_financeira);
CREATE INDEX IF NOT EXISTS idx_regras_financeiras_ativo ON public.regras_financeiras(ativo);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_regras_financeiras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_regras_financeiras_updated_at ON public.regras_financeiras;
CREATE TRIGGER trigger_update_regras_financeiras_updated_at
    BEFORE UPDATE ON public.regras_financeiras
    FOR EACH ROW
    EXECUTE FUNCTION public.update_regras_financeiras_updated_at();

-- Inserir regras padrão
INSERT INTO public.regras_financeiras (nome, descricao, modalidade_financeira, tipo_liquidacao, prazo_dias, gera_conta_receber, entra_caixa_imediato, agrupa_faturamento, formas_pagamento_permitidas, ativo)
VALUES
(
    'Pagamento à Vista (Caixa)',
    'Operações com recebimento imediato no momento da execução',
    'CAIXA_IMEDIATO',
    'imediata',
    0,
    false,
    true,
    false,
    '["Dinheiro", "Pix", "Transferência Bancária", "Depósito Bancário", "Cartão de Débito", "Cartão de Crédito"]'::jsonb,
    true
),
(
    'Pagamento a Prazo (Boleto)',
    'Operações com recebimento futuro via boleto',
    'DUPLICATA',
    'futura',
    7,
    true,
    false,
    false,
    '["Boleto Bancário", "Duplicata"]'::jsonb,
    true
),
(
    'Faturamento Mensal',
    'Operações consolidadas para pagamento no fechamento mensal',
    'FATURAMENTO_MENSAL',
    'mensal',
    NULL,
    true,
    false,
    true,
    '["Faturamento Mensal"]'::jsonb,
    true
)
ON CONFLICT DO NOTHING;

-- Habilitar RLS
ALTER TABLE public.regras_financeiras ENABLE ROW LEVEL SECURITY;

-- Policy
DROP POLICY IF EXISTS "regras_financeiras_all_authenticated" ON public.regras_financeiras;
CREATE POLICY "regras_financeiras_all_authenticated" ON public.regras_financeiras
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Função para classificar financeiro
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
    FROM public.regras_financeiras
    WHERE empresa_id = p_empresa_id
      AND modalidade_financeira = p_modalidade_financeira
      AND ativo = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_regra IS NULL THEN
        SELECT * INTO v_regra
        FROM public.regras_financeiras
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

-- Função para obter formas de pagamento permitidas
CREATE OR REPLACE FUNCTION public.get_formas_pagamento_permitidas(
    p_modalidade_financeira TEXT,
    p_empresa_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql AS $$
DECLARE
    v_formas JSONB;
BEGIN
    SELECT formas_pagamento_permitidas INTO v_formas
    FROM public.regras_financeiras
    WHERE (empresa_id = p_empresa_id OR empresa_id IS NULL)
      AND modalidade_financeira = p_modalidade_financeira
      AND ativo = true
    ORDER BY empresa_id DESC NULLS LAST
    LIMIT 1;

    RETURN COALESCE(v_formas, '[]'::jsonb);
END;
$$;