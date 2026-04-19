import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Users, Boxes, Wallet, AlertTriangle, ArrowRight, Activity, LineChart as LineIcon, BarChart3, PieChart as PieIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { EmpresaService, ColaboradorService, OperacaoService } from "@/services/base.service";

import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))"];

const Dashboard = () => {
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  // Busca dados reais
  const { data: cols = [] } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: () => ColaboradorService.getAll(),
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: ops = [] } = useQuery({
    queryKey: ["operacoes", new Date().toISOString().split('T')[0]],
    queryFn: () => OperacaoService.getByDate(new Date().toISOString().split('T')[0]),
  });

  const { data: history = [] } = useQuery({
    queryKey: ["operacoes_history"],
    queryFn: () => OperacaoService.getWeeklyHistory(),
  });

  const serieSemanalReal = (history || []).map(h => ({
    dia: new Date(h.data).toLocaleDateString('pt-BR', { weekday: 'short' }),
    operacoes: h.total_operacoes || 0,
    valor: Number(h.valor_total_calculado) || 0,
    colaboradores: 0
  }));

  const totalCalculado = ops.reduce((acc, op) => acc + (Number(op.quantidade) * Number(op.valor_unitario || 0)), 0);
  const inconsistencias = ops.filter(op => op.status === 'inconsistente').length;

  // Distribuição por cargo
  const distribCargo = Object.entries(
    cols.reduce<Record<string, number>>((acc, c: any) => {
      const cargo = c.cargo || "Sem cargo";
      acc[cargo] = (acc[cargo] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value: Number(value) }));

  // Distribuição por tipo de contrato (Ponto vs Operação)
  const distribContrato = [
    { name: "Por Hora (Ponto)", value: cols.filter((c: any) => c.tipo_contrato === "Hora").length },
    { name: "Por Operação", value: cols.filter((c: any) => c.tipo_contrato === "Operação").length },
  ];

  return (
    <AppShell title="Dashboard" subtitle={`Visão geral · ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Operações hoje" value={ops.length.toString()} icon={Boxes} delta={{ value: ops.length > 0 ? "Ativo" : "Pendente", positive: ops.length > 0 }} />
          <MetricCard label="Colaboradores" value={cols.length.toString()} icon={Users} />
          <MetricCard label="Total calculado" value={`R$ ${totalCalculado.toLocaleString('pt-BR')}`} icon={Wallet} accent />
          <MetricCard label="Inconsistências" value={inconsistencias.toString()} icon={AlertTriangle} delta={{ value: inconsistencias > 0 ? "Atenção" : "OK", positive: inconsistencias === 0 }} />
        </div>

        {/* Gráfico semanal com toggle */}
        <section className="esc-card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-foreground">Operações e faturamento — últimos 7 dias</h2>
            </div>
            {serieSemanalReal.length > 0 && (
              <div className="inline-flex items-center bg-muted rounded-lg p-1">
                <ChartTabBtn active={chartType === "line"} onClick={() => setChartType("line")} icon={<LineIcon className="h-3.5 w-3.5" />}>
                  Linhas
                </ChartTabBtn>
                <ChartTabBtn active={chartType === "bar"} onClick={() => setChartType("bar")} icon={<BarChart3 className="h-3.5 w-3.5" />}>
                  Colunas
                </ChartTabBtn>
              </div>
            )}
          </div>

          <div className="h-[280px] w-full">
            {serieSemanalReal.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {chartType === "line" ? (
                  <LineChart data={serieSemanalReal} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="l" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="r" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, n: string) => (n === "Faturamento (R$)" ? [`R$ ${v.toLocaleString("pt-BR")}`, n] : [v, n])}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line yAxisId="l" type="monotone" dataKey="operacoes" name="Operações" stroke="hsl(var(--info))" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line yAxisId="r" type="monotone" dataKey="valor" name="Faturamento (R$)" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                ) : (
                  <BarChart data={serieSemanalReal} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="operacoes" name="Operações" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="valor" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed border-border p-8 text-center">
                <LineIcon className="h-10 w-10 mb-2 opacity-20" />
                <p className="text-sm">Nenhum dado histórico disponível nos últimos 7 dias.</p>
                <p className="text-xs mt-1">Os dados aparecerão aqui após o processamento diário.</p>
              </div>
            )}
          </div>
        </section>

        {/* Pizzas: por cargo e por tipo de contrato */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PieCard title="Colaboradores por cargo" icon={<PieIcon className="h-4 w-4 text-muted-foreground" />} data={distribCargo} />
          <PieCard title="Distribuição: Ponto vs Operação" icon={<PieIcon className="h-4 w-4 text-muted-foreground" />} data={distribContrato} />
        </div>

        <section className="esc-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-foreground">Status do dia</h2>
            </div>
            <span className="esc-chip bg-warning-soft text-warning-strong">Pendente de processamento</span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Última sincronização há 2 minutos. 3 inconsistências aguardando revisão antes do fechamento do dia.
          </p>
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/processamento">Ir para processamento <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/inconsistencias">Ver inconsistências</Link>
            </Button>
          </div>
        </section>
      </div>
    </AppShell>
  );
};

const ChartTabBtn = ({
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
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {children}
  </button>
);

const PieCard = ({ title, icon, data }: { title: string; icon: React.ReactNode; data: { name: string; value: number }[] }) => (
  <section className="esc-card p-5">
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h3 className="font-display font-semibold text-foreground text-sm">{title}</h3>
    </div>
    <div className="h-[240px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </section>
);

export default Dashboard;
