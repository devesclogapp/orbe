-- Adicionar campos fixos à tabela regras_dados para regras financeiras
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS natureza TEXT;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS modalidade_financeira TEXT;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS forma_pagamento TEXT;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS prazo_dias INTEGER;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS tipo_liquidacao TEXT;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS entra_caixa_imediato BOOLEAN DEFAULT false;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS gera_conta_receber BOOLEAN DEFAULT false;
ALTER TABLE regras_dados ADD COLUMN IF NOT EXISTS agrupa_faturamento BOOLEAN DEFAULT false;

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_regras_dados_natureza ON regras_dados(natureza);
CREATE INDEX IF NOT EXISTS idx_regras_dados_modalidade ON regras_dados(modalidade_financeira);
CREATE INDEX IF NOT EXISTS idx_regras_dados_tipo_liquidacao ON regras_dados(tipo_liquidacao);