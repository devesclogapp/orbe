import { useQuery } from "@tanstack/react-query";
import { ConsolidadoService } from "@/services/base.service";
import { Loader2, Wallet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const ResultadoBlock = ({ date, empresaId }: { date: string; empresaId: string }) => {
  const competencia = date.substring(0, 7); // "YYYY-MM"

  const { data, isLoading } = useQuery({
    queryKey: ['consolidado', competencia, empresaId],
    queryFn: () => ConsolidadoService.getByCompetencia(competencia, empresaId === 'all' ? undefined : empresaId)
  });

  if (isLoading) {
    return (
      <section className="esc-card p-12 flex flex-col items-center justify-center min-h-[250px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm font-medium text-muted-foreground animate-pulse">Calculando resultados financeiros...</p>
      </section>
    );
  }

  const { clientes = [], colaboradores = [] } = data || {};

  const totalColab = colaboradores?.reduce((acc: number, c: any) => acc + Number(c.valor_total || 0), 0);
  const totalOps = clientes?.reduce((acc: number, c: any) => acc + Number(c.valor_total || 0), 0);
  const totalDia = totalColab + totalOps;

  return (
    <section className="esc-card overflow-hidden">
      <header className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h2 className="font-display font-semibold text-foreground">Resultado consolidado</h2>
          <span className="esc-chip bg-primary-soft text-primary ml-1 text-[10px] uppercase tracking-wider">Mês {competencia}</span>
        </div>
        <div className="text-xs text-muted-foreground">Competência ativa</div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
        {/* Por colaborador */}
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-4 opacity-70">Top colaboradores (fechamento)</div>
          <ul className="space-y-4">
            {colaboradores.length > 0 ? colaboradores.slice(0, 5).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between text-sm group">
                <div className="transition-transform group-hover:translate-x-1 duration-200">
                  <div className="font-semibold text-foreground">{c.colaboradores?.nome}</div>
                  <div className="text-[11px] text-muted-foreground">Consolidado competência</div>
                </div>
                <div className="font-display font-bold text-foreground">
                  R$ {Number(c.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </li>
            )) : <li className="py-4 text-center text-xs text-muted-foreground italic bg-secondary/20 rounded-lg">Sem fechamentos registrados.</li>}
          </ul>
        </div>

        {/* Por cliente/operação */}
        <div className="p-5">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-4 opacity-70">Top clientes (faturamento)</div>
          <ul className="space-y-4">
            {clientes.length > 0 ? clientes.slice(0, 5).map((c: any) => (
              <li key={c.id} className="flex items-center justify-between text-sm group">
                <div className="transition-transform group-hover:translate-x-1 duration-200">
                  <div className="font-semibold text-foreground">{c.clientes?.nome}</div>
                  <div className="text-[11px] text-muted-foreground">Faturamento projetado</div>
                </div>
                <div className="font-display font-bold text-foreground">
                  R$ {Number(c.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </li>
            )) : <li className="py-4 text-center text-xs text-muted-foreground italic bg-secondary/20 rounded-lg">Sem faturamento este mês.</li>}
          </ul>
        </div>
      </div>

      <footer className="border-t border-border bg-secondary/30 px-5 py-5 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Total label="Encargos Operacionais" value={`R$ ${totalColab.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <Total label="Receita Bruta" value={`R$ ${totalOps.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} />
        <Total label="Resultado Projetado" value={`R$ ${totalDia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} highlight />
      </footer>
    </section>
  );
};

const Total = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => (
  <div className={cn("rounded-lg p-1", highlight && "bg-primary-soft/20 -m-1 p-2")}>
    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1.5 mb-1">
      {highlight && <TrendingUp className="h-3 w-3 text-primary" />}
      {label}
    </div>
    <div className={cn(
      "font-display font-black text-2xl tracking-tight leading-none",
      highlight ? "text-primary" : "text-foreground"
    )}>
      {value}
    </div>
  </div>
);
