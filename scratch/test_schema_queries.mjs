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

  console.log("=== TEST 1: jornadas_trabalho ===");
  const r1 = await supabase.from('jornadas_trabalho').select('*').limit(1);
  console.log("jornadas_trabalho:", JSON.stringify(r1));

  console.log("\n=== TEST 2: colaboradores.jornada_id ===");
  const r2 = await supabase.from('colaboradores').select('jornada_id').limit(1);
  console.log("colaboradores.jornada_id:", JSON.stringify(r2));

  console.log("\n=== TEST 3: supabase_migrations schema ===");
  try {
    const r3 = await supabase.schema('supabase_migrations').from('schema_migrations').select('*').limit(5);
    console.log("supabase_migrations via schema():", JSON.stringify(r3));
  } catch (err) {
    console.log("Error schema():", err.message);
  }

  console.log("\n=== TEST 4: schema_migrations direct ===");
  const r4 = await supabase.from('schema_migrations').select('*').limit(5);
  console.log("schema_migrations direct:", JSON.stringify(r4));

  console.log("\n=== TEST 5: _prisma_migrations / migrations ===");
  const r5 = await supabase.from('_prisma_migrations').select('*').limit(5);
  console.log("_prisma_migrations:", JSON.stringify(r5));
}

run().catch(console.error);
