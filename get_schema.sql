CREATE OR REPLACE FUNCTION get_lancamentos_diaristas_columns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cols json;
BEGIN
  SELECT json_agg(column_name) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'lancamentos_diaristas';
  RETURN v_cols;
END;
$$;