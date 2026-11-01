-- Migration: 20261018130000_fix_dia_01_reabertura_novo_fechamento.sql
-- Objetivo: FIX-DIA-01 — Fechamento Atômico Transacional e Blindado de Diaristas
--           Reutiliza lote existente em status 'EM_ABERTO' preservando ID e auditoria
--           Garante concorrência com SELECT FOR UPDATE e tratamento de colisão 23505
--           Validações de RBAC, Isolamento Tenant/Empresa e integridade referencial
-- Status: LOCAL PREPARADA (Aguardando autorização expressa para execução em produção)

BEGIN;

CREATE OR REPLACE FUNCTION public.fechar_ou_refechar_periodo_diaristas(
  p_tenant_id        UUID,
  p_empresa_id       UUID,
  p_periodo_inicio   DATE,
  p_periodo_fim      DATE,
  p_total_registros  INT,
  p_valor_total      NUMERIC,
  p_fechado_por      UUID,
  p_fechado_por_nome TEXT,
  p_fechado_por_role TEXT,
  p_observacoes      TEXT,
  p_lancamento_ids   UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lote_id             UUID;
  v_status              TEXT;
  v_lote                RECORD;
  v_mes_ref             TEXT;
  v_auth_uid            UUID;
  v_db_tenant_id        UUID;
  v_db_role             TEXT;
  v_db_nome             TEXT;
  v_effective_tenant_id UUID;
BEGIN
  -- 1. Validação de parâmetros fundamentais
  IF p_empresa_id IS NULL OR p_periodo_inicio IS NULL OR p_periodo_fim IS NULL THEN
    RAISE EXCEPTION 'BAD_REQUEST: Parâmetros obrigatórios ausentes para fechamento do período de diaristas.';
  END IF;

  -- 2. Determinação estrita da identidade do executor (auth.uid)
  v_auth_uid := auth.uid();
  IF v_auth_uid IS NULL THEN
    -- Contexto de execução sem contexto HTTP (ex: migrations, scripts service_role): exige p_fechado_por explícito
    IF p_fechado_por IS NULL THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Sessão não autenticada e identificador não informado.';
    END IF;
    v_auth_uid := p_fechado_por;
  ELSE
    -- Em contexto autenticado pelo Supabase, auth.uid() é a autoridade máxima; impede personificação
    IF p_fechado_por IS NOT NULL AND p_fechado_por != v_auth_uid THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Identificador informado não confere com o usuário autenticado.';
    END IF;
  END IF;

  -- 3. Obtenção confiável de perfil e tenant na base de dados (impede elevação de privilégio via parâmetros)
  SELECT tenant_id, lower(trim(role)), full_name
  INTO v_db_tenant_id, v_db_role, v_db_nome
  FROM public.profiles
  WHERE user_id = v_auth_uid;

  IF NOT FOUND THEN
    SELECT tenant_id, lower(trim(role)), full_name
    INTO v_db_tenant_id, v_db_role, v_db_nome
    FROM public.user_permissions
    WHERE user_id = v_auth_uid AND status = 'ativo';
  END IF;

  -- Fallback para execução controlada administrativa caso auth.uid() seja nulo e parâmetros tenham sido fornecidos
  IF v_db_role IS NULL THEN
    IF auth.uid() IS NULL AND p_fechado_por_role IS NOT NULL THEN
      v_db_role := lower(trim(p_fechado_por_role));
      v_db_tenant_id := p_tenant_id;
      v_db_nome := p_fechado_por_nome;
    ELSE
      RAISE EXCEPTION 'UNAUTHORIZED: Perfil do usuário não localizado na base de dados.';
    END IF;
  END IF;

  -- Validação estrita de autorização de perfil (RBAC) com a role comprovada no banco
  IF v_db_role NOT IN ('encarregado', 'rh', 'admin', 'gestor', 'supervisor') THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Perfil "%" não possui autorização para fechar período de diaristas.', v_db_role;
  END IF;

  -- 4. Isolamento Tenant / Empresa: Validação com base no tenant confiável do usuário
  IF v_db_tenant_id IS NOT NULL AND p_tenant_id IS NOT NULL AND v_db_tenant_id != p_tenant_id THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: Usuário não pertence ao tenant especificado.';
  END IF;
  v_effective_tenant_id := COALESCE(v_db_tenant_id, p_tenant_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = p_empresa_id AND tenant_id = v_effective_tenant_id
  ) THEN
    RAISE EXCEPTION 'TENANT_MISMATCH: A empresa informada não pertence ao tenant especificado ou não existe.';
  END IF;

  -- 5. Isolamento estrito dos lançamentos informados (prevenção de vazamento entre empresas/tenants)
  IF p_lancamento_ids IS NOT NULL AND array_length(p_lancamento_ids, 1) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.lancamentos_diaristas
      WHERE id = ANY(p_lancamento_ids)
        AND (tenant_id != v_effective_tenant_id OR empresa_id != p_empresa_id)
    ) THEN
      RAISE EXCEPTION 'CROSS_TENANT_VIOLATION: Lançamentos informados não pertencem à empresa ou ao tenant.';
    END IF;
  END IF;

  v_mes_ref := to_char(p_periodo_inicio, 'YYYY-MM');

  -- 6. Bloqueio pessimista por período/empresa/tenant para proteção estrita de concorrência
  SELECT id, status INTO v_lote_id, v_status
  FROM public.diaristas_lotes_fechamento
  WHERE tenant_id = v_effective_tenant_id
    AND empresa_id = p_empresa_id
    AND periodo_inicio = p_periodo_inicio
    AND periodo_fim = p_periodo_fim
  FOR UPDATE;

  IF FOUND THEN
    -- Se o lote já existe e está EM_ABERTO (reaberto operacionalmente), reutiliza o lote
    IF UPPER(v_status) = 'EM_ABERTO' THEN
      UPDATE public.diaristas_lotes_fechamento
      SET
        total_registros  = p_total_registros,
        valor_total      = p_valor_total,
        status           = 'AGUARDANDO_VALIDACAO_RH',
        fechado_por      = v_auth_uid,
        fechado_por_nome = COALESCE(v_db_nome, p_fechado_por_nome, 'Usuário'),
        fechado_em       = now(),
        observacoes      = p_observacoes,
        tipo_reabertura  = NULL,
        updated_at       = now()
      WHERE id = v_lote_id
      RETURNING * INTO v_lote;

      -- Log de auditoria de novo fechamento
      INSERT INTO public.diaristas_logs_fechamento (
        empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role,
        acao, periodo_inicio, periodo_fim, motivo
      ) VALUES (
        p_empresa_id, v_effective_tenant_id, v_auth_uid, 
        COALESCE(v_db_nome, p_fechado_por_nome, 'Usuário'), 
        v_db_role,
        'REFECHAMENTO_LADO_RH', p_periodo_inicio, p_periodo_fim,
        'Lote ' || v_lote_id::text || ' re-fechado com ' || p_total_registros || ' itens. Valor R$ ' || p_valor_total || '.'
      );

    ELSE
      -- Concorrência: lote já está fechado, em validação, financeiro, pago ou cancelado
      RAISE EXCEPTION 'CONCURRENCY_ERROR: Já existe um lote ativo para este período (status: %).', v_status;
    END IF;

  ELSE
    -- 7. Lote inédito para o período: criação segura com tratamento de colisão simultânea (duplo fechamento)
    BEGIN
      INSERT INTO public.diaristas_lotes_fechamento (
        tenant_id,
        empresa_id,
        periodo_inicio,
        periodo_fim,
        mes_referencia,
        total_registros,
        valor_total,
        status,
        fechado_por,
        fechado_por_nome,
        fechado_em,
        observacoes
      ) VALUES (
        v_effective_tenant_id,
        p_empresa_id,
        p_periodo_inicio,
        p_periodo_fim,
        v_mes_ref,
        p_total_registros,
        p_valor_total,
        'AGUARDANDO_VALIDACAO_RH',
        v_auth_uid,
        COALESCE(v_db_nome, p_fechado_por_nome, 'Usuário'),
        now(),
        p_observacoes
      )
      RETURNING * INTO v_lote;

      v_lote_id := v_lote.id;

      -- Log de auditoria de fechamento inicial
      INSERT INTO public.diaristas_logs_fechamento (
        empresa_id, tenant_id, usuario_id, usuario_nome, usuario_role,
        acao, periodo_inicio, periodo_fim, motivo
      ) VALUES (
        p_empresa_id, v_effective_tenant_id, v_auth_uid, 
        COALESCE(v_db_nome, p_fechado_por_nome, 'Usuário'), 
        v_db_role,
        'FECHAMENTO_LADO_RH', p_periodo_inicio, p_periodo_fim,
        'Lote ' || v_lote_id::text || ' gerado com ' || p_total_registros || ' itens. Valor R$ ' || p_valor_total || '.'
      );

    EXCEPTION WHEN unique_violation THEN
      -- Colisão na inserção simultânea do primeiro lote: re-consulta com FOR UPDATE
      SELECT id, status INTO v_lote_id, v_status
      FROM public.diaristas_lotes_fechamento
      WHERE tenant_id = v_effective_tenant_id
        AND empresa_id = p_empresa_id
        AND periodo_inicio = p_periodo_inicio
        AND periodo_fim = p_periodo_fim
      FOR UPDATE;

      IF FOUND THEN
        IF UPPER(v_status) = 'EM_ABERTO' THEN
          UPDATE public.diaristas_lotes_fechamento
          SET
            total_registros  = p_total_registros,
            valor_total      = p_valor_total,
            status           = 'AGUARDANDO_VALIDACAO_RH',
            fechado_por      = v_auth_uid,
            fechado_por_nome = COALESCE(v_db_nome, p_fechado_por_nome, 'Usuário'),
            fechado_em       = now(),
            observacoes      = p_observacoes,
            tipo_reabertura  = NULL,
            updated_at       = now()
          WHERE id = v_lote_id
          RETURNING * INTO v_lote;
        ELSE
          RAISE EXCEPTION 'CONCURRENCY_ERROR: Já existe um lote ativo para este período (status: %).', v_status;
        END IF;
      ELSE
        RAISE EXCEPTION 'CONCURRENCY_ERROR: Concorrência detectada ao criar lote de fechamento.';
      END IF;
    END;
  END IF;

  -- 8. Atualizar e vincular atomicamente os lançamentos escopados
  IF p_lancamento_ids IS NOT NULL AND array_length(p_lancamento_ids, 1) > 0 THEN
    UPDATE public.lancamentos_diaristas
    SET
      status             = 'AGUARDANDO_VALIDACAO_RH',
      lote_fechamento_id = v_lote_id,
      updated_at         = now()
    WHERE id = ANY(p_lancamento_ids)
      AND tenant_id = v_effective_tenant_id;
  END IF;

  RETURN to_jsonb(v_lote);
END;
$$;

-- Permissões estritas: Revoga de PUBLIC e anon; concede apenas a authenticated e service_role
REVOKE ALL ON FUNCTION public.fechar_ou_refechar_periodo_diaristas(UUID,UUID,DATE,DATE,INT,NUMERIC,UUID,TEXT,TEXT,TEXT,UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fechar_ou_refechar_periodo_diaristas(UUID,UUID,DATE,DATE,INT,NUMERIC,UUID,TEXT,TEXT,TEXT,UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.fechar_ou_refechar_periodo_diaristas(UUID,UUID,DATE,DATE,INT,NUMERIC,UUID,TEXT,TEXT,TEXT,UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fechar_ou_refechar_periodo_diaristas(UUID,UUID,DATE,DATE,INT,NUMERIC,UUID,TEXT,TEXT,TEXT,UUID[]) TO service_role;

COMMIT;
