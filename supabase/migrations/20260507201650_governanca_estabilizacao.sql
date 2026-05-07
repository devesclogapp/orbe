-- Migration: Estabilização da Governança Executiva (Fase 7.1)
-- Adiciona colunas para persistência de nomes de usuário, cria índices vitais e funções RPC para performance.

-- 1. Persistir nome humano da auditoria
ALTER TABLE auditoria_workflow_ciclos 
ADD COLUMN IF NOT EXISTS user_name text,
ADD COLUMN IF NOT EXISTS user_email text;

-- 2. Índices de Otimização
CREATE INDEX IF NOT EXISTS idx_auditoria_workflow_ciclos_tenant_created 
ON auditoria_workflow_ciclos (tenant_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_ciclos_operacionais_tenant_competencia 
ON ciclos_operacionais (tenant_id, competencia);

CREATE INDEX IF NOT EXISTS idx_ciclos_operacionais_tenant_status 
ON ciclos_operacionais (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_lotes_remessa_tenant_status 
ON lotes_remessa (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auditoria_tenant_impacto 
ON auditoria (tenant_id, impacto, created_at DESC);

-- 3. Função RPC para KPIs Executivos
CREATE OR REPLACE FUNCTION get_executive_governance_kpis(p_tenant_id uuid DEFAULT NULL)
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
        -- Ciclos
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
        FROM ciclos_operacionais
        WHERE tenant_id = p_tenant_id;

        -- Remessas
        SELECT COUNT(*)
        INTO v_remessas_prontas
        FROM lotes_remessa
        WHERE tenant_id = p_tenant_id AND status ILIKE '%pront%';

        -- Inconsistencias (Auditoria + RH)
        SELECT COUNT(*) INTO v_auditoria_critica
        FROM auditoria
        WHERE tenant_id = p_tenant_id AND impacto = 'critico';

        SELECT COUNT(*) INTO v_inconsistencias_rh
        FROM rh_processamento_inconsistencias
        WHERE tenant_id = p_tenant_id;

        v_inconsistencias_criticas := v_auditoria_critica + v_inconsistencias_rh;
    ELSE
        -- Global scope (Same logic, but no tenant filter)
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
        FROM ciclos_operacionais;

        SELECT COUNT(*)
        INTO v_remessas_prontas
        FROM lotes_remessa
        WHERE status ILIKE '%pront%';

        SELECT COUNT(*) INTO v_auditoria_critica
        FROM auditoria
        WHERE impacto = 'critico';

        SELECT COUNT(*) INTO v_inconsistencias_rh
        FROM rh_processamento_inconsistencias;

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

-- 4. Função RPC para Timeline Corporativa com Paginação e Filtros
CREATE OR REPLACE FUNCTION get_governance_timeline(
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
        -- Logs do Workflow
        SELECT 
            'wf-' || wf.id::text AS log_id,
            (wf.acao || ' - ' || wf.etapa) AS log_acao,
            'WORKFLOW' AS log_modulo,
            COALESCE(wf.user_name, wf.usuario_id::text, 'Sistema') AS log_usuario,
            CASE 
                WHEN wf.acao IN ('REJEITAR', 'REABRIR') THEN 'critico'
                WHEN wf.acao = 'APROVAR' THEN 'baixo'
                ELSE 'medio'
            END AS log_impacto,
            wf.criado_em AS log_data_hora,
            COALESCE(c.competencia, 'N/A') AS log_competencia,
            wf.observacao AS log_observacao,
            wf.tenant_id
        FROM auditoria_workflow_ciclos wf
        LEFT JOIN ciclos_operacionais c ON wf.ciclo_id = c.id
        
        UNION ALL
        
        -- Logs de Auditoria Geral
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
        FROM auditoria a
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
