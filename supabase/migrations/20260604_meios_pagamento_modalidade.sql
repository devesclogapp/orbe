-- ============================================================================
-- MIGRATION: Adicionar coluna modalidade e popular meios de pagamento
-- ============================================================================
-- Contexto: O encarregado tem 2 opções de lançamento por volume:
--   1. "Recebimento Imediato" (À Vista) → modalidade = 'CAIXA_IMEDIATO'
--   2. "Pagamento a Prazo" (Boleto/Fat. Mensal) → modalidade = 'DUPLICATA'
-- Cada opção deve carregar apenas os meios pertinentes.
-- ============================================================================

-- 1. Adicionar coluna modalidade
ALTER TABLE public.formas_pagamento_operacional
  ADD COLUMN IF NOT EXISTS modalidade TEXT DEFAULT 'CAIXA_IMEDIATO'
  CHECK (modalidade IN ('CAIXA_IMEDIATO', 'DUPLICATA', 'AMBOS'));

-- 2. Atualizar registros existentes com modalidade correta
UPDATE public.formas_pagamento_operacional
SET modalidade = CASE
  WHEN nome IN ('Dinheiro', 'Pix', 'Transferência Bancária', 'Depósito Bancário', 'Cartão de Débito', 'Cartão de Crédito') THEN 'CAIXA_IMEDIATO'
  WHEN nome IN ('Produção', 'Diária', 'Operação fixa', 'Ajuste interno') THEN 'AMBOS'
  ELSE 'CAIXA_IMEDIATO'
END
WHERE modalidade IS NULL OR modalidade = 'CAIXA_IMEDIATO';

-- 3. Inserir meios de pagamento à prazo (Boleto / Faturamento Mensal)
INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo)
VALUES
  ('Boleto Bancário', 'Pagamento via boleto bancário com prazo definido', 'DUPLICATA', true),
  ('Faturamento Mensal', 'Faturamento consolidado mensal para a empresa', 'DUPLICATA', true),
  ('Duplicata', 'Pagamento via duplicata mercantil', 'DUPLICATA', true),
  ('Nota Promissória', 'Pagamento via nota promissória', 'DUPLICATA', true)
ON CONFLICT (nome) DO UPDATE SET modalidade = EXCLUDED.modalidade, ativo = true;

-- 4. Garantir que meios à vista tenham a modalidade correta
INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo)
VALUES
  ('Dinheiro', 'Pagamento em espécie', 'CAIXA_IMEDIATO', true),
  ('Pix', 'Pagamento via Pix', 'CAIXA_IMEDIATO', true),
  ('Transferência Bancária', 'Transferência bancária online', 'CAIXA_IMEDIATO', true),
  ('Depósito Bancário', 'Depósito em conta bancária', 'CAIXA_IMEDIATO', true),
  ('Cartão de Débito', 'Pagamento com cartão de débito', 'CAIXA_IMEDIATO', true),
  ('Cartão de Crédito', 'Pagamento com cartão de crédito', 'CAIXA_IMEDIATO', true)
ON CONFLICT (nome) DO UPDATE SET modalidade = EXCLUDED.modalidade, ativo = true;

-- 5. Índice para busca por modalidade
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_modalidade
  ON public.formas_pagamento_operacional (modalidade, ativo);
