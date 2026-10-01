/**
 * MarcacoesPontoParser.ts
 *
 * Motor Operacional — FIX 04.2-D: Validação e Interpretação Segura das Marcações CLT.
 *
 * Princípio Fundamental:
 * DADO INCOMPLETO ≠ ZERO HORAS TRABALHADAS.
 * DADO INCOMPLETO = IMPOSSIBILIDADE DE APURAÇÃO.
 *
 * Esta camada é 100% pura (sem efeitos colaterais em banco ou IO).
 * Ela interpreta as marcações existentes sem nunca inventar horários,
 * completar batidas faltantes ou assumir intervalos fictícios.
 */

export type TipoInterpretacaoMarcacao =
  | "COMPLETA"
  | "MARCACAO_INCOMPLETA"
  | "MARCACAO_INVALIDA"
  | "SEM_MARCACOES"
  | "FALTA_PENDENTE_JUSTIFICATIVA"
  | "TRABALHO_EM_DIA_NAO_TRABALHAVEL"
  | "FALTA_CONFIRMADA"
  | "FALTA_ABONADA"
  | "DSR_DIRECIONADO_BH"
  | "DSR_DIRECIONADO_HE";

export type CampoMarcacao = "entrada" | "saida_almoco" | "retorno_almoco" | "saida";

export interface MarcacaoPreservada {
  campo: CampoMarcacao;
  valor: string;
  origem?: "IMPORTADA" | "REGULARIZADA_RH";
  valorOriginal?: string | null;
  justificativa?: string | null;
  executadoPorNome?: string | null;
  dataIntervencao?: string | null;
}

export interface AvaliacaoMarcacoesResult {
  calculavel: boolean;
  quantidadeMarcacoes: number;
  minutosTrabalhados: number | null;
  tipo: TipoInterpretacaoMarcacao;
  motivo: string | null;
  marcacoesPreservadas: MarcacaoPreservada[];
  possuiRegularizacao?: boolean;
  possuiDecisaoRh?: boolean;
  decisaoRh?: any;
}

export interface PontoRegularizacaoItemLike {
  valor: string;
  valorOriginal?: string | null;
  justificativa?: string;
  executadoPorNome?: string;
  created_at?: string;
}

export interface PontoLikeMarcacoes {
  entrada?: string | null;
  saida_almoco?: string | null;
  retorno_almoco?: string | null;
  saida?: string | null;
  status?: string | null;
  regularizacoes?: Partial<Record<CampoMarcacao, PontoRegularizacaoItemLike>> | null;
  decisao?: any | null;
  [key: string]: any;
}

export interface JornadaResolvidaLike {
  temJornadaConfigurada: boolean;
  trabalhavel: boolean;
  minutosPrevistos: number | null;
  tipoDia?: string;
  [key: string]: any;
}

export interface AvaliarMarcacoesPontoParams {
  ponto: PontoLikeMarcacoes;
  jornadaResolvida?: JornadaResolvidaLike | null;
  permiteJornadaSemIntervalo?: boolean;
  decisao?: any | null;
}

/**
 * Converte string de horário (HH:MM ou HH:MM:SS) em minutos a partir da meia-noite (0 a 1439).
 * Retorna null se formato for inválido ou fora dos limites cronológicos.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  if (typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(:(\d{2}))?$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

/**
 * Avalia a consistência e calcula os minutos trabalhados de um registro de ponto.
 *
 * Regras:
 * 1. Quatro marcações válidas (entrada < saida_almoco < retorno_almoco < saida):
 *    (saida_almoco - entrada) + (saida - retorno_almoco).
 * 2. Marcações incompletas (1, 3 ou campos faltantes):
 *    calculavel = false, minutos = null, zero efeito financeiro automático.
 * 3. Duas marcações sem autorização explícita:
 *    calculavel = false (exige regra explícita de jornada contínua).
 * 4. Zero marcações em dia trabalhável:
 *    FALTA_PENDENTE_JUSTIFICATIVA (retido para RH, sem débito cego automático).
 * 5. Zero marcações em dia não trabalhável (DSR/Folga/Feriado com 0 min previstos):
 *    calculavel = true, workedMinutes = 0, SEM_MARCACOES.
 * 6. Marcações em dia não trabalhável (DSR/Folga/Feriado):
 *    TRABALHO_EM_DIA_NAO_TRABALHAVEL (retido para RH, sem crédito automático).
 * 7. Marcações fora de ordem cronológica:
 *    MARCACAO_INVALIDA (calculavel = false, minutos = null).
 */
export function avaliarMarcacoesPonto(params: AvaliarMarcacoesPontoParams): AvaliacaoMarcacoesResult {
  const { ponto, jornadaResolvida, permiteJornadaSemIntervalo = false, decisao } = params;
  const decisaoAtiva = decisao || ponto?.decisao || null;
  const tipoDecisao = decisaoAtiva?.tipo_decisao || null;

  const camposEstruturados: CampoMarcacao[] = [
    "entrada",
    "saida_almoco",
    "retorno_almoco",
    "saida",
  ];

  // 1. Extração segura preservando exatamente os dados factuais e aplicando regularizações RH ativas
  const marcacoesPreservadas: MarcacaoPreservada[] = [];
  let possuiRegularizacao = false;

  for (const campo of camposEstruturados) {
    const reg = ponto.regularizacoes?.[campo];
    let valor: string | null = null;
    let origem: "IMPORTADA" | "REGULARIZADA_RH" = "IMPORTADA";
    let valorOriginal: string | null = null;

    if (reg && typeof reg.valor === "string" && reg.valor.trim() !== "") {
      valor = reg.valor.trim();
      origem = "REGULARIZADA_RH";
      const rawOriginal = ponto[campo];
      valorOriginal =
        typeof rawOriginal === "string" &&
        rawOriginal.trim() !== "" &&
        rawOriginal.trim().toLowerCase() !== "null"
          ? rawOriginal.trim()
          : null;
      possuiRegularizacao = true;
    } else {
      const raw = ponto[campo];
      if (typeof raw === "string" && raw.trim() !== "" && raw.trim().toLowerCase() !== "null") {
        valor = raw.trim();
        origem = "IMPORTADA";
      }
    }

    if (valor) {
      marcacoesPreservadas.push({
        campo,
        valor,
        origem,
        valorOriginal,
        justificativa: reg?.justificativa,
        executadoPorNome: reg?.executadoPorNome,
        dataIntervencao: reg?.created_at,
      });
    }
  }

  const count = marcacoesPreservadas.length;

  // 2. Validação de formato de hora para cada batida presente
  for (const m of marcacoesPreservadas) {
    const mins = parseTimeToMinutes(m.valor);
    if (mins === null) {
      return {
        calculavel: false,
        quantidadeMarcacoes: count,
        minutosTrabalhados: null,
        tipo: "MARCACAO_INVALIDA",
        motivo: `Formato de horário inválido no campo '${m.campo}': "${m.valor}".`,
        marcacoesPreservadas,
        possuiRegularizacao,
      };
    }
  }

  // 3. ZERO MARCAÇÕES
  if (count === 0) {
    const isNaoTrabalhavel =
      jornadaResolvida?.temJornadaConfigurada === true &&
      (jornadaResolvida.trabalhavel === false || jornadaResolvida.minutosPrevistos === 0);

    if (isNaoTrabalhavel) {
      return {
        calculavel: true,
        quantidadeMarcacoes: 0,
        minutosTrabalhados: 0,
        tipo: "SEM_MARCACOES",
        motivo: null,
        marcacoesPreservadas,
        possuiRegularizacao,
      };
    }

    const isTrabalhavel =
      jornadaResolvida?.temJornadaConfigurada === true &&
      jornadaResolvida.trabalhavel === true &&
      (jornadaResolvida.minutosPrevistos ?? 0) > 0;

    if (isTrabalhavel) {
      // Governança RH: decisão formal de confirmar falta injustificada
      if (tipoDecisao === "FALTA_INJUSTIFICADA_CONFIRMADA") {
        return {
          calculavel: true,
          quantidadeMarcacoes: 0,
          minutosTrabalhados: 0,
          tipo: "FALTA_CONFIRMADA",
          motivo: `Falta injustificada confirmada pelo RH: ${decisaoAtiva?.justificativa || ""}`.trim(),
          marcacoesPreservadas,
          possuiRegularizacao,
          possuiDecisaoRh: true,
          decisaoRh: decisaoAtiva,
        };
      }

      // Governança RH: decisão formal de abonar/justificar falta
      if (tipoDecisao === "FALTA_JUSTIFICADA_ABONADA") {
        return {
          calculavel: true,
          quantidadeMarcacoes: 0,
          minutosTrabalhados: 0,
          tipo: "FALTA_ABONADA",
          motivo: `Falta abonada/justificada pelo RH: ${decisaoAtiva?.justificativa || ""}`.trim(),
          marcacoesPreservadas,
          possuiRegularizacao,
          possuiDecisaoRh: true,
          decisaoRh: decisaoAtiva,
        };
      }

      return {
        calculavel: false,
        quantidadeMarcacoes: 0,
        minutosTrabalhados: null,
        tipo: "FALTA_PENDENTE_JUSTIFICATIVA",
        motivo:
          "Dia trabalhável sem marcações de ponto registradas. Retido para justificativa, abono ou regularização pelo RH.",
        marcacoesPreservadas,
        possuiRegularizacao,
      };
    }

    return {
      calculavel: false,
      quantidadeMarcacoes: 0,
      minutosTrabalhados: null,
      tipo: "SEM_MARCACOES",
      motivo: "Nenhuma marcação de ponto registrada.",
      marcacoesPreservadas,
      possuiRegularizacao,
    };
  }

  // 4. TRABALHO EM DIA NÃO TRABALHÁVEL
  const isDiaNaoTrabalhavel =
    jornadaResolvida?.temJornadaConfigurada === true &&
    (jornadaResolvida.trabalhavel === false || jornadaResolvida.minutosPrevistos === 0);

  if (isDiaNaoTrabalhavel && count > 0) {
    if (tipoDecisao === "DSR_DIRECIONADO_BANCO_HORAS" || tipoDecisao === "DSR_DIRECIONADO_HORA_EXTRA") {
      // Se a marcação for ímpar/incompleta, mantém bloqueio por incompletude para regularização prévia
      if (count === 1 || count === 3) {
        return {
          calculavel: false,
          quantidadeMarcacoes: count,
          minutosTrabalhados: null,
          tipo: "MARCACAO_INCOMPLETA",
          motivo:
            count === 1
              ? "Trabalho em repouso com apenas uma marcação. Regularize a batida faltante antes de processar o direcionamento."
              : "Trabalho em repouso com três marcações. Regularize a batida faltante antes de processar o direcionamento.",
          marcacoesPreservadas,
          possuiRegularizacao,
          possuiDecisaoRh: true,
          decisaoRh: decisaoAtiva,
        };
      }

      let minutosTrabalhadosFatuais: number | null = null;
      let erroCronologico: string | null = null;

      if (count === 4) {
        const itemEntrada = marcacoesPreservadas.find((m) => m.campo === "entrada");
        const itemSaidaAlmoco = marcacoesPreservadas.find((m) => m.campo === "saida_almoco");
        const itemRetornoAlmoco = marcacoesPreservadas.find((m) => m.campo === "retorno_almoco");
        const itemSaida = marcacoesPreservadas.find((m) => m.campo === "saida");

        if (itemEntrada && itemSaidaAlmoco && itemRetornoAlmoco && itemSaida) {
          const mEntrada = parseTimeToMinutes(itemEntrada.valor)!;
          const mSaidaAlmoco = parseTimeToMinutes(itemSaidaAlmoco.valor)!;
          const mRetornoAlmoco = parseTimeToMinutes(itemRetornoAlmoco.valor)!;
          const mSaida = parseTimeToMinutes(itemSaida.valor)!;

          if (mEntrada < mSaidaAlmoco && mSaidaAlmoco < mRetornoAlmoco && mRetornoAlmoco < mSaida) {
            minutosTrabalhadosFatuais = (mSaidaAlmoco - mEntrada) + (mSaida - mRetornoAlmoco);
          } else {
            erroCronologico = "Ordem cronológica das marcações em repouso é inválida.";
          }
        } else {
          return {
            calculavel: false,
            quantidadeMarcacoes: 4,
            minutosTrabalhados: null,
            tipo: "MARCACAO_INCOMPLETA",
            motivo: "Campos de marcação estruturados em repouso não correspondem ao conjunto completo.",
            marcacoesPreservadas,
            possuiRegularizacao,
            possuiDecisaoRh: true,
            decisaoRh: decisaoAtiva,
          };
        }
      } else if (count === 2) {
        const itemEntrada = marcacoesPreservadas.find((m) => m.campo === "entrada");
        const itemSaida = marcacoesPreservadas.find((m) => m.campo === "saida");

        if (itemEntrada && itemSaida) {
          const mEntrada = parseTimeToMinutes(itemEntrada.valor)!;
          const mSaida = parseTimeToMinutes(itemSaida.valor)!;
          if (mEntrada < mSaida) {
            minutosTrabalhadosFatuais = mSaida - mEntrada;
          } else {
            erroCronologico = "Horário de saída anterior ou igual ao horário de entrada.";
          }
        }
      }

      if (erroCronologico) {
        return {
          calculavel: false,
          quantidadeMarcacoes: count,
          minutosTrabalhados: null,
          tipo: "MARCACAO_INVALIDA",
          motivo: erroCronologico,
          marcacoesPreservadas,
          possuiRegularizacao,
          possuiDecisaoRh: true,
          decisaoRh: decisaoAtiva,
        };
      }

      if (minutosTrabalhadosFatuais !== null) {
        return {
          calculavel: true,
          quantidadeMarcacoes: count,
          minutosTrabalhados: minutosTrabalhadosFatuais,
          tipo:
            tipoDecisao === "DSR_DIRECIONADO_BANCO_HORAS"
              ? "DSR_DIRECIONADO_BH"
              : "DSR_DIRECIONADO_HE",
          motivo:
            tipoDecisao === "DSR_DIRECIONADO_BANCO_HORAS"
              ? `Trabalho em repouso/DSR direcionado ao Banco de Horas pelo RH: ${decisaoAtiva?.justificativa || ""}`.trim()
              : `Trabalho em repouso/DSR direcionado para pagamento de Hora Extra pelo RH: ${decisaoAtiva?.justificativa || ""}`.trim(),
          marcacoesPreservadas,
          possuiRegularizacao,
          possuiDecisaoRh: true,
          decisaoRh: decisaoAtiva,
        };
      }
    }

    return {
      calculavel: false,
      quantidadeMarcacoes: count,
      minutosTrabalhados: null,
      tipo: "TRABALHO_EM_DIA_NAO_TRABALHAVEL",
      motivo:
        "Trabalho registrado em dia não trabalhável (folga/DSR/feriado). Retido para direcionamento pelo RH (compensação ou hora extra).",
      marcacoesPreservadas,
      possuiRegularizacao,
    };
  }

  // 5. MARCAÇÕES ÍMPARES (1 OU 3 BATIDAS)
  if (count === 1 || count === 3) {
    return {
      calculavel: false,
      quantidadeMarcacoes: count,
      minutosTrabalhados: null,
      tipo: "MARCACAO_INCOMPLETA",
      motivo:
        count === 1
          ? "Apenas uma marcação registrada (marcação ímpar/incompleta)."
          : "Três marcações registradas (marcação ímpar/incompleta). Ausência de batida de fechamento de turno.",
      marcacoesPreservadas,
      possuiRegularizacao,
    };
  }

  // 6. DUAS MARCAÇÕES (AVALIAÇÃO CONSERVADORA)
  if (count === 2) {
    const itemEntrada = marcacoesPreservadas.find((m) => m.campo === "entrada");
    const itemSaida = marcacoesPreservadas.find((m) => m.campo === "saida");

    if (permiteJornadaSemIntervalo && itemEntrada && itemSaida) {
      const mEntrada = parseTimeToMinutes(itemEntrada.valor)!;
      const mSaida = parseTimeToMinutes(itemSaida.valor)!;

      if (mEntrada >= mSaida) {
        return {
          calculavel: false,
          quantidadeMarcacoes: 2,
          minutosTrabalhados: null,
          tipo: "MARCACAO_INVALIDA",
          motivo: "Horário de saída anterior ou igual ao horário de entrada.",
          marcacoesPreservadas,
          possuiRegularizacao,
        };
      }

      return {
        calculavel: true,
        quantidadeMarcacoes: 2,
        minutosTrabalhados: mSaida - mEntrada,
        tipo: "COMPLETA",
        motivo: null,
        marcacoesPreservadas,
        possuiRegularizacao,
      };
    }

    return {
      calculavel: false,
      quantidadeMarcacoes: 2,
      minutosTrabalhados: null,
      tipo: "MARCACAO_INCOMPLETA",
      motivo:
        "Marcação com apenas 2 batidas requer autorização ou regra explícita de jornada contínua sem intervalo.",
      marcacoesPreservadas,
      possuiRegularizacao,
    };
  }

  // 7. QUATRO MARCAÇÕES E VALIDAÇÃO CRONOLÓGICA
  if (count === 4) {
    const itemEntrada = marcacoesPreservadas.find((m) => m.campo === "entrada");
    const itemSaidaAlmoco = marcacoesPreservadas.find((m) => m.campo === "saida_almoco");
    const itemRetornoAlmoco = marcacoesPreservadas.find((m) => m.campo === "retorno_almoco");
    const itemSaida = marcacoesPreservadas.find((m) => m.campo === "saida");

    const hasAllFour = Boolean(itemEntrada && itemSaidaAlmoco && itemRetornoAlmoco && itemSaida);

    if (!hasAllFour) {
      return {
        calculavel: false,
        quantidadeMarcacoes: 4,
        minutosTrabalhados: null,
        tipo: "MARCACAO_INCOMPLETA",
        motivo: "Campos de marcação estruturados não correspondem ao conjunto completo (entrada, intervalo e saída).",
        marcacoesPreservadas,
        possuiRegularizacao,
      };
    }

    const mEntrada = parseTimeToMinutes(itemEntrada!.valor)!;
    const mSaidaAlmoco = parseTimeToMinutes(itemSaidaAlmoco!.valor)!;
    const mRetornoAlmoco = parseTimeToMinutes(itemRetornoAlmoco!.valor)!;
    const mSaida = parseTimeToMinutes(itemSaida!.valor)!;

    // Validação de ordem cronológica estrita: entrada < saida_almoco < retorno_almoco < saida
    if (!(mEntrada < mSaidaAlmoco && mSaidaAlmoco < mRetornoAlmoco && mRetornoAlmoco < mSaida)) {
      let motivoDetalhe = "Ordem cronológica das marcações é inválida.";
      if (mSaidaAlmoco <= mEntrada) {
        motivoDetalhe = "Saída para almoço anterior ou igual ao horário de entrada.";
      } else if (mRetornoAlmoco <= mSaidaAlmoco) {
        motivoDetalhe = "Retorno do almoço anterior ou igual à saída para almoço (intervalo negativo ou nulo).";
      } else if (mSaida <= mRetornoAlmoco) {
        motivoDetalhe = "Saída final anterior ou igual ao retorno do almoço.";
      }

      return {
        calculavel: false,
        quantidadeMarcacoes: 4,
        minutosTrabalhados: null,
        tipo: "MARCACAO_INVALIDA",
        motivo: motivoDetalhe,
        marcacoesPreservadas,
        possuiRegularizacao,
      };
    }

    const turno1 = mSaidaAlmoco - mEntrada;
    const turno2 = mSaida - mRetornoAlmoco;
    const minutosTrabalhados = turno1 + turno2;

    return {
      calculavel: true,
      quantidadeMarcacoes: 4,
      minutosTrabalhados,
      tipo: "COMPLETA",
      motivo: null,
      marcacoesPreservadas,
      possuiRegularizacao,
    };
  }

  // 8. QUANTIDADE ACIMA DE 4 MARCAÇÕES
  return {
    calculavel: false,
    quantidadeMarcacoes: count,
    minutosTrabalhados: null,
    tipo: "MARCACAO_INVALIDA",
    motivo: "Quantidade de marcações excede a capacidade estruturada de 4 batidas diárias.",
    marcacoesPreservadas,
    possuiRegularizacao,
  };
}

export const parseMarcacoesPonto = avaliarMarcacoesPonto;
