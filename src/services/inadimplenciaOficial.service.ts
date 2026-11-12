import { supabase } from "@/lib/supabase";
import { fetchAllSupabasePages } from "@/lib/supabasePagination";
import { getCurrentTenantId } from "./domain/base.service";
import { EnvironmentQueryFilter } from "./environment/EnvironmentQueryFilter";
import { parseISO, differenceInDays } from "date-fns";

// ==============================================================================
// ORBE ERP — CONV-12: INADIMPLÊNCIA & COBRANÇA OFICIAL
// Adapter de Apresentação e Serviço Desacoplado (InadimplenciaOficialService)
// ZERO MOCK — Consome 100% de estruturas reais do banco de dados.
// ==============================================================================

export type ModalidadeReceitaReal = "CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL";

export type StatusReceitaInadimplente =
  | "aguardando_fechamento"
  | "pendente_cobranca"
  | "cobranca_gerada"
  | "cobranca_enviada"
  | "pendente_recebimento";

export type FaixaAging = "1_30" | "31_60" | "61_90" | "mais_90";

export interface ItemReceitaInadimplenteUI {
  id: string;
  refOrigem: string;
  tipoOrigem: "Operação por Volume" | "Serviço Extra";
  descricao: string;
  valor: number;
  data: string;
  operacao_id?: string | null;
  servico_extra_id?: string | null;
}

export interface HistoricoCobrancaUI {
  id?: string;
  dataHora: string;
  acao: string;
  usuario: string;
  detalhes?: string;
}

export interface TituloInadimplenteUI {
  id: string;
  empresaId: string;
  clienteNome: string;
  modalidade: ModalidadeReceitaReal;
  competencia: string; // YYYY-MM
  competenciaFormatada: string;
  vencimento: string; // YYYY-MM-DD
  valorTotal: number;
  status: StatusReceitaInadimplente;
  observacao?: string | null;
  itens: ItemReceitaInadimplenteUI[];
  historico?: HistoricoCobrancaUI[];
  raw?: any;
}

export interface ClienteInadimplenteResumo {
  empresaId: string;
  clienteNome: string;
  totalInadimplente: number;
  quantidadeTitulos: number;
  maiorAtrasoDias: number;
  tituloMaisAntigoVencimento: string;
  faixaMaisCritica: FaixaAging;
  faixaMaisCriticaLabel: string;
  titulos: TituloInadimplenteUI[];
  dias_1_30: number;
  dias_31_60: number;
  dias_61_90: number;
  dias_mais_90: number;
  qtd_1_30: number;
  qtd_31_60: number;
  qtd_61_90: number;
  qtd_mais_90: number;
}

export interface KpisAgingTotais {
  totalInadimplente: number;
  quantidadeTotal: number;
  dias_1_30: number;
  qtd_1_30: number;
  dias_31_60: number;
  qtd_31_60: number;
  dias_61_90: number;
  qtd_61_90: number;
  dias_mais_90: number;
  qtd_mais_90: number;
  totalAcima60Dias: number;
  qtdAcima60Dias: number;
  percentualAcima60Dias: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function formatCompetencia(comp?: string | null): string {
  if (!comp || !/^\d{4}-\d{2}$/.test(comp)) return comp || "—";
  const [ano, mes] = comp.split("-");
  const mesIndex = parseInt(mes, 10) - 1;
  return `${MESES[mesIndex] || mes} / ${ano}`;
}

export function formatCurrency(val?: number | null): string {
  return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateStr);
}

/**
 * Cálculo seguro de dias de atraso com proteção de fuso horário.
 * Se dataCorte não for informada, utiliza a data corrente (YYYY-MM-DD).
 */
export function calcularDiasAtraso(vencimento: string, dataCorte?: string): number {
  if (!vencimento) return 0;
  const hojeStr = dataCorte || new Date().toISOString().split("T")[0];
  const dRef = parseISO(hojeStr);
  const dVenc = parseISO(vencimento.split("T")[0]);
  return differenceInDays(dRef, dVenc);
}

export function getFaixaAging(diasAtraso: number): FaixaAging {
  if (diasAtraso <= 30) return "1_30";
  if (diasAtraso <= 60) return "31_60";
  if (diasAtraso <= 90) return "61_90";
  return "mais_90";
}

export function getFaixaAgingLabel(faixa: FaixaAging): string {
  switch (faixa) {
    case "1_30":
      return "1 a 30 dias";
    case "31_60":
      return "31 a 60 dias";
    case "61_90":
      return "61 a 90 dias";
    case "mais_90":
      return "+90 dias";
  }
}

export function getFaixaAgingBadgeClass(faixa: FaixaAging): string {
  switch (faixa) {
    case "1_30":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800";
    case "31_60":
      return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800";
    case "61_90":
      return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
    case "mais_90":
      return "bg-red-100 text-red-800 border-red-300 font-semibold dark:bg-red-950/60 dark:text-red-300 dark:border-red-700";
  }
}

export function getStatusCobrancaLabel(status: string): string {
  switch (status) {
    case "aguardando_fechamento":
      return "Aguardando Fechamento";
    case "pendente_cobranca":
      return "Cobrança Pendente";
    case "cobranca_gerada":
      return "Cobrança Gerada";
    case "cobranca_enviada":
      return "Cobrança Enviada";
    case "pendente_recebimento":
      return "Aguardando Recebimento";
    case "recebido":
      return "Recebido";
    case "conciliado":
      return "Conciliado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

export function getStatusCobrancaBadgeClass(status: string): string {
  switch (status) {
    case "aguardando_fechamento":
      return "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
    case "pendente_cobranca":
      return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
    case "cobranca_gerada":
      return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
    case "cobranca_enviada":
      return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300";
    case "pendente_recebimento":
      return "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export function getModalidadeLabel(mod: ModalidadeReceitaReal): string {
  switch (mod) {
    case "CAIXA_IMEDIATO":
      return "Caixa Imediato";
    case "DUPLICATA":
      return "Duplicata";
    case "FATURAMENTO_MENSAL":
      return "Faturamento Mensal";
    default:
      return mod;
  }
}

export function getContextoCobrancaDescricao(status: string): string {
  switch (status) {
    case "pendente_cobranca":
      return "O faturamento foi consolidado mas o documento de cobrança ainda não foi emitido ou processado.";
    case "cobranca_gerada":
      return "A fatura comercial em PDF foi emitida e aguarda declaração de envio ao cliente.";
    case "cobranca_enviada":
      return "O documento de cobrança foi formalmente registrado como enviado ao cliente tomador do serviço.";
    case "pendente_recebimento":
      return "A cobrança foi encaminhada e o financeiro aguarda a liquidação bancária/comprovante.";
    case "aguardando_fechamento":
      return "A competência mensal ainda não foi encerrada formalmente no ORBE.";
    default:
      return "Título em processo operacional de acompanhamento.";
  }
}

/**
 * Calcula os KPIs de Aging sobre o universo contextual (invariante a filtros de busca e tabela).
 */
export function calcularKpisInadimplencia(
  titulos: TituloInadimplenteUI[],
  dataCorte?: string
): KpisAgingTotais {
  const totais: KpisAgingTotais = {
    totalInadimplente: 0,
    quantidadeTotal: titulos.length,
    dias_1_30: 0,
    qtd_1_30: 0,
    dias_31_60: 0,
    qtd_31_60: 0,
    dias_61_90: 0,
    qtd_61_90: 0,
    dias_mais_90: 0,
    qtd_mais_90: 0,
    totalAcima60Dias: 0,
    qtdAcima60Dias: 0,
    percentualAcima60Dias: 0,
  };

  for (const t of titulos) {
    const dias = calcularDiasAtraso(t.vencimento, dataCorte);
    const faixa = getFaixaAging(dias);
    const valor = Number(t.valorTotal) || 0;

    totais.totalInadimplente += valor;

    if (faixa === "1_30") {
      totais.dias_1_30 += valor;
      totais.qtd_1_30 += 1;
    } else if (faixa === "31_60") {
      totais.dias_31_60 += valor;
      totais.qtd_31_60 += 1;
    } else if (faixa === "61_90") {
      totais.dias_61_90 += valor;
      totais.qtd_61_90 += 1;
      totais.totalAcima60Dias += valor;
      totais.qtdAcima60Dias += 1;
    } else {
      totais.dias_mais_90 += valor;
      totais.qtd_mais_90 += 1;
      totais.totalAcima60Dias += valor;
      totais.qtdAcima60Dias += 1;
    }
  }

  totais.percentualAcima60Dias =
    totais.totalInadimplente > 0
      ? Math.round((totais.totalAcima60Dias / totais.totalInadimplente) * 100)
      : 0;

  return totais;
}

/**
 * Agrupa títulos estritamente pelo identificador canônico da empresa (empresaId).
 */
export function agruparInadimplenciaPorCliente(
  titulos: TituloInadimplenteUI[],
  dataCorte?: string
): ClienteInadimplenteResumo[] {
  const map = new Map<string, ClienteInadimplenteResumo>();

  for (const t of titulos) {
    const empId = t.empresaId;
    if (!map.has(empId)) {
      map.set(empId, {
        empresaId: empId,
        clienteNome: t.clienteNome,
        totalInadimplente: 0,
        quantidadeTitulos: 0,
        maiorAtrasoDias: 0,
        tituloMaisAntigoVencimento: t.vencimento,
        faixaMaisCritica: "1_30",
        faixaMaisCriticaLabel: "1 a 30 dias",
        titulos: [],
        dias_1_30: 0,
        dias_31_60: 0,
        dias_61_90: 0,
        dias_mais_90: 0,
        qtd_1_30: 0,
        qtd_31_60: 0,
        qtd_61_90: 0,
        qtd_mais_90: 0,
      });
    }

    const c = map.get(empId)!;
    const dias = calcularDiasAtraso(t.vencimento, dataCorte);
    const faixa = getFaixaAging(dias);
    const valor = Number(t.valorTotal) || 0;

    c.titulos.push(t);
    c.totalInadimplente += valor;
    c.quantidadeTitulos += 1;

    if (dias > c.maiorAtrasoDias) {
      c.maiorAtrasoDias = dias;
    }

    if (t.vencimento < c.tituloMaisAntigoVencimento) {
      c.tituloMaisAntigoVencimento = t.vencimento;
    }

    if (faixa === "1_30") {
      c.dias_1_30 += valor;
      c.qtd_1_30 += 1;
    } else if (faixa === "31_60") {
      c.dias_31_60 += valor;
      c.qtd_31_60 += 1;
    } else if (faixa === "61_90") {
      c.dias_61_90 += valor;
      c.qtd_61_90 += 1;
    } else {
      c.dias_mais_90 += valor;
      c.qtd_mais_90 += 1;
    }
  }

  // Determina faixa mais crítica de cada cliente
  for (const c of map.values()) {
    if (c.qtd_mais_90 > 0) {
      c.faixaMaisCritica = "mais_90";
    } else if (c.qtd_61_90 > 0) {
      c.faixaMaisCritica = "61_90";
    } else if (c.qtd_31_60 > 0) {
      c.faixaMaisCritica = "31_60";
    } else {
      c.faixaMaisCritica = "1_30";
    }
    c.faixaMaisCriticaLabel = getFaixaAgingLabel(c.faixaMaisCritica);
  }

  return Array.from(map.values()).sort((a, b) => b.totalInadimplente - a.totalInadimplente);
}

export interface ReceitaContextualParaInadimplencia {
  id?: string;
  empresa_id?: string | null;
  competencia?: string | null;
  created_at?: string | null;
  vencimento?: string | null;
  data_recebimento?: string | null;
  status?: string | null;
  valor_total?: number | string | null;
}

export interface ResumoInadimplenciaContextual {
  totalInadimplente: number;
  quantidadeTitulos: number;
}

const STATUS_LIQUIDADOS_OU_CANCELADOS_RECEITA = new Set([
  "recebido",
  "pago",
  "conciliado",
  "cancelado",
  "estornado",
]);

function normalizeCompetenciaInadimplencia(competencia?: string): string {
  if (!competencia) return "";
  const trimmed = competencia.trim();
  const matchAll = /^(\d{4})-all$/i.exec(trimmed);
  if (matchAll) return `${matchAll[1]}-all`;
  const matchMonth = /^(\d{4})-(\d{2})/.exec(trimmed);
  if (matchMonth) return `${matchMonth[1]}-${matchMonth[2]}`;
  return trimmed;
}

function getNextMonthStartDate(canonicalMonth: string): string {
  const [yearStr, monthStr] = canonicalMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return canonicalMonth;
  }
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * Calcula o total inadimplente a partir da regra oficial de `receitas_operacionais`:
 * - status ativo (nao recebido, pago, conciliado, cancelado ou estornado)
 * - sem data_recebimento
 * - vencimento nao nulo e estritamente menor que dataCorte (YYYY-MM-DD)
 * - competencia compativel com o recorte do Dashboard (YYYY-MM ou YYYY-all)
 * - deduplicacao por id e soma em centavos para evitar erro de ponto flutuante
 */
export function calcularTotalInadimplenteContextual(
  titulos: ReceitaContextualParaInadimplencia[],
  options?: {
    competencia?: string;
    dataCorte?: string;
  }
): ResumoInadimplenciaContextual {
  const dataCorte = options?.dataCorte || new Date().toISOString().split("T")[0];
  const canonicalCompetencia = normalizeCompetenciaInadimplencia(options?.competencia);
  const isAnual = canonicalCompetencia.endsWith("-all");
  const yearPart = isAnual ? canonicalCompetencia.split("-")[0] : "";

  const seenIds = new Set<string>();
  let totalCents = 0;
  let quantidadeTitulos = 0;

  for (const item of titulos || []) {
    if (!item) continue;

    if (item.id) {
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);
    }

    if (canonicalCompetencia) {
      const itemComp =
        item.competencia ||
        (item.created_at ? String(item.created_at).slice(0, 7) : "");
      if (isAnual) {
        if (!itemComp.startsWith(`${yearPart}-`)) continue;
      } else if (itemComp && itemComp !== canonicalCompetencia) {
        continue;
      }
    }

    const stat = String(item.status || "").trim().toLowerCase();
    if (!stat || STATUS_LIQUIDADOS_OU_CANCELADOS_RECEITA.has(stat)) continue;
    if (item.data_recebimento) continue;

    const vencStr = item.vencimento ? String(item.vencimento).slice(0, 10) : "";
    if (!vencStr || !/^\d{4}-\d{2}-\d{2}$/.test(vencStr)) continue;
    if (vencStr >= dataCorte) continue;

    const numericValor = Number(item.valor_total ?? 0);
    if (!Number.isFinite(numericValor) || numericValor <= 0) continue;

    const valorCents = Math.round(numericValor * 100);
    if (valorCents <= 0) continue;

    totalCents += valorCents;
    quantidadeTitulos += 1;
  }

  return {
    totalInadimplente: Number((totalCents / 100).toFixed(2)),
    quantidadeTitulos,
  };
}

class InadimplenciaOficialServiceClass {
  /**
   * Consulta títulos vencidos no banco com respeito rigoroso a:
   * - tenant_id
   * - empresa_id (específica ou todas)
   * - EnvironmentQueryFilter (Produção x Homologação)
   * - Vencimento < hoje E status NOT IN ('recebido', 'pago', 'conciliado', 'cancelado')
   */
  async getTitulosInadimplentesContextuais(
    empresaId?: string,
    dataCorte?: string
  ): Promise<TituloInadimplenteUI[]> {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) throw new Error("Tenant não encontrado.");

    const hojeStr = dataCorte || new Date().toISOString().split("T")[0];

    // Obter testIds para aplicação de escopo de ambiente oficial
    const { data: testEmpresas, error: testEmpresasError } = await supabase
      .from("empresas")
      .select("id")
      .eq("is_teste", true);
    if (testEmpresasError) {
      throw testEmpresasError;
    }
    const testIds = testEmpresas?.map((e) => e.id) || [];

    const buildQuery = () => {
      let query = supabase
        .from("receitas_operacionais")
        .select(`
          *,
          empresas:empresa_id(id, nome),
          receitas_operacionais_itens(
            id,
            valor_item,
            operacao_id,
            servico_extra_id,
            created_at,
            operacoes_producao(
              id,
              data_operacao,
              servicos:tipos_servico_operacional(nome),
              produtos:produtos_carga(nome)
            ),
            servicos_extras_operacionais:servico_extra_id(
              id,
              data,
              descricao_servico,
              tipo_servico
            )
          )
        `)
        .eq("tenant_id", tenantId)
        .not("status", "in", '("recebido","pago","conciliado","cancelado")')
        .not("vencimento", "is", null)
        .lt("vencimento", hojeStr);

      if (empresaId && empresaId !== "all") {
        query = query.eq("empresa_id", empresaId);
      } else {
        query = EnvironmentQueryFilter.applyEmpresaScope(query, {
          tenantId,
          column: "empresa_id",
          includeNullInProduction: false,
          testIds,
        });
      }

      return query
        .order("vencimento", { ascending: true })
        .order("id", { ascending: true });
    };

    let rawList: any[];
    try {
      rawList = await fetchAllSupabasePages(buildQuery);
    } catch (error) {
      console.error("[InadimplenciaOficialService] Erro ao buscar inadimplência:", error);
      throw error;
    }

    return rawList.map((r: any): TituloInadimplenteUI => {
      const itensRaw = r.receitas_operacionais_itens || [];
      const itensUI: ItemReceitaInadimplenteUI[] = itensRaw.map((it: any) => {
        const isSe = Boolean(it.servico_extra_id != null || it.servicos_extras_operacionais != null);
        const refOrigem = isSe
          ? `SEX-${String(it.servico_extra_id || it.id).slice(0, 4).toUpperCase()}`
          : `OPV-${String(it.operacao_id || it.id).slice(0, 4).toUpperCase()}`;

        let descricao = "Item Operacional";
        if (isSe) {
          descricao =
            it.servicos_extras_operacionais?.descricao_servico ||
            it.servicos_extras_operacionais?.tipo_servico ||
            "Serviço Extra";
        } else {
          descricao =
            it.operacoes_producao?.servicos?.nome ||
            it.operacoes_producao?.produtos?.nome ||
            "Operação por Volume";
        }

        const dataFato = isSe
          ? (it.servicos_extras_operacionais?.data || it.created_at)
          : (it.operacoes_producao?.data_operacao || it.created_at);

        return {
          id: it.id,
          refOrigem,
          tipoOrigem: isSe ? "Serviço Extra" : "Operação por Volume",
          descricao,
          valor: Number(it.valor_item || 0),
          data: String(dataFato || "").slice(0, 10),
          operacao_id: it.operacao_id,
          servico_extra_id: it.servico_extra_id,
        };
      });

      const compCanonica = r.competencia || (r.created_at ? String(r.created_at).slice(0, 7) : "");

      return {
        id: r.id,
        empresaId: r.empresa_id,
        clienteNome: r.empresas?.nome || "Cliente Desconhecido",
        modalidade: r.modalidade as ModalidadeReceitaReal,
        competencia: compCanonica,
        competenciaFormatada: formatCompetencia(compCanonica),
        vencimento: String(r.vencimento).slice(0, 10),
        valorTotal: Number(r.valor_total || 0),
        status: r.status as StatusReceitaInadimplente,
        observacao: r.observacao || null,
        itens: itensUI,
        raw: r,
      };
    });
  }

  /**
   * Consulta o valor total inadimplente alinhado ao recorte contextual do Dashboard
   * (tenant, empresa, competencia YYYY-MM ou YYYY-all, data de corte e ambiente).
   */
  async getTotalInadimplenteByContexto(params: {
    tenantId?: string;
    empresaId?: string;
    competencia?: string;
    dataCorte?: string;
    environment?: string;
  }): Promise<ResumoInadimplenciaContextual> {
    const resolvedTenantId = params.tenantId || (await getCurrentTenantId());
    if (!resolvedTenantId) {
      throw new Error("Tenant não encontrado para consulta de inadimplência.");
    }

    const hojeStr = params.dataCorte || new Date().toISOString().split("T")[0];
    const canonicalCompetencia = normalizeCompetenciaInadimplencia(params.competencia);
    const isAnual = canonicalCompetencia.endsWith("-all");
    const yearPart = isAnual ? Number(canonicalCompetencia.split("-")[0]) : 0;
    const normalizedEmpresaId =
      params.empresaId && params.empresaId !== "all" ? params.empresaId : undefined;

    const { data: testEmpresas, error: testEmpresasError } = await supabase
      .from("empresas")
      .select("id")
      .eq("is_teste", true);
    if (testEmpresasError) {
      throw testEmpresasError;
    }
    const testIds = testEmpresas?.map((e) => e.id) || [];

    let query = supabase
      .from("receitas_operacionais")
      .select("id, empresa_id, competencia, created_at, vencimento, data_recebimento, status, valor_total")
      .eq("tenant_id", resolvedTenantId)
      .not("status", "in", '("recebido","pago","conciliado","cancelado")')
      .is("data_recebimento", null)
      .not("vencimento", "is", null)
      .lt("vencimento", hojeStr);

    if (canonicalCompetencia) {
      if (isAnual && Number.isFinite(yearPart) && yearPart > 0) {
        query = query.or(
          `and(competencia.gte.${yearPart}-01,competencia.lt.${yearPart + 1}-01),and(competencia.is.null,created_at.gte.${yearPart}-01-01,created_at.lt.${yearPart + 1}-01-01)`
        );
      } else if (/^\d{4}-\d{2}$/.test(canonicalCompetencia)) {
        const startRange = `${canonicalCompetencia}-01`;
        const endRange = getNextMonthStartDate(canonicalCompetencia);
        query = query.or(
          `competencia.eq.${canonicalCompetencia},and(competencia.is.null,created_at.gte.${startRange},created_at.lt.${endRange})`
        );
      }
    }

    query = EnvironmentQueryFilter.applyEmpresaScope(query, {
      tenantId: resolvedTenantId,
      column: "empresa_id",
      includeNullInProduction: false,
      testIds,
      targetEmpresaId: normalizedEmpresaId,
      environment: params.environment,
    });

    if (normalizedEmpresaId) {
      query = query.eq("empresa_id", normalizedEmpresaId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[InadimplenciaOficialService] Erro ao buscar resumo contextual de inadimplência:", error);
      throw error;
    }

    return calcularTotalInadimplenteContextual(
      (data || []) as ReceitaContextualParaInadimplencia[],
      {
        competencia: canonicalCompetencia || undefined,
        dataCorte: hojeStr,
      }
    );
  }
}

export const InadimplenciaOficialService = new InadimplenciaOficialServiceClass();
