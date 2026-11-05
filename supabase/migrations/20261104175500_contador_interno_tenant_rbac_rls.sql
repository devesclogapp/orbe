-- ==============================================================================
-- ORBE ERP ESC LOG 2026 — FASE FINAL DE HOMOLOGAÇÃO
-- Módulo: CONTABILIDADE / GOVERNANÇA (CONT-07.2)
-- Descrição: Adequação da Segurança e RLS para o Perfil Contador Interno (ESC Logística)
-- Arquivo: supabase/migrations/20261104175500_contador_interno_tenant_rbac_rls.sql
-- Status: PREPARADA (NÃO APLICADA AUTOMATICAMENTE — AGUARDANDO AUTORIZAÇÃO)
-- ==============================================================================

-- 1. Atualização da Helper Function de Verificação de Autorização Contábil
-- O Contador é um profissional interno da própria ESC Logística com acesso
-- às ferramentas contábeis de todas as empresas clientes pertencentes ao seu tenant.
-- Preserva rigorosamente o isolamento entre tenants (multi-tenant fail-closed).
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

  -- Checar em user_permissions:
  -- Admin, Financeiro e Contador Interno ativos no mesmo tenant possuem acesso contábil
  -- Preserva isolamento estrito: usuário do tenant A jamais acessa empresa do tenant B
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = p_user_id
      AND up.tenant_id = v_tenant_id
      AND up.status = 'ativo'
      AND up.role IN ('admin', 'financeiro', 'contador')
  ) INTO v_is_authorized;

  RETURN v_is_authorized;
END;
$$;

COMMENT ON FUNCTION public.fn_check_contabil_empresa_access IS 
'CONT-07.2: Verifica autorização contábil (admin, financeiro ou contador interno) para uma empresa com isolamento estrito de tenant.';


-- ==============================================================================
-- 2. Atualização da RPC Transacional: rpc_salvar_mapeamento_contabil_par
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
  -- 2.1 Validação de autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado: operação requer usuário autenticado.';
  END IF;

  -- 2.2 Validação de parâmetros obrigatórios
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

  -- 2.3 Checagem RBAC Fail-Closed via função de acesso contábil (Admin, Financeiro, Contador Interno)
  v_is_authorized := public.fn_check_contabil_empresa_access(v_user_id, p_empresa_id);

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: usuário não possui permissão contábil no tenant desta empresa.';
  END IF;

  -- Obter tenant_id para auditoria e consistência
  SELECT e.tenant_id INTO v_tenant_id
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  -- 2.4 UPSERT determinístico: Linha DÉBITO
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

  -- 2.5 UPSERT determinístico: Linha CRÉDITO
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

