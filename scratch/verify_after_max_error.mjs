import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function verifyStateAfterMaxError() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha auth:', authErr.message);
    process.exit(1);
  }

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';
  const loteRhId = 'c5533ad8-e622-408f-8032-697cd57c8016';

  console.log('=== VERIFICAÇÃO SOMENTE-LEITURA APÓS 3ª TENTATIVA (ERRO max(uuid)) ===\n');

  // 1. Retorno Arquivo
  const { data: retArqs } = await supabase
    .from('cnab_retorno_arquivos')
    .select('id, nome_arquivo, status, created_at')
    .eq('remessa_arquivo_id', remessaId);
  console.log('1. cnab_retorno_arquivos:', retArqs);

  // 2. Retorno Itens
  const { data: retItens } = await supabase
    .from('cnab_retorno_itens')
    .select('id, status, status_conciliacao')
    .eq('remessa_arquivo_id', remessaId);
  console.log('2. cnab_retorno_itens:', retItens);

  // 3. Remessa NSA 10
  const { data: remessa } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, status, modo, updated_at')
    .eq('id', remessaId)
    .single();
  console.log('3. cnab_remessas_arquivos:', remessa);

  // 4. Lote Operacional Intermitentes
  const { data: loteOp } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, updated_at')
    .eq('id', loteOpId)
    .single();
  console.log('4. intermitentes_lotes_fechamento:', loteOp);

  // 5. Lançamentos Intermitentes
  const { data: lancs } = await supabase
    .from('lancamentos_intermitentes')
    .select('id, nome_colaborador, status_pipeline, updated_at')
    .eq('lote_fechamento_id', loteOpId);
  console.log('5. lancamentos_intermitentes:', lancs);

  // 6. Espelho RH/Financeiro
  const { data: loteRh } = await supabase
    .from('rh_financeiro_lotes')
    .select('id, status, updated_at')
    .eq('id', loteRhId)
    .single();
  console.log('6. rh_financeiro_lotes:', loteRh);

  // 7. Itens Espelho RH
  const { data: loteRhItens } = await supabase
    .from('rh_financeiro_lote_itens')
    .select('id, nome_colaborador, status')
    .eq('lote_id', loteRhId);
  console.log('7. rh_financeiro_lote_itens:', loteRhItens);
}

verifyStateAfterMaxError();
