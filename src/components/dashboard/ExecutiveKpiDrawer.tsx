import React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ExecutiveKpiDrawerType = "faturamento" | "custos" | "lucro" | "margem" | "caixa" | null;

export interface DrawerBreakdownItem {
  categoria: string;
  descricao: string;
  valor: number;
  percentual: number;
  icon?: React.ComponentType<{ className?: string }>;
  destaque?: boolean;
}

export interface ExecutiveKpiDrawerProps {
  type: ExecutiveKpiDrawerType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (path: string) => void;
  competencia?: string;
  canonicalCompetencia?: string;
  empresaId?: string;
  isLoading?: boolean;
  isError?: boolean;
  isStaleError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  inadimplenciaStatus?: "ok" | "loading" | "error" | "unavailable";
  onRetryInadimplencia?: () => void;
  data?: {
    faturamentoTotal: number;
    faturamentoAnterior?: number;
    custosTotais: number;
    custosAnterior?: number;
    resultadoOperacional: number;
    resultadoAnterior?: number;
    margemOperacional: number;
    margemAnterior?: number;
    caixaRecebido: number;
    aReceber: number;
    inadimplenteTotal?: number;
    folhaValor?: number;
    diaristasValor?: number;
    intermitentesValor?: number;
    custosExtrasValor?: number;
    contasAPagar?: number;
  };
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(val) ? val : 0);

type InadimplenciaDisplayState =
  | { state: "loading"; aReceberTotal: number }
  | { state: "error" | "unavailable"; aReceberTotal: number }
  | { state: "ok"; aReceberTotal: number; noPrazo: number; vencido: number };

function resolveInadimplenciaView(
  aReceber: number,
  inadimplenteTotal: number | undefined,
  status?: "ok" | "loading" | "error" | "unavailable"
): InadimplenciaDisplayState {
  const safeAReceber = Number.isFinite(aReceber) ? Math.max(0, aReceber) : 0;

  if (status === "loading") {
    return { state: "loading", aReceberTotal: safeAReceber };
  }

  if (
    status === "error" ||
    status === "unavailable" ||
    typeof inadimplenteTotal !== "number" ||
    !Number.isFinite(inadimplenteTotal)
  ) {
    return {
      state: status === "error" ? "error" : "unavailable",
      aReceberTotal: safeAReceber,
    };
  }

  const rawVencido = Math.max(0, inadimplenteTotal);
  const vencido = Number(Math.min(safeAReceber, rawVencido).toFixed(2));
  const noPrazo = Number(Math.max(0, safeAReceber - vencido).toFixed(2));

  return {
    state: "ok",
    aReceberTotal: safeAReceber,
    noPrazo,
    vencido,
  };
}

function StaleDataNotice({
  errorMessage,
  onRetry,
}: {
  errorMessage?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="rounded-lg border border-amber-300/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-xs space-y-1.5"
      data-testid="drawer-stale-warning"
      role="alert"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Dados desatualizados — falha ao atualizar
        </span>
        {onRetry && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="h-6 px-2 text-[10px] border-amber-400/70 dark:border-amber-700"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Tentar novamente
          </Button>
        )}
      </div>
      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-snug">
        {errorMessage ||
          "Os valores abaixo referem-se à última leitura carregada deste contexto e podem não refletir o estado atual."}
      </p>
    </div>
  );
}

export const ExecutiveKpiDrawer: React.FC<ExecutiveKpiDrawerProps> = ({
  type,
  open,
  onOpenChange,
  onNavigate,
  competencia = "Competência Atual",
  canonicalCompetencia,
  empresaId = "all",
  isLoading = false,
  isError = false,
  isStaleError = false,
  errorMessage,
  onRetry,
  inadimplenciaStatus,
  onRetryInadimplencia,
  data,
}) => {
  if (!type) return null;

  const staleBanner = isStaleError ? (
    <StaleDataNotice errorMessage={errorMessage} onRetry={onRetry} />
  ) : null;

  if (isLoading || (!data && !isError)) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Carregando indicador — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Atualizando os dados consolidados para o contexto selecionado.
            </SheetDescription>
            <div className="mt-4 rounded-xl border border-border/80 bg-card p-3.5 space-y-2" data-testid="drawer-loading-state">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-8 w-44" />
            </div>
          </div>
          <div className="flex-1 p-5 space-y-4">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if ((isError && !isStaleError) || !data) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Indicador indisponível — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Não foi possível carregar os dados financeiros deste KPI.
            </SheetDescription>
          </div>
          <div className="flex-1 p-5 flex flex-col items-center justify-center text-center gap-3" data-testid="drawer-error-state">
            <AlertCircle className="h-8 w-8 text-rose-500" />
            <p className="text-sm font-semibold text-foreground">
              Erro ao consultar os indicadores
            </p>
            <p className="text-xs text-muted-foreground max-w-xs">
              {errorMessage || "Os valores financeiros não puderam ser validados. Tente novamente."}
            </p>
            {onRetry && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tentar novamente
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const buildContextualNavigationUrl = (basePath: string) => {
    const params = new URLSearchParams();
    if (canonicalCompetencia) {
      params.set("mes", canonicalCompetencia);
    }
    if (empresaId && empresaId !== "all") {
      params.set("empresa", empresaId);
    }
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  const buildDreNavigationUrl = () => buildContextualNavigationUrl("/financeiro/dre");
  const buildReceitasNavigationUrl = () => buildContextualNavigationUrl("/financeiro/receitas");
  const buildFinanceiroNavigationUrl = () => buildContextualNavigationUrl("/financeiro");

  // 1. FATURAMENTO TOTAL
  if (type === "faturamento") {
    const faturamento = data.faturamentoTotal || 0;
    const anterior = data.faturamentoAnterior ?? 0;
    const variacao = anterior > 0 ? ((faturamento - anterior) / anterior) * 100 : null;
    const diferenca = faturamento - anterior;
    const inadimplenciaView = resolveInadimplenciaView(
      data.aReceber || 0,
      data.inadimplenteTotal,
      inadimplenciaStatus
    );

    const liquidacao = [
      {
        id: "recebido",
        titulo: "Recebido",
        status: "Recebido (Em Conta)",
        valor: data.caixaRecebido || 0,
        percentual: faturamento > 0 ? ((data.caixaRecebido || 0) / faturamento) * 100 : 0,
        tipo: "sucesso" as const,
        state: "ok" as const,
      },
      {
        id: "a-receber",
        titulo: inadimplenciaView.state === "ok" ? "A Receber (No Prazo)" : "A Receber (Total)",
        status: inadimplenciaView.state === "ok" ? "A Receber (No Prazo)" : "A Receber (Total)",
        valor:
          inadimplenciaView.state === "ok"
            ? inadimplenciaView.noPrazo
            : inadimplenciaView.aReceberTotal,
        percentual:
          faturamento > 0
            ? ((inadimplenciaView.state === "ok"
                ? inadimplenciaView.noPrazo
                : inadimplenciaView.aReceberTotal) /
                faturamento) *
              100
            : 0,
        tipo: "neutro" as const,
        state: inadimplenciaView.state,
      },
      {
        id: "vencido",
        titulo: "Vencido",
        status: "Vencido / Inadimplente",
        valor: inadimplenciaView.state === "ok" ? inadimplenciaView.vencido : null,
        percentual:
          faturamento > 0 && inadimplenciaView.state === "ok"
            ? (inadimplenciaView.vencido / faturamento) * 100
            : null,
        tipo:
          inadimplenciaView.state === "ok" && inadimplenciaView.vencido > 0
            ? ("critico" as const)
            : ("neutro" as const),
        state: inadimplenciaView.state,
      },
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
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Faturamento Total — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Posição consolidada das receitas operacionais apuradas no período.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Total Faturado no Período
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(faturamento)}
                </div>
                {variacao !== null ? (
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                    variacao >= 0
                      ? "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-200/80 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                  )}>
                    <TrendingUp className="h-3 w-3" />
                    {variacao >= 0 ? `+${variacao.toFixed(1)}%` : `${variacao.toFixed(1)}%`} vs anterior
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Base inicial</span>
                )}
              </div>
              {anterior > 0 && (
                <div className="mt-2 text-[11px] text-muted-foreground border-t border-border/40 pt-1.5 flex justify-between">
                  <span>Competência anterior: {formatCurrency(anterior)}</span>
                  <strong className={cn("font-semibold", diferenca >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600")}>
                    {diferenca >= 0 ? `+${formatCurrency(diferenca)}` : formatCurrency(diferenca)}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {staleBanner}
            {/* Bloco 1: Liquidação Financeira */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Posição de Liquidação (Recebido vs A Receber)
                </h4>
                <span className="text-[10px] text-muted-foreground">Fluxo Real</span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {liquidacao.map((item) => (
                  <div
                    key={item.id}
                    className={cn(
                      "rounded-lg border p-2 text-left flex flex-col justify-between",
                      item.tipo === "critico"
                        ? "border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20"
                        : "border-border/80 bg-card"
                    )}
                  >
                    <div className="text-[10px] font-medium text-muted-foreground truncate" title={item.status}>
                      {item.titulo}
                    </div>
                    {item.id === "vencido" && item.state === "loading" ? (
                      <>
                        <Skeleton className="h-4 w-16 mt-1" />
                        <span className="text-[9px] mt-0.5 text-muted-foreground">Carregando...</span>
                      </>
                    ) : item.id === "vencido" && (item.state === "error" || item.state === "unavailable") ? (
                      <>
                        <div className="font-display text-xs font-semibold mt-1 text-amber-700 dark:text-amber-400">
                          Indisponível
                        </div>
                        <div className="text-[9px] mt-0.5 text-muted-foreground flex items-center justify-between gap-1">
                          <span>{item.state === "error" ? "Falha na fonte" : "Sem fonte"}</span>
                          {item.state === "error" && onRetryInadimplencia && (
                            <button
                              type="button"
                              onClick={onRetryInadimplencia}
                              className="underline font-medium text-foreground hover:opacity-80"
                            >
                              Tentar
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div className={cn(
                          "font-display text-xs font-bold mt-1",
                          item.tipo === "critico" ? "text-rose-700 dark:text-rose-400" : "text-foreground"
                        )}>
                          {formatCurrency(item.valor ?? 0)}
                        </div>
                        <div className={cn(
                          "text-[9px] mt-0.5 font-medium",
                          item.tipo === "critico" ? "text-rose-600 dark:text-rose-400 font-bold" : "text-muted-foreground"
                        )}>
                          {(item.percentual ?? 0).toFixed(0)}% do total
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bloco 2: Gestão de Títulos e Faturamento */}
            <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status do Faturamento:</span>
                <span className="font-semibold text-foreground">Apurado na Competência</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Classificação de Modalidades:</span>
                <span className="font-medium text-foreground">Caixa Imediato / Duplicatas / Mensal</span>
              </div>
              <div className="border-t border-border/50 pt-2 flex justify-between items-center text-[11px] text-muted-foreground">
                <span>Governança Financeira:</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium">Contratos & Operações Validados</span>
              </div>
            </div>
          </div>

          {/* Rodapé com CTA */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigate(buildReceitasNavigationUrl())}
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
    const custos = data.custosTotais || 0;
    const anterior = data.custosAnterior ?? 0;
    const variacao = anterior > 0 ? ((custos - anterior) / anterior) * 100 : null;

    const composicao: DrawerBreakdownItem[] = [
      {
        categoria: "Folha CLT & Encargos",
        descricao: "Mão de obra direta CLT processada e aprovada",
        valor: data.folhaValor || 0,
        percentual: custos > 0 ? ((data.folhaValor || 0) / custos) * 100 : 0,
        destaque: true,
      },
      {
        categoria: "Diaristas Operacionais",
        descricao: "Lotes fechados de diaristas na competência",
        valor: data.diaristasValor || 0,
        percentual: custos > 0 ? ((data.diaristasValor || 0) / custos) * 100 : 0,
      },
      {
        categoria: "Intermitentes",
        descricao: "Convocações e horas de intermitentes aprovadas",
        valor: data.intermitentesValor || 0,
        percentual: custos > 0 ? ((data.intermitentesValor || 0) / custos) * 100 : 0,
      },
      {
        categoria: "Custos Extras Operacionais",
        descricao: "Despesas e insumos operacionais reconhecidos no DRE",
        valor: data.custosExtrasValor || 0,
        percentual: custos > 0 ? ((data.custosExtrasValor || 0) / custos) * 100 : 0,
      },
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
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Custos & Despesas — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Composição real dos custos operacionais apurados na competência.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Total de Custos & Despesas
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(custos)}
                </div>
                {variacao !== null ? (
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                    variacao <= 0
                      ? "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      : "border-amber-200/80 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400"
                  )}>
                    <TrendingUp className="h-3 w-3" />
                    {variacao <= 0 ? `${variacao.toFixed(1)}% (economia)` : `+${variacao.toFixed(1)}% vs anterior`}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Base inicial</span>
                )}
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {staleBanner}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. De onde vieram os custos?
                </h4>
                <span className="text-[10px] text-muted-foreground">4 categorias reais</span>
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
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted/60 dark:bg-slate-800/40 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          item.destaque ? "bg-blue-600 dark:bg-blue-500" : "bg-muted-foreground/35"
                        )}
                        style={{ width: `${Math.min(100, item.percentual)}%` }}
                      />
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
              onClick={() => onNavigate(buildFinanceiroNavigationUrl())}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir Central Financeira
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 3. RESULTADO OPERACIONAL
  if (type === "lucro") {
    const faturamento = data.faturamentoTotal || 0;
    const custos = data.custosTotais || 0;
    const resultado = data.resultadoOperacional || 0;
    const margem = faturamento > 0 ? (resultado / faturamento) * 100 : 0;

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Resultado Operacional — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Demonstração da ponte econômica entre Faturamento e Custos Operacionais.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Resultado Operacional Real
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(resultado)}
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                  resultado >= 0
                    ? "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                    : "border-rose-200/80 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                )}>
                  <Activity className="h-3 w-3" />
                  Margem: {margem.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {staleBanner}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Ponte de Cálculo
                </h4>
                <span className="text-[10px] text-muted-foreground">Demonstração</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-foreground">(+) Faturamento Total:</span>
                  <span className="font-mono font-bold text-foreground">{formatCurrency(faturamento)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>(-) Custos e Despesas:</span>
                  <span className="font-mono">{formatCurrency(custos)}</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between items-center">
                  <span className="font-bold text-blue-600 dark:text-blue-400">(=) Resultado Operacional:</span>
                  <span className="font-mono font-display text-sm font-bold text-foreground">
                    {formatCurrency(resultado)}
                  </span>
                </div>
              </div>
            </div>

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
                  <div className="font-display text-lg font-bold text-foreground mt-0.5">{margem.toFixed(1)}%</div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">da receita líquida</div>
                </div>
                <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Conversão Líquida</div>
                  <div className="font-display text-lg font-bold text-foreground mt-0.5">
                    R$ {(faturamento > 0 ? (resultado / faturamento) : 0).toFixed(2)} / R$ 1
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">retorno operacional</div>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigate(buildDreNavigationUrl())}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir DRE Gerencial
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 4. MARGEM OPERACIONAL
  if (type === "margem") {
    const faturamento = data.faturamentoTotal || 0;
    const resultado = data.resultadoOperacional || 0;
    const margem = data.margemOperacional || 0;
    const anterior = data.margemAnterior ?? 0;
    const variacaoPP = margem - anterior;

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Margem Operacional — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Relação percentual entre o Resultado Operacional e o Faturamento Total.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Margem Operacional Consolidada
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {margem.toFixed(1)}%
                </div>
                {anterior > 0 && (
                  <span className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold",
                    variacaoPP >= 0
                      ? "border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-200/80 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400"
                  )}>
                    <TrendingUp className="h-3 w-3" />
                    {variacaoPP >= 0 ? `+${variacaoPP.toFixed(1)} p.p.` : `${variacaoPP.toFixed(1)} p.p.`} vs anterior
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {staleBanner}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Relação de Cálculo
                </h4>
                <span className="text-[10px] text-muted-foreground">Fórmula Canônica</span>
              </div>

              <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-3 space-y-2 text-xs">
                <div className="text-center p-2 rounded bg-muted/30 font-mono text-[11px] text-foreground">
                  Margem = (Resultado Operacional ÷ Faturamento Total) × 100
                </div>
                <div className="flex justify-between items-center pt-1 text-muted-foreground">
                  <span>Resultado Operacional:</span>
                  <span className="font-mono text-foreground font-semibold">{formatCurrency(resultado)}</span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Faturamento Total:</span>
                  <span className="font-mono text-foreground font-semibold">{formatCurrency(faturamento)}</span>
                </div>
                <div className="border-t border-border pt-1.5 flex justify-between items-center font-bold text-foreground">
                  <span>Margem Efetiva:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-display text-sm">{margem.toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15">
            <Button
              type="button"
              onClick={() => onNavigate(buildDreNavigationUrl())}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir DRE Gerencial
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // 5. CAIXA & CONTAS
  if (type === "caixa") {
    const recebido = data.caixaRecebido || 0;
    const aReceber = data.aReceber || 0;
    const inadimplenciaView = resolveInadimplenciaView(
      aReceber,
      data.inadimplenteTotal,
      inadimplenciaStatus
    );

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 flex flex-col justify-between bg-card text-card-foreground border-l border-border dark:border-border/30 shadow-2xl dark:shadow-none z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="border-b border-border/70 dark:border-border/25 p-5 bg-muted/20 dark:bg-muted/15">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Drill-down de KPI · Camada 2
              </span>
            </div>

            <SheetTitle className="font-display text-lg font-bold text-foreground">
              Caixa & Contas — {competencia}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground mt-0.5">
              Posição real de recebimentos em conta e contas a receber no período.
            </SheetDescription>

            {/* Destaque Principal */}
            <div className="mt-4 rounded-xl border border-border/80 dark:border-border/25 bg-card dark:bg-card/70 p-3.5 shadow-xs dark:shadow-none">
              <div className="text-[11px] font-medium text-muted-foreground">
                Total Recebido no Período
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="font-display text-3xl font-bold tracking-tight text-foreground">
                  {formatCurrency(recebido)}
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200/80 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Liquidado
                </span>
              </div>
            </div>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {staleBanner}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Contas a Receber
                </h4>
                <span className="text-[10px] text-muted-foreground">Aging / Posição</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border/80 dark:border-border/25 bg-card dark:bg-card/60 p-2.5">
                  <div className="text-[10px] text-muted-foreground">
                    {inadimplenciaView.state === "ok" ? "A Receber no Prazo" : "A Receber (Total)"}
                  </div>
                  {inadimplenciaView.state === "loading" ? (
                    <Skeleton className="h-5 w-24 mt-1" />
                  ) : (
                    <div className="font-display text-sm font-bold text-foreground mt-0.5">
                      {formatCurrency(
                        inadimplenciaView.state === "ok"
                          ? inadimplenciaView.noPrazo
                          : inadimplenciaView.aReceberTotal
                      )}
                    </div>
                  )}
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    {inadimplenciaView.state === "ok"
                      ? "vencimento no ciclo"
                      : "saldo pendente na competência"}
                  </div>
                </div>

                <div className="rounded-lg border border-rose-200/80 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20 p-2.5">
                  <div className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">Vencido / Atrasado</div>
                  {inadimplenciaView.state === "loading" ? (
                    <>
                      <Skeleton className="h-5 w-24 mt-1" />
                      <div className="text-[9px] text-muted-foreground mt-0.5">Consultando vencimentos...</div>
                    </>
                  ) : inadimplenciaView.state === "error" || inadimplenciaView.state === "unavailable" ? (
                    <>
                      <div className="font-display text-sm font-semibold text-amber-700 dark:text-amber-400 mt-0.5">
                        Indisponível
                      </div>
                      <div className="text-[9px] text-muted-foreground mt-0.5 flex items-center justify-between gap-2">
                        <span>
                          {inadimplenciaView.state === "error"
                            ? "Falha ao consultar vencidos"
                            : "Detalhamento indisponível"}
                        </span>
                        {inadimplenciaView.state === "error" && onRetryInadimplencia && (
                          <button
                            type="button"
                            onClick={onRetryInadimplencia}
                            className="underline font-semibold text-rose-700 dark:text-rose-400"
                          >
                            Tentar novamente
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-display text-sm font-bold text-rose-700 dark:text-rose-400 mt-0.5">
                        {formatCurrency(inadimplenciaView.vencido)}
                      </div>
                      <div className="text-[9px] text-rose-600 dark:text-rose-400 font-semibold mt-0.5">faturas vencidas</div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="border-t border-border/70 dark:border-border/25 p-4 bg-muted/20 dark:bg-muted/15 flex flex-col gap-2">
            <Button
              type="button"
              onClick={() => onNavigate(buildReceitasNavigationUrl())}
              className="w-full bg-blue-600 text-white hover:bg-blue-700 font-medium text-xs flex items-center justify-center gap-2 h-9 shadow-xs"
            >
              Abrir Receitas & Cobranças
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return null;
};
