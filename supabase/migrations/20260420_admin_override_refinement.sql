-- 1. Tornar logs de auditoria imutáveis
DO $$ 
BEGIN
    -- Impedir UPDATE e DELETE em audit.logs
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'protect_audit_logs') THEN
        CREATE OR REPLACE FUNCTION audit.prevent_alteration() RETURNS TRIGGER AS $body$
        BEGIN
            RAISE EXCEPTION 'Registros de auditoria são imutáveis e não podem ser alterados ou removidos.';
        END;
        $body$ LANGUAGE plpgsql;

        CREATE TRIGGER protect_audit_logs
        BEFORE UPDATE OR DELETE ON audit.logs
        FOR EACH ROW EXECUTE FUNCTION audit.prevent_alteration();
        
        CREATE TRIGGER protect_audit_overrides
        BEFORE UPDATE OR DELETE ON audit.overrides
        FOR EACH ROW EXECUTE FUNCTION audit.prevent_alteration();
    END IF;
END $$;

-- 2. Refinar validate_admin_override para ser a única fonte de verdade para imutabilidade
CREATE OR REPLACE FUNCTION public.validate_admin_override()
RETURNS TRIGGER AS $$
DECLARE
  v_justificativa text;
  v_user_role text;
BEGIN
    v_user_role := public.get_user_role();

    -- Se o registro antigo já estava em estado de imutabilidade
    IF (OLD.status IN ('pago', 'processado', 'fechado', 'consolidado')) THEN
        
        -- Se não for Admin, bloqueia sumariamente (mantendo lógica da check_immutability)
        IF v_user_role IS NULL OR v_user_role != 'Admin' THEN
             RAISE EXCEPTION 'Registro bloqueado por status de imutabilidade (%). Alteração não permitida para seu perfil.', OLD.status;
        END IF;

        -- Se for Admin, exige justificativa
        BEGIN
            v_justificativa := current_setting('app.override_justification', true);
        EXCEPTION WHEN OTHERS THEN
            v_justificativa := NULL;
        END;

        IF (v_justificativa IS NULL OR v_justificativa = '' OR v_justificativa = 'null') THEN
            RAISE EXCEPTION 'Justificativa obrigatória para alterar registro travado (status: %). Utilize o mecanismo de override.', OLD.status;
        END IF;

        -- Registra o override
        INSERT INTO audit.overrides (
            table_name, record_id, empresa_id, justificativa, dados_anteriores, dados_novos, user_id
        )
        VALUES (
            TG_TABLE_NAME, OLD.id, OLD.empresa_id, v_justificativa, row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid()
        );
        
        -- Limpa a variável de sessão para evitar reuso acidental na mesma transação (opcional, mas seguro)
        -- PERFORM set_config('app.override_justification', '', false);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Remover gatilhos duplicados e garantir que tabelas críticas usem validate_admin_override
DO $$
BEGIN
    -- Tabelas que devem usar validate_admin_override
    -- faturas, operacoes, registros_ponto, financeiro_consolidados_cliente

    -- Remover check_immutability onde validate_admin_override será usado
    DROP TRIGGER IF EXISTS check_faturas_immutability ON faturas;
    DROP TRIGGER IF EXISTS check_operacoes_immutability ON operacoes;
    DROP TRIGGER IF EXISTS check_ponto_immutability ON registros_ponto;
    DROP TRIGGER IF EXISTS check_financeiro_consolidados_immutability ON financeiro_consolidados_cliente;

    -- Garantir validate_admin_override (fatal_admin_override_check)
    
    -- Faturas
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'fatal_admin_override_check' AND event_object_table = 'faturas') THEN
        CREATE TRIGGER fatal_admin_override_check BEFORE UPDATE ON faturas FOR EACH ROW EXECUTE FUNCTION validate_admin_override();
    END IF;

    -- Operações
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'fatal_admin_override_check' AND event_object_table = 'operacoes') THEN
        CREATE TRIGGER fatal_admin_override_check BEFORE UPDATE ON operacoes FOR EACH ROW EXECUTE FUNCTION validate_admin_override();
    END IF;

    -- Registros Ponto
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'fatal_admin_override_check' AND event_object_table = 'registros_ponto') THEN
        CREATE TRIGGER fatal_admin_override_check BEFORE UPDATE ON registros_ponto FOR EACH ROW EXECUTE FUNCTION validate_admin_override();
    END IF;

    -- Consolidados
    IF NOT EXISTS (SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'fatal_admin_override_check' AND event_object_table = 'financeiro_consolidados_cliente') THEN
        CREATE TRIGGER fatal_admin_override_check BEFORE UPDATE ON financeiro_consolidados_cliente FOR EACH ROW EXECUTE FUNCTION validate_admin_override();
    END IF;

END $$;
