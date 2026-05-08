-- FASE 10.3 - REVALIDACAO AUTOMATICA E ESCALONAMENTO

-- Função para invalidar ciclo operacional
CREATE OR REPLACE FUNCTION public.invalidate_ciclo_operacional()
RETURNS TRIGGER AS $BODY$
DECLARE
    v_data DATE;
    v_empresa_id UUID;
    v_ciclo_id UUID;
    v_status_antigo VARCHAR;
BEGIN
    -- Determinar a data e empresa baseando-se na tabela afetada
    IF TG_TABLE_NAME = 'registros_ponto' THEN
        IF TG_OP = 'DELETE' THEN
            v_data := OLD.data_registro;
            v_empresa_id := OLD.empresa_id;
        ELSE
            v_data := NEW.data_registro;
            v_empresa_id := NEW.empresa_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'operacoes_producao' THEN
        IF TG_OP = 'DELETE' THEN
            v_data := OLD.data_operacao;
            v_empresa_id := OLD.empresa_id;
        ELSE
            v_data := NEW.data_operacao;
            v_empresa_id := NEW.empresa_id;
        END IF;
    ELSE
        RETURN NEW;
    END IF;

    -- Encontrar o ciclo operacional correspondente
    SELECT id, status_automacao INTO v_ciclo_id, v_status_antigo
    FROM public.ciclos_operacionais
    WHERE empresa_id = v_empresa_id
      AND v_data >= data_inicio 
      AND v_data <= data_fim
    LIMIT 1;

    -- Se encontrou o ciclo e o status não é 'aguardando_validacao' ou 'bloqueado_automacao'
    IF v_ciclo_id IS NOT NULL AND v_status_antigo IN ('pronto_para_fechamento') THEN
        UPDATE public.ciclos_operacionais
        SET status_automacao = 'aguardando_validacao'
        WHERE id = v_ciclo_id;

        -- Registrar na auditoria
        INSERT INTO public.automacao_alertas (
            empresa_id, tipo, severidade, mensagem, contexto_json
        ) VALUES (
            v_empresa_id, 
            'ciclo_invalidado_automaticamente', 
            'warning', 
            'Ciclo reaberto automaticamente devido a alterações em ' || TG_TABLE_NAME || ' no dia ' || v_data,
            jsonb_build_object('ciclo_id', v_ciclo_id, 'tabela', TG_TABLE_NAME, 'data', v_data, 'acao', TG_OP)
        );
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar Triggers
DROP TRIGGER IF EXISTS trg_invalidate_ciclo_ponto ON public.registros_ponto;
CREATE TRIGGER trg_invalidate_ciclo_ponto
AFTER INSERT OR UPDATE OR DELETE ON public.registros_ponto
FOR EACH ROW EXECUTE FUNCTION public.invalidate_ciclo_operacional();

DROP TRIGGER IF EXISTS trg_invalidate_ciclo_producao ON public.operacoes_producao;
CREATE TRIGGER trg_invalidate_ciclo_producao
AFTER INSERT OR UPDATE OR DELETE ON public.operacoes_producao
FOR EACH ROW EXECUTE FUNCTION public.invalidate_ciclo_operacional();

