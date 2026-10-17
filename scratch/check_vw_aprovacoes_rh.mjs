import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function checkVwAprovacoesRh() {
  console.log('=== AUDITORIA READ-ONLY: vw_aprovacoes_rh NO SUPABASE OFICIAL ===\n');

  const sbAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sbAuth.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });

  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    return;
  }

  // Consulta operações na vw_aprovacoes_rh
  const { data: items, error: errView } = await sbAuth
    .from('vw_aprovacoes_rh')
    .select('*')
    .eq('tipo', 'OPERAÇÃO')
    .limit(10);

  if (errView) {
    console.error('Erro ao consultar vw_aprovacoes_rh:', errView.message);
    return;
  }

  console.log(`Operações retornadas por vw_aprovacoes_rh: ${items.length}`);
  console.log(JSON.stringify(items, null, 2));

  // Verifica se a operação homologada OP-0328D4A8 aparece
  const opHomologada = items.find(i => i.id === '0328d4a8-6ed2-47f7-b45d-531af9a0674c');
  console.log('\nOperação OP-0328D4A8 na view:');
  console.log(opHomologada || 'Não retornada');
}

checkVwAprovacoesRh().catch(console.error);
