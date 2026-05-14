import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTenant } from "@/contexts/TenantContext";
import { supabase } from "@/lib/supabase";
import { BHEventoService } from "@/services/v4.service";

export type OperationalTone = "green" | "yellow" | "red" | "blue" | "gray";

export type OperationalDetail = {
  id: string;
  title: string;
  subtitle: string;
  detail: string;
  route: string;
  tone?: OperationalTone;
  actionLabel?: string;
};

export type OperationalPulseItem = {
  count: number;
  tone: OperationalTone;
  label: string;
  hint: string;
  details: OperationalDetail[];
};

type OperationalPulseMap = Record<string, OperationalPulseItem>;

type OperationalStage = {
  count: number;
  tone: OperationalTone;
};

type OperationalPulseData = {
  items: OperationalPulseMap;
  stages: {
    entradas: OperationalStage;
    rh: OperationalStage;
    financeiro: OperationalStage;
  };
  totalAttention: number;
};

const severityRank: Record<OperationalTone, number> = {
  red: 5,
  yellow: 4,
  blue: 3,
  green: 2,
  gray: 1,
};

const emptyItem = (): OperationalPulseItem => ({
  count: 0,
  tone: "gray",
  label: "Sem movimento",
  hint: "Nenhuma pendencia no momento",
  details: [],
});

const safeCount = async (
  table: string,
  apply?: (query: any) => any,
  options?: { tenantId?: string | null; skipTenant?: boolean },
) => {
  try {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    if (options?.tenantId && !options.skipTenant) {
      query = query.eq("tenant_id", options.tenantId);
    }
    if (apply) {
      query = apply(query);
    }
    const { count, error } = await query;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
};

const safeSelect = async (
  table: string,
  select: string,
  apply?: (query: any) => any,
  options?: { tenantId?: string | null; skipTenant?: boolean },
) => {
  try {
    let query = supabase.from(table).select(select);
    if (options?.tenantId && !options.skipTenant) {
      query = query.eq("tenant_id", options.tenantId);
    }
    if (apply) {
      query = apply(query);
    }
    const { data, error } = await query;
    if (error) return [];
    return data ?? [];
  } catch {
    return [];
  }
};

const createPulse = (params: {
  critical?: number;
  warning?: number;
  waiting?: number;
  healthy?: number;
  criticalLabel?: string;
  warningLabel?: string;
  waitingLabel?: string;
  healthyLabel?: string;
  grayLabel?: string;
  hint?: string;
  details?: OperationalDetail[];
}): OperationalPulseItem => {
  const critical = params.critical ?? 0;
  const warning = params.warning ?? 0;
  const waiting = params.waiting ?? 0;
  const healthy = params.healthy ?? 0;

  if (critical > 0) {
    return {
      count: critical,
      tone: "red",
      label: params.criticalLabel ?? "Critico",
      hint: params.hint ?? "Acao imediata necessaria",
      details: params.details ?? [],
    };
  }

  if (warning > 0) {
    return {
      count: warning,
      tone: "yellow",
      label: params.warningLabel ?? "Atencao",
      hint: params.hint ?? "Pendencias em acompanhamento",
      details: params.details ?? [],
    };
  }

  if (waiting > 0) {
    return {
      count: waiting,
      tone: "blue",
      label: params.waitingLabel ?? "Aguardando acao",
      hint: params.hint ?? "Fluxo aguardando proxima etapa",
      details: params.details ?? [],
    };
  }

  if (healthy > 0) {
    return {
      count: 0,
      tone: "green",
      label: params.healthyLabel ?? "Saudavel",
      hint: params.hint ?? "Fluxo processado",
      details: params.details ?? [],
    };
  }

  return {
    count: 0,
    tone: "gray",
    label: params.grayLabel ?? "Sem movimento",
    hint: params.hint ?? "Sem pendencias agora",
    details: params.details ?? [],
  };
};

const buildStage = (keys: string[], items: OperationalPulseMap): OperationalStage => {
  const related = keys.map((key) => items[key]).filter(Boolean);
  if (related.length === 0) {
    return { count: 0, tone: "gray" };
  }

  const top = [...related].sort((a, b) => severityRank[b.tone] - severityRank[a.tone])[0];
  const count = related.reduce((acc, item) => acc + item.count, 0);
  return { count, tone: top.tone };
};

const compactMinutes = (mins: number) => {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = mins < 0 ? "-" : "+";
  return `${sign}${h}h${String(m).padStart(2, "0")}`;
};

export const useOperationalPulse = () => {
  const { tenantId } = useTenant();

  const query = useQuery<OperationalPulseData>({
    queryKey: ["operational-pulse", tenantId],
    enabled: Boolean(tenantId),
    staleTime: 1000 * 60 * 2,
    queryFn: async () => {
      const [
        operacoesPendentes,
        operacoesComAlerta,
        pontosPendentes,
        pontosInconsistentes,
        diaristasRh,
        diaristasFinanceiro,
        custosPendentes,
        custosAtrasados,
        servicosPendentes,
        servicosAlertas,
        cadastrosPendentes,
        processamentoPendencias,
        processamentoInconsistencias,
        ciclosRhPendentes,
        financeiroPendencias,
        remessasPendentes,
        automacaoCritica,
        automacaoAtencao,
        pontosDetalhe,
        financeiroDetalhe,
        ciclosDetalhe,
      ] = await Promise.all([
        safeCount("operacoes", (q) => q.eq("status", "pendente"), { tenantId }),
        safeCount("operacoes", (q) => q.in("status", ["bloqueado", "com_alerta", "inconsistente"]), { tenantId }),
        safeCount("registros_ponto", (q) => q.eq("status_processamento", "pendente"), { tenantId }),
        safeCount("registros_ponto", (q) => q.eq("status_processamento", "inconsistente"), { tenantId }),
        safeCount("diaristas_lotes_fechamento", (q) => q.eq("status", "AGUARDANDO_VALIDACAO_RH"), { tenantId }),
        safeCount("diaristas_lotes_fechamento", (q) => q.eq("status", "AGUARDANDO_FINANCEIRO"), { tenantId }),
        safeCount("custos_extras_operacionais", (q) => q.eq("status_pagamento", "PENDENTE"), { tenantId }),
        safeCount("custos_extras_operacionais", (q) => q.eq("status_pagamento", "ATRASADO"), { tenantId }),
        safeCount("operacoes_producao", (q) => q.in("status", ["pendente", "aguardando_validacao"]), { tenantId }),
        safeCount("operacoes_producao", (q) => q.in("status", ["com_alerta", "bloqueado"]), { tenantId }),
        safeCount("colaboradores", (q) => q.or("status_cadastro.eq.pendente_complemento,cadastro_provisorio.eq.true"), { tenantId }),
        safeCount("registros_ponto", (q) => q.eq("status_processamento", "pendente"), { tenantId }),
        safeCount("processamento_rh_inconsistencias", (q) => q.eq("resolvida", false), { tenantId }),
        safeCount("ciclos_operacionais", (q) => q.eq("status", "fechado").eq("status_rh", "pendente"), { tenantId }),
        safeCount("financeiro_consolidados_cliente", (q) => q.neq("status", "aprovado"), { tenantId, skipTenant: true }),
        safeCount("ciclos_operacionais", (q) => q.or("status_financeiro.eq.validado_financeiro,status_remessa.eq.nao_gerada,status_remessa.eq.pronta"), { tenantId }),
        safeCount("ciclos_operacionais", (q) => q.in("status_automacao", ["bloqueado_automacao", "inconsistencias_detectadas"]), { tenantId }),
        safeCount("ciclos_operacionais", (q) => q.eq("status_automacao", "aguardando_validacao"), { tenantId }),
        safeSelect(
          "registros_ponto",
          "id,nome_colaborador,matricula_colaborador,status_processamento,minutos_atraso,minutos_extra",
          (q) => q.in("status_processamento", ["pendente", "inconsistente"]).order("created_at", { ascending: false }).limit(6),
          { tenantId },
        ),
        safeSelect(
          "financeiro_consolidados_cliente",
          "id,status,valor_total,clientes(nome)",
          (q) => q.neq("status", "aprovado").order("valor_total", { ascending: false }).limit(6),
          { tenantId, skipTenant: true },
        ),
        safeSelect(
          "ciclos_operacionais",
          "id,competencia,semana_operacional,status_rh,status_financeiro,status_remessa,total_inconsistencias",
          (q) =>
            q
              .or("status_rh.eq.pendente,status_financeiro.eq.pendente,status_remessa.eq.nao_gerada,status_remessa.eq.pronta")
              .order("updated_at", { ascending: false })
              .limit(6),
          { tenantId },
        ),
      ]);

      let bancoHorasCritico = 0;
      let bancoHorasAtencao = 0;
      let bancoHorasRh = 0;
      let bhDetails: OperationalDetail[] = [];

      try {
        const saldos = await BHEventoService.getSaldosGerais({ includeWithoutMovement: false });
        bancoHorasCritico = saldos.filter((item: any) => item.status === "debito_critico").length;
        bancoHorasAtencao = saldos.filter((item: any) => ["horas_a_vencer", "debito_leve", "excesso_banco"].includes(item.status)).length;
        bancoHorasRh = saldos.filter((item: any) => item.status === "aguardando_rh").length;
        bhDetails = saldos
          .filter((item: any) => ["debito_critico", "horas_a_vencer", "aguardando_rh", "debito_leve"].includes(item.status))
          .sort((a: any, b: any) => b.status_priority - a.status_priority)
          .slice(0, 6)
          .map((item: any) => ({
            id: item.id,
            title: item.nome,
            subtitle: item.status_label,
            detail: item.saldo_formatado,
            route: `/banco-horas/extrato/${item.id}`,
            tone:
              item.status === "debito_critico"
                ? "red"
                : item.status === "aguardando_rh"
                  ? "blue"
                  : "yellow",
            actionLabel: "Abrir extrato",
          }));
      } catch {}

      const processamentoDetails: OperationalDetail[] = pontosDetalhe
        .map((item: any) => {
          const atraso = Math.abs(Number(item.minutos_atraso || 0));
          const extra = Number(item.minutos_extra || 0);
          const inconsistente = item.status_processamento === "inconsistente";
          const detail = inconsistente
            ? atraso > 0
              ? `Atraso ${compactMinutes(-atraso)}`
              : "Registro exige revisao manual"
            : extra > 0
              ? `Extra ${compactMinutes(extra)}`
              : "";

          return {
            id: item.id,
            title: item.nome_colaborador || "Colaborador sem nome",
            subtitle: inconsistente ? "Critico para processamento" : "Aguardando acao RH",
            detail,
            route: "/banco-horas/processamento",
            tone: inconsistente ? "red" : "blue",
            actionLabel: "Abrir processamento",
          };
        })
        .filter((item) => item.detail || item.tone === "red");

      const financeiroDetailsMapped: OperationalDetail[] = financeiroDetalhe
        .map((item: any) => {
          const valor = Number(item.valor_total || 0);
          const aguardandoAprovacao = item.status !== "aprovado";

          return {
            id: item.id,
            title: item.clientes?.nome || "Cliente sem nome",
            subtitle: aguardandoAprovacao ? "Aguardando aprovacao" : "Aprovado",
            detail: valor > 0
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
              : "Consolidado financeiro pendente",
            route: `/financeiro/faturamento/${item.id}`,
            tone: aguardandoAprovacao ? "yellow" : "green",
            actionLabel: "Abrir memoria",
          };
        })
        .filter((item) => item.subtitle !== "Aprovado");

      const fechamentoDetails: OperationalDetail[] = ciclosDetalhe.map((item: any) => {
        const inconsistencias = Number(item.total_inconsistencias || 0);
        const aguardandoRh = item.status_rh === "pendente";
        const aguardandoFinanceiro = item.status_financeiro === "pendente";
        const aguardandoRemessa = item.status_remessa === "nao_gerada" || item.status_remessa === "pronta";

        let subtitle = "Saudavel";
        let detail = "";
        let tone: OperationalTone = "green";

        if (aguardandoRh) {
          subtitle = "Aguardando RH";
          detail = inconsistencias > 0 ? `${inconsistencias} inconsistencias abertas` : "Validacao do RH pendente";
          tone = "yellow";
        } else if (aguardandoFinanceiro) {
          subtitle = "Aguardando financeiro";
          detail = inconsistencias > 0 ? `${inconsistencias} inconsistencias abertas` : "Liberacao financeira pendente";
          tone = "blue";
        } else if (aguardandoRemessa) {
          subtitle = "Aguardando remessa";
          detail = item.status_remessa === "pronta" ? "Remessa pronta para envio" : "Remessa ainda nao gerada";
          tone = item.status_remessa === "pronta" ? "blue" : "yellow";
        } else if (inconsistencias > 0) {
          subtitle = "Com alerta";
          detail = `${inconsistencias} inconsistencias abertas`;
          tone = "red";
        }

        return {
          id: item.id,
          title: `${item.competencia} · Semana ${item.semana_operacional}`,
          subtitle,
          detail,
          route: "/fechamento",
          tone,
          actionLabel: "Abrir fechamento",
        };
      });

      const items: OperationalPulseMap = {
        dashboard: createPulse({
          critical: operacoesComAlerta + pontosInconsistentes + custosAtrasados + bancoHorasCritico + automacaoCritica,
          warning: operacoesPendentes + pontosPendentes + diaristasRh + custosPendentes + servicosPendentes + financeiroPendencias,
          waiting: diaristasFinanceiro + remessasPendentes + ciclosRhPendentes,
          healthy: 1,
          hint: "Resumo operacional",
          details: [...bhDetails.slice(0, 2), ...processamentoDetails.slice(0, 2), ...financeiroDetailsMapped.slice(0, 2)],
        }),
        operacoes_recebidas: createPulse({
          critical: operacoesComAlerta,
          waiting: operacoesPendentes,
          healthy: operacoesPendentes + operacoesComAlerta === 0 ? 1 : 0,
          criticalLabel: "Critico",
          waitingLabel: "Recebidas",
          healthyLabel: "Processadas",
          hint: "Operacoes aguardando tratamento",
          details: [],
        }),
        pontos_recebidos: createPulse({
          critical: pontosInconsistentes,
          waiting: pontosPendentes,
          healthy: pontosPendentes + pontosInconsistentes === 0 ? 1 : 0,
          criticalLabel: "Inconsist.",
          waitingLabel: "Aguardando RH",
          healthyLabel: "Processados",
          hint: "Registros aguardando processamento RH",
          details: processamentoDetails,
        }),
        diaristas_recebidos: createPulse({
          warning: diaristasRh,
          waiting: diaristasFinanceiro,
          healthy: diaristasRh + diaristasFinanceiro === 0 ? 1 : 0,
          warningLabel: "Pendente RH",
          waitingLabel: "Aguard. financeiro",
          healthyLabel: "Encaminhados",
          hint: "Lotes de diaristas em fluxo",
          details: fechamentoDetails.filter((item) => item.subtitle === "Aguardando RH" || item.subtitle === "Aguardando financeiro"),
        }),
        custos_extras: createPulse({
          critical: custosAtrasados,
          waiting: custosPendentes,
          healthy: custosPendentes + custosAtrasados === 0 ? 1 : 0,
          criticalLabel: "Atrasado",
          waitingLabel: "Pend. pgto",
          healthyLabel: "Regular",
          hint: "Custos aguardando reflexo financeiro",
          details: [],
        }),
        servicos_extras: createPulse({
          critical: servicosAlertas,
          waiting: servicosPendentes,
          healthy: servicosPendentes + servicosAlertas === 0 ? 1 : 0,
          criticalLabel: "Com alerta",
          waitingLabel: "Pend. validacao",
          healthyLabel: "Processados",
          hint: "Servicos extras em tratamento",
          details: [],
        }),
        central_de_cadastros: createPulse({
          warning: cadastrosPendentes,
          healthy: cadastrosPendentes === 0 ? 1 : 0,
          warningLabel: "Incompletos",
          healthyLabel: "Cadastros ok",
          hint: "Cadastros que bloqueiam o fluxo",
          details: [],
        }),
        processamento_rh: createPulse({
          critical: processamentoInconsistencias,
          waiting: processamentoPendencias,
          healthy: processamentoPendencias + processamentoInconsistencias === 0 ? 1 : 0,
          criticalLabel: "Inconsist.",
          waitingLabel: "Aguardando RH",
          healthyLabel: "Processado",
          hint: "Filas reais de processamento RH",
          details: processamentoDetails,
        }),
        banco_de_horas: createPulse({
          critical: bancoHorasCritico,
          warning: bancoHorasAtencao,
          waiting: bancoHorasRh,
          healthy: bancoHorasCritico + bancoHorasAtencao + bancoHorasRh === 0 ? 1 : 0,
          criticalLabel: "Critico",
          warningLabel: "Atencao",
          waitingLabel: "Aguardando RH",
          healthyLabel: "Equilibrado",
          hint: "Saldos com risco ou acao pendente",
          details: bhDetails,
        }),
        regras_de_banco: emptyItem(),
        fechamento_mensal: createPulse({
          warning: ciclosRhPendentes,
          waiting: remessasPendentes,
          healthy: ciclosRhPendentes + remessasPendentes === 0 ? 1 : 0,
          warningLabel: "Aguardando RH",
          waitingLabel: "Em transicao",
          healthyLabel: "Fechado",
          hint: "Ciclos aguardando validacao ou envio",
          details: fechamentoDetails,
        }),
        central_financeira: createPulse({
          warning: financeiroPendencias,
          waiting: remessasPendentes,
          healthy: financeiroPendencias + remessasPendentes === 0 ? 1 : 0,
          warningLabel: "Pendencias",
          waitingLabel: "Fila bancaria",
          healthyLabel: "Saudavel",
          hint: "Itens com impacto financeiro imediato",
          details: [...financeiroDetailsMapped, ...fechamentoDetails.filter((item) => item.subtitle === "Aguardando financeiro" || item.subtitle === "Aguardando remessa")].slice(0, 6),
        }),
        faturamento: createPulse({
          warning: financeiroPendencias,
          healthy: financeiroPendencias === 0 ? 1 : 0,
          warningLabel: "Aguard. aprovacao",
          healthyLabel: "Aprovado",
          hint: "Clientes aguardando aprovacao",
          details: financeiroDetailsMapped,
        }),
        pagamentos_remessas: createPulse({
          waiting: remessasPendentes + diaristasFinanceiro,
          healthy: remessasPendentes + diaristasFinanceiro === 0 ? 1 : 0,
          waitingLabel: "Pronto para envio",
          healthyLabel: "Sem fila",
          hint: "Pagamentos, remessas e lotes prontos",
          details: fechamentoDetails.filter((item) => item.subtitle === "Aguardando financeiro" || item.subtitle === "Aguardando remessa"),
        }),
        regras_de_calculo: emptyItem(),
        central_de_relatorios: emptyItem(),
        governanca: createPulse({
          critical: automacaoCritica,
          waiting: automacaoAtencao,
          healthy: automacaoCritica + automacaoAtencao === 0 ? 1 : 0,
          criticalLabel: "Bloqueios",
          waitingLabel: "Em validacao",
          healthyLabel: "Controlado",
          hint: "Eventos sistemicos e bloqueios",
          details: [],
        }),
        automacao_operacional: createPulse({
          critical: automacaoCritica,
          waiting: automacaoAtencao,
          healthy: automacaoCritica + automacaoAtencao === 0 ? 1 : 0,
          criticalLabel: "Bloqueada",
          waitingLabel: "Em validacao",
          healthyLabel: "Rodando",
          hint: "Motor operacional e alertas",
          details: [],
        }),
        regras_operacionais: emptyItem(),
      };

      const stages = {
        entradas: buildStage(["operacoes_recebidas", "pontos_recebidos", "diaristas_recebidos", "custos_extras", "servicos_extras"], items),
        rh: buildStage(["central_de_cadastros", "processamento_rh", "banco_de_horas", "fechamento_mensal"], items),
        financeiro: buildStage(["central_financeira", "faturamento", "pagamentos_remessas"], items),
      };

      return {
        items,
        stages,
        totalAttention: stages.entradas.count + stages.rh.count + stages.financeiro.count,
      };
    },
  });

  return useMemo(
    () => ({
      data: query.data,
      items: query.data?.items ?? {},
      stages: query.data?.stages ?? {
        entradas: { count: 0, tone: "gray" },
        rh: { count: 0, tone: "gray" },
        financeiro: { count: 0, tone: "gray" },
      },
      totalAttention: query.data?.totalAttention ?? 0,
      isLoading: query.isLoading,
      refetch: query.refetch,
    }),
    [query.data, query.isLoading, query.refetch],
  );
};
