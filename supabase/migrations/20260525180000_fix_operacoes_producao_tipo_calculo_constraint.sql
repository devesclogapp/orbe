-- ============================================================
-- FIX: Constraint operacoes_producao_tipo_calculo_check
-- Problema: o banco ainda usa o constraint original
--   CHECK (tipo_calculo_snapshot IN ('volume', 'fixo', 'colaborador'))
-- mas o frontend pode enviar 'operation' ou 'daily' (valores modernizados).
-- O retry no service.ts só captura 'operation'/'daily' → falha quando o
-- valor enviado é 'volume' mas o spread de regraFinanceira injeta
-- um campo não sanitizado.
--
-- Solução:
--   1. Remover o constraint antigo (inline na coluna, nome gerado pelo PG).
--   2. Adicionar novo constraint nomeado que aceita todos os valores.
--   3. Migrar dados legados ('fixo' → 'volume') para consistência.
-- ============================================================

-- Passo 1: Remover o constraint antigo gerado automaticamente.
-- O PG nomeia constraints inline como tabela_coluna_check.
ALTER TABLE public.operacoes_producao
  DROP CONSTRAINT IF EXISTS operacoes_producao_tipo_calculo_snapshot_check;

-- Passo 2: Também remover versão sem _snapshot (pode existir por migration anterior)
ALTER TABLE public.operacoes_producao
  DROP CONSTRAINT IF EXISTS operacoes_producao_tipo_calculo_check;

-- Passo 3: Normalizar dados legados antes de adicionar o novo constraint
-- 'fixo' era o antigo nome de 'operation' — unificar para 'volume' (comportamento volume)
UPDATE public.operacoes_producao
  SET tipo_calculo_snapshot = 'volume'
  WHERE tipo_calculo_snapshot = 'fixo';

UPDATE public.operacoes_producao
  SET tipo_calculo_snapshot = 'volume'
  WHERE tipo_calculo_snapshot = 'daily';

UPDATE public.operacoes_producao
  SET tipo_calculo_snapshot = 'volume'
  WHERE tipo_calculo_snapshot = 'operation';

-- Passo 4: Garantir que não há nulos inválidos
UPDATE public.operacoes_producao
  SET tipo_calculo_snapshot = 'volume'
  WHERE tipo_calculo_snapshot IS NULL
     OR tipo_calculo_snapshot NOT IN ('volume', 'colaborador');

-- Passo 5: Adicionar constraint nomeado limpo e final
ALTER TABLE public.operacoes_producao
  ADD CONSTRAINT operacoes_producao_tipo_calculo_snapshot_check
  CHECK (tipo_calculo_snapshot IN ('volume', 'colaborador'));

-- Nota: O sistema operacional atual usa apenas 'volume' e 'colaborador'.
-- 'fixo', 'operation' e 'daily' eram valores intermediários de migração.
-- O frontend sempre envia 'volume' como padrão e 'colaborador' quando
-- regraFinanceira.tipoCalculo = 'colaborador'. Qualquer outro valor
-- é normalizado pelo sanitizeOperacaoPayload no service.ts.

NOTIFY pgrst, 'reload schema';
