import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function verifyLegacyDropped() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  // Tentar chamar com a ordem legada (p_banco_codigo primeiro)
  const { data, error } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
    p_banco_codigo: '341',
    p_nome_arquivo: 'TEST.RET',
    p_hash_arquivo: 'HASH',
    p_empresa_id: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
    p_conta_bancaria_id: 'faecb252-7b9e-407d-93a5-e10466d35b0e',
    p_itens: []
  });

  console.log('Ordem legada resultado:', { data, error });
}

verifyLegacyDropped();
