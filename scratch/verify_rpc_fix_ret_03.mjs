import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function verifyFixRet03Installed() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    process.exit(1);
  }

  console.log('Autenticado como:', authData.user.email);

  // Testar chamada à RPC rpc_aplicar_cnab_retorno
  // Se a FIX-RET-03 estiver instalada, a ordem dos parâmetros é:
  // p_empresa_id, p_conta_bancaria_id, p_banco_codigo, p_nome_arquivo, p_hash_arquivo, p_itens
  // E com p_itens: [] vazio, o retorno da FIX-RET-03 é:
  // total_processados: 0, total_pagos: 0, total_rejeitados: 0, total_divergentes: 0
  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';
  const contaId = 'faecb252-7b9e-407d-93a5-e10466d35b0e';

  const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
    p_empresa_id: empresaId,
    p_conta_bancaria_id: contaId,
    p_banco_codigo: '341',
    p_nome_arquivo: 'VERIFY_FIX_RET_03.RET',
    p_hash_arquivo: 'verify_hash_dummy_' + Date.now(),
    p_itens: []
  });

  console.log('Resultado da chamada RPC:', { data: rpcRes, error: rpcErr });

  if (rpcErr) {
    console.error('ERRO NA RPC:', rpcErr);
  } else {
    console.log('A RPC rpc_aplicar_cnab_retorno respondeu com sucesso:');
    console.log(JSON.stringify(rpcRes, null, 2));
  }
}

verifyFixRet03Installed();
