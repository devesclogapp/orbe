import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function checkOp() {
  const sbAuth = createClient(supabaseUrl, supabaseAnonKey);
  await sbAuth.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });

  const opId = '0328d4a8-6ed2-47f7-b45d-531af9a0674c';
  const { data: opData, error: opErr } = await sbAuth
    .from('operacoes_producao')
    .select('*')
    .eq('id', opId)
    .single();

  if (opErr) {
    console.error('Erro:', opErr.message);
  } else {
    console.log('Operacao OP-0328D4A8:', JSON.stringify(opData, null, 2));
  }
}

checkOp().catch(console.error);
