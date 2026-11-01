/**
 * ==============================================================================
 * SERVIÇO CANÔNICO: RemuneracaoResolver
 * Módulo: RH / Financeiro / Ponto CLT
 * Responsabilidade: DINHEIRO / REMUNERAÇÃO BASE
 * 
 * Regra Arquitetural:
 * - Serviço PURO: sem chamadas de rede ou banco de dados.
 * - Desacoplado de Jornada/Calendário: não decide dias trabalháveis, DSR, feriados ou batidas.
 * - Fonte Única da Verdade para derivação de valor-hora, valor-dia e divisores mensais.
 * - Elimina divisores espalhados e fallbacks concorrentes (/8, /220 locais).
 * ==============================================================================
 */

export interface ColaboradorRemuneracaoInput {
  modelo_calculo?: string | null;
  tipo_contrato?: string | null;
  regime_trabalho?: string | null;
  tipo_colaborador?: string | null;
  salario_base?: number | string | null;
  valor_base?: number | string | null;
  valor_hora?: number | string | null;
  valor_diaria?: number | string | null;
}

export interface ReferenciaGeralCLT {
  identificador: string;
  cargaSemanalMinutos: number;
  divisorMensal: number;
  divisorDiaFalta: number;
  vigenciaInicio?: string;
}

/**
 * Referência Geral CLT Vigente (44h semanais, divisor 220, mês comercial 30 dias).
 * Ponto ÚNICO central de definição da referência geral do sistema.
 */
export const REFERENCIA_GERAL_CLT_PADRAO: ReferenciaGeralCLT = {
  identificador: "CLT_PADRAO_VIGENTE_44H",
  cargaSemanalMinutos: 2640, // 44h semanais (44 * 60)
  divisorMensal: 220,        // Art. 64 da CLT e Súmula 431 do TST: (44 / 6) * 30 = 220
  divisorDiaFalta: 30,       // Art. 64 da CLT: 1/30 do salário mensal
  vigenciaInicio: "1943-05-01",
};

export type OrigemDivisor =
  | "JORNADA_CONFIGURADA"
  | "REFERENCIA_GERAL_CLT"
  | "NAO_APLICAVEL";

export type OrigemValorRemuneracao =
  | "SALARIO_BASE"
  | "VALOR_BASE"
  | "VALOR_HORA_DIRETO"
  | "VALOR_DIARIA_DIRETO"
  | "SEM_BASE";

export type ModeloAplicadoRemuneracao =
  | "CLT_MENSAL"
  | "DIARIA"
  | "HORISTA"
  | "PRODUCAO"
  | "INTERMITENTE"
  | "OUTRO"
  | "SEM_BASE";

export interface RemuneracaoResolverParams {
  colaborador: ColaboradorRemuneracaoInput | null | undefined;
  cargaSemanalMinutos?: number | null;
  referenciaGeral?: ReferenciaGeralCLT;
  minutosJornadaDia?: number | null;
  isJornadaConfigurada?: boolean;
}

export interface RemuneracaoResult {
  salarioMensal: number;
  divisorMensal: number;
  valorHora: number;
  valorDiaBase: number;
  modeloAplicado: ModeloAplicadoRemuneracao;
  origemValor: OrigemValorRemuneracao;
  origemDivisor: OrigemDivisor;
  cargaSemanalMinutosUtilizada: number | null;
  referenciaGeralUtilizada: ReferenciaGeralCLT | null;
}

/**
 * Converte de forma segura valor para número positivo.
 */
function safeNumber(val: unknown): number {
  if (val === null || val === undefined || val === "") return 0;
  const num = typeof val === "number" ? val : parseFloat(String(val).replace(",", "."));
  return isNaN(num) || num < 0 ? 0 : num;
}

/**
 * Deriva o divisor mensal a partir da carga horária semanal em minutos.
 * Fundamentação: Art. 64 CLT e Súmula 431 TST: (HorasSemanais / 6) * 30 = HorasSemanais * 5
 * Em minutos: (MinutosSemanais / 60) * 5 = MinutosSemanais / 12
 */
export function calcularDivisorMensalFromCargaSemanal(cargaSemanalMinutos: number): number {
  if (cargaSemanalMinutos <= 0) return 0;
  const divisor = cargaSemanalMinutos / 12;
  return Number(divisor.toFixed(4));
}

export class RemuneracaoResolver {
  /**
   * Resolve a remuneração base de forma determinística, pura e auditável.
   */
  static resolve(params: RemuneracaoResolverParams): RemuneracaoResult {
    const {
      colaborador,
      cargaSemanalMinutos,
      referenciaGeral = REFERENCIA_GERAL_CLT_PADRAO,
      minutosJornadaDia,
      isJornadaConfigurada = false,
    } = params;

    const modelo = String(colaborador?.modelo_calculo || "").trim().toUpperCase();
    const contrato = String(colaborador?.tipo_contrato || "").trim().toUpperCase();
    const tipoColab = String(colaborador?.tipo_colaborador || "").trim().toUpperCase();
    const regime = String(colaborador?.regime_trabalho || "").trim().toUpperCase();

    const valorHoraDireto = safeNumber(colaborador?.valor_hora);
    const salarioBase = safeNumber(colaborador?.salario_base);
    const valorDiaria = safeNumber(colaborador?.valor_diaria);
    const valorBase = safeNumber(colaborador?.valor_base);

    // Carga diária padrão em horas para regimes não mensalistas
    const jornadaDiariaHoras =
      typeof minutosJornadaDia === "number" && minutosJornadaDia > 0
        ? minutosJornadaDia / 60
        : 8;

    // -------------------------------------------------------------------------
    // 1. DIARISTA / DIÁRIA (preserva semântica de diária, zero divisor CLT)
    // -------------------------------------------------------------------------
    if (
      modelo === "DIÁRIA" ||
      modelo === "DIARIA" ||
      contrato === "DIARIA" ||
      contrato === "DIÁRIA" ||
      tipoColab === "DIARISTA" ||
      regime === "DIARISTA"
    ) {
      const diaBase = valorDiaria > 0 ? valorDiaria : valorBase > 0 ? valorBase : 0;
      const horaBase = jornadaDiariaHoras > 0 ? diaBase / jornadaDiariaHoras : 0;
      const origemValor: OrigemValorRemuneracao =
        valorDiaria > 0 ? "VALOR_DIARIA_DIRETO" : valorBase > 0 ? "VALOR_BASE" : "SEM_BASE";

      return {
        salarioMensal: 0,
        divisorMensal: 0,
        valorHora: Number(horaBase.toFixed(4)),
        valorDiaBase: Number(diaBase.toFixed(2)),
        modeloAplicado: "DIARIA",
        origemValor,
        origemDivisor: "NAO_APLICAVEL",
        cargaSemanalMinutosUtilizada: null,
        referenciaGeralUtilizada: null,
      };
    }

    // -------------------------------------------------------------------------
    // 2. HORISTA / HORA (preserva semântica de valor-hora direto)
    // -------------------------------------------------------------------------
    if (
      modelo === "HORISTA" ||
      contrato === "HORA" ||
      tipoColab === "HORISTA" ||
      regime === "HORISTA"
    ) {
      const horaBase = valorHoraDireto > 0 ? valorHoraDireto : valorBase > 0 ? valorBase : 0;
      const diaBase = horaBase * jornadaDiariaHoras;
      const origemValor: OrigemValorRemuneracao =
        valorHoraDireto > 0 ? "VALOR_HORA_DIRETO" : valorBase > 0 ? "VALOR_BASE" : "SEM_BASE";

      return {
        salarioMensal: 0,
        divisorMensal: 0,
        valorHora: Number(horaBase.toFixed(4)),
        valorDiaBase: Number(diaBase.toFixed(2)),
        modeloAplicado: "HORISTA",
        origemValor,
        origemDivisor: "NAO_APLICAVEL",
        cargaSemanalMinutosUtilizada: null,
        referenciaGeralUtilizada: null,
      };
    }

    // -------------------------------------------------------------------------
    // 3. PRODUÇÃO / OPERAÇÃO (preserva semântica de taxa operacional)
    // -------------------------------------------------------------------------
    if (
      modelo === "PRODUÇÃO" ||
      modelo === "PRODUCAO" ||
      contrato === "OPERAÇÃO" ||
      contrato === "OPERACAO" ||
      tipoColab === "PRODUÇÃO" ||
      tipoColab === "PRODUCAO" ||
      regime === "PRODUCAO" ||
      regime === "PRODUÇÃO"
    ) {
      const diaBase = valorBase > 0 ? valorBase : 0;
      const horaBase = jornadaDiariaHoras > 0 ? diaBase / jornadaDiariaHoras : 0;
      const origemValor: OrigemValorRemuneracao = valorBase > 0 ? "VALOR_BASE" : "SEM_BASE";

      return {
        salarioMensal: 0,
        divisorMensal: 0,
        valorHora: Number(horaBase.toFixed(4)),
        valorDiaBase: Number(diaBase.toFixed(2)),
        modeloAplicado: "PRODUCAO",
        origemValor,
        origemDivisor: "NAO_APLICAVEL",
        cargaSemanalMinutosUtilizada: null,
        referenciaGeralUtilizada: null,
      };
    }

    // -------------------------------------------------------------------------
    // 4. INTERMITENTE (não aplica divisor mensal CLT de 220)
    // -------------------------------------------------------------------------
    if (
      tipoColab === "INTERMITENTE" ||
      contrato === "INTERMITENTE" ||
      regime === "INTERMITENTE" ||
      modelo === "INTERMITENTE"
    ) {
      let horaBase = 0;
      let diaBase = 0;
      let origemValor: OrigemValorRemuneracao = "SEM_BASE";

      if (valorHoraDireto > 0) {
        horaBase = valorHoraDireto;
        diaBase = horaBase * jornadaDiariaHoras;
        origemValor = "VALOR_HORA_DIRETO";
      } else if (valorDiaria > 0) {
        diaBase = valorDiaria;
        horaBase = jornadaDiariaHoras > 0 ? diaBase / jornadaDiariaHoras : 0;
        origemValor = "VALOR_DIARIA_DIRETO";
      } else if (valorBase > 0) {
        // Para intermitente sem valor_hora/valor_diaria explícito, valor_base é tratado como taxa horária
        horaBase = valorBase;
        diaBase = horaBase * jornadaDiariaHoras;
        origemValor = "VALOR_BASE";
      }

      return {
        salarioMensal: 0,
        divisorMensal: 0,
        valorHora: Number(horaBase.toFixed(4)),
        valorDiaBase: Number(diaBase.toFixed(2)),
        modeloAplicado: "INTERMITENTE",
        origemValor,
        origemDivisor: "NAO_APLICAVEL",
        cargaSemanalMinutosUtilizada: null,
        referenciaGeralUtilizada: null,
      };
    }

    // -------------------------------------------------------------------------
    // 5. CLT MENSAL / MENSALISTA
    // -------------------------------------------------------------------------
    const isMensal =
      modelo === "CLT_MENSAL" ||
      modelo === "MENSAL" ||
      contrato === "MENSAL" ||
      tipoColab === "CLT" ||
      regime === "CLT" ||
      salarioBase > 0;

    if (isMensal) {
      // 5.1 Precedência Salarial
      let salario = 0;
      let origemValor: OrigemValorRemuneracao = "SEM_BASE";

      if (salarioBase > 0) {
        salario = salarioBase;
        origemValor = "SALARIO_BASE";
      } else if (valorBase > 0) {
        salario = valorBase;
        origemValor = "VALOR_BASE";
      } else if (valorHoraDireto > 0) {
        salario = 0;
        origemValor = "VALOR_HORA_DIRETO";
      }

      // 5.2 Resolução da Origem do Divisor
      let divisorMensal: number;
      let origemDivisor: OrigemDivisor;
      let cargaUtilizada: number;

      const hasJornadaValida =
        Boolean(isJornadaConfigurada) &&
        typeof cargaSemanalMinutos === "number" &&
        cargaSemanalMinutos > 0;

      if (hasJornadaValida) {
        divisorMensal = calcularDivisorMensalFromCargaSemanal(cargaSemanalMinutos!);
        origemDivisor = "JORNADA_CONFIGURADA";
        cargaUtilizada = cargaSemanalMinutos!;
      } else {
        divisorMensal = referenciaGeral.divisorMensal;
        origemDivisor = "REFERENCIA_GERAL_CLT";
        cargaUtilizada = referenciaGeral.cargaSemanalMinutos;
      }

      // 5.3 Cálculo do Valor-Hora
      let horaBase = 0;
      if (valorHoraDireto > 0) {
        horaBase = valorHoraDireto;
      } else if (salario > 0 && divisorMensal > 0) {
        horaBase = salario / divisorMensal;
      }

      // 5.4 Cálculo do Salário-Dia / Falta (Art. 64 CLT: 1/30)
      const divisorDia = referenciaGeral.divisorDiaFalta > 0 ? referenciaGeral.divisorDiaFalta : 30;
      let diaBase = 0;
      if (salario > 0) {
        diaBase = salario / divisorDia;
      } else if (horaBase > 0 && divisorMensal > 0) {
        diaBase = horaBase * (divisorMensal / divisorDia);
      }

      return {
        salarioMensal: Number(salario.toFixed(2)),
        divisorMensal: Number(divisorMensal.toFixed(4)),
        valorHora: Number(horaBase.toFixed(4)),
        valorDiaBase: Number(diaBase.toFixed(2)),
        modeloAplicado: "CLT_MENSAL",
        origemValor,
        origemDivisor,
        cargaSemanalMinutosUtilizada: cargaUtilizada,
        referenciaGeralUtilizada: origemDivisor === "REFERENCIA_GERAL_CLT" ? referenciaGeral : null,
      };
    }

    // -------------------------------------------------------------------------
    // 6. AUSÊNCIA DE BASE / OUTRO
    // -------------------------------------------------------------------------
    const temAlgumaBase =
      valorHoraDireto > 0 || salarioBase > 0 || valorDiaria > 0 || valorBase > 0;

    if (!temAlgumaBase) {
      return {
        salarioMensal: 0,
        divisorMensal: 0,
        valorHora: 0,
        valorDiaBase: 0,
        modeloAplicado: "SEM_BASE",
        origemValor: "SEM_BASE",
        origemDivisor: "NAO_APLICAVEL",
        cargaSemanalMinutosUtilizada: null,
        referenciaGeralUtilizada: null,
      };
    }

    // Fallback residual genérico caso exista base mas regime seja não identificado
    const horaBase =
      valorHoraDireto > 0
        ? valorHoraDireto
        : valorDiaria > 0 && jornadaDiariaHoras > 0
          ? valorDiaria / jornadaDiariaHoras
          : valorBase > 0 && jornadaDiariaHoras > 0
            ? valorBase / jornadaDiariaHoras
            : 0;

    const diaBase = valorDiaria > 0 ? valorDiaria : horaBase * jornadaDiariaHoras;

    return {
      salarioMensal: 0,
      divisorMensal: 0,
      valorHora: Number(horaBase.toFixed(4)),
      valorDiaBase: Number(diaBase.toFixed(2)),
      modeloAplicado: "OUTRO",
      origemValor: valorHoraDireto > 0 ? "VALOR_HORA_DIRETO" : valorDiaria > 0 ? "VALOR_DIARIA_DIRETO" : "VALOR_BASE",
      origemDivisor: "NAO_APLICAVEL",
      cargaSemanalMinutosUtilizada: null,
      referenciaGeralUtilizada: null,
    };
  }
}
