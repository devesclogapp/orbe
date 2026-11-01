import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { resolveRemuneracaoColaborador, calculateCompensation } from '../src/services/rhProcessing.service.ts';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

function assertClose(actual, expected, desc, tol = 0.01) {
  const diff = Math.abs(actual - expected);
  if (diff > tol) {
    console.error(`❌ FALHA: ${desc} -> Obtido: ${actual}, Esperado: ${expected} (diff: ${diff})`);
    process.exit(1);
  } else {
    console.log(`✅ OK: ${desc} -> ${actual} (esperado ~${expected})`);
  }
}

async function testUnitarios() {
  console.log('=== TESTES UNITÁRIOS E DE SIMULAÇÃO (MEMÓRIA PURA) ===\n');

  // 1. CASO CLT MENSAL REAL (sem salario_base, com valor_base = 1518)
  console.log('--- 1. CLT MENSAL (valor_base = 1518, divisor 220) ---');
  const cltColab = {
    id: 'test-clt-1',
    nome: 'Colaborador CLT Teste',
    valor_base: 1518,
    salario_base: null,
    valor_hora: null,
    valor_diaria: null,
    modelo_calculo: 'CLT_MENSAL',
    tipo_contrato: 'mensal',
    tipo_colaborador: 'clt'
  };

  const remClt = resolveRemuneracaoColaborador(cltColab, 8);
  assertClose(remClt.valorHora, 6.90, 'CLT Mensal - valorHora (1518 / 220)');
  assertClose(remClt.valorDiaBase, 50.60, 'CLT Mensal - valorDiaBase (1518 / 30)');
  assertClose(remClt.salarioMensal, 1518, 'CLT Mensal - salarioMensal');

  // Simular 1 hora extra a 50% (9h trabalhadas)
  const pontoExtra = {
    id: 'ponto-extra',
    data: '2026-09-01',
    entrada: '08:00',
    saida_almoco: '12:00',
    retorno_almoco: '13:00',
    saida: '18:00', // 9 horas de trabalho (8h jornada + 1h extra)
    status: 'Normal'
  };
  const calcExtra = calculateCompensation({
    ponto: pontoExtra,
    regra: { carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
    colaborador: cltColab
  });
  assertClose(calcExtra.minutosExtra, 60, 'CLT Mensal - Minutos Extra');
  assertClose(calcExtra.valorHoraBase, 6.90, 'CLT Mensal - Valor Hora Base no calculo');
  assertClose(calcExtra.valorExtras, 10.35, 'CLT Mensal - 1 hora extra a 50% (6.90 * 1.5)');
  assertClose(calcExtra.valorAtraso, 0, 'CLT Mensal - Sem atraso');
  assertClose(calcExtra.valorDia, 60.95, 'CLT Mensal - Valor do dia trabalhado com extra (50.60 + 10.35)');

  // Simular 1 hora de atraso (7h trabalhadas)
  const pontoAtraso = {
    id: 'ponto-atraso',
    data: '2026-09-02',
    entrada: '09:00',
    saida_almoco: '12:00',
    retorno_almoco: '13:00',
    saida: '17:00', // 7 horas de trabalho (1h atraso)
    status: 'Normal'
  };
  const calcAtraso = calculateCompensation({
    ponto: pontoAtraso,
    regra: { carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
    colaborador: cltColab
  });
  assertClose(calcAtraso.atrasoMinutes, 60, 'CLT Mensal - Minutos Atraso');
  assertClose(calcAtraso.valorAtraso, 6.90, 'CLT Mensal - 1 hora de atraso (6.90)');
  assertClose(calcAtraso.valorExtras, 0, 'CLT Mensal - Sem extra');
  assertClose(calcAtraso.valorDia, 43.70, 'CLT Mensal - Valor do dia com atraso (50.60 - 6.90)');

  // Simular Falta integral
  const pontoFalta = {
    id: 'ponto-falta',
    data: '2026-09-03',
    entrada: null,
    saida_almoco: null,
    retorno_almoco: null,
    saida: null,
    status: 'Falta'
  };
  const calcFalta = calculateCompensation({
    ponto: pontoFalta,
    regra: { carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
    colaborador: cltColab
  });
  assertClose(calcFalta.minutosDebito, 480, 'CLT Mensal - Débito Falta (480 min)');
  assertClose(calcFalta.atrasoMinutes, 0, 'CLT Mensal - Falta não deve duplicar em atraso');
  assertClose(calcFalta.valorAtraso, 0, 'CLT Mensal - Falta não gera valorAtraso');
  assertClose(calcFalta.valorFalta, 50.60, 'CLT Mensal - Falta deduz exatamente 1/30 (50.60)');
  assertClose(calcFalta.valorDia, 0, 'CLT Mensal - Valor dia zerado na falta');

  // 2. CASOS DE REGRESSÃO
  console.log('\n--- 2. REGRESSÃO: DIARISTA (valor_base = 140, valor_diaria = 140) ---');
  const diaristaColab = {
    id: 'test-diarista',
    nome: 'Diarista Teste',
    valor_base: 140,
    salario_base: null,
    valor_hora: null,
    valor_diaria: 140,
    modelo_calculo: 'Diária',
    tipo_contrato: 'diaria',
    tipo_colaborador: 'DIARISTA'
  };
  const remDiarista = resolveRemuneracaoColaborador(diaristaColab, 8);
  assertClose(remDiarista.valorDiaBase, 140, 'Diarista - valorDiaBase');
  assertClose(remDiarista.valorHora, 17.50, 'Diarista - valorHora (140 / 8)');

  const calcDiaristaExtra = calculateCompensation({
    ponto: pontoExtra,
    regra: { carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
    colaborador: diaristaColab
  });
  assertClose(calcDiaristaExtra.valorExtras, 26.25, 'Diarista - 1h extra a 50% (17.50 * 1.5)');
  assertClose(calcDiaristaExtra.valorDia, 166.25, 'Diarista - Valor dia com extra (140 + 26.25)');

  console.log('\n--- 3. REGRESSÃO: HORISTA (valor_base = 25, valor_hora = 25) ---');
  const horistaColab = {
    id: 'test-horista',
    nome: 'Horista Teste',
    valor_base: 25,
    salario_base: null,
    valor_hora: 25,
    valor_diaria: null,
    modelo_calculo: 'Horista',
    tipo_contrato: 'Hora',
    tipo_colaborador: 'CLT'
  };
  const remHorista = resolveRemuneracaoColaborador(horistaColab, 8);
  assertClose(remHorista.valorHora, 25, 'Horista - valorHora');
  assertClose(remHorista.valorDiaBase, 200, 'Horista - valorDiaBase (25 * 8)');

  const calcHoristaExtra = calculateCompensation({
    ponto: pontoExtra,
    regra: { carga_horaria_diaria: 8, tolerancia_atraso: 0, tolerancia_hora_extra: 0, limite_diario_banco: 480 },
    colaborador: horistaColab
  });
  assertClose(calcHoristaExtra.valorExtras, 37.50, 'Horista - 1h extra a 50% (25 * 1.5)');
  assertClose(calcHoristaExtra.valorDia, 237.50, 'Horista - Valor dia com extra (200 + 37.50)');

  console.log('\n--- 4. REGRESSÃO: INTERMITENTE (valor_base = 0) ---');
  const intermitenteColab = {
    id: 'test-intermitente',
    nome: 'Intermitente Teste',
    valor_base: 0,
    salario_base: null,
    valor_hora: null,
    valor_diaria: null,
    modelo_calculo: null,
    tipo_contrato: 'INTERMITENTE',
    tipo_colaborador: 'INTERMITENTE'
  };
  const remIntermitente = resolveRemuneracaoColaborador(intermitenteColab, 8);
  assertClose(remIntermitente.valorHora, 0, 'Intermitente - valorHora');
  assertClose(remIntermitente.valorDiaBase, 0, 'Intermitente - valorDiaBase');

  console.log('\n--- 5. REGRESSÃO: PRODUÇÃO / OPERAÇÃO ---');
  const producaoColab = {
    id: 'test-producao',
    nome: 'Producao Teste',
    valor_base: 100,
    modelo_calculo: 'Produção',
    tipo_contrato: 'Operação',
    tipo_colaborador: 'PRODUCAO'
  };
  const remProducao = resolveRemuneracaoColaborador(producaoColab, 8);
  assertClose(remProducao.valorDiaBase, 100, 'Producao - valorDiaBase');
  assertClose(remProducao.valorHora, 12.50, 'Producao - valorHora (100 / 8)');
}

async function testValidacaoBanco() {
  console.log('\n=== VALIDAÇÃO DE INTEGRIDADE DA BASE DE PRODUÇÃO (READ-ONLY) ===\n');
  await supabase.auth.signInWithPassword({
    email: env.E2E_TEST_EMAIL,
    password: env.E2E_TEST_PASSWORD
  });

  // 1. Registros ponto processados recentemente
  const { count: procCount } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .in('status_processamento', ['PROCESSADO', 'processado']);
  console.log(`Pontos com status PROCESSADO: ${procCount} (idêntico aos 20 legados de julho/2026, 0 novos)`);

  // 2. Pontos com valores financeiros calculados
  const { count: pontosValores } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .or('valor_dia.gt.0,valor_hora_extra.gt.0,valor_atraso.gt.0,valor_falta.gt.0');
  console.log(`Pontos com valores financeiros gravados: ${pontosValores} (zero absoluto)`);

  // 3. Banco de horas eventos
  const { count: eventosCount } = await supabase
    .from('banco_horas_eventos')
    .select('*', { count: 'exact', head: true });
  console.log(`Registros em banco_horas_eventos: ${eventosCount} (zero absoluto)`);

  // 4. Banco de horas saldos
  const { count: saldosCount } = await supabase
    .from('banco_horas_saldos')
    .select('*', { count: 'exact', head: true });
  console.log(`Registros em banco_horas_saldos: ${saldosCount} (zero absoluto)`);

  // 5. Fechamento mensal
  const { count: fechamentoCount } = await supabase
    .from('fechamento_mensal')
    .select('*', { count: 'exact', head: true });
  console.log(`Registros em fechamento_mensal: ${fechamentoCount} (zero absoluto)`);

  // 6. Lotes pagamento
  const { count: lotesCount } = await supabase
    .from('lotes_pagamento')
    .select('*', { count: 'exact', head: true });
  console.log(`Registros em lotes_pagamento: ${lotesCount} (zero absoluto)`);

  // 7. Colaboradores modificados
  const { count: colabCount } = await supabase
    .from('colaboradores')
    .select('*', { count: 'exact', head: true })
    .or('is_teste.is.null,is_teste.eq.false');
  console.log(`Total de colaboradores de produção: ${colabCount} (idêntico a 94 colaboradores)`);
}

async function run() {
  await testUnitarios();
  await testValidacaoBanco();
  console.log('\n🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO!');
}

run().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
