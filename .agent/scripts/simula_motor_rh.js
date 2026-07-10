const fs = require('fs');
const EXTRA_RATE = 1.5;

const timeToMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const [hours, minutes] = String(timeStr).split(":").map(Number);
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

const calculateCompensation = (params) => {
    const { ponto, regra } = params;
    const workedMinutes =
        ponto.status === "Ausente" || ponto.status === "Falta" ? 0 : calculateWorkedMinutes(ponto);
    const jornadaHours = Number(regra?.carga_horaria_diaria ?? 8) || 8;
    const jornadaMinutes = Math.round(jornadaHours * 60);
    const toleranciaAtraso = Number(regra?.tolerancia_atraso ?? 10) || 0;
    const toleranciaExtra = Number(regra?.tolerancia_hora_extra ?? 10) || 0;
    const limiteDiarioBanco = Number(regra?.limite_diario_banco ?? 480) || 480;

    let saldoBase = workedMinutes - jornadaMinutes;
    let minutosExtra = 0;
    let minutosDebito = 0;

    if (ponto.status === "Ausente" || ponto.status === "Falta") {
        saldoBase = -jornadaMinutes;
        minutosDebito = jornadaMinutes;
    } else if (saldoBase > toleranciaExtra) {
        minutosExtra = Math.min(saldoBase, limiteDiarioBanco);
    } else if (saldoBase < -toleranciaAtraso) {
        minutosDebito = Math.abs(saldoBase);
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

const results = {};

const p1 = { entrada: "08:00", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "17:00", status: "Presente" };
results["HML-001 (Jornada Normal)"] = calculateCompensation({ ponto: p1, regra: regraTeste, colaborador: {} });

const p2 = { entrada: "08:00", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "19:00", status: "Presente" };
results["HML-002 (Hora Extra)"] = calculateCompensation({ ponto: p2, regra: regraTeste, colaborador: {} });

const p3 = { entrada: "08:30", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "17:00", status: "Presente" };
results["HML-003 (Atraso Acima)"] = calculateCompensation({ ponto: p3, regra: regraTeste, colaborador: {} });

const p3b = { entrada: "08:05", saida_almoco: "12:00", retorno_almoco: "13:00", saida: "17:00", status: "Presente" };
results["HML-003 (Atraso Dentro)"] = calculateCompensation({ ponto: p3b, regra: regraTeste, colaborador: {} });

const p4 = { entrada: "08:00", saida_almoco: "12:00", retorno_almoco: "13:00", saida: null, status: "Presente" };
results["HML-004 (Incompleto)"] = calculateCompensation({ ponto: p4, regra: regraTeste, colaborador: {} });

fs.writeFileSync("y:/2026/ERP ESC LOG/Orbe/.agent/scripts/output.json", JSON.stringify(results, null, 2), "utf8");
