import pkg from 'pg';
const { Client } = pkg;

async function setup() {
  const client = new Client('postgresql://postgres:postgres@127.0.0.1:54323/postgres');
  await client.connect();
  console.log('Connected to isolated postgres 54323.');

  await client.query(`
    CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    CREATE SCHEMA IF NOT EXISTS auth;

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID AS $$
    BEGIN
        RETURN COALESCE(
            NULLIF(current_setting('app.current_user_id', true), '')::UUID,
            'a0000000-0000-0000-0000-000000000001'::UUID
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

    -- Sequences / Counters
    CREATE TABLE IF NOT EXISTS public.cnab_sequencial_controle (
        tenant_id UUID NOT NULL,
        conta_bancaria_id UUID NOT NULL,
        banco_codigo TEXT NOT NULL,
        ultimo_sequencial INTEGER NOT NULL DEFAULT 1,
        updated_at TIMESTAMPTZ DEFAULT now(),
        PRIMARY KEY (tenant_id, conta_bancaria_id, banco_codigo)
    );

    CREATE OR REPLACE FUNCTION public.get_next_cnab_sequencial(
        p_tenant_id UUID,
        p_conta_bancaria_id UUID,
        p_banco_codigo TEXT
    ) RETURNS INTEGER AS $$
    DECLARE
        v_seq INTEGER;
    BEGIN
        INSERT INTO public.cnab_sequencial_controle (tenant_id, conta_bancaria_id, banco_codigo, ultimo_sequencial, updated_at)
        VALUES (p_tenant_id, p_conta_bancaria_id, p_banco_codigo, 1, now())
        ON CONFLICT (tenant_id, conta_bancaria_id, banco_codigo)
        DO UPDATE SET ultimo_sequencial = cnab_sequencial_controle.ultimo_sequencial + 1, updated_at = now()
        RETURNING ultimo_sequencial INTO v_seq;

        RETURN v_seq;
    END;
    $$ LANGUAGE plpgsql;

    -- Tabelas principais
    CREATE TABLE IF NOT EXISTS public.empresas (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        nome TEXT NOT NULL,
        is_teste BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.colaboradores (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID REFERENCES public.empresas(id),
        nome TEXT NOT NULL,
        cpf TEXT,
        is_teste BOOLEAN DEFAULT false
    );

    CREATE TABLE IF NOT EXISTS public.contas_bancarias_empresa (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        ativo BOOLEAN DEFAULT true,
        banco_codigo TEXT NOT NULL,
        banco_nome TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.faturas (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        status TEXT,
        updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.rh_financeiro_lotes (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        status TEXT,
        competencia TEXT,
        updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.rh_financeiro_lote_itens (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        lote_id UUID NOT NULL REFERENCES public.rh_financeiro_lotes(id),
        colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
        status TEXT
    );

    CREATE TABLE IF NOT EXISTS public.lotes_remessa (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        status TEXT,
        updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.intermitentes_lotes_fechamento (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        competencia VARCHAR(7),
        status TEXT NOT NULL DEFAULT 'FECHADO_FINANCEIRO',
        updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.lancamentos_intermitentes (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        lote_fechamento_id UUID REFERENCES public.intermitentes_lotes_fechamento(id),
        colaborador_id UUID NOT NULL REFERENCES public.colaboradores(id),
        status_pipeline TEXT,
        valor_total NUMERIC(14,2)
    );

    CREATE TABLE IF NOT EXISTS public.diaristas_lotes_fechamento (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        status TEXT NOT NULL DEFAULT 'FECHADO_FINANCEIRO',
        status_conciliacao TEXT,
        updated_at TIMESTAMPTZ
    );

    CREATE TABLE IF NOT EXISTS public.lancamentos_diaristas (
        id UUID PRIMARY KEY,
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        lote_fechamento_id UUID REFERENCES public.diaristas_lotes_fechamento(id),
        status TEXT
    );

    CREATE TABLE IF NOT EXISTS public.cnab_remessas_arquivos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL,
        empresa_id UUID NOT NULL REFERENCES public.empresas(id),
        lote_id UUID,
        diaristas_lote_id UUID,
        intermitentes_lote_id UUID,
        conta_bancaria_id UUID NOT NULL REFERENCES public.contas_bancarias_empresa(id),
        nome_arquivo TEXT NOT NULL,
        conteudo_arquivo TEXT,
        competencia TEXT,
        observacoes TEXT,
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

    CREATE TABLE IF NOT EXISTS public.cnab_remessa_itens (
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

    CREATE TABLE IF NOT EXISTS public.cnab_auditoria_bancaria (
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

    -- Trigger de imutabilidade canônica e estrita
    CREATE OR REPLACE FUNCTION public.check_cnab_remessa_imutabilidade()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    BEGIN
        IF TG_OP = 'UPDATE' THEN
            IF OLD.status IN ('gerado', 'baixado', 'enviado', 'enviado_manual', 'homologado') THEN
                IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
                    RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Tenants.';
                END IF;
                IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
                    RAISE EXCEPTION 'Imutabilidade violada: Não é permitido transferir a Remessa entre Empresas.';
                END IF;
                IF NEW.conta_bancaria_id IS DISTINCT FROM OLD.conta_bancaria_id THEN
                    RAISE EXCEPTION 'Imutabilidade violada: Conta Bancária não pode ser alterada em arquivo já gerado.';
                END IF;
                IF NEW.hash_arquivo IS DISTINCT FROM OLD.hash_arquivo THEN
                    RAISE EXCEPTION 'Imutabilidade violada: Hash do Arquivo (Checksum) corrompido ou alterado indevidamente.';
                END IF;
                IF NEW.conteudo_arquivo IS DISTINCT FROM OLD.conteudo_arquivo THEN
                    RAISE EXCEPTION 'Imutabilidade violada: O conteúdo em texto do CNAB não pode ser alterado após registro.';
                END IF;
                IF NEW.total_valor IS DISTINCT FROM OLD.total_valor THEN
                    RAISE EXCEPTION 'Imutabilidade violada: O Valor Total é imutável.';
                END IF;
                IF NEW.total_registros IS DISTINCT FROM OLD.total_registros THEN
                    RAISE EXCEPTION 'Imutabilidade violada: O Volume de Registros (Linhas) é imutável.';
                END IF;
                IF NEW.sequencial_arquivo IS DISTINCT FROM OLD.sequencial_arquivo THEN
                    RAISE EXCEPTION 'Imutabilidade violada: O Sequencial Bancário é estritamente fixo.';
                END IF;
                IF NEW.status = 'cancelado' AND OLD.status IN ('enviado', 'enviado_manual', 'homologado', 'processado') THEN
                     RAISE EXCEPTION 'Workflow violado: Arquivos submetidos / enviados não podem mais ser cancelados.';
                END IF;
            END IF;
        END IF;
        RETURN NEW;
    END;
    $$;

    DROP TRIGGER IF EXISTS enforce_cnab_remessa_imutabilidade ON public.cnab_remessas_arquivos;
    CREATE TRIGGER enforce_cnab_remessa_imutabilidade
        BEFORE UPDATE ON public.cnab_remessas_arquivos
        FOR EACH ROW
        EXECUTE FUNCTION public.check_cnab_remessa_imutabilidade();
  `);

  console.log('Isolated DB setup successfully executed!');
  await client.end();
}

setup().catch(console.error);
