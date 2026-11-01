import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function inspectColumns() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  // Testar operacoes_producao colunas de timestamp
  const testOpCols = ['updated_at', 'atualizado_em', 'created_at', 'criado_em'];
  for (const c of testOpCols) {
    const { error } = await sb.from('operacoes_producao').select(c).limit(1);
    console.log(`operacoes_producao.${c}:`, error ? `FAIL: ${error.message}` : 'EXISTS');
  }

  // Testar custos_extras_operacionais colunas de observacao
  const testCustCols = ['observacoes', 'observacao', 'obs', 'motivo', 'descricao'];
  for (const c of testCustCols) {
    const { error } = await sb.from('custos_extras_operacionais').select(c).limit(1);
    console.log(`custos_extras_operacionais.${c}:`, error ? `FAIL: ${error.message}` : 'EXISTS');
  }

  // Pegar uma linha qualquer de operacoes_producao para ver todas as chaves
  const { data: opRow } = await sb.from('operacoes_producao').select('*').limit(1);
  if (opRow && opRow[0]) {
    console.log('operacoes_producao columns:', Object.keys(opRow[0]));
  }

  // Pegar uma linha qualquer de custos_extras_operacionais
  const { data: custRow } = await sb.from('custos_extras_operacionais').select('*').limit(1);
  if (custRow && custRow[0]) {
    console.log('custos_extras_operacionais columns:', Object.keys(custRow[0]));
  }
}

inspectColumns().catch(console.error);
