    -- =============================================================
    -- Migration: Adicionar campos de Serviço Extra ao cadastro de Tipos de Serviço
    -- Objetivo: Permitir que serviços sejam configurados com preço e unidade para lançamentos automáticos.
    -- =============================================================

    ALTER TABLE public.tipos_servico_operacional 
    ADD COLUMN IF NOT EXISTS is_extra_service BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS unidade_cobranca TEXT, 
    ADD COLUMN IF NOT EXISTS tipo_calculo TEXT,
    ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC(15, 2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS ativo_encarregado BOOLEAN DEFAULT true;

    -- Comentários para documentação
    COMMENT ON COLUMN public.tipos_servico_operacional.is_extra_service IS 'Define se o serviço pode ser lançado individualmente como Serviço Extra pelo encarregado.';
    COMMENT ON COLUMN public.tipos_servico_operacional.unidade_cobranca IS 'Unidade de medida para cobrança: op, hora, pallet, unidade, colaborador etc.';
    COMMENT ON COLUMN public.tipos_servico_operacional.tipo_calculo IS 'Regra de cálculo: por_operacao (fixo), por_quantidade ou por_unidade.';
    COMMENT ON COLUMN public.tipos_servico_operacional.valor_unitario IS 'Valor base para faturamento do serviço extra.';
    COMMENT ON COLUMN public.tipos_servico_operacional.ativo_encarregado IS 'Se o serviço está disponível para seleção no portal do encarregado.';

    -- Adicionar campos de snapshot na tela de lançamentos de serviços extras
    ALTER TABLE public.servicos_extras_operacionais
    ADD COLUMN IF NOT EXISTS unidade_cobranca_snapshot TEXT,
    ADD COLUMN IF NOT EXISTS tipo_calculo_snapshot TEXT;

    COMMENT ON COLUMN public.servicos_extras_operacionais.unidade_cobranca_snapshot IS 'Snapshot da unidade de cobrança no momento do lançamento.';
    COMMENT ON COLUMN public.servicos_extras_operacionais.tipo_calculo_snapshot IS 'Snapshot do tipo de cálculo no momento do lançamento.';
