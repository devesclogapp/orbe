    -- ============================================================
    -- AUDITORIA MULTI-TENANT — Correções Críticas, Altas e Médias
    -- Data: 2026-05-12
    -- Ref: auditoria_multitenant.md
    -- ============================================================

    -- ============================================================
    -- 🔴 CRÍTICO 1: contratos e registros_ponto sem isolamento
    -- Tabelas do schema inicial com USING (true) — sem tenant_id
    -- ============================================================

    -- contratos — adicionar tenant_id e policy correta
    ALTER TABLE public.contratos
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

    -- Popula dados legados com o tenant do usuário admin principal
    -- (ajustar se houver múltiplos tenants com contratos)
    UPDATE public.contratos
    SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
    WHERE tenant_id IS NULL;

    DROP POLICY IF EXISTS "Acesso total autenticado para contratos"     ON public.contratos;
    DROP POLICY IF EXISTS "contratos_tenant_all"                        ON public.contratos;

    ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "contratos_tenant_all" ON public.contratos
    FOR ALL TO authenticated
    USING  (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

    -- Trigger para auto-população em futuros INSERTs
    DROP TRIGGER IF EXISTS trg_auto_tenant_contratos ON public.contratos;
    CREATE TRIGGER trg_auto_tenant_contratos
    BEFORE INSERT ON public.contratos
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

    CREATE INDEX IF NOT EXISTS idx_contratos_tenant_id ON public.contratos(tenant_id);

    -- ----

    -- registros_ponto — adicionar tenant_id e policy correta
    ALTER TABLE public.registros_ponto
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

    -- Tenta popular via colaborador → empresa → tenant
    UPDATE public.registros_ponto rp
    SET tenant_id = e.tenant_id
    FROM public.colaboradores c
    JOIN public.empresas e ON c.empresa_id = e.id
    WHERE rp.colaborador_id = c.id
    AND rp.tenant_id IS NULL
    AND e.tenant_id IS NOT NULL;

    -- Fallback: registros ainda sem tenant recebem o tenant principal
    UPDATE public.registros_ponto
    SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
    WHERE tenant_id IS NULL;

    DROP POLICY IF EXISTS "Acesso total autenticado para registros_ponto" ON public.registros_ponto;
    DROP POLICY IF EXISTS "registros_ponto_tenant_all"                     ON public.registros_ponto;

    ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "registros_ponto_tenant_all" ON public.registros_ponto
    FOR ALL TO authenticated
    USING  (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

    -- Trigger para auto-população em futuros INSERTs
    DROP TRIGGER IF EXISTS trg_auto_tenant_registros_ponto ON public.registros_ponto;
    CREATE OR REPLACE FUNCTION public.auto_set_tenant_registros_ponto()
    RETURNS TRIGGER AS $$
    BEGIN
    -- Tenta resolver via colaborador → empresa → tenant
    IF NEW.tenant_id IS NULL AND NEW.colaborador_id IS NOT NULL THEN
        NEW.tenant_id := (
        SELECT e.tenant_id
        FROM public.colaboradores c
        JOIN public.empresas e ON c.empresa_id = e.id
        WHERE c.id = NEW.colaborador_id
        LIMIT 1
        );
    END IF;
    -- Fallback: tenant do usuário logado
    IF NEW.tenant_id IS NULL THEN
        NEW.tenant_id := public.current_tenant_id();
    END IF;
    RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER trg_auto_tenant_registros_ponto
    BEFORE INSERT ON public.registros_ponto
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_registros_ponto();

    CREATE INDEX IF NOT EXISTS idx_registros_ponto_tenant_id ON public.registros_ponto(tenant_id);

    -- ============================================================
    -- 🟠 ALTO 1: Policy anon em tenant_invitations permite enumeração
    -- Risco: qualquer requisição não autenticada lista todos convites
    -- ============================================================

    DROP POLICY IF EXISTS "Qualquer um com token válido pode aceitar convite" ON public.tenant_invitations;
    DROP POLICY IF EXISTS "invitations_public_read"                           ON public.tenant_invitations;

    -- Nova policy anon: bloqueia SELECT sem predicado de token
    -- O frontend deve chamar a function accept_tenant_invitation() em vez de SELECT direto
    -- Para validação do token via frontend, usar uma RPC SECURITY DEFINER

    CREATE OR REPLACE FUNCTION public.validate_invitation_token(p_token TEXT)
    RETURNS TABLE(
    id         UUID,
    tenant_id  UUID,
    email      TEXT,
    role       TEXT,
    expires_at TIMESTAMPTZ
    ) AS $$
    SELECT
        ti.id,
        ti.tenant_id,
        ti.email,
        ti.role,
        ti.expires_at
    FROM public.tenant_invitations ti
    WHERE ti.token = p_token
        AND ti.expires_at > NOW()
        AND ti.accepted_at IS NULL;
    $$ LANGUAGE sql STABLE SECURITY DEFINER;

    -- Revoke acesso público direto à tabela de convites para anon
    -- Apenas usuários autenticados (admins) e a function SECURITY DEFINER têm acesso
    REVOKE SELECT ON public.tenant_invitations FROM anon;

    -- ============================================================
    -- 🟠 ALTO 2: regras_financeiras com tenant_id IS NULL escrita livre
    -- Qualquer autenticado pode criar "regras globais" — restringir a admin
    -- ============================================================

    DROP POLICY IF EXISTS "rf_tenant_all" ON public.regras_financeiras;

    CREATE POLICY "rf_tenant_all" ON public.regras_financeiras
    FOR ALL TO authenticated
    USING (
        tenant_id = public.current_tenant_id()
        OR (
        tenant_id IS NULL
        -- Regras globais de sistema: apenas admins podem ler/escrever
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        )
    )
    WITH CHECK (
        tenant_id = public.current_tenant_id()
        OR (
        tenant_id IS NULL
        AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE user_id = auth.uid() AND role = 'admin'
        )
        )
    );

    -- ============================================================
    -- 🟡 MÉDIO 1: accept_tenant_invitation aceita user_id externo
    -- Substituir parâmetro por auth.uid() interno
    -- ============================================================

    CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(p_token TEXT)
    RETURNS UUID AS $$
    DECLARE
    p_user_id  UUID := auth.uid();  -- sempre o usuário logado, sem aceitar externo
    invitation public.tenant_invitations%ROWTYPE;
    profile_id UUID;
    BEGIN
    -- Validar que há usuário autenticado
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- Buscar convite pelo token
    SELECT * INTO invitation
    FROM public.tenant_invitations
    WHERE token = p_token
        AND expires_at > NOW()
        AND accepted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Convite inválido ou expirado';
    END IF;

    -- Verificar se o email do usuário autenticado corresponde ao convite
    IF invitation.email != (SELECT email FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'E-mail do usuário não corresponde ao convite';
    END IF;

    -- Verificar se o usuário já tem um profile (não permitir multi-tenant por enquanto)
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
        RAISE EXCEPTION 'Usuário já possui um tenant vinculado';
    END IF;

    -- Criar profile vinculado ao tenant do convite
    INSERT INTO public.profiles (user_id, tenant_id, full_name, role)
    VALUES (
        p_user_id,
        invitation.tenant_id,
        (SELECT raw_user_meta_data->>'full_name' FROM auth.users WHERE id = p_user_id),
        invitation.role
    )
    RETURNING id INTO profile_id;

    -- Marcar convite como aceito
    UPDATE public.tenant_invitations
    SET accepted_at = NOW()
    WHERE id = invitation.id;

    RETURN profile_id;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- ============================================================
    -- 🟡 MÉDIO 2: production_entry_collaborators
    -- Coluna correta: production_entry_id (não entry_id)
    -- Índice idx_production_entry_collaborators_entry já criado em 20260428233000
    -- Apenas garantindo que existe (IF NOT EXISTS é seguro)
    -- ============================================================

    CREATE INDEX IF NOT EXISTS idx_production_entry_collaborators_entry
    ON public.production_entry_collaborators(production_entry_id);

    -- ============================================================
    -- 🟡 MÉDIO 3: UNIQUE(matricula) global — sem escopo por tenant
    -- Dois tenants não podem ter o mesmo número de matrícula
    -- ============================================================

    ALTER TABLE public.colaboradores
    DROP CONSTRAINT IF EXISTS colaboradores_matricula_key;

    ALTER TABLE public.colaboradores
    ADD CONSTRAINT colaboradores_matricula_tenant_unique
    UNIQUE (tenant_id, matricula);

    -- ============================================================
    -- 🟡 MÉDIO 4: Índices compostos para queries filtradas por tenant
    -- ============================================================

    -- operacoes_producao: filtros frequentes por (tenant_id, status) e (tenant_id, data)
    CREATE INDEX IF NOT EXISTS idx_op_producao_tenant_status
    ON public.operacoes_producao(tenant_id, status);

    CREATE INDEX IF NOT EXISTS idx_op_producao_tenant_data
    ON public.operacoes_producao(tenant_id, data_operacao)
    WHERE tenant_id IS NOT NULL;

    -- colaboradores: filtros por (tenant_id, status)
    CREATE INDEX IF NOT EXISTS idx_colaboradores_tenant_status
    ON public.colaboradores(tenant_id, status);

    -- lancamentos_financeiros
    CREATE INDEX IF NOT EXISTS idx_lancamentos_fin_tenant_status
    ON public.lancamentos_financeiros(tenant_id, status)
    WHERE tenant_id IS NOT NULL;

    -- ciclos_diaristas
    CREATE INDEX IF NOT EXISTS idx_ciclos_diaristas_tenant_status
    ON public.ciclos_diaristas(tenant_id, status)
    WHERE tenant_id IS NOT NULL;

    -- lote_pagamento_diaristas
    CREATE INDEX IF NOT EXISTS idx_lotes_tenant_status
    ON public.lote_pagamento_diaristas(tenant_id, status)
    WHERE tenant_id IS NOT NULL;

    -- empresas
    CREATE INDEX IF NOT EXISTS idx_empresas_tenant_status
    ON public.empresas(tenant_id, status);

    -- ============================================================
    -- 🟡 MÉDIO 5: tipos_servico_operacional / formas_pagamento_operacional
    -- Atualmente tratadas como catálogos globais (USING true).
    -- Adicionando tenant_id e isolando corretamente por tenant.
    -- Se TRUE global for intencional, reverter esta seção.
    -- ============================================================

    -- tipos_servico_operacional
    ALTER TABLE public.tipos_servico_operacional
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

    -- Popula registros legados com o tenant principal
    UPDATE public.tipos_servico_operacional
    SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
    WHERE tenant_id IS NULL;

    DROP POLICY IF EXISTS "tso_authenticated_access" ON public.tipos_servico_operacional;

    CREATE POLICY "tso_tenant_all" ON public.tipos_servico_operacional
    FOR ALL TO authenticated
    USING  (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

    -- formas_pagamento_operacional
    ALTER TABLE public.formas_pagamento_operacional
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id);

    UPDATE public.formas_pagamento_operacional
    SET tenant_id = (SELECT id FROM public.tenants ORDER BY created_at LIMIT 1)
    WHERE tenant_id IS NULL;

    DROP POLICY IF EXISTS "fpo_authenticated_access" ON public.formas_pagamento_operacional;

    CREATE POLICY "fpo_tenant_all" ON public.formas_pagamento_operacional
    FOR ALL TO authenticated
    USING  (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

    -- Atualizar triggers para incluir as novas colunas
    DROP TRIGGER IF EXISTS trg_auto_tenant_tipos_servico ON public.tipos_servico_operacional;
    CREATE TRIGGER trg_auto_tenant_tipos_servico
    BEFORE INSERT ON public.tipos_servico_operacional
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

    DROP TRIGGER IF EXISTS trg_auto_tenant_formas_pagamento ON public.formas_pagamento_operacional;
    CREATE TRIGGER trg_auto_tenant_formas_pagamento
    BEFORE INSERT ON public.formas_pagamento_operacional
    FOR EACH ROW EXECUTE FUNCTION public.auto_set_tenant_id();

    -- ============================================================
    -- ✅ VERIFICAÇÃO FINAL
    -- Execute após aplicar para confirmar:
    -- 1. Nenhuma tabela operacional com USING (true) exceto catálogos
    -- 2. Novas tabelas com tenant_id correto
    -- ============================================================

    SELECT
    tablename,
    policyname,
    cmd,
    qual
    FROM pg_policies
    WHERE schemaname = 'public'
    AND (
        qual = 'true'
        OR qual LIKE '%current_tenant_id%'
    )
    ORDER BY
    CASE WHEN qual = 'true' THEN 0 ELSE 1 END,
    tablename,
    policyname;
