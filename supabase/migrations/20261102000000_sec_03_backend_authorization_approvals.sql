-- ==============================================================================
-- MIGRATION: 20261102000000_sec_03_backend_authorization_approvals.sql
-- DOMÍNIO: Governança, RBAC & Central de Aprovações RH (SEC-03 Backend Hardening)
-- OBJETIVO: 
--   1. Criar a função canônica public.has_user_permission com isolamento multi-tenant
--      estrito e comportamento Fail-Closed, garantindo que restrições customizadas
--      em user_permissions (ex.: aprovar = false) sobreponham presets de perfil.
--   2. Proteger as decisões da Central de Aprovações nos 6 DOMÍNIOS do ERP ORBE:
--      - Domínio 1: Ponto CLT (registros_ponto)
--      - Domínio 2: Diaristas (validar_periodo_diaristas & reabrir_periodo_diaristas)
--      - Domínio 3: Intermitentes (intermitentes_lotes_fechamento)
--      - Domínio 4: Operações por Volume (rpc_rh_aprovar_operacao & rpc_rh_devolver_operacao)
--      - Domínio 5: Custos Extras (rpc_custo_extra_transicionar)
--      - Domínio 6: Serviços Extras (servicos_extras_operacionais)
--   3. Eliminar vulnerabilidades de impersonation em funções SECURITY DEFINER,
--      utilizando estritamente auth.uid() para clientes autenticados.
--   4. Preservar 100% de compatibilidade com integrações de máquina (n8n, Edge Functions,
--      service_role e ingestão automatizada do RHID / Workflow B).
-- STATUS: PREPARADO LOCALMENTE — NÃO APLICAR AUTOMATICAMENTE EM PRODUÇÃO.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. FUNÇÃO AUXILIAR UNIVERSAL E BLINDADA DE VERIFICAÇÃO DE SERVICE_ROLE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_service_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_claims JSONB;
  v_role TEXT;
BEGIN
  -- 0.1 Regra de Ouro: Se existe um usuário final autenticado (auth.uid), NUNCA é service_role.
  -- Impede qualquer possibilidade de spoofing por usuários comuns autenticados.
  IF auth.uid() IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  -- 0.2 Obtém a role ativa da conexão/transação atual no PostgreSQL
  v_role := current_setting('role', true);
  IF v_role = 'service_role' THEN
    RETURN TRUE;
  END IF;

  -- 0.3 Se estiver rodando como superusuário de infraestrutura/background (postgres / supabase_admin)
  IF session_user IN ('postgres', 'supabase_admin') AND current_user IN ('postgres', 'supabase_admin') THEN
    BEGIN
      v_jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
      -- Apenas autoriza se claims for vazio (background SQL direto) ou claim de role for 'service_role'
      IF v_jwt_claims IS NULL OR v_jwt_claims->>'role' = 'service_role' THEN
        RETURN TRUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RETURN FALSE;
    END;
  END IF;

  -- 0.4 Fail-Closed Absoluto
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.is_service_role() IS
  'SEC-03: Função auxiliar canônica e blindada contra spoofing para identificar com segurança chamadas de workers e automações legítimas (service_role).';

REVOKE ALL ON FUNCTION public.is_service_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_service_role() TO authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 1. FUNÇÃO CANÔNICA DE AUTORIZAÇÃO (FAIL-CLOSED & MULTI-TENANT DETERMINÍSTICO)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_user_permission(
  p_user_id UUID,
  p_module TEXT,
  p_action TEXT,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_effective_tenant_id UUID;
  v_role TEXT;
  v_status TEXT;
  v_user_tenant_id UUID;
  v_permissions JSONB;
  v_custom_val TEXT;
BEGIN
  -- 1.1 Bypass seguro para chamadas de sistema e automações legítimas (service_role)
  IF public.is_service_role() THEN
    RETURN TRUE;
  END IF;

  -- 1.2 Fail-Closed: Usuário não identificado
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1.3 Resolução inequívoca do Tenant Efetivo
  v_effective_tenant_id := p_tenant_id;
  IF v_effective_tenant_id IS NULL THEN
    v_effective_tenant_id := public.current_tenant_id();
  END IF;

  -- Se ainda for nulo, tenta resolver a partir do profile do usuário
  IF v_effective_tenant_id IS NULL THEN
    SELECT tenant_id INTO v_effective_tenant_id
    FROM public.profiles
    WHERE (user_id = p_user_id OR id = p_user_id)
    LIMIT 1;
  END IF;

  -- Fail-Closed: Se o tenant não puder ser determinado, nega acesso imediatamente
  IF v_effective_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- 1.4 Obter papel, status e matriz customizada com escopo estrito de tenant
  SELECT 
    up.role,
    up.status,
    up.tenant_id,
    up.permissions
  INTO 
    v_role,
    v_status,
    v_user_tenant_id,
    v_permissions
  FROM public.user_permissions up
  WHERE up.user_id = p_user_id
    AND up.tenant_id = v_effective_tenant_id;

  -- Fallback de leitura para tabela profiles caso user_permissions ainda não tenha sido sincronizado
  IF v_role IS NULL THEN
    SELECT 
      p.role,
      'ativo',
      p.tenant_id,
      '{}'::jsonb
    INTO 
      v_role,
      v_status,
      v_user_tenant_id,
      v_permissions
    FROM public.profiles p
    WHERE (p.user_id = p_user_id OR p.id = p_user_id)
      AND p.tenant_id = v_effective_tenant_id;
  END IF;

  -- Perfil inexistente no tenant efetivo
  IF v_role IS NULL OR v_user_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Isolamento Multi-tenant estrito: tenant deve coincidir exatamente
  IF v_user_tenant_id IS DISTINCT FROM v_effective_tenant_id THEN
    RETURN FALSE;
  END IF;

  -- 1.5 Conta deve estar estritamente 'ativo' (rejeita 'bloqueado', 'inativo', 'pendente', etc.)
  IF lower(COALESCE(v_status, '')) <> 'ativo' THEN
    RETURN FALSE;
  END IF;

  -- 1.6 Super Admin e Admin possuem autorização total de governança no tenant
  IF lower(v_role) IN ('admin', 'super_admin') THEN
    RETURN TRUE;
  END IF;

  -- 1.7 Avaliação estrita da matriz JSONB customizada (Prioridade Absoluta)
  -- Se o módulo e a ação estiverem configurados no JSONB, o valor booleano é definitivo.
  -- Se estiver explicitamente como "false", NUNCA realiza fallback para o preset da role.
  IF v_permissions IS NOT NULL AND v_permissions ? p_module THEN
    v_custom_val := v_permissions->p_module->>p_action;
    IF v_custom_val IS NOT NULL THEN
      RETURN (v_custom_val = 'true');
    END IF;
  END IF;

  -- 1.8 Fallback para Presets de Papel (somente quando não houver customização explícita)
  IF lower(v_role) = 'rh' THEN
    IF p_module = 'processamento_rh' AND p_action IN ('ver', 'processar', 'aprovar', 'exportar') THEN
      RETURN TRUE;
    ELSIF p_module = 'operacoes_recebidas' AND p_action IN ('ver', 'aprovar') THEN
      RETURN TRUE;
    ELSIF p_module = 'pontos_recebidos' AND p_action IN ('ver', 'importar', 'exportar') THEN
      RETURN TRUE;
    ELSIF p_module = 'banco_de_horas' AND p_action IN ('ver', 'criar', 'editar', 'exportar') THEN
      RETURN TRUE;
    ELSIF p_module = 'regras_de_banco' AND p_action IN ('ver', 'criar', 'editar') THEN
      RETURN TRUE;
    ELSIF p_module = 'cadastro_de_diaristas' AND p_action IN ('ver', 'criar', 'editar', 'exportar') THEN
      RETURN TRUE;
    ELSIF p_module = 'fechamento_mensal' AND p_action IN ('ver', 'processar', 'fechar', 'reabrir') THEN
      RETURN TRUE;
    ELSE
      RETURN FALSE;
    END IF;
  ELSIF lower(v_role) = 'gestor' THEN
    IF p_module IN (
      'dashboard', 'central_operacional', 'operacoes_recebidas', 'pontos_recebidos',
      'banco_de_horas', 'processamento_rh', 'fechamento_mensal', 'central_financeira',
      'faturamento', 'pagamentos_remessas'
    ) AND p_action IN ('ver', 'aprovar') THEN
      RETURN TRUE;
    ELSIF p_module = 'central_de_relatorios' AND p_action IN ('ver', 'exportar') THEN
      RETURN TRUE;
    ELSE
      RETURN FALSE;
    END IF;
  ELSIF lower(v_role) = 'financeiro' THEN
    IF p_module IN ('central_financeira', 'faturamento') AND p_action IN ('ver', 'criar', 'editar', 'aprovar', 'exportar') THEN
      RETURN TRUE;
    ELSIF p_module = 'pagamentos_remessas' AND p_action IN ('ver', 'criar', 'editar', 'aprovar', 'processar', 'exportar') THEN
      RETURN TRUE;
    ELSIF p_module = 'fechamento_mensal' AND p_action IN ('ver', 'aprovar', 'fechar', 'reabrir') THEN
      RETURN TRUE;
    ELSIF p_module = 'regras_de_calculo' AND p_action IN ('ver', 'criar', 'editar') THEN
      RETURN TRUE;
    ELSIF p_module = 'central_de_relatorios' AND p_action IN ('ver', 'exportar') THEN
      RETURN TRUE;
    ELSE
      RETURN FALSE;
    END IF;
  ELSIF lower(v_role) = 'encarregado' THEN
    IF p_module = 'central_operacional' AND p_action IN ('ver', 'criar', 'editar') THEN
      RETURN TRUE;
    ELSIF p_module = 'importacoes' AND p_action IN ('ver', 'criar', 'importar') THEN
      RETURN TRUE;
    ELSE
      RETURN FALSE;
    END IF;
  END IF;

  -- 1.9 Fail-Closed Absoluto
  RETURN FALSE;
END;
$$;

COMMENT ON FUNCTION public.has_user_permission(UUID, TEXT, TEXT, UUID) IS
  'SEC-03: Função canônica de autorização no servidor com isolamento multi-tenant, validação estrita de user_permissions e proteção fail-closed.';

REVOKE ALL ON FUNCTION public.has_user_permission(UUID, TEXT, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_user_permission(UUID, TEXT, TEXT, UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. DOMÍNIO 1: PONTO CLT (registros_ponto)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_check_ponto_approval_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Permite operações internas de workers/ingestões com service_role
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  -- Se o status_processamento for alterado para estado de decisão RH (PROCESSADO ou INCONSISTENTE)
  IF NEW.status_processamento IS DISTINCT FROM OLD.status_processamento THEN
    IF NEW.status_processamento IN ('PROCESSADO', 'INCONSISTENTE') THEN
      IF NOT public.has_user_permission(auth.uid(), 'processamento_rh', 'aprovar', NEW.tenant_id) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização (processamento_rh:aprovar) para aprovar ou devolver registros de ponto.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ponto_approval_permission ON public.registros_ponto;
CREATE TRIGGER trg_ponto_approval_permission
BEFORE UPDATE ON public.registros_ponto
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_ponto_approval_permission();

-- ------------------------------------------------------------------------------
-- 3. DOMÍNIO 2: DIARISTAS (validar_periodo_diaristas & reabrir_periodo_diaristas)
-- ------------------------------------------------------------------------------
-- 3.1 Aprovação / Validação de Diaristas
CREATE OR REPLACE FUNCTION public.validar_periodo_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id UUID;
  v_periodo_inicio DATE;
  v_periodo_fim DATE;
  v_tenant_id UUID;
  v_caller_id UUID := auth.uid();
  v_real_role TEXT;
  v_real_nome TEXT;
  v_log_user_id UUID;
BEGIN
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LOTE_NOT_FOUND: Lote de fechamento de diaristas % não encontrado.', p_lote_id;
  END IF;

  -- Validação de Autorização Fail-Closed (Anti-Impersonation Estrito)
  IF NOT public.is_service_role() THEN
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: Chamada sem identidade autenticada.';
    END IF;

    -- Obtém a role real e nome do operador a partir do perfil no banco
    SELECT lower(role), full_name INTO v_real_role, v_real_nome
    FROM public.profiles
    WHERE (user_id = v_caller_id OR id = v_caller_id)
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'AUTH_PROFILE_INVALID: Usuário autenticado não pertence ao tenant deste lote.';
    END IF;

    IF NOT public.has_user_permission(v_caller_id, 'processamento_rh', 'aprovar', v_tenant_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização (processamento_rh:aprovar) para validar fechamento de diaristas.';
    END IF;

    v_log_user_id := v_caller_id;
  ELSE
    v_real_role := 'service_role';
    v_real_nome := 'Sistema Automatizado';
    v_log_user_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  -- SINCRONIZAÇÃO EM CASCATA: Lançamentos -> VALIDADO_RH
  UPDATE public.lancamentos_diaristas
  SET status = 'VALIDADO_RH', updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  UPDATE public.diaristas_lotes_fechamento
  SET status = 'VALIDADO_RH', updated_at = now()
  WHERE id = p_lote_id;

  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES 
  (v_empresa_id, v_tenant_id, v_log_user_id, v_real_nome, v_real_role, 'VALIDOU', v_periodo_inicio, v_periodo_fim);
END;
$$;

REVOKE ALL ON FUNCTION public.validar_periodo_diaristas(UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_periodo_diaristas(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- 3.2 Devolução / Reabertura de Diaristas
CREATE OR REPLACE FUNCTION public.reabrir_periodo_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT,
  p_motivo TEXT,
  p_tipo_reabertura TEXT DEFAULT 'operacional'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_empresa_id UUID;
  v_periodo_inicio DATE;
  v_periodo_fim DATE;
  v_tenant_id UUID;
  v_caller_id UUID := auth.uid();
  v_real_role TEXT;
  v_real_nome TEXT;
  v_log_user_id UUID;
  v_tipo TEXT;
BEGIN
  v_tipo := COALESCE(p_tipo_reabertura, 'operacional');
  IF v_tipo NOT IN ('operacional', 'administrativa') THEN
    RAISE EXCEPTION 'tipo_reabertura inválido: %. Use operacional ou administrativa.', v_tipo;
  END IF;

  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento
  WHERE id = p_lote_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lote não encontrado: %', p_lote_id;
  END IF;

  -- Validação de Autorização Fail-Closed (Anti-Impersonation Estrito)
  IF NOT public.is_service_role() THEN
    IF v_caller_id IS NULL THEN
      RAISE EXCEPTION 'AUTH_REQUIRED: Chamada sem identidade autenticada.';
    END IF;

    SELECT lower(role), full_name INTO v_real_role, v_real_nome
    FROM public.profiles
    WHERE (user_id = v_caller_id OR id = v_caller_id)
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'AUTH_PROFILE_INVALID: Usuário autenticado não pertence ao tenant deste lote.';
    END IF;

    IF NOT public.has_user_permission(v_caller_id, 'processamento_rh', 'aprovar', v_tenant_id) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização para devolver ou reabrir fechamento de diaristas.';
    END IF;

    v_log_user_id := v_caller_id;
  ELSE
    v_real_role := 'service_role';
    v_real_nome := 'Sistema Automatizado';
    v_log_user_id := COALESCE(p_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid);
  END IF;

  -- Execução da Reabertura
  IF v_tipo = 'operacional' THEN
    UPDATE public.lancamentos_diaristas
    SET status = 'EM_ABERTO',
        lote_fechamento_id = NULL,
        updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    UPDATE public.diaristas_lotes_fechamento
    SET status = 'EM_ABERTO',
        tipo_reabertura = 'operacional',
        updated_at = now()
    WHERE id = p_lote_id;
  ELSIF v_tipo = 'administrativa' THEN
    UPDATE public.lancamentos_diaristas
    SET status = 'AGUARDANDO_VALIDACAO_RH',
        updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    UPDATE public.diaristas_lotes_fechamento
    SET status = 'AGUARDANDO_VALIDACAO_RH',
        tipo_reabertura = 'administrativa',
        updated_at = now()
    WHERE id = p_lote_id;
  END IF;

  -- Log auditável com identidade real do operador
  INSERT INTO public.diaristas_logs_fechamento
    (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role,
     acao, periodo_inicio, periodo_fim, motivo)
  VALUES
    (v_empresa_id, v_tenant_id, v_log_user_id, v_real_nome, v_real_role,
     'REABRIU', v_periodo_inicio, v_periodo_fim,
     '[' || UPPER(v_tipo) || '] ' || COALESCE(p_motivo, 'Não informado'));
END;
$$;

REVOKE ALL ON FUNCTION public.reabrir_periodo_diaristas(UUID, UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reabrir_periodo_diaristas(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. DOMÍNIO 3: INTERMITENTES (intermitentes_lotes_fechamento)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_check_intermitentes_approval_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Bloqueia aprovação, devolução ou rejeição sem autorização
    IF NEW.status IN ('VALIDADO_RH', 'DEVOLVIDO_RH', 'REJEITADO', 'EM_REVISAO') THEN
      IF NOT public.has_user_permission(auth.uid(), 'processamento_rh', 'aprovar', NEW.tenant_id) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização (processamento_rh:aprovar) para aprovar, devolver ou alterar o estado deste lote de intermitentes.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_intermitentes_approval_permission ON public.intermitentes_lotes_fechamento;
CREATE TRIGGER trg_intermitentes_approval_permission
BEFORE UPDATE ON public.intermitentes_lotes_fechamento
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_intermitentes_approval_permission();

-- ------------------------------------------------------------------------------
-- 5. DOMÍNIO 4: OPERAÇÕES POR VOLUME (rpc_rh_aprovar_operacao & rpc_rh_devolver_operacao)
-- ------------------------------------------------------------------------------
-- 5.1 Aprovação RH de Operação
CREATE OR REPLACE FUNCTION public.rpc_rh_aprovar_operacao(
    p_operacao_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_tenant_id uuid;
    v_user_role text;
    v_novo_status text;
BEGIN
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    IF public.is_service_role() THEN
        NULL;
    ELSE
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'AUTH_REQUIRED: Chamada sem identidade autenticada.';
        END IF;

        SELECT tenant_id, lower(COALESCE(role, '')) INTO v_user_tenant_id, v_user_role 
        FROM public.profiles 
        WHERE user_id = auth.uid() OR id = auth.uid()
        LIMIT 1;

        IF NOT FOUND OR v_user_tenant_id IS NULL OR v_user_role IS NULL OR trim(v_user_role) = '' THEN
            RAISE EXCEPTION 'AUTH_PROFILE_INVALID: Usuário não possui perfil ativo, role válida ou tenant configurado.';
        END IF;

        IF v_operacao.tenant_id IS NULL OR v_operacao.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
            RAISE EXCEPTION 'CROSS_TENANT_ACCESS_DENIED: Operação não pertence ao tenant autenticado.';
        END IF;

        IF NOT (
          public.has_user_permission(auth.uid(), 'operacoes_recebidas', 'aprovar', v_operacao.tenant_id)
          OR public.has_user_permission(auth.uid(), 'processamento_rh', 'aprovar', v_operacao.tenant_id)
        ) THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização para aprovação RH de operações.';
        END IF;
    END IF;

    IF v_operacao.status_rh = 'APROVADO_RH' THEN
        RAISE EXCEPTION 'OP_ALREADY_APPROVED: Operação já foi aprovada pelo RH anteriormente.';
    END IF;

    IF v_operacao.status = 'EM_RESTRICAO' THEN
        RAISE EXCEPTION 'OP_IN_RESTRICTION: Operação em restrição operacional. Não pode ser aprovada pelo RH sem resolução.';
    END IF;

    IF v_operacao.status_rh NOT IN ('PENDENTE_RH', 'EM_VALIDACAO') THEN
        RAISE EXCEPTION 'OP_INVALID_STATUS_RH: Operação com status RH "%" não está apta para aprovação (esperado: PENDENTE_RH ou EM_VALIDACAO).', v_operacao.status_rh;
    END IF;

    IF v_operacao.status IN ('PENDENTE', 'EM_VALIDACAO', 'AGUARDANDO_FATURAMENTO') THEN
        v_novo_status := 'AGUARDANDO_FATURAMENTO';
    ELSE
        v_novo_status := v_operacao.status;
    END IF;

    UPDATE public.operacoes_producao
    SET status = v_novo_status,
        status_rh = 'APROVADO_RH',
        atualizado_em = v_now
    WHERE id = p_operacao_id;

    INSERT INTO public.audit_log (
        tenant_id,
        registro_id,
        entidade,
        acao,
        descricao,
        usuario_id,
        usuario_nome,
        perfil_usuario,
        valor_anterior,
        valor_novo,
        created_at
    ) VALUES (
        v_operacao.tenant_id,
        p_operacao_id,
        'operacoes_producao',
        'UPDATE',
        'Aprovação RH formalizada com sucesso via RPC.',
        auth.uid(),
        COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'Usuário RH'),
        COALESCE(v_user_role, 'rh'),
        json_build_object('status', v_operacao.status, 'status_rh', v_operacao.status_rh),
        json_build_object('status', v_novo_status, 'status_rh', 'APROVADO_RH'),
        v_now
    );

    RETURN json_build_object(
        'success', true,
        'operacao_id', p_operacao_id,
        'status', v_novo_status,
        'status_rh', 'APROVADO_RH',
        'updated_at', v_now
    );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO authenticated, service_role;

-- 5.2 Devolução RH de Operação
CREATE OR REPLACE FUNCTION public.rpc_rh_devolver_operacao(
    p_operacao_id UUID,
    p_motivo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_operacao record;
    v_now timestamptz := now();
    v_user_tenant_id uuid;
    v_user_role text;
BEGIN
    SELECT * INTO v_operacao 
    FROM public.operacoes_producao 
    WHERE id = p_operacao_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OP_NOT_FOUND: Operação não encontrada.';
    END IF;

    IF public.is_service_role() THEN
        NULL;
    ELSE
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'AUTH_REQUIRED: Chamada sem identidade autenticada.';
        END IF;

        SELECT tenant_id, lower(COALESCE(role, '')) INTO v_user_tenant_id, v_user_role 
        FROM public.profiles 
        WHERE user_id = auth.uid() OR id = auth.uid()
        LIMIT 1;

        IF NOT FOUND OR v_user_tenant_id IS NULL OR v_user_role IS NULL OR trim(v_user_role) = '' THEN
            RAISE EXCEPTION 'AUTH_PROFILE_INVALID: Usuário não possui perfil ativo, role válida ou tenant configurado.';
        END IF;

        IF v_operacao.tenant_id IS NULL OR v_operacao.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
            RAISE EXCEPTION 'CROSS_TENANT_ACCESS_DENIED: Operação não pertence ao tenant autenticado.';
        END IF;

        IF NOT (
          public.has_user_permission(auth.uid(), 'operacoes_recebidas', 'aprovar', v_operacao.tenant_id)
          OR public.has_user_permission(auth.uid(), 'processamento_rh', 'aprovar', v_operacao.tenant_id)
        ) THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização para devolução RH de operações.';
        END IF;
    END IF;

    UPDATE public.operacoes_producao
    SET status_rh = 'DEVOLVIDO_RH',
        status = 'EM_RESTRICAO',
        avaliacao_json = CASE 
            WHEN p_motivo IS NOT NULL THEN COALESCE(avaliacao_json, '{}'::jsonb) || jsonb_build_object('motivo_devolucao_rh', p_motivo, 'data_devolucao_rh', v_now)
            ELSE avaliacao_json
        END,
        atualizado_em = v_now
    WHERE id = p_operacao_id;

    INSERT INTO public.audit_log (
        tenant_id,
        registro_id,
        entidade,
        acao,
        descricao,
        usuario_id,
        usuario_nome,
        perfil_usuario,
        valor_anterior,
        valor_novo,
        created_at
    ) VALUES (
        v_operacao.tenant_id,
        p_operacao_id,
        'operacoes_producao',
        'UPDATE',
        'Operação devolvida pelo RH para correção na origem: ' || COALESCE(p_motivo, 'Sem justificativa'),
        auth.uid(),
        COALESCE((SELECT full_name FROM public.profiles WHERE user_id = auth.uid() LIMIT 1), 'Usuário RH'),
        COALESCE(v_user_role, 'rh'),
        json_build_object('status', v_operacao.status, 'status_rh', v_operacao.status_rh),
        json_build_object('status', 'EM_RESTRICAO', 'status_rh', 'DEVOLVIDO_RH'),
        v_now
    );

    RETURN json_build_object('success', true, 'operacao_id', p_operacao_id, 'status', 'EM_RESTRICAO', 'status_rh', 'DEVOLVIDO_RH');
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_rh_devolver_operacao(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_rh_devolver_operacao(UUID, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. DOMÍNIO 5: CUSTOS EXTRAS (rpc_custo_extra_transicionar)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rpc_custo_extra_transicionar(
   p_id UUID,
   p_acao TEXT,
   p_updated_at TIMESTAMPTZ,
   p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
   v_user_id UUID := auth.uid();
   v_user_tenant_id UUID;
   v_user_role TEXT;
   v_is_service_role BOOLEAN := FALSE;
   v_registro RECORD;
   v_novo_pipeline_status TEXT;
   v_novo_status_pagamento TEXT;
BEGIN
   -- 1. Identidade e Autenticação
   IF public.is_service_role() THEN
       v_is_service_role := TRUE;
   ELSE
       IF v_user_id IS NULL THEN
           RAISE EXCEPTION 'AUTH_REQUIRED: Operação restrita a usuários autenticados.';
       END IF;
   END IF;

   -- 2. Identificação de Tenant e Role com Fail-Closed
   IF NOT v_is_service_role THEN
       SELECT tenant_id, lower(role) INTO v_user_tenant_id, v_user_role
       FROM public.profiles
       WHERE user_id = v_user_id OR id = v_user_id
       LIMIT 1;

       IF v_user_tenant_id IS NULL THEN
           v_user_tenant_id := public.current_tenant_id();
       END IF;

       IF v_user_tenant_id IS NULL THEN
           RAISE EXCEPTION 'TENANT_REQUIRED: Não foi possível determinar o tenant do usuário autenticado.';
       END IF;

       IF v_user_role IS NULL THEN
           RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Usuário autenticado não possui perfil configurado.';
       END IF;

       -- Verificação de autorização com has_user_permission
       IF p_acao = 'finalizar_pagamento' THEN
           IF NOT public.has_user_permission(v_user_id, 'pagamentos_remessas', 'aprovar', v_user_tenant_id)
              AND NOT public.has_user_permission(v_user_id, 'central_financeira', 'aprovar', v_user_tenant_id) THEN
               RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Usuário não possui autorização financeira para liquidar pagamentos de custos extras.';
           END IF;
       ELSIF p_acao IN ('avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver') THEN
           IF NOT public.has_user_permission(v_user_id, 'processamento_rh', 'aprovar', v_user_tenant_id)
              AND NOT public.has_user_permission(v_user_id, 'central_financeira', 'aprovar', v_user_tenant_id) THEN
               RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Usuário não possui autorização (processamento_rh:aprovar) para transicionar custos extras.';
           END IF;
       ELSE
           RAISE EXCEPTION 'Ação de transição desconhecida: %', p_acao;
       END IF;
   END IF;

   -- 3. Lock do registro para concorrência segura (FOR UPDATE)
   SELECT * INTO v_registro
   FROM public.custos_extras_operacionais
   WHERE id = p_id
   FOR UPDATE;
   
   IF NOT FOUND OR v_registro IS NULL THEN
      RAISE EXCEPTION 'REGISTRO_NOT_FOUND: Custo extra % não encontrado.', p_id;
   END IF;

   -- 4. Isolamento Multi-tenant
   IF NOT v_is_service_role AND v_registro.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Acesso negado. O registro de custo extra pertence a outro tenant.';
   END IF;

   -- 5. Concorrência Otimista (OCC)
   IF p_updated_at IS NOT NULL AND v_registro.atualizado_em IS DISTINCT FROM p_updated_at THEN
      RAISE EXCEPTION 'CONCORRENCIA: Registro modificado por outro usuário. Recarregue a página.';
   END IF;

   -- 6. Determinação de novos status de pipeline
   IF p_acao = 'aprovar' THEN
       v_novo_pipeline_status := 'APROVADO';
       v_novo_status_pagamento := v_registro.status_pagamento;
   ELSIF p_acao = 'devolver' THEN
       v_novo_pipeline_status := 'DEVOLVIDO';
       v_novo_status_pagamento := 'pendente';
   ELSIF p_acao = 'avancar_validacao' THEN
       v_novo_pipeline_status := 'EM_VALIDACAO';
       v_novo_status_pagamento := v_registro.status_pagamento;
   ELSIF p_acao = 'enviar_financeiro' THEN
       v_novo_pipeline_status := 'ENVIADO_FINANCEIRO';
       v_novo_status_pagamento := v_registro.status_pagamento;
   ELSIF p_acao = 'finalizar_pagamento' THEN
       v_novo_pipeline_status := v_registro.pipeline_status;
       v_novo_status_pagamento := 'pago';
   END IF;

   -- 7. Efetivação
   UPDATE public.custos_extras_operacionais
   SET pipeline_status = COALESCE(v_novo_pipeline_status, pipeline_status),
       status_pagamento = COALESCE(v_novo_status_pagamento, status_pagamento),
       justificativa_devolucao = CASE WHEN p_acao = 'devolver' THEN p_justificativa ELSE justificativa_devolucao END,
       atualizado_em = now()
   WHERE id = p_id;

   RETURN jsonb_build_object(
       'success', true,
       'id', p_id,
       'pipeline_status', v_novo_pipeline_status,
       'status_pagamento', v_novo_status_pagamento,
       'updated_at', now()
   );
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_custo_extra_transicionar(UUID, TEXT, TIMESTAMPTZ, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rpc_custo_extra_transicionar(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 7. DOMÍNIO 6: SERVIÇOS EXTRAS (servicos_extras_operacionais)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_check_servico_extra_approval_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_service_role() THEN
    RETURN NEW;
  END IF;

  -- Se o pipeline_status estiver sendo alterado para estados de aprovação ou devolução
  IF NEW.pipeline_status IS DISTINCT FROM OLD.pipeline_status THEN
    IF NEW.pipeline_status IN ('APROVADO_OPERACAO', 'DEVOLVIDO', 'APROVADO_FINANCEIRO') THEN
      IF NOT (
        public.has_user_permission(auth.uid(), 'operacoes_recebidas', 'aprovar', NEW.tenant_id)
        OR public.has_user_permission(auth.uid(), 'processamento_rh', 'aprovar', NEW.tenant_id)
        OR public.has_user_permission(auth.uid(), 'central_financeira', 'aprovar', NEW.tenant_id)
      ) THEN
        RAISE EXCEPTION 'PERMISSION_DENIED: Usuário não possui autorização para aprovar ou devolver serviços extras.';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_servico_extra_approval_permission ON public.servicos_extras_operacionais;
CREATE TRIGGER trg_check_servico_extra_approval_permission
BEFORE UPDATE ON public.servicos_extras_operacionais
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_servico_extra_approval_permission();

-- ------------------------------------------------------------------------------
-- 8. REGISTRO OFICIAL NO HISTÓRICO DE MIGRATIONS (supabase_migrations.schema_migrations)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'supabase_migrations' 
      AND table_name = 'schema_migrations'
  ) THEN
    INSERT INTO supabase_migrations.schema_migrations (version)
    VALUES ('20261102000000')
    ON CONFLICT (version) DO NOTHING;
  END IF;
END $$;

