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

  console.log('=== INSPEÇÃO DOS PONTOS REAIS DE JORGE BRUNO (SETEMBRO/2026) ===\n');

  // Buscar Jorge
  const { data: jorge } = await supabase
    .from('colaboradores')
    .select('id, nome, matricula, empresa_id, modelo_calculo, tipo_contrato, tipo_colaborador, valor_base, jornada_contratada')
    .eq('matricula', '44')
    .single();

  console.log('Colaborador Jorge:', JSON.stringify(jorge, null, 2));

  // Buscar registros_ponto de Jorge em setembro/2026
  const { data: pontos } = await supabase
    .from('registros_ponto')
    .select('id, data, entrada, saida_almoco, retorno_almoco, saida, status, status_processamento, horas_trabalhadas, atraso, falta, hora_extra, tipo_dia, observacoes')
    .eq('colaborador_id', jorge.id)
    .gte('data', '2026-09-01')
    .lte('data', '2026-09-30')
    .order('data', { ascending: true });

  console.log(`Total de pontos em setembro/2026: ${pontos?.length}`);

  // Analisar cada dia da semana
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const summary = (pontos || []).map(p => {
    const dateObj = new Date(`${p.data}T00:00:00`);
    const dayOfWeek = dayNames[dateObj.getDay()];
    return {
      data: p.data,
      diaSemana: dayOfWeek,
      entrada: p.entrada,
      saida_almoco: p.saida_almoco,
      retorno_almoco: p.retorno_almoco,
      saida: p.saida,
      status: p.status,
      tipo_dia: p.tipo_dia,
      horas_trabalhadas: p.horas_trabalhadas,
      atraso: p.atraso,
      falta: p.falta,
      hora_extra: p.hora_extra
    };
  });

  console.log('Dias presentes no banco:');
  console.table(summary);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
