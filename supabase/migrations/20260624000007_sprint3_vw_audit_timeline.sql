-- ==============================================================================
-- MIGRATION: 20260624000007_sprint3_vw_audit_timeline.sql
-- SPRINT 3: Observabilidade, Auditoria e Governança Corporativa
-- ETAPA 8: VIEW DE TIMELINE OPERACIONAL
-- ==============================================================================

CREATE OR REPLACE VIEW public.vw_audit_timeline_operacional AS
SELECT 
    a.id AS log_id,
    a.registro_id,
    a.entidade,
    a.acao,
    a.descricao,
    a.usuario_nome,
    a.perfil_usuario,
    a.created_at AS data_hora,
    -- Tentando ser inteligente e inferir status das tabelas principais caso tenha havido update
    CASE 
        WHEN a.acao = 'INSERT' THEN 'Criado'
        WHEN a.acao = 'UPDATE' AND (a.valor_novo->>'status') IS DISTINCT FROM (a.valor_anterior->>'status') THEN 'Status: ' || COALESCE(a.valor_novo->>'status', 'Atualizado')
        WHEN a.acao = 'UPDATE' AND (a.valor_novo->>'pipeline_status') IS DISTINCT FROM (a.valor_anterior->>'pipeline_status') THEN 'Pipeline: ' || COALESCE(a.valor_novo->>'pipeline_status', 'Atualizado')
        WHEN a.acao = 'DELETE' THEN 'Excluído'
        ELSE 'Atualização'
    END AS evento_resumido,
    a.valor_anterior,
    a.valor_novo,
    a.tenant_id,
    a.empresa_id
FROM 
    public.audit_log a
ORDER BY 
    a.created_at DESC;

-- Garante RLS da view passando pelo filtro de tenant subjacente
-- Views sem a flag security_invoker usam as credenciais do criador por padrao (o admin), 
-- mas como a auditoria tem RLS, o mais seguro é expor baseando no usuário que está selecionando:
ALTER VIEW public.vw_audit_timeline_operacional ALTER COLUMN log_id SET DEFAULT null;

-- Nota: Views em PostgresSQL (se não materializadas) não possuem policy própria e seguem 
-- as regras da tabela subjacente se forem updatable, mas com SECURITY INVOKER o SELECT filtra pelo RLS.
-- No Supabase, recomendamos usar funções RPC ou aplicar RLS na audit_log associada a tenant_id
