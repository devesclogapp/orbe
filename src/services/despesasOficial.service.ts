/**
 * despesasOficial.service.ts
 *
 * CONV-10 — ADAPTER OFICIAL FEDERADO DE DESPESAS & CONTAS A PAGAR
 *
 * Responsabilidade:
 * - Consultar os 4 motores homologados: CUSTOS EXTRAS, CLT, DIARISTAS, INTERMITENTES
 * - Normalizar para apresentação SEM alterar backend ou criar enums no banco
 * - Proteger contra duplicidades com identidade canônica ORIGEM:ID
 * - Calcular KPIs unificados a partir do dataset deduplicado
 * - Preservar contratos existentes (CUSTOS EXTRAS NÃO ENTRA EM CNAB)
 */

import { supabase } from "@/lib/supabase";
import { getCurrentTenantId } from "@/services/domain/base.service";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { EnvironmentQueryFilter } from "@/services/environment/EnvironmentQueryFilter";
import { CustoExtraOperacionalService } from "@/services/domain/despesas.service";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";

export type OrigemDespesaFederada = "CUSTOS_EXTRAS" | "CLT" | "DIARISTAS" | "INTERMITENTES";

export type TipoDespesaFederada =
  | "PAGO_EMPRESA"
  | "REEMBOLSO_COLABORADOR"
  | "PAGAMENTO_PENDENTE"
  | "MAO_DE_OBRA";

export type SituacaoFinanceiraUX =
  | "AGUARDANDO_LIBERACAO"
  | "A_PAGAR"
  | "PRONTA_BANCO"
  | "PAGA"
  | "EM_ANALISE";

export interface HistoricoEventoFederado {
  id: string;
  data: string;
  usuario: string;
  papel: string;
  acao: string;
  descricao: string;
}

export interface DespesaFederadaItem {
  id: string; // Chave canônica: ORIGEM:ID_CANONICO
  canonicalId: string;
  origem: OrigemDespesaFederada;
  tipo: TipoDespesaFederada;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  beneficiarioNome: string;
  beneficiarioDocumento?: string;
  empresaId: string;
  empresaNome: string;
  competencia: string; // YYYY-MM
  competenciaFormatada: string;
  dataDespesa?: string;
  dataVencimento?: string | null;
  periodoReferencia?: string;
  valor: number;
  valorTotal?: number; // Alias para compatibilidade
  situacao: SituacaoFinanceiraUX;
  situacaoVisual?: SituacaoFinanceiraUX; // Alias para compatibilidade
  statusReal: string;
  dataPagamento?: string | null;
  formaLiquidacao?: string | null;
  quantidadePessoas?: number | null;
  quantidadeLancamentos?: number;
  quantidadeUnidades?: string;
  readinessBancario: boolean;
  prontoParaBanco?: boolean; // Alias para compatibilidade
  rotaEspecialista?: string;
  comprovanteDisponivel?: boolean;
  rawItem?: any;
  historico: HistoricoEventoFederado[];
}

export interface DespesasKpiStats {
  despesasReconhecidas: number;
  despesasNoPeriodo: number;
  totalDespesas?: number; // Alias para compatibilidade
  aPagar: number;
  totalAPagar?: number; // Alias para compatibilidade
  prontasPagamento: number;
  prontasExecucao: number;
  totalProntasExecucao?: number; // Alias para compatibilidade
  prontasLiquidacaoDireta: number;
  custosExtrasProntos?: number; // Alias para compatibilidade
  prontasViaBanco: number;
  pagasLiquidadas: number;
  totalPagas?: number; // Alias para compatibilidade
  maoDeObraProntaBanco: number;
  qtdReconhecidas: number;
  quantidadeDespesas?: number; // Alias para compatibilidade
  qtdAPagar: number;
  quantidadeAPagar?: number; // Alias para compatibilidade
  qtdProntasPagamento: number;
  qtdProntasExecucao: number;
  qtdPagasLiquidadas: number;
  quantidadePagas?: number; // Alias para compatibilidade
  qtdProntasBanco: number;
}

export const DATA_REFERENCIA_SISTEMA = new Date().toISOString().slice(0, 10);

export function buildCanonicalFederatedId(origem: OrigemDespesaFederada, rawId: string): string {
  return `${origem}:${rawId}`;
}

export function deduplicarDespesas(itens: DespesaFederadaItem[]): DespesaFederadaItem[] {
  const map = new Map<string, DespesaFederadaItem>();
  for (const item of itens) {
    if (!item.id) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function formatCompetencia(competencia?: string | null): string {
  if (!competencia) return "—";
  const parts = competencia.split("-");
  if (parts.length >= 2) {
    const year = Number(parts[0]);
    const month = Number(parts[1]);
    if (!isNaN(year) && !isNaN(month) && month >= 1 && month <= 12) {
      const date = new Date(Date.UTC(year, month - 1, 1));
      return date.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
    }
  }
  return competencia;
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parts = dateStr.slice(0, 10).split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

export function formatCurrency(val: number): string {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function calcularDiasVencimento(dataVencimento?: string | null, situacao?: SituacaoFinanceiraUX, dataReferencia = DATA_REFERENCIA_SISTEMA): {
  isVencido: boolean;
  diasAtraso: number;
  diasParaVencer: number;
} {
  if (!dataVencimento || situacao === "PAGA") {
    return { isVencido: false, diasAtraso: 0, diasParaVencer: 0 };
  }

  const venc = new Date(dataVencimento + "T12:00:00Z");
  const ref = new Date(dataReferencia + "T12:00:00Z");
  const diffTime = ref.getTime() - venc.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > 0) {
    return { isVencido: true, diasAtraso: diffDays, diasParaVencer: 0 };
  }
  return { isVencido: false, diasAtraso: 0, diasParaVencer: Math.abs(diffDays) };
}

export function getOrigemLabel(origem: OrigemDespesaFederada): string {
  switch (origem) {
    case "CUSTOS_EXTRAS":
      return "Custos Extras";
    case "CLT":
      return "CLT / Folha";
    case "DIARISTAS":
      return "Diaristas";
    case "INTERMITENTES":
      return "Intermitentes";
    default:
      return origem;
  }
}

export function getTipoLabel(tipo: TipoDespesaFederada): string {
  switch (tipo) {
    case "PAGO_EMPRESA":
      return "Pago pela Empresa";
    case "REEMBOLSO_COLABORADOR":
      return "Reembolso a Colaborador";
    case "PAGAMENTO_PENDENTE":
      return "Fornecedor / Boleto";
    case "MAO_DE_OBRA":
      return "Mão de Obra";
    default:
      return tipo;
  }
}

export function getSituacaoBadge(situacao: SituacaoFinanceiraUX, dataVencimento?: string | null, dataReferencia = DATA_REFERENCIA_SISTEMA): {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  className: string;
} {
  const { isVencido, diasAtraso } = calcularDiasVencimento(dataVencimento, situacao, dataReferencia);

  if (isVencido && situacao !== "PAGA") {
    return {
      label: `Vencido (${diasAtraso}d)`,
      variant: "destructive",
      className: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-900",
    };
  }

  switch (situacao) {
    case "AGUARDANDO_LIBERACAO":
      return {
        label: "Aguardando Liberação",
        variant: "secondary",
        className: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900",
      };
    case "A_PAGAR":
      return {
        label: "A Pagar",
        variant: "default",
        className: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-900",
      };
    case "PRONTA_BANCO":
      return {
        label: "Pronta p/ Banco",
        variant: "outline",
        className: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-900",
      };
    case "PAGA":
      return {
        label: "Paga",
        variant: "outline",
        className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-900",
      };
    case "EM_ANALISE":
      return {
        label: "Em Análise",
        variant: "secondary",
        className: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-950/60 dark:text-slate-300 dark:border-slate-900 font-medium",
      };
    default:
      return {
        label: situacao,
        variant: "secondary",
        className: "bg-muted text-muted-foreground",
      };
  }
}

export function calculateDespesasKpiStats(data: DespesaFederadaItem[]): DespesasKpiStats {
  let despesasNoPeriodo = 0;
  let aPagar = 0;
  let prontasLiquidacaoDireta = 0;
  let prontasViaBanco = 0;
  let pagasLiquidadas = 0;
  let maoDeObraProntaBanco = 0;

  let qtdReconhecidas = 0;
  let qtdAPagar = 0;
  let qtdProntasExecucao = 0;
  let qtdPagasLiquidadas = 0;
  let qtdProntasBanco = 0;

  for (const item of data) {
    const val = Number(item.valor ?? item.valorTotal ?? 0);
    const sit = item.situacao || item.situacaoVisual;
    despesasNoPeriodo += val;
    qtdReconhecidas += 1;

    // A Pagar: obrigações ativas pendentes de liquidação financeira.
    // PAGO_EMPRESA já foi pago, portanto possui situacao === 'PAGA' e não entra em A Pagar.
    if (
      sit === "AGUARDANDO_LIBERACAO" ||
      sit === "A_PAGAR" ||
      sit === "PRONTA_BANCO"
    ) {
      aPagar += val;
      qtdAPagar += 1;
    }

    // Prontas para Execução Direta: Custos Extras liberados pelo operacional em A_PAGAR
    if (item.origem === "CUSTOS_EXTRAS" && sit === "A_PAGAR") {
      prontasLiquidacaoDireta += val;
      qtdProntasExecucao += 1;
    }

    // Prontas via Banco: Mão de obra homologada com status PRONTA_BANCO
    if (item.tipo === "MAO_DE_OBRA" && sit === "PRONTA_BANCO") {
      prontasViaBanco += val;
      qtdProntasExecucao += 1;
      maoDeObraProntaBanco += val;
      qtdProntasBanco += 1;
    }

    // Pagas / Liquidadas: obrigações quitadas (inclui PAGO_EMPRESA finalizado)
    if (sit === "PAGA") {
      pagasLiquidadas += val;
      qtdPagasLiquidadas += 1;
    }
  }

  const prontasExecucao = prontasLiquidacaoDireta + prontasViaBanco;

  return {
    despesasReconhecidas: despesasNoPeriodo,
    despesasNoPeriodo,
    totalDespesas: despesasNoPeriodo,
    aPagar,
    totalAPagar: aPagar,
    prontasPagamento: prontasExecucao,
    prontasExecucao,
    totalProntasExecucao: prontasExecucao,
    prontasLiquidacaoDireta,
    custosExtrasProntos: prontasLiquidacaoDireta,
    prontasViaBanco,
    pagasLiquidadas,
    totalPagas: pagasLiquidadas,
    maoDeObraProntaBanco,
    qtdReconhecidas,
    quantidadeDespesas: qtdReconhecidas,
    qtdAPagar,
    quantidadeAPagar: qtdAPagar,
    qtdProntasPagamento: qtdProntasExecucao,
    qtdProntasExecucao,
    qtdPagasLiquidadas,
    quantidadePagas: qtdPagasLiquidadas,
    qtdProntasBanco,
  };
}

/**
 * Normalizadores Federados por Domínio
 */

export function normalizarCustoExtra(item: any, empresasMap: Map<string, string>, mesContexto: string): DespesaFederadaItem {
  const rawId = String(item.id || "");
  const id = buildCanonicalFederatedId("CUSTOS_EXTRAS", rawId);
  const data = item.data ? String(item.data).slice(0, 10) : "";
  const competencia = data ? data.slice(0, 7) : mesContexto;
  const valor = Number(item.total ?? item.valor_total ?? (item.valor_unitario !== undefined ? Number(item.valor_unitario) * Number(item.quantidade || 1) : 0));

  const origemRecurso = item.origem_recurso || "PAGO_EMPRESA";
  let tipo: TipoDespesaFederada = "PAGO_EMPRESA";
  if (origemRecurso === "REEMBOLSO_COLABORADOR") {
    tipo = "REEMBOLSO_COLABORADOR";
  } else if (origemRecurso === "PAGAMENTO_PENDENTE") {
    tipo = "PAGAMENTO_PENDENTE";
  }

  const sStatus = String(item.pipeline_status || "").toUpperCase();
  const sPag = String(item.status_pagamento || "").toUpperCase();

  let situacao: SituacaoFinanceiraUX = "EM_ANALISE";
  if (sStatus === "FINALIZADO" || sPag === "PAGO" || tipo === "PAGO_EMPRESA") {
    situacao = "PAGA";
  } else if (sStatus === "ENVIADO_FINANCEIRO") {
    situacao = "A_PAGAR";
  } else if (sStatus === "APROVADO_OPERACAO") {
    situacao = "AGUARDANDO_LIBERACAO";
  } else if (sStatus === "RECEBIDO" || sStatus === "EM_VALIDACAO") {
    situacao = "EM_ANALISE";
  }

  const empresaNome = item.empresas?.nome || item.empresa_nome || empresasMap.get(item.empresa_id) || "Empresa";
  const categoria = item.categoria_custo || "Operacional";
  const descricao = item.descricao || "Custo operacional extraordinário";
  const codigo = item.codigo || `CE-${data ? data.slice(0, 4) : "2026"}-${rawId.slice(0, 4).toUpperCase()}`;

  let beneficiarioNome = empresaNome;
  let beneficiarioDocumento = undefined;
  if (tipo === "REEMBOLSO_COLABORADOR") {
    beneficiarioNome = item.favorecido_colaborador?.nome || item.colaboradores?.nome || item.colaborador_nome || item.favorecido_nome || item.responsavel_nome || "Colaborador a Reembolsar";
  } else if (tipo === "PAGAMENTO_PENDENTE") {
    beneficiarioNome = item.favorecido_fornecedor?.nome || item.fornecedores?.nome || item.favorecido_nome || "Fornecedor a Pagar";
    beneficiarioDocumento = item.documento || item.cnpj || undefined;
  } else {
    beneficiarioNome = item.favorecido_nome || item.fornecedores?.nome || empresaNome;
  }

  return {
    id,
    canonicalId: rawId,
    origem: "CUSTOS_EXTRAS",
    tipo,
    codigo,
    titulo: item.categoria_custo ? `${item.categoria_custo} — ${item.descricao ? item.descricao.slice(0, 32) : "Despesa"}` : "Custo Extra Operacional",
    descricao,
    categoria,
    beneficiarioNome,
    beneficiarioDocumento,
    empresaId: item.empresa_id || "",
    empresaNome,
    competencia,
    competenciaFormatada: formatCompetencia(competencia),
    dataDespesa: data || undefined,
    dataVencimento: item.data_vencimento || null,
    valor,
    valorTotal: valor,
    situacao,
    situacaoVisual: situacao,
    statusReal: item.pipeline_status || item.status_pagamento || "RECEBIDO",
    dataPagamento: (situacao === "PAGA") ? (item.data_pagamento || data || null) : null,
    formaLiquidacao: item.forma_pagamento_ref?.nome || item.forma_pagamento || (tipo === "PAGO_EMPRESA" ? "Cartão Corporativo / Caixa" : "Transferência / PIX"),
    readinessBancario: false, // Regra CONV-05: Custos extras NUNCA vão para o CNAB
    prontoParaBanco: false,
    comprovanteDisponivel: Boolean(item.comprovante_url || item.anexo_url),
    rawItem: item,
    historico: [
      {
        id: `h-init-${rawId}`,
        data: item.criado_em ? new Date(item.criado_em).toLocaleString("pt-BR") : "—",
        usuario: item.responsavel_nome || "Operação",
        papel: "Encarregado / Operação",
        acao: "Lançamento",
        descricao: item.observacao || "Despesa registrada no portal operacional.",
      },
    ],
  };
}

export function normalizarLoteClt(item: any, empresasMap: Map<string, string>, mesContexto: string): DespesaFederadaItem {
  const rawId = String(item.id || "");
  const id = buildCanonicalFederatedId("CLT", rawId);
  const competencia = item.competencia || mesContexto;
  const valor = Number(item.valor_total || 0);
  const empresaNome = item.empresa?.nome || empresasMap.get(item.empresa_id) || "Empresa";
  const status = String(item.status || "").toUpperCase();

  let situacao: SituacaoFinanceiraUX = "A_PAGAR";
  if (status === "PAGO") {
    situacao = "PAGA";
  } else if (status === "AGUARDANDO_PAGAMENTO" || status === "APROVADO_FINANCEIRO" || status === "CNAB_GERADO") {
    situacao = "PRONTA_BANCO";
  } else if (status === "AGUARDANDO_FINANCEIRO" || status === "EM_ANALISE_FINANCEIRA") {
    situacao = "AGUARDANDO_LIBERACAO";
  }

  const isBancoHoras = item.tipo === "BANCO_HORAS";
  const codigo = `LT-CLT-${competencia}-${isBancoHoras ? "BH" : "FOLHA"}`;
  const titulo = isBancoHoras ? "Lote Banco de Horas" : "Folha Oficial CLT";
  const qtdPessoas = Number(item.total_colaboradores || 0);

  return {
    id,
    canonicalId: rawId,
    origem: "CLT",
    tipo: "MAO_DE_OBRA",
    codigo,
    titulo,
    descricao: `${qtdPessoas} colaborador(es) apurados no motor RH`,
    categoria: "Mão de Obra CLT",
    beneficiarioNome: `Colaboradores CLT (${qtdPessoas} pessoas)`,
    empresaId: item.empresa_id || "",
    empresaNome,
    competencia,
    competenciaFormatada: formatCompetencia(competencia),
    periodoReferencia: formatCompetencia(competencia),
    valor,
    valorTotal: valor,
    situacao,
    situacaoVisual: situacao,
    statusReal: item.status || "AGUARDANDO_FINANCEIRO",
    quantidadePessoas: qtdPessoas,
    quantidadeUnidades: `${qtdPessoas} colaboradores`,
    readinessBancario: situacao === "PRONTA_BANCO",
    prontoParaBanco: situacao === "PRONTA_BANCO",
    rotaEspecialista: "/bancario",
    rawItem: item,
    historico: [
      {
        id: `h-clt-${rawId}`,
        data: item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "—",
        usuario: item.criado_por_nome || "RH Oficial",
        papel: "Setor RH",
        acao: "Fechamento RH",
        descricao: `Lote ${titulo} gerado com ${qtdPessoas} colaboradores para análise financeira.`,
      },
    ],
  };
}

export function normalizarLoteDiarista(
  item: any,
  empresasMap: Map<string, string>,
  mesContexto: string,
  diaristasStats?: { diaristasDistintos?: number; totalLancamentos?: number }
): DespesaFederadaItem {
  const rawId = String(item.id || "");
  const id = buildCanonicalFederatedId("DIARISTAS", rawId);
  const pInicio = item.periodo_inicio ? String(item.periodo_inicio).slice(0, 10) : "";
  const pFim = item.periodo_fim ? String(item.periodo_fim).slice(0, 10) : "";
  const competencia = pInicio ? pInicio.slice(0, 7) : (item.competencia || mesContexto);
  const valor = Number(item.valor_total || 0);
  const empresaNome = item.empresa?.nome || empresasMap.get(item.empresa_id) || "Empresa";
  const status = String(item.status || "").toUpperCase();

  let situacao: SituacaoFinanceiraUX = "A_PAGAR";
  if (status === "PAGO") {
    situacao = "PAGA";
  } else if (status === "FECHADO_FINANCEIRO" || status === "AGUARDANDO_PAGAMENTO" || status === "CNAB_GERADO") {
    situacao = "PRONTA_BANCO";
  } else if (status === "VALIDADO_RH" || status === "AGUARDANDO_FINANCEIRO") {
    situacao = "AGUARDANDO_LIBERACAO";
  }

  const codigo = `LT-DIA-${pInicio ? pInicio.slice(5).replace("-", "") : rawId.slice(0, 6)}`;
  const titulo = `Lote Diaristas — Semana ${pInicio ? formatDate(pInicio) : ""}`;

  // 1. Quantidade de Lançamentos / Diárias (total_registros do lote ou contagem comprovada)
  const qtdLancamentos = diaristasStats?.totalLancamentos !== undefined
    ? diaristasStats.totalLancamentos
    : Number(item.total_registros ?? item.quantidade_diarias ?? 0);

  // 2. Quantidade de Pessoas Distintas (diaristas distintos comprovados)
  let qtdPessoas: number | null | undefined;
  if (diaristasStats?.diaristasDistintos !== undefined) {
    qtdPessoas = diaristasStats.diaristasDistintos;
  } else if (item.total_colaboradores !== undefined && item.total_colaboradores !== null) {
    qtdPessoas = Number(item.total_colaboradores);
  } else if (qtdLancamentos === 0) {
    qtdPessoas = 0; // Comprovadamente zero
  } else {
    // Há lançamentos, mas diaristas distintos não puderam ser comprovados (Desconhecido)
    qtdPessoas = undefined;
  }

  const textoDiarias = `${qtdLancamentos} diária${qtdLancamentos === 1 ? "" : "s"}`;

  return {
    id,
    canonicalId: rawId,
    origem: "DIARISTAS",
    tipo: "MAO_DE_OBRA",
    codigo,
    titulo,
    descricao: `Fechamento semanal da grade operacional de diaristas (${textoDiarias})`,
    categoria: "Mão de Obra Diaristas",
    beneficiarioNome: `Equipe Diaristas (${textoDiarias})`,
    empresaId: item.empresa_id || "",
    empresaNome,
    competencia,
    competenciaFormatada: formatCompetencia(competencia),
    periodoReferencia: (pInicio && pFim) ? `${formatDate(pInicio)} a ${formatDate(pFim)}` : formatCompetencia(competencia),
    valor,
    valorTotal: valor,
    situacao,
    situacaoVisual: situacao,
    statusReal: item.status || "VALIDADO_RH",
    quantidadePessoas: qtdPessoas,
    quantidadeLancamentos: qtdLancamentos,
    quantidadeUnidades: textoDiarias,
    readinessBancario: situacao === "PRONTA_BANCO",
    prontoParaBanco: situacao === "PRONTA_BANCO",
    rotaEspecialista: "/bancario?origem=DIARISTA",
    rawItem: item,
    historico: [
      {
        id: `h-dia-${rawId}`,
        data: item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "—",
        usuario: item.fechado_por || "Encarregado",
        papel: "Operacional",
        acao: "Fechamento Semanal",
        descricao: `Grade semanal de diaristas fechada e validada pelo RH.`,
      },
    ],
  };
}

export function normalizarLoteIntermitente(
  item: any,
  empresasMap: Map<string, string>,
  mesContexto: string,
  intermitentesStats?: { pessoasDistintas?: number; totalLancamentos?: number }
): DespesaFederadaItem {
  const rawId = String(item.id || "");
  const id = buildCanonicalFederatedId("INTERMITENTES", rawId);
  const pInicio = item.periodo_inicio ? String(item.periodo_inicio).slice(0, 10) : "";
  const pFim = item.periodo_fim ? String(item.periodo_fim).slice(0, 10) : "";
  const competencia = item.competencia || (pInicio ? pInicio.slice(0, 7) : mesContexto);
  const valor = Number(item.valor_total || 0);
  const empresaNome = item.empresa?.nome || empresasMap.get(item.empresa_id) || "Empresa";
  const status = String(item.status || "").toUpperCase();

  let situacao: SituacaoFinanceiraUX = "A_PAGAR";
  if (status === "PAGO") {
    situacao = "PAGA";
  } else if (status === "FECHADO_FINANCEIRO" || status === "AGUARDANDO_PAGAMENTO" || status === "CNAB_GERADO") {
    situacao = "PRONTA_BANCO";
  } else if (status === "VALIDADO_RH" || status === "AGUARDANDO_FINANCEIRO") {
    situacao = "AGUARDANDO_LIBERACAO";
  }

  const codigo = `LT-INT-${competencia}-${rawId.slice(0, 4).toUpperCase()}`;
  const titulo = `Lote Intermitentes — ${competencia}`;

  // Resolução correta da contagem de convocações e de colaboradores conforme a fonte consultada:
  const qtdLancamentos = intermitentesStats?.totalLancamentos !== undefined
    ? intermitentesStats.totalLancamentos
    : Number(item.quantidade_registros ?? item.total_registros ?? item.total_colaboradores ?? 0);

  let qtdPessoas: number | null | undefined;
  if (intermitentesStats?.pessoasDistintas !== undefined) {
    qtdPessoas = intermitentesStats.pessoasDistintas;
  } else if (item.total_colaboradores !== undefined && item.total_colaboradores !== null) {
    qtdPessoas = Number(item.total_colaboradores);
  } else if (qtdLancamentos > 0) {
    qtdPessoas = qtdLancamentos;
  } else {
    qtdPessoas = 0;
  }

  const textoConvocacoes = `${qtdLancamentos} convocação${qtdLancamentos === 1 ? "" : "ões"}`;

  return {
    id,
    canonicalId: rawId,
    origem: "INTERMITENTES",
    tipo: "MAO_DE_OBRA",
    codigo,
    titulo,
    descricao: `Apuração de jornadas convocadas e horas apuradas (${textoConvocacoes})`,
    categoria: "Mão de Obra Intermitentes",
    beneficiarioNome: `Equipe Intermitentes (${textoConvocacoes})`,
    empresaId: item.empresa_id || "",
    empresaNome,
    competencia,
    competenciaFormatada: formatCompetencia(competencia),
    periodoReferencia: (pInicio && pFim) ? `${formatDate(pInicio)} a ${formatDate(pFim)}` : formatCompetencia(competencia),
    valor,
    valorTotal: valor,
    situacao,
    situacaoVisual: situacao,
    statusReal: item.status || "VALIDADO_RH",
    quantidadePessoas: qtdPessoas,
    quantidadeLancamentos: qtdLancamentos,
    quantidadeUnidades: textoConvocacoes,
    readinessBancario: situacao === "PRONTA_BANCO",
    prontoParaBanco: situacao === "PRONTA_BANCO",
    rotaEspecialista: "/bancario?origem=INTERMITENTE",
    rawItem: item,
    historico: [
      {
        id: `h-int-${rawId}`,
        data: item.created_at ? new Date(item.created_at).toLocaleString("pt-BR") : "—",
        usuario: item.fechado_por || "Encarregado",
        papel: "Operacional",
        acao: "Fechamento de Jornadas",
        descricao: `Lote de intermitentes apurado e validado.`,
      },
    ],
  };
}

/**
 * Service Principal Federado
 */
export const DespesasContasPagarOficialService = {
  calculateKpiStats: calculateDespesasKpiStats,
  calculateDespesasKpiStats,
  deduplicarDespesas,
  buildCanonicalFederatedId,

  async fetchDespesasFederadas(params: {
    empresaId?: string | null;
    competencia?: string;
    competenciaMes?: string;
  }): Promise<{
    itens: DespesaFederadaItem[];
    stats: DespesasKpiStats;
  }> {
    const { empresaId } = params;
    const mesCompetencia = params.competencia || params.competenciaMes || new Date().toISOString().slice(0, 7);
    const tenantId = await getCurrentTenantId();

    // 1. Carregar Empresas para Lookup Seguro
    const { data: rawEmpresas } = await supabase.from("empresas").select("id, nome").eq("tenant_id", tenantId);
    const empresasMap = new Map<string, string>();
    for (const emp of rawEmpresas || []) {
      empresasMap.set(emp.id, emp.nome);
    }

    const targetEmpresaId = empresaId && empresaId !== "all" ? empresaId : undefined;

    // 2. Consultar os 4 Motores Especialistas com Fail-Closed Seguro
    const [
      resCustosExtras,
      resLotesRh,
      resDiaristas,
      resIntermitentes,
    ] = await Promise.all([
      // A. CUSTOS EXTRAS
      CustoExtraOperacionalService.getByCompetencia(mesCompetencia, targetEmpresaId).catch((err) => {
        console.error("[DespesasOficialService] Erro ao carregar Custos Extras:", err);
        throw new Error(`Falha crítica ao consultar Custos Extras: ${err.message}`);
      }),

      // B. CLT (rh_financeiro_lotes)
      RHFinanceiroService.listLotesRecebidos(mesCompetencia, targetEmpresaId).catch((err) => {
        console.error("[DespesasOficialService] Erro ao carregar Lotes CLT:", err);
        throw new Error(`Falha crítica ao consultar Lotes CLT: ${err.message}`);
      }),

      // C. DIARISTAS (diaristas_lotes_fechamento)
      (async () => {
        if (targetEmpresaId) {
          return LoteFechamentoDiaristaService.getByEmpresaParaFinanceiro(targetEmpresaId);
        }
        let q = supabase
          .from("diaristas_lotes_fechamento")
          .select("*, empresa:empresas(nome)")
          .in("status", ["VALIDADO_RH", "FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO", "PAGO", "pago", "cnab_gerado"])
          .order("created_at", { ascending: false });

        const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
        q = EnvironmentQueryFilter.applyEmpresaScope(q, {
          tenantId,
          column: "empresa_id",
          includeNullInProduction: false,
          testIds,
        });
        const { data, error } = await q;
        if (error) throw error;
        return (data || []).filter((l: any) => !mesCompetencia || String(l.periodo_inicio || "").slice(0, 7) === mesCompetencia);
      })().catch((err) => {
        console.error("[DespesasOficialService] Erro ao carregar Diaristas:", err);
        throw new Error(`Falha crítica ao consultar Diaristas: ${err.message}`);
      }),

      // D. INTERMITENTES (intermitentes_lotes_fechamento)
      (async () => {
        let q = supabase
          .from("intermitentes_lotes_fechamento")
          .select("*, empresa:empresas(nome)")
          .order("created_at", { ascending: false });

        const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
        q = EnvironmentQueryFilter.applyEmpresaScope(q, {
          tenantId,
          column: "empresa_id",
          includeNullInProduction: true,
          testIds,
          targetEmpresaId: targetEmpresaId,
        });

        if (targetEmpresaId) {
          q = q.eq("empresa_id", targetEmpresaId);
        }
        if (mesCompetencia) {
          q = q.eq("competencia", mesCompetencia);
        }

        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      })().catch((err) => {
        console.error("[DespesasOficialService] Erro ao carregar Intermitentes:", err);
        throw new Error(`Falha crítica ao consultar Intermitentes: ${err.message}`);
      }),
    ]);

    // 3. Resolução Relacional e Agregada em Lote (Sem N+1)
    
    // 3.1. Diaristas: Contagem de diárias e diaristas distintos
    const diaristasStatsMap = new Map<string, { diaristasDistintos?: number; totalLancamentos?: number }>();
    const diaristasLoteIds = (resDiaristas || []).map((l: any) => l.id).filter(Boolean);

    if (diaristasLoteIds.length > 0) {
      try {
        let qItens = supabase
          .from("lancamentos_diaristas")
          .select("lote_fechamento_id, diarista_id")
          .in("lote_fechamento_id", diaristasLoteIds);

        if (targetEmpresaId) {
          qItens = qItens.eq("empresa_id", targetEmpresaId);
        }

        const { data: itensDb, error: errItens } = await qItens;
        if (!errItens && itensDb) {
          const gruposDiaristas = new Map<string, Set<string>>();
          const contagensLancamentos = new Map<string, number>();
          const temDiaristaNulo = new Map<string, boolean>();

          itensDb.forEach((it: any) => {
            const lid = it.lote_fechamento_id;
            if (!lid) return;
            if (!gruposDiaristas.has(lid)) {
              gruposDiaristas.set(lid, new Set());
              contagensLancamentos.set(lid, 0);
              temDiaristaNulo.set(lid, false);
            }
            contagensLancamentos.set(lid, (contagensLancamentos.get(lid) || 0) + 1);
            if (it.diarista_id) {
              gruposDiaristas.get(lid)!.add(it.diarista_id);
            } else {
              temDiaristaNulo.set(lid, true);
            }
          });

          diaristasLoteIds.forEach((lid: string) => {
            const totalLanc = contagensLancamentos.get(lid);
            const grupo = gruposDiaristas.get(lid);
            const teveNulo = temDiaristaNulo.get(lid);

            if (totalLanc === undefined || totalLanc === 0) {
              diaristasStatsMap.set(lid, {
                totalLancamentos: undefined,
                diaristasDistintos: undefined,
              });
            } else if (teveNulo && (!grupo || grupo.size === 0)) {
              diaristasStatsMap.set(lid, {
                totalLancamentos: totalLanc,
                diaristasDistintos: undefined,
              });
            } else {
              diaristasStatsMap.set(lid, {
                totalLancamentos: totalLanc,
                diaristasDistintos: grupo?.size || 0,
              });
            }
          });
        }
      } catch (err) {
        console.warn("[DespesasOficialService] Falha ao consultar diaristas distintos em lote:", err);
      }
    }

    // 3.2. Intermitentes: Deduplicação relacional estrita e contagens
    // Um espelho RH só poderá ser suprimido da projeção visual quando existir correspondência
    // comprovada com o fechamento operacional por identificadores dos eventos de origem.
    const suppressedRhIntermitenteIds = new Set<string>();
    const intermitentesStatsMap = new Map<string, { pessoasDistintas?: number; totalLancamentos?: number }>();
    const rhIntermitentes = (resLotesRh || []).filter((l: any) => l.tipo === "INTERMITENTES");
    const opIntermitentes = resIntermitentes || [];

    if (rhIntermitentes.length > 0 && opIntermitentes.length > 0) {
      try {
        const rhLoteIds = rhIntermitentes.map((l: any) => l.id).filter(Boolean);
        const { data: rhItensDb, error: errRhItens } = await supabase
          .from("rh_financeiro_lote_itens")
          .select("lote_id, referencia_evento_id")
          .in("lote_id", rhLoteIds)
          .eq("origem_evento", "lancamentos_intermitentes");

        if (!errRhItens && rhItensDb && rhItensDb.length > 0) {
          const refEventIds = [...new Set(rhItensDb.map((it: any) => it.referencia_evento_id).filter(Boolean))];

          if (refEventIds.length > 0) {
            const { data: lancDb, error: errLanc } = await supabase
              .from("lancamentos_intermitentes")
              .select("id, lote_fechamento_id, colaborador_id")
              .in("id", refEventIds);

            if (!errLanc && lancDb) {
              const lancMap = new Map<string, { lote_fechamento_id: string; colaborador_id: string }>();
              lancDb.forEach((l: any) => {
                if (l.id) {
                  lancMap.set(l.id, {
                    lote_fechamento_id: l.lote_fechamento_id,
                    colaborador_id: l.colaborador_id,
                  });
                }
              });

              // Mapear cada rh_lote_id para os fechamentos operacionais correspondentes
              const rhParaOpMap = new Map<string, Set<string>>();
              const opParaRhMap = new Map<string, Set<string>>();

              rhItensDb.forEach((it: any) => {
                const rhId = it.lote_id;
                const lancInfo = lancMap.get(it.referencia_evento_id);
                if (rhId && lancInfo?.lote_fechamento_id) {
                  const opId = lancInfo.lote_fechamento_id;
                  if (!rhParaOpMap.has(rhId)) rhParaOpMap.set(rhId, new Set());
                  rhParaOpMap.get(rhId)!.add(opId);

                  if (!opParaRhMap.has(opId)) opParaRhMap.set(opId, new Set());
                  opParaRhMap.get(opId)!.add(rhId);
                }
              });

              // Regra de equivalência estrita:
              // 1. rhLote deve possuir eventos comprovadamente ligados
              // 2. Todos os eventos do rhLote devem apontar para exatamente 1 lote operacional
              // 3. Nenhum outro rhLote pode apontar ambiguamente para o mesmo lote operacional
              // 4. Verificação adicional de coerência de empresa e tenant
              rhIntermitentes.forEach((rhLote: any) => {
                const targetOpIds = rhParaOpMap.get(rhLote.id);
                if (targetOpIds && targetOpIds.size === 1) {
                  const targetOpId = Array.from(targetOpIds)[0];
                  const opLotesMatching = opIntermitentes.filter((op: any) => op.id === targetOpId);

                  if (opLotesMatching.length === 1) {
                    const opLote = opLotesMatching[0];
                    const rhSourcesForOp = opParaRhMap.get(targetOpId);

                    const coerenciaEmpresa = !targetEmpresaId || String(rhLote.empresa_id) === String(opLote.empresa_id);
                    const coerenciaTenant = !rhLote.tenant_id || !opLote.tenant_id || String(rhLote.tenant_id) === String(opLote.tenant_id);

                    // Ausência de ambiguidade: exatamente 1 RH lote aponta para este lote operacional
                    if (rhSourcesForOp && rhSourcesForOp.size === 1 && coerenciaEmpresa && coerenciaTenant) {
                      suppressedRhIntermitenteIds.add(rhLote.id);
                    }
                  }
                }
              });
            }
          }
        }
      } catch (err) {
        console.warn("[DespesasOficialService] Falha ao verificar equivalência relacional de intermitentes. Preservando todos os registros por segurança:", err);
      }
    }

    // 3.3. Contagem de pessoas e convocações para lotes operacionais de intermitentes
    const opLoteIds = (opIntermitentes || []).map((l: any) => l.id).filter(Boolean);
    if (opLoteIds.length > 0) {
      try {
        const { data: lancOpDb, error: errLancOp } = await supabase
          .from("lancamentos_intermitentes")
          .select("lote_fechamento_id, colaborador_id")
          .in("lote_fechamento_id", opLoteIds);

        if (!errLancOp && lancOpDb) {
          const colabsPorLote = new Map<string, Set<string>>();
          const totalPorLote = new Map<string, number>();

          lancOpDb.forEach((it: any) => {
            const lid = it.lote_fechamento_id;
            if (!lid) return;
            if (!colabsPorLote.has(lid)) {
              colabsPorLote.set(lid, new Set());
              totalPorLote.set(lid, 0);
            }
            totalPorLote.set(lid, (totalPorLote.get(lid) || 0) + 1);
            if (it.colaborador_id) colabsPorLote.get(lid)!.add(it.colaborador_id);
          });

          opLoteIds.forEach((lid: string) => {
            intermitentesStatsMap.set(lid, {
              totalLancamentos: totalPorLote.get(lid),
              pessoasDistintas: colabsPorLote.get(lid)?.size,
            });
          });
        }
      } catch (err) {
        console.warn("[DespesasOficialService] Falha ao consultar contagens de intermitentes em lote:", err);
      }
    }

    // 4. Normalização Individual com Proteção Canônica
    const listaNormalizada: DespesaFederadaItem[] = [];

    // A. Custos Extras
    for (const item of resCustosExtras || []) {
      const sStatus = String(item.pipeline_status || "").toUpperCase();
      const sPag = String(item.status_pagamento || "").toUpperCase();

      // Regra FIX CEX-01 (GATE 5.14): Custos extras sob custódia operacional (RECEBIDO / EM_VALIDACAO)
      // não são obrigações financeiras aprovadas e não compõem a carteira de Contas a Pagar.
      // Somente registros aprovados pela operação (APROVADO_OPERACAO, ENVIADO_FINANCEIRO, FINALIZADO)
      // ou liquidados (status_pagamento = PAGO) são federados ao financeiro.
      const isOperacionalPendente = (sStatus === "RECEBIDO" || sStatus === "EM_VALIDACAO") && sPag !== "PAGO" && sStatus !== "FINALIZADO";
      if (isOperacionalPendente) {
        continue;
      }

      listaNormalizada.push(normalizarCustoExtra(item, empresasMap, mesCompetencia));
    }

    // B. CLT / RH
    for (const item of resLotesRh || []) {
      if (item.tipo === "DIARISTAS") {
        // Se vier mapeado em rh_financeiro_lotes, normaliza como Diaristas
        listaNormalizada.push(normalizarLoteDiarista(item, empresasMap, mesCompetencia));
      } else if (item.tipo === "INTERMITENTES") {
        // Suprime o espelho RH SOMENTE se houver correspondência relacional comprovada
        if (!suppressedRhIntermitenteIds.has(item.id)) {
          listaNormalizada.push(normalizarLoteIntermitente(item, empresasMap, mesCompetencia));
        }
      } else {
        listaNormalizada.push(normalizarLoteClt(item, empresasMap, mesCompetencia));
      }
    }

    // C. Diaristas Lotes
    for (const item of resDiaristas || []) {
      const stats = diaristasStatsMap.get(item.id);
      listaNormalizada.push(normalizarLoteDiarista(item, empresasMap, mesCompetencia, stats));
    }

    // D. Intermitentes Lotes
    for (const item of resIntermitentes || []) {
      const stats = intermitentesStatsMap.get(item.id);
      listaNormalizada.push(normalizarLoteIntermitente(item, empresasMap, mesCompetencia, stats));
    }

    // 5. DEDUPLICAÇÃO ESTRITA por Chave Canônica (ORIGEM:ID_CANONICO)
    const itensDeduplicados = deduplicarDespesas(listaNormalizada);

    // Ordenação canônica por data / vencimento descendente
    itensDeduplicados.sort((a, b) => {
      const dataA = a.dataVencimento || a.dataDespesa || a.competencia;
      const dataB = b.dataVencimento || b.dataDespesa || b.competencia;
      return String(dataB).localeCompare(String(dataA));
    });

    // 5. Cálculo dos 4 KPIs sobre o Universo Contextual Deduplicado
    const stats = calculateDespesasKpiStats(itensDeduplicados);

    return {
      itens: itensDeduplicados,
      stats,
    };
  },
};
