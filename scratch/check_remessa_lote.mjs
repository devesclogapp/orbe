import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkRemessaAndLote() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';

  const { data: rem, error: remErr } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, status, modo, updated_at')
    .eq('id', remessaId);
  console.log('Remessa query:', rem, remErr);

  const { data: lote, error: loteErr } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, status_conciliacao, updated_at')
    .eq('id', loteOpId);
  console.log('Lote query:', lote, loteErr);
}

checkRemessaAndLote();
