import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExecutiveMetricCardProps {
  label: string;
  value: string;
  delta?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
    caption?: string;
  };
  subtitle?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant?: "success" | "warning" | "info" | "neutral" | "destructive";
  };
  className?: string;
  onClick?: () => void;
  isClickable?: boolean;
}

export const ExecutiveMetricCard: React.FC<ExecutiveMetricCardProps> = ({
  label,
  value,
  delta,
  subtitle,
  icon: Icon,
  badge,
  className,
  onClick,
  isClickable = false,
}) => {
  const clickable = isClickable || Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all duration-200 shadow-xs",
        "dark:border-white/[0.05] dark:bg-[#15191F] dark:shadow-none",
        clickable && "cursor-pointer hover:border-blue-500/40 hover:bg-muted/15 dark:hover:border-white/[0.08] dark:hover:bg-[#1A1F27] hover:shadow-xs",
        className
      )}
    >
      {/* 1. Nome do Indicador + Micro-chevron / Ícone sutil */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 dark:text-[#A0A7B2] truncate">
          {label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {Icon && (
            <Icon className="h-3.5 w-3.5 text-muted-foreground/50 dark:text-[#69717D]" strokeWidth={1.75} />
          )}
          {clickable && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          )}
        </div>
      </div>

      {/* 2. Valor Principal + Variação Calculada Real */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="font-display text-2xl font-bold tracking-tight text-foreground dark:text-[#F1F3F5] sm:text-[26px] leading-none">
          {value}
        </div>

        {delta && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-semibold shrink-0",
              delta.isNeutral
                ? "text-muted-foreground dark:text-[#A0A7B2]"
                : delta.isPositive
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {delta.isNeutral ? (
              <Minus className="mr-0.5 h-3 w-3" />
            ) : delta.isPositive ? (
              <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
            )}
            {delta.value}
          </span>
        )}
      </div>

      {/* 3. Informações Secundárias */}
      {(subtitle || badge) && (
        <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-border/40 dark:border-white/[0.04] pt-1.5 text-[10.5px] text-muted-foreground/80 dark:text-[#A0A7B2]">
          <span className="leading-tight tracking-tight min-w-0">{subtitle || ""}</span>
          {badge && (
            <span
              className={cn(
                "inline-flex items-center rounded border px-1.5 py-0.5 text-[9px] font-semibold shrink-0 uppercase tracking-wider",
                badge.variant === "warning" && "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
                badge.variant === "destructive" && "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                badge.variant === "success" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                badge.variant === "info" && "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400",
                (!badge.variant || badge.variant === "neutral") && "border-border/80 bg-muted/30 text-muted-foreground"
              )}
            >
              {badge.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
