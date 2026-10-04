import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export interface OrbeKpiCardProps {
  label: string;
  value: string | number;
  subValue?: string | React.ReactNode;
  icon?: LucideIcon;
  status?: "info" | "success" | "warning" | "danger" | "neutral";
  interactive?: boolean;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
}

/**
 * OrbeKpiCard
 * 
 * Card de métrica/KPI oficial do ORBE Design System.
 * Regra: Informativo por padrão (não clicável a menos que explicitamente solicitado via interactive={true}).
 */
export const OrbeKpiCard: React.FC<OrbeKpiCardProps> = ({
  label,
  value,
  subValue,
  icon: Icon,
  status,
  interactive = false,
  selected = false,
  onClick,
  className,
  trend,
}) => {
  const statusDots = {
    info: "bg-blue-600 dark:bg-blue-400",
    success: "bg-emerald-600 dark:bg-emerald-400",
    warning: "bg-amber-500 dark:bg-amber-400",
    danger: "bg-rose-600 dark:bg-rose-400",
    neutral: "bg-slate-400 dark:bg-slate-500",
  };

  return (
    <div
      onClick={interactive ? onClick : undefined}
      className={cn(
        "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between space-y-2 select-none",
        interactive && "cursor-pointer transition-all hover:bg-muted/30 dark:hover:bg-[#1A1F27] hover:border-border-strong",
        selected && "border-blue-600 dark:border-blue-500 bg-blue-50/20 dark:bg-[#1A1F27] ring-1 ring-blue-600/40 dark:ring-blue-500/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {status && (
            <span className={cn("h-2 w-2 rounded-full shrink-0", statusDots[status])} />
          )}
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
            {label}
          </span>
        </div>
        {Icon && (
          <div className="h-6 w-6 rounded-md bg-muted/40 dark:bg-white/[0.04] flex items-center justify-center text-muted-foreground shrink-0">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-xl sm:text-2xl font-black font-display font-mono text-foreground leading-none tracking-tight">
          {value}
        </div>
        {(subValue || trend) && (
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-0.5">
            {subValue && <span className="truncate">{subValue}</span>}
            {trend && (
              <span
                className={cn(
                  "font-mono font-medium text-[11px] shrink-0",
                  trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                )}
              >
                {trend.value}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
