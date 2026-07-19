import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing config");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('financeiro_competencias').select('*').limit(1);
  console.log("financeiro_competencias:", error ? error.message : "Success");
  
  const { data: cols, error: colsErr } = await supabase.rpc('execute_sql_query', {
    sql: "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('financeiro_competencias', 'rh_financeiro_lotes', 'intermitentes_lotes_fechamento') ORDER BY table_name, ordinal_position;"
  });
  console.log("Cols via rpc:", cols, colsErr);
}

main();
