import React from "react";
import { cn } from "@/lib/utils";
import { LucideIcon, Search } from "lucide-react";

export interface OrbeInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
  dense?: boolean;
}

/**
 * OrbeInput
 * 
 * Campo de input padrão do ORBE Design System.
 * Otimizado para densidade ERP e suporte a temas Light e Dark.
 */
export const OrbeInput = React.forwardRef<HTMLInputElement, OrbeInputProps>(
  ({ icon: Icon, dense = true, className, type = "text", ...props }, ref) => {
    return (
      <div className="relative flex-1 min-w-[180px]">
        {Icon && (
          <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
            <Icon className="h-3.5 w-3.5" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={cn(
            "w-full rounded-lg border border-border/80 dark:border-white/[0.08] bg-background dark:bg-[#111419] text-foreground placeholder:text-muted-foreground text-xs shadow-2xs transition-colors",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:border-blue-600 dark:focus-visible:border-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            dense ? "h-8 py-1" : "h-9 py-1.5",
            Icon ? "pl-8 pr-2.5" : "px-2.5",
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

OrbeInput.displayName = "OrbeInput";

/**
 * OrbeSearchInput
 * 
 * Atalho semântico para campo de busca com ícone de lupa.
 */
export const OrbeSearchInput = React.forwardRef<HTMLInputElement, Omit<OrbeInputProps, "icon">>(
  (props, ref) => {
    return <OrbeInput ref={ref} icon={Search} placeholder="Filtrar ou pesquisar..." {...props} />;
  }
);

OrbeSearchInput.displayName = "OrbeSearchInput";

export interface OrbeSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  dense?: boolean;
}

/**
 * OrbeSelect
 * 
 * Select nativo estilizado do ORBE Design System.
 */
export const OrbeSelect = React.forwardRef<HTMLSelectElement, OrbeSelectProps>(
  ({ dense = true, className, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          "rounded-lg border border-border/80 dark:border-white/[0.08] bg-background dark:bg-[#111419] text-foreground text-xs shadow-2xs transition-colors px-2.5",
          "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 focus-visible:border-blue-600 dark:focus-visible:border-blue-500",
          "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
          dense ? "h-8 py-1" : "h-9 py-1.5",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

OrbeSelect.displayName = "OrbeSelect";
