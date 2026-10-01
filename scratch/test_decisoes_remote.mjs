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
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  if (authErr) {
    console.error('Auth error:', authErr);
    process.exit(1);
  }

  console.log('Authenticated user:', auth.user.email);

  const { data: decisaoCheck, error: errDecisao } = await supabase
    .from('registros_ponto_decisoes')
    .select('id, tipo_decisao, justificativa, ativo')
    .limit(5);

  console.log('registros_ponto_decisoes query:', {
    error: errDecisao,
    count: decisaoCheck?.length,
    sample: decisaoCheck
  });
}

check();
