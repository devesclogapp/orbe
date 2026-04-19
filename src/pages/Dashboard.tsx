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
import { serieSemanal, colaboradores } from "@/data/mock";
import { cn } from "@/lib/utils";

const COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))"];

const Dashboard = () => {
  const [chartType, setChartType] = useState<"line" | "bar">("line");

  // Distribuição por cargo
  const distribCargo = Object.entries(
    colaboradores.reduce<Record<string, number>>((acc, c) => {
      acc[c.cargo] = (acc[c.cargo] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  // Distribuição por tipo de contrato (Ponto vs Operação)
  const distribContrato = [
    { name: "Por Hora (Ponto)", value: colaboradores.filter((c) => c.contrato === "Hora").length },
    { name: "Por Operação", value: colaboradores.filter((c) => c.contrato === "Operação").length },
  ];

  return (
    <AppShell title="Dashboard" subtitle="Visão geral · Segunda, 07 Mar 2025">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Operações hoje" value="8" icon={Boxes} delta={{ value: "+30%", positive: true }} />
          <MetricCard label="Colaboradores" value="12" icon={Users} delta={{ value: "+1", positive: true }} />
          <MetricCard label="Total calculado" value="R$ 3.189" icon={Wallet} delta={{ value: "+12%", positive: true }} accent />
          <MetricCard label="Inconsistências" value="3" icon={AlertTriangle} delta={{ value: "-2", positive: true }} />
        </div>

        {/* Gráfico semanal com toggle */}
        <section className="esc-card p-5">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-foreground">Operações e faturamento — últimos 7 dias</h2>
            </div>
            <div className="inline-flex items-center bg-muted rounded-lg p-1">
              <ChartTabBtn active={chartType === "line"} onClick={() => setChartType("line")} icon={<LineIcon className="h-3.5 w-3.5" />}>
                Linhas
              </ChartTabBtn>
              <ChartTabBtn active={chartType === "bar"} onClick={() => setChartType("bar")} icon={<BarChart3 className="h-3.5 w-3.5" />}>
                Colunas
              </ChartTabBtn>
            </div>
          </div>

          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === "line" ? (
                <LineChart data={serieSemanal} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
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
                <BarChart data={serieSemanal} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="operacoes" name="Operações" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="colaboradores" name="Colaboradores" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
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
