-- Tabela de tenants (empresas/contas)
CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar tenant_id e role na tabela profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'user'));

-- Habilitar RLS nas tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para tenants
CREATE POLICY "Tenants são visíveis para membros do tenant" ON tenants
    FOR SELECT USING (
        id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Admin pode criar tenants" ON tenants
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admin pode atualizar tenant" ON tenants
    FOR UPDATE USING (
        id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

-- Políticas para profiles
CREATE POLICY "Profiles visíveis para membros do tenant" ON profiles
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users podem atualizar próprio profile" ON profiles
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admin pode criar profiles no tenant" ON profiles
    FOR INSERT WITH CHECK (
        auth.uid() IN (SELECT user_id FROM profiles WHERE tenant_id = profiles.tenant_id AND role = 'admin')
    );