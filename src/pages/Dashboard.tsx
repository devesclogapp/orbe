import React, { useMemo, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  DollarSign,
  Activity,
  Package,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ChevronRight,
  ArrowRight,
  Wallet,
  Building2,
  FileText,
  BarChart2,
  RefreshCw,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { useTenant } from "@/contexts/TenantContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  DashboardConsolidadoService,
  OperationalIntegrityKPIs,
  RadarAlertaReal,
  StatusCiclosReal,
  MotoresDataReal,
  EvolucaoPontoReal,
} from "@/services/dashboard.service";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { ExecutiveMetricCard } from "@/components/dashboard/ExecutiveMetricCard";
import { ExecutiveKpiDrawer, ExecutiveKpiDrawerType } from "@/components/dashboard/ExecutiveKpiDrawer";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(val) ? val : 0);

const formatInteger = (val: number) =>
  new Intl.NumberFormat("pt-BR").format(Number.isFinite(val) ? val : 0);

const MONTH_NAME_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const date = new Date(2026, index, 1);
  const labelBase = format(date, "MMMM", { locale: ptBR });
  return {
    value: String(index + 1).padStart(2, "0"),
    label: labelBase.charAt(0).toUpperCase() + labelBase.slice(1),
  };
});

const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "Todos os Meses" },
  ...MONTH_NAME_OPTIONS,
];

const YEAR_OPTIONS = Array.from(
  new Set(
    Array.from({ length: 24 }, (_, index) =>
      String(startOfMonth(addMonths(new Date(), -index)).getFullYear()),
    ),
  ),
).sort((a, b) => Number(b) - Number(a));

export default function Dashboard() {
  const navigate = useNavigate();
  const { tenantId, loading: isTenantLoading } = useTenant();
  const { environment } = usePreferences();

  // Filtros Temporais e de Empresa
  const [selectedYear, setSelectedYear] = useState(() => {
    return localStorage.getItem("orbe_dashboard_year") || String(new Date().getFullYear());
  });
  const [selectedMonthNumber, setSelectedMonthNumber] = useState(() => {
    return localStorage.getItem("orbe_dashboard_month") || "10";
  });
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("all");

  useEffect(() => {
    localStorage.setItem("orbe_dashboard_year", selectedYear);
  }, [selectedYear]);

  useEffect(() => {
    localStorage.setItem("orbe_dashboard_month", selectedMonthNumber);
  }, [selectedMonthNumber]);

  // Alternador visual para o gráfico: Barras vs Linhas
  const [evolucaoChartMode, setEvolucaoChartMode] = useState<"barras" | "linhas">("barras");

  // Drawer de Drill-down ativo (5 KPIs)
  const [activeDrawer, setActiveDrawer] = useState<ExecutiveKpiDrawerType>(null);

  // Competência canônica atual e anterior
  const canonicalCompetencia = useMemo(() => {
    if (selectedMonthNumber === "all") return `${selectedYear}-all`;
    return `${selectedYear}-${selectedMonthNumber}`;
  }, [selectedYear, selectedMonthNumber]);

  const previousCompetencia = useMemo(() => {
    if (selectedMonthNumber === "all") {
      return `${Number(selectedYear) - 1}-all`;
    }
    const currentRef = new Date(`${selectedYear}-${selectedMonthNumber}-01T12:00:00`);
    const prevDate = addMonths(currentRef, -1);
    return format(prevDate, "yyyy-MM");
  }, [selectedYear, selectedMonthNumber]);

  const empresaParam = selectedEmpresaId !== "all" ? selectedEmpresaId : undefined;

  // 1. Query: Lista de Empresas para filtro
  const { data: empresas = [] } = useQuery({
    queryKey: ["dashboard-empresas-lista", tenantId],
    queryFn: () => EmpresaService.getAll(),
    enabled: !isTenantLoading && !!tenantId,
    staleTime: 1000 * 60 * 10,
  });

  // 2. Query: KPIs Consolidada Competência Atual
  const {
    data: kpisAtual,
    isLoading: isLoadingKpis,
    isError: isErrorKpis,
    refetch: refetchKpis,
  } = useQuery<OperationalIntegrityKPIs>({
    queryKey: ["dashboard-kpis-atual", tenantId, selectedYear, selectedMonthNumber, selectedEmpresaId, environment],
    queryFn: () => DashboardConsolidadoService.getKpisAggregate(selectedYear, selectedMonthNumber, empresaParam),
    enabled: !isTenantLoading && !!tenantId,
    placeholderData: (previousData) => previousData,
  });

  // 3. Query: KPIs Consolidada Competência Anterior (para DELTA-CALC real)
  const { data: kpisAnterior } = useQuery<OperationalIntegrityKPIs>({
    queryKey: ["dashboard-kpis-anterior", tenantId, previousCompetencia, selectedEmpresaId, environment],
    queryFn: () => {
      const [pYear, pMonth] = previousCompetencia.split("-");
      return DashboardConsolidadoService.getKpisAggregate(pYear, pMonth, empresaParam);
    },
    enabled: !isTenantLoading && !!tenantId,
    staleTime: 1000 * 60 * 15,
    placeholderData: (previousData) => previousData,
  });

  // 4. Query: Radar de Alertas Reais
  const { data: radarAlertas = [] } = useQuery<RadarAlertaReal[]>({
    queryKey: ["dashboard-radar-alertas", tenantId, canonicalCompetencia, selectedEmpresaId, environment],
    queryFn: () => DashboardConsolidadoService.getRadarAlertas(canonicalCompetencia, empresaParam),
    enabled: !isTenantLoading && !!tenantId,
    placeholderData: (previousData) => previousData,
  });

  // 5. Query: Status dos Ciclos
  const { data: statusCiclos } = useQuery<StatusCiclosReal>({
    queryKey: ["dashboard-status-ciclos", tenantId, canonicalCompetencia, selectedEmpresaId, environment],
    queryFn: () => DashboardConsolidadoService.getStatusCiclos(canonicalCompetencia, empresaParam),
    enabled: !isTenantLoading && !!tenantId,
    placeholderData: (previousData) => previousData,
  });

  // 6. Query: Síntese dos 4 Motores do ORBE
  const { data: motoresData } = useQuery<MotoresDataReal>({
    queryKey: ["dashboard-motores-data", tenantId, canonicalCompetencia, selectedEmpresaId, environment],
    queryFn: () => DashboardConsolidadoService.getMotoresData(canonicalCompetencia, empresaParam),
    enabled: !isTenantLoading && !!tenantId,
    placeholderData: (previousData) => previousData,
  });

  // 7. Query: Gráfico de Evolução Semanal / Factual
  const { data: evolucaoSemanal = [] } = useQuery<EvolucaoPontoReal[]>({
    queryKey: ["dashboard-evolucao-semanal", tenantId, canonicalCompetencia, selectedEmpresaId, environment],
    queryFn: () => DashboardConsolidadoService.getEvolucaoSemanal(canonicalCompetencia, empresaParam),
    enabled: !isTenantLoading && !!tenantId,
    placeholderData: (previousData) => previousData,
  });

  // DELTA-CALC: Cálculo Real dos Deltas vs Competência Anterior
  const deltas = useMemo(() => {
    const calcDelta = (atual: number, anterior: number, invertido: boolean = false) => {
      if (!anterior || anterior === 0) {
        if (atual > 0) return { value: "+100%", isPositive: !invertido, isNeutral: false };
        return { value: "0.0%", isPositive: true, isNeutral: true };
      }
      const varPct = ((atual - anterior) / Math.abs(anterior)) * 100;
      const isPositive = invertido ? varPct <= 0 : varPct >= 0;
      const sign = varPct >= 0 ? "+" : "";
      return {
        value: `${sign}${varPct.toFixed(1)}%`,
        isPositive,
        isNeutral: Math.abs(varPct) < 0.01,
      };
    };

    const faturamentoAtual = kpisAtual?.faturamentoTotal || 0;
    const faturamentoAnt = kpisAnterior?.faturamentoTotal || 0;

    const custosAtual = (kpisAtual?.finValorAprovado || 0) + (kpisAtual?.custosGerais || 0);
    const custosAnt = (kpisAnterior?.finValorAprovado || 0) + (kpisAnterior?.custosGerais || 0);

    const resultadoAtual = kpisAtual?.lucroReal || 0;
    const resultadoAnt = kpisAnterior?.lucroReal || 0;

    const margemAtual = faturamentoAtual > 0 ? (resultadoAtual / faturamentoAtual) * 100 : 0;
    const margemAnt = faturamentoAnt > 0 ? (resultadoAnt / faturamentoAnt) * 100 : 0;
    const margemDiffPP = margemAtual - margemAnt;

    return {
      faturamento: calcDelta(faturamentoAtual, faturamentoAnt),
      custos: calcDelta(custosAtual, custosAnt, true), // redução de custo é positiva
      resultado: calcDelta(resultadoAtual, resultadoAnt),
      margem: {
        value: `${margemDiffPP >= 0 ? "+" : ""}${margemDiffPP.toFixed(1)} p.p.`,
        isPositive: margemDiffPP >= 0,
        isNeutral: Math.abs(margemDiffPP) < 0.01,
      },
    };
  }, [kpisAtual, kpisAnterior]);

  // Composição dos Custos Reais (Ranking Consolidado)
  const distribuicaoCustos = useMemo(() => {
    const folha = kpisAtual?.folhaValorAprovado || 0;
    const diaristas = kpisAtual?.diaristasValorAprovado || 0;
    const intermitentes = kpisAtual?.intermitentesValorAprovado || 0;
    const extras = kpisAtual?.custosGerais || 0;
    const total = folha + diaristas + intermitentes + extras;

    const items = [
      { categoria: "Folha CLT & Encargos", valor: folha, percentual: total > 0 ? (folha / total) * 100 : 0 },
      { categoria: "Diaristas Operacionais", valor: diaristas, percentual: total > 0 ? (diaristas / total) * 100 : 0 },
      { categoria: "Intermitentes", valor: intermitentes, percentual: total > 0 ? (intermitentes / total) * 100 : 0 },
      { categoria: "Custos Extras & Logística", valor: extras, percentual: total > 0 ? (extras / total) * 100 : 0 },
    ];

    return items.sort((a, b) => b.valor - a.valor);
  }, [kpisAtual]);

  const faturamentoTotal = kpisAtual?.faturamentoTotal || 0;
  const custosTotais = (kpisAtual?.finValorAprovado || 0) + (kpisAtual?.custosGerais || 0);
  const resultadoOperacional = kpisAtual?.lucroReal || 0;
  const margemOperacional = faturamentoTotal > 0 ? (resultadoOperacional / faturamentoTotal) * 100 : 0;
  const caixaRecebido = kpisAtual?.caixaRecebido || 0;
  const aReceber = Math.max(0, faturamentoTotal - caixaRecebido);

  const monthLabel = useMemo(() => {
    if (selectedMonthNumber === "all") return `Ano Consolidado de ${selectedYear}`;
    const date = new Date(Number(selectedYear), Number(selectedMonthNumber) - 1, 1);
    const mName = format(date, "MMMM", { locale: ptBR });
    return `${mName.charAt(0).toUpperCase() + mName.slice(1)} / ${selectedYear}`;
  }, [selectedYear, selectedMonthNumber]);

  const handleRefresh = () => {
    refetchKpis();
  };

  // Paleta adaptativa Recharts
  const chartTheme = {
    receita: "hsl(var(--foreground))",
    custos: "hsl(var(--muted-foreground))",
    lucro: "#2563EB",
    axisTick: "hsl(var(--muted-foreground))",
    axisLine: "hsl(var(--border))",
    tooltipBg: "hsl(var(--card))",
    tooltipBorder: "hsl(var(--border))",
    tooltipText: "hsl(var(--foreground))",
  };

  const isEmpresaSemMovimentacao = !isLoadingKpis && faturamentoTotal === 0 && custosTotais === 0;

  return (
    <AppShell
      title="Dashboard Executivo"
      subtitle={`Central de inteligência operacional & financeira · ${monthLabel}`}
    >
      <div className="space-y-4 pb-12 w-full max-w-[1560px] mx-auto pt-1 animate-in fade-in-50 duration-200">
        
        {/* BARRA DE CONTROLES SUPERIORES (FILTROS DE EMPRESA E COMPETÊNCIA) */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border/80 rounded-xl p-3 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Seletor de Empresa */}
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="w-[220px] sm:w-[260px] h-8 text-xs bg-background border-border/80">
                  <SelectValue placeholder="Todas as Unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Consolidado Geral (Todas Unidades)</SelectItem>
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Ano */}
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[100px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Seletor de Mês */}
            <Select value={selectedMonthNumber} onValueChange={setSelectedMonthNumber}>
              <SelectTrigger className="w-[150px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_FILTER_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="h-8 px-2.5 text-xs border-border/80 hover:bg-muted/50 gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>
        </div>

        {/* BARRA DE CONTEXTO: ESTADO DOS CICLOS OPERACIONAIS */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 shadow-xs transition-colors duration-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Ciclos:
            </span>

            {/* Ciclo CLT */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground">
              <Clock className="h-3 w-3 text-muted-foreground" />
              {statusCiclos?.clt.label || `CLT: Aberto (fecha em ${statusCiclos?.clt.prazoDias || 5}d)`}
            </span>

            {/* Ciclo Diaristas */}
            <span className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
              statusCiclos?.diaristas.status === "em_analise"
                ? "border-amber-200/80 bg-amber-50/50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-400"
                : "border-border/80 bg-muted/30 text-foreground"
            )}>
              <span className={cn("h-1.5 w-1.5 rounded-full", statusCiclos?.diaristas.status === "em_analise" ? "bg-amber-500" : "bg-muted-foreground")} />
              {statusCiclos?.diaristas.label || "Diaristas: Ciclo Regular"}
            </span>

            {/* Ciclo Financeiro */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              {statusCiclos?.financeiro.label || "Financeiro: Conciliação em Dia"}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">Último sync REP:</span>
            <strong className="text-foreground font-semibold">{statusCiclos?.ultimoSyncRhid || "Hoje 07:01"}</strong>
          </div>
        </div>

        {/* 1. COMO ESTAMOS? — 5 KPIs EXECUTIVOS SUPERIORES (COM DRILL-DOWN REAL) */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {isLoadingKpis && !kpisAtual ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 bg-card space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            <>
              {/* KPI 1: Faturamento Total */}
              <ExecutiveMetricCard
                label="Faturamento Total"
                value={formatCurrency(faturamentoTotal)}
                delta={{
                  value: deltas.faturamento.value,
                  isPositive: deltas.faturamento.isPositive,
                  isNeutral: deltas.faturamento.isNeutral,
                }}
                subtitle="Receitas apuradas · Clique p/ detalhar"
                icon={TrendingUp}
                isClickable={true}
                onClick={() => setActiveDrawer("faturamento")}
              />

              {/* KPI 2: Custos & Despesas */}
              <ExecutiveMetricCard
                label="Custos & Despesas"
                value={formatCurrency(custosTotais)}
                delta={{
                  value: deltas.custos.value,
                  isPositive: deltas.custos.isPositive,
                  isNeutral: deltas.custos.isNeutral,
                }}
                subtitle="CLT, Diaristas e Extras · Detalhar"
                icon={DollarSign}
                isClickable={true}
                onClick={() => setActiveDrawer("custos")}
              />

              {/* KPI 3: Resultado Operacional */}
              <ExecutiveMetricCard
                label="Resultado Operacional"
                value={formatCurrency(resultadoOperacional)}
                delta={{
                  value: deltas.resultado.value,
                  isPositive: deltas.resultado.isPositive,
                  isNeutral: deltas.resultado.isNeutral,
                }}
                subtitle="Receita − Custos · DRE Gerencial"
                icon={Activity}
                isClickable={true}
                onClick={() => setActiveDrawer("lucro")}
              />

              {/* KPI 4: Margem Operacional */}
              <ExecutiveMetricCard
                label="Margem Operacional"
                value={`${margemOperacional.toFixed(1)}%`}
                delta={{
                  value: deltas.margem.value,
                  isPositive: deltas.margem.isPositive,
                  isNeutral: deltas.margem.isNeutral,
                }}
                subtitle="Rentabilidade apurada · Detalhar"
                icon={FileText}
                isClickable={true}
                onClick={() => setActiveDrawer("margem")}
              />

              {/* KPI 5: Caixa & Contas */}
              <div
                onClick={() => setActiveDrawer("caixa")}
                className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3.5 shadow-xs transition-all duration-200 cursor-pointer hover:border-blue-500/40 hover:bg-muted/15"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 truncate">
                    Caixa & Contas
                  </span>
                  <div className="flex items-center gap-1">
                    <Wallet className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.75} />
                    <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
                  </div>
                </div>

                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <div className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[26px] leading-none">
                    {formatCurrency(caixaRecebido)}
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Em conta</span>
                </div>

                <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground/75">
                  <span>A receber: <strong className="text-foreground font-semibold">{formatCurrency(aReceber)}</strong></span>
                  <span className="text-blue-600 dark:text-blue-400 text-[10px] font-medium group-hover:underline">Detalhar</span>
                </div>
              </div>
            </>
          )}
        </section>

        {/* 2. O QUE PRECISA DA MINHA ATENÇÃO? — RADAR DE ATENÇÃO (FATOS REAIS) */}
        <section className="rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-colors duration-200">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-foreground/80">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-display text-sm font-bold text-foreground">
                Radar de Atenção Operacional & Financeira
              </h3>
            </div>
            <span className="text-[11px] font-medium text-muted-foreground/80">
              {radarAlertas.length} ações imediatas sugeridas
            </span>
          </div>

          {radarAlertas.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Nenhuma pendência crítica ou alerta ativo registrado para o escopo selecionado.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60 pt-0.5">
              {radarAlertas.map((alerta) => {
                const isCritico = alerta.tipo === "critico";
                const isAtencao = alerta.tipo === "atencao";

                return (
                  <div
                    key={alerta.id}
                    className="flex flex-col justify-between py-2 sm:py-0 px-0 sm:px-3.5 first:sm:pl-1 last:sm:pr-1 transition-colors hover:bg-muted/15 rounded-lg group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 rounded-full shrink-0",
                              isCritico
                                ? "bg-rose-500"
                                : isAtencao
                                ? "bg-amber-500"
                                : "bg-muted-foreground/50"
                            )}
                          />
                          <span
                            className={cn(
                              "font-semibold",
                              isCritico
                                ? "text-rose-600 dark:text-rose-400"
                                : isAtencao
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                            )}
                          >
                            {alerta.modulo}
                          </span>
                        </div>
                        <span className="text-muted-foreground/70 font-normal text-[10px]">
                          {alerta.tempo}
                        </span>
                      </div>

                      <h5 className="mt-1.5 text-xs font-semibold text-foreground leading-snug">
                        {alerta.titulo}
                      </h5>

                      <p className="mt-1 text-[11px] text-muted-foreground/80 line-clamp-2 leading-relaxed">
                        {alerta.descricao}
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
                      {alerta.valor ? (
                        <span className="font-display text-xs font-bold text-foreground">
                          {formatCurrency(alerta.valor)}
                        </span>
                      ) : (
                        <span />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(alerta.origemRota)}
                        className="h-6 text-[10px] font-medium px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      >
                        {alerta.acaoLabel}{" "}
                        <ChevronRight className="ml-0.5 h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 3. COMO ESTAMOS EVOLUINDO? — TENDÊNCIAS & COMPOSIÇÃO DE CUSTOS */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Gráfico 1: Evolução Semanal / Factual */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs lg:col-span-7 flex flex-col justify-between transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  {selectedMonthNumber === "all" ? "Evolução Mensal no Ano" : "Evolução Semanal: Receita vs Custos Diretos"}
                </h3>
                <p className="text-xs text-muted-foreground/80">
                  Valores apurados em R$ na competência {monthLabel}
                </p>
              </div>

              {/* TOGGLE BARRAS ↔ LINHAS */}
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border/80 bg-muted/40 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setEvolucaoChartMode("barras")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                      evolucaoChartMode === "barras"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Visualização em barras agrupadas"
                  >
                    <BarChart2 className="h-3 w-3" />
                    Barras
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvolucaoChartMode("linhas")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                      evolucaoChartMode === "linhas"
                        ? "bg-card text-foreground shadow-xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Visualização em curvas de tendência contínua"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Linhas
                  </button>
                </div>

                {/* Legenda Corporativa */}
                <div className="hidden sm:flex items-center gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-foreground" />
                    <span className="text-muted-foreground text-[11px]">Receita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-muted-foreground" />
                    <span className="text-muted-foreground text-[11px]">Custos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs bg-blue-600" />
                    <span className="text-muted-foreground text-[11px]">Resultado</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Área do Gráfico */}
            <div className="h-[230px] w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                {evolucaoChartMode === "barras" ? (
                  <BarChart data={evolucaoSemanal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="semana"
                      tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                      axisLine={{ stroke: chartTheme.axisLine }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText,
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: number) => [formatCurrency(val), ""]}
                    />
                    <Bar dataKey="receita" fill={chartTheme.receita} radius={[4, 4, 0, 0]} name="Receita" />
                    <Bar dataKey="custos" fill={chartTheme.custos} radius={[4, 4, 0, 0]} name="Custos" />
                    <Bar dataKey="lucro" fill={chartTheme.lucro} radius={[4, 4, 0, 0]} name="Resultado" />
                  </BarChart>
                ) : (
                  <LineChart data={evolucaoSemanal} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="semana"
                      tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                      axisLine={{ stroke: chartTheme.axisLine }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartTheme.axisTick }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `R$${Math.round(v / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText,
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                      formatter={(val: number) => [formatCurrency(val), ""]}
                    />
                    <Line
                      type="monotone"
                      dataKey="receita"
                      stroke={chartTheme.receita}
                      strokeWidth={2}
                      dot={{ r: 3, fill: chartTheme.receita }}
                      name="Receita"
                    />
                    <Line
                      type="monotone"
                      dataKey="custos"
                      stroke={chartTheme.custos}
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: chartTheme.custos }}
                      name="Custos"
                    />
                    <Line
                      type="monotone"
                      dataKey="lucro"
                      stroke={chartTheme.lucro}
                      strokeWidth={2}
                      dot={{ r: 3.5, fill: chartTheme.lucro }}
                      name="Resultado"
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Composição dos Custos de Operação (Ranking Real) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs lg:col-span-5 flex flex-col justify-between transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Composição dos Custos de Operação
                </h3>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  Total: {formatCurrency(custosTotais)}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground/80">
                Ranking Real
              </span>
            </div>

            {/* Ranking de Barras */}
            <div className="py-2.5 space-y-2.5">
              {distribuicaoCustos.map((item, idx) => {
                const isPrincipal = idx === 0 && item.valor > 0;
                return (
                  <div key={item.categoria} className="space-y-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium text-foreground truncate max-w-[200px]" title={item.categoria}>
                        {item.categoria}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-muted-foreground font-mono text-[11px]">
                          {formatCurrency(item.valor)}
                        </span>
                        <span className="font-bold text-foreground text-xs w-8 text-right">
                          {item.percentual.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/60 dark:bg-slate-800/40 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPrincipal ? "bg-blue-600 dark:bg-blue-500" : "bg-muted-foreground/35 dark:bg-slate-700/50"
                        )}
                        style={{
                          width: `${Math.min(100, item.percentual)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/50 pt-2 text-[11px] text-muted-foreground flex justify-between items-center">
              <span>Maior centro: <strong className="text-foreground">{distribuicaoCustos[0]?.categoria || "Folha CLT"}</strong></span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Base consolidada</span>
            </div>
          </div>
        </section>

        {/* 4. COMO ESTÃO OS MOTORES DO ORBE? — 4 CARDS SÍNTESE */}
        <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Motor 1: Operações por Volume */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    Operações por Volume
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 bg-muted/30 text-muted-foreground text-[10px] font-medium">
                  {motoresData?.volume.aprovadasPercent ?? 100}% OK
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Descargas</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatInteger(motoresData?.volume.totalDescargas ?? 0)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">caminhões</div>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Volume</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatInteger(motoresData?.volume.volumeCaixas ?? 0)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">caixas / plts</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Contratos Mensais:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(motoresData?.volume.modalidades.mensal ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caixa Imediato:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(motoresData?.volume.modalidades.caixaImediato ?? 0)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                {motoresData?.volume.pendentesConferencia ?? 0} pendentes
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/operacoes-volume")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 p-1 font-medium"
              >
                Ver Operações <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Motor 2: RH CLT & Banco de Horas (Destino oficial: /clt/pontos conforme RH-01) */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    CLT & Banco de Horas
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 bg-muted/30 text-muted-foreground text-[10px] font-medium">
                  {motoresData?.rhClt.totalColaboradores ?? 0} Ativos
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Saldo Banco</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {((motoresData?.rhClt.saldoBancoGeralMinutos ?? 0) / 60).toFixed(0)}h
                  </div>
                  <div className="text-[9px] text-muted-foreground">saldo apurado</div>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Horas Extras</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {motoresData?.rhClt.horasExtrasTotal ?? 0}h
                  </div>
                  <div className="text-[9px] text-muted-foreground">apuradas no ciclo</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Adicional Noturno:</span>
                  <span className="font-semibold text-foreground">{motoresData?.rhClt.adicionalNoturnoHoras ?? 0}h</span>
                </div>
                <div className="flex justify-between">
                  <span>Débitos Críticos:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{motoresData?.rhClt.colaboradoresSaldoCritico ?? 0} colaboradores</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Motor CLT</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/clt/pontos")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 p-1 font-medium"
              >
                Ver Ponto <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Motor 3: Diaristas */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    Diaristas
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 bg-muted/30 text-muted-foreground text-[10px] font-medium">
                  {motoresData?.diaristas.totalAtivos ?? 0} Cadastrados
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Presenças Sem.</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {motoresData?.diaristas.presencasSemanaAtual ?? 0}
                  </div>
                  <div className="text-[9px] text-muted-foreground">{formatCurrency(motoresData?.diaristas.valorSemanaAtual ?? 0)}</div>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Acumulado Mês</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatCurrency(motoresData?.diaristas.valorAcumuladoMes ?? 0)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">{motoresData?.diaristas.lotesConcluidosMes ?? 0} lotes fechados</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Ciclo Atual:</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Ciclo Semanal Ativo</span>
                </div>
                <div className="flex justify-between">
                  <span>Previsão Pagamento:</span>
                  <span className="font-semibold text-foreground">{motoresData?.diaristas.previsaoPagamento ?? "Sexta-feira"}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Grade e Lotes</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/operacional/diaristas")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 p-1 font-medium"
              >
                Ver Diárias <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Motor 4: Intermitentes */}
          <div className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    Intermitentes
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 bg-muted/30 text-muted-foreground text-[10px] font-medium">
                  {motoresData?.intermitentes.totalCadastrados ?? 0} Cadastrados
                </Badge>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Convocações</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {motoresData?.intermitentes.convocacoesAtivas ?? 0} ativas
                  </div>
                  <div className="text-[9px] text-muted-foreground">no período</div>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/30 p-2">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground">Valor Mês</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatCurrency(motoresData?.intermitentes.valorAcumuladoMes ?? 0)}
                  </div>
                  <div className="text-[9px] text-muted-foreground">acumulado</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground">
                <div className="flex justify-between">
                  <span>Status do Lote:</span>
                  <span className="font-medium text-foreground">{motoresData?.intermitentes.statusLote ?? "Lote consolidado"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remessa CNAB:</span>
                  <span className="font-medium text-foreground">{motoresData?.intermitentes.remessaCnabStatus ?? "Remessa regular"}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Lotes RH</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/operacional/intermitentes")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 p-1 font-medium"
              >
                Ver Lotes <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

        </section>

        {/* MENSAGEM EMPTY STATE QUANDO NÃO HÁ MOVIMENTAÇÃO REAL */}
        {isEmpresaSemMovimentacao && (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
            Sem movimentação financeira ou operacional registrada para esta competência e filtro selecionados.
          </div>
        )}

      </div>

      {/* DRAWER LATERAL DIREITO UNIFICADO (SUPORTA OS 5 KPIs COM DADOS REAIS) */}
      <ExecutiveKpiDrawer
        type={activeDrawer}
        open={Boolean(activeDrawer)}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
        onNavigate={(path) => navigate(path)}
        competencia={monthLabel}
        data={{
          faturamentoTotal,
          faturamentoAnterior: kpisAnterior?.faturamentoTotal,
          custosTotais,
          custosAnterior: (kpisAnterior?.finValorAprovado || 0) + (kpisAnterior?.custosGerais || 0),
          resultadoOperacional,
          resultadoAnterior: kpisAnterior?.lucroReal,
          margemOperacional,
          margemAnterior: kpisAnterior && kpisAnterior.faturamentoTotal > 0 ? (kpisAnterior.lucroReal / kpisAnterior.faturamentoTotal) * 100 : 0,
          caixaRecebido,
          aReceber,
          folhaValor: kpisAtual?.folhaValorAprovado || 0,
          diaristasValor: kpisAtual?.diaristasValorAprovado || 0,
          intermitentesValor: kpisAtual?.intermitentesValorAprovado || 0,
          custosExtrasValor: kpisAtual?.custosGerais || 0,
        }}
      />
    </AppShell>
  );
}
