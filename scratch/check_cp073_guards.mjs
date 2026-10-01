import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

const EXPECTED_COLAB_ID = 'cc782f3f-10a9-4a45-8219-7cdb91a791ed';
const EXPECTED_SANDBOX_ID = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
const COMPETENCIA = '2026-10';

async function main() {
  console.log('=== VERIFICAÇÃO DOS GUARDS PRÉ-CP07.3 ===');

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: process.env.E2E_TEST_EMAIL,
    password: process.env.E2E_TEST_PASSWORD,
  });
  if (authErr || !authData.user) {
    throw new Error(`Falha na autenticação: ${authErr?.message}`);
  }
  console.log(`[AUTH] Conectado: ${authData.user.email}`);

  // 1. Empresa
  const { data: emp, error: empErr } = await supabase
    .from('empresas')
    .select('id, nome, is_teste')
    .eq('id', EXPECTED_SANDBOX_ID)
    .single();
  console.log('1. Empresa:', emp, 'is_teste:', emp?.is_teste);

  // 2. Colaborador
  const { data: colab, error: colabErr } = await supabase
    .from('colaboradores')
    .select('id, nome, is_teste, empresa_id')
    .eq('id', EXPECTED_COLAB_ID)
    .single();
  console.log('2. Colaborador:', colab, 'is_teste:', colab?.is_teste);

  // 3. Pontos
  const { data: pontos, error: pontosErr } = await supabase
    .from('registros_ponto')
    .select('id, data, status_processamento, minutos_extra, valor_hora_extra, horas_extras_detalhadas')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .order('data', { ascending: true });
  console.log(`3. Total pontos: ${pontos?.length}`);
  const statusCounts = {};
  let totalMinutosExtra = 0;
  for (const p of pontos || []) {
    statusCounts[p.status_processamento] = (statusCounts[p.status_processamento] || 0) + 1;
    totalMinutosExtra += (p.minutos_extra || 0);
    console.log(`   ${p.data}: status=${p.status_processamento}, min_extra=${p.minutos_extra}, val_he=${p.valor_hora_extra}`);
  }
  console.log('   Status counts:', statusCounts);
  console.log(`   Total minutos extra físicos: ${totalMinutosExtra}`);

  // 4. Saldo BH
  const { data: saldoBH, error: saldoErr } = await supabase
    .from('banco_horas_saldos')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .maybeSingle();
  console.log('4. Saldo BH:', saldoBH?.saldo_atual_minutos, 'minutos (+4h = 240min)');

  // 5. Eventos BH
  const { data: eventosBH, error: evErr } = await supabase
    .from('banco_horas_eventos')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .order('data_evento', { ascending: true });
  console.log(`5. Total eventos BH: ${eventosBH?.length}`);
  for (const ev of eventosBH || []) {
    console.log(`   Evento ${ev.data_evento}: tipo=${ev.tipo_evento}, min=${ev.minutos_evento}, ref_fin_pend=${ev.reflexo_financeiro_pendente}`);
  }

  // 6. Lotes RH Financeiro existentes
  const { data: lotes, error: lotesErr } = await supabase
    .from('rh_financeiro_lotes')
    .select('*')
    .eq('empresa_id', EXPECTED_SANDBOX_ID)
    .eq('competencia', COMPETENCIA);
  console.log(`6. Lotes RH Financeiro existentes para 2026-10: ${lotes?.length}`);

  // 7. Fechamento mensal existente
  const { data: fechamento, error: fechErr } = await supabase
    .from('fechamento_mensal')
    .select('*')
    .eq('colaborador_id', EXPECTED_COLAB_ID)
    .eq('ano', 2026)
    .eq('mes', 10);
  console.log(`7. Fechamento mensal existente:`, fechamento);
}

main().catch(console.error);
