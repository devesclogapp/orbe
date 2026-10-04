import React from "react";
import { cn } from "@/lib/utils";

export interface OrbePageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  badge?: React.ReactNode;
  title: string | React.ReactNode;
  description?: string | React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * OrbePageHeader
 * 
 * Cabeçalho unificado de página do ORBE ERP.
 * Padroniza o H1 institucional, descrição e bloco de ações.
 */
export const OrbePageHeader: React.FC<OrbePageHeaderProps> = ({
  badge,
  title,
  description,
  actions,
  className,
  ...props
}) => {
  return (
    <header
      className={cn(
        "flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2 border-b border-border/60 dark:border-white/[0.05]",
        className
      )}
      {...props}
    >
      <div className="space-y-1">
        {badge && <div className="mb-1">{badge}</div>}
        <h1 className="text-lg sm:text-xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {actions}
        </div>
      )}
    </header>
  );
};
