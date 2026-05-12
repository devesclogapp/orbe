-- get triggers
CREATE OR REPLACE FUNCTION get_triggers()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_triggers json;
BEGIN
  SELECT json_agg(trigger_name) INTO v_triggers
  FROM information_schema.triggers
  WHERE event_object_table = 'lancamentos_diaristas';
  RETURN v_triggers;
END;
$$;