import React from "react";
import { cn } from "@/lib/utils";

export type OrbeBadgeVariant = "institutional" | "neutral" | "outline" | "solid";

export interface OrbeBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: OrbeBadgeVariant;
  children: React.ReactNode;
}

/**
 * OrbeBadge (Institutional)
 * 
 * Badge Institucional do ORBE ERP para rótulos de contexto, categorias documentais e tags do sistema.
 * Restrito a Royal Blue e tons Neutros.
 */
export const OrbeBadge: React.FC<OrbeBadgeProps> = ({
  variant = "institutional",
  children,
  className,
  ...props
}) => {
  const variantStyles: Record<OrbeBadgeVariant, string> = {
    institutional:
      "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50",
    neutral:
      "bg-muted/60 text-muted-foreground border-border/70 dark:bg-white/[0.04] dark:text-[#A0A7B2] dark:border-white/[0.08]",
    outline:
      "bg-transparent text-foreground border-border/80 dark:border-white/[0.12] dark:text-[#F1F3F5]",
    solid:
      "bg-[#2563EB] text-white border-transparent shadow-2xs font-semibold",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[6px] border px-2 py-0.5 text-[11px] font-medium leading-none select-none tracking-tight",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
};
