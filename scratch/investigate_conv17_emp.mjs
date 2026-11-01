import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const [k, ...v] = line.trim().split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim();
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  console.log('=== DETALHES DAS EMPRESAS DOS LOTES DE 08/2026 ===');
  const ids = [
    '4d4c1328-a8e7-4c5b-875d-924b416fa13a',
    '2d67a910-c329-45df-8330-e8bce09a8ee4',
    'cf987be4-467e-4970-b46d-d01881a92ab5'
  ];

  for (const id of ids) {
    const { data: emp, error } = await supabase
      .from('empresas')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    console.log(`Empresa ID ${id}:`, emp);
  }

  console.log('\n=== BUSCAR NA TABELA EMPRESAS POR NOME LIKE Operacional% OU Castanhal% ===');
  const { data: todasEmps } = await supabase
    .from('empresas')
    .select('id, nome, cnpj, tipo, created_at, status');
  console.log('Todas as empresas:', todasEmps);

  console.log('\n=== VERIFICAR LANÇAMENTOS INTERMITENTES QUE DERAM ORIGEM AOS LOTES DE 08/2026 ===');
  const { data: lancsAgrupados } = await supabase
    .from('lancamentos_intermitentes')
    .select('id, empresa_id, data_referencia, status_pipeline, lote_fechamento_id, created_at')
    .gte('data_referencia', '2026-08-01')
    .lte('data_referencia', '2026-08-31');
  console.log(`Lançamentos em 08/2026: total ${lancsAgrupados?.length}`);
  const empresasDosLancs = {};
  (lancsAgrupados || []).forEach(l => {
    empresasDosLancs[l.empresa_id] = (empresasDosLancs[l.empresa_id] || 0) + 1;
  });
  console.log('Contagem por empresa_id em lancamentos_intermitentes 08/2026:', empresasDosLancs);

  console.log('\n=== VERIFICAR RH_FINANCEIRO_LOTES PARA OS LOTES DE 08/2026 ===');
  const { data: rh08 } = await supabase
    .from('rh_financeiro_lotes')
    .select('*')
    .or('competencia.eq.2026-08,competencia.eq.08/2026');
  console.log('rh_financeiro_lotes 08/2026:', rh08);
}

run().catch(console.error);
