-- =============================================================
-- Migration: Adicionar campos operacionais avançados para Serviços Extras
-- Objetivo: Suportar cálculo de ISS, Materiais, Colaboradores e Períodos no lançamento.
-- =============================================================

ALTER TABLE public.servicos_extras_operacionais
ADD COLUMN IF NOT EXISTS descricao_servico TEXT,
ADD COLUMN IF NOT EXISTS tipo_servico TEXT,
ADD COLUMN IF NOT EXISTS forma_pagamento_id UUID REFERENCES public.formas_pagamento_operacional(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS quantidade_colaboradores INTEGER,
ADD COLUMN IF NOT EXISTS iss_percentual NUMERIC(5, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_iss NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS materiais_snapshot JSONB,
ADD COLUMN IF NOT EXISTS custo_materiais NUMERIC(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS regra_id UUID REFERENCES public.servicos_especificos_regras(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS emite_nf BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS transportadora_id UUID REFERENCES public.transportadoras_clientes(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS valor_unitario_snapshot NUMERIC(15, 2);

-- Comentários para documentação
COMMENT ON COLUMN public.servicos_extras_operacionais.quantidade_colaboradores IS 'Quantidade de colaboradores envolvidos no serviço extra.';
COMMENT ON COLUMN public.servicos_extras_operacionais.iss_percentual IS 'Percentual de ISS aplicado no momento do lançamento.';
COMMENT ON COLUMN public.servicos_extras_operacionais.valor_iss IS 'Valor monetário do ISS deduzido/calculado.';
COMMENT ON COLUMN public.servicos_extras_operacionais.materiais_snapshot IS 'Snapshot dos materiais consumidos no serviço extra.';
COMMENT ON COLUMN public.servicos_extras_operacionais.custo_materiais IS 'Custo total dos materiais adicionais.';
COMMENT ON COLUMN public.servicos_extras_operacionais.regra_id IS 'Vínculo com a regra operacional de período utilizada.';
COMMENT ON COLUMN public.servicos_extras_operacionais.emite_nf IS 'Indica se o lançamento exige emissão de nota fiscal.';
COMMENT ON COLUMN public.servicos_extras_operacionais.transportadora_id IS 'Vínculo com a transportadora, se o serviço for específico de uma carga/veículo.';
COMMENT ON COLUMN public.servicos_extras_operacionais.valor_unitario_snapshot IS 'Snapshot do valor unitário base no momento do lançamento.';
