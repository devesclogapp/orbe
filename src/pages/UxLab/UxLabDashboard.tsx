import React, { useState } from "react";
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
  Sparkles,
  BarChart2,
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
import { toast } from "sonner";

import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabMetricCard } from "@/components/ux-lab/UxLabMetricCard";
import { UxLabKpiDrawer, KpiDrawerType } from "@/components/ux-lab/UxLabKpiDrawer";
import { UxLabThemeProvider, useUxLabTheme } from "@/components/ux-lab/UxLabThemeContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MOCK_EXECUTIVE_SUMMARY,
  ExecutiveSummary,
} from "./mockData";
import { cn } from "@/lib/utils";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

const formatInteger = (val: number) =>
  new Intl.NumberFormat("pt-BR").format(val);

function UxLabDashboardContent() {
  const { isDark } = useUxLabTheme();
  const [data] = useState<ExecutiveSummary>(MOCK_EXECUTIVE_SUMMARY);
  const [competencia, setCompetencia] = useState("2026-10");
  const [empresa, setEmpresa] = useState("all");
  const [activeItem, setActiveItem] = useState("dashboard");

  // Alternador visual para o gráfico de Evolução Semanal: Barras vs Linhas (V3.1)
  const [evolucaoChartMode, setEvolucaoChartMode] = useState<"barras" | "linhas">("barras");

  // Estado do Drawer de Drill-down ativo (abrange todos os 5 KPIs na V3.1)
  const [activeDrawer, setActiveDrawer] = useState<KpiDrawerType>(null);

  // Modal explicativo ao clicar em itens da Sidebar ou CTAs dos Drawers
  const [simulatedModal, setSimulatedModal] = useState<{
    open: boolean;
    title: string;
    description: string;
  }>({
    open: false,
    title: "",
    description: "",
  });

  const handleRefresh = () => {
    toast.success("Indicadores atualizados com sucesso", {
      description: "Dados recalculados com base na competência selecionada.",
    });
  };

  const handleSidebarSelect = (id: string, label: string) => {
    setActiveItem(id);
    if (id === "dashboard") return;

    setSimulatedModal({
      open: true,
      title: label,
      description: `O módulo "${label}" foi reorganizado na arquitetura da Sidebar do UX LAB e será homologado nas próximas etapas da evolução do ORBE.`,
    });
  };

  const handleNavigateToSpecialist = (title: string, description: string) => {
    setSimulatedModal({
      open: true,
      title,
      description,
    });
  };

  const { kpis, evolucaoSemanal, distribuicaoCustos, operacaoVolume, rhClt, diaristas, intermitentes, radarAlertas } = data;

  // Paleta adaptativa para Recharts (garante alto contraste e sobriedade em Light e Dark mode)
  const chartTheme = {
    receita: isDark ? "#e2e8f0" : "#0f172a", // #e2e8f0 (slate-200 sereno, neutro claro, off-white suave, não estourado)
    custos: isDark ? "#94a3b8" : "#94a3b8", // #94a3b8 (slate-400 neutro intermediário ~65% luminosidade, nítido contra a superfície do card)
    lucro: isDark ? "#3b82f6" : "#2563EB", // Azul Royal controlado sem neon
    axisTick: isDark ? "#64748b" : "hsl(0 0% 45%)", // silêncio visual
    axisLine: isDark ? "#1e293b" : "hsl(0 0% 87%)",
    gridLine: isDark ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.05)",
    tooltipBg: isDark ? "#1c222c" : "hsl(0 0% 100%)",
    tooltipBorder: isDark ? "#28303e" : "hsl(0 0% 87%)",
    tooltipText: isDark ? "#e2e8f0" : "hsl(0 0% 9%)",
  };

  return (
    <UxLabShell
      title="Dashboard Executivo V3.2.1"
      subtitle="Central de inteligência do ORBE · Base visual homologada · Calibração fina Dark UI e contraste sereno"
      activeItem={activeItem}
      onSelectItem={handleSidebarSelect}
      competencia={competencia}
      onCompetenciaChange={setCompetencia}
      empresa={empresa}
      onEmpresaChange={setEmpresa}
      onRefresh={handleRefresh}
    >
      <div className="space-y-4 pb-10 animate-in fade-in-50 duration-200">
        
        {/* BARRA DE CONTEXTO: ESTADO DOS CICLOS OPERACIONAIS */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-border/80 dark:border-border/30 bg-card px-3.5 py-2 shadow-xs transition-colors duration-200">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
              Ciclos:
            </span>

            {/* Ciclo CLT: Neutro com status de prazo */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 dark:border-border/30 bg-muted/40 dark:bg-muted/20 px-2 py-0.5 text-[11px] font-medium text-foreground">
              <Clock className="h-3 w-3 text-muted-foreground" />
              CLT: Aberto (fecha em 5d)
            </span>

            {/* Ciclo Diaristas: Atenção semântica pontual */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200/80 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Diaristas: Sem 43 em Análise RH
            </span>

            {/* Ciclo Financeiro: Neutro saudável */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/80 dark:border-border/30 bg-muted/40 dark:bg-muted/20 px-2 py-0.5 text-[11px] font-medium text-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              Financeiro: Conciliação em Dia
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="hidden sm:inline">Último sync RHID:</span>
            <strong className="text-foreground font-semibold">Hoje 07:01</strong>
          </div>
        </div>

        {/* 1. COMO ESTAMOS? — KPIs EXECUTIVOS SUPERIORES (TODOS OS 5 COM DRILL-DOWN ATIVO) */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Faturamento Total */}
          <UxLabMetricCard
            label="Faturamento Total"
            value={formatCurrency(kpis.faturamentoTotal)}
            delta={{
              value: `+${kpis.faturamentoDelta}%`,
              isPositive: true,
            }}
            subtitle="Meta: R$ 450k · Clique para detalhar"
            icon={TrendingUp}
            isClickable={true}
            onClick={() => setActiveDrawer("faturamento")}
          />

          {/* Card 2: Custos & Despesas */}
          <UxLabMetricCard
            label="Custos & Despesas"
            value={formatCurrency(kpis.custosTotais)}
            delta={{
              value: `${kpis.custosDelta}%`,
              isPositive: true, // redução é positiva
            }}
            subtitle="Abaixo do teto · Clique para detalhar"
            icon={DollarSign}
            isClickable={true}
            onClick={() => setActiveDrawer("custos")}
          />

          {/* Card 3: Lucro Operacional (Nomenclatura Corrigida: Resultado Operacional) */}
          <UxLabMetricCard
            label="Lucro Operacional"
            value={formatCurrency(kpis.lucroOperacional)}
            delta={{
              value: `+${kpis.lucroDelta}%`,
              isPositive: true,
            }}
            subtitle="Resultado Operacional · Clique para detalhar"
            icon={Activity}
            isClickable={true}
            onClick={() => setActiveDrawer("lucro")}
          />

          {/* Card 4: Margem Operacional */}
          <UxLabMetricCard
            label="Margem Operacional"
            value={`${kpis.margemOperacional.toFixed(1)}%`}
            delta={{
              value: "+3.0 p.p.",
              isPositive: true,
            }}
            subtitle={`Meta: ${kpis.margemMeta.toFixed(1)}% · Clique para detalhar`}
            icon={FileText}
            isClickable={true}
            onClick={() => setActiveDrawer("margem")}
          />

          {/* Card 5: Caixa & Contas (Clicável com Drawer Lateral Ativo) */}
          <div
            onClick={() => setActiveDrawer("caixa")}
            className="group flex flex-col justify-between overflow-hidden rounded-xl border border-border/80 dark:border-border/40 bg-card p-3.5 shadow-xs dark:shadow-none transition-all duration-200 cursor-pointer hover:border-blue-500/40 hover:bg-muted/15 dark:hover:border-slate-700/50 dark:hover:bg-muted/25"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                Caixa & Contas
              </span>
              <div className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.75} />
                <ChevronRight className="h-3 w-3 text-muted-foreground/30 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
              </div>
            </div>

            <div className="mt-2 flex items-baseline justify-between gap-2">
              <div className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-[26px] leading-none">
                {formatCurrency(kpis.caixaRecebido)}
              </div>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Em conta</span>
            </div>

            <div className="mt-2.5 flex items-center justify-between border-t border-border/40 dark:border-border/25 pt-1.5 text-[11px] text-muted-foreground/75 dark:text-muted-foreground/70">
              <span>A receber: <strong className="text-foreground font-semibold">{formatCurrency(kpis.aReceber)}</strong></span>
              <span className="text-blue-600 dark:text-blue-400 text-[10px] font-medium group-hover:underline">Detalhar</span>
            </div>
          </div>
        </section>

        {/* 2. O QUE PRECISA DA MINHA ATENÇÃO? — RADAR DE ATENÇÃO (SUPERFÍCIE CONTÍNUA SEM ENCAPSULAMENTOS) */}
        <section className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-4 shadow-xs dark:shadow-none transition-colors duration-200">
          <div className="flex items-center justify-between mb-3 pb-2.5 border-b border-border/50 dark:border-border/20">
            <div className="flex items-center gap-2">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-muted text-foreground/80 dark:bg-muted/40">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-border/60 dark:divide-border/30 pt-0.5">
            {radarAlertas.map((alerta) => {
              const isCritico = alerta.tipo === "critico";
              const isAtencao = alerta.tipo === "atencao";

              return (
                <div
                  key={alerta.id}
                  className="flex flex-col justify-between py-2 sm:py-0 px-0 sm:px-3.5 first:sm:pl-1 last:sm:pr-1 transition-colors hover:bg-muted/15 dark:hover:bg-muted/10 rounded-lg group"
                >
                  <div>
                    {/* Header minimalista com micro-dot semântico */}
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

                  <div className="mt-3 pt-2 border-t border-border/40 dark:border-border/20 flex items-center justify-between">
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
                      onClick={() => handleSidebarSelect("alerta-acao", alerta.acaoLabel)}
                      className="h-6 text-[10px] font-medium px-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30"
                    >
                      {alerta.acaoLabel}{" "}
                      <ChevronRight className="ml-0.5 h-3 w-3 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. COMO ESTAMOS EVOLUINDO? — TENDÊNCIAS & COMPOSIÇÃO DE CUSTOS */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Gráfico 1: Evolução Semanal com Alternância BARRAS ↔ LINHAS e Paleta Adaptativa */}
          <div className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-4 shadow-xs dark:shadow-none lg:col-span-7 flex flex-col justify-between transition-colors duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Evolução Semanal: Receita vs Custos vs Lucro
                </h3>
                <p className="text-xs text-muted-foreground/80">
                  Valores apurados em R$ na competência {competencia}
                </p>
              </div>

              {/* TOGGLE BARRAS ↔ LINHAS */}
              <div className="flex items-center gap-3">
                <div className="flex items-center rounded-lg border border-border/80 dark:border-border/30 bg-muted/40 dark:bg-muted/25 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setEvolucaoChartMode("barras")}
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors",
                      evolucaoChartMode === "barras"
                        ? "bg-card text-foreground shadow-xs dark:shadow-none font-semibold"
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
                        ? "bg-card text-foreground shadow-xs dark:shadow-none font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                    title="Visualização em curvas de tendência contínua"
                  >
                    <TrendingUp className="h-3 w-3" />
                    Linhas
                  </button>
                </div>

                {/* Legenda Corporativa com Cores Adaptativas */}
                <div className="hidden sm:flex items-center gap-2.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: chartTheme.receita }} />
                    <span className="text-muted-foreground dark:text-slate-300 text-[11px]">Receita</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: chartTheme.custos }} />
                    <span className="text-muted-foreground dark:text-slate-300 text-[11px]">Custos</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-xs" style={{ backgroundColor: chartTheme.lucro }} />
                    <span className="text-muted-foreground dark:text-slate-300 text-[11px]">Lucro</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Área do Gráfico (Barras ou Linhas com Contraste Calmo em Light e Dark) */}
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
                      tickFormatter={(v) => `R$${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText,
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{ color: chartTheme.axisTick }}
                      formatter={(val: number) => [formatCurrency(val), ""]}
                    />
                    <Bar dataKey="receita" fill={chartTheme.receita} radius={[4, 4, 0, 0]} name="Receita" />
                    <Bar dataKey="custos" fill={chartTheme.custos} radius={[4, 4, 0, 0]} name="Custos" />
                    <Bar dataKey="lucro" fill={chartTheme.lucro} radius={[4, 4, 0, 0]} name="Lucro" />
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
                      tickFormatter={(v) => `R$${v / 1000}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: chartTheme.tooltipBg,
                        borderColor: chartTheme.tooltipBorder,
                        color: chartTheme.tooltipText,
                        borderRadius: "8px",
                        fontSize: "12px",
                        boxShadow: isDark ? "0 4px 16px rgba(0,0,0,0.5)" : "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{ color: chartTheme.axisTick }}
                      formatter={(val: number) => [formatCurrency(val), ""]}
                    />
                    <Line
                      type="monotone"
                      dataKey="receita"
                      stroke={chartTheme.receita}
                      strokeWidth={2}
                      dot={{ r: 3, fill: chartTheme.receita }}
                      activeDot={{ r: 4.5 }}
                      name="Receita"
                    />
                    <Line
                      type="monotone"
                      dataKey="custos"
                      stroke={chartTheme.custos}
                      strokeWidth={1.75}
                      strokeDasharray="4 4"
                      dot={{ r: 2.5, fill: chartTheme.custos }}
                      activeDot={{ r: 4 }}
                      name="Custos"
                    />
                    <Line
                      type="monotone"
                      dataKey="lucro"
                      stroke={chartTheme.lucro}
                      strokeWidth={2}
                      dot={{ r: 3.5, fill: chartTheme.lucro }}
                      activeDot={{ r: 5 }}
                      name="Lucro"
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gráfico 2: Composição dos Custos (Ranking Consolidado com Destaque Azul Royal) */}
          <div className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-4 shadow-xs dark:shadow-none lg:col-span-5 flex flex-col justify-between transition-colors duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-foreground">
                  Composição dos Custos de Operação
                </h3>
                <p className="text-xs text-muted-foreground/80 mt-0.5">
                  Total: {formatCurrency(kpis.custosTotais)}
                </p>
              </div>
              <span className="text-[11px] font-semibold text-muted-foreground/80">
                Ranking
              </span>
            </div>

            {/* Ranking de Barras Coerente */}
            <div className="py-2.5 space-y-2.5">
              {distribuicaoCustos.map((item, idx) => {
                const isPrincipal = idx === 0; // Folha CLT (52%) é o maior custo
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
                    {/* Barra de Progresso: Destaque Azul Royal na categoria principal; neutro nas demais */}
                    <div className="h-2 w-full rounded-full bg-muted/60 dark:bg-slate-800/40 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isPrincipal ? "bg-blue-600 dark:bg-blue-600/80" : "bg-muted-foreground/35 dark:bg-slate-700/50"
                        )}
                        style={{
                          width: `${item.percentual}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border/50 dark:border-border/20 pt-2 text-[11px] text-muted-foreground flex justify-between items-center">
              <span>Maior centro de custo: <strong className="text-foreground">Folha CLT (52%)</strong></span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold">Orçamento sob controle</span>
            </div>
          </div>
        </section>

        {/* 4. COMO ESTÃO OS MOTORES DO ORBE? — 4 CARDS IRMÃOS (SEM ENCAPSULAMENTOS PESADOS) */}
        <section className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          
          {/* Motor 1: Operações por Volume */}
          <div className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-3.5 shadow-xs dark:shadow-none flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-muted/40">
                    <Package className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    Operações por Volume
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 dark:border-border/30 bg-muted/30 dark:bg-muted/20 text-muted-foreground text-[10px] font-medium">
                  {operacaoVolume.aprovadasPercent}% OK
                </Badge>
              </div>

              {/* Agrupamento tipográfico limpo sem caixas dentro de caixas no Dark */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Descargas</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatInteger(operacaoVolume.totalDescargas)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">caminhões</div>
                </div>

                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Volume</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatInteger(operacaoVolume.volumeCaixas)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">caixas / plts</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground/80 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Produtividade:</span>
                  <span className="font-semibold text-foreground">{operacaoVolume.produtividadeMediaCxH} cx/h</span>
                </div>
                <div className="flex justify-between">
                  <span>Contratos Mensais:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(operacaoVolume.modalidades.mensal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Caixa Imediato:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(operacaoVolume.modalidades.caixaImediato)}</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 dark:border-border/20 flex items-center justify-between">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
                {operacaoVolume.pendentesConferencia} pendentes
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSidebarSelect("operacoes-volume", "Operações por Volume")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30 p-1 font-medium"
              >
                Ver Operações <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Motor 2: Recursos Humanos CLT & Banco de Horas */}
          <div className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-3.5 shadow-xs dark:shadow-none flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-muted/40">
                    <Clock className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    CLT & Banco de Horas
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 dark:border-border/30 bg-muted/30 dark:bg-muted/20 text-muted-foreground text-[10px] font-medium">
                  {rhClt.totalColaboradores} Ativos
                </Badge>
              </div>

              {/* Agrupamento tipográfico limpo sem caixas dentro de caixas no Dark */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Saldo Banco</div>
                  <div className="font-display text-base font-bold text-foreground">
                    +{(rhClt.saldoBancoGeralMinutos / 60).toFixed(0)}h
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">superávit geral</div>
                </div>

                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Horas Extras</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {rhClt.horasExtrasTotal}h
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">50%: {rhClt.horasExtras50}h</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground/80 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Adicional Noturno:</span>
                  <span className="font-semibold text-foreground">{rhClt.adicionalNoturnoHoras}h apuradas</span>
                </div>
                <div className="flex justify-between">
                  <span>Débitos Críticos:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400">{rhClt.colaboradoresSaldoCritico} colaboradores</span>
                </div>
                <div className="flex justify-between">
                  <span>Sync RHID REP:</span>
                  <span className="font-medium text-foreground">100% OK às 07:01</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 dark:border-border/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/80 dark:text-slate-400">Motor CLT em dia</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSidebarSelect("banco-horas", "Banco de Horas")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30 p-1 font-medium"
              >
                Ver Banco <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Motor 3: Diaristas (MÓDULO INDEPENDENTE COM VISUAL IRMÃO) */}
          <div className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-3.5 shadow-xs dark:shadow-none flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-muted/40">
                    <Users className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    Diaristas
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 dark:border-border/30 bg-muted/30 dark:bg-muted/20 text-muted-foreground text-[10px] font-medium">
                  {diaristas.totalAtivos} Cadastrados
                </Badge>
              </div>

              {/* Agrupamento tipográfico limpo sem caixas dentro de caixas no Dark */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Presenças Sem.</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {diaristas.presencasSemanaAtual}
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">{formatCurrency(diaristas.valorSemanaAtual)}</div>
                </div>

                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Acumulado Mês</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatCurrency(diaristas.valorAcumuladoMes)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">{diaristas.lotesConcluidosMes} lotes pagos</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground/80 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Ciclo Atual:</span>
                  <span className="font-medium text-amber-700 dark:text-amber-400">Sem 43 em Análise RH</span>
                </div>
                <div className="flex justify-between">
                  <span>Previsão Pagamento:</span>
                  <span className="font-semibold text-foreground">{diaristas.previsaoPagamento}</span>
                </div>
                <div className="flex justify-between">
                  <span>Histórico CNAB:</span>
                  <span className="font-medium text-foreground">100% conciliado</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 dark:border-border/20 flex items-center justify-between">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">Lote aguardando RH</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSidebarSelect("diaristas", "Diaristas (Grade & Lotes)")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30 p-1 font-medium"
              >
                Ver Diárias <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Motor 4: Intermitentes (MÓDULO INDEPENDENTE COM VISUAL IRMÃO) */}
          <div className="rounded-xl border border-border/80 dark:border-border/30 bg-card p-3.5 shadow-xs dark:shadow-none flex flex-col justify-between transition-colors duration-200">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground dark:bg-muted/40">
                    <Calendar className="h-3.5 w-3.5" />
                  </div>
                  <h4 className="font-display text-xs font-bold text-foreground">
                    Intermitentes
                  </h4>
                </div>
                <Badge variant="outline" className="border-border/80 dark:border-border/30 bg-muted/30 dark:bg-muted/20 text-muted-foreground text-[10px] font-medium">
                  {intermitentes.totalCadastrados} Cadastrados
                </Badge>
              </div>

              {/* Agrupamento tipográfico limpo sem caixas dentro de caixas no Dark */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Convocações</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {intermitentes.convocacoesAtivas} ativas
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">{intermitentes.horasCumpridas}h cumpridas</div>
                </div>

                <div className="rounded-lg bg-muted/40 dark:bg-transparent border border-border/30 dark:border-0 p-2 dark:p-0.5">
                  <div className="text-[9px] uppercase font-semibold text-muted-foreground/80 dark:text-slate-400">Valor Mês</div>
                  <div className="font-display text-base font-bold text-foreground">
                    {formatCurrency(intermitentes.valorAcumuladoMes)}
                  </div>
                  <div className="text-[9px] text-muted-foreground/75 dark:text-slate-400">Sem: {formatCurrency(intermitentes.valorSemanaAtual)}</div>
                </div>
              </div>

              <div className="mt-2.5 space-y-1 text-[11px] text-muted-foreground/80 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>Status do Lote:</span>
                  <span className="font-medium text-foreground">{intermitentes.statusLote}</span>
                </div>
                <div className="flex justify-between">
                  <span>Remessa CNAB:</span>
                  <span className="font-medium text-foreground">{intermitentes.remessaCnabStatus}</span>
                </div>
                <div className="flex justify-between">
                  <span>Conformidade Legal:</span>
                  <span className="font-medium text-foreground">Contratos validados</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-border/40 dark:border-border/20 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/80 dark:text-slate-400">Convocações ativas</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSidebarSelect("intermitentes", "Intermitentes")}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/30 p-1 font-medium"
              >
                Ver Lotes <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </div>
          </div>

        </section>
      </div>

      {/* DRAWER LATERAL DIREITO UNIFICADO — SUPORTA OS 5 KPIs (COMPATÍVEL COM LIGHT & DARK) */}
      <UxLabKpiDrawer
        type={activeDrawer}
        open={Boolean(activeDrawer)}
        onOpenChange={(open) => !open && setActiveDrawer(null)}
        onNavigateToSpecialist={handleNavigateToSpecialist}
        competencia={data.competencia}
      />

      {/* DIALOG DE TRANSIÇÃO PEDAGÓGICA DO LAB */}
      <Dialog
        open={simulatedModal.open}
        onOpenChange={(open) => setSimulatedModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-md bg-card text-card-foreground border-border">
          <DialogHeader>
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              Proposta de Navegação do UX LAB
            </div>
            <DialogTitle className="font-display text-lg font-bold text-foreground">
              {simulatedModal.title}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-1">
              {simulatedModal.description}
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5 border border-border">
            <p className="font-semibold text-foreground">
              Fundação de Tema e Navegação:
            </p>
            <ol className="list-decimal pl-4 space-y-1">
              <li><strong>Tema Light/Dark:</strong> Suporte global com alternador Sun/Moon no Topbar e persistência em localStorage.</li>
              <li><strong>Contraste Adaptativo:</strong> Gráficos e dados ajustam luminosidade sem gerar poluição visual ou neon.</li>
              <li><strong>Drill-down nos 5 KPIs:</strong> Gavetas analíticas padronizadas compatíveis com ambos os temas.</li>
              <li><strong>Nomenclatura Corrigida:</strong> "Resultado Operacional" padronizado sem associar compulsoriamente a EBITDA.</li>
            </ol>
          </div>

          <DialogFooter className="mt-2">
            <Button
              type="button"
              onClick={() => setSimulatedModal((prev) => ({ ...prev, open: false }))}
              className="bg-blue-600 text-white hover:bg-blue-700 text-xs"
            >
              Compreendido, continuar avaliando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UxLabShell>
  );
}

export default function UxLabDashboard() {
  return (
    <UxLabThemeProvider>
      <UxLabDashboardContent />
    </UxLabThemeProvider>
  );
}
