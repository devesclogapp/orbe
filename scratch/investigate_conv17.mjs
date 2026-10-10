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

  console.log('\n=== 1. TODOS OS LOTES EM intermitentes_lotes_fechamento (LIMIT 20) ===');
  const { data: allLotes, error: errAllLotes } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, competencia, periodo_inicio, periodo_fim, quantidade_registros, valor_total, status, empresa_id, created_at, observacoes')
    .order('created_at', { ascending: false })
    .limit(20);
  
  if (errAllLotes) console.error('Erro all lotes:', errAllLotes);
  else console.log('Lotes encontrados:', JSON.stringify(allLotes, null, 2));

  console.log('\n=== 2. LOTES COM competencia ILIKE %08% ===');
  const { data: lotes08 } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, competencia, periodo_inicio, periodo_fim, quantidade_registros, valor_total, status, empresa_id, created_at, observacoes')
    .or('competencia.ilike.%08%,periodo_inicio.ilike.%2026-08%');
  console.log('Lotes 08:', JSON.stringify(lotes08, null, 2));

  console.log('\n=== 3. TODAS AS EMPRESAS ===');
  const { data: todasEmpresas } = await supabase
    .from('empresas')
    .select('id, nome, cnpj, tipo, created_at');
  console.log('Todas as empresas:', JSON.stringify(todasEmpresas, null, 2));

  console.log('\n=== 4. BUSCAR LOTES CANCELADOS ===');
  const { data: lotesCancelados } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, competencia, periodo_inicio, periodo_fim, quantidade_registros, valor_total, status, empresa_id')
    .eq('status', 'CANCELADO');
  console.log('Lotes Cancelados:', JSON.stringify(lotesCancelados, null, 2));

  if (lotesCancelados && lotesCancelados.length > 0) {
    for (const lc of lotesCancelados) {
      const { data: itens, count } = await supabase
        .from('lancamentos_intermitentes')
        .select('id, status_pipeline, nome_colaborador', { count: 'exact' })
        .eq('lote_fechamento_id', lc.id);
      console.log(`Lote Cancelado ${lc.id}: quantidade_registros=${lc.quantidade_registros}, count em lancamentos_intermitentes=${count}, itens:`, itens);
    }
  }

  console.log('\n=== 5. RH_FINANCEIRO_LOTES ===');
  const { data: rhLotes } = await supabase
    .from('rh_financeiro_lotes')
    .select('id, empresa_id, competencia, status, valor_total, tipo, quantidade_registros')
    .eq('tipo', 'INTERMITENTES');
  console.log('rh_financeiro_lotes:', JSON.stringify(rhLotes, null, 2));
}

run().catch(console.error);
