-- ============================================================
-- BLOCO 4: ETAPA 3 — BACKFILL (SANEAMENTO E VINCULAÇÃO)
-- ============================================================

-- 1. Tenta preencher empresa_id com base na Conta Bancaria relacionada
UPDATE public.cnab_remessas_arquivos r
SET empresa_id = c.empresa_id
FROM public.contas_bancarias_empresa c
WHERE r.conta_bancaria_id = c.id
  AND r.empresa_id IS NULL;

-- 2. Tenta preencher empresa_id com base no Lote (se lotes_remessa possuir empresa_id ou através de faturas)
UPDATE public.cnab_remessas_arquivos r
SET empresa_id = f.empresa_id
FROM public.faturas f
WHERE r.lote_id = f.lote_remessa_id
  AND r.empresa_id IS NULL
  AND f.empresa_id IS NOT NULL;

-- ============================================================
-- BLOCO 4: ETAPA 4 — GATE DO BACKFILL (AUDITORIA)
-- O sistema só poderá avançar para a Migration B se esta query retornar 0.
-- ============================================================
-- SELECT id, tenant_id, conta_bancaria_id, lote_id, nome_arquivo 
-- FROM public.cnab_remessas_arquivos 
-- WHERE empresa_id IS NULL;
