-- 2026-05-03 23:10:00: Enable pg_cron and schedule backup for custos
-- Ensure the extension is installed
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a scheduled job that copies custos to custos_backup daily at 03:00 UTC
SELECT cron.schedule('0 3 * * *', $$
  INSERT INTO custos_backup
  SELECT *, now() AS backup_at FROM custos;
$$);

-- Ensure custos_backup table exists
CREATE TABLE IF NOT EXISTS custos_backup (
  id uuid,
  data date,
  usuario_id uuid,
  custo_extra numeric,
  custo_transportador numeric,
  custo_alimentacao numeric,
  custos_operacionais numeric,
  backup_at timestamptz
);
