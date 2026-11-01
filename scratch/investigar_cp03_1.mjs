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

  console.log('=== INVESTIGAÇÃO CP03.1 — SEMÂNTICA DE VALOR_BASE E DADOS REAIS ===\n');

  // 1. Inspecionar colaboradores
  const { data: colabs, error: errColab } = await supabase
    .from('colaboradores')
    .select('id, nome, matricula, tipo_colaborador, tipo_contrato, modelo_calculo, valor_base, salario_base, valor_hora, valor_diaria, status_cadastro, cadastro_provisorio, empresa_id, is_teste')
    .or('is_teste.is.null,is_teste.eq.false');

  if (errColab) {
    console.error('Erro ao buscar colaboradores:', errColab);
    return;
  }

  console.log(`Total colaboradores (produção): ${colabs.length}`);

  // Estatísticas de valor_base por tipo_colaborador
  const grouped = {};
  for (const c of colabs) {
    const tipo = (c.tipo_colaborador || 'SEM_TIPO').toUpperCase();
    if (!grouped[tipo]) grouped[tipo] = [];
    grouped[tipo].push(c);
  }

  for (const [tipo, list] of Object.entries(grouped)) {
    console.log(`\n==============================================`);
    console.log(`--- TIPO: ${tipo} (Total: ${list.length}) ---`);
    console.log(`==============================================`);
    const valorBaseSet = new Set(list.map(c => c.valor_base));
    const salarioBaseSet = new Set(list.map(c => c.salario_base));
    const valorHoraSet = new Set(list.map(c => c.valor_hora));
    const valorDiariaSet = new Set(list.map(c => c.valor_diaria));
    const modeloCalculoSet = new Set(list.map(c => c.modelo_calculo));
    const tipoContratoSet = new Set(list.map(c => c.tipo_contrato));

    console.log(`Valores base distintos:`, Array.from(valorBaseSet));
    console.log(`Salários base distintos:`, Array.from(salarioBaseSet));
    console.log(`Valores hora distintos:`, Array.from(valorHoraSet));
    console.log(`Valores diária distintos:`, Array.from(valorDiariaSet));
    console.log(`Modelos de cálculo distintos:`, Array.from(modeloCalculoSet));
    console.log(`Tipos de contrato distintos:`, Array.from(tipoContratoSet));

    console.log(`Exemplos (até 3):`);
    console.log(JSON.stringify(list.slice(0, 3).map(c => ({
      nome: c.nome,
      matricula: c.matricula,
      tipo_colaborador: c.tipo_colaborador,
      tipo_contrato: c.tipo_contrato,
      modelo_calculo: c.modelo_calculo,
      valor_base: c.valor_base,
      salario_base: c.salario_base,
      valor_hora: c.valor_hora,
      valor_diaria: c.valor_diaria
    })), null, 2));
  }

  // 2. Verificar se existem registros_ponto com valor_dia > 0, valor_hora_extra > 0, etc.
  console.log('\n--- VERIFICAÇÃO EM REGISTROS_PONTO ---');
  const { data: pontosCalculados, error: errPontos } = await supabase
    .from('registros_ponto')
    .select('id, data, colaborador_id, status_processamento, valor_dia, valor_hora_extra, valor_atraso, valor_falta, minutos_extra, minutos_atraso, jornada_calculada')
    .or('valor_dia.gt.0,valor_hora_extra.gt.0,valor_atraso.gt.0,valor_falta.gt.0,minutos_extra.gt.0,minutos_atraso.gt.0')
    .limit(50);

  if (errPontos) {
    console.error('Erro ao consultar registros_ponto:', errPontos);
  } else {
    console.log(`Registros_ponto com valores financeiros calculados: ${pontosCalculados?.length || 0}`);
    if (pontosCalculados && pontosCalculados.length > 0) {
      console.log('Exemplos:', JSON.stringify(pontosCalculados.slice(0, 5), null, 2));
    }
  }

  // 3. Contagem total de pontos com status_processamento = 'PROCESSADO'
  const { count: procCount, error: errProc } = await supabase
    .from('registros_ponto')
    .select('*', { count: 'exact', head: true })
    .in('status_processamento', ['PROCESSADO', 'processado']);

  console.log(`Total registros_ponto com status PROCESSADO: ${procCount ?? 0}`);

  // 4. Verificar banco_horas_eventos
  console.log('\n--- VERIFICAÇÃO EM BANCO_HORAS_EVENTOS ---');
  const { count: eventosCount, error: errEventos } = await supabase
    .from('banco_horas_eventos')
    .select('*', { count: 'exact', head: true });

  console.log(`Total registros em banco_horas_eventos: ${eventosCount ?? 0}`);

  // 5. Verificar banco_horas_saldos
  console.log('\n--- VERIFICAÇÃO EM BANCO_HORAS_SALDOS ---');
  const { count: saldosCount, error: errSaldos } = await supabase
    .from('banco_horas_saldos')
    .select('*', { count: 'exact', head: true });

  console.log(`Total registros em banco_horas_saldos: ${saldosCount ?? 0}`);

  // 6. Verificar fechamento_mensal
  console.log('\n--- VERIFICAÇÃO EM FECHAMENTO_MENSAL ---');
  const { count: fechamentoCount, error: errFechamento } = await supabase
    .from('fechamento_mensal')
    .select('*', { count: 'exact', head: true });

  console.log(`Total registros em fechamento_mensal: ${fechamentoCount ?? 0}`);

  // 7. Verificar processamento_rh_logs
  console.log('\n--- VERIFICAÇÃO EM PROCESSAMENTO_RH_LOGS ---');
  const { data: logs, error: errLogs } = await supabase
    .from('processamento_rh_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`Total logs recentes em processamento_rh_logs: ${logs?.length ?? 0}`);
  if (logs && logs.length > 0) {
    console.log('Logs:', JSON.stringify(logs, null, 2));
  }
}

run();
