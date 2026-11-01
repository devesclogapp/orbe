import React from "react";
import { cn } from "@/lib/utils";

export type OrbeSemanticStatus = "success" | "warning" | "danger" | "info" | "neutral";

export interface OrbeStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: OrbeSemanticStatus;
  label: string | React.ReactNode;
  showDot?: boolean;
  pulse?: boolean;
}

/**
 * OrbeStatusBadge (Semantic)
 * 
 * Badge Semântico Oficial para status operacionais e de governança.
 * Mapeamento:
 * - success: CONCLUÍDO, PAGO, REGULAR, CONCILIADO (Verde)
 * - warning: PENDÊNCIA, AGUARDANDO_RH, ATENÇÃO (Âmbar)
 * - danger: EM_RESTRIÇÃO, DEVOLVIDO, CRÍTICO, INCONSISTENTE (Rose/Vermelho)
 * - info: PROCESSANDO, EM_EXECUÇÃO, SELECIONADO (Royal Blue)
 * - neutral: RASCUNHO, HISTÓRICO, INFORMATIVO (Slate)
 */
export const OrbeStatusBadge: React.FC<OrbeStatusBadgeProps> = ({
  status,
  label,
  showDot = true,
  pulse = false,
  className,
  ...props
}) => {
  const styles: Record<OrbeSemanticStatus, { bg: string; dot: string }> = {
    success: {
      bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50",
      dot: "bg-emerald-600 dark:bg-emerald-400",
    },
    warning: {
      bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50",
      dot: "bg-amber-500 dark:bg-amber-400",
    },
    danger: {
      bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50",
      dot: "bg-rose-600 dark:bg-rose-400",
    },
    info: {
      bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
      dot: "bg-blue-600 dark:bg-blue-400",
    },
    neutral: {
      bg: "bg-muted/60 text-muted-foreground border-border/70 dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]",
      dot: "bg-slate-400 dark:bg-slate-500",
    },
  };

  const current = styles[status] || styles.neutral;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none select-none tracking-tight shrink-0",
        current.bg,
        className
      )}
      {...props}
    >
      {showDot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            current.dot,
            pulse && "animate-pulse"
          )}
        />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
};
