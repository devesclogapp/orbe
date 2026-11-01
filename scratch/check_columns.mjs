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

  const { data: colabs } = await supabase.from('colaboradores').select('*').limit(1);
  if (colabs && colabs[0]) {
    console.log('--- COLUNAS DE COLABORADORES ---');
    console.log(Object.keys(colabs[0]).sort().join(', '));
  }

  const { data: pontos } = await supabase.from('registros_ponto').select('*').limit(1);
  if (pontos && pontos[0]) {
    console.log('\n--- COLUNAS DE REGISTROS_PONTO ---');
    console.log(Object.keys(pontos[0]).sort().join(', '));
  }

  const { data: regras } = await supabase.from('banco_horas_regras').select('*').limit(1);
  if (regras && regras[0]) {
    console.log('\n--- COLUNAS DE BANCO_HORAS_REGRAS ---');
    console.log(Object.keys(regras[0]).sort().join(', '));
  }
}

run();
