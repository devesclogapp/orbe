-- ==============================================================================
-- SCRIPT DE CONTINGÊNCIA / ROLLBACK: SEC-03 BACKEND AUTHORIZATION
-- Arquivo: rollback_20261102000000_sec_03_backend_authorization_approvals.sql
-- Objetivo: Restaurar integralmente o estado das funções, triggers e privilégios
--           ao estado imediatamente anterior à migration SEC-03.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REMOÇÃO DOS TRIGGERS DE BARREIRA ADICIONADOS PELA SEC-03
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ponto_approval_permission ON public.registros_ponto;
DROP FUNCTION IF EXISTS public.trg_check_ponto_approval_permission();

DROP TRIGGER IF EXISTS trg_intermitentes_approval_permission ON public.intermitentes_lotes_fechamento;
DROP FUNCTION IF EXISTS public.trg_check_intermitentes_approval_permission();

DROP TRIGGER IF EXISTS trg_check_servico_extra_approval_permission ON public.servicos_extras_operacionais;
DROP FUNCTION IF EXISTS public.trg_check_servico_extra_approval_permission();

-- ------------------------------------------------------------------------------
-- 2. RESTAURAÇÃO DAS RPCS AO ESTADO HOMOLOGADO ANTERIOR
-- ------------------------------------------------------------------------------

-- 2.1 Diaristas: validar_periodo_diaristas (Restaura versão de 20260537_fix_sync_status_diaristas.sql)
CREATE OR REPLACE FUNCTION public.validar_periodo_diaristas(
  p_lote_id UUID,
  p_usuario_id UUID,
  p_usuario_nome TEXT,
  p_usuario_role TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_empresa_id UUID;
  v_periodo_inicio DATE;
  v_periodo_fim DATE;
  v_tenant_id UUID;
BEGIN
  SELECT empresa_id, periodo_inicio, periodo_fim, tenant_id 
  INTO v_empresa_id, v_periodo_inicio, v_periodo_fim, v_tenant_id
  FROM public.diaristas_lotes_fechamento WHERE id = p_lote_id;

  UPDATE public.lancamentos_diaristas
  SET status = 'VALIDADO_RH', updated_at = now()
  WHERE lote_fechamento_id = p_lote_id;

  UPDATE public.diaristas_lotes_fechamento
  SET status = 'VALIDADO_RH', updated_at = now()
  WHERE id = p_lote_id;

  INSERT INTO public.diaristas_logs_fechamento 
  (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role, acao, periodo_inicio, periodo_fim)
  VALUES 
  (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role, 'VALIDOU', v_periodo_inicio, v_periodo_fim);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validar_periodo_diaristas(UUID, UUID, TEXT, TEXT) TO authenticated, service_role;

-- 2.2 Diaristas: reabrir_periodo_diaristas (Restaura versão de 20260541_tipo_reabertura_diaristas.sql)
CREATE OR REPLACE FUNCTION public.reabrir_periodo_diaristas(
  p_lote_id        UUID,
  p_usuario_id     UUID,
  p_usuario_nome   TEXT,
  p_usuario_role   TEXT,
  p_motivo         TEXT,
  p_tipo_reabertura TEXT DEFAULT 'operacional'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_empresa_id     UUID;
  v_periodo_inicio DATE;
  v_periodo_fim    DATE;
  v_tenant_id      UUID;
  v_tipo           TEXT;
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

  IF v_tipo = 'operacional' THEN
    UPDATE public.lancamentos_diaristas
    SET status            = 'EM_ABERTO',
        lote_fechamento_id = NULL,
        updated_at        = now()
    WHERE lote_fechamento_id = p_lote_id;

    UPDATE public.diaristas_lotes_fechamento
    SET status           = 'EM_ABERTO',
        tipo_reabertura  = 'operacional',
        updated_at       = now()
    WHERE id = p_lote_id;
  ELSIF v_tipo = 'administrativa' THEN
    UPDATE public.lancamentos_diaristas
    SET status     = 'AGUARDANDO_VALIDACAO_RH',
        updated_at = now()
    WHERE lote_fechamento_id = p_lote_id;

    UPDATE public.diaristas_lotes_fechamento
    SET status          = 'AGUARDANDO_VALIDACAO_RH',
        tipo_reabertura = 'administrativa',
        updated_at      = now()
    WHERE id = p_lote_id;
  END IF;

  INSERT INTO public.diaristas_logs_fechamento
    (empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role,
     acao, periodo_inicio, periodo_fim, motivo)
  VALUES
    (v_empresa_id, v_tenant_id, p_usuario_id, p_usuario_nome, p_usuario_role,
     'REABRIU', v_periodo_inicio, v_periodo_fim,
     '[' || UPPER(v_tipo) || '] ' || COALESCE(p_motivo, 'Não informado'));
END;
$$;

GRANT EXECUTE ON FUNCTION public.reabrir_periodo_diaristas(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 2.3 Operações: rpc_rh_aprovar_operacao (Restaura versão de 20261016210000_fix_lote2_operacoes_volume_rpcs.sql)
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

    IF auth.role() = 'service_role' THEN
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

        IF v_user_role NOT IN ('rh', 'admin', 'super_admin', 'gestor') THEN
            RAISE EXCEPTION 'PERMISSION_DENIED: Perfil % não autorizado para aprovação RH de operações.', v_user_role;
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

GRANT EXECUTE ON FUNCTION public.rpc_rh_aprovar_operacao(UUID) TO authenticated, service_role;

-- 2.4 Operações: rpc_rh_devolver_operacao (Restaura versão de 20260807180001_rpc_rh_operacoes.sql)
CREATE OR REPLACE FUNCTION public.rpc_rh_devolver_operacao(
    p_operacao_id UUID,
    p_motivo TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.operacoes_producao
    SET status_rh = 'DEVOLVIDO_RH',
        status = 'EM_RESTRICAO',
        avaliacao_json = CASE 
            WHEN p_motivo IS NOT NULL THEN COALESCE(avaliacao_json, '{}'::jsonb) || jsonb_build_object('motivo_devolucao_rh', p_motivo, 'data_devolucao_rh', now())
            ELSE avaliacao_json
        END,
        atualizado_em = now()
    WHERE id = p_operacao_id;
    
    RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_rh_devolver_operacao(UUID, TEXT) TO authenticated, service_role;

-- 2.5 Custos Extras: rpc_custo_extra_transicionar (Restaura versão de 20260918130000_fase1_custos_extras_origem_recurso_rpc.sql)
CREATE OR REPLACE FUNCTION public.rpc_custo_extra_transicionar(
   p_id UUID,
   p_acao TEXT,
   p_updated_at TIMESTAMPTZ,
   p_justificativa TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
   IF v_user_id IS NULL THEN
       IF current_setting('role', true) = 'service_role' OR current_user = 'service_role' THEN
           v_is_service_role := TRUE;
       ELSE
           RAISE EXCEPTION 'AUTH_REQUIRED: Operação restrita a usuários autenticados.';
       END IF;
   END IF;

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
           RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Usuário autenticado não possui perfil (role) configurado.';
       END IF;

       IF p_acao = 'finalizar_pagamento' THEN
           IF v_user_role NOT IN ('admin', 'financeiro') THEN
               RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin ou financeiro podem liquidar pagamentos de custos extras. Perfil atual: %', v_user_role;
           END IF;
       ELSIF p_acao IN ('avancar_validacao', 'aprovar', 'enviar_financeiro', 'devolver') THEN
           IF v_user_role NOT IN ('admin', 'rh', 'financeiro') THEN
               RAISE EXCEPTION 'ROLE_NOT_AUTHORIZED: Apenas usuários com perfil admin, rh ou financeiro podem transicionar custos extras. Perfil atual: %', v_user_role;
           END IF;
       ELSE
           RAISE EXCEPTION 'Açao de transicao desconhecida: %', p_acao;
       END IF;
   END IF;

   SELECT * INTO v_registro
   FROM public.custos_extras_operacionais
   WHERE id = p_id
   FOR UPDATE;
   
   IF NOT FOUND OR v_registro IS NULL THEN
      RAISE EXCEPTION 'REGISTRO_NOT_FOUND: Custo extra % não encontrado.', p_id;
   END IF;

   IF NOT v_is_service_role AND v_registro.tenant_id IS DISTINCT FROM v_user_tenant_id THEN
      RAISE EXCEPTION 'TENANT_MISMATCH: Acesso negado. O registro de custo extra pertence a outro tenant.';
   END IF;

   IF p_updated_at IS NOT NULL AND v_registro.atualizado_em IS DISTINCT FROM p_updated_at THEN
      RAISE EXCEPTION 'CONCORRENCIA: Registro modificado por outro usuário. Recarregue a página.';
   END IF;

   IF v_registro.deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'ESTADO_INVALIDO: Registro foi excluído logicamente.';
   END IF;

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

GRANT EXECUTE ON FUNCTION public.rpc_custo_extra_transicionar(UUID, TEXT, TIMESTAMPTZ, TEXT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. REMOÇÃO DAS FUNÇÕES AUXILIARES DA SEC-03 (SE NÃO UTILIZADAS POR OUTROS)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.has_user_permission(UUID, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS public.is_service_role();

-- ------------------------------------------------------------------------------
-- 4. REMOÇÃO DO HISTÓRICO NO SUPABASE CLI (schema_migrations)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'supabase_migrations' 
      AND table_name = 'schema_migrations'
  ) THEN
    DELETE FROM supabase_migrations.schema_migrations 
    WHERE version = '20261102000000';
  END IF;
END $$;

