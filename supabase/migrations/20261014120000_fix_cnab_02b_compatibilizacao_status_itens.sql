-- =============================================================================
-- ERP ORBE — FIX-CNAB-02B: COMPATIBILIZAÇÃO DA CHECK CONSTRAINT DE STATUS
-- TABELA: public.rh_financeiro_lote_itens
--
-- MOTIVAÇÃO:
-- A constraint original (20260514163000_rh_financeiro_lotes.sql) restringia os itens a:
--   CHECK (status IN ('PENDENTE', 'EM_ANALISE', 'APROVADO', 'REJEITADO'))
-- Enquanto a tabela pai (rh_financeiro_lotes) foi ampliada em 20260518003304 para o
-- fluxo financeiro/bancário.
-- 
-- Ao gerar remessa CNAB (rpc_registrar_cnab_remessa), o motor transaciona os itens
-- para 'AGUARDANDO_RETORNO', e no retorno bancário (rpc_processar_retorno_cnab_oficial),
-- liquida para 'PAGO'.
-- 
-- Esta migration harmoniza a constraint rh_financeiro_lote_itens_status_check
-- sem alterar nenhum dado existente (todos os registros continuam válidos).
-- =============================================================================

DO $$
BEGIN
    -- 1. Remover constraint restritiva legada se existir
    ALTER TABLE public.rh_financeiro_lote_itens 
        DROP CONSTRAINT IF EXISTS rh_financeiro_lote_itens_status_check;

    -- 2. Recriar constraint com os estados completos do ciclo RH + Financeiro Bancário
    ALTER TABLE public.rh_financeiro_lote_itens 
        ADD CONSTRAINT rh_financeiro_lote_itens_status_check 
        CHECK (status IN (
            -- Estados de RH / Fechamento
            'PENDENTE',
            'EM_ANALISE',
            'APROVADO',
            'REJEITADO',
            -- Estados do Ciclo Bancário / CNAB / Conciliação
            'AGUARDANDO_RETORNO',
            'PROCESSADO',
            'ENVIADO',
            'PAGO',
            'CANCELADO'
        ));

    COMMENT ON CONSTRAINT rh_financeiro_lote_itens_status_check ON public.rh_financeiro_lote_itens IS 
        'FIX-CNAB-02B: Estados do ciclo RH e liquidação bancária CNAB para itens CLT';
END $$;
