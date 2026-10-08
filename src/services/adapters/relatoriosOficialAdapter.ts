/**
 * ORBE ERP — CONV-14: Central de Relatórios Oficial
 * Adapter Desacoplado de Relatórios (relatoriosOficialAdapter.ts)
 * 
 * ZERO MOCK — Consome 100% de estruturas e serviços canônicos reais homologados.
 * Aplica isolamento obrigatório por tenant_id, empresa_id e ambiente.
 * R06 (Produtividade Individual) permanece bloqueado.
 */

import { supabase } from "@/lib/supabase";
import { getCurrentTenantId, operationalClient } from "@/services/domain/base.service";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { EnvironmentQueryFilter } from "@/services/environment/EnvironmentQueryFilter";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { ReceitasOficialService } from "@/services/receitasOficial.service";
import { ServicosExtrasOperacionaisService } from "@/services/receitas/receitas.service";

// ============================================================
// METADADOS E CATÁLOGO OFICIAL
// ============================================================
export interface ReportMeta {
  id: string;
  code: string;
  title: string;
  description: string;
  category: "OPERACIONAL" | "PESSOAS & RH" | "FINANCEIRO & FATURAMENTO";
  status: "ready" | "in_preparation";
  outputFormats: Array<"CSV" | "PDF">;
  primaryTemporalType: "data_operacao" | "competencia" | "ciclo_semanal" | "data_custo";
  allowedRoles: Array<"admin" | "gestor" | "financeiro" | "rh">;
}

export const RELATORIOS_CATALOGO_OFICIAL: ReportMeta[] = [
  // OPERACIONAL
  {
    id: "r01-operacoes-volume",
    code: "R01",
    title: "Analítico de Operações por Volume",
    description: "Operações, cargas, quantidades, valores e status de descargas",
    category: "OPERACIONAL",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "data_operacao",
    allowedRoles: ["admin", "gestor", "financeiro", "rh"],
  },
  {
    id: "r04-custos-extras",
    code: "R04",
    title: "Custos Extras Operacionais",
    description: "Despesas extraordinárias por período, unidade e categoria de gasto",
    category: "OPERACIONAL",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "data_custo",
    allowedRoles: ["admin", "gestor", "financeiro", "rh"],
  },
  {
    id: "r07-servicos-extras",
    code: "R07",
    title: "Analítico de Serviços Extras",
    description: "Serviços adicionais, transbordos, enlonamento e faturamentos complementares",
    category: "OPERACIONAL",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "data_operacao",
    allowedRoles: ["admin", "gestor", "financeiro", "rh"],
  },

  // PESSOAS & RH
  {
    id: "r02-fechamento-diaristas",
    code: "R02",
    title: "Fechamento de Diaristas",
    description: "Consolidação de diárias, funções, lotes semanais e liquidações",
    category: "PESSOAS & RH",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "ciclo_semanal",
    allowedRoles: ["admin", "gestor", "financeiro", "rh"],
  },
  {
    id: "r05-banco-horas",
    code: "R05",
    title: "Consolidado de Banco de Horas",
    description: "Créditos, débitos, saldos acumulados e horas a vencer em horas e minutos",
    category: "PESSOAS & RH",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "competencia",
    allowedRoles: ["admin", "gestor", "rh"], // Estritamente bloqueado para Financeiro
  },

  // FINANCEIRO & FATURAMENTO
  {
    id: "r03-faturamento-receitas",
    code: "R03",
    title: "Faturamento e Receitas",
    description: "Receitas por cliente, competência, modalidade e situação de recebimento",
    category: "FINANCEIRO & FATURAMENTO",
    status: "ready",
    outputFormats: ["CSV", "PDF"],
    primaryTemporalType: "competencia",
    allowedRoles: ["admin", "gestor", "financeiro"], // Estritamente bloqueado para RH
  },
];

// Tipos do Filtro Global por Fluxo
export type FluxoId =
  | "todos"
  | "operacoes-volume"
  | "servicos-extras"
  | "custos-extras"
  | "diaristas"
  | "banco-horas"
  | "faturamento-receitas";

export interface FluxoOption {
  id: FluxoId;
  label: string;
  reportCode?: string;
  description: string;
}

export const FLUXOS_DISPONIVEIS: FluxoOption[] = [
  { id: "todos", label: "Todos os Fluxos", description: "Visão consolidada transversal dos 6 cadernos oficiais" },
  { id: "operacoes-volume", label: "Operações por Volume", reportCode: "R01", description: "Movimentação operacional, volumes e descargas" },
  { id: "servicos-extras", label: "Serviços Extras", reportCode: "R07", description: "Serviços extraordinários e faturamentos adicionais" },
  { id: "custos-extras", label: "Custos Extras", reportCode: "R04", description: "Despesas de campo, ferramentas e manutenções" },
  { id: "diaristas", label: "Diaristas", reportCode: "R02", description: "Apuração semanal de diárias e lotes operacionais" },
  { id: "banco-horas", label: "Banco de Horas", reportCode: "R05", description: "Saldos, créditos/débitos e vencimentos de horas CLT" },
  { id: "faturamento-receitas", label: "Faturamento / Receitas", reportCode: "R03", description: "Livro fiscal de receitas faturadas e conciliação" },
];

// ============================================================
// GOVERNANÇA DE ACESSO (RBAC POR CÓDIGO DE RELATÓRIO)
// ============================================================
export function checkReportAccess(reportIdOrCode: string, role?: string | null): boolean {
  if (!role) return false;
  const normalizedRole = role.toLowerCase();

  // R06 (Produtividade Individual) permanece ESTRITAMENTE BLOQUEADO para todos os perfis
  if (
    reportIdOrCode === "r06-produtividade-individual" ||
    reportIdOrCode.toUpperCase() === "R06" ||
    reportIdOrCode.toUpperCase() === "R6"
  ) {
    return false;
  }

  if (normalizedRole === "admin" || normalizedRole === "gestor") return true;

  const code = reportIdOrCode.toUpperCase().replace(/^R0?/, "R0");
  const report = RELATORIOS_CATALOGO_OFICIAL.find(
    (r) => r.id === reportIdOrCode || r.code === code || r.code === reportIdOrCode.toUpperCase()
  );

  if (!report) return false;
  return report.allowedRoles.includes(normalizedRole as any);
}

// ============================================================
// MODELOS DE DADOS NORMALIZADOS PARA OS SEIS RELATÓRIOS
// ============================================================

// R01 — Operações por Volume
export interface OperacaoVolumeRow {
  id: string;
  empresaId: string;
  dataOperacao: string; // YYYY-MM-DD
  codigoOperacional: string;
  unidade: string;
  transportadora: string;
  tipoServico: string;
  produtoCarga: string;
  quantidade: number;
  valorUnitario: number;
  totalBruto: number;
  materiais: number;
  iss: number;
  placa: string;
  nfNumero: string | null;
  status: string;
}

// R02 — Diaristas
export interface DiaristaFechamentoRow {
  id: string;
  empresaId: string;
  cicloId: string;
  cicloLabel: string;
  dataLancamento: string;
  colaboradorNome: string;
  cpfMascarado: string;
  funcao: string;
  codigoMarcacao: "P" | "MP";
  quantidadeDiarias: number;
  valorDiariaBase: number;
  total: number;
  loteCodigo: string;
  statusLote: "em_aberto" | "fechado_para_pagamento" | "enviado_financeiro" | "pago" | "cancelado";
}

// R03 — Faturamento e Receitas
export interface FaturamentoReceitaRow {
  id: string;
  empresaId: string;
  competencia: string;
  competenciaFormatada: string;
  clienteNome: string;
  modalidade: "FATURAMENTO_MENSAL" | "DUPLICATA" | "CAIXA_IMEDIATO";
  origem: "Operação por Volume" | "Serviço Extra";
  valorFaturado: number;
  vencimento: string;
  dataRecebimento: string | null;
  status: string;
}

// R04 — Custos Extras
export interface CustoExtraRow {
  id: string;
  empresaId: string;
  data: string;
  unidade: string;
  categoriaCusto: "MERENDA" | "ADMINISTRATIVO" | "OPERACIONAL" | "FORNECEDOR";
  descricao: string;
  favorecidoTipo: "Colaborador" | "Fornecedor";
  favorecidoNome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  origemRecurso: "CAIXINHA" | "TRANSFERENCIA" | "BOLETO" | "REEMBOLSO";
  lancadorNome: string;
  status: "PENDENTE" | "ATRASADO" | "PAGO";
}

// R05 — Banco de Horas
export interface BancoHorasRow {
  id: string;
  empresaId: string;
  matricula: string;
  colaboradorNome: string;
  competencia: string;
  saldoMinutos: number;
  saldoFormatado: string;
  creditosMinutos: number;
  creditosFormatado: string;
  debitosMinutos: number;
  debitosFormatado: string;
  aVencer30dMinutos: number;
  aVencer30dFormatado: string;
  vencidasMinutos: number;
  vencidasFormatado: string;
  status: "OK" | "Débito" | "A Vencer" | "Crítico";
}

// R07 — Serviços Extras
export interface ServicoExtraRow {
  id: string;
  empresaId: string;
  data: string;
  tipoServico: string;
  descricao: string;
  tomadorNome: string;
  quantidade: number;
  valorUnitario: number;
  total: number;
  modalidadeFinanceira: "DEPOSITO_IMEDIATO" | "CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL";
  nfNumero: string | null;
  pipelineStatus: "PENDENTE" | "EM_VALIDACAO" | "APROVADO_OPERACAO" | "APROVADO_FINANCEIRO" | "FATURADO" | "CONCLUIDO" | "DEVOLVIDO";
}

// ============================================================
// FORMATADORES AUXILIARES
// ============================================================
export function formatBRL(val: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val || 0);
}

export function formatMinutosToHourString(minutos: number): string {
  const sign = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function maskCpf(cpf?: string | null): string {
  if (!cpf) return "—";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length === 11) {
    return `***.***.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
  }
  return "***.***.***-**";
}

// Tradutores de apresentação
export function getModalidadeLabel(modalidade: string): string {
  switch (modalidade) {
    case "FATURAMENTO_MENSAL": return "Faturamento Mensal";
    case "DUPLICATA": return "Duplicata";
    case "CAIXA_IMEDIATO": return "Caixa Imediato";
    default: return modalidade || "—";
  }
}

export function getStatusReceitaLabel(status: string): string {
  switch (status) {
    case "pendente_recebimento": return "Pendente Recebimento";
    case "pendente_cobranca": return "Pendente Cobrança";
    case "aguardando_fechamento": return "Aguardando Fechamento";
    case "cobranca_enviada": return "Cobrança Enviada";
    case "recebido": return "Recebido";
    case "pago": return "Pago";
    case "conciliado": return "Conciliado";
    case "cancelado": return "Cancelado";
    default: return status || "Pendente";
  }
}

export function getSituacaoDerivadaReceita(
  row: FaturamentoReceitaRow,
  dataReferencia: string = new Date().toISOString().slice(0, 10)
): { isAtrasado: boolean; diasAtraso: number; descricao: string } {
  if (row.status === "conciliado" || row.status === "recebido" || row.status === "pago" || row.status === "cancelado") {
    return { isAtrasado: false, diasAtraso: 0, descricao: "Liquidado" };
  }
  if (row.dataRecebimento) {
    return { isAtrasado: false, diasAtraso: 0, descricao: "Liquidado" };
  }
  if (row.vencimento && row.vencimento < dataReferencia) {
    const dVenc = new Date(row.vencimento).getTime();
    const dRef = new Date(dataReferencia).getTime();
    const dias = Math.max(1, Math.round((dRef - dVenc) / (1000 * 60 * 60 * 24)));
    return { isAtrasado: true, diasAtraso: dias, descricao: `Em Atraso (${dias}d)` };
  }
  return { isAtrasado: false, diasAtraso: 0, descricao: "No Prazo" };
}

export function getStatusLoteDiaristaLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "pago":
      return { label: "Pago", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
    case "enviado_financeiro":
      return { label: "Enviado Financeiro", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
    case "fechado_para_pagamento":
      return { label: "Fechado p/ Pgto", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" };
    case "em_aberto":
      return { label: "Em Aberto", className: "bg-muted text-muted-foreground border-border/60" };
    case "cancelado":
      return { label: "Cancelado", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" };
    default:
      return { label: status || "Em Aberto", className: "bg-muted text-muted-foreground border-border/60" };
  }
}

export function getStatusCustoExtraLabel(status: string): { label: string; className: string } {
  const norm = (status || "").toUpperCase();
  switch (norm) {
    case "PAGO":
      return { label: "Pago", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
    case "PENDENTE":
      return { label: "Pendente", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
    case "ATRASADO":
      return { label: "Atrasado", className: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" };
    default:
      return { label: status || "Pendente", className: "bg-muted text-muted-foreground border-border/60" };
  }
}

export function getCategoriaCustoLabel(cat: string): string {
  switch (cat) {
    case "MERENDA": return "Merenda / Lanche";
    case "ADMINISTRATIVO": return "Administrativo";
    case "OPERACIONAL": return "Operacional";
    case "FORNECEDOR": return "Fornecedor";
    default: return cat || "Operacional";
  }
}

export function getPipelineStatusServicoExtraLabel(status: string): { label: string; className: string } {
  switch (status) {
    case "CONCLUIDO":
      return { label: "Concluído", className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" };
    case "FATURADO":
      return { label: "Faturado", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" };
    case "APROVADO_FINANCEIRO":
      return { label: "Aprov. Financeiro", className: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30" };
    case "APROVADO_OPERACAO":
      return { label: "Aprov. Operação", className: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30" };
    case "EM_VALIDACAO":
      return { label: "Em Validação", className: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30" };
    case "PENDENTE":
      return { label: "Pendente", className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" };
    case "DEVOLVIDO":
      return { label: "Devolvido", className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30" };
    default:
      return { label: status || "Pendente", className: "bg-muted text-muted-foreground border-border/60" };
  }
}

export function getCompetenciaDateRange(competencia?: string): { inicio: string; fimExclusivo: string } | null {
  if (!competencia || !/^\d{4}-\d{2}$/.test(competencia)) return null;
  const [anoStr, mesStr] = competencia.split("-");
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);
  const inicio = `${competencia}-01`;
  const proxMes = mes === 12 ? 1 : mes + 1;
  const proxAno = mes === 12 ? ano + 1 : ano;
  const fimExclusivo = `${proxAno}-${String(proxMes).padStart(2, "0")}-01`;
  return { inicio, fimExclusivo };
}

// ============================================================
// ADAPTER SERVICE PRINCIPAL
// ============================================================
class RelatoriosOficialAdapterClass {
  /**
   * Consulta R01 com isolamento total (tenant, empresa, ambiente, competência/período)
   * Consulta canônica direta em operacoes_producao com foreign keys relacionais auditadas.
   */
  async getR01Data(empresaId: string, options?: { competencia?: string; dataDe?: string; dataAte?: string }): Promise<OperacaoVolumeRow[]> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para consulta R01");
    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    let query = operationalClient
      .from("operacoes_producao")
      .select(`
        id,
        empresa_id,
        data_operacao,
        codigo_operacional,
        quantidade,
        valor_unitario_snapshot,
        valor_total,
        valor_descarga,
        valor_total_materiais,
        custo_com_iss,
        placa,
        nf_numero,
        status,
        unidades:unidade_id(nome),
        transportadoras_clientes:transportadora_id(nome),
        tipos_servico_operacional:tipo_servico_id(nome),
        produtos_carga:produto_carga_id(nome)
      `)
      .eq("tenant_id", tenantId)
      .eq("empresa_id", empresaId)
      .is("deleted_at", null);

    const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
    query = EnvironmentQueryFilter.applyEmpresaScope(query as any, {
      tenantId,
      column: "empresa_id",
      includeNullInProduction: false,
      testIds,
    });

    if (options?.dataDe) query = query.gte("data_operacao", options.dataDe);
    if (options?.dataAte) query = query.lte("data_operacao", options.dataAte);

    if (options?.competencia && !options.dataDe && !options.dataAte) {
      const range = getCompetenciaDateRange(options.competencia);
      if (range) {
        query = query.gte("data_operacao", range.inicio).lt("data_operacao", range.fimExclusivo);
      }
    }

    query = query.order("data_operacao", { ascending: false });

    const { data: raw, error } = await query;
    if (error) {
      console.error("[relatoriosOficialAdapter] Erro em R01:", error);
      throw error;
    }

    return (raw || []).map((r: any): OperacaoVolumeRow => ({
      id: r.id,
      empresaId: r.empresa_id,
      dataOperacao: String(r.data_operacao || "").slice(0, 10),
      codigoOperacional: r.codigo_operacional || `OPV-${String(r.id || "").slice(0, 4).toUpperCase()}`,
      unidade: r.unidades?.nome || "Matriz",
      transportadora: r.transportadoras_clientes?.nome || "Não informada",
      tipoServico: r.tipos_servico_operacional?.nome || "Descarga",
      produtoCarga: r.produtos_carga?.nome || "Carga Geral",
      quantidade: Number(r.quantidade || 0),
      valorUnitario: Number(r.valor_unitario_snapshot || 0),
      totalBruto: Number(r.valor_total || 0),
      materiais: Number(r.valor_total_materiais || 0),
      iss: Number(r.custo_com_iss || 0),
      placa: r.placa || "—",
      nfNumero: r.nf_numero || null,
      status: r.status || "pendente",
    }));
  }

  /**
   * Consulta R02 com isolamento total (lotes de fechamento + lançamentos analíticos)
   * Preserva a semântica temporal: lotes filtrados estritamente pela competência (mes_referencia)
   * ou intervalo de datas, impedindo que lançamentos de outros meses (ex: agosto) vazem para setembro.
   */
  async getR02Data(empresaId: string, options?: { competencia?: string; dataDe?: string; dataAte?: string; cicloId?: string }): Promise<DiaristaFechamentoRow[]> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para consulta R02");
    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    const range = getCompetenciaDateRange(options?.competencia);
    const inicio = options?.dataDe || range?.inicio;
    const dataAte = options?.dataAte;

    let queryLotes = operationalClient
      .from("diaristas_lotes_fechamento")
      .select("*, empresas:empresa_id(nome)")
      .eq("empresa_id", empresaId);

    const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
    queryLotes = EnvironmentQueryFilter.applyEmpresaScope(queryLotes as any, {
      tenantId,
      column: "empresa_id",
      includeNullInProduction: false,
      testIds,
    });

    if (options?.cicloId && options.cicloId !== "all") {
      queryLotes = queryLotes.eq("id", options.cicloId);
    } else if (options?.competencia) {
      if (range) {
        queryLotes = queryLotes.or(
          `mes_referencia.eq.${options.competencia},and(periodo_inicio.gte.${range.inicio},periodo_inicio.lt.${range.fimExclusivo})`
        );
      } else {
        queryLotes = queryLotes.eq("mes_referencia", options.competencia);
      }
    } else if (inicio || dataAte) {
      if (inicio) queryLotes = queryLotes.gte("periodo_fim", inicio);
      if (dataAte) queryLotes = queryLotes.lte("periodo_inicio", dataAte);
    }

    queryLotes = queryLotes.order("created_at", { ascending: false });

    const { data: lotes, error: lotErr } = await queryLotes;
    if (lotErr) {
      console.error("[relatoriosOficialAdapter] Erro ao buscar lotes em R02:", lotErr);
      throw lotErr;
    }
    if (!lotes || lotes.length === 0) return [];

    const loteIds = lotes.map((l: any) => l.id);
    const lotesMap = new Map<string, any>(lotes.map((l: any) => [l.id, l]));

    const lancamentos = await LoteFechamentoDiaristaService.getLancamentosByLoteIds(loteIds);

    // Filtragem defensiva: garantir que cada lançamento pertença estritamente à competência/período especificado
    const filteredLancamentos = (lancamentos || []).filter((it: any) => {
      const lote = lotesMap.get(it.lote_fechamento_id);
      if (!lote) return false;
      if (options?.competencia) {
        const comp = options.competencia;
        const loteMesRef = lote.mes_referencia || "";
        const dataMes = String(it.data_lancamento || "").slice(0, 7);
        if (loteMesRef !== comp && dataMes !== comp) return false;
      }
      return true;
    });

    return filteredLancamentos.map((it: any): DiaristaFechamentoRow => {
      const lote = lotesMap.get(it.lote_fechamento_id) || {};
      const cicloLabel = `Semana ${lote.periodo_inicio ? String(lote.periodo_inicio).slice(5) : ""} a ${lote.periodo_fim ? String(lote.periodo_fim).slice(5) : ""}`;

      return {
        id: it.id,
        empresaId: it.empresa_id || empresaId,
        cicloId: it.lote_fechamento_id || "ciclo-aberto",
        cicloLabel,
        dataLancamento: String(it.data_lancamento || "").slice(0, 10),
        colaboradorNome: it.nome_colaborador || "Diarista",
        cpfMascarado: maskCpf(it.cpf_colaborador),
        funcao: it.funcao_colaborador || "Ajudante Geral",
        codigoMarcacao: it.codigo_marcacao === "MP" ? "MP" : "P",
        quantidadeDiarias: Number(it.quantidade_diaria || 1),
        valorDiariaBase: Number(it.valor_diaria_base || 0),
        total: Number(it.valor_calculado || 0),
        loteCodigo: `LOTE-${String(it.lote_fechamento_id || "").slice(0, 6).toUpperCase()}`,
        statusLote: lote.status || "fechado_para_pagamento",
      };
    });
  }

  /**
   * Consulta R03 com isolamento total (livro fiscal de receitas faturadas)
   */
  async getR03Data(empresaId: string, options?: { competencia?: string }): Promise<FaturamentoReceitaRow[]> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para consulta R03");
    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    const receitas = await ReceitasOficialService.getReceitasContextuais(tenantId, empresaId, options?.competencia);

    return (receitas || []).map((r: any): FaturamentoReceitaRow => {
      const origem: "Operação por Volume" | "Serviço Extra" = r.origemPrincipal === "Serviço Extra" ? "Serviço Extra" : "Operação por Volume";
      const comp = r.competencia || "";
      const compFormatada = comp.includes("-") ? `${comp.split("-")[1]}/${comp.split("-")[0]}` : comp;

      return {
        id: r.id,
        empresaId: r.clienteId || empresaId,
        competencia: comp,
        competenciaFormatada: compFormatada,
        clienteNome: r.clienteNome || "Cliente",
        modalidade: r.modalidade as any,
        origem,
        valorFaturado: Number(r.valorTotal || 0),
        vencimento: String(r.vencimento || "").slice(0, 10),
        dataRecebimento: r.dataRecebimento ? String(r.dataRecebimento).slice(0, 10) : null,
        status: r.status as any,
      };
    });
  }

  /**
   * Consulta R04 com isolamento total de empresa e ambiente
   */
  async getR04Data(empresaId: string, options?: { competencia?: string; dataDe?: string; dataAte?: string }): Promise<CustoExtraRow[]> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para consulta R04");
    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);

    let query = operationalClient
      .from("custos_extras_operacionais")
      .select("*, empresas:empresa_id(nome), unidades:unidade_id(nome)")
      .eq("empresa_id", empresaId);

    query = EnvironmentQueryFilter.applyEmpresaScope(query as any, {
      tenantId,
      column: "empresa_id",
      includeNullInProduction: false,
      testIds,
    });

    if (options?.dataDe) query = query.gte("data", options.dataDe);
    if (options?.dataAte) query = query.lte("data", options.dataAte);
    if (options?.competencia && !options.dataDe && !options.dataAte) {
      const range = getCompetenciaDateRange(options.competencia);
      if (range) {
        query = query.gte("data", range.inicio).lt("data", range.fimExclusivo);
      }
    }

    query = query.order("data", { ascending: false });

    const { data, error } = await query;
    if (error) {
      console.error("[relatoriosOficialAdapter] Erro em R04:", error);
      throw error;
    }

    return (data || []).map((c: any): CustoExtraRow => {
      const cat = (c.categoria_custo || "OPERACIONAL").toUpperCase();
      const validCat: "MERENDA" | "ADMINISTRATIVO" | "OPERACIONAL" | "FORNECEDOR" =
        cat === "MERENDA" || cat === "ADMINISTRATIVO" || cat === "FORNECEDOR" ? cat : "OPERACIONAL";

      const orig = (c.origem_recurso || "CAIXINHA").toUpperCase();
      const validOrig: "CAIXINHA" | "TRANSFERENCIA" | "BOLETO" | "REEMBOLSO" =
        orig === "BOLETO" || orig === "TRANSFERENCIA" || orig === "REEMBOLSO" ? orig : "CAIXINHA";

      const st = (c.status_pagamento || "PENDENTE").toUpperCase();
      const validSt: "PENDENTE" | "ATRASADO" | "PAGO" = st === "PAGO" || st === "ATRASADO" ? st : "PENDENTE";

      return {
        id: c.id,
        empresaId: c.empresa_id,
        data: String(c.data || "").slice(0, 10),
        unidade: c.unidades?.nome || "Matriz",
        categoriaCusto: validCat,
        descricao: c.descricao || "Custo Extra",
        favorecidoTipo: c.favorecido_colaborador_id ? "Colaborador" : "Fornecedor",
        favorecidoNome: c.favorecido_nome || "Fornecedor / Colaborador",
        quantidade: Number(c.quantidade || 1),
        valorUnitario: Number(c.valor_unitario || 0),
        total: Number(c.total || 0),
        origemRecurso: validOrig,
        lancadorNome: c.lancador_nome || "Encarregado",
        status: validSt,
      };
    });
  }

  /**
   * Consulta R05 com isolamento contextual seguro e ELEGIBILIDADE CLT ESTRITA:
   * Colaboradores que pertencem estritamente ao domínio CLT (regime_trabalho='CLT' ou tipo_colaborador ILIKE 'clt').
   * Diaristas e Intermitentes NÃO pertencem ao domínio CLT e NÃO devem constar no Banco de Horas.
   */
  async getR05Data(empresaId: string, options?: { competencia?: string }): Promise<BancoHorasRow[]> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para consulta R05");
    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    // 1. Buscar colaboradores vinculados estritamente à empresa solicitada, com ELEGIBILIDADE CLT REAL
    const { data: colabs, error: colabErr } = await supabase
      .from("colaboradores")
      .select("id, nome, matricula, empresa_id, tipo_colaborador, regime_trabalho, bh_ativo, status")
      .eq("tenant_id", tenantId)
      .eq("empresa_id", empresaId)
      .eq("bh_ativo", true)
      .is("deleted_at", null);

    if (colabErr) {
      console.error("[relatoriosOficialAdapter] Erro ao buscar colaboradores para R05:", colabErr);
      throw colabErr;
    }
    if (!colabs || colabs.length === 0) return [];

    // Filtrar estritamente regime/vínculo CLT:
    // Deve possuir regime_trabalho='CLT' ou tipo_colaborador ILIKE 'clt',
    // e NÃO ser DIARISTA nem INTERMITENTE.
    const cltColabs = colabs.filter((c: any) => {
      const tipo = String(c.tipo_colaborador || "").toUpperCase();
      const regime = String(c.regime_trabalho || "").toUpperCase();
      const isCLT = tipo === "CLT" || regime === "CLT";
      const isDiaristaOuIntermitente = tipo === "DIARISTA" || tipo === "INTERMITENTE" || regime === "DIARISTA" || regime === "INTERMITENTE";
      return isCLT && !isDiaristaOuIntermitente;
    });

    if (cltColabs.length === 0) return [];

    const colabIds = cltColabs.map((c) => c.id);

    // 2. Buscar saldos reais dos colaboradores CLT encontrados
    const { data: saldosData, error: saldosErr } = await supabase
      .from("banco_horas_saldos")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("colaborador_id", colabIds);

    if (saldosErr) {
      console.error("[relatoriosOficialAdapter] Erro ao buscar saldos para R05:", saldosErr);
      throw saldosErr;
    }

    // 3. Buscar eventos ativos para compor alertas e créditos/débitos
    const { data: eventosData, error: evErr } = await supabase
      .from("banco_horas_eventos")
      .select("colaborador_id, quantidade_minutos, minutos, data_vencimento, status, is_teste")
      .eq("tenant_id", tenantId)
      .in("colaborador_id", colabIds)
      .or("is_teste.is.null,is_teste.eq.false");

    if (evErr) {
      console.error("[relatoriosOficialAdapter] Erro ao buscar eventos para R05:", evErr);
      throw evErr;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    const comp = options?.competencia || new Date().toISOString().slice(0, 7);

    // Mapear saldos por colaborador
    const saldosMap = new Map<string, any>((saldosData || []).map((s: any) => [s.colaborador_id, s]));

    return cltColabs.map((c): BancoHorasRow => {
      const s = saldosMap.get(c.id) || {};
      const saldoMin = Number(s.saldo_atual_minutos || 0);
      const creditosMin = Number(s.horas_positivas_minutos || 0);
      const debitosMin = Number(s.horas_negativas_minutos || 0);

      // Calcular vencimentos a partir dos eventos do colaborador
      const colabEventos = (eventosData || []).filter((e: any) => e.colaborador_id === c.id);
      let aVencer30d = 0;
      let vencidas = 0;

      for (const ev of colabEventos) {
        if (!ev.data_vencimento) continue;
        const vDate = new Date(ev.data_vencimento);
        const mins = Number(ev.quantidade_minutos || ev.minutos || 0);
        if (mins <= 0) continue;

        if (vDate < today) {
          vencidas += mins;
        } else if (vDate <= in30Days) {
          aVencer30d += mins;
        }
      }

      let statusLabel: "OK" | "Débito" | "A Vencer" | "Crítico" = "OK";
      if (vencidas > 0 || saldoMin < -60) {
        statusLabel = "Crítico";
      } else if (aVencer30d > 0) {
        statusLabel = "A Vencer";
      } else if (saldoMin < 0) {
        statusLabel = "Débito";
      }

      return {
        id: c.id,
        empresaId,
        matricula: c.matricula || "—",
        colaboradorNome: c.nome,
        competencia: comp,
        saldoMinutos: saldoMin,
        saldoFormatado: formatMinutosToHourString(saldoMin),
        creditosMinutos: creditosMin,
        creditosFormatado: formatMinutosToHourString(creditosMin),
        debitosMinutos: debitosMin,
        debitosFormatado: formatMinutosToHourString(debitosMin),
        aVencer30dMinutos: aVencer30d,
        aVencer30dFormatado: formatMinutosToHourString(aVencer30d),
        vencidasMinutos: vencidas,
        vencidasFormatado: formatMinutosToHourString(vencidas),
        status: statusLabel,
      };
    });
  }

  /**
   * Consulta R07 com isolamento total (serviços extraordinários)
   */
  async getR07Data(empresaId: string, options?: { competencia?: string; dataDe?: string; dataAte?: string }): Promise<ServicoExtraRow[]> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para consulta R07");
    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    const raw = await ServicosExtrasOperacionaisService.getWithEmpresas(empresaId, options?.competencia);
    const dataDe = options?.dataDe;
    const dataAte = options?.dataAte;

    const range = getCompetenciaDateRange(options?.competencia);

    const filtered = (raw || []).filter((r: any) => {
      if (dataDe && r.data < dataDe) return false;
      if (dataAte && r.data > dataAte) return false;
      if (range && !dataDe && !dataAte) {
        if (r.data < range.inicio || r.data >= range.fimExclusivo) return false;
      }
      return true;
    });

    return filtered.map((r: any): ServicoExtraRow => ({
      id: r.id,
      empresaId: r.empresa_id || empresaId,
      data: String(r.data || "").slice(0, 10),
      tipoServico: r.tipos_servico_operacional?.nome || r.tipo_servico || "Serviço Extra",
      descricao: r.descricao_servico || "Serviço extraordinário",
      tomadorNome: r.empresas?.nome || r.empresa_nome || "Tomador",
      quantidade: Number(r.quantidade || 1),
      valorUnitario: Number(r.valor_unitario || 0),
      total: Number(r.total || 0),
      modalidadeFinanceira: r.modalidade_financeira || "CAIXA_IMEDIATO",
      nfNumero: r.nf_numero || null,
      pipelineStatus: r.pipeline_status || "PENDENTE",
    }));
  }

  /**
   * Consolida os dados dos 6 cadernos para alimentar a Central de Relatórios (KPIs, Mapa, Infográficos)
   */
  async getCentralHubConsolidado(empresaId: string, competencia: string) {
    if (!empresaId) throw new Error("Empresa é obrigatória para o Hub de Relatórios");

    const [r01Rows, r02Rows, r03Rows, r04Rows, r05Rows, r07Rows] = await Promise.all([
      this.getR01Data(empresaId, { competencia }),
      this.getR02Data(empresaId, { competencia }),
      this.getR03Data(empresaId, { competencia }),
      this.getR04Data(empresaId, { competencia }),
      this.getR05Data(empresaId, { competencia }),
      this.getR07Data(empresaId, { competencia }),
    ]);

    // 01 — Total de Registros Consolidados
    const totalRegistros = r01Rows.length + r02Rows.length + r03Rows.length + r04Rows.length + r05Rows.length + r07Rows.length;
    const relatoriosAtivos = [r01Rows, r02Rows, r03Rows, r04Rows, r05Rows, r07Rows].filter((arr) => arr.length > 0).length;

    // 02 — Volume Operacional (Exclusivamente R01)
    const volumeOperacional = r01Rows.reduce((acc, r) => acc + r.quantidade, 0);

    // 03 — Receitas Reportadas (Exclusivamente R03)
    const receitasReportadas = r03Rows.reduce((acc, r) => acc + r.valorFaturado, 0);

    // 04 — Despesas Apuradas (Diaristas R02 + Custos Extras R04)
    const diaristasTotal = r02Rows.reduce((acc, r) => acc + r.total, 0);
    const custosExtrasTotal = r04Rows.reduce((acc, r) => acc + r.total, 0);
    const despesasApuradas = diaristasTotal + custosExtrasTotal;

    // Banco de Horas (Horas / Minutos, sem valor monetário)
    const bancoHorasSaldoMinutos = r05Rows.reduce((acc, r) => acc + r.saldoMinutos, 0);
    const bancoHorasAVencerMinutos = r05Rows.reduce((acc, r) => acc + r.aVencer30dMinutos, 0);

    // Infográfico 01 — Distribuição por Domínio
    const registrosOperacional = r01Rows.length + r04Rows.length + r07Rows.length;
    const registrosRH = r02Rows.length + r05Rows.length;
    const registrosFinanceiro = r03Rows.length;

    const pctOperacional = totalRegistros > 0 ? Math.round((registrosOperacional / totalRegistros) * 100) : 0;
    const pctRH = totalRegistros > 0 ? Math.round((registrosRH / totalRegistros) * 100) : 0;
    const pctFinanceiro = totalRegistros > 0 ? Math.max(0, 100 - pctOperacional - pctRH) : 0;

    const counts: Record<string, number> = {
      "r01-operacoes-volume": r01Rows.length,
      "r02-fechamento-diaristas": r02Rows.length,
      "r03-faturamento-receitas": r03Rows.length,
      "r04-custos-extras": r04Rows.length,
      "r05-banco-horas": r05Rows.length,
      "r07-servicos-extras": r07Rows.length,
    };

    return {
      kpis: {
        totalRegistros,
        relatoriosAtivos,
        volumeOperacional,
        receitasReportadas,
        despesasApuradas,
        diaristasTotal,
        custosExtrasTotal,
        bancoHorasSaldoMinutos,
        bancoHorasAVencerMinutos,
      },
      infograficos: {
        registrosOperacional,
        registrosRH,
        registrosFinanceiro,
        pctOperacional,
        pctRH,
        pctFinanceiro,
      },
      counts,
      datasets: {
        r01Rows,
        r02Rows,
        r03Rows,
        r04Rows,
        r05Rows,
        r07Rows,
      },
    };
  }

  /**
   * Exporta dados em CSV limpo com UTF-8 BOM e sanitização contra injection
   */
  exportReportToCSV(reportId: string, rows: any[], empresaNome: string, competencia: string): void {
    if (!rows || rows.length === 0) {
      throw new Error("Não há registros no período filtrado para exportação.");
    }

    const sanitize = (val: unknown): string => {
      const s = String(val ?? "").replace(/"/g, '""');
      if (s.startsWith("=") || s.startsWith("+") || s.startsWith("-") || s.startsWith("@")) {
        return `"'${s}"`;
      }
      return `"${s}"`;
    };

    let headers: string[] = [];
    let formattedRows: (string | number)[][] = [];

    if (reportId === "r01-operacoes-volume") {
      headers = ["Data", "Código", "Unidade", "Transportadora", "Serviço", "Carga", "Quantidade", "Valor Unitário (R$)", "Total Bruto (R$)", "Materiais (R$)", "ISS (R$)", "Placa", "NF", "Status"];
      formattedRows = rows.map((r: OperacaoVolumeRow) => [
        r.dataOperacao, r.codigoOperacional, r.unidade, r.transportadora, r.tipoServico, r.produtoCarga,
        r.quantidade, r.valorUnitario.toFixed(2), r.totalBruto.toFixed(2), r.materiais.toFixed(2), r.iss.toFixed(2),
        r.placa, r.nfNumero || "—", r.status
      ]);
    } else if (reportId === "r02-fechamento-diaristas") {
      headers = ["Data", "Colaborador", "CPF", "Função", "Código", "Quantidade de Diárias", "Valor da Diária (R$)", "Total (R$)", "Lote", "Status do Lote"];
      formattedRows = rows.map((r: DiaristaFechamentoRow) => [
        r.dataLancamento, r.colaboradorNome, r.cpfMascarado, r.funcao, r.codigoMarcacao,
        r.quantidadeDiarias, r.valorDiariaBase.toFixed(2), r.total.toFixed(2), r.loteCodigo, getStatusLoteDiaristaLabel(r.statusLote).label
      ]);
    } else if (reportId === "r03-faturamento-receitas") {
      headers = ["Competência", "Cliente", "Modalidade", "Origem", "Valor Faturado (R$)", "Vencimento", "Data Recebimento", "Status", "Situação"];
      formattedRows = rows.map((r: FaturamentoReceitaRow) => [
        r.competenciaFormatada, r.clienteNome, getModalidadeLabel(r.modalidade), r.origem,
        r.valorFaturado.toFixed(2), r.vencimento, r.dataRecebimento || "—", getStatusReceitaLabel(r.status), getSituacaoDerivadaReceita(r).descricao
      ]);
    } else if (reportId === "r04-custos-extras") {
      headers = ["Data", "Unidade", "Categoria", "Descrição", "Favorecido", "Tipo Favorecido", "Quantidade", "Valor Unitário (R$)", "Total (R$)", "Origem do Recurso", "Lançador", "Status"];
      formattedRows = rows.map((r: CustoExtraRow) => [
        r.data, r.unidade, getCategoriaCustoLabel(r.categoriaCusto), r.descricao, r.favorecidoNome,
        r.favorecidoTipo, r.quantidade, r.valorUnitario.toFixed(2), r.total.toFixed(2), r.origemRecurso, r.lancadorNome, getStatusCustoExtraLabel(r.status).label
      ]);
    } else if (reportId === "r05-banco-horas") {
      headers = ["Matrícula", "Colaborador", "Competência", "Saldo Atual", "Créditos", "Débitos", "A Vencer (30d)", "Vencidas", "Status"];
      formattedRows = rows.map((r: BancoHorasRow) => [
        r.matricula, r.colaboradorNome, r.competencia, r.saldoFormatado, r.creditosFormatado, r.debitosFormatado,
        r.aVencer30dFormatado, r.vencidasFormatado, r.status
      ]);
    } else if (reportId === "r07-servicos-extras") {
      headers = ["Data", "Tipo de Serviço", "Descrição", "Cliente / Tomador", "Quantidade", "Valor Unitário (R$)", "Total (R$)", "Modalidade Financeira", "NF", "Status Pipeline"];
      formattedRows = rows.map((r: ServicoExtraRow) => [
        r.data, r.tipoServico, r.descricao, r.tomadorNome, r.quantidade, r.valorUnitario.toFixed(2),
        r.total.toFixed(2), r.modalidadeFinanceira, r.nfNumero || "—", getPipelineStatusServicoExtraLabel(r.pipelineStatus).label
      ]);
    }

    const sanitizeNoQuote = (val: unknown): string => String(val ?? "").replace(/[;\n\r]/g, " ");

    const csvLines = [
      `# CADERNO DOCUMENTAL;${sanitizeNoQuote(reportId.toUpperCase())}`,
      `# EMPRESA;${sanitizeNoQuote(empresaNome)}`,
      `# COMPETENCIA_PERIODO;${sanitizeNoQuote(competencia || "Geral")}`,
      `# EMISSAO;${sanitizeNoQuote(new Date().toLocaleString("pt-BR"))}`,
      headers.map(sanitize).join(";"),
      ...formattedRows.map((line) => line.map(sanitize).join(";")),
    ];

    const csvContent = "\uFEFF" + csvLines.join("\n");

    const safeEmpresa = (empresaNome || "EMPRESA").replace(/[^a-zA-Z0-9]/g, "_");
    const safeComp = (competencia || "PERIODO").replace(/[^a-zA-Z0-9_-]/g, "_");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ORBE_${reportId.toUpperCase()}_${safeEmpresa}_${safeComp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Exporta Dossiê Consolidado de Resumo da Competência em CSV
   */
  exportDossierToCSV(data: { empresaNome: string; competencia: string; kpis: any; selectedReports: string[] }): void {
    const sanitize = (val: unknown) => `"${String(val ?? "").replace(/"/g, '""')}"`;
    const summary = [
      ["CADERNO DOCUMENTAL", "ORBE ERP — ESC LOGÍSTICA"],
      ["EMPRESA", data.empresaNome],
      ["COMPETÊNCIA", data.competencia],
      ["DATA DE EMISSÃO", new Date().toLocaleString("pt-BR")],
      [],
      ["INDICADOR", "VALOR APURADO"],
      ["Total de Registros Consolidados", data.kpis.totalRegistros],
      ["Volume Operacional (R01)", data.kpis.volumeOperacional],
      ["Receitas Reportadas (R03)", data.kpis.receitasReportadas.toFixed(2)],
      ["Despesas Apuradas (R02+R04)", data.kpis.despesasApuradas.toFixed(2)],
      ["Banco de Horas - Saldo Líquido", formatMinutosToHourString(data.kpis.bancoHorasSaldoMinutos)],
      [],
      ["CADERNOS INCLUÍDOS", data.selectedReports.join(", ")],
    ];

    const csvContent = "\uFEFF" + summary.map((line) => line.map(sanitize).join(";")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `ORBE_DOSSIE_COMPETENCIA_${data.competencia}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

export const RelatoriosOficialAdapter = new RelatoriosOficialAdapterClass();
