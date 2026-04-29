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

type PontoTableBlockProps = {
  date: string;
  empresaId: string;
};

export const PontoTableBlock = ({ date, empresaId }: PontoTableBlockProps) => {
  const { id: selectedId, kind, select } = useSelection();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ponto", date, empresaId],
    queryFn: () => PontoService.getByDate(date, empresaId === "all" ? undefined : empresaId),
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
                  <div className="font-medium text-foreground">{row.colaboradores?.nome}</div>
                  <div className="text-xs text-muted-foreground">{row.colaboradores?.cargo} · {row.colaboradores?.empresas?.nome}</div>
                </td>
                <td className="px-3 text-center text-foreground">{row.entrada || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.saida_almoco || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.retorno_almoco || "-"}</td>
                <td className="px-3 text-center text-foreground">{row.saida || "-"}</td>
                <td className="px-3 text-center font-display font-medium">{row.horas_trabalhadas || "0h00"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.horas_extras || "-"}</td>
                <td className="px-3 text-center text-muted-foreground">{row.tipo_dia}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">
                  R$ {Number(row.valor_dia || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-5 text-center"><StatusChip status={row.status} /></td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={10} className="p-12 text-center text-muted-foreground italic">Nenhum registro encontrado para {date}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
