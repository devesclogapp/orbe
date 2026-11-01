import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Printer,
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  DollarSign,
  PieChart as PieIcon,
  TrendingUp,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DRELedgerItem } from "@/pages/UxLab/dreMockData";

interface UxLabDREDrawerProps {
  item: DRELedgerItem | null;
  open: boolean;
  onClose: () => void;
  competencia?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v);

const fmtPct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;

export const UxLabDREDrawer: React.FC<UxLabDREDrawerProps> = ({
  item,
  open,
  onClose,
  competencia = "Outubro / 2026",
}) => {
  const navigate = useNavigate();
  if (!item) return null;

  const isReceita = item.tipo === "receita";
  const isDeducao = item.tipo === "deducao";
  const isGood = isReceita ? item.deltaPercent >= 0 : item.deltaPercent <= 0;

  const getOriginModule = () => {
    switch (item.id) {
      case "receita-operacional":
        return {
          label: "Abrir módulo de origem",
          tooltip: "Navegar para Faturamento de Clientes (/financeiro/faturamento)",
          route: "/financeiro/faturamento",
        };
      case "folha-clt":
        return {
          label: "Abrir módulo de origem",
          tooltip: "Navegar para Fechamento Mensal CLT (/banco-horas/fechamento)",
          route: "/banco-horas/fechamento",
        };
      case "diaristas":
        return {
          label: "Abrir módulo de origem",
          tooltip: "Navegar para Gestão de Diaristas (/rh/diaristas)",
          route: "/rh/diaristas",
        };
      case "intermitentes":
        return {
          label: "Abrir módulo de origem",
          tooltip: "Navegar para Lotes de Intermitentes (/operacional/intermitentes/lotes)",
          route: "/operacional/intermitentes/lotes",
        };
      case "custos-extras":
        return {
          label: "Abrir módulo de origem",
          tooltip: "Navegar para Custos Extras Recebidos (/operacional/custos-extras)",
          route: "/operacional/custos-extras",
        };
      default:
        return null;
    }
  };

  const originModule = getOriginModule();

  const handlePrint = () => {
    document.body.classList.add("printing-dre-drawer");
    const cleanup = () => {
      document.body.classList.remove("printing-dre-drawer");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(() => {
      window.print();
      setTimeout(cleanup, 2000);
    }, 80);
  };

  const getDrawerDescription = () => {
    if (item.tipo === "receita") {
      return "Composição analítica das receitas operacionais reconhecidas na competência.";
    }
    if (item.id === "folha-clt") {
      return "Composição dos lotes financeiros de remuneração CLT reconhecidos na competência.";
    }
    if (item.id === "diaristas") {
      return "Composição dos lotes de fechamento de diaristas operacionais da competência.";
    }
    if (item.id === "intermitentes") {
      return "Composição dos lotes financeiros de trabalhadores intermitentes da competência.";
    }
    if (item.id === "custos-extras") {
      return "Composição dos custos extras e despesas operacionais da competência.";
    }
    return "Composição analítica dos lançamentos operacionais reconhecidos na competência.";
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="dre-drawer-sheet w-full sm:max-w-xl md:max-w-2xl lg:max-w-[700px] p-0 flex flex-col gap-0 border-l border-border bg-card dark:bg-[#111419] dark:border-white/[0.06] text-foreground overflow-hidden shadow-2xl transition-colors duration-200"
      >
        {/* ── 1. CABEÇALHO DO DRAWER ──────────────────────────────── */}
        <div className="border-b border-border/80 bg-muted/20 dark:bg-[#0D1014] dark:border-white/[0.04] px-5 py-4 shrink-0 space-y-2 pr-14">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-black font-mono shadow-xs",
                  isReceita && "bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200",
                  isDeducao &&
                    "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/40"
                )}
              >
                {item.sinal}
              </span>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    DRE Gerencial Operacional
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground dark:text-[#A0A7B2]">
                    {competencia}
                  </span>
                </div>
                <SheetTitle className="font-display text-lg font-bold tracking-tight text-foreground dark:text-[#F1F3F5] leading-tight truncate">
                  {item.label}
                </SheetTitle>
              </div>
            </div>
          </div>

          <SheetDescription className="text-xs text-muted-foreground dark:text-[#A0A7B2]">
            {getDrawerDescription()}
          </SheetDescription>
        </div>

        {/* ── 2. CARDS DE SÍNTESE DO ITEM ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 p-5 shrink-0 border-b border-border/40 dark:border-white/[0.04] bg-muted/10 dark:bg-white/[0.01]">
          <div className="rounded-xl border border-border/60 dark:border-white/[0.05] bg-card dark:bg-[#151921] p-3 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              Valor Total
            </div>
            <div className="font-display text-base sm:text-lg font-black text-foreground dark:text-[#F1F3F5]">
              {fmt(item.valor)}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 dark:border-white/[0.05] bg-card dark:bg-[#151921] p-3 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <PieIcon className="h-3 w-3 text-muted-foreground" />
              % da Receita
            </div>
            <div className="font-display text-base sm:text-lg font-black text-foreground dark:text-[#F1F3F5]">
              {fmtPct(item.percentualReceita)}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 dark:border-white/[0.05] bg-card dark:bg-[#151921] p-3 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              vs Mês Ant.
            </div>
            <div
              className={cn(
                "font-display text-base sm:text-lg font-black flex items-center gap-0.5",
                isGood
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              )}
            >
              {item.deltaPercent > 0 ? (
                <ArrowUpRight className="h-4 w-4 shrink-0" />
              ) : (
                <ArrowDownRight className="h-4 w-4 shrink-0" />
              )}
              {Math.abs(item.deltaPercent).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* ── 3. CORPO EXPANDIDO (TABELA COMPLETA COM SCROLL) ──────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar-dre print:overflow-visible">
          {/* Caixa de Descrição */}
          <div className="rounded-xl border border-border/50 dark:border-white/[0.05] bg-muted/20 dark:bg-white/[0.015] p-3.5 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground dark:text-[#A0A7B2] leading-relaxed">
              {item.descricao}
            </p>
          </div>

          {/* Tabela Analítica Completa */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground dark:text-[#F1F3F5] flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Composição Detalhada ({item.detalhes.length} linhas)
                </h4>
                {isReceita && (
                  <Badge variant="outline" className="text-[9px] font-mono text-muted-foreground/80 bg-muted/30 border-border/40">
                    Simulação UX Lab
                  </Badge>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {competencia}
              </Badge>
            </div>

            <div className="rounded-xl border border-border/60 dark:border-white/[0.06] overflow-hidden bg-card dark:bg-[#151921] shadow-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 dark:bg-white/[0.025] border-b border-border/40 dark:border-white/[0.05]">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Subconta / Composição
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Valor (R$)
                    </th>
                    <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      % do Grupo
                    </th>
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Observação / Contexto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 dark:divide-white/[0.03]">
                  {item.detalhes.map((d, i) => (
                    <tr
                      key={i}
                      className="hover:bg-muted/30 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-4 py-3 font-medium text-foreground dark:text-[#F1F3F5]">
                        {d.label}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground dark:text-[#F1F3F5]">
                        {fmt(d.valor)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground dark:text-[#A0A7B2]">
                        {fmtPct(d.percentualPai)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground dark:text-[#8D96A5] leading-relaxed">
                        {d.nota || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 dark:bg-white/[0.04] border-t-2 border-border/60 dark:border-white/[0.08]">
                    <td className="px-4 py-3 font-display font-bold text-xs uppercase text-foreground dark:text-[#F1F3F5]">
                      Total do Grupo
                    </td>
                    <td className="px-4 py-3 text-right font-display font-bold text-sm text-foreground dark:text-[#F1F3F5]">
                      {fmt(item.valor)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-xs text-muted-foreground dark:text-[#A0A7B2]">
                      100.0%
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                      {fmtPct(item.percentualReceita)} da Receita Operacional
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ── 4. RODAPÉ DO DRAWER ─────────────────────────────────── */}
        <div className="border-t border-border/80 bg-muted/20 dark:bg-[#0D1014] dark:border-white/[0.04] px-5 py-3 shrink-0 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Demonstrativo Gerencial ESC Logística · {competencia}</span>
          <div className="flex items-center gap-2 dre-drawer-actions">
            {originModule && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  navigate(originModule.route);
                }}
                className="gap-1.5 text-xs font-semibold h-8 border-border/80 dark:border-white/[0.08] hover:bg-muted text-foreground"
                title={originModule.tooltip}
              >
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="hidden sm:inline">{originModule.label}</span>
                <span className="sm:hidden">Origem</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs font-semibold h-8 border-border/80 dark:border-white/[0.08] hover:bg-muted text-foreground"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Imprimir</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
