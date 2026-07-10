import { test } from 'vitest';

const EXTRA_RATE = 1.5;

const timeToMinutes = (timeStr: string | null): number => {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(":").map(Number);
  return (hours || 0) * 60 + (minutes || 0);
};

const calculateWorkedMinutes = (ponto: any): number => {
  const entrada = timeToMinutes(ponto.entrada);
  const saida = timeToMinutes(ponto.saida);
  const saidaAlmoco = timeToMinutes(ponto.saida_almoco);
  const retornoAlmoco = timeToMinutes(ponto.retorno_almoco);

  const almocoDuration =
    saidaAlmoco > 0 && retornoAlmoco > 0 ? retornoAlmoco - saidaAlmoco : 0;

  return entrada > 0 && saida > 0 ? saida - entrada - Math.max(almocoDuration, 0) : 0;
};

const calculateCompensation = (params: any) => {
  const { ponto, regra, colaborador } = params;
  const workedMinutes =
    ponto.status === "Ausente" || ponto.status === "Falta" ? 0 : calculateWorkedMinutes(ponto);
  const jornadaHours =
    Number(regra?.carga_horaria_diaria ?? regra?.jornada_contratada ?? 8) || 8;
  const jornadaMinutes = Math.round(jornadaHours * 60);
  const toleranciaAtraso = Number(regra?.tolerancia_atraso ?? 10) || 0; // Defaulting to 10 for testing
  const toleranciaExtra = Number(regra?.tolerancia_hora_extra ?? 10) || 0;
  const limiteDiarioBanco = Number(regra?.limite_diario_banco ?? 480) || 480;

  let saldoBase = workedMinutes - jornadaMinutes;
  let minutosExtra = 0;
  let minutosDebito = 0;

  if (ponto.status === "Ausente" || ponto.status === "Falta") {
    saldoBase = -jornadaMinutes;
    minutosDebito = jornadaMinutes;
  } else if (saldoBase > toleranciaExtra) {
    minutosExtra = Math.min(saldoBase - toleranciaExtra, limiteDiarioBanco);
  } else if (saldoBase < 0) {
    minutosDebito = Math.abs(saldoBase) > toleranciaAtraso ? Math.abs(saldoBase) - toleranciaAtraso : 0;
  }

  const saldoDia = minutosExtra - minutosDebito;
  const atrasoMinutes = saldoBase < 0 ? minutosDebito : 0;
  return {
    workedMinutes,
    saldoBase,
    minutosExtra,
    minutosDebito,
    saldoDia,
    atrasoMinutes
  };
};

const regraTeste = {
  carga_horaria_diaria: 8,
  tolerancia_atraso: 10,
  tolerancia_hora_extra: 10,
  limite_diario_banco: 480
};

console.log("=== HML-001: Jornada Normal ===");
const p1 = { entrada: "08:00", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "17:00", status: "Presente" };
console.log(calculateCompensation({ ponto: p1, regra: regraTeste, colaborador: {} }));

console.log("\n=== HML-002: Hora Extra ===");
const p2 = { entrada: "08:00", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "19:00", status: "Presente" };
console.log(calculateCompensation({ ponto: p2, regra: regraTeste, colaborador: {} }));

console.log("\n=== HML-003: Atraso (Acima da Tolerância) ===");
const p3 = { entrada: "08:30", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "17:00", status: "Presente" };
console.log(calculateCompensation({ ponto: p3, regra: regraTeste, colaborador: {} }));

console.log("\n=== HML-003: Atraso (Dentro da Tolerância) ===");
const p3b = { entrada: "08:05", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "17:00", status: "Presente" };
console.log(calculateCompensation({ ponto: p3b, regra: regraTeste, colaborador: {} }));

console.log("\n=== HML-004: Batidas Incompletas (Sem saída) ===");
const p4 = { entrada: "08:00", saida_almoco: "12:00", retorno_almoco: "13:00", saida: null, status: "Presente" };
console.log(calculateCompensation({ ponto: p4, regra: regraTeste, colaborador: {} }));
