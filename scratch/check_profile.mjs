import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkUserProfiles() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  console.log('Login authData:', authData?.user?.id, 'error:', authErr?.message);

  // Consultar perfis_usuarios
  const { data: perfis, error: pErr } = await supabase
    .from('perfis_usuarios')
    .select('*');
  console.log('Perfis encontrados com e2e-test:', perfis, pErr);

  // Consultar usuarios ou auth metadata
  console.log('User metadata:', authData?.user?.user_metadata);
  console.log('App metadata:', authData?.user?.app_metadata);
}

checkUserProfiles();
