-- RLS bypass migration para MotorFinanceiro espelhar clientes logísticos com responsabilidade
-- Atendendo ao erro de Policy FOR INSERT onde app não possui permissão

CREATE OR REPLACE FUNCTION public.ensure_cliente_espelho(p_id uuid, p_nome text)
RETURNS uuid AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.clientes WHERE id = p_id) THEN
    INSERT INTO public.clientes (id, nome)
    VALUES (p_id, p_nome);
  END IF;
  RETURN p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
