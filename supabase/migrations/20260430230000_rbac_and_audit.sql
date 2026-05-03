-- 2026-05-03 23:00:00: RBAC & Audit Policies
-- Make sure to run after the user role definitions are created

-- Create roles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'admin_role') THEN
    CREATE ROLE admin_role LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'rh_role') THEN
    CREATE ROLE rh_role LOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'fin_role') THEN
    CREATE ROLE fin_role LOGIN;
  END IF;
END$$;
;

-- Enable Row Level Security for important tables
ALTER TABLE registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos ENABLE ROW LEVEL SECURITY;

-- Policies: only the creator or admin can read/write
CREATE POLICY reg_ponto_read ON registros_ponto FOR SELECT USING (
  auth.role() = 'admin_role' OR auth.uid() = colaborador_id
);
CREATE POLICY reg_ponto_write ON registros_ponto FOR INSERT WITH CHECK (
  auth.role() = 'admin_role' OR auth.uid() = colaborador_id
), UPDATE USING (
  auth.role() = 'admin_role' OR auth.uid() = colaborador_id
), DELETE USING (
  auth.role() = 'admin_role' OR auth.uid() = colaborador_id
);

CREATE POLICY ops_read ON operacoes FOR SELECT USING (
  auth.role() = 'admin_role' OR auth.role() = 'fin_role'
);
CREATE POLICY ops_write ON operacoes FOR INSERT WITH CHECK (
  auth.role() = 'admin_role' OR auth.role() = 'rh_role'
), UPDATE USING (
  auth.role() = 'admin_role' OR auth.role() = 'rh_role'
), DELETE USING (
  auth.role() = 'admin_role'
);

CREATE POLICY custos_read ON custos FOR SELECT USING (
  auth.role() = 'admin_role' OR auth.role() = 'fin_role'
);
CREATE POLICY custos_write ON custos FOR INSERT WITH CHECK (
  auth.role() = 'admin_role' OR auth.role() = 'rh_role'
), UPDATE USING (
  auth.role() = 'admin_role' OR auth.role() = 'rh_role'
), DELETE USING (
  auth.role() = 'admin_role'
);

-- Audit tables
CREATE TABLE operation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  target_id uuid,
  before jsonb,
  after jsonb,
  occurred_at timestamptz DEFAULT now()
);

CREATE TABLE ponto_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  operation text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  target_id uuid,
  before jsonb,
  after jsonb,
  occurred_at timestamptz DEFAULT now()
);

-- Trigger functions
CREATE OR REPLACE FUNCTION audit_func(target_table text) RETURNS trigger AS $$
DECLARE
  old_row jsonb;
  new_row jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    old_row := row_to_json(OLD)::jsonb;
    INSERT INTO operation_audit (table_name, operation, user_id, target_id, before, after) VALUES (
      target_table, TG_OP, auth.uid(), (OLD.id)::uuid, old_row, NULL
    );
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    old_row := row_to_json(OLD)::jsonb;
    new_row := row_to_json(NEW)::jsonb;
    INSERT INTO operation_audit (table_name, operation, user_id, target_id, before, after) VALUES (
      target_table, TG_OP, auth.uid(), (NEW.id)::uuid, old_row, new_row
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    new_row := row_to_json(NEW)::jsonb;
    INSERT INTO operation_audit (table_name, operation, user_id, target_id, before, after) VALUES (
      target_table, TG_OP, auth.uid(), (NEW.id)::uuid, NULL, new_row
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Attach triggers
CREATE TRIGGER trg_operacoes_audit
AFTER INSERT OR UPDATE OR DELETE ON operacoes FOR EACH ROW EXECUTE FUNCTION audit_func('operacoes');

CREATE TRIGGER trg_registros_ponto_audit
AFTER INSERT OR UPDATE OR DELETE ON registros_ponto FOR EACH ROW EXECUTE FUNCTION audit_func('registros_ponto');

-- Note: Similar triggers can be added for custos and other tables.
