import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

const TARGET_LOTE_ID = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';

async function checkLancs() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  await sb.auth.signInWithPassword({ email: testEmail, password: testPassword });

  // Inspecionar lancamentos_diaristas usando select('*')
  const { data, error } = await sb
    .from('lancamentos_diaristas')
    .select('*')
    .eq('lote_fechamento_id', TARGET_LOTE_ID);

  console.log('Error lancamentos_diaristas:', error);
  console.log('Data lancamentos_diaristas length:', data?.length);
  console.log(JSON.stringify(data, null, 2));

  // Verificar quais colunas existem em cnab_remessa_itens
  const { data: remItens } = await sb
    .from('cnab_remessa_itens')
    .select('*')
    .eq('remessa_id', '46391aad-6417-48cf-ac78-03a2a9dd8b22');

  console.log('Origem IDs em cnab_remessa_itens:');
  remItens?.forEach(ri => console.log('ri.id:', ri.id, 'origem_id:', ri.origem_id, 'status:', ri.status, 'valor:', ri.valor));

  if (remItens && remItens.length > 0) {
    const origemIds = remItens.map(ri => ri.origem_id);
    const { data: lancsPorId, error: lancsErr } = await sb
      .from('lancamentos_diaristas')
      .select('*')
      .in('id', origemIds);
    console.log('Lançamentos encontrados por origem_id:', lancsPorId?.length, 'error:', lancsErr);
    console.log(JSON.stringify(lancsPorId, null, 2));
  }
}

checkLancs();
