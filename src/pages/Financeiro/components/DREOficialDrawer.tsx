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
import {
  DRELedgerItem,
  getDREDrawerData,
  formatBRL,
  formatPercent,
} from "@/services/adapters/dreOficialAdapter";
import { OperationalIntegrityKPIs } from "@/services/dashboard.service";

interface DREOficialDrawerProps {
  item: DRELedgerItem | null;
  open: boolean;
  onClose: () => void;
  competenciaLabel?: string;
  kpisAtual?: OperationalIntegrityKPIs | null;
}

export const DREOficialDrawer: React.FC<DREOficialDrawerProps> = ({
  item,
  open,
  onClose,
  competenciaLabel = "Competência Atual",
  kpisAtual,
}) => {
  const navigate = useNavigate();

  if (!item) return null;

  const drawerData = getDREDrawerData(item, kpisAtual);
  const isReceita = drawerData.tipo === "receita";
  const isDeducao = drawerData.tipo === "deducao";
  const isGood = isReceita ? drawerData.deltaPercent >= 0 : drawerData.deltaPercent <= 0;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-[700px] p-0 flex flex-col gap-0 border-l border-border bg-card text-foreground overflow-hidden shadow-2xl transition-colors duration-200"
      >
        {/* ── 1. CABEÇALHO DO DRAWER ──────────────────────────────── */}
        <div className="border-b border-border/80 bg-muted/20 px-5 py-4 shrink-0 space-y-2 pr-14">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={cn(
                  "flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-sm font-black font-mono shadow-xs",
                  isReceita && "bg-slate-100 dark:bg-white/[0.08] text-slate-700 dark:text-slate-200",
                  isDeducao &&
                    "bg-muted/80 dark:bg-white/[0.06] text-muted-foreground border border-border/60"
                )}
              >
                {drawerData.sinal}
              </span>
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    DRE Gerencial Operacional
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                    {competenciaLabel}
                  </span>
                </div>
                <SheetTitle className="font-display text-lg font-bold tracking-tight text-foreground leading-tight truncate">
                  {drawerData.label}
                </SheetTitle>
              </div>
            </div>
          </div>

          <SheetDescription className="text-xs text-muted-foreground leading-relaxed">
            {drawerData.descricao}
          </SheetDescription>
        </div>

        {/* ── 2. CARDS DE SÍNTESE DO ITEM ─────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 p-5 shrink-0 border-b border-border/40 bg-muted/10">
          <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              Valor Total
            </div>
            <div className="font-display text-base sm:text-lg font-black text-foreground">
              {formatBRL(drawerData.valor)}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <PieIcon className="h-3 w-3 text-muted-foreground" />
              % da Receita
            </div>
            <div className="font-display text-base sm:text-lg font-black text-foreground">
              {formatPercent(drawerData.percentualReceita)}
            </div>
          </div>

          <div className="rounded-xl border border-border/60 bg-card p-3 space-y-1 shadow-xs">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              vs Mês Ant.
            </div>
            <div
              className={cn(
                "font-display text-base sm:text-lg font-black flex items-center gap-0.5",
                isGood ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {drawerData.deltaPercent > 0 ? (
                <ArrowUpRight className="h-4 w-4 shrink-0" />
              ) : (
                <ArrowDownRight className="h-4 w-4 shrink-0" />
              )}
              {Math.abs(drawerData.deltaPercent).toFixed(1)}%
            </div>
          </div>
        </div>

        {/* ── 3. CORPO EXPANDIDO COM SCROLL ────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Caixa de Critério de Reconhecimento Contábil */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 flex items-start gap-2.5">
            <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <span className="font-semibold text-foreground">Critério de Reconhecimento Econômico:</span>
              <p className="text-muted-foreground leading-relaxed">
                {drawerData.criterioReconhecimento}
              </p>
            </div>
          </div>

          {/* Tabela Analítica de Subcontas */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                Composição Factual ({drawerData.subcontas.length} {drawerData.subcontas.length === 1 ? "registro" : "registros"})
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono">
                {competenciaLabel}
              </Badge>
            </div>

            <div className="rounded-xl border border-border/60 overflow-hidden bg-card shadow-xs">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border/40">
                    <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Subconta / Componente
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
                <tbody className="divide-y divide-border/30">
                  {drawerData.subcontas.map((d, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {d.label}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                        {formatBRL(d.valor)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {formatPercent(d.percentualPai)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground leading-relaxed">
                        {d.observacao}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 border-t-2 border-border/60">
                    <td className="px-4 py-3 font-display font-bold text-xs uppercase text-foreground">
                      Total do Grupo
                    </td>
                    <td className="px-4 py-3 text-right font-display font-bold text-sm text-foreground">
                      {formatBRL(drawerData.valor)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-xs text-muted-foreground">
                      100.0%
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold text-muted-foreground">
                      {formatPercent(drawerData.percentualReceita)} da Receita Operacional
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* ── 4. RODAPÉ DO DRAWER ─────────────────────────────────── */}
        <div className="border-t border-border/80 bg-muted/20 px-5 py-3 shrink-0 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Demonstrativo Oficial ESC Logística · {competenciaLabel}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                navigate(drawerData.origemModulo.route);
              }}
              className="gap-1.5 text-xs font-semibold h-8 border-border/80 hover:bg-muted text-foreground"
              title={drawerData.origemModulo.tooltip}
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="hidden sm:inline">{drawerData.origemModulo.label}</span>
              <span className="sm:hidden">Origem</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="gap-1.5 text-xs font-semibold h-8 border-border/80 hover:bg-muted text-foreground"
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
