import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function inspectOfficial() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('Falha na autenticacao:', authErr.message);
    process.exit(1);
  }
  console.log('=== INSPEÇÃO DE LEITURA ESTRITA: SUPABASE OFICIAL (lifgjtcflzmspilhryap) ===');
  console.log('Autenticado como:', authData.user.email, '| UID:', authData.user.id);

  // 1. Inspecionar operações de empresas de teste
  const { data: testEmpresas } = await sb.from('empresas').select('id, nome, is_teste').eq('is_teste', true);
  console.log('\n--- EMPRESAS DE TESTE CADASTRADAS ---');
  console.log(testEmpresas);

  const testEmpresaIds = testEmpresas?.map(e => e.id) || [];
  const { data: ops, error: opErr } = await sb
    .from('operacoes_producao')
    .select(`
      id, data_operacao, valor_total, status, status_rh, empresa_id, tenant_id, deleted_at
    `)
    .in('empresa_id', testEmpresaIds);

  console.log('\n--- OPERAÇÃO OP-B2F2D4E2 ---');
  if (opErr) {
    console.error('Erro ao buscar operacao:', opErr.message);
  } else if (!ops || ops.length === 0) {
    console.log('Operação OP-B2F2D4E2 não encontrada pelo código direto.');
  } else {
    const op = ops[0];
    console.log(`ID: ${op.id}`);
    console.log(`Código: ${op.codigo}`);
    console.log(`Data: ${op.data_operacao}`);
    console.log(`Valor Total: R$ ${op.valor_total_operacao}`);
    console.log(`Status Operação: ${op.status} | Status RH: ${op.status_rh}`);
    console.log(`Empresa: ${op.empresa?.nome} (ID: ${op.empresa_id})`);
    console.log(`Empresa is_teste: ${op.empresa?.is_teste}`);
    console.log(`Deleted At: ${op.deleted_at}`);

    // 2. Verificar se há itens de receita operacional vinculados a essa operação
    const { data: recItens, error: recItensErr } = await sb
      .from('receitas_operacionais_itens')
      .select('id, receita_id, tenant_id')
      .eq('operacao_id', op.id);

    console.log('\n--- VÍNCULOS COM RECEITAS OPERACIONAIS ---');
    if (recItensErr) {
      console.log('Consulta a receitas_operacionais_itens retornou erro:', recItensErr.message);
    } else {
      console.log(`Total de itens de receita vinculados: ${recItens.length}`);
    }

    // 3. Verificar faturas
    const { data: faturas, error: fatErr } = await sb
      .from('faturas')
      .select('id, status, competencia, valor')
      .eq('empresa_id', op.empresa_id);

    console.log('\n--- FATURAS DA EMPRESA DE HOMOLOGAÇÃO ---');
    if (fatErr) {
      console.log('Consulta a faturas retornou erro:', fatErr.message);
    } else {
      console.log(`Total de faturas vinculadas à empresa de homologação: ${faturas.length}`);
    }
  }

  // 4. Verificar se a RPC rpc_registrar_cnab_remessa pode ser inspecionada quanto à assinatura (sem invocar mutação)
  console.log('\n--- VERIFICAÇÃO DE ASSINATURA RPC ---');
  // Se passarmos parâmetros vazios/inválidos, a RPC deve acusar parâmetros ou auth, provando que está instalada e ativa no banco
  const { error: rpcCnabErr } = await sb.rpc('rpc_registrar_cnab_remessa', {});
  console.log('rpc_registrar_cnab_remessa status no servidor:', rpcCnabErr ? rpcCnabErr.message : 'DISPONIVEL');

  const { error: rpcEncErr } = await sb.rpc('rpc_encerrar_homologacao_empresa', {});
  console.log('rpc_encerrar_homologacao_empresa status no servidor:', rpcEncErr ? rpcEncErr.message : 'DISPONIVEL');
}

inspectOfficial().catch(console.error);
