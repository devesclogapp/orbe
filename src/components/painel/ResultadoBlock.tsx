import { useQuery } from "@tanstack/react-query";
import { ConsolidadoService } from "@/services/base.service";
import { Loader2, Wallet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const ResultadoBlock = () => {
  const today = new Date().toISOString().split('T')[0];
  const competencia = today.substring(0, 7); // "YYYY-MM"

  const { data, isLoading } = useQuery({
    queryKey: ['consolidado', competencia],
    queryFn: () => ConsolidadoService.getByCompetencia(competencia)
  });

  if (isLoading) {
    return (
      <section className="esc-card p-10 flex justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </section>
    );
  }

  const { clientes = [], colaboradores = [] } = data || {};

  const totalColab = colaboradores?.reduce((acc: number, c: any) => acc + Number(c.valor_total || 0), 0);
  const totalOps = clientes?.reduce((acc: number, c: any) => acc + Number(c.valor_total || 0), 0);
  const totalDia = totalColab + totalOps;
  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display font-semibold text-foreground">Resultado financeiro</h2>
          <span className="esc-chip bg-info-soft text-info ml-1">Tempo real</span>
        </div>
        <div className="text-xs text-muted-foreground">Atualizado agora</div>
      </header>

      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Por colaborador */}
        <div className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">Por colaborador (competência)</div>
          <ul className="space-y-2.5">
            {colaboradores.length > 0 ? colaboradores.slice(0, 5).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground">{c.colaboradores?.nome}</div>
                  <div className="text-xs text-muted-foreground">Competência {c.competencia}</div>
                </div>
                <div className="font-display font-semibold text-foreground">
                  R$ {Number(c.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </li>
            )) : <li className="text-xs text-muted-foreground italic">Sem fechamentos este mês.</li>}
          </ul>
        </div>

        {/* Por cliente/operação */}
        <div className="p-5">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-3">Por cliente (competência)</div>
          <ul className="space-y-2.5">
            {clientes.length > 0 ? clientes.slice(0, 5).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="text-foreground">{c.clientes?.nome}</div>
                  <div className="text-xs text-muted-foreground">Faturamento {c.competencia}</div>
                </div>
                <div className="font-display font-semibold text-foreground">
                  R$ {Number(c.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </li>
            )) : <li className="text-xs text-muted-foreground italic">Sem faturamento este mês.</li>}
          </ul>
        </div>
      </div>

      <footer className="border-t border-border bg-background/50 px-5 py-4 grid grid-cols-3 gap-4">
        <Total label="Total colaboradores" value={`R$ ${totalColab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <Total label="Total clientes" value={`R$ ${totalOps.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <Total label="Total mês" value={`R$ ${totalDia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} highlight />
      </footer>
    </section>
  );
};

const Total = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium flex items-center gap-1">
      {highlight && <TrendingUp className="h-3 w-3 text-primary" />}
      {label}
    </div>
    <div className={cn(
      "mt-1 font-display font-bold text-xl",
      highlight ? "text-primary" : "text-foreground"
    )}>
      {value}
    </div>
  </div>
);
