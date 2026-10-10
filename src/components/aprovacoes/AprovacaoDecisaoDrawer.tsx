import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  X,
  Clock,
  Users,
  Wrench,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Info,
  Calendar,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Package,
  RotateCcw,
  Wallet,
  ExternalLink,
  Ban,
  Check,
  Loader2,
  DollarSign,
  RefreshCw,
  FileEdit,
  ArrowRight,
  UserX
} from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import {
  getOrigemRecursoBadge,
  getOrigemRecursoApprovalNotice,
  getOrigemRecursoStatusNotice,
  type OrigemRecursoBanco
} from "@/types/custosExtrasForm";
import { cn, decimalParaHora } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type TipoItem = "PONTO" | "DIARISTA" | "INTERMITENTE" | "CUSTO EXTRA" | "SERVIÇO EXTRA" | "OPERAÇÃO";
export type SituacaoItem = "Em análise" | "Aprovado" | "Devolvido" | "Pendente";

export interface ApprovalItem {
  id: string;
  tipo: TipoItem;
  referencia: string;
  colaborador: string;
  descricao: string;
  empresa: string;
  operacao: string;
  valor: number;
  horas?: string;
  competencia: string;
  data_recebimento: string;
  situacao: SituacaoItem;
  raw_status?: string;
  raw_lote_id?: string;
  origem_recurso?: OrigemRecursoBanco;
}

interface AprovacaoDecisaoDrawerProps {
  item: ApprovalItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAprovar: (item: ApprovalItem) => void;
  onDevolver: (item: ApprovalItem, motivo: string) => void;
  isAprovando: boolean;
  isDevolvendo: boolean;
  onOpenServicoExtraContinuity?: (item: ApprovalItem) => void;
}

const fmt = (v?: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

const fmtDate = (d?: string) => {
  if (!d) return "—";
  try {
    return format(new Date(d.includes("T") ? d : d + "T12:00:00"), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
};

export const SITUACAO_BADGES: Record<SituacaoItem, { label: string; className: string; icon: any }> = {
  "Em análise": {
    label: "Aguardando Decisão",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border-blue-200 dark:border-blue-900/40",
    icon: Clock,
  },
  "Aprovado": {
    label: "Aprovado",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/40",
    icon: CheckCircle2,
  },
  "Devolvido": {
    label: "Devolvido",
    className: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-900/40",
    icon: RotateCcw,
  },
  "Pendente": {
    label: "Pendente",
    className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700",
    icon: Clock,
  },
};

export function getDominioRoute(tipo: TipoItem): string {
  switch (tipo) {
    case "OPERAÇÃO":
      return "/operacoes-volume";
    case "SERVIÇO EXTRA":
      return "/operacional/servicos-extras";
    case "CUSTO EXTRA":
      return "/operacional/custos-extras";
    case "DIARISTA":
      return "/producao/diaristas";
    case "INTERMITENTE":
      return "/intermitentes/lotes";
    case "PONTO":
      return "/clt/pontos";
    default:
      return "/central";
  }
}

export function renderDominioBadge(tipo: TipoItem) {
  switch (tipo) {
    case "OPERAÇÃO":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          <Package className="w-3 h-3 text-muted-foreground" />
          Operação
        </span>
      );
    case "SERVIÇO EXTRA":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          <Wrench className="w-3 h-3 text-muted-foreground" />
          Serviço Extra
        </span>
      );
    case "CUSTO EXTRA":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          <Wallet className="w-3 h-3 text-muted-foreground" />
          Custo Extra
        </span>
      );
    case "DIARISTA":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          <Users className="w-3 h-3 text-muted-foreground" />
          Lote Diaristas
        </span>
      );
    case "INTERMITENTE":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          <Users className="w-3 h-3 text-muted-foreground" />
          Lote Intermitentes
        </span>
      );
    case "PONTO":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          <Clock className="w-3 h-3 text-muted-foreground" />
          Ponto CLT
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
          {tipo}
        </span>
      );
  }
}

export function AprovacaoDecisaoDrawer({
  item,
  open,
  onOpenChange,
  onAprovar,
  onDevolver,
  isAprovando,
  isDevolvendo,
}: AprovacaoDecisaoDrawerProps) {
  const navigate = useNavigate();
  const [modalDevolucaoOpen, setModalDevolucaoOpen] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");

  // Sub-queries sob demanda
  const {
    data: valData,
    refetch: refetchCompletude,
    isFetching: isFetchingCompletude,
  } = useQuery({
    queryKey: ["completude-lote", item?.id],
    queryFn: async () => {
      if (item?.tipo === "INTERMITENTE" && item?.situacao === "Em análise") {
        return await IntermitentesLoteService.verificarCompletudeLote(item.id);
      }
      return { podeAprovar: true, pendencias: [] };
    },
    enabled: !!item && item.tipo === "INTERMITENTE",
  });

  const { data: opData, isLoading: opLoading } = useQuery({
    queryKey: ["operacao-detalhes", item?.id],
    queryFn: async () => {
      if (item?.tipo === "OPERAÇÃO") {
        return await OperacaoProducaoService.getByIdWithDetails(item.id);
      }
      return null;
    },
    enabled: !!item && item.tipo === "OPERAÇÃO",
  });

  const { data: diaristaData, isLoading: diaristaLoading } = useQuery({
    queryKey: ["diarista-detalhes", item?.raw_lote_id],
    queryFn: async () => {
      if (item?.tipo === "DIARISTA" && item?.raw_lote_id) {
        return await LoteFechamentoDiaristaService.getLoteDetalhe(item.raw_lote_id);
      }
      return null;
    },
    enabled: !!item && item.tipo === "DIARISTA" && !!item.raw_lote_id,
  });

  const { data: intermitenteData, isLoading: intermitenteLoading } = useQuery({
    queryKey: ["intermitente-detalhes-aprovacao", item?.id],
    queryFn: async () => {
      if (item?.tipo === "INTERMITENTE") {
        return await IntermitentesLoteService.getLoteDetalhe(item.id);
      }
      return null;
    },
    enabled: !!item && item.tipo === "INTERMITENTE",
  });

  const { data: custoExtraData, isLoading: custoExtraLoading } = useQuery({
    queryKey: ["custo-extra-detalhes-aprovacao", item?.id],
    queryFn: async () => {
      if (item?.tipo !== "CUSTO EXTRA") return null;
      const { data, error } = await supabase
        .from("custos_extras_operacionais" as any)
        .select("id, origem_recurso, atualizado_em, pipeline_status, status_pagamento, favorecido_colaborador_id, favorecido_fornecedor_id, colaboradores:favorecido_colaborador_id(nome), fornecedores:favorecido_fornecedor_id(nome)")
        .eq("id", item.id)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!item && item.tipo === "CUSTO EXTRA",
  });

  if (!item) return null;

  const isOperacaoRestrita = item.tipo === "OPERAÇÃO" && (opData?.status === "EM_RESTRICAO" || !opData?.entrada_ponto || !opData?.saida_ponto);
  const isIntermitenteIncompleto = item.tipo === "INTERMITENTE" && valData?.podeAprovar === false;
  const isFailClosedBloqueado = isOperacaoRestrita || isIntermitenteIncompleto;

  const situacaoBadge = SITUACAO_BADGES[item.situacao] || SITUACAO_BADGES["Em análise"];
  const SituacaoIcon = situacaoBadge.icon;

  const origemRecurso = ((custoExtraData as any)?.origem_recurso || item.origem_recurso) as OrigemRecursoBanco | undefined;
  const origemBadge = getOrigemRecursoBadge(origemRecurso);
  const detailNotice = getOrigemRecursoStatusNotice(origemRecurso, item.situacao === "Aprovado");

  const handleConfirmarDevolucao = () => {
    if (!motivoDevolucao.trim()) return;
    onDevolver(item, motivoDevolucao);
    setModalDevolucaoOpen(false);
    setMotivoDevolucao("");
    onOpenChange(false);
  };

  const handleAprovarClick = () => {
    if (isFailClosedBloqueado) return;
    onAprovar(item);
  };

  const handleAbrirModuloEspecialista = () => {
    const route = getDominioRoute(item.tipo);
    onOpenChange(false);
    navigate(route);
  };

  const handleResolverPendenciaColaborador = (colaboradorId?: string, colaboradorNome?: string) => {
    if (!colaboradorId) {
      handleAbrirModuloEspecialista();
      return;
    }
    onOpenChange(false);
    navigate("/colaboradores", {
      state: {
        openEditId: colaboradorId,
        returnTo: "/rh/aprovacoes",
        loteId: item.id,
        loteRef: item.referencia,
        colaboradorNome,
      },
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-card border-l border-border text-foreground transition-colors duration-200">
          {/* Header do Drawer */}
          <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border p-5 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {renderDominioBadge(item.tipo)}
                <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                  {item.referencia}
                </span>
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border", situacaoBadge.className)}>
                  <SituacaoIcon className="w-3.5 h-3.5" />
                  {situacaoBadge.label}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <h2 className="text-lg font-display font-bold text-foreground tracking-tight leading-tight">
                {item.colaborador}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {item.empresa}
                </span>
                {item.operacao && (
                  <>
                    <span>•</span>
                    <span>{item.operacao}</span>
                  </>
                )}
                <span>•</span>
                <span>Recebido: {fmtDate(item.data_rece_recebimento || item.data_recebimento)}</span>
              </div>
            </div>
          </div>

          {/* Conteúdo Rolável */}
          <div className="flex-1 p-5 space-y-6">
            {/* Bloco de Alerta Estruturado (Fail-Closed) com Diagnóstico Acionável */}
            {isFailClosedBloqueado && (
              <div className="rounded-xl border border-rose-300 dark:border-rose-900 bg-rose-50/90 dark:bg-rose-950/40 p-4 space-y-4 shadow-sm">
                {/* Header Fail-Closed */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-rose-200 dark:border-rose-900/60">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                        Decisão Bloqueada por Pendência Cadastral/Operacional (Fail-Closed)
                      </h4>
                      <p className="text-xs text-rose-700/90 dark:text-rose-300/80 mt-0.5">
                        Aprovação RH impedida preventivamente. O lote não avançará para o Financeiro até que todas as inconsistências sejam regularizadas.
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-rose-400 text-rose-800 dark:border-rose-700 dark:text-rose-300 text-[10px] font-bold shrink-0 bg-rose-100/60 dark:bg-rose-900/40">
                    Bloqueio Ativo
                  </Badge>
                </div>

                {/* Estrutura: PROBLEMA -> DIAGNÓSTICO -> IMPACTO -> PRÓXIMA AÇÃO -> DESTINO CORRETO */}
                {item.tipo === "INTERMITENTE" && (
                  <div className="space-y-3">
                    {/* Lista de Registros Inconsistentes */}
                    {valData?.itensPendentes && valData.itensPendentes.length > 0 ? (
                      valData.itensPendentes.map((p, idx) => (
                        <div
                          key={p.colaboradorId || idx}
                          className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-card p-3.5 space-y-3 shadow-xs"
                        >
                          {/* Colaborador Afetado */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center text-xs font-bold shrink-0">
                                {idx + 1}
                              </span>
                              <div>
                                <span className="text-xs font-bold text-foreground block">
                                  {p.colaborador}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {p.cargo ? `${p.cargo} · ` : ""}Matrícula: {p.matricula || "Não informada"}
                                </span>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                              Pendente Complemento
                            </Badge>
                          </div>

                          {/* Diagnóstico Factual (Motivo Real da Validação) */}
                          <div className="space-y-1.5 text-xs bg-muted/40 p-2.5 rounded-md border border-border/60">
                            <span className="text-[11px] font-bold text-rose-800 dark:text-rose-300 uppercase tracking-wider block">
                              Diagnóstico Factual:
                            </span>

                            {p.detalhes?.operacional && p.detalhes.operacional.length > 0 && (
                              <div className="text-[11px] text-foreground">
                                <span className="font-semibold text-rose-700 dark:text-rose-400">Identificação Pessoal: </span>
                                {p.detalhes.operacional.join(", ")}
                              </div>
                            )}

                            {p.detalhes?.rh && p.detalhes.rh.length > 0 && (
                              <div className="text-[11px] text-foreground">
                                <span className="font-semibold text-rose-700 dark:text-rose-400">Remuneração & Regra RH: </span>
                                {p.detalhes.rh.join(", ")}
                              </div>
                            )}

                            {p.detalhes?.financeiro && p.detalhes.financeiro.length > 0 && (
                              <div className="text-[11px] text-foreground">
                                <span className="font-semibold text-rose-700 dark:text-rose-400">Dados Bancários para Pagamento: </span>
                                {p.detalhes.financeiro.join(", ")}
                              </div>
                            )}

                            {!p.detalhes && (
                              <p className="text-[11px] text-muted-foreground">{p.motivo}</p>
                            )}
                          </div>

                          {/* Impacto e Próxima Ação */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded bg-muted/20 border border-border/40">
                              <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Impacto:</span>
                              <span className="text-foreground">Lote impedido de gerar despesa financeira e remessa CNAB.</span>
                            </div>
                            <div className="p-2 rounded bg-muted/20 border border-border/40">
                              <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Próxima Ação:</span>
                              <span className="text-foreground">{p.proximaAcao}</span>
                            </div>
                          </div>

                          {/* CTA Corretivo Direto no Registro Afetado */}
                          <div className="pt-1 flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">
                              Destino: <strong className="text-foreground">{p.moduloDestino}</strong>
                            </span>
                            <Button
                              size="sm"
                              onClick={() => handleResolverPendenciaColaborador(p.colaboradorId, p.colaborador)}
                              className="h-8 text-xs font-bold bg-[#2563EB] hover:bg-[#2563EB]/90 text-white shadow-xs"
                            >
                              <FileEdit className="w-3.5 h-3.5 mr-1.5" />
                              Resolver Cadastro de {p.colaborador.split(" ")[0]}
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      /* Fallback para pendências genéricas */
                      <div className="space-y-2 text-xs">
                        <span className="font-bold text-rose-800 dark:text-rose-300">Pendências identificadas no lote:</span>
                        <ul className="list-disc pl-5 space-y-1 text-rose-700 dark:text-rose-300/90 text-xs">
                          {valData?.pendencias.map((pend, i) => (
                            <li key={i}>{pend}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Se for Operação Restrita */}
                {isOperacaoRestrita && (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-900/60 bg-card p-3 space-y-2.5 text-xs">
                    <div>
                      <span className="font-bold text-rose-800 dark:text-rose-300 block">Diagnóstico Operacional:</span>
                      <p className="text-muted-foreground text-[11px] mt-0.5">
                        Horários de entrada ou saída não registrados ou status em restrição operacional.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-muted/20 border border-border/40">
                        <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Impacto:</span>
                        <span className="text-foreground">Impossível faturar operação ou apurar rateio da equipe.</span>
                      </div>
                      <div className="p-2 rounded bg-muted/20 border border-border/40">
                        <span className="font-semibold text-muted-foreground block text-[10px] uppercase">Próxima Ação:</span>
                        <span className="text-foreground">Preencher horários de entrada e saída na operação de volume.</span>
                      </div>
                    </div>
                    <div className="pt-1 flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleAbrirModuloEspecialista}
                        className="h-8 text-xs font-bold bg-[#2563EB] hover:bg-[#2563EB]/90 text-white shadow-xs"
                      >
                        <FileEdit className="w-3.5 h-3.5 mr-1.5" />
                        Corrigir na Recepção Operacional
                      </Button>
                    </div>
                  </div>
                )}

                {/* Barra de Revalidação e Ações Rápidas */}
                <div className="pt-2 border-t border-rose-200 dark:border-rose-900/60 flex items-center justify-between gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isFetchingCompletude}
                    onClick={() => refetchCompletude()}
                    className="h-8 text-xs font-semibold border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isFetchingCompletude && "animate-spin")} />
                    Revalidar Integridade
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAbrirModuloEspecialista}
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Ver Lote de Origem
                  </Button>
                </div>
              </div>
            )}

            {/* A. O que está sendo autorizado? */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                O que está sendo autorizado?
              </h3>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {item.descricao || "Registro operacional aguardando decisão na fila transversal."}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Valor / Impacto:</span>
                    <span className="font-bold text-sm text-foreground font-mono">
                      {fmt(item.valor)}
                    </span>
                  </div>
                  {item.horas && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Horas / Volume:</span>
                      <span className="font-semibold text-foreground">
                        {item.horas}
                      </span>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Competência:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {item.competencia || "—"}
                    </span>
                  </div>
                  {origemRecurso && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Origem Recurso:</span>
                      <Badge variant={origemBadge.variant} className={cn("text-[10px] font-semibold mt-0.5", origemBadge.className)}>
                        {origemBadge.label}
                      </Badge>
                    </div>
                  )}
                </div>

                {detailNotice && (
                  <div className="p-2.5 rounded-md bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-xs text-blue-900 dark:text-blue-300 leading-relaxed">
                    <span className="font-medium">{detailNotice}</span>
                  </div>
                )}
              </div>
            </div>

            {/* B. Checklist de Integridade Factual */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Validação de Integridade & Regras de Negócio
              </h3>
              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <div className="divide-y divide-border text-xs">
                  <div className="flex items-start justify-between p-3 gap-3">
                    <div className="flex items-start gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium text-foreground">Identificação do Domínio</span>
                        <p className="text-[11px] text-muted-foreground">Classificado como {item.tipo} com rota de resolução válida.</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 text-[10px]">
                      Conforme
                    </Badge>
                  </div>

                  {item.tipo === "OPERAÇÃO" && (
                    <div className="flex items-start justify-between p-3 gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {!isOperacaoRestrita ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className={!isOperacaoRestrita ? "font-medium text-foreground" : "font-bold text-rose-700 dark:text-rose-400"}>
                            Horários de Entrada e Saída
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {!isOperacaoRestrita ? "Horários válidos registrados na operação." : "Horários ausentes ou em restrição."}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={!isOperacaoRestrita ? "border-emerald-300 text-emerald-700 text-[10px]" : "border-rose-300 text-rose-700 text-[10px] font-bold"}>
                        {!isOperacaoRestrita ? "Conforme" : "Pendente"}
                      </Badge>
                    </div>
                  )}

                  {item.tipo === "INTERMITENTE" && (
                    <div className="flex items-start justify-between p-3 gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        {!isIntermitenteIncompleto ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className={!isIntermitenteIncompleto ? "font-medium text-foreground" : "font-bold text-rose-700 dark:text-rose-400"}>
                            Completude Cadastral & Bancária
                          </span>
                          <p className="text-[11px] text-muted-foreground">
                            {!isIntermitenteIncompleto
                              ? "Todos os colaboradores do lote possuem dados cadastrais, remuneração e bancários completos."
                              : `${valData?.itensPendentes?.length || valData?.pendencias?.length || 1} pendência(s) cadastral(is) impeditiva(s) detectada(s).`}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={!isIntermitenteIncompleto ? "border-emerald-300 text-emerald-700 text-[10px]" : "border-rose-300 text-rose-700 text-[10px] font-bold"}>
                        {!isIntermitenteIncompleto ? "Conforme" : "Pendente (Fail-Closed)"}
                      </Badge>
                    </div>
                  )}

                  {item.tipo === "CUSTO EXTRA" && (
                    <div className="flex items-start justify-between p-3 gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-medium text-foreground">Origem do Recurso e Favorecido</span>
                          <p className="text-[11px] text-muted-foreground">
                            {origemBadge.labelCompleto || "Origem registrada para apropriação financeira."}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700 text-[10px]">
                        Conforme
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* C. Composição Específica do Domínio */}
            {item.tipo === "OPERAÇÃO" && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Composição Operacional
                </h3>
                <div className="rounded-xl border border-border bg-card p-4 space-y-3 text-xs">
                  {opLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                  ) : opData ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {opData.tipos_servico_operacional && (
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Serviço:</span>
                            <span className="font-semibold text-foreground">{opData.tipos_servico_operacional.nome}</span>
                          </div>
                        )}
                        {opData.transportadoras_clientes && (
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Transportadora:</span>
                            <span className="font-semibold text-foreground">{opData.transportadoras_clientes.nome}</span>
                          </div>
                        )}
                        {opData.produtos_carga && (
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Produto:</span>
                            <span className="font-semibold text-foreground">{opData.produtos_carga.nome}</span>
                          </div>
                        )}
                        {opData.quantidade != null && (
                          <div>
                            <span className="text-muted-foreground block text-[11px]">Volume / Quantidade:</span>
                            <span className="font-semibold text-foreground">{opData.quantidade}</span>
                          </div>
                        )}
                      </div>

                      {opData.production_entry_collaborators && opData.production_entry_collaborators.length > 0 && (
                        <div className="pt-2 border-t border-border/60">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                            Colaboradores Escalados ({opData.production_entry_collaborators.length})
                          </span>
                          <div className="space-y-1 max-h-[140px] overflow-y-auto">
                            {opData.production_entry_collaborators.map((c: any, i: number) => (
                              <div key={i} className="flex justify-between items-center bg-muted/40 p-1.5 px-2 rounded text-[11px]">
                                <span className="font-medium text-foreground">{c.colaboradores?.nome || "Colaborador"}</span>
                                <span className="text-muted-foreground text-[10px]">{c.colaboradores?.cargo || "Operacional"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-muted-foreground text-center py-2">Detalhes da operação carregados.</p>
                  )}
                </div>
              </div>
            )}

            {item.tipo === "DIARISTA" && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    Lote de Diaristas
                  </span>
                  <span className="text-[10px] text-muted-foreground font-normal">Edição no Especialista</span>
                </h3>
                <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-xs">
                  {diaristaLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                  ) : diaristaData?.lancamentos && diaristaData.lancamentos.length > 0 ? (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {diaristaData.lancamentos.map((l: any, i: number) => (
                        <div key={i} className="flex justify-between items-center bg-muted/30 p-2 rounded text-[11px]">
                          <div>
                            <span className="font-semibold text-foreground block">{l.colaboradores?.nome || "Diarista"}</span>
                            <span className="text-muted-foreground text-[10px]">{l.colaboradores?.cargo || "Auxiliar"} · {l.dias_trabalhados || 1} diária(s)</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">{fmt(l.valor_calculado || l.valor_total || 0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-2">Lote de diaristas consolidado.</p>
                  )}
                </div>
              </div>
            )}

            {item.tipo === "INTERMITENTE" && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Lote de Intermitentes
                </h3>
                <div className="rounded-xl border border-border bg-card p-3 space-y-2 text-xs">
                  {intermitenteLoading ? (
                    <div className="flex justify-center py-3"><Loader2 className="animate-spin h-5 w-5 text-muted-foreground" /></div>
                  ) : intermitenteData?.itens && intermitenteData.itens.length > 0 ? (
                    <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                      {intermitenteData.itens.map((c: any, i: number) => (
                        <div key={i} className="flex justify-between items-center bg-muted/30 p-2 rounded text-[11px]">
                          <div>
                            <span className="font-semibold text-foreground block">{c.nome_colaborador || "Colaborador"}</span>
                            <span className="text-muted-foreground text-[10px]">{decimalParaHora(c.horas_trabalhadas || 0)} trab</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">{fmt(c.valor_calculado || c.total || 0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-2">Lote de intermitentes consolidado.</p>
                  )}
                </div>
              </div>
            )}

            {/* D. Histórico e Rastreabilidade */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Rastreabilidade do Registro
              </h3>
              <div className="rounded-xl border border-border bg-card p-3.5 text-xs space-y-2">
                <div className="flex justify-between text-muted-foreground">
                  <span>Data de Recebimento na Central:</span>
                  <span className="font-medium text-foreground font-mono">{fmtDate(item.data_recebimento)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Status do Domínio Especialista:</span>
                  <span className="font-medium text-foreground">{item.raw_status || "REGISTRADO"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Fixo */}
          <div className="sticky bottom-0 z-20 bg-card border-t border-border p-4 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbrirModuloEspecialista}
              className="w-full sm:w-auto text-xs font-medium text-muted-foreground hover:text-foreground border-border"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              Ver no Módulo Especialista
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {item.situacao !== "Devolvido" && !isFailClosedBloqueado && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAprovando || isDevolvendo}
                  onClick={() => setModalDevolucaoOpen(true)}
                  className="flex-1 sm:flex-none text-xs font-bold border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Devolver
                </Button>
              )}

              {item.situacao === "Devolvido" ? (
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Registro em Correção na Origem
                </div>
              ) : isFailClosedBloqueado ? (
                <Button
                  size="sm"
                  disabled
                  className="flex-1 sm:flex-none text-xs font-bold bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                >
                  <Ban className="w-3.5 h-3.5 mr-1.5" />
                  Aprovação Bloqueada (Fail-Closed)
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleAprovarClick}
                  disabled={isAprovando || isDevolvendo}
                  className="flex-1 sm:flex-none text-xs font-bold bg-[#2563EB] hover:bg-[#2563EB]/90 text-white shadow-sm dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  {isAprovando ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {item.tipo === "DIARISTA" || item.tipo === "INTERMITENTE"
                    ? `Aprovar Lote (${fmt(item.valor)})`
                    : "Aprovar Decisão"}
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal de Justificativa de Devolução */}
      <Dialog open={modalDevolucaoOpen} onOpenChange={setModalDevolucaoOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              Devolver Decisão para Correção
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Informe a justificativa para devolução do registro ao módulo especialista.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
              <span className="font-bold text-foreground">{item.referencia}</span> · {item.colaborador} ({item.tipo})
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                Justificativa Obrigatória <span className="text-rose-500">*</span>
              </label>
              <Textarea
                placeholder="Descreva a divergência encontrada, documentos faltantes ou inconsistência operacional..."
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
                rows={4}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalDevolucaoOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmarDevolucao}
              disabled={!motivoDevolucao.trim() || isDevolvendo}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              {isDevolvendo ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
