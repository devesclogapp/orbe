CREATE OR REPLACE FUNCTION ensure_competencia_financeira(p_empresa_id uuid, p_competencia date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tenta inserir ignorando duplicidade
  INSERT INTO financeiro_competencias (empresa_id, competencia)
  VALUES (p_empresa_id, p_competencia)
  ON CONFLICT DO NOTHING;
EXCEPTION WHEN unique_violation THEN
  -- Ignora caso ON CONFLICT não cubra a constraint específica (por nome desconhecido na constraint primária)
  NULL;
END;
$$;
