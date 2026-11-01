import React from "react";
import { cn } from "@/lib/utils";

export interface OrbePageContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Se deve aplicar o padding horizontal padrão (p-4 md:p-6). Padrão: true */
  padded?: boolean;
  /** Se deve aplicar o max-width oficial de 1560px. Padrão: true */
  maxWidth?: boolean;
}

/**
 * OrbePageContainer
 * 
 * Container de layout oficial transversal para todas as telas do ORBE ERP.
 * Define o workspace max de 1560px e espaçamentos padrão.
 */
export const OrbePageContainer: React.FC<OrbePageContainerProps> = ({
  children,
  padded = true,
  maxWidth = true,
  className,
  ...props
}) => {
  return (
    <div
      className={cn(
        "w-full flex-1 min-h-0 flex flex-col space-y-6 pb-16",
        maxWidth && "max-w-[1560px] mx-auto",
        padded && "p-4 md:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
