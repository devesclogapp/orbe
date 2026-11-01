import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lifgjtcflzmspilhryap.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@orbe.local';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '123456';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function generateMatrix() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  const targetLoteId = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  const targetRemessaId = '46391aad-6417-48cf-ac78-03a2a9dd8b22';

  const { data: itens } = await supabase
    .from('cnab_remessa_itens')
    .select('id, remessa_id, origem_tipo, origem_id, valor, status, created_at')
    .eq('remessa_id', targetRemessaId)
    .order('created_at', { ascending: true });

  const { data: lancs } = await supabase
    .from('lancamentos_diaristas')
    .select('id, data_lancamento, codigo_marcacao, valor_diaria_base, valor_calculado, status, created_at')
    .eq('lote_fechamento_id', targetLoteId)
    .order('data_lancamento', { ascending: true });

  console.log('=== DADOS REAIS EXTRAÍDOS DO SUPABASE ===');
  console.log('ITENS DA REMESSA (cnab_remessa_itens):');
  console.table(itens);

  console.log('\nLANÇAMENTOS DO LOTE (lancamentos_diaristas):');
  console.table(lancs);

  // Cruzar FK origem_id com lancamento.id
  console.log('\nVÍNCULO RELACIONAL ESTREITO:');
  for (const item of itens || []) {
    const lanc = (lancs || []).find(l => l.id === item.origem_id);
    console.log(`Item ${item.id} -> origem_id ${item.origem_id} -> Lançamento Data: ${lanc?.data_lancamento}, Código: ${lanc?.codigo_marcacao}, Valor Lanc: R$ ${lanc?.valor_calculado}, Valor Item: R$ ${item.valor}, Match: ${item.valor === lanc?.valor_calculado}`);
  }
}

generateMatrix();
