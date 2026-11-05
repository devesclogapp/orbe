-- ==============================================================================
-- ORBE ERP ESC LOG 2026 — FASE FINAL DE HOMOLOGAÇÃO
-- Módulo: CONTABILIDADE / GOVERNANÇA (CONT-07)
-- Descrição: Preparação de Políticas RLS e RBAC para Perfil Contador com isolamento estrito por Empresa
-- Arquivo: supabase/migrations/20261104170000_contador_rbac_rls.sql
-- Status: PREPARADA PARA APLICAÇÃO SEGURA NO BANCO
-- ==============================================================================

-- 1. Helper Function de Verificação de Autorização Contábil (Multi-Tenant & Perfil Contador)
CREATE OR REPLACE FUNCTION public.fn_check_contabil_empresa_access(
  p_user_id UUID,
  p_empresa_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_tenant_id UUID;
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  IF p_user_id IS NULL OR p_empresa_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Obter tenant_id da empresa
  SELECT e.tenant_id INTO v_tenant_id
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  IF v_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Checar em user_permissions se é admin/financeiro no tenant OU contador com acesso à empresa
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = p_user_id
      AND up.tenant_id = v_tenant_id
      AND up.status = 'ativo'
      AND (
        up.role IN ('admin', 'financeiro')
        OR (
          up.role = 'contador'
          AND (
            (up.permissions->'contador_context'->>'empresa_id') = p_empresa_id::text
            OR (up.permissions->'contador_context'->'empresas_ids') ? (p_empresa_id::text)
          )
        )
      )
  ) INTO v_is_authorized;

  RETURN v_is_authorized;
END;
$$;

COMMENT ON FUNCTION public.fn_check_contabil_empresa_access IS 
'Verifica se o usuário possui autorização contábil (admin, financeiro ou contador vinculado) para uma empresa e tenant específicos.';


-- ==============================================================================
-- 2. Tabela: public.contabil_mapeamento
-- ==============================================================================
ALTER TABLE public.contabil_mapeamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_mapeamento_select_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_insert_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_update_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_delete_policy" ON public.contabil_mapeamento;

CREATE POLICY "contabil_mapeamento_select_policy"
ON public.contabil_mapeamento
FOR SELECT
TO authenticated
USING (
  public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "contabil_mapeamento_insert_policy"
ON public.contabil_mapeamento
FOR INSERT
TO authenticated
WITH CHECK (
  public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "contabil_mapeamento_update_policy"
ON public.contabil_mapeamento
FOR UPDATE
TO authenticated
USING (
  public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
)
WITH CHECK (
  public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "contabil_mapeamento_delete_policy"
ON public.contabil_mapeamento
FOR DELETE
TO authenticated
USING (
  public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);


-- ==============================================================================
-- 3. Atualização da RPC Transacional: rpc_salvar_mapeamento_contabil_par
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.rpc_salvar_mapeamento_contabil_par(
  p_empresa_id UUID,
  p_operacao_tipo TEXT,
  p_conta_debito TEXT,
  p_conta_credito TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_tipo TEXT;
  v_debito TEXT;
  v_credito TEXT;
BEGIN
  -- 3.1 Validação de autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado: operação requer usuário autenticado.';
  END IF;

  -- 3.2 Validação de parâmetros obrigatórios
  IF p_empresa_id IS NULL THEN
    RAISE EXCEPTION 'p_empresa_id é obrigatório.';
  END IF;

  v_tipo := trim(COALESCE(p_operacao_tipo, ''));
  IF v_tipo = '' THEN
    RAISE EXCEPTION 'p_operacao_tipo é obrigatório.';
  END IF;

  v_debito := trim(COALESCE(p_conta_debito, ''));
  v_credito := trim(COALESCE(p_conta_credito, ''));
  IF v_debito = '' OR v_credito = '' THEN
    RAISE EXCEPTION 'Contas de Débito e Crédito são obrigatórias e não podem ser vazias.';
  END IF;

  -- 3.3 Checagem RBAC Fail-Closed via função de acesso contábil
  v_is_authorized := public.fn_check_contabil_empresa_access(v_user_id, p_empresa_id);

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: usuário não possui permissão contábil (admin, financeiro ou contador autorizado) para esta empresa.';
  END IF;

  -- Obter tenant_id para auditoria e consistência
  SELECT e.tenant_id INTO v_tenant_id
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  -- 3.4 UPSERT determinístico: Linha DÉBITO
  INSERT INTO public.contabil_mapeamento (
    empresa_id,
    operacao_tipo,
    classificacao,
    conta_contabil,
    ativo,
    created_at,
    updated_at
  )
  VALUES (
    p_empresa_id,
    v_tipo,
    'DEBITO',
    v_debito,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (empresa_id, operacao_tipo, classificacao)
  DO UPDATE SET
    conta_contabil = EXCLUDED.conta_contabil,
    ativo = TRUE,
    updated_at = NOW();

  -- 3.5 UPSERT determinístico: Linha CRÉDITO
  INSERT INTO public.contabil_mapeamento (
    empresa_id,
    operacao_tipo,
    classificacao,
    conta_contabil,
    ativo,
    created_at,
    updated_at
  )
  VALUES (
    p_empresa_id,
    v_tipo,
    'CREDITO',
    v_credito,
    TRUE,
    NOW(),
    NOW()
  )
  ON CONFLICT (empresa_id, operacao_tipo, classificacao)
  DO UPDATE SET
    conta_contabil = EXCLUDED.conta_contabil,
    ativo = TRUE,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', TRUE,
    'empresa_id', p_empresa_id,
    'operacao_tipo', v_tipo,
    'debito', v_debito,
    'credito', v_credito,
    'updated_at', NOW()
  );
END;
$$;


-- ==============================================================================
-- 4. Tabela: public.contabil_logs_integracao
-- ==============================================================================
-- 4.1 Garantir a existência da coluna empresa_id (compatibilidade retroativa)
ALTER TABLE public.contabil_logs_integracao 
ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- 4.2 Popular empresa_id retroativo caso esteja presente no jsonb payload
UPDATE public.contabil_logs_integracao
SET empresa_id = (payload->>'empresa_id')::uuid
WHERE empresa_id IS NULL 
  AND payload IS NOT NULL 
  AND (payload->>'empresa_id') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

-- 4.3 Aplicar RLS
ALTER TABLE public.contabil_logs_integracao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contabil_logs_integracao_select_policy" ON public.contabil_logs_integracao;
DROP POLICY IF EXISTS "contabil_logs_integracao_insert_policy" ON public.contabil_logs_integracao;

CREATE POLICY "contabil_logs_integracao_select_policy"
ON public.contabil_logs_integracao
FOR SELECT
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "contabil_logs_integracao_insert_policy"
ON public.contabil_logs_integracao
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);


-- ==============================================================================
-- 5. Tabela: public.relatorios_agendamentos
-- ==============================================================================
ALTER TABLE public.relatorios_agendamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relatorios_agendamentos_select_policy" ON public.relatorios_agendamentos;
DROP POLICY IF EXISTS "relatorios_agendamentos_insert_policy" ON public.relatorios_agendamentos;
DROP POLICY IF EXISTS "relatorios_agendamentos_update_policy" ON public.relatorios_agendamentos;
DROP POLICY IF EXISTS "relatorios_agendamentos_delete_policy" ON public.relatorios_agendamentos;

CREATE POLICY "relatorios_agendamentos_select_policy"
ON public.relatorios_agendamentos
FOR SELECT
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "relatorios_agendamentos_insert_policy"
ON public.relatorios_agendamentos
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "relatorios_agendamentos_update_policy"
ON public.relatorios_agendamentos
FOR UPDATE
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
)
WITH CHECK (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "relatorios_agendamentos_delete_policy"
ON public.relatorios_agendamentos
FOR DELETE
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);


-- ==============================================================================
-- 6. Tabela: public.relatorios_layouts_exportacao
-- ==============================================================================
ALTER TABLE public.relatorios_layouts_exportacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "relatorios_layouts_exportacao_select_policy" ON public.relatorios_layouts_exportacao;
DROP POLICY IF EXISTS "relatorios_layouts_exportacao_insert_policy" ON public.relatorios_layouts_exportacao;
DROP POLICY IF EXISTS "relatorios_layouts_exportacao_update_policy" ON public.relatorios_layouts_exportacao;
DROP POLICY IF EXISTS "relatorios_layouts_exportacao_delete_policy" ON public.relatorios_layouts_exportacao;

CREATE POLICY "relatorios_layouts_exportacao_select_policy"
ON public.relatorios_layouts_exportacao
FOR SELECT
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "relatorios_layouts_exportacao_insert_policy"
ON public.relatorios_layouts_exportacao
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "relatorios_layouts_exportacao_update_policy"
ON public.relatorios_layouts_exportacao
FOR UPDATE
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
)
WITH CHECK (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);

CREATE POLICY "relatorios_layouts_exportacao_delete_policy"
ON public.relatorios_layouts_exportacao
FOR DELETE
TO authenticated
USING (
  empresa_id IS NULL 
  OR public.fn_check_contabil_empresa_access(auth.uid(), empresa_id)
);
