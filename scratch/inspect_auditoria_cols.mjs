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

  const { data: audit } = await supabase.from('cnab_auditoria_bancaria').select('*').limit(1);
  if (audit && audit[0]) {
    console.log('COLUNAS cnab_auditoria_bancaria:');
    console.log(Object.keys(audit[0]));
  }
}
run().catch(console.error);
