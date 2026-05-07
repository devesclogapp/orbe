BEGIN;

-- ============================================================
-- FASE 9 - Reinicializacao Operacional Controlada
-- Objetivo:
--   1. Permitir reset seguro e multi-tenant por modo
--   2. Preservar estrutura, usuarios, governanca e trilhas auditoraveis
--   3. Integrar os resets a auditoria executiva e timeline corporativa
-- ============================================================

CREATE TABLE IF NOT EXISTS public.auditoria_reset_operacional (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome TEXT,
  tipo_reset TEXT NOT NULL CHECK (
    tipo_reset IN (
      'RESET_OPERACIONAL',
      'RESET_FINANCEIRO',
      'RESET_COMPLETO_TENANT'
    )
  ),
  justificativa TEXT NOT NULL,
  tabelas_afetadas JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_registros_removidos INTEGER NOT NULL DEFAULT 0,
  request_ip TEXT,
  request_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_auditoria_reset_operacional_tenant_created
  ON public.auditoria_reset_operacional (tenant_id, created_at DESC);

ALTER TABLE public.auditoria_reset_operacional ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auditoria_reset_operacional_select_admin" ON public.auditoria_reset_operacional;
CREATE POLICY "auditoria_reset_operacional_select_admin"
  ON public.auditoria_reset_operacional
  FOR SELECT TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND p.tenant_id = auditoria_reset_operacional.tenant_id
        AND lower(COALESCE(p.role, '')) IN ('admin', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION public.prevent_auditoria_reset_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria de reset e imutavel.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_auditoria_reset_update ON public.auditoria_reset_operacional;
CREATE TRIGGER trg_prevent_auditoria_reset_update
  BEFORE UPDATE OR DELETE ON public.auditoria_reset_operacional
  FOR EACH ROW EXECUTE FUNCTION public.prevent_auditoria_reset_mutation();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'auditoria_workflow_ciclos') THEN
    ALTER TABLE public.auditoria_workflow_ciclos
      ADD COLUMN IF NOT EXISTS competencia_snapshot TEXT,
      ADD COLUMN IF NOT EXISTS referencia_reset_id UUID REFERENCES public.auditoria_reset_operacional(id) ON DELETE SET NULL;

    ALTER TABLE public.auditoria_workflow_ciclos
      ALTER COLUMN ciclo_id DROP NOT NULL;

    ALTER TABLE public.auditoria_workflow_ciclos
      DROP CONSTRAINT IF EXISTS auditoria_workflow_ciclos_etapa_check;

    ALTER TABLE public.auditoria_workflow_ciclos
      ADD CONSTRAINT auditoria_workflow_ciclos_etapa_check
      CHECK (etapa IN ('OPERACIONAL', 'RH', 'FINANCEIRO', 'REMESSA', 'SISTEMA'));

    ALTER TABLE public.auditoria_workflow_ciclos
      DROP CONSTRAINT IF EXISTS auditoria_workflow_ciclos_acao_check;

    ALTER TABLE public.auditoria_workflow_ciclos
      ADD CONSTRAINT auditoria_workflow_ciclos_acao_check
      CHECK (acao IN ('APROVAR', 'REJEITAR', 'REABRIR', 'GERAR', 'RESET'));

    IF EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name = 'auditoria_workflow_ciclos'
        AND constraint_name = 'auditoria_workflow_ciclos_ciclo_id_fkey'
    ) THEN
      ALTER TABLE public.auditoria_workflow_ciclos
        DROP CONSTRAINT auditoria_workflow_ciclos_ciclo_id_fkey;
    END IF;

    ALTER TABLE public.auditoria_workflow_ciclos
      ADD CONSTRAINT auditoria_workflow_ciclos_ciclo_id_fkey
      FOREIGN KEY (ciclo_id)
      REFERENCES public.ciclos_operacionais(id)
      ON DELETE SET NULL;

    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_auditoria_workflow_reset_ref ON public.auditoria_workflow_ciclos (referencia_reset_id)';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.is_reset_operacional_role()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.tenant_id = public.current_tenant_id()
      AND lower(COALESCE(p.role, '')) IN ('admin', 'super_admin')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_reset_request_ip()
RETURNS TEXT AS $$
DECLARE
  v_headers JSONB;
  v_candidate TEXT;
BEGIN
  BEGIN
    v_headers := COALESCE(NULLIF(current_setting('request.headers', true), ''), '{}')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_headers := '{}'::jsonb;
  END;

  v_candidate := COALESCE(
    NULLIF(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1), ''),
    NULLIF(v_headers ->> 'x-real-ip', ''),
    NULLIF(v_headers ->> 'cf-connecting-ip', ''),
    NULLIF(v_headers ->> 'fly-client-ip', '')
  );

  RETURN NULLIF(BTRIM(v_candidate), '');
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_reset_mode_metadata(p_mode TEXT)
RETURNS TABLE (
  mode_key TEXT,
  mode_audit_label TEXT,
  expected_confirmation TEXT,
  workflow_stage TEXT,
  human_label TEXT
) AS $$
BEGIN
  CASE upper(COALESCE(p_mode, ''))
    WHEN 'OPERACIONAL' THEN
      RETURN QUERY
      SELECT
        'operacional'::text,
        'RESET_OPERACIONAL'::text,
        'DIGITE RESET OPERACIONAL'::text,
        'OPERACIONAL'::text,
        'Reset Operacional'::text;
    WHEN 'FINANCEIRO' THEN
      RETURN QUERY
      SELECT
        'financeiro'::text,
        'RESET_FINANCEIRO'::text,
        'DIGITE RESET FINANCEIRO'::text,
        'FINANCEIRO'::text,
        'Reset Financeiro'::text;
    WHEN 'COMPLETO' THEN
      RETURN QUERY
      SELECT
        'completo'::text,
        'RESET_COMPLETO_TENANT'::text,
        'DIGITE RESET COMPLETO'::text,
        'SISTEMA'::text,
        'Reset Completo do Tenant'::text;
    ELSE
      RAISE EXCEPTION 'Modo de reset invalido: %', p_mode;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.build_reset_plan(p_mode TEXT)
RETURNS JSONB AS $$
DECLARE
  v_plan JSONB;
BEGIN
  CASE upper(COALESCE(p_mode, ''))
    WHEN 'OPERACIONAL' THEN
      v_plan := jsonb_build_array(
        jsonb_build_object(
          'table_name', 'processamento_rh_inconsistencias',
          'delete_priority', 10,
          'descricao', 'Inconsistencias do processamento RH',
          'count_sql', 'SELECT COUNT(*) FROM public.processamento_rh_inconsistencias WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.processamento_rh_inconsistencias WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'processamento_rh_logs',
          'delete_priority', 20,
          'descricao', 'Logs transitórios do processamento RH',
          'count_sql', 'SELECT COUNT(*) FROM public.processamento_rh_logs WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.processamento_rh_logs WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'resultados_processamento',
          'delete_priority', 30,
          'descricao', 'Memoria transitória de processamento',
          'count_sql', 'SELECT COUNT(*) FROM public.resultados_processamento WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.resultados_processamento WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'motor_auditoria_logs',
          'delete_priority', 40,
          'descricao', 'Memoria transitória do motor operacional',
          'count_sql', 'SELECT COUNT(*) FROM public.motor_auditoria_logs WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.motor_auditoria_logs WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'banco_horas_eventos',
          'delete_priority', 50,
          'descricao', 'Eventos do banco de horas',
          'count_sql', 'SELECT COUNT(*) FROM public.banco_horas_eventos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.banco_horas_eventos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'banco_horas_saldos',
          'delete_priority', 60,
          'descricao', 'Saldos acumulados do banco de horas',
          'count_sql', 'SELECT COUNT(*) FROM public.banco_horas_saldos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.banco_horas_saldos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'fechamento_mensal',
          'delete_priority', 70,
          'descricao', 'Fechamentos mensais de RH',
          'count_sql', 'SELECT COUNT(*) FROM public.fechamento_mensal WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.fechamento_mensal WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'ciclos_operacionais',
          'delete_priority', 80,
          'descricao', 'Ciclos operacionais e workflow temporario',
          'count_sql', 'SELECT COUNT(*) FROM public.ciclos_operacionais WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.ciclos_operacionais WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'ciclos_diaristas',
          'delete_priority', 90,
          'descricao', 'Ciclos operacionais de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.ciclos_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.ciclos_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'production_entry_collaborators',
          'delete_priority', 100,
          'descricao', 'Colaboradores vinculados nas entradas de producao',
          'count_sql', 'SELECT COUNT(*) FROM public.production_entry_collaborators pec WHERE EXISTS (SELECT 1 FROM public.operacoes_producao op WHERE op.id = pec.production_entry_id AND op.tenant_id = $1)',
          'delete_sql', 'DELETE FROM public.production_entry_collaborators pec WHERE EXISTS (SELECT 1 FROM public.operacoes_producao op WHERE op.id = pec.production_entry_id AND op.tenant_id = $1)'
        ),
        jsonb_build_object(
          'table_name', 'operacoes_producao',
          'delete_priority', 110,
          'descricao', 'Lancamentos de producao',
          'count_sql', 'SELECT COUNT(*) FROM public.operacoes_producao WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.operacoes_producao WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lancamentos_diaristas',
          'delete_priority', 120,
          'descricao', 'Lancamentos diarios de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.lancamentos_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lancamentos_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'diaristas_lotes_fechamento',
          'delete_priority', 130,
          'descricao', 'Lotes de fechamento de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.diaristas_lotes_fechamento WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.diaristas_lotes_fechamento WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'operacoes',
          'delete_priority', 140,
          'descricao', 'Operacoes recebidas legadas',
          'count_sql', 'SELECT COUNT(*) FROM public.operacoes WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.operacoes WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'custos_extras_operacionais',
          'delete_priority', 150,
          'descricao', 'Custos extras operacionais',
          'count_sql', 'SELECT COUNT(*) FROM public.custos_extras_operacionais WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.custos_extras_operacionais WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'registros_ponto',
          'delete_priority', 160,
          'descricao', 'Registros de ponto recebidos',
          'count_sql', 'SELECT COUNT(*) FROM public.registros_ponto WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.registros_ponto WHERE tenant_id = $1'
        )
      );
    WHEN 'FINANCEIRO' THEN
      v_plan := jsonb_build_array(
        jsonb_build_object(
          'table_name', 'financeiro_conciliacoes',
          'delete_priority', 210,
          'descricao', 'Conciliacoes financeiras',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_conciliacoes WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_conciliacoes WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_retorno_itens',
          'delete_priority', 220,
          'descricao', 'Itens de retorno CNAB',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_retorno_itens WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_retorno_itens WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_retorno_arquivos',
          'delete_priority', 230,
          'descricao', 'Arquivos de retorno CNAB',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_retorno_arquivos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_retorno_arquivos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_remessas_arquivos',
          'delete_priority', 240,
          'descricao', 'Arquivos de remessa CNAB',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_remessas_arquivos WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_remessas_arquivos WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lote_pagamento_itens',
          'delete_priority', 250,
          'descricao', 'Itens de lote de pagamento',
          'count_sql', 'SELECT COUNT(*) FROM public.lote_pagamento_itens WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lote_pagamento_itens WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lote_pagamento_diaristas',
          'delete_priority', 260,
          'descricao', 'Lotes de pagamento de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.lote_pagamento_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lote_pagamento_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lotes_remessa',
          'delete_priority', 270,
          'descricao', 'Lotes de remessa',
          'count_sql', 'SELECT COUNT(*) FROM public.lotes_remessa WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lotes_remessa WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'faturas',
          'delete_priority', 280,
          'descricao', 'Faturas geradas pelo motor financeiro',
          'count_sql', 'SELECT COUNT(*) FROM public.faturas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.faturas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_calculos_memoria',
          'delete_priority', 290,
          'descricao', 'Memoria de calculo financeiro',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_calculos_memoria WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_calculos_memoria WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_consolidados_cliente',
          'delete_priority', 300,
          'descricao', 'Consolidados financeiros por cliente',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_consolidados_cliente WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_consolidados_cliente WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_consolidados_colaborador',
          'delete_priority', 310,
          'descricao', 'Consolidados financeiros por colaborador',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_consolidados_colaborador WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_consolidados_colaborador WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lancamentos_financeiros',
          'delete_priority', 320,
          'descricao', 'Lancamentos financeiros transacionais',
          'count_sql', 'SELECT COUNT(*) FROM public.lancamentos_financeiros WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lancamentos_financeiros WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'lancamentos_adicionais_diaristas',
          'delete_priority', 330,
          'descricao', 'Ajustes financeiros adicionais de diaristas',
          'count_sql', 'SELECT COUNT(*) FROM public.lancamentos_adicionais_diaristas WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.lancamentos_adicionais_diaristas WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'financeiro_competencias',
          'delete_priority', 340,
          'descricao', 'Competencias financeiras transitórias',
          'count_sql', 'SELECT COUNT(*) FROM public.financeiro_competencias WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.financeiro_competencias WHERE tenant_id = $1'
        ),
        jsonb_build_object(
          'table_name', 'cnab_sequencial_controle',
          'delete_priority', 350,
          'descricao', 'Memoria de sequencial CNAB por tenant',
          'count_sql', 'SELECT COUNT(*) FROM public.cnab_sequencial_controle WHERE tenant_id = $1',
          'delete_sql', 'DELETE FROM public.cnab_sequencial_controle WHERE tenant_id = $1'
        )
      );
    WHEN 'COMPLETO' THEN
      v_plan := public.build_reset_plan('OPERACIONAL') || public.build_reset_plan('FINANCEIRO');
    ELSE
      RAISE EXCEPTION 'Modo de reset invalido: %', p_mode;
  END CASE;

  RETURN v_plan;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.run_tenant_reset(
  p_mode TEXT,
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_mode_key TEXT;
  v_mode_audit_label TEXT;
  v_expected_confirmation TEXT;
  v_workflow_stage TEXT;
  v_human_label TEXT;
  v_actor_user_id UUID := auth.uid();
  v_actor_tenant_id UUID;
  v_actor_role TEXT;
  v_actor_name TEXT;
  v_actor_email TEXT;
  v_plan JSONB;
  v_step JSONB;
  v_count BIGINT;
  v_deleted BIGINT;
  v_total BIGINT := 0;
  v_items JSONB := '[]'::jsonb;
  v_observacao TEXT;
  v_request_ip TEXT;
  v_audit_reset_id UUID;
  v_competencia_snapshot TEXT := TO_CHAR(CURRENT_DATE, 'YYYY-MM');
BEGIN
  SELECT
    mode_key,
    mode_audit_label,
    expected_confirmation,
    workflow_stage,
    human_label
  INTO
    v_mode_key,
    v_mode_audit_label,
    v_expected_confirmation,
    v_workflow_stage,
    v_human_label
  FROM public.get_reset_mode_metadata(p_mode);

  IF v_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario nao autenticado.';
  END IF;

  SELECT
    p.tenant_id,
    lower(COALESCE(p.role, '')),
    COALESCE(NULLIF(BTRIM(COALESCE(p.full_name, '')), ''), 'Administrador do Tenant'),
    COALESCE(NULLIF(BTRIM(COALESCE(p_request_context ->> 'user_email', '')), ''), p_request_context ->> 'email')
  INTO
    v_actor_tenant_id,
    v_actor_role,
    v_actor_name,
    v_actor_email
  FROM public.profiles p
  WHERE p.user_id = v_actor_user_id
    AND p.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_actor_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant invalido para o usuario autenticado.';
  END IF;

  IF v_actor_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Apenas admin ou super_admin podem executar este reset.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.tenants t
    WHERE t.id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'Tenant informado nao existe.';
  END IF;

  IF NOT p_preview_only THEN
    IF NULLIF(BTRIM(COALESCE(p_justificativa, '')), '') IS NULL THEN
      RAISE EXCEPTION 'Justificativa obrigatoria para executar o reset.';
    END IF;

    IF BTRIM(COALESCE(p_confirmacao, '')) <> v_expected_confirmation THEN
      RAISE EXCEPTION 'Confirmacao textual invalida. Esperado: %', v_expected_confirmation;
    END IF;
  END IF;

  v_plan := public.build_reset_plan(v_mode_key);

  FOR v_step IN
    SELECT value
    FROM jsonb_array_elements(v_plan)
    ORDER BY (value->>'delete_priority')::int ASC
  LOOP
    IF to_regclass(format('public.%I', v_step ->> 'table_name')) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE v_step ->> 'count_sql'
      INTO v_count
      USING p_tenant_id;

    v_total := v_total + COALESCE(v_count, 0);

    IF NOT p_preview_only AND COALESCE(v_count, 0) > 0 THEN
      EXECUTE v_step ->> 'delete_sql'
        USING p_tenant_id;

      GET DIAGNOSTICS v_deleted = ROW_COUNT;
    ELSE
      v_deleted := COALESCE(v_count, 0);
    END IF;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'tabela', v_step ->> 'table_name',
        'descricao', v_step ->> 'descricao',
        'registros', COALESCE(v_deleted, 0)
      )
    );
  END LOOP;

  IF p_preview_only THEN
    RETURN jsonb_build_object(
      'preview_only', TRUE,
      'mode', v_mode_key,
      'tipo_reset', v_mode_audit_label,
      'confirmation_phrase', v_expected_confirmation,
      'total_registros', v_total,
      'tabelas', v_items
    );
  END IF;

  v_request_ip := public.get_reset_request_ip();
  v_observacao := format(
    '%s executado por %s. %s registro(s) removido(s).',
    v_human_label,
    v_actor_name,
    v_total
  );

  INSERT INTO public.auditoria_reset_operacional (
    tenant_id,
    usuario_id,
    usuario_nome,
    tipo_reset,
    justificativa,
    tabelas_afetadas,
    total_registros_removidos,
    request_ip,
    request_context
  )
  VALUES (
    p_tenant_id,
    v_actor_user_id,
    v_actor_name,
    v_mode_audit_label,
    BTRIM(COALESCE(p_justificativa, '')),
    v_items,
    v_total::INTEGER,
    v_request_ip,
    COALESCE(p_request_context, '{}'::jsonb)
  )
  RETURNING id INTO v_audit_reset_id;

  -- Log global na tabela principal do reset (que possui tenant_id nativo) foi feito acima.

  IF to_regclass('public.auditoria_workflow_ciclos') IS NOT NULL THEN
    INSERT INTO public.auditoria_workflow_ciclos (
      tenant_id,
      ciclo_id,
      usuario_id,
      etapa,
      acao,
      observacao,
      user_name,
      user_email,
      competencia_snapshot,
      referencia_reset_id
    )
    VALUES (
      p_tenant_id,
      NULL,
      v_actor_user_id,
      v_workflow_stage,
      'RESET',
      v_observacao || ' Justificativa: ' || BTRIM(COALESCE(p_justificativa, '')),
      v_actor_name,
      v_actor_email,
      v_competencia_snapshot,
      v_audit_reset_id
    );
  END IF;

  RETURN jsonb_build_object(
    'preview_only', FALSE,
    'mode', v_mode_key,
    'tipo_reset', v_mode_audit_label,
    'confirmation_phrase', v_expected_confirmation,
    'total_registros', v_total,
    'tabelas', v_items,
    'audit_id', v_audit_reset_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_operacional_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'OPERACIONAL',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_financeiro_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'FINANCEIRO',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.reset_completo_tenant(
  p_tenant_id UUID,
  p_justificativa TEXT DEFAULT NULL,
  p_confirmacao TEXT DEFAULT NULL,
  p_preview_only BOOLEAN DEFAULT FALSE,
  p_request_context JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB AS $$
BEGIN
  RETURN public.run_tenant_reset(
    'COMPLETO',
    p_tenant_id,
    p_justificativa,
    p_confirmacao,
    p_preview_only,
    p_request_context
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.reset_operacional_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_financeiro_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_completo_tenant(UUID, TEXT, TEXT, BOOLEAN, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_executive_governance_kpis(p_tenant_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_operacional numeric := 0;
    v_total_faturavel numeric := 0;
    v_total_folha numeric := 0;
    v_total_ciclos bigint := 0;
    v_ciclos_pendentes bigint := 0;
    v_ciclos_rejeitados bigint := 0;
    v_remessas_prontas bigint := 0;
    v_inconsistencias_criticas bigint := 0;
    v_auditoria_critica bigint := 0;
    v_inconsistencias_rh bigint := 0;
BEGIN
    IF p_tenant_id IS NOT NULL THEN
        SELECT 
            COALESCE(SUM(valor_operacional), 0),
            COALESCE(SUM(valor_faturavel), 0),
            COALESCE(SUM(valor_folha), 0),
            COUNT(*),
            COUNT(*) FILTER (WHERE status IN ('aberto', 'processando', 'validacao')),
            COUNT(*) FILTER (WHERE status_rh = 'rejeitado_rh' OR status_financeiro = 'rejeitado_financeiro')
        INTO 
            v_total_operacional,
            v_total_faturavel,
            v_total_folha,
            v_total_ciclos,
            v_ciclos_pendentes,
            v_ciclos_rejeitados
        FROM public.ciclos_operacionais
        WHERE tenant_id = p_tenant_id;

        SELECT COUNT(*)
        INTO v_remessas_prontas
        FROM public.lotes_remessa
        WHERE tenant_id = p_tenant_id
          AND status ILIKE '%pront%';

        SELECT COUNT(*)
        INTO v_auditoria_critica
        FROM public.auditoria
        WHERE tenant_id = p_tenant_id
          AND impacto = 'critico';

        IF to_regclass('public.processamento_rh_inconsistencias') IS NOT NULL THEN
          EXECUTE 'SELECT COUNT(*) FROM public.processamento_rh_inconsistencias WHERE tenant_id = $1'
            INTO v_inconsistencias_rh
            USING p_tenant_id;
        END IF;

        v_inconsistencias_criticas := v_auditoria_critica + v_inconsistencias_rh;
    ELSE
        SELECT 
            COALESCE(SUM(valor_operacional), 0),
            COALESCE(SUM(valor_faturavel), 0),
            COALESCE(SUM(valor_folha), 0),
            COUNT(*),
            COUNT(*) FILTER (WHERE status IN ('aberto', 'processando', 'validacao')),
            COUNT(*) FILTER (WHERE status_rh = 'rejeitado_rh' OR status_financeiro = 'rejeitado_financeiro')
        INTO 
            v_total_operacional,
            v_total_faturavel,
            v_total_folha,
            v_total_ciclos,
            v_ciclos_pendentes,
            v_ciclos_rejeitados
        FROM public.ciclos_operacionais;

        SELECT COUNT(*)
        INTO v_remessas_prontas
        FROM public.lotes_remessa
        WHERE status ILIKE '%pront%';

        SELECT COUNT(*)
        INTO v_auditoria_critica
        FROM public.auditoria
        WHERE impacto = 'critico';

        IF to_regclass('public.processamento_rh_inconsistencias') IS NOT NULL THEN
          EXECUTE 'SELECT COUNT(*) FROM public.processamento_rh_inconsistencias'
            INTO v_inconsistencias_rh;
        END IF;

        v_inconsistencias_criticas := v_auditoria_critica + v_inconsistencias_rh;
    END IF;

    RETURN json_build_object(
        'totalOperacional', v_total_operacional,
        'totalFaturavel', v_total_faturavel,
        'totalFolha', v_total_folha,
        'totalDiaristas', 0,
        'totalCiclos', v_total_ciclos,
        'ciclosPendentes', v_ciclos_pendentes,
        'ciclosRejeitados', v_ciclos_rejeitados,
        'remessasProntas', v_remessas_prontas,
        'inconsistenciasCriticas', v_inconsistencias_criticas
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_governance_timeline(
    p_tenant_id uuid DEFAULT NULL,
    p_modulo text DEFAULT 'TODOS',
    p_impacto text DEFAULT 'TODOS',
    p_competencia text DEFAULT 'TODAS',
    p_usuario text DEFAULT 'TODOS',
    p_limit int DEFAULT 50,
    p_offset int DEFAULT 0
)
RETURNS TABLE (
    id text,
    acao text,
    modulo text,
    usuario text,
    impacto text,
    data_hora timestamp with time zone,
    competencia text,
    observacao text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH combined_logs AS (
        SELECT 
            'wf-' || wf.id::text AS log_id,
            (wf.acao || ' - ' || wf.etapa) AS log_acao,
            CASE
              WHEN wf.acao = 'RESET' THEN 'SISTEMA'
              ELSE 'WORKFLOW'
            END AS log_modulo,
            COALESCE(wf.user_name, wf.usuario_id::text, 'Sistema') AS log_usuario,
            CASE 
                WHEN wf.acao IN ('REJEITAR', 'REABRIR', 'RESET') THEN 'critico'
                WHEN wf.acao = 'APROVAR' THEN 'baixo'
                ELSE 'medio'
            END AS log_impacto,
            wf.criado_em AS log_data_hora,
            COALESCE(c.competencia, wf.competencia_snapshot, 'N/A') AS log_competencia,
            wf.observacao AS log_observacao,
            wf.tenant_id
        FROM public.auditoria_workflow_ciclos wf
        LEFT JOIN public.ciclos_operacionais c ON wf.ciclo_id = c.id
        
        UNION ALL
        
        SELECT 
            'aud-' || a.id::text AS log_id,
            a.acao AS log_acao,
            a.modulo AS log_modulo,
            COALESCE(a.user_id::text, 'Sistema') AS log_usuario,
            a.impacto AS log_impacto,
            a.created_at AS log_data_hora,
            'N/A' AS log_competencia,
            NULLIF(a.detalhes::text, '{}') AS log_observacao,
            a.tenant_id
        FROM public.auditoria a
    )
    SELECT 
        l.log_id,
        l.log_acao,
        l.log_modulo,
        l.log_usuario,
        l.log_impacto,
        l.log_data_hora,
        l.log_competencia,
        l.log_observacao
    FROM combined_logs l
    WHERE (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
      AND (p_modulo = 'TODOS' OR l.log_modulo = p_modulo)
      AND (p_impacto = 'TODOS' OR l.log_impacto = p_impacto)
      AND (p_competencia = 'TODAS' OR l.log_competencia = p_competencia)
      AND (p_usuario = 'TODOS' OR l.log_usuario ILIKE '%' || p_usuario || '%')
    ORDER BY l.log_data_hora DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

COMMIT;
