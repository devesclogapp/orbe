-- ==============================================================================
-- MIGRATION: ADD IP AND USER AGENT TO AUDIT LOGS
-- ==============================================================================

-- 1. Add IP and User-Agent columns to the logs table
ALTER TABLE public.diaristas_logs_fechamento 
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- (Optional) If you want the RPCs to capture this automatically when tracking changes,
-- you can update your functions (like `marcar_como_pago_diaristas`) to use
-- `current_setting('request.headers', true)` to extract IP and user-agent.
--
-- Example of extracting inside an RPC:
-- DECLARE
--   v_ip TEXT;
--   v_ua TEXT;
-- BEGIN
--   v_ip := current_setting('request.headers', true)::json->>'x-forwarded-for';
--   v_ua := current_setting('request.headers', true)::json->>'user-agent';
--   
--   INSERT INTO public.diaristas_logs_fechamento (..., ip_address, user_agent)
--   VALUES (..., v_ip, v_ua);
-- END;
