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

  // Query PostgreSQL information_schema via RPC or direct queries if allowed
  const { data, error } = await supabase.rpc('get_tables_list');
  if (data) {
    console.log('Tables:', data);
  } else {
    // Try querying common candidate names
    const candidateTables = [
      'registros_ponto_ajustes',
      'registros_ponto_regularizacoes',
      'ponto_ajustes',
      'ponto_regularizacoes',
      'ajustes_ponto',
      'pontos_ajustes',
      'ponto_marcacoes_ajustes'
    ];
    for (const t of candidateTables) {
      const { data: d, error: err } = await supabase.from(t).select('id').limit(1);
      console.log(`Table ${t}:`, err ? err.message : 'EXISTS');
    }
  }
}

run();
