import React from "react";
import {
  Clock,
  Users,
  Wrench,
  Building2,
  AlertTriangle,
  Calendar,
  Layers,
  ArrowRight,
  ShieldAlert,
  Package,
  Wallet,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  FileText,
  UserCheck,
  AlertCircle,
  Info
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  ItemInconsistenciaNormalizado,
  DominioInconsistencia,
} from "@/services/inconsistenciasTransversais.service";

interface InconsistenciaDrawerProps {
  item: ItemInconsistenciaNormalizado | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InconsistenciaDrawer({
  item,
  open,
  onOpenChange,
}: InconsistenciaDrawerProps) {
  const navigate = useNavigate();

  if (!item) return null;

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

  const getDominioBadge = (dom: DominioInconsistencia) => {
    switch (dom) {
      case "OPERACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            Operação por Volume
          </span>
        );
      case "SERVICO_EXTRA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
            <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
            Serviço Extra
          </span>
        );
      case "CUSTO_EXTRA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            Custo Extra
          </span>
        );
      case "DIARISTA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            Diaristas
          </span>
        );
      case "INTERMITENTE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            Intermitentes
          </span>
        );
      case "PONTO_CLT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            Ponto CLT
          </span>
        );
      default:
        return null;
    }
  };

  const handleAbrirModulo = () => {
    if (item.rotaDestino) {
      navigate(item.rotaDestino);
      onOpenChange(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col h-full bg-card border-l border-border shadow-2xl z-50 overflow-hidden"
      >
        {/* 1. CABEÇALHO DO DRAWER */}
        <div className="p-6 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {getDominioBadge(item.dominio)}
              <span className="font-mono text-xs font-bold text-muted-foreground px-2 py-0.5 rounded bg-muted">
                {item.codigo}
              </span>
            </div>

            {item.bloqueante ? (
              <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-900/40 gap-1.5 py-1 px-2.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                Bloqueante
              </Badge>
            ) : (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-900/40 gap-1.5 py-1 px-2.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Requer Correção
              </Badge>
            )}
          </div>

          <SheetTitle className="text-xl font-bold text-foreground leading-tight tracking-tight">
            {item.tituloHumano}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground mt-1">
            Diagnóstico operacional e direcionamento para saneamento no módulo de origem.
          </SheetDescription>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              {item.empresaNome}
            </span>
            {item.unidadeNome && (
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {item.unidadeNome}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Detectado em {formatDate(item.detectadoEm)}
            </span>
          </div>
        </div>

        {/* 2. CORPO ROLÁVEL COM OS 5 PASSOS DIAGNÓSTICOS FACTUAIS */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* PASSO 1: O QUE ACONTECEU */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <Info className="w-4 h-4 text-[#2563EB]" />
              O que aconteceu?
            </div>
            <div className="p-4 rounded-lg bg-muted/40 border border-border text-sm text-foreground leading-relaxed">
              {item.detalhesDrawer.oqueAconteceu}
            </div>
          </div>

          {/* PASSO 2: POR QUE O FLUXO PAROU (IMPACTO) */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              <ShieldAlert className="w-4 h-4" />
              Por que o fluxo parou? (Impacto)
            </div>
            <div className="p-4 rounded-lg bg-rose-500/5 border border-rose-500/20 text-sm text-foreground leading-relaxed">
              {item.detalhesDrawer.porqueFluxoParou}
            </div>
          </div>

          {/* PASSO 3: O QUE PRECISA SER FEITO */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563EB] uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              O que precisa ser feito?
            </div>
            <div className="p-4 rounded-lg bg-[#2563EB]/5 border border-[#2563EB]/20 text-sm font-medium text-foreground leading-relaxed">
              {item.detalhesDrawer.oquePrecisaSerFeito}
            </div>
          </div>

          {/* PASSO 4: RESPONSÁVEL E ONDE CORRIGIR */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-muted-foreground" />
                Responsável pela Ação
              </div>
              <div className="text-base font-bold text-foreground">
                {item.responsavelLabel}
              </div>
              <div className="text-xs text-muted-foreground">
                Perfil encarregado de efetuar a correção
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-1">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                Onde Corrigir?
              </div>
              <div className="text-base font-bold text-foreground">
                {item.detalhesDrawer.ondeCorrigir}
              </div>
              <div className="text-xs text-muted-foreground">
                Módulo especialista correspondente
              </div>
            </div>
          </div>

          {/* PASSO 5: DEPOIS DA CORREÇÃO */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              <CheckCircle2 className="w-4 h-4" />
              Depois da Correção
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-sm text-foreground leading-relaxed">
              {item.detalhesDrawer.depoisDaCorrecao}
            </div>
          </div>

          {/* RASTREABILIDADE */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Rastreabilidade & Auditoria
            </div>
            <div className="p-4 rounded-lg bg-muted/20 border border-border text-xs space-y-2 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Origem do Dado:</span>
                <span className="text-foreground font-medium">{item.detalhesDrawer.rastreabilidade.origem}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Detectado Por:</span>
                <span className="text-foreground font-medium">{item.detalhesDrawer.rastreabilidade.detectadoPor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data/Hora Detecção:</span>
                <span className="text-foreground font-medium">{formatDate(item.detalhesDrawer.rastreabilidade.detectadoEm)}</span>
              </div>
              {item.detalhesDrawer.rastreabilidade.motivoDevolucao && (
                <div className="pt-2 border-t border-border">
                  <span className="text-rose-600 dark:text-rose-400 font-semibold block mb-1">
                    Motivo Registrado na Devolução:
                  </span>
                  <p className="text-foreground italic bg-rose-500/5 p-2 rounded border border-rose-500/20 font-sans">
                    "{item.detalhesDrawer.rastreabilidade.motivoDevolucao}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. RODAPÉ COM CTA DE DESPACHO CONTEXTUAL */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            className="text-xs"
            onClick={() => onOpenChange(false)}
          >
            Fechar Painel
          </Button>

          <Button
            className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium text-xs gap-2 shadow-sm"
            onClick={handleAbrirModulo}
          >
            <span>{item.ctaLabel}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
