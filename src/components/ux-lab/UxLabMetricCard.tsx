import React from "react";
import { LucideIcon, ArrowUpRight, ArrowDownRight, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface UxLabMetricCardProps {
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

export const UxLabMetricCard: React.FC<UxLabMetricCardProps> = ({
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
        "dark:border-border/40 dark:bg-card dark:shadow-none",
        clickable && "cursor-pointer hover:border-blue-500/40 hover:bg-muted/15 dark:hover:border-slate-700/50 dark:hover:bg-muted/25 hover:shadow-xs",
        className
      )}
    >
      {/* 1. Nome do Indicador + Micro-chevron / Ícone sutil */}
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
          {label}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {Icon && (
            <Icon className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.75} />
          )}
          {clickable && (
            <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          )}
        </div>
      </div>

      {/* 2. Valor Principal (Elemento Dominante) + Variação Essencial Discreta */}
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[26px] leading-none">
          {value}
        </div>

        {delta && (
          <span
            className={cn(
              "inline-flex items-center text-xs font-semibold shrink-0",
              delta.isNeutral
                ? "text-muted-foreground"
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

      {/* 3. Informações Secundárias (Contexto Discreto e Neutro) */}
      {(subtitle || badge) && (
        <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 dark:border-border/25 pt-1.5 text-[11px] text-muted-foreground/75 dark:text-muted-foreground/70">
          <span className="truncate">{subtitle || ""}</span>
          {badge && (
            <span className="inline-flex items-center rounded border border-border/70 dark:border-border/40 bg-muted/50 dark:bg-muted/30 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground shrink-0">
              {badge.text}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
