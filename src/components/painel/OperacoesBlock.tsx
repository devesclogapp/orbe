import { Boxes, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusChip } from "./StatusChip";

const ops = [
  { id: "OP-1041", transp: "Transvolume", servico: "Volume", qtd: 320, ini: "08:00", fim: "11:30", produto: "Eletro", status: "ok" as const, valor: "R$ 1.280,00" },
  { id: "OP-1042", transp: "RodoCarga", servico: "Carro", qtd: 4, ini: "09:15", fim: "12:00", produto: "Móveis", status: "inconsistente" as const, valor: "R$ 920,00", alert: true },
  { id: "OP-1043", transp: "Transvolume", servico: "Volume", qtd: 180, ini: "13:00", fim: "15:40", produto: "Bebidas", status: "pendente" as const, valor: "R$ 720,00" },
  { id: "OP-1044", transp: "Express SP", servico: "Carro", qtd: 2, ini: "14:00", fim: "16:30", produto: "Diversos", status: "ok" as const, valor: "R$ 460,00" },
  { id: "OP-1045", transp: "RodoCarga", servico: "Volume", qtd: 500, ini: "16:00", fim: "16:20", produto: "Eletro", status: "inconsistente" as const, valor: "R$ 2.000,00", alert: true },
];

export const OperacoesBlock = () => {
  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Boxes className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground">Operações</h2>
          <span className="esc-chip bg-secondary text-foreground ml-1">Manual</span>
        </div>
        <Button size="sm" className="h-8">
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova operação
        </Button>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="esc-table-header">
            <tr className="text-left">
              <th className="px-5 h-11 font-medium">Operação</th>
              <th className="px-3 h-11 font-medium">Transportadora</th>
              <th className="px-3 h-11 font-medium text-center">Serviço</th>
              <th className="px-3 h-11 font-medium text-center">Qtd</th>
              <th className="px-3 h-11 font-medium text-center">Início</th>
              <th className="px-3 h-11 font-medium text-center">Fim</th>
              <th className="px-3 h-11 font-medium text-right">Valor</th>
              <th className="px-3 h-11 font-medium text-center">Status</th>
              <th className="px-5 h-11 font-medium text-center">Ações</th>
            </tr>
          </thead>
          <tbody>
            {ops.map((o) => (
              <tr key={o.id} className={`border-t border-muted hover:bg-background transition-colors ${o.alert ? "bg-rowAlert border-l-[3px] border-l-primary" : ""}`}>
                <td className="px-5 h-[52px]">
                  <div className="font-medium text-foreground">{o.id}</div>
                  <div className="text-xs text-muted-foreground">{o.produto}</div>
                </td>
                <td className="px-3 text-foreground">{o.transp}</td>
                <td className="px-3 text-center text-muted-foreground">{o.servico}</td>
                <td className="px-3 text-center font-display font-medium">{o.qtd}</td>
                <td className="px-3 text-center text-muted-foreground">{o.ini}</td>
                <td className="px-3 text-center text-muted-foreground">{o.fim}</td>
                <td className="px-3 text-right font-display font-semibold text-foreground">{o.valor}</td>
                <td className="px-3 text-center"><StatusChip status={o.status} /></td>
                <td className="px-5">
                  <div className="flex items-center justify-center gap-1">
                    <button className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button className="h-7 w-7 rounded-md hover:bg-destructive-soft flex items-center justify-center text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
