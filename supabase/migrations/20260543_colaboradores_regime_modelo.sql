-- Migration: 20260543_colaboradores_regime_modelo.sql
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS regime_trabalho TEXT;
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS modelo_calculo TEXT;

-- Mapeamento automático:
UPDATE colaboradores 
SET regime_trabalho = 'CLT', modelo_calculo = 'Mensal' 
WHERE tipo_colaborador = 'CLT' AND regime_trabalho IS NULL;

UPDATE colaboradores 
SET regime_trabalho = 'Diarista', modelo_calculo = 'Diária' 
WHERE tipo_colaborador = 'DIARISTA' AND regime_trabalho IS NULL;

UPDATE colaboradores 
SET modelo_calculo = 'Produção' 
WHERE tipo_colaborador IN ('PRODUÇÃO', 'TERCEIRIZADO') AND modelo_calculo IS NULL;

UPDATE colaboradores 
SET regime_trabalho = 'Intermitente', modelo_calculo = 'Horista' 
WHERE tipo_colaborador = 'INTERMITENTE' AND regime_trabalho IS NULL;

-- Default fallbacks
UPDATE colaboradores 
SET regime_trabalho = 'Outro' 
WHERE regime_trabalho IS NULL;

UPDATE colaboradores 
SET modelo_calculo = 'Horista' 
WHERE modelo_calculo IS NULL;
