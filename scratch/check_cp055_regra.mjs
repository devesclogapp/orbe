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

  const { data: regras, error } = await supabase.from('banco_horas_regras').select('*');
  console.log('Regras in DB:', regras, 'error:', error);

  const { count: cEventos } = await supabase.from('banco_horas_eventos').select('*', { count: 'exact', head: true });
  const { count: cSaldos } = await supabase.from('banco_horas_saldos').select('*', { count: 'exact', head: true });
  const { count: cFechamento } = await supabase.from('fechamento_mensal').select('*', { count: 'exact', head: true });
  console.log('Eventos count:', cEventos, 'Saldos count:', cSaldos, 'Fechamento count:', cFechamento);
}

check().catch(console.error);
