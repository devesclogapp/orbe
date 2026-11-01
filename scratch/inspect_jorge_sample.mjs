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

  const { data } = await supabase
    .from('registros_ponto')
    .select('id, data, entrada, saida_almoco, retorno_almoco, saida, status, status_processamento')
    .eq('cpf_colaborador', '09292850785')
    .order('data', { ascending: true })
    .limit(10);

  console.log('Amostra de registros do Jorge:');
  console.log(JSON.stringify(data, null, 2));
}
check();
