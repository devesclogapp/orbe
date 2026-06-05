-- 1. Adicionar coluna modalidade
ALTER TABLE public.formas_pagamento_operacional
  ADD COLUMN IF NOT EXISTS modalidade TEXT DEFAULT 'CAIXA_IMEDIATO'
  CHECK (modalidade IN ('CAIXA_IMEDIATO', 'DUPLICATA', 'AMBOS'));

-- 2. Atualizar registros existentes com modalidade correta (Lógica geral)
UPDATE public.formas_pagamento_operacional
SET modalidade = CASE
  WHEN nome IN ('Dinheiro', 'Pix', 'Transferência Bancária', 'Depósito Bancário', 'Cartão de Débito', 'Cartão de Crédito') THEN 'CAIXA_IMEDIATO'
  WHEN nome IN ('Produção', 'Diária', 'Operação fixa', 'Ajuste interno', 'Boleto Bancário', 'Faturamento Mensal', 'Duplicata', 'Nota Promissória') THEN 'DUPLICATA'
  ELSE modalidade -- Mantém o que já estiver definido se não for um dos padrões
END
WHERE modalidade IS NULL OR modalidade = 'CAIXA_IMEDIATO';

-- 3. Inserir meios de pagamento (Lógica robusta via DO block)
DO $$
BEGIN
  -- Prazo
  IF NOT EXISTS (SELECT 1 FROM public.formas_pagamento_operacional WHERE nome = 'Boleto Bancário') THEN
    INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo) VALUES ('Boleto Bancário', 'Pagamento via boleto bancário', 'DUPLICATA', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formas_pagamento_operacional WHERE nome = 'Faturamento Mensal') THEN
    INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo) VALUES ('Faturamento Mensal', 'Faturamento consolidado mensal', 'DUPLICATA', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formas_pagamento_operacional WHERE nome = 'Duplicata') THEN
    INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo) VALUES ('Duplicata', 'Pagamento via duplicata', 'DUPLICATA', true);
  END IF;

  -- À Vista
  IF NOT EXISTS (SELECT 1 FROM public.formas_pagamento_operacional WHERE nome = 'Dinheiro') THEN
    INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo) VALUES ('Dinheiro', 'Pagamento em espécie', 'CAIXA_IMEDIATO', true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.formas_pagamento_operacional WHERE nome = 'Pix') THEN
    INSERT INTO public.formas_pagamento_operacional (nome, descricao, modalidade, ativo) VALUES ('Pix', 'Pagamento via Pix', 'CAIXA_IMEDIATO', true);
  END IF;
END $$;

-- 4. Forçar a modalidade correta para todos os nomes conhecidos
UPDATE public.formas_pagamento_operacional SET modalidade = 'DUPLICATA', ativo = true WHERE nome IN ('Boleto Bancário', 'Faturamento Mensal', 'Duplicata', 'Nota Promissória');
UPDATE public.formas_pagamento_operacional SET modalidade = 'CAIXA_IMEDIATO', ativo = true WHERE nome IN ('Dinheiro', 'Pix', 'Transferência Bancária', 'Depósito Bancário', 'Cartão de Débito', 'Cartão de Crédito');


-- 6. Índice para busca por modalidade
CREATE INDEX IF NOT EXISTS idx_formas_pagamento_modalidade
  ON public.formas_pagamento_operacional (modalidade, ativo);

