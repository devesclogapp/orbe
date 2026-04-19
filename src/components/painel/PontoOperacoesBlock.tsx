import { useState } from "react";
import { StatusChip } from "./StatusChip";
import { Clock, RefreshCw, Boxes, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePreferences } from "@/contexts/PreferencesContext";

const pontoRows = [
  { nome: "Jainudin", cargo: "Conferente", entrada: "—", saida: "—", horas: "0h00", extras: "—", periodo: "Diurno", status: "incompleto" as const },
  { nome: "Imelda Hakim", cargo: "Operadora", entrada: "08:02", saida: "17:10", horas: "8h08", extras: "0h08", periodo: "Diurno", status: "ok" as const },
  { nome: "Ita Septiasari", cargo: "Conferente", entrada: "08:00", saida: "18:30", horas: "9h30", extras: "1h30", periodo: "Diurno", status: "ok" as const },
  { nome: "Hendy", cargo: "Operador", entrada: "08:00", saida: "15:05", horas: "6h05", extras: "—", periodo: "Diurno", status: "ajustado" as const },
  { nome: "Hikmat Sofyan", cargo: "Operador", entrada: "08:00", saida: "18:22", horas: "9h22", extras: "1h22", periodo: "Diurno", status: "inconsistente" as const, alert: true },
  { nome: "Ahmad Indrawan", cargo: "Conferente", entrada: "08:00", saida: "16:20", horas: "7h20", extras: "—", periodo: "Diurno", status: "ok" as const },
  { nome: "Joko Joko", cargo: "Operador", entrada: "08:00", saida: "17:12", horas: "8h12", extras: "0h12", periodo: "Diurno", status: "ok" as const },
];

const opsRows = [
  { id: "OP-1041", transp: "Transvolume", servico: "Volume", qtd: 320, ini: "08:00", fim: "11:30", produto: "Eletro", status: "ok" as const, valor: "R$ 1.280,00" },
  { id: "OP-1042", transp: "RodoCarga", servico: "Carro", qtd: 4, ini: "09:15", fim: "12:00", produto: "Móveis", status: "inconsistente" as const, valor: "R$ 920,00", alert: true },
  { id: "OP-1043", transp: "Transvolume", servico: "Volume", qtd: 180, ini: "13:00", fim: "15:40", produto: "Bebidas", status: "pendente" as const, valor: "R$ 720,00" },
  { id: "OP-1044", transp: "Express SP", servico: "Carro", qtd: 2, ini: "14:00", fim: "16:30", produto: "Diversos", status: "ok" as const, valor: "R$ 460,00" },
  { id: "OP-1045", transp: "RodoCarga", servico: "Volume", qtd: 500, ini: "16:00", fim: "16:20", produto: "Eletro", status: "inconsistente" as const, valor: "R$ 2.000,00", alert: true },
];

export const PontoOperacoesBlock = () => {
  const { defaultTab } = usePreferences();
  const [tab, setTab] = useState<"ponto" | "operacoes">(defaultTab);

  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-3 border-b border-border gap-4 flex-wrap">
        <div className="inline-flex items-center bg-muted rounded-lg p-1">
          <TabButton active={tab === "ponto"} onClick={() => setTab("ponto")} icon={<Clock className="h-3.5 w-3.5" />}>
            Ponto
          </TabButton>
          <TabButton active={tab === "operacoes"} onClick={() => setTab("operacoes")} icon={<Boxes className="h-3.5 w-3.5" />}>
            Operações
          </TabButton>
        </div>

        {tab === "ponto" ? (
          <button className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" /> Sincronizado há 2 min
          </button>
        ) : (
          <Button size="sm" className="h-8">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nova operação
          </Button>
        )}
      </header>

      {tab === "ponto" ? <PontoTable /> : <OperacoesTable />}
    </section>
  );
};

const TabButton = ({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-sm font-medium transition-colors",
      active
        ? "bg-card text-foreground shadow-sm"
        : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {children}
  </button>
);

const PontoTable = () => (
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
        {pontoRows.map((r, i) => (
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
);

const OperacoesTable = () => (
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
        {opsRows.map((o) => (
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
);
