import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkE2EUser() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Erro de login:', authErr);
    return;
  }

  const user = authData.user;
  console.log('Login com sucesso!');
  console.log('User ID:', user.id);
  console.log('Email:', user.email);

  // Buscar profile
  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  console.log('Profile:', profile, profErr ? { error: profErr.message } : '');

  // Buscar permissões
  const { data: perms, error: permErr } = await supabase
    .from('user_permissions')
    .select('*')
    .eq('user_id', user.id);

  console.log('User Permissions:', perms, permErr ? { error: permErr.message } : '');

  // Buscar outras contas de teste em profiles (somente leitura)
  const { data: allProfiles, error: allErr } = await supabase
    .from('profiles')
    .select('user_id, tenant_id, full_name, role');

  console.log('Perfis visíveis no tenant:', allProfiles, allErr ? { error: allErr.message } : '');
}

checkE2EUser().catch(console.error);

