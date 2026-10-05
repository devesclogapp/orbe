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
  DollarSign,
  AlertTriangle,
  ArrowRight,
  Clock,
  Layers,
  FileText,
} from "lucide-react";
import {
  ClienteInadimplenteResumo,
  TituloInadimplenteMock,
  calcularDiasAtraso,
  getFaixaAging,
  getFaixaAgingBadgeClass,
  getFaixaAgingLabel,
  getStatusCobrancaBadgeClass,
  getStatusCobrancaLabel,
  getModalidadeLabel,
  DATA_REFERENCIA_UX14,
} from "@/pages/UxLab/inadimplenciaMockData";

interface UxLabClienteInadimplenciaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cliente: ClienteInadimplenteResumo | null;
  onSelectTitulo: (titulo: TituloInadimplenteMock) => void;
  dataReferencia?: string;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
};

export function UxLabClienteInadimplenciaDrawer({
  isOpen,
  onClose,
  cliente,
  onSelectTitulo,
  dataReferencia = DATA_REFERENCIA_UX14,
}: UxLabClienteInadimplenciaDrawerProps) {
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
              <Badge variant="outline" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                  Tomador de serviço
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
                {cliente.quantidadeTitulos} {cliente.quantidadeTitulos === 1 ? "título" : "títulos"}
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
                  <span className="text-amber-700 dark:text-amber-300 font-semibold block">1 a 30 dias</span>
                  <p className="font-bold text-foreground mt-0.5">{formatCurrency(cliente.dias_1_30)}</p>
                  <span className="text-[10px] text-muted-foreground">{cliente.qtd_1_30} títulos</span>
                </div>
              )}

              {cliente.qtd_31_60 > 0 && (
                <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs">
                  <span className="text-orange-700 dark:text-orange-300 font-semibold block">31 a 60 dias</span>
                  <p className="font-bold text-foreground mt-0.5">{formatCurrency(cliente.dias_31_60)}</p>
                  <span className="text-[10px] text-muted-foreground">{cliente.qtd_31_60} títulos</span>
                </div>
              )}

              {cliente.qtd_61_90 > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs">
                  <span className="text-rose-700 dark:text-rose-300 font-semibold block">61 a 90 dias</span>
                  <p className="font-bold text-foreground mt-0.5">{formatCurrency(cliente.dias_61_90)}</p>
                  <span className="text-[10px] text-muted-foreground">{cliente.qtd_61_90} títulos</span>
                </div>
              )}

              {cliente.qtd_mais_90 > 0 && (
                <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-xs">
                  <span className="text-red-800 dark:text-red-300 font-bold block">+90 dias (Crítico)</span>
                  <p className="font-bold text-red-600 dark:text-red-400 mt-0.5">{formatCurrency(cliente.dias_mais_90)}</p>
                  <span className="text-[10px] text-muted-foreground">{cliente.qtd_mais_90} títulos</span>
                </div>
              )}
            </div>
          </div>

          {/* Lista Compacta de Títulos em Atraso */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Títulos Vencidos ({cliente.titulos.length})
              </h4>
              <span className="text-xs text-muted-foreground">
                Ordenado por maior atraso
              </span>
            </div>

            <div className="space-y-2">
              {cliente.titulos.map((t) => {
                const dias = calcularDiasAtraso(t.vencimento, dataReferencia);
                const faixa = getFaixaAging(dias);

                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl bg-card border border-border hover:border-primary/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-primary">{t.id}</span>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getFaixaAgingBadgeClass(faixa)}`}>
                          {dias} {dias === 1 ? "dia" : "dias"}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] px-2 py-0 ${getStatusCobrancaBadgeClass(t.status)}`}>
                          {getStatusCobrancaLabel(t.status)}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>Comp: <strong className="text-foreground font-medium">{t.competenciaFormatada}</strong></span>
                        <span>·</span>
                        <span>Venc: <strong className="text-foreground font-medium">{formatDate(t.vencimento)}</strong></span>
                        <span>·</span>
                        <span>Modalidade: <strong className="text-foreground font-medium">{getModalidadeLabel(t.modalidade)}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
                      <span className="text-sm font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(t.valorTotal)}
                      </span>

                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => onSelectTitulo(t)}
                      >
                        Ver Título
                        <ArrowRight className="w-3.5 h-3.5" />
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
