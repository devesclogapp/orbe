import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runAudit() {
  console.log('=== AUDITORIA READ-ONLY SUPABASE OFICIAL — FIX-CNAB-04 ===\n');
  const auth = await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  if (auth.error) {
    console.error('Falha de autenticação no Supabase oficial:', auth.error);
    return;
  }
  console.log('Autenticado com sucesso no Supabase oficial como:', auth.data.user?.email);

  // 1. Inspecionar cnab_remessas_arquivos
  console.log('\n--- 1. Registros em cnab_remessas_arquivos ---');
  const { data: remessas, error: errRemessas } = await supabase
    .from('cnab_remessas_arquivos')
    .select('*')
    .order('data_geracao', { ascending: false });

  if (errRemessas) {
    console.error('Erro ao consultar cnab_remessas_arquivos:', errRemessas);
  } else {
    console.log(`Total de remessas encontradas: ${remessas.length}`);
    if (remessas.length > 0) {
      console.log('Colunas disponíveis em cnab_remessas_arquivos:');
      console.log(Object.keys(remessas[0]));
      console.log('\nÚltimas remessas (resumo):');
      console.table(remessas.slice(0, 10).map(r => ({
        id: r.id,
        sequencial: r.sequencial_arquivo,
        nome_arquivo: r.nome_arquivo,
        status: r.status,
        modo: r.modo,
        total_valor: r.total_valor,
        total_registros: r.total_registros,
        lote_id: r.lote_id,
        intermitentes_lote_id: r.intermitentes_lote_id ?? '(não existe/null)',
        diaristas_lote_id: r.diaristas_lote_id ?? '(não existe/null)',
        conteudo_presente: !!r.conteudo_arquivo
      })));
    }
  }

  // 2. Inspecionar NSA 8 (CLT) e NSA 9 (Intermitentes)
  console.log('\n--- 2. Detalhes de NSA 8 e NSA 9 ---');
  const remessas8e9 = (remessas || []).filter(r => r.sequencial_arquivo === 8 || r.sequencial_arquivo === 9);
  console.table(remessas8e9.map(r => ({
    id: r.id,
    sequencial: r.sequencial_arquivo,
    nome: r.nome_arquivo,
    status: r.status,
    modo: r.modo,
    empresa_id: r.empresa_id,
    lote_id: r.lote_id,
    intermitentes_lote_id: r.intermitentes_lote_id ?? '(null)',
    diaristas_lote_id: r.diaristas_lote_id ?? '(null)',
    valor: r.total_valor,
    registros: r.total_registros,
    data_geracao: r.data_geracao
  })));

  // 3. Inspecionar cnab_remessa_itens para NSA 8 e NSA 9
  console.log('\n--- 3. Itens em cnab_remessa_itens para NSA 8 e NSA 9 ---');
  for (const rem of remessas8e9) {
    const { data: itens, error: errItens } = await supabase
      .from('cnab_remessa_itens')
      .select('*')
      .eq('remessa_id', rem.id);

    if (errItens) {
      console.error(`Erro ao consultar itens da remessa ${rem.sequencial_arquivo}:`, errItens);
    } else {
      console.log(`Remessa NSA ${rem.sequencial_arquivo} (${rem.id}): ${itens.length} itens`);
      console.table(itens.map(it => ({
        id: it.id,
        origem_tipo: it.origem_tipo,
        origem_id: it.origem_id,
        valor: it.valor,
        status: it.status,
        numero_sequencial_lote: it.numero_sequencial_lote
      })));
    }
  }

  // 4. Inspecionar cnab_sequencial_controle
  console.log('\n--- 4. cnab_sequencial_controle ---');
  const { data: seqs, error: errSeq } = await supabase
    .from('cnab_sequencial_controle')
    .select('*');

  if (errSeq) {
    console.error('Erro ao consultar cnab_sequencial_controle:', errSeq);
  } else {
    console.table(seqs);
  }

  // 5. Inspecionar Lote INT-2026-07 em intermitentes_lotes_fechamento
  console.log('\n--- 5. Lote INT-2026-07 em intermitentes_lotes_fechamento ---');
  const { data: lotesInt, error: errLoteInt } = await supabase
    .from('intermitentes_lotes_fechamento')
    .select('*')
    .eq('id', '67b0d4c0-7878-43ab-8cd2-06d67f58909f');

  if (errLoteInt) {
    console.error('Erro ao consultar intermitentes_lotes_fechamento:', errLoteInt);
  } else {
    console.table(lotesInt);
  }

  // 6. Inspecionar lançamentos do lote INT-2026-07
  console.log('\n--- 6. Lançamentos intermitentes vinculados a INT-2026-07 ---');
  const { data: lancsInt, error: errLancs } = await supabase
    .from('lancamentos_intermitentes')
    .select('*')
    .eq('lote_fechamento_id', '67b0d4c0-7878-43ab-8cd2-06d67f58909f');

  if (errLancs) {
    console.error('Erro ao consultar lancamentos_intermitentes:', errLancs);
  } else {
    console.table(lancsInt?.map(l => ({
      id: l.id,
      colaborador_id: l.colaborador_id,
      valor_total: l.valor_total,
      status_pipeline: l.status_pipeline,
      data_inicio: l.data_inicio,
      data_fim: l.data_fim
    })));
  }

  // 7. Inspecionar lotes de diaristas fechados / gerados
  console.log('\n--- 7. Lotes de diaristas (amostra de status) ---');
  const { data: lotesDia, error: errLoteDia } = await supabase
    .from('diaristas_lotes_fechamento')
    .select('*')
    .limit(5);

  if (errLoteDia) {
    console.error('Erro ao consultar diaristas_lotes_fechamento:', errLoteDia);
  } else {
    if (lotesDia.length > 0) {
      console.log('Colunas de diaristas_lotes_fechamento:', Object.keys(lotesDia[0]));
      console.table(lotesDia.map(l => ({
        id: l.id,
        empresa_id: l.empresa_id,
        status: l.status,
        status_conciliacao: l.status_conciliacao
      })));
    }
  }

  // 8. Checar se existem duplicidades em remessas ativas para lote_id
  console.log('\n--- 8. Verificação de Lotes CLT em cnab_remessas_arquivos ---');
  const lotesCLT = (remessas || []).filter(r => r.lote_id && !['cancelado', 'erro'].includes(r.status));
  const counts = {};
  for (const r of lotesCLT) {
    const key = `${r.tenant_id}_${r.lote_id}`;
    counts[key] = (counts[key] || 0) + 1;
  }
  const dups = Object.entries(counts).filter(([_, count]) => count > 1);
  console.log('Duplicidades encontradas em lote_id CLT ativos:', dups);

  // 9. Checar se intermitentes_lote_id ou diaristas_lote_id já existem nas colunas
  if (remessas && remessas.length > 0) {
    const firstRow = remessas[0];
    console.log('\n--- 9. Verificação de Existência de Novas Colunas ---');
    console.log('Coluna "intermitentes_lote_id" existe?', 'intermitentes_lote_id' in firstRow);
    console.log('Coluna "diaristas_lote_id" existe?', 'diaristas_lote_id' in firstRow);
    console.log('Coluna "conteudo_arquivo" existe?', 'conteudo_arquivo' in firstRow);
    console.log('Coluna "competencia" existe?', 'competencia' in firstRow);
    console.log('Coluna "observacoes" existe?', 'observacoes' in firstRow);
  }

  // 10. Testar chamada de leitura da RPC atual rpc_registrar_cnab_remessa com parâmetros inválidos
  // apenas para inspecionar erro de validação e confirmar que a RPC existe no backend
  console.log('\n--- 10. Teste de Assinatura da RPC rpc_registrar_cnab_remessa ---');
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_registrar_cnab_remessa', {
    p_conta_bancaria_id: '00000000-0000-0000-0000-000000000000',
    p_lote_id: '00000000-0000-0000-0000-000000000000',
    p_empresa_id: '00000000-0000-0000-0000-000000000000',
    p_modo: 'homologacao',
    p_nome_arquivo: 'TESTE_PROBE.txt',
    p_hash_arquivo: 'hash_probe',
    p_total_valor: 10.00,
    p_total_registros: 1,
    p_itens: []
  });
  console.log('Resposta probe RPC (esperado erro de validação ou conta inexistente):', rpcErr?.message || rpcRes);
}

runAudit().catch(console.error);
