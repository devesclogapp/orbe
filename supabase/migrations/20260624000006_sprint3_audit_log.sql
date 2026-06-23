-- ==============================================================================
-- MIGRATION: 20260624000006_sprint3_audit_log.sql
-- SPRINT 3: Observabilidade, Auditoria e Governança Corporativa
-- ==============================================================================

-- 1. CRIAÇÃO DA TABELA CENTRAL (ETAPA 1)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    empresa_id UUID,
    usuario_id UUID,
    usuario_nome TEXT,
    perfil_usuario TEXT,
    acao TEXT NOT NULL,
    entidade TEXT NOT NULL,
    registro_id UUID NOT NULL,
    descricao TEXT,
    valor_anterior JSONB,
    valor_novo JSONB,
    origem TEXT,
    ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. IMUTABILIDADE E RLS (ETAPA 2)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- INSERT permitido para o sistema via security definer (triggers), 
-- ou para usuário do próprio tenant_id
CREATE POLICY "Strict Insert Only on audit_log" 
ON public.audit_log 
FOR INSERT 
WITH CHECK (true); -- Permitimos INSERT pq a trigger que faz o insert.

-- SELECT permitido apenas para visualização no mesmo tenant (adicional de segurança corporativa)
CREATE POLICY "Strict Select on audit_log" 
ON public.audit_log 
FOR SELECT 
USING (tenant_id = public.current_tenant_id());

-- NOTA: Sem políticas de UPDATE ou DELETE criadas, logo eles são implicitamente PROIBIDOS.


-- 3. ÍNDICES DE AUDITORIA (ETAPA 3)
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_empresa ON public.audit_log(empresa_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entidade ON public.audit_log(entidade);
CREATE INDEX IF NOT EXISTS idx_audit_log_registro ON public.audit_log(registro_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_usuario ON public.audit_log(usuario_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at);

-- 4. FUNÇÃO GENÉRICA DE CAPTURA (ETAPA 4)
CREATE OR REPLACE FUNCTION public.fn_capture_audit_log()
RETURNS trigger AS $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID;
    v_empresa_id UUID;
    v_usuario_nome TEXT;
    v_perfil_usuario TEXT;
    v_ip TEXT;
    v_user_agent TEXT;
    v_origem TEXT;
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Se estiver na tabela audit_log, previne loop e sai (Segurança extra pela REGRA 1)
    IF TG_TABLE_NAME = 'audit_log' THEN
        RETURN CASE TG_OP WHEN 'DELETE' THEN OLD ELSE NEW END;
    END IF;

    -- Capturar usuário (auth.uid ou system bypass)
    v_user_id := auth.uid();
    
    IF v_user_id IS NOT NULL THEN
        -- Tenta buscar detalhes do perfil (usuario_nome, perfil_usuario) se a tabela perfis_usuarios existir
        BEGIN
            SELECT nome, role INTO v_usuario_nome, v_perfil_usuario
            FROM public.perfis_usuarios
            WHERE user_id = v_user_id LIMIT 1;
            
            -- Fallback se a query anterior não trouxer dados, tenta pelo jwt claims
            IF v_usuario_nome IS NULL THEN
                v_usuario_nome := current_setting('request.jwt.claims', true)::json->>'email';
            END IF;
            
            v_origem := 'SYSTEM_USER';
        EXCEPTION WHEN OTHERS THEN
            v_usuario_nome := current_setting('request.jwt.claims', true)::json->>'email';
            v_perfil_usuario := 'AUTHENTICATED';
            v_origem := 'SYSTEM_USER';
        END;
    ELSE
        -- Fallback estrutural: Automações, Edge Functions, RPCs internas
        v_origem := 'SYSTEM';
        v_usuario_nome := 'SISTEMA AUTOMATIZADO';
        v_perfil_usuario := 'SYSTEM';
    END IF;
    
    -- Capturar IP e User Agent de forma opcional (soft extract - REGRA 2)
    BEGIN
        v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
        v_user_agent := current_setting('request.headers', true)::json->>'user-agent';
    EXCEPTION WHEN OTHERS THEN
        v_ip := NULL;
        v_user_agent := NULL;
    END;

    -- Captura dos dados com Saneamento (REGRA 4)
    IF TG_OP = 'INSERT' THEN
        v_new_data := row_to_json(NEW)::jsonb;
        v_new_data := v_new_data - 'password' - 'token' - 'secret' - 'senha' - 'hash';
        
        -- Extração de IDs (Tenant e Empresa) adaptando-se às colunas existentes
        BEGIN v_tenant_id := (v_new_data->>'tenant_id')::uuid; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        BEGIN v_empresa_id := (v_new_data->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
        
        IF v_tenant_id IS NULL THEN
            v_tenant_id := '00000000-0000-0000-0000-000000000000'::uuid; -- Fallback seguro caso a entidade não tenha tenant_id mas deva ser logada
        END IF;

        INSERT INTO public.audit_log (
            tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
            acao, entidade, registro_id, descricao, valor_novo, origem, ip, user_agent
        )
        VALUES (
            v_tenant_id, v_empresa_id, v_user_id, v_usuario_nome, v_perfil_usuario, 
            TG_OP, TG_TABLE_NAME, (NEW.id)::uuid, 'Criou registro em ' || TG_TABLE_NAME, 
            v_new_data, v_origem, v_ip, v_user_agent
        );
        
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        v_old_data := row_to_json(OLD)::jsonb;
        v_new_data := row_to_json(NEW)::jsonb;
        
        v_old_data := v_old_data - 'password' - 'token' - 'secret' - 'senha' - 'hash';
        v_new_data := v_new_data - 'password' - 'token' - 'secret' - 'senha' - 'hash';
        
        BEGIN v_tenant_id := (v_new_data->>'tenant_id')::uuid; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        BEGIN v_empresa_id := (v_new_data->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;

        IF v_tenant_id IS NULL THEN
             v_tenant_id := '00000000-0000-0000-0000-000000000000'::uuid;
        END IF;

        INSERT INTO public.audit_log (
            tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
            acao, entidade, registro_id, descricao, valor_anterior, valor_novo, origem, ip, user_agent
        )
        VALUES (
            v_tenant_id, v_empresa_id, v_user_id, v_usuario_nome, v_perfil_usuario, 
            TG_OP, TG_TABLE_NAME, (NEW.id)::uuid, 'Alterou registro em ' || TG_TABLE_NAME, 
            v_old_data, v_new_data, v_origem, v_ip, v_user_agent
        );
        
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        v_old_data := row_to_json(OLD)::jsonb;
        v_old_data := v_old_data - 'password' - 'token' - 'secret' - 'senha' - 'hash';

        BEGIN v_tenant_id := (v_old_data->>'tenant_id')::uuid; EXCEPTION WHEN OTHERS THEN v_tenant_id := NULL; END;
        BEGIN v_empresa_id := (v_old_data->>'empresa_id')::uuid; EXCEPTION WHEN OTHERS THEN v_empresa_id := NULL; END;
        
        IF v_tenant_id IS NULL THEN
            v_tenant_id := '00000000-0000-0000-0000-000000000000'::uuid;
        END IF;

        INSERT INTO public.audit_log (
            tenant_id, empresa_id, usuario_id, usuario_nome, perfil_usuario,
            acao, entidade, registro_id, descricao, valor_anterior, origem, ip, user_agent
        )
        VALUES (
            v_tenant_id, v_empresa_id, v_user_id, v_usuario_nome, v_perfil_usuario, 
            TG_OP, TG_TABLE_NAME, (OLD.id)::uuid, 'Excluiu registro de ' || TG_TABLE_NAME, 
            v_old_data, v_origem, v_ip, v_user_agent
        );
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. ATTACH TRIGGERS AS TABELAS INICIAIS CRÍTICAS (ETAPA 5)

-- Helper para dropar e recriar trigger de forma limpa (idempotente)
DO $$
DECLARE
    target_tables text[] := ARRAY[
        'operacoes_producao',
        'servicos_extras_operacionais',
        'custos_extras_operacionais',
        'lancamentos_diaristas',
        'lancamentos_intermitentes',
        'financeiro_consolidados_cliente',
        'financeiro_consolidados_colaborador',
        'financeiro_lotes_pagamento',
        'cnab_remessas_arquivos',
        'retornos_bancarios'
    ];
    t_name text;
BEGIN
    FOR t_name IN SELECT unnest(target_tables)
    LOOP
        -- Checar se a tabela existe de fato na DB
        IF EXISTS (
            SELECT 1 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = t_name
        ) THEN
            EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I;', t_name, t_name);
            EXECUTE format('
                CREATE TRIGGER trg_audit_%I
                AFTER INSERT OR UPDATE OR DELETE ON public.%I
                FOR EACH ROW EXECUTE FUNCTION public.fn_capture_audit_log();
            ', t_name, t_name);
        END IF;
    END LOOP;
END $$;
