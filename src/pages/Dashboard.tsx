import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Users, Boxes, Wallet, AlertTriangle, ArrowRight, Activity, LineChart as LineIcon, BarChart3, PieChart as PieIcon, Loader2, RefreshCw } from "lucide-react";
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
import { EmpresaService, ColaboradorService, OperacaoService, ResultadosService } from "@/services/base.service";

import { cn } from "@/lib/utils";

// Cores autorizadas pelo Orbe Design System
const COLORS = [
  "hsl(var(--primary))", // Brand Orange
  "hsl(var(--info))",    // Interaction Blue
  "hsl(var(--success))", // Status Green
  "hsl(var(--warning))", // Alert Amber
  "hsl(var(--gray-300))" // Neutral Gray
];

const Dashboard = () => {
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM

  // Busca dados reais
  const { data: cols = [], isLoading: isLoadingCols, isError: isErrorCols } = useQuery({
    queryKey: ["colaboradores"],
    queryFn: () => ColaboradorService.getAll(),
    retry: 1
  });

  const { data: empresas = [], isLoading: isLoadingEmpresas, isError: isErrorEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
    retry: 1
  });

  const { data: results = [], isLoading: isLoadingResults, isError: isErrorResults } = useQuery({
    queryKey: ["resultados_mensais", selectedMonth],
    queryFn: () => ResultadosService.getByMonth(selectedMonth),
    retry: 1
  });

  const { data: rawOps = [], isLoading: isLoadingRawOps } = useQuery({
    queryKey: ["operacoes_mensais", selectedMonth],
    queryFn: () => OperacaoService.getByMonth(selectedMonth),
    retry: 1
  });

  const isLoading = isLoadingCols || isLoadingEmpresas || isLoadingResults || isLoadingRawOps;
  const isError = isErrorCols || isErrorEmpresas || isErrorResults;

  const totalOperacoes = results.length > 0
    ? results.reduce((acc, r) => acc + (r.total_operacoes || 0), 0)
    : rawOps.length;

  const totalCalculado = results.length > 0
    ? results.reduce((acc, r) => acc + Number(r.valor_total_calculado || 0), 0)
    : rawOps.reduce((acc, op) => acc + (Number(op.quantidade) * Number(op.valor_unitario || 0)), 0);

  const inconsistencias = results.length > 0
    ? results.reduce((acc, r) => acc + (r.contagem_inconsistencias || 0), 0)
    : rawOps.filter(op => op.status === 'inconsistente').length;

  // Se não houver histórico processado, gerar histórico baseado nas operações reais (modo preview)
  const serieMensal = results.length > 0
    ? (results || []).map(r => ({
      dia: new Date(r.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      operacoes: r.total_operacoes || 0,
      valor: Number(r.valor_total_calculado) || 0,
      inconsistencias: r.contagem_inconsistencias || 0
    }))
    : Object.values(
      rawOps.reduce((acc: any, op: any) => {
        const dia = new Date(op.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        if (!acc[dia]) acc[dia] = { dia, operacoes: 0, valor: 0, inconsistencias: 0 };
        acc[dia].operacoes += 1;
        acc[dia].valor += (Number(op.quantidade) * Number(op.valor_unitario || 0));
        if (op.status === 'inconsistente') acc[dia].inconsistencias += 1;
        return acc;
      }, {})
    );

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

  const lastSync = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <AppShell title="Dashboard" subtitle={`Visão consolidada · ${new Date(selectedMonth + "-01").toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4 flex-wrap bg-card border border-border p-3 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Período de análise:</div>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all font-bold text-foreground"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Dados sincronizados em tempo real ({lastSync})
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground animate-pulse">Consolidando visão geral...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center p-20 esc-card text-center">
            <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="text-lg font-display font-semibold text-foreground">Erro de conexão</h2>
            <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
              Não foi possível carregar os indicadores do dashboard. Verifique sua permissão ou conexão com o servidor.
            </p>
            <Button onClick={() => window.location.reload()} className="h-10 px-8">
              Recarregar sistema
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard label="Operações no mês" value={totalOperacoes.toLocaleString('pt-BR')} icon={Boxes} />
              <MetricCard label="Colaboradores" value={cols.length.toString()} icon={Users} />
              <MetricCard label="Faturamento do mês" value={`R$ ${totalCalculado.toLocaleString('pt-BR')}`} icon={Wallet} accent />
              <MetricCard label="Inconsistências" value={inconsistencias.toString()} icon={AlertTriangle} delta={{ value: inconsistencias > 0 ? "Revisão Necessária" : "Consistente", positive: inconsistencias === 0 }} />
            </div>

            <section className="esc-card p-5">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display font-semibold text-foreground">Operações e faturamento — histórico mensal</h2>
                </div>
                {serieMensal.length > 0 && (
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
                {serieMensal.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "line" ? (
                      <LineChart data={serieMensal} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="l" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis yAxisId="r" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontFamily: "Inter, sans-serif"
                          }}
                          formatter={(v: number, n: string) => (n === "Faturamento (R$)" ? [`R$ ${v.toLocaleString("pt-BR")}`, n] : [v, n])}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line yAxisId="l" type="monotone" dataKey="operacoes" name="Operações" stroke="hsl(var(--info))" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line yAxisId="r" type="monotone" dataKey="valor" name="Faturamento (R$)" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line yAxisId="l" type="monotone" dataKey="inconsistencias" name="Inconsistências" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" />
                      </LineChart>
                    ) : (
                      <BarChart data={serieMensal} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontFamily: "Inter, sans-serif"
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="operacoes" name="Operações" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="valor" name="Faturamento" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="inconsistencias" name="Inconsistências" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PieCard title="Colaboradores por cargo" icon={<PieIcon className="h-4 w-4 text-muted-foreground" />} data={distribCargo} />
              <PieCard title="Distribuição: Ponto vs Operação" icon={<PieIcon className="h-4 w-4 text-muted-foreground" />} data={distribContrato} />
            </div>
          </>
        )}

        <section className="esc-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-display font-semibold text-foreground">Status do dia</h2>
            </div>
            <span className={cn(
              "esc-chip",
              inconsistencias > 0 ? "bg-warning-soft text-warning-strong" : "bg-success-soft text-success-strong"
            )}>
              {inconsistencias > 0 ? "Pendente de processamento" : "Pronto para fechamento"}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Última sincronização às {lastSync}. {inconsistencias > 0 ? `${inconsistencias} inconsistências aguardando revisão.` : "Todos os registros estão consistentes."}
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
  <Button
    variant={active ? "secondary" : "ghost"}
    size="sm"
    onClick={onClick}
    className={cn(
      "gap-1.5 h-7 px-3 text-[11px] font-bold uppercase tracking-wider transition-all",
      active ? "bg-background text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground"
    )}
  >
    {icon}
    {children}
  </Button>
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
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            stroke="none"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "Inter, sans-serif",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
            }}
          />
          <Legend
            verticalAlign="bottom"
            align="center"
            iconType="circle"
            wrapperStyle={{
              paddingTop: "24px",
              fontSize: "11px",
              fontFamily: "Inter, sans-serif",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontWeight: 600,
              color: "hsl(var(--muted-foreground))"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  </section>
);

export default Dashboard;
