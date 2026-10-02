import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  ArrowRight,
  Package,
  Wrench,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  DollarSign,
  Activity,
  Percent,
  Wallet,
  Users,
  Calendar,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type KpiDrawerType = "faturamento" | "custos" | "lucro" | "margem" | "caixa" | null;

interface UxLabKpiDrawerProps {
  type: KpiDrawerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigateToSpecialist: (moduleTitle: string, description: string) => void;
  competencia?: string;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export const UxLabKpiDrawer: React.FC<UxLabKpiDrawerProps> = ({
  type,
  open,
  onOpenChange,
  onNavigateToSpecialist,
  competencia = "Outubro / 2026",
}) => {
  if (!type) return null;

  // 1. FATURAMENTO TOTAL
  if (type === "faturamento") {
    const composicao = [
      {
        categoria: "Operações por Volume",
        descricao: "Descargas de carretas e pallets faturados",
        valor: 398500,
        percentual: 82.6,
        icon: Package,
      },
      {
        categoria: "Serviços Extras",
        descricao: "Conserto de pallets, transbordos e adicionais",
        valor: 51650,
        percentual: 10.7,
        icon: Wrench,
      },
      {
        categoria: "Outras Receitas Operacionais",
        descricao: "Apoio logístico eventual e taxas contratuais",
        valor: 32200,
        percentual: 6.7,
        icon: FileText,
      },
    ];

    const liquidacao = [
      {
        status: "Recebido (Em Conta)",
        valor: 310420,
        percentual: 64.4,
        tipo: "sucesso",
      },
      {
        status: "A Receber (No Prazo)",
        valor: 133430,
        percentual: 27.7,
        tipo: "neutro",
      },
      {
        status: "Vencido (Inadimplente)",
        valor: 38500,
        percentual: 7.9,
        tipo: "critico",
      },
    ];

    const semanas = [
      { semana: "Semana 40", valor: 112000 },
      { semana: "Semana 41", valor: 124500 },
      { semana: "Semana 42", valor: 118000 },
      { semana: "Semana 43 (Atual)", valor: 127850 },
    ];

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Faturamento Total — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Composição analítica demonstrativa das receitas operacionais apuradas.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Total Faturado no Período
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(482350)}
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  +8.4% vs anterior
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 flex justify-between">
                <span>Competência anterior: R$ 444.950,00</span>
                <strong className="text-foreground font-semibold">+R$ 37.400,00</strong>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Bloco 1: Origem */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Origem da Receita (De onde veio?)
                </h4>
                <span className="text-[10px] text-muted-foreground">3 fontes</span>
              </div>

              <div className="space-y-2.5">
                {composicao.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.categoria}
                      className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5 transition-colors hover:bg-muted/20"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground shrink-0">
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-foreground">{item.categoria}</div>
                            <div className="text-[10px] text-muted-foreground">{item.descricao}</div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-display text-xs font-bold text-foreground">
                            {formatCurrency(item.valor)}
                          </div>
                          <div className="text-[10px] font-medium text-muted-foreground">
                            {item.percentual.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600"
                          style={{ width: `${item.percentual}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloco 2: Posição de Liquidação */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Posição Financeira (Liquidação)
                </h4>
                <span className="text-[10px] text-muted-foreground">Fluxo de Caixa</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {liquidacao.map((item) => (
                  <div
                    key={item.status}
                    className={cn(
                      "rounded-lg border p-2 text-left flex flex-col justify-between",
                      item.tipo === "critico"
                        ? "border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20"
                        : "border-border/80 bg-card"
                    )}
                  >
                    <div className="text-[10px] font-medium text-muted-foreground truncate" title={item.status}>
                      {item.status.split(" ")[0]}
                    </div>
                    <div className={cn(
                      "font-display text-xs font-bold mt-1",
                      item.tipo === "critico" ? "text-rose-700 dark:text-rose-400" : "text-foreground"
                    )}>
                      {formatCurrency(item.valor)}
                    </div>
                    <div className={cn(
                      "text-[9px] mt-0.5 font-medium",
                      item.tipo === "critico" ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                    )}>
                      {item.percentual.toFixed(0)}% do total
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco 3: Evolução Semanal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Evolução Semanal
                </h4>
                <span className="text-[10px] text-muted-foreground">Competência</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5 space-y-1.5">
                {semanas.map((s) => (
                  <div key={s.semana} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">{s.semana}</span>
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {formatCurrency(s.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé com CTA Azul Royal */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigateToSpecialist(
                "Receitas Operacionais",
                "Você avançou da síntese do KPI para a tela especialista de Receitas Operacionais, onde ocorrem as conferências detalhadas de faturas, contratos e duplicatas."
              )}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir Receitas Operacionais
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 2. CUSTOS & DESPESAS
  if (type === "custos") {
    const composicao = [
      {
        categoria: "Folha CLT & Encargos",
        descricao: "74 colaboradores diretos, provisões e encargos",
        valor: 180500,
        percentual: 52.0,
        destaque: true,
      },
      {
        categoria: "Diaristas Operacionais",
        descricao: "Diárias de apoio operacional por ciclo semanal",
        valor: 83300,
        percentual: 24.0,
        destaque: false,
      },
      {
        categoria: "Intermitentes",
        descricao: "Horas cumpridas e convocações ativas",
        valor: 41650,
        percentual: 12.0,
        destaque: false,
      },
      {
        categoria: "Custos Extras & Logística",
        descricao: "Lanches, ferramentas, insumos e manutenção",
        valor: 41670,
        percentual: 12.0,
        destaque: false,
      },
    ];

    const semanas = [
      { semana: "Semana 40", valor: 82000 },
      { semana: "Semana 41", valor: 89000 },
      { semana: "Semana 42", valor: 84500 },
      { semana: "Semana 43 (Atual)", valor: 91620 },
    ];

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Custos & Despesas — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              De onde vieram os R$ 347.120 de despesas operacionais da competência.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Total de Custos & Despesas
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(347120)}
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  -2.1% (economia)
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 flex justify-between">
                <span>Orçamento teto: R$ 360.000,00</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">Dentro do teto previsto</strong>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Bloco 1: Composição */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. De onde vieram os R$ 347.120?
                </h4>
                <span className="text-[10px] text-muted-foreground">4 categorias</span>
              </div>

              <div className="space-y-2.5">
                {composicao.map((item) => (
                  <div
                    key={item.categoria}
                    className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-foreground">{item.categoria}</div>
                        <div className="text-[10px] text-muted-foreground">{item.descricao}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-display text-xs font-bold text-foreground">
                          {formatCurrency(item.valor)}
                        </div>
                        <div className="text-[10px] font-medium text-muted-foreground">
                          {item.percentual.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted/60 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          item.destaque ? "bg-blue-600" : "bg-muted-foreground/35"
                        )}
                        style={{ width: `${item.percentual}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco 2: Comparativo com Competência Anterior */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Comparativo vs Mês Anterior
                </h4>
                <span className="text-[10px] text-muted-foreground">Variação Real</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Setembro / 2026 (Realizado):</span>
                  <span className="font-mono font-medium">{formatCurrency(354500)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Outubro / 2026 (Atual):</span>
                  <span className="font-mono font-bold text-foreground">{formatCurrency(347120)}</span>
                </div>
                <div className="border-t border-border/50 pt-1.5 flex justify-between items-center text-emerald-700 dark:text-emerald-400 font-semibold">
                  <span>Economia Apurada:</span>
                  <span>-R$ 7.380,00 (-2.1%)</span>
                </div>
              </div>
            </div>

            {/* Bloco 3: Evolução Semanal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Distribuição Semanal
                </h4>
                <span className="text-[10px] text-muted-foreground">Semanas</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5 space-y-1.5">
                {semanas.map((s) => (
                  <div key={s.semana} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">{s.semana}</span>
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {formatCurrency(s.valor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigateToSpecialist(
                "Despesas & Contas a Pagar",
                "Transição para a tela especialista de Despesas e Contas a Pagar, onde se controlam vencimentos, lotes RH e borderôs."
              )}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir Despesas / Contas a Pagar
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 3. LUCRO OPERACIONAL
  if (type === "lucro") {
    const semanas = [
      { semana: "Semana 40", lucro: 30000, margem: 26.8 },
      { semana: "Semana 41", lucro: 35500, margem: 28.5 },
      { semana: "Semana 42", lucro: 33500, margem: 28.4 },
      { semana: "Semana 43 (Atual)", lucro: 36230, margem: 28.3 },
    ];

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Lucro Operacional — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Como chegamos ao resultado operacional de R$ 135.230 no período.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Resultado Operacional
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(135230)}
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  +14.2% vs anterior
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 flex justify-between">
                <span>Mês anterior: R$ 118.400,00</span>
                <strong className="text-foreground font-semibold">+R$ 16.830,00</strong>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Bloco 1: Ponte de Cálculo Simples */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Ponte de Cálculo (Como chegamos neste valor?)
                </h4>
                <span className="text-[10px] text-muted-foreground">Demonstração</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">(+) Faturamento Total:</span>
                  <span className="font-mono font-bold text-foreground">{formatCurrency(482350)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>(-) Custos e Despesas:</span>
                  <span className="font-mono">{formatCurrency(347120)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="font-bold text-blue-600">(=) Lucro Operacional:</span>
                  <span className="font-mono font-display text-sm font-bold text-foreground">
                    {formatCurrency(135230)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bloco 2: Desempenho e Margem */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Eficiência de Conversão
                </h4>
                <span className="text-[10px] text-muted-foreground">Indicadores</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Margem Operacional</div>
                  <div className="font-display text-lg font-bold text-foreground mt-0.5">28.0%</div>
                  <div className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium mt-0.5">+3.0 p.p. vs meta</div>
                </div>
                <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Conversão Líquida</div>
                  <div className="font-display text-lg font-bold text-foreground mt-0.5">R$ 0,28 / R$ 1</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">retorno operacional</div>
                </div>
              </div>
            </div>

            {/* Bloco 3: Evolução Semanal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Lucro por Semana
                </h4>
                <span className="text-[10px] text-muted-foreground">Competência</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5 space-y-1.5">
                {semanas.map((s) => (
                  <div key={s.semana} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">{s.semana}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-semibold text-foreground">
                        {formatCurrency(s.lucro)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">({s.margem}%)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigateToSpecialist(
                "Resultado Operacional (DRE)",
                "Transição para a visão completa de DRE Gerencial, onde são calculados custos fixos, variáveis, impostos e resultado líquido."
              )}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir DRE
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 4. MARGEM OPERACIONAL
  if (type === "margem") {
    const semanas = [
      { semana: "Semana 40", margem: 26.8 },
      { semana: "Semana 41", margem: 28.5 },
      { semana: "Semana 42", margem: 28.4 },
      { semana: "Semana 43 (Atual)", margem: 28.3 },
    ];

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Margem Operacional — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Por que a margem operacional alcançou 28,0% na competência.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Margem Operacional Consolidada
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  28.0%
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  +3.0 p.p. vs meta
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 flex justify-between">
                <span>Meta estabelecida: 25.0% (MOCK)</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">+12% acima da meta</strong>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Bloco 1: Fórmula & Relação */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Relação de Cálculo
                </h4>
                <span className="text-[10px] text-muted-foreground">Fórmula</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
                <div className="text-center p-2 rounded bg-muted/30 font-mono text-[11px] text-foreground">
                  Margem = (Resultado Operacional ÷ Faturamento Total) × 100
                </div>
                <div className="flex justify-between items-center pt-1 text-muted-foreground">
                  <span>Resultado Operacional:</span>
                  <span className="font-mono text-foreground font-semibold">{formatCurrency(135230)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Faturamento Total:</span>
                  <span className="font-mono text-foreground font-semibold">{formatCurrency(482350)}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between items-center font-bold text-foreground">
                  <span>Margem Efetiva:</span>
                  <span className="text-blue-600 font-display text-sm">28.04%</span>
                </div>
              </div>
            </div>

            {/* Bloco 2: Histórico vs Meta */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Comparativo Histórico
                </h4>
                <span className="text-[10px] text-muted-foreground">Metas</span>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center p-2 rounded-lg border border-border/80 dark:border-border/25 text-xs">
                  <span className="text-muted-foreground">Competência Anterior (Set/26):</span>
                  <span className="font-bold text-foreground">25.0%</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg border border-border/80 dark:border-border/25 text-xs">
                  <span className="text-muted-foreground">Competência Atual (Out/26):</span>
                  <span className="font-bold text-blue-600">28.0% (+3.0 p.p.)</span>
                </div>
                <div className="flex justify-between items-center p-2 rounded-lg border border-border/80 dark:border-border/25 text-xs bg-muted/20">
                  <span className="text-muted-foreground">Meta de Planejamento (MOCK):</span>
                  <span className="font-semibold text-foreground">25.0%</span>
                </div>
              </div>
            </div>

            {/* Bloco 3: Estabilidade Semanal */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Estabilidade Semanal da Margem
                </h4>
                <span className="text-[10px] text-muted-foreground">Semanas</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5 space-y-1.5">
                {semanas.map((s) => (
                  <div key={s.semana} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground text-[11px]">{s.semana}</span>
                    <span className="font-mono text-[11px] font-semibold text-foreground">
                      {s.margem.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigateToSpecialist(
                "Resultado Operacional (DRE)",
                "Transição para a DRE Gerencial para análise de margem de contribuição por cliente, produto e filial."
              )}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir DRE
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 5. CAIXA & CONTAS
  if (type === "caixa") {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Caixa & Contas — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Como está nossa posição financeira, disponibilidade em conta e compromissos.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Disponibilidade Imediata em Conta
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(310000)}
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Conciliado
                </span>
              </div>
              <div className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 flex justify-between">
                <span>Contas a Pagar no mês: R$ 128.400,00</span>
                <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">Cobertura 2.41x</strong>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Bloco 1: Contas a Receber vs Vencido */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Contas a Receber (Aging)
                </h4>
                <span className="text-[10px] text-muted-foreground">Recebíveis</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5">
                  <div className="text-[10px] text-muted-foreground">A Receber no Prazo</div>
                  <div className="font-display text-sm font-bold text-foreground mt-0.5">
                    {formatCurrency(158150)}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">vencimento no ciclo</div>
                </div>

                <div className="rounded-lg border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 p-2.5">
                  <div className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">Vencido (&gt;10d)</div>
                  <div className="font-display text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                    {formatCurrency(14200)}
                  </div>
                  <div className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">2 faturas em cobrança</div>
                </div>
              </div>
            </div>

            {/* Bloco 2: Contas a Pagar */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  2. Contas a Pagar & Compromissos
                </h4>
                <span className="text-[10px] text-muted-foreground">Saídas</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center text-amber-700 font-semibold">
                  <span>Vencendo Hoje:</span>
                  <span className="font-mono">{formatCurrency(18500)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>A Vencer no Ciclo:</span>
                  <span className="font-mono">{formatCurrency(109900)}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between items-center font-bold text-foreground">
                  <span>Total Contas a Pagar:</span>
                  <span className="font-mono">{formatCurrency(128400)}</span>
                </div>
              </div>
            </div>

            {/* Bloco 3: Saldo Projetado do Ciclo */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  3. Saldo Projetado ao Fim do Ciclo
                </h4>
                <span className="text-[10px] text-muted-foreground">Projeção</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Disponível Atual:</span>
                  <span className="font-mono">{formatCurrency(310000)}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>(+) Entradas Previstas:</span>
                  <span className="font-mono font-medium">+{formatCurrency(172350)}</span>
                </div>
                <div className="flex justify-between text-rose-700 dark:text-rose-400">
                  <span>(-) Saídas Programadas:</span>
                  <span className="font-mono font-medium">-{formatCurrency(128400)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-bold text-foreground">
                  <span>(=) Saldo Projetado:</span>
                  <span className="font-mono font-display text-sm text-blue-600">
                    {formatCurrency(353950)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigateToSpecialist(
                "Financeiro & Central Bancária",
                "Transição para a Central Financeira do ORBE, onde se gerenciam extratos, conciliação CNAB e contas correntes."
              )}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir Financeiro
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return null;
};
