import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { CalendarCheck, Lock, Unlock, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { CicloOperacionalService, CicloOperacional } from "@/services/operationalEngine/CicloOperacionalService";
import { toast } from "sonner";
import { buildOperationalFailurePipeline, buildOperationalStagePipeline, buildOperationalStageReviewPipeline, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { buildOperationalPipelineSeenKey, useOperationalPipelineAutoTrigger } from "@/hooks/useOperationalPipelineAutoTrigger";

type CustoExtraResumo = {
  id: string;
  empresa_id: string | null;
  data: string | null;
  status_pagamento: string | null;
};

type ServicoExtraResumo = {
  id: string;
  empresa_id: string | null;
  data: string | null;
  pipeline_status: string | null;
};

type PendingActionState = {
  action: string;
  id: string;
};

const StatusBadge = ({ label, status, type }: { label: string, status?: string | null, type: 'operacional' | 'rh' | 'fin' | 'remessa' | 'automacao' }) => {
  const safeStatus = status || 'pendente';
  let color = "bg-secondary text-secondary-foreground";
  let Icon = Clock;

  if (safeStatus === 'pendente' || safeStatus === 'aberto' || safeStatus === 'processando' || safeStatus === 'nao_gerada' || safeStatus === 'aguardando_validacao') {
    color = "bg-warning-soft text-warning-strong";
  } else if (safeStatus === 'validado_rh' || safeStatus === 'validado_financeiro' || safeStatus === 'fechado' || safeStatus === 'pronta' || safeStatus === 'remetida' || safeStatus === 'pronto_para_fechamento') {
    color = "bg-success-soft text-success-strong";
    Icon = CheckCircle2;
  } else if (safeStatus === 'rejeitado_rh' || safeStatus === 'rejeitado_financeiro' || safeStatus === 'retornada' || safeStatus === 'inconsistencias_detectadas' || safeStatus === 'bloqueado_automacao') {
    color = "bg-destructive-soft text-destructive-strong";
    Icon = XCircle;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</span>
      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium w-fit", color)}>
        <Icon className="h-3 w-3" />
        {safeStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </span>
    </div>
  );
};

const Fechamento = () => {
  const queryClient = useQueryClient();
  const currentMonth = new Date().toISOString().substring(0, 7);
  const { openPipeline } = useOperationalPipeline();
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null);

  const { data: list = [], isLoading } = useQuery<CicloOperacional[]>({
    queryKey: ["ciclos_operacionais", currentMonth],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase.from('profiles').select('tenant_id').eq('user_id', user.id).single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return [];
      return CicloOperacionalService.getCiclosDaCompetencia(tenantId, currentMonth);
    },
  });

  const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");
    return user.id;
  };

  const actionMutation = useMutation({
    mutationFn: async ({ action, id, obs }: { action: string, id: string, obs?: string }) => {
      const userId = await getUserId();
      switch (action) {
        case 'fechar': return CicloOperacionalService.fecharSemana(id, userId);
        case 'reabrir': return CicloOperacionalService.reabrirSemana(id, userId, obs);
        case 'validarRH': return CicloOperacionalService.validarRH(id, userId, obs);
        case 'rejeitarRH': return CicloOperacionalService.rejeitarRH(id, userId, obs || 'Rejeitado pelo RH');
        case 'validarFin': return CicloOperacionalService.validarFinanceiro(id, userId, obs);
        case 'rejeitarFin': return CicloOperacionalService.rejeitarFinanceiro(id, userId, obs || 'Rejeitado pelo Financeiro');
        default: throw new Error("Ação inválida");
      }
    },
    onSuccess: () => {
      toast.success("Ação concluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["ciclos_operacionais"] });
    },
    onError: (err: any, variables) => {
      const stageByAction: Record<string, "fechamento_mensal" | "central_financeira"> = {
        fechar: "fechamento_mensal",
        reabrir: "fechamento_mensal",
        validarRH: "fechamento_mensal",
        rejeitarRH: "fechamento_mensal",
        validarFin: "central_financeira",
        rejeitarFin: "central_financeira",
      };

      openPipeline(
        buildOperationalFailurePipeline({
          competencia: currentMonth,
          empresa: "Operacao",
          currentStage: stageByAction[variables.action] ?? "fechamento_mensal",
          failureStatus: variables.action === "rejeitarRH" || variables.action === "rejeitarFin" ? "devolved" : "blocked",
          failureTitle: "Falha no fluxo de fechamento",
          failureDescription: err.message || "A ação não pôde ser concluída nesta etapa.",
          nextAction: {
            label: "Revisar fechamento",
            description: "Analise os bloqueios operacionais e ajuste a competência antes de tentar novamente.",
            route: "/fechamento",
          },
        }),
      );
      toast.error("Erro na ação", { description: err.message });
    }
  });

  const handleAction = (action: string, id: string, requireObs: boolean = false) => {
    if (requireObs) {
      setPendingAction({ action, id });
      return;
    }

    actionMutation.mutate({ action, id, obs: "" });
  };

  const closePendingActionModal = () => {
    if (actionMutation.isPending) return;
    setPendingAction(null);
  };

  const confirmPendingAction = (obs: string) => {
    if (!pendingAction) return;
    actionMutation.mutate({
      action: pendingAction.action,
      id: pendingAction.id,
      obs,
    });
    setPendingAction(null);
  };

  const { data: custosExtras = [] } = useQuery<CustoExtraResumo[]>({
    queryKey: ["custos_extras_fechamento", currentMonth],
    queryFn: async () => {
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;
      const { data, error } = await supabase
        .from("custos_extras_operacionais")
        .select("id, empresa_id, data, status_pagamento")
        .gte("data", startDate)
        .lte("data", endDate);
      if (error) throw error;
      return (data || []) as CustoExtraResumo[];
    },
  });

  const { data: servicosExtras = [] } = useQuery<ServicoExtraResumo[]>({
    queryKey: ["servicos_extras_fechamento", currentMonth],
    queryFn: async () => {
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;
      const { data, error } = await (supabase as any)
        .from("servicos_extras_operacionais")
        .select("id, empresa_id, data, pipeline_status")
        .gte("data", startDate)
        .lte("data", endDate);
      if (error) {
        // Tabela pode não existir ainda (migration não aplicada) → retorna vazio
        console.warn("servicos_extras_operacionais não disponível:", error.message);
        return [];
      }
      return (data || []) as ServicoExtraResumo[];
    },
  });

  const getCriticalBlockers = (c: CicloOperacional) => {
    const blockers: string[] = [];
    if ((c.total_inconsistencias || 0) > 0) blockers.push("Existem inconsistências críticas no ciclo.");
    if (c.status_automacao !== "pronto_para_fechamento") blockers.push("Motor operacional ainda não liberou o fechamento.");
    if (c.status_rh === "rejeitado_rh") blockers.push("RH rejeitou o ciclo. Ajuste obrigatório antes de avançar.");
    if (c.status_financeiro === "rejeitado_financeiro") blockers.push("Financeiro rejeitou o ciclo. Ajuste obrigatório antes de avançar.");
    return blockers;
  };

  const getCustosPendentesDoCiclo = (c: CicloOperacional) =>
    custosExtras.filter((item) =>
      item.empresa_id === c.empresa_id &&
      Boolean(item.data) &&
      item.data! >= c.data_inicio &&
      item.data! <= c.data_fim &&
      item.status_pagamento !== "RECEBIDO",
    );

  const getServicosPendentesDoCiclo = (c: CicloOperacional) =>
    servicosExtras.filter((item) =>
      item.empresa_id === c.empresa_id &&
      Boolean(item.data) &&
      item.data! >= c.data_inicio &&
      item.data! <= c.data_fim &&
      ["PENDENTE", "EM_VALIDACAO", "DEVOLVIDO"].includes(String(item.pipeline_status || "").toUpperCase()),
    );

  const getFinancialFlowBlockers = (c: CicloOperacional) => {
    const blockers: string[] = [];
    const custosPendentes = getCustosPendentesDoCiclo(c);
    const servicosPendentes = getServicosPendentesDoCiclo(c);

    if (custosPendentes.length > 0) {
      blockers.push(`${custosPendentes.length} custo(s) extra(s) ainda aguardam reflexo financeiro.`);
    }

    if (servicosPendentes.length > 0) {
      blockers.push(`${servicosPendentes.length} serviço(s) extra(s) ainda estão pendentes de validação operacional.`);
    }

    return blockers;
  };

  const competenciaSummary = {
    entradasPendentes: list.filter((c) => c.status !== "fechado" && c.status_automacao !== "pronto_para_fechamento").length,
    rhPendentes: list.filter((c) => c.status === "fechado" && c.status_rh !== "validado_rh").length,
    financeiroPendentes: list.filter((c) => c.status_rh === "validado_rh" && c.status_financeiro !== "validado_financeiro").length,
    bancarioPendentes: list.filter((c) => c.status_financeiro === "validado_financeiro" && c.status_remessa !== "pronta" && c.status_remessa !== "remetida").length,
    fechados: list.filter((c) => c.status_financeiro === "validado_financeiro" && (c.status_remessa === "pronta" || c.status_remessa === "remetida")).length,
  };

  const competenciaTemBloqueiosFinanceiros = list.some((c) => getFinancialFlowBlockers(c).length > 0);

  const fechamentoConcluidoParaFinanceiro =
    list.length > 0 &&
    competenciaSummary.entradasPendentes === 0 &&
    competenciaSummary.rhPendentes === 0 &&
    !competenciaTemBloqueiosFinanceiros &&
    competenciaSummary.financeiroPendentes > 0;

  useOperationalPipelineAutoTrigger({
    enabled: fechamentoConcluidoParaFinanceiro,
    storageKey: buildOperationalPipelineSeenKey({
      etapa: "fechamento_mensal_concluido",
      competencia: currentMonth,
      empresa: "tenant",
    }),
    trigger: fechamentoConcluidoParaFinanceiro
      ? buildOperationalStagePipeline({
        competencia: currentMonth,
        empresa: "Operacao",
        completedStage: "fechamento_mensal",
      })
      : null,
  });

  const fechamentoReviewTrigger = buildOperationalStageReviewPipeline({
    competencia: currentMonth,
    empresa: "Operacao",
    currentStage: "fechamento_mensal",
  });

  return (
    <AppShell
      title="Fechamento Mensal"
      subtitle={`Ciclos Operacionais da Competência ${currentMonth}`}
      pipelineTrigger={fechamentoReviewTrigger}
    >
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <section className="esc-card p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Entradas</p>
                <p className="text-lg font-semibold text-foreground">{competenciaSummary.entradasPendentes}</p>
                <p className="text-xs text-muted-foreground">pendentes de liberação</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">RH</p>
                <p className="text-lg font-semibold text-foreground">{competenciaSummary.rhPendentes}</p>
                <p className="text-xs text-muted-foreground">aguardando aprovação</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Financeiro</p>
                <p className="text-lg font-semibold text-foreground">{competenciaSummary.financeiroPendentes}</p>
                <p className="text-xs text-muted-foreground">aguardando aprovação</p>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Bancário</p>
                <p className="text-lg font-semibold text-foreground">{competenciaSummary.bancarioPendentes}</p>
                <p className="text-xs text-muted-foreground">preparação remessa</p>
              </div>
              <div className="rounded-lg border border-success/30 bg-success-soft/30 px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-success-strong/80">Fechado</p>
                <p className="text-lg font-semibold text-success-strong">{competenciaSummary.fechados}</p>
                <p className="text-xs text-success-strong/80">prontos no fluxo</p>
              </div>
            </div>
          </section>

          {list.map((c) => {
            const criticalBlockers = getCriticalBlockers(c);
            const financialFlowBlockers = getFinancialFlowBlockers(c);

            return (
              <article key={c.id} className="esc-card p-6 flex flex-col gap-5">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <CalendarCheck className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-lg text-foreground">
                        Semana {c.semana_operacional}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(`${c.data_inicio}T12:00:00Z`).toLocaleDateString('pt-BR')} até {new Date(`${c.data_fim}T12:00:00Z`).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <StatusBadge label="Automação" status={c.status_automacao || 'aguardando_validacao'} type="automacao" />
                    <StatusBadge label="Operacional" status={c.status} type="operacional" />
                    <StatusBadge label="RH" status={c.status_rh} type="rh" />
                    <StatusBadge label="Financeiro" status={c.status_financeiro} type="fin" />
                    <StatusBadge label="Remessa" status={c.status_remessa} type="remessa" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-6 py-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Registros</div>
                    <div className="font-display font-semibold text-2xl">{c.total_registros || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Processados</div>
                    <div className="font-display font-semibold text-2xl">{c.total_processados || 0}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Inconsistências</div>
                    <div className={cn("font-display font-semibold text-2xl", (c.total_inconsistencias || 0) > 0 ? "text-destructive" : "text-muted-foreground")}>
                      {c.total_inconsistencias || 0}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Valor Operacional</div>
                    <div className="font-display font-semibold text-2xl text-success">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(c.valor_operacional || 0)}
                    </div>
                  </div>
                </div>

                {criticalBlockers.length > 0 && (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Bloqueios críticos</p>
                    <ul className="mt-2 space-y-1 text-sm text-destructive">
                      {criticalBlockers.map((item, idx) => (
                        <li key={`${c.id}-blocker-${idx}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {financialFlowBlockers.length > 0 && (
                  <div className="rounded-lg border border-warning/30 bg-warning-soft/40 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-warning-strong">Validações do fluxo financeiro</p>
                    <ul className="mt-2 space-y-1 text-sm text-warning-strong">
                      {financialFlowBlockers.map((item, idx) => (
                        <li key={`${c.id}-finance-blocker-${idx}`}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-border bg-muted/30 -mx-6 px-6 pb-2 -mb-2 rounded-b-xl">
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                    {(c.status === "fechado" || c.status === "enviado_financeiro") ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                    {c.status === "fechado" && c.fechado_em ? `Fechado oper. em ${new Date(c.fechado_em).toLocaleDateString('pt-BR')}` : "Aguardando fluxos processuais"}
                  </span>

                  <div className="flex items-center gap-2">
                    {/* Fluxo Botões:
                      Se aberto -> Fechar Período
                      Se fechado -> RH aprovar/rejeitar e Reabrir
                      Se RH Validado -> Fin aprovar/rejeitar
                  */}

                    {c.status !== "fechado" && c.status !== "enviado_financeiro" && (
                      <Button
                        size="sm"
                        disabled={criticalBlockers.length > 0 || actionMutation.isPending}
                        onClick={() => handleAction('fechar', c.id)}
                      >
                        {actionMutation.isPending ? "Processando..." : getCriticalBlockers(c).length > 0 ? "Bloqueado por pendências" : "1. Fechar Operacional"}
                      </Button>
                    )}

                    {c.status === "fechado" && c.status_rh === "pendente" && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => handleAction('reabrir', c.id, true)} disabled={actionMutation.isPending}>Reabrir Operacional</Button>
                        <Button size="sm" variant="destructive" onClick={() => handleAction('rejeitarRH', c.id, true)} disabled={actionMutation.isPending}>Rejeitar (RH)</Button>
                        <Button size="sm" variant="default" onClick={() => handleAction('validarRH', c.id, false)} disabled={actionMutation.isPending}>2. Aprovar RH</Button>
                      </>
                    )}

                    {c.status_rh === "validado_rh" && c.status_financeiro === "pendente" && (
                      <>
                        <Button size="sm" variant="destructive" onClick={() => handleAction('rejeitarFin', c.id, true)} disabled={actionMutation.isPending}>Rejeitar (Fin)</Button>
                        <Button size="sm" variant="default" onClick={() => handleAction('validarFin', c.id, false)} disabled={actionMutation.isPending || financialFlowBlockers.length > 0}>3. Aprovar Financeiro</Button>
                      </>
                    )}

                    {c.status_financeiro === "validado_financeiro" && (
                      <Button size="sm" variant="outline" onClick={() => handleAction('reabrir', c.id, true)} disabled={actionMutation.isPending}>
                        Forçar Reabertura
                      </Button>
                    )}
                  </div>
                </div>

                {c.status_financeiro !== "validado_financeiro" && (
                  <div className="text-xs text-muted-foreground">
                    Fechamento final da competência permanece bloqueado até <strong>aprovação financeira</strong>.
                  </div>
                )}
              </article>
            );
          })}
          {list.length === 0 && (
            <div className="p-12 text-center text-muted-foreground italic esc-card">
              Nenhuma semana processada para a competência selecionada.
            </div>
          )}
        </div>
      )}
      <JustificationModal
        isOpen={!!pendingAction}
        onClose={closePendingActionModal}
        onConfirm={confirmPendingAction}
        isLoading={actionMutation.isPending}
        title="Justificativa obrigatória"
        description="Esta ação altera um ciclo já fechado ou devolvido. Registre a justificativa completa para manter a rastreabilidade operacional e financeira."
      />
    </AppShell>
  );
};

export default Fechamento;
