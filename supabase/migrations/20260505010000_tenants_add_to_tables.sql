-- Adicionar tenant_id na tabela empresas
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Adicionar tenant_id nas tabelas que não têm empresa_id
ALTER TABLE regras_fechamento ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE ciclos_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE lote_pagamento_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE lancamentos_adicionais_diaristas ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE regras_financeiras ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE ponto ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE operation_audit ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
ALTER TABLE ponto_audit ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);

-- Adicionar função para obter tenant_id do usuário atual
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Políticas RLS para empresas - usuário só vê empresas do seu tenant
DROP POLICY IF EXISTS "Users see only their tenant companies" ON empresas;
CREATE POLICY "Users see only their tenant companies" ON empresas
    FOR SELECT USING (
        tenant_id = auth.current_tenant_id()
        OR auth.current_tenant_id() IS NULL
    );

-- Políticas RLS para tabelas com empresa_id
DROP POLICY IF EXISTS "Users can only see their tenant data" ON operacoes;
CREATE POLICY "Users can only see their tenant data" ON operacoes
    FOR SELECT USING (
        empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
        OR auth.current_tenant_id() IS NULL
    );

DROP POLICY IF EXISTS "Users can only see their tenant data" ON operacoes_producao;
CREATE POLICY "Users can only see their tenant data" ON operacoes_producao
    FOR SELECT USING (
        empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
        OR auth.current_tenant_id() IS NULL
    );

DROP POLICY IF EXISTS "Users can only see their tenant data" ON custos_extras_operacionais;
CREATE POLICY "Users can only see their tenant data" ON custos_extras_operacionais
    FOR SELECT USING (
        empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
        OR auth.current_tenant_id() IS NULL
    );

DROP POLICY IF EXISTS "Users can only see their tenant data" ON colaboradores;
CREATE POLICY "Users can only see their tenant data" ON colaboradores
    FOR SELECT USING (
        empresa_id IN (SELECT id FROM empresas WHERE tenant_id = auth.current_tenant_id())
        OR auth.current_tenant_id() IS NULL
    );

DROP POLICY IF EXISTS "Users can only see their tenant data" ON ponto;
CREATE POLICY "Users can only see their tenant data" ON ponto
    FOR SELECT USING (
        tenant_id = auth.current_tenant_id()
        OR auth.current_tenant_id() IS NULL
    );

-- Função para migrar empresas existentes para tenants
CREATE OR REPLACE FUNCTION migration.create_tenants_from_empresas()
RETURNS void AS $$
DECLARE
    emp RECORD;
    tenant_uuid UUID;
BEGIN
    FOR emp IN SELECT id, nome FROM empresas LOOP
        tenant_uuid := gen_random_uuid();
        
        INSERT INTO tenants (id, name, created_by)
        VALUES (tenant_uuid, emp.nome, NULL);
        
        UPDATE empresas SET tenant_id = tenant_uuid WHERE id = emp.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;