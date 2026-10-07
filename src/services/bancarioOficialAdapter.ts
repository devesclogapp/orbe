import { supabase } from "@/lib/supabase";
import { getCurrentTenantId, cleanUuid } from "@/services/domain/base.service";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { EnvironmentQueryFilter } from "@/services/environment/EnvironmentQueryFilter";

export type OrigemBancariaOficial = "CLT" | "DIARISTAS" | "INTERMITENTES";

export type SituacaoBancariaOficial =
  | "PRONTO_BANCO"      // Homologado no RH/Financeiro, apto para remessa
  | "REMESSA_GERADA"   // Remessa criada no sistema (TXT disponível)
  | "ARQUIVO_BAIXADO"   // Arquivo baixado pelo operador (aguarda envio externo)
  | "ENVIADO_MANUAL"    // Transmissão manual confirmada no internet banking
  | "LIQUIDADO"         // Retorno bancário processado com sucesso
  | "CONCILIADO"        // Baixa confirmada e lote quitado
  | "REJEITADO"         // Rejeição apontada pela instituição bancária
  | "DIVERGENTE";       // Valor creditado difere do valor esperado

export type EstagioBancarioTab =
  | "TODAS"
  | "PRONTAS_BANCO"
  | "REMESSAS"
  | "AGUARDANDO_RETORNO"
  | "CONCILIACAO"
  | "PENDENCIAS";

export interface ContaPagadoraOficial {
  id: string;
  empresaId?: string;
  bancoCodigo: string;
  bancoNome: string;
  agencia: string;
  agenciaMascarada: string;
  conta: string;
  contaMascarada: string;
  convenio?: string;
  cedenteNome: string;
  cedenteCnpjMascarado: string;
  permiteCnab: boolean;
  ativo: boolean;
}

export interface ItemObrigacaoBancariaOficial {
  id: string;
  referencia: string;
  origemTipo: OrigemBancariaOficial;
  loteId: string;
  loteCodigo?: string;
  empresaId: string;
  empresaNome: string;
  isEmpresaTeste?: boolean;
  competencia: string;
  favorecidoDescricao: string;
  favorecidoNomeMascarado: string;
  documentoFavorecidoMascarado: string;
  dadosBancariosFavorecidoMascarado: string;
  quantidadeFavorecidos: number;
  valorTotal: number;
  valorEsperado: number;
  valorRetornado?: number;
  diferencaValor?: number;
  contaPagadora: ContaPagadoraOficial;
  situacao: SituacaoBancariaOficial;
  estagioTab: EstagioBancarioTab;

  // Metadados de Remessa (quando gerada)
  remessaId?: string;
  remessaNumero?: string;
  remessaNsa?: number;
  remessaHash?: string;
  remessaDataGeracao?: string;
  remessaDataDownload?: string;
  remessaDataEnvio?: string;
  remessaNomeArquivo?: string;
  remessaQtdRegistros?: number;
  observacaoEnvio?: string;
  usuarioGeracaoNome?: string;
  usuarioEnvioNome?: string;

  // Metadados de Retorno (quando houver ocorrência)
  retornoId?: string;
  retornoData?: string;
  codigoOcorrencia?: string;
  motivoRejeicaoCodigo?: string;
  motivoRejeicaoDescricao?: string;
  impactoRejeicao?: string;
  acaoRejeicaoRecomendada?: string;

  // Pré-validação de Remessa
  preValidacao: {
    contaValida: boolean;
    dadosObrigatorios: boolean;
    favorecidosAptos: boolean;
    qtdFavorecidosAptos?: number;
    qtdFavorecidosInaptos?: number;
    valorConsolidado: boolean;
    inconsistencias: string[];
  };

  // Timeline de Auditoria
  timeline: Array<{
    etapa: string;
    dataHora: string;
    responsavel: string;
    descricao: string;
    status: "concluido" | "atual" | "pendente" | "erro";
  }>;
}

export interface CentralBancariaKpiStats {
  prontasValor: number;
  prontasQtdLotes: number;
  emTransitoValor: number;
  emTransitoGeradasQtd: number;
  emTransitoBaixadasQtd: number;
  emTransitoEnviadasQtd: number;
  liquidadasValor: number;
  liquidadasQtdItens: number;
  pendenciasValor: number;
  pendenciasRejeitadosQtd: number;
  pendenciasDivergentesQtd: number;
  pendenciasQtdTotal: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE MASCARAMENTO SEGURO
// ─────────────────────────────────────────────────────────────────────────────

export function maskCnpj(doc?: string | null): string {
  if (!doc) return "••.•••.•••/••••-••";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 14) {
    return `${clean.slice(0, 2)}.${clean.slice(2, 5)}.${clean.slice(5, 8)}/${clean.slice(8, 12)}-••`;
  }
  return "••.•••.•••/••••-••";
}

export function maskCpf(doc?: string | null): string {
  if (!doc) return "CPF •••.•••.•••-••";
  const clean = doc.replace(/\D/g, "");
  if (clean.length === 11) {
    return `CPF •••.${clean.slice(3, 6)}.${clean.slice(6, 9)}-••`;
  }
  return "CPF •••.•••.•••-••";
}

export function maskConta(conta?: string | null): string {
  if (!conta) return "Cc •••••";
  const clean = conta.trim();
  if (clean.length > 4) {
    return `Cc •••• ${clean.slice(-4)}`;
  }
  return `Cc •••• ${clean}`;
}

export function maskAgencia(agencia?: string | null): string {
  if (!agencia) return "Ag. ••••";
  return `Ag. ${agencia.trim()}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE KPIS CONTEXTUAIS
// ─────────────────────────────────────────────────────────────────────────────

export function calculateCentralBancariaKpiStats(
  items: ItemObrigacaoBancariaOficial[]
): CentralBancariaKpiStats {
  let prontasValor = 0;
  let prontasQtdLotes = 0;

  let emTransitoValor = 0;
  let emTransitoGeradasQtd = 0;
  let emTransitoBaixadasQtd = 0;
  let emTransitoEnviadasQtd = 0;

  let liquidadasValor = 0;
  let liquidadasQtdItens = 0;

  let pendenciasValor = 0;
  let pendenciasRejeitadosQtd = 0;
  let pendenciasDivergentesQtd = 0;

  for (const item of items) {
    const val = Number(item.valorTotal || 0);

    // 1. Prontas para Banco
    if (item.situacao === "PRONTO_BANCO") {
      prontasValor += val;
      prontasQtdLotes += 1;
    }

    // 2. Em Trânsito Bancário
    if (
      item.situacao === "REMESSA_GERADA" ||
      item.situacao === "ARQUIVO_BAIXADO" ||
      item.situacao === "ENVIADO_MANUAL"
    ) {
      emTransitoValor += val;
      if (item.situacao === "REMESSA_GERADA") emTransitoGeradasQtd += 1;
      if (item.situacao === "ARQUIVO_BAIXADO") emTransitoBaixadasQtd += 1;
      if (item.situacao === "ENVIADO_MANUAL") emTransitoEnviadasQtd += 1;
    }

    // 3. Liquidadas no Período
    if (item.situacao === "LIQUIDADO" || item.situacao === "CONCILIADO") {
      liquidadasValor += item.valorRetornado ? Number(item.valorRetornado) : val;
      liquidadasQtdItens += item.quantidadeFavorecidos || 1;
    }

    // 4. Pendências Bancárias
    if (item.situacao === "REJEITADO") {
      pendenciasValor += val;
      pendenciasRejeitadosQtd += 1;
    } else if (item.situacao === "DIVERGENTE") {
      pendenciasValor += val;
      pendenciasDivergentesQtd += 1;
    }
  }

  return {
    prontasValor,
    prontasQtdLotes,
    emTransitoValor,
    emTransitoGeradasQtd,
    emTransitoBaixadasQtd,
    emTransitoEnviadasQtd,
    liquidadasValor,
    liquidadasQtdItens,
    pendenciasValor,
    pendenciasRejeitadosQtd,
    pendenciasDivergentesQtd,
    pendenciasQtdTotal: pendenciasRejeitadosQtd + pendenciasDivergentesQtd,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGES SEMÂNTICOS
// ─────────────────────────────────────────────────────────────────────────────

export function getSituacaoBadge(situacao: SituacaoBancariaOficial): {
  label: string;
  variant: "default" | "secondary" | "destructive" | "outline";
  className: string;
} {
  switch (situacao) {
    case "PRONTO_BANCO":
      return {
        label: "Pronto p/ Banco",
        variant: "outline",
        className:
          "border-blue-300 bg-blue-50/80 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-300",
      };
    case "REMESSA_GERADA":
      return {
        label: "Remessa Gerada",
        variant: "secondary",
        className:
          "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
      };
    case "ARQUIVO_BAIXADO":
      return {
        label: "Arquivo Baixado",
        variant: "outline",
        className:
          "border-indigo-300 bg-indigo-50/80 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold",
      };
    case "ENVIADO_MANUAL":
      return {
        label: "Enviado ao Banco",
        variant: "outline",
        className:
          "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
      };
    case "LIQUIDADO":
      return {
        label: "Liquidado",
        variant: "default",
        className:
          "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
      };
    case "CONCILIADO":
      return {
        label: "Conciliado",
        variant: "default",
        className:
          "border-emerald-400 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200 font-bold",
      };
    case "REJEITADO":
      return {
        label: "Rejeitado",
        variant: "destructive",
        className:
          "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 font-bold",
      };
    case "DIVERGENTE":
      return {
        label: "Divergente",
        variant: "destructive",
        className:
          "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 font-bold",
      };
  }
}

export function getOrigemBadge(origem: OrigemBancariaOficial): {
  label: string;
  className: string;
} {
  switch (origem) {
    case "CLT":
      return {
        label: "CLT",
        className:
          "border-blue-200 bg-blue-50/70 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-300",
      };
    case "DIARISTAS":
      return {
        label: "Diaristas",
        className:
          "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300",
      };
    case "INTERMITENTES":
      return {
        label: "Intermitentes",
        className:
          "border-purple-200 bg-purple-50/70 text-purple-700 dark:border-purple-900/40 dark:bg-purple-950/30 dark:text-purple-300",
      };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVIÇO ADAPTER OFICIAL — CONSULTA REAL E UNIFICAÇÃO
// ─────────────────────────────────────────────────────────────────────────────

export interface FetchCentralBancariaParams {
  empresaId?: string;
  competencia?: string;
}

export const BancarioOficialAdapter = {
  /**
   * Consulta as fontes reais de dados (CLT, Diaristas, Intermitentes, Remessas, Retornos)
   * e unifica para visualização na esteira bancária, mantendo segregação e isolamento por tenant.
   */
  async carregarObrigacoes(
    params: FetchCentralBancariaParams = {}
  ): Promise<ItemObrigacaoBancariaOficial[]> {
    const tenantId = await getCurrentTenantId();
    const { empresaId, competencia } = params;

    // 1. Carregar Empresas ativas para mapeamento de nomes
    const { data: empresasDb } = await supabase
      .from("empresas")
      .select("id, nome, cnpj, cidade, estado, is_teste");
    const empresasMap = new Map((empresasDb || []).map((e) => [e.id, e]));

    // Bloco 4 Segregation: Obter IDs de empresas de teste para aplicar escopo do ambiente ativo
    const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);

    // 2. Carregar Contas Bancárias elegíveis (ativo = true, permite_cnab = true)
    let contasQuery = supabase
      .from("contas_bancarias_empresa")
      .select("*")
      .eq("ativo", true);
    if (empresaId) {
      contasQuery = contasQuery.eq("empresa_id", empresaId);
    } else {
      contasQuery = EnvironmentQueryFilter.applyEmpresaScope(contasQuery, {
        tenantId,
        column: "empresa_id",
        includeNullInProduction: false,
        testIds,
      });
    }
    const { data: contasDb } = await contasQuery;
    const contasPorEmpresa = new Map<string, any[]>();
    (contasDb || []).forEach((cta) => {
      if (cta.empresa_id) {
        const arr = contasPorEmpresa.get(cta.empresa_id) || [];
        arr.push(cta);
        contasPorEmpresa.set(cta.empresa_id, arr);
      }
    });

    // Helper para extrair conta pagadora formatada
    const resolveContaPagadora = (
      empId: string,
      contaBancariaId?: string | null
    ): ContaPagadoraOficial => {
      let rawConta = (contasDb || []).find((c) => c.id === contaBancariaId);
      if (!rawConta) {
        const contasEmp = contasPorEmpresa.get(empId) || [];
        rawConta = contasEmp.find((c) => c.is_padrao) || contasEmp[0];
      }

      const validContaId = cleanUuid(rawConta?.id);
      if (rawConta && validContaId) {
        return {
          id: validContaId,
          // Empresa canônica DONA da conta (sem fallback para a empresa do lote,
          // para que divergência lote × conta seja detectável e bloqueada).
          empresaId: rawConta.empresa_id ? String(rawConta.empresa_id) : "",
          bancoCodigo: String(rawConta.banco_codigo || "001"),
          bancoNome: String(rawConta.banco_nome || (rawConta.banco_codigo === "341" ? "Itaú Unibanco" : "Banco do Brasil")),
          agencia: String(rawConta.agencia || ""),
          agenciaMascarada: maskAgencia(rawConta.agencia),
          conta: String(rawConta.conta || ""),
          contaMascarada: maskConta(rawConta.conta),
          convenio: rawConta.convenio ? String(rawConta.convenio) : undefined,
          cedenteNome: String(rawConta.cedente_nome || empresasMap.get(empId)?.nome || "EMPRESA"),
          cedenteCnpjMascarado: maskCnpj(rawConta.cedente_cnpj || empresasMap.get(empId)?.cnpj),
          permiteCnab: Boolean(rawConta.permite_cnab ?? true),
          ativo: Boolean(rawConta.ativo ?? true),
        };
      }

      // FAIL-CLOSED: Nenhuma conta bancária válida/ativa cadastrada para esta empresa
      const emp = empresasMap.get(empId);
      return {
        id: "",
        empresaId: empId,
        bancoCodigo: "",
        bancoNome: "Conta Não Vinculada",
        agencia: "",
        agenciaMascarada: "—",
        conta: "",
        contaMascarada: "—",
        cedenteNome: emp?.nome || "EMPRESA",
        cedenteCnpjMascarado: maskCnpj(emp?.cnpj),
        permiteCnab: false, // FAIL CLOSED: impede geração CNAB
        ativo: false,
      };
    };

    // 3. Carregar Remessas Existentes
    let remessasQuery = supabase
      .from("cnab_remessas_arquivos")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (empresaId) remessasQuery = remessasQuery.eq("empresa_id", empresaId);
    if (competencia) remessasQuery = remessasQuery.eq("competencia", competencia);
    const { data: remessasDb } = await remessasQuery;
    const remessasPorLoteRh = new Map<string, any>();
    const remessasPorLoteDiarista = new Map<string, any>();
    const remessasPorLoteIntermitente = new Map<string, any>();

    (remessasDb || []).forEach((rem) => {
      if (rem.lote_id) remessasPorLoteRh.set(rem.lote_id, rem);
      if (rem.diaristas_lote_id) remessasPorLoteDiarista.set(rem.diaristas_lote_id, rem);
      if (rem.intermitentes_lote_id) remessasPorLoteIntermitente.set(rem.intermitentes_lote_id, rem);
    });

    // 4. Carregar Itens de Retorno com Pendências ou Liquidações Recentes
    const { data: retornoItensDb } = await supabase
      .from("cnab_retorno_itens")
      .select("*")
      .in("status", ["pago", "rejeitado", "divergente"])
      .order("created_at", { ascending: false })
      .limit(500);

    const retornosPorLoteRh = new Map<string, any[]>();
    const retornosPorLoteDiarista = new Map<string, any[]>();
    const retornosPorLoteIntermitente = new Map<string, any[]>();

    (retornoItensDb || []).forEach((it) => {
      if (it.lote_id) {
        const arr = retornosPorLoteRh.get(it.lote_id) || [];
        arr.push(it);
        retornosPorLoteRh.set(it.lote_id, arr);
      }
      if (it.diaristas_lote_id) {
        const arr = retornosPorLoteDiarista.get(it.diaristas_lote_id) || [];
        arr.push(it);
        retornosPorLoteDiarista.set(it.diaristas_lote_id, arr);
      }
      if (it.intermitentes_lote_id) {
        const arr = retornosPorLoteIntermitente.get(it.intermitentes_lote_id) || [];
        arr.push(it);
        retornosPorLoteIntermitente.set(it.intermitentes_lote_id, arr);
      }
    });

    const obrigacoes: ItemObrigacaoBancariaOficial[] = [];

    // ─────────────────────────────────────────────────────────────────────────
    // FONTE 1: CLT (rh_financeiro_lotes)
    // ─────────────────────────────────────────────────────────────────────────
    let rhQuery = supabase
      .from("rh_financeiro_lotes")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (empresaId) {
      rhQuery = rhQuery.eq("empresa_id", empresaId);
    } else {
      rhQuery = EnvironmentQueryFilter.applyEmpresaScope(rhQuery, {
        tenantId,
        column: "empresa_id",
        includeNullInProduction: true,
        testIds,
      });
    }
    if (competencia) rhQuery = rhQuery.eq("competencia", competencia);

    const { data: rhLotesDb } = await rhQuery;

    // Carregar itens dos lotes CLT para validação factual dos favorecidos
    const rhLoteIds = (rhLotesDb || []).map((l) => l.id);
    let itensRhDb: any[] = [];
    if (rhLoteIds.length > 0) {
      const { data: itensCarregados } = await supabase
        .from("rh_financeiro_lote_itens")
        .select(`
          id, lote_id, valor_calculado,
          colaboradores (
            id, nome, cpf, banco_codigo, agencia, conta, digito_conta, tipo_conta, status_cadastro
          )
        `)
        .in("lote_id", rhLoteIds);
      itensRhDb = itensCarregados || [];
    }

    const itensPorLoteRh = new Map<string, any[]>();
    itensRhDb.forEach((it) => {
      const arr = itensPorLoteRh.get(it.lote_id) || [];
      arr.push(it);
      itensPorLoteRh.set(it.lote_id, arr);
    });

    (rhLotesDb || []).forEach((lote) => {
      const remessa = remessasPorLoteRh.get(lote.id);
      const retornos = retornosPorLoteRh.get(lote.id) || [];
      const emp = empresasMap.get(lote.empresa_id);

      // Avaliação factual dos favorecidos do lote
      const itensDoLote = itensPorLoteRh.get(lote.id) || [];
      let aptos = 0;
      let inaptos = 0;
      const inconsistenciasBeneficiarios: string[] = [];

      for (const it of itensDoLote) {
        const col = it.colaboradores;
        const banco = col?.banco_codigo ? String(col.banco_codigo).replace(/\D/g, "") : "";
        const ag = col?.agencia ? String(col.agencia).replace(/\D/g, "") : "";
        const cc = col?.conta ? String(col.conta).replace(/\D/g, "") : "";
        const cpf = col?.cpf ? String(col.cpf).replace(/\D/g, "") : "";
        const valor = Number(it.valor_calculado || 0);

        const hasBanco = Boolean(banco && banco !== "000");
        const hasAg = Boolean(ag && ag.length > 0);
        const hasCc = Boolean(cc && cc.length > 0);
        const hasCpf = Boolean(cpf && (cpf.length === 11 || cpf.length === 14));
        const hasValor = valor > 0;

        if (hasBanco && hasAg && hasCc && hasCpf && hasValor) {
          aptos++;
        } else {
          inaptos++;
          const p: string[] = [];
          if (!hasBanco) p.push("Banco ausente");
          if (!hasAg) p.push("Agência ausente");
          if (!hasCc) p.push("Conta ausente");
          if (!hasCpf) p.push("CPF ausente");
          if (!hasValor) p.push("Valor zerado");
          inconsistenciasBeneficiarios.push(
            `${col?.nome || "Colaborador sem identificação"}: ${p.join(", ")}`
          );
        }
      }

      // Se há itens carregados, todos com valor > 0 precisam estar aptos;
      // se inaptos > 0, o lote NÃO está apto para geração CNAB.
      const favorecidosAptos =
        itensDoLote.length > 0 ? inaptos === 0 && aptos > 0 : true;

      // Determinar situação real derivada
      let situacao: SituacaoBancariaOficial = "PRONTO_BANCO";
      let estagioTab: EstagioBancarioTab = "PRONTAS_BANCO";

      if (retornos.some((r) => r.status === "rejeitado")) {
        situacao = "REJEITADO";
        estagioTab = "PENDENCIAS";
      } else if (retornos.some((r) => r.status === "divergente")) {
        situacao = "DIVERGENTE";
        estagioTab = "PENDENCIAS";
      } else if (lote.status === "PAGO" || (remessa && remessa.status === "homologado")) {
        situacao = "LIQUIDADO";
        estagioTab = "CONCILIACAO";
      } else if (remessa) {
        if (remessa.status === "enviado_manual") {
          situacao = "ENVIADO_MANUAL";
          estagioTab = "AGUARDANDO_RETORNO";
        } else if (remessa.status === "baixado") {
          situacao = "ARQUIVO_BAIXADO";
          estagioTab = "REMESSAS";
        } else {
          situacao = "REMESSA_GERADA";
          estagioTab = "REMESSAS";
        }
      }

      const contaPagadora = resolveContaPagadora(
        lote.empresa_id,
        remessa?.conta_bancaria_id
      );

      const rejeicaoItem = retornos.find((r) => r.status === "rejeitado");
      const divergenteItem = retornos.find((r) => r.status === "divergente");

      const formatDt = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString("pt-BR") : "—";

      obrigacoes.push({
        id: `clt-${lote.id}`,
        referencia: `CLT-${lote.competencia || "MENSAL"}`,
        origemTipo: "CLT",
        loteId: lote.id,
        loteCodigo: `RH-${String(lote.id).slice(0, 8).toUpperCase()}`,
        empresaId: lote.empresa_id,
        empresaNome: emp?.nome || "Empresa Não Identificada",
        isEmpresaTeste: Boolean(emp?.is_teste),
        competencia: lote.competencia || "—",
        favorecidoDescricao: `${lote.quantidade_colaboradores || lote.total_registros || 1} Colaborador(es) CLT`,
        favorecidoNomeMascarado: "Folha Salarial Mensal CLT",
        documentoFavorecidoMascarado: "Contas Salário Diversas",
        dadosBancariosFavorecidoMascarado: "Contas Salário / Corrente Diversas",
        quantidadeFavorecidos: Number(lote.quantidade_colaboradores || lote.total_registros || 1),
        valorTotal: Number(lote.valor_total || 0),
        valorEsperado: Number(lote.valor_total || 0),
        valorRetornado: divergenteItem?.valor_retornado ? Number(divergenteItem.valor_retornado) : undefined,
        diferencaValor: divergenteItem?.valor_retornado ? Number(lote.valor_total || 0) - Number(divergenteItem.valor_retornado) : undefined,
        contaPagadora,
        situacao,
        estagioTab,
        remessaId: remessa?.id,
        remessaNumero: remessa ? `REM-${String(remessa.sequencial_arquivo).padStart(6, "0")}` : undefined,
        remessaNsa: remessa?.sequencial_arquivo,
        remessaHash: remessa?.hash_arquivo,
        remessaDataGeracao: remessa?.data_geracao,
        remessaDataDownload: remessa?.status === "baixado" || remessa?.status === "enviado_manual" ? remessa?.updated_at : undefined,
        remessaDataEnvio: remessa?.data_envio,
        remessaNomeArquivo: remessa?.nome_arquivo,
        remessaQtdRegistros: remessa?.total_registros,
        observacaoEnvio: remessa?.observacoes || undefined,
        motivoRejeicaoCodigo: rejeicaoItem?.codigo_ocorrencia,
        motivoRejeicaoDescricao: rejeicaoItem?.descricao_ocorrencia,
        impactoRejeicao: rejeicaoItem ? "Crédito recusado pela câmara de compensação bancária." : undefined,
        acaoRejeicaoRecomendada: rejeicaoItem ? "Verificar cadastro de dados bancários do colaborador no RH." : undefined,
        preValidacao: {
          contaValida: Boolean(contaPagadora.ativo && contaPagadora.permiteCnab),
          dadosObrigatorios: true,
          favorecidosAptos,
          qtdFavorecidosAptos: aptos,
          qtdFavorecidosInaptos: inaptos,
          valorConsolidado: Number(lote.valor_total || 0) > 0,
          inconsistencias: inconsistenciasBeneficiarios,
        },
        timeline: [
          {
            etapa: "Aprovação Financeira",
            dataHora: formatDt(lote.created_at),
            responsavel: "Setor RH / Financeiro",
            descricao: "Lote CLT validado e homologado para remessa bancária.",
            status: "concluido",
          },
          ...(remessa
            ? [
                {
                  etapa: "Geração da Remessa",
                  dataHora: formatDt(remessa.data_geracao),
                  responsavel: "Operador Financeiro",
                  descricao: `Arquivo ${remessa.nome_arquivo} gerado com sucesso.`,
                  status: "concluido" as const,
                },
              ]
            : []),
          ...(remessa?.data_envio
            ? [
                {
                  etapa: "Envio ao Banco",
                  dataHora: formatDt(remessa.data_envio),
                  responsavel: "Operador Financeiro",
                  descricao: "Arquivo transmitido manualmente via Internet Banking.",
                  status: "concluido" as const,
                },
              ]
            : []),
          ...(situacao === "LIQUIDADO" || situacao === "CONCILIADO"
            ? [
                {
                  etapa: "Liquidação Bancária",
                  dataHora: formatDt(remessa?.updated_at || lote.updated_at),
                  responsavel: "Retorno Bancário",
                  descricao: "Retorno confirmado e pagamentos conciliados.",
                  status: "concluido" as const,
                },
              ]
            : []),
        ],
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FONTE 2: DIARISTAS (diaristas_lotes_fechamento)
    // ─────────────────────────────────────────────────────────────────────────
    let diaristasQuery = supabase
      .from("diaristas_lotes_fechamento")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (empresaId) {
      diaristasQuery = diaristasQuery.eq("empresa_id", empresaId);
    } else {
      diaristasQuery = EnvironmentQueryFilter.applyEmpresaScope(diaristasQuery, {
        tenantId,
        column: "empresa_id",
        includeNullInProduction: false,
        testIds,
      });
    }

    const { data: diaristasLotesDb } = await diaristasQuery;

    (diaristasLotesDb || []).forEach((lote) => {
      const remessa = remessasPorLoteDiarista.get(lote.id);
      const retornos = retornosPorLoteDiarista.get(lote.id) || [];
      const emp = empresasMap.get(lote.empresa_id);

      let situacao: SituacaoBancariaOficial = "PRONTO_BANCO";
      let estagioTab: EstagioBancarioTab = "PRONTAS_BANCO";

      if (retornos.some((r) => r.status === "rejeitado")) {
        situacao = "REJEITADO";
        estagioTab = "PENDENCIAS";
      } else if (retornos.some((r) => r.status === "divergente")) {
        situacao = "DIVERGENTE";
        estagioTab = "PENDENCIAS";
      } else if (lote.status === "PAGO" || (remessa && remessa.status === "homologado")) {
        situacao = "LIQUIDADO";
        estagioTab = "CONCILIACAO";
      } else if (remessa) {
        if (remessa.status === "enviado_manual") {
          situacao = "ENVIADO_MANUAL";
          estagioTab = "AGUARDANDO_RETORNO";
        } else if (remessa.status === "baixado") {
          situacao = "ARQUIVO_BAIXADO";
          estagioTab = "REMESSAS";
        } else {
          situacao = "REMESSA_GERADA";
          estagioTab = "REMESSAS";
        }
      }

      const contaPagadora = resolveContaPagadora(
        lote.empresa_id,
        remessa?.conta_bancaria_id
      );

      const rejeicaoItem = retornos.find((r) => r.status === "rejeitado");
      const divergenteItem = retornos.find((r) => r.status === "divergente");

      const formatDt = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString("pt-BR") : "—";

      obrigacoes.push({
        id: `dia-${lote.id}`,
        referencia: `DIA-${lote.mes_referencia || formatDt(lote.data_inicio).slice(3)}`,
        origemTipo: "DIARISTAS",
        loteId: lote.id,
        loteCodigo: `DIA-${String(lote.id).slice(0, 8).toUpperCase()}`,
        empresaId: lote.empresa_id,
        empresaNome: emp?.nome || "Empresa Não Identificada",
        isEmpresaTeste: Boolean(emp?.is_teste),
        competencia: lote.mes_referencia || formatDt(lote.data_inicio).slice(3),
        favorecidoDescricao: `${lote.total_registros || 1} Diarista(s) Semanal`,
        favorecidoNomeMascarado: "Pagamento Semanal de Diárias",
        documentoFavorecidoMascarado: "Chaves PIX / Contas Bancárias",
        dadosBancariosFavorecidoMascarado: "Contas Corrente / PIX Diversas",
        quantidadeFavorecidos: Number(lote.total_registros || 1),
        valorTotal: Number(lote.valor_total || 0),
        valorEsperado: Number(lote.valor_total || 0),
        valorRetornado: divergenteItem?.valor_retornado ? Number(divergenteItem.valor_retornado) : undefined,
        diferencaValor: divergenteItem?.valor_retornado ? Number(lote.valor_total || 0) - Number(divergenteItem.valor_retornado) : undefined,
        contaPagadora,
        situacao,
        estagioTab,
        remessaId: remessa?.id,
        remessaNumero: remessa ? `REM-${String(remessa.sequencial_arquivo).padStart(6, "0")}` : undefined,
        remessaNsa: remessa?.sequencial_arquivo,
        remessaHash: remessa?.hash_arquivo,
        remessaDataGeracao: remessa?.data_geracao,
        remessaDataDownload: remessa?.status === "baixado" || remessa?.status === "enviado_manual" ? remessa?.updated_at : undefined,
        remessaDataEnvio: remessa?.data_envio,
        remessaNomeArquivo: remessa?.nome_arquivo,
        remessaQtdRegistros: remessa?.total_registros,
        observacaoEnvio: remessa?.observacoes || undefined,
        motivoRejeicaoCodigo: rejeicaoItem?.codigo_ocorrencia,
        motivoRejeicaoDescricao: rejeicaoItem?.descricao_ocorrencia,
        impactoRejeicao: rejeicaoItem ? "Diarista não recebeu crédito semanal por inconsistência bancária." : undefined,
        acaoRejeicaoRecomendada: rejeicaoItem ? "Atualizar chave PIX ou conta do diarista no cadastro." : undefined,
        preValidacao: {
          contaValida: Boolean(contaPagadora.ativo && contaPagadora.permiteCnab),
          dadosObrigatorios: true,
          favorecidosAptos: true,
          valorConsolidado: Number(lote.valor_total || 0) > 0,
          inconsistencias: [],
        },
        timeline: [
          {
            etapa: "Fechamento Semanal",
            dataHora: formatDt(lote.created_at),
            responsavel: "Encarregado / RH",
            descricao: "Grade semanal fechada e aprovada pelo financeiro.",
            status: "concluido",
          },
          ...(remessa
            ? [
                {
                  etapa: "Remessa CNAB",
                  dataHora: formatDt(remessa.data_geracao),
                  responsavel: "Operador Financeiro",
                  descricao: `Arquivo gerado: ${remessa.nome_arquivo}`,
                  status: "concluido" as const,
                },
              ]
            : []),
          ...(remessa?.data_envio
            ? [
                {
                  etapa: "Transmissão Bancária",
                  dataHora: formatDt(remessa.data_envio),
                  responsavel: "Operador Financeiro",
                  descricao: "Arquivo enviado ao internet banking.",
                  status: "concluido" as const,
                },
              ]
            : []),
          ...(situacao === "LIQUIDADO" || situacao === "CONCILIADO"
            ? [
                {
                  etapa: "Liquidação Bancária",
                  dataHora: formatDt(lote.paid_at || lote.updated_at),
                  responsavel: "Retorno Bancário",
                  descricao: "Pagamentos de diaristas quitados.",
                  status: "concluido" as const,
                },
              ]
            : []),
        ],
      });
    });

    // ─────────────────────────────────────────────────────────────────────────
    // FONTE 3: INTERMITENTES (intermitentes_lotes_fechamento)
    // ─────────────────────────────────────────────────────────────────────────
    let intermitentesQuery = supabase
      .from("intermitentes_lotes_fechamento")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });
    if (empresaId) {
      intermitentesQuery = intermitentesQuery.eq("empresa_id", empresaId);
    } else {
      intermitentesQuery = EnvironmentQueryFilter.applyEmpresaScope(intermitentesQuery, {
        tenantId,
        column: "empresa_id",
        includeNullInProduction: false,
        testIds,
      });
    }
    if (competencia) intermitentesQuery = intermitentesQuery.eq("competencia", competencia);

    const { data: intermitentesLotesDb } = await intermitentesQuery;

    (intermitentesLotesDb || []).forEach((lote) => {
      const remessa = remessasPorLoteIntermitente.get(lote.id);
      const retornos = retornosPorLoteIntermitente.get(lote.id) || [];
      const emp = empresasMap.get(lote.empresa_id);

      let situacao: SituacaoBancariaOficial = "PRONTO_BANCO";
      let estagioTab: EstagioBancarioTab = "PRONTAS_BANCO";

      if (retornos.some((r) => r.status === "rejeitado")) {
        situacao = "REJEITADO";
        estagioTab = "PENDENCIAS";
      } else if (retornos.some((r) => r.status === "divergente")) {
        situacao = "DIVERGENTE";
        estagioTab = "PENDENCIAS";
      } else if (lote.status === "PAGO" || (remessa && remessa.status === "homologado")) {
        situacao = "LIQUIDADO";
        estagioTab = "CONCILIACAO";
      } else if (remessa) {
        if (remessa.status === "enviado_manual") {
          situacao = "ENVIADO_MANUAL";
          estagioTab = "AGUARDANDO_RETORNO";
        } else if (remessa.status === "baixado") {
          situacao = "ARQUIVO_BAIXADO";
          estagioTab = "REMESSAS";
        } else {
          situacao = "REMESSA_GERADA";
          estagioTab = "REMESSAS";
        }
      }

      const contaPagadora = resolveContaPagadora(
        lote.empresa_id,
        remessa?.conta_bancaria_id
      );

      const rejeicaoItem = retornos.find((r) => r.status === "rejeitado");
      const divergenteItem = retornos.find((r) => r.status === "divergente");

      const formatDt = (d?: string | null) =>
        d ? new Date(d).toLocaleDateString("pt-BR") : "—";

      obrigacoes.push({
        id: `int-${lote.id}`,
        referencia: `INT-${lote.competencia || "PERIODO"}`,
        origemTipo: "INTERMITENTES",
        loteId: lote.id,
        loteCodigo: `INT-${String(lote.id).slice(0, 8).toUpperCase()}`,
        empresaId: lote.empresa_id,
        empresaNome: emp?.nome || "Empresa Não Identificada",
        isEmpresaTeste: Boolean(emp?.is_teste),
        competencia: lote.competencia || "—",
        favorecidoDescricao: `${lote.total_registros || 1} Intermitente(s) Convocados`,
        favorecidoNomeMascarado: "Remuneração Contrato Intermitente",
        documentoFavorecidoMascarado: "Contas Corrente Diversas",
        dadosBancariosFavorecidoMascarado: "Transferência Bancária TED/PIX",
        quantidadeFavorecidos: Number(lote.total_registros || 1),
        valorTotal: Number(lote.valor_total || 0),
        valorEsperado: Number(lote.valor_total || 0),
        valorRetornado: divergenteItem?.valor_retornado ? Number(divergenteItem.valor_retornado) : undefined,
        diferencaValor: divergenteItem?.valor_retornado ? Number(lote.valor_total || 0) - Number(divergenteItem.valor_retornado) : undefined,
        contaPagadora,
        situacao,
        estagioTab,
        remessaId: remessa?.id,
        remessaNumero: remessa ? `REM-${String(remessa.sequencial_arquivo).padStart(6, "0")}` : undefined,
        remessaNsa: remessa?.sequencial_arquivo,
        remessaHash: remessa?.hash_arquivo,
        remessaDataGeracao: remessa?.data_geracao,
        remessaDataDownload: remessa?.status === "baixado" || remessa?.status === "enviado_manual" ? remessa?.updated_at : undefined,
        remessaDataEnvio: remessa?.data_envio,
        remessaNomeArquivo: remessa?.nome_arquivo,
        remessaQtdRegistros: remessa?.total_registros,
        observacaoEnvio: remessa?.observacoes || undefined,
        motivoRejeicaoCodigo: rejeicaoItem?.codigo_ocorrencia,
        motivoRejeicaoDescricao: rejeicaoItem?.descricao_ocorrencia,
        impactoRejeicao: rejeicaoItem ? "Intermitente com pagamento retido por dado inválido." : undefined,
        acaoRejeicaoRecomendada: rejeicaoItem ? "Conferir conta e CPF no cadastro do intermitente." : undefined,
        preValidacao: {
          contaValida: Boolean(contaPagadora.ativo && contaPagadora.permiteCnab),
          dadosObrigatorios: true,
          favorecidosAptos: true,
          valorConsolidado: Number(lote.valor_total || 0) > 0,
          inconsistencias: [],
        },
        timeline: [
          {
            etapa: "Aprovação Financeira",
            dataHora: formatDt(lote.created_at),
            responsavel: "Financeiro / Convocação",
            descricao: "Lote de intermitentes aprovado para remessa.",
            status: "concluido",
          },
          ...(remessa
            ? [
                {
                  etapa: "Geração CNAB",
                  dataHora: formatDt(remessa.data_geracao),
                  responsavel: "Operador Financeiro",
                  descricao: `Arquivo gerado: ${remessa.nome_arquivo}`,
                  status: "concluido" as const,
                },
              ]
            : []),
          ...(remessa?.data_envio
            ? [
                {
                  etapa: "Transmissão",
                  dataHora: formatDt(remessa.data_envio),
                  responsavel: "Operador Financeiro",
                  descricao: "Remessa transmitida externamente.",
                  status: "concluido" as const,
                },
              ]
            : []),
          ...(situacao === "LIQUIDADO" || situacao === "CONCILIADO"
            ? [
                {
                  etapa: "Liquidação",
                  dataHora: formatDt(lote.updated_at),
                  responsavel: "Retorno Bancário",
                  descricao: "Pagamentos liquidados com sucesso.",
                  status: "concluido" as const,
                },
              ]
            : []),
        ],
      });
    });

    return obrigacoes;
  },
};
