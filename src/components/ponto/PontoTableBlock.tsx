import { useSelection } from "@/contexts/SelectionContext";
import { cn } from "@/lib/utils";

import { StatusChip } from "../painel/StatusChip";
import { getOperationalStatus } from "@/constants/operationalStatus";
import { Badge } from "../ui/badge";

const calculateWorkedHours = (row: any): string => {
  if (!row.entrada || !row.saida) return "-";
  try {
    const entrada = row.entrada.includes(":") ? row.entrada.slice(0, 5).split(":") : ["0", "0"];
    const saida = row.saida.includes(":") ? row.saida.slice(0, 5).split(":") : ["0", "0"];
    const entradaMin = parseInt(entrada[0]) * 60 + parseInt(entrada[1]);
    const saidaMin = parseInt(saida[0]) * 60 + parseInt(saida[1]);
    const almoco = (row.saida_almoco && row.retorno_almoco) ?
      (parseInt(row.retorno_almoco.slice(0, 5).split(":")[0]) * 60 + parseInt(row.retorno_almoco.slice(0, 5).split(":")[1])) -
      (parseInt(row.saida_almoco.slice(0, 5).split(":")[0]) * 60 + parseInt(row.saida_almoco.slice(0, 5).split(":")[1])) : 0;
    const diff = saidaMin - entradaMin - almoco;
    if (diff <= 0) return "0h00";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  } catch {
    return "-";
  }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return "-";
  try {
    const normalized = String(dateStr).trim();

    // `YYYY-MM-DD` vindo do banco representa uma data civil, não um instante em UTC.
    // Usar `new Date("2026-05-27")` em fusos negativos (ex.: Brasil) faz a UI voltar 1 dia.
    const localDateMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (localDateMatch) {
      const [, year, month, day] = localDateMatch;
      return `${day}/${month}/${year}`;
    }

    return new Date(normalized).toLocaleDateString("pt-BR");
  } catch {
    return "-";
  }
};

type PontoTableBlockProps = {
  month: string;
  monthLabel: string;
  empresaId: string;
  rows: any[];
};

// Legacy functions removed in favor of centralized operationalStatus.ts config

export const PontoTableBlock = ({ monthLabel, rows }: PontoTableBlockProps) => {
  const { id: selectedId, kind, select } = useSelection();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="esc-table-header">
          <tr className="text-center font-display text-[11px]">
            <th className="px-2 py-2 font-semibold">Data</th>
            <th className="px-2 py-2 font-semibold">Empresa</th>
            <th className="px-2 py-2 font-semibold text-left">Colaborador</th>
            <th className="px-2 py-2 font-semibold">Matrícula</th>
            <th className="px-2 py-2 font-semibold">CPF</th>
            <th className="px-2 py-2 font-semibold text-left">Cargo</th>
            <th className="px-2 py-2 font-semibold">Entrada</th>
            <th className="px-2 py-2 font-semibold">S. Almoço</th>
            <th className="px-2 py-2 font-semibold">Retorno</th>
            <th className="px-2 py-2 font-semibold">Saída</th>
            <th className="px-2 py-2 font-semibold">Horas</th>
            <th className="px-2 py-2 font-semibold">Extras</th>
            <th className="px-2 py-2 font-semibold">Falta</th>
            <th className="px-2 py-2 font-semibold">Atraso</th>
            <th className="px-2 py-2 font-semibold">Status</th>
            <th className="px-2 py-2 font-semibold">Proc. RH</th>
            <th className="px-2 py-2 font-semibold">Comp.</th>
            <th className="px-2 py-2 font-semibold">Origem</th>
            <th className="px-2 py-2 font-semibold text-left">Obs</th>
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
                  "esc-table-row cursor-pointer transition-all border-b border-muted/50",
                  row.status === "inconsistente" && "bg-rowAlert border-l-[3px] border-l-primary",
                  isSelected && "bg-primary-soft/40 border-l-[3px] border-l-primary"
                )}
              >
                <td className="px-2 py-2 text-center text-foreground whitespace-nowrap">{formatDate(row.data)}</td>
                <td className="px-2 py-2 text-center text-muted-foreground max-w-[100px] truncate">{row.empresas?.nome || row.empresa_nome || "-"}</td>
                <td className="px-2 py-2 text-left text-foreground font-medium max-w-[140px] truncate">
                  {row.colaboradores?.nome || row.nome_colaborador || "-"}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground font-mono text-[10px]">
                  {row.matricula_colaborador || row.colaboradores?.matricula || "-"}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground font-mono text-[10px]">
                  {row.cpf_colaborador || "-"}
                </td>
                <td className="px-2 py-2 text-left text-muted-foreground max-w-[100px] truncate">
                  {row.colaboradores?.cargo || row.cargo_colaborador || "-"}
                </td>
                <td className="px-2 py-2 text-center text-foreground font-mono">{row.entrada ? row.entrada.slice(0, 5) : "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground font-mono">{row.saida_almoco ? row.saida_almoco.slice(0, 5) : "-"}</td>
                <td className="px-2 py-2 text-center text-muted-foreground font-mono">{row.retorno_almoco ? row.retorno_almoco.slice(0, 5) : "-"}</td>
                <td className="px-2 py-2 text-center text-foreground font-mono">{row.saida ? row.saida.slice(0, 5) : "-"}</td>
                <td className="px-2 py-2 text-center font-display font-medium">
                  {row.horas_trabalhadas || (row.entrada && row.saida ? calculateWorkedHours(row) : "-")}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground">{row.hora_extra || "-"}</td>
                <td className="px-2 py-2 text-center">
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.5 rounded",
                    row.falta?.toLowerCase().includes("sim") || row.falta?.toLowerCase().includes("true")
                      ? "bg-destructive-soft text-destructive"
                      : "text-muted-foreground"
                  )}>
                    {row.falta || "-"}
                  </span>
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground">{row.atraso || "-"}</td>
                <td className="px-2 py-2 text-center">
                  <Badge
                    variant={getOperationalStatus(row.status).variant as any}
                    className={cn("text-[10px]", getOperationalStatus(row.status).bg, getOperationalStatus(row.status).color)}
                  >
                    {getOperationalStatus(row.status).label}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-center">
                  <Badge
                    variant={getOperationalStatus(row.status_processamento).variant as any}
                    className={cn("text-[10px]", getOperationalStatus(row.status_processamento).bg, getOperationalStatus(row.status_processamento).color)}
                  >
                    {getOperationalStatus(row.status_processamento).label}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-center font-mono text-[10px] text-muted-foreground">
                  {row.competencia || String(row.data || "").slice(0, 7) || "-"}
                </td>
                <td className="px-2 py-2 text-center text-muted-foreground">
                  {row.origem || "importacao"}
                </td>
                <td className="px-2 py-2 text-left text-muted-foreground max-w-[80px] truncate" title={row.observacoes || ""}>
                  {row.observacoes || "-"}
                </td>
              </tr>
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={19} className="p-12 text-center text-muted-foreground italic">Nenhum registro encontrado para {monthLabel}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
