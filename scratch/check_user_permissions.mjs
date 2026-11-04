import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkPermissions() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  const { data: perms, error } = await supabase
    .from('user_permissions')
    .select('*');

  if (error) {
    console.error('Erro ao buscar user_permissions:', error);
    return;
  }

  console.log('=== REGISTROS DE USER_PERMISSIONS ===');
  for (const p of perms) {
    console.log(`User ID: ${p.user_id} | Nome: ${p.full_name} | Role: ${p.role}`);
    console.log('  Permissions:', JSON.stringify(p.permissions, null, 2));
  }
}

checkPermissions().catch(console.error);

