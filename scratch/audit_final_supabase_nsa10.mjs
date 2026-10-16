import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function auditSupabaseOfficial() {
  console.log('========================================================================');
  console.log('AUDITORIA FINAL PÓS-CONCILIAÇÃO MANUAL NSA 10 (LEITURA SUPABASE OFICIAL)');
  console.log('========================================================================\n');

  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('Falha de autenticação no Supabase Oficial:', authErr.message);
    process.exit(1);
  }

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';
  const loteRhId = 'c5533ad8-e622-408f-8032-697cd57c8016';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  // 1. Remessa NSA 10
  console.log('--- 1. REMESSA NSA 10 ---');
  const { data: remessa, error: remErr } = await sb
    .from('cnab_remessas_arquivos')
    .select('id, sequencial_arquivo, banco_codigo, status, modo, empresa_id, total_valor, total_registros, intermitentes_lote_id, created_at, updated_at')
    .eq('id', remessaId)
    .single();
  console.log('Remessa:', JSON.stringify(remessa, null, 2));

  // 2. Retorno persistido
  console.log('\n--- 2. ARQUIVO DE RETORNO PERSISTIDO ---');
  const { data: retornos, error: retErr } = await sb
    .from('cnab_retorno_arquivos')
    .select('id, remessa_arquivo_id, nome_arquivo, hash_arquivo, banco_codigo, modo, status, total_linhas, total_processados, total_sucesso, total_rejeitado, total_divergente, total_pendente, created_at')
    .eq('remessa_arquivo_id', remessaId);
  console.log('Retornos encontrados:', JSON.stringify(retornos, null, 2));

  const retornoId = retornos && retornos.length > 0 ? retornos[0].id : null;

  // 3. Itens da Remessa e Itens do Retorno
  console.log('\n--- 3. ITENS DA REMESSA E RETORNO ---');
  const { data: itensRemessa } = await sb
    .from('cnab_remessa_itens')
    .select('id, remessa_id, valor, status, origem_tipo, origem_id, updated_at')
    .eq('remessa_id', remessaId);
  console.log('Itens da Remessa:', JSON.stringify(itensRemessa, null, 2));

  let itensRetorno = [];
  if (retornoId) {
    const { data: ir } = await sb
      .from('cnab_retorno_itens')
      .select('id, retorno_arquivo_id, remessa_arquivo_id, remessa_item_id, valor_esperado, valor_retornado, codigo_ocorrencia, status, status_conciliacao, nome_favorecido, modo, created_at')
      .eq('retorno_arquivo_id', retornoId);
    itensRetorno = ir || [];
  }
  console.log('Itens do Retorno:', JSON.stringify(itensRetorno, null, 2));

  // 4. Lançamentos Intermitentes
  console.log('\n--- 4. LANÇAMENTOS INTERMITENTES ---');
  const lancIds = itensRemessa ? itensRemessa.map(i => i.origem_id) : [];
  const { data: lancamentos } = await sb
    .from('lancamentos_intermitentes')
    .select('id, colaborador_id, nome_colaborador, status_pipeline, total, competencia, lote_fechamento_id')
    .in('id', lancIds);
  console.log('Lançamentos:', JSON.stringify(lancamentos, null, 2));

  // 5. Lote Operacional Intermitentes
  console.log('\n--- 5. LOTE OPERACIONAL INTERMITENTES ---');
  const { data: loteOp } = await sb
    .from('intermitentes_lotes_fechamento')
    .select('id, competencia, empresa_id, status, valor_total, quantidade_registros, updated_at')
    .eq('id', loteOpId)
    .single();
  console.log('Lote Operacional:', JSON.stringify(loteOp, null, 2));

  // 6. Espelho RH/Financeiro e Itens
  console.log('\n--- 6. ESPELHO RH/FINANCEIRO E ITENS ---');
  const { data: loteRh } = await sb
    .from('rh_financeiro_lotes')
    .select('id, empresa_id, competencia, tipo, status, total_colaboradores, valor_total, updated_at')
    .eq('id', loteRhId)
    .single();
  console.log('Lote Espelho RH:', JSON.stringify(loteRh, null, 2));

  const { data: itensRh } = await sb
    .from('rh_financeiro_lote_itens')
    .select('id, lote_id, colaborador_id, nome_colaborador, valor_calculado, status, referencia_evento_id, origem_evento')
    .eq('lote_id', loteRhId);
  console.log('Itens do Espelho RH:', JSON.stringify(itensRh, null, 2));

  // 7. Auditoria Bancária
  console.log('\n--- 7. AUDITORIA BANCÁRIA ---');
  const { data: auditorias } = await sb
    .from('cnab_auditoria_bancaria')
    .select('id, arquivo_id, lote_id, acao, usuario_nome, detalhes, created_at')
    .eq('arquivo_id', remessaId)
    .order('created_at', { ascending: false });
  console.log('Registros de Auditoria para NSA 10:', JSON.stringify(auditorias, null, 2));

  // 8. Isolamento de Homologação / Empresa
  console.log('\n--- 8. ISOLAMENTO DE HOMOLOGAÇÃO ---');
  const { data: empresa } = await sb
    .from('empresas')
    .select('id, nome, is_teste, homologacao_ativa')
    .eq('id', empresaId)
    .single();
  console.log('Status da Empresa:', JSON.stringify(empresa, null, 2));

  // 9. Verificar se gerou movimentações reais em pagamentos ou DRE
  console.log('\n--- 9. VERIFICAÇÃO DE REGISTROS FINANCEIROS / DRE / PRODUÇÃO ---');
  
  // Buscar se há pagamentos na tabela geral de contas a pagar / transações financeiras para a remessa ou lançamentos
  const { data: pagamentosReais } = await sb
    .from('contas_pagar')
    .select('id, empresa_id, status, valor, descricao, created_at')
    .eq('empresa_id', empresaId)
    .gte('created_at', '2026-10-15T00:00:00.000Z');
  console.log('Contas a pagar para empresa de teste:', JSON.stringify(pagamentosReais, null, 2));

  // Verificar se há movimentações em lancamentos_dre ou transacoes_bancarias
  const { data: dreLanc } = await sb
    .from('dre_lancamentos')
    .select('id, empresa_id, valor, descricao, created_at')
    .eq('empresa_id', empresaId)
    .gte('created_at', '2026-10-15T00:00:00.000Z');
  console.log('Lançamentos DRE empresa de teste:', JSON.stringify(dreLanc, null, 2));

  // Verificar empresas de produção (não-teste) para garantir que nenhuma foi afetada hoje
  const { data: remessasProdAfetadas } = await sb
    .from('cnab_remessas_arquivos')
    .select('id, empresa_id, sequencial_arquivo, modo, status, updated_at')
    .neq('modo', 'homologacao')
    .gte('updated_at', '2026-10-16T17:00:00.000Z');
  console.log('Remessas de produção modificadas hoje:', JSON.stringify(remessasProdAfetadas, null, 2));
}

auditSupabaseOfficial().catch(err => {
  console.error('Erro na auditoria do Supabase:', err);
  process.exit(1);
});
