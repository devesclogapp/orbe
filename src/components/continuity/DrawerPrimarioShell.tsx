import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DrawerPrimarioShellProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  tagline?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  className?: string;
  headerActions?: React.ReactNode;
}

/**
 * DrawerPrimarioShell
 * 
 * Contrato canônico para Drawers Primários (Detalhes) do ORBE:
 * - Abre ao clicar em um registro operacional ou financeiro
 * - Altura útil travada na viewport: h-[100dvh] max-h-[100dvh]
 * - Header fixo (shrink-0) com título, badge, tagline e botão fechar
 * - Corpo com scroll vertical seguro (flex-1 min-h-0 overflow-y-auto overflow-x-hidden)
 * - Footer fixo (shrink-0) para ações de contexto
 * - Z-index padrão: z-50
 */
export const DrawerPrimarioShell: React.FC<DrawerPrimarioShellProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  badge,
  tagline,
  children,
  footer,
  widthClass = "w-full sm:max-w-lg",
  className,
  headerActions,
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className={cn(
          widthClass,
          "h-[100dvh] max-h-[100dvh] p-0 flex flex-col overflow-hidden overflow-x-hidden bg-background border-l border-border shadow-2xl z-50",
          className
        )}
      >
        {/* Header Fixo */}
        <header className="p-5 pb-4 border-b border-border bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between shrink-0">
          <div className="space-y-1 pr-4 min-w-0 flex-1">
            {(badge || tagline) && (
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {badge}
                {tagline && (
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {tagline}
                  </span>
                )}
              </div>
            )}
            <SheetTitle className="font-display text-lg font-bold text-foreground text-left truncate">
              {title}
            </SheetTitle>
            {subtitle && (
              <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
                {subtitle}
              </SheetDescription>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {headerActions}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
              onClick={onClose}
              aria-label="Fechar painel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Corpo com Scroll Vertical e Proteção min-h-0 */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 space-y-5">
          {children}
        </div>

        {/* Footer Fixo */}
        {footer && (
          <footer className="p-4 border-t border-border bg-slate-50/70 dark:bg-slate-900/50 shrink-0">
            {footer}
          </footer>
        )}
      </SheetContent>
    </Sheet>
  );
};
