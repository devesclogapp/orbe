import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkP002RPCs() {
  console.log('=== TESTE DE ACESSIBILIDADE DAS RPCs DO P0-02 NO SUPABASE REMOTO ===');
  console.log('URL:', supabaseUrl);

  // 1. Teste de chamada não autenticada a rpc_rh_retificar_intermitente
  // Esperado: Falha com código 42501 (AUTH_REQUIRED) ou erro de autorização/permissão, provando que a função existe
  const { data: data1, error: err1 } = await supabase.rpc('rpc_rh_retificar_intermitente', {
    p_lancamento_id: '00000000-0000-0000-0000-000000000000',
    p_nova_empresa_id: '00000000-0000-0000-0000-000000000000'
  });

  console.log('rpc_rh_retificar_intermitente (anon):', {
    data: data1,
    error: err1 ? { message: err1.message, code: err1.code, details: err1.details, hint: err1.hint } : null
  });

  // 2. Teste de chamada não autenticada a rpc_rh_revalidar_lote_devolvido
  const { data: data2, error: err2 } = await supabase.rpc('rpc_rh_revalidar_lote_devolvido', {
    p_lote_id: '00000000-0000-0000-0000-000000000000',
    p_justificativa: 'Teste de integridade somente leitura'
  });

  console.log('rpc_rh_revalidar_lote_devolvido (anon):', {
    data: data2,
    error: err2 ? { message: err2.message, code: err2.code, details: err2.details, hint: err2.hint } : null
  });

  // 3. Teste autenticado com usuário de teste
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  
  if (email && password) {
    const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr) {
      console.log('Aviso: Falha ao autenticar usuário de teste:', authErr.message);
    } else {
      console.log(`Autenticado como: ${authData.user.email} (ID: ${authData.user.id})`);
      
      // Chamada autenticada com ID inexistente para testar validação de negócio sem alterar dados
      const { data: dataAuth1, error: errAuth1 } = await supabase.rpc('rpc_rh_retificar_intermitente', {
        p_lancamento_id: '00000000-0000-0000-0000-000000000000',
        p_nova_empresa_id: '00000000-0000-0000-0000-000000000000'
      });
      console.log('rpc_rh_retificar_intermitente (autenticado):', {
        data: dataAuth1,
        error: errAuth1 ? { message: errAuth1.message, code: errAuth1.code, details: errAuth1.details } : null
      });

      const { data: dataAuth2, error: errAuth2 } = await supabase.rpc('rpc_rh_revalidar_lote_devolvido', {
        p_lote_id: '00000000-0000-0000-0000-000000000000',
        p_justificativa: 'Teste de acessibilidade RPC P0-02'
      });
      console.log('rpc_rh_revalidar_lote_devolvido (autenticado):', {
        data: dataAuth2,
        error: errAuth2 ? { message: errAuth2.message, code: errAuth2.code, details: errAuth2.details } : null
      });
    }
  }
}

checkP002RPCs().catch(console.error);

