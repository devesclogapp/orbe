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

  const { data, error } = await supabase
    .from('registros_ponto')
    .select('id, data, colaborador_id, status_processamento, valor_dia, valor_hora_extra, valor_atraso, valor_falta, minutos_extra, minutos_atraso, jornada_calculada, created_at, updated_at')
    .in('status_processamento', ['PROCESSADO', 'processado']);

  console.log('Registros processados:', data?.length);
  if (data?.length > 0) {
    console.log('Sample:', JSON.stringify(data.slice(0, 10), null, 2));
    // Buscar nomes dos colaboradores desses registros
    const colabIds = [...new Set(data.map(d => d.colaborador_id))];
    const { data: colabs } = await supabase
      .from('colaboradores')
      .select('id, nome, matricula, tipo_colaborador, valor_base, is_teste')
      .in('id', colabIds);
    console.log('Colaboradores dos pontos processados:', JSON.stringify(colabs, null, 2));
  }
}
check();
