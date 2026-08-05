-- ============================================================
-- BLOCO 4: ETAPA 5 — MIGRATION B (CONSTRAINTS E NOT NULL)
-- ============================================================

-- 1. Aplicar restrição NOT NULL na coluna empresa_id (agora que o backfill garantiu 100% de preenchimento)
ALTER TABLE public.cnab_remessas_arquivos
ALTER COLUMN empresa_id SET NOT NULL;

-- 2. Constraints adicionais de Integridade (Foreign Keys que blindam cruzamento de Tenant)
-- NOTA: Isto obriga que a conta bancária pertença rigorosamente ao tenant de quem está inserindo
-- Se a tabela de lote/conta não suportar UNIQUE(id, tenant_id), essa restrição pode falhar (Depende da infra de Contas Bancarias)
-- (Vamos primeiro assegurar o basico: FK direta se já não houver, o que existe pelo CREATE)

-- 3. Blindagem de Idempotência do Arquivo (Evitar processar o mesmo CNAB físico)
-- Drop the less restrictive index if it exists, and apply the strict one
DROP INDEX IF EXISTS public.idx_cnab_remessas_arquivos_hash;

CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessas_idempotency
ON public.cnab_remessas_arquivos (tenant_id, conta_bancaria_id, hash_arquivo);

-- 4. Retornos: Aplicar idempotência de Arquivo de Retorno
CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_retorno_idempotency
ON public.cnab_retorno_arquivos (tenant_id, banco_codigo, hash_arquivo);
