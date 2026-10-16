import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function probeIntegral() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  const { data, error } = await supabase
    .from('cnab_auditoria_bancaria')
    .insert({
      acao: 'RETORNO_PROCESSADO_INTEGRAL',
      detalhes: { teste: true }
    });

  console.log('Resultado insert com RETORNO_PROCESSADO_INTEGRAL:');
  console.log('Error:', error);
}

probeIntegral();
