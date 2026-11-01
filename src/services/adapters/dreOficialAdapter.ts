import { OperationalIntegrityKPIs, DashboardConsolidadoService } from "@/services/dashboard.service";

/**
 * ADAPTER OFICIAL DE APRESENTAÇÃO — RESULTADO OPERACIONAL (DRE)
 * Mapeia os dados econômicos reais providos pelo DashboardConsolidadoService
 * para a interface analítica e executiva da UX03.
 *
 * ZERO MOCKS. ZERO DADOS FICTÍCIOS.
 * Preserva o motor financeiro e a competência canônica (YYYY-MM).
 */

export const ORBE_BLUE_SCALE = {
  clt: "#1D4ED8",          // Folha CLT (Azul Royal Profundo)
  diaristas: "#2563EB",    // Diaristas Operacionais (Azul Primário)
  intermitentes: "#3B82F6",// Trabalhadores Intermitentes (Azul Médio)
  custosExtras: "#60A5FA", // Custos Extras & Logística (Azul Suave)
  receita: "#64748B",      // Receita Operacional (Slate Estrutural)
};

export interface DREKpiDelta {
  value: string;
  isPositive?: boolean;
  isNeutral?: boolean;
}

export interface DREKpiCardData {
  label: string;
  value: number;
  formatted: string;
  delta?: DREKpiDelta;
  subtitle: string;
}

export interface DREKpiGroup {
  receita: DREKpiCardData;
  custos: DREKpiCardData;
  resultado: DREKpiCardData;
  margem: DREKpiCardData;
}

export interface DRELedgerDetailItem {
  label: string;
  valor: number;
  percentualPai: number;
  nota?: string;
}

export interface DRELedgerItem {
  id: "receita-operacional" | "folha-clt" | "diaristas" | "intermitentes" | "custos-extras";
  tipo: "receita" | "deducao";
  sinal: "+" | "-";
  label: string;
  descricao: string;
  valor: number;
  percentualReceita: number;
  deltaPercent: number;
  diffNominal?: number;
  diffPct?: number;
  compValor?: number;
  variacaoTexto?: string;
  variacaoStatus?: DREVariationStatus;
  formattedNominalDiff?: string;
  cor: string;
  detalhes: DRELedgerDetailItem[];
}

export interface DREComposicaoItem {
  nome: string;
  valor: number;
  percentual: number;
  cor: string;
}

export interface DREEmpresaItem {
  id: string;
  empresa: string;
  receita: number;
  custos: number;
  resultado: number;
  margem: number;
  deltaReceita?: number;
  deltaMargem?: number;
}

export interface DRETendenciaItem {
  mes: string;
  mesKey: string;
  receita: number;
  custos: number;
  resultado: number;
  margem: number;
  isCurrent: boolean;
}

export interface DREDrawerOrigin {
  label: string;
  route: string;
  tooltip: string;
}

export interface DREDrawerData {
  id: string;
  label: string;
  tipo: "receita" | "deducao";
  sinal: "+" | "-";
  valor: number;
  percentualReceita: number;
  deltaPercent: number;
  descricao: string;
  criterioReconhecimento: string;
  origemModulo: DREDrawerOrigin;
  subcontas: Array<{
    label: string;
    valor: number;
    percentualPai: number;
    observacao: string;
  }>;
}

// ── FORMATADORES ─────────────────────────────────────────────────────────────

export const formatBRL = (val: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(val);

export const formatBRLDecimal = (val: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);

export const formatPercent = (val: number, decimals = 1): string =>
  `${val.toFixed(decimals)}%`;

export const formatNominalDiff = (val: number): string => {
  if (val === 0) return "R$ 0";
  const formatted = formatBRL(Math.abs(val));
  return val > 0 ? `+${formatted}` : `-${formatted}`;
};

export const formatPercentDiff = (val: number, decimals = 1): string => {
  const formatted = Math.abs(val).toFixed(decimals).replace(".", ",");
  if (val === 0) return "0,0%";
  return val > 0 ? `+${formatted}%` : `−${formatted}%`;
};

// ── MOTOR SEMÂNTICO DE VARIAÇÃO (CONV-13-FIX02) ───────────────────────────────

export type DREVariationStatus = "sem_variacao" | "sem_base" | "calculado";

export interface DREVariationResult {
  status: DREVariationStatus;
  diffNominal: number;
  diffPct?: number;
  formattedNominal: string;
  formattedPercent: string;
  isPositive: boolean;
  isNegative: boolean;
  isNeutral: boolean;
}

/**
 * Trata as variações comparativas conforme a matriz semântica oficial:
 * | Período principal | Comparativo | Apresentação |
 * | R$ 0              | R$ 0        | Sem variação (delta nominal R$ 0, sem setas, cor neutra) |
 * | R$ 0              | R$ 100      | −100,0% |
 * | R$ 100            | R$ 0        | Sem base comparativa (preserva delta nominal, sem taxa fabricada) |
 * | R$ 120            | R$ 100      | +20,0% |
 * | R$ 80             | R$ 100      | −20,0% |
 */
export function calculateDREVariation(
  vAtual: number,
  vComp?: number | null,
  isReceitaOrResultado = true
): DREVariationResult {
  if (vComp === undefined || vComp === null) {
    return {
      status: "sem_variacao",
      diffNominal: 0,
      formattedNominal: "R$ 0",
      formattedPercent: "Sem variação",
      isPositive: false,
      isNegative: false,
      isNeutral: true,
    };
  }

  // 1. Ambos zerados: R$ 0 × R$ 0 -> Sem variação
  if (vAtual === 0 && vComp === 0) {
    return {
      status: "sem_variacao",
      diffNominal: 0,
      diffPct: 0,
      formattedNominal: "R$ 0",
      formattedPercent: "Sem variação",
      isPositive: false,
      isNegative: false,
      isNeutral: true,
    };
  }

  const diffNominal = vAtual - vComp;
  const formattedNom = formatNominalDiff(diffNominal);

  // 2. Principal diferente de zero × Comparativo zero: R$ 100 × R$ 0 -> Sem base comparativa
  if (vComp === 0 && vAtual !== 0) {
    return {
      status: "sem_base",
      diffNominal,
      diffPct: undefined, // não fabrica taxa percentual artificial
      formattedNominal: formattedNom,
      formattedPercent: "Sem base comparativa",
      isPositive: false,
      isNegative: false,
      isNeutral: true,
    };
  }

  // 3. Principal zero × Comparativo > 0: R$ 0 × R$ 100 -> −100,0%
  // 4. Ambos positivos/não nulos: R$ 120 × R$ 100 -> +20,0%, R$ 80 × R$ 100 -> −20,0%
  const pct = (diffNominal / Math.abs(vComp)) * 100;
  const formattedPct = formatPercentDiff(pct, 1);

  const isPos = isReceitaOrResultado ? diffNominal > 0 : diffNominal < 0;
  const isNeg = isReceitaOrResultado ? diffNominal < 0 : diffNominal > 0;

  return {
    status: "calculado",
    diffNominal,
    diffPct: pct,
    formattedNominal: formattedNom,
    formattedPercent: formattedPct,
    isPositive: isPos,
    isNegative: isNeg,
    isNeutral: diffNominal === 0,
  };
}

// ── CONVERSÃO DOS 4 KPIS ──────────────────────────────────────────────────────

export function buildDREKpis(
  kpisAtual?: OperationalIntegrityKPIs | null,
  kpisComp?: OperationalIntegrityKPIs | null,
  isComparing = false,
  compLabel = "mês anterior"
): DREKpiGroup {
  const receitaAtual = kpisAtual?.faturamentoTotal ?? 0;
  const custosAtual = (kpisAtual?.finValorAprovado ?? 0) + (kpisAtual?.custosGerais ?? 0);
  const resultadoAtual = kpisAtual?.lucroReal ?? 0;
  const margemAtual = receitaAtual > 0 ? (resultadoAtual / receitaAtual) * 100 : 0;

  const receitaComp = kpisComp?.faturamentoTotal ?? 0;
  const custosComp = (kpisComp?.finValorAprovado ?? 0) + (kpisComp?.custosGerais ?? 0);
  const resultadoComp = kpisComp?.lucroReal ?? 0;
  const margemComp = receitaComp > 0 ? (resultadoComp / receitaComp) * 100 : 0;

  const hasComp = Boolean(kpisComp);

  const deltaReceita = calculateDREVariation(receitaAtual, hasComp ? receitaComp : null, true);
  const deltaCustos = calculateDREVariation(custosAtual, hasComp ? custosComp : null, false);
  const deltaResultado = calculateDREVariation(resultadoAtual, hasComp ? resultadoComp : null, true);

  // Delta Margem (estritamente em pontos percentuais)
  let deltaMargem: DREKpiDelta | undefined = undefined;
  if (hasComp) {
    if (receitaAtual === 0 && receitaComp === 0) {
      deltaMargem = {
        value: "Sem variação",
        isNeutral: true,
      };
    } else if (receitaComp === 0 && receitaAtual > 0) {
      deltaMargem = {
        value: "Sem base comparativa",
        isNeutral: true,
      };
    } else {
      const deltaMargemPP = margemAtual - margemComp;
      const formattedPP = Math.abs(deltaMargemPP).toFixed(1).replace(".", ",");
      if (deltaMargemPP === 0) {
        deltaMargem = {
          value: "0,0 pp",
          isNeutral: true,
        };
      } else if (deltaMargemPP > 0) {
        deltaMargem = {
          value: `+${formattedPP} pp`,
          isPositive: true,
        };
      } else {
        deltaMargem = {
          value: `−${formattedPP} pp`,
          isPositive: false,
        };
      }
    }
  }

  return {
    receita: {
      label: "Receita Operacional",
      value: receitaAtual,
      formatted: formatBRL(receitaAtual),
      delta: hasComp
        ? {
            value: deltaReceita.formattedPercent,
            isPositive: deltaReceita.isPositive,
            isNeutral: deltaReceita.isNeutral,
          }
        : undefined,
      subtitle: isComparing && hasComp
        ? `vs ${compLabel} (${deltaReceita.formattedNominal})`
        : "Total faturado reconhecido",
    },
    custos: {
      label: "Custos Totais",
      value: custosAtual,
      formatted: formatBRL(custosAtual),
      delta: hasComp
        ? {
            value: deltaCustos.formattedPercent,
            isNeutral: true, // custos totais utilizam apresentação neutra
          }
        : undefined,
      subtitle: isComparing && hasComp
        ? `vs ${compLabel} (${deltaCustos.formattedNominal})`
        : receitaAtual > 0
        ? `${formatPercent((custosAtual / receitaAtual) * 100)} da receita operacional`
        : "Mão de obra e extras",
    },
    resultado: {
      label: "Resultado Operacional",
      value: resultadoAtual,
      formatted: formatBRL(resultadoAtual),
      delta: hasComp
        ? {
            value: deltaResultado.formattedPercent,
            isPositive: deltaResultado.isPositive,
            isNeutral: deltaResultado.isNeutral,
          }
        : undefined,
      subtitle: isComparing && hasComp
        ? `vs ${compLabel} (${deltaResultado.formattedNominal})`
        : "Receita − Custos Diretos",
    },
    margem: {
      label: "Margem Operacional",
      value: margemAtual,
      formatted: formatPercent(margemAtual),
      delta: deltaMargem,
      subtitle: isComparing && hasComp
        ? `vs ${compLabel} (${formatPercent(margemComp)} base)`
        : "Eficiência operacional apurada",
    },
  };
}

// ── CONVERSÃO DO DEMONSTRATIVO EM CASCATA (WATERFALL LEDGER) ─────────────────

export function buildDRELedger(
  kpisAtual?: OperationalIntegrityKPIs | null,
  kpisComp?: OperationalIntegrityKPIs | null,
  isComparing = false
): DRELedgerItem[] {
  const receita = kpisAtual?.faturamentoTotal ?? 0;
  const folha = kpisAtual?.folhaValorAprovado ?? 0;
  const diaristas = kpisAtual?.diaristasValorAprovado ?? 0;
  const intermitentes = kpisAtual?.intermitentesValorAprovado ?? 0;
  const extras = kpisAtual?.custosGerais ?? 0;
  const caixaRecebido = kpisAtual?.caixaRecebido ?? 0;
  const aReceber = Math.max(0, receita - caixaRecebido);

  const compReceita = kpisComp?.faturamentoTotal;
  const compFolha = kpisComp?.folhaValorAprovado;
  const compDiaristas = kpisComp?.diaristasValorAprovado;
  const compIntermitentes = kpisComp?.intermitentesValorAprovado;
  const compExtras = kpisComp?.custosGerais;

  const deltaReceita = calculateDREVariation(receita, compReceita, true);
  const deltaFolha = calculateDREVariation(folha, compFolha, false);
  const deltaDiaristas = calculateDREVariation(diaristas, compDiaristas, false);
  const deltaIntermitentes = calculateDREVariation(intermitentes, compIntermitentes, false);
  const deltaExtras = calculateDREVariation(extras, compExtras, false);

  return [
    {
      id: "receita-operacional",
      tipo: "receita",
      sinal: "+",
      label: "Receita Operacional",
      descricao:
        "Total faturado das operações logísticas reconhecidas na competência (por volume e serviços extras faturados), exceto canceladas.",
      valor: receita,
      percentualReceita: receita > 0 ? 100 : 0,
      deltaPercent: deltaReceita.diffPct ?? 0,
      diffNominal: isComparing ? deltaReceita.diffNominal : undefined,
      diffPct: isComparing ? deltaReceita.diffPct : undefined,
      variacaoTexto: isComparing ? deltaReceita.formattedPercent : undefined,
      variacaoStatus: isComparing ? deltaReceita.status : undefined,
      formattedNominalDiff: isComparing ? deltaReceita.formattedNominal : undefined,
      compValor: isComparing ? (compReceita ?? 0) : undefined,
      cor: ORBE_BLUE_SCALE.receita,
      detalhes: [
        {
          label: "Caixa Recebido / Liquidado",
          valor: caixaRecebido,
          percentualPai: receita > 0 ? (caixaRecebido / receita) * 100 : 0,
          nota: "Valores já recebidos, pagos ou conciliados no banco.",
        },
        {
          label: "A Receber / Em Aberto",
          valor: aReceber,
          percentualPai: receita > 0 ? (aReceber / receita) * 100 : 0,
          nota: "Faturamentos em cobrança ou com vencimento a prazo.",
        },
      ],
    },
    {
      id: "folha-clt",
      tipo: "deducao",
      sinal: "-",
      label: "Folha CLT",
      descricao:
        "Remuneração aprovada dos colaboradores CLT da competência, incluindo lotes de salário base, variáveis de ponto e liquidação de banco de horas.",
      valor: folha,
      percentualReceita: receita > 0 && folha > 0 ? (folha / receita) * 100 : 0,
      deltaPercent: deltaFolha.diffPct ?? 0,
      diffNominal: isComparing ? deltaFolha.diffNominal : undefined,
      diffPct: isComparing ? deltaFolha.diffPct : undefined,
      variacaoTexto: isComparing ? deltaFolha.formattedPercent : undefined,
      variacaoStatus: isComparing ? deltaFolha.status : undefined,
      formattedNominalDiff: isComparing ? deltaFolha.formattedNominal : undefined,
      compValor: isComparing ? (compFolha ?? 0) : undefined,
      cor: ORBE_BLUE_SCALE.clt,
      detalhes: [
        {
          label: "Lotes de Folha CLT Aprovados",
          valor: folha,
          percentualPai: 100,
          nota: "Lotes aprovados pelo financeiro ou enviados para remessa.",
        },
      ],
    },
    {
      id: "diaristas",
      tipo: "deducao",
      sinal: "-",
      label: "Diaristas Operacionais",
      descricao:
        "Pagamentos dos ciclos semanais de diaristas com fechamento financeiro aprovado na competência.",
      valor: diaristas,
      percentualReceita: receita > 0 && diaristas > 0 ? (diaristas / receita) * 100 : 0,
      deltaPercent: deltaDiaristas.diffPct ?? 0,
      diffNominal: isComparing ? deltaDiaristas.diffNominal : undefined,
      diffPct: isComparing ? deltaDiaristas.diffPct : undefined,
      variacaoTexto: isComparing ? deltaDiaristas.formattedPercent : undefined,
      variacaoStatus: isComparing ? deltaDiaristas.status : undefined,
      formattedNominalDiff: isComparing ? deltaDiaristas.formattedNominal : undefined,
      compValor: isComparing ? (compDiaristas ?? 0) : undefined,
      cor: ORBE_BLUE_SCALE.diaristas,
      detalhes: [
        {
          label: "Fechamentos Semanais Aprovados",
          valor: diaristas,
          percentualPai: 100,
          nota: "Lotes semanais de diárias validados pelo RH e fechados no financeiro.",
        },
      ],
    },
    {
      id: "intermitentes",
      tipo: "deducao",
      sinal: "-",
      label: "Trabalhadores Intermitentes",
      descricao:
        "Remuneração aprovada de colaboradores sob contrato de trabalho intermitente na competência.",
      valor: intermitentes,
      percentualReceita: receita > 0 && intermitentes > 0 ? (intermitentes / receita) * 100 : 0,
      deltaPercent: deltaIntermitentes.diffPct ?? 0,
      diffNominal: isComparing ? deltaIntermitentes.diffNominal : undefined,
      diffPct: isComparing ? deltaIntermitentes.diffPct : undefined,
      variacaoTexto: isComparing ? deltaIntermitentes.formattedPercent : undefined,
      variacaoStatus: isComparing ? deltaIntermitentes.status : undefined,
      formattedNominalDiff: isComparing ? deltaIntermitentes.formattedNominal : undefined,
      compValor: isComparing ? (compIntermitentes ?? 0) : undefined,
      cor: ORBE_BLUE_SCALE.intermitentes,
      detalhes: [
        {
          label: "Lotes de Intermitentes Aprovados",
          valor: intermitentes,
          percentualPai: 100,
          nota: "Lotes com status APROVADO_FINANCEIRO, CNAB_GERADO ou PAGO.",
        },
      ],
    },
    {
      id: "custos-extras",
      tipo: "deducao",
      sinal: "-",
      label: "Custos Extras & Logística",
      descricao:
        "Despesas e custos operacionais de campo aprovados no pipeline (alimentação, EPIs, ferramentas, manutenções).",
      valor: extras,
      percentualReceita: receita > 0 && extras > 0 ? (extras / receita) * 100 : 0,
      deltaPercent: deltaExtras.diffPct ?? 0,
      diffNominal: isComparing ? deltaExtras.diffNominal : undefined,
      diffPct: isComparing ? deltaExtras.diffPct : undefined,
      variacaoTexto: isComparing ? deltaExtras.formattedPercent : undefined,
      variacaoStatus: isComparing ? deltaExtras.status : undefined,
      formattedNominalDiff: isComparing ? deltaExtras.formattedNominal : undefined,
      compValor: isComparing ? (compExtras ?? 0) : undefined,
      cor: ORBE_BLUE_SCALE.custosExtras,
      detalhes: [
        {
          label: "Despesas de Campo Aprovadas",
          valor: extras,
          percentualPai: 100,
          nota: "Custos aprovados na operação sem cancelamento financeiro.",
        },
      ],
    },
  ];
}

// ── COMPOSIÇÃO DE CUSTOS (DONUT CHART) ────────────────────────────────────────

export function buildDREComposicao(kpis?: OperationalIntegrityKPIs | null): DREComposicaoItem[] {
  const folha = kpis?.folhaValorAprovado ?? 0;
  const diaristas = kpis?.diaristasValorAprovado ?? 0;
  const intermitentes = kpis?.intermitentesValorAprovado ?? 0;
  const extras = kpis?.custosGerais ?? 0;
  const total = folha + diaristas + intermitentes + extras;

  if (total === 0) return [];

  const items: DREComposicaoItem[] = [
    {
      nome: "Folha CLT & Encargos",
      valor: folha,
      percentual: (folha / total) * 100,
      cor: ORBE_BLUE_SCALE.clt,
    },
    {
      nome: "Diaristas Operacionais",
      valor: diaristas,
      percentual: (diaristas / total) * 100,
      cor: ORBE_BLUE_SCALE.diaristas,
    },
    {
      nome: "Trabalhadores Intermitentes",
      valor: intermitentes,
      percentual: (intermitentes / total) * 100,
      cor: ORBE_BLUE_SCALE.intermitentes,
    },
    {
      nome: "Custos Extras & Logística",
      valor: extras,
      percentual: (extras / total) * 100,
      cor: ORBE_BLUE_SCALE.custosExtras,
    },
  ];

  return items.sort((a, b) => b.valor - a.valor);
}

// ── TENDÊNCIA 12 MESES ────────────────────────────────────────────────────────

const MESES_ABREV = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez"
];

export function buildDRETendencia(
  snapshots: OperationalIntegrityKPIs[],
  year: string,
  currentCompetencia?: string
): DRETendenciaItem[] {
  return snapshots.map((snap, idx) => {
    const mesNum = String(idx + 1).padStart(2, "0");
    const mesKey = `${year}-${mesNum}`;
    const receita = snap.faturamentoTotal ?? 0;
    const custos = (snap.finValorAprovado ?? 0) + (snap.custosGerais ?? 0);
    const resultado = snap.lucroReal ?? 0;
    const margem = receita > 0 ? (resultado / receita) * 100 : 0;

    return {
      mes: `${MESES_ABREV[idx]}/${year.slice(-2)}`,
      mesKey,
      receita,
      custos,
      resultado,
      margem,
      isCurrent: mesKey === currentCompetencia,
    };
  });
}

// ── DRAWER ANALÍTICO OFICIAL ──────────────────────────────────────────────────

export function getDREDrawerData(
  item: DRELedgerItem,
  kpisAtual?: OperationalIntegrityKPIs | null
): DREDrawerData {
  const receita = kpisAtual?.faturamentoTotal ?? 0;
  const caixaRecebido = kpisAtual?.caixaRecebido ?? 0;
  const aReceber = Math.max(0, receita - caixaRecebido);

  switch (item.id) {
    case "receita-operacional":
      return {
        id: item.id,
        label: item.label,
        tipo: item.tipo,
        sinal: item.sinal,
        valor: item.valor,
        percentualReceita: item.percentualReceita,
        deltaPercent: item.deltaPercent,
        descricao:
          "Composição analítica das receitas operacionais auferidas pela prestação dos serviços logísticos no período.",
        criterioReconhecimento:
          "Reconhecidas por regime de competência a partir de receitas_operacionais (operações por volume e serviços extras) com status != 'cancelado'.",
        origemModulo: {
          label: "Abrir Receitas Operacionais",
          route: "/financeiro/receitas",
          tooltip: "Navegar para o pipeline de faturamento e receitas",
        },
        subcontas: [
          {
            label: "Caixa Realizado / Liquidado",
            valor: caixaRecebido,
            percentualPai: item.valor > 0 ? (caixaRecebido / item.valor) * 100 : 0,
            observacao: "Títulos e faturamentos com status 'recebido', 'pago' ou 'conciliado'.",
          },
          {
            label: "A Receber / Em Aberto",
            valor: aReceber,
            percentualPai: item.valor > 0 ? (aReceber / item.valor) * 100 : 0,
            observacao: "Valores faturados em cobrança ou com vencimento a prazo.",
          },
        ],
      };

    case "folha-clt":
      return {
        id: item.id,
        label: item.label,
        tipo: item.tipo,
        sinal: item.sinal,
        valor: item.valor,
        percentualReceita: item.percentualReceita,
        deltaPercent: item.deltaPercent,
        descricao:
          "Composição dos lotes financeiros de remuneração CLT homologados e reconhecidos na competência.",
        criterioReconhecimento:
          "Reconhecido após validação RH e aprovação financeira formal dos lotes de folha (status APROVADO_FINANCEIRO, CNAB_GERADO ou PAGO).",
        origemModulo: {
          label: "Abrir Fechamento CLT",
          route: "/banco-horas/fechamento",
          tooltip: "Navegar para o fechamento mensal da folha CLT",
        },
        subcontas: [
          {
            label: "Lotes de Folha CLT Consolidados",
            valor: item.valor,
            percentualPai: 100,
            observacao:
              "Salários base, horas extras apuradas em ponto e banco de horas com reflexo financeiro pendente.",
          },
        ],
      };

    case "diaristas":
      return {
        id: item.id,
        label: item.label,
        tipo: item.tipo,
        sinal: item.sinal,
        valor: item.valor,
        percentualReceita: item.percentualReceita,
        deltaPercent: item.deltaPercent,
        descricao:
          "Composição dos lotes semanais de fechamento dos diaristas operacionais alocados nas operações.",
        criterioReconhecimento:
          "Reconhecido a partir do fechamento financeiro do lote semanal (FECHADO_FINANCEIRO em diante), sem depender de liquidação bancária.",
        origemModulo: {
          label: "Abrir Gestão de Diaristas",
          route: "/operacional/diaristas",
          tooltip: "Navegar para a esteira e fechamentos de diaristas",
        },
        subcontas: [
          {
            label: "Lotes Semanais de Diárias Aprovados",
            valor: item.valor,
            percentualPai: 100,
            observacao:
              "Presenças semanais confirmadas pelo encarregado e validadas pelo RH.",
          },
        ],
      };

    case "intermitentes":
      return {
        id: item.id,
        label: item.label,
        tipo: item.tipo,
        sinal: item.sinal,
        valor: item.valor,
        percentualReceita: item.percentualReceita,
        deltaPercent: item.deltaPercent,
        descricao:
          "Composição dos lotes financeiros de remuneração de trabalhadores intermitentes convocados.",
        criterioReconhecimento:
          "Reconhecido nos lotes de rh_financeiro_lotes com tipo = 'INTERMITENTES' e status aprovado.",
        origemModulo: {
          label: "Abrir Intermitentes",
          route: "/operacional/intermitentes",
          tooltip: "Navegar para o módulo de intermitentes",
        },
        subcontas: [
          {
            label: "Lotes de Convocação Aprovados",
            valor: item.valor,
            percentualPai: 100,
            observacao:
              "Horas e convocações apuradas e aprovadas para pagamento.",
          },
        ],
      };

    case "custos-extras":
      return {
        id: item.id,
        label: item.label,
        tipo: item.tipo,
        sinal: item.sinal,
        valor: item.valor,
        percentualReceita: item.percentualReceita,
        deltaPercent: item.deltaPercent,
        descricao:
          "Composição das despesas e custos operacionais eventuais lançados em campo.",
        criterioReconhecimento:
          "Lançamentos em custos_extras_operacionais com pipeline APROVADO_OPERACAO, ENVIADO_FINANCEIRO ou FINALIZADO, e status_pagamento != 'CANCELADO'.",
        origemModulo: {
          label: "Abrir Custos Extras",
          route: "/operacional/custos-extras",
          tooltip: "Navegar para os custos extras operacionais",
        },
        subcontas: [
          {
            label: "Custos e Despesas Pontuais Aprovadas",
            valor: item.valor,
            percentualPai: 100,
            observacao:
              "Insumos, alimentação, ferramentas e despesas emergenciais de campo aprovadas.",
          },
        ],
      };
  }
}

// ── EXPORTAÇÃO CSV LIMPA ──────────────────────────────────────────────────────

export function exportDREToCSV(
  ledger: DRELedgerItem[],
  resultado: number,
  margem: number,
  competenciaLabel: string,
  empresaLabel: string
): void {
  const now = new Date();
  const dateStr = `${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;

  const metadata = [
    "DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO — GERENCIAL OPERACIONAL",
    "ORBE / ESC Logística",
    `Competência:;${competenciaLabel}`,
    `Empresa / Unidade:;${empresaLabel}`,
    `Data de Emissão:;${dateStr}`,
    "",
  ];

  const headers = [
    "Conta / Descrição",
    "Tipo",
    "Sinal",
    "Valor (R$)",
    "% da Receita Operacional",
    "Variação vs Mês Anterior",
  ];

  const rows = ledger.map((it) => [
    `"${it.label}"`,
    it.tipo === "receita" ? "Receita Operacional" : "Custo Direto",
    it.sinal,
    it.valor.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    `${it.percentualReceita.toFixed(1)}%`,
    `${it.deltaPercent >= 0 ? "+" : ""}${it.deltaPercent.toFixed(1)}%`,
  ]);

  rows.push([
    '"RESULTADO OPERACIONAL"',
    "Resultado Líquido",
    "=",
    resultado.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    `${margem.toFixed(1)}% (Margem)`,
    "—",
  ]);

  const csvContent =
    "\uFEFF" +
    metadata.join("\n") +
    headers.join(";") +
    "\n" +
    rows.map((r) => r.join(";")).join("\n");

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const createObjUrl = window.URL?.createObjectURL || (typeof URL !== "undefined" ? URL.createObjectURL : undefined);
    const revokeObjUrl = window.URL?.revokeObjectURL || (typeof URL !== "undefined" ? URL.revokeObjectURL : undefined);

    if (typeof createObjUrl === "function") {
      const url = createObjUrl(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `DRE_ESC_Log_${competenciaLabel.replace(/[^a-zA-Z0-9]/g, "_")}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (typeof revokeObjUrl === "function") {
        revokeObjUrl(url);
      }
    }
  }
}
