-- FASE 10.4 - AUTO-CURA E LIMPEZA INTELIGENTE DE ALERTAS
-- Objetivo: resolver alertas corrigidos, reduzir severidade, limpar fila e
-- integrar os eventos com governanca sem executar acoes financeiras criticas.

-- 1. Persistencia de tenant, auto-cura e anti-loop na fila
ALTER TABLE public.automacao_execucoes
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS cancelado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recuperado_em TIMESTAMPTZ;

UPDATE public.automacao_execucoes ae
SET tenant_id = e.tenant_id
FROM public.empresas e
WHERE ae.empresa_id = e.id
  AND ae.tenant_id IS NULL
  AND e.tenant_id IS NOT NULL;

-- 2. Persistencia de resolucao automatica, severidade reversa e anti-flapping
ALTER TABLE public.automacao_alertas
  ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS data_resolucao TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolvido_automaticamente BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS severidade_original VARCHAR(50),
  ADD COLUMN IF NOT EXISTS severidade_anterior VARCHAR(50),
  ADD COLUMN IF NOT EXISTS reducoes_severidade INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS auto_cura_tentativas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_auto_cura_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cooldown_ate TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS flapping_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_reabertura_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolucao_contexto_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.automacao_alertas aa
SET
  tenant_id = e.tenant_id,
  severidade_original = COALESCE(aa.severidade_original, aa.severidade),
  data_resolucao = COALESCE(aa.data_resolucao, aa.resolvido_em)
FROM public.empresas e
WHERE aa.empresa_id = e.id
  AND (aa.tenant_id IS NULL OR aa.severidade_original IS NULL OR aa.data_resolucao IS NULL)
  AND e.tenant_id IS NOT NULL;

-- 3. Ciclos: memoria de liberacao automatica sem fechar financeiro.
ALTER TABLE public.ciclos_operacionais
  ADD COLUMN IF NOT EXISTS status_automacao_atualizado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_cura_liberado_em TIMESTAMPTZ;

-- 4. Workflow: permitir eventos sistemicos de automacao na timeline.
DO $$
BEGIN
  IF to_regclass('public.auditoria_workflow_ciclos') IS NOT NULL THEN
    ALTER TABLE public.auditoria_workflow_ciclos
      ALTER COLUMN usuario_id DROP NOT NULL;

    ALTER TABLE public.auditoria_workflow_ciclos
      DROP CONSTRAINT IF EXISTS auditoria_workflow_ciclos_etapa_check;

    ALTER TABLE public.auditoria_workflow_ciclos
      ADD CONSTRAINT auditoria_workflow_ciclos_etapa_check
      CHECK (etapa IN ('OPERACIONAL', 'RH', 'FINANCEIRO', 'REMESSA', 'AUTOMACAO'));

    ALTER TABLE public.auditoria_workflow_ciclos
      DROP CONSTRAINT IF EXISTS auditoria_workflow_ciclos_acao_check;

    ALTER TABLE public.auditoria_workflow_ciclos
      ADD CONSTRAINT auditoria_workflow_ciclos_acao_check
      CHECK (acao IN ('APROVAR', 'REJEITAR', 'REABRIR', 'GERAR', 'AUTO_CURAR', 'LIBERAR', 'RECUPERAR'));
  ELSE
    RAISE NOTICE 'Tabela public.auditoria_workflow_ciclos ausente; ajustes de workflow da Fase 10.4 foram ignorados neste ambiente.';
  END IF;
END $$;

-- 5. Trigger de tenant para automacao.
CREATE OR REPLACE FUNCTION public.set_automacao_tenant_from_empresa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tenant_id IS NULL AND NEW.empresa_id IS NOT NULL THEN
    SELECT tenant_id INTO NEW.tenant_id
    FROM public.empresas
    WHERE id = NEW.empresa_id
    LIMIT 1;
  END IF;

  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_automacao_execucoes_tenant ON public.automacao_execucoes;
CREATE TRIGGER trg_automacao_execucoes_tenant
  BEFORE INSERT OR UPDATE ON public.automacao_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.set_automacao_tenant_from_empresa();

DROP TRIGGER IF EXISTS trg_automacao_alertas_tenant ON public.automacao_alertas;
CREATE TRIGGER trg_automacao_alertas_tenant
  BEFORE INSERT OR UPDATE ON public.automacao_alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_automacao_tenant_from_empresa();

-- 6. RLS por tenant, mantendo fallback por empresa para dados antigos.
DROP POLICY IF EXISTS "Acesso Tenant Isolado Automacao Execucoes OAI" ON public.automacao_execucoes;
DROP POLICY IF EXISTS "Acesso Tenant Isolado Automacao Alertas OAI" ON public.automacao_alertas;
DROP POLICY IF EXISTS "automacao_execucoes_tenant_all" ON public.automacao_execucoes;
DROP POLICY IF EXISTS "automacao_alertas_tenant_all" ON public.automacao_alertas;

CREATE POLICY "automacao_execucoes_tenant_all" ON public.automacao_execucoes
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = public.current_tenant_id())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    OR empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = public.current_tenant_id())
  );

CREATE POLICY "automacao_alertas_tenant_all" ON public.automacao_alertas
  FOR ALL TO authenticated
  USING (
    tenant_id = public.current_tenant_id()
    OR empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = public.current_tenant_id())
  )
  WITH CHECK (
    tenant_id = public.current_tenant_id()
    OR empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = public.current_tenant_id())
  );

-- 7. Indices de performance para batches e dashboards.
CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_tenant_status
  ON public.automacao_execucoes (tenant_id, status, prioridade DESC, created_at);

CREATE INDEX IF NOT EXISTS idx_automacao_execucoes_heartbeat
  ON public.automacao_execucoes (tenant_id, status, heartbeat_at)
  WHERE status = 'executando';

CREATE INDEX IF NOT EXISTS idx_automacao_alertas_tenant_ativos
  ON public.automacao_alertas (tenant_id, resolvido, severidade, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_automacao_alertas_auto_cura
  ON public.automacao_alertas (tenant_id, resolvido_automaticamente, data_resolucao DESC);

CREATE INDEX IF NOT EXISTS idx_automacao_alertas_contexto
  ON public.automacao_alertas USING GIN (contexto_json);

CREATE INDEX IF NOT EXISTS idx_ciclos_status_automacao_tenant
  ON public.ciclos_operacionais (tenant_id, status_automacao, status_automacao_atualizado_em DESC);

-- 8. RPC para o dashboard de Saude Operacional.
CREATE OR REPLACE FUNCTION public.get_automacao_saude_operacional(p_tenant_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id UUID := COALESCE(p_tenant_id, public.current_tenant_id());
  v_alertas_ativos BIGINT := 0;
  v_auto_curados BIGINT := 0;
  v_bloqueios_removidos BIGINT := 0;
  v_severidade_media NUMERIC := 0;
  v_tempo_medio NUMERIC := 0;
BEGIN
  SELECT COUNT(*)
  INTO v_alertas_ativos
  FROM public.automacao_alertas aa
  WHERE COALESCE(aa.resolvido, false) = false
    AND (
      v_tenant_id IS NULL
      OR aa.tenant_id = v_tenant_id
      OR aa.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = v_tenant_id)
    );

  SELECT COUNT(*)
  INTO v_auto_curados
  FROM public.automacao_alertas aa
  WHERE aa.resolvido_automaticamente = true
    AND (
      v_tenant_id IS NULL
      OR aa.tenant_id = v_tenant_id
      OR aa.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = v_tenant_id)
    );

  SELECT COUNT(*)
  INTO v_bloqueios_removidos
  FROM public.automacao_alertas aa
  WHERE aa.resolvido_automaticamente = true
    AND COALESCE(aa.severidade_original, aa.severidade_anterior, aa.severidade) IN ('critical', 'high')
    AND (
      v_tenant_id IS NULL
      OR aa.tenant_id = v_tenant_id
      OR aa.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = v_tenant_id)
    );

  SELECT COALESCE(AVG(
    CASE aa.severidade
      WHEN 'critical' THEN 4
      WHEN 'high' THEN 3
      WHEN 'medium' THEN 2
      WHEN 'low' THEN 1
      ELSE 0
    END
  ), 0)
  INTO v_severidade_media
  FROM public.automacao_alertas aa
  WHERE COALESCE(aa.resolvido, false) = false
    AND (
      v_tenant_id IS NULL
      OR aa.tenant_id = v_tenant_id
      OR aa.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = v_tenant_id)
    );

  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(aa.data_resolucao, aa.resolvido_em) - aa.criado_em)) / 60), 0)
  INTO v_tempo_medio
  FROM public.automacao_alertas aa
  WHERE aa.resolvido_automaticamente = true
    AND aa.criado_em IS NOT NULL
    AND COALESCE(aa.data_resolucao, aa.resolvido_em) IS NOT NULL
    AND (
      v_tenant_id IS NULL
      OR aa.tenant_id = v_tenant_id
      OR aa.empresa_id IN (SELECT id FROM public.empresas WHERE tenant_id = v_tenant_id)
    );

  RETURN json_build_object(
    'alertasAtivos', v_alertas_ativos,
    'alertasAutoCurados', v_auto_curados,
    'bloqueiosRemovidos', v_bloqueios_removidos,
    'severidadeMedia', ROUND(v_severidade_media, 1),
    'tempoMedioResolucaoMinutos', ROUND(v_tempo_medio)
  );
END;
$$;

-- 9. Timeline corporativa passa a incluir eventos de automacao.
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
    IF to_regclass('public.auditoria_workflow_ciclos') IS NOT NULL THEN
        RETURN QUERY
        WITH combined_logs AS (
            SELECT
                'wf-' || wf.id::text AS log_id,
                (wf.acao || ' - ' || wf.etapa) AS log_acao,
                'WORKFLOW' AS log_modulo,
                COALESCE(wf.user_name, wf.usuario_id::text, 'Sistema') AS log_usuario,
                CASE
                    WHEN wf.acao IN ('REJEITAR', 'REABRIR') THEN 'critico'
                    WHEN wf.acao IN ('APROVAR', 'LIBERAR', 'AUTO_CURAR') THEN 'baixo'
                    ELSE 'medio'
                END AS log_impacto,
                wf.criado_em AS log_data_hora,
                COALESCE(c.competencia, 'N/A') AS log_competencia,
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

            UNION ALL

            SELECT
                'auto-' || aa.id::text AS log_id,
                CASE
                    WHEN aa.resolvido_automaticamente THEN 'Alerta resolvido automaticamente'
                    WHEN COALESCE(aa.reducoes_severidade, 0) > 0 THEN 'Severidade reduzida automaticamente'
                    ELSE 'Alerta de automacao'
                END AS log_acao,
                'AUTOMACAO' AS log_modulo,
                'Sistema' AS log_usuario,
                CASE
                    WHEN COALESCE(aa.severidade_original, aa.severidade) = 'critical' THEN 'critico'
                    WHEN COALESCE(aa.severidade_original, aa.severidade) IN ('high', 'medium') THEN 'medio'
                    ELSE 'baixo'
                END AS log_impacto,
                COALESCE(aa.data_resolucao, aa.ultima_auto_cura_em, aa.criado_em) AS log_data_hora,
                'N/A' AS log_competencia,
                aa.mensagem AS log_observacao,
                COALESCE(aa.tenant_id, e.tenant_id) AS tenant_id
            FROM public.automacao_alertas aa
            LEFT JOIN public.empresas e ON e.id = aa.empresa_id
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
    ELSE
        RETURN QUERY
        WITH combined_logs AS (
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

            UNION ALL

            SELECT
                'auto-' || aa.id::text AS log_id,
                CASE
                    WHEN aa.resolvido_automaticamente THEN 'Alerta resolvido automaticamente'
                    WHEN COALESCE(aa.reducoes_severidade, 0) > 0 THEN 'Severidade reduzida automaticamente'
                    ELSE 'Alerta de automacao'
                END AS log_acao,
                'AUTOMACAO' AS log_modulo,
                'Sistema' AS log_usuario,
                CASE
                    WHEN COALESCE(aa.severidade_original, aa.severidade) = 'critical' THEN 'critico'
                    WHEN COALESCE(aa.severidade_original, aa.severidade) IN ('high', 'medium') THEN 'medio'
                    ELSE 'baixo'
                END AS log_impacto,
                COALESCE(aa.data_resolucao, aa.ultima_auto_cura_em, aa.criado_em) AS log_data_hora,
                'N/A' AS log_competencia,
                aa.mensagem AS log_observacao,
                COALESCE(aa.tenant_id, e.tenant_id) AS tenant_id
            FROM public.automacao_alertas aa
            LEFT JOIN public.empresas e ON e.id = aa.empresa_id
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
    END IF;
END;
$$;
