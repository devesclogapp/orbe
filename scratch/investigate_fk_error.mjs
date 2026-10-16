import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function investigateFkError() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha auth:', authErr.message);
    process.exit(1);
  }

  console.log('=== INVESTIGAÇÃO DA FK cnab_auditoria_bancaria_lote_id_fkey ===\n');

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';

  // 1. Dados da Remessa NSA 10
  const { data: remessa } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, intermitentes_lote_id, diaristas_lote_id, lote_id, modo, status, updated_at')
    .eq('id', remessaId)
    .single();
  console.log('1. Remessa NSA 10 campos de lotes:', remessa);

  // 2. Verificar se loteOpId existe na tabela lotes_remessa
  const { data: emLotesRemessa, error: errLotesRemessa } = await supabase
    .from('lotes_remessa')
    .select('id')
    .eq('id', loteOpId);
  console.log('2. Busca de loteOpId em lotes_remessa:', { emLotesRemessa, errLotesRemessa });

  // 3. Confirmar rollback integral no banco
  const { data: retArqs } = await supabase
    .from('cnab_retorno_arquivos')
    .select('id')
    .eq('remessa_arquivo_id', remessaId);
  console.log('3. cnab_retorno_arquivos vinculados à NSA 10:', retArqs);

  const { data: retItens } = await supabase
    .from('cnab_retorno_itens')
    .select('id')
    .eq('remessa_arquivo_id', remessaId);
  console.log('4. cnab_retorno_itens vinculados à NSA 10:', retItens);

  const { data: loteOp } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, updated_at')
    .eq('id', loteOpId)
    .single();
  console.log('5. intermitentes_lotes_fechamento status:', loteOp);

  const { data: loteRh } = await supabase
    .from('rh_financeiro_lotes')
    .select('id, status, updated_at')
    .eq('id', 'c5533ad8-e622-408f-8032-697cd57c8016')
    .single();
  console.log('6. rh_financeiro_lotes status:', loteRh);

  // 4. Teste de INSERT com lote_id = loteOpId (deve violar cnab_auditoria_bancaria_lote_id_fkey)
  const { data: testFk, error: errFk } = await supabase
    .from('cnab_auditoria_bancaria')
    .insert({
      arquivo_id: remessaId,
      lote_id: loteOpId, // esse é ID de intermitentes_lotes_fechamento!
      acao: 'processamento_retorno',
      detalhes: { teste: true }
    });
  console.log('7. Teste de INSERT com lote_id = loteOpId (erro esperado de FK):', errFk?.message, errFk?.code);
}

investigateFkError();
