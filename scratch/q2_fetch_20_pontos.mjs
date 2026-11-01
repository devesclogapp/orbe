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

  const { data: rows, error } = await supabase
    .from('registros_ponto')
    .select('id, colaborador_id, data, status, status_processamento, regra_aplicada, processado_em, updated_at, created_at, entrada, saida, horas_trabalhadas, horas_calculadas, saldo_dia')
    .in('status_processamento', ['PROCESSADO', 'processado'])
    .order('updated_at', { ascending: true });

  console.log(`Total encontrados: ${rows?.length}`);
  console.log(JSON.stringify(rows, null, 2));
}

run();
