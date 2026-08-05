-- ============================================================
-- BLOCO 4: ETAPA 2 — MIGRATION A (ESTRUTURAS BASE NULLABLE)
-- ============================================================

-- 1. Adicionar colunas base em cnab_remessas_arquivos (NULLABLE para backfill)
ALTER TABLE public.cnab_remessas_arquivos 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- (O tenant_id já existe e já é NOT NULL)

-- 2. Criar tabela física de itens da remessa (Vínculo unificado)
CREATE TABLE IF NOT EXISTS public.cnab_remessa_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    remessa_id UUID NOT NULL REFERENCES public.cnab_remessas_arquivos(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    
    origem_tipo TEXT NOT NULL CHECK (origem_tipo IN ('CLT', 'INTERMITENTE', 'DIARISTA')),
    origem_id UUID NOT NULL, -- Pode apontar para rh_financeiro_lote_itens.id, lancamentos_intermitentes.id ou lancamentos_diaristas.id dependendo do tipo
    
    -- Cache financeiro
    fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL,
    lote_item_id UUID, 
    
    valor NUMERIC(15, 2) NOT NULL CHECK (valor > 0),
    status TEXT NOT NULL DEFAULT 'remetido' CHECK (status IN ('remetido', 'conciliado', 'rejeitado', 'divergente', 'cancelado', 'invalidado')),
    criado_por UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- RLS para a nova tabela
ALTER TABLE public.cnab_remessa_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_cnab_remessa_itens_select"
    ON public.cnab_remessa_itens FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "tenant_isolation_cnab_remessa_itens_insert"
    ON public.cnab_remessa_itens FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "tenant_isolation_cnab_remessa_itens_update"
    ON public.cnab_remessa_itens FOR UPDATE
    USING (tenant_id = (SELECT public.current_tenant_id()));

CREATE POLICY "tenant_isolation_cnab_remessa_itens_delete"
    ON public.cnab_remessa_itens FOR DELETE
    USING (tenant_id = (SELECT public.current_tenant_id()));

-- Indice parcial de idempotencia imediato (pois a tabela esta vazia e e' seguro aplicar constraint agora)
CREATE UNIQUE INDEX IF NOT EXISTS uq_cnab_remessa_itens_origem 
ON public.cnab_remessa_itens (tenant_id, origem_tipo, origem_id)
WHERE status NOT IN ('cancelado', 'invalidado');

-- Trigger de updated_at para a nova tabela
CREATE OR REPLACE FUNCTION public.update_cnab_remessa_itens_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

CREATE TRIGGER update_cnab_remessa_itens_updated_at
    BEFORE UPDATE ON public.cnab_remessa_itens
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cnab_remessa_itens_updated_at();
