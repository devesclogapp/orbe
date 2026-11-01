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

  const { data: regras, count } = await supabase
    .from('banco_horas_regras')
    .select('*', { count: 'exact' });

  console.log(`Total registros em banco_horas_regras: ${count}`);
  if (regras && regras.length > 0) {
    console.log('Regras encontradas:', JSON.stringify(regras, null, 2));
  } else {
    console.log('A tabela banco_horas_regras está 100% VAZIA (0 registros).');
  }
}

run().catch(console.error);
