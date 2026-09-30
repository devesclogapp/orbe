import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function check() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const testSql = async (sql) => {
    const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: sql });
    return { data, error };
  };

  const r1 = await testSql("SELECT to_regclass('public.jornadas_trabalho') as tbl;");
  const r2 = await testSql("SELECT to_regclass('public.registros_ponto_regularizacoes') as tbl;");
  const r3 = await testSql("SELECT column_name FROM information_schema.columns WHERE table_name = 'banco_horas_regras' AND column_name IN ('vigencia_inicio', 'vigencia_fim', 'adicional_hora_extra_percentual');");
  const r4 = await testSql("SELECT column_name FROM information_schema.columns WHERE table_name = 'colaboradores' AND column_name = 'jornada_id';");

  console.log("jornadas_trabalho:", r1.data);
  console.log("registros_ponto_regularizacoes:", r2.data);
  console.log("banco_horas_regras novas colunas:", r3.data);
  console.log("colaboradores.jornada_id:", r4.data);
}

check().catch(console.error);
