import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://lifgjtcflzmspilhryap.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpZmdqdGNmbHptc3BpbGhyeWFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1MzkzODYsImV4cCI6MjA5MjExNTM4Nn0.JCbw4w_Hjz5uDpEm0QhP92-hNt5ACK5jhhkr85N8gYs';
const testEmail = 'e2e-test@orbe.local';
const testPassword = '123456';

async function checkState() {
  const sb = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await sb.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });

  if (authErr) {
    console.error('Falha auth:', authErr.message);
    return;
  }

  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  console.log('=== VERIFICAÇÃO READ-ONLY DO ESTADO DO BANCO OFICIAL ===');

  // 1. Contas bancarias
  const { data: contas } = await sb
    .from('contas_bancarias_empresa')
    .select('id, banco_codigo, banco_nome, agencia, conta, ativo, permite_cnab')
    .eq('empresa_id', empresaId);
  console.log('\n--- CONTAS BANCÁRIAS DA EMPRESA ---');
  console.log(contas);

  // 2. Sequencial controle
  const { data: seqs } = await sb
    .from('cnab_sequencial_controle')
    .select('*');
  console.log('\n--- CNAB SEQUENCIAL CONTROLE ---');
  console.log(seqs);

  // 3. Lote CLT-2026-07 em rh_financeiro_lotes
  const { data: rhLotes } = await sb
    .from('rh_financeiro_lotes')
    .select('*')
    .eq('empresa_id', empresaId);
  console.log('\n--- RH FINANCEIRO LOTES ---');
  console.log(rhLotes);

  // 4. Itens do lote CLT
  if (rhLotes && rhLotes.length > 0) {
    for (const l of rhLotes) {
      const { data: itens } = await sb
        .from('rh_financeiro_lote_itens')
        .select('id, lote_id, nome_colaborador, valor_calculado, status, colaborador_id')
        .eq('lote_id', l.id);
      console.log(`\n--- ITENS DO LOTE ${l.id} (${l.competencia}) ---`);
      console.log(itens);
    }
  }

  // 5. lotes_remessa
  const { data: lotesRemessa } = await sb
    .from('lotes_remessa')
    .select('*')
    .eq('empresa_id', empresaId);
  console.log('\n--- LOTES REMESSA ---');
  console.log(lotesRemessa);

  // 6. cnab_remessas_arquivos
  const { data: remessas } = await sb
    .from('cnab_remessas_arquivos')
    .select('*')
    .eq('empresa_id', empresaId);
  console.log('\n--- CNAB REMESSAS ARQUIVOS (EMPRESA HML) ---');
  console.log(remessas);

  // 7. cnab_remessa_itens
  const { data: remItens } = await sb
    .from('cnab_remessa_itens')
    .select('*')
    .eq('empresa_id', empresaId);
  console.log('\n--- CNAB REMESSA ITENS (EMPRESA HML) ---');
  console.log(remItens);
}

checkState().catch(console.error);
