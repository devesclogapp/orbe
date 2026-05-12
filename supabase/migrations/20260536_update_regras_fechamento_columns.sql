-- Migration: 20260536_update_regras_fechamento_columns
-- Objetivo: Adicionar colunas faltantes para regras operacionais de diaristas

ALTER TABLE public.regras_fechamento 
ADD COLUMN IF NOT EXISTS permitir_reabertura BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS limite_reabertura INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS exigir_motivo BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS bloquear_edicao BOOLEAN NOT NULL DEFAULT true;

-- Garantir que exista ao menos uma regra ativa para o tenant atual caso não haja
-- (Opcional, mas ajuda na estabilidade da UI)
