import React, { useState } from "react";
import {
  X,
  Clock,
  Users,
  Wrench,
  Building2,
  AlertTriangle,
  Receipt,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Package,
  Wallet,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  FileText,
  UserCheck,
  AlertCircle,
  Lock,
  Check,
  ShieldCheck
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  CicloFechamentoItemMock,
  DominioFechamento,
  EstadoVisualFechamento,
} from "@/pages/UxLab/fechamentoCiclosMockData";

interface UxLabFechamentoDrawerProps {
  ciclo: CicloFechamentoItemMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmarFechamento?: (cicloId: string) => void;
}

export function UxLabFechamentoDrawer({
  ciclo,
  open,
  onOpenChange,
  onConfirmarFechamento,
}: UxLabFechamentoDrawerProps) {
  const navigate = useNavigate();
  const [confirmando, setConfirmando] = useState<boolean>(false);

  if (!ciclo) return null;

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return isoStr;
    }
  };

  const formatCompetencia = (compStr?: string) => {
    if (!compStr) return "—";
    const match = compStr.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const [_, year, month] = match;
      const months = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
      ];
      const monthIdx = parseInt(month, 10) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        return `${months[monthIdx]} / ${year}`;
      }
    }
    return compStr;
  };

  const getDominioBadge = (dom: DominioFechamento) => {
    switch (dom) {
      case "OPERACIONAL":
        return { label: "Ciclo Operacional", icon: Package };
      case "DIARISTAS":
        return { label: "Diaristas", icon: Users };
      case "INTERMITENTES":
        return { label: "Intermitentes", icon: Calendar };
      case "CLT":
        return { label: "CLT / Folha Mensal", icon: Lock };
    }
  };

  const getEstadoBadge = (estado: EstadoVisualFechamento) => {
    switch (estado) {
      case "PRONTO_PARA_FECHAR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PRONTO PARA FECHAR
          </span>
        );
      case "BLOQUEADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50">
            <ShieldAlert className="w-3.5 h-3.5" />
            BLOQUEADO
          </span>
        );
      case "AGUARDANDO_APROVACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50">
            <Clock className="w-3.5 h-3.5" />
            AGUARDANDO APROVAÇÃO
          </span>
        );
      case "FECHADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
            <Check className="w-3.5 h-3.5" />
            FECHADO
          </span>
        );
    }
  };

  const dominioInfo = getDominioBadge(ciclo.dominio);
  const DominioIcon = dominioInfo.icon;

  const handleExecutarFechamentoConfirmado = () => {
    if (onConfirmarFechamento) {
      onConfirmarFechamento(ciclo.id);
    }
    toast.success(`Fechamento do ciclo [${ciclo.titulo}] confirmado com sucesso!`, {
      description: `Lote consolidado e encaminhado para o fluxo financeiro.`,
    });
    setConfirmando(false);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setConfirmando(false);
        onOpenChange(v);
      }}
    >
      <SheetContent className="sm:max-w-[560px] w-full p-0 flex flex-col bg-background border-l border-border shadow-xl">
        {/* Header Institucional Monocromático com Estado Semântico */}
        <div className="p-6 border-b border-border bg-card/50">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                <DominioIcon className="w-3.5 h-3.5" />
                {dominioInfo.label}
              </span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs font-medium text-foreground">{ciclo.periodo}</span>
            </div>
            {getEstadoBadge(ciclo.estadoVisual)}
          </div>

          <SheetTitle className="text-lg font-semibold tracking-tight text-foreground">
            {ciclo.titulo}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            {ciclo.subtitulo}
          </SheetDescription>
        </div>

        {/* Corpo Scrollável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card: O Que Será Consolidado? */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-foreground" />
                O que será consolidado?
              </span>
              <span className="text-xs font-mono font-semibold text-[#2563EB]">
                {formatCurrency(ciclo.valorTotal)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-2.5 rounded-md bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground block">Grandeza Principal</span>
                <span className="text-sm font-semibold text-foreground mt-0.5 block">
                  {ciclo.grandezaResumo}
                </span>
              </div>
              <div className="p-2.5 rounded-md bg-muted/40 border border-border/60">
                <span className="text-[11px] text-muted-foreground block">Competência</span>
                <span className="text-sm font-semibold text-foreground mt-0.5 block">
                  {formatCompetencia(ciclo.competencia)}
                </span>
              </div>
            </div>

            {/* Sub-detalhes de consolidação se houver */}
            {ciclo.consolidacao?.detalhes && ciclo.consolidacao.detalhes.length > 0 && (
              <div className="pt-2 border-t border-border/60 space-y-1.5">
                <span className="text-[11px] font-medium text-muted-foreground block">
                  Composição do Lote:
                </span>
                {ciclo.consolidacao.detalhes.map((det, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-background/50 border border-border/40"
                  >
                    <span className="text-muted-foreground">{det.rotulo}</span>
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(det.valor)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Card: Checklist de Prontidão */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
              Checklist de Prontidão
            </span>

            <div className="space-y-2 pt-1">
              {ciclo.checklist.map((chk) => {
                const isSucesso = chk.tipo === "sucesso";
                const isBloqueio = chk.tipo === "bloqueio";
                return (
                  <div
                    key={chk.id}
                    className={`p-2.5 rounded-md border text-xs flex items-start gap-2.5 transition-colors ${
                      isSucesso
                        ? "bg-muted/30 border-border text-foreground"
                        : isBloqueio
                        ? "bg-rose-500/5 border-rose-500/20 text-foreground"
                        : "bg-amber-500/5 border-amber-500/20 text-foreground"
                    }`}
                  >
                    {isSucesso && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {isBloqueio && (
                      <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    )}
                    {!isSucesso && !isBloqueio && (
                      <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block text-foreground">{chk.titulo}</span>
                      {chk.descricao && (
                        <span className="text-[11px] text-muted-foreground block mt-0.5">
                          {chk.descricao}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card: Efeito do Fechamento */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-foreground" />
              Efeito do Fechamento
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {ciclo.efeitoFechamento}
            </p>
          </div>

          {/* Card: Rastreabilidade & Auditoria */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-foreground" />
              Rastreabilidade & Governança
            </span>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-[11px] text-muted-foreground block">Empresa</span>
                <span className="font-medium text-foreground block truncate">
                  {ciclo.rastreabilidade.empresa}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Responsável</span>
                <span className="font-medium text-foreground block truncate">
                  {ciclo.rastreabilidade.responsavel}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Data da Revisão</span>
                <span className="font-medium text-foreground block">
                  {formatDate(ciclo.rastreabilidade.dataHoraRevisao)}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Status Motor</span>
                <span className="font-mono text-xs text-muted-foreground block">
                  {ciclo.statusMotorOriginal}
                </span>
              </div>
            </div>

            {ciclo.rastreabilidade.fechadoEm && (
              <div className="pt-2 border-t border-border/60 text-xs">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium block">
                  Fechamento Consolidado em:
                </span>
                <span className="text-foreground">
                  {formatDate(ciclo.rastreabilidade.fechadoEm)} por{" "}
                  {ciclo.rastreabilidade.fechadoPor}
                </span>
              </div>
            )}
          </div>

          {/* Box de Confirmação Ativa se o usuário clicou em Confirmar Fechamento */}
          {confirmando && (
            <div className="rounded-lg border-2 border-[#2563EB] bg-[#2563EB]/5 p-4 space-y-3 animate-in fade-in-50">
              <div className="flex items-start gap-2.5">
                <HelpCircle className="w-5 h-5 text-[#2563EB] shrink-0 mt-0.5" />
                <div>
                  <span className="text-sm font-semibold text-foreground block">
                    Confirmar fechamento do lote de {dominioInfo.label}?
                  </span>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    Após a confirmação, o ciclo transitará para o estado consolidado. Alterações
                    posteriores deverão seguir o fluxo formal de ajuste ou reabertura do domínio.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmando(false)}
                  className="h-8 text-xs"
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  onClick={handleExecutarFechamentoConfirmado}
                  className="h-8 text-xs bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium"
                >
                  Sim, Confirmar Fechamento
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-border bg-card/50 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>

          {ciclo.estadoVisual === "PRONTO_PARA_FECHAR" && !confirmando && (
            <Button
              size="sm"
              onClick={() => setConfirmando(true)}
              className="text-xs bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Confirmar Fechamento
            </Button>
          )}

          {ciclo.estadoVisual === "BLOQUEADO" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                onOpenChange(false);
                navigate("/ux-lab/inconsistencias");
              }}
              className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ver na Central de Inconsistências
            </Button>
          )}

          {ciclo.estadoVisual === "AGUARDANDO_APROVACAO" && (
            <Button
              size="sm"
              variant="default"
              onClick={() => {
                onOpenChange(false);
                navigate("/ux-lab/aprovacoes");
              }}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Abrir Central de Aprovações
            </Button>
          )}

          {ciclo.estadoVisual === "FECHADO" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" />
              Lote Consolidado (Modo Leitura)
            </span>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
