import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowRight,
    Building2,
    Calendar,
    CheckCircle2,
    ChevronRight,
    Circle,
    Clock,
    GitBranch,
    Loader2,
    X,
    Zap,
} from "lucide-react";

import { PipelineStep, PipelineStepStatus, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Step Node ────────────────────────────────────────────────────────────────

const StepNode = ({ status }: { status: PipelineStepStatus }) => {
    if (status === "done") {
        return (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
            </div>
        );
    }
    if (status === "current") {
        return (
            <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary shadow-sm ring-2 ring-primary/25 ring-offset-1 ring-offset-background">
                <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                <Circle className="h-2.5 w-2.5 fill-white text-white" />
            </div>
        );
    }
    return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-border bg-muted/40">
            <Circle className="h-2 w-2 fill-muted-foreground/30 text-muted-foreground/30" />
        </div>
    );
};

// ─── Single Step Row ──────────────────────────────────────────────────────────

const PipelineStepRow = ({
    step,
    index,
    isLast,
}: {
    step: PipelineStep;
    index: number;
    isLast: boolean;
}) => {
    const isDone = step.status === "done";
    const isCurrent = step.status === "current";
    const isPending = step.status === "pending" || step.status === "blocked";

    return (
        <div className="flex gap-3">
            {/* Left: node + connector */}
            <div className="flex flex-col items-center">
                <StepNode status={step.status} />
                {!isLast && (
                    <div
                        className={cn(
                            "mt-1 w-px flex-1",
                            isDone ? "bg-emerald-300/60" : "bg-border/60",
                        )}
                        style={{ minHeight: 24 }}
                    />
                )}
            </div>

            {/* Right: content */}
            <div className={cn("pb-4 flex-1 min-w-0", isLast && "pb-0")}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span
                            className={cn(
                                "text-sm font-semibold leading-tight",
                                isDone && "text-emerald-700 dark:text-emerald-400",
                                isCurrent && "text-foreground",
                                isPending && "text-muted-foreground",
                            )}
                        >
                            {step.label}
                        </span>
                        {isDone && (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                                Concluído
                            </span>
                        )}
                        {isCurrent && (
                            <span className="inline-flex items-center rounded-full bg-primary/8 px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
                                <Loader2 className="h-2.5 w-2.5 mr-1 animate-spin" />
                                Em andamento
                            </span>
                        )}
                        {isPending && (
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground border border-border">
                                Pendente
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {isDone && step.timestamp && (
                            <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                                <Clock className="h-2.5 w-2.5" />
                                {step.timestamp}
                            </span>
                        )}
                        {(isCurrent || isPending) && step.responsible && (
                            <span className="text-[11px] text-muted-foreground">
                                Responsável: <strong className="text-foreground/80">{step.responsible}</strong>
                            </span>
                        )}
                    </div>
                </div>

                <p
                    className={cn(
                        "mt-0.5 text-xs leading-relaxed",
                        isDone && "text-emerald-600/70 dark:text-emerald-500/60",
                        isCurrent && "text-muted-foreground",
                        isPending && "text-muted-foreground/50",
                    )}
                >
                    {step.description}
                </p>
            </div>
        </div>
    );
};

// ─── Main Modal ───────────────────────────────────────────────────────────────

export const OperationalPipelineModal = () => {
    const { isOpen, payload, closePipeline } = useOperationalPipeline();
    const navigate = useNavigate();
    const overlayRef = useRef<HTMLDivElement>(null);

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closePipeline();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isOpen, closePipeline]);

    // Close on overlay click
    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === overlayRef.current) closePipeline();
    };

    if (!payload) return null;

    const { context, steps, nextAction } = payload;

    const handleNextAction = () => {
        closePipeline();
        if (nextAction?.route) {
            setTimeout(() => navigate(nextAction.route), 150);
        }
    };

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className={cn(
                "fixed inset-0 z-[200] flex items-center justify-center p-4",
                "bg-background/60 backdrop-blur-sm",
                "transition-opacity duration-200",
                isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
            aria-modal="true"
            role="dialog"
            aria-label="Fluxo sendo executado"
        >
            {/* Modal Card */}
            <div
                className={cn(
                    "relative w-full max-w-[560px] rounded-2xl border border-border bg-card shadow-2xl",
                    "transition-all duration-300",
                    isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2",
                )}
            >
                {/* Close button */}
                <button
                    onClick={closePipeline}
                    className="absolute right-4 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Fechar"
                >
                    <X className="h-3.5 w-3.5" />
                </button>

                {/* Header */}
                <div className="px-6 pb-0 pt-6 text-center">
                    {/* Icon */}
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 border border-emerald-200">
                        <CheckCircle2 className="h-6 w-6 text-emerald-600" strokeWidth={1.75} />
                    </div>
                    <h2 className="font-display text-lg font-semibold text-foreground">
                        Fluxo sendo executado
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Acompanhe o progresso da competência{" "}
                        <strong className="text-foreground">{context.competencia}</strong> para{" "}
                        <strong className="text-foreground">{context.empresa}</strong>.
                    </p>
                </div>

                {/* Context badges */}
                <div className="mx-6 mt-4 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="uppercase tracking-wide text-[10px] font-semibold">Competência</span>
                        <span className="font-semibold text-foreground">{context.competencia}</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5" />
                        <span className="uppercase tracking-wide text-[10px] font-semibold">Empresa</span>
                        <span className="font-semibold text-foreground">{context.empresa}</span>
                    </div>
                    <div className="h-4 w-px bg-border" />
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <GitBranch className="h-3.5 w-3.5" />
                        <span className="uppercase tracking-wide text-[10px] font-semibold">Fluxo</span>
                        <span className="font-semibold text-foreground">{context.fluxo}</span>
                    </div>
                </div>

                {/* Timeline / Steps */}
                <div className="mx-6 mt-4 rounded-xl border border-border bg-background/60 px-4 py-4">
                    <div className="space-y-0">
                        {steps.map((step, index) => (
                            <PipelineStepRow
                                key={step.id}
                                step={step}
                                index={index}
                                isLast={index === steps.length - 1}
                            />
                        ))}
                    </div>
                </div>

                {/* Next Action CTA */}
                {nextAction && (
                    <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Zap className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary/70 mb-0.5">
                                Próxima ação recomendada
                            </div>
                            <div className="text-sm font-semibold text-foreground leading-snug">
                                {nextAction.description}
                            </div>
                        </div>
                    </div>
                )}

                {/* Footer Buttons */}
                <div className="flex items-center justify-between gap-3 px-6 pb-5 pt-4">
                    <button
                        onClick={closePipeline}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                        Continuar nesta tela
                    </button>
                    {nextAction && (
                        <Button
                            onClick={handleNextAction}
                            className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                            size="sm"
                        >
                            {nextAction.label}
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Footer footnote */}
                <div className="border-t border-border px-6 py-2.5">
                    <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                        <ArrowRight className="h-3 w-3" />
                        As etapas concluídas desbloqueiam as próximas ações do fluxo.
                    </p>
                </div>
            </div>
        </div>
    );
};
