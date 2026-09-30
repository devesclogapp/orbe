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

  const res1 = await supabase.from('jornadas_trabalho').select('*');
  console.log('jornadas_trabalho count:', res1.data?.length, 'error:', res1.error);

  const res2 = await supabase.from('colaboradores').select('id, jornada_id').not('jornada_id', 'is', null);
  console.log('colaboradores com jornada_id count:', res2.data?.length, 'error:', res2.error);
}

run();
