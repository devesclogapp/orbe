import { supabase } from "@/lib/supabase";
import { ReceitasService } from "@/services/receitas/receitas.service";

// ==============================================================================
// ORBE ERP — CONV-09: RECEITAS OPERACIONAIS OFICIAL (UX11 + DOMÍNIO REAL)
// Camada de Apresentação e Adapter Desacoplado (ReceitasOficialService)
// ZERO MOCK — Consome 100% de estruturas e RPCs reais homologadas.
// ==============================================================================

export type ModalidadeReceitaReal = "CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL";

export type StatusReceitaReal =
  | "aguardando_fechamento"
  | "pendente_cobranca"
  | "cobranca_gerada"
  | "cobranca_enviada"
  | "pendente_recebimento"
  | "recebido"
  | "pago"
  | "conciliado"
  | "cancelado";

export type EstagioFinanceiroUX =
  | "TODOS"
  | "A_FATURAR_FECHAR"
  | "COBRANCA_PENDENTE"
  | "A_RECEBER"
  | "RECEBIDAS";

export type OrigemReceitaReal = "Operação por Volume" | "Serviço Extra" | "Origem Mista";

export interface ReceitaItemComposicaoUI {
  id: string;
  refOrigem: string;
  tipoOrigem: "Operação por Volume" | "Serviço Extra";
  descricao: string;
  valor: number;
  data: string;
  operacao_id?: string | null;
  servico_extra_id?: string | null;
}

export interface ReceitaEventoHistoricoUI {
  id?: string;
  dataHora: string;
  acao: string;
  usuario: string;
  detalhes?: string;
  status_anterior?: string | null;
  status_novo?: string | null;
}

export interface ReceitaItemUI {
  id: string;
  clienteNome: string;
  clienteId: string;
  modalidade: ModalidadeReceitaReal;
  origemPrincipal: OrigemReceitaReal;
  competencia: string; // YYYY-MM
  competenciaFormatada: string;
  vencimento: string; // YYYY-MM-DD
  dataRecebimento?: string | null; // YYYY-MM-DD
  valorTotal: number;
  status: StatusReceitaReal;
  observacao?: string | null; // Ex: "FATURA_COMPLEMENTAR"
  itens: ReceitaItemComposicaoUI[];
  historico?: ReceitaEventoHistoricoUI[];
  raw?: any;
}

export interface KpisReceitasStats {
  totalReconhecido: number;
  valorAFaturarFechar: number;
  valorCobrancaPendente: number;
  aFaturarCobrar: number;
  aReceber: number;
  recebido: number;
  conciliado: number;
}

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

/**
 * Formata competência YYYY-MM para string amigável (Ex: "Outubro / 2026")
 */
export function formatCompetencia(comp?: string | null): string {
  if (!comp || !/^\d{4}-\d{2}$/.test(comp)) return comp || "—";
  const [ano, mes] = comp.split("-");
  const mesIndex = parseInt(mes, 10) - 1;
  return `${MESES[mesIndex] || mes} / ${ano}`;
}

/**
 * Formata valores monetários em Real brasileiro
 */
export function formatCurrency(val?: number | null): string {
  return Number(val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Formata datas ISO YYYY-MM-DD para DD/MM/AAAA
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(dateStr);
}

/**
 * Mapeamento Canônico: Status Persistido -> Agrupamento UX de Apresentação
 */
export function getEstagioUX(status: string): EstagioFinanceiroUX {
  switch (status) {
    case "aguardando_fechamento":
      return "A_FATURAR_FECHAR";
    case "pendente_cobranca":
    case "cobranca_gerada":
      return "COBRANCA_PENDENTE";
    case "cobranca_enviada":
    case "pendente_recebimento":
      return "A_RECEBER";
    case "recebido":
    case "pago":
    case "conciliado":
    case "fechado":
      return "RECEBIDAS";
    default:
      return "A_RECEBER";
  }
}

export function getEstagioUXLabel(estagio: EstagioFinanceiroUX): string {
  switch (estagio) {
    case "A_FATURAR_FECHAR":
      return "A Faturar / Fechar";
    case "COBRANCA_PENDENTE":
      return "Cobrança Pendente";
    case "A_RECEBER":
      return "A Receber";
    case "RECEBIDAS":
      return "Recebidas";
    case "TODOS":
    default:
      return "Todos";
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

export function getStatusLabel(status: string): string {
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
      return "Pendente Recebimento";
    case "recebido":
      return "Recebido";
    case "pago":
      return "Pago";
    case "conciliado":
      return "Conciliado";
    case "cancelado":
      return "Cancelado";
    default:
      return status;
  }
}

/**
 * ESTADO DERIVADO: Situação de Vencimento
 * VENCIDO é calculado em memória: (vencimento < hoje) AND status NOT IN ('recebido', 'pago', 'conciliado', 'cancelado')
 */
export function getSituacaoVencimento(
  row: { vencimento?: string | null; status: string; dataRecebimento?: string | null },
  dataCorte?: string
): { isVencido: boolean; diasAtraso: number; label: string } {
  const isLiquidadoOuCancelado =
    row.status === "recebido" ||
    row.status === "pago" ||
    row.status === "conciliado" ||
    row.status === "cancelado" ||
    Boolean(row.dataRecebimento);

  if (isLiquidadoOuCancelado || !row.vencimento) {
    return { isVencido: false, diasAtraso: 0, label: "Liquidado" };
  }

  const todayStr = dataCorte || new Date().toISOString().split("T")[0];
  if (row.vencimento < todayStr) {
    const dVenc = new Date(row.vencimento + "T12:00:00Z").getTime();
    const dCorte = new Date(todayStr + "T12:00:00Z").getTime();
    const diffDays = Math.max(1, Math.round((dCorte - dVenc) / (1000 * 60 * 60 * 24)));
    return {
      isVencido: true,
      diasAtraso: diffDays,
      label: `VENCIDO • ${diffDays} dias`,
    };
  }

  return { isVencido: false, diasAtraso: 0, label: "No Prazo" };
}

/**
 * CÁLCULO DOS 4 KPIS CANÔNICOS DA UX11 SOBRE O UNIVERSO CONTEXTUAL (INVARIANTE A FILTROS EXPLORATÓRIOS)
 * REGRA MATEMÁTICA: Receita Reconhecida = A Faturar/Cobrar + A Receber + Recebido
 */
export function calcularKpisReceitas(receitasContextuais: ReceitaItemUI[]): KpisReceitasStats {
  const ativas = receitasContextuais.filter((r) => r.status !== "cancelado");

  let totalReconhecido = 0;
  let valorAFaturarFechar = 0;
  let valorCobrancaPendente = 0;
  let aReceber = 0;
  let recebido = 0;
  let conciliado = 0;

  ativas.forEach((r) => {
    const valor = Number(r.valorTotal || 0);
    totalReconhecido += valor;

    const est = getEstagioUX(r.status);
    if (est === "A_FATURAR_FECHAR") {
      valorAFaturarFechar += valor;
    } else if (est === "COBRANCA_PENDENTE") {
      valorCobrancaPendente += valor;
    } else if (est === "A_RECEBER") {
      aReceber += valor;
    } else if (est === "RECEBIDAS") {
      recebido += valor;
      if (r.status === "conciliado") {
        conciliado += valor;
      }
    }
  });

  const aFaturarCobrar = valorAFaturarFechar + valorCobrancaPendente;

  return {
    totalReconhecido,
    valorAFaturarFechar,
    valorCobrancaPendente,
    aFaturarCobrar,
    aReceber,
    recebido,
    conciliado,
  };
}

class ReceitasOficialServiceClass {
  /**
   * Consulta receitas reais do banco respeitando estritamente o contexto principal:
   * tenant_id + empresa_id + competencia (YYYY-MM)
   */
  async getReceitasContextuais(
    tenantId: string,
    empresaId?: string,
    competencia?: string
  ): Promise<ReceitaItemUI[]> {
    const env = typeof window !== "undefined" ? localStorage.getItem("esc-log-environment") : null;
    const isHomologacao = env === "HOMOLOGACAO" || env === "homologacao";
    const { data: testEmpresas } = await supabase.from("empresas").select("id").eq("is_teste", true);
    const testIds = testEmpresas?.map((e) => e.id) || [];
    const safeTestIds = testIds.length > 0 ? testIds : ["00000000-0000-0000-0000-000000000000"];

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
      .eq("tenant_id", tenantId);

    if (empresaId && empresaId !== "all") {
      query = query.eq("empresa_id", empresaId);
    } else {
      if (isHomologacao) {
        query = query.in("empresa_id", safeTestIds);
      } else {
        query = query.or(`empresa_id.not.in.(${safeTestIds.join(",")}),empresa_id.is.null`);
      }
    }

    query = query.order("created_at", { ascending: false }).limit(1000);

    const { data, error } = await query;
    if (error) {
      console.error("[ReceitasOficialService] Erro ao buscar receitas:", error);
      throw error;
    }

    const rawList = data || [];

    // Filtro canônico por competência:
    // Utiliza receitas_operacionais.competencia (YYYY-MM) como fonte primária do período econômico.
    // Fallback para created_at SOMENTE se competencia for NULL em registros legados.
    const filteredByComp = competencia && competencia !== "all"
      ? rawList.filter((r: any) => {
          if (r.competencia) {
            return r.competencia === competencia;
          }
          if (r.created_at) {
            return String(r.created_at).slice(0, 7) === competencia;
          }
          return false;
        })
      : rawList;

    // Normalização para o modelo UI da UX11
    return filteredByComp.map((r: any): ReceitaItemUI => {
      const itensRaw = r.receitas_operacionais_itens || [];
      const temOp = itensRaw.some((it: any) => it.operacao_id != null || it.operacoes_producao != null);
      const temSe = itensRaw.some((it: any) => it.servico_extra_id != null || it.servicos_extras_operacionais != null);

      let origemPrincipal: OrigemReceitaReal = "Operação por Volume";
      if (temSe && !temOp) {
        origemPrincipal = "Serviço Extra";
      } else if (temSe && temOp) {
        origemPrincipal = "Origem Mista";
      }

      const compCanonica = r.competencia || (r.created_at ? String(r.created_at).slice(0, 7) : "");

      const itensUI: ReceitaItemComposicaoUI[] = itensRaw.map((it: any) => {
        const isSe = Boolean(it.servico_extra_id != null || it.servicos_extras_operacionais != null);
        const refOrigem = isSe
          ? `SEX-${String(it.servico_extra_id || it.id).slice(0, 4).toUpperCase()}`
          : `OPV-${String(it.operacao_id || it.id).slice(0, 4).toUpperCase()}`;

        let descricao = "Item Operacional";
        if (isSe) {
          descricao = it.servicos_extras_operacionais?.descricao_servico || it.servicos_extras_operacionais?.tipo_servico || "Serviço Extra";
        } else {
          descricao = it.operacoes_producao?.servicos?.nome || it.operacoes_producao?.produtos?.nome || "Operação por Volume";
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

      return {
        id: r.id,
        clienteNome: r.empresas?.nome || "Cliente não informado",
        clienteId: r.empresa_id,
        modalidade: r.modalidade as ModalidadeReceitaReal,
        origemPrincipal,
        competencia: compCanonica,
        competenciaFormatada: formatCompetencia(compCanonica),
        vencimento: r.vencimento ? String(r.vencimento).slice(0, 10) : "",
        dataRecebimento: r.data_recebimento ? String(r.data_recebimento).slice(0, 10) : null,
        valorTotal: Number(r.valor_total || 0),
        status: r.status as StatusReceitaReal,
        observacao: r.observacao || null,
        itens: itensUI,
        raw: r,
      };
    });
  }

  /**
   * Busca detalhes e histórico real da receita sob demanda para o Drawer
   */
  async getReceitaDetalhesEHistorico(receitaId: string) {
    const [detalhes, historico] = await Promise.all([
      ReceitasService.getReceitaDetalhes(receitaId),
      ReceitasService.getHistorico(receitaId),
    ]);

    const historicoUI: ReceitaEventoHistoricoUI[] = (historico || []).map((h: any) => {
      let dataHora = "—";
      if (h.created_at) {
        const d = new Date(h.created_at);
        const dia = String(d.getDate()).padStart(2, "0");
        const mes = String(d.getMonth() + 1).padStart(2, "0");
        const hora = String(d.getHours()).padStart(2, "0");
        const min = String(d.getMinutes()).padStart(2, "0");
        dataHora = `${dia}/${mes} ${hora}:${min}`;
      }

      return {
        id: h.id,
        dataHora,
        acao: h.acao,
        usuario: h.detalhes?.usuario_email || (h.usuario_id ? "Operador" : "Sistema"),
        detalhes: h.detalhes?.texto || (typeof h.detalhes === "string" ? h.detalhes : undefined),
        status_anterior: h.status_anterior,
        status_novo: h.status_novo,
      };
    });

    return { detalhes, historico: historicoUI };
  }

  /**
   * Fechamento e consolidação de Faturamento Mensal (chama RPC oficial)
   */
  async fecharCompetenciaMensal(tenantId: string, receitaId: string, vencimento?: string) {
    return ReceitasService.fecharCompetenciaMensal(tenantId, receitaId, vencimento);
  }

  /**
   * Registro de envio de cobrança ao cliente (chama RPC oficial)
   */
  async registrarEnvioCobranca(tenantId: string, receitaId: string) {
    return ReceitasService.updateStatus(tenantId, receitaId, "cobranca_enviada");
  }

  /**
   * Confirmação de recebimento (chama RPC oficial com sincronização de operações e serviços extras)
   */
  async confirmarRecebimento(tenantId: string, receitaId: string, dataRecebimento?: string) {
    return ReceitasService.updateStatus(tenantId, receitaId, "recebido");
  }

  /**
   * Registra log de evento na trilha de auditoria
   */
  async logEvent(tenantId: string, receitaId: string, acao: string, detalhesText: string, detalhesJson?: any) {
    return ReceitasService.logEvent(tenantId, receitaId, acao, detalhesText, detalhesJson);
  }
}

export const ReceitasOficialService = new ReceitasOficialServiceClass();
