import { useMemo, useState, useEffect } from "react";
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
  ArrowUpRight,
  ArrowDownRight,
  SearchIcon,
  Search,
  X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
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

import { useAuth } from "@/contexts/AuthContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { usePreferences } from "@/contexts/PreferencesContext";
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
} from "@/services/domain/despesas.service";
import { OperacaoService } from "@/services/domain/core.service";
import { ConsolidadoService } from "@/services/domain/producao.service";
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
  const { environment } = usePreferences();
  const [chartType, setChartType] = useState<"line" | "bar">("line");
  const [selectedYear, setSelectedYear] = useState(() => {
    return localStorage.getItem("orbe_operacoes_year") || String(new Date().getFullYear());
  });
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(() => {
    return localStorage.getItem("orbe_operacoes_month") || "all";
  });
  const selectedMonth = `${selectedYear}-${selectedMonthNumber}`;

  // Watch for changes to persist them
  useEffect(() => {
    localStorage.setItem("orbe_operacoes_year", selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem("orbe_operacoes_month", selectedMonthNumber);
  }, [selectedMonthNumber]);

  // Estado para filtro ativo nos KPIs
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const [alertsExpanded, setAlertsExpanded] = useState(true);

  // Estado para controle de visualização da tabela e filtros
  const [tableFilters, setTableFilters] = useState({
    tipo: 'operacoes',
    status: 'all',
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOpId, setSelectedOpId] = useState<string | null>(null);

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

  const navigateToReceitas = (state: Record<string, any> = {}) => {
    navigate('/financeiro/receitas', { state });
  };

  const handleKpiClick = (filterType: string) => {
    if (activeFilter === filterType) {
      setActiveFilter(null);
    } else {
      setActiveFilter(filterType);
    }
  };

  const clearFilter = () => {
    setActiveFilter(null);
  };

  const matchesSelectedPeriod = (op: any) => {
    const referencia = String(op?.data_operacao ?? op?.data_referencia ?? op?.data ?? "");
    if (!referencia.startsWith(selectedYear)) return false;
    if (selectedMonthNumber === "all") return true;
    return referencia.startsWith(`${selectedYear}-${selectedMonthNumber}`);
  };

  const {
    data: operacoesBase = [],
    isLoading: isLoadingOperacoes,
  } = useQuery<any[]>({
    queryKey: ["dashboard-operacoes", tenantId || "all", selectedYear, selectedMonthNumber, environment],
    queryFn: () => OperacaoService.getAllPainel(undefined, tenantId).catch(() => []),
    retry: 0,
    enabled: !isTenantLoading && !!tenantId,
  });

  const {
    data: custosExtras = [],
  } = useQuery<any[]>({
    queryKey: ["dashboard-custos-extras", tenantId || "all", environment],
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
    queryKey: ["dashboard-kpis-consolidados", tenantId, selectedYear, selectedMonthNumber, environment],
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


  useEffect(() => {
    if (operacoesPeriodo.length > 0 && !selectedOpId) {
      setSelectedOpId(operacoesPeriodo[0].id);
    }
  }, [operacoesPeriodo, selectedOpId]);

  const selectedOp = operacoesPeriodo.find(op => op.id === selectedOpId) || operacoesPeriodo[0];

  return (
    <AppShell
      title="Dashboard"
      subtitle={`Visão geral consolidada de operações + custos extras · ${monthLabelCapitalized}`}
    >
      <div className="space-y-6 pb-12 w-full max-w-[1400px] mx-auto pt-2">
        {/* ROW 1: 4 Main Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            label="LUCRO REAL"
            value={formatCurrency(dashboardKpis.lucroReal)}
            delta={{ value: "12.5%", positive: true }}
            icon={Activity}
            chartData={serieDiaria.map(d => ({ value: d.lucro }))}
            chartColor="#10B981"
            chartType="line"
          />
          <MetricCard
            label="FATURAMENTO TOTAL"
            value={formatCurrency(dashboardKpis.faturamento)}
            delta={{ value: "8.2%", positive: true }}
            icon={CalendarIcon}
            chartData={serieDiaria.map(d => ({ value: d.faturamento }))}
            chartColor="#2563EB"
            chartType="bar"
          />
          <MetricCard
            label="CUSTOS TOTAIS"
            value={formatCurrency(dashboardKpis.custosTotais)}
            delta={{ value: "2 dias", positive: false }}
            icon={AlertCircle}
            chartData={serieDiaria.map(d => ({ value: d.custos }))}
            chartColor="#8B5CF6"
            chartType="line"
          />
          <div className="group relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-white border border-slate-100 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.1)] p-5 text-left w-full min-h-[220px]">
            <div className="flex justify-between items-start z-10 relative">
              <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Caixa Recebido</span>
              <div className="flex items-center justify-center p-2 rounded-xl bg-slate-50 text-slate-400 border border-slate-100 transition-colors group-hover:bg-slate-100 group-hover:text-slate-600">
                <Wallet className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-2 flex flex-col gap-1 w-full justify-center z-10 relative">
              <div className="font-display font-bold text-4xl text-slate-900">{formatCurrency(dashboardKpis.caixaRecebido)}</div>
              <div className="mt-1">
                <Badge className="bg-[#DCFCE7] text-[#15803D] hover:bg-[#DCFCE7] font-semibold border-none rounded-[6px] px-2 py-0.5 text-[12px] w-fit">Em conta</Badge>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 z-10 relative">
              <div className="rounded-lg bg-[#F7F7F7] border border-[#EBEBEB] p-2 text-center transition-all hover:bg-slate-100 cursor-pointer">
                <div className="text-[10px] text-[#737373] font-semibold uppercase">A Receber</div>
                <div className="font-bold text-[14px] text-[#171717] mt-1">{formatCurrency(dashboardKpis.aReceber)}</div>
              </div>
              <div className="rounded-lg bg-[#FEE2E2] border border-[#FEE2E2] p-2 text-center transition-all hover:bg-red-100 cursor-pointer">
                <div className="text-[10px] text-[#B91C1C] font-semibold uppercase">Atrasado</div>
                <div className="font-bold text-[14px] text-[#B91C1C] mt-1">{formatCurrency(dashboardKpis.atrasado)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: Active Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 py-2">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-[14px] font-semibold text-[#171717]">Filtros operacionais</span>
          </div>

          <Select value={tableFilters.tipo} onValueChange={(v) => setTableFilters(prev => ({ ...prev, tipo: v }))}>
            <SelectTrigger className="w-[140px] h-[36px] bg-white border border-[#DEDEDE] font-medium text-[#171717] rounded-[6px] shadow-sm px-3">
              <SelectValue placeholder="Todas Empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="operacoes">Operações</SelectItem>
              <SelectItem value="custos">Custos</SelectItem>
              <SelectItem value="todos">Todos tipos</SelectItem>
            </SelectContent>
          </Select>

          <Select value={tableFilters.status} onValueChange={(v) => setTableFilters(prev => ({ ...prev, status: v }))}>
            <SelectTrigger className="w-[130px] h-[36px] bg-white border border-[#DEDEDE] font-medium text-[#171717] rounded-[6px] shadow-sm px-3">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">S: Todos</SelectItem>
              <SelectItem value="pendente">S: Pendente</SelectItem>
              <SelectItem value="recebido">S: Recebido</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          {/* Date selectors */}
          <div className="hidden lg:flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[130px] h-[36px] px-3 rounded-[6px] border-[#DEDEDE] bg-white shadow-sm font-medium text-[#171717] hover:bg-[#F0F0F0]">
                <SelectValue placeholder="Selecione o Ano" />
                <CalendarIcon className="ml-2 h-3.5 w-3.5 text-[#A3A3A3]" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
              <SelectTrigger className="w-[160px] h-[36px] px-3 rounded-[6px] border-[#DEDEDE] bg-white shadow-sm font-medium text-[#171717] hover:bg-[#F0F0F0]">
                <SelectValue placeholder="Selecione o Mês" />
                <CalendarIcon className="ml-2 h-3.5 w-3.5 text-[#A3A3A3]" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_FILTER_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label} {m.value !== 'all' ? selectedYear : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#A3A3A3]" />
            <input
              type="text"
              placeholder="Buscar op #"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-[36px] w-[160px] rounded-[6px] border border-[#C4C4C4] bg-white pl-9 pr-4 text-[14px] font-medium text-[#171717] outline-none placeholder:text-[#A3A3A3] focus:border-[#2563EB] shadow-[0_0_0_0_rgba(37,99,235,0)] focus:shadow-[0_0_0_3px_rgba(37,99,235,0.12)] transition-all"
            />
          </div>
        </div>

        {/* ROW 3: Table and Context Panel (Standard Orbe Layout) */}
        <div className="flex flex-col lg:flex-row gap-4 items-start relative pb-8">
          <div className="w-full lg:w-[calc(100%-320px-16px)] rounded-[12px] bg-white border border-[#DEDEDE] overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#EBEBEB] border-b border-[#DEDEDE]">
                  <TableRow>
                    <TableHead className="text-[12px] font-medium text-[#4D4D4D] uppercase h-[44px]">Operação</TableHead>
                    <TableHead className="text-[12px] font-medium text-[#4D4D4D] uppercase h-[44px]">Data</TableHead>
                    <TableHead className="text-[12px] font-medium text-[#4D4D4D] uppercase h-[44px] text-center">Status</TableHead>
                    <TableHead className="text-[12px] font-medium text-[#4D4D4D] uppercase h-[44px] text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {operacoesPeriodo.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="h-32 text-center text-[#737373] text-[14px]">
                        Nenhuma operação selecionada ou encontrada nesta competência.
                      </TableCell>
                    </TableRow>
                  ) : (
                    operacoesPeriodo.map(op => {
                      const statusPg = String(op.status_pgto || op.status || 'Pendente').toLowerCase();
                      const isSelected = selectedOpId === op.id;
                      const opTitle = typeof op.id === 'number' ? `OP-${op.id}` : `OP-${String(op.id).substring(0, 6).toUpperCase()}`;

                      let badgeClasses = "bg-[#FEF9C3] text-[#A16207]";
                      if (statusPg === "ok" || statusPg === "recebido" || statusPg === "pago") badgeClasses = "bg-[#DCFCE7] text-[#15803D]";
                      if (statusPg === "atrasado" || statusPg === "divergente") badgeClasses = "bg-[#FEE2E2] text-[#B91C1C]";
                      if (statusPg === "ajustado") badgeClasses = "bg-[#DBEAFE] text-[#1D4ED8]";

                      return (
                        <TableRow
                          key={op.id}
                          onClick={() => setSelectedOpId(op.id)}
                          className={cn("cursor-pointer h-[52px] border-b border-[#EBEBEB] text-[14px]", isSelected ? "bg-[#DBEAFE] hover:bg-[#DBEAFE]" : "hover:bg-[#F7F7F7] bg-white")}
                        >
                          <TableCell className="font-semibold text-[#171717]">
                            #{opTitle}
                          </TableCell>
                          <TableCell className="text-[#171717]">
                            {op.data_operacao ? format(new Date(op.data_operacao), "dd/MM/yyyy") : "-"}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={cn("font-medium border-none shadow-none rounded-[6px] px-2 py-0.5", badgeClasses)}>{op.status_pgto || op.status || "Pendente"}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-[#171717]">
                            {formatCurrency(op.valor_total || 0)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="w-full lg:w-[320px] bg-white border border-[#DEDEDE] lg:absolute lg:right-0 lg:top-0 lg:bottom-0 p-4 shadow-sm z-10 flex flex-col h-full rounded-[12px] lg:rounded-none lg:border-y-0 lg:border-r-0 pb-16">
            <h3 className="font-display font-semibold text-[#171717] text-[18px] mb-4">Detalhes da Operação</h3>
            {selectedOp ? (
              <div className="space-y-6 flex-1">
                <div>
                  <div className="text-[12px] font-medium text-[#737373] uppercase mb-1">Empresa / Cliente</div>
                  <div className="font-semibold text-[#171717] text-[14px]">{selectedOp.empresas?.nome || "Empresa não informada"}</div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-y border-[#EBEBEB] py-4">
                  <h2 className="text-xl font-bold tracking-tight text-gray-900 leading-none">
                    Dashboard {operacoesBase.length} ops fetch
                  </h2>
                  <span className="text-sm font-medium text-gray-500 tracking-wide mt-1">Vol.</span>
                  <div>
                    <div className="text-[12px] font-medium text-[#737373] uppercase mb-1">Vol.</div>
                    <div className="font-semibold text-[#171717] text-[14px]">{formatInteger(selectedOp.quantidade || 1)} cx</div>
                  </div>
                  <div>
                    <div className="text-[12px] font-medium text-[#737373] uppercase mb-1">Serviço</div>
                    <div className="font-semibold text-[#171717] text-[14px] truncate" title={selectedOp.tipos_servico_operacional?.nome || "Serviço"}>{selectedOp.tipos_servico_operacional?.nome || "Serviço"}</div>
                  </div>
                </div>

                <div className="bg-[#F7F7F7] p-4 rounded-[12px] border border-[#EBEBEB]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[13px] font-medium text-[#4D4D4D]">Sub Total</span>
                    <span className="font-semibold text-[#171717] text-[14px]">{formatCurrency(selectedOp.valor_total || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[13px] font-medium text-[#4D4D4D]">Custos Adicionais</span>
                    <span className="font-semibold text-[#171717] text-[14px]">{formatCurrency(0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-[#DEDEDE]">
                    <span className="text-[14px] font-bold text-[#171717]">Total</span>
                    <span className="font-display font-bold text-[20px] text-[#FD4C00]">{formatCurrency(selectedOp.valor_total || 0)}</span>
                  </div>
                </div>

                <Button className="w-full bg-[#FD4C00] hover:bg-[#E54300] text-white font-semibold h-[40px] rounded-[8px] shadow-sm transition-colors" onClick={() => navigateToOperacoes()}>
                  Ações Completas
                </Button>
              </div>
            ) : (
              <div className="text-center py-12 text-[#737373] flex-1">
                <Activity className="h-8 w-8 mx-auto mb-3 opacity-30 text-[#A3A3A3]" />
                <p className="text-[13px] font-medium max-w-[200px] mx-auto">Selecione uma operação na tabela para visualizar o painel contextual.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppShell>
  );
};

export default Dashboard;
