import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectJornadasTrabalho() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // Check columns via rpc or schema
  const { data, error } = await supabase.from('jornadas_trabalho').select('*').limit(1);
  if (error) {
    console.error('Error selecting from jornadas_trabalho:', error);
  } else {
    console.log('jornadas_trabalho query result:', data);
  }
}

inspectJornadasTrabalho();
