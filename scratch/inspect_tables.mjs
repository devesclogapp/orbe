import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspectRealTables() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const tablesToCheck = [
    'empresas',
    'colaboradores',
    'tipos_servico_operacional',
    'transportadoras_clientes',
    'fornecedores',
    'produtos_carga',
    'unidades',
    'regras_operacionais',
    'formas_pagamento_operacional',
    'tipos_regra_operacional',
    'regras_modulos',
    'regras_dados',
    'materiais_operacionais',
    'operacoes_producao',
    'servicos_extras',
    'custos_extras',
    'coletores',
    'jornadas_trabalho'
  ];

  console.log('--- CONTAGEM REAL POR TABELA NO SUPABASE ---');
  const counts = {};
  for (const tbl of tablesToCheck) {
    const { data, count, error } = await supabase
      .from(tbl)
      .select('*', { count: 'exact' });
    if (error) {
      console.log(`- ${tbl}: ERRO (${error.message})`);
      counts[tbl] = { error: error.message };
    } else {
      console.log(`- ${tbl}: ${data.length} registros (count: ${count})`);
      counts[tbl] = { count: data.length, sample: data.slice(0, 5) };
    }
  }

  fs.writeFileSync('scratch/real_tables_counts.json', JSON.stringify(counts, null, 2));
}

inspectRealTables().catch(console.error);

