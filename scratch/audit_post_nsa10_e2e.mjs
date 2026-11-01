import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

export async function auditPostNsa10() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha de autenticação:', authErr.message);
    process.exit(1);
  }

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';
  const loteRhId = 'c5533ad8-e622-408f-8032-697cd57c8016';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  console.log('=== AUDITORIA COMPLETA PÓS-CONCILIAÇÃO NSA 10 ===\n');

  // 1. Arquivo de Retorno
  const { data: retArqs } = await supabase
    .from('cnab_retorno_arquivos')
    .select('*')
    .eq('remessa_arquivo_id', remessaId);

  console.log('1. RETORNO ARQUIVOS (cnab_retorno_arquivos):', JSON.stringify(retArqs, null, 2));

  // 2. Itens do Retorno
  const { data: retItens } = await supabase
    .from('cnab_retorno_itens')
    .select('id, retorno_arquivo_id, remessa_arquivo_id, nome_favorecido, valor_esperado, valor_retornado, status, status_conciliacao, modo')
    .eq('remessa_arquivo_id', remessaId);

  console.log('\n2. ITENS DO RETORNO (cnab_retorno_itens):', JSON.stringify(retItens, null, 2));

  // 3. Remessa
  const { data: remessa } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, modo, status, sequencial_simulado, total_registros, total_valor, empresa_id')
    .eq('id', remessaId)
    .single();

  console.log('\n3. REMESSA (cnab_remessas_arquivos):', JSON.stringify(remessa, null, 2));

  // 4. Lote Operacional Intermitentes
  const { data: loteOp } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, status_conciliacao, quantidade_registros, valor_total, updated_at')
    .eq('id', loteOpId)
    .single();

  console.log('\n4. LOTE OPERACIONAL (intermitentes_lotes_fechamento):', JSON.stringify(loteOp, null, 2));

  // 5. Lançamentos Intermitentes
  const { data: lancs } = await supabase
    .from('lancamentos_intermitentes')
    .select('id, nome_colaborador, total, status_pipeline, updated_at')
    .eq('lote_fechamento_id', loteOpId);

  console.log('\n5. LANÇAMENTOS INTERMITENTES:', JSON.stringify(lancs, null, 2));

  // 6. Espelho RH / Financeiro
  const { data: loteRh } = await supabase
    .from('rh_financeiro_lotes')
    .select('id, status, tipo, total_colaboradores, valor_total, updated_at')
    .eq('id', loteRhId)
    .single();

  console.log('\n6. LOTE RH ESPELHO (rh_financeiro_lotes):', JSON.stringify(loteRh, null, 2));

  // 7. Itens do Espelho RH
  const { data: loteRhItens } = await supabase
    .from('rh_financeiro_lote_itens')
    .select('id, nome_colaborador, valor_calculado, status')
    .eq('lote_id', loteRhId);

  console.log('\n7. ITENS DO ESPELHO RH (rh_financeiro_lote_itens):', JSON.stringify(loteRhItens, null, 2));

  // 8. Auditoria de Não-Contaminação de Produção
  const { count: prodRemessasCount } = await supabase
    .from('cnab_remessas_arquivos')
    .select('*', { count: 'exact', head: true })
    .neq('modo', 'homologacao');

  const { count: prodRetornosCount } = await supabase
    .from('cnab_retorno_arquivos')
    .select('*', { count: 'exact', head: true })
    .neq('modo', 'homologacao');

  const { count: prodLotesRhCount } = await supabase
    .from('rh_financeiro_lotes')
    .select('*', { count: 'exact', head: true })
    .neq('empresa_id', empresaId);

  console.log('\n8. INTEGRIDADE DE PRODUÇÃO (ISOLAMENTO):', {
    prodRemessasCount,
    prodRetornosCount,
    prodLotesRhCount
  });
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  auditPostNsa10();
}
