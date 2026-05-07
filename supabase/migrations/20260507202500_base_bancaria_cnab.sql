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
