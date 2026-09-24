import React from "react";
import { Check, Circle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TimelineStageItem {
  id: string;
  label: string;
  responsible?: string;
  description?: string;
  status: "done" | "current" | "pending" | "devolved";
}

export interface TimelineVerticalStepperProps {
  stages: TimelineStageItem[];
  isFlowDone?: boolean;
  className?: string;
  concludedMessage?: {
    title?: string;
    description?: string;
  };
}

/**
 * TimelineVerticalStepper
 * 
 * Componente visual detalhado de linha do tempo vertical para Drawers Secundários:
 * - Renderiza cada etapa com nó visual, linhas conectoras, responsáveis e descrições
 * - Destaque pulsante na etapa atual ("● Você está aqui")
 * - Tratamento explícito para fluxo concluído (card verde e checks completos)
 * - Suporte a estágios devolvidos (ícone de alerta e badge específico)
 */
export const TimelineVerticalStepper: React.FC<TimelineVerticalStepperProps> = ({
  stages,
  isFlowDone = false,
  className,
  concludedMessage = {
    title: "Fluxo concluído com sucesso.",
    description: "Todas as etapas operacionais e financeiras foram finalizadas.",
  },
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {isFlowDone && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900 p-4 text-center space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{concludedMessage.title}</span>
          </div>
          {concludedMessage.description && (
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
              {concludedMessage.description}
            </p>
          )}
        </section>
      )}

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-border/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Linha do Tempo
          </span>
          <span className="text-[10px] text-muted-foreground">
            {stages.length} etapas
          </span>
        </div>

        <div className="space-y-0 pt-1">
          {stages.map((stage, idx) => {
            const isDone = isFlowDone || stage.status === "done";
            const isCurrent = !isFlowDone && stage.status === "current";
            const isDevolved = !isFlowDone && stage.status === "devolved";
            const isPending = !isFlowDone && !isDone && !isCurrent && !isDevolved;
            const isLast = idx === stages.length - 1;

            return (
              <div key={stage.id} className="flex gap-3 relative">
                {/* Conector e Ícone */}
                <div className="flex flex-col items-center">
                  {isDone ? (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                    </div>
                  ) : isCurrent ? (
                    <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white ring-4 ring-primary/25 ring-offset-2 ring-offset-background shadow-xs">
                      <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping" />
                      <Circle className="h-2.5 w-2.5 fill-white text-white" />
                    </div>
                  ) : isDevolved ? (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs">
                      <AlertTriangle className="h-3.5 w-3.5" />
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
                        isDone ? "bg-emerald-400/80" : "bg-border/70"
                      )}
                    />
                  )}
                </div>

                {/* Conteúdo do Estágio */}
                <div
                  className={cn(
                    "flex-1 pb-4 min-w-0 transition-all p-3 -mt-1 rounded-lg",
                    isCurrent &&
                      "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary border-y border-r border-border/80 shadow-xs rounded-r-lg",
                    isLast && "pb-1"
                  )}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          "text-xs",
                          isDone && "font-semibold text-emerald-700 dark:text-emerald-400",
                          isCurrent && "font-bold text-foreground text-sm",
                          isDevolved && "font-bold text-rose-700 dark:text-rose-400",
                          isPending && "font-medium text-muted-foreground/70"
                        )}
                      >
                        {stage.label}
                      </span>

                      {isDone && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                        >
                          ✓ Concluído
                        </Badge>
                      )}

                      {isCurrent && (
                        <Badge className="text-[10px] font-bold uppercase tracking-tight h-5 px-2 bg-primary text-primary-foreground shadow-xs animate-pulse">
                          ● Você está aqui
                        </Badge>
                      )}

                      {isDevolved && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-bold uppercase tracking-tight h-4 px-1.5 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400"
                        >
                          ↩ Devolvido
                        </Badge>
                      )}

                      {isPending && (
                        <Badge
                          variant="outline"
                          className="text-[10px] font-medium h-4 px-1.5 bg-muted/80 text-muted-foreground border-border"
                        >
                          Pendente
                        </Badge>
                      )}
                    </div>

                    {stage.responsible && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {stage.responsible}
                      </span>
                    )}
                  </div>

                  {stage.description && (
                    <p
                      className={cn(
                        "mt-1 text-[11px] leading-relaxed",
                        isCurrent
                          ? "text-foreground/90 font-medium"
                          : "text-muted-foreground/70"
                      )}
                    >
                      {stage.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
