import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const testSql = async (sql) => {
    const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: sql });
    return { data, error };
  };

  console.log("--- Q1.2: to_regclass('public.jornadas_trabalho') ---");
  const q1Regclass = await testSql("SELECT to_regclass('public.jornadas_trabalho') as regclass;");
  console.log("Result:", JSON.stringify(q1Regclass));

  console.log("\n--- Q1.2: column_name jornada_id em colaboradores ---");
  const q1Col = await testSql("SELECT column_name FROM information_schema.columns WHERE table_name = 'colaboradores' AND column_name = 'jornada_id';");
  console.log("Result:", JSON.stringify(q1Col));

  console.log("\n--- Q1.4: schema_migrations ---");
  const q1Mig = await testSql("SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260929%' ORDER BY version;");
  console.log("Result 20260929%:", JSON.stringify(q1Mig));

  const q1MigRecent = await testSql("SELECT version FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 15;");
  console.log("Result recent:", JSON.stringify(q1MigRecent));
}

run().catch(console.error);
