-- Migration para adicionar coluna responsavel_nome nas tabelas operacionais
-- Objetivo: Corrigir erro 400 ao salvar producao/custos onde o campo eh enviado mas nao existe na tabela.

ALTER TABLE IF EXISTS public.operacoes_producao 
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;

ALTER TABLE IF EXISTS public.custos_extras_operacionais
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;

ALTER TABLE IF EXISTS public.servicos_extras_operacionais
ADD COLUMN IF NOT EXISTS responsavel_nome TEXT;

-- Comentarios para documentacao
COMMENT ON COLUMN public.operacoes_producao.responsavel_nome IS 'Nome do responsavel pelo lancamento (Encarregado/Operador)';
COMMENT ON COLUMN public.custos_extras_operacionais.responsavel_nome IS 'Nome do responsavel pelo lancamento (Encarregado/Operador)';
COMMENT ON COLUMN public.servicos_extras_operacionais.responsavel_nome IS 'Nome do responsavel pelo lancamento (Encarregado/Operador)';

-- Backfill: Tenta popular o nome a partir do profile se estiver vazio
UPDATE public.operacoes_producao op
SET responsavel_nome = p.full_name
FROM public.profiles p
WHERE op.responsavel_id = p.user_id
AND (op.responsavel_nome IS NULL OR op.responsavel_nome = '');

UPDATE public.custos_extras_operacionais ce
SET responsavel_nome = p.full_name
FROM public.profiles p
WHERE ce.criado_por = p.user_id
AND (ce.responsavel_nome IS NULL OR ce.responsavel_nome = '');

UPDATE public.servicos_extras_operacionais se
SET responsavel_nome = p.full_name
FROM public.profiles p
WHERE se.criado_por = p.user_id
AND (se.responsavel_nome IS NULL OR se.responsavel_nome = '');
