-- ==============================================================================
-- MOTOR CNAB240 — MIGRATION ADITIVA: CONSTRAINT ORIGEM_TIPO EM CNAB_REMESSA_ITENS
-- ==============================================================================
-- Motivo:
-- Atualização aditiva da constraint cnab_remessa_itens_origem_tipo_check na tabela
-- cnab_remessa_itens para garantir compatibilidade com todas as origens legítimas
-- do ecossistema financeiro e operacional do ORBE:
--
-- 1. 'DIARISTA' e 'LANCAMENTO_DIARISTA' (Lançamentos operacionais de diaristas)
-- 2. 'INTERMITENTE' e 'LANCAMENTO_INTERMITENTE' (Lançamentos de intermitentes)
-- 3. 'CLT' e 'RH_FINANCEIRO_ITEM' (Itens e fechamentos de colaboradores CLT)
-- 4. 'FATURA' (Cobranças/faturamento a receber)
--
-- Preserva estrita validação de domínio (não permite strings livres ou arbitrárias).
--
-- ATENÇÃO: NÃO EXECUTAR AUTOMATICAMENTE. APLICAÇÃO MANUAL NO SUPABASE STUDIO.
-- ==============================================================================

ALTER TABLE public.cnab_remessa_itens
  DROP CONSTRAINT IF EXISTS cnab_remessa_itens_origem_tipo_check;

ALTER TABLE public.cnab_remessa_itens
  ADD CONSTRAINT cnab_remessa_itens_origem_tipo_check
  CHECK (origem_tipo IN (
    'CLT',
    'INTERMITENTE',
    'DIARISTA',
    'LANCAMENTO_DIARISTA',
    'LANCAMENTO_INTERMITENTE',
    'FATURA',
    'RH_FINANCEIRO_ITEM'
  ));

COMMENT ON CONSTRAINT cnab_remessa_itens_origem_tipo_check ON public.cnab_remessa_itens IS
  'Garante que itens de remessa pertençam exclusivamente aos domínios financeiros homologados (CLT, INTERMITENTE, DIARISTA, FATURA, RH_FINANCEIRO_ITEM).';
