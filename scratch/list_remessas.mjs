import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function listRemessas() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    return;
  }

  console.log('User ID:', authData.user.id);

  // Listar todas as remessas visíveis
  const { data: remessas, error: remErr } = await sb
    .from('lotes_remessa')
    .select('id, sequencial_arquivo, modo, empresa_id, tipo, status, created_at');

  console.log('Remessas encontradas:', remessas);
  if (remErr) console.error('Erro:', remErr);

  // Buscar por sequencial 10
  const { data: rem10 } = await sb
    .from('lotes_remessa')
    .select('*')
    .eq('sequencial_arquivo', 10);
  console.log('Remessa sequencial 10:', rem10);

  // Buscar perfil/tenant do usuario
  const { data: perfil } = await sb
    .from('perfis_usuarios')
    .select('*')
    .eq('user_id', authData.user.id);
  console.log('Perfil usuário:', perfil);
}

listRemessas();
