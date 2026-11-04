import { supabase } from "@/lib/supabase";

export interface PortalOperacaoItem {
  id: string;
  data_operacao: string;
  empresa_nome: string;
  transportadora_nome: string;
  fornecedor_nome: string;
  tipo_servico_nome: string;
  produto_nome: string;
  quantidade: number;
  placa: string;
  nf_numero: string;
  ctrc: string;
  horario_inicio: string | null;
  horario_fim: string | null;
  status_operacional: string;
  observacao: string;
  total_count: number;
}

export interface PortalStats {
  total_operacoes: number;
  volume_total: number;
  operacoes_hoje: number;
  empresa_nome: string;
}

export interface GetPortalOperacoesParams {
  dataInicio?: string | null;
  dataFim?: string | null;
  status?: string | null;
  tipoServicoId?: string | null;
  limit?: number;
  offset?: number;
}

export const OPERATIONAL_ELIGIBLE_STATUSES = [
  "RECEBIDO",
  "AGUARDANDO_FATURAMENTO",
  "FATURADO",
  "CONCLUIDO",
  "FECHADO",
  "RECEBIDO_FINANCEIRO",
];

export const PortalOperacionalService = {
  /**
   * Consulta segura de operações validadas da empresa contratante conectada.
   * Utiliza a RPC get_portal_cliente_operacoes com SECURITY DEFINER
   * e filtragem hermética por auth.uid() e empresa_id.
   */
  async getOperacoes(params: GetPortalOperacoesParams = {}): Promise<{
    itens: PortalOperacaoItem[];
    total: number;
  }> {
    const { data, error } = await supabase.rpc("get_portal_cliente_operacoes", {
      p_data_inicio: params.dataInicio || null,
      p_data_fim: params.dataFim || null,
      p_status: params.status || null,
      p_tipo_servico_id: params.tipoServicoId || null,
      p_limit: params.limit ?? 50,
      p_offset: params.offset ?? 0,
    });

    if (error) {
      console.error("[PortalOperacionalService.getOperacoes] Erro na consulta:", error);
      throw error;
    }

    const rows = (data || []) as PortalOperacaoItem[];
    const total = rows.length > 0 ? Number(rows[0].total_count || 0) : 0;

    return {
      itens: rows,
      total,
    };
  },

  /**
   * Consulta agregada de KPIs operacionais da empresa contratante conectada para o mês.
   */
  async getStats(competencia?: string): Promise<PortalStats | null> {
    const { data, error } = await supabase.rpc("get_portal_cliente_stats", {
      p_competencia: competencia || null,
    });

    if (error) {
      console.error("[PortalOperacionalService.getStats] Erro ao carregar estatísticas:", error);
      throw error;
    }

    const rows = (data || []) as PortalStats[];
    if (rows.length === 0) return null;

    return {
      total_operacoes: Number(rows[0].total_operacoes || 0),
      volume_total: Number(rows[0].volume_total || 0),
      operacoes_hoje: Number(rows[0].operacoes_hoje || 0),
      empresa_nome: rows[0].empresa_nome || "Empresa Contratante",
    };
  },

  /**
   * Modo Prévia Administrativa:
   * Executado quando um usuário Admin/Gestor navega no portal para visualizar
   * os dados de uma empresa contratante específica dentro do seu tenant.
   * Não altera a RPC do cliente, mantendo o isolamento por auth.uid() intocado.
   */
  async getAdminPreviewOperacoes(
    empresaId: string,
    params: GetPortalOperacoesParams = {},
  ): Promise<{
    itens: PortalOperacaoItem[];
    total: number;
  }> {
    let query = supabase
      .from("operacoes_producao")
      .select(
        `
        id,
        data_operacao,
        quantidade,
        placa,
        nf_numero,
        ctrc,
        entrada_ponto,
        saida_ponto,
        status,
        observacao,
        empresas:empresa_id(nome),
        transportadoras:transportadora_id(nome),
        fornecedores:fornecedor_id(nome),
        tipos_servico:tipo_servico_id(nome),
        produtos:produto_carga_id(nome)
      `,
        { count: "exact" },
      )
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .in("status", [
        ...OPERATIONAL_ELIGIBLE_STATUSES,
        ...OPERATIONAL_ELIGIBLE_STATUSES.map((s) => s.toLowerCase()),
      ]);

    if (params.dataInicio) {
      query = query.gte("data_operacao", params.dataInicio);
    }
    if (params.dataFim) {
      query = query.lte("data_operacao", params.dataFim);
    }
    if (params.status) {
      query = query.ilike("status", params.status);
    }
    if (params.tipoServicoId) {
      query = query.eq("tipo_servico_id", params.tipoServicoId);
    }

    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    query = query
      .order("data_operacao", { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error("[PortalOperacionalService.getAdminPreviewOperacoes] Erro:", error);
      throw error;
    }

    const rows: PortalOperacaoItem[] = (data || []).map((row: any) => {
      const stUpper = String(row.status || "").toUpperCase();
      let status_operacional = "Em conferência";
      if (["CONCLUIDO", "FECHADO", "RECEBIDO_FINANCEIRO"].includes(stUpper)) {
        status_operacional = "Concluído";
      } else if (stUpper === "FATURADO") {
        status_operacional = "Faturado";
      } else if (stUpper === "AGUARDANDO_FATURAMENTO") {
        status_operacional = "Concluído";
      } else if (stUpper === "RECEBIDO") {
        status_operacional = "Recebido";
      }

      return {
        id: row.id,
        data_operacao: row.data_operacao,
        empresa_nome: row.empresas?.nome || "-",
        transportadora_nome: row.transportadoras?.nome || "-",
        fornecedor_nome: row.fornecedores?.nome || "-",
        tipo_servico_nome: row.tipos_servico?.nome || "Não classificado",
        produto_nome: row.produtos?.nome || "Geral",
        quantidade: Number(row.quantidade || 0),
        placa: row.placa || "-",
        nf_numero: row.nf_numero || "-",
        ctrc: row.ctrc || "-",
        horario_inicio: row.entrada_ponto || null,
        horario_fim: row.saida_ponto || null,
        status_operacional,
        observacao: row.observacao || "",
        total_count: count || 0,
      };
    });

    return {
      itens: rows,
      total: count || 0,
    };
  },

  /**
   * KPIs agregados para o Modo Prévia Administrativa.
   */
  async getAdminPreviewStats(
    empresaId: string,
    competencia?: string,
  ): Promise<PortalStats | null> {
    const comp = competencia || new Date().toISOString().slice(0, 7);
    const inicioMes = `${comp}-01`;
    const ano = parseInt(comp.split("-")[0], 10);
    const mes = parseInt(comp.split("-")[1], 10);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const fimMes = `${comp}-${String(ultimoDia).padStart(2, "0")}`;
    const hoje = new Date().toISOString().slice(0, 10);

    const { data: emp } = await supabase
      .from("empresas")
      .select("nome")
      .eq("id", empresaId)
      .maybeSingle();

    const { data, error } = await supabase
      .from("operacoes_producao")
      .select("quantidade, data_operacao")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null)
      .in("status", [
        ...OPERATIONAL_ELIGIBLE_STATUSES,
        ...OPERATIONAL_ELIGIBLE_STATUSES.map((s) => s.toLowerCase()),
      ])
      .gte("data_operacao", inicioMes)
      .lte("data_operacao", fimMes);

    if (error) {
      console.error("[PortalOperacionalService.getAdminPreviewStats] Erro:", error);
      throw error;
    }

    const rows = data || [];
    const total_operacoes = rows.length;
    const volume_total = rows.reduce((acc, r) => acc + Number(r.quantidade || 0), 0);
    const operacoes_hoje = rows.filter((r) => r.data_operacao === hoje).length;

    return {
      total_operacoes,
      volume_total,
      operacoes_hoje,
      empresa_nome: emp?.nome || "Empresa Contratante",
    };
  },

  /**
   * Ponto único de entrada: despacha para RPC ou Prévia Admin conforme o contexto ativo.
   */
  async fetchOperacoes(
    params: GetPortalOperacoesParams = {},
    adminEmpresaId?: string | null,
  ): Promise<{ itens: PortalOperacaoItem[]; total: number }> {
    if (adminEmpresaId) {
      return this.getAdminPreviewOperacoes(adminEmpresaId, params);
    }
    return this.getOperacoes(params);
  },

  /**
   * Consulta a totalidade de operações do período de forma exaustiva e paginada,
   * garantindo que agregações (como distribuição por serviço) não sofram truncamento
   * qualquer que seja o volume total de operações registradas.
   */
  async fetchAllPeriodOperacoes(
    params: Omit<GetPortalOperacoesParams, "limit" | "offset"> = {},
    adminEmpresaId?: string | null,
  ): Promise<{ itens: PortalOperacaoItem[]; total: number }> {
    const pageSize = 200;
    let offset = 0;
    let allItens: PortalOperacaoItem[] = [];
    let total = 0;
    const maxIterations = 50; // Proteção contra loops infinitos (até 10.000 operações)
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      const page = await this.fetchOperacoes(
        { ...params, limit: pageSize, offset },
        adminEmpresaId,
      );

      total = page.total;
      if (!page.itens || page.itens.length === 0) break;

      allItens.push(...page.itens);
      offset += page.itens.length;

      if (allItens.length >= total) break;
    }

    return {
      itens: allItens,
      total: total || allItens.length,
    };
  },

  async fetchStats(
    competencia?: string,
    adminEmpresaId?: string | null,
  ): Promise<PortalStats | null> {
    if (adminEmpresaId) {
      return this.getAdminPreviewStats(adminEmpresaId, competencia);
    }
    return this.getStats(competencia);
  },

  /**
   * Obtém o vínculo ativo da empresa contratante para o usuário autenticado.
   */
  async getMyVinculo() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return null;

    const { data, error } = await supabase
      .from("portal_cliente_usuarios")
      .select("id, tenant_id, empresa_id, ativo, created_at")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .maybeSingle();

    if (error) {
      console.error("[PortalOperacionalService.getMyVinculo] Erro ao buscar vínculo:", error);
      return null;
    }

    return data;
  },
};
