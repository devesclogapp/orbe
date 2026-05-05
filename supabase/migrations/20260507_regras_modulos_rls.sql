-- RLS policies for regras_modulos table
-- Enable RLS if not already enabled
ALTER TABLE regras_modulos ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read
CREATE POLICY "Allow read access to authenticated users" ON regras_modulos
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert
CREATE POLICY "Allow insert access to authenticated users" ON regras_modulos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update
CREATE POLICY "Allow update access to authenticated users" ON regras_modulos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete
CREATE POLICY "Allow delete access to authenticated users" ON regras_modulos
  FOR DELETE
  TO authenticated
  USING (true);

-- RLS policies for regras_campos table
ALTER TABLE regras_campos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users" ON regras_campos
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert access to authenticated users" ON regras_campos
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users" ON regras_campos
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access to authenticated users" ON regras_campos
  FOR DELETE TO authenticated USING (true);

-- RLS policies for regras_dados table
ALTER TABLE regras_dados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to authenticated users" ON regras_dados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow insert access to authenticated users" ON regras_dados
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow update access to authenticated users" ON regras_dados
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access to authenticated users" ON regras_dados
  FOR DELETE TO authenticated USING (true);