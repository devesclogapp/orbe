import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowLeftRight,
  Download,
  Printer,
  FileSpreadsheet,
  Building2,
  RefreshCw,
  X,
  ChevronRight,
  PieChart as PieIcon,
  ChevronDown,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTenant } from "@/contexts/TenantContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { AppShell } from "@/components/layout/AppShell";
import { ExecutiveMetricCard } from "@/components/dashboard/ExecutiveMetricCard";
import { DREOficialDrawer } from "./components/DREOficialDrawer";
import {
  buildDREKpis,
  buildDRELedger,
  buildDREComposicao,
  buildDRETendencia,
  exportDREToCSV,
  formatBRL,
  formatPercent,
  DRELedgerItem,
  ORBE_BLUE_SCALE,
} from "@/services/adapters/dreOficialAdapter";
import {
  DashboardConsolidadoService,
  OperationalIntegrityKPIs,
} from "@/services/dashboard.service";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const YEAR_OPTIONS = ["2027", "2026", "2025", "2024"];

const MONTH_FILTER_OPTIONS = [
  { value: "all", label: "Ano Inteiro / Todos" },
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

export default function RelatorioDRE() {
  const { tenant } = useTenant();
  const { environment } = usePreferences();

  // Filtros Globais
  const [year, setYear] = useState<string>("2026");
  const [month, setMonth] = useState<string>("10");
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("all");

  // Comparação Temporal
  const [isComparing, setIsComparing] = useState(false);
  const [compMonth, setCompMonth] = useState<string>("09");
  const [compYear, setCompYear] = useState<string>("2026");

  // Drawer de Investigação
  const [drawerItem, setDrawerItem] = useState<DRELedgerItem | null>(null);

  // Aba ativa do Hub de Investigação
  const [activeTab, setActiveTab] = useState<"empresa" | "composicao" | "tendencia">("composicao");

  const canonicalCompetencia = useMemo(() => {
    if (month === "all") return `${year}-all`;
    return `${year}-${month}`;
  }, [year, month]);

  const comparativeCompetencia = useMemo(() => {
    if (isComparing) {
      if (compMonth === "all") return `${compYear}-all`;
      return `${compYear}-${compMonth}`;
    }
    // Padrão automático: mês anterior
    if (month === "all") {
      return `${Number(year) - 1}-all`;
    }
    const currentRef = new Date(`${year}-${month}-01T12:00:00`);
    const prevDate = addMonths(currentRef, -1);
    return format(prevDate, "yyyy-MM");
  }, [isComparing, compYear, compMonth, year, month]);

  const empresaParam = selectedEmpresaId !== "all" ? selectedEmpresaId : undefined;

  // 1. Query: Lista de Empresas do Tenant (filtrada por ambiente)
  const { data: allEmpresas = [] } = useQuery({
    queryKey: ["dre_empresas_lista", tenant?.id],
    queryFn: () => EmpresaService.getAll(),
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 10,
  });

  const empresas = useMemo(() => {
    const isHomolog = environment === "HOMOLOGACAO";
    return allEmpresas.filter((e) => (isHomolog ? Boolean(e.is_teste) : !e.is_teste));
  }, [allEmpresas, environment]);

  // 2. Query Principal: KPIs da Competência Atual
  const {
    data: dreData,
    isLoading,
    error,
    refetch,
  } = useQuery<OperationalIntegrityKPIs>({
    queryKey: ["dre_kpis", year, month, empresaParam, environment],
    queryFn: () => DashboardConsolidadoService.getKpisAggregate(year, month, empresaParam),
    enabled: !!tenant?.id,
  });

  // 3. Query Comparativa: KPIs da Competência Comparativa
  const { data: dreCompData } = useQuery<OperationalIntegrityKPIs>({
    queryKey: ["dre_kpis_comp", comparativeCompetencia, empresaParam, environment],
    queryFn: () => {
      const [cYear, cMonth] = comparativeCompetencia.split("-");
      return DashboardConsolidadoService.getKpisAggregate(cYear, cMonth, empresaParam);
    },
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 10,
  });

  // 4. Query: Dados de 12 Meses para Tendência Anual (sob demanda/background)
  const { data: tendencia12M = [] } = useQuery({
    queryKey: ["dre_tendencia_12m", year, empresaParam, environment],
    queryFn: async () => {
      const months = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
      const snaps = await Promise.all(
        months.map((m) =>
          DashboardConsolidadoService.getKpisByCompetencia(`${year}-${m}`, empresaParam)
        )
      );
      return buildDRETendencia(snaps, year, canonicalCompetencia);
    },
    enabled: !!tenant?.id,
    staleTime: 1000 * 60 * 15,
  });

  // 5. Query: Decomposição por Empresa (quando selecionado "Todas as Unidades")
  const { data: empresasBreakdown = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["dre_empresas_breakdown", canonicalCompetencia, environment, empresas.map((e) => e.id).join(",")],
    queryFn: async () => {
      if (empresas.length === 0) return [];
      const results = await Promise.all(
        empresas.map(async (emp) => {
          const snap = await DashboardConsolidadoService.getKpisByCompetencia(
            canonicalCompetencia,
            emp.id
          );
          const rec = snap.faturamentoTotal ?? 0;
          const cus = (snap.finValorAprovado ?? 0) + (snap.custosGerais ?? 0);
          const res = snap.lucroReal ?? 0;
          const mar = rec > 0 ? (res / rec) * 100 : 0;
          return {
            id: emp.id,
            empresa: emp.nome,
            receita: rec,
            custos: cus,
            resultado: res,
            margem: mar,
          };
        })
      );
      return results;
    },
    enabled: !!tenant?.id && empresas.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  // Labels Contextuais
  const competenciaLabel = useMemo(() => {
    if (month === "all") return `Ano ${year}`;
    const date = new Date(Number(year), Number(month) - 1, 1);
    const mName = format(date, "MMMM", { locale: ptBR });
    return `${mName.charAt(0).toUpperCase() + mName.slice(1)} / ${year}`;
  }, [year, month]);

  const compLabel = useMemo(() => {
    if (isComparing) {
      if (compMonth === "all") return `Ano ${compYear}`;
      const date = new Date(Number(compYear), Number(compMonth) - 1, 1);
      const mName = format(date, "MMMM", { locale: ptBR });
      return `${mName.charAt(0).toUpperCase() + mName.slice(1)} / ${compYear}`;
    }
    const [cYear, cMonth] = comparativeCompetencia.split("-");
    if (cMonth === "all") return `Ano ${cYear}`;
    const date = new Date(Number(cYear), Number(cMonth) - 1, 1);
    const mName = format(date, "MMMM", { locale: ptBR });
    return `${mName.charAt(0).toUpperCase() + mName.slice(1)} / ${cYear}`;
  }, [isComparing, compYear, compMonth, comparativeCompetencia]);

  const empresaLabel = useMemo(() => {
    if (selectedEmpresaId === "all") return "Consolidado Geral (Todas Unidades)";
    const found = empresas.find((e) => e.id === selectedEmpresaId);
    return found ? found.nome : "Unidade Selecionada";
  }, [selectedEmpresaId, empresas]);

  // Adaptações de Dados
  const kpis = useMemo(
    () => buildDREKpis(dreData, dreCompData, isComparing, compLabel),
    [dreData, dreCompData, isComparing, compLabel]
  );

  const ledgerItems = useMemo(
    () => buildDRELedger(dreData, dreCompData, isComparing),
    [dreData, dreCompData, isComparing]
  );

  const composicaoCustos = useMemo(
    () => buildDREComposicao(dreData),
    [dreData]
  );

  // Ações de Exportação
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    exportDREToCSV(
      ledgerItems,
      kpis.resultado.value,
      kpis.margem.value,
      competenciaLabel,
      empresaLabel
    );
    toast.success("CSV exportado com sucesso", {
      description: `Demonstrativo de ${competenciaLabel} baixado.`,
    });
  };

  const handleRefresh = () => {
    refetch();
    toast.success("DRE atualizado", {
      description: "Dados recalculados a partir da base oficial.",
    });
  };

  // Tema adaptativo para gráficos Recharts
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

  return (
    <AppShell
      title="Resultado Operacional (DRE)"
      subtitle={`Demonstração Gerencial de Lucratividade, Faturamento e Custos Operacionais · ${competenciaLabel}`}
    >
      <div className="mx-auto max-w-[1700px] w-full px-4 sm:px-6 md:px-8 space-y-5 pb-20 animate-in fade-in-50 duration-300">
        {/* ── BARRA DE CONTROLES SUPERIORES (FILTROS) ──────────────────── */}
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
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Ano */}
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[100px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent>
                {YEAR_OPTIONS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Seletor de Mês */}
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="w-[150px] h-8 text-xs bg-background border-border/80">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_FILTER_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Ações Globais: Comparar, Exportar, Atualizar */}
          <div className="flex items-center gap-2">
            <Button
              variant={isComparing ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsComparing((prev) => !prev)}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 border-border/80",
                isComparing && "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50"
              )}
              title="Ativar comparação entre competências"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Comparar</span>
              {isComparing && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5 border-border/80"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Exportar</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 text-xs">
                <DropdownMenuItem onClick={handlePrint} className="gap-2 cursor-pointer py-2">
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Imprimir DRE</span>
                    <span className="text-[10px] text-muted-foreground">Documento A4 / PDF</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV} className="gap-2 cursor-pointer py-2">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground">Exportar CSV</span>
                    <span className="text-[10px] text-muted-foreground">Planilha consolidada</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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

        {/* ── BARRA DE COMPARAÇÃO ATIVA ───────────────────────────────── */}
        {isComparing && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-blue-200/70 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20 text-xs animate-in fade-in-50 duration-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Comparando:</span>
                <span className="underline decoration-blue-400/60 underline-offset-2">
                  {competenciaLabel}
                </span>
                <span className="text-muted-foreground/60">×</span>
              </div>

              {/* Seletor do Mês Comparativo */}
              <div className="w-[170px]">
                <Select value={compMonth} onValueChange={setCompMonth}>
                  <SelectTrigger className="h-7 text-xs bg-card border-blue-200 dark:border-blue-900/60 font-semibold">
                    <SelectValue placeholder="Mês Comparativo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_FILTER_OPTIONS.filter((m) => m.value !== month).map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor do Ano Comparativo */}
              <div className="w-[100px]">
                <Select value={compYear} onValueChange={setCompYear}>
                  <SelectTrigger className="h-7 text-xs bg-card border-blue-200 dark:border-blue-900/60 font-semibold">
                    <SelectValue placeholder="Ano" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y} className="text-xs">
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-[11px] text-muted-foreground hidden lg:inline">
                (Diferenças nominais e deltas percentuais exibidos nos cards e demonstrativo)
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsComparing(false)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-blue-100/50 dark:hover:bg-blue-900/30 gap-1"
            >
              <X className="h-3.5 w-3.5" />
              <span>Encerrar comparação</span>
            </Button>
          </div>
        )}

        {/* ── BARRA DE CONTEXTO E AUDITORIA ───────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                dreData?.auditoriaCompetencia?.status === "ok"
                  ? "border-emerald-200/80 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-400"
                  : "border-border/80 bg-muted/30 text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  dreData?.auditoriaCompetencia?.status === "ok"
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-muted-foreground"
                )}
              />
              {dreData?.auditoriaCompetencia?.status === "ok" ? "Dados Auditados" : "Dados Consistentes"}
            </span>

            <span className="text-muted-foreground/40 hidden sm:inline">·</span>

            <div className="flex items-center gap-1.5 font-medium text-foreground text-xs">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {competenciaLabel}
              </span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-muted-foreground">{empresaLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Última consolidação:</span>
            <strong className="text-foreground font-semibold">
              {dreData?.consolidadoEm ? format(new Date(dreData.consolidadoEm), "dd/MM/yyyy HH:mm") : "Recém consolidado"}
            </strong>
          </div>
        </div>

        {error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Falha ao processar Resultado Operacional</h3>
              <p className="text-xs text-red-600">{error instanceof Error ? error.message : "Erro de comunicação."}</p>
            </div>
          </div>
        ) : null}

        {/* ── 1. SÍNTESE DO PERÍODO — 4 KPIS EXECUTIVOS ────────────────── */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading && !dreData ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border p-4 bg-card space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))
          ) : (
            <>
              {/* KPI 1: Receita Operacional */}
              <ExecutiveMetricCard
                label="Receita Operacional"
                value={kpis.receita.formatted}
                delta={kpis.receita.delta}
                subtitle={kpis.receita.subtitle}
                icon={TrendingUp}
                isClickable={true}
                onClick={() => setDrawerItem(ledgerItems[0])}
              />

              {/* KPI 2: Custos Totais */}
              <ExecutiveMetricCard
                label="Custos Totais"
                value={kpis.custos.formatted}
                delta={kpis.custos.delta}
                subtitle={kpis.custos.subtitle}
                icon={DollarSign}
                isClickable={true}
                onClick={() => setDrawerItem(ledgerItems[1])}
              />

              {/* KPI 3: Resultado Operacional */}
              <ExecutiveMetricCard
                label="Resultado Operacional"
                value={kpis.resultado.formatted}
                delta={kpis.resultado.delta}
                subtitle={kpis.resultado.subtitle}
                icon={kpis.resultado.value < 0 ? TrendingDown : TrendingUp}
                isClickable={true}
                onClick={() => setDrawerItem(ledgerItems[0])}
              />

              {/* KPI 4: Margem Operacional */}
              <ExecutiveMetricCard
                label="Margem Operacional"
                value={kpis.margem.formatted}
                delta={kpis.margem.delta}
                subtitle={kpis.margem.subtitle}
                icon={Target}
                isClickable={false}
              />
            </>
          )}
        </section>

        {/* ── 2. O DEMONSTRATIVO EM CASCATA MODERNO (THE WATERFALL LEDGER) ── */}
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div>
              <h3 className="font-display text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                Demonstrativo em Cascata
              </h3>
              <p className="text-xs text-muted-foreground">
                Formação econômica do resultado gerencial · Clique nas linhas para abrir a decomposição analítica
              </p>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Regime de Competência
            </span>
          </div>

          {isLoading && !dreData ? (
            <div className="space-y-3 py-4">
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          ) : (
            <div className="space-y-1">
              {ledgerItems.map((item) => {
                const isReceita = item.tipo === "receita";
                const isDeducao = item.tipo === "deducao";
                // CONV-13-FIX02: A largura preenchida deve representar exclusivamente o valor da competência principal selecionada.
                // Quando o valor principal for zero: Largura preenchida = 0%.
                // Preservar o trilho neutro da barra. Não aplicar largura mínima artificial.
                const barWidth =
                  item.valor > 0 && item.percentualReceita > 0
                    ? Math.min(100, item.percentualReceita)
                    : 0;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group border-b border-border/40 last:border-0 rounded-lg transition-colors duration-150 cursor-pointer hover:bg-muted/40",
                      isReceita && "bg-muted/20 border-b-2 border-b-border/60 mb-2"
                    )}
                    onClick={() => setDrawerItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDrawerItem(item);
                      }
                    }}
                    title={`Abrir detalhamento de ${item.label}`}
                  >
                    <div className="flex items-center gap-2 sm:gap-4 py-3 px-3">
                      {/* Badge do Sinal Aritmético */}
                      <span
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-black font-mono shadow-xs",
                          isReceita && "bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200",
                          isDeducao && "bg-muted/80 text-muted-foreground border border-border/60"
                        )}
                      >
                        {item.sinal}
                      </span>

                      {/* Label e Barra Monocromática na Escala Azul ORBE */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-semibold text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
                              isReceita ? "text-sm sm:text-base font-bold" : "text-sm"
                            )}
                          >
                            {item.label}
                          </span>
                        </div>

                        {/* Barra de Progresso Proporcional (0% se valor for zero, sem artificialismos) */}
                        <div className="mt-1.5 relative h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                            style={{
                              width: `${barWidth}%`,
                              backgroundColor: item.cor,
                            }}
                          />
                        </div>
                      </div>

                      {/* Valores: Padrão vs Comparativo */}
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {isComparing && item.compValor !== undefined ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-display font-bold text-xs sm:text-sm text-foreground">
                                {formatBRL(item.valor)}
                              </span>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {formatBRL(item.compValor)} ({compLabel})
                              </div>
                            </div>

                            {/* Apresentação Semântica das Variações (CONV-13-FIX02) */}
                            <div className="text-right min-w-[75px]">
                              {item.variacaoStatus === "sem_variacao" ? (
                                <>
                                  <span className="inline-flex items-center text-[11px] font-bold font-mono text-muted-foreground">
                                    R$ 0
                                  </span>
                                  <div className="text-[10px] font-semibold font-mono text-muted-foreground">
                                    Sem variação
                                  </div>
                                </>
                              ) : item.variacaoStatus === "sem_base" ? (
                                <>
                                  <span className="inline-flex items-center text-[11px] font-bold font-mono text-muted-foreground">
                                    {item.formattedNominalDiff ?? formatBRL(item.diffNominal ?? 0)}
                                  </span>
                                  <div className="text-[10px] font-semibold font-mono text-muted-foreground">
                                    Sem base comparativa
                                  </div>
                                </>
                              ) : (
                                <>
                                  <span
                                    className={cn(
                                      "inline-flex items-center text-[11px] font-bold font-mono",
                                      isReceita && (item.diffNominal ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400",
                                      isReceita && (item.diffNominal ?? 0) < 0 && "text-rose-600 dark:text-rose-400",
                                      !isReceita && "text-muted-foreground"
                                    )}
                                  >
                                    {item.formattedNominalDiff ?? formatBRL(item.diffNominal ?? 0)}
                                  </span>
                                  <div
                                    className={cn(
                                      "text-[10px] font-semibold font-mono",
                                      isReceita && (item.diffPct ?? 0) > 0 && "text-emerald-600 dark:text-emerald-400",
                                      isReceita && (item.diffPct ?? 0) < 0 && "text-rose-600 dark:text-rose-400",
                                      !isReceita && "text-muted-foreground"
                                    )}
                                  >
                                    ({item.variacaoTexto ?? `${(item.diffPct ?? 0).toFixed(1)}%`})
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        ) : (
                          <>
                            <span className="hidden sm:block text-xs text-muted-foreground/75 font-mono w-14 text-right">
                              {formatPercent(item.percentualReceita)}
                            </span>

                            <span
                              className={cn(
                                "font-display font-bold text-right text-foreground",
                                isReceita ? "text-sm sm:text-base min-w-[95px]" : "text-xs sm:text-sm min-w-[85px]"
                              )}
                            >
                              {formatBRL(item.valor)}
                            </span>

                            {/* Variação percentual padrão (Modo Sem Comparação) */}
                            <span
                              className={cn(
                                "inline-flex items-center text-[11px] font-semibold w-14 justify-end font-mono",
                                item.valor === 0 && "text-muted-foreground",
                                item.valor > 0 && isReceita && item.deltaPercent >= 0 && "text-emerald-600 dark:text-emerald-400",
                                item.valor > 0 && isReceita && item.deltaPercent < 0 && "text-rose-600 dark:text-rose-400",
                                item.valor > 0 && !isReceita && "text-muted-foreground"
                              )}
                            >
                              {item.valor === 0 ? (
                                <>
                                  <Minus className="h-3 w-3 mr-0.5 shrink-0 opacity-70" />
                                  —
                                </>
                              ) : item.deltaPercent > 0 ? (
                                <>
                                  <ArrowUpRight className="h-3 w-3 mr-0.5 shrink-0 opacity-70" />
                                  {Math.abs(item.deltaPercent).toFixed(1)}%
                                </>
                              ) : item.deltaPercent < 0 ? (
                                <>
                                  <ArrowDownRight className="h-3 w-3 mr-0.5 shrink-0 opacity-70" />
                                  {Math.abs(item.deltaPercent).toFixed(1)}%
                                </>
                              ) : (
                                <>
                                  <Minus className="h-3 w-3 mr-0.5 shrink-0 opacity-70" />
                                  0,0%
                                </>
                              )}
                            </span>
                          </>
                        )}

                        <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* ── LINHA DE RESULTADO OPERACIONAL (=) ───────────────── */}
              <div className="mt-4 rounded-xl border border-border/80 bg-muted/20 p-4 shadow-2xs">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-foreground font-black text-sm font-mono shrink-0 border border-border/50">
                      =
                    </span>
                    <div>
                      <div className="font-display text-sm sm:text-base font-bold text-foreground">
                        Resultado Operacional
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Lucro bruto gerencial das operações logísticas · antes de despesas corporativas e impostos
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={cn(
                        "font-display text-xl sm:text-2xl font-black leading-none",
                        kpis.resultado.value < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
                      )}
                    >
                      {formatBRL(kpis.resultado.value)}
                    </div>

                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      <span className="text-[11px] text-muted-foreground">
                        {formatPercent(kpis.margem.value, 1)} da receita
                      </span>
                      {kpis.resultado.delta && (
                        <span
                          className={cn(
                            "inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full border",
                            kpis.resultado.delta.isNeutral
                              ? "text-muted-foreground bg-muted/40 border-border/60"
                              : kpis.resultado.delta.isPositive
                              ? "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900/40"
                              : "text-rose-700 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-950/30 dark:border-rose-900/40"
                          )}
                        >
                          {kpis.resultado.delta.isNeutral ? (
                            <Minus className="h-3 w-3 mr-0.5" />
                          ) : kpis.resultado.delta.isPositive ? (
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3 mr-0.5" />
                          )}
                          {kpis.resultado.delta.value} vs {compLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra de Margem Operacional Monocromática Azul ORBE (0% se não houver margem positiva) */}
                <div className="mt-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Margem Operacional</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {formatPercent(kpis.margem.value)} da receita operacional
                    </span>
                  </div>

                  <div className="h-2 w-full rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-700 ease-out"
                      style={{
                        width: `${kpis.resultado.value > 0 && kpis.margem.value > 0 ? Math.min(100, kpis.margem.value) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── 3. HUB DE INVESTIGAÇÃO (ABAS ANALÍTICAS) ──────────────────── */}
        <section className="rounded-2xl border border-border/80 bg-card p-5 shadow-xs space-y-4">
          <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">
                  Hub de Investigação Operacional
                </h3>
                <p className="text-xs text-muted-foreground">
                  Análise detalhada por unidade, composição de custos e evolução histórica
                </p>
              </div>

              <TabsList className="bg-muted/50 p-0.5 border border-border/60">
                <TabsTrigger value="empresa" className="text-xs">
                  Por Empresa
                </TabsTrigger>
                <TabsTrigger value="composicao" className="text-xs">
                  Composição de Custos
                </TabsTrigger>
                <TabsTrigger value="tendencia" className="text-xs">
                  Tendência 12 Meses
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ABA 1: POR EMPRESA */}
            <TabsContent value="empresa" className="pt-3">
              {isLoadingEmpresas ? (
                <div className="space-y-3 py-4">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : empresasBreakdown.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Nenhuma empresa com movimentação encontrada para o filtro selecionado.
                </div>
              ) : (
                <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border/40">
                        <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Empresa / Unidade Operacional
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Receita Operacional
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Custos Diretos
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Resultado Operacional
                        </th>
                        <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Margem %
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {empresasBreakdown.map((row) => (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                            {row.empresa}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                            {formatBRL(row.receita)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {formatBRL(row.custos)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3 text-right font-mono font-bold",
                              row.resultado < 0 ? "text-rose-600 dark:text-rose-400" : "text-blue-600 dark:text-blue-400"
                            )}
                          >
                            {formatBRL(row.resultado)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                            {formatPercent(row.margem)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            {/* ABA 2: COMPOSIÇÃO DE CUSTOS (DONUT RECHARTS) */}
            <TabsContent value="composicao" className="pt-3">
              {composicaoCustos.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Sem custos diretos aprovados para a competência selecionada.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={composicaoCustos}
                          dataKey="valor"
                          nameKey="nome"
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {composicaoCustos.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.cor} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(val: any) => [formatBRL(Number(val)), "Valor"]}
                          contentStyle={{
                            backgroundColor: chartTheme.tooltipBg,
                            borderColor: chartTheme.tooltipBorder,
                            color: chartTheme.tooltipText,
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Decomposição Monocromática de Mão de Obra e Extras
                    </h4>
                    <div className="space-y-2">
                      {composicaoCustos.map((item) => (
                        <div
                          key={item.nome}
                          className="flex items-center justify-between p-2.5 rounded-lg border border-border/50 bg-muted/10 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: item.cor }}
                            />
                            <span className="font-semibold text-foreground">{item.nome}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-foreground">
                              {formatBRL(item.valor)}
                            </span>
                            <span className="font-mono text-muted-foreground w-12 text-right">
                              {formatPercent(item.percentual)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ABA 3: TENDÊNCIA 12 MESES */}
            <TabsContent value="tendencia" className="pt-3">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={tendencia12M} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        name === "margem" ? formatPercent(Number(val)) : formatBRL(Number(val)),
                        name === "margem" ? "Margem %" : name === "receita" ? "Receita" : "Custos",
                      ]}
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText,
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="receita"
                      fill="#2563EB"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={30}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="margem"
                      stroke="#1D4ED8"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "#1D4ED8" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>
          </Tabs>
        </section>

        {/* ── 4. DRAWER ANALÍTICO OFICIAL ─────────────────────────────── */}
        <DREOficialDrawer
          item={drawerItem}
          open={Boolean(drawerItem)}
          onClose={() => setDrawerItem(null)}
          competenciaLabel={competenciaLabel}
          kpisAtual={dreData}
        />
      </div>
    </AppShell>
  );
}
