-- Tabela de convites
CREATE TABLE IF NOT EXISTS tenant_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'rh', 'financeiro', 'encarregado', 'user')),
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS para convites
ALTER TABLE tenant_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Convites visíveis para admins do tenant" ON tenant_invitations
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Qualquer um com token válido pode aceitar convite" ON tenant_invitations
    FOR SELECT USING (expires_at > NOW());

-- Function para aceitar convite
CREATE OR REPLACE FUNCTION accept_tenant_invitation(p_token TEXT, p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    invitation tenant_invitations%ROWTYPE;
    profile_id UUID;
BEGIN
    -- Buscar convite pelo token
    SELECT * INTO invitation 
    FROM tenant_invitations 
    WHERE token = p_token 
      AND expires_at > NOW()
      AND accepted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite inválido ou expirado';
    END IF;

    -- Verificar se o email corresponde
    IF invitation.email != (SELECT email FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
    END IF;

    -- Criar profile vinculado ao tenant do convite
    INSERT INTO profiles (user_id, tenant_id, full_name, role)
    VALUES (
        p_user_id,
        invitation.tenant_id,
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id),
        invitation.role
    )
    RETURNING id INTO profile_id;

    -- Marcar convite como aceito
    UPDATE tenant_invitations 
    SET accepted_at = NOW() 
    WHERE id = invitation.id;

    RETURN profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;