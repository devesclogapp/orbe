-- Backfill de regra aplicada para registros já processados no Processamento RH

ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS regra_aplicada TEXT;

WITH regras_extraidas AS (
  SELECT
    pri.registro_ponto_id,
    COALESCE(
      MAX(
        CASE
          WHEN pri.tipo = 'motor_regra_aplicada' THEN
            NULLIF(
              regexp_replace(pri.descricao, '^Motor aplicou regra: (.*) via prioridade .*$', '\1'),
              pri.descricao
            )
        END
      ),
      MAX(
        CASE
          WHEN pri.tipo = 'regra_padrao_aplicada' THEN
            NULLIF(
              regexp_replace(pri.descricao, '^Regra resolvida via Motor Seguro: (.*)$', '\1'),
              pri.descricao
            )
        END
      )
    ) AS regra_aplicada
  FROM public.processamento_rh_inconsistencias pri
  WHERE pri.tipo IN ('motor_regra_aplicada', 'regra_padrao_aplicada')
  GROUP BY pri.registro_ponto_id
)
UPDATE public.registros_ponto rp
SET regra_aplicada = re.regra_aplicada
FROM regras_extraidas re
WHERE rp.id = re.registro_ponto_id
  AND COALESCE(NULLIF(BTRIM(rp.regra_aplicada), ''), '') = ''
  AND COALESCE(NULLIF(BTRIM(re.regra_aplicada), ''), '') <> '';
