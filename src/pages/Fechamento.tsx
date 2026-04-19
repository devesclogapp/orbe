import { AppShell } from "@/components/layout/AppShell";
import { fechamentos } from "@/data/mock";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";

const Fechamento = () => {
  return (
    <AppShell title="Fechamento Mensal" subtitle="Consolidação dos totais por período">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fechamentos.map((f) => (
          <article key={f.periodo} className="esc-card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-md bg-primary-soft flex items-center justify-center text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground">{f.periodo}</h3>
                  <p className="text-xs text-muted-foreground">{f.totalDias} dias · {f.operacoes} operações</p>
                </div>
              </div>
              <span
                className={cn(
                  "esc-chip inline-flex items-center gap-1",
                  f.status === "fechado"
                    ? "bg-success-soft text-success-strong"
                    : "bg-warning-soft text-warning-strong"
                )}
              >
                {f.status === "fechado" ? <><Lock className="h-3 w-3" /> Fechado</> : <><Unlock className="h-3 w-3" /> Aberto</>}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 my-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</div>
                <div className="font-display font-bold text-xl text-foreground">{f.valor}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Inconsistências</div>
                <div className={cn("font-display font-bold text-xl", f.inconsistencias > 0 ? "text-destructive-strong" : "text-success-strong")}>
                  {f.inconsistencias}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {f.status === "fechado" ? `Fechado em ${f.fechadoEm}` : "Aguardando consolidação"}
              </span>
              {f.status === "fechado" ? (
                <Button size="sm" variant="outline">Reabrir</Button>
              ) : (
                <Button size="sm" disabled={f.inconsistencias > 0}>Fechar período</Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </AppShell>
  );
};

export default Fechamento;
