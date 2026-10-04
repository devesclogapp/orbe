import React, { useEffect } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { OrbeButton } from "./OrbeButton";

export interface OrbeDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footerActions?: React.ReactNode;
  size?: "md" | "lg" | "xl";
}

/**
 * OrbeDrawer
 * 
 * Shell Oficial de Drawer Especialista do ORBE ERP.
 * Suporta o fluxo canônico de 4 blocos:
 * 1. Diagnóstico / Status
 * 2. Pipeline / Stepper
 * 3. Contexto e Dados Especializados
 * 4. Ação / Despacho
 */
export const OrbeDrawer: React.FC<OrbeDrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  badge,
  children,
  footerActions,
  size = "lg",
}) => {
  // Tratar tecla ESC para fechamento
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const sizeClasses = {
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-3xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay com opacidade padronizada */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div
        className={cn(
          "relative z-50 w-full h-full bg-card dark:bg-[#15191F] text-foreground border-l border-border/80 dark:border-white/[0.08] shadow-2xl flex flex-col min-h-0 animate-in slide-in-from-right duration-200",
          sizeClasses[size]
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border/80 dark:border-white/[0.06] bg-muted/20 dark:bg-[#111419] shrink-0">
          <div className="space-y-1 pr-4 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {badge}
              <h2 className="text-sm sm:text-base font-bold font-display tracking-tight text-foreground truncate">
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>

          <OrbeButton
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Fechar (ESC)"
            className="shrink-0"
          >
            <X className="h-4 w-4" />
          </OrbeButton>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 min-h-0">
          {children}
        </div>

        {/* Sticky Footer */}
        {footerActions && (
          <div className="p-3.5 sm:p-4 border-t border-border/80 dark:border-white/[0.06] bg-muted/20 dark:bg-[#111419] flex items-center justify-end gap-2.5 shrink-0">
            {footerActions}
          </div>
        )}
      </div>
    </div>
  );
};
