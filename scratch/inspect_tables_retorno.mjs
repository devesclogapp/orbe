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

  const candidates = [
    'lancamentos_intermitentes',
    'intermitentes_lancamentos',
    'intermitentes_lotes_fechamento',
    'intermitentes_lotes',
    'lancamentos_diaristas',
    'diaristas_lotes_fechamento',
    'diaristas_lotes',
    'lotes_fechamento_diaristas',
    'lotes_remessa',
    'rh_financeiro_lotes',
    'cnab_remessas_arquivos',
    'cnab_remessa_itens',
    'cnab_retorno_arquivos',
    'cnab_retorno_itens'
  ];

  console.log('=== VERIFICAÇÃO DE TABELAS REAIS ===');
  for (const t of candidates) {
    const { data, error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      console.log(`❌ ${t}: NÃO EXISTE (${error.message})`);
    } else {
      console.log(`✅ ${t}: EXISTE (${data ? data.length : 0} rows lidas)`);
    }
  }

  // Verificar colunas de cnab_remessas_arquivos
  const { data: remessa } = await supabase.from('cnab_remessas_arquivos').select('*').limit(1);
  if (remessa && remessa[0]) {
    console.log('\n=== COLUNAS DE cnab_remessas_arquivos ===');
    console.log(Object.keys(remessa[0]));
  }

  // Verificar colunas de cnab_remessa_itens
  const { data: item } = await supabase.from('cnab_remessa_itens').select('*').limit(1);
  if (item && item[0]) {
    console.log('\n=== COLUNAS DE cnab_remessa_itens ===');
    console.log(Object.keys(item[0]));
  }

  // Verificar colunas de lancamentos_intermitentes
  const { data: lint } = await supabase.from('lancamentos_intermitentes').select('*').limit(1);
  if (lint && lint[0]) {
    console.log('\n=== COLUNAS DE lancamentos_intermitentes ===');
    console.log(Object.keys(lint[0]));
  }

  // Verificar colunas de intermitentes_lotes_fechamento
  const { data: loteint } = await supabase.from('intermitentes_lotes_fechamento').select('*').limit(1);
  if (loteint && loteint[0]) {
    console.log('\n=== COLUNAS DE intermitentes_lotes_fechamento ===');
    console.log(Object.keys(loteint[0]));
  }

  // Verificar colunas de lancamentos_diaristas
  const { data: ldia } = await supabase.from('lancamentos_diaristas').select('*').limit(1);
  if (ldia && ldia[0]) {
    console.log('\n=== COLUNAS DE lancamentos_diaristas ===');
    console.log(Object.keys(ldia[0]));
  }

  // Verificar colunas de diaristas_lotes_fechamento
  const { data: lotedia } = await supabase.from('diaristas_lotes_fechamento').select('*').limit(1);
  if (lotedia && lotedia[0]) {
    console.log('\n=== COLUNAS DE diaristas_lotes_fechamento ===');
    console.log(Object.keys(lotedia[0]));
  }
}

run().catch(console.error);
