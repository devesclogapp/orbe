import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=');
  if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function run() {
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  const candidateTables = [
    'clientes', 'faturas', 'financeiro_consolidados_cliente', 'aprovacoes_cliente',
    'relatorios_salvos', 'relatorios_agendados', 'layouts_exportacao', 'relatorios',
    'contabilidade_mapeamento', 'contabilidade_fechamentos', 'contabilidade_exportacoes', 'contabilidade_logs',
    'plano_contas', 'fechamentos_contabeis',
    'user_permissions', 'tenant_invitations', 'audit_log',
    'registros_ponto', 'pontos_importados', 'jornadas_trabalho', 'historico_importacoes',
    'banco_horas_registros', 'banco_horas_saldos', 'fechamentos_mensais_clt',
    'empresas', 'unidades', 'colaboradores', 'operacoes_producao',
    'servicos_extras', 'custos_extras', 'diaristas_lancamentos', 'diaristas_lotes',
    'integracoes_config'
  ];

  console.log('--- DETALHE DE TABELAS ---');
  for (const tbl of candidateTables) {
    const { data, count, error } = await supabase
      .from(tbl)
      .select('count', { count: 'exact' })
      .limit(1);
    if (error) {
      console.log(`- ${tbl}: ERRO (${error.code}) ${error.message}`);
    } else {
      console.log(`- ${tbl}: EXISTE | count = ${count}`);
    }
  }
}

run().catch(console.error);
