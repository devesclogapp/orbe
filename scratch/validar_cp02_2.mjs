import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) env[key.trim()] = vals.join('=').trim().replace(/^['"]|['"]$/g, '');
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Simulação idêntica da função buildRuleExplanation atualizada em ProcessamentoRH.tsx
const parseHourMinuteString = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(-)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const sign = match[1] ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const calculateWorkedMinutes = (ponto) => {
  const entrada = timeToMinutes(ponto.entrada);
  const saida = timeToMinutes(ponto.saida);
  const saidaAlmoco = timeToMinutes(ponto.saida_almoco);
  const retornoAlmoco = timeToMinutes(ponto.retorno_almoco);
  const almocoDuration =
    saidaAlmoco > 0 && retornoAlmoco > 0 ? retornoAlmoco - saidaAlmoco : 0;
  return entrada > 0 && saida > 0 ? saida - entrada - Math.max(almocoDuration, 0) : 0;
};

const minutesToTime = (totalMinutes) => {
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${hours}h ${minutes}m`;
};

const formatCompactMinutes = (value) => {
  const abs = Math.abs(value);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours > 0 && minutes > 0) return `${hours}h${String(minutes).padStart(2, "0")}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
};

const formatRuleMinutes = (value) => (value > 0 ? formatCompactMinutes(value) : "0min");

const DEFAULT_RULE_NAME = "Regra padrão automática 8h";

const buildRuleExplanation = (ponto, regra) => {
  const statusProc = String(ponto?.status_processamento || "").toUpperCase();
  const isPendente = statusProc === "PENDENTE" || statusProc === "PENDENTE_PROCESSAMENTO" || !statusProc;
  const isInconsistente = statusProc === "INCONSISTENTE";
  const isProcessado = statusProc === "PROCESSADO";

  const workedMinutes =
    parseHourMinuteString(ponto?.horas_calculadas) ?? calculateWorkedMinutes(ponto);
  const jornadaHours =
    Number(ponto?.jornada_calculada ?? regra?.carga_horaria_diaria ?? regra?.jornada_contratada ?? 8) || 8;
  const jornadaMinutes = Math.round(jornadaHours * 60);

  if (isPendente) {
    return {
      isPendente: true,
      isInconsistente: false,
      isProcessado: false,
      regraNome: "Aguardando processamento RH",
      resumo: "Aguardando processamento RH",
      workedMinutes,
      jornadaHours,
      jornadaMinutes,
      saldoBase: 0,
      saldoFinal: 0,
      minutosExtra: 0,
      minutosAtraso: 0,
      excedente: 0,
      deficit: 0,
      toleranciaExtra: 0,
      toleranciaAtraso: 0,
      descontoTolerancia: 0,
      descontoLimite: 0,
      limiteDiarioBanco: 0,
    };
  }

  if (isInconsistente) {
    const inconsistenciasTexto = ponto?.inconsistencias || "Ponto inconsistente aguardando validação RH";
    return {
      isPendente: false,
      isInconsistente: true,
      isProcessado: false,
      regraNome: ponto?.regra_aplicada || regra?.nome || "Inconsistente",
      resumo: inconsistenciasTexto,
      workedMinutes,
      jornadaHours,
      jornadaMinutes,
      saldoBase: Number(ponto?.saldo_dia || 0),
      saldoFinal: Number(ponto?.saldo_dia || 0),
      minutosExtra: Number(ponto?.minutos_extra || 0),
      minutosAtraso: Number(ponto?.minutos_atraso || 0),
      excedente: 0,
      deficit: 0,
      toleranciaExtra: Number(regra?.tolerancia_hora_extra || 0),
      toleranciaAtraso: Number(regra?.tolerancia_atraso || 0),
      descontoTolerancia: 0,
      descontoLimite: 0,
      limiteDiarioBanco: Number(regra?.limite_diario_banco || 0),
    };
  }

  const toleranciaExtra = Number(regra?.tolerancia_hora_extra ?? (ponto.regra_aplicada === DEFAULT_RULE_NAME ? 10 : 0)) || 0;
  const toleranciaAtraso = Number(regra?.tolerancia_atraso ?? (ponto.regra_aplicada === DEFAULT_RULE_NAME ? 10 : 5)) || 0;
  const limiteDiarioBanco = Number(regra?.limite_diario_banco ?? (ponto.regra_aplicada === DEFAULT_RULE_NAME ? 120 : 480)) || 480;
  const saldoBase = workedMinutes - jornadaMinutes;
  const saldoFinal = Number(ponto.saldo_dia || 0);
  const minutosExtra = Number(ponto.minutos_extra || 0);
  const minutosAtraso = Number(ponto.minutos_atraso || 0);
  const excedente = Math.max(saldoBase, 0);
  const deficit = Math.max(-saldoBase, 0);
  const descontoTolerancia = excedente > 0 ? Math.min(excedente, toleranciaExtra) : Math.min(deficit, toleranciaAtraso);
  const brutoPosTolerancia = excedente > 0 ? Math.max(excedente - toleranciaExtra, 0) : Math.max(deficit - toleranciaAtraso, 0);
  const descontoLimite = excedente > 0 ? Math.max(brutoPosTolerancia - minutosExtra, 0) : 0;

  let resumo = `Jornada padrão ${jornadaHours}h sem desconto aplicado.`;

  if (excedente > 0) {
    resumo =
      minutosExtra > 0
        ? `Jornada padrão ${jornadaHours}h com tolerância de ${formatRuleMinutes(toleranciaExtra)}. Excedente de ${formatCompactMinutes(excedente)} -> ${formatCompactMinutes(minutosExtra)} convertidos em banco.`
        : `Jornada padrão ${jornadaHours}h com tolerância de ${formatRuleMinutes(toleranciaExtra)}. Excedente de ${formatCompactMinutes(excedente)} ficou dentro da política e não virou banco.`;
  } else if (deficit > 0) {
    resumo =
      minutosAtraso > 0
        ? `Jornada padrão ${jornadaHours}h com tolerância de atraso de ${formatRuleMinutes(toleranciaAtraso)}. Déficit de ${formatCompactMinutes(deficit)} -> ${formatCompactMinutes(minutosAtraso)} descontados do banco.`
        : `Jornada padrão ${jornadaHours}h com tolerância de atraso de ${formatRuleMinutes(toleranciaAtraso)}. Déficit de ${formatCompactMinutes(deficit)} ficou dentro da tolerância.`;
  }

  return {
    isPendente: false,
    isInconsistente: false,
    isProcessado: true,
    regraNome: ponto.regra_aplicada || regra?.nome || "—",
    resumo,
    workedMinutes,
    jornadaHours,
    jornadaMinutes,
    saldoBase,
    saldoFinal,
    minutosExtra,
    minutosAtraso,
    excedente,
    deficit,
    toleranciaExtra,
    toleranciaAtraso,
    descontoTolerancia,
    descontoLimite,
    limiteDiarioBanco,
  };
};

// Gate Cadastral
const validateColaboradorApto = (colaborador) => {
  if (!colaborador) return { apto: false, motivos: ["Colaborador não identificado"] };
  const motivos = [];
  if (String(colaborador.tipo_colaborador ?? "").trim().toUpperCase() === "DIARISTA") {
    motivos.push("Diaristas não participam do Banco de Horas CLT");
  }
  if (colaborador.status_cadastro === "pendente_complemento") {
    motivos.push("Cadastro pendente de complemento");
  }
  if (colaborador.cadastro_provisorio === true) {
    motivos.push("Cadastro provisório ainda não completado");
  }
  const modelo = String(colaborador.modelo_calculo ?? "").trim();
  const contrato = String(colaborador.tipo_contrato ?? "").trim();
  if (!modelo && !contrato) {
    motivos.push("Tipo de contrato ou modelo de cálculo não definido");
  }
  const statusLc = String(colaborador.status ?? "").toLowerCase();
  if (["bloqueado", "inativo"].includes(statusLc)) {
    motivos.push(`Colaborador com status ${statusLc}`);
  }
  return { apto: motivos.length === 0, motivos };
};

async function main() {
    console.log('================================================================');
    console.log('       VALIDAÇÃO TÉCNICA OBRIGATÓRIA — FIX CP02.2');
    console.log('================================================================\n');

    await supabase.auth.signInWithPassword({
        email: env.E2E_TEST_EMAIL,
        password: env.E2E_TEST_PASSWORD
    });

    // 1. Obter colaborador Jorge
    const { data: jorge } = await supabase
        .from('colaboradores')
        .select('*')
        .eq('matricula', '44')
        .single();

    // 2. Obter registros de ponto do Jorge em setembro/2026
    const { data: pontos } = await supabase
        .from('registros_ponto')
        .select('*')
        .eq('colaborador_id', jorge.id)
        .gte('data', '2026-09-01')
        .lte('data', '2026-09-30')
        .order('data', { ascending: true });

    console.log('CASO 1 & 2 — JORGE / REGISTRO PENDENTE & MARCAÇÕES REAIS:');
    const ponto25 = pontos.find(p => p.data === '2026-09-25');
    const workedMin25 = calculateWorkedMinutes(ponto25);
    const expl25 = buildRuleExplanation(ponto25, null);

    console.log(`- Data analisada: ${ponto25.data}`);
    console.log(`- Marcações reais: Ent: ${ponto25.entrada} | AlmSaída: ${ponto25.saida_almoco} | AlmRetorno: ${ponto25.retorno_almoco} | Saída: ${ponto25.saida}`);
    console.log(`- Horas brutas calculáveis: ${minutesToTime(workedMin25)} (455 min)`);
    console.log(`- status_processamento no banco: "${ponto25.status_processamento}"`);
    console.log(`- isPendente detectado: ${expl25.isPendente}`);
    console.log(`- Regra exibida: "${expl25.regraNome}"`);
    console.log(`- Resumo exibido: "${expl25.resumo}"`);
    console.log(`- Saldo Final retornado: ${expl25.saldoFinal}`);
    console.log(`- Minutos de atraso retornados: ${expl25.minutosAtraso}`);

    const caso1Aprovado = expl25.isPendente === true && 
                          expl25.resumo === "Aguardando processamento RH" &&
                          expl25.regraNome === "Aguardando processamento RH";
    console.log(`=> CASO 1 APROVADO? ${caso1Aprovado ? 'SIM' : 'NÃO'}`);

    const caso2Aprovado = ponto25.entrada === '08:05:00' && ponto25.saida === '17:54:00' && workedMin25 === 455;
    console.log(`=> CASO 2 APROVADO? ${caso2Aprovado ? 'SIM' : 'NÃO'}`);

    console.log('\nCASO 3 & 4 — DADOS PERSISTIDOS & STATUS NO BANCO:');
    console.log(`- Total de registros do Jorge em setembro: ${pontos.length}`);
    const todosPendentes = pontos.every(p => p.status_processamento === 'pendente');
    const todosSaldosNulos = pontos.every(p => p.saldo_dia === null && p.horas_calculadas === null);
    console.log(`- Todos os 28 registros continuam com status_processamento "pendente"? ${todosPendentes ? 'SIM' : 'NÃO'}`);
    console.log(`- Nenhum registro foi alterado (saldos permanecem nulos no banco)? ${todosSaldosNulos ? 'SIM' : 'NÃO'}`);
    console.log(`=> CASO 3 APROVADO? ${todosSaldosNulos ? 'SIM' : 'NÃO'}`);
    console.log(`=> CASO 4 APROVADO? ${todosPendentes ? 'SIM' : 'NÃO'}`);

    console.log('\nCASO 5 — GATE CADASTRAL:');
    const gateJorge = validateColaboradorApto(jorge);
    console.log(`- status_cadastro real do Jorge: "${jorge.status_cadastro}"`);
    console.log(`- cadastro_provisorio real do Jorge: ${jorge.cadastro_provisorio}`);
    console.log(`- Gate validateColaboradorApto resultado: apto = ${gateJorge.apto}`);
    console.log(`- Motivos legítimos: ${JSON.stringify(gateJorge.motivos)}`);
    const caso5Aprovado = gateJorge.apto === false && 
                          gateJorge.motivos.includes("Cadastro pendente de complemento") &&
                          gateJorge.motivos.includes("Cadastro provisório ainda não completado");
    console.log(`=> CASO 5 APROVADO? ${caso5Aprovado ? 'SIM' : 'NÃO'}`);

    console.log('\nCASO 6 — REGISTROS EFETIVAMENTE PROCESSADOS (PRESERVAÇÃO):');
    // Testar com um mock representativo de registro processado
    const pontoProcessadoMock = {
        data: '2026-09-25',
        entrada: '08:00:00',
        saida_almoco: '12:00:00',
        retorno_almoco: '13:00:00',
        saida: '17:30:00',
        horas_calculadas: '8:30',
        status_processamento: 'PROCESSADO',
        regra_aplicada: 'Regra padrão automática 8h',
        jornada_calculada: 8,
        minutos_extra: 30,
        minutos_atraso: 0,
        saldo_dia: 30,
    };
    const regraMock = {
        nome: 'Regra padrão automática 8h',
        carga_horaria_diaria: 8,
        tolerancia_hora_extra: 10,
        tolerancia_atraso: 10,
        limite_diario_banco: 120
    };
    const explProc = buildRuleExplanation(pontoProcessadoMock, regraMock);
    console.log(`- Status simulado: ${pontoProcessadoMock.status_processamento}`);
    console.log(`- isProcessado: ${explProc.isProcessado}`);
    console.log(`- isPendente: ${explProc.isPendente}`);
    console.log(`- Regra Nome: ${explProc.regraNome}`);
    console.log(`- Minutos Extra: ${explProc.minutosExtra}`);
    console.log(`- Saldo Final: ${explProc.saldoFinal}`);
    console.log(`- Resumo explicativo gerado: "${explProc.resumo}"`);

    const caso6Aprovado = explProc.isProcessado === true && 
                          explProc.isPendente === false &&
                          explProc.minutosExtra === 30 &&
                          explProc.saldoFinal === 30 &&
                          explProc.resumo.includes("convertidos em banco");
    console.log(`=> CASO 6 APROVADO? ${caso6Aprovado ? 'SIM' : 'NÃO'}`);

    console.log('\n================================================================');
    console.log(`RESULTADO GERAL: ${caso1Aprovado && caso2Aprovado && todosSaldosNulos && todosPendentes && caso5Aprovado && caso6Aprovado ? 'TODOS OS 6 CASOS VALIDADOS COM SUCESSO' : 'FALHA NA VALIDAÇÃO'}`);
    console.log('================================================================');
}

main().catch(console.error);
