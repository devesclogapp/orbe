import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

const TARGET = {
  tenantId: '09ccafb6-2cf2-4c83-ac3d-a2913947693c',
  empresaId: '28a560b5-37ef-403d-ae4f-b28a608b6a68',
  loteId: '371806e7-91e4-49ed-b6df-e7e0e5fcd68a',
  remessaId: '46391aad-6417-48cf-ac78-03a2a9dd8b22',
};

async function runReadOnlyAudit() {
  console.log('==============================================================================');
  console.log('AUDITORIA READ-ONLY SUPABASE OFICIAL — ETAPA 7D: REFLEXOS FINANCEIROS');
  console.log('==============================================================================\n');

  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });

  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    process.exit(1);
  }

  console.log('✓ Sessão autenticada com sucesso.');
  console.log('  Usuário:', authData.user.email);
  console.log('  UID:', authData.user.id);
  console.log('  Target Tenant:', TARGET.tenantId);
  console.log('  Target Empresa:', TARGET.empresaId);
  console.log('  Target Lote:', TARGET.loteId);
  console.log('  Target Remessa:', TARGET.remessaId, '\n');

  // 1. Estado da tabela diaristas_lotes_fechamento
  console.log('--- 1. DIARISTAS_LOTES_FECHAMENTO ---');
  const { data: loteData, error: loteErr } = await sb
    .from('diaristas_lotes_fechamento')
    .select('*')
    .eq('id', TARGET.loteId);

  if (loteErr) console.error('Erro lote:', loteErr.message);
  else console.log(JSON.stringify(loteData, null, 2));

  // 2. Estado de lancamentos_diaristas vinculados
  console.log('\n--- 2. LANCAMENTOS_DIARISTAS (ITENS DO LOTE) ---');
  const { data: lancsData, error: lancsErr } = await sb
    .from('lancamentos_diaristas')
    .select('id, diarista_id, data_lancamento, tipo_presenca, valor_calculado, status, status_pagamento, status_conciliacao, lote_fechamento_id')
    .eq('lote_fechamento_id', TARGET.loteId);

  if (lancsErr) console.error('Erro lancamentos:', lancsErr.message);
  else console.log(JSON.stringify(lancsData, null, 2));

  // 3. Estado de cnab_remessas_arquivos
  console.log('\n--- 3. CNAB_REMESSAS_ARQUIVOS ---');
  const { data: remData, error: remErr } = await sb
    .from('cnab_remessas_arquivos')
    .select('*')
    .eq('id', TARGET.remessaId);

  if (remErr) console.error('Erro remessa:', remErr.message);
  else console.log(JSON.stringify(remData, null, 2));

  // 4. Estado de cnab_remessa_itens
  console.log('\n--- 4. CNAB_REMESSA_ITENS ---');
  const { data: remItensData, error: remItensErr } = await sb
    .from('cnab_remessa_itens')
    .select('id, remessa_id, origem_tipo, origem_id, fatura_id, valor, status')
    .eq('remessa_id', TARGET.remessaId);

  if (remItensErr) console.error('Erro remessa_itens:', remItensErr.message);
  else console.log(JSON.stringify(remItensData, null, 2));

  // 5. Estado de cnab_retorno_arquivos vinculados a essa remessa
  console.log('\n--- 5. CNAB_RETORNO_ARQUIVOS ---');
  const { data: retArqsData, error: retArqsErr } = await sb
    .from('cnab_retorno_arquivos')
    .select('*')
    .eq('remessa_arquivo_id', TARGET.remessaId);

  if (retArqsErr) console.error('Erro retorno_arquivos:', retArqsErr.message);
  else console.log(JSON.stringify(retArqsData, null, 2));

  // 6. Estado de cnab_retorno_itens
  console.log('\n--- 6. CNAB_RETORNO_ITENS ---');
  const { data: retItensData, error: retItensErr } = await sb
    .from('cnab_retorno_itens')
    .select('id, retorno_arquivo_id, remessa_arquivo_id, remessa_item_id, diaristas_lote_id, fatura_id, colaborador_id, valor_esperado, valor_retornado, status, status_conciliacao')
    .eq('remessa_arquivo_id', TARGET.remessaId);

  if (retItensErr) console.error('Erro retorno_itens:', retItensErr.message);
  else console.log(JSON.stringify(retItensData, null, 2));

  // 7. Faturas / Contas a Pagar: verificar se existem faturas geradas para esse lote ou lançamentos
  console.log('\n--- 7. FATURAS / CONTAS A PAGAR VINCULADAS ---');
  const { data: faturasLote, error: fatLoteErr } = await sb
    .from('faturas')
    .select('*')
    .or(`lote_remessa_id.eq.${TARGET.loteId},empresa_id.eq.${TARGET.empresaId}`);

  if (fatLoteErr) console.error('Erro faturas:', fatLoteErr.message);
  else {
    console.log(`Total faturas na empresa de teste: ${faturasLote?.length || 0}`);
    console.log(JSON.stringify(faturasLote, null, 2));
  }

  // 8. lotes_remessa: verificar se foi criado lote redundante na tabela legada de lotes de remessa
  console.log('\n--- 8. LOTES_REMESSA (TABELA LEGADA) ---');
  const { data: lotesRemessa, error: lotesRemErr } = await sb
    .from('lotes_remessa')
    .select('*')
    .eq('empresa_id', TARGET.empresaId);

  if (lotesRemErr) console.error('Erro lotes_remessa:', lotesRemErr.message);
  else {
    console.log(`Total lotes_remessa na empresa de teste: ${lotesRemessa?.length || 0}`);
    console.log(JSON.stringify(lotesRemessa, null, 2));
  }

  // 9. cnab_auditoria_bancaria: trilha de auditoria
  console.log('\n--- 9. CNAB_AUDITORIA_BANCARIA ---');
  const { data: auditData, error: auditErr } = await sb
    .from('cnab_auditoria_bancaria')
    .select('*')
    .eq('empresa_id', TARGET.empresaId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (auditErr) console.error('Erro auditoria:', auditErr.message);
  else {
    console.log(`Total eventos de auditoria obtidos: ${auditData?.length || 0}`);
    console.log(JSON.stringify(auditData, null, 2));
  }

  // 10. Intermitentes lotes fechamento (schema real)
  console.log('\n--- 10. INTERMITENTES_LOTES_FECHAMENTO ---');
  const { data: intLotes, error: intErr } = await sb
    .from('intermitentes_lotes_fechamento')
    .select('id, status, competencia, empresa_id')
    .eq('empresa_id', TARGET.empresaId);

  if (intErr) console.error('Erro intermitentes lotes:', intErr.message);
  else console.log(JSON.stringify(intLotes, null, 2));

  console.log('\n==============================================================================');
  console.log('FIM DA AUDITORIA READ-ONLY');
  console.log('==============================================================================');
}

runReadOnlyAudit().catch(err => {
  console.error('Erro não tratado na auditoria:', err);
  process.exit(1);
});
