-- Permite que regras verdadeiramente globais existam sem empresa/fornecedor/tipo de serviço.
ALTER TABLE public.fornecedor_valores_servico
  ALTER COLUMN empresa_id DROP NOT NULL,
  ALTER COLUMN fornecedor_id DROP NOT NULL,
  ALTER COLUMN tipo_servico_id DROP NOT NULL;

-- Consolida regras antigas de ISS que foram replicadas por empresa/fornecedor/serviço
-- em uma única linha global por combinação de vigência e valor.
WITH iss_rule_types AS (
  SELECT id
  FROM public.tipos_regra_operacional
  WHERE UPPER(COALESCE(nome, '') || ' ' || COALESCE(coluna_planilha, '')) LIKE '%ISS%'
),
ranked_iss_rules AS (
  SELECT
    fvs.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        fvs.tipo_regra_id,
        fvs.tipo_calculo,
        fvs.valor_unitario,
        fvs.ativo,
        fvs.vigencia_inicio,
        COALESCE(fvs.vigencia_fim, '9999-12-31'::date),
        COALESCE(fvs.forma_pagamento_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY fvs.updated_at DESC, fvs.created_at DESC, fvs.id DESC
    ) AS rn
  FROM public.fornecedor_valores_servico fvs
  INNER JOIN iss_rule_types irt
    ON irt.id = fvs.tipo_regra_id
),
keepers AS (
  SELECT id
  FROM ranked_iss_rules
  WHERE rn = 1
)
UPDATE public.fornecedor_valores_servico fvs
SET
  empresa_id = NULL,
  fornecedor_id = NULL,
  tipo_servico_id = NULL,
  unidade_id = NULL,
  transportadora_id = NULL,
  produto_carga_id = NULL
WHERE fvs.id IN (SELECT id FROM keepers);

WITH iss_rule_types AS (
  SELECT id
  FROM public.tipos_regra_operacional
  WHERE UPPER(COALESCE(nome, '') || ' ' || COALESCE(coluna_planilha, '')) LIKE '%ISS%'
),
ranked_iss_rules AS (
  SELECT
    fvs.id,
    ROW_NUMBER() OVER (
      PARTITION BY
        fvs.tipo_regra_id,
        fvs.tipo_calculo,
        fvs.valor_unitario,
        fvs.ativo,
        fvs.vigencia_inicio,
        COALESCE(fvs.vigencia_fim, '9999-12-31'::date),
        COALESCE(fvs.forma_pagamento_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ORDER BY fvs.updated_at DESC, fvs.created_at DESC, fvs.id DESC
    ) AS rn
  FROM public.fornecedor_valores_servico fvs
  INNER JOIN iss_rule_types irt
    ON irt.id = fvs.tipo_regra_id
)
DELETE FROM public.fornecedor_valores_servico fvs
USING ranked_iss_rules rir
WHERE fvs.id = rir.id
  AND rir.rn > 1;

DROP INDEX IF EXISTS public.fornecedor_valores_servico_regra_ativa_unique;

CREATE UNIQUE INDEX fornecedor_valores_servico_regra_ativa_unique
  ON public.fornecedor_valores_servico (
    COALESCE(fornecedor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(tipo_servico_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(empresa_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(unidade_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(transportadora_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(produto_carga_id, '00000000-0000-0000-0000-000000000000'::uuid),
    vigencia_inicio
  );
