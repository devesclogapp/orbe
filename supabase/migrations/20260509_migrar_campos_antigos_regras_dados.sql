-- Migration para migrar dados antigos dos campos customizados para os campos fixos
-- Execute este script no Supabase SQL Editor

-- 1. Atualizar registros que têm 'categoria' (natureza)
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'natureza',
  CASE 
    WHEN dados->>'categoria' = 'Receita' THEN 'Receita'
    WHEN dados->>'categoria' = 'Despesa' THEN 'Despesa'
    WHEN dados->>'categoria' = 'Custo' THEN 'Custo'
    ELSE 'Despesa'
  END
)
WHERE dados ? 'categoria';

-- 2. Atualizar 'meios de pagamento' para 'modalidade_financeira'
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'modalidade_financeira',
  CASE 
    WHEN dados->>'meios de pagamento' IN ('À vista', 'Pix', 'Dinheiro') THEN 'CAIXA_IMEDIATO'
    WHEN dados->>'meios de pagamento' = 'Prazo' THEN 'DUPLICATA'
    WHEN dados->>'meios de pagamento' = 'Mensal' THEN 'FATURAMENTO_MENSAL'
    ELSE 'CAIXA_IMEDIATO'
  END
)
WHERE dados ? 'meios de pagamento';

-- 3. Atualizar 'meios de pagamento' para 'forma_pagamento'
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'forma_pagamento',
  CASE 
    WHEN dados->>'meios de pagamento' = 'Pix' THEN 'PIX'
    WHEN dados->>'meios de pagamento' = 'Dinheiro' THEN 'Dinheiro'
    WHEN dados->>'meios de pagamento' = 'Cartão' THEN 'Cartão Débito'
    WHEN dados->>'meios de pagamento' = 'Transferência' THEN 'Transferência'
    WHEN dados->>'meios de pagamento' = 'Cheque' THEN 'Cheque'
    WHEN dados->>'meios de pagamento' = 'Boleto' THEN 'Boleto'
    ELSE 'Dinheiro'
  END
)
WHERE dados ? 'meios de pagamento';

-- 4. Migrar 'compensação/dias' para 'prazo_dias'
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'prazo_dias',
  CASE 
    WHEN dados->>'compensação/dias' IS NOT NULL AND dados->>'compensação/dias' ~ '^[0-9]+$' THEN 
      (dados->>'compensação/dias')::int
    WHEN dados->>'compensação/dias' = 'À vista' THEN 0
    ELSE 0
  END
)
WHERE dados ? 'compensação/dias';

-- 5. Calcular 'tipo_liquidacao' baseado no prazo
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'tipo_liquidacao',
  CASE 
    WHEN dados->>'prazo_dias' IS NOT NULL AND (dados->>'prazo_dias')::int = 0 THEN 'imediato'
    ELSE 'futuro'
  END
)
WHERE dados ? 'prazo_dias';

-- 6. Calcular 'entra_caixa_imediato'
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'entra_caixa_imediato',
  CASE 
    WHEN dados->>'prazo_dias' IS NOT NULL AND (dados->>'prazo_dias')::int = 0 THEN true
    ELSE false
  END
)
WHERE dados ? 'prazo_dias';

-- 7. Calcular 'gera_conta_receber'
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'gera_conta_receber',
  CASE 
    WHEN dados->>'prazo_dias' IS NOT NULL AND (dados->>'prazo_dias')::int = 0 THEN false
    ELSE true
  END
)
WHERE dados ? 'prazo_dias';

-- 8. Calcular 'agrupa_faturamento'
UPDATE regras_dados
SET dados = dados || jsonb_build_object(
  'agrupa_faturamento',
  CASE 
    WHEN dados->>'meios de pagamento' = 'Mensal' THEN true
    ELSE false
  END
)
WHERE dados ? 'meios de pagamento';

-- Verificar o resultado
-- SELECT id, dados->>'natureza' as natureza, dados->>'modalidade_financeira' as modalidade, 
--        dados->>'forma_pagamento' as forma, dados->>'prazo_dias' as prazo
-- FROM regras_dados 
-- WHERE dados ? 'natureza'
-- LIMIT 10;