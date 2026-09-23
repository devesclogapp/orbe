import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  FileText,
  DollarSign,
  AlertTriangle,
  Receipt,
  X,
  Sparkles,
} from "lucide-react";

import { useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ─── 5 Estágios Canônicos Apresentados com Linguagem de Negócio (Receitas) ───────
export const SERVICOS_EXTRAS_STAGES = [
  {
    id: "lancamento",
    key: "RECEBIDO",
    label: "Recebido",
    responsible: "Encarregado / Operação",
    description: "Serviço extra registrado e capturado pelo sistema.",
  },
  {
    id: "validacao_operacional",
    key: "EM_VALIDACAO",
    label: "Em validação",
    responsible: "Operação / ADM",
    description: "Conferência técnica e validação dos dados operacionais.",
  },
  {
    id: "aprovacao",
    key: "APROVADO_OPERACAO",
    label: "Aprovado",
    responsible: "Gestor Operacional",
    description: "Serviço validado e aprovado. Receita gerada no financeiro.",
  },
  {
    id: "faturamento",
    key: "FATURAMENTO",
    label: "A receber / Faturamento",
    responsible: "Financeiro",
    description: "Disponível na Central de Receitas para cobrança e faturamento.",
  },
  {
    id: "concluido",
    key: "CONCLUIDO",
    label: "Recebido",
    responsible: "Financeiro / Tesouraria",
    description: "Receita liquidada e fluxo de serviço extra concluído.",
  },
] as const;

export const ServicosExtrasContinuityDrawer: React.FC = () => {
  const { isOpen, payload, closePipeline } = useOperationalPipeline();
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
  const nextAction = payload?.nextAction;

  // Resolução do índice atual
  const { currentStageIndex, isFlowDone, isDevolved } = useMemo(() => {
    if (!payload) return { currentStageIndex: 2, isFlowDone: false, isDevolved: false };

    const devolvido = rawSteps.some((s) => s.status === "devolved");
    const concluido =
      rawSteps.every((s) => s.status === "done") ||
      (rawSteps[rawSteps.length - 1]?.status === "done" &&
        rawSteps[rawSteps.length - 1]?.id === "concluido");

    let idx = 2; // Default para Aprovações: Aprovado
    const activeStep = rawSteps.find((s) => s.status === "current");
    if (activeStep) {
      const foundIdx = SERVICOS_EXTRAS_STAGES.findIndex((st) => st.id === activeStep.id);
      if (foundIdx !== -1) idx = foundIdx;
    } else if (concluido) {
      idx = 4; // Recebido / Concluído
    }

    return {
      currentStageIndex: idx,
      isFlowDone: concluido,
      isDevolved: devolvido,
    };
  }, [payload, rawSteps]);

  // Modalidade Financeira
  const rawModalidade = String(context?.modalidade_financeira || context?.modalidade || "").trim().toUpperCase();
  const modalidadeInfo = useMemo(() => {
    switch (rawModalidade) {
      case "CAIXA_IMEDIATO":
        return {
          key: "CAIXA_IMEDIATO",
          label: "Caixa Imediato",
          badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
          complement: "Recebimento imediato gerado. O valor está pronto para confirmação no caixa.",
          isValid: true,
        };
      case "DUPLICATA":
        return {
          key: "DUPLICATA",
          label: "Duplicata",
          badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
          complement: "Cobrança avulsa gerada. O título está pronto para emissão e envio.",
          isValid: true,
        };
      case "FATURAMENTO_MENSAL":
        return {
          key: "FATURAMENTO_MENSAL",
          label: "Faturamento Mensal",
          badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
          complement: "Serviço integrado à fatura mensal da competência aguardando fechamento.",
          isValid: true,
        };
      default:
        return {
          key: null,
          label: rawModalidade || "Não determinada",
          badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
          complement: "Destino financeiro não pôde ser determinado. Verifique a modalidade de pagamento configurada.",
          isValid: false,
        };
    }
  }, [rawModalidade]);

  // Título e subtítulo dinâmicos conforme estágio real
  const headerInfo = useMemo(() => {
    if (isDevolved) {
      return {
        title: "Serviço Devolvido",
        subtitle: "Serviço extra retornado à etapa anterior para ajustes operacionais.",
      };
    }
    switch (currentStageIndex) {
      case 0:
        return {
          title: "Serviço Registrado",
          subtitle: "Serviço extra capturado. Aguardando encaminhamento para validação operacional.",
        };
      case 1:
        return {
          title: "Serviço em Validação",
          subtitle: "Conferência técnica e validação dos dados operacionais em andamento.",
        };
      case 2:
        return {
          title: "Serviço Aprovado",
          subtitle: "Acompanhe a geração da receita e o encaminhamento financeiro.",
        };
      case 3:
        return {
          title: "Serviço em Faturamento / A Receber",
          subtitle: "Disponível na Central de Receitas para cobrança e faturamento.",
        };
      case 4:
        return {
          title: "Receita Liquidada / Concluído",
          subtitle: "Receita confirmada e fluxo de serviço extra finalizado.",
        };
      default:
        return {
          title: "Serviço Extra",
          subtitle: "Acompanhe o fluxo operacional e financeiro do serviço.",
        };
    }
  }, [currentStageIndex, isDevolved]);

  // Derivação do banner de resultado
  const resultSummary = useMemo(() => {
    if (isFlowDone || currentStageIndex === 4) {
      return {
        icon: CheckCircle2,
        title: "Receita liquidada e fluxo de serviço extra concluído.",
        description: "O recebimento foi confirmado no financeiro e o ciclo operacional está encerrado.",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      };
    }
    if (isDevolved) {
      return {
        icon: AlertTriangle,
        title: "Serviço extra devolvido para correção",
        description: context?.devolucaoMotivo || "O lançamento retornou à etapa anterior para ajustes operacionais.",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
      };
    }
    if (currentStageIndex === 0) {
      return {
        icon: Sparkles,
        title: "Serviço extra registrado no sistema.",
        description: "Lançamento inicial capturado, aguardando início da validação técnica e operacional.",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      };
    }
    if (currentStageIndex === 1) {
      return {
        icon: AlertTriangle,
        title: "Serviço aguardando validação técnica e operacional.",
        description: "O lançamento está em análise pela equipe operacional antes de ser aprovado para o financeiro.",
        badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
      };
    }
    // A partir do estágio 2 (Aprovado)
    if (!modalidadeInfo.isValid) {
      return {
        icon: AlertTriangle,
        title: "Serviço aprovado, mas modalidade financeira requer atenção.",
        description: modalidadeInfo.complement,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      };
    }
    return {
      icon: CheckCircle2,
      title: "Serviço aprovado e encaminhado para o fluxo financeiro.",
      description: modalidadeInfo.complement,
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    };
  }, [isFlowDone, isDevolved, currentStageIndex, modalidadeInfo, context?.devolucaoMotivo]);

  // CTA direciona para o Financeiro com o identificador no state
  const handleCtaClick = () => {
    if (!nextAction?.route) return;
    const registroId = context?.registroId || (nextAction as any)?.actionPayload?.highlightServicoExtraId;
    closePipeline();
    navigate(nextAction.route, {
      state: {
        highlightServicoExtraId: registroId,
        activeTab: modalidadeInfo.key,
      },
    });
  };

  if (!isOpen || !payload || payload.context?.fluxo !== "Serviços Extras") {
    return null;
  }

  const ResultIcon = resultSummary.icon;
  const valorFormatado = typeof context?.valor === "number"
    ? context.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : null;

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
        aria-labelledby="servicos-extras-continuity-title"
        className={cn(
          "relative z-10 w-full max-w-[480px] bg-white dark:bg-slate-950 border-l border-border",
          "shadow-2xl flex flex-col h-full overflow-hidden",
          "animate-in slide-in-from-right duration-300 ease-out"
        )}
      >
        {/* Cabeçalho do Drawer */}
        <header className="p-5 border-b border-border bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between shrink-0">
          <div className="space-y-1 pr-6">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800"
              >
                Serviços Extras
              </Badge>
              <span className="text-[11px] text-muted-foreground font-medium">
                Continuidade Operacional
              </span>
            </div>
            <h2
              id="servicos-extras-continuity-title"
              className="font-display text-lg font-bold text-foreground"
            >
              {headerInfo.title}
            </h2>
            <p className="text-xs text-muted-foreground">
              {headerInfo.subtitle}
            </p>
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
            onClick={closePipeline}
            aria-label="Fechar painel"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Card de Resumo do Resultado */}
          <div
            className={cn(
              "rounded-xl border p-4 flex items-start gap-3 transition-colors",
              resultSummary.badgeClass
            )}
          >
            <div className="p-1.5 rounded-lg bg-white/80 dark:bg-black/30 shrink-0 mt-0.5">
              <ResultIcon className="h-4 w-4" />
            </div>
            <div className="space-y-1 min-w-0">
              <h3 className="text-xs font-bold leading-snug">
                {resultSummary.title}
              </h3>
              <p className="text-[11px] leading-relaxed opacity-90">
                {resultSummary.description}
              </p>
            </div>
          </div>

          {/* Card com Metadados do Serviço Extra */}
          <section className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-border/80 space-y-2.5 text-xs">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
              Dados do Serviço Extra
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">Empresa</div>
                  <div className="font-semibold text-foreground truncate">
                    {context?.empresa || "—"}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">Competência / Data</div>
                  <div className="font-semibold text-foreground truncate">
                    {context?.competencia || context?.data || "—"}
                  </div>
                </div>
              </div>
            </div>

            {context?.descricao && (
              <div className="flex items-start gap-2 pt-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">Descrição do Serviço</div>
                  <div className="font-medium text-foreground line-clamp-2">
                    {context.descricao}
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
              {valorFormatado && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-muted-foreground">Valor</div>
                    <div className="font-bold text-foreground truncate">
                      {valorFormatado}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">Modalidade</div>
                  <div>
                    <Badge variant="outline" className={cn("text-[10px] font-semibold h-4 px-1.5", modalidadeInfo.badgeClass)}>
                      {modalidadeInfo.label}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Stepper com os 5 Estágios Canônicos */}
          <section className="space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-border">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Fluxo Operacional e Financeiro
              </span>
              <span className="text-[10px] text-muted-foreground">
                5 etapas
              </span>
            </div>

            <div className="space-y-0 pt-1">
              {SERVICOS_EXTRAS_STAGES.map((stage, idx) => {
                const isStepDone = isFlowDone || idx < currentStageIndex;
                const isStepCurrent = !isFlowDone && idx === currentStageIndex;
                const isStepPending = !isFlowDone && idx > currentStageIndex;
                const isLast = idx === SERVICOS_EXTRAS_STAGES.length - 1;

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

                    {/* Coluna Direita: Conteúdo da Etapa */}
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
        </div>

        {/* Rodapé com CTA Contextual */}
        <footer className="p-4 border-t border-border bg-slate-50/70 dark:bg-slate-900/50 space-y-2 shrink-0">
          {modalidadeInfo.isValid && nextAction?.route ? (
            <>
              <Button
                onClick={handleCtaClick}
                className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-10"
              >
                <span>{nextAction.label || "Continuar para Financeiro →"}</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                <span>Direciona para o Kanban de Receitas filtrado</span>
                <button
                  type="button"
                  onClick={closePipeline}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Fechar
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                Modalidade financeira não configurada. O serviço foi aprovado, mas não foi possível direcionar automaticamente para o financeiro.
              </div>
              <Button
                variant="outline"
                onClick={closePipeline}
                className="w-full font-medium h-9"
              >
                Fechar
              </Button>
            </div>
          )}
        </footer>
      </aside>
    </div>
  );
};
