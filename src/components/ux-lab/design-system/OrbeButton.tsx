import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

export type OrbeButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
export type OrbeButtonSize = "sm" | "md" | "lg" | "icon-sm" | "icon-md";

export interface OrbeButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: OrbeButtonVariant;
  size?: OrbeButtonSize;
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  loading?: boolean;
}

/**
 * OrbeButton
 * 
 * Botão oficial do ORBE Design System.
 * Primário estritamente em Royal Blue (#2563EB). Sem botões institucionais laranjas.
 */
export const OrbeButton = React.forwardRef<HTMLButtonElement, OrbeButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      icon: Icon,
      iconRight: IconRight,
      loading = false,
      className,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const variantStyles: Record<OrbeButtonVariant, string> = {
      primary:
        "bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white font-semibold shadow-xs border border-blue-500/30 dark:border-blue-400/20 focus-visible:ring-2 focus-visible:ring-blue-600/40",
      secondary:
        "bg-card dark:bg-[#15191F] hover:bg-muted/60 dark:hover:bg-[#1A1F27] text-foreground font-medium border border-border/80 dark:border-white/[0.08] shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-600/30",
      ghost:
        "bg-transparent hover:bg-muted/50 dark:hover:bg-white/[0.04] text-muted-foreground hover:text-foreground font-medium border border-transparent focus-visible:ring-2 focus-visible:ring-blue-600/30",
      destructive:
        "bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold shadow-xs border border-rose-500/30 focus-visible:ring-2 focus-visible:ring-rose-600/40",
    };

    const sizeStyles: Record<OrbeButtonSize, string> = {
      sm: "h-8 px-2.5 text-xs rounded-lg gap-1.5",
      md: "h-9 px-3.5 text-xs rounded-lg gap-1.5",
      lg: "h-10 px-4 text-sm rounded-lg gap-2",
      "icon-sm": "h-8 w-8 p-0 rounded-lg justify-center",
      "icon-md": "h-9 w-9 p-0 rounded-lg justify-center",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center transition-all duration-150 select-none cursor-pointer focus-visible:outline-none disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
        ) : Icon ? (
          <Icon className="h-3.5 w-3.5 shrink-0" />
        ) : null}
        {children}
        {IconRight && !loading && <IconRight className="h-3.5 w-3.5 shrink-0" />}
      </button>
    );
  }
);

OrbeButton.displayName = "OrbeButton";
