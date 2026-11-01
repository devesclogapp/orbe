import React from "react";
import { cn } from "@/lib/utils";

export type OrbeCardVariant =
  | "surface"
  | "kpi"
  | "analytical"
  | "compact"
  | "interactive"
  | "document";

export interface OrbeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: OrbeCardVariant;
  selected?: boolean;
  interactive?: boolean;
  children: React.ReactNode;
}

/**
 * OrbeCard
 * 
 * Componente unificado de Cards do ORBE Design System.
 * Regra: Evitar aninhamento excessivo (máximo 1 nível interno).
 */
export const OrbeCard = React.forwardRef<HTMLDivElement, OrbeCardProps>(
  (
    {
      variant = "surface",
      selected = false,
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<OrbeCardVariant, string> = {
      surface: "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-4 sm:p-5 shadow-xs",
      kpi: "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-3.5 sm:p-4 shadow-xs flex flex-col justify-between",
      analytical: "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-4 sm:p-5 shadow-xs space-y-3",
      compact: "bg-card dark:bg-[#15191F] border border-border/60 dark:border-white/[0.05] rounded-lg p-3 shadow-2xs",
      interactive: "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-3.5 sm:p-4 shadow-xs transition-all cursor-pointer hover:border-border-strong hover:bg-muted/30 dark:hover:bg-[#1A1F27] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30",
      document: "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl px-4 sm:px-5 py-3.5 shadow-xs",
    };

    const selectedStyles = selected
      ? "border-blue-600 dark:border-blue-500 bg-blue-50/20 dark:bg-[#1A1F27] ring-1 ring-blue-600/40 dark:ring-blue-500/40 shadow-xs"
      : "";

    return (
      <div
        ref={ref}
        className={cn(
          variantStyles[variant],
          interactive && variant !== "interactive" && "cursor-pointer transition-colors hover:bg-muted/20 dark:hover:bg-[#1A1F27]",
          selectedStyles,
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

OrbeCard.displayName = "OrbeCard";
