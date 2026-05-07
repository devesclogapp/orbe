-- ============================================================
-- FASE 8.2 - Retorno CNAB240 Banco do Brasil
-- ============================================================

CREATE TABLE IF NOT EXISTS public.cnab_retorno_arquivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    remessa_arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id) ON DELETE SET NULL,
    nome_arquivo TEXT NOT NULL,
    hash_arquivo TEXT NOT NULL,
    banco_codigo VARCHAR(10) NOT NULL DEFAULT '001',
    data_processamento TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    usuario_processamento UUID REFERENCES auth.users(id),
    total_linhas INTEGER NOT NULL DEFAULT 0,
    total_processados INTEGER NOT NULL DEFAULT 0,
    total_sucesso INTEGER NOT NULL DEFAULT 0,
    total_rejeitado INTEGER NOT NULL DEFAULT 0,
    total_divergente INTEGER NOT NULL DEFAULT 0,
    total_pendente INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'processado'
        CHECK (status IN ('processado', 'processado_com_pendencias', 'erro')),
    erros_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cnab_retorno_arquivos_hash
    ON public.cnab_retorno_arquivos (tenant_id, hash_arquivo);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_arquivos_tenant
    ON public.cnab_retorno_arquivos (tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_arquivos_remessa
    ON public.cnab_retorno_arquivos (remessa_arquivo_id);

CREATE TABLE IF NOT EXISTS public.cnab_retorno_itens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    retorno_arquivo_id UUID NOT NULL REFERENCES public.cnab_retorno_arquivos(id) ON DELETE CASCADE,
    remessa_arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id) ON DELETE SET NULL,
    lote_id UUID REFERENCES public.lotes_remessa(id) ON DELETE SET NULL,
    fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL,
    colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
    nome_favorecido TEXT,
    documento_favorecido VARCHAR(20),
    valor_esperado NUMERIC(15, 2),
    valor_retornado NUMERIC(15, 2),
    data_ocorrencia DATE,
    codigo_ocorrencia VARCHAR(10),
    descricao_ocorrencia TEXT,
    status TEXT NOT NULL DEFAULT 'pendente'
        CHECK (status IN ('pago', 'rejeitado', 'divergente', 'pendente', 'desconhecido')),
    linha_original TEXT NOT NULL,
    parsed_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_arquivo
    ON public.cnab_retorno_itens (retorno_arquivo_id);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_remessa
    ON public.cnab_retorno_itens (remessa_arquivo_id);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_lote
    ON public.cnab_retorno_itens (lote_id);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_fatura
    ON public.cnab_retorno_itens (fatura_id);

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_status
    ON public.cnab_retorno_itens (tenant_id, status);

ALTER TABLE public.cnab_retorno_arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cnab_retorno_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cnab_retorno_arquivos_select" ON public.cnab_retorno_arquivos;
CREATE POLICY "tenant_isolation_cnab_retorno_arquivos_select"
    ON public.cnab_retorno_arquivos FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_retorno_arquivos_insert" ON public.cnab_retorno_arquivos;
CREATE POLICY "tenant_isolation_cnab_retorno_arquivos_insert"
    ON public.cnab_retorno_arquivos FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_retorno_arquivos_update" ON public.cnab_retorno_arquivos;
CREATE POLICY "tenant_isolation_cnab_retorno_arquivos_update"
    ON public.cnab_retorno_arquivos FOR UPDATE
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_retorno_itens_select" ON public.cnab_retorno_itens;
CREATE POLICY "tenant_isolation_cnab_retorno_itens_select"
    ON public.cnab_retorno_itens FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_retorno_itens_insert" ON public.cnab_retorno_itens;
CREATE POLICY "tenant_isolation_cnab_retorno_itens_insert"
    ON public.cnab_retorno_itens FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_retorno_itens_update" ON public.cnab_retorno_itens;
CREATE POLICY "tenant_isolation_cnab_retorno_itens_update"
    ON public.cnab_retorno_itens FOR UPDATE
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP TRIGGER IF EXISTS set_tenant_id_cnab_retorno_arquivos ON public.cnab_retorno_arquivos;
CREATE TRIGGER set_tenant_id_cnab_retorno_arquivos
    BEFORE INSERT ON public.cnab_retorno_arquivos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_tenant_id();

DROP TRIGGER IF EXISTS set_tenant_id_cnab_retorno_itens ON public.cnab_retorno_itens;
CREATE TRIGGER set_tenant_id_cnab_retorno_itens
    BEFORE INSERT ON public.cnab_retorno_itens
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_tenant_id();

CREATE OR REPLACE FUNCTION public.update_cnab_retorno_arquivos_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cnab_retorno_arquivos_updated_at ON public.cnab_retorno_arquivos;
CREATE TRIGGER update_cnab_retorno_arquivos_updated_at
    BEFORE UPDATE ON public.cnab_retorno_arquivos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cnab_retorno_arquivos_updated_at();

ALTER TABLE public.cnab_auditoria_bancaria
    DROP CONSTRAINT IF EXISTS cnab_auditoria_bancaria_acao_check;

ALTER TABLE public.cnab_auditoria_bancaria
    ADD CONSTRAINT cnab_auditoria_bancaria_acao_check
    CHECK (
        acao IN (
            'geracao',
            'download',
            'envio_manual',
            'homologacao',
            'erro_homologacao',
            'validacao',
            'upload_retorno',
            'processamento_retorno',
            'erro_retorno',
            'divergencia_retorno'
        )
    );
