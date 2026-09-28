-- ==============================================================================
-- MOTOR CNAB240 MULTIBANCO — MIGRATION: CONTADORES SEMÂNTICOS
-- ==============================================================================
-- Motivo:
-- Separação explícita entre a quantidade física de linhas CNAB (registros de 240 posições)
-- e a quantidade de itens financeiros / pagamentos (itens do lote / faturas vinculadas),
-- além da contagem de beneficiários únicos (após consolidação).
--
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE. APLICAÇÃO MANUAL NO SUPABASE STUDIO.
-- ==============================================================================

-- 1. Adicionar colunas semânticas de contagem na tabela cnab_remessas_arquivos
ALTER TABLE public.cnab_remessas_arquivos
  ADD COLUMN IF NOT EXISTS quantidade_itens_financeiros INTEGER,
  ADD COLUMN IF NOT EXISTS quantidade_registros_cnab INTEGER,
  ADD COLUMN IF NOT EXISTS quantidade_beneficiarios INTEGER;

-- Comentários de documentação nas colunas
COMMENT ON COLUMN public.cnab_remessas_arquivos.quantidade_itens_financeiros IS
  'Quantidade total de itens/lançamentos financeiros de origem vinculados à remessa (ex: 2 lançamentos P/MP).';

COMMENT ON COLUMN public.cnab_remessas_arquivos.quantidade_registros_cnab IS
  'Quantidade física de registros/linhas geradas no arquivo CNAB (Header, Lotes, Segmentos A/B, Trailers).';

COMMENT ON COLUMN public.cnab_remessas_arquivos.quantidade_beneficiarios IS
  'Quantidade de pessoas/beneficiários únicos que receberam ordens de pagamento no arquivo após consolidação.';

-- 2. Backfill inicial para registros preexistentes:
-- Para remessas antigas onde quantidade_itens_financeiros for nula, assume total_registros.
UPDATE public.cnab_remessas_arquivos
SET
  quantidade_itens_financeiros = COALESCE(quantidade_itens_financeiros, total_registros),
  quantidade_registros_cnab = COALESCE(quantidade_registros_cnab, total_registros)
WHERE quantidade_itens_financeiros IS NULL;
