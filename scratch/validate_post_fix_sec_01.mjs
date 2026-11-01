import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function checkVwAprovacoesRhTenant() {
  const authClient = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData } = await authClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  const { data: profile } = await authClient.from('profiles').select('tenant_id').eq('user_id', authData.user.id).single();
  const userTenant = profile?.tenant_id;

  // Em vw_aprovacoes_rh, obtemos as empresas vinculadas às aprovações
  const { data: rhRows } = await authClient.from('vw_aprovacoes_rh').select('id, tipo, empresa_id, situacao').limit(10);
  console.log(`vw_aprovacoes_rh retornou ${rhRows.length} linhas.`);

  // Validar se as empresas das aprovações pertencem ao tenant do usuário autenticado
  const empIds = rhRows.map(r => r.empresa_id).filter(Boolean);
  if (empIds.length > 0) {
    const { data: emps } = await authClient.from('empresas').select('id, tenant_id').in('id', empIds);
    const allEmpsInTenant = emps.every(e => e.tenant_id === userTenant);
    console.log(`Empresas de vw_aprovacoes_rh (${emps.length}) pertencem ao tenant do usuário: ${allEmpsInTenant}`);
  }
}

checkVwAprovacoesRhTenant();
