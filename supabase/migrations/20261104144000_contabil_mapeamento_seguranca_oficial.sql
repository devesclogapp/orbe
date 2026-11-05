-- ==============================================================================
-- ORBE ERP - MIGRATION CONT-02.4: SEGURANÇA E ATOMICIDADE CONTÁBIL DEFINITIVA
-- Arquivo: supabase/migrations/20261104144000_contabil_mapeamento_seguranca_oficial.sql
-- Tabela: public.contabil_mapeamento
-- Diretrizes:
--   1. Autorização exclusivamente baseada em public.user_permissions (sem fallback em profiles).
--   2. Remoção explícita de políticas conhecidas para contabil_mapeamento.
--   3. Preservação do modelo canônico de duas linhas (DEBITO / CREDITO) via conta_contabil.
--   4. Constraint composta de unicidade (empresa_id, operacao_tipo, classificacao).
--   5. RPC transacional SECURITY DEFINER com search_path seguro, validações estritas de inputs
--      e revogação de execução pública.
--   6. Nenhuma exclusão automática de dados (DELETE).
-- STATUS: PREPARADO LOCALMENTE — NÃO APLICAR AUTOMATICAMENTE SEM AUTORIZAÇÃO.
-- ==============================================================================

-- 1. Criação idempotente da constraint de unicidade composta
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_contabil_mapeamento_empresa_tipo_classificacao'
  ) THEN
    ALTER TABLE public.contabil_mapeamento
    ADD CONSTRAINT uq_contabil_mapeamento_empresa_tipo_classificacao
    UNIQUE (empresa_id, operacao_tipo, classificacao);
  END IF;
END;
$$;

-- 2. Habilitação mandatória de Row Level Security
ALTER TABLE public.contabil_mapeamento ENABLE ROW LEVEL SECURITY;

-- 3. Remoção explícita das políticas contábeis conhecidas para substituição
DROP POLICY IF EXISTS "Tenant access for contabil_mapeamento" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_select_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_insert_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_update_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_delete_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_all_policy" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Permitir leitura para autenticados" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Permitir escrita para autenticados" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Allow public read access" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Public read access" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Allow public access" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "Allow authenticated access" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_read" ON public.contabil_mapeamento;
DROP POLICY IF EXISTS "contabil_mapeamento_write" ON public.contabil_mapeamento;

-- 4. Política de SELECT: Exclusiva para usuários ativos com role admin ou financeiro em user_permissions
CREATE POLICY "contabil_mapeamento_select_policy"
ON public.contabil_mapeamento
FOR SELECT
TO authenticated
USING (
  empresa_id IN (
    SELECT e.id FROM public.empresas e
    JOIN public.user_permissions up ON up.tenant_id = e.tenant_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'ativo'
      AND up.role IN ('admin', 'financeiro')
  )
);

-- 5. Política de INSERT: Exclusiva para usuários ativos com role admin ou financeiro em user_permissions
CREATE POLICY "contabil_mapeamento_insert_policy"
ON public.contabil_mapeamento
FOR INSERT
TO authenticated
WITH CHECK (
  empresa_id IN (
    SELECT e.id FROM public.empresas e
    JOIN public.user_permissions up ON up.tenant_id = e.tenant_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'ativo'
      AND up.role IN ('admin', 'financeiro')
  )
);

-- 6. Política de UPDATE: Exclusiva para usuários ativos com role admin ou financeiro em user_permissions
CREATE POLICY "contabil_mapeamento_update_policy"
ON public.contabil_mapeamento
FOR UPDATE
TO authenticated
USING (
  empresa_id IN (
    SELECT e.id FROM public.empresas e
    JOIN public.user_permissions up ON up.tenant_id = e.tenant_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'ativo'
      AND up.role IN ('admin', 'financeiro')
  )
)
WITH CHECK (
  empresa_id IN (
    SELECT e.id FROM public.empresas e
    JOIN public.user_permissions up ON up.tenant_id = e.tenant_id
    WHERE up.user_id = auth.uid()
      AND up.status = 'ativo'
      AND up.role IN ('admin', 'financeiro')
  )
);

-- 7. RPC Transacional SECURITY DEFINER com checagem estrita em user_permissions
CREATE OR REPLACE FUNCTION public.rpc_salvar_mapeamento_contabil_par(
  p_empresa_id UUID,
  p_operacao_tipo TEXT,
  p_conta_debito TEXT,
  p_conta_credito TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_is_authorized BOOLEAN := FALSE;
  v_tipo TEXT;
  v_debito TEXT;
  v_credito TEXT;
BEGIN
  -- 7.1 Validação de autenticação
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado: operação requer usuário autenticado.';
  END IF;

  -- 7.2 Validação de parâmetros obrigatórios
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

  -- 7.3 Validação de tenant e empresa
  SELECT e.tenant_id INTO v_tenant_id
  FROM public.empresas e
  WHERE e.id = p_empresa_id;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Empresa informada não existe ou não possui tenant associado.';
  END IF;

  -- 7.4 Checagem RBAC Fail-Closed exclusivamente em public.user_permissions
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions up
    WHERE up.user_id = v_user_id
      AND up.tenant_id = v_tenant_id
      AND up.status = 'ativo'
      AND up.role IN ('admin', 'financeiro')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Acesso negado: usuário não possui permissão ativa de admin ou financeiro no tenant desta empresa.';
  END IF;

  -- 7.5 Gravação atômica do par Débito e Crédito (duas linhas preservadas)
  INSERT INTO public.contabil_mapeamento (
    empresa_id,
    operacao_tipo,
    classificacao,
    conta_contabil,
    updated_at
  )
  VALUES
    (p_empresa_id, v_tipo, 'DEBITO', v_debito, NOW()),
    (p_empresa_id, v_tipo, 'CREDITO', v_credito, NOW())
  ON CONFLICT (empresa_id, operacao_tipo, classificacao)
  DO UPDATE SET
    conta_contabil = EXCLUDED.conta_contabil,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Mapeamento Débito/Crédito gravado com sucesso com garantia atômica.'
  );
END;
$$;

-- 8. Restrição de privilégios de execução da RPC
REVOKE ALL ON FUNCTION public.rpc_salvar_mapeamento_contabil_par(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_salvar_mapeamento_contabil_par(UUID, TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rpc_salvar_mapeamento_contabil_par(UUID, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 9. Registro formal no histórico de migrations do Supabase
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261104144000', 'contabil_mapeamento_seguranca_oficial')
ON CONFLICT (version) DO NOTHING;

