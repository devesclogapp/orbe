// ═══════════════════════════════════════════════════════════════════════════
// UX LAB — RESULTADO OPERACIONAL (DRE) V2 — PROTÓTIPO 2
// Ferramentas Gerenciais: Competência, Empresa, Comparar, Exportar (Print/CSV)
// Rota: /ux-lab/dre  |  Isolado de produção — dados exclusivamente mock
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  Target,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  BarChart2,
  Building2,
  ArrowLeftRight,
  Download,
  Printer,
  FileSpreadsheet,
  ChevronDown,
  X,
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
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { toast } from "sonner";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UX_LAB_ROUTES } from "@/components/ux-lab/UxLabSidebar";
import { UxLabMetricCard } from "@/components/ux-lab/UxLabMetricCard";
import {
  UxLabThemeProvider,
  useUxLabTheme,
} from "@/components/ux-lab/UxLabThemeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { UxLabDREDrawer } from "@/components/ux-lab/UxLabDREDrawer";
import {
  MOCK_EMPRESAS_OPTIONS,
  MOCK_COMPETENCIAS_OPTIONS,
} from "@/pages/UxLab/mockData";
import {
  DRE_LEDGER,
  DRE_RESULTADO_LINE,
  DRE_BY_EMPRESA,
  DRE_COMPOSICAO,
  DRE_TENDENCIA_12M,
  DRE_RECEITA_OPERACIONAL,
  DRE_CUSTOS_TOTAIS,
  DRE_RESULTADO,
  DRE_MARGEM,
  DRE_MARGEM_MES_ANTERIOR,
  DRELedgerItem,
  DREComposicaoItem,
  ORBE_BLUE_SCALE,
  DRE_COMPETENCIAS_MAP,
  getDRESnapshot,
  getDREByEmpresaForCompetencia,
  DRESnapshot,
} from "./dreMockData";

// ── HELPERS ──────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const fmtPct = (v: number, decimals = 1) => `${v.toFixed(decimals)}%`;

// ── LEDGER ROW ────────────────────────────────────────────────────────────────

interface LedgerRowProps {
  item: DRELedgerItem;
  index: number;
  animate: boolean;
  onOpenDrawer: (item: DRELedgerItem) => void;
  isComparing?: boolean;
  compValor?: number;
  compLabel?: string;
}

function LedgerRow({
  item,
  index,
  animate,
  onOpenDrawer,
  isComparing = false,
  compValor,
  compLabel = "Set/26",
}: LedgerRowProps) {
  const isReceita = item.tipo === "receita";
  const isDeducao = item.tipo === "deducao";

  // REGRA SEMÂNTICA GLOBAL ORBE:
  // Receita: subida é positiva (verde), queda é negativa (vermelho)
  // Custos: variação descritiva neutra (não colore positivo/negativo sem regra semântica comprovada)
  const isRevenuePositive = isReceita && item.deltaPercent >= 0;
  const isRevenueNegative = isReceita && item.deltaPercent < 0;

  const barWidth = Math.max(2, Math.min(100, item.percentualReceita));
  const targetWidth = animate ? barWidth : 0;

  const diffNominal = compValor !== undefined ? item.valor - compValor : 0;
  const diffPct =
    compValor !== undefined && compValor > 0
      ? (diffNominal / compValor) * 100
      : 0;

  return (
    <div
      className={cn(
        "border-b border-border/30 dark:border-white/[0.04] last:border-0",
        isReceita &&
          "bg-muted/20 dark:bg-white/[0.015] rounded-t-lg border-b-2 border-b-border/40 dark:border-b-white/[0.06] mb-1"
      )}
    >
      {/* Linha principal clicável com affordance único e claro de drill-down para o Drawer */}
      <div
        className={cn(
          "group flex items-center gap-2 md:gap-4 py-3 px-2 rounded-lg transition-colors duration-150 cursor-pointer hover:bg-muted/40 dark:hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
        )}
        onClick={() => onOpenDrawer(item)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenDrawer(item);
          }
        }}
        title={`Abrir detalhamento de ${item.label} no painel lateral`}
        aria-label={`Abrir detalhamento de ${item.label}`}
      >
        {/* Badge Sinal Financeiro */}
        <span
          className={cn(
            "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-black font-mono shadow-xs",
            isReceita &&
              "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300",
            isDeducao &&
              "bg-muted/60 dark:bg-white/[0.04] text-muted-foreground border border-border/40 dark:border-white/[0.05]"
          )}
        >
          {item.sinal}
        </span>

        {/* Label + Barra de Progresso Monocromática com Animação de Entrada */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "font-semibold text-foreground truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors",
                isReceita ? "text-sm md:text-base" : "text-sm"
              )}
            >
              {item.label}
            </span>
          </div>

          {/* Barra de Progresso — Escala Tonal Azul ORBE com Animação */}
          <div className="mt-1.5 relative h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.05] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000 ease-out"
              style={{
                width: `${targetWidth}%`,
                backgroundColor: item.cor,
                transitionDelay: `${index * 80}ms`,
              }}
            />
          </div>
        </div>

        {/* Valores: Normal vs Comparativo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isComparing && compValor !== undefined ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span
                  className={cn(
                    "font-display font-bold text-xs sm:text-sm text-foreground"
                  )}
                >
                  {fmt(item.valor)}
                </span>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {fmt(compValor)} ({compLabel})
                </div>
              </div>

              <div className="text-right min-w-[70px]">
                <span
                  className={cn(
                    "inline-flex items-center text-[11px] font-bold font-mono",
                    isRevenuePositive && "text-emerald-600 dark:text-emerald-400",
                    isRevenueNegative && "text-rose-600 dark:text-rose-400",
                    !isReceita && "text-muted-foreground"
                  )}
                >
                  {diffNominal >= 0 ? "+" : ""}
                  {fmt(diffNominal)}
                </span>
                <div
                  className={cn(
                    "text-[10px] font-semibold font-mono",
                    isRevenuePositive && "text-emerald-600 dark:text-emerald-400",
                    isRevenueNegative && "text-rose-600 dark:text-rose-400",
                    !isReceita && "text-muted-foreground/75"
                  )}
                >
                  ({diffPct >= 0 ? "+" : ""}
                  {diffPct.toFixed(1)}%)
                </div>
              </div>
            </div>
          ) : (
            <>
              <span className="hidden xl:block text-xs text-muted-foreground/70 font-mono w-12 text-right">
                {fmtPct(item.percentualReceita)}
              </span>

              <span
                className={cn(
                  "font-display font-bold text-right text-foreground",
                  isReceita
                    ? "text-sm sm:text-base min-w-[95px]"
                    : "text-xs sm:text-sm min-w-[85px]"
                )}
              >
                {fmt(item.valor)}
              </span>

              {/* Indicador de Variação */}
              <span
                className={cn(
                  "inline-flex items-center text-[11px] font-semibold w-12 justify-end font-mono",
                  isRevenuePositive && "text-emerald-600 dark:text-emerald-400",
                  isRevenueNegative && "text-rose-600 dark:text-rose-400",
                  !isReceita && "text-muted-foreground dark:text-[#A0A7B2]"
                )}
              >
                {item.deltaPercent > 0 ? (
                  <ArrowUpRight className="h-3 w-3 mr-0.5 shrink-0 opacity-70" />
                ) : (
                  <ArrowDownRight className="h-3 w-3 mr-0.5 shrink-0 opacity-70" />
                )}
                {Math.abs(item.deltaPercent).toFixed(1)}%
              </span>
            </>
          )}

          {/* Chevron Indicador Único e Discreto de Drill-down para o Drawer */}
          <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ── RESULTADO ROW ─────────────────────────────────────────────────────────────

interface ResultadoRowProps {
  animate?: boolean;
  isComparing?: boolean;
  resultadoBase?: number;
  resultadoComp?: number;
  margemBase?: number;
  margemComp?: number;
  compLabel?: string;
}

function ResultadoRow({
  animate = false,
  isComparing = false,
  resultadoBase = DRE_RESULTADO_LINE.valor,
  resultadoComp = 118000,
  margemBase = DRE_MARGEM,
  margemComp = DRE_MARGEM_MES_ANTERIOR,
  compLabel = "Set/26",
}: ResultadoRowProps) {
  const margemDelta = margemBase - margemComp;
  const margemBarWidth = Math.min(100, (margemBase / 40) * 100);
  const targetWidth = animate ? margemBarWidth : 0;

  const diffResultado = resultadoBase - resultadoComp;
  const diffResultadoPct =
    resultadoComp > 0 ? (diffResultado / resultadoComp) * 100 : 0;

  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 sm:p-4 shadow-2xs">
      {/* Linha principal do resultado — Superfície Neutra e Hierarquia Tipográfica */}
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
              Gerencial operacional · antes de impostos e ajustes contábeis
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-display text-xl sm:text-2xl font-black text-foreground leading-none">
            {fmt(resultadoBase)}
          </div>
          {isComparing ? (
            <div className="text-[11px] text-muted-foreground font-mono mt-1">
              Comp ({compLabel}): {fmt(resultadoComp)} ·{" "}
              <span
                className={cn(
                  "font-bold",
                  diffResultado >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {diffResultado >= 0 ? "+" : ""}
                {fmt(diffResultado)} ({diffResultadoPct >= 0 ? "+" : ""}
                {diffResultadoPct.toFixed(1)}%)
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1.5 mt-1">
              <span className="text-[11px] text-muted-foreground">
                {fmtPct(margemBase, 2)} da receita
              </span>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                <ArrowUpRight className="h-3 w-3 mr-0.5" />
                +{DRE_RESULTADO_LINE.deltaPercent.toFixed(1)}% vs Set/26
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Barra de Margem Operacional — Limpa, Monocromática Azul e com Animação */}
      <div className="mt-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">
            Margem Operacional
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {fmtPct(margemBase)} da receita operacional
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-muted/60 dark:bg-white/[0.06] overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-1000 ease-out"
            style={{
              width: `${targetWidth}%`,
              transitionDelay: "450ms",
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground dark:text-[#F1F3F5]">
              {fmtPct(margemBase)} {isComparing ? "base" : "atual"}
            </span>
            <span className="text-muted-foreground/60 text-[11px]">
              ({fmtPct(margemComp)} em {compLabel})
            </span>
          </div>
          <span
            className={cn(
              "font-medium text-[11px]",
              margemDelta >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {margemDelta >= 0 ? "+" : ""}
            {margemDelta.toFixed(1)} pp vs {compLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── INVESTIGATION SECTION ─────────────────────────────────────────────────────

type InvTab = "empresa" | "composicao" | "tendencia";

interface ChartTheme {
  axisTick: string;
  gridLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
}

function InvestigationSection({
  isDark,
  selectedEmpresa,
  onSelectEmpresa,
  competencia = "2026-10",
  baseSnapshot,
}: {
  isDark: boolean;
  selectedEmpresa?: string;
  onSelectEmpresa?: (id: string) => void;
  competencia?: string;
  baseSnapshot: DRESnapshot;
}) {
  const [activeTab, setActiveTab] = useState<InvTab>("empresa");

  const chartTheme: ChartTheme = {
    axisTick: isDark ? "#69717D" : "#94A3B8",
    gridLine: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)",
    tooltipBg: isDark ? "#1A1F27" : "#FFFFFF",
    tooltipBorder: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    tooltipText: isDark ? "#F1F3F5" : "#0F172A",
  };

  const tabs: { id: InvTab; label: string; icon: React.ElementType }[] = [
    { id: "empresa", label: "Por Empresa", icon: Building2 },
    { id: "composicao", label: "Composição de Custos", icon: BarChart2 },
    { id: "tendencia", label: "Tendência 12 Meses", icon: TrendingUp },
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs flex flex-col flex-1 h-full min-h-0">
      {/* Cabeçalho + Tabs Fixo */}
      <div className="shrink-0 border-b border-border/60 px-4 md:px-6 pt-4 pb-0 bg-muted/10">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">
              Análise por Dimensão
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Empresa, composição de custos e evolução dos últimos 12 meses
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-[10px] border-blue-500/30 bg-blue-50 dark:bg-white/[0.04] text-blue-700 dark:text-blue-400 hidden sm:inline-flex"
          >
            3 dimensões
          </Badge>
        </div>

        <div className="flex gap-0.5 md:gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 md:px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-all duration-150",
                  isActive
                    ? "text-blue-700 dark:text-blue-400 border-b-blue-600 dark:border-b-blue-500 bg-blue-50/60 dark:bg-white/[0.04]"
                    : "text-muted-foreground border-b-transparent hover:text-foreground hover:border-b-border/40"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba ativa com scroll interno */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-dre p-4 md:p-6 animate-in fade-in-50 duration-150 overscroll-contain">
        {activeTab === "empresa" && (
          <TabEmpresa
            selectedEmpresa={selectedEmpresa}
            onSelectEmpresa={onSelectEmpresa}
            competencia={competencia}
          />
        )}
        {activeTab === "composicao" && (
          <TabComposicao
            isDark={isDark}
            chartTheme={chartTheme}
            baseSnapshot={baseSnapshot}
          />
        )}
        {activeTab === "tendencia" && (
          <TabTendencia isDark={isDark} chartTheme={chartTheme} />
        )}
      </div>
    </div>
  );
}

// ── TAB: POR EMPRESA ──────────────────────────────────────────────────────────

function TabEmpresa({
  selectedEmpresa,
  onSelectEmpresa,
  competencia = "2026-10",
}: {
  selectedEmpresa?: string;
  onSelectEmpresa?: (id: string) => void;
  competencia?: string;
}) {
  const margemColor = (m: number) => {
    if (m >= 25) return "text-emerald-600 dark:text-emerald-400";
    if (m >= 20) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
  };
  const margemBg = (m: number) => {
    if (m >= 25)
      return "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-900/30";
    if (m >= 20)
      return "bg-amber-50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-900/30";
    return "bg-rose-50 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/30";
  };

  const empresasList = getDREByEmpresaForCompetencia(competencia);
  const selectedName = empresasList.find((e) => e.id === selectedEmpresa)?.empresa;
  const activeEmp = empresasList.find((e) => e.id === selectedEmpresa);

  const totalReceita = empresasList.reduce((acc, e) => acc + e.receita, 0);
  const totalCustos = empresasList.reduce((acc, e) => acc + e.custos, 0);
  const totalResultado = totalReceita - totalCustos;
  const totalMargem = totalReceita > 0 ? (totalResultado / totalReceita) * 100 : 0;

  return (
    <div className="space-y-3">
      {selectedEmpresa && selectedEmpresa !== "all" && (
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs text-blue-800 dark:text-blue-300 animate-in fade-in-50 duration-150">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span>
              Filtro ativo no cabeçalho: <strong>{selectedName}</strong> ({fmt(activeEmp?.receita || 0)} • Margem {activeEmp?.margem.toFixed(1)}%). O demonstrativo principal e KPIs refletem esta unidade.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelectEmpresa?.("all")}
            className="text-[11px] font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity shrink-0"
          >
            Ver todas as unidades (Consolidado)
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Quebra do resultado por empresa operadora cadastrada na competência. Cada unidade possui dataset operacional próprio, sem rateio artificial de sede.
      </p>
      <div className="overflow-x-auto rounded-xl border border-border/40 dark:border-white/[0.05]">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/40 dark:bg-white/[0.02] border-b border-border/40 dark:border-white/[0.04]">
              {["Unidade", "Receita", "Custos", "Resultado", "Margem", "Δ Receita"].map(
                (h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70",
                      h === "Unidade" ? "text-left" : "text-right"
                    )}
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {empresasList.map((e) => {
              const isSelected = selectedEmpresa === e.id;
              return (
                <tr
                  key={e.id}
                  className={cn(
                    "border-b border-border/20 dark:border-white/[0.025] last:border-0 hover:bg-muted/20 dark:hover:bg-white/[0.015] transition-colors cursor-pointer",
                    isSelected &&
                      "bg-blue-50/50 dark:bg-blue-950/25 ring-1 ring-inset ring-blue-500/30 font-medium"
                  )}
                  onClick={() => onSelectEmpresa?.(e.id)}
                  title={`Filtrar DRE por ${e.empresa}`}
                >
                  <td className="px-4 py-3 font-medium text-foreground dark:text-[#F1F3F5]/90 flex items-center gap-2">
                    {e.empresa}
                    {isSelected && (
                      <Badge
                        variant="outline"
                        className="text-[9px] px-1 py-0 h-4 border-blue-400 text-blue-600 dark:text-blue-400"
                      >
                        Ativa
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-foreground dark:text-[#F1F3F5]">
                    {fmt(e.receita)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground dark:text-[#A0A7B2]">
                    {fmt(e.custos)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground dark:text-[#F1F3F5]">
                    {fmt(e.resultado)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-bold",
                        margemBg(e.margem),
                        margemColor(e.margem)
                      )}
                    >
                      {fmtPct(e.margem)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center text-[11px] font-semibold",
                        e.deltaReceita >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {e.deltaReceita >= 0 ? "+" : ""}
                      {e.deltaReceita.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/30 dark:bg-white/[0.02] border-t border-border/60 dark:border-white/[0.06] font-semibold text-foreground dark:text-[#F1F3F5]">
              <td className="px-4 py-2.5 text-[11px]">Consolidado Geral (3 unidades)</td>
              <td className="px-4 py-2.5 text-right font-mono">{fmt(totalReceita)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{fmt(totalCustos)}</td>
              <td className="px-4 py-2.5 text-right font-mono font-bold text-blue-600 dark:text-blue-400">{fmt(totalResultado)}</td>
              <td className="px-4 py-2.5 text-right font-mono font-bold">{fmtPct(totalMargem)}</td>
              <td className="px-4 py-2.5 text-right font-mono text-muted-foreground text-[10px]">Σ unidades</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── TAB: COMPOSIÇÃO DE CUSTOS ─────────────────────────────────────────────────

function TabComposicao({
  isDark,
  chartTheme,
  baseSnapshot,
}: {
  isDark: boolean;
  chartTheme: ChartTheme;
  baseSnapshot: DRESnapshot;
}) {
  const [animateDonut, setAnimateDonut] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setAnimateDonut(true), 60);
    return () => clearTimeout(timer);
  }, [baseSnapshot]);

  const totalCustos = baseSnapshot.custos;
  const composicaoData: DREComposicaoItem[] = [
    {
      nome: "Folha CLT & Encargos",
      valor: baseSnapshot.clt,
      percentual: totalCustos > 0 ? (baseSnapshot.clt / totalCustos) * 100 : 0,
      cor: ORBE_BLUE_SCALE.canonical.clt,
    },
    {
      nome: "Diaristas Operacionais",
      valor: baseSnapshot.diaristas,
      percentual: totalCustos > 0 ? (baseSnapshot.diaristas / totalCustos) * 100 : 0,
      cor: ORBE_BLUE_SCALE.canonical.diaristas,
    },
    {
      nome: "Intermitentes",
      valor: baseSnapshot.intermitentes,
      percentual: totalCustos > 0 ? (baseSnapshot.intermitentes / totalCustos) * 100 : 0,
      cor: ORBE_BLUE_SCALE.canonical.intermitentes,
    },
    {
      nome: "Custos Extras & Logística",
      valor: baseSnapshot.custosExtras,
      percentual: totalCustos > 0 ? (baseSnapshot.custosExtras / totalCustos) * 100 : 0,
      cor: ORBE_BLUE_SCALE.canonical.custosExtras,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Decomposição dos custos diretos da operação ({baseSnapshot.empresaLabel}). Participação de cada grupo no custo total reconhecido.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        {/* Donut Chart */}
        <div className="h-44 sm:h-48 relative flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={composicaoData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={3}
                dataKey="valor"
                animationDuration={900}
                animationEasing="ease-out"
              >
                {composicaoData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.cor}
                    stroke={isDark ? "#111419" : "#FFFFFF"}
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(val: number) => [fmt(val), "Valor"]}
                contentStyle={{
                  backgroundColor: chartTheme.tooltipBg,
                  borderColor: chartTheme.tooltipBorder,
                  borderRadius: "10px",
                  fontSize: "12px",
                  color: chartTheme.tooltipText,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
              Custos
            </span>
            <span className="font-display text-sm font-black text-foreground dark:text-[#F1F3F5]">
              {fmt(totalCustos)}
            </span>
          </div>
        </div>

        {/* Lista com Barras de Participação */}
        <div className="space-y-2.5">
          {composicaoData.map((c, i) => (
            <div key={c.nome} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: c.cor }}
                  />
                  <span className="font-medium text-foreground dark:text-[#F1F3F5] truncate text-[11px]">
                    {c.nome}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono shrink-0 text-[11px]">
                  <span className="text-muted-foreground font-semibold">
                    {fmt(c.valor)}
                  </span>
                  <span className="font-bold text-foreground dark:text-[#F1F3F5] w-9 text-right">
                    {c.percentual.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.05] overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-1000 ease-out"
                  style={{
                    width: animateDonut ? `${c.percentual}%` : "0%",
                    backgroundColor: c.cor,
                    transitionDelay: `${i * 120}ms`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── TAB: TENDÊNCIA 12 MESES ───────────────────────────────────────────────────

function TabTendencia({
  isDark,
  chartTheme,
}: {
  isDark: boolean;
  chartTheme: ChartTheme;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Evolução mensal de Receita (barras), Custos e Margem (linha). Competência destacada = mês corrente.
        </p>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-600 inline-block" />
            Receita
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2 rounded-xs bg-blue-600 dark:bg-blue-500 inline-block" />
            Margem %
          </span>
        </div>
      </div>

      <div className="h-56 sm:h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={DRE_TENDENCIA_12M}
            margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.gridLine}
              vertical={false}
            />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: chartTheme.axisTick }}
              axisLine={{ stroke: chartTheme.gridLine }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: chartTheme.axisTick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[15, 35]}
              tick={{ fontSize: 10, fill: chartTheme.axisTick }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip
              formatter={(val: number, name: string) => {
                if (name === "margem") return [`${val.toFixed(1)}%`, "Margem Operacional"];
                if (name === "receita") return [fmt(val), "Receita Operacional"];
                if (name === "custos") return [fmt(val), "Custos Totais"];
                if (name === "resultado") return [fmt(val), "Resultado Operacional"];
                return [val, name];
              }}
              labelFormatter={(label) => `Competência: ${label}`}
              contentStyle={{
                backgroundColor: chartTheme.tooltipBg,
                borderColor: chartTheme.tooltipBorder,
                borderRadius: "10px",
                fontSize: "12px",
                color: chartTheme.tooltipText,
                boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
              }}
            />
            <ReferenceLine
              yAxisId="right"
              y={25}
              stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.15)"}
              strokeDasharray="2 2"
              label={{
                value: "Média 25%",
                position: "insideBottomRight",
                fontSize: 9,
                fill: chartTheme.axisTick,
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="receita"
              fill={isDark ? "#1E293B" : "#E2E8F0"}
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
              animationDuration={1200}
              animationEasing="ease-out"
            >
              {DRE_TENDENCIA_12M.map((entry) => (
                <Cell
                  key={entry.mes}
                  fill={
                    entry.isCurrent
                      ? isDark
                        ? "#3B82F6"
                        : "#2563EB"
                      : isDark
                      ? "#1E293B"
                      : "#E2E8F0"
                  }
                />
              ))}
            </Bar>
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="margem"
              stroke="#1D4ED8"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#1D4ED8", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#2563EB" }}
              animationDuration={1500}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── MAIN CONTENT ──────────────────────────────────────────────────────────────

function UxLabDREContent() {
  const navigate = useNavigate();
  const { isDark } = useUxLabTheme();

  // Estados Globais
  const [competencia, setCompetencia] = useState("2026-10");
  const [empresa, setEmpresa] = useState("all");
  const [isComparing, setIsComparing] = useState(false);
  const [competenciaComparativa, setCompetenciaComparativa] = useState("2026-09");
  const [drawerItem, setDrawerItem] = useState<DRELedgerItem | null>(null);
  const [animateBars, setAnimateBars] = useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setAnimateBars(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const handleSidebarSelect = (id: string, label: string) => {
    if (id === "dre") return;
    const targetRoute = UX_LAB_ROUTES[id];
    if (targetRoute) {
      navigate(targetRoute);
      return;
    }
    toast.info(`Módulo em planejamento: ${label}`, {
      description: "Este módulo especialista será prototipado em sua própria fase do UX Lab.",
    });
  };

  const handleRefresh = () => {
    toast.success("DRE recalculado", {
      description: "Dados demonstrativos atualizados para a competência selecionada.",
    });
  };

  // ── RESOLUÇÃO RIGOROSA CONFORME EMPRESA E COMPETÊNCIA (SEM RATEIO PROPORCIONAL) ─
  const baseSnapshot = getDRESnapshot(competencia, empresa);
  const compSnapshot = getDRESnapshot(competenciaComparativa, empresa);

  const competenciaLabel = baseSnapshot.competenciaLabel;
  const compLabel = compSnapshot.competenciaLabel;
  const empresaLabel = baseSnapshot.empresaLabel;

  const activeReceita = baseSnapshot.receita;
  const activeCustos = baseSnapshot.custos;
  const activeResultado = baseSnapshot.resultado;
  const activeMargem = baseSnapshot.margem;

  const compReceita = compSnapshot.receita;
  const compCustos = compSnapshot.custos;
  const compResultado = compSnapshot.resultado;
  const compMargem = compSnapshot.margem;

  const deltaReceitaNominal = activeReceita - compReceita;
  const deltaReceitaPct =
    compReceita > 0 ? (deltaReceitaNominal / compReceita) * 100 : 0;

  const deltaCustosNominal = activeCustos - compCustos;
  const deltaCustosPct =
    compCustos > 0 ? (deltaCustosNominal / compCustos) * 100 : 0;

  const deltaResultadoNominal = activeResultado - compResultado;
  const deltaResultadoPct =
    compResultado > 0 ? (deltaResultadoNominal / compResultado) * 100 : 0;

  // Para Margem Operacional, variação estritamente em pontos percentuais (pp)
  const deltaMargemPP = activeMargem - compMargem;

  // Ledger Dinâmico rigoroso derivado dos componentes reais do snapshot
  const dynamicLedger = DRE_LEDGER.map((it) => {
    let valor = 0;
    let compValor = 0;
    let deltaPercent = 0;

    if (it.id === "receita-operacional") {
      valor = baseSnapshot.receita;
      compValor = compSnapshot.receita;
      deltaPercent = isComparing ? deltaReceitaPct : 8.6;
    } else if (it.id === "folha-clt") {
      valor = baseSnapshot.clt;
      compValor = compSnapshot.clt;
      deltaPercent = isComparing
        ? compValor > 0
          ? ((valor - compValor) / compValor) * 100
          : 0
        : 3.7;
    } else if (it.id === "diaristas") {
      valor = baseSnapshot.diaristas;
      compValor = compSnapshot.diaristas;
      deltaPercent = isComparing
        ? compValor > 0
          ? ((valor - compValor) / compValor) * 100
          : 0
        : 3.2;
    } else if (it.id === "intermitentes") {
      valor = baseSnapshot.intermitentes;
      compValor = compSnapshot.intermitentes;
      deltaPercent = isComparing
        ? compValor > 0
          ? ((valor - compValor) / compValor) * 100
          : 0
        : 6.7;
    } else if (it.id === "custos-extras") {
      valor = baseSnapshot.custosExtras;
      compValor = compSnapshot.custosExtras;
      deltaPercent = isComparing
        ? compValor > 0
          ? ((valor - compValor) / compValor) * 100
          : 0
        : 36.4;
    }

    const percentualReceita =
      activeReceita > 0 ? (valor / activeReceita) * 100 : 0;

    return {
      ...it,
      valor,
      percentualReceita,
      deltaPercent,
      compValor,
    };
  });

  // Ações de Impressão e Exportação
  const handlePrintDRE = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const now = new Date();
    const dateStr =
      now.toLocaleDateString("pt-BR") +
      " " +
      now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const metadata = [
      `DEMONSTRATIVO DO RESULTADO DO EXERCÍCIO — GERENCIAL OPERACIONAL`,
      `ORBE / ESC Logística`,
      `Competência:;${competenciaLabel}`,
      `Empresa / Unidade:;${empresaLabel}`,
      `Estado da Competência:;Dados consistentes`,
      `Data de Emissão:;${dateStr}`,
      ``,
    ];

    const headers = [
      "Conta / Descrição",
      "Tipo",
      "Sinal",
      "Valor (R$)",
      "% da Receita Operacional",
      "Variação vs Mês Anterior",
    ];

    const rows = dynamicLedger.map((it) => [
      `"${it.label}"`,
      it.tipo === "receita" ? "Receita Operacional" : "Custo Direto",
      it.sinal,
      it.valor.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      `${it.percentualReceita.toFixed(1)}%`,
      `${it.deltaPercent >= 0 ? "+" : ""}${it.deltaPercent.toFixed(1)}%`,
    ]);

    rows.push([
      `"RESULTADO OPERACIONAL"`,
      "Resultado Líquido",
      "=",
      activeResultado.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      `${activeMargem.toFixed(1)}% (Margem)`,
      `${deltaMargemPP >= 0 ? "+" : ""}${deltaMargemPP.toFixed(1)} pp`,
    ]);

    const csvContent =
      "\uFEFF" +
      metadata.join("\n") +
      headers.join(";") +
      "\n" +
      rows.map((r) => r.join(";")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `DRE_ESC_Log_${competenciaLabel.replace(/[^a-zA-Z0-9]/g, "_")}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exportado com sucesso", {
      description: `Demonstrativo consolidado de ${competenciaLabel} baixado.`,
    });
  };

  return (
    <UxLabShell
      title="Resultado Operacional — DRE"
      subtitle="Formação progressiva do resultado · Outubro 2026 · Demonstrativo Gerencial Operacional"
      activeItem="dre"
      onSelectItem={handleSidebarSelect}
      competencia={competencia}
      onCompetenciaChange={setCompetencia}
      empresa={empresa}
      onEmpresaChange={setEmpresa}
      onRefresh={handleRefresh}
    >
      <div className="space-y-5 pb-10 animate-in fade-in-50 duration-200">
        {/* ── CABEÇALHO EXCLUSIVO PARA IMPRESSÃO A4 (PRINT-ONLY) ─────── */}
        <div className="print-only mb-6 pb-4 border-b-2 border-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                ORBE · ESC Logística
              </div>
              <h1 className="text-xl font-black text-slate-900 mt-0.5">
                RESULTADO OPERACIONAL — DRE GERENCIAL OPERACIONAL
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                Demonstrativo de Formação do Resultado Operacional Bruto
              </div>
            </div>
            <div className="text-right text-xs space-y-0.5">
              <div>
                <span className="text-slate-500">Competência:</span>{" "}
                <strong>{competenciaLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500">Unidade:</span>{" "}
                <strong>{empresaLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500">Consistência:</span>{" "}
                <strong className="text-emerald-700">Dados consistentes</strong>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-200">
            <span>ESC Logística — Grupo ORBE · Uso Interno Gerencial</span>
            <span>
              Documento gerado em {new Date().toLocaleDateString("pt-BR")} às{" "}
              {new Date().toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        {/* ── BARRA DE AÇÕES GERENCIAIS DO DRE (PROTÓTIPO 2) ─────────── */}
        <div className="dre-no-print flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-xs">
          {/* Esquerda: Identificação de Contexto e Estado de Consistência */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Estado de Consistência Discreto */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span>Dados consistentes</span>
            </div>

            <span className="text-muted-foreground/40 hidden sm:inline">·</span>

            {/* Competência e Unidade Ativa */}
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {competenciaLabel}
              </span>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-muted-foreground">{empresaLabel}</span>
            </div>
          </div>

          {/* Direita: Ações Globais (Comparar, Exportar) */}
          <div className="flex items-center gap-2">
            {/* Botão Toggle Comparar */}
            <Button
              variant={isComparing ? "secondary" : "outline"}
              size="sm"
              onClick={() => setIsComparing((prev) => !prev)}
              className={cn(
                "h-8 text-xs font-semibold gap-1.5 border-border/80 dark:border-white/[0.08]",
                isComparing &&
                  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50"
              )}
              title="Ativar comparação entre competências"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
              <span>Comparar</span>
              {isComparing && (
                <span className="ml-1 w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </Button>

            {/* Menu Dropdown Exportar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs font-semibold gap-1.5 border-border/80 dark:border-white/[0.08] hover:bg-muted text-foreground"
                >
                  <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Exportar</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground/70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-56 text-xs bg-popover dark:bg-[#1A1F27] border-border dark:border-white/[0.06]"
              >
                <DropdownMenuItem
                  onClick={handlePrintDRE}
                  className="gap-2 cursor-pointer py-2 focus:bg-muted dark:focus:bg-white/[0.05]"
                >
                  <Printer className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground dark:text-[#F1F3F5]">
                      Imprimir DRE
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Documento A4 ou Salvar como PDF
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleExportCSV}
                  className="gap-2 cursor-pointer py-2 focus:bg-muted dark:focus:bg-white/[0.05]"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <div className="flex flex-col">
                    <span className="font-semibold text-foreground dark:text-[#F1F3F5]">
                      Exportar CSV
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Demonstrativo consolidado para Excel
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* ── BARRA COMPACTA DE COMPARAÇÃO ATIVA ─────────────────────── */}
        {isComparing && (
          <div className="dre-no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 text-xs animate-in fade-in-50 duration-200">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 font-semibold text-blue-700 dark:text-blue-300">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>Comparando:</span>
                <span className="underline decoration-blue-400/60 underline-offset-2">
                  {competenciaLabel}
                </span>
                <span className="text-muted-foreground/60">×</span>
              </div>

              {/* Seletor compacto da Competência Comparativa */}
              <div className="w-[190px]">
                <Select
                  value={competenciaComparativa}
                  onValueChange={setCompetenciaComparativa}
                >
                  <SelectTrigger className="h-7 text-xs bg-card dark:bg-[#15191F] border-blue-200 dark:border-blue-900/60 font-semibold text-foreground">
                    <SelectValue placeholder="Competência Comparativa" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover dark:bg-[#1A1F27] border-border dark:border-white/[0.06]">
                    {MOCK_COMPETENCIAS_OPTIONS.filter(
                      (opt) => opt.value !== competencia
                    ).map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <span className="text-[11px] text-muted-foreground hidden lg:inline">
                (Diferenças absolutas e variações em % / pp exibidas nos cards e demonstrativo)
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsComparing(false)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-blue-100/50 dark:hover:bg-blue-900/30 gap-1"
              title="Encerrar comparação"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Encerrar comparação</span>
            </Button>
          </div>
        )}

        {/* ── SÍNTESE DO PERÍODO (KPIS) ──────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-[#A0A7B2]">
              Síntese do Período
            </h2>
            <span className="h-px flex-1 bg-border/40 dark:bg-white/[0.04]" />
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              {competenciaLabel}
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <UxLabMetricCard
              label="Receita Operacional"
              value={fmt(activeReceita)}
              delta={
                isComparing
                  ? {
                      value: `${deltaReceitaPct >= 0 ? "+" : ""}${deltaReceitaPct.toFixed(1)}%`,
                      isPositive: deltaReceitaPct >= 0,
                    }
                  : { value: "+8.4%", isPositive: true }
              }
              subtitle={
                isComparing
                  ? `vs ${compLabel} (${deltaReceitaNominal >= 0 ? "+" : ""}${fmt(deltaReceitaNominal)})`
                  : "vs Set/26 (simulação UX)"
              }
              icon={TrendingUp}
            />

            <UxLabMetricCard
              label="Custos Totais"
              value={fmt(activeCustos)}
              delta={
                isComparing
                  ? {
                      value: `${deltaCustosPct >= 0 ? "+" : ""}${deltaCustosPct.toFixed(1)}%`,
                      isNeutral: true,
                    }
                  : {
                      value: `${fmtPct((activeCustos / activeReceita) * 100)} da receita`,
                      isNeutral: true,
                    }
              }
              subtitle={
                isComparing
                  ? `vs ${compLabel} (${deltaCustosNominal >= 0 ? "+" : ""}${fmt(deltaCustosNominal)})`
                  : "−1,6 pp vs Set/26"
              }
              icon={DollarSign}
            />

            <UxLabMetricCard
              label="Resultado Operacional"
              value={fmt(activeResultado)}
              delta={
                isComparing
                  ? {
                      value: `${deltaResultadoPct >= 0 ? "+" : ""}${deltaResultadoPct.toFixed(1)}%`,
                      isPositive: deltaResultadoPct >= 0,
                    }
                  : { value: "+14.2%", isPositive: true }
              }
              subtitle={
                isComparing
                  ? `vs ${compLabel} (${deltaResultadoNominal >= 0 ? "+" : ""}${fmt(deltaResultadoNominal)})`
                  : "vs Set/26"
              }
              icon={TrendingUp}
            />

            {/* KPI 4: Margem Operacional — Limpo e Sem Metas Fictícias */}
            <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-3.5 transition-all duration-200 shadow-xs dark:border-white/[0.05] dark:bg-[#15191F] dark:shadow-none">
              <div className="flex items-center justify-between gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80 dark:text-[#A0A7B2] truncate">
                  Margem Operacional
                </span>
                <Target
                  className="h-3.5 w-3.5 text-muted-foreground/50 dark:text-[#69717D]"
                  strokeWidth={1.75}
                />
              </div>

              <div className="mt-2">
                <div className="font-display text-2xl font-bold tracking-tight text-foreground dark:text-[#F1F3F5] sm:text-[26px] leading-none">
                  {fmtPct(activeMargem)}
                </div>

                <div className="mt-2.5 space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-[width] duration-1000 ease-out"
                      style={{
                        width: animateBars ? `${(activeMargem / 40) * 100}%` : "0%",
                        transitionDelay: "150ms",
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground/60 dark:text-[#69717D]">
                      Eficiência operacional
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {isComparing
                        ? `${compLabel}: ${fmtPct(compMargem)}`
                        : `Set/26: ${fmtPct(DRE_MARGEM_MES_ANTERIOR)}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 dark:border-white/[0.04] pt-1.5 text-[11px] text-muted-foreground/75 dark:text-[#69717D]">
                <span className="truncate">Variação mensal</span>
                <span
                  className={cn(
                    "inline-flex items-center shrink-0 font-semibold text-[11px]",
                    deltaMargemPP >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  )}
                >
                  {deltaMargemPP >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  )}
                  {deltaMargemPP >= 0 ? "+" : ""}
                  {deltaMargemPP.toFixed(1)} pp vs {isComparing ? compLabel : "Set/26"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── GRID 2 COLUNAS: DEMONSTRATIVO + ANÁLISE POR DIMENSÃO ─────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* ── COLUNA 1: SEÇÃO DEMONSTRATIVO ──────────────────────── */}
          <section className="flex flex-col lg:h-[560px] lg:max-h-[560px] min-h-0 space-y-2">
            <div className="flex items-center gap-2 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-[#A0A7B2]">
                Demonstrativo
              </h3>
              <span className="h-px flex-1 bg-border/40 dark:bg-white/[0.04]" />
            </div>

            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs flex flex-col flex-1 h-full min-h-0">
              {/* Cabeçalho Fixo */}
              <div className="shrink-0 flex items-center justify-between px-4 sm:px-5 py-3 bg-muted/30 border-b border-border/40">
                <div>
                  <h2 className="text-sm font-bold text-foreground">
                    Demonstrativo — {competenciaLabel}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isComparing
                      ? `Comparativo ativo com ${compLabel}. Clique para expandir.`
                      : "Clique em qualquer linha para expandir no Drawer lateral."}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-foreground/60 shrink-0">
                  {isComparing ? (
                    <>
                      <span>BASE</span>
                      <span>|</span>
                      <span>COMP ({compLabel})</span>
                      <span>|</span>
                      <span>Δ VARIAÇÃO</span>
                    </>
                  ) : (
                    <>
                      <span className="hidden xl:inline">% Rec.</span>
                      <span className="hidden xl:inline">|</span>
                      <span>Valor</span>
                      <span>|</span>
                      <span>Δ Mês Ant.</span>
                    </>
                  )}
                </div>
              </div>

              {/* Linhas do Ledger com Scroll Próprio e Drill-down no Drawer com Animação */}
              <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar-dre px-2 sm:px-4 py-2 space-y-0.5 overscroll-contain">
                {dynamicLedger.map((item, index) => (
                  <LedgerRow
                    key={item.id}
                    item={item}
                    index={index}
                    animate={animateBars}
                    onOpenDrawer={(selected) => setDrawerItem(selected)}
                    isComparing={isComparing}
                    compValor={item.compValor}
                    compLabel={compLabel}
                  />
                ))}
              </div>

              {/* Separador visual Fixo */}
              <div className="shrink-0 mx-3 sm:mx-5 border-t-2 border-dashed border-border/50" />

              {/* Resultado — Linha Final Fixa no rodapé */}
              <div className="shrink-0 px-2 sm:px-4 pb-3.5 pt-2.5 bg-card border-t border-border/20">
                <ResultadoRow
                  animate={animateBars}
                  isComparing={isComparing}
                  resultadoBase={activeResultado}
                  resultadoComp={compResultado}
                  margemBase={activeMargem}
                  margemComp={compMargem}
                  compLabel={compLabel}
                />
              </div>
            </div>
          </section>

          {/* ── COLUNA 2: SEÇÃO ANÁLISE POR DIMENSÃO ────────────────── */}
          <section className="flex flex-col lg:h-[560px] lg:max-h-[560px] min-h-0 space-y-2">
            <div className="flex items-center gap-2 shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground dark:text-[#A0A7B2]">
                Análise por Dimensão
              </h3>
              <span className="h-px flex-1 bg-border/40 dark:bg-white/[0.04]" />
            </div>
            <InvestigationSection
              isDark={isDark}
              selectedEmpresa={empresa}
              onSelectEmpresa={setEmpresa}
              competencia={competencia}
              baseSnapshot={baseSnapshot}
            />
          </section>
        </div>

        {/* Drawer Lateral Direito com Visão Expandida, Origem e Impressão */}
        <UxLabDREDrawer
          item={drawerItem}
          open={!!drawerItem}
          onClose={() => setDrawerItem(null)}
          competencia={competenciaLabel}
        />
      </div>
    </UxLabShell>
  );
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

export default function UxLabDRE() {
  return (
    <UxLabThemeProvider>
      <UxLabDREContent />
    </UxLabThemeProvider>
  );
}
