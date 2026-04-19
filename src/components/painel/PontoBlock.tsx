import { StatusChip } from "./StatusChip";
import { Clock, RefreshCw } from "lucide-react";

const rows = [
  { nome: "Jainudin", cargo: "Conferente", entrada: "—", saida: "—", horas: "0h00", extras: "—", tipo: "Normal", periodo: "Diurno", status: "incompleto" as const },
  { nome: "Imelda Hakim", cargo: "Operadora", entrada: "08:02", saida: "17:10", horas: "8h08", extras: "0h08", tipo: "Normal", periodo: "Diurno", status: "ok" as const },
  { nome: "Ita Septiasari", cargo: "Conferente", entrada: "08:00", saida: "18:30", horas: "9h30", extras: "1h30", tipo: "Normal", periodo: "Diurno", status: "ok" as const },
  { nome: "Hendy", cargo: "Operador", entrada: "08:00", saida: "15:05", horas: "6h05", extras: "—", tipo: "Normal", periodo: "Diurno", status: "ajustado" as const },
  { nome: "Hikmat Sofyan", cargo: "Operador", entrada: "08:00", saida: "18:22", horas: "9h22", extras: "1h22", tipo: "Normal", periodo: "Diurno", status: "inconsistente" as const, alert: true },
  { nome: "Ahmad Indrawan", cargo: "Conferente", entrada: "08:00", saida: "16:20", horas: "7h20", extras: "—", tipo: "Normal", periodo: "Diurno", status: "ok" as const },
  { nome: "Joko Joko", cargo: "Operador", entrada: "08:00", saida: "17:12", horas: "8h12", extras: "0h12", tipo: "Normal", periodo: "Diurno", status: "ok" as const },
];

export const PontoBlock = () => {
  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground">Ponto</h2>
          <span className="esc-chip bg-success-soft text-success-strong ml-1">Automático</span>
        </div>
        <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Sincronizado há 2 min
        </button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="esc-table-header">
            <tr className="text-left">
              <th className="px-5 h-11 font-medium">Colaborador</th>
              <th className="px-3 h-11 font-medium text-center">Entrada</th>
              <th className="px-3 h-11 font-medium text-center">Saída</th>
              <th className="px-3 h-11 font-medium text-center">Horas</th>
              <th className="px-3 h-11 font-medium text-center">Extras</th>
              <th className="px-3 h-11 font-medium text-center">Período</th>
              <th className="px-5 h-11 font-medium text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className={`border-t border-muted hover:bg-background transition-colors ${r.alert ? "bg-rowAlert border-l-[3px] border-l-primary" : ""}`}
              >
                <td className="px-5 h-[52px]">
                  <div className="font-medium text-foreground">{r.nome}</div>
                  <div className="text-xs text-muted-foreground">{r.cargo}</div>
                </td>
                <td className="px-3 text-center text-foreground">{r.entrada}</td>
                <td className="px-3 text-center text-foreground">{r.saida}</td>
                <td className="px-3 text-center font-display font-medium">{r.horas}</td>
                <td className="px-3 text-center text-muted-foreground">{r.extras}</td>
                <td className="px-3 text-center text-muted-foreground">{r.periodo}</td>
                <td className="px-5 text-center"><StatusChip status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
