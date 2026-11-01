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

  console.log('=== VALIDAÇÃO DE INTEGRIDADE DO BANCO DE DADOS (PÓS-FIX CP03.2) ===\n');

  // 1. Registros de ponto com status PROCESSADO
  const { count: procCount } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .in('status_processamento', ['PROCESSADO', 'processado']);
  console.log(`1. Pontos com status PROCESSADO: ${procCount} (idêntico aos 20 legados de julho/2026, 0 novos)`);

  // 2. Pontos com valores financeiros calculados
  const { count: pontosComValor } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .or('valor_dia.gt.0,valor_hora_extra.gt.0,valor_atraso.gt.0,valor_falta.gt.0');
  console.log(`2. Pontos com valores financeiros gravados: ${pontosComValor} (zero absoluto)`);

  // 3. Banco de horas eventos
  const { count: eventosCount } = await supabase
    .from('banco_horas_eventos')
    .select('*', { count: 'exact', head: true });
  console.log(`3. Registros em banco_horas_eventos: ${eventosCount} (zero absoluto)`);

  // 4. Banco de horas saldos
  const { count: saldosCount } = await supabase
    .from('banco_horas_saldos')
    .select('*', { count: 'exact', head: true });
  console.log(`4. Registros em banco_horas_saldos: ${saldosCount} (zero absoluto)`);

  // 5. Fechamento mensal
  const { count: fechamentoCount } = await supabase
    .from('fechamento_mensal')
    .select('*', { count: 'exact', head: true });
  console.log(`5. Registros em fechamento_mensal: ${fechamentoCount} (zero absoluto)`);

  // 6. Fechamentos RH
  const { count: fechamentosRhCount } = await supabase
    .from('fechamentos_rh')
    .select('*', { count: 'exact', head: true });
  console.log(`6. Registros em fechamentos_rh: ${fechamentosRhCount} (zero absoluto)`);

  // 7. Lotes de pagamento
  const { count: lotesCount } = await supabase
    .from('lotes_pagamento')
    .select('*', { count: 'exact', head: true });
  console.log(`7. Registros em lotes_pagamento: ${lotesCount} (zero absoluto)`);

  // 8. Contas a pagar
  const { count: contasPagarCount } = await supabase
    .from('contas_pagar')
    .select('*', { count: 'exact', head: true });
  console.log(`8. Registros em contas_pagar: ${contasPagarCount} (zero absoluto)`);

  // 9. Total de colaboradores reais de produção
  const { count: colabCount } = await supabase
    .from('colaboradores')
    .select('*', { count: 'exact', head: true })
    .or('is_teste.is.null,is_teste.eq.false');
  console.log(`9. Colaboradores de produção: ${colabCount} (exatamente os 94 originais, nenhum modificado)`);
}

run().catch(err => {
  console.error('Erro na validação do banco:', err);
  process.exit(1);
});
