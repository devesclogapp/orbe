import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';

async function verify() {
  console.log('=== VERIFICAÇÃO PÓS-MIGRATION LOTE 2 (SUPABASE OFICIAL - READ-ONLY) ===\n');

  // 1. TESTE ANON (Privilégios REVOGADOS)
  console.log('[1] Verificando REVOKE de EXECUTE para papel anon...');
  const sbAnon = createClient(supabaseUrl, supabaseAnonKey);
  const { data: dAnon1, error: eAnon1 } = await sbAnon.rpc('rpc_operacao_validar_aprovar', {
    p_operacao_id: '00000000-0000-0000-0000-000000000000',
    p_updated_at_frontend: new Date().toISOString()
  });
  console.log('rpc_operacao_validar_aprovar (anon):', { status: eAnon1?.code || 'OK', message: eAnon1?.message });

  const { data: dAnon2, error: eAnon2 } = await sbAnon.rpc('rpc_rh_aprovar_operacao', {
    p_operacao_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('rpc_rh_aprovar_operacao (anon):', { status: eAnon2?.code || 'OK', message: eAnon2?.message });

  // 2. TESTE AUTHENTICATED
  console.log('\n[2] Autenticando com usuário de homologação/E2E...');
  const sbAuth = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sbAuth.auth.signInWithPassword({
    email: 'e2e-test@orbe.local',
    password: '123456'
  });

  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    return;
  }
  console.log('Autenticado com sucesso. User ID:', authData.user.id);

  // 3. VERIFICAR INSTALAÇÃO DA NOVA DEFINIÇÃO DE rpc_rh_aprovar_operacao
  // Antes da migration: retornava { success: true } para UUID inexistente.
  // Nova migration: dispara OP_NOT_FOUND (ou AUTH / CROSS_TENANT)
  console.log('\n[3] Testando chamada de rpc_rh_aprovar_operacao com UUID inexistente...');
  const { data: dRhNotFound, error: eRhNotFound } = await sbAuth.rpc('rpc_rh_aprovar_operacao', {
    p_operacao_id: '00000000-0000-0000-0000-000000000000'
  });
  console.log('Resultado rpc_rh_aprovar_operacao:', { data: dRhNotFound, error: eRhNotFound?.message });

  // 4. VERIFICAR INSTALAÇÃO DA NOVA DEFINIÇÃO DE rpc_operacao_validar_aprovar
  console.log('\n[4] Testando chamada de rpc_operacao_validar_aprovar com UUID inexistente...');
  const { data: dOpNotFound, error: eOpNotFound } = await sbAuth.rpc('rpc_operacao_validar_aprovar', {
    p_operacao_id: '00000000-0000-0000-0000-000000000000',
    p_updated_at_frontend: new Date().toISOString()
  });
  console.log('Resultado rpc_operacao_validar_aprovar:', { data: dOpNotFound, error: eOpNotFound?.message });

  // 5. READ-ONLY: Conferência dos registros existentes em operacoes_producao e receitas
  console.log('\n[5] Conferência de preservação dos registros existentes (READ-ONLY)...');
  const { count: totalOps, error: errOps } = await sbAuth
    .from('operacoes_producao')
    .select('*', { count: 'exact', head: true });
  console.log('Total de operacoes_producao no banco oficial:', totalOps, errOps ? `(Erro: ${errOps.message})` : '');

  const { count: totalRec, error: errRec } = await sbAuth
    .from('receitas_operacionais')
    .select('*', { count: 'exact', head: true });
  console.log('Total de receitas_operacionais no banco oficial:', totalRec, errRec ? `(Erro: ${errRec.message})` : '');

  const { count: totalItens, error: errItens } = await sbAuth
    .from('receitas_operacionais_itens')
    .select('*', { count: 'exact', head: true });
  console.log('Total de receitas_operacionais_itens no banco oficial:', totalItens, errItens ? `(Erro: ${errItens.message})` : '');

  // Amostra de status das operações existentes
  const { data: sampleOps } = await sbAuth
    .from('operacoes_producao')
    .select('id, status, status_rh, status_pagamento, valor_total, entrada_ponto, saida_ponto')
    .order('criado_em', { ascending: false })
    .limit(5);
  console.log('\nAmostra das 5 últimas operações existentes (inalteradas):');
  console.log(sampleOps);
}

verify().catch(console.error);
