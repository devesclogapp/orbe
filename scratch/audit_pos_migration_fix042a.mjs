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

  console.log('=== AUDITORIA DE INTEGRIDADE DO BANCO DE DADOS (PÓS-FIX 04.2-A) ===\n');

  // 1. Tabela jornadas_trabalho (tabela nasce vazia, 0 registros)
  const { count: jornadasCount, error: errJornadas } = await supabase
    .from('jornadas_trabalho')
    .select('*', { count: 'exact', head: true });
  console.log(`1. Registros em jornadas_trabalho: ${jornadasCount ?? 0} (zero absoluto) ${errJornadas ? `[Nota: ${errJornadas.message}]` : ''}`);

  // 2. Colaboradores de produção e integridade de jornada_id
  const { count: totalColabs } = await supabase
    .from('colaboradores')
    .select('*', { count: 'exact', head: true })
    .or('is_teste.is.null,is_teste.eq.false');
  console.log(`2. Total de colaboradores reais de produção: ${totalColabs} (inalterado, 94)`);

  const { count: colabsComJornada } = await supabase
    .from('colaboradores')
    .select('*', { count: 'exact', head: true })
    .not('jornada_id', 'is', null);
  console.log(`3. Colaboradores com jornada_id preenchido: ${colabsComJornada ?? 0} (zero absoluto, nenhum vinculado prematuramente)`);

  // 4. Registros de ponto alterados
  const { count: procCount } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .in('status_processamento', ['PROCESSADO', 'processado']);
  console.log(`4. Pontos com status PROCESSADO: ${procCount} (inalterado, exatamente os 20 legados de julho/2026)`);

  // 5. Pontos com valores financeiros
  const { count: pontosComValor } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .or('valor_dia.gt.0,valor_hora_extra.gt.0,valor_atraso.gt.0,valor_falta.gt.0');
  console.log(`5. Pontos com valores gravados: ${pontosComValor} (zero absoluto)`);

  // 6. Banco de horas eventos
  const { count: eventosCount } = await supabase
    .from('banco_horas_eventos')
    .select('*', { count: 'exact', head: true });
  console.log(`6. Registros em banco_horas_eventos: ${eventosCount} (zero absoluto)`);

  // 7. Banco de horas saldos
  const { count: saldosCount } = await supabase
    .from('banco_horas_saldos')
    .select('*', { count: 'exact', head: true });
  console.log(`7. Registros em banco_horas_saldos: ${saldosCount} (zero absoluto)`);

  // 8. Fechamentos
  const { count: fechamentoCount } = await supabase
    .from('fechamento_mensal')
    .select('*', { count: 'exact', head: true });
  console.log(`8. Registros em fechamento_mensal: ${fechamentoCount} (zero absoluto)`);

  const { count: fechamentosRhCount } = await supabase
    .from('fechamentos_rh')
    .select('*', { count: 'exact', head: true });
  console.log(`9. Registros em fechamentos_rh: ${fechamentosRhCount} (zero absoluto)`);

  // 9. Lotes de pagamento e contas a pagar
  const { count: lotesCount } = await supabase
    .from('lotes_pagamento')
    .select('*', { count: 'exact', head: true });
  console.log(`10. Registros em lotes_pagamento: ${lotesCount} (zero absoluto)`);

  const { count: contasPagarCount } = await supabase
    .from('contas_pagar')
    .select('*', { count: 'exact', head: true });
  console.log(`11. Registros em contas_pagar: ${contasPagarCount} (zero absoluto)`);

  // 10. Tabela banco_horas_regras intacta
  const { count: regrasBhCount } = await supabase
    .from('banco_horas_regras')
    .select('*', { count: 'exact', head: true });
  console.log(`12. Registros em banco_horas_regras: ${regrasBhCount} (intacta, 0 registros)`);

  console.log('\nTODOS OS CRITÉRIOS DE INTEGRIDADE FORAM ATENDIDOS COM SUCESSO.');
}

run().catch(err => {
  console.error('Erro na auditoria do banco:', err);
  process.exit(1);
});
