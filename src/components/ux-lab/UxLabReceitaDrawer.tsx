import React, { useState } from "react";
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
  ListCheck
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
import {
  ReceitaOperacionalMock,
  getEstagioUX,
  getEstagioUXLabel,
  getModalidadeLabel,
  getStatusLabel,
  getSituacaoVencimento,
} from "@/pages/UxLab/receitasMockData";

interface UxLabReceitaDrawerProps {
  receita: ReceitaOperacionalMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReceitaUpdated?: (receitaAtualizada: ReceitaOperacionalMock) => void;
}

export function UxLabReceitaDrawer({
  receita,
  open,
  onOpenChange,
  onReceitaUpdated,
}: UxLabReceitaDrawerProps) {
  const navigate = useNavigate();

  // Estados locais para fluxo de ações no Drawer
  const [modoFechamento, setModoFechamento] = useState<boolean>(false);
  const [vencimentoFechamento, setVencimentoFechamento] = useState<string>("2026-11-30");
  const [isFechando, setIsFechando] = useState<boolean>(false);

  // Modal de Confirmação de Recebimento
  const [modalRecebimentoOpen, setModalRecebimentoOpen] = useState<boolean>(false);
  const [dataRecebimentoInput, setDataRecebimentoInput] = useState<string>("2026-10-04");
  const [isRecebendo, setIsRecebendo] = useState<boolean>(false);

  // Resetar modo ao abrir nova receita
  React.useEffect(() => {
    setModoFechamento(false);
    if (receita?.vencimento) {
      setVencimentoFechamento(receita.vencimento);
    }
  }, [receita?.id]);

  if (!receita) return null;

  const estagio = getEstagioUX(receita.status);
  const situacaoVenc = getSituacaoVencimento(receita);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // --- Handlers de Ações Mock ---

  const handleGerarCobranca = () => {
    toast.success("Documento de Cobrança gerado com sucesso!", {
      description: `Fatura Comercial PDF emitida para ${receita.clienteNome} no valor de ${formatCurrency(receita.valorTotal)}.`,
    });
    if (onReceitaUpdated) {
      onReceitaUpdated({
        ...receita,
        status: "cobranca_gerada",
        historico: [
          {
            dataHora: "04/10 14:30",
            acao: "GERAR_COBRANCA",
            usuario: "Financeiro",
            detalhes: "Documento emitido em formato PDF.",
          },
          ...receita.historico,
        ],
      });
    }
  };

  const handleRegistrarEnvio = () => {
    toast.success("Cobrança registrada como enviada ao cliente!", {
      description: "O título encontra-se em monitoramento até o vencimento.",
    });
    if (onReceitaUpdated) {
      onReceitaUpdated({
        ...receita,
        status: "cobranca_enviada",
        historico: [
          {
            dataHora: "04/10 14:35",
            acao: "REGISTRAR_ENVIO",
            usuario: "Financeiro",
            detalhes: "Cobrança enviada externamente e registrada no sistema.",
          },
          ...receita.historico,
        ],
      });
    }
  };

  const handleConfirmarFechamentoMensal = () => {
    setIsFechando(true);
    setTimeout(() => {
      setIsFechando(false);
      setModoFechamento(false);
      toast.success("Competência consolidada e fechada com sucesso!", {
        description: `A receita de ${receita.clienteNome} foi fechada com vencimento para ${formatDate(vencimentoFechamento)}. Pronta para cobrança.`,
      });
      if (onReceitaUpdated) {
        onReceitaUpdated({
          ...receita,
          status: "pendente_cobranca",
          vencimento: vencimentoFechamento,
          historico: [
            {
              dataHora: "04/10 14:40",
              acao: "FECHAR_COMPETENCIA",
              usuario: "Financeiro",
              detalhes: `Competência consolidada (${receita.itens.length} itens). Vencimento fixado em ${formatDate(vencimentoFechamento)}.`,
            },
            ...receita.historico,
          ],
        });
      }
    }, 400);
  };

  const handleExecutarConfirmacaoRecebimento = () => {
    setIsRecebendo(true);
    setTimeout(() => {
      setIsRecebendo(false);
      setModalRecebimentoOpen(false);
      toast.success("Recebimento confirmado com sucesso!", {
        description: `Pagamento de ${formatCurrency(receita.valorTotal)} registrado no ORBE. Próxima etapa: Conciliação Bancária.`,
      });
      if (onReceitaUpdated) {
        onReceitaUpdated({
          ...receita,
          status: "recebido",
          dataRecebimento: dataRecebimentoInput,
          historico: [
            {
              dataHora: "04/10 14:45",
              acao: "CONFIRMAR_RECEBIMENTO",
              usuario: "Financeiro / Caixa",
              detalhes: `Recebimento registrado com data ${formatDate(dataRecebimentoInput)}. Disponibilizado para a Central Bancária.`,
            },
            ...receita.historico,
          ],
        });
      }
    }, 300);
  };

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
                      ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                      : estagio === "COBRANCA_PENDENTE"
                      ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300"
                      : estagio === "A_RECEBER"
                      ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300"
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
                      <span className="font-semibold text-foreground">{receita.itens.length} itens consolidados</span>
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
                    disabled={isFechando}
                  >
                    {isFechando ? "Consolidando..." : "Confirmar Fechamento"}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* 2.1. RESUMO FINANCEIRO */}
                <div className="bg-card rounded-xl p-5 border border-border shadow-xs space-y-4">
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
                        <span>Título vencido há <strong>{situacaoVenc.diasAtraso} dias</strong> (vencimento em {formatDate(receita.vencimento)}).</span>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:text-rose-900 underline"
                        onClick={() => toast.info("Direcionando para Inadimplência & Cobrança (Módulo Especialista)...")}
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
                      Composição da Receita ({receita.itens.length} {receita.itens.length === 1 ? "item" : "itens"})
                    </h4>
                  </div>

                  <div className="bg-card rounded-xl border border-border overflow-hidden text-xs">
                    <div className="divide-y divide-border/40">
                      {receita.itens.map((it) => (
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
                          <span className="font-bold text-foreground font-display shrink-0">
                            {formatCurrency(it.valor)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2.3. TIMELINE FINANCEIRA ESPECÍFICA POR MODALIDADE */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Linha do Tempo do Ciclo Financeiro
                  </h4>

                  <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                    {/* Renderização condicional por modalidade */}
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
                              {receita.itens.length} {receita.itens.length === 1 ? "lançamento compõe" : "lançamentos compõem"} esta receita na competência {receita.competenciaFormatada}.
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
                                : "Acompanhamento até a liquidação bancária."}
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
                                : "Conferência realizada na Central Bancária."}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // DUPLICATA
                      <div className="space-y-3 text-xs">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5 h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                            <Check className="h-3 w-3" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Receita Reconhecida</p>
                            <p className="text-[11px] text-muted-foreground">Operação validada e aprovada.</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            ["cobranca_gerada", "cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-blue-100 text-blue-700 animate-pulse"
                          }`}>
                            {["cobranca_gerada", "cobranca_enviada", "recebido", "conciliado"].includes(receita.status) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Clock className="h-3 w-3" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Geração da Duplicata / Cobrança</p>
                            <p className="text-[11px] text-muted-foreground">
                              {["cobranca_gerada", "cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                                ? "Título/fatura emitido em PDF."
                                : "Emissão de documento de cobrança."}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${
                            ["cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {["cobranca_enviada", "recebido", "conciliado"].includes(receita.status) ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">Envio da Cobrança</p>
                            <p className="text-[11px] text-muted-foreground">
                              {["cobranca_enviada", "recebido", "conciliado"].includes(receita.status)
                                ? "Cobrança enviada ao cliente. Em monitoramento até vencimento."
                                : "Aguardando confirmação de envio."}
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
                                : "Acompanhamento até a liquidação financeira."}
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
                                : "Conferência realizada na Central Bancária."}
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
                    Histórico & Auditoria
                  </h4>

                  <div className="bg-card rounded-xl p-4 border border-border space-y-3">
                    {receita.historico.map((h, i) => (
                      <div key={i} className="flex items-start justify-between gap-2 text-xs border-b border-border/40 pb-2 last:border-b-0 last:pb-0">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground">{h.acao}</span>
                            <span className="text-[10px] text-muted-foreground">por {h.usuario}</span>
                          </div>
                          {h.detalhes && <p className="text-[11px] text-muted-foreground">{h.detalhes}</p>}
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground shrink-0">{h.dataHora}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 3. FOOTER COM AÇÕES CONTEXTUAIS */}
          <SheetFooter className="p-4 border-t border-border/60 bg-card shrink-0 flex flex-row items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {receita.modalidade === "FATURAMENTO_MENSAL" ? "Cancelar" : "Fechar"}
            </Button>

            {!modoFechamento && (
              <div className="flex items-center gap-2">
                {/* AÇÃO 1: Faturamento Mensal - aguardando_fechamento */}
                {receita.modalidade === "FATURAMENTO_MENSAL" && receita.status === "aguardando_fechamento" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5"
                    onClick={() => setModoFechamento(true)}
                  >
                    <ListCheck className="h-4 w-4" />
                    Revisar Fechamento
                  </Button>
                )}

                {/* AÇÃO 2: Cobrança Pendente */}
                {receita.status === "pendente_cobranca" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5"
                    onClick={handleGerarCobranca}
                  >
                    <FileText className="h-4 w-4" />
                    Gerar Cobrança
                  </Button>
                )}

                {/* AÇÃO 3: Cobrança Gerada -> Registrar Envio */}
                {receita.status === "cobranca_gerada" && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-semibold gap-1.5"
                    onClick={handleRegistrarEnvio}
                  >
                    <Send className="h-4 w-4" />
                    Registrar Envio
                  </Button>
                )}

                {/* AÇÃO 4: A Receber (cobranca_enviada ou pendente_recebimento) */}
                {(receita.status === "cobranca_enviada" || receita.status === "pendente_recebimento") && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
                    onClick={() => setModalRecebimentoOpen(true)}
                  >
                    <Banknote className="h-4 w-4" />
                    Confirmar Recebimento
                  </Button>
                )}

                {/* AÇÃO 5: Recebido -> Redirecionar para Central Bancária */}
                {receita.status === "recebido" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-semibold gap-1.5"
                    onClick={() => {
                      toast.info("Direcionando para Central Bancária (CNAB & Retorno)...");
                      navigate("/financeiro/retorno");
                    }}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Abrir Central Bancária
                  </Button>
                )}

                {/* AÇÃO 6: Conciliado -> Somente Leitura */}
                {receita.status === "conciliado" && (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold text-xs py-1.5 px-3">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                    Ciclo Concluído
                  </Badge>
                )}
              </div>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* MODAL CONTEXTUAL DE CONFIRMAÇÃO DE RECEBIMENTO */}
      <Dialog open={modalRecebimentoOpen} onOpenChange={setModalRecebimentoOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              Confirmar Recebimento
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Confirme o recebimento financeiro desta receita para atualizar o fluxo de caixa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="bg-muted/30 p-3.5 rounded-lg border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-semibold text-foreground">{receita.clienteNome}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Referência:</span>
                <span className="font-mono font-medium text-foreground">{receita.id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modalidade:</span>
                <span className="font-medium text-foreground">{getModalidadeLabel(receita.modalidade)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-border/50">
                <span className="font-bold text-foreground">Valor a Receber:</span>
                <span className="font-black text-base font-display text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(receita.valorTotal)}
                </span>
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

            <p className="text-[11px] text-muted-foreground bg-blue-50/70 dark:bg-blue-950/20 p-2.5 rounded-md border border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200">
              <strong>Próxima etapa:</strong> Após confirmar, o título passará para o status <em>Recebido</em> e ficará disponível para conferência e conciliação na Central Bancária.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              disabled={isRecebendo}
            >
              {isRecebendo ? "Confirmando..." : "Confirmar Recebimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
