-- =====================================================================
-- LIMPEZA DE DUPLICATAS: lancamentos_diaristas
-- Execute agora no SQL Editor do Supabase
-- =====================================================================

-- Remove todas as duplicatas em aberto, mantendo apenas o MAIS RECENTE
-- por combinação (empresa_id, diarista_id, data_lancamento)
DELETE FROM lancamentos_diaristas
WHERE id IN (
  SELECT id FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY empresa_id, diarista_id, data_lancamento
        ORDER BY created_at DESC
      ) AS rn
    FROM lancamentos_diaristas
    WHERE status IN ('em_aberto', 'EM_ABERTO')
  ) ranked
  WHERE rn > 1
);

-- Resultado esperado: mensagem "DELETE N" onde N = número de duplicatas removidas
SELECT 
  empresa_id, diarista_id, data_lancamento, COUNT(*) as total
FROM lancamentos_diaristas
WHERE status IN ('em_aberto', 'EM_ABERTO')
GROUP BY empresa_id, diarista_id, data_lancamento
HAVING COUNT(*) > 1;
-- Se retornar vazio: limpeza concluída com sucesso
