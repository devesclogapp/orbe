import { useQuery } from "@tanstack/react-query";
import { ResultadosService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Lock, Unlock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const Fechamento = () => {
  const { data: list = [], isLoading } = useQuery({
    queryKey: ["fechamentos"],
    queryFn: () => ResultadosService.getSummary(),
  });

  return (
    <AppShell title="Fechamento Mensal" subtitle="Consolidação dos totais por período">
      {isLoading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((f: any) => (
            <article key={f.id} className="esc-card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-md bg-primary-soft flex items-center justify-center text-primary">
                    <CalendarCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">
                      {new Date(f.data).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {f.empresas?.nome} · {f.total_operacoes} operações
                    </p>
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
                  <div className="font-display font-bold text-xl text-foreground">
                    R$ {Number(f.valor_total_calculado).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Inconsistências</div>
                  <div className={cn("font-display font-bold text-xl", (f.contagem_inconsistencias || 0) > 0 ? "text-destructive-strong" : "text-success-strong")}>
                    {f.contagem_inconsistencias || 0}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  {f.status === "fechado" ? `Fechado em ${new Date(f.created_at).toLocaleDateString('pt-BR')}` : "Aguardando consolidação"}
                </span>
                {f.status === "fechado" ? (
                  <Button size="sm" variant="outline">Reabrir</Button>
                ) : (
                  <Button size="sm" disabled={(f.contagem_inconsistencias || 0) > 0}>Fechar período</Button>
                )}
              </div>
            </article>
          ))}
          {list.length === 0 && (
            <div className="col-span-2 p-12 text-center text-muted-foreground italic esc-card">
              Nenhum fechamento processado ainda.
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
};

export default Fechamento;
