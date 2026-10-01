/**
 * rhPresentation.service.ts
 *
 * FIX 04.2-E — Sinalização das Pendências CLT na Interface RH
 *
 * Mapeia e traduz o estado dos 4 Gates homologados do Pipeline CLT para
 * a camada visual do usuário, garantindo:
 * 1. Respeito rigoroso à precedência (Cadastro -> Jornada -> Regra de Banco -> Marcações).
 * 2. Ausência total de saldos ou horas extras calculadas hipotéticas quando bloqueado ("—").
 * 3. Marcações factuais preservadas (quando ausente, "—", NUNCA "00:00").
 * 4. Linguagem operacional clara e amigável (sem "fallback", "isFallback", "null", etc.).
 */

import { JornadaResolver } from "./operationalEngine/JornadaResolver";
import { JornadaTrabalho } from "@/types/jornada.types";
import MotorExecutavel from "./operationalEngine/MotorIndex";
import { avaliarMarcacoesPonto } from "./operationalEngine/MarcacoesPontoParser";

export type StatusVisualPonto =
  | "PROCESSADO"
  | "CADASTRO_PENDENTE"
  | "JORNADA_NAO_PARAMETRIZADA"
  | "REGRA_BANCO_NAO_PARAMETRIZADA"
  | "MARCACAO_INCOMPLETA"
  | "MARCACAO_INVALIDA"
  | "FALTA_PENDENTE_JUSTIFICATIVA"
  | "TRABALHO_EM_DIA_NAO_TRABALHAVEL"
  | "INCONSISTENTE"
  | "APTO_PROCESSAMENTO";

export interface MarcacaoDetalheVisual {
  valor: string;
  origem: "IMPORTADA" | "REGULARIZADA_RH";
  valorOriginal?: string | null;
  justificativa?: string | null;
  executadoPorNome?: string | null;
  dataIntervencao?: string | null;
}

export interface FactualPunches {
  entrada: string;
  saida_almoco: string;
  retorno_almoco: string;
  saida: string;
  quantidadePreservada: number;
  detalhes?: Record<"entrada" | "saida_almoco" | "retorno_almoco" | "saida", MarcacaoDetalheVisual>;
  possuiRegularizacao?: boolean;
}

export interface PontoPresentationInfo {
  statusVisual: StatusVisualPonto;
  badgeLabel: string;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  badgeClassName: string;
  titulo: string;
  explicacao: string;
  acaoNecessaria: string | null;
  isBloqueado: boolean;
  isProcessado: boolean;
  isPendente: boolean;
  marcacoes: FactualPunches;
  horasBrutas: string;
  horasExtra: string;
  atraso: string;
  saldoDia: string;
  saldoAcumulado: string;
  jornadaPrevistaHours: number | null;
  jornadaNome: string;
  regraNome: string;
  resumoRegra: string;
}

export const minutesToTime = (totalMinutes: number): string => {
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${hours}h ${minutes}m`;
};

/**
 * Extrai e formata as 4 marcações físicas sem nunca inventar horários.
 * Quando o horário estiver ausente, retorna "—" (NUNCA "00:00").
 * Preserva distinção clara entre batida importada e regularizada pelo RH.
 */
export function formatFactualPunches(ponto: any): FactualPunches {
  const formatPunch = (val?: string | null): string => {
    if (
      !val ||
      typeof val !== "string" ||
      val.trim() === "" ||
      val.trim().toLowerCase() === "null"
    ) {
      return "—";
    }
    const trimmed = val.trim();
    return trimmed.length >= 5 ? trimmed.slice(0, 5) : trimmed;
  };

  const campos: Array<"entrada" | "saida_almoco" | "retorno_almoco" | "saida"> = [
    "entrada",
    "saida_almoco",
    "retorno_almoco",
    "saida",
  ];

  const detalhes: Record<"entrada" | "saida_almoco" | "retorno_almoco" | "saida", MarcacaoDetalheVisual> = {} as any;
  let possuiRegularizacao = false;
  let count = 0;

  for (const campo of campos) {
    const reg = ponto?.regularizacoes?.[campo];
    if (reg && reg.valor) {
      possuiRegularizacao = true;
      detalhes[campo] = {
        valor: formatPunch(reg.valor),
        origem: "REGULARIZADA_RH",
        valorOriginal: formatPunch(ponto?.[campo]),
        justificativa: reg.justificativa,
        executadoPorNome: reg.executadoPorNome,
        dataIntervencao: reg.created_at,
      };
      if (detalhes[campo].valor !== "—") count++;
    } else {
      const formatted = formatPunch(ponto?.[campo]);
      detalhes[campo] = {
        valor: formatted,
        origem: "IMPORTADA",
        valorOriginal: null,
      };
      if (formatted !== "—") count++;
    }
  }

  return {
    entrada: detalhes.entrada.valor,
    saida_almoco: detalhes.saida_almoco.valor,
    retorno_almoco: detalhes.retorno_almoco.valor,
    saida: detalhes.saida.valor,
    quantidadePreservada: count,
    detalhes,
    possuiRegularizacao,
  };
}

export interface ResolvePontoPresentationParams {
  ponto: any;
  colaborador?: any | null;
  jornadas?: JornadaTrabalho[];
  regras?: any[];
  empresaNome?: string | null;
  tenantId?: string;
}

/**
 * Avalia o registro de ponto frente aos 4 Gates de Segurança e retorna
 * as informações consolidadas para apresentação na UI do RH.
 */
export function resolvePontoPresentation(
  params: ResolvePontoPresentationParams,
): PontoPresentationInfo {
  const {
    ponto,
    colaborador,
    jornadas = [],
    regras = [],
    empresaNome,
    tenantId = ponto?.tenant_id || "",
  } = params;

  const marcacoes = formatFactualPunches(ponto);
  const statusProc = String(ponto?.status_processamento || "").toUpperCase();
  const isProcessado = statusProc === "PROCESSADO";

  // =========================================================================
  // CASO 1: PONTO JÁ PROCESSADO NO BANCO
  // =========================================================================
  if (isProcessado) {
    const extra = Number(ponto?.minutos_extra || 0);
    const atraso = Number(ponto?.minutos_atraso || 0);
    const saldoDia = Number(ponto?.saldo_dia || 0);
    const saldoAcumulado = Number(ponto?.saldo_acumulado_minutos || 0);

    return {
      statusVisual: "PROCESSADO",
      badgeLabel: "Processado",
      badgeVariant: "default",
      badgeClassName: "bg-success-soft text-success border-0",
      titulo: "Processamento Concluído",
      explicacao: `Registro calculado e consolidado pelo Motor RH. Regra aplicada: ${ponto?.regra_aplicada || "Regra Padrão"}.`,
      acaoNecessaria: null,
      isBloqueado: false,
      isProcessado: true,
      isPendente: false,
      marcacoes,
      horasBrutas: minutesToTime(Number(ponto?.jornada_calculada || 8) * 60),
      horasExtra: extra > 0 ? minutesToTime(extra) : "—",
      atraso: atraso > 0 ? minutesToTime(atraso) : "—",
      saldoDia: minutesToTime(saldoDia),
      saldoAcumulado: minutesToTime(saldoAcumulado),
      jornadaPrevistaHours: Number(ponto?.jornada_calculada || 8),
      jornadaNome: ponto?.regra_aplicada || "Jornada Padrão",
      regraNome: ponto?.regra_aplicada || "Regra Padrão",
      resumoRegra: ponto?.regra_aplicada || "Processado",
    };
  }

  // =========================================================================
  // CASO 2: PONTO NÃO PROCESSADO / PENDENTE (AVALIAÇÃO DOS 4 GATES)
  // REGRA FUNDAMENTAL: Enquanto bloqueado, saldos = "—"
  // =========================================================================
  const emptyFinance = {
    horasExtra: "—",
    atraso: "—",
    saldoDia: "—",
    saldoAcumulado: "—",
    isProcessado: false,
    isPendente: true,
  };

  // -------------------------------------------------------------------------
  // GATE 1 — CADASTRAL (PRECEDÊNCIA MÁXIMA)
  // -------------------------------------------------------------------------
  const isColaboradorInvalido =
    !colaborador ||
    colaborador.cadastro_provisorio === true ||
    colaborador.status_cadastro === "pendente_complemento" ||
    !colaborador.empresa_id ||
    !colaborador.tipo_contrato ||
    !colaborador.modelo_calculo ||
    !colaborador.valor_base;

  if (isColaboradorInvalido) {
    return {
      statusVisual: "CADASTRO_PENDENTE",
      badgeLabel: "Cadastro Pendente",
      badgeVariant: "warning",
      badgeClassName: "bg-warning-soft text-warning border-0",
      titulo: "Cadastro Pendente",
      explicacao:
        "Cadastro do colaborador pendente de complemento (dados cadastrais ou contratuais incompletos).",
      acaoNecessaria: "Completar dados contratuais na Central de Cadastros.",
      isBloqueado: true,
      marcacoes,
      horasBrutas: "—",
      ...emptyFinance,
      jornadaPrevistaHours: null,
      jornadaNome: "—",
      regraNome: "Aguardando Cadastro",
      resumoRegra: "Cadastro pendente de complemento",
    };
  }

  // -------------------------------------------------------------------------
  // GATE 2 — JORNADA DE TRABALHO
  // -------------------------------------------------------------------------
  const resolucaoJornada = JornadaResolver.resolveSync({
    tenantId,
    data: ponto.data,
    colaboradorId: colaborador?.id || null,
    colaboradorJornadaId: colaborador?.jornada_id || null,
    empresaId: colaborador?.empresa_id || ponto.empresa_id || null,
    jornadasDisponiveis: jornadas,
  });

  if (!resolucaoJornada.temJornadaConfigurada) {
    return {
      statusVisual: "JORNADA_NAO_PARAMETRIZADA",
      badgeLabel: "Jornada Não Parametrizada",
      badgeVariant: "destructive",
      badgeClassName: "bg-destructive/15 text-destructive border-0",
      titulo: "Jornada Não Parametrizada",
      explicacao:
        "Não existe uma jornada de trabalho válida configurada para este colaborador/empresa nesta data.",
      acaoNecessaria: "Ação necessária: Configurar jornada de trabalho.",
      isBloqueado: true,
      marcacoes,
      horasBrutas: "—",
      ...emptyFinance,
      jornadaPrevistaHours: null,
      jornadaNome: "SEM_JORNADA",
      regraNome: "Sem Jornada",
      resumoRegra: "Jornada de trabalho não configurada",
    };
  }

  // -------------------------------------------------------------------------
  // GATE 3 — REGRA DE BANCO DE HORAS (BLOQUEIO DE FALLBACK)
  // -------------------------------------------------------------------------
  const tipoColab = colaborador?.tipo_colaborador || "CLT";
  const calendario = MotorExecutavel.Calendar.getCalendario(ponto.data, tipoColab);
  const motorCtx = {
    tenantId,
    empresaId: colaborador?.empresa_id || ponto.empresa_id || null,
    colaboradorId: colaborador?.id || null,
    operacaoId: null,
    dataProcessamento: ponto.data,
    tipoColaborador: tipoColab,
    calendario,
  };

  const { rule: abstractRegra, isFallback } = MotorExecutavel.resolveRule(
    motorCtx,
    regras,
  );

  if (isFallback) {
    return {
      statusVisual: "REGRA_BANCO_NAO_PARAMETRIZADA",
      badgeLabel: "Regra de Banco Não Parametrizada",
      badgeVariant: "destructive",
      badgeClassName: "bg-destructive/15 text-destructive border-0",
      titulo: "Regra de Banco Não Parametrizada",
      explicacao:
        "A jornada foi identificada, mas não existe uma política de banco de horas/compensação configurada.",
      acaoNecessaria: "Ação necessária: Configurar regra de banco de horas.",
      isBloqueado: true,
      marcacoes,
      horasBrutas: "—",
      ...emptyFinance,
      jornadaPrevistaHours:
        typeof resolucaoJornada.minutosPrevistos === "number"
          ? Number((resolucaoJornada.minutosPrevistos / 60).toFixed(2))
          : null,
      jornadaNome: resolucaoJornada.jornadaId || "Jornada Configurada",
      regraNome: "Sem Regra de Banco",
      resumoRegra: "Regra de banco de horas não configurada",
    };
  }

  // -------------------------------------------------------------------------
  // GATE 4 — CONSISTÊNCIA DAS MARCAÇÕES
  // -------------------------------------------------------------------------
  const avaliacaoMarcacoes = avaliarMarcacoesPonto({
    ponto,
    jornadaResolvida: resolucaoJornada,
    decisao: (ponto as any)?.decisao,
  });

  const jornadaPrevistaHours =
    typeof resolucaoJornada.minutosPrevistos === "number"
      ? Number((resolucaoJornada.minutosPrevistos / 60).toFixed(2))
      : 8;

  if (!avaliacaoMarcacoes.calculavel) {
    if (avaliacaoMarcacoes.tipo === "MARCACAO_INCOMPLETA") {
      return {
        statusVisual: "MARCACAO_INCOMPLETA",
        badgeLabel: "Marcação Incompleta",
        badgeVariant: "warning",
        badgeClassName: "bg-warning-soft text-warning border-0",
        titulo: "Marcação Incompleta",
        explicacao:
          "Existem marcações de ponto insuficientes para calcular a jornada com segurança.",
        acaoNecessaria:
          "Aguardar registro completo ou solicitar regularização de ponto pelo colaborador.",
        isBloqueado: true,
        marcacoes,
        horasBrutas: "—",
        ...emptyFinance,
        jornadaPrevistaHours,
        jornadaNome: resolucaoJornada.jornadaId || "Jornada Configurada",
        regraNome: abstractRegra.nome || "Regra Configurada",
        resumoRegra: "Marcação incompleta retida para RH",
      };
    }

    if (avaliacaoMarcacoes.tipo === "MARCACAO_INVALIDA") {
      return {
        statusVisual: "MARCACAO_INVALIDA",
        badgeLabel: "Marcação Inválida",
        badgeVariant: "destructive",
        badgeClassName: "bg-destructive/15 text-destructive border-0",
        titulo: "Marcação Inválida",
        explicacao:
          "As marcações possuem uma sequência de horários incompatível com o cálculo automático.",
        acaoNecessaria: "Verificar consistência dos horários do coletor.",
        isBloqueado: true,
        marcacoes,
        horasBrutas: "—",
        ...emptyFinance,
        jornadaPrevistaHours,
        jornadaNome: resolucaoJornada.jornadaId || "Jornada Configurada",
        regraNome: abstractRegra.nome || "Regra Configurada",
        resumoRegra: "Marcação inválida retida para RH",
      };
    }

    if (avaliacaoMarcacoes.tipo === "FALTA_PENDENTE_JUSTIFICATIVA") {
      return {
        statusVisual: "FALTA_PENDENTE_JUSTIFICATIVA",
        badgeLabel: "Falta Pendente de Justificativa",
        badgeVariant: "warning",
        badgeClassName: "bg-warning-soft text-warning border-0",
        titulo: "Falta Pendente de Justificativa",
        explicacao:
          "Era um dia previsto de trabalho, mas não existem marcações suficientes para confirmar a jornada.",
        acaoNecessaria: "Aguardar envio de atestado, justificativa ou abono pelo RH.",
        isBloqueado: true,
        marcacoes,
        horasBrutas: "—",
        ...emptyFinance,
        jornadaPrevistaHours,
        jornadaNome: resolucaoJornada.jornadaId || "Jornada Configurada",
        regraNome: abstractRegra.nome || "Regra Configurada",
        resumoRegra: "Ausência pendente de justificativa pelo RH",
      };
    }

    if (avaliacaoMarcacoes.tipo === "TRABALHO_EM_DIA_NAO_TRABALHAVEL") {
      return {
        statusVisual: "TRABALHO_EM_DIA_NAO_TRABALHAVEL",
        badgeLabel: "Trabalho em Dia Não Trabalhável",
        badgeVariant: "outline",
        badgeClassName: "border-primary/40 text-primary bg-primary/5",
        titulo: "Trabalho em Dia Não Trabalhável",
        explicacao:
          "Foram encontradas marcações em um dia configurado como não trabalhável.",
        acaoNecessaria:
          "Definir direcionamento pelo RH (compensação ou hora extra).",
        isBloqueado: true,
        marcacoes,
        horasBrutas: "—",
        ...emptyFinance,
        jornadaPrevistaHours: 0,
        jornadaNome: resolucaoJornada.jornadaId || "Dia Não Trabalhável",
        regraNome: abstractRegra.nome || "Regra Configurada",
        resumoRegra: "Trabalho em repouso retido para decisão do RH",
      };
    }
  }

  // -------------------------------------------------------------------------
  // TODOS OS 4 GATES APROVADOS (APTO PARA PROCESSAMENTO)
  // -------------------------------------------------------------------------
  const workedMins = avaliacaoMarcacoes.minutosTrabalhados ?? 0;
  const decisaoAtiva = (ponto as any)?.decisao || avaliacaoMarcacoes.decisaoRh;

  const badgeLabel = decisaoAtiva
    ? decisaoAtiva.tipo_decisao === "FALTA_INJUSTIFICADA_CONFIRMADA"
      ? "Falta Confirmada"
      : decisaoAtiva.tipo_decisao === "FALTA_JUSTIFICADA_ABONADA"
        ? "Falta Abonada"
        : decisaoAtiva.tipo_decisao === "DSR_DIRECIONADO_BANCO_HORAS"
          ? "DSR → Banco de Horas"
          : "DSR → Hora Extra"
    : "Apto para Processamento";

  const badgeClassName = decisaoAtiva
    ? decisaoAtiva.tipo_decisao === "FALTA_INJUSTIFICADA_CONFIRMADA"
      ? "bg-destructive/15 text-destructive border-0"
      : decisaoAtiva.tipo_decisao === "FALTA_JUSTIFICADA_ABONADA"
        ? "bg-success-soft text-success border-0"
        : "bg-primary-soft text-primary border-0"
    : "bg-info-soft text-info border-0";

  const explicacao = decisaoAtiva
    ? `Apto para processamento com Decisão RH ativa (${decisaoAtiva.tipo_decisao}). Justificativa: ${decisaoAtiva.justificativa}`
    : "Todos os 4 Gates foram atendidos com sucesso. O ponto está pronto para ser processado pelo Motor RH.";

  return {
    statusVisual: "APTO_PROCESSAMENTO",
    badgeLabel,
    badgeVariant: "secondary",
    badgeClassName,
    titulo: decisaoAtiva ? `Decisão RH: ${badgeLabel}` : "Apto para Processamento",
    explicacao,
    acaoNecessaria: "Ponto pronto para cálculo na execução do Motor RH.",
    isBloqueado: false,
    marcacoes,
    horasBrutas: minutesToTime(workedMins),
    ...emptyFinance,
    jornadaPrevistaHours,
    jornadaNome: resolucaoJornada.jornadaId || "Jornada Configurada",
    regraNome: abstractRegra.nome || "Regra Configurada",
    resumoRegra: decisaoAtiva ? `Decisão RH: ${decisaoAtiva.tipo_decisao}` : "Apto para processamento",
    decisao: decisaoAtiva || null,
  };
}
