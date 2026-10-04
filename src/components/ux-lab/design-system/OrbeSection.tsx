import React from "react";
import { cn } from "@/lib/utils";

export interface OrbeSectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * OrbeSection
 * 
 * Seção estrutural analítica com título H2, descrição opcional e área de conteúdo.
 */
export const OrbeSection: React.FC<OrbeSectionProps> = ({
  title,
  description,
  badge,
  actions,
  children,
  className,
  ...props
}) => {
  return (
    <section className={cn("space-y-3.5", className)} {...props}>
      {(title || actions || badge) && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            {badge}
            {title && (
              <h2 className="text-sm sm:text-base font-bold font-display text-foreground tracking-tight">
                {title}
              </h2>
            )}
            {description && (
              <span className="text-xs text-muted-foreground hidden md:inline">
                • {description}
              </span>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div>{children}</div>
    </section>
  );
};
