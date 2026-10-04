import React from "react";
import { cn } from "@/lib/utils";
import { Filter, RotateCcw } from "lucide-react";
import { OrbeButton } from "./OrbeButton";

export interface OrbeFilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  activeCount?: number;
  onClear?: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * OrbeFilterBar
 * 
 * Barra transversal de filtros rápidos para tabelas e relatórios.
 * Compacta, com suporte a contagem de filtros ativos e reset rápido.
 */
export const OrbeFilterBar: React.FC<OrbeFilterBarProps> = ({
  activeCount = 0,
  onClear,
  children,
  actions,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-card dark:bg-[#15191F] p-2.5 sm:p-3 rounded-xl border border-border/80 dark:border-white/[0.06] shadow-2xs",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground shrink-0 pr-1">
          <Filter className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden sm:inline">Filtros</span>
          {activeCount > 0 && (
            <span className="h-4 px-1.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 text-[10px] font-mono font-bold border border-blue-200 dark:border-blue-900/40">
              {activeCount}
            </span>
          )}
        </div>

        {children}

        {activeCount > 0 && onClear && (
          <OrbeButton
            variant="ghost"
            size="sm"
            onClick={onClear}
            icon={RotateCcw}
            className="text-[11px] h-8 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
          >
            Limpar
          </OrbeButton>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
          {actions}
        </div>
      )}
    </div>
  );
};
