import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lifgjtcflzmspilhryap.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@orbe.local';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '123456';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testIndexPresence() {
  const { data: authData } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  // Tentar inserir deliberadamente com conflito de chave única ou verificar metadados?
  // NÃO PODEMOS FAZER INSERTS (estritamente read-only).
  // Mas podemos verificar a tabela cnab_remessas_arquivos
  const { data, error } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, diaristas_lote_id, status')
    .limit(5);

  console.log('cnab_remessas_arquivos amostra:', data, error);
}

testIndexPresence();
