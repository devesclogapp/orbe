-- Setup Schema Isolado para Testes do FIX-HML-02
DO $roles$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
END
$roles$;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS auth;

-- Stubs de contexto e autenticação
CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('app.current_user_id', true), '')::UUID,
        'a0000000-0000-0000-0000-000000000001'::UUID
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('app.current_role', true),
        'authenticated'
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.current_tenant_id() RETURNS UUID AS $$
BEGIN
    RETURN COALESCE(
        NULLIF(current_setting('app.current_tenant_id', true), '')::UUID,
        'e0000000-0000-0000-0000-000000000001'::UUID
    );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.get_next_cnab_sequencial(
    p_tenant_id UUID,
    p_conta_bancaria_id UUID,
    p_banco_codigo TEXT
) RETURNS INTEGER AS $$
BEGIN
    RETURN 101;
END;
$$ LANGUAGE plpgsql;

-- Tabelas de Suporte
DROP TABLE IF EXISTS public.cnab_auditoria_bancaria CASCADE;
DROP TABLE IF EXISTS public.cnab_remessa_itens CASCADE;
DROP TABLE IF EXISTS public.cnab_remessas_arquivos CASCADE;
DROP TABLE IF EXISTS public.rh_financeiro_lote_itens CASCADE;
DROP TABLE IF EXISTS public.contas_bancarias_empresa CASCADE;
DROP TABLE IF EXISTS public.faturas CASCADE;
DROP TABLE IF EXISTS public.receitas_operacionais_itens CASCADE;
DROP TABLE IF EXISTS public.receitas_operacionais CASCADE;
DROP TABLE IF EXISTS public.custos_extras_operacionais CASCADE;
DROP TABLE IF EXISTS public.servicos_extras_operacionais CASCADE;
DROP TABLE IF EXISTS public.operacoes_producao CASCADE;
DROP TABLE IF EXISTS public.colaboradores CASCADE;
DROP TABLE IF EXISTS public.empresas CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.lancamentos_diaristas CASCADE;
DROP TABLE IF EXISTS public.diaristas_lotes_fechamento CASCADE;
DROP TABLE IF EXISTS public.intermitentes_lotes_fechamento CASCADE;
DROP TABLE IF EXISTS public.rh_financeiro_lotes CASCADE;
DROP TABLE IF EXISTS public.financeiro_consolidados_cliente CASCADE;
DROP TABLE IF EXISTS public.financeiro_consolidados_colaborador CASCADE;

CREATE TABLE public.empresas (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    nome TEXT NOT NULL,
    is_teste BOOLEAN DEFAULT false
);

CREATE TABLE public.colaboradores (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    nome TEXT NOT NULL,
    is_teste BOOLEAN DEFAULT false
);

CREATE TABLE public.operacoes_producao (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    data_operacao DATE,
    status TEXT,
    status_rh TEXT,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    motivo_exclusao TEXT,
    atualizado_em TIMESTAMPTZ
);

CREATE TABLE public.servicos_extras_operacionais (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    data DATE,
    pipeline_status TEXT,
    status_pagamento TEXT,
    justificativa_devolucao TEXT,
    atualizado_em TIMESTAMPTZ
);

CREATE TABLE public.custos_extras_operacionais (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    data DATE,
    pipeline_status TEXT,
    status_pagamento TEXT,
    observacao TEXT,
    deleted_at TIMESTAMPTZ,
    atualizado_em TIMESTAMPTZ
);

CREATE TABLE public.receitas_operacionais (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    status TEXT,
    observacao TEXT,
    updated_at TIMESTAMPTZ,
    competencia VARCHAR(7)
);

CREATE TABLE public.receitas_operacionais_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    receita_id UUID NOT NULL REFERENCES public.receitas_operacionais(id),
    operacao_id UUID REFERENCES public.operacoes_producao(id),
    servico_extra_id UUID REFERENCES public.servicos_extras_operacionais(id)
);

CREATE TABLE public.faturas (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    colaborador_id UUID REFERENCES public.colaboradores(id),
    status TEXT,
    updated_at TIMESTAMPTZ,
    motivo_rejeicao TEXT,
    competencia VARCHAR(7)
);

CREATE TABLE public.contas_bancarias_empresa (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    ativo BOOLEAN DEFAULT true,
    banco_codigo TEXT NOT NULL,
    banco_nome TEXT NOT NULL
);

CREATE TABLE public.rh_financeiro_lote_itens (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL,
    colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
    status TEXT
);

CREATE TABLE public.cnab_remessas_arquivos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    lote_id UUID,
    conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias_empresa(id),
    nome_arquivo TEXT NOT NULL,
    sequencial_arquivo INTEGER,
    hash_arquivo TEXT,
    total_registros INTEGER,
    total_valor NUMERIC,
    modo TEXT NOT NULL,
    status TEXT NOT NULL,
    usuario_geracao UUID,
    data_geracao TIMESTAMPTZ,
    banco_codigo TEXT,
    banco_nome TEXT
);

CREATE TABLE public.cnab_remessa_itens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    remessa_id UUID NOT NULL REFERENCES public.cnab_remessas_arquivos(id),
    tenant_id UUID NOT NULL,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    origem_tipo TEXT NOT NULL,
    origem_id UUID NOT NULL,
    fatura_id UUID,
    lote_item_id UUID,
    valor NUMERIC NOT NULL,
    status TEXT NOT NULL,
    criado_por UUID
);

CREATE TABLE public.cnab_auditoria_bancaria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    arquivo_id UUID,
    lote_id UUID,
    acao TEXT NOT NULL,
    usuario_id UUID,
    usuario_nome TEXT,
    detalhes JSONB,
    ip_address TEXT
);

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY,
    user_id UUID,
    role TEXT
);

CREATE TABLE public.lancamentos_diaristas (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    tenant_id UUID NOT NULL,
    status TEXT,
    data_lancamento DATE
);

CREATE TABLE public.diaristas_lotes_fechamento (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    tenant_id UUID NOT NULL,
    status TEXT,
    mes_referencia TEXT,
    updated_at TIMESTAMPTZ
);

CREATE TABLE public.intermitentes_lotes_fechamento (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    tenant_id UUID NOT NULL,
    status TEXT,
    competencia TEXT,
    updated_at TIMESTAMPTZ
);

CREATE TABLE public.rh_financeiro_lotes (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    tenant_id UUID NOT NULL,
    status TEXT,
    competencia TEXT,
    updated_at TIMESTAMPTZ
);

CREATE TABLE public.financeiro_consolidados_cliente (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    tenant_id UUID NOT NULL,
    status TEXT,
    competencia TEXT
);

CREATE TABLE public.financeiro_consolidados_colaborador (
    id UUID PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id),
    tenant_id UUID NOT NULL,
    status TEXT,
    competencia TEXT
);
