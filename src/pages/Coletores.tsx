import { AppShell } from "@/components/layout/AppShell";
import { coletores } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { Plus, Cpu, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

const statusMap = {
  online: { label: "Online", icon: Wifi, cls: "bg-success-soft text-success-strong" },
  offline: { label: "Offline", icon: WifiOff, cls: "bg-muted text-muted-foreground" },
  erro: { label: "Erro", icon: AlertTriangle, cls: "bg-destructive-soft text-destructive-strong" },
};

const Coletores = () => {
  return (
    <AppShell title="Coletores REP" subtitle="Dispositivos de ponto eletrônico">
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button><Plus className="h-4 w-4 mr-1.5" /> Cadastrar coletor</Button>
        </div>
        <section className="esc-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="esc-table-header">
              <tr className="text-left">
                <th className="px-5 h-11 font-medium">Identificação</th>
                <th className="px-3 h-11 font-medium">Modelo / Série</th>
                <th className="px-3 h-11 font-medium">Empresa</th>
                <th className="px-3 h-11 font-medium text-center">Última sync</th>
                <th className="px-3 h-11 font-medium text-center">Registros</th>
                <th className="px-5 h-11 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {coletores.map((c) => {
                const s = statusMap[c.status];
                const Icon = s.icon;
                return (
                  <tr key={c.id} className="border-t border-muted hover:bg-background">
                    <td className="px-5 h-[60px]">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-md bg-secondary flex items-center justify-center">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <span className="font-medium text-foreground">{c.id}</span>
                      </div>
                    </td>
                    <td className="px-3">
                      <div className="text-foreground">{c.modelo}</div>
                      <div className="text-xs text-muted-foreground">{c.serie}</div>
                    </td>
                    <td className="px-3 text-muted-foreground">{c.empresa}</td>
                    <td className="px-3 text-center text-muted-foreground">{c.ultimaSync}</td>
                    <td className="px-3 text-center font-display font-medium">{c.registros}</td>
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

export default Coletores;
