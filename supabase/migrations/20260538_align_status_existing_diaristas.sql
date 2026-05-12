-- Migration: 20260538_align_status_existing_diaristas
-- Objetivo: Sincronizar retroativamente o status dos lançamentos individuais com o status dos seus lotes pai

UPDATE public.lancamentos_diaristas l
SET status = lf.status,
    updated_at = now()
FROM public.diaristas_lotes_fechamento lf
WHERE l.lote_fechamento_id = lf.id
AND l.status != lf.status;

-- Garantir que todos os lançamentos que deveriam estar vinculados a um lote mas por algum motivo de falha anterior não estão (baseado no período)
-- Nota: Esta parte é mais perigosa, vamos focar apenas no que já tem lote_fechamento_id.
