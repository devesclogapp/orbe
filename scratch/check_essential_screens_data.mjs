import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function checkScreensExact() {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  await supabase.auth.signInWithPassword({ email, password });

  const tableList = [
    // Operações
    { label: 'Operações por Volume / Produção', table: 'operacoes_producao' },
    { label: 'Receitas Operacionais', table: 'receitas_operacionais' },
    { label: 'Diaristas Lotes Fechamento', table: 'diaristas_lotes_fechamento' },
    { label: 'Serviços Extras Operacionais', table: 'servicos_extras_operacionais' },
    { label: 'Custos Extras Operacionais', table: 'custos_extras_operacionais' },
    // RH
    { label: 'Pontos CLT', table: 'registros_ponto' },
    { label: 'Lançamentos Intermitentes', table: 'lancamentos_intermitentes' },
    { label: 'Lotes Intermitentes Fechamento', table: 'intermitentes_lotes_fechamento' },
    { label: 'Colaboradores', table: 'colaboradores' },
    { label: 'Empresas', table: 'empresas' },
    // Financeiro
    { label: 'Lotes RH / Financeiro', table: 'rh_financeiro_lotes' },
    { label: 'Arquivos Remessas CNAB', table: 'cnab_remessas_arquivos' },
    { label: 'Contas Bancárias da Empresa', table: 'contas_bancarias_empresa' },
  ];

  console.log('=== TESTE DE LEITURA DAS TABELAS ESSENCIAIS (select * limit 1) ===');
  let passCount = 0;
  for (const t of tableList) {
    const { data, error } = await supabase.from(t.table).select('*').limit(1);
    if (error) {
      console.log(`❌ ${t.label} (${t.table}): ERRO -> ${error.message}`);
    } else {
      console.log(`✅ ${t.label} (${t.table}): ACESSÍVEL (Retornou ${data.length} reg)`);
      passCount++;
    }
  }

  console.log(`\nTaxa de sucesso: ${passCount}/${tableList.length}`);
}

checkScreensExact().catch(console.error);
