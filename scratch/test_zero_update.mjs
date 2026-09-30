import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function testUpdate() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // Fetch the current rule
  const { data: regras } = await supabase.from('banco_horas_regras').select('*');
  const target = regras[0];
  console.log('Target rule before:', target.id, target.nome, 'adicional:', target.adicional_hora_extra_percentual);

  // Update with 0
  const { data: updated, error } = await supabase
    .from('banco_horas_regras')
    .update({ adicional_hora_extra_percentual: 0 })
    .eq('id', target.id)
    .select('*')
    .single();

  console.log('Target rule after updating with 0:', updated?.id, 'adicional:', updated?.adicional_hora_extra_percentual, 'error:', error);
}

testUpdate().catch(console.error);
