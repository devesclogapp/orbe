import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkLoteOnly() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';

  const { data: lote, error: loteErr } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, updated_at')
    .eq('id', loteOpId);
  console.log('Lote query:', lote, loteErr);
}

checkLoteOnly();
