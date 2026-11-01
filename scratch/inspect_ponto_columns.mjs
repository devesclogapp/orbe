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

  const { data, error } = await supabase.from('registros_ponto').select('*').limit(1);
  if (data && data[0]) {
    console.log('REGISTROS_PONTO COLUMNS:', Object.keys(data[0]));
    console.log('SAMPLE ROW:', data[0]);
  } else {
    console.log('Error/Empty:', error);
  }
}

run();
