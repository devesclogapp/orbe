    -- Migração para refinamento do módulo de Serviços Específicos
    -- Objetivo: Vincular precificação ao motor principal e registrar snapshots

    -- 1. ADICIONAR COLUNAS DE SNAPSHOT NA TABELA DE LANÇAMENTOS
    ALTER TABLE public.servicos_especificos_lancamentos
    ADD COLUMN IF NOT EXISTS fator_periodo_snapshot numeric NOT NULL DEFAULT 1.00,
    ADD COLUMN IF NOT EXISTS valor_unitario_snapshot numeric NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS tipo_calculo_snapshot text DEFAULT 'volume';

    -- 2. ADICIONAR COLUNAS NA TABELA DE REGRAS (TURNOS)
    ALTER TABLE public.servicos_especificos_regras
    ADD COLUMN IF NOT EXISTS tipo_periodo text DEFAULT 'DIURNO',
    ADD COLUMN IF NOT EXISTS peso_multiplicador numeric NOT NULL DEFAULT 1.00;

    -- 3. ADICIONAR COLUNAS DE VÍNCULO COM O MOTOR DE REGRAS GERAL
    -- Permite saber qual regra foi usada para resolver o preço base
    ALTER TABLE public.servicos_especificos_lancamentos
    ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS transportadora_id uuid REFERENCES public.transportadoras_clientes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS produto_carga_id uuid REFERENCES public.produtos_carga(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tipo_servico_id uuid REFERENCES public.tipos_servico_operacional(id) ON DELETE SET NULL;

    -- 3. AJUSTAR CONSTRAINTS DE UNICIDADE NA TABELA DE REGRAS
    -- Remove a antiga constraint legada
    ALTER TABLE public.servicos_especificos_regras 
    DROP CONSTRAINT IF EXISTS servicos_especificos_regras_codigo_periodo_empresa_id_key;

    -- Garantir um código único por tenant (Regra Global)
    DROP INDEX IF EXISTS servicos_especificos_regras_tenant_codigo_global_idx;
    CREATE UNIQUE INDEX servicos_especificos_regras_tenant_codigo_global_idx 
    ON public.servicos_especificos_regras (tenant_id, codigo) 
    WHERE empresa_id IS NULL;

    -- Garantir um código único por empresa dentro do tenant (Regra Específica)
    DROP INDEX IF EXISTS servicos_especificos_regras_tenant_codigo_empresa_idx;
    CREATE UNIQUE INDEX servicos_especificos_regras_tenant_codigo_empresa_idx 
    ON public.servicos_especificos_regras (tenant_id, codigo, empresa_id) 
    WHERE empresa_id IS NOT NULL;

    -- 4. CORRIGIR POLÍTICAS DE RLS (ESTAVAM USANDO AUTH.UID() EM VEZ DE TENANT_ID COMPARTILHADO)
    -- Tabela de Regras
    DROP POLICY IF EXISTS "Enable Read access for all users of the tenant" ON public.servicos_especificos_regras;
    CREATE POLICY "Enable Read access for all users of the tenant"
        ON public.servicos_especificos_regras FOR SELECT
        USING (tenant_id = public.current_tenant_id());

    DROP POLICY IF EXISTS "Enable Insert access for all users of the tenant" ON public.servicos_especificos_regras;
    CREATE POLICY "Enable Insert access for all users of the tenant"
        ON public.servicos_especificos_regras FOR INSERT
        WITH CHECK (tenant_id = public.current_tenant_id());

    DROP POLICY IF EXISTS "Enable Update access for all users of the tenant" ON public.servicos_especificos_regras;
    CREATE POLICY "Enable Update access for all users of the tenant"
        ON public.servicos_especificos_regras FOR UPDATE
        USING (tenant_id = public.current_tenant_id());

    DROP POLICY IF EXISTS "Enable Delete access for all users of the tenant" ON public.servicos_especificos_regras;
    CREATE POLICY "Enable Delete access for all users of the tenant"
        ON public.servicos_especificos_regras FOR DELETE
        USING (tenant_id = public.current_tenant_id());

    -- Tabela de Lançamentos
    DROP POLICY IF EXISTS "Enable Read access for all users of the tenant" ON public.servicos_especificos_lancamentos;
    CREATE POLICY "Enable Read access for all users of the tenant"
        ON public.servicos_especificos_lancamentos FOR SELECT
        USING (tenant_id = public.current_tenant_id());

    DROP POLICY IF EXISTS "Enable Insert access for all users of the tenant" ON public.servicos_especificos_lancamentos;
    CREATE POLICY "Enable Insert access for all users of the tenant"
        ON public.servicos_especificos_lancamentos FOR INSERT
        WITH CHECK (tenant_id = public.current_tenant_id());

    -- 5. ATUALIZAR COMENTÁRIOS
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.fator_periodo_snapshot IS 'Multiplicador de turno aplicado no momento do lançamento';
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.valor_unitario_snapshot IS 'Valor unitário base recuperado da regra operacional geral';
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.tipo_calculo_snapshot IS 'Tipo de cálculo (volume/colaborador) da regra de origem';
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.fornecedor_id IS 'Vínculo opcional com fornecedor para resolução de preço';
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.transportadora_id IS 'Vínculo opcional com transportadora para resolução de preço';
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.produto_carga_id IS 'Vínculo opcional com produto para resolução de preço';
    COMMENT ON COLUMN public.servicos_especificos_lancamentos.tipo_servico_id IS 'Vínculo com o tipo de serviço operacional usado como base';

    -- 3. GARANTIR TRÍADE DE PERIODOS PADRÃO (AUTOPROVISIONAMENTO)
    -- Esta lógica geralmente é executada por tenant, mas aqui deixamos o template SQL
    -- INSERT INTO public.servicos_especificos_regras (codigo, descricao, tipo_periodo, peso_multiplicador, tenant_id)
    -- SELECT 'D1', 'Primeiro Período Diurno', 'DIURNO', 1.00, tenant_id FROM public.tenants
    -- ON CONFLICT DO NOTHING;
