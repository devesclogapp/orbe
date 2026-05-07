import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Coffee,
  DollarSign,
  Loader2,
  LogIn,
  LogOut,
  Timer,
  User,
  UtensilsCrossed,
  Zap,
} from "lucide-react";

import { useSelection } from "@/contexts/SelectionContext";
import { cn } from "@/lib/utils";
import { PontoService } from "@/services/base.service";

import { StatusChip } from "../painel/StatusChip";

const calculateWorkedHours = (row: any): string => {
  if (!row.entrada || !row.saida) return "-";
  try {
    const entrada = row.entrada.includes(":") ? row.entrada.slice(0,5).split(":") : ["0","0"];
    const saida = row.saida.includes(":") ? row.saida.slice(0,5).split(":") : ["0","0"];
    const entradaMin = parseInt(entrada[0]) * 60 + parseInt(entrada[1]);
    const saidaMin = parseInt(saida[0]) * 60 + parseInt(saida[1]);
    const almoco = (row.saida_almoco && row.retorno_almoco) ? 
      (parseInt(row.retorno_almoco.slice(0,5).split(":")[0]) * 60 + parseInt(row.retorno_almoco.slice(0,5).split(":")[1])) -
      (parseInt(row.saida_almoco.slice(0,5).split(":")[0]) * 60 + parseInt(row.saida_almoco.slice(0,5).split(":")[1])) : 0;
    const diff = saidaMin - entradaMin - almoco;
    if (diff <= 0) return "0h00";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  } catch {
    return "-";
  }
};

type PontoTableBlockProps = {
  month: string;
  monthLabel: string;
  empresaId: string;
};

export const PontoTableBlock = ({ month, monthLabel, empresaId }: PontoTableBlockProps) => {
  const { id: selectedId, kind, select } = useSelection();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ponto", month, empresaId],
    queryFn: () => PontoService.getByMonth(month, empresaId === "all" ? undefined : empresaId),
  });

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground min-h-[300px] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        Carregando registros de ponto...
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="esc-table-header">
          <tr className="text-left font-display">
            <th className="px-5 font-semibold py-3"><span className="inline-flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-muted-foreground" />Colaborador</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogIn className="h-3.5 w-3.5 text-muted-foreground" />Entrada</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><UtensilsCrossed className="h-3.5 w-3.5 text-muted-foreground" />Saida almoco</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Coffee className="h-3.5 w-3.5 text-muted-foreground" />Retorno almoco</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><LogOut className="h-3.5 w-3.5 text-muted-foreground" />Saida</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5 text-muted-foreground" />Horas</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-muted-foreground" />Extras</span></th>
            <th className="px-3 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />Tipo dia</span></th>
            <th className="px-3 font-semibold text-right"><span className="inline-flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" />Valor do dia</span></th>
            <th className="px-5 font-semibold text-center"><span className="inline-flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />Status</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any) => {
            const isSelected = kind === "colaborador" && selectedId === row.colaborador_id;
            return (
              <tr
                key={row.id}
                onClick={() => select("colaborador", row.colaborador_id)}
                className={cn(
                  "esc-table-row cursor-pointer transition-all",
                  row.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-5 py-3">
                  <div className="font-medium text-foreground">
                    {row.colaboradores?.nome || row.nome_colaborador || "-"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.colaboradores?.cargo || row.cargo_colaborador || "-"} · 
                    {row.colaboradores?.empresas?.nome || "-"}
                  </div>
                </td>
                <td className="px-3 text-center text-foreground">{row.entrada ? row.entrada.slice(0,5) : "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.saida_almoco ? row.saida_almoco.slice(0,5) : "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.retorno_almoco ? row.retorno_almoco.slice(0,5) : "-"}</td>
                <td className="px-3 text-center text-foreground">{row.saida ? row.saida.slice(0,5) : "-"}</td>
                <td className="px-3 text-center font-display font-medium">
                  {row.horas_trabalhadas || (row.entrada && row.saida ? calculateWorkedHours(row) : "-")}
                </td>
                <td className="px-3 text-center text-muted-foreground">{row.hora_extra || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.tipo_dia || "-"}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">
                  R$ {Number(row.valor_dia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 text-center">
                  <StatusChip status={row.status} label={row.status} />
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="p-12 text-center text-muted-foreground italic">Nenhum registro encontrado para {monthLabel}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
