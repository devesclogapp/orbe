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
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all duration-200 shadow-xs select-none",
        "dark:border-white/[0.05] dark:bg-[#15191F] dark:shadow-none",
        interactive && "cursor-pointer hover:border-blue-500/40 hover:bg-muted/15 dark:hover:border-white/[0.08] dark:hover:bg-[#1A1F27]",
        selected && "border-blue-600 dark:border-blue-500 bg-blue-50/20 dark:bg-[#1A1F27] ring-1 ring-blue-600/40 dark:ring-blue-500/40",
        className
      )}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 dark:text-[#A0A7B2] truncate">
            {label}
          </span>
        </div>
        {Icon && (
          <div className="flex items-center gap-1 shrink-0">
            <Icon className="h-3.5 w-3.5 text-muted-foreground/50 dark:text-[#69717D]" strokeWidth={1.75} />
          </div>
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="font-display text-2xl font-bold tracking-tight text-foreground dark:text-[#F1F3F5] sm:text-[26px] leading-none">
          {value}
        </div>
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

      {subValue && (
        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-border/40 dark:border-white/[0.04] pt-1.5 text-[10.5px] text-muted-foreground/80 dark:text-[#A0A7B2]">
          <span className="leading-tight tracking-tight min-w-0 truncate">{subValue}</span>
        </div>
      )}
    </div>
  );
};
