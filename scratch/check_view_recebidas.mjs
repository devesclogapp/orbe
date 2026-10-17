import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function checkOpStatusInView() {
  const sbAuth = createClient(supabaseUrl, supabaseAnonKey);
  await sbAuth.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });

  const ids = [
    'e9aeb606-5a9c-4cc1-9c33-92bf4870beef',
    'fa088809-d946-40b7-bb5a-c7e4133529de',
    '5753a880-a2de-4b52-a7a5-0a9263530286',
    '3f6f8942-529d-4fe0-966f-de94a6d4611b'
  ];

  const { data, error } = await sbAuth
    .from('operacoes_producao')
    .select('id, status, status_rh, valor_total, criado_em')
    .in('id', ids);

  console.log('Status no operacoes_producao das operações que aparecem na view:');
  console.log(data);

  // Consulta se existe alguma operação com status RECEBIDO na vw_aprovacoes_rh
  const { data: opRecebida } = await sbAuth
    .from('operacoes_producao')
    .select('id, status, status_rh')
    .eq('status', 'RECEBIDO')
    .limit(3);
  console.log('\nExemplos de operações com status RECEBIDO no banco:');
  console.log(opRecebida);

  if (opRecebida && opRecebida.length > 0) {
    const { data: viewCheck } = await sbAuth
      .from('vw_aprovacoes_rh')
      .select('id, tipo, raw_status')
      .in('id', opRecebida.map(o => o.id));
    console.log('Essas operações RECEBIDO aparecem na vw_aprovacoes_rh oficial?');
    console.log(viewCheck);
  }
}

checkOpStatusInView().catch(console.error);
