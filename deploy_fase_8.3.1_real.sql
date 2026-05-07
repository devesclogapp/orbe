CREATE OR REPLACE FUNCTION public.set_current_tenant_id() RETURNS TRIGGER AS $$ BEGIN IF NEW.tenant_id IS NULL THEN NEW.tenant_id := public.current_tenant_id(); END IF; RETURN NEW; END; $$ LANGUAGE plpgsql SECURITY DEFINER;
-- Fase 8.0: Base Bancária Obrigatória para CNAB240 Banco do Brasil

-- 1. Create contas_bancarias_empresa
CREATE TABLE IF NOT EXISTS public.contas_bancarias_empresa (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL,
    banco_codigo VARCHAR(10) NOT NULL,
    banco_nome VARCHAR(255) NOT NULL,
    agencia VARCHAR(20) NOT NULL,
    agencia_digito VARCHAR(5),
    conta VARCHAR(50) NOT NULL,
    conta_digito VARCHAR(5),
    convenio VARCHAR(50),
    carteira VARCHAR(20),
    variacao_carteira VARCHAR(20),
    cedente_nome VARCHAR(255) NOT NULL,
    cedente_cnpj VARCHAR(20) NOT NULL,
    tipo_conta VARCHAR(50) NOT NULL DEFAULT 'CORRENTE',
    tipo_servico VARCHAR(50) NOT NULL DEFAULT 'PAGAMENTO_FORNECEDOR',
    ativo BOOLEAN NOT NULL DEFAULT true,
    is_padrao BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 2. RLS & Tenant isolation
ALTER TABLE public.contas_bancarias_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation: contas_bancarias_empresa select" ON public.contas_bancarias_empresa;
CREATE POLICY "Tenant Isolation: contas_bancarias_empresa select" ON public.contas_bancarias_empresa
    FOR SELECT USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "Tenant Isolation: contas_bancarias_empresa insert" ON public.contas_bancarias_empresa;
CREATE POLICY "Tenant Isolation: contas_bancarias_empresa insert" ON public.contas_bancarias_empresa
    FOR INSERT WITH CHECK (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "Tenant Isolation: contas_bancarias_empresa update" ON public.contas_bancarias_empresa;
CREATE POLICY "Tenant Isolation: contas_bancarias_empresa update" ON public.contas_bancarias_empresa
    FOR UPDATE USING (tenant_id = (SELECT public.current_tenant_id()));

DROP POLICY IF EXISTS "Tenant Isolation: contas_bancarias_empresa delete" ON public.contas_bancarias_empresa;
CREATE POLICY "Tenant Isolation: contas_bancarias_empresa delete" ON public.contas_bancarias_empresa
    FOR DELETE USING (tenant_id = (SELECT public.current_tenant_id()));

-- Trigger auto tenant
DROP TRIGGER IF EXISTS set_tenant_id_contas_bancarias_empresa ON public.contas_bancarias_empresa;
CREATE TRIGGER set_tenant_id_contas_bancarias_empresa
    BEFORE INSERT ON public.contas_bancarias_empresa
    FOR EACH ROW
    EXECUTE FUNCTION public.set_current_tenant_id();

CREATE INDEX IF NOT EXISTS idx_contas_bancarias_empresa_tenant
    ON public.contas_bancarias_empresa (tenant_id);

CREATE INDEX IF NOT EXISTS idx_contas_bancarias_empresa_empresa
    ON public.contas_bancarias_empresa (empresa_id);

CREATE INDEX IF NOT EXISTS idx_contas_bancarias_empresa_ativo
    ON public.contas_bancarias_empresa (tenant_id, ativo, is_padrao);

-- Esta migration nao altera o workflow de remessas.
-- Os status CNAB ficam centralizados em 20260507165148_cnab_remessas_arquivos.sql.
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
-- ============================================================
-- FASE 8.3 - Baixa financeira controlada e auditavel
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_financeiro_conciliacao_role()
RETURNS BOOLEAN AS $$
  SELECT public.get_user_role() IN ('Admin', 'Financeiro');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

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
      'divergencia_retorno',
      'conciliacao_aprovada',
      'conciliacao_rejeitada',
      'conciliacao_divergente',
      'conciliacao_revertida',
      'conciliacao_observacao'
    )
  );

ALTER TABLE public.cnab_retorno_itens
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS observacao_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS conciliado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revertido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revertido_por UUID REFERENCES auth.users(id);

UPDATE public.cnab_retorno_itens
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.cnab_retorno_itens
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.cnab_retorno_itens
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.cnab_retorno_itens
  DROP CONSTRAINT IF EXISTS cnab_retorno_itens_status_conciliacao_check;

ALTER TABLE public.cnab_retorno_itens
  ADD CONSTRAINT cnab_retorno_itens_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

-- Patch de compatibilidade: garantir public.faturas.tenant_id antes de qualquer uso em indices e RPCs
ALTER TABLE IF EXISTS public.faturas
  ADD COLUMN IF NOT EXISTS tenant_id UUID;

UPDATE public.faturas AS f
SET tenant_id = e.tenant_id
FROM public.empresas AS e
WHERE f.tenant_id IS NULL
  AND f.empresa_id = e.id
  AND e.tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_faturas_tenant
  ON public.faturas (tenant_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'faturas'
      AND column_name = 'tenant_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.faturas
    WHERE tenant_id IS NULL
  ) THEN
    ALTER TABLE public.faturas
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'financeiro_consolidados_cliente'
  ) THEN
    ALTER TABLE public.financeiro_consolidados_cliente
      ADD COLUMN IF NOT EXISTS tenant_id UUID;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'financeiro_consolidados_cliente'
        AND column_name = 'empresa_id'
    ) THEN
      UPDATE public.financeiro_consolidados_cliente AS fcc
      SET tenant_id = e.tenant_id
      FROM public.empresas AS e
      WHERE fcc.tenant_id IS NULL
        AND fcc.empresa_id = e.id
        AND e.tenant_id IS NOT NULL;
    END IF;
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'financeiro_consolidados_colaborador'
  ) THEN
    ALTER TABLE public.financeiro_consolidados_colaborador
      ADD COLUMN IF NOT EXISTS tenant_id UUID;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'financeiro_consolidados_colaborador'
        AND column_name = 'empresa_id'
    ) THEN
      UPDATE public.financeiro_consolidados_colaborador AS fcc
      SET tenant_id = e.tenant_id
      FROM public.empresas AS e
      WHERE fcc.tenant_id IS NULL
        AND fcc.empresa_id = e.id
        AND e.tenant_id IS NOT NULL;
    END IF;
  END IF;
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
      ADD COLUMN IF NOT EXISTS tenant_id UUID;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'lotes_remessa'
        AND column_name = 'empresa_id'
    ) THEN
      UPDATE public.lotes_remessa AS lr
      SET tenant_id = e.tenant_id
      FROM public.empresas AS e
      WHERE lr.tenant_id IS NULL
        AND lr.empresa_id = e.id
        AND e.tenant_id IS NOT NULL;
    END IF;
  END IF;
END;
$$;

ALTER TABLE public.faturas
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT,
  ADD COLUMN IF NOT EXISTS conciliado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS conciliado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS revertido_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revertido_por UUID REFERENCES auth.users(id);

UPDATE public.faturas
SET status_conciliacao = COALESCE(
  status_conciliacao,
  CASE
    WHEN status = 'pago' THEN 'conciliado'
    ELSE 'aguardando_conciliacao'
  END
);

ALTER TABLE public.faturas
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.faturas
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.faturas
  DROP CONSTRAINT IF EXISTS faturas_status_conciliacao_check;

ALTER TABLE public.faturas
  ADD CONSTRAINT faturas_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.financeiro_consolidados_cliente
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT;

UPDATE public.financeiro_consolidados_cliente
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.financeiro_consolidados_cliente
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.financeiro_consolidados_cliente
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.financeiro_consolidados_cliente
  DROP CONSTRAINT IF EXISTS financeiro_consolidados_cliente_status_conciliacao_check;

ALTER TABLE public.financeiro_consolidados_cliente
  ADD CONSTRAINT financeiro_consolidados_cliente_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.financeiro_consolidados_colaborador
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT;

UPDATE public.financeiro_consolidados_colaborador
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.financeiro_consolidados_colaborador
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.financeiro_consolidados_colaborador
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.financeiro_consolidados_colaborador
  DROP CONSTRAINT IF EXISTS financeiro_consolidados_colaborador_status_conciliacao_check;

ALTER TABLE public.financeiro_consolidados_colaborador
  ADD CONSTRAINT financeiro_consolidados_colaborador_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.lotes_remessa
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT;

UPDATE public.lotes_remessa
SET status_conciliacao = COALESCE(status_conciliacao, 'aguardando_conciliacao');

ALTER TABLE public.lotes_remessa
  ALTER COLUMN status_conciliacao SET DEFAULT 'aguardando_conciliacao';

ALTER TABLE public.lotes_remessa
  ALTER COLUMN status_conciliacao SET NOT NULL;

ALTER TABLE public.lotes_remessa
  DROP CONSTRAINT IF EXISTS lotes_remessa_status_conciliacao_check;

ALTER TABLE public.lotes_remessa
  ADD CONSTRAINT lotes_remessa_status_conciliacao_check
  CHECK (status_conciliacao IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

CREATE TABLE IF NOT EXISTS public.financeiro_conciliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  retorno_item_id UUID NOT NULL REFERENCES public.cnab_retorno_itens(id) ON DELETE CASCADE,
  remessa_arquivo_id UUID REFERENCES public.cnab_remessas_arquivos(id) ON DELETE SET NULL,
  lote_id UUID REFERENCES public.lotes_remessa(id) ON DELETE SET NULL,
  fatura_id UUID REFERENCES public.faturas(id) ON DELETE SET NULL,
  colaborador_id UUID REFERENCES public.colaboradores(id) ON DELETE SET NULL,
  valor_original NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_pago NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_conciliado NUMERIC(15,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aguardando_conciliacao',
  status_anterior TEXT,
  usuario_conciliacao UUID REFERENCES auth.users(id),
  data_conciliacao TIMESTAMPTZ,
  observacao TEXT,
  reversivel BOOLEAN NOT NULL DEFAULT TRUE,
  revertido_em TIMESTAMPTZ,
  revertido_por UUID REFERENCES auth.users(id),
  motivo_reversao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.financeiro_conciliacoes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.financeiro_conciliacoes
  ADD COLUMN IF NOT EXISTS status_anterior TEXT,
  ADD COLUMN IF NOT EXISTS motivo_reversao TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now());

UPDATE public.financeiro_conciliacoes
SET tenant_id = itens.tenant_id
FROM public.cnab_retorno_itens itens
WHERE public.financeiro_conciliacoes.tenant_id IS NULL
  AND itens.id = public.financeiro_conciliacoes.retorno_item_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'financeiro_conciliacoes'
      AND column_name = 'tenant_id'
      AND is_nullable = 'YES'
  ) AND NOT EXISTS (
    SELECT 1
    FROM public.financeiro_conciliacoes
    WHERE tenant_id IS NULL
  ) THEN
    ALTER TABLE public.financeiro_conciliacoes
      ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END;
$$;

ALTER TABLE public.financeiro_conciliacoes
  DROP CONSTRAINT IF EXISTS financeiro_conciliacoes_status_check;

ALTER TABLE public.financeiro_conciliacoes
  ADD CONSTRAINT financeiro_conciliacoes_status_check
  CHECK (status IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido'));

ALTER TABLE public.financeiro_conciliacoes
  DROP CONSTRAINT IF EXISTS financeiro_conciliacoes_status_anterior_check;

ALTER TABLE public.financeiro_conciliacoes
  ADD CONSTRAINT financeiro_conciliacoes_status_anterior_check
  CHECK (
    status_anterior IS NULL OR
    status_anterior IN ('aguardando_conciliacao', 'conciliado', 'divergente', 'rejeitado_banco', 'revertido')
  );

CREATE INDEX IF NOT EXISTS idx_cnab_retorno_itens_status_conciliacao
  ON public.cnab_retorno_itens (tenant_id, status_conciliacao, retorno_arquivo_id);

CREATE INDEX IF NOT EXISTS idx_faturas_status_conciliacao
  ON public.faturas (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_financeiro_consolidados_cliente_status_conciliacao
  ON public.financeiro_consolidados_cliente (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_financeiro_consolidados_colab_status_conciliacao
  ON public.financeiro_consolidados_colaborador (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_lotes_remessa_status_conciliacao
  ON public.lotes_remessa (tenant_id, status_conciliacao);

CREATE INDEX IF NOT EXISTS idx_financeiro_conciliacoes_tenant_status
  ON public.financeiro_conciliacoes (tenant_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_financeiro_conciliacoes_retorno_item_ativo
  ON public.financeiro_conciliacoes (retorno_item_id)
  WHERE status <> 'revertido';

ALTER TABLE public.financeiro_conciliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_conciliacoes_select" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "tenant_isolation_conciliacoes_insert" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "tenant_isolation_conciliacoes_update" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "financeiro_conciliacoes_select" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "financeiro_conciliacoes_insert" ON public.financeiro_conciliacoes;
DROP POLICY IF EXISTS "financeiro_conciliacoes_update" ON public.financeiro_conciliacoes;

CREATE POLICY "financeiro_conciliacoes_select"
  ON public.financeiro_conciliacoes
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id());

CREATE POLICY "financeiro_conciliacoes_insert"
  ON public.financeiro_conciliacoes
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_financeiro_conciliacao_role()
  );

CREATE POLICY "financeiro_conciliacoes_update"
  ON public.financeiro_conciliacoes
  FOR UPDATE TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND public.is_financeiro_conciliacao_role()
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    AND public.is_financeiro_conciliacao_role()
  );

CREATE OR REPLACE FUNCTION public.set_financeiro_conciliacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_financeiro_conciliacoes_updated_at ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_financeiro_conciliacoes_updated_at
  BEFORE INSERT OR UPDATE ON public.financeiro_conciliacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_financeiro_conciliacoes_updated_at();

CREATE OR REPLACE FUNCTION public.calcular_status_conciliacao_agrupado(
  p_total INTEGER,
  p_conciliado INTEGER,
  p_divergente INTEGER,
  p_rejeitado INTEGER,
  p_revertido INTEGER
)
RETURNS TEXT AS $$
BEGIN
  IF COALESCE(p_total, 0) = 0 THEN
    RETURN 'aguardando_conciliacao';
  END IF;

  IF COALESCE(p_conciliado, 0) = p_total THEN
    RETURN 'conciliado';
  END IF;

  IF COALESCE(p_divergente, 0) > 0 THEN
    RETURN 'divergente';
  END IF;

  IF COALESCE(p_rejeitado, 0) = p_total THEN
    RETURN 'rejeitado_banco';
  END IF;

  IF COALESCE(p_revertido, 0) = p_total THEN
    RETURN 'revertido';
  END IF;

  RETURN 'aguardando_conciliacao';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.validate_admin_override()
RETURNS TRIGGER AS $$
DECLARE
  v_justificativa TEXT;
  v_user_role TEXT;
BEGIN
  v_user_role := public.get_user_role();

  IF (
    TG_TABLE_NAME = 'faturas'
    AND OLD.status = 'pago'
    AND NEW.status = 'pendente'
    AND COALESCE(NEW.status_conciliacao, '') = 'revertido'
    AND public.is_financeiro_conciliacao_role()
  ) THEN
    RETURN NEW;
  END IF;

  IF (OLD.status IN ('pago', 'processado', 'fechado', 'consolidado')) THEN
    IF v_user_role IS NULL OR v_user_role != 'Admin' THEN
      RAISE EXCEPTION 'Registro bloqueado por status de imutabilidade (%). Alteração não permitida para seu perfil.', OLD.status;
    END IF;

    BEGIN
      v_justificativa := current_setting('app.override_justification', true);
    EXCEPTION WHEN OTHERS THEN
      v_justificativa := NULL;
    END;

    IF (v_justificativa IS NULL OR v_justificativa = '' OR v_justificativa = 'null') THEN
      RAISE EXCEPTION 'Justificativa obrigatória para alterar registro travado (status: %). Utilize o mecanismo de override.', OLD.status;
    END IF;

    INSERT INTO audit.overrides (
      table_name, record_id, empresa_id, justificativa, dados_anteriores, dados_novos, user_id
    )
    VALUES (
      TG_TABLE_NAME, OLD.id, OLD.empresa_id, v_justificativa, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.sync_financeiro_conciliacao_context(
  p_fatura_id UUID,
  p_lote_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_fatura public.faturas%ROWTYPE;
  v_total INTEGER;
  v_conciliado INTEGER;
  v_divergente INTEGER;
  v_rejeitado INTEGER;
  v_revertido INTEGER;
  v_status TEXT;
  v_lote_id UUID;
BEGIN
  IF p_fatura_id IS NOT NULL THEN
    SELECT *
    INTO v_fatura
    FROM public.faturas
    WHERE id = p_fatura_id;

    IF FOUND THEN
      IF v_fatura.colaborador_id IS NOT NULL THEN
        SELECT
          COUNT(*),
          COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'revertido')
        INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido
        FROM public.faturas
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND colaborador_id = v_fatura.colaborador_id;

        v_status := public.calcular_status_conciliacao_agrupado(v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido);

        UPDATE public.financeiro_consolidados_colaborador
        SET status_conciliacao = v_status
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND colaborador_id = v_fatura.colaborador_id;
      END IF;

      IF v_fatura.cliente_id IS NOT NULL THEN
        SELECT
          COUNT(*),
          COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
          COUNT(*) FILTER (WHERE status_conciliacao = 'revertido')
        INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido
        FROM public.faturas
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND cliente_id = v_fatura.cliente_id;

        v_status := public.calcular_status_conciliacao_agrupado(v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido);

        UPDATE public.financeiro_consolidados_cliente
        SET status_conciliacao = v_status
        WHERE tenant_id = v_fatura.tenant_id
          AND empresa_id = v_fatura.empresa_id
          AND competencia = v_fatura.competencia
          AND cliente_id = v_fatura.cliente_id;
      END IF;

      v_lote_id := COALESCE(p_lote_id, v_fatura.lote_remessa_id);
    ELSE
      v_lote_id := p_lote_id;
    END IF;
  ELSE
    v_lote_id := p_lote_id;
  END IF;

  IF v_lote_id IS NOT NULL THEN
    SELECT
      COUNT(*),
      COUNT(*) FILTER (WHERE status_conciliacao = 'conciliado'),
      COUNT(*) FILTER (WHERE status_conciliacao = 'divergente'),
      COUNT(*) FILTER (WHERE status_conciliacao = 'rejeitado_banco'),
      COUNT(*) FILTER (WHERE status_conciliacao = 'revertido')
    INTO v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido
    FROM public.faturas
    WHERE lote_remessa_id = v_lote_id;

    v_status := public.calcular_status_conciliacao_agrupado(v_total, v_conciliado, v_divergente, v_rejeitado, v_revertido);

    UPDATE public.lotes_remessa
    SET status_conciliacao = v_status
    WHERE id = v_lote_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.guard_cnab_retorno_item_conciliacao()
RETURNS TRIGGER AS $$
DECLARE
  v_is_allowed BOOLEAN;
BEGIN
  v_is_allowed := public.is_financeiro_conciliacao_role();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'O status bancario do retorno nao pode ser alterado manualmente.';
  END IF;

  IF (
    NEW.status_conciliacao IS DISTINCT FROM OLD.status_conciliacao OR
    COALESCE(NEW.observacao_conciliacao, '') IS DISTINCT FROM COALESCE(OLD.observacao_conciliacao, '') OR
    NEW.conciliado_em IS DISTINCT FROM OLD.conciliado_em OR
    NEW.conciliado_por IS DISTINCT FROM OLD.conciliado_por OR
    NEW.revertido_em IS DISTINCT FROM OLD.revertido_em OR
    NEW.revertido_por IS DISTINCT FROM OLD.revertido_por
  ) AND NOT v_is_allowed THEN
    RAISE EXCEPTION 'Usuario sem permissao para alterar a conciliacao.';
  END IF;

  IF OLD.status_conciliacao = 'conciliado' AND NEW.status_conciliacao NOT IN ('conciliado', 'revertido') THEN
    RAISE EXCEPTION 'Item conciliado nao pode ser alterado sem reversao autorizada.';
  END IF;

  IF OLD.status_conciliacao = 'conciliado' AND (
    NEW.valor_esperado IS DISTINCT FROM OLD.valor_esperado OR
    NEW.valor_retornado IS DISTINCT FROM OLD.valor_retornado
  ) THEN
    RAISE EXCEPTION 'Valores de item conciliado nao podem ser alterados silenciosamente.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_cnab_retorno_item_conciliacao ON public.cnab_retorno_itens;
CREATE TRIGGER trg_guard_cnab_retorno_item_conciliacao
  BEFORE UPDATE ON public.cnab_retorno_itens
  FOR EACH ROW EXECUTE FUNCTION public.guard_cnab_retorno_item_conciliacao();

CREATE OR REPLACE FUNCTION public.guard_financeiro_conciliacoes_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'revertido' THEN
    RAISE EXCEPTION 'Conciliacoes revertidas sao imutaveis.';
  END IF;

  IF (
    NEW.retorno_item_id IS DISTINCT FROM OLD.retorno_item_id OR
    NEW.remessa_arquivo_id IS DISTINCT FROM OLD.remessa_arquivo_id OR
    NEW.lote_id IS DISTINCT FROM OLD.lote_id OR
    NEW.fatura_id IS DISTINCT FROM OLD.fatura_id OR
    NEW.colaborador_id IS DISTINCT FROM OLD.colaborador_id OR
    NEW.valor_original IS DISTINCT FROM OLD.valor_original OR
    NEW.valor_pago IS DISTINCT FROM OLD.valor_pago OR
    NEW.valor_conciliado IS DISTINCT FROM OLD.valor_conciliado OR
    COALESCE(NEW.observacao, '') IS DISTINCT FROM COALESCE(OLD.observacao, '')
  ) AND NEW.status <> 'revertido' THEN
    RAISE EXCEPTION 'A conciliacao e append-only e nao aceita alteracao silenciosa de valores.';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'revertido' THEN
    RAISE EXCEPTION 'A conciliacao so pode mudar de status via reversao autorizada.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_financeiro_conciliacoes_update ON public.financeiro_conciliacoes;
CREATE TRIGGER trg_guard_financeiro_conciliacoes_update
  BEFORE UPDATE ON public.financeiro_conciliacoes
  FOR EACH ROW EXECUTE FUNCTION public.guard_financeiro_conciliacoes_update();

CREATE OR REPLACE FUNCTION public.conciliar_retorno_item(
  p_retorno_item_id UUID,
  p_status_conciliacao TEXT,
  p_valor_conciliado NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS SETOF public.financeiro_conciliacoes AS $$
DECLARE
  v_item public.cnab_retorno_itens%ROWTYPE;
  v_conciliacao public.financeiro_conciliacoes%ROWTYPE;
  v_user_id UUID;
  v_acao TEXT;
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para conciliar baixa financeira.';
  END IF;

  IF p_status_conciliacao NOT IN ('conciliado', 'divergente', 'rejeitado_banco') THEN
    RAISE EXCEPTION 'Status de conciliacao invalido: %', p_status_conciliacao;
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = p_retorno_item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de retorno nao encontrado.';
  END IF;

  IF v_item.status_conciliacao = 'conciliado' THEN
    RAISE EXCEPTION 'Item ja conciliado. Use a reversao autorizada antes de nova conciliacao.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_conciliacoes fc
    WHERE fc.retorno_item_id = p_retorno_item_id
      AND fc.status <> 'revertido'
  ) THEN
    RAISE EXCEPTION 'Ja existe conciliacao ativa para este item.';
  END IF;

  INSERT INTO public.financeiro_conciliacoes (
    tenant_id,
    retorno_item_id,
    remessa_arquivo_id,
    lote_id,
    fatura_id,
    colaborador_id,
    valor_original,
    valor_pago,
    valor_conciliado,
    status,
    status_anterior,
    usuario_conciliacao,
    data_conciliacao,
    observacao,
    reversivel
  )
  VALUES (
    v_item.tenant_id,
    v_item.id,
    v_item.remessa_arquivo_id,
    v_item.lote_id,
    v_item.fatura_id,
    v_item.colaborador_id,
    COALESCE(v_item.valor_esperado, 0),
    COALESCE(v_item.valor_retornado, 0),
    COALESCE(p_valor_conciliado, v_item.valor_retornado, 0),
    p_status_conciliacao,
    v_item.status_conciliacao,
    v_user_id,
    timezone('utc', now()),
    NULLIF(BTRIM(COALESCE(p_observacao, '')), ''),
    TRUE
  )
  RETURNING *
  INTO v_conciliacao;

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = p_status_conciliacao,
    observacao_conciliacao = NULLIF(BTRIM(COALESCE(p_observacao, '')), ''),
    conciliado_em = timezone('utc', now()),
    conciliado_por = v_user_id,
    revertido_em = NULL,
    revertido_por = NULL
  WHERE id = v_item.id;

  IF v_item.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN 'pago'
        ELSE 'pendente'
      END,
      status_conciliacao = p_status_conciliacao,
      motivo_rejeicao = CASE
        WHEN p_status_conciliacao = 'rejeitado_banco' THEN NULLIF(BTRIM(COALESCE(p_observacao, '')), '')
        ELSE motivo_rejeicao
      END,
      data_pagamento = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN COALESCE(v_item.data_ocorrencia, CURRENT_DATE)
        ELSE NULL
      END,
      conciliado_em = timezone('utc', now()),
      conciliado_por = v_user_id,
      revertido_em = NULL,
      revertido_por = NULL
    WHERE id = v_item.fatura_id;
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(v_item.fatura_id, v_item.lote_id);

  v_acao := CASE p_status_conciliacao
    WHEN 'conciliado' THEN 'conciliacao_aprovada'
    WHEN 'divergente' THEN 'conciliacao_divergente'
    ELSE 'conciliacao_rejeitada'
  END;

  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    acao,
    usuario_id,
    detalhes
  )
  VALUES (
    v_item.tenant_id,
    v_item.remessa_arquivo_id,
    v_item.lote_id,
    v_acao,
    v_user_id,
    jsonb_build_object(
      'retorno_item_id', v_item.id,
      'fatura_id', v_item.fatura_id,
      'status_banco', v_item.status,
      'status_conciliacao', p_status_conciliacao,
      'valor_original', COALESCE(v_item.valor_esperado, 0),
      'valor_pago', COALESCE(v_item.valor_retornado, 0),
      'valor_conciliado', COALESCE(p_valor_conciliado, v_item.valor_retornado, 0),
      'observacao', NULLIF(BTRIM(COALESCE(p_observacao, '')), '')
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = v_conciliacao.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reverter_conciliacao_financeira(
  p_conciliacao_id UUID,
  p_motivo TEXT
)
RETURNS SETOF public.financeiro_conciliacoes AS $$
DECLARE
  v_conciliacao public.financeiro_conciliacoes%ROWTYPE;
  v_item public.cnab_retorno_itens%ROWTYPE;
  v_user_id UUID;
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para reverter conciliacao.';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_motivo, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Motivo da reversao e obrigatorio.';
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_conciliacao
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliacao nao encontrada.';
  END IF;

  IF NOT COALESCE(v_conciliacao.reversivel, FALSE) THEN
    RAISE EXCEPTION 'Esta conciliacao nao e reversivel.';
  END IF;

  IF v_conciliacao.status = 'revertido' THEN
    RAISE EXCEPTION 'Esta conciliacao ja foi revertida.';
  END IF;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = v_conciliacao.retorno_item_id
  FOR UPDATE;

  UPDATE public.financeiro_conciliacoes
  SET
    status_anterior = v_conciliacao.status,
    status = 'revertido',
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id,
    motivo_reversao = NULLIF(BTRIM(COALESCE(p_motivo, '')), ''),
    observacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao, '')), '') IS NULL THEN NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
      ELSE observacao || ' | Reversao: ' || NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
    END
  WHERE id = p_conciliacao_id;

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = 'revertido',
    observacao_conciliacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao_conciliacao, '')), '') IS NULL THEN NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
      ELSE observacao_conciliacao || ' | Reversao: ' || NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
    END,
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id
  WHERE id = v_conciliacao.retorno_item_id;

  IF v_conciliacao.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = 'pendente',
      status_conciliacao = 'revertido',
      data_pagamento = NULL,
      revertido_em = timezone('utc', now()),
      revertido_por = v_user_id
    WHERE id = v_conciliacao.fatura_id;
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(v_conciliacao.fatura_id, COALESCE(v_conciliacao.lote_id, v_item.lote_id));

  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    acao,
    usuario_id,
    detalhes
  )
  VALUES (
    v_conciliacao.tenant_id,
    v_conciliacao.remessa_arquivo_id,
    COALESCE(v_conciliacao.lote_id, v_item.lote_id),
    'conciliacao_revertida',
    v_user_id,
    jsonb_build_object(
      'conciliacao_id', v_conciliacao.id,
      'retorno_item_id', v_conciliacao.retorno_item_id,
      'status_anterior', v_conciliacao.status,
      'motivo', NULLIF(BTRIM(COALESCE(p_motivo, '')), '')
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.conciliar_retorno_item(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverter_conciliacao_financeira(UUID, TEXT) TO authenticated;
-- ============================================================
-- FASE 8.3 - Hardening de homologacao
-- Objetivo:
--   1. Fechar bypass cross-tenant nas RPCs SECURITY DEFINER
--   2. Exigir observacao tambem no backend para divergencia/rejeicao
-- ============================================================

CREATE OR REPLACE FUNCTION public.conciliar_retorno_item(
  p_retorno_item_id UUID,
  p_status_conciliacao TEXT,
  p_valor_conciliado NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS SETOF public.financeiro_conciliacoes AS $$
DECLARE
  v_item public.cnab_retorno_itens%ROWTYPE;
  v_conciliacao public.financeiro_conciliacoes%ROWTYPE;
  v_user_id UUID;
  v_acao TEXT;
  v_observacao_limpa TEXT;
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para conciliar baixa financeira.';
  END IF;

  IF p_status_conciliacao NOT IN ('conciliado', 'divergente', 'rejeitado_banco') THEN
    RAISE EXCEPTION 'Status de conciliacao invalido: %', p_status_conciliacao;
  END IF;

  v_observacao_limpa := NULLIF(BTRIM(COALESCE(p_observacao, '')), '');

  IF p_status_conciliacao IN ('divergente', 'rejeitado_banco')
    AND v_observacao_limpa IS NULL THEN
    RAISE EXCEPTION 'Observacao obrigatoria para divergencia ou rejeicao bancaria.';
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = p_retorno_item_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de retorno nao encontrado para o tenant atual.';
  END IF;

  IF v_item.status_conciliacao = 'conciliado' THEN
    RAISE EXCEPTION 'Item ja conciliado. Use a reversao autorizada antes de nova conciliacao.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.financeiro_conciliacoes fc
    WHERE fc.retorno_item_id = p_retorno_item_id
      AND fc.tenant_id = public.current_tenant_id()
      AND fc.status <> 'revertido'
  ) THEN
    RAISE EXCEPTION 'Ja existe conciliacao ativa para este item.';
  END IF;

  INSERT INTO public.financeiro_conciliacoes (
    tenant_id,
    retorno_item_id,
    remessa_arquivo_id,
    lote_id,
    fatura_id,
    colaborador_id,
    valor_original,
    valor_pago,
    valor_conciliado,
    status,
    status_anterior,
    usuario_conciliacao,
    data_conciliacao,
    observacao,
    reversivel
  )
  VALUES (
    v_item.tenant_id,
    v_item.id,
    v_item.remessa_arquivo_id,
    v_item.lote_id,
    v_item.fatura_id,
    v_item.colaborador_id,
    COALESCE(v_item.valor_esperado, 0),
    COALESCE(v_item.valor_retornado, 0),
    COALESCE(p_valor_conciliado, v_item.valor_retornado, 0),
    p_status_conciliacao,
    v_item.status_conciliacao,
    v_user_id,
    timezone('utc', now()),
    v_observacao_limpa,
    TRUE
  )
  RETURNING *
  INTO v_conciliacao;

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = p_status_conciliacao,
    observacao_conciliacao = v_observacao_limpa,
    conciliado_em = timezone('utc', now()),
    conciliado_por = v_user_id,
    revertido_em = NULL,
    revertido_por = NULL
  WHERE id = v_item.id
    AND tenant_id = public.current_tenant_id();

  IF v_item.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN 'pago'
        ELSE 'pendente'
      END,
      status_conciliacao = p_status_conciliacao,
      motivo_rejeicao = CASE
        WHEN p_status_conciliacao = 'rejeitado_banco' THEN v_observacao_limpa
        ELSE motivo_rejeicao
      END,
      data_pagamento = CASE
        WHEN p_status_conciliacao = 'conciliado' THEN COALESCE(v_item.data_ocorrencia, CURRENT_DATE)
        ELSE NULL
      END,
      conciliado_em = timezone('utc', now()),
      conciliado_por = v_user_id,
      revertido_em = NULL,
      revertido_por = NULL
    WHERE id = v_item.fatura_id
      AND tenant_id = public.current_tenant_id();
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(v_item.fatura_id, v_item.lote_id);

  v_acao := CASE p_status_conciliacao
    WHEN 'conciliado' THEN 'conciliacao_aprovada'
    WHEN 'divergente' THEN 'conciliacao_divergente'
    ELSE 'conciliacao_rejeitada'
  END;

  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    acao,
    usuario_id,
    detalhes
  )
  VALUES (
    v_item.tenant_id,
    v_item.remessa_arquivo_id,
    v_item.lote_id,
    v_acao,
    v_user_id,
    jsonb_build_object(
      'retorno_item_id', v_item.id,
      'fatura_id', v_item.fatura_id,
      'status_banco', v_item.status,
      'status_conciliacao', p_status_conciliacao,
      'valor_original', COALESCE(v_item.valor_esperado, 0),
      'valor_pago', COALESCE(v_item.valor_retornado, 0),
      'valor_conciliado', COALESCE(p_valor_conciliado, v_item.valor_retornado, 0),
      'observacao', v_observacao_limpa
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = v_conciliacao.id
    AND tenant_id = public.current_tenant_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reverter_conciliacao_financeira(
  p_conciliacao_id UUID,
  p_motivo TEXT
)
RETURNS SETOF public.financeiro_conciliacoes AS $$
DECLARE
  v_conciliacao public.financeiro_conciliacoes%ROWTYPE;
  v_item public.cnab_retorno_itens%ROWTYPE;
  v_user_id UUID;
  v_motivo_limpo TEXT;
BEGIN
  IF NOT public.is_financeiro_conciliacao_role() THEN
    RAISE EXCEPTION 'Usuario sem permissao para reverter conciliacao.';
  END IF;

  v_motivo_limpo := NULLIF(BTRIM(COALESCE(p_motivo, '')), '');

  IF v_motivo_limpo IS NULL THEN
    RAISE EXCEPTION 'Motivo da reversao e obrigatorio.';
  END IF;

  SELECT auth.uid() INTO v_user_id;

  SELECT *
  INTO v_conciliacao
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conciliacao nao encontrada para o tenant atual.';
  END IF;

  IF NOT COALESCE(v_conciliacao.reversivel, FALSE) THEN
    RAISE EXCEPTION 'Esta conciliacao nao e reversivel.';
  END IF;

  IF v_conciliacao.status = 'revertido' THEN
    RAISE EXCEPTION 'Esta conciliacao ja foi revertida.';
  END IF;

  SELECT *
  INTO v_item
  FROM public.cnab_retorno_itens
  WHERE id = v_conciliacao.retorno_item_id
    AND tenant_id = public.current_tenant_id()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item de retorno associado nao encontrado para o tenant atual.';
  END IF;

  UPDATE public.financeiro_conciliacoes
  SET
    status_anterior = v_conciliacao.status,
    status = 'revertido',
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id,
    motivo_reversao = v_motivo_limpo,
    observacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao, '')), '') IS NULL THEN v_motivo_limpo
      ELSE observacao || ' | Reversao: ' || v_motivo_limpo
    END
  WHERE id = p_conciliacao_id
    AND tenant_id = public.current_tenant_id();

  UPDATE public.cnab_retorno_itens
  SET
    status_conciliacao = 'revertido',
    observacao_conciliacao = CASE
      WHEN NULLIF(BTRIM(COALESCE(observacao_conciliacao, '')), '') IS NULL THEN v_motivo_limpo
      ELSE observacao_conciliacao || ' | Reversao: ' || v_motivo_limpo
    END,
    revertido_em = timezone('utc', now()),
    revertido_por = v_user_id
  WHERE id = v_conciliacao.retorno_item_id
    AND tenant_id = public.current_tenant_id();

  IF v_conciliacao.fatura_id IS NOT NULL THEN
    UPDATE public.faturas
    SET
      status = 'pendente',
      status_conciliacao = 'revertido',
      data_pagamento = NULL,
      revertido_em = timezone('utc', now()),
      revertido_por = v_user_id
    WHERE id = v_conciliacao.fatura_id
      AND tenant_id = public.current_tenant_id();
  END IF;

  PERFORM public.sync_financeiro_conciliacao_context(
    v_conciliacao.fatura_id,
    COALESCE(v_conciliacao.lote_id, v_item.lote_id)
  );

  INSERT INTO public.cnab_auditoria_bancaria (
    tenant_id,
    arquivo_id,
    lote_id,
    acao,
    usuario_id,
    detalhes
  )
  VALUES (
    v_conciliacao.tenant_id,
    v_conciliacao.remessa_arquivo_id,
    COALESCE(v_conciliacao.lote_id, v_item.lote_id),
    'conciliacao_revertida',
    v_user_id,
    jsonb_build_object(
      'conciliacao_id', v_conciliacao.id,
      'retorno_item_id', v_conciliacao.retorno_item_id,
      'status_anterior', v_conciliacao.status,
      'motivo', v_motivo_limpo
    )
  );

  RETURN QUERY
  SELECT *
  FROM public.financeiro_conciliacoes
  WHERE id = p_conciliacao_id
    AND tenant_id = public.current_tenant_id();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.conciliar_retorno_item(UUID, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reverter_conciliacao_financeira(UUID, TEXT) TO authenticated;
