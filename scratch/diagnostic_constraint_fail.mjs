import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function runDiagnostic() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha auth:', authErr.message);
    process.exit(1);
  }

  console.log('=== DIAGNÓSTICO SOMENTE-LEITURA NO SUPABASE OFICIAL ===\n');

  const remessaId = '38107d57-4069-434e-aed3-8501fe606272';
  const loteOpId = '183c011a-53ea-41da-b76f-aea686362f38';
  const loteRhId = 'c5533ad8-e622-408f-8032-697cd57c8016';
  const empresaId = '28a560b5-37ef-403d-ae4f-b28a608b6a68';

  // 1. Confirmar estado de cnab_retorno_arquivos para a remessa
  const { data: retArqs } = await supabase
    .from('cnab_retorno_arquivos')
    .select('*')
    .eq('remessa_arquivo_id', remessaId);
  console.log('1. cnab_retorno_arquivos para a remessa NSA 10:', retArqs);

  // 2. Confirmar estado de cnab_retorno_itens
  const { data: retItens } = await supabase
    .from('cnab_retorno_itens')
    .select('*')
    .eq('remessa_arquivo_id', remessaId);
  console.log('2. cnab_retorno_itens para a remessa NSA 10:', retItens);

  // 3. Confirmar se a remessa mudou de status
  const { data: remessa } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, status, modo, sequencial_simulado, updated_at')
    .eq('id', remessaId)
    .single();
  console.log('3. cnab_remessas_arquivos status atual:', remessa);

  // 4. Confirmar se lote operacional mudou de status
  const { data: loteOp } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('id, status, status_conciliacao, updated_at')
    .eq('id', loteOpId)
    .single();
  console.log('4. intermitentes_lotes_fechamento status atual:', loteOp);

  // 5. Confirmar se lançamentos intermitentes mudaram de status
  const { data: lancs } = await supabase
    .from('lancamentos_intermitentes')
    .select('id, nome_colaborador, status_pipeline, updated_at')
    .eq('lote_fechamento_id', loteOpId);
  console.log('5. lancamentos_intermitentes status atual:', lancs);

  // 6. Confirmar se lote espelho RH mudou de status
  const { data: loteRh } = await supabase
    .from('rh_financeiro_lotes')
    .select('id, status, updated_at')
    .eq('id', loteRhId)
    .single();
  console.log('6. rh_financeiro_lotes status atual:', loteRh);

  // 7. Confirmar se itens do espelho RH mudaram de status
  const { data: loteRhItens } = await supabase
    .from('rh_financeiro_lote_itens')
    .select('id, nome_colaborador, status')
    .eq('lote_id', loteRhId);
  console.log('7. rh_financeiro_lote_itens status atual:', loteRhItens);

  // 8. Inspecionar valores distintos já presentes em cnab_auditoria_bancaria.acao
  const { data: acoesAudit } = await supabase
    .from('cnab_auditoria_bancaria')
    .select('acao');
  
  const acoesDistintas = [...new Set((acoesAudit || []).map(a => a.acao))];
  console.log('8. Ações já registradas historicamente em cnab_auditoria_bancaria:', acoesDistintas);
}

runDiagnostic();
