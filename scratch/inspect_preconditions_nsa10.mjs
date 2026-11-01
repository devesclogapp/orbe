import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function inspectPreconditions() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    process.exit(1);
  }

  console.log('Autenticado com sucesso como:', authData.user.email);

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';

  // 1. Remessa
  const { data: remessa, error: remessaErr } = await sb
    .from('lotes_remessa')
    .select('*')
    .eq('id', remessaId)
    .single();

  console.log('\n--- DADOS DA REMESSA ---');
  if (remessaErr) {
    console.error('Erro ao buscar remessa:', remessaErr);
  } else {
    console.log(JSON.stringify(remessa, null, 2));
  }

  if (!remessa) return;

  // 2. Empresa da remessa
  const { data: empresa, error: empErr } = await sb
    .from('empresas')
    .select('id, nome, razao_social, cnpj, is_teste, homologacao_ativa')
    .eq('id', remessa.empresa_id)
    .single();

  console.log('\n--- DADOS DA EMPRESA ---');
  console.log(empresa);

  // 3. Itens da remessa
  const { data: itensRemessa, error: itensErr } = await sb
    .from('lotes_remessa_itens')
    .select('*')
    .eq('remessa_id', remessaId)
    .order('numero_sequencial_registro', { ascending: true });

  console.log('\n--- ITENS DA REMESSA ---');
  console.log(JSON.stringify(itensRemessa, null, 2));

  // 4. Lote Operacional (intermitentes_lotes / diaristas_lotes)
  let loteOperacional = null;
  if (remessa.lote_id) {
    const { data: intermitenteLote } = await sb
      .from('intermitentes_lotes')
      .select('*')
      .eq('id', remessa.lote_id)
      .maybeSingle();
    
    if (intermitenteLote) {
      loteOperacional = { tipo: 'intermitentes', data: intermitenteLote };
      // Itens operacionais
      const { data: itensOp } = await sb
        .from('intermitentes_lote_itens')
        .select('*')
        .eq('lote_id', remessa.lote_id);
      loteOperacional.itens = itensOp;
    } else {
      const { data: diaristaLote } = await sb
        .from('diaristas_lotes')
        .select('*')
        .eq('id', remessa.lote_id)
        .maybeSingle();
      if (diaristaLote) {
        loteOperacional = { tipo: 'diaristas', data: diaristaLote };
      }
    }
  }

  console.log('\n--- LOTE OPERACIONAL ---');
  console.log(JSON.stringify(loteOperacional, null, 2));

  // 5. Espelho RH / Financeiro
  console.log('\n--- ESPELHO RH / FINANCEIRO ---');
  const { data: espelhosLote } = await sb
    .from('rh_financeiro_lotes')
    .select('*')
    .eq('empresa_id', remessa.empresa_id);
  console.log('rh_financeiro_lotes:', JSON.stringify(espelhosLote, null, 2));

  if (espelhosLote && espelhosLote.length > 0) {
    for (const esp of espelhosLote) {
      const { data: espItens } = await sb
        .from('rh_financeiro_lote_itens')
        .select('*')
        .eq('lote_id', esp.id);
      console.log(`Itens do espelho ${esp.id} (${esp.tipo_folha}):`, JSON.stringify(espItens, null, 2));
    }
  }

  // 6. Retornos existentes para a remessa ou empresa
  const { data: retornosRemessa } = await sb
    .from('cnab_retorno_arquivos')
    .select('*')
    .eq('empresa_id', remessa.empresa_id);

  console.log('\n--- RETORNOS REGISTRADOS PARA A EMPRESA ---');
  console.log(JSON.stringify(retornosRemessa, null, 2));

  // 7. Teste de existência da FIX-RET-03 na RPC rpc_aplicar_cnab_retorno
  console.log('\n--- TESTE DE DETECÇÃO DA RPC (FIX-RET-03) ---');
  // Chamada simulada com dados vazios para verificar mensagem de erro exata da FIX-RET-03
  const { data: rpcTest, error: rpcErr } = await sb.rpc('rpc_aplicar_cnab_retorno', {
    p_empresa_id: remessa.empresa_id,
    p_conta_bancaria_id: remessa.conta_bancaria_id,
    p_banco_codigo: '341',
    p_nome_arquivo: 'TESTE_PING.RET',
    p_hash_arquivo: 'TESTE_HASH_PING',
    p_itens: []
  });
  console.log('RPC Test result:', { data: rpcTest, error: rpcErr });

  // 8. Baseline de registros de produção
  const { count: prodLotesCount } = await sb
    .from('lotes_remessa')
    .select('*', { count: 'exact', head: true })
    .neq('modo', 'homologacao');

  const { count: prodRhCount } = await sb
    .from('rh_financeiro_lotes')
    .select('*', { count: 'exact', head: true })
    .neq('modo', 'homologacao');

  console.log('\n--- BASELINE PRODUÇÃO (CONTAGEM) ---');
  console.log({ prodLotesCount, prodRhCount });
}

inspectPreconditions();
