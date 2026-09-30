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
  const authRes = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });
  if (authRes.error) {
    console.error("Auth error:", authRes.error);
    process.exit(1);
  }

  console.log("=== TESTANDO EXECUTE_SQL_QUERY ===");
  const testSql = async (sql) => {
    const { data, error } = await supabase.rpc('execute_sql_query', { sql_query: sql });
    return { data, error };
  };

  // 1. Q1 - to_regclass e column check
  console.log("\n--- Q1.2: to_regclass('public.jornadas_trabalho') ---");
  const q1Regclass = await testSql("SELECT to_regclass('public.jornadas_trabalho') as regclass;");
  console.log("Result:", JSON.stringify(q1Regclass));

  console.log("\n--- Q1.2: column_name jornada_id em colaboradores ---");
  const q1Col = await testSql("SELECT column_name FROM information_schema.columns WHERE table_name = 'colaboradores' AND column_name = 'jornada_id';");
  console.log("Result:", JSON.stringify(q1Col));

  console.log("\n--- Q1.4: schema_migrations ---");
  const q1Mig = await testSql("SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '20260929%' ORDER BY version;");
  console.log("Result:", JSON.stringify(q1Mig));
  if (q1Mig.error) {
    const q1MigAll = await testSql("SELECT * FROM supabase_migrations.schema_migrations ORDER BY version DESC LIMIT 10;");
    console.log("All recent migrations:", JSON.stringify(q1MigAll));
  }

  // 2. Q2 - Registros processados
  console.log("\n--- Q2: registros_ponto processados ---");
  const q2Sql = `
    SELECT id, colaborador_id, data, status, status_processamento, regra_aplicada,
           processado_em, updated_at, horas_calculadas, saldo_dia, saldo_acumulado_minutos,
           jornada_calculada, valor_hora, valor_dia, is_teste
    FROM registros_ponto
    WHERE status_processamento IN ('PROCESSADO', 'processado')
       OR status IN ('PROCESSADO', 'processado')
    ORDER BY processado_em;
  `;
  const q2Res = await testSql(q2Sql);
  if (q2Res.data) {
    console.log("Count processados via SQL:", q2Res.data.length);
    console.log("Rows:", JSON.stringify(q2Res.data, null, 2));
  } else {
    console.log("Error SQL, tentando supabase.from:", q2Res.error);
    const { data: rows, error: rError } = await supabase
      .from('registros_ponto')
      .select('id, colaborador_id, data, status, status_processamento, regra_aplicada, processado_em, updated_at, horas_calculadas, saldo_dia, saldo_acumulado_minutos, jornada_calculada, valor_hora, valor_dia, is_teste')
      .in('status_processamento', ['PROCESSADO', 'processado'])
      .order('processado_em');
    console.log("Count rows:", rows?.length, "Rows:", JSON.stringify(rows, null, 2), "Error:", rError);
  }
}

run().catch(console.error);
