-- ============================================================
-- Migration: Renomear código FERIADO → F (regras_marcacao_diaristas)
-- ============================================================

-- 1. Atualiza o código na tabela de regras
UPDATE public.regras_marcacao_diaristas
SET codigo = 'F'
WHERE codigo = 'FERIADO';

-- 2. Atualiza lançamentos retroativos que usavam 'FERIADO'
UPDATE public.lancamentos_diaristas
SET codigo_marcacao = 'F'
WHERE codigo_marcacao = 'FERIADO';
