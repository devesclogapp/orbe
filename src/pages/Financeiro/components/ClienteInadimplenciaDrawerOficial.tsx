import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  Clock,
  Layers,
  ChevronRight,
} from "lucide-react";
import {
  ClienteInadimplenteResumo,
  TituloInadimplenteUI,
  calcularDiasAtraso,
  getFaixaAging,
  getFaixaAgingBadgeClass,
  getStatusCobrancaBadgeClass,
  getStatusCobrancaLabel,
  getModalidadeLabel,
  formatCurrency,
  formatDate,
} from "@/services/inadimplenciaOficial.service";

interface ClienteInadimplenciaDrawerOficialProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteInadimplenteResumo | null;
  onSelectTitulo: (titulo: TituloInadimplenteUI) => void;
}

export function ClienteInadimplenciaDrawerOficial({
  isOpen,
  onClose,
  cliente,
  onSelectTitulo,
}: ClienteInadimplenciaDrawerOficialProps) {
  if (!cliente) return null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[760px] p-0 flex flex-col bg-background border-l border-border h-full overflow-hidden"
      >
        {/* Header Consolidado */}
        <div className="p-6 border-b border-border bg-card/50">
          <SheetHeader className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Badge
                variant="outline"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Posição Consolidada da Inadimplência
              </Badge>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-medium ${getFaixaAgingBadgeClass(cliente.faixaMaisCritica)}`}
              >
                Faixa mais crítica: {cliente.faixaMaisCriticaLabel}
              </Badge>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <SheetTitle className="text-xl font-bold text-foreground">
                  {cliente.clienteNome}
                </SheetTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tomador de serviço · ID: {cliente.empresaId}
                </p>
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card Resumo Financeiro do Cliente */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Total em Atraso
              </span>
              <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                {formatCurrency(cliente.totalInadimplente)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Títulos Vencidos
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {cliente.quantidadeTitulos}{" "}
                {cliente.quantidadeTitulos === 1 ? "título" : "títulos"}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Maior Atraso
              </span>
              <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                {cliente.maiorAtrasoDias} dias
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Título Mais Antigo
              </span>
              <p className="text-lg font-bold text-foreground mt-1">
                {formatDate(cliente.tituloMaisAntigoVencimento)}
              </p>
            </div>
          </div>

          {/* Distribuição por Aging do Cliente */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Distribuição por Aging do Cliente
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {cliente.qtd_1_30 > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs">
                  <span className="text-amber-700 dark:text-amber-300 font-semibold block">
                    1 a 30 dias
                  </span>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCurrency(cliente.dias_1_30)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {cliente.qtd_1_30} títulos
                  </span>
                </div>
              )}

              {cliente.qtd_31_60 > 0 && (
                <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs">
                  <span className="text-orange-700 dark:text-orange-300 font-semibold block">
                    31 a 60 dias
                  </span>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCurrency(cliente.dias_31_60)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {cliente.qtd_31_60} títulos
                  </span>
                </div>
              )}

              {cliente.qtd_61_90 > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs">
                  <span className="text-rose-700 dark:text-rose-300 font-semibold block">
                    61 a 90 dias
                  </span>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCurrency(cliente.dias_61_90)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {cliente.qtd_61_90} títulos
                  </span>
                </div>
              )}

              {cliente.qtd_mais_90 > 0 && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs">
                  <span className="text-red-700 dark:text-red-300 font-semibold block">
                    +90 dias
                  </span>
                  <p className="font-bold text-foreground mt-0.5">
                    {formatCurrency(cliente.dias_mais_90)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {cliente.qtd_mais_90} títulos
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Títulos Componentes em Atraso */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              Títulos em Aberto deste Cliente ({cliente.titulos.length})
            </h4>

            <div className="space-y-2">
              {cliente.titulos.map((t) => {
                const diasAtraso = calcularDiasAtraso(t.vencimento);
                const faixaAging = getFaixaAging(diasAtraso);

                return (
                  <div
                    key={t.id}
                    className="p-3.5 rounded-lg bg-card border border-border flex items-center justify-between gap-3 text-xs hover:bg-muted/10 cursor-pointer transition-colors"
                    onClick={() => onSelectTitulo(t)}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-primary">{t.id}</span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${getFaixaAgingBadgeClass(faixaAging)}`}
                        >
                          {diasAtraso} {diasAtraso === 1 ? "dia" : "dias"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 ${getStatusCobrancaBadgeClass(t.status)}`}
                        >
                          {getStatusCobrancaLabel(t.status)}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-[11px]">
                        Modalidade: {getModalidadeLabel(t.modalidade)} · Competência:{" "}
                        {t.competenciaFormatada} · Vencimento: {formatDate(t.vencimento)}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-bold text-red-600 dark:text-red-400 font-display">
                        {formatCurrency(t.valorTotal)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
