import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

const TARGET_LOTE_ID = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';

async function checkLoteAndLancs() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  await sb.auth.signInWithPassword({ email: testEmail, password: testPassword });

  const { data: lote } = await sb
    .from('diaristas_lotes_fechamento')
    .select('*')
    .eq('id', TARGET_LOTE_ID)
    .single();

  console.log('=== LOTE DIARISTAS FECHAMENTO ===');
  console.log(JSON.stringify(lote, null, 2));

  const { data: lancs } = await sb
    .from('lancamentos_diaristas')
    .select('id, data_lancamento, valor_calculado, status, status_pagamento, status_conciliacao, lote_fechamento_id, diarista_id')
    .eq('lote_fechamento_id', TARGET_LOTE_ID);

  console.log('=== LANCAMENTOS DO LOTE ===');
  console.log(JSON.stringify(lancs, null, 2));

  // Check columns of cnab_auditoria_bancaria
  const { data: auditCols } = await sb
    .from('cnab_auditoria_bancaria')
    .select('*')
    .limit(1);

  console.log('=== AMOSTRA CNAB_AUDITORIA_BANCARIA ===');
  console.log(JSON.stringify(auditCols, null, 2));
}

checkLoteAndLancs();
