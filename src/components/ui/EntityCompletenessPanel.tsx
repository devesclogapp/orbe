import React from "react";
import { cn } from "@/lib/utils";
import type { ColaboradorCompletudeDetailed } from "@/services/domain/core.service";

export interface EntityCompletenessPanelProps {
    data: ColaboradorCompletudeDetailed;
    className?: string;
    labels?: {
        operacional?: string;
        rh?: string;
        financeiro?: string;
    };
}

export function EntityCompletenessPanel({ data, className, labels }: EntityCompletenessPanelProps) {
    const opLabel = labels?.operacional || "Apto (Recebendo Pontos)";
    const opPendingLabel = "Pendente";
    const rhPendingPrefix = "Falta: ";
    const finPendingLabel = "Dados bancários pendentes";

    return (
        <div className={cn("grid grid-cols-2 md:grid-cols-4 gap-2 mb-2 pb-2", className)}>
            <div className={cn("p-2 rounded-md border flex flex-col gap-1 items-start text-xs", data.operacional.completo ? "bg-emerald-50 border-emerald-100 text-slate-700" : "bg-rose-50 border-rose-100 text-slate-700")}>
                <span className="font-semibold uppercase tracking-wider text-[10px]">Operacional</span>
                <span className="font-medium">{data.operacional.completo ? opLabel : opPendingLabel}</span>
            </div>
            <div className={cn("p-2 rounded-md border flex flex-col gap-1 items-start text-xs", data.rh.completo ? "bg-emerald-50 border-emerald-100 text-slate-700" : "bg-rose-50 border-rose-100 text-slate-700")}>
                <span className="font-semibold uppercase tracking-wider text-[10px]">RH</span>
                <span className="font-medium">{data.rh.completo ? "OK" : "Pendente"}</span>
                {!data.rh.completo && data.rh.pendencias.length > 0 && (
                    <span className="text-[9px] leading-tight text-slate-500 mt-0.5">{rhPendingPrefix}{data.rh.pendencias.join(", ")}</span>
                )}
            </div>
            <div className={cn("p-2 rounded-md border flex flex-col gap-1 items-start text-xs", data.financeiro.completo ? "bg-emerald-50 border-emerald-100 text-slate-700" : "bg-amber-50 border-amber-100 text-slate-700")}>
                <span className="font-semibold uppercase tracking-wider text-[10px]">Financeiro</span>
                <span className="font-medium">{data.financeiro.completo ? "Apto" : "Pendente"}</span>
                {!data.financeiro.completo && (
                    <span className="text-[9px] leading-tight text-slate-500 mt-0.5">{finPendingLabel}</span>
                )}
            </div>
            <div className="p-2 rounded-md border bg-slate-50 border-slate-200 flex flex-col gap-1 items-start text-xs text-slate-700">
                <span className="font-semibold uppercase tracking-wider text-[10px]">Geral</span>
                <span className="font-medium">{data.geral.percentual}% Completo</span>
            </div>
        </div>
    );
}
