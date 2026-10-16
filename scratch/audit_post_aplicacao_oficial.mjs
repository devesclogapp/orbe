import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log('================================================================================');
  console.log('ERP ORBE — AUDITORIA PÓS-APLICAÇÃO OFICIAL FIX-RET-02C (READ-ONLY)');
  console.log('Ambiente: Supabase Oficial (lifgjtcflzmspilhryap)');
  console.log('================================================================================\n');

  // Autenticação
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha de autenticação no Supabase oficial:', authErr);
    process.exit(1);
  }
  console.log('✅ Autenticado como:', auth.user?.email, '| User ID:', auth.user?.id);

  // 1. ESTRUTURA INSTALADA EM cnab_retorno_arquivos E cnab_retorno_itens
  console.log('\n--- 1. ESTRUTURA INSTALADA E BACKFILL DE REGISTROS LEGADOS ---');
  const { data: retArquivos, error: errRetArq } = await supabase
    .from('cnab_retorno_arquivos')
    .select('id, nome_arquivo, modo, empresa_id, conta_bancaria_id, remessa_arquivo_id, status, created_at')
    .order('created_at', { ascending: false });

  if (errRetArq) {
    console.error('❌ Erro ao consultar cnab_retorno_arquivos:', errRetArq);
  } else {
    console.log(`✅ Colunas modo, empresa_id e conta_bancaria_id acessíveis em cnab_retorno_arquivos.`);
    console.log(`Total de registros históricos encontrados: ${retArquivos.length}`);
    console.table(retArquivos);
  }

  const { data: retItens, error: errRetItens } = await supabase
    .from('cnab_retorno_itens')
    .select('id, modo, status, remessa_item_id, created_at')
    .limit(10);

  if (errRetItens) {
    console.error('❌ Erro ao consultar cnab_retorno_itens:', errRetItens);
  } else {
    console.log(`✅ Coluna modo acessível em cnab_retorno_itens.`);
    console.log(`Amostra de itens (modo e status):`);
    console.table(retItens);
  }

  // 2. VERIFICAÇÃO DA EXISTÊNCIA E ASSINATURA DA RPC rpc_aplicar_cnab_retorno
  console.log('\n--- 2. VERIFICAÇÃO DA RPC rpc_aplicar_cnab_retorno ---');
  // Chamada de teste sonda sem processar nada (payload nulo para verificar fail-closed da nova RPC)
  const { data: rpcTest, error: rpcErr } = await supabase.rpc('rpc_aplicar_cnab_retorno', {
    p_empresa_id: '00000000-0000-0000-0000-000000000000',
    p_conta_bancaria_id: '00000000-0000-0000-0000-000000000000',
    p_banco_codigo: '341',
    p_nome_arquivo: 'PROBE_TEST.RET',
    p_hash_arquivo: 'hash_probe_check',
    p_itens: []
  });

  console.log('Resposta da sonda RPC (esperado Fail-Closed da nova RPC):');
  console.log('Data:', rpcTest);
  console.log('Mensagem de erro retornada pela RPC instalada:', rpcErr?.message);
  const rpcInstalada = rpcErr?.message?.includes('Falha de Integridade: O retorno bancário não possui itens') ||
                       rpcErr?.message?.includes('Falha de Segurança: Empresa') ||
                       rpcErr?.message?.includes('Apenas usuários com perfil');
  if (rpcInstalada) {
    console.log('✅ NOVA RPC FIX-RET-02C CONFIRMADA ATIVA NO SUPABASE OFICIAL!');
  } else {
    console.log('⚠️ Resposta inesperada da RPC:', rpcErr);
  }

  // 3. INTEGRIDADE DAS REMESSAS OFICIAIS NSA 8, 9 E 10
  console.log('\n--- 3. INTEGRIDADE DAS REMESSAS OFICIAIS (NSA 8, 9, 10) ---');
  const { data: remessas, error: remErr } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, sequencial_arquivo, nome_arquivo, hash_arquivo, status, modo, total_registros, total_valor, banco_codigo, banco_nome, created_at')
    .in('sequencial_arquivo', [8, 9, 10])
    .order('sequencial_arquivo', { ascending: true });

  if (remErr) {
    console.error('❌ Erro ao consultar remessas:', remErr);
  } else {
    console.table(remessas);
  }

  const { data: itensRemessa, error: itensRemErr } = await supabase
    .from('cnab_remessa_itens')
    .select('id, remessa_id, origem_tipo, origem_id, valor, status')
    .in('remessa_id', (remessas || []).map(r => r.id));

  if (itensRemErr) {
    console.error('❌ Erro ao consultar itens da remessa:', itensRemErr);
  } else {
    console.log(`Total de itens das remessas NSA 8, 9, 10: ${itensRemessa?.length}`);
    const nsa10 = (remessas || []).find(r => r.sequencial_arquivo === 10);
    const itensNsa10 = (itensRemessa || []).filter(i => i.remessa_id === nsa10?.id);
    console.log('\nItens específicos da Remessa NSA 10:');
    console.table(itensNsa10);
  }

  // 4. INTEGRIDADE FINANCEIRA E OPERACIONAL
  console.log('\n--- 4. INTEGRIDADE FINANCEIRA E OPERACIONAL ---');
  // Lote operacional de intermitentes
  const loteIdHml = '183c011a-53ea-41da-b76f-aea686362f38';
  const { data: loteOp, error: loteErr } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, competencia, status, valor_total, quantidade_registros')
    .eq('id', loteIdHml)
    .single();

  console.log('Lote Operacional Intermitentes:', loteOp, loteErr ? 'Erro: ' + loteErr.message : '');

  // Lançamentos do lote
  const { data: lancs, error: lancErr } = await supabase
    .from('lancamentos_intermitentes')
    .select('id, colaborador_id, total, status_pipeline, lote_fechamento_id')
    .eq('lote_fechamento_id', loteIdHml);

  console.log('Lançamentos do Lote:');
  console.table(lancs);

  // Lote RH/Financeiro
  const { data: rhLote, error: rhErr } = await supabase
    .from('rh_financeiro_lotes')
    .select('id, competencia, tipo, status, valor_total, total_colaboradores')
    .eq('competencia', '2026-11')
    .eq('tipo', 'INTERMITENTES');

  console.log('Lote RH/Financeiro:', rhLote, rhErr ? 'Erro: ' + rhErr.message : '');

  // 5. RASTREABILIDADE E AUDITORIA BANCÁRIA
  console.log('\n--- 5. AUDITORIA BANCÁRIA E AUSÊNCIA DE RETORNOS INESPERADOS ---');
  const { data: auditLogs, error: auditErr } = await supabase
    .from('cnab_auditoria_bancaria')
    .select('id, arquivo_id, lote_id, acao, usuario_id, detalhes, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (auditErr) {
    console.error('❌ Erro ao consultar cnab_auditoria_bancaria:', auditErr);
  } else {
    console.log(`Últimos registros de cnab_auditoria_bancaria:`);
    console.table(auditLogs);
  }
}

run().catch(console.error);
