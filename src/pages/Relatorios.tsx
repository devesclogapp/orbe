import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { OperacaoService, ColaboradorService } from "@/services/base.service";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2 } from "lucide-react";

const Relatorios = () => {
  const { data: history = [], isLoading: loadingHist } = useQuery({
    queryKey: ["operacoes_history_full"],
    queryFn: () => OperacaoService.getWeeklyHistory(),
  });

  const { data: cols = [], isLoading: loadingCols } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: () => ColaboradorService.getAll(),
  });

  const { data: recentOps = [], isLoading: loadingOps } = useQuery({
    queryKey: ["operacoes_recent"],
    queryFn: () => OperacaoService.getAll(),
  });

  const totalSemana = (history || []).reduce((s, d) => s + Number(d.valor_total_calculado || 0), 0);
  const totalOps = (history || []).reduce((s, d) => s + (d.total_operacoes || 0), 0);

  const chartData = (history || []).map(h => ({
    dia: new Date(h.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
    valor: Number(h.valor_total_calculado) || 0,
  }));

  const isLoading = loadingHist || loadingCols || loadingOps;

  return (
    <AppShell title="Relatórios" subtitle="Visão consolidada por período">
      <div className="space-y-4">
        <div className="flex justify-end gap-2">
          <Button variant="outline"><FileText className="h-4 w-4 mr-1.5" /> PDF</Button>
          <Button><Download className="h-4 w-4 mr-1.5" /> Exportar CSV</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card label="Faturamento da semana" value={`R$ ${totalSemana.toLocaleString("pt-BR")}`} />
              <Card label="Operações da semana" value={String(totalOps)} />
              <Card label="Colaboradores" value={String(cols.length)} />
            </div>

            <section className="esc-card p-5">
              <h2 className="font-display font-semibold text-foreground mb-4">Faturamento por dia (Últimos 7 dias)</h2>
              <div className="h-[300px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                        formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="valor" name="Faturamento (R$)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground italic border border-dashed rounded-lg">
                    Dados históricos insuficientes para gerar o gráfico.
                  </div>
                )}
              </div>
            </section>

            <section className="esc-card overflow-hidden">
              <header className="px-5 py-3 border-b border-border">
                <h2 className="font-display font-semibold text-foreground">Operações recentes</h2>
              </header>
              <table className="w-full text-sm">
                <thead className="esc-table-header">
                  <tr className="text-left">
                    <th className="px-5 h-11 font-medium">Operação</th>
                    <th className="px-3 h-11 font-medium">Transportadora</th>
                    <th className="px-3 h-11 font-medium text-center">Serviço</th>
                    <th className="px-3 h-11 font-medium text-center">Qtd</th>
                    <th className="px-5 h-11 font-medium text-right">Valor estimado</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOps.map((o: any) => (
                    <tr key={o.id} className="border-t border-muted">
                      <td className="px-5 h-[44px] font-medium text-foreground">{o.id.substring(0, 8)}</td>
                      <td className="px-3 text-muted-foreground">{o.transportadora}</td>
                      <td className="px-3 text-center text-muted-foreground">{o.tipo_servico}</td>
                      <td className="px-3 text-center">{o.quantidade}</td>
                      <td className="px-5 text-right font-display font-semibold">
                        R$ {(Number(o.quantidade) * Number(o.valor_unitario || 0)).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                  {recentOps.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-muted-foreground italic">Nenhuma operação lançada.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
};

const Card = ({ label, value }: { label: string; value: string }) => (
  <div className="esc-card p-5">
    <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
    <div className="mt-2 font-display font-bold text-2xl text-foreground">{value}</div>
  </div>
);

export default Relatorios;
