import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Calendar as CalendarIcon,
  HandCoins,
  LineChart as LineIcon,
  Loader2,
  Package2,
  PieChart as PieIcon,
  PiggyBank,
  Receipt,
  RefreshCw,
  Scale,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CustoExtraOperacionalService,
  OperacaoService,
} from "@/services/base.service";
import { processarOperacao } from "@/utils/financeiro";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const integerFormatter = new Intl.NumberFormat("pt-BR");

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const formatCurrency = (value: number) =>
  currencyFormatter.format(Number.isFinite(value) ? value : 0);

const formatInteger = (value: number) =>
  integerFormatter.format(Number.isFinite(value) ? value : 0);

const formatPercent = (value: number) =>
  `${percentFormatter.format(Number.isFinite(value) ? value : 0)}%`;

const COLORS = {
  receita: "hsl(var(--primary))",
  custos: "hsl(var(--destructive))",
  lucro: "hsl(var(--success))",
  recebido: "hsl(var(--success))",
  pendente: "hsl(var(--warning))",
  atrasado: "hsl(var(--destructive))",
  merenda: "hsl(var(--primary))",
  administrativo: "hsl(var(--info))",
  operacional: "hsl(var(--warning))",
  fornecedor: "hsl(var(--success))",
};

const MONTH_NAME_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2026, index, 1);
  const labelBase = format(date, "MMMM", { locale: ptBR });
  return {
    value: String(index + 1).padStart(2, "0"),
    label: labelBase.charAt(0).toUpperCase() + labelBase.slice(1),
  };
});

const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  ...MONTH_NAME_OPTIONS,
];

const YEAR_OPTIONS = Array.from(
  new Set(
    Array.from({ length: 24 }, (_, index) =>
      String(startOfMonth(addMonths(new Date(), -index)).getFullYear()),
    ),
  ),
).sort((a, b) => Number(b) - Number(a));

const Dashboard = () => {
  const navigate = useNavigate();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear()),
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(
    "all",
  );
  const selectedMonth = `${selectedYear}-${selectedMonthNumber}`;
  const matchesSelectedPeriod = (value: unknown) => {
    const referencia = String(value ?? "");
    if (!referencia.startsWith(selectedYear)) return false;
    if (selectedMonthNumber === "all") return true;
    return referencia.startsWith(`${selectedYear}-${selectedMonthNumber}`);
  };

  const {
    data: operacoesBase = [],
    isLoading: isLoadingOperacoes,
    isError: isErrorOperacoes,
  } = useQuery<any[]>({
    queryKey: ["dashboard-operacoes", "all"],
    queryFn: () => OperacaoService.getAllPainel(),
    retry: 1,
  });

  const {
    data: custosExtras = [],
    isLoading: isLoadingCustos,
    isError: isErrorCustos,
  } = useQuery<any[]>({
    queryKey: ["dashboard-custos-extras", "all"],
    queryFn: () => CustoExtraOperacionalService.getAll(),
    retry: 1,
  });

  const isLoading = isLoadingOperacoes || isLoadingCustos;
  const isError = isErrorOperacoes || isErrorCustos;

  const operacoesPeriodo = useMemo(
    () =>
      operacoesBase
        .filter((item) => {
          const referencia = String(
            item.data_operacao ?? item.data_referencia ?? item.data ?? "",
          );
          return matchesSelectedPeriod(referencia);
        })
        .map((item) => processarOperacao(item)),
    [operacoesBase, selectedMonthNumber, selectedYear],
  );

  const custosPeriodo = useMemo(
    () =>
      custosExtras.filter((item) =>
        matchesSelectedPeriod(item.data),
      ),
    [custosExtras, selectedMonthNumber, selectedYear],
  );

  const dashboardKpis = useMemo(() => {
    let faturamento = 0;
    let caixaRecebidoOperacoes = 0;
    let aReceber = 0;
    let atrasado = 0;
    let volumeTotal = 0;

    operacoesPeriodo.forEach((item) => {
      const totalLinha = Number(
        item.totalFinalCalculado ?? item.valor_total_label ?? item.valor_total ?? 0,
      );
      const quantidade = Number(item.quantidade ?? item.quantidade_label ?? 0);
      const statusPagamento = String(
        item.statusPagamento ?? item.status_pagamento ?? "",
      ).toUpperCase();

      faturamento += Number.isFinite(totalLinha) ? totalLinha : 0;
      volumeTotal += Number.isFinite(quantidade) ? quantidade : 0;

      if (statusPagamento === "RECEBIDO") caixaRecebidoOperacoes += totalLinha;
      if (statusPagamento === "PENDENTE") aReceber += totalLinha;
      if (statusPagamento === "ATRASADO") atrasado += totalLinha;
    });

    let custosTotais = 0;
    let custosRecebidos = 0;
    let custosPendentes = 0;
    let custosAtrasados = 0;
    let merenda = 0;
    let administrativo = 0;
    let operacional = 0;
    let fornecedor = 0;

    custosPeriodo.forEach((item) => {
      const total = Number(item.total ?? 0);
      const status = String(item.status_pagamento ?? "").toUpperCase();
      const categoria = String(item.categoria_custo ?? "").toUpperCase();

      custosTotais += total;

      if (status === "RECEBIDO") custosRecebidos += total;
      if (status === "PENDENTE") custosPendentes += total;
      if (status === "ATRASADO") custosAtrasados += total;

      if (categoria === "MERENDA") merenda += total;
      if (categoria === "ADMINISTRATIVO") administrativo += total;
      if (categoria === "OPERACIONAL") operacional += total;
      if (categoria === "FORNECEDOR") fornecedor += total;
    });

    const lucroReal = faturamento - custosTotais;
    const margemLucro = faturamento > 0 ? (lucroReal / faturamento) * 100 : 0;
    const caixaRecebido = caixaRecebidoOperacoes - custosRecebidos;

    return {
      faturamento,
      custosTotais,
      lucroReal,
      caixaRecebido,
      aReceber,
      atrasado,
      margemLucro,
      volumeTotal,
      totalOperacoes: operacoesPeriodo.length,
      totalLancamentosCustos: custosPeriodo.length,
      caixaRecebidoOperacoes,
      custosRecebidos,
      custosPendentes,
      custosAtrasados,
      categoriasCustos: {
        merenda,
        administrativo,
        operacional,
        fornecedor,
      },
    };
  }, [custosPeriodo, operacoesPeriodo]);

  const serieDiaria = useMemo(() => {
    const dias = new Map<
      string,
      { dia: string; receita: number; custos: number; lucro: number }
    >();

    operacoesPeriodo.forEach((item) => {
      const chave = String(
        item.data_operacao ?? item.data_referencia ?? item.data ?? "",
      ).slice(0, 10);
      if (!chave) return;

      const atual = dias.get(chave) ?? {
        dia: chave.slice(8, 10),
        receita: 0,
        custos: 0,
        lucro: 0,
      };

      atual.receita += Number(
        item.totalFinalCalculado ?? item.valor_total_label ?? item.valor_total ?? 0,
      );
      atual.lucro = atual.receita - atual.custos;
      dias.set(chave, atual);
    });

    custosPeriodo.forEach((item) => {
      const chave = String(item.data ?? "").slice(0, 10);
      if (!chave) return;

      const atual = dias.get(chave) ?? {
        dia: chave.slice(8, 10),
        receita: 0,
        custos: 0,
        lucro: 0,
      };

      atual.custos += Number(item.total ?? 0);
      atual.lucro = atual.receita - atual.custos;
      dias.set(chave, atual);
    });

    return Array.from(dias.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, value]) => value);
  }, [custosPeriodo, operacoesPeriodo]);

  const financeiroStatusData = useMemo(
    () => [
      {
        name: "Caixa recebido",
        value: Math.max(dashboardKpis.caixaRecebido, 0),
        fill: COLORS.recebido,
      },
      {
        name: "A receber",
        value: dashboardKpis.aReceber,
        fill: COLORS.pendente,
      },
      {
        name: "Atrasado",
        value: dashboardKpis.atrasado,
        fill: COLORS.atrasado,
      },
    ].filter((item) => item.value > 0),
    [dashboardKpis],
  );

  const categoriasCustosData = useMemo(
    () => [
      {
        name: "Merenda",
        value: dashboardKpis.categoriasCustos.merenda,
        fill: COLORS.merenda,
      },
      {
        name: "Administrativo",
        value: dashboardKpis.categoriasCustos.administrativo,
        fill: COLORS.administrativo,
      },
      {
        name: "Operacional",
        value: dashboardKpis.categoriasCustos.operacional,
        fill: COLORS.operacional,
      },
      {
        name: "Fornecedor",
        value: dashboardKpis.categoriasCustos.fornecedor,
        fill: COLORS.fornecedor,
      },
    ].filter((item) => item.value > 0),
    [dashboardKpis],
  );

  const monthLabelCapitalized =
    selectedMonthNumber === "all"
      ? `Todos os meses de ${selectedYear}`
      : new Date(`${selectedMonth}-01T12:00:00`).toLocaleDateString(
          "pt-BR",
          {
            month: "long",
            year: "numeric",
          },
        ).replace(/^\w/, (char) => char.toUpperCase());

  const lastSync = new Date().toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Visao geral consolidada de operacoes + custos extras · ${monthLabelCapitalized}`}
    >
      <div className="space-y-5">
        <section className="esc-card rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Periodo de analise
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[120px] h-10 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Ano" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {YEAR_OPTIONS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
                <SelectTrigger className="w-[180px] h-10 shrink-0 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Mes" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {MONTH_FILTER_OPTIONS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Consolidacao atualizada em {lastSync}
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="esc-card flex flex-col items-center justify-center p-20 text-center">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Consolidando receita, custos e lucro do periodo...
            </p>
          </div>
        ) : isError ? (
          <div className="esc-card flex flex-col items-center justify-center p-20 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h2 className="font-display text-lg font-semibold text-foreground">
              Erro ao carregar o dashboard
            </h2>
            <p className="mt-2 mb-6 max-w-md text-sm text-muted-foreground">
              Nao foi possivel consolidar operacoes e custos extras. Verifique a
              conexao com o banco e se as migrations operacionais ja foram aplicadas.
            </p>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Recarregar
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Lucro real"
                  value={formatCurrency(dashboardKpis.lucroReal)}
                  icon={PiggyBank}
                  variant="solid"
                  chartData={serieDiaria.map(d => ({ value: d.lucro }))}
                />
                <MetricCard
                  label="Faturamento Total"
                  value={formatCurrency(dashboardKpis.faturamento)}
                  icon={Wallet}
                  chartData={serieDiaria.map(d => ({ value: d.receita }))}
                  chartColor={COLORS.receita}
                />
                <MetricCard
                  label="Custos Totais"
                  value={formatCurrency(dashboardKpis.custosTotais)}
                  icon={TrendingDown}
                  chartData={serieDiaria.map(d => ({ value: d.custos }))}
                  chartColor={COLORS.custos}
                />
                <MetricCard
                  label="Margem de Lucro"
                  value={formatPercent(dashboardKpis.margemLucro)}
                  icon={Scale}
                  chartData={serieDiaria.map(d => ({ value: d.receita > 0 ? (d.lucro / d.receita) * 100 : 0 }))}
                  chartColor={COLORS.lucro}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard
                  label="Caixa Recebido"
                  value={formatCurrency(dashboardKpis.caixaRecebido)}
                  size="small"
                />
                <MetricCard
                  label="A Receber"
                  value={formatCurrency(dashboardKpis.aReceber)}
                  size="small"
                />
                <MetricCard
                  label="Atrasado"
                  value={formatCurrency(dashboardKpis.atrasado)}
                  size="small"
                />
                <MetricCard
                  label="Volume Total"
                  value={formatInteger(dashboardKpis.volumeTotal)}
                  size="small"
                />
                <MetricCard
                  label="Operações"
                  value={formatInteger(dashboardKpis.totalOperacoes)}
                  size="small"
                />
                <MetricCard
                  label="Custos (Lançs.)"
                  value={formatInteger(dashboardKpis.totalLancamentosCustos)}
                  size="small"
                />
              </div>
            </div>

            <section className="esc-card p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <h2 className="font-display font-semibold text-foreground">
                    Receita, custos e lucro por dia
                  </h2>
                </div>
                {serieDiaria.length > 0 && (
                  <div className="inline-flex items-center rounded-lg bg-muted p-1">
                    <ChartTabBtn
                      active={chartType === "line"}
                      onClick={() => setChartType("line")}
                      icon={<LineIcon className="h-3.5 w-3.5" />}
                    >
                      Linhas
                    </ChartTabBtn>
                    <ChartTabBtn
                      active={chartType === "bar"}
                      onClick={() => setChartType("bar")}
                      icon={<BarChart3 className="h-3.5 w-3.5" />}
                    >
                      Colunas
                    </ChartTabBtn>
                  </div>
                )}
              </div>

              <div className="h-[320px] w-full">
                {serieDiaria.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    {chartType === "line" ? (
                      <LineChart
                        data={serieDiaria}
                        margin={{ top: 8, right: 16, left: -10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="receita" name="Receita" stroke={COLORS.receita} strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="custos" name="Custos" stroke={COLORS.custos} strokeWidth={2.5} dot={{ r: 3 }} />
                        <Line type="monotone" dataKey="lucro" name="Lucro" stroke={COLORS.lucro} strokeWidth={2.5} dot={{ r: 3 }} />
                      </LineChart>
                    ) : (
                      <BarChart
                        data={serieDiaria}
                        margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="dia" stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                        <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number, name: string) => [formatCurrency(value), name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="receita" name="Receita" fill={COLORS.receita} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="custos" name="Custos" fill={COLORS.custos} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="lucro" name="Lucro" fill={COLORS.lucro} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState text="Nenhum movimento encontrado no periodo selecionado." />
                )}
              </div>
            </section>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <PieCard
                title="Status financeiro da receita"
                icon={<PieIcon className="h-4 w-4 text-muted-foreground" />}
                data={financeiroStatusData}
              />
              <PieCard
                title="Composicao dos custos extras"
                icon={<PieIcon className="h-4 w-4 text-muted-foreground" />}
                data={categoriasCustosData}
              />
            </div>

            <section className="esc-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Scale className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-display font-semibold text-foreground">
                  Leitura consolidada do periodo
                </h2>
              </div>

              <div className="space-y-3 text-sm">
                <InsightRow
                  label="Receita recebida"
                  value={formatCurrency(dashboardKpis.caixaRecebidoOperacoes)}
                />
                <InsightRow
                  label="Custos baixados"
                  value={formatCurrency(dashboardKpis.custosRecebidos)}
                />
                <InsightRow
                  label="Custos pendentes"
                  value={formatCurrency(dashboardKpis.custosPendentes)}
                />
                <InsightRow
                  label="Custos atrasados"
                  value={formatCurrency(dashboardKpis.custosAtrasados)}
                />
              </div>

              <div className="mt-5 rounded-2xl border border-border bg-muted/20 p-4">
                <div
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                    dashboardKpis.lucroReal >= 0
                      ? "bg-success-soft text-success-strong"
                      : "bg-destructive-soft text-destructive-strong",
                  )}
                >
                  {dashboardKpis.lucroReal >= 0
                    ? "Periodo com lucro positivo"
                    : "Periodo com lucro pressionado"}
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  O dashboard cruza exclusivamente a receita das operacoes com os
                  custos extras do mesmo mes para chegar ao lucro real. O KPI
                  "Caixa recebido" mostra o saldo realizado no periodo entre
                  recebimentos operacionais e custos extras ja baixados.
                </p>
              </div>

              <div className="mt-5 flex gap-2">
                <Button asChild>
                  <Link to="/operacional/operacoes">
                    Ir para operacoes <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link to="/inconsistencias">Ver inconsistencias</Link>
                </Button>
              </div>
            </section>
          </>
        )}
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
      "h-7 gap-1.5 px-3 text-[11px] font-bold uppercase tracking-wider transition-all",
      active
        ? "bg-background text-foreground shadow-sm ring-1 ring-border"
        : "text-muted-foreground hover:text-foreground",
    )}
  >
    {icon}
    {children}
  </Button>
);

const EmptyChartState = ({ text }: { text: string }) => (
  <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 p-8 text-center text-muted-foreground">
    <Activity className="mb-2 h-10 w-10 opacity-20" />
    <p className="text-sm">{text}</p>
  </div>
);

const PieCard = ({
  title,
  icon,
  data,
}: {
  title: string;
  icon: React.ReactNode;
  data: { name: string; value: number; fill: string }[];
}) => (
  <section className="esc-card p-5">
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="h-[240px]">
      {data.length > 0 ? (
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
              {data.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [formatCurrency(value), "Valor"]}
            />
            <Legend
              verticalAlign="bottom"
              align="center"
              iconType="circle"
              wrapperStyle={{
                paddingTop: "24px",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                fontWeight: 600,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <EmptyChartState text="Nenhum dado disponivel para este grafico." />
      )}
    </div>
  </section>
);

const InsightRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </div>
);

export default Dashboard;
