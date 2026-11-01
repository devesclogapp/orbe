import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lifgjtcflzmspilhryap.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'e2e-test@orbe.local';
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || '123456';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function investigateDivergence() {
  console.log('=== INVESTIGAÇÃO DE DIVERGÊNCIA DE ITENS NSA 11 ===\n');

  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (authErr) {
    console.error('Erro de autenticação:', authErr);
    return;
  }
  console.log('Autenticado como:', authData.user?.email);

  const targetLoteId = '371806e7-91e4-49ed-b6df-e7e0e5fcd68a';
  const targetRemessaId = '46391aad-6417-48cf-ac78-03a2a9dd8b22';

  // 1. Remessa Oficial 46391aad...
  console.log('\n--- 1. cnab_remessas_arquivos (por ID) ---');
  const { data: remessaExata, error: errRemExata } = await supabase
    .from('cnab_remessas_arquivos')
    .select('*')
    .eq('id', targetRemessaId);
  console.log('Remessa 46391aad:', JSON.stringify(remessaExata, null, 2));

  // 1b. Todas as remessas vinculadas ao lote
  console.log('\n--- 1b. cnab_remessas_arquivos (por diaristas_lote_id) ---');
  const { data: remessasLote, error: errRemLote } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, sequencial_arquivo, nome_arquivo, hash_arquivo, total_valor, total_registros, diaristas_lote_id, status, created_at, updated_at')
    .eq('diaristas_lote_id', targetLoteId);
  console.log('Remessas do lote:', JSON.stringify(remessasLote, null, 2));

  // 2. Itens vinculados à remessa 46391aad...
  console.log('\n--- 2. cnab_remessa_itens (por remessa_id) ---');
  const { data: itensRemessa, error: errItensRem } = await supabase
    .from('cnab_remessa_itens')
    .select('*')
    .eq('remessa_id', targetRemessaId);
  console.log('Itens da remessa 46391aad:', JSON.stringify(itensRemessa, null, 2));

  // 3. Procurar em cnab_remessa_itens itens com valores 140 ou 70, ou origem_tipo = 'DIARISTA'
  console.log('\n--- 3. Busca histórica em cnab_remessa_itens (valores 140, 70 ou origem_tipo DIARISTA) ---');
  const { data: itens140, error: errItens140 } = await supabase
    .from('cnab_remessa_itens')
    .select('id, remessa_id, origem_tipo, origem_id, valor, status, created_at')
    .in('valor', [140, 70, 140.00, 70.00]);
  console.log('Itens com valor 140 ou 70:', JSON.stringify(itens140, null, 2));

  const { data: itensTipoDiarista, error: errTipo } = await supabase
    .from('cnab_remessa_itens')
    .select('id, remessa_id, origem_tipo, origem_id, valor, status, created_at')
    .eq('origem_tipo', 'DIARISTA');
  console.log('Itens com origem_tipo = DIARISTA (singular):', JSON.stringify(itensTipoDiarista, null, 2));

  // 4. Lançamentos Diaristas vinculados ao lote
  console.log('\n--- 4. lancamentos_diaristas vinculados ao lote ---');
  const { data: lancsLote, error: errLancs } = await supabase
    .from('lancamentos_diaristas')
    .select('*')
    .eq('lote_fechamento_id', targetLoteId);
  console.log('Lançamentos do lote:', JSON.stringify(lancsLote, null, 2));

  // 5. Outros lançamentos de diaristas em geral (valores 140 ou 70)
  console.log('\n--- 5. Outros lançamentos em lancamentos_diaristas com valores 140 ou 70 ---');
  const { data: lancsOutros, error: errLancsOutros } = await supabase
    .from('lancamentos_diaristas')
    .select('id, lote_fechamento_id, diarista_id, valor_calculado, status, data_lancamento, created_at')
    .in('valor_calculado', [140, 70, 140.00, 70.00]);
  console.log('Lançamentos com 140 ou 70:', JSON.stringify(lancsOutros, null, 2));

  // 6. Todos os lotes de fechamento de diaristas
  console.log('\n--- 6. diaristas_lotes_fechamento (todos) ---');
  const { data: todosLotes, error: errTodosLotes } = await supabase
    .from('diaristas_lotes_fechamento')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Lotes de diaristas existentes:', JSON.stringify(todosLotes, null, 2));

  // 7. Todas as remessas em cnab_remessas_arquivos com sequencial_arquivo = 11 ou recente
  console.log('\n--- 7. cnab_remessas_arquivos (NSA 11 ou recentes) ---');
  const { data: remessasNsa11, error: errNsa11 } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, sequencial_arquivo, nome_arquivo, hash_arquivo, total_valor, total_registros, diaristas_lote_id, status, created_at')
    .eq('sequencial_arquivo', 11);
  console.log('Remessas com NSA 11:', JSON.stringify(remessasNsa11, null, 2));

  // 8. Histórico em cnab_auditoria_bancaria
  console.log('\n--- 8. cnab_auditoria_bancaria recente ---');
  const { data: audit, error: errAudit } = await supabase
    .from('cnab_auditoria_bancaria')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log('Auditoria bancária recente:', JSON.stringify(audit, null, 2));
}

investigateDivergence().catch(console.error);
