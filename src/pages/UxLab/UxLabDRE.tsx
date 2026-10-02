// ═══════════════════════════════════════════════════════════════════════════
// UX LAB — RESULTADO OPERACIONAL (DRE) V2 — PROTÓTIPO 1
// Arquitetura 3 Camadas: Síntese (KPIs) → Formação (Ledger) → Investigação
// Rota: /ux-lab/dre  |  Isolado de produção — dados exclusivamente mock
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  DollarSign,
  Target,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  BarChart2,
  Building2,
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
import { UxLabMetricCard } from "@/components/ux-lab/UxLabMetricCard";
import {
  UxLabThemeProvider,
  useUxLabTheme,
} from "@/components/ux-lab/UxLabThemeContext";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DRE_LEDGER,
  DRE_RESULTADO_LINE,
  DRE_BY_EMPRESA,
  DRE_COMPOSICAO,
  DRE_TENDENCIA_12M,
  DRE_RECEITA_BRUTA,
  DRE_MARGEM,
  DRE_MARGEM_META,
  DRE_MARGEM_MES_ANTERIOR,
  DRELedgerItem,
  DREComposicaoItem,
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
  isExpanded: boolean;
  onToggle: () => void;
}

function LedgerRow({ item, isExpanded, onToggle }: LedgerRowProps) {
  const isReceita = item.tipo === "receita";
  const isDeducao = item.tipo === "deducao";
  const hasDetails = item.detalhes.length > 0;

  // Semântica de cor: para custos, queda é BOA; para receita, subida é BOA
  const isGood = isDeducao ? item.deltaPercent < 0 : item.deltaPercent > 0;
  const barWidth = Math.max(2, Math.min(100, item.percentualReceita));

  return (
    <div
      className={cn(
        "border-b border-border/30 dark:border-white/[0.04] last:border-0",
        isReceita &&
          "bg-muted/20 dark:bg-white/[0.015] rounded-t-lg border-b-2 border-b-border/40 dark:border-b-white/[0.06] mb-1"
      )}
    >
      {/* Linha principal */}
      <div
        className={cn(
          "flex items-center gap-2 md:gap-4 py-3 px-2 rounded-lg transition-colors duration-150",
          hasDetails && "cursor-pointer hover:bg-muted/30 dark:hover:bg-white/[0.02]"
        )}
        onClick={hasDetails ? onToggle : undefined}
        role={hasDetails ? "button" : undefined}
        tabIndex={hasDetails ? 0 : undefined}
        onKeyDown={
          hasDetails
            ? (e) => { if (e.key === "Enter" || e.key === " ") onToggle(); }
            : undefined
        }
      >
        {/* Badge Sinal */}
        <span
          className={cn(
            "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-black font-mono",
            isReceita && "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300",
            isDeducao &&
              "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/30"
          )}
        >
          {item.sinal}
        </span>

        {/* Label + Barra de Progresso */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "font-semibold text-foreground dark:text-[#F1F3F5] truncate",
                isReceita ? "text-sm md:text-base" : "text-sm"
              )}
            >
              {item.label}
            </span>
            {hasDetails && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
                  isExpanded && "rotate-180"
                )}
              />
            )}
          </div>

          {/* Barra de Progresso — % da receita */}
          <div className="mt-1.5 relative h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.05] overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${barWidth}%`, backgroundColor: item.cor }}
            />
          </div>
        </div>

        {/* Valores: % / Valor / Delta */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <span className="hidden lg:block text-xs text-muted-foreground/60 dark:text-[#69717D] font-mono w-14 text-right">
            {fmtPct(item.percentualReceita)}
          </span>

          <span
            className={cn(
              "font-display font-bold text-right text-foreground dark:text-[#F1F3F5]",
              isReceita
                ? "text-base md:text-lg min-w-[110px]"
                : "text-sm md:text-base min-w-[100px]"
            )}
          >
            {fmt(item.valor)}
          </span>

          <span
            className={cn(
              "inline-flex items-center text-[11px] font-semibold w-14 justify-end",
              isGood
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            )}
          >
            {item.deltaPercent > 0 ? (
              <ArrowUpRight className="h-3 w-3 mr-0.5 shrink-0" />
            ) : (
              <ArrowDownRight className="h-3 w-3 mr-0.5 shrink-0" />
            )}
            {Math.abs(item.deltaPercent).toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Detalhe Expandido */}
      {isExpanded && hasDetails && (
        <div className="ml-10 mr-2 mb-3 animate-in slide-in-from-top-1 duration-200">
          <div className="rounded-xl border border-border/40 dark:border-white/[0.05] overflow-hidden bg-card dark:bg-[#0D1014]">
            {/* Descrição */}
            <div className="px-4 py-2.5 bg-muted/30 dark:bg-white/[0.015] border-b border-border/30 dark:border-white/[0.04]">
              <p className="text-xs text-muted-foreground dark:text-[#A0A7B2] leading-relaxed">
                <Info className="inline h-3 w-3 mr-1 mb-0.5 text-muted-foreground/60" />
                {item.descricao}
              </p>
            </div>

            {/* Tabela de Detalhes */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20 dark:border-white/[0.03]">
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      Composição
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      Valor
                    </th>
                    <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                      % do total
                    </th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 hidden md:table-cell">
                      Observação
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {item.detalhes.map((d, i) => (
                    <tr
                      key={i}
                      className="border-b border-border/10 dark:border-white/[0.025] last:border-0 hover:bg-muted/20 dark:hover:bg-white/[0.01] transition-colors"
                    >
                      <td className="px-4 py-2.5 text-foreground dark:text-[#F1F3F5]/80 leading-snug">
                        {d.label}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground dark:text-[#F1F3F5]">
                        {fmt(d.valor)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground dark:text-[#A0A7B2] font-mono">
                        {fmtPct(d.percentualPai)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground dark:text-[#69717D] hidden md:table-cell leading-snug">
                        {d.nota || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 dark:bg-white/[0.025] border-t border-border/30 dark:border-white/[0.04]">
                    <td className="px-4 py-2 font-bold text-[11px] text-muted-foreground uppercase tracking-wide">
                      Total
                    </td>
                    <td className="px-4 py-2 text-right font-display font-bold text-sm text-foreground dark:text-[#F1F3F5]">
                      {fmt(item.valor)}
                    </td>
                    <td className="px-4 py-2 text-right font-semibold text-[11px] text-muted-foreground dark:text-[#A0A7B2]">
                      {fmtPct(item.percentualReceita)} da receita
                    </td>
                    <td className="hidden md:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RESULTADO ROW ─────────────────────────────────────────────────────────────

function ResultadoRow() {
  const margemDelta = DRE_MARGEM - DRE_MARGEM_MES_ANTERIOR;
  const margemBarWidth = Math.min(100, (DRE_MARGEM / 40) * 100);
  const metaBarWidth = Math.min(100, (DRE_MARGEM_META / 40) * 100);

  return (
    <div className="rounded-2xl border-2 border-green-200/70 dark:border-green-900/40 bg-gradient-to-br from-green-50/80 to-emerald-50/30 dark:from-green-950/20 dark:to-emerald-950/10 p-4 md:p-5 shadow-sm">
      {/* Linha principal do resultado */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-600 text-white font-black text-lg font-mono shadow-sm shrink-0">
            =
          </span>
          <div>
            <div className="font-display text-base md:text-lg font-bold text-foreground dark:text-[#F1F3F5]">
              Resultado Operacional
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Gerencial operacional · antes de impostos e ajustes contábeis
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="font-display text-2xl md:text-3xl font-black text-green-700 dark:text-green-400 leading-none">
            {fmt(DRE_RESULTADO_LINE.valor)}
          </div>
          <div className="flex items-center justify-end gap-2 mt-1">
            <span className="text-xs text-muted-foreground">
              {fmtPct(DRE_RESULTADO_LINE.percentualReceita, 2)} da receita
            </span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3 w-3 mr-0.5" />
              +{DRE_RESULTADO_LINE.deltaPercent.toFixed(1)}% vs Set/26
            </span>
          </div>
        </div>
      </div>

      {/* Barra de Margem */}
      <div className="mt-4 space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-muted-foreground">
            Margem Operacional — Out/26
          </span>
          <span className="text-muted-foreground">
            Meta: {fmtPct(DRE_MARGEM_META)}
          </span>
        </div>

        <div className="relative h-3 w-full rounded-full bg-muted/60 dark:bg-white/[0.06] overflow-visible">
          {/* Marker de meta */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-amber-400 dark:bg-amber-500 z-10"
            style={{ left: `${metaBarWidth}%` }}
          />
          {/* Barra atual */}
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-700 ease-out"
            style={{ width: `${margemBarWidth}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <span className="font-bold text-green-700 dark:text-green-400">
              {fmtPct(DRE_MARGEM)} atual
            </span>
            <span className="text-muted-foreground/60">
              {fmtPct(DRE_MARGEM_MES_ANTERIOR)} em Set/26
            </span>
          </div>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
            +{margemDelta.toFixed(1)} pp vs mês ant. · +
            {(DRE_MARGEM - DRE_MARGEM_META).toFixed(1)} pp acima da meta
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

function InvestigationSection({ isDark }: { isDark: boolean }) {
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
    <div className="rounded-2xl border border-border dark:border-white/[0.06] bg-card dark:bg-[#111419] overflow-hidden shadow-xs">
      {/* Cabeçalho + Tabs */}
      <div className="border-b border-border/60 dark:border-white/[0.05] px-4 md:px-6 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground dark:text-[#F1F3F5]">
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
                    : "text-muted-foreground border-b-transparent hover:text-foreground dark:hover:text-[#F1F3F5] hover:border-b-border/40 dark:hover:border-b-white/[0.08]"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Conteúdo da aba ativa */}
      <div className="p-4 md:p-6 animate-in fade-in-50 duration-150">
        {activeTab === "empresa" && <TabEmpresa />}
        {activeTab === "composicao" && (
          <TabComposicao isDark={isDark} chartTheme={chartTheme} />
        )}
        {activeTab === "tendencia" && (
          <TabTendencia isDark={isDark} chartTheme={chartTheme} />
        )}
      </div>
    </div>
  );
}

// ── TAB: POR EMPRESA ──────────────────────────────────────────────────────────

function TabEmpresa() {
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

  const totals = DRE_BY_EMPRESA.reduce(
    (acc, e) => ({
      receita: acc.receita + e.receita,
      custos: acc.custos + e.custos,
      resultado: acc.resultado + e.resultado,
    }),
    { receita: 0, custos: 0, resultado: 0 }
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Quebra do resultado por unidade de negócio. Receita e custos atribuídos diretamente por empresa operadora.
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
            {DRE_BY_EMPRESA.map((e) => (
              <tr
                key={e.id}
                className="border-b border-border/20 dark:border-white/[0.025] last:border-0 hover:bg-muted/20 dark:hover:bg-white/[0.015] transition-colors"
              >
                <td className="px-4 py-3 font-medium text-foreground dark:text-[#F1F3F5]/90">
                  {e.empresa}
                </td>
                <td className="px-4 py-3 text-right font-mono font-semibold text-foreground dark:text-[#F1F3F5]">
                  {fmt(e.receita)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-muted-foreground dark:text-[#A0A7B2]">
                  {fmt(e.custos)}
                </td>
                <td className="px-4 py-3 text-right font-mono font-bold text-green-700 dark:text-green-400">
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
                    {e.deltaReceita >= 0 ? (
                      <ArrowUpRight className="h-3 w-3 mr-0.5" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3 mr-0.5" />
                    )}
                    {Math.abs(e.deltaReceita).toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 dark:bg-white/[0.03] border-t-2 border-border/40 dark:border-white/[0.06]">
              <td className="px-4 py-3 font-bold text-xs text-foreground dark:text-[#F1F3F5] uppercase tracking-wide">
                Consolidado Geral
              </td>
              <td className="px-4 py-3 text-right font-display font-bold text-sm text-foreground dark:text-[#F1F3F5]">
                {fmt(totals.receita)}
              </td>
              <td className="px-4 py-3 text-right font-display font-bold text-sm text-muted-foreground dark:text-[#A0A7B2]">
                {fmt(totals.custos)}
              </td>
              <td className="px-4 py-3 text-right font-display font-bold text-sm text-green-700 dark:text-green-400">
                {fmt(totals.resultado)}
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center justify-center rounded-full border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  {fmtPct(DRE_MARGEM)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="inline-flex items-center text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  8.4%
                </span>
              </td>
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
}: {
  isDark: boolean;
  chartTheme: ChartTheme;
}) {
  const totalCustos = DRE_COMPOSICAO.reduce((s, i) => s + i.valor, 0);

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Distribuição dos {fmt(totalCustos)} em custos totais por categoria.
        Identifica as principais alavancas de otimização operacional.
      </p>
      <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
        {/* Donut Chart */}
        <div className="flex-shrink-0 w-[200px] h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={DRE_COMPOSICAO}
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={90}
                paddingAngle={3}
                dataKey="valor"
                nameKey="nome"
                startAngle={90}
                endAngle={-270}
              >
                {DRE_COMPOSICAO.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.cor}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as DREComposicaoItem;
                  return (
                    <div
                      className="rounded-lg border p-2.5 text-xs shadow-md"
                      style={{
                        background: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText,
                      }}
                    >
                      <p className="font-bold mb-1">{d.nome}</p>
                      <p className="font-mono">{fmt(d.valor)}</p>
                      <p style={{ color: chartTheme.axisTick }}>
                        {fmtPct(d.percentual)} dos custos
                      </p>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda com barras de proporção */}
        <div className="flex-1 space-y-3 w-full">
          {DRE_COMPOSICAO.map((item) => (
            <div key={item.nome} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="flex-shrink-0 w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.cor }}
                  />
                  <span className="text-xs font-medium text-foreground dark:text-[#F1F3F5]/80 truncate">
                    {item.nome}
                  </span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-bold text-foreground dark:text-[#F1F3F5] font-mono">
                    {fmt(item.valor)}
                  </span>
                  <span className="text-xs text-muted-foreground dark:text-[#A0A7B2] font-mono w-10 text-right">
                    {fmtPct(item.percentual)}
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.06] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${item.percentual}%`,
                    backgroundColor: item.cor,
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          ))}

          {/* Total */}
          <div className="pt-2.5 border-t border-border/30 dark:border-white/[0.04] flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              Total Custos
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-display font-bold text-foreground dark:text-[#F1F3F5]">
                {fmt(totalCustos)}
              </span>
              <span className="text-xs font-bold text-muted-foreground font-mono w-10 text-right">
                100%
              </span>
            </div>
          </div>
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <p className="text-xs text-muted-foreground max-w-lg">
          Evolução mensal do resultado operacional e da margem (Nov/25 → Out/26).
          Linha tracejada = meta de margem {fmtPct(DRE_MARGEM_META)}.
          Coluna destacada = mês atual.
        </p>
        <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-green-500 opacity-80 inline-block" />
            Resultado
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-5 inline-block"
              style={{ borderTop: "2px dashed #D97706" }}
            />
            Margem %
          </span>
        </div>
      </div>

      <div className="h-[270px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={DRE_TENDENCIA_12M}
            margin={{ top: 8, right: 42, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={chartTheme.gridLine}
              vertical={false}
            />
            <XAxis
              dataKey="mes"
              tick={{ fontSize: 10, fill: chartTheme.axisTick }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10, fill: chartTheme.axisTick }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={(v) => `${v}%`}
              domain={[0, 40]}
              tick={{ fontSize: 10, fill: chartTheme.axisTick }}
              tickLine={false}
              axisLine={false}
              width={38}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const find = (key: string) =>
                  payload.find((p) => p.dataKey === key)?.value as
                    | number
                    | undefined;
                return (
                  <div
                    className="rounded-lg border p-3 text-xs shadow-md space-y-1 min-w-[170px]"
                    style={{
                      background: chartTheme.tooltipBg,
                      borderColor: chartTheme.tooltipBorder,
                      color: chartTheme.tooltipText,
                    }}
                  >
                    <p
                      className="font-bold mb-2 pb-1.5 border-b text-sm"
                      style={{ borderColor: chartTheme.tooltipBorder }}
                    >
                      {label}
                    </p>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: chartTheme.axisTick }}>Receita</span>
                      <span className="font-mono font-semibold">
                        {find("receita") !== undefined
                          ? fmt(find("receita")!)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span style={{ color: chartTheme.axisTick }}>Custos</span>
                      <span className="font-mono font-semibold">
                        {find("custos") !== undefined
                          ? fmt(find("custos")!)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 font-bold">
                      <span className="text-green-600 dark:text-green-400">
                        Resultado
                      </span>
                      <span className="font-mono text-green-600 dark:text-green-400">
                        {find("resultado") !== undefined
                          ? fmt(find("resultado")!)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span className="text-amber-600 dark:text-amber-400">
                        Margem
                      </span>
                      <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {find("margem") !== undefined
                          ? fmtPct(find("margem")!)
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              }}
            />
            {/* Linha de meta */}
            <ReferenceLine
              yAxisId="right"
              y={DRE_MARGEM_META}
              stroke="#D97706"
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{
                value: `Meta ${fmtPct(DRE_MARGEM_META)}`,
                position: "right",
                fontSize: 10,
                fill: "#D97706",
                dx: 4,
              }}
            />
            {/* Barras de Resultado */}
            <Bar
              yAxisId="left"
              dataKey="resultado"
              name="Resultado"
              radius={[3, 3, 0, 0]}
              maxBarSize={28}
            >
              {DRE_TENDENCIA_12M.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.isCurrent
                      ? "#16A34A"
                      : isDark
                      ? "#4ADE80"
                      : "#86EFAC"
                  }
                  opacity={entry.isCurrent ? 1 : 0.72}
                />
              ))}
            </Bar>
            {/* Linha de Margem % */}
            <Line
              yAxisId="right"
              dataKey="margem"
              name="Margem %"
              type="monotone"
              stroke="#D97706"
              strokeWidth={2}
              dot={{ r: 2.5, fill: "#D97706", strokeWidth: 0 }}
              activeDot={{ r: 4.5, fill: "#D97706" }}
            />
            {/* Linhas invisíveis para enriquecer o tooltip */}
            <Line
              yAxisId="left"
              dataKey="receita"
              stroke="transparent"
              dot={false}
            />
            <Line
              yAxisId="left"
              dataKey="custos"
              stroke="transparent"
              dot={false}
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

  const [competencia, setCompetencia] = useState("2026-10");
  const [empresa, setEmpresa] = useState("all");
  const [expandedLedgerItem, setExpandedLedgerItem] = useState<string | null>(
    null
  );

  const handleSidebarSelect = (id: string, label: string) => {
    if (id === "dre") return;
    if (id === "dashboard") { navigate("/ux-lab"); return; }
    if (id === "torre-operacional") { navigate("/ux-lab/torre"); return; }
    toast.info(`Módulo em homologação: ${label}`, {
      description:
        "Este módulo será disponibilizado nas próximas etapas do UX LAB.",
    });
  };

  const handleRefresh = () => {
    toast.success("DRE recalculado", {
      description:
        "Dados demonstrativos atualizados para a competência selecionada.",
    });
  };

  const toggleLedgerItem = (id: string) => {
    setExpandedLedgerItem((prev) => (prev === id ? null : id));
  };

  return (
    <UxLabShell
      title="Resultado Operacional — DRE"
      subtitle="Formação progressiva do resultado · Outubro 2026 · Gerencial não contábil"
      activeItem="dre"
      onSelectItem={handleSidebarSelect}
      competencia={competencia}
      onCompetenciaChange={setCompetencia}
      empresa={empresa}
      onEmpresaChange={setEmpresa}
      onRefresh={handleRefresh}
    >
      <div className="space-y-5 pb-10 animate-in fade-in-50 duration-200">

        {/* Aviso metodológico */}
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200/70 dark:border-amber-800/30 bg-amber-50/60 dark:bg-amber-950/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-400">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
          <span className="leading-relaxed">
            <strong className="font-bold">DRE Gerencial Operacional</strong> —
            Relatório de resultado antes de impostos sobre lucro, depreciações e
            ajustes contábeis estatutários. Dados em consolidação para{" "}
            <strong>Outubro / 2026</strong>. Não substitui a DRE contábil/societária.
          </span>
        </div>

        {/* ── CAMADA 1: SÍNTESE ─────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 dark:text-[#69717D]">
              Camada 1
            </span>
            <span className="h-px flex-1 bg-border/40 dark:bg-white/[0.04]" />
            <span className="text-[11px] font-semibold text-muted-foreground dark:text-[#A0A7B2]">
              Síntese do Período
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <UxLabMetricCard
              label="Receita Bruta"
              value={fmt(DRE_RECEITA_BRUTA)}
              delta={{ value: "+8.4%", isPositive: true }}
              subtitle="vs Set/26 · Meta: R$450k superada"
              icon={TrendingUp}
            />

            <UxLabMetricCard
              label="Custos Totais"
              value={fmt(347120)}
              delta={{ value: "72,0% da receita", isNeutral: true }}
              subtitle="−1,6 pp vs Set/26 · margem expandindo"
              icon={DollarSign}
            />

            <UxLabMetricCard
              label="Resultado Operacional"
              value={fmt(135230)}
              delta={{ value: "+14.2%", isPositive: true }}
              subtitle="vs Set/26 · melhor competência do ano"
              icon={TrendingUp}
            />

            {/* KPI 4: Margem — card especial com barra de meta */}
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
                <div className="font-display text-2xl font-bold tracking-tight text-green-700 dark:text-green-400 sm:text-[26px] leading-none">
                  {fmtPct(DRE_MARGEM)}
                </div>

                <div className="mt-2.5 space-y-1">
                  <div className="h-1.5 w-full rounded-full bg-muted/60 dark:bg-white/[0.06] overflow-hidden relative">
                    <div
                      className="absolute inset-y-0 w-0.5 bg-amber-400 dark:bg-amber-500 z-10"
                      style={{ left: `${(DRE_MARGEM_META / 40) * 100}%` }}
                    />
                    <div
                      className="h-full rounded-full bg-green-500 transition-all duration-700"
                      style={{ width: `${(DRE_MARGEM / 40) * 100}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground/60 dark:text-[#69717D]">
                      Meta: {fmtPct(DRE_MARGEM_META)}
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{(DRE_MARGEM - DRE_MARGEM_META).toFixed(1)} pp acima
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/40 dark:border-white/[0.04] pt-1.5 text-[11px] text-muted-foreground/75 dark:text-[#69717D]">
                <span className="truncate">
                  Set/26: {fmtPct(DRE_MARGEM_MES_ANTERIOR)}
                </span>
                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 shrink-0 font-semibold">
                  <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  +{(DRE_MARGEM - DRE_MARGEM_MES_ANTERIOR).toFixed(1)} pp
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ── CAMADA 2: FORMAÇÃO DO RESULTADO ──────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 dark:text-[#69717D]">
              Camada 2
            </span>
            <span className="h-px flex-1 bg-border/40 dark:bg-white/[0.04]" />
            <span className="text-[11px] font-semibold text-muted-foreground dark:text-[#A0A7B2]">
              Formação do Resultado
            </span>
          </div>

          <div className="rounded-2xl border border-border dark:border-white/[0.06] bg-card dark:bg-[#111419] overflow-hidden shadow-xs">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between px-4 md:px-6 py-3 bg-muted/30 dark:bg-white/[0.02] border-b border-border/40 dark:border-white/[0.05]">
              <div>
                <h2 className="text-sm font-bold text-foreground dark:text-[#F1F3F5]">
                  Demonstrativo — Outubro / 2026
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Clique em qualquer linha para expandir o detalhamento. Δ = variação vs Setembro / 2026.
                </p>
              </div>
              <div className="hidden md:flex items-center gap-3 text-[10px] text-muted-foreground/50 dark:text-[#69717D] shrink-0">
                <span>% Receita</span>
                <span>|</span>
                <span>Valor</span>
                <span>|</span>
                <span>Δ vs Mês Ant.</span>
              </div>
            </div>

            {/* Linhas do Ledger */}
            <div className="px-3 md:px-5 py-2">
              {DRE_LEDGER.map((item) => (
                <LedgerRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedLedgerItem === item.id}
                  onToggle={() => toggleLedgerItem(item.id)}
                />
              ))}
            </div>

            {/* Separador visual */}
            <div className="mx-4 md:mx-6 border-t-2 border-dashed border-border/50 dark:border-white/[0.08]" />

            {/* Resultado — Linha Final */}
            <div className="px-3 md:px-5 pb-5 pt-3">
              <ResultadoRow />
            </div>
          </div>
        </section>

        {/* ── CAMADA 3: INVESTIGAÇÃO ────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 dark:text-[#69717D]">
              Camada 3
            </span>
            <span className="h-px flex-1 bg-border/40 dark:bg-white/[0.04]" />
            <span className="text-[11px] font-semibold text-muted-foreground dark:text-[#A0A7B2]">
              Investigação
            </span>
          </div>
          <InvestigationSection isDark={isDark} />
        </section>

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
