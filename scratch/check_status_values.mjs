import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function checkStatusConstraints() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  // Consultar uma linha de cada tabela para ver os valores existentes de status
  const tables = [
    { table: 'operacoes_producao', cols: 'status, status_rh' },
    { table: 'servicos_extras_operacionais', cols: 'pipeline_status, status_pagamento' },
    { table: 'custos_extras_operacionais', cols: 'pipeline_status, status_pagamento' },
    { table: 'lancamentos_diaristas', cols: 'status' },
    { table: 'diaristas_lotes_fechamento', cols: 'status' },
    { table: 'intermitentes_lotes_fechamento', cols: 'status' },
    { table: 'rh_financeiro_lotes', cols: 'status' },
    { table: 'receitas_operacionais', cols: 'status' },
    { table: 'faturas', cols: 'status' },
    { table: 'financeiro_consolidados_cliente', cols: 'status' },
    { table: 'financeiro_consolidados_colaborador', cols: 'status' }
  ];

  for (const t of tables) {
    const { data, error } = await sb.from(t.table).select(t.cols).limit(5);
    if (error) {
      console.error(`Erro ao ler ${t.table}:`, error.message);
    } else {
      console.log(`${t.table}:`, data);
    }
  }
}

checkStatusConstraints().catch(console.error);
