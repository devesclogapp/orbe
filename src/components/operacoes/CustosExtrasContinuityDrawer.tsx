import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  GitBranch,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

import { useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── 5 Estágios Canônicos Apresentados com Linguagem de Negócio ─────────────────
export const CUSTOS_EXTRAS_STAGES = [
  {
    id: "lancamento",
    key: "RECEBIDO",
    label: "Recebido",
    responsible: "Encarregado",
    description: "Custo extra registrado e capturado pelo sistema.",
  },
  {
    id: "validacao_operacional",
    key: "EM_VALIDACAO",
    label: "Em validação",
    responsible: "Operação / ADM",
    description: "Análise técnica operacional e conferência de dados.",
  },
  {
    id: "financeiro",
    key: "APROVADO_OPERACAO",
    label: "Aprovado",
    responsible: "Gestor Operacional",
    description: "Despesa aprovada operacionalmente para pagamento.",
  },
  {
    id: "centro_custo",
    key: "ENVIADO_FINANCEIRO",
    label: "A pagar",
    responsible: "Financeiro",
    description: "Disponível na Central de Pagamentos para liquidação.",
  },
  {
    id: "concluido",
    key: "FINALIZADO",
    label: "Pago",
    responsible: "Financeiro",
    description: "Despesa liquidada e fluxo operacional concluído.",
  },
] as const;

export const CustosExtrasContinuityDrawer: React.FC = () => {
  const { isOpen, payload, closePipeline } = useOperationalPipeline();
  const { role } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePipeline();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closePipeline]);

  const context = payload?.context;
  const rawSteps = payload?.steps ?? [];
  const completedStage = payload?.completedStage;

  // Resolução segura do índice atual
  const { currentStageIndex, isFlowDone, isDevolved } = useMemo(() => {
    if (!payload) return { currentStageIndex: 0, isFlowDone: false, isDevolved: false };

    const devolvido = rawSteps.some((s) => s.status === "devolved");
    const concluido =
      rawSteps.every((s) => s.status === "done") ||
      (rawSteps[rawSteps.length - 1]?.status === "done" &&
        rawSteps[rawSteps.length - 1]?.id === "concluido");

    let idx = 0;
    const activeStep = rawSteps.find((s) => s.status === "current");
    if (activeStep) {
      const foundIdx = CUSTOS_EXTRAS_STAGES.findIndex((st) => st.id === activeStep.id);
      if (foundIdx !== -1) idx = foundIdx;
    } else if (concluido) {
      idx = 4; // Pago
    }

    return {
      currentStageIndex: idx,
      isFlowDone: concluido,
      isDevolved: devolvido,
    };
  }, [payload, rawSteps]);

  // Detecção contextual da tela atual: usuário já está em Pagamentos?
  const isAlreadyAtPagamentos = useMemo(() => {
    return (
      location.pathname.startsWith("/financeiro") &&
      (location.search.includes("custos-extras") || location.search.includes("origem=CUSTOS_EXTRAS"))
    );
  }, [location.pathname, location.search]);

  // Regra RBAC: Encarregado não é ejetado para rotas administrativas ou financeiras
  const isEncarregado = role === "encarregado";
  const rawNextAction = payload?.nextAction;
  const nextAction = useMemo(() => {
    if (!rawNextAction) return undefined;
    if (isEncarregado && (!rawNextAction.route || !rawNextAction.route.startsWith("/producao"))) {
      return undefined;
    }
    // Quando já estamos na visão contextual de Pagamentos e o estágio é "A pagar" (ou aponta para pagamentos):
    // Em vez de "Continuar para Pagamentos ->", exibe "Registrar pagamento", que fecha o drawer e mantém o usuário na tela atual
    if (isAlreadyAtPagamentos && (currentStageIndex === 3 || rawNextAction.route?.includes("/financeiro"))) {
      return {
        label: "Registrar pagamento",
        description: "Você já está na visão de Pagamentos. Prossiga com o pagamento do item nesta tela.",
        route: "", // Sem redirecionamento: fecha o drawer e permanece no contexto
        actionPayload: { registroId: context?.registroId || rawNextAction?.actionPayload?.registroId },
      };
    }
    return rawNextAction;
  }, [rawNextAction, isEncarregado, isAlreadyAtPagamentos, currentStageIndex, context?.registroId]);

  // Derivação contextual do banner de resultado ("O que aconteceu")
  const resultSummary = useMemo(() => {
    if (isFlowDone) {
      return {
        icon: CheckCircle2,
        title: "Despesa liquidada e finalizada no pipeline financeiro.",
        description: "O pagamento foi concluído e o ciclo deste custo extra está encerrado.",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      };
    }
    if (isDevolved) {
      return {
        icon: Zap,
        title: "Despesa devolvida para correção",
        description: "O lançamento retornou à etapa anterior para ajustes operacionais.",
        badgeClass: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800",
      };
    }
    switch (currentStageIndex) {
      case 3:
        return {
          icon: Sparkles,
          title: "Despesa liberada. Pagamento pendente.",
          description: "Disponível na Central de Pagamentos para liquidação.",
          badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
        };
      case 2:
        return {
          icon: CheckCircle2,
          title: "Despesa aprovada. Aguardando liberação para pagamento.",
          description: "Despesa aprovada operacionalmente para pagamento.",
          badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
        };
      case 1:
        return {
          icon: ArrowRight,
          title: "Despesa em validação operacional.",
          description: "Análise técnica e conferência de dados em andamento.",
          badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
        };
      default:
        return {
          icon: Check,
          title: "Lançamento recebido. Aguardando encaminhamento para validação.",
          description: "A etapa operacional inicial do lançamento foi concluída.",
          badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
        };
    }
  }, [currentStageIndex, isDevolved, isFlowDone]);

  // CTA direciona sem executar transição no backend
  const handleCtaClick = () => {
    closePipeline();
    if (nextAction?.route) {
      navigate(nextAction.route);
    } else {
      const registroId = (nextAction as any)?.actionPayload?.registroId || context?.registroId;
      if (registroId) {
        window.dispatchEvent(
          new CustomEvent("orbe:continuar-pagamento-custo-extra", {
            detail: { registroId },
          })
        );
      }
    }
  };

  if (!isOpen || !payload || payload.context?.fluxo !== "Custos Extras") {
    return null;
  }

  const ResultIcon = resultSummary.icon;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      {/* Overlay Backdrop suave */}
      <div
        onClick={closePipeline}
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
        aria-hidden="true"
      />

      {/* Drawer Container que desliza da DIREITA para a ESQUERDA */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Status do Custo Extra"
        className={cn(
          "relative z-[210] flex h-full w-full flex-col bg-card shadow-2xl border-l border-border",
          "sm:max-w-[480px] lg:max-w-[500px]",
          "animate-in slide-in-from-right duration-300 ease-out"
        )}
      >
        {/* Header do Drawer */}
        <header className="flex items-start justify-between border-b border-border/80 px-6 py-5 bg-muted/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <GitBranch className="h-4 w-4" />
              </span>
              <h2 className="font-display text-base font-bold tracking-tight text-foreground">
                Status do Custo Extra
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Acompanhe o fluxo de aprovação e pagamento da despesa.
            </p>

            {/* Metadados de Contexto */}
            {context && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1 font-medium bg-background px-2 py-0.5 rounded-md border border-border">
                  <Calendar className="h-3 w-3 text-muted-foreground/70" />
                  {context.competencia}
                </span>
                <span className="inline-flex items-center gap-1 font-medium bg-background px-2 py-0.5 rounded-md border border-border">
                  <Building2 className="h-3 w-3 text-muted-foreground/70" />
                  <span className="max-w-[140px] truncate">{context.empresa}</span>
                </span>
                <Badge variant="outline" className="text-[10px] font-semibold bg-primary/5 text-primary border-primary/20">
                  Custos Extras
                </Badge>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={closePipeline}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
            aria-label="Fechar drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Corpo Scrollável */}
        <div className="flex-1 overflow-y-auto px-6 py-6 pb-8 space-y-6">
          {/* 1. RESUMO DO RESULTADO (O QUE ACONTECEU) */}
          <section className={cn("rounded-xl border p-4 transition-all shadow-xs", resultSummary.badgeClass)}>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-black/40 shadow-xs">
                <ResultIcon className="h-4 w-4 text-inherit" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-80 mb-0.5">
                  Resumo da Ação
                </div>
                <div className="text-sm font-bold leading-snug">
                  {resultSummary.title}
                </div>
                <p className="mt-1 text-xs opacity-90 leading-relaxed">
                  {resultSummary.description}
                </p>
              </div>
            </div>
          </section>

          {/* 2. LINHA DO TEMPO DO FLUXO COM INDICAÇÃO EXPLÍCITA "VOCÊ ESTÁ AQUI" */}
          <section className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between pb-1 border-b border-border/60">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Fluxo Operacional
              </span>
              <span className="text-[10px] text-muted-foreground">
                5 etapas
              </span>
            </div>

            <div className="space-y-0 pt-1">
              {CUSTOS_EXTRAS_STAGES.map((stage, idx) => {
                const isStepDone = isFlowDone || idx < currentStageIndex;
                const isStepCurrent = !isFlowDone && idx === currentStageIndex;
                const isStepPending = !isFlowDone && idx > currentStageIndex;
                const isLast = idx === CUSTOS_EXTRAS_STAGES.length - 1;

                return (
                  <div key={stage.id} className="flex gap-3 relative">
                    {/* Coluna Esquerda: Nó do Stepper + Linha Conectora */}
                    <div className="flex flex-col items-center">
                      {isStepDone ? (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                          <Check className="h-3.5 w-3.5 stroke-[3]" />
                        </div>
                      ) : isStepCurrent ? (
                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white ring-3 ring-primary/20 ring-offset-1 ring-offset-background shadow-xs">
                          <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-75" />
                          <Circle className="h-2.5 w-2.5 fill-white text-white" />
                        </div>
                      ) : (
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-700 bg-muted/40">
                          <Circle className="h-1.5 w-1.5 fill-slate-300 text-slate-300 dark:fill-slate-600 dark:text-slate-600" />
                        </div>
                      )}

                      {!isLast && (
                        <div
                          className={cn(
                            "w-0.5 my-1 flex-1 min-h-[30px]",
                            isStepDone ? "bg-emerald-400/80" : "bg-border/70"
                          )}
                        />
                      )}
                    </div>

                    {/* Coluna Direita: Conteúdo da Etapa com Destaque Forte na Atual */}
                    <div
                      className={cn(
                        "flex-1 pb-4 min-w-0 transition-all p-3 -mt-1 rounded-lg",
                        isStepCurrent && "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary border-y border-r border-border/80 shadow-xs rounded-r-lg",
                        isLast && "pb-1"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-xs",
                              isStepDone && "font-semibold text-emerald-700 dark:text-emerald-400",
                              isStepCurrent && "font-bold text-foreground text-sm",
                              isStepPending && "font-medium text-muted-foreground/70"
                            )}
                          >
                            {stage.label}
                          </span>

                          {/* TAGS EXPLÍCITAS DE ESTADO */}
                          {isStepDone && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                            >
                              ✓ Concluído
                            </Badge>
                          )}

                          {isStepCurrent && (
                            <Badge
                              className="text-[10px] font-bold uppercase tracking-tight h-5 px-2 bg-primary text-primary-foreground shadow-xs animate-pulse"
                            >
                              ● Você está aqui
                            </Badge>
                          )}

                          {isStepPending && (
                            <Badge
                              variant="outline"
                              className="text-[10px] font-medium h-4 px-1.5 bg-muted/80 text-muted-foreground border-border"
                            >
                              Pendente
                            </Badge>
                          )}
                        </div>

                        <span className="text-[10px] text-muted-foreground font-medium">
                          {stage.responsible}
                        </span>
                      </div>

                      <p
                        className={cn(
                          "mt-1 text-[11px] leading-relaxed",
                          isStepCurrent ? "text-foreground/90 font-medium" : "text-muted-foreground/70"
                        )}
                      >
                        {stage.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 3. PRÓXIMA AÇÃO RECOMENDADA */}
          {!isFlowDone && nextAction ? (
            <section className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-xs">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary mb-0.5">
                    Próxima Ação Recomendada
                  </div>
                  <div className="text-xs font-semibold text-foreground leading-relaxed">
                    {nextAction.description}
                  </div>
                </div>
              </div>

              {/* Botão CTA Primário Contextual */}
              <Button
                onClick={handleCtaClick}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 justify-center gap-1.5 shadow-sm transition-all"
              >
                <span>{nextAction.label}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </section>
          ) : isFlowDone ? (
            <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Fluxo concluído. Despesa paga.</span>
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Não há pendências adicionais para este lançamento.
              </p>
            </section>
          ) : null}
        </div>

        {/* Footer com Opção Voluntária "Continuar nesta tela" */}
        <footer className="border-t border-border/80 px-6 py-5 bg-muted/25 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={closePipeline}
            className="w-full sm:w-auto text-xs font-medium text-muted-foreground hover:text-foreground hover:underline transition-colors py-2 px-3 text-center rounded-md hover:bg-muted/50"
          >
            Continuar nesta tela
          </button>

          {isFlowDone && (
            <Button
              variant="outline"
              size="sm"
              onClick={closePipeline}
              className="w-full sm:w-auto text-xs h-8 font-medium"
            >
              Concluir
            </Button>
          )}
        </footer>
      </aside>
    </div>
  );
};
