import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }
});

async function testSecondBranch() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  const { data, error } = await supabase.rpc('rpc_rh_retificar_intermitente', {
    p_lancamento_id: '00000000-0000-0000-0000-000000000000',
    p_nova_empresa_id: '00000000-0000-0000-0000-000000000000',
    p_justificativa: 'Auditoria de integridade somente leitura hotfix P0-02'
  });

  console.log('rpc_rh_retificar_intermitente (com justificativa válida):', {
    data,
    error: error ? { message: error.message, code: error.code } : null
  });
}

testSecondBranch().catch(console.error);

