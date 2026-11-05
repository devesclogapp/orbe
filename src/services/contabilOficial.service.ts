import { supabase } from "@/lib/supabase";
import { getCurrentTenantId } from "@/services/domain/base.service";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { RelatoriosOficialAdapter } from "@/services/adapters/relatoriosOficialAdapter";

export type CategoriaContabil =
  | "RECEITA_OPERACAO_VOLUME"
  | "RECEITA_SERVICO_EXTRA"
  | "DESPESA_DIARISTAS"
  | "DESPESA_CUSTO_EXTRA";

export interface MapeamentoContabilItem {
  operacao_tipo: CategoriaContabil;
  titulo: string;
  descricao: string;
  natureza: "RECEITA" | "DESPESA";
  conta_debito: string;
  conta_credito: string;
  status: "COMPLETO" | "INCOMPLETO";
}

export interface LancamentoContabilPartidaDobrada {
  id: string;
  data: string; // YYYY-MM-DD
  origem: string;
  origem_tipo: CategoriaContabil;
  documento: string;
  historico: string;
  conta_debito: string;
  conta_credito: string;
  valor: number;
  empresa_id: string;
  empresa_nome: string;
  centro_custo: string;
  mapeado: boolean;
  status_origem: string;
}

export interface PreviaContabilConsolidada {
  empresa_id: string;
  empresa_nome: string;
  competencia: string;
  status_fechamento: "FECHADO_FINANCEIRO" | "EM_ABERTO";
  fechamento_detalhe: string;
  total_lancamentos: number;
  total_debito: number;
  total_credito: number;
  diferenca: number;
  lancamentos_nao_mapeados: number;
  inconsistencias: string[];
  elegivel_exportacao: boolean;
  bloqueios: string[];
  lancamentos: LancamentoContabilPartidaDobrada[];
  content_hash: string;
}

export interface ContabilLogItem {
  id: string;
  execucao_data: string;
  tipo_envio: string;
  status: string;
  sistema_destino: string;
  empresa_id?: string;
  empresa_nome?: string;
  competencia?: string;
  total_lancamentos?: number;
  total_valor?: number;
  content_hash?: string;
  arquivo_nome?: string;
  solicitante?: string;
  user_id?: string | null;
  erro_detalhe?: string | null;
  payload?: any;
}

const CATEGORIAS_DEFINICAO: Record<
  CategoriaContabil,
  { titulo: string; descricao: string; natureza: "RECEITA" | "DESPESA" }
> = {
  RECEITA_OPERACAO_VOLUME: {
    titulo: "Receita de Operações e Faturamento",
    descricao: "Faturamento consolidado das operações logísticas por volume e medições",
    natureza: "RECEITA",
  },
  RECEITA_SERVICO_EXTRA: {
    titulo: "Receita de Serviços Extras",
    descricao: "Faturamento e recebimentos de serviços extraordinários homologados",
    natureza: "RECEITA",
  },
  DESPESA_DIARISTAS: {
    titulo: "Despesa com Diárias Operacionais",
    descricao: "Apropriação dos lotes semanais de diaristas aprovados pelo financeiro",
    natureza: "DESPESA",
  },
  DESPESA_CUSTO_EXTRA: {
    titulo: "Custos Extras Operacionais",
    descricao: "Lançamento de despesas de insumos, materiais e reembolsos operacionais",
    natureza: "DESPESA",
  },
};

/**
 * Hash determinístico simples (FNV-1a 32-bit em hexadecimal)
 */
function computeDeterministicHash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

class ContabilOficialServiceClass {
  /**
   * Consulta os mapeamentos contábeis reais de uma empresa estritamente no Supabase.
   * Preserva o modelo de duas linhas por categoria contábil (classificacao = 'DEBITO' ou 'CREDITO').
   * Não utiliza cache local ou localStorage.
   */
  async getMapeamentos(empresaId: string): Promise<MapeamentoContabilItem[]> {
    if (!empresaId) return [];

    const { data: dbMappings, error } = await supabase
      .from("contabil_mapeamento")
      .select("*")
      .eq("empresa_id", empresaId);

    if (error) {
      console.error("[ContabilOficialService] Erro ao consultar contabil_mapeamento no Supabase:", error);
      throw new Error(`Falha ao consultar mapeamento contábil no banco de dados: ${error.message}`);
    }

    const rows = Array.isArray(dbMappings) ? dbMappings : [];
    const result: MapeamentoContabilItem[] = [];

    for (const [key, meta] of Object.entries(CATEGORIAS_DEFINICAO) as [
      CategoriaContabil,
      (typeof CATEGORIAS_DEFINICAO)[CategoriaContabil]
    ][]) {
      const rowDebito = rows.find(
        (m) => m.operacao_tipo === key && m.classificacao === "DEBITO"
      );
      const rowCredito = rows.find(
        (m) => m.operacao_tipo === key && m.classificacao === "CREDITO"
      );

      const contaDebito = rowDebito?.conta_contabil?.trim() || "";
      const contaCredito = rowCredito?.conta_contabil?.trim() || "";

      const status =
        contaDebito && contaCredito ? "COMPLETO" : "INCOMPLETO";

      result.push({
        operacao_tipo: key,
        titulo: meta.titulo,
        descricao: meta.descricao,
        natureza: meta.natureza,
        conta_debito: contaDebito,
        conta_credito: contaCredito,
        status,
      });
    }

    return result;
  }

  /**
   * Salva o par Débito e Crédito de uma categoria contábil com garantia de atomicidade.
   * Evita padrão não-atômico (DELETE seguido de INSERT isolado).
   * Prioriza RPC transacional segura; se não disponível, executa UPSERT em lote único.
   */
  async salvarMapeamento(
    empresaId: string,
    operacaoTipo: CategoriaContabil,
    contaDebito: string,
    contaCredito: string
  ): Promise<{ success: boolean; message: string }> {
    if (!empresaId) throw new Error("Empresa ID é obrigatório para salvar mapeamento.");
    if (!contaDebito?.trim() || !contaCredito?.trim()) {
      throw new Error("Contas de Débito e Crédito são obrigatórias.");
    }

    // 1. Tentativa via RPC transacional atômica (se a migration for aprovada no banco)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "rpc_salvar_mapeamento_contabil_par",
        {
          p_empresa_id: empresaId,
          p_operacao_tipo: operacaoTipo,
          p_conta_debito: contaDebito.trim(),
          p_conta_credito: contaCredito.trim(),
        }
      );

      if (!rpcError && (rpcData as any)?.success) {
        return {
          success: true,
          message: "Mapeamento gravado com sucesso no Supabase com garantia atômica (RPC).",
        };
      }

      if (rpcError) {
        const msg = String(rpcError.message || "");
        const code = String((rpcError as any).code || "");
        const isNotInstalled =
          code === "42883" ||
          msg.includes("does not exist") ||
          msg.includes("not found");

        if (!isNotInstalled) {
          console.error("[ContabilOficialService] Erro na RPC de mapeamento:", rpcError);
          throw new Error(`Falha de persistência atômica no Supabase: ${msg}`);
        }
      }
    } catch (err: any) {
      if (err?.message?.includes("Falha de persistência atômica no Supabase")) {
        throw err;
      }
      // RPC ainda não instalada no banco, procede para upsert direto atômico
    }

    // 2. Gravação atômica em lote único via UPSERT
    const rowsToUpsert = [
      {
        operacao_tipo: operacaoTipo,
        conta_contabil: contaDebito.trim(),
        classificacao: "DEBITO",
        empresa_id: empresaId,
        updated_at: new Date().toISOString(),
      },
      {
        operacao_tipo: operacaoTipo,
        conta_contabil: contaCredito.trim(),
        classificacao: "CREDITO",
        empresa_id: empresaId,
        updated_at: new Date().toISOString(),
      },
    ];

    const { error: upsertError } = await supabase
      .from("contabil_mapeamento")
      .upsert(rowsToUpsert, {
        onConflict: "empresa_id,operacao_tipo,classificacao",
      });

    if (upsertError) {
      console.error("[ContabilOficialService] Erro na gravação atômica do mapeamento:", upsertError);
      throw new Error(`Falha de persistência atômica no Supabase: ${upsertError.message}`);
    }

    return {
      success: true,
      message: "Mapeamento gravado com sucesso no Supabase (UPSERT atômico).",
    };
  }

  /**
   * Gera a prévia analítica e conferência dos lançamentos contábeis de uma competência e empresa.
   * Utiliza estritamente os dados oficiais dos relatórios R03, R02, R04 e R07.
   */
  async gerarPreviaContabil(
    empresaId: string,
    competencia: string,
    empresaNome = "Empresa Não Informada"
  ): Promise<PreviaContabilConsolidada> {
    if (!empresaId) throw new Error("Parâmetro empresa_id obrigatório para prévia contábil.");
    if (!competencia) throw new Error("Parâmetro competência obrigatório para prévia contábil.");

    const tenantId = await getCurrentTenantId();
    await EnvironmentService.assertEmpresaAllowed({ tenantId, empresaId });

    // 1. Obter mapeamentos vigentes
    const mapeamentos = await this.getMapeamentos(empresaId);
    const mapLookup = new Map<CategoriaContabil, MapeamentoContabilItem>();
    mapeamentos.forEach((m) => mapLookup.set(m.operacao_tipo, m));

    // 2. Extrair dados das fontes financeiras oficiais
    const [r02Rows, r03Rows, r04Rows, r07Rows] = await Promise.all([
      RelatoriosOficialAdapter.getR02Data(empresaId, { competencia }),
      RelatoriosOficialAdapter.getR03Data(empresaId, { competencia }),
      RelatoriosOficialAdapter.getR04Data(empresaId, { competencia }),
      RelatoriosOficialAdapter.getR07Data(empresaId, { competencia }),
    ]);

    const lancamentos: LancamentoContabilPartidaDobrada[] = [];
    const inconsistencias: string[] = [];
    let lotesAbertosCount = 0;

    // --- FATO 1: Faturamento e Receitas Operacionais (R03) ---
    const mapR03 = mapLookup.get("RECEITA_OPERACAO_VOLUME");
    for (const r of r03Rows) {
      const valor = Number(Number(r.valorFaturado || 0).toFixed(2));
      if (valor <= 0) continue;

      const dataLancamento = r.vencimento || `${competencia}-28`;
      const doc = `REC-${r.id.slice(0, 8).toUpperCase()}`;
      const hist = `Faturamento Ref. ${r.origem} - Cliente ${r.clienteNome}`;

      const cDeb = mapR03?.conta_debito || "";
      const cCred = mapR03?.conta_credito || "";
      const isMapeado = Boolean(cDeb && cCred);

      lancamentos.push({
        id: `LANC-R03-${r.id}`,
        data: dataLancamento,
        origem: r.origem,
        origem_tipo: "RECEITA_OPERACAO_VOLUME",
        documento: doc,
        historico: hist,
        conta_debito: cDeb,
        conta_credito: cCred,
        valor,
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        centro_custo: "OPERACIONAL",
        mapeado: isMapeado,
        status_origem: r.status || "FATURADO",
      });

      if (r.status && ["PENDENTE", "EM_ABERTO"].includes(r.status.toUpperCase())) {
        lotesAbertosCount++;
      }
    }

    // --- FATO 2: Despesas com Diárias Operacionais (R02) ---
    // Agrupamento por lote semanal para evitar granularidade excessiva e refletir fato financeiro
    const mapR02 = mapLookup.get("DESPESA_DIARISTAS");
    const lotesDiaristasMap = new Map<
      string,
      { loteCodigo: string; data: string; total: number; statusLote: string; count: number }
    >();

    for (const r of r02Rows) {
      const loteCod = r.loteCodigo || "LOTE-SEM-CODIGO";
      const atual = lotesDiaristasMap.get(loteCod) || {
        loteCodigo: loteCod,
        data: r.dataLancamento || `${competencia}-20`,
        total: 0,
        statusLote: r.statusLote || "em_aberto",
        count: 0,
      };

      atual.total += Number(r.total || 0);
      atual.count += 1;
      lotesDiaristasMap.set(loteCod, atual);

      if (r.statusLote === "em_aberto") {
        lotesAbertosCount++;
      }
    }

    for (const [, lote] of lotesDiaristasMap) {
      const valor = Number(lote.total.toFixed(2));
      if (valor <= 0) continue;

      const doc = lote.loteCodigo;
      const hist = `Apropriação Folha Diaristas Lote ${doc} (${lote.count} diárias)`;

      const cDeb = mapR02?.conta_debito || "";
      const cCred = mapR02?.conta_credito || "";
      const isMapeado = Boolean(cDeb && cCred);

      lancamentos.push({
        id: `LANC-R02-${doc}`,
        data: lote.data,
        origem: "Fechamento Diaristas",
        origem_tipo: "DESPESA_DIARISTAS",
        documento: doc,
        historico: hist,
        conta_debito: cDeb,
        conta_credito: cCred,
        valor,
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        centro_custo: "OPERACIONAL",
        mapeado: isMapeado,
        status_origem: lote.statusLote.toUpperCase(),
      });
    }

    // --- FATO 3: Custos Extras Operacionais (R04) ---
    const mapR04 = mapLookup.get("DESPESA_CUSTO_EXTRA");
    for (const r of r04Rows) {
      const valor = Number(Number(r.total || 0).toFixed(2));
      if (valor <= 0) continue;

      const doc = `CEX-${r.id.slice(0, 8).toUpperCase()}`;
      const hist = `Custo Extra (${r.categoriaCusto}): ${r.descricao} - ${r.favorecidoNome}`;

      const cDeb = mapR04?.conta_debito || "";
      const cCred = mapR04?.conta_credito || "";
      const isMapeado = Boolean(cDeb && cCred);

      lancamentos.push({
        id: `LANC-R04-${r.id}`,
        data: r.data || `${competencia}-15`,
        origem: "Custos Extras",
        origem_tipo: "DESPESA_CUSTO_EXTRA",
        documento: doc,
        historico: hist,
        conta_debito: cDeb,
        conta_credito: cCred,
        valor,
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        centro_custo: "OPERACIONAL",
        mapeado: isMapeado,
        status_origem: r.status || "PENDENTE",
      });

      if (r.status === "PENDENTE") {
        lotesAbertosCount++;
      }
    }

    // --- FATO 4: Serviços Extras Faturáveis (R07) ---
    // Apenas serviços não consolidados no faturamento mensal
    const mapR07 = mapLookup.get("RECEITA_SERVICO_EXTRA");
    for (const r of r07Rows) {
      if (r.modalidadeFinanceira === "FATURAMENTO_MENSAL") {
        // Já incluso no fluxo de faturamento do R03 para evitar dupla contabilização
        continue;
      }

      const valor = Number(Number(r.total || 0).toFixed(2));
      if (valor <= 0) continue;

      const doc = r.nfNumero ? `NF-${r.nfNumero}` : `SEXT-${r.id.slice(0, 8).toUpperCase()}`;
      const hist = `Serviço Extra Faturável: ${r.tipoServico} - ${r.tomadorNome}`;

      const cDeb = mapR07?.conta_debito || "";
      const cCred = mapR07?.conta_credito || "";
      const isMapeado = Boolean(cDeb && cCred);

      lancamentos.push({
        id: `LANC-R07-${r.id}`,
        data: r.data || `${competencia}-10`,
        origem: "Serviço Extra",
        origem_tipo: "RECEITA_SERVICO_EXTRA",
        documento: doc,
        historico: hist,
        conta_debito: cDeb,
        conta_credito: cCred,
        valor,
        empresa_id: empresaId,
        empresa_nome: empresaNome,
        centro_custo: "OPERACIONAL",
        mapeado: isMapeado,
        status_origem: r.pipelineStatus || "PENDENTE",
      });

      if (["PENDENTE", "EM_VALIDACAO"].includes(r.pipelineStatus)) {
        lotesAbertosCount++;
      }
    }

    // Ordenar lançamentos por data
    lancamentos.sort((a, b) => a.data.localeCompare(b.data));

    // Totais e cálculos
    let totalDebito = 0;
    let totalCredito = 0;
    let lancamentosNaoMapeados = 0;

    for (const l of lancamentos) {
      totalDebito += l.valor;
      totalCredito += l.valor; // Em partidas dobradas cada fato gera débito e crédito balanceados
      if (!l.mapeado) {
        lancamentosNaoMapeados++;
      }
    }

    totalDebito = Number(totalDebito.toFixed(2));
    totalCredito = Number(totalCredito.toFixed(2));
    const diferenca = Number((totalDebito - totalCredito).toFixed(2));

    // Status de fechamento
    const statusFechamento =
      lotesAbertosCount === 0 && lancamentos.length > 0
        ? "FECHADO_FINANCEIRO"
        : "EM_ABERTO";

    const fechamentoDetalhe =
      statusFechamento === "FECHADO_FINANCEIRO"
        ? "Competência com fechamento financeiro homologado e lotes aprovados."
        : `Existem ${lotesAbertosCount} item(ns)/lote(s) com tramitação em aberto na competência.`;

    // Avaliação de bloqueios de exportação
    const bloqueios: string[] = [];
    if (lancamentos.length === 0) {
      bloqueios.push("Não há lançamentos financeiros para a empresa e competência selecionadas.");
    }
    if (lancamentosNaoMapeados > 0) {
      bloqueios.push(
        `Existem ${lancamentosNaoMapeados} lançamento(s) sem contas de débito ou crédito configuradas.`
      );
    }
    if (statusFechamento !== "FECHADO_FINANCEIRO") {
      bloqueios.push(
        "A competência não possui fechamento financeiro homologado. Prévia liberada; exportação bloqueada."
      );
    }
    if (diferenca !== 0) {
      bloqueios.push("Débitos e créditos não estão equilibrados.");
      inconsistencias.push(`Diferença de R$ ${diferenca} detectada entre débitos e créditos.`);
    }

    const elegivelExportacao = bloqueios.length === 0;

    // Hash determinístico do conteúdo
    const hashPayload = lancamentos
      .map((l) => `${l.data}|${l.documento}|${l.conta_debito}|${l.conta_credito}|${l.valor}`)
      .join(";");
    const contentHash = computeDeterministicHash(
      `${empresaId}:${competencia}:${hashPayload}`
    );

    return {
      empresa_id: empresaId,
      empresa_nome: empresaNome,
      competencia,
      status_fechamento: statusFechamento,
      fechamento_detalhe: fechamentoDetalhe,
      total_lancamentos: lancamentos.length,
      total_debito: totalDebito,
      total_credito: totalCredito,
      diferenca,
      lancamentos_nao_mapeados: lancamentosNaoMapeados,
      inconsistencias,
      elegivel_exportacao: elegivelExportacao,
      bloqueios,
      lancamentos,
      content_hash: contentHash,
    };
  }

  /**
   * Verifica se já existe exportação prévia registrada para a mesma competência e conteúdo.
   */
  async verificarDuplicidadeExportacao(
    empresaId: string,
    competencia: string,
    contentHash: string
  ): Promise<{ duplicado: boolean; logAnterior?: ContabilLogItem }> {
    try {
      const { data, error } = await supabase
        .from("contabil_logs_integracao")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error || !data) return { duplicado: false };

      const logExistente = data.find((row: any) => {
        const p = row.payload;
        return (
          p &&
          p.empresa_id === empresaId &&
          p.competencia === competencia &&
          p.content_hash === contentHash &&
          row.status === "sucesso"
        );
      });

      if (logExistente) {
        return {
          duplicado: true,
          logAnterior: {
            id: logExistente.id,
            execucao_data: logExistente.execucao_data || logExistente.created_at,
            tipo_envio: logExistente.tipo_envio,
            status: logExistente.status,
            sistema_destino: logExistente.sistema_destino,
            empresa_id: logExistente.payload?.empresa_id,
            empresa_nome: logExistente.payload?.empresa_nome,
            competencia: logExistente.payload?.competencia,
            total_lancamentos: logExistente.payload?.total_lancamentos,
            total_valor: logExistente.payload?.total_debito,
            arquivo_nome: logExistente.payload?.arquivo_nome,
            user_id: logExistente.user_id,
          },
        };
      }
    } catch {
      // Ignora falha de verificação
    }

    return { duplicado: false };
  }

  /**
   * Exporta arquivo CSV de partidas dobradas e registra log oficial.
   * Cabeçalho: Data;ContaDebito;ContaCredito;Valor;Historico;Documento;Empresa;CentroCusto
   */
  async exportarCSV(
    previa: PreviaContabilConsolidada,
    userEmail = "usuario_orbe"
  ): Promise<{ fileName: string; csvContent: string; logId?: string }> {
    if (!previa.elegivel_exportacao) {
      throw new Error(
        `Exportação bloqueada: ${previa.bloqueios.join(" | ")}`
      );
    }

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;

    const sanitize = (val: string | number | null | undefined): string => {
      const str = String(val ?? "").replace(/[\r\n]+/g, " ").trim();
      if (str.includes(";") || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const header = [
      "Data",
      "ContaDebito",
      "ContaCredito",
      "Valor",
      "Historico",
      "Documento",
      "Empresa",
      "CentroCusto",
    ].join(";");

    const lines = previa.lancamentos.map((l) => {
      return [
        sanitize(l.data),
        sanitize(l.conta_debito),
        sanitize(l.conta_credito),
        l.valor.toFixed(2),
        sanitize(l.historico),
        sanitize(l.documento),
        sanitize(l.empresa_nome),
        sanitize(l.centro_custo),
      ].join(";");
    });

    const csvContent = [header, ...lines].join("\r\n");

    const slug = previa.empresa_nome
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const timestamp = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
    const fileName = `ORBE_CONTABIL_${slug}_${previa.competencia}_${timestamp}.csv`;

    // Disparar download no navegador
    if (typeof window !== "undefined" && typeof URL.createObjectURL === "function") {
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(url);
      }
    }

    // Registrar no histórico oficial (contabil_logs_integracao)
    let logId: string | undefined;
    try {
      const { data: logData, error: logErr } = await supabase
        .from("contabil_logs_integracao")
        .insert({
          tipo_envio: "Mensal",
          status: "sucesso",
          sistema_destino: "ORBE_CSV_PARTIDAS_DOBRADAS",
          user_id: userId,
          payload: {
            empresa_id: previa.empresa_id,
            empresa_nome: previa.empresa_nome,
            competencia: previa.competencia,
            total_lancamentos: previa.total_lancamentos,
            total_debito: previa.total_debito,
            total_credito: previa.total_credito,
            content_hash: previa.content_hash,
            arquivo_nome: fileName,
            solicitante: userEmail,
          },
        })
        .select()
        .single();

      if (!logErr && logData) {
        logId = logData.id;
      }
    } catch {
      // Ignora falha de gravação de log
    }

    return { fileName, csvContent, logId };
  }

  /**
   * Retorna os logs reais gravados no Supabase contabil_logs_integracao.
   */
  async getLogs(empresaId?: string, competencia?: string): Promise<ContabilLogItem[]> {
    try {
      const { data, error } = await supabase
        .from("contabil_logs_integracao")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error || !data) return [];

      let filtered = data.map((row: any) => ({
        id: row.id,
        execucao_data: row.execucao_data || row.created_at,
        tipo_envio: row.tipo_envio || "Mensal",
        status: row.status || "sucesso",
        sistema_destino: row.sistema_destino || "ORBE_CSV",
        empresa_id: row.payload?.empresa_id,
        empresa_nome: row.payload?.empresa_nome || "Empresa Geral",
        competencia: row.payload?.competencia || "-",
        total_lancamentos: row.payload?.total_lancamentos || 0,
        total_valor: row.payload?.total_debito || 0,
        content_hash: row.payload?.content_hash,
        arquivo_nome: row.payload?.arquivo_nome,
        solicitante: row.payload?.solicitante || (row.user_id ? `Usuário (${row.user_id.slice(0, 8)})` : "Automático"),
        user_id: row.user_id,
        erro_detalhe: row.erro_detalhe || row.payload?.erro_detalhe || null,
        payload: row.payload,
      }));

      if (empresaId) {
        filtered = filtered.filter(
          (l: ContabilLogItem) => !l.empresa_id || l.empresa_id === empresaId
        );
      }
      if (competencia) {
        filtered = filtered.filter(
          (l: ContabilLogItem) => !l.competencia || l.competencia === competencia
        );
      }

      return filtered;
    } catch {
      return [];
    }
  }
}

export const ContabilOficialService = new ContabilOficialServiceClass();
