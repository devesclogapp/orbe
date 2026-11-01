import React from "react";
import { Check, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface PipelineStepConfig {
  key: string;
  label: string;
  shortLabel?: string;
  responsible?: string;
  description?: string;
}

export interface PipelineExceptionState {
  isException: boolean;
  label?: string; // ex: "Reprovado"
  description?: string;
  stepKey?: string; // chave do passo onde ocorreu o bloqueio/reprovação
}

export interface UxPipelineStepperProps {
  steps: PipelineStepConfig[];
  currentStepKey: string;
  exceptionState?: PipelineExceptionState | null;
  variant?: "compact" | "detailed";
  subtitle?: string;
  className?: string;
}

/**
 * UxPipelineStepper — Padrão Transversal ORBE para Visualização de Esteiras Operacionais
 * 
 * Variantes:
 * - compact: uso em tabelas / listagens de alta densidade (●━━━━●━━━━◉────○────○ com tooltips acessíveis)
 * - detailed: uso em Drawers / painéis de detalhe (esteira horizontal estruturada com alçadas institucionais)
 * 
 * Princípios de Design System:
 * - Progresso visual da esquerda para a direita.
 * - Cores neutras institucionais para etapas já concluídas (verde reservado para conclusão/liquidação).
 * - Destaque semântico na etapa atual ("Você está aqui").
 * - Tratamento de estados de exceção (REPROVADO/EM_RESTRICAO/DEVOLVIDO) em rose/vermelho com tooltip.
 * - Desacoplado de regras de negócio específicas de cada tela.
 */
export const UxPipelineStepper: React.FC<UxPipelineStepperProps> = ({
  steps,
  currentStepKey,
  exceptionState,
  variant = "compact",
  subtitle = "Acompanhamento da esteira operacional deste lançamento.",
  className,
}) => {
  const isException = Boolean(exceptionState?.isException);
  const exceptionStepKey = exceptionState?.stepKey;

  // Resolução do índice atual da esteira
  const currentIndex = React.useMemo(() => {
    // Se estiver em exceção e tiver stepKey específico (ex: reprovado na validação)
    if (isException && exceptionStepKey) {
      const idx = steps.findIndex((s) => s.key === exceptionStepKey);
      if (idx !== -1) return idx;
    }
    const foundIdx = steps.findIndex((s) => s.key === currentStepKey);
    return foundIdx !== -1 ? foundIdx : 0;
  }, [steps, currentStepKey, isException, exceptionStepKey]);

  const lastStepKey = steps[steps.length - 1]?.key;
  const isFinalizado =
    (currentStepKey === lastStepKey ||
      currentStepKey === "FINALIZADO" ||
      currentStepKey === "CONCLUIDO") &&
    !isException;

  // ─────────────────────────────────────────────────────────────────────────────
  // VARIANTE COMPACT (TABELA / LISTAGEM)
  // ─────────────────────────────────────────────────────────────────────────────
  if (variant === "compact") {
    const currentStepConfig = steps[currentIndex];
    const statusLabel = isException
      ? exceptionState?.label || "Exceção"
      : currentStepConfig?.label || currentStepKey;

    const ariaLabel = `Pipeline operacional: ${statusLabel}. Etapa ${currentIndex + 1} de ${steps.length}.`;

    return (
      <TooltipProvider delayDuration={150}>
        <div
          role="region"
          aria-label={ariaLabel}
          className={cn("inline-flex items-center justify-start select-none py-1", className)}
        >
          <div className="flex items-center gap-1">
            {steps.map((step, idx) => {
              const isStepDone = isFinalizado || idx < currentIndex;
              const isStepCurrent = !isFinalizado && idx === currentIndex;
              const isStepPending = !isFinalizado && idx > currentIndex;
              const isLast = idx === steps.length - 1;

              // Tooltip status text
              let stepStatusText = "Pendente";
              if (isStepCurrent) {
                stepStatusText = isException ? (exceptionState?.label || "Exceção") : "Etapa atual";
              } else if (isStepDone) {
                stepStatusText = "Concluído";
              }

              return (
                <React.Fragment key={step.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        tabIndex={0}
                        aria-label={`${step.label} — ${stepStatusText}`}
                        className={cn(
                          "flex items-center justify-center transition-all duration-150 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/40",
                          isStepCurrent && isException && "w-3.5 h-3.5 bg-rose-500 ring-2 ring-rose-400/40 dark:ring-rose-500/30 text-white",
                          isStepCurrent && !isException && !isFinalizado && "w-3 h-3 bg-royal-blue dark:bg-royal-blue-light ring-2 ring-royal-blue/30 dark:ring-royal-blue-light/30 shadow-xs",
                          isStepCurrent && isFinalizado && "w-3 h-3 bg-emerald-600 dark:bg-emerald-500 ring-2 ring-emerald-400/30 shadow-xs",
                          isStepDone && !isFinalizado && "w-2.5 h-2.5 bg-slate-400 dark:bg-zinc-400 hover:bg-slate-500",
                          isStepDone && isFinalizado && "w-2.5 h-2.5 bg-emerald-600 dark:bg-emerald-500",
                          isStepPending && "w-2 h-2 rounded-full border border-slate-300 dark:border-zinc-700 bg-transparent hover:border-slate-400"
                        )}
                      >
                        {isStepCurrent && isException ? (
                          <span className="text-[8px] font-black leading-none text-white">✕</span>
                        ) : isStepCurrent ? (
                          <span className="w-1 h-1 rounded-full bg-white dark:bg-black" />
                        ) : null}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs py-1 px-2.5 z-50">
                      <div className="font-semibold text-foreground flex items-center gap-1.5">
                        <span>{step.label}</span>
                        <span className="text-[10px] text-muted-foreground font-normal">
                          ({stepStatusText})
                        </span>
                      </div>
                      {step.responsible && (
                        <div className="text-[10px] text-muted-foreground">
                          Alçada: {step.responsible}
                        </div>
                      )}
                    </TooltipContent>
                  </Tooltip>

                  {/* Linha Conectora entre pontos */}
                  {!isLast && (
                    <div
                      className={cn(
                        "h-[2px] w-2 sm:w-2.5 transition-colors",
                        isFinalizado
                          ? "bg-emerald-500/80 dark:bg-emerald-600/70"
                          : idx < currentIndex
                          ? "bg-slate-400/80 dark:bg-zinc-500/70"
                          : "bg-slate-200 dark:bg-zinc-800"
                      )}
                      aria-hidden="true"
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VARIANTE DETAILED (DRAWER / HORIZONTAL DETALHADO)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className={cn("w-full space-y-3", className)}>
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
            Etapas do Processo
          </span>
          <span className="text-[10px] text-muted-foreground">
            {subtitle}
          </span>
        </div>
        <span className="text-[10px] font-medium text-muted-foreground shrink-0">
          {steps.length} etapas canônicas
        </span>
      </div>

      {/* Esteira Horizontal Estruturada */}
      <div className="relative pt-1 pb-2 overflow-x-auto">
        <div className="flex items-start justify-between min-w-[440px] gap-1">
          {steps.map((step, idx) => {
            const isStepDone = isFinalizado || idx < currentIndex;
            const isStepCurrent = !isFinalizado && idx === currentIndex;
            const isStepPending = !isFinalizado && idx > currentIndex;
            const isLast = idx === steps.length - 1;

            return (
              <div
                key={step.key}
                className={cn(
                  "flex-1 flex flex-col items-center text-center relative px-1",
                  isStepCurrent && "scale-[1.02] transition-transform"
                )}
              >
                {/* Linhas Conectoras Horizontais (Esquerda e Direita do Nó) */}
                {idx > 0 && (
                  <div
                    className={cn(
                      "absolute top-3 right-1/2 left-0 -translate-y-1/2 h-[2px] -z-0",
                      isStepDone || (isStepCurrent && !isException)
                        ? "bg-slate-400/80 dark:bg-zinc-500/70"
                        : "bg-border dark:bg-zinc-800"
                    )}
                    aria-hidden="true"
                  />
                )}
                {!isLast && (
                  <div
                    className={cn(
                      "absolute top-3 left-1/2 right-0 -translate-y-1/2 h-[2px] -z-0",
                      isStepDone
                        ? isFinalizado
                          ? "bg-emerald-500/80"
                          : "bg-slate-400/80 dark:bg-zinc-500/70"
                        : "bg-border dark:bg-zinc-800"
                    )}
                    aria-hidden="true"
                  />
                )}

                {/* Nó Indicador (Icone do Passo) */}
                <div
                  className={cn(
                    "relative z-10 flex items-center justify-center rounded-full transition-all duration-150 mb-1.5 shadow-2xs",
                    isStepDone && !isFinalizado && "w-6 h-6 bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-200 border border-slate-300 dark:border-zinc-700",
                    isStepDone && isFinalizado && "w-6 h-6 bg-emerald-600 text-white shadow-xs",
                    isStepCurrent && isException && "w-6 h-6 bg-rose-600 text-white ring-4 ring-rose-500/20 shadow-xs",
                    isStepCurrent && !isException && !isFinalizado && "w-6 h-6 bg-royal-blue dark:bg-royal-blue-light text-white dark:text-zinc-900 ring-4 ring-royal-blue/20 dark:ring-royal-blue-light/30 shadow-xs",
                    isStepPending && "w-6 h-6 border-2 border-border bg-card text-muted-foreground/60"
                  )}
                >
                  {isStepDone ? (
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  ) : isStepCurrent && isException ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : isStepCurrent ? (
                    <Circle className="w-2.5 h-2.5 fill-current" />
                  ) : (
                    <Circle className="w-1.5 h-1.5 text-muted-foreground/40 fill-muted-foreground/40" />
                  )}
                </div>

                {/* Título da Etapa */}
                <div
                  className={cn(
                    "text-[11px] leading-tight font-semibold",
                    isStepCurrent && isException && "text-rose-600 dark:text-rose-400 font-bold",
                    isStepCurrent && !isException && "text-foreground font-bold",
                    isStepDone && "text-muted-foreground font-medium",
                    isStepPending && "text-muted-foreground/60 font-normal"
                  )}
                >
                  {step.label}
                </div>

                {/* Alçada / Responsável Institucional */}
                {step.responsible && (
                  <div className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5">
                    {step.responsible}
                  </div>
                )}

                {/* Marcador Explícito "Você está aqui" ou "Bloqueado" */}
                {isStepCurrent && (
                  <div className="mt-1.5">
                    {isException ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-900/60">
                        Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-tight bg-primary text-primary-foreground shadow-2xs">
                        Você está aqui
                      </span>
                    )}
                  </div>
                )}

                {isStepDone && isLast && (
                  <div className="mt-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                      Concluído
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
