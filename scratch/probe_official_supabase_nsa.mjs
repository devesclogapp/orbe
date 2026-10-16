import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase credentials missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function run() {
  console.log('=== CONSULTA SOMENTE LEITURA AO SUPABASE OFICIAL ===\n');

  // Autenticação para permitir consultas RLS
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) {
    console.error('Falha de autenticação no Supabase oficial:', authErr);
    process.exit(1);
  }
  console.log('Autenticação bem-sucedida como:', auth.user?.email, 'Role:', auth.user?.role);

  // 1. Consulta somente leitura aos registros oficiais NSA 8, 9 e 10
  console.log('\n--- 1. REGISTROS OFICIAIS cnab_remessas_arquivos (NSA 8, 9, 10) ---');
  const { data: remessas, error: remErr } = await supabase
    .from('cnab_remessas_arquivos')
    .select('id, sequencial_arquivo, nome_arquivo, hash_arquivo, status, modo, total_registros, total_valor, banco_codigo, banco_nome, empresa_id, conta_bancaria_id, lote_id, intermitentes_lote_id, diaristas_lote_id, created_at, updated_at')
    .in('sequencial_arquivo', [8, 9, 10])
    .order('sequencial_arquivo', { ascending: true });

  if (remErr) {
    console.error('Erro ao consultar cnab_remessas_arquivos:', remErr);
  } else {
    console.table(remessas);
  }

  // 2. Consulta aos itens de cada uma dessas remessas oficiais
  console.log('\n--- 2. ITENS DAS REMESSAS OFICIAIS cnab_remessa_itens ---');
  const remessaIds = (remessas || []).map(r => r.id);
  const { data: itens, error: itensErr } = await supabase
    .from('cnab_remessa_itens')
    .select('id, remessa_id, empresa_id, origem_tipo, origem_id, lote_item_id, fatura_id, valor, status, created_at')
    .in('remessa_id', remessaIds);

  if (itensErr) {
    console.error('Erro ao consultar cnab_remessa_itens:', itensErr);
  } else {
    console.log(`Total de itens encontrados para NSA 8, 9, 10: ${itens?.length}`);
    for (const r of (remessas || [])) {
      const itensDaRemessa = (itens || []).filter(i => i.remessa_id === r.id);
      console.log(`\nRemessa NSA ${r.sequencial_arquivo} (ID: ${r.id}): ${itensDaRemessa.length} itens:`);
      console.table(itensDaRemessa.map(i => ({
        id: i.id,
        origem_tipo: i.origem_tipo,
        origem_id: i.origem_id,
        valor: i.valor,
        status: i.status
      })));
    }
  }

  // 3. Consulta de retornos existentes para essas remessas ou no sistema
  console.log('\n--- 3. VERIFICAÇÃO DE RETORNOS EXISTENTES (cnab_retorno_arquivos) ---');
  const { data: retornos, error: retErr } = await supabase
    .from('cnab_retorno_arquivos')
    .select('*')
    .order('created_at', { ascending: false });

  if (retErr) {
    console.log('Aviso ao consultar cnab_retorno_arquivos:', retErr.message);
  } else {
    console.log(`Total de arquivos de retorno registrados no Supabase oficial: ${retornos?.length || 0}`);
    if (retornos && retornos.length > 0) {
      console.table(retornos.map(r => ({
        id: r.id,
        nome_arquivo: r.nome_arquivo,
        hash_arquivo: r.hash_arquivo?.substring(0, 16) + '...',
        remessa_arquivo_id: r.remessa_arquivo_id,
        modo: r.modo,
        status: r.status,
        created_at: r.created_at
      })));
    }
  }

  // 4. Verificação de esquema e colunas atuais no Supabase oficial
  console.log('\n--- 4. VERIFICAÇÃO DE COMPATIBILIDADE DE ESQUEMA ---');
  // Consultando estrutura via select vazio ou probe
  const probeTables = [
    'cnab_retorno_arquivos',
    'cnab_retorno_itens',
    'cnab_remessas_arquivos',
    'cnab_remessa_itens',
    'cnab_auditoria_bancaria',
    'intermitentes_lotes_fechamento',
    'lancamentos_intermitentes',
    'diaristas_lotes_fechamento',
    'lancamentos_diaristas',
    'rh_financeiro_lotes',
    'lotes_remessa',
    'faturas'
  ];

  for (const t of probeTables) {
    const { data: sample, error: err } = await supabase
      .from(t)
      .select('*')
      .limit(1);
    if (err) {
      console.log(`[Tabela ${t}]: ❌ Erro: ${err.message}`);
    } else {
      const cols = sample && sample[0] ? Object.keys(sample[0]) : '(tabela vazia ou RLS restrito)';
      console.log(`[Tabela ${t}]: ✅ Acessível. Colunas detectadas:`, cols);
    }
  }
}

run().catch(console.error);
