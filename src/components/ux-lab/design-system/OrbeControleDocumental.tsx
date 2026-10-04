import React from "react";
import { cn } from "@/lib/utils";
import { ShieldCheck, Database, FileCheck } from "lucide-react";

export interface OrbeControleDocumentalProps {
  reportCode: string;
  totalRegistros: number;
  fonte: string;
  criterios?: string;
  hashRastreabilidade?: string;
  className?: string;
}

/**
 * OrbeControleDocumental
 * 
 * Bloco compacto de rastreabilidade, assinatura técnica e governança documental do ORBE ERP.
 * Padrão homologado no R01.
 */
export const OrbeControleDocumental: React.FC<OrbeControleDocumentalProps> = ({
  reportCode,
  totalRegistros,
  fonte,
  criterios = "Registros processados e consolidados na competência ativa",
  hashRastreabilidade = "ORBE-SEC-7FA92C",
  className,
}) => {
  return (
    <div
      className={cn(
        "bg-card dark:bg-[#15191F] border border-border/80 dark:border-white/[0.06] rounded-xl p-3.5 sm:p-4 shadow-2xs space-y-2 text-xs text-muted-foreground",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/50 dark:border-white/[0.04] pb-2">
        <div className="flex items-center gap-1.5 font-bold font-display text-foreground text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Controle Documental & Auditoria</span>
        </div>
        <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          <Database className="h-3 w-3" />
          <span>Hash: {hashRastreabilidade}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px]">
        <div>
          <span className="font-semibold text-foreground">Relatório:</span>{" "}
          <span className="font-mono">{reportCode}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Total de Registros:</span>{" "}
          <span className="font-mono">{totalRegistros}</span>
        </div>
        <div>
          <span className="font-semibold text-foreground">Fonte:</span> {fonte}
        </div>
      </div>

      <div className="text-[11px] pt-1 text-muted-foreground flex items-center gap-1 border-t border-border/30 dark:border-white/[0.02]">
        <FileCheck className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className="truncate">Critérios aplicados: {criterios}</span>
      </div>
    </div>
  );
};
