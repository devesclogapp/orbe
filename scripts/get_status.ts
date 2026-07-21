import { getE2EContext } from './utils/e2e-guard';
async function main() {
  const { supabase } = await getE2EContext('DEBUG-STATUS');
  const { data, error } = await supabase.rpc('execute_sql_query', {
    sql_query: "SELECT pg_get_constraintdef(c.oid) AS constraint_def FROM pg_constraint c JOIN pg_class t ON c.conrelid = t.oid WHERE t.relname = 'intermitentes_lotes_fechamento' AND c.conname = 'intermitentes_lotes_fechamento_status_check';"
  });
  console.log(data || error);
}
main().catch(console.log);
