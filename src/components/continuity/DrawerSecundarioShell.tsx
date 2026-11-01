import React from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface DrawerSecundarioShellProps {
  isOpen: boolean;
  onBack?: () => void;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  tagline?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  widthClass?: string;
  className?: string;
  zIndexClass?: string;
  headerActions?: React.ReactNode;
  hideOverlay?: boolean;
}

/**
 * DrawerSecundarioShell
 * 
 * Contrato canônico para Drawers Secundários (Fluxo Completo / Linha do Tempo) do ORBE:
 * - Aberto a partir da ação "Ver fluxo completo →"
 * - Camada superior sobreposta ao Drawer Primário (z-[60])
 * - Altura útil travada na viewport: h-[100dvh] max-h-[100dvh]
 * - Mesma geometria, largura canônica, top, bottom e borda direita do Drawer Primário
 * - Único Backdrop: hideOverlay=true por padrão para não duplicar o backdrop já aberto pelo primário
 * - Header fixo (shrink-0) com ação nativa "← Voltar aos detalhes", título e botão fechar
 * - Corpo com scroll vertical seguro (flex-1 min-h-0 overflow-y-auto overflow-x-hidden)
 * - Footer fixo (shrink-0) para ações de continuidade
 * - Fecha respeitando a pilha: "Voltar aos detalhes" retorna ao primário sem fechá-lo
 */
export const DrawerSecundarioShell: React.FC<DrawerSecundarioShellProps> = ({
  isOpen,
  onBack,
  onClose,
  title,
  subtitle,
  badge,
  tagline,
  children,
  footer,
  widthClass = "w-full sm:max-w-lg",
  className,
  zIndexClass = "z-[60]",
  headerActions,
  hideOverlay = true,
}) => {
  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        hideOverlay={hideOverlay}
        className={cn(
          widthClass,
          zIndexClass,
          "h-[100dvh] max-h-[100dvh] p-0 flex flex-col overflow-hidden overflow-x-hidden bg-background border-l border-border shadow-2xl",
          className
        )}
      >
        {/* Header Fixo com Botão "Voltar aos detalhes" e Alinhamento Preciso */}
        <header className="p-5 pb-4 border-b border-border bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between shrink-0">
          <div className="space-y-1 pr-4 min-w-0 flex-1">
            {onBack && (
              <div className="mb-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="h-7 px-2 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1.5 shrink-0 -ml-1"
                  title="Voltar aos detalhes consolidados"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Voltar aos detalhes</span>
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <SheetTitle className="font-display text-lg font-bold text-foreground text-left truncate">
                {title}
              </SheetTitle>
              {badge}
            </div>

            {(subtitle || tagline) && (
              <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
                {subtitle || tagline}
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
              aria-label="Fechar fluxo completo"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Corpo com Scroll Vertical e Proteção min-h-0 */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 space-y-4">
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
