import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTenant } from "@/contexts/TenantContext";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Boxes,
  Calendar as CalendarIcon,
  Database,
  FileText,
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
  Users,
  Wallet,
  X,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  CustoExtraOperacionalService,
  OperacaoService,
  ConsolidadoService,
} from "@/services/base.service";
import { AuditoriaService } from "@/services/v4.service";
import { ReportService } from "@/services/report.service";

import { processarOperacao } from "@/utils/financeiro";
import { DashboardConsolidadoService, OperationalIntegrityKPIs } from "@/services/dashboard.service";

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

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getAuditoriaBadgeVariant = (
  status: OperationalIntegrityKPIs["auditoriaCompetencia"]["status"] | undefined,
) => {
  switch (status) {
    case "ok":
      return "success";
    case "divergente":
      return "destructive";
    case "pendente":
      return "warning";
    default:
      return "secondary";
  }
};

const getAuditoriaStatusLabel = (
  status: OperationalIntegrityKPIs["auditoriaCompetencia"]["status"] | undefined,
) => {
  switch (status) {
    case "ok":
      return "OK";
    case "divergente":
      return "Divergente";
    case "pendente":
      return "Pendente";
    default:
      return "Sem dados";
  }
};

const getTipoFluxoLabel = (value?: OperationalIntegrityKPIs["tipoFluxo"]) => {
  switch (value) {
    case "folha_variavel":
      return "CLT";
    case "diarista":
      return "Diarista";
    case "operacional":
      return "Operacional";
    case "misto":
      return "Misto";
    default:
      return "Sem fluxo";
  }
};

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
  const { tenantId, loading: isTenantLoading } = useTenant();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedYear, setSelectedYear] = useState(
    String(new Date().getFullYear()),
  );
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(
    "all",
  );
  const selectedMonth = `${selectedYear}-${selectedMonthNumber}`;

  // Estado para filtro ativo nos KPIs
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  // Estado para alertas
  const [alertsExpanded, setAlertsExpanded] = useState(true);

  // Estado para controle de visualização da tabela
  const [showDataTable, setShowDataTable] = useState(false);

  // Estado para filtros da tabela
  const [tableFilters, setTableFilters] = useState({
    tipo: 'operacoes', // operacoes, custos, diaristas
    status: 'all',
  });

  const buildFilters = (extraFilters: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    params.set("ano", selectedYear);
    if (selectedMonthNumber !== "all") {
      params.set("mes", selectedMonthNumber);
    }
    Object.entries(extraFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  };

  const navigateToOperacoes = (filters: Record<string, string> = {}) => {
    navigate(`/operacional/operacoes?${buildFilters(filters)}`);
  };

  const handleKpiClick = (filterType: string) => {
    if (activeFilter === filterType) {
      setActiveFilter(null);
      setShowDataTable(false);
    } else {
      setActiveFilter(filterType);
      setShowDataTable(true);
    }
  };

  const clearFilter = () => {
    setActiveFilter(null);
    setShowDataTable(false);
  };

  const matchesSelectedPeriod = (value: unknown) => {
    const referencia = String(value ?? "");
    if (!referencia.startsWith(selectedYear)) return false;
    if (selectedMonthNumber === "all") return true;
    return referencia.startsWith(`${selectedYear}-${selectedMonthNumber}`);
  };

  const {
    data: operacoesBase = [],
    isLoading: isLoadingOperacoes,
  } = useQuery<any[]>({
    queryKey: ["dashboard-operacoes", tenantId || "all", selectedYear, selectedMonthNumber],
    queryFn: () => OperacaoService.getAllPainel(undefined, tenantId).catch(() => []),
    retry: 0,
    enabled: !isTenantLoading && !!tenantId,
  });

  const {
    data: custosExtras = [],
  } = useQuery<any[]>({
    queryKey: ["dashboard-custos-extras", tenantId || "all"],
    queryFn: () => CustoExtraOperacionalService.getAll(undefined, tenantId).catch(() => []),
    retry: 0,
    enabled: !isTenantLoading && !!tenantId,
  });

  const {
    data: kpisConsolidados,
    isLoading: isLoadingKpis,
    isError: isErrorKpis,
    error: kpisError,
  } = useQuery<OperationalIntegrityKPIs>({
    queryKey: ["dashboard-kpis-consolidados", tenantId, selectedYear, selectedMonthNumber],
    queryFn: () => DashboardConsolidadoService.getKpisAggregate(selectedYear, selectedMonthNumber, tenantId),
    retry: 1,
    enabled: !isTenantLoading && !!tenantId,
  });

  const isLoading = isTenantLoading || isLoadingOperacoes || isLoadingKpis;
  // Only surface a hard error if the consolidated KPI service itself throws a real error
  const isError = isErrorKpis;

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
    let faturamento = kpisConsolidados?.faturamentoTotal || 0;

    // As per new rules, we only read from the consolidated source
    const lucroReal = kpisConsolidados?.lucroReal || 0;
    const caixaRecebido = kpisConsolidados?.caixaRecebido || 0;
    const aReceber = (kpisConsolidados?.faturamentoTotal || 0) - caixaRecebido;

    // We compute costs and margins
    const custosTotais = kpisConsolidados?.custosGerais || 0;
    const margemLucro = faturamento > 0 ? (lucroReal / faturamento) * 100 : 0;

    let volumeTotal = 0;
    operacoesPeriodo.forEach((item) => {
      const quantidade = Number(item.quantidade ?? item.quantidade_label ?? 0);
      volumeTotal += Number.isFinite(quantidade) ? quantidade : 0;
    });

    let merenda = 0;
    let administrativo = 0;
    let operacional = 0;
    let fornecedor = 0;
    let custosPendentes = 0;
    let atrasado = 0;

    custosPeriodo.forEach((item) => {
      const total = Number(item.total ?? 0);
      const status = String(item.status_pagamento ?? "").toUpperCase();
      const categoria = String(item.categoria_custo ?? "").toUpperCase();

      if (status === "PENDENTE") custosPendentes += total;
      if (status === "ATRASADO") atrasado += total;

      if (categoria === "MERENDA") merenda += total;
      if (categoria === "ADMINISTRATIVO") administrativo += total;
      if (categoria === "OPERACIONAL") operacional += total;
      if (categoria === "FORNECEDOR") fornecedor += total;
    });

    return {
      faturamento,
      custosTotais: (kpisConsolidados?.finValorAprovado || 0) + custosTotais,
      lucroReal,
      caixaRecebido,
      aReceber,
      atrasado,
      margemLucro,
      volumeTotal,
      totalOperacoes: operacoesPeriodo.length,
      totalLancamentosCustos: custosPeriodo.length,
      custosPendentes,
      categoriasCustos: {
        merenda,
        administrativo,
        operacional,
        fornecedor,
      },
      ...kpisConsolidados
    };
  }, [kpisConsolidados, operacoesPeriodo, custosPeriodo]);

  const kpiOrigins = useMemo(
    () => [
      {
        label: "Faturamento Total",
        value: formatCurrency(dashboardKpis.faturamento),
        origin: kpisConsolidados?.origens.faturamentoTotal,
      },
      {
        label: "Caixa Recebido",
        value: formatCurrency(dashboardKpis.caixaRecebido),
        origin: kpisConsolidados?.origens.caixaRecebido,
      },
      {
        label: "Custos Totais",
        value: formatCurrency(dashboardKpis.custosTotais),
        origin: kpisConsolidados?.origens.custosGerais,
      },
      {
        label: "Lucro Real",
        value: formatCurrency(dashboardKpis.lucroReal),
        origin: kpisConsolidados?.origens.lucroReal,
      },
      {
        label: "Financeiro Aprovado",
        value: formatCurrency(kpisConsolidados?.finValorAprovado || 0),
        origin: kpisConsolidados?.origens.finValorAprovado,
      },
    ],
    [dashboardKpis, kpisConsolidados],
  );

  // activeFilter is used only for display; KPIs always reflect full period data

  const hasRegraOperacional = (op: any) => {
    return op.tipo_calculo_snapshot || op.regra_financeira;
  };

  const alerts = useMemo(() => {
    const result = [];

    const opSemRegra = operacoesPeriodo.filter(op => !hasRegraOperacional(op)).length;
    if (opSemRegra > 0) {
      result.push({
        id: 'sem_regra',
        tipo: 'warning',
        titulo: `${opSemRegra} operação(ões) sem regra operacional`,
        descricao: 'Verificar regras operacionais cadastradas',
        onClick: () => navigateToOperacoes({ sem_regra: 'true' }),
      });
    }

    if (dashboardKpis.custosPendentes > 0) {
      result.push({
        id: 'custos_pendentes',
        tipo: 'warning',
        titulo: `${formatCurrency(dashboardKpis.custosPendentes)} em custos pendentes`,
        descricao: 'Verificar status de pagamento',
        onClick: () => navigateToOperacoes({ categoria_servico: 'CUSTO', status_pgto: 'PENDENTE' }),
      });
    }

    if (dashboardKpis.atrasado > 0) {
      result.push({
        id: 'atrasado',
        tipo: 'destructive',
        titulo: `${formatCurrency(dashboardKpis.atrasado)} em atraso`,
        descricao: 'Verificar recebimentos atrasados',
        onClick: () => navigateToOperacoes({ vencimento_atrasado: 'true' }),
      });
    }

    if (dashboardKpis.volumeTotal === 0) {
      result.push({
        id: 'sem_volume',
        tipo: 'info',
        titulo: 'Nenhum volume registrado no período',
        descricao: 'Verificar lançamentos',
        onClick: () => navigateToOperacoes({ categoria_servico: 'SERVICO_VOLUME' }),
      });
    }

    return result;
  }, [operacoesPeriodo, dashboardKpis]);

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
      subtitle={`Visão geral consolidada de operações + custos extras · ${monthLabelCapitalized}`}
    >
      <div className="space-y-5">
        <section className="esc-card rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Período de análise
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
                    <SelectValue placeholder="Mês" />
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

            <div className="flex items-center gap-4">
              {alerts.length > 0 && (
                <div className="hidden md:flex gap-2">
                  {alerts.slice(0, 2).map((alert, index) => (
                    <div
                      key={alert.id}
                      onClick={alert.onClick}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer transition-colors hover:shadow-sm",
                        alert.tipo === 'destructive'
                          ? "border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive/10"
                          : alert.tipo === 'warning'
                            ? "border-warning/30 bg-warning/10 text-warning-strong hover:bg-warning/20"
                            : alert.tipo === 'info'
                              ? "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
                              : "border-muted bg-muted/30 text-muted-foreground hover:bg-muted/50"
                      )}
                      title={alert.descricao}
                    >
                      {alert.tipo === 'destructive' ? (
                        <AlertTriangle className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                      <span>{alert.titulo}</span>
                    </div>
                  ))}
                  {alerts.length > 2 && (
                    <div className="flex items-center px-2 py-1.5 rounded-lg border border-muted bg-muted/30 text-[11px] font-medium text-muted-foreground">
                      +{alerts.length - 2} alertas
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground whitespace-nowrap pl-4 border-l">
                <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                Consolidação atualizada em {lastSync}
              </div>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="esc-card flex flex-col items-center justify-center p-20 text-center">
            <Loader2 className="mb-3 h-10 w-10 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              Consolidando receita, custos e lucro do período...
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
              {kpisError instanceof Error
                ? kpisError.message
                : 'Não foi possível consolidar os dados. Verifique a conexão com o banco.'}
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
                  onClick={() => navigateToOperacoes({ categoria_servico: "SERVICO_VOLUME" })}
                />
                <MetricCard
                  label="Custos Totais"
                  value={formatCurrency(dashboardKpis.custosTotais)}
                  icon={TrendingDown}
                  chartData={serieDiaria.map(d => ({ value: d.custos }))}
                  chartColor={COLORS.custos}
                  onClick={() => navigateToOperacoes({ categoria_servico: "CUSTO" })}
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
                  onClick={() => navigateToOperacoes({ entra_caixa_imediato: "true" })}
                />
                <MetricCard
                  label="A Receber"
                  value={formatCurrency(dashboardKpis.aReceber)}
                  size="small"
                  onClick={() => navigateToOperacoes({ gera_conta_receber: "true" })}
                />
                <MetricCard
                  label="Atrasado"
                  value={formatCurrency(dashboardKpis.atrasado)}
                  size="small"
                  onClick={() => navigateToOperacoes({ vencimento_atrasado: "true" })}
                />
                <MetricCard
                  label="Volume Total"
                  value={formatInteger(dashboardKpis.volumeTotal)}
                  size="small"
                  onClick={() => navigateToOperacoes({ categoria_servico: "SERVICO_VOLUME" })}
                />
                <MetricCard
                  label="Operações"
                  value={formatInteger(dashboardKpis.totalOperacoes)}
                  size="small"
                  onClick={() => navigateToOperacoes()}
                />
                <MetricCard
                  label="Custos (Lançs.)"
                  value={formatInteger(dashboardKpis.totalLancamentosCustos)}
                  size="small"
                  onClick={() => navigateToOperacoes({ categoria_servico: "CUSTO" })}
                />
              </div>

              <section className="esc-card rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-foreground">
                        Auditoria da Competência
                      </h3>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Prova de consistência entre RH, Financeiro, CNAB e histórico bancário.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={getAuditoriaBadgeVariant(kpisConsolidados?.auditoriaCompetencia.status)}>
                      {getAuditoriaStatusLabel(kpisConsolidados?.auditoriaCompetencia.status)}
                    </Badge>
                    <Badge variant="outline">
                      Tipo: {getTipoFluxoLabel(kpisConsolidados?.auditoriaCompetencia.tipoFluxo)}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">RH fechado</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.rhFechado || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Financeiro recebido</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.financeiroRecebido || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Financeiro aprovado</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.financeiroAprovado || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">CNAB gerado</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.cnabGerado || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Histórico bancário</div>
                    <div className="mt-1 text-lg font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.bancoHistorico || 0)}</div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-4">
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Dif. RH x Financeiro</div>
                    <div className="mt-1 text-base font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.diferencaRhFinanceiro || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Dif. Financeiro x CNAB</div>
                    <div className="mt-1 text-base font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.diferencaFinanceiroCnab || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Dif. CNAB x Banco</div>
                    <div className="mt-1 text-base font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.diferencaCnabHistorico || 0)}</div>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">Diferença geral</div>
                    <div className="mt-1 text-base font-semibold">{formatCurrency(kpisConsolidados?.auditoriaCompetencia.diferencaTotal || 0)}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>Competência: {kpisConsolidados?.competencia || "-"}</span>
                  <span>Atualizado em: {formatDateTime(kpisConsolidados?.auditoriaCompetencia.atualizadoEm)}</span>
                </div>

                {(kpisConsolidados?.auditoriaCompetencia.pendencias || []).length > 0 && (
                  <div className="mt-4 rounded-xl border border-warning/30 bg-warning/10 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-warning-strong">
                      <AlertCircle className="h-4 w-4" />
                      Pendências de auditoria
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {(kpisConsolidados?.auditoriaCompetencia.pendencias || []).map((item) => (
                        <div key={item}>{item}</div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="esc-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-foreground">Rastreabilidade dos KPIs</h3>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-5">
                  {kpiOrigins.map((item) => (
                    <div key={item.label} className="rounded-xl border border-border bg-muted/20 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</div>
                      <div className="mt-1 text-base font-semibold">{item.value}</div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <div>Fonte: {item.origin?.fonte || "-"}</div>
                        <div>Competência: {item.origin?.competencia || "-"}</div>
                        <div>Atualizado em: {formatDateTime(item.origin?.atualizadoEm)}</div>
                        <div>Tipo: {getTipoFluxoLabel(item.origin?.tipoFluxo)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Filtro ativo exibido */}
            {activeFilter && (
              <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg">
                <span className="text-sm font-medium">Filtro ativo:</span>
                <Badge variant="outline" className="bg-white">
                  {activeFilter}
                </Badge>
                <Button variant="ghost" size="sm" onClick={clearFilter}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Tabela de Dados Principais */}
            <div className="esc-card overflow-hidden">
              <div className="p-4 border-b flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">Dados do Período</h3>
                  <Badge variant="outline">{operacoesPeriodo.length + custosPeriodo.length} registros</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={tableFilters.tipo} onValueChange={(v) => setTableFilters(prev => ({ ...prev, tipo: v }))}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operacoes">Operações</SelectItem>
                      <SelectItem value="custos">Custos</SelectItem>
                      <SelectItem value="todos">Todos</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={tableFilters.status} onValueChange={(v) => setTableFilters(prev => ({ ...prev, status: v }))}>
                    <SelectTrigger className="w-[140px] h-8">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="atrasado">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Data</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Serviço</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      let rows: any[] = [];

                      if (tableFilters.tipo === 'operacoes' || tableFilters.tipo === 'todos') {
                        operacoesPeriodo.slice(0, 20).forEach(op => {
                          const statusPg = op.status_pgto || op.status;
                          if (tableFilters.status !== 'all' && statusPg?.toUpperCase() !== tableFilters.status.toUpperCase()) return;
                          rows.push({
                            data: op.data_operacao || op.data,
                            empresa: op.empresas?.nome || '-',
                            servico: op.tipos_servico_operacional?.nome || '-',
                            quantidade: op.quantidade || 1,
                            valor: op.valor_total || 0,
                            status: statusPg,
                            tipo: 'op',
                            id: op.id,
                          });
                        });
                      }

                      if (tableFilters.tipo === 'custos' || tableFilters.tipo === 'todos') {
                        custosPeriodo.slice(0, 20).forEach(c => {
                          const statusPg = c.status;
                          if (tableFilters.status !== 'all' && statusPg?.toUpperCase() !== tableFilters.status.toUpperCase()) return;
                          rows.push({
                            data: c.data,
                            empresa: c.empresa?.nome || '-',
                            servico: c.descricao || c.tipo_custo || '-',
                            quantidade: 1,
                            valor: c.total || 0,
                            status: statusPg,
                            tipo: 'custo',
                            id: c.id,
                          });
                        });
                      }

                      rows = rows.slice(0, 50); // Limit to 50 rows

                      if (rows.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                              Nenhum registro encontrado para os filtros selecionados.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return rows.map((row, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="whitespace-nowrap">{row.data ? format(new Date(row.data), 'dd/MM/yyyy') : '-'}</TableCell>
                          <TableCell>{row.empresa}</TableCell>
                          <TableCell>{row.servico}</TableCell>
                          <TableCell className="text-center">{row.quantidade}</TableCell>
                          <TableCell className="font-medium">{formatCurrency(row.valor)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              row.status?.toUpperCase() === 'RECEBIDO' || row.status?.toUpperCase() === 'PAGO' ? 'default' :
                                row.status?.toUpperCase() === 'ATRASADO' ? 'destructive' : 'secondary'
                            }>
                              {row.status || 'Pendente'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => navigateToOperacoes()}>
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>

              <div className="p-3 border-t bg-muted/30 text-center">
                <Button variant="outline" size="sm" onClick={() => navigateToOperacoes()}>
                  Ver todos os registros
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
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

            <DashboardReportsSection navigate={navigate} selectedYear={selectedYear} selectedMonthNumber={selectedMonthNumber} />

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
                  value={formatCurrency(dashboardKpis.caixaRecebido)}
                />
                <InsightRow
                  label="Custos baixados"
                  value={formatCurrency(0)}
                />
                <InsightRow
                  label="Custos pendentes"
                  value={formatCurrency(dashboardKpis.custosPendentes)}
                />
                <InsightRow
                  label="Custos atrasados"
                  value={formatCurrency(dashboardKpis.atrasado)}
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

const QuickReportCard = ({
  title,
  subtitle,
  icon: Icon,
  stats,
  onClick
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  stats?: { label: string; value: string }[];
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="esc-card p-4 text-left hover:border-primary/40 transition-all group w-full"
  >
    <div className="flex items-start gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary-soft/20 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <h4 className="font-display font-semibold text-sm text-foreground">{title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{subtitle}</p>
      </div>
    </div>
    {stats && stats.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-muted/50 rounded-md px-2 py-1">
            <span className="text-[10px] text-muted-foreground uppercase">{stat.label}</span>
            <div className="text-xs font-semibold text-foreground">{stat.value}</div>
          </div>
        ))}
      </div>
    )}
    <div className="mt-3 flex items-center text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
      <span>Ver relatório completo</span>
      <ArrowRight className="h-3 w-3 ml-1" />
    </div>
  </button>
);

const DashboardReportsSection = ({ navigate, selectedYear, selectedMonthNumber }: { navigate: (path: string) => void; selectedYear: string; selectedMonthNumber: string }) => {
  const { data: consolidadoData } = useQuery({
    queryKey: ["consolidado", selectedYear, selectedMonthNumber],
    queryFn: () => ConsolidadoService.getByCompetencia(`${selectedYear}-${selectedMonthNumber}`),
    enabled: !!selectedYear && !!selectedMonthNumber,
  });

  const { data: inconsistencias = [] } = useQuery({
    queryKey: ["inconsistencias-ponto"],
    queryFn: () => OperacaoService.getInconsistencies(),
  });

  const { data: auditoriaLogs = [] } = useQuery({
    queryKey: ["auditoria-logs"],
    queryFn: () => AuditoriaService.getAll(),
  });

  const { data: reports = [] } = useQuery({
    queryKey: ["reports_catalog"],
    queryFn: () => ReportService.getAll(),
  });

  const getReportId = (slug: string) => {
    const report = reports.find((r: any) => r.slug === slug);
    return report?.id || "";
  };

  const totalFaturamento = useMemo(() => {
    if (!consolidadoData) return 0;
    const data = consolidadoData as any;
    return (data.colaboradores || data.clientes || []).reduce(
      (acc: number, curr: any) => acc + Number(curr.valor_total || 0),
      0
    );
  }, [consolidadoData]);

  const totalInconsistencias = Array.isArray(inconsistencias) ? inconsistencias.length : 0;

  const ultimosLogs = Array.isArray(auditoriaLogs) ? auditoriaLogs.slice(0, 3) : [];

  const faturamentoId = getReportId("faturamento-cliente");
  const inconsistenciasId = getReportId("inconsistencias-ponto");
  const auditoriaId = getReportId("log-auditoria");

  return (
    <section className="esc-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <h2 className="font-display font-semibold text-foreground">Relatórios rápidos</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickReportCard
          title="Faturamento por Cliente"
          subtitle="Receita consolidada por cliente"
          icon={BarChart3}
          stats={[
            { label: "Total", value: formatCurrency(totalFaturamento) },
            { label: "Clientes", value: String((consolidadoData as any)?.clientes?.length || 0) }
          ]}
          onClick={() => faturamentoId && navigate(`/relatorios/detalhe/${faturamentoId}`)}
        />
        <QuickReportCard
          title="Inconsistências de Ponto"
          subtitle="Registros com problemas de ponto"
          icon={AlertCircle}
          stats={[
            { label: "Total", value: String(totalInconsistencias) },
            { label: "Pendentes", value: String(totalInconsistencias) }
          ]}
          onClick={() => inconsistenciasId && navigate(`/relatorios/detalhe/${inconsistenciasId}`)}
        />
        <QuickReportCard
          title="Log de Auditoria"
          subtitle="Histórico de alterações no sistema"
          icon={Database}
          stats={[
            { label: "Total", value: String(auditoriaLogs.length) },
            { label: "Recentes", value: String(ultimosLogs.length) }
          ]}
          onClick={() => auditoriaId && navigate(`/relatorios/detalhe/${auditoriaId}`)}
        />
        <QuickReportCard
          title="Diaristas"
          subtitle="Controle de diaristas e ajustes"
          icon={Users}
          stats={[
            { label: "Ativos", value: "-" },
            { label: "Ajustes", value: "-" }
          ]}
          onClick={() => navigate("/rh/diaristas")}
        />
      </div>
    </section>
  );
};

const InsightRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-semibold text-foreground">{value}</span>
  </div>
);

export default Dashboard;
