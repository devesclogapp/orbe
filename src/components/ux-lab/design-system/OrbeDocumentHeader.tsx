import React from "react";
import { cn } from "@/lib/utils";
import { FileText, Building2, Calendar, Clock, ShieldCheck } from "lucide-react";
import { OrbeBadge } from "./OrbeBadge";

export interface OrbeDocumentHeaderProps {
  reportCode: string;
  reportTitle: string;
  empresaNome: string;
  competencia: string;
  dataEmissao?: string;
  badgeText?: string;
  className?: string;
}

/**
 * OrbeDocumentHeader
 * 
 * Cabeçalho Documental Canônico para Relatórios Analíticos e Dossiês Oficiais.
 * Padrão homologado no R01.
 */
export const OrbeDocumentHeader: React.FC<OrbeDocumentHeaderProps> = ({
  reportCode,
  reportTitle,
  empresaNome,
  competencia,
  dataEmissao = new Date().toLocaleDateString("pt-BR"),
  badgeText = "Oficial",
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl px-4 sm:px-5 py-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">
              {reportCode}
            </span>
            <span className="text-xs font-bold text-foreground">• {reportTitle}</span>
            <OrbeBadge variant="institutional">{badgeText}</OrbeBadge>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap pt-0.5">
            <span className="flex items-center gap-1">
              <Building2 className="h-3 w-3" />
              {empresaNome}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {competencia}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-border/40">
        <div className="flex items-center gap-1.5 font-mono text-[11px]">
          <Clock className="h-3 w-3" />
          <span>Emitido: {dataEmissao}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Assinatura Digital</span>
        </div>
      </div>
    </div>
  );
};
