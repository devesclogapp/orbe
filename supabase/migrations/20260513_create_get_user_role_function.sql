-- Criar função get_user_role para retornar role normalizada da tabela perfis_usuarios
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
BEGIN
  -- Pegar o user_id da sessão atual
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Buscar role na tabela perfis_usuarios
  SELECT LOWER(pu.role) INTO v_role
  FROM public.perfis_usuarios pu
  WHERE pu.user_id = v_user_id
  LIMIT 1;
  
  RETURN v_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;