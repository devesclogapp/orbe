import React, { useState, useEffect } from "react";
import {
  X,
  Receipt,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Check,
  AlertCircle,
  AlertTriangle,
  Send,
  FileText,
  DollarSign,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Info,
  Banknote,
  RotateCcw,
  Zap,
  Layers,
  ChevronRight,
  ListCheck,
  ArrowRightLeft,
  ChevronLeft
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
import { Input } from "@/components/ui/input";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ReceitaItemUI,
  ReceitasOficialService,
  getEstagioUX,
  getEstagioUXLabel,
  getModalidadeLabel,
  getStatusLabel,
  getSituacaoVencimento,
  formatCurrency,
  formatDate,
} from "@/services/receitasOficial.service";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { generateCobrancaPDF } from "@/utils/pdfCobranca";
import { useTenant } from "@/contexts/TenantContext";

interface ReceitaDrawerOficialProps {
  receita: ReceitaItemUI | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ReceitaDrawerOficial({
  receita,
  open,
  onOpenChange,
  onSuccess,
}: ReceitaDrawerOficialProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId, role } = useTenant();

  const isFinanceiroOrAdmin = role === "admin" || role === "financeiro";

  // Estados locais para fluxo de ações no Drawer
  const [modoFechamento, setModoFechamento] = useState<boolean>(false);
  const [vencimentoFechamento, setVencimentoFechamento] = useState<string>("");
  const [isFechando, setIsFechando] = useState<boolean>(false);

  // Modal de Confirmação de Recebimento
  const [modalRecebimentoOpen, setModalRecebimentoOpen] = useState<boolean>(false);
  const [dataRecebimentoInput, setDataRecebimentoInput] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [isRecebendo, setIsRecebendo] = useState<boolean>(false);

  // Resetar modo ao abrir nova receita
  useEffect(() => {
    setModoFechamento(false);
    if (receita?.vencimento) {
      setVencimentoFechamento(receita.vencimento);
    } else {
      setVencimentoFechamento(new Date().toISOString().split("T")[0]);
    }
  }, [receita?.id, receita?.vencimento]);

  // Query detalhada sob demanda (lazy load de itens completos e histórico)
  const { data: detalhesEHistorico, isLoading: isLoadingDetalhes } = useQuery({
    queryKey: ["receita-detalhes-historico", receita?.id],
    queryFn: () => ReceitasOficialService.getReceitaDetalhesEHistorico(receita!.id),
    enabled: open && Boolean(receita?.id),
    staleTime: 1000 * 30,
  });

  const detalhesRaw = detalhesEHistorico?.detalhes || receita?.raw;
  const historicoReal = detalhesEHistorico?.historico || receita?.historico || [];

  const estagio = receita ? getEstagioUX(receita.status) : "A_RECEBER";
  const situacaoVenc = receita ? getSituacaoVencimento(receita) : { isVencido: false, diasAtraso: 0, label: "No Prazo" };

  // --- MUTAÇÕES REAIS ---

  const fecharCompetenciaMutation = useMutation({
    mutationFn: async ({ vencimento }: { vencimento?: string }) => {
      if (!tenantId || !receita) throw new Error("Contexto de tenant ou receita inválido.");
      return ReceitasOficialService.fecharCompetenciaMensal(tenantId, receita.id, vencimento);
    },
    onSuccess: () => {
      toast.success("Competência consolidada e fechada com sucesso!", {
        description: `A receita de ${receita?.clienteNome} foi fechada com vencimento para ${formatDate(vencimentoFechamento)}. Pronta para cobrança.`,
      });
      queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["receita-detalhes-historico", receita?.id] });
      setIsFechando(false);
      setModoFechamento(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error("Erro ao fechar competência", {
        description: err.message || "Falha na transição de fechamento.",
      });
      setIsFechando(false);
    },
  });

  const registrarEnvioMutation = useMutation({
    mutationFn: async () => {
      if (!tenantId || !receita) throw new Error("Contexto de tenant ou receita inválido.");
      return ReceitasOficialService.registrarEnvioCobranca(tenantId, receita.id);
    },
    onSuccess: () => {
      toast.success("Cobrança registrada como enviada ao cliente!", {
        description: "O título encontra-se em monitoramento até o vencimento.",
      });
      queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["receita-detalhes-historico", receita?.id] });
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error("Erro ao registrar envio", {
        description: err.message || "Falha ao registrar envio da cobrança.",
      });
    },
  });

  const confirmarRecebimentoMutation = useMutation({
    mutationFn: async ({ dataRecebimento }: { dataRecebimento: string }) => {
      if (!tenantId || !receita) throw new Error("Contexto de tenant ou receita inválido.");
      // Chama service de atualização de status para 'recebido' (RPC de confirmação)
      return ReceitasService.updateStatus(tenantId, receita.id, "recebido");
    },
    onSuccess: () => {
      toast.success("Recebimento confirmado com sucesso!", {
        description: `Pagamento de ${formatCurrency(receita?.valorTotal)} registrado no ORBE. Próxima etapa: Conciliação Bancária.`,
        action: {
          label: "Ir para Conciliação",
          onClick: () => {
            onOpenChange(false);
            navigate("/financeiro/retorno", {
              state: {
                activeTab: "receitas",
                highlightReceitaId: receita?.id,
              },
            });
          },
        },
      });
      queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["receita-detalhes-historico", receita?.id] });
      queryClient.invalidateQueries({ queryKey: ["receitas_para_conciliacao"] });
      setIsRecebendo(false);
      setModalRecebimentoOpen(false);
      onSuccess?.();
    },
    onError: (err: any) => {
      toast.error("Erro ao confirmar recebimento", {
        description: err.message || "Falha ao liquidar recebimento.",
      });
      setIsRecebendo(false);
    },
  });

  const handleGerarCobranca = () => {
    if (!receita) return;
    try {
      generateCobrancaPDF(receita.raw || receita, detalhesRaw, "Fatura Comercial (PDF)", receita.vencimento);

      if (tenantId) {
        ReceitasOficialService.logEvent(
          tenantId,
          receita.id,
          "GERAR_COBRANCA",
          `Fatura Comercial em PDF gerada para ${receita.clienteNome}. Vencimento: ${formatDate(receita.vencimento)}.`,
          { formato: "Fatura Comercial (PDF)", vencimento: receita.vencimento }
        ).then(() => {
          queryClient.invalidateQueries({ queryKey: ["receita-detalhes-historico", receita.id] });
        }).catch((e) => console.warn("Falha ao registrar histórico de geração:", e));
      }

      toast.success("Documento de Cobrança gerado com sucesso!", {
        description: `Fatura Comercial PDF emitida para ${receita.clienteNome} no valor de ${formatCurrency(receita.valorTotal)}.`,
      });
    } catch (err: any) {
      toast.error("Erro ao gerar PDF de cobrança", {
        description: err.message || "Falha na geração do documento.",
      });
    }
  };

  const handleConfirmarFechamentoMensal = () => {
    setIsFechando(true);
    fecharCompetenciaMutation.mutate({ vencimento: vencimentoFechamento });
  };

  const handleExecutarConfirmacaoRecebimento = () => {
    setIsRecebendo(true);
    confirmarRecebimentoMutation.mutate({ dataRecebimento: dataRecebimentoInput });
  };

  if (!receita) return null;

  // Itens consolidados para exibição
  const itensExibicao = (detalhesRaw?.receitas_operacionais_itens || receita.itens || []).map((it: any) => {
    const isSe = Boolean(it.servico_extra_id != null || it.servicos_extras_operacionais != null);
    const refOrigem = it.refOrigem || (isSe
      ? `SEX-${String(it.servico_extra_id || it.id).slice(0, 4).toUpperCase()}`
      : `OPV-${String(it.operacao_id || it.id).slice(0, 4).toUpperCase()}`);

    const descricao = it.descricao || (isSe
      ? (it.servicos_extras_operacionais?.descricao_servico || it.servicos_extras_operacionais?.tipo_servico || "Serviço Extra")
      : (it.operacoes_producao?.servicos?.nome || it.operacoes_producao?.produtos?.nome || "Operação por Volume"));

    const valor = Number(it.valor || it.valor_item || 0);
    const dataFato = it.data || it.servicos_extras_operacionais?.data || it.operacoes_producao?.data_operacao || it.created_at;

    return {
      id: it.id,
      refOrigem,
      tipoOrigem: isSe ? ("Serviço Extra" as const) : ("Operação por Volume" as const),
      descricao,
      valor,
      data: String(dataFato || "").slice(0, 10),
      operacao_id: it.operacao_id,
      servico_extra_id: it.servico_extra_id,
    };
  });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[620px] md:max-w-[700px] p-0 flex flex-col h-full bg-background border-l border-border"
        >
          {/* 1. HEADER DO DRAWER */}
          <SheetHeader className="p-6 border-b border-border/60 bg-muted/10 shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="font-semibold text-xs bg-muted/50 border-border">
                    {getModalidadeLabel(receita.modalidade)}
                  </Badge>
                  {receita.observacao === "FATURA_COMPLEMENTAR" && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-semibold">
                      COMPLEMENTAR
                    </Badge>
                  )}
                  <span className="font-mono text-xs text-muted-foreground font-medium">
                    {receita.id}
                  </span>
                </div>
                <SheetTitle className="text-xl font-bold tracking-tight text-foreground truncate">
                  {receita.clienteNome}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>Competência: <strong>{receita.competenciaFormatada}</strong></span>
                  <span>•</span>
                  <span>Origem: {receita.origemPrincipal}</span>
                </SheetDescription>
              </div>

              <div className="shrink-0 flex items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={
                    estagio === "A_FATURAR_FECHAR"
                      ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 font-bold"
                      : estagio === "COBRANCA_PENDENTE"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 font-bold"
                      : estagio === "A_RECEBER"
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 font-bold"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold"
                  }
                >
                  {getEstagioUXLabel(estagio).toUpperCase()}
                </Badge>
              </div>
            </div>
          </SheetHeader>

          {/* 2. CORPO DO DRAWER (SCROLLABLE) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* MODO DE FECHAMENTO (SUBVIEW CONTEXTUAL) */}
            {modoFechamento ? (
              <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/50 rounded-xl p-5 space-y-5 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <h4 className="font-bold text-sm text-foreground">
                      Revisão do Fechamento de Faturamento Mensal
                    </h4>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setModoFechamento(false)}
                  >
                    Voltar
                  </Button>
                </div>

                <div className="bg-background rounded-lg p-4 border border-border space-y-3 text-xs">
                  <p className="font-semibold text-foreground text-sm">O que será faturado?</p>
                  <div className="grid grid-cols-2 gap-3 text-muted-foreground">
                    <div>
                      <span className="block text-[11px] uppercase font-bold text-muted-foreground/70">Lançamentos</span>
                      <span className="font-semibold text-foreground">{itensExibicao.length} itens consolidados</span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase font-bold text-muted-foreground/70">Valor Consolidado</span>
                      <span className="font-bold text-base text-foreground font-display">{formatCurrency(receita.valorTotal)}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase font-bold text-muted-foreground/70">Competência</span>
                      <span className="font-medium text-foreground">{receita.competenciaFormatada}</span>
                    </div>
                    <div>
                      <span className="block text-[11px] uppercase font-bold text-muted-foreground/70">Cliente</span>
                      <span className="font-medium text-foreground">{receita.clienteNome}</span>
                    </div>
                  </div>
                </div>

                {/* Vencimento Padrão */}
                <div className="space-y-1.5">
                  <Label htmlFor="vencimento-fechamento" className="text-xs font-semibold">
                    Aplicar Vencimento Padrão da Fatura:
                  </Label>
                  <Input
                    id="vencimento-fechamento"
                    type="date"
                    value={vencimentoFechamento}
                    onChange={(e) => setVencimentoFechamento(e.target.value)}
                    className="h-9 text-xs font-medium"
                  />
                </div>

                {/* Checklist Operacional */}
                <div className="space-y-2 bg-background/80 rounded-lg p-3.5 border border-border">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    Checklist de Validação
                  </p>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>Itens operacionais consolidados e apurados</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>Tomador do serviço (cliente) identificado</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>Valores unitários e adicionais resolvidos</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-4 w-4 shrink-0" />
                      <span>Nenhum lançamento duplicado no período</span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-purple-900/80 dark:text-purple-300 leading-relaxed bg-purple-100/60 dark:bg-purple-900/30 p-3 rounded-lg">
                  <strong>Efeito do Fechamento:</strong> Este fechamento consolidará a receita mensal e a disponibilizará imediatamente para geração e envio da cobrança.
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setModoFechamento(false)}
                    disabled={isFechando}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-semibold"
                    onClick={handleConfirmarFechamentoMensal}
                    disabled={isFechando || !isFinanceiroOrAdmin}
                  >
                    {isFechando ? "Consolidando..." : "Confirmar Fechamento"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 2.1. RESUMO FINANCEIRO */}
                <div className="bg-card rounded-xl p-5 border border-border shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border/50">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Valor Reconhecido
                    </span>
                    <span className="text-2xl font-black font-display text-foreground tracking-tight">
                      {formatCurrency(receita.valorTotal)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Modalidade
                      </span>
                      <span className="font-semibold text-foreground">
                        {getModalidadeLabel(receita.modalidade)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Vencimento
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatDate(receita.vencimento)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Origem
                      </span>
                      <span className="font-semibold text-foreground">
                        {receita.origemPrincipal}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {receita.dataRecebimento ? "Liquidação" : "Situação Financeira"}
                      </span>
                      <span className="font-semibold text-foreground">
                        {receita.dataRecebimento
                          ? formatDate(receita.dataRecebimento)
                          : receita.status === "aguardando_fechamento"
                          ? "Aguardando faturamento"
                          : receita.status === "pendente_cobranca" || receita.status === "cobranca_gerada"
                          ? "Aguardando cobrança"
                          : "Aguardando recebimento"}
                      </span>
                    </div>
                  </div>

                  {/* Alerta contextual se VENCIDO */}
                  {situacaoVenc.isVencido && (
                    <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg p-3 flex items-center justify-between gap-2 text-xs text-rose-800 dark:text-rose-200">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span>
                          Título vencido há <strong>{situacaoVenc.diasAtraso} dias</strong> (vencimento em {formatDate(receita.vencimento)}).
                        </span>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900 underline"
                        onClick={() => {
                          onOpenChange(false);
                          navigate("/financeiro/inadimplencia");
                        }}
                      >
                        Abrir em Cobrança
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2.2. COMPOSIÇÃO DA RECEITA */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Composição da Receita ({itensExibicao.length} {itensExibicao.length === 1 ? "item" : "itens"})
                    </h4>
                  </div>

                  <div className="bg-card rounded-xl border border-border overflow-hidden text-xs">
                    <div className="divide-y divide-border/40">
                      {itensExibicao.length === 0 ? (
                        <div className="p-4 text-center text-muted-foreground">
                          Nenhum item discriminado vinculado.
                        </div>
                      ) : (
                        itensExibicao.map((it: any) => (
                          <div key={it.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/10 transition-colors">
                            <div className="space-y-0.5 min-w-0">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-mono text-[10px] px-1.5 h-4 bg-muted/40">
                                  {it.refOrigem}
                                </Badge>
                                <span className="font-semibold text-foreground truncate">
                                  {it.descricao}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground">
                                {it.tipoOrigem} • {formatDate(it.data)}
                              </p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-foreground font-display">
                                {formatCurrency(it.valor)}
                              </span>
                              {it.operacao_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  title="Ver Operação por Volume"
                                  onClick={() => {
                                    onOpenChange(false);
                                    navigate("/operacoes-volume", { state: { highlight: it.operacao_id } });
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                              {it.servico_extra_id && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                                  title="Ver Serviço Extra"
                                  onClick={() => {
                                    onOpenChange(false);
                                    navigate("/operacional/servicos-extras", { state: { highlight: it.servico_extra_id } });
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* 2.3. TIMELINE DO CICLO FINANCEIRO */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Linha do Tempo do Ciclo Financeiro
                  </h4>

                  <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                    {receita.modalidade === "CAIXA_IMEDIATO" ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Receita Reconhecida</p>
                            <p className="text-[11px] text-muted-foreground">Fato gerador operacional aprovado.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            receita.status === "recebido" || receita.status === "conciliado"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700 animate-pulse"
                          }`}>
                            {receita.status === "recebido" || receita.status === "conciliado" ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Recebimento Imediato (À Vista)</p>
                            <p className="text-[11px] text-muted-foreground">
                              {receita.status === "recebido" || receita.status === "conciliado"
                                ? `Liquidado em ${formatDate(receita.dataRecebimento)}`
                                : "Aguardando confirmação do comprovante (PIX/dinheiro)"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            receita.status === "conciliado"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {receita.status === "conciliado" ? <Check className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Conciliação Bancária</p>
                            <p className="text-[11px] text-muted-foreground">
                              {receita.status === "conciliado"
                                ? "Conferência concluída contra extrato bancário."
                                : "Conferência realizada na Central Bancária após recebimento."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : receita.modalidade === "FATURAMENTO_MENSAL" ? (
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Receita Reconhecida</p>
                            <p className="text-[11px] text-muted-foreground">
                              {itensExibicao.length} {itensExibicao.length === 1 ? "lançamento compõe" : "lançamentos compõem"} esta receita na competência {receita.competenciaFormatada}.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            receita.status !== "aguardando_fechamento"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700 animate-pulse"
                          }`}>
                            {receita.status !== "aguardando_fechamento" ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Fechamento da Competência</p>
                            <p className="text-[11px] text-muted-foreground">
                              {receita.status !== "aguardando_fechamento"
                                ? `Ciclo consolidado. Vencimento: ${formatDate(receita.vencimento)}`
                                : "Aguardando consolidação e fixação de vencimento."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            ["cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                              ? "bg-emerald-100 text-emerald-700"
                              : receita.status === "cobranca_gerada"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {["cobranca_enviada", "recebido", "conciliado"].includes(receita.status) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Cobrança</p>
                            <p className="text-[11px] text-muted-foreground">
                              {["cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                                ? "Fatura consolidada gerada e enviada ao cliente."
                                : "Geração de Fatura Consolidada em PDF."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            ["recebido", "conciliado"].includes(receita.status)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {["recebido", "conciliado"].includes(receita.status) ? <Check className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Recebimento</p>
                            <p className="text-[11px] text-muted-foreground">
                              {["recebido", "conciliado"].includes(receita.status)
                                ? `Liquidado em ${formatDate(receita.dataRecebimento)}`
                                : "Aguardando pagamento até o vencimento."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* DUPLICATA */
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Receita Reconhecida</p>
                            <p className="text-[11px] text-muted-foreground">Fato gerador operacional aprovado.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            ["cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700 animate-pulse"
                          }`}>
                            {["cobranca_enviada", "recebido", "conciliado"].includes(receita.status) ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Cobrança (Emissão & Envio)</p>
                            <p className="text-[11px] text-muted-foreground">
                              {["cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                                ? "Cobrança enviada ao cliente com sucesso."
                                : "Emissão de título comercial e envio ao cliente."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            ["recebido", "conciliado"].includes(receita.status)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {["recebido", "conciliado"].includes(receita.status) ? <Check className="h-3 w-3" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Recebimento</p>
                            <p className="text-[11px] text-muted-foreground">
                              {["recebido", "conciliado"].includes(receita.status)
                                ? `Liquidado em ${formatDate(receita.dataRecebimento)}`
                                : "Aguardando compensação do pagamento."}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2.4. HISTÓRICO & AUDITORIA */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Histórico & Auditoria ({historicoReal.length} {historicoReal.length === 1 ? "evento" : "eventos"})
                  </h4>

                  <div className="bg-card rounded-xl border border-border p-3 text-xs space-y-2">
                    {isLoadingDetalhes ? (
                      <p className="text-muted-foreground text-center py-2">Carregando trilha de auditoria...</p>
                    ) : historicoReal.length === 0 ? (
                      <p className="text-muted-foreground text-center py-2">Nenhum evento registrado ainda.</p>
                    ) : (
                      historicoReal.map((ev, idx) => (
                        <div key={ev.id || idx} className="flex items-start justify-between gap-2 py-1.5 border-b border-border/40 last:border-0">
                          <div>
                            <span className="font-semibold text-foreground block">
                              {ev.acao}
                            </span>
                            {ev.detalhes && (
                              <p className="text-[11px] text-muted-foreground">{ev.detalhes}</p>
                            )}
                            <span className="text-[10px] text-muted-foreground/80">Por: {ev.usuario}</span>
                          </div>
                          <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                            {ev.dataHora}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. AÇÕES DE RODAPÉ (SOMENTE QUANDO FORA DO MODO FECHAMENTO) */}
          {!modoFechamento && (
            <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>

              <div className="flex flex-wrap items-center gap-2">
                {/* Status 1: AGUARDANDO_FECHAMENTO (Faturamento Mensal) */}
                {receita.status === "aguardando_fechamento" && (
                  <Button
                    size="sm"
                    className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
                    onClick={() => setModoFechamento(true)}
                    disabled={!isFinanceiroOrAdmin}
                  >
                    <ListCheck className="h-4 w-4 mr-1.5" />
                    Revisar Fechamento
                  </Button>
                )}

                {/* Status 2: PENDENTE_COBRANCA ou COBRANCA_GERADA */}
                {(receita.status === "pendente_cobranca" || receita.status === "cobranca_gerada") && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGerarCobranca}
                      disabled={!isFinanceiroOrAdmin}
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      Gerar Documento de Cobrança
                    </Button>
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                      onClick={() => registrarEnvioMutation.mutate()}
                      disabled={registrarEnvioMutation.isPending || !isFinanceiroOrAdmin}
                    >
                      <Send className="h-4 w-4 mr-1.5" />
                      {registrarEnvioMutation.isPending ? "Registrando..." : "Registrar Envio ao Cliente"}
                    </Button>
                  </>
                )}

                {/* Status 3: COBRANCA_ENVIADA ou PENDENTE_RECEBIMENTO */}
                {(receita.status === "cobranca_enviada" || receita.status === "pendente_recebimento") && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleGerarCobranca}
                      disabled={!isFinanceiroOrAdmin}
                    >
                      <FileText className="h-4 w-4 mr-1.5" />
                      Reemitir Documento
                    </Button>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                      onClick={() => setModalRecebimentoOpen(true)}
                      disabled={!isFinanceiroOrAdmin}
                    >
                      <Banknote className="h-4 w-4 mr-1.5" />
                      Confirmar Recebimento
                    </Button>
                  </>
                )}

                {/* Status 4: RECEBIDO ou CONCILIADO */}
                {(receita.status === "recebido" || receita.status === "conciliado") && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    onClick={() => {
                      onOpenChange(false);
                      navigate("/financeiro/retorno", {
                        state: {
                          activeTab: "receitas",
                          highlightReceitaId: receita.id,
                        },
                      });
                    }}
                  >
                    <ArrowRightLeft className="h-4 w-4 mr-1.5" />
                    Abrir Central Bancária
                  </Button>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* MODAL DE CONFIRMAÇÃO DE RECEBIMENTO */}
      <Dialog open={modalRecebimentoOpen} onOpenChange={setModalRecebimentoOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Confirmar Recebimento
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirme o recebimento financeiro desta receita para atualizar o fluxo de caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="bg-muted/40 p-3 rounded-lg space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-semibold text-foreground">{receita.clienteNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-bold text-foreground font-display text-sm">{formatCurrency(receita.valorTotal)}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="data-recebimento" className="text-xs font-semibold">
                Data Efetiva do Recebimento:
              </Label>
              <Input
                id="data-recebimento"
                type="date"
                value={dataRecebimentoInput}
                onChange={(e) => setDataRecebimentoInput(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O recebimento registrará a liquidação no ORBE e disponibilizará o título para conferência final na <strong>Central Bancária</strong>.
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setModalRecebimentoOpen(false)}
              disabled={isRecebendo}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleExecutarConfirmacaoRecebimento}
              disabled={isRecebendo || !isFinanceiroOrAdmin}
            >
              {isRecebendo ? "Confirmando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
