-- Atualiza formas de pagamento para o card "Descarga à Vista (Caixa)"
-- Remove formas existentes e insere as novas

DELETE FROM public.formas_pagamento_operacional WHERE nome IN ('Dinheiro', 'Pix', 'Transferência Bancária', 'Depósito Bancário', 'Cartão de Débito', 'Cartão de Crédito');

INSERT INTO public.formas_pagamento_operacional (nome, descricao)
VALUES
  ('Dinheiro', 'Pagamento em espécie'),
  ('Pix', 'Pagamento via Pix'),
  ('Transferência Bancária', 'Transferência bancária online'),
  ('Depósito Bancário', 'Depósito em conta bancária'),
  ('Cartão de Débito', 'Pagamento com cartão de débito'),
  ('Cartão de Crédito', 'Pagamento com cartão de crédito')
ON CONFLICT (nome) DO NOTHING;