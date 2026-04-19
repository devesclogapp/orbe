import { AppShell } from "@/components/layout/AppShell";
import { importacoes } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { RefreshCw, Upload, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const statusMap = {
  sucesso: { label: "Sucesso", icon: CheckCircle2, cls: "bg-success-soft text-success-strong" },
  erro: { label: "Erro", icon: XCircle, cls: "bg-destructive-soft text-destructive-strong" },
  parcial: { label: "Parcial", icon: AlertCircle, cls: "bg-warning-soft text-warning-strong" },
};

const Importacoes = () => {
  return (
    <AppShell title="Importações" subtitle="Histórico de sincronizações de ponto">
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline"><Upload className="h-4 w-4 mr-1.5" /> Importar CSV</Button>
          <Button><RefreshCw className="h-4 w-4 mr-1.5" /> Sincronizar agora</Button>
        </div>
        <section className="esc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="esc-table-header">
              <tr className="text-left">
                <th className="px-5 h-11 font-medium">ID</th>
                <th className="px-3 h-11 font-medium">Data / hora</th>
                <th className="px-3 h-11 font-medium">Origem</th>
                <th className="px-3 h-11 font-medium">Empresa</th>
                <th className="px-3 h-11 font-medium text-center">Registros</th>
                <th className="px-3 h-11 font-medium text-center">Duração</th>
                <th className="px-5 h-11 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {importacoes.map((i) => {
                const s = statusMap[i.status];
                const Icon = s.icon;
                return (
                  <tr key={i.id} className="border-t border-muted hover:bg-background">
                    <td className="px-5 h-[52px] font-medium text-foreground">{i.id}</td>
                    <td className="px-3 text-muted-foreground">{i.data}</td>
                    <td className="px-3 text-foreground">{i.origem}</td>
                    <td className="px-3 text-muted-foreground">{i.empresa}</td>
                    <td className="px-3 text-center font-display font-medium">{i.registros}</td>
                    <td className="px-3 text-center text-muted-foreground">{i.duracao}</td>
                    <td className="px-5 text-center">
                      <span className={cn("esc-chip inline-flex items-center gap-1", s.cls)}>
                        <Icon className="h-3 w-3" /> {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </div>
    </AppShell>
  );
};

export default Importacoes;
