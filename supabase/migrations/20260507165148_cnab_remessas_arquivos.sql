-- ============================================================
-- FASE 8.1.1 — CNAB Remessas Arquivos + Sequencial + Auditoria Bancária
-- ============================================================

-- 1. Tabela principal: memória persistente de arquivos CNAB gerados
CREATE TABLE IF NOT EXISTS public.cnab_remessas_arquivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    lote_id UUID REFERENCES public.lotes_remessa(id) ON DELETE SET NULL,

    -- Identificação do arquivo
    nome_arquivo TEXT NOT NULL,
    sequencial_arquivo INTEGER NOT NULL,

    -- Integridade
    hash_arquivo TEXT NOT NULL, -- SHA-256 do conteúdo gerado

    -- Conteúdo (opcional - somente se ativado por config do tenant)
    conteudo_arquivo TEXT,

    -- Totalizadores
    total_registros INTEGER NOT NULL DEFAULT 0,
    total_valor NUMERIC(15, 2) NOT NULL DEFAULT 0,

    -- Dados bancários snapshot (imutável pós-geração)
    banco_codigo VARCHAR(10),
    banco_nome VARCHAR(255),
    conta_bancaria_id UUID REFERENCES public.contas_bancarias_empresa(id) ON DELETE SET NULL,

    -- Workflow de status
    status TEXT NOT NULL DEFAULT 'gerado'
        CHECK (status IN ('gerado', 'baixado', 'enviado_manual', 'homologado', 'erro_homologacao')),

    -- Modo (separação homologação x produção)
    modo TEXT NOT NULL DEFAULT 'producao'
        CHECK (modo IN ('homologacao', 'producao')),

    -- Competência
    competencia VARCHAR(7), -- YYYY-MM

    -- Auditoria de geração
    usuario_geracao UUID REFERENCES auth.users(id),
    data_geracao TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    -- Auditoria de envio
    usuario_envio UUID REFERENCES auth.users(id),
    data_envio TIMESTAMPTZ,

    -- Auditoria de homologação
    usuario_homologacao UUID REFERENCES auth.users(id),
    data_homologacao TIMESTAMPTZ,

    -- Metadados extras
    observacoes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Garantir unicidade de sequencial por tenant + conta bancária
CREATE UNIQUE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_sequencial
    ON public.cnab_remessas_arquivos (tenant_id, conta_bancaria_id, sequencial_arquivo);

-- Impedir duplicidade de hash por tenant (mesmo arquivo não pode ser gerado 2x)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_hash
    ON public.cnab_remessas_arquivos (tenant_id, hash_arquivo);

-- Índices operacionais
CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_tenant
    ON public.cnab_remessas_arquivos (tenant_id);

CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_lote
    ON public.cnab_remessas_arquivos (lote_id);

CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_status
    ON public.cnab_remessas_arquivos (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_cnab_remessas_arquivos_competencia
    ON public.cnab_remessas_arquivos (tenant_id, competencia);

-- 2. Tabela de controle de sequencial CNAB por tenant + conta bancária
CREATE TABLE IF NOT EXISTS public.cnab_sequencial_controle (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias_empresa(id) ON DELETE CASCADE,
    banco_codigo VARCHAR(10) NOT NULL,
    ultimo_sequencial INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    CONSTRAINT cnab_sequencial_unico UNIQUE (tenant_id, conta_bancaria_id)
);

CREATE INDEX IF NOT EXISTS idx_cnab_sequencial_controle_tenant
    ON public.cnab_sequencial_controle (tenant_id, conta_bancaria_id);

-- 3. Auditoria bancária
CREATE TABLE IF NOT EXISTS public.cnab_auditoria_bancaria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id) ON DELETE SET NULL,
    lote_id UUID REFERENCES public.lotes_remessa(id) ON DELETE SET NULL,

    acao TEXT NOT NULL
        CHECK (acao IN ('geracao', 'download', 'envio_manual', 'homologacao', 'erro_homologacao', 'validacao')),

    usuario_id UUID REFERENCES auth.users(id),
    usuario_nome TEXT,
    detalhes JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Auditoria bancária é APPEND-ONLY: bloquear UPDATE e DELETE
CREATE OR REPLACE RULE cnab_auditoria_no_update AS
    ON UPDATE TO public.cnab_auditoria_bancaria DO INSTEAD NOTHING;

CREATE OR REPLACE RULE cnab_auditoria_no_delete AS
    ON DELETE TO public.cnab_auditoria_bancaria DO INSTEAD NOTHING;

CREATE INDEX IF NOT EXISTS idx_cnab_auditoria_tenant
    ON public.cnab_auditoria_bancaria (tenant_id);

CREATE INDEX IF NOT EXISTS idx_cnab_auditoria_arquivo
    ON public.cnab_auditoria_bancaria (arquivo_id);

CREATE INDEX IF NOT EXISTS idx_cnab_auditoria_created
    ON public.cnab_auditoria_bancaria (tenant_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

-- cnab_remessas_arquivos
ALTER TABLE public.cnab_remessas_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessas_arquivos_select" ON public.cnab_remessas_arquivos;
CREATE POLICY "tenant_isolation_cnab_remessas_arquivos_select"
    ON public.cnab_remessas_arquivos FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessas_arquivos_insert" ON public.cnab_remessas_arquivos;
CREATE POLICY "tenant_isolation_cnab_remessas_arquivos_insert"
    ON public.cnab_remessas_arquivos FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_remessas_arquivos_update" ON public.cnab_remessas_arquivos;
CREATE POLICY "tenant_isolation_cnab_remessas_arquivos_update"
    ON public.cnab_remessas_arquivos FOR UPDATE
    USING (tenant_id = (SELECT public.current_tenant_id()));

-- cnab_sequencial_controle
ALTER TABLE public.cnab_sequencial_controle ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cnab_sequencial_select" ON public.cnab_sequencial_controle;
CREATE POLICY "tenant_isolation_cnab_sequencial_select"
    ON public.cnab_sequencial_controle FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_sequencial_insert" ON public.cnab_sequencial_controle;
CREATE POLICY "tenant_isolation_cnab_sequencial_insert"
    ON public.cnab_sequencial_controle FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_sequencial_update" ON public.cnab_sequencial_controle;
CREATE POLICY "tenant_isolation_cnab_sequencial_update"
    ON public.cnab_sequencial_controle FOR UPDATE
    USING (tenant_id = (SELECT public.current_tenant_id()));

-- cnab_auditoria_bancaria
ALTER TABLE public.cnab_auditoria_bancaria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_cnab_auditoria_select" ON public.cnab_auditoria_bancaria;
CREATE POLICY "tenant_isolation_cnab_auditoria_select"
    ON public.cnab_auditoria_bancaria FOR SELECT
    USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "tenant_isolation_cnab_auditoria_insert" ON public.cnab_auditoria_bancaria;
CREATE POLICY "tenant_isolation_cnab_auditoria_insert"
    ON public.cnab_auditoria_bancaria FOR INSERT
    WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

-- ============================================================
-- FUNÇÃO: get_next_cnab_sequencial
-- Retorna próximo sequencial de forma atômica (sem race condition)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_next_cnab_sequencial(
    p_tenant_id UUID,
    p_conta_bancaria_id UUID,
    p_banco_codigo TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_next INTEGER;
BEGIN
    INSERT INTO public.cnab_sequencial_controle (tenant_id, conta_bancaria_id, banco_codigo, ultimo_sequencial)
    VALUES (p_tenant_id, p_conta_bancaria_id, p_banco_codigo, 1)
    ON CONFLICT (tenant_id, conta_bancaria_id)
    DO UPDATE SET
        ultimo_sequencial = cnab_sequencial_controle.ultimo_sequencial + 1,
        updated_at = timezone('utc', now())
    RETURNING ultimo_sequencial INTO v_next;

    RETURN v_next;
END;
$$;

-- ============================================================
-- Triggers: auto tenant_id e updated_at
-- ============================================================
DROP TRIGGER IF EXISTS set_tenant_id_cnab_remessas_arquivos ON public.cnab_remessas_arquivos;
CREATE TRIGGER set_tenant_id_cnab_remessas_arquivos
    BEFORE INSERT ON public.cnab_remessas_arquivos
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_tenant_id();

CREATE OR REPLACE FUNCTION public.update_cnab_remessas_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_cnab_remessas_arquivos_updated_at ON public.cnab_remessas_arquivos;
CREATE TRIGGER update_cnab_remessas_arquivos_updated_at
    BEFORE UPDATE ON public.cnab_remessas_arquivos
    FOR EACH ROW
    EXECUTE FUNCTION public.update_cnab_remessas_updated_at();

DROP TRIGGER IF EXISTS set_tenant_id_cnab_auditoria_bancaria ON public.cnab_auditoria_bancaria;
CREATE TRIGGER set_tenant_id_cnab_auditoria_bancaria
    BEFORE INSERT ON public.cnab_auditoria_bancaria
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_tenant_id();

-- ============================================================
-- Atualizar status da tabela lotes_remessa com novos valores
-- ============================================================
DO $$
BEGIN
    -- Tenta adicionar novos status ao CHECK constraint se existir
    -- (safe: se não existir o constraint, ignora)
    BEGIN
        ALTER TABLE public.lotes_remessa DROP CONSTRAINT IF EXISTS lotes_remessa_status_check;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
END;
$$;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'lotes_remessa'
    ) THEN
        ALTER TABLE public.lotes_remessa
            ADD CONSTRAINT lotes_remessa_status_check
            CHECK (status IN (
                'rascunho', 'validado', 'pendente_correcao', 'pronto_cnab',
                'gerado', 'baixado', 'enviado_manual', 'homologado', 'erro_homologacao',
                'enviado', 'processado', 'erro'
            ));
    END IF;
END;
$$;
