import React from "react";
import { ChevronRight, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PipelineStageItem {
  id: string;
  label: string;
  compactLabel?: string;
  status: "done" | "current" | "pending" | "devolved";
}

export interface PipelineHorizontalBarProps {
  stages: PipelineStageItem[];
  onVerFluxoCompleto?: () => void;
  title?: string;
  actionLabel?: string;
  className?: string;
  isFlowDone?: boolean;
}

/**
 * PipelineHorizontalBar
 * 
 * Componente visual compacto de pipeline horizontal para Drawers Primários:
 * - Apresenta o resumo das etapas em linha única adaptativa
 * - Pills com indicadores de status (✓ concluído, ● atual pulsante, ○ pendente, ↩ devolvido)
 * - Exibe contagem de etapas e gatilho interativo "Ver fluxo completo →"
 * - Dispara a abertura do Drawer Secundário
 */
export const PipelineHorizontalBar: React.FC<PipelineHorizontalBarProps> = ({
  stages,
  onVerFluxoCompleto,
  title = "Fluxo Operacional e Financeiro",
  actionLabel = "Ver fluxo completo",
  className,
  isFlowDone = false,
}) => {
  const completedCount = isFlowDone
    ? stages.length
    : stages.filter((s) => s.status === "done").length;

  return (
    <section className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between pb-0.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-primary" /> {title}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {completedCount} de {stages.length} etapas
        </span>
      </div>

      <button
        type="button"
        onClick={onVerFluxoCompleto}
        disabled={!onVerFluxoCompleto}
        className={cn(
          "w-full text-left p-2.5 rounded-lg border border-border/80 bg-slate-50/80 dark:bg-slate-900/60 transition-all space-y-1.5 shadow-2xs group",
          onVerFluxoCompleto &&
            "hover:bg-slate-100/90 dark:hover:bg-slate-900 hover:border-primary/50 cursor-pointer"
        )}
        title={
          onVerFluxoCompleto
            ? "Clique para ver o fluxo completo com descrições e responsáveis"
            : undefined
        }
      >
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-1 border-b border-border/40">
          <span className="font-semibold text-foreground/80">
            Resumo das Etapas
          </span>
          {onVerFluxoCompleto && (
            <span className="text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform font-bold">
              <span>{actionLabel}</span>
              <ChevronRight className="h-3 w-3" />
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1 w-full flex-wrap sm:flex-nowrap pt-0.5">
          {stages.map((stage, idx) => {
            const isDone = isFlowDone || stage.status === "done";
            const isCurrent = !isFlowDone && stage.status === "current";
            const isDevolved = !isFlowDone && stage.status === "devolved";
            const isPending = !isFlowDone && !isDone && !isCurrent && !isDevolved;
            const isLast = idx === stages.length - 1;

            return (
              <div key={stage.id} className="flex items-center gap-1 min-w-0 shrink">
                <span
                  className={cn(
                    "font-medium transition-colors flex items-center gap-1 text-[10px] sm:text-[11px] min-w-0 rounded px-1.5 py-0.5",
                    isDone &&
                      "text-emerald-700 dark:text-emerald-400 font-semibold bg-emerald-50/60 dark:bg-emerald-950/40",
                    isCurrent &&
                      "text-primary font-bold bg-primary/10 shadow-2xs",
                    isDevolved &&
                      "text-rose-700 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/40",
                    isPending && "text-muted-foreground/70"
                  )}
                  title={stage.label}
                >
                  <span className="truncate">{stage.compactLabel || stage.label}</span>
                  {isDone && <span className="text-emerald-600 font-bold shrink-0">✓</span>}
                  {isCurrent && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                  )}
                  {isDevolved && (
                    <span className="text-rose-600 font-bold shrink-0">↩</span>
                  )}
                </span>
                {!isLast && (
                  <span className="text-muted-foreground/40 font-mono text-[9px] sm:text-[10px] shrink-0 mx-0.5">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </button>
    </section>
  );
};
