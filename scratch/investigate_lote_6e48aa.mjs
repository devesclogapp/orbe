import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Ler .env.local
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  if (authError) {
    console.error('Falha de autenticação:', authError);
    return;
  }
  console.log('Autenticado com sucesso como:', authData.user.email);

  console.log('\n=== 1. BUSCA LOTE 6e48aa EM intermitentes_lotes_fechamento ===');
  const { data: loteData, error: loteErr } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('*')
    .ilike('id', '%6e48aa%');
  console.log('Lote 6e48aa:', JSON.stringify(loteData, null, 2), loteErr);

  console.log('\n=== 2. BUSCA NA VIEW/TABELA DE APROVAÇÕES RH ===');
  const { data: viewAprov, error: viewErr } = await supabase
    .from('vw_aprovacoes_rh')
    .select('*')
    .limit(10);
  console.log('vw_aprovacoes_rh sample:', JSON.stringify(viewAprov, null, 2), viewErr);

  if (loteData && loteData.length > 0) {
    const loteId = loteData[0].id;
    console.log('\n=== 3. BUSCA LOTE ESPECÍFICO NA vw_aprovacoes_rh ===');
    const { data: loteInView, error: viewLoteErr } = await supabase
      .from('vw_aprovacoes_rh')
      .select('*')
      .or(`id.eq.${loteId},referencia_id.eq.${loteId},lote_id.eq.${loteId}`);
    console.log('Lote in vw_aprovacoes_rh:', JSON.stringify(loteInView, null, 2), viewLoteErr);

    console.log('\n=== 4. BUSCA NA TABELA rh_aprovacoes OU SIMILAR ===');
    const { data: rhAprov, error: rhAprovErr } = await supabase
      .from('rh_aprovacoes')
      .select('*')
      .or(`referencia_id.eq.${loteId},lote_id.eq.${loteId}`);
    console.log('rh_aprovacoes:', JSON.stringify(rhAprov, null, 2), rhAprovErr);
  }
}

run();
