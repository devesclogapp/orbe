import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function checkSchemaAndDependencies() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  console.log('--- REGRAS DE COLUNAS (NULLABLE / NOT NULL) ---');
  
  // Testar inserção mock/dry run ou inspecionar uma operação existente
  const { data: opSample } = await supabase
    .from('operacoes_producao')
    .select('*')
    .limit(1);

  if (opSample && opSample.length > 0) {
    console.log('Colunas em operacoes_producao:');
    console.log(Object.keys(opSample[0]));
  }

  // Inspecionar servicos_extras_operacionais
  const { data: seSample } = await supabase
    .from('servicos_extras_operacionais')
    .select('*')
    .limit(1);

  if (seSample && seSample.length > 0) {
    console.log('\nColunas em servicos_extras_operacionais:');
    console.log(Object.keys(seSample[0]));
    console.log('Exemplo:', seSample[0]);
  }

  // Inspecionar custos_extras_operacionais
  const { data: ceSample } = await supabase
    .from('custos_extras_operacionais')
    .select('*')
    .limit(1);

  if (ceSample && ceSample.length > 0) {
    console.log('\nColunas em custos_extras_operacionais:');
    console.log(Object.keys(ceSample[0]));
    console.log('Exemplo:', ceSample[0]);
  }

  // Inspecionar diaristas / presencas
  const tablesDiaristas = ['diaristas_presencas', 'diaristas_ciclos', 'diaristas_lotes', 'regras_marcacao_diaristas'];
  for (const t of tablesDiaristas) {
    const { data, count, error } = await supabase.from(t).select('*', { count: 'exact' }).limit(1);
    if (error) {
      console.log(`\n${t}: ERRO (${error.message})`);
    } else {
      console.log(`\n${t}: ${count} registros`);
      if (data && data.length > 0) {
        console.log('Colunas:', Object.keys(data[0]));
        console.log('Exemplo:', data[0]);
      }
    }
  }
}

checkSchemaAndDependencies().catch(console.error);

