import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function validateHotfix() {
  console.log('=== VALIDAÇÃO REMOTA DO HOTFIX P0-02 (READ-ONLY / NÃO DESTRUTIVO) ===');
  console.log('Target:', supabaseUrl);

  // 1. Autenticar com usuário de teste autorizado
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha de autenticação:', authErr);
    process.exit(1);
  }
  console.log(`Autenticado com sucesso como ${authData.user.email} (UID: ${authData.user.id})`);

  // 2. Testar rpc_rh_retificar_intermitente com validação não-destrutiva
  console.log('\n--- Testando rpc_rh_retificar_intermitente ---');
  const { data: r1, error: e1 } = await supabase.rpc('rpc_rh_retificar_intermitente', {
    p_lancamento_id: '00000000-0000-0000-0000-000000000000',
    p_nova_empresa_id: '00000000-0000-0000-0000-000000000000',
    p_justificativa: null
  });

  console.log('Resultado rpc_rh_retificar_intermitente:', {
    data: r1,
    error: e1 ? { message: e1.message, code: e1.code, details: e1.details } : null
  });

  // 3. Testar rpc_rh_revalidar_lote_devolvido com ID inexistente
  console.log('\n--- Testando rpc_rh_revalidar_lote_devolvido ---');
  const { data: r2, error: e2 } = await supabase.rpc('rpc_rh_revalidar_lote_devolvido', {
    p_lote_id: '00000000-0000-0000-0000-000000000000',
    p_justificativa: 'Validação somente leitura do hotfix P0-02'
  });

  console.log('Resultado rpc_rh_revalidar_lote_devolvido:', {
    data: r2,
    error: e2 ? { message: e2.message, code: e2.code, details: e2.details } : null
  });

  // 4. Testar proteção de acesso anônimo (deve continuar retornando 42501 permission denied)
  console.log('\n--- Testando proteção pública / anon ---');
  const supabaseAnon = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { data: rAnon, error: eAnon } = await supabaseAnon.rpc('rpc_rh_retificar_intermitente', {
    p_lancamento_id: '00000000-0000-0000-0000-000000000000',
    p_nova_empresa_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Chamada anon rpc_rh_retificar_intermitente:', {
    error: eAnon ? { message: eAnon.message, code: eAnon.code } : null
  });

  return { e1, e2, eAnon };
}

validateHotfix().catch(console.error);

