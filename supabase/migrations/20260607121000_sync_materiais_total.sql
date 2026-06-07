-- Trigger para atualizar o total de materiais na operação pai
CREATE OR REPLACE FUNCTION public.fn_sync_materiais_total_operacao()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalcula a soma de materiais para a operação pai
    UPDATE public.operacoes_producao
    SET valor_total_materiais = (
        SELECT COALESCE(SUM(valor_total), 0)
        FROM public.operacao_producao_materiais
        WHERE operacao_id = COALESCE(NEW.operacao_id, OLD.operacao_id)
    )
    WHERE id = COALESCE(NEW.operacao_id, OLD.operacao_id);

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger na tabela de vínculo
DROP TRIGGER IF EXISTS trg_sync_materiais_total ON public.operacao_producao_materiais;
CREATE TRIGGER trg_sync_materiais_total
AFTER INSERT OR UPDATE OR DELETE ON public.operacao_producao_materiais
FOR EACH ROW EXECUTE PROCEDURE public.fn_sync_materiais_total_operacao();

-- Recarregar schema para garantir que o PostgREST veja as mudanças
NOTIFY pgrst, 'reload schema';
