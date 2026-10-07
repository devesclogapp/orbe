import React, { useState } from "react";
import {
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  ExternalLink,
  ShieldCheck,
  Info,
  RotateCcw,
  Users,
  Loader2,
  XCircle,
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  DespesaFederadaItem,
  getSituacaoBadge,
  getOrigemLabel,
  getTipoLabel,
  calcularDiasVencimento,
  formatCurrency,
  formatDate,
} from "@/services/despesasOficial.service";
import { CustoExtraOperacionalService } from "@/services/domain/despesas.service";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";

interface DespesaDrawerOficialProps {
  despesa?: DespesaFederadaItem | null;
  item?: DespesaFederadaItem | null; // Alias para compatibilidade
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void; // Alias para compatibilidade
  onSuccessMutation?: () => void;
}

export function DespesaDrawerOficial(props: DespesaDrawerOficialProps) {
  const despesa = props.despesa || props.item || null;
  const item = despesa; // Alias de rastreabilidade
  const open = props.open;
  const onOpenChange = props.onOpenChange || ((v: boolean) => { if (!v) props.onClose?.(); });
  const onSuccessMutation = props.onSuccessMutation;
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Modais de ações
  const [modalLiberarOpen, setModalLiberarOpen] = useState(false);
  const [modalLiquidarOpen, setModalLiquidarOpen] = useState(false);
  const [modalDevolverOpen, setModalDevolverOpen] = useState(false);
  const [modalAprovarLoteOpen, setModalAprovarLoteOpen] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [observacaoAprovacao, setObservacaoAprovacao] = useState("");

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["despesas-federadas"] });
    queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
    queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["lotes-diaristas-financeiro"] });
    queryClient.invalidateQueries({ queryKey: ["intermitentes_lotes_bancario"] });
    onSuccessMutation?.();
  };

  // Mutação: Custos Extras — Liberar para Pagamento (enviar_financeiro)
  const liberarCustoMutation = useMutation({
    mutationFn: async () => {
      if (!despesa || !despesa.empresaId || !item || !item.empresaId) {
        toast.error("Contexto de empresa não determinado inequivocamente. Ação bloqueada (Fail Closed).");
        throw new Error("Contexto de empresa não determinado inequivocamente.");
      }
      return CustoExtraOperacionalService.transicionar(
        despesa.canonicalId,
        "enviar_financeiro",
        despesa.rawItem?.atualizado_em || new Date().toISOString()
      );
    },
    onSuccess: () => {
      toast.success("Obrigação liberada para pagamento!", {
        description: "Status alterado para A PAGAR.",
      });
      invalidateQueries();
      setModalLiberarOpen(false);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao liberar obrigação", { description: err.message });
    },
  });

  // Mutação: Custos Extras — Liquidar Pagamento (finalizar_pagamento)
  const liquidarCustoMutation = useMutation({
    mutationFn: async () => {
      if (!despesa) return;
      return CustoExtraOperacionalService.transicionar(
        despesa.canonicalId,
        "finalizar_pagamento",
        despesa.rawItem?.atualizado_em || new Date().toISOString()
      );
    },
    onSuccess: () => {
      toast.success("Pagamento liquidado com sucesso!", {
        description: "A despesa foi finalizada e marcada como PAGA.",
      });
      invalidateQueries();
      setModalLiquidarOpen(false);
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao liquidar pagamento", { description: err.message });
    },
  });

  // Mutação: Devolver para Operação ou RH
  const devolverMutation = useMutation({
    mutationFn: async () => {
      if (!despesa) return;
      if (!motivoDevolucao.trim()) {
        throw new Error("Informe a justificativa da devolução.");
      }

      if (despesa.origem === "CUSTOS_EXTRAS") {
        return CustoExtraOperacionalService.transicionar(
          despesa.canonicalId,
          "reprovar",
          despesa.rawItem?.atualizado_em || new Date().toISOString(),
          motivoDevolucao.trim()
        );
      }

      if (despesa.origem === "CLT") {
        return RHFinanceiroService.devolverAoRH(despesa.canonicalId, motivoDevolucao.trim());
      }

      if (despesa.origem === "DIARISTAS") {
        return LoteFechamentoDiaristaService.reabrirPeriodo(
          despesa.canonicalId,
          user?.id || "",
          user?.email || "Financeiro",
          "financeiro",
          motivoDevolucao.trim(),
          "administrativa"
        );
      }

      if (despesa.origem === "INTERMITENTES") {
        return IntermitentesLoteService.devolverLote(despesa.canonicalId, motivoDevolucao.trim());
      }
    },
    onSuccess: () => {
      toast.warning("Item devolvido com sucesso", {
        description: "A origem foi notificada para os devidos ajustes.",
      });
      invalidateQueries();
      setModalDevolverOpen(false);
      setMotivoDevolucao("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao devolver item", { description: err.message });
    },
  });

  // Mutação: Aprovação Financeira de Lote de Mão de Obra
  const aprovarLoteMutation = useMutation({
    mutationFn: async () => {
      if (!despesa) return;

      if (despesa.origem === "CLT") {
        return RHFinanceiroService.aprovarFinanceiro(despesa.canonicalId, observacaoAprovacao);
      }

      if (despesa.origem === "DIARISTAS") {
        return LoteFechamentoDiaristaService.aprovarFinanceiro(
          despesa.canonicalId,
          user?.id || "",
          user?.email || "Financeiro",
          "financeiro"
        );
      }

      if (despesa.origem === "INTERMITENTES") {
        return IntermitentesLoteService.aprovarFinanceiro(despesa.canonicalId, user?.id || "");
      }
    },
    onSuccess: () => {
      toast.success("Lote aprovado com sucesso!", {
        description: "Liberado para a etapa bancária / CNAB na Central Bancária.",
      });
      invalidateQueries();
      setModalAprovarLoteOpen(false);
      setObservacaoAprovacao("");
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao aprovar lote", { description: err.message });
    },
  });

  if (!despesa) return null;

  const situacaoBadge = getSituacaoBadge(despesa.situacao, despesa.dataVencimento);
  const { isVencido, diasAtraso } = calcularDiasVencimento(despesa.dataVencimento, despesa.situacao);

  const isMaoDeObra = despesa.tipo === "MAO_DE_OBRA";
  const isPagoEmpresa = despesa.tipo === "PAGO_EMPRESA";
  const isLiquidada = despesa.situacao === "PAGA";
  const isCustoExtra = despesa.origem === "CUSTOS_EXTRAS";
  const isClt = despesa.origem === "CLT";
  const isDiaristas = despesa.origem === "DIARISTAS";
  const isIntermitentes = despesa.origem === "INTERMITENTES";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border">
          {/* HEADER DO DRAWER */}
          <SheetHeader className="p-6 pb-5 border-b border-border bg-card/60">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-0.5">
                  {despesa.codigo}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {getOrigemLabel(despesa.origem)}
                </Badge>
              </div>
              <Badge className={situacaoBadge.className}>
                {situacaoBadge.label}
              </Badge>
            </div>
            <SheetTitle className="text-xl font-display font-bold text-foreground mt-2 text-left">
              {despesa.titulo}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground text-left">
              {getTipoLabel(despesa.tipo)} · {despesa.empresaNome}
            </SheetDescription>
          </SheetHeader>

          {/* CORPO DO DRAWER */}
          <div className="p-6 space-y-6 flex-1">
            {/* 1. RESUMO FINANCEIRO */}
            <div className="rounded-lg border border-border/80 bg-muted/20 p-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Valor da Obrigação
                </span>
                <span className="text-2xl font-display font-bold text-foreground">
                  {formatCurrency(despesa.valor)}
                </span>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block mb-0.5">Competência Econômica:</span>
                  <span className="font-medium text-foreground">{despesa.competenciaFormatada}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-0.5">Origem do Recurso:</span>
                  <span className="font-medium text-foreground">{getTipoLabel(despesa.tipo)}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground block mb-0.5">Beneficiário / Favorecido:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{despesa.beneficiarioNome}</span>
                    {despesa.beneficiarioDocumento && (
                      <span className="text-muted-foreground font-mono text-[11px]">
                        ({despesa.beneficiarioDocumento})
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ALERTA DE VENCIMENTO DERIVADO */}
            {isVencido && !isLiquidada && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Título Vencido há {diasAtraso} dia(s)</p>
                  <p className="text-rose-800/90 dark:text-rose-300/90 text-[11px]">
                    Vencimento expirou em {formatDate(despesa.dataVencimento)}. Priorize o desembolso.
                  </p>
                </div>
              </div>
            )}

            {/* AVISO INFORMATIVO: PAGO PELA EMPRESA */}
            {isPagoEmpresa && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg border border-blue-200 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200 text-xs">
                <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Desembolso Direto da Empresa</p>
                  <p className="text-blue-800/90 dark:text-blue-300/90 text-[11px]">
                    Gasto já realizado no ato pela empresa. Não gera títulos no contas a pagar futuro nem transita no CNAB.
                  </p>
                </div>
              </div>
            )}

            {/* 2. DETALHES DE COMPOSIÇÃO */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-primary" />
                {isMaoDeObra ? "Composição da Mão de Obra" : "Dados do Gasto"}
              </h4>
              <div className="rounded-lg border border-border/80 bg-card p-4 space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="font-medium text-foreground text-right max-w-[280px]">
                    {despesa.descricao}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Categoria:</span>
                  <span className="font-medium text-foreground">{despesa.categoria}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status no Banco:</span>
                  <span className="font-mono text-muted-foreground">{despesa.statusReal}</span>
                </div>
                {despesa.dataDespesa && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data do Fato Gerador:</span>
                    <span className="font-medium text-foreground">{formatDate(despesa.dataDespesa)}</span>
                  </div>
                )}
                {despesa.dataVencimento && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data de Vencimento:</span>
                    <span className="font-semibold text-foreground font-mono">
                      {formatDate(despesa.dataVencimento)}
                    </span>
                  </div>
                )}
                {despesa.periodoReferencia && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Período de Referência:</span>
                    <span className="font-medium text-foreground">{despesa.periodoReferencia}</span>
                  </div>
                )}
                {despesa.quantidadePessoas !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pessoas Envolvidas:</span>
                    <span className="font-medium text-foreground">
                      {despesa.quantidadePessoas} colaboradores ({despesa.quantidadeUnidades || "unidades"})
                    </span>
                  </div>
                )}
                {despesa.formaLiquidacao && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Forma de Liquidação:</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      {despesa.formaLiquidacao}
                    </span>
                  </div>
                )}
                {despesa.dataPagamento && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data da Liquidação:</span>
                    <span className="font-medium text-foreground">{formatDate(despesa.dataPagamento)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 3. ESTEIRA FINANCEIRA */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Esteira Financeira
              </h4>
              <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
                {isMaoDeObra ? (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Fechamento do Ciclo Operacional</span>
                        <span className="text-muted-foreground text-[11px]">Encarregado</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Validação & Homologação RH</span>
                        <span className="text-muted-foreground text-[11px]">Setor RH</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        despesa.situacao === "AGUARDANDO_LIBERACAO"
                          ? "bg-amber-100 text-amber-700 animate-pulse"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {despesa.situacao === "AGUARDANDO_LIBERACAO" ? "●" : "✓"}
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Aprovação Financeira do Lote</span>
                        <span className="text-muted-foreground text-[11px]">Financeiro</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isLiquidada ? "bg-emerald-100 text-emerald-700" : despesa.situacao === "PRONTA_BANCO" ? "bg-primary/20 text-primary animate-pulse" : "bg-muted text-muted-foreground"
                      }`}>
                        {isLiquidada ? "✓" : despesa.situacao === "PRONTA_BANCO" ? "●" : "○"}
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className={`font-semibold ${isLiquidada ? "text-foreground" : "text-primary"}`}>
                          Execução Bancária (CNAB 240 / Retorno)
                        </span>
                        <span className="text-muted-foreground text-[11px]">Central Bancária</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Despesa Registrada</span>
                        <span className="text-muted-foreground text-[11px]">Portal Encarregado</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Aprovação Operacional</span>
                        <span className="text-muted-foreground text-[11px]">RH / Operação</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        despesa.situacao === "AGUARDANDO_LIBERACAO"
                          ? "bg-amber-100 text-amber-700 animate-pulse"
                          : "bg-emerald-100 text-emerald-700"
                      }`}>
                        {despesa.situacao === "AGUARDANDO_LIBERACAO" ? "●" : "✓"}
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Liberação Financeira</span>
                        <span className="text-muted-foreground text-[11px]">Financeiro</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        isLiquidada
                          ? "bg-emerald-100 text-emerald-700"
                          : despesa.situacao === "A_PAGAR"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {isLiquidada ? "✓" : "○"}
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className={`font-medium ${isLiquidada ? "text-emerald-700 font-semibold" : "text-muted-foreground"}`}>
                          Liquidação / Pagamento Efetivado (Direto)
                        </span>
                        <span className="text-muted-foreground text-[11px]">Fora do CNAB</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CONTEXTO OPERACIONAL POR ORIGEM */}
            {isCustoExtra && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                <span className="font-semibold">Fora do pipeline CNAB bancário:</span> Despesa de Custo Extra é liquidada financeiramente de forma manual / direta, sem emissão de remessa bancária CNAB.
              </div>
            )}
            {item.origem === "CLT" && (
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50/60 dark:bg-blue-950/20 text-xs text-blue-800 dark:text-blue-300">
                <span className="font-semibold">Folha Salarial / CLT:</span> Lote consolidado do motor RH pronto para análise e posterior remessa bancária.
              </div>
            )}
            {item.origem === "DIARISTAS" && (
              <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/20 text-xs text-emerald-800 dark:text-emerald-300">
                <span className="font-semibold">Diaristas Operacionais:</span> Fechamento semanal da grade operacional de diárias com apuração e validação.
              </div>
            )}
            {item.origem === "INTERMITENTES" && (
              <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/60 dark:bg-purple-950/20 text-xs text-purple-800 dark:text-purple-300">
                <span className="font-semibold">Trabalho Intermitente:</span> Apuração de convocações e horas apuradas de colaboradores intermitentes.
              </div>
            )}

            {/* 4. HISTÓRICO & AUDITORIA */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Histórico & Auditoria
              </h4>
              <div className="rounded-lg border border-border/80 bg-card divide-y divide-border/60">
                {despesa.historico.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground italic">Nenhum evento adicional registrado.</p>
                ) : (
                  despesa.historico.map((ev) => (
                    <div key={ev.id} className="p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">{ev.acao}</span>
                        <span>{ev.data}</span>
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{ev.descricao}</p>
                      <p className="text-[10px] text-muted-foreground/70">
                        Por: {ev.usuario} ({ev.papel})
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* FOOTER DO DRAWER COM CTAS ESPECÍFICOS POR DOMÍNIO */}
          <SheetFooter className="p-4 border-t border-border bg-card/60 flex flex-row items-center justify-end gap-2">
            {isMaoDeObra ? (
              // Mão de Obra
              despesa.situacao === "PRONTA_BANCO" ? (
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 rounded-lg gap-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold"
                  onClick={() => {
                    onOpenChange(false);
                    if (despesa.rotaEspecialista) {
                      navigate(despesa.rotaEspecialista);
                    } else {
                      navigate("/bancario");
                    }
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Abrir Central Bancária
                </Button>
              ) : despesa.situacao === "AGUARDANDO_LIBERACAO" ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/inconsistencias");
                    }}
                  >
                    Ver Impedimentos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg text-xs font-medium text-foreground"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/rh/aprovacoes");
                    }}
                  >
                    Abrir Aprovações
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg text-xs font-semibold text-destructive border-destructive/30 hover:bg-destructive/5"
                    onClick={() => setModalDevolverOpen(true)}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Devolver ao RH
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="h-9 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                    onClick={() => setModalAprovarLoteOpen(true)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Aprovar Financeiro
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              )
            ) : isPagoEmpresa || isLiquidada ? (
              // Custo Extra Pago / Liquidado: somente leitura
              <Button variant="outline" size="sm" className="h-9 rounded-lg text-xs font-medium" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            ) : despesa.situacao === "AGUARDANDO_LIBERACAO" ? (
              // Custo Extra Aguardando Liberação: Devolver ou Liberar
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => setModalDevolverOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Devolver p/ Operação
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 rounded-lg text-xs font-semibold bg-[#2563EB] hover:bg-[#1D4ED8] text-white"
                  onClick={() => setModalLiberarOpen(true)}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Liberar para Pagamento
                </Button>
              </>
            ) : (
              // Custo Extra A_PAGAR: Confirmar Pagamento direto ou Devolver
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-lg text-xs font-semibold text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => setModalDevolverOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Devolver
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-9 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => setModalLiquidarOpen(true)}
                >
                  <DollarSign className="h-3.5 w-3.5 mr-1.5" />
                  Confirmar Pagamento
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Dialog: Confirmar Liberação de Custo Extra */}
      <Dialog open={modalLiberarOpen} onOpenChange={setModalLiberarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar para Pagamento</DialogTitle>
            <DialogDescription>
              A despesa avançará para o estágio de A PAGAR no Financeiro para liquidação direta.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-foreground">
            Deseja liberar a despesa <strong>{despesa.titulo}</strong> no valor de <strong>{formatCurrency(despesa.valor)}</strong>?
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLiberarOpen(false)}>Cancelar</Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={liberarCustoMutation.isPending}
              onClick={() => liberarCustoMutation.mutate()}
            >
              {liberarCustoMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirmar Liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Liquidação de Custo Extra */}
      <Dialog open={modalLiquidarOpen} onOpenChange={setModalLiquidarOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Liquidação / Pagamento</DialogTitle>
            <DialogDescription>
              Esta ação registrará o desembolso e marcará a obrigação como PAGA.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-foreground space-y-2">
            <p>Valor: <strong className="text-emerald-700">{formatCurrency(despesa.valor)}</strong></p>
            <p>Favorecido: <strong>{despesa.beneficiarioNome}</strong></p>
            <p className="text-xs text-muted-foreground">Esta liquidação é efetuada diretamente fora do pipeline bancário CNAB.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalLiquidarOpen(false)}>Cancelar</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={liquidarCustoMutation.isPending}
              onClick={() => liquidarCustoMutation.mutate()}
            >
              {liquidarCustoMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirmar Pagamento Efetivado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Aprovar Lote Financeiro (Mão de Obra) */}
      <Dialog open={modalAprovarLoteOpen} onOpenChange={setModalAprovarLoteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovação Financeira do Lote</DialogTitle>
            <DialogDescription>
              O lote será homologado pelo Financeiro e encaminhado para a etapa bancária (Central Bancária / CNAB).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>Lote: <strong>{despesa.titulo}</strong> ({despesa.codigo})</p>
            <p>Valor total: <strong className="text-primary">{formatCurrency(despesa.valor)}</strong></p>
            {despesa.origem === "CLT" && (
              <div className="space-y-1">
                <Label htmlFor="obs-aprov" className="text-xs">Observação (opcional):</Label>
                <Textarea
                  id="obs-aprov"
                  rows={2}
                  placeholder="Nota de histórico financeiro..."
                  value={observacaoAprovacao}
                  onChange={(e) => setObservacaoAprovacao(e.target.value)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalAprovarLoteOpen(false)}>Cancelar</Button>
            <Button
              className="bg-primary text-primary-foreground"
              disabled={aprovarLoteMutation.isPending}
              onClick={() => aprovarLoteMutation.mutate()}
            >
              {aprovarLoteMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Aprovar Lote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Devolver para Operação ou RH */}
      <Dialog open={modalDevolverOpen} onOpenChange={setModalDevolverOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Devolver para Ajustes
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da devolução para que o responsável realize a correção.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="motivo-dev" className="text-xs font-semibold">Motivo da devolução:</Label>
            <Textarea
              id="motivo-dev"
              rows={3}
              placeholder="Descreva o motivo da devolução..."
              value={motivoDevolucao}
              onChange={(e) => setMotivoDevolucao(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalDevolverOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={devolverMutation.isPending || !motivoDevolucao.trim()}
              onClick={() => devolverMutation.mutate()}
            >
              {devolverMutation.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
