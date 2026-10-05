import React, { useState } from "react";
import {
  X,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  Check,
  AlertCircle,
  AlertTriangle,
  FileText,
  DollarSign,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Info,
  Banknote,
  RotateCcw,
  Users,
  Wallet,
  Receipt,
  UserCheck,
  Truck,
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
import {
  DespesaObrigacaoMock,
  getSituacaoBadge,
  getOrigemLabel,
  getTipoLabel,
  calcularDiasVencimento,
} from "@/pages/UxLab/despesasMockData";

interface UxLabDespesaDrawerProps {
  despesa: DespesaObrigacaoMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDespesaUpdated?: (despesaAtualizada: DespesaObrigacaoMock) => void;
}

export function UxLabDespesaDrawer({
  despesa,
  open,
  onOpenChange,
  onDespesaUpdated,
}: UxLabDespesaDrawerProps) {
  const navigate = useNavigate();

  // Dialogs de Ações Financeiras
  const [modalLiberarOpen, setModalLiberarOpen] = useState(false);
  const [modalLiquidarOpen, setModalLiquidarOpen] = useState(false);
  const [modalDevolverOpen, setModalDevolverOpen] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");

  if (!despesa) return null;

  const situacaoBadge = getSituacaoBadge(despesa.situacao, despesa.dataVencimento);
  const { isVencido, diasAtraso } = calcularDiasVencimento(despesa.dataVencimento, despesa.situacao);

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

  // Ação 1: Liberar para Pagamento (Custos Extras)
  const handleLiberarPagamento = () => {
    const atualizada: DespesaObrigacaoMock = {
      ...despesa,
      situacao: "A_PAGAR",
      historico: [
        {
          id: `h-${Date.now()}`,
          data: `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          usuario: "Flávio Financeiro",
          papel: "Financeiro / Controladoria",
          acao: "Liberação Financeira",
          descricao: "Despesa aprovada e liberada para desembolso/pagamento no financeiro.",
        },
        ...despesa.historico,
      ],
    };
    onDespesaUpdated?.(atualizada);
    setModalLiberarOpen(false);
    toast.success("Obrigação liberada com sucesso!", {
      description: "O status foi atualizado para A PAGAR.",
    });
  };

  // Ação 2: Confirmar Pagamento / Liquidação (Custos Extras)
  const handleConfirmarPagamento = () => {
    const dataHoje = new Date().toISOString().slice(0, 10);
    const atualizada: DespesaObrigacaoMock = {
      ...despesa,
      situacao: "PAGA",
      dataPagamento: dataHoje,
      formaLiquidacao: despesa.tipo === "REEMBOLSO_COLABORADOR" ? "Transferência Direta PIX" : "Boleto Liquidado",
      historico: [
        {
          id: `h-${Date.now()}`,
          data: `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          usuario: "Flávio Financeiro",
          papel: "Financeiro",
          acao: "Liquidação Financeira",
          descricao: "Pagamento efetuado e registrado no financeiro com sucesso.",
        },
        ...despesa.historico,
      ],
    };
    onDespesaUpdated?.(atualizada);
    setModalLiquidarOpen(false);
    toast.success("Pagamento liquidado com sucesso!", {
      description: "A obrigação foi finalizada e marcada como PAGA.",
    });
  };

  // Ação 3: Devolver para Operação (Custos Extras)
  const handleDevolver = () => {
    if (!motivoDevolucao.trim()) {
      toast.error("Informe a justificativa da devolução.");
      return;
    }
    const atualizada: DespesaObrigacaoMock = {
      ...despesa,
      situacao: "AGUARDANDO_LIBERACAO",
      historico: [
        {
          id: `h-${Date.now()}`,
          data: `${new Date().toLocaleDateString("pt-BR")} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
          usuario: "Flávio Financeiro",
          papel: "Financeiro",
          acao: "Devolução Financeira",
          descricao: `Devolvido para reavaliação. Motivo: ${motivoDevolucao.trim()}`,
        },
        ...despesa.historico,
      ],
    };
    onDespesaUpdated?.(atualizada);
    setModalDevolverOpen(false);
    setMotivoDevolucao("");
    toast.warning("Despesa devolvida para a operação", {
      description: "O encarregado será notificado para ajuste.",
    });
  };

  const isMaoDeObra = despesa.tipo === "MAO_DE_OBRA";
  const isPagoEmpresa = despesa.tipo === "PAGO_EMPRESA";

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border">
          {/* ── HEADER DO DRAWER ──────────────────────────────────────────────── */}
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

          {/* ── CORPO DO DRAWER ───────────────────────────────────────────────── */}
          <div className="p-6 space-y-6 flex-1">
            {/* 1. RESUMO FINANCEIRO (CARD DE DESTAQUE) */}
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
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
                  <span className="text-muted-foreground block mb-0.5">Competência:</span>
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

            {/* ALERTA DE VENCIMENTO DERIVADO (SE VENCIDO) */}
            {isVencido && despesa.situacao !== "PAGA" && (
              <div className="flex items-start gap-3 p-3.5 rounded-lg border border-rose-200 bg-rose-50/80 dark:border-rose-900/50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold">Título Vencido há {diasAtraso} dia(s)</p>
                  <p className="text-rose-800/90 dark:text-rose-300/90 text-[11px]">
                    Vencimento contratual expirou em {formatDate(despesa.dataVencimento)}. Priorize o agendamento da liquidação.
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

            {/* 2. DETALHES DE ORIGEM / CATEGORIA */}
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
                {despesa.quantidadePessoas && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pessoas Envolvidas:</span>
                    <span className="font-medium text-foreground">
                      {despesa.quantidadePessoas} colaboradores ({despesa.quantidadeUnidades})
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

            {/* 3. FLUXO FINANCEIRO (TIMELINE DE ESTÁGIOS) */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-primary" />
                Esteira Financeira
              </h4>
              <div className="rounded-lg border border-border/80 bg-card p-4 space-y-3">
                {isMaoDeObra ? (
                  // Fluxo B: Mão de Obra
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
                      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">
                        ✓
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className="font-medium text-foreground">Aprovação Financeira da Obrigação</span>
                        <span className="text-muted-foreground text-[11px]">Financeiro</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                        despesa.situacao === "PAGA" ? "bg-emerald-100 text-emerald-700" : "bg-primary/20 text-primary animate-pulse"
                      }`}>
                        {despesa.situacao === "PAGA" ? "✓" : "●"}
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className={`font-semibold ${despesa.situacao === "PAGA" ? "text-foreground" : "text-primary"}`}>
                          Execução Bancária (CNAB 240 / Retorno)
                        </span>
                        <span className="text-muted-foreground text-[11px]">Central Bancária</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Fluxo A: Custos Extras
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
                        despesa.situacao === "PAGA"
                          ? "bg-emerald-100 text-emerald-700"
                          : despesa.situacao === "A_PAGAR"
                          ? "bg-primary/20 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {despesa.situacao === "PAGA" ? "✓" : "○"}
                      </div>
                      <div className="flex-1 flex justify-between">
                        <span className={`font-medium ${despesa.situacao === "PAGA" ? "text-emerald-700 font-semibold" : "text-muted-foreground"}`}>
                          Liquidação / Pagamento Efetivado
                        </span>
                        <span className="text-muted-foreground text-[11px]">Desembolso</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 4. HISTÓRICO & AUDITORIA */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Histórico & Auditoria
              </h4>
              <div className="rounded-lg border border-border/80 bg-card divide-y divide-border/60">
                {despesa.historico.map((ev) => (
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
                ))}
              </div>
            </div>
          </div>

          {/* ── FOOTER DO DRAWER COM CTAS ───────────────────────────────────────── */}
          <SheetFooter className="p-4 border-t border-border bg-card/60 flex flex-row items-center justify-end gap-2">
            {isMaoDeObra ? (
              // CTA para Mão de Obra: direcionamento para a Central Bancária
              <Button
                variant="default"
                className="gap-1.5 bg-primary text-primary-foreground font-semibold"
                onClick={() => {
                  onOpenChange(false);
                  navigate("/bancario");
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Abrir Central Bancária
              </Button>
            ) : isPagoEmpresa || despesa.situacao === "PAGA" ? (
              // Despesa já paga / liquidada: Leitura
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fechar
              </Button>
            ) : despesa.situacao === "AGUARDANDO_LIBERACAO" ? (
              // Custo Extra Aguardando Liberação: Devolver ou Liberar
              <>
                <Button
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => setModalDevolverOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Devolver p/ Operação
                </Button>
                <Button
                  variant="default"
                  className="bg-primary text-primary-foreground font-semibold"
                  onClick={() => setModalLiberarOpen(true)}
                >
                  <CheckCircle2 className="h-4 w-4 mr-1.5" />
                  Liberar para Pagamento
                </Button>
              </>
            ) : (
              // Custo Extra A_PAGAR: Confirmar Pagamento ou Devolver
              <>
                <Button
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                  onClick={() => setModalDevolverOpen(true)}
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Devolver
                </Button>
                <Button
                  variant="default"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                  onClick={() => setModalLiquidarOpen(true)}
                >
                  <DollarSign className="h-4 w-4 mr-1.5" />
                  Confirmar Pagamento
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── DIALOG 1: LIBERAR PARA PAGAMENTO ──────────────────────────────────── */}
      <Dialog open={modalLiberarOpen} onOpenChange={setModalLiberarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Liberar para Pagamento?</DialogTitle>
            <DialogDescription className="text-xs">
              Confirme a liberação financeira desta obrigação no valor de{" "}
              <strong className="text-foreground">{formatCurrency(despesa.valor)}</strong> para{" "}
              <strong className="text-foreground">{despesa.beneficiarioNome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" size="sm" onClick={() => setModalLiberarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-primary font-semibold"
              onClick={handleLiberarPagamento}
            >
              Confirmar Liberação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG 2: CONFIRMAR PAGAMENTO / LIQUIDAÇÃO ────────────────────────── */}
      <Dialog open={modalLiquidarOpen} onOpenChange={setModalLiquidarOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Liquidação de Pagamento?</DialogTitle>
            <DialogDescription className="text-xs">
              O valor de <strong className="text-foreground">{formatCurrency(despesa.valor)}</strong> será
              marcado como quitado para <strong className="text-foreground">{despesa.beneficiarioNome}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-muted/40 rounded-lg border border-border text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Origem:</span>
              <span className="font-medium text-foreground">{getTipoLabel(despesa.tipo)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Documento:</span>
              <span className="font-mono text-foreground">{despesa.codigo}</span>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" size="sm" onClick={() => setModalLiquidarOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="default"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleConfirmarPagamento}
            >
              Efetivar Baixa Financeira
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG 3: DEVOLVER PARA OPERAÇÃO ──────────────────────────────────── */}
      <Dialog open={modalDevolverOpen} onOpenChange={setModalDevolverOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Devolver Despesa para Correção?</DialogTitle>
            <DialogDescription className="text-xs">
              Informe a justificativa detalhada para devolver a despesa à equipe de campo/RH.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Justificativa da Devolução (Obrigatória):</Label>
            <Textarea
              placeholder="Ex: Comprovante ilegível, valor divergente da nota ou classificação incorreta..."
              value={motivoDevolucao}
              onChange={(e) => setMotivoDevolucao(e.target.value)}
              className="text-xs min-h-[80px]"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button variant="outline" size="sm" onClick={() => setModalDevolverOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="font-semibold"
              onClick={handleDevolver}
            >
              Devolver Obrigação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
