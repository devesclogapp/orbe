ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS pis text;
NOTIFY pgrst, 'reload schema';
