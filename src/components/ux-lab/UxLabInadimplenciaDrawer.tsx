import React, { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  Send,
  CalendarDays,
  ExternalLink,
  Layers,
  AlertTriangle,
  History,
  Info,
  CheckCircle2,
} from "lucide-react";
import {
  TituloInadimplenteMock,
  calcularDiasAtraso,
  getFaixaAging,
  getFaixaAgingBadgeClass,
  getFaixaAgingLabel,
  getStatusCobrancaBadgeClass,
  getStatusCobrancaLabel,
  getContextoCobrancaDescricao,
  getModalidadeLabel,
  DATA_REFERENCIA_UX14,
} from "@/pages/UxLab/inadimplenciaMockData";

interface UxLabInadimplenciaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: TituloInadimplenteMock | null;
  onRegistrarEnvio?: (tituloId: string, observacao?: string) => void;
  onAlterarVencimento?: (tituloId: string, novoVencimento: string, justificativa?: string) => void;
  onNavigateToReceitas?: (tituloId: string) => void;
  dataReferencia?: string;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
};

export function UxLabInadimplenciaDrawer({
  isOpen,
  onClose,
  titulo,
  onRegistrarEnvio,
  onAlterarVencimento,
  onNavigateToReceitas,
  dataReferencia = DATA_REFERENCIA_UX14,
}: UxLabInadimplenciaDrawerProps) {
  // Modais internos de confirmação
  const [isEnvioModalOpen, setIsEnvioModalOpen] = useState(false);
  const [envioObs, setEnvioObs] = useState("");

  const [isVencimentoModalOpen, setIsVencimentoModalOpen] = useState(false);
  const [novoVencimento, setNovoVencimento] = useState("");
  const [vencimentoJustificativa, setVencimentoJustificativa] = useState("");

  if (!titulo) return null;

  const dias = calcularDiasAtraso(titulo.vencimento, dataReferencia);
  const faixa = getFaixaAging(dias);
  const hasDocumentoGerado = titulo.status !== "pendente_cobranca";

  const handleSimulatePDF = () => {
    toast.success(
      hasDocumentoGerado
        ? `Reemissão da Fatura Comercial PDF #${titulo.id} simulada com sucesso.`
        : `Emissão da Fatura Comercial PDF #${titulo.id} simulada com sucesso.`,
      {
        description: "No ambiente de produção, o arquivo PDF é baixado com memória de cálculo detalhada.",
      }
    );
  };

  const handleConfirmEnvio = () => {
    if (onRegistrarEnvio) {
      onRegistrarEnvio(titulo.id, envioObs);
    }
    setIsEnvioModalOpen(false);
    setEnvioObs("");
    toast.success("Envio de cobrança registrado com sucesso!", {
      description: "Status atualizado para Cobrança Enviada. Registro inserido na trilha de auditoria.",
    });
  };

  const handleConfirmAlterarVencimento = () => {
    if (!novoVencimento) {
      toast.error("Informe a nova data de vencimento.");
      return;
    }

    if (onAlterarVencimento) {
      onAlterarVencimento(titulo.id, novoVencimento, vencimentoJustificativa);
    }
    setIsVencimentoModalOpen(false);
    setNovoVencimento("");
    setVencimentoJustificativa("");
  };

  const handleGoToReceitas = () => {
    if (onNavigateToReceitas) {
      onNavigateToReceitas(titulo.id);
    } else {
      toast.info("Direcionando para a Central de Receitas (UX11)...", {
        description: "O registro de liquidação e conciliação pertence ao fluxo financeiro da Central de Receitas.",
      });
    }
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[760px] p-0 flex flex-col bg-background border-l border-border h-full overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-border bg-card/50">
            <SheetHeader className="space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-primary">{titulo.id}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs px-2.5 py-0.5 font-medium ${getFaixaAgingBadgeClass(faixa)}`}
                  >
                    {dias} {dias === 1 ? "dia de atraso" : "dias de atraso"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0.5 font-normal text-muted-foreground"
                  >
                    {getFaixaAgingLabel(faixa)}
                  </Badge>
                </div>

                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-medium ${getStatusCobrancaBadgeClass(titulo.status)}`}
                >
                  {getStatusCobrancaLabel(titulo.status)}
                </Badge>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold text-foreground">
                    {titulo.clienteNome}
                  </SheetTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Modalidade: {getModalidadeLabel(titulo.modalidade)} · Competência: {titulo.competenciaFormatada}
                  </p>
                </div>
              </div>
            </SheetHeader>
          </div>

          {/* Corpo com Scroll */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Resumo Financeiro & Saldo em Aberto */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-card border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Valor Original
                </span>
                <p className="text-lg font-bold text-foreground mt-1">
                  {formatCurrency(titulo.valorTotal)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Saldo em Aberto
                </span>
                <p className="text-lg font-bold text-red-600 dark:text-red-400 mt-1">
                  {formatCurrency(titulo.valorTotal)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Vencimento
                </span>
                <p className="text-lg font-bold text-foreground mt-1">
                  {formatDate(titulo.vencimento)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-card border border-border">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Dias em Atraso
                </span>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                  {dias} dias
                </p>
              </div>
            </div>

            {/* Aviso de Inexistência de Amortização Parcial */}
            <div className="p-3 rounded-lg bg-muted/40 border border-border/80 flex items-start gap-2.5 text-xs text-muted-foreground">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                Este título não possui amortização parcial registrada. No domínio financeiro do ORBE, a liquidação de receitas é integral.
              </span>
            </div>

            {/* Seção: Situação da Cobrança */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                  <Send className="w-4 h-4 text-primary" />
                  Situação da Cobrança
                </h4>
                <Badge variant="outline" className={`text-[10px] ${getStatusCobrancaBadgeClass(titulo.status)}`}>
                  {getStatusCobrancaLabel(titulo.status)}
                </Badge>
              </div>

              <p className="text-xs text-muted-foreground">
                {getContextoCobrancaDescricao(titulo.status)}
              </p>

              <div className="p-3 rounded-lg bg-muted/30 border border-border text-[11px] text-muted-foreground flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span>
                  <strong>Nota de Governança:</strong> O registro de envio é declaratório. O ORBE não realiza disparos automatizados de e-mail ou WhatsApp.
                </span>
              </div>
            </div>

            {/* Seção: Ações Operacionais de Cobrança */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Ações de Cobrança
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* Ação 1: Fatura PDF */}
                <Button
                  variant="outline"
                  className="h-auto p-3.5 flex flex-col items-start text-left gap-1 border-border hover:border-primary/50"
                  onClick={handleSimulatePDF}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <FileText className="w-4 h-4 text-primary" />
                    {hasDocumentoGerado ? "Reemitir Fatura PDF" : "Gerar Fatura PDF"}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Emite documento de cobrança com memória de cálculo
                  </span>
                </Button>

                {/* Ação 2: Registrar Envio */}
                <Button
                  variant="outline"
                  className="h-auto p-3.5 flex flex-col items-start text-left gap-1 border-border hover:border-orange-500/50"
                  disabled={titulo.status === "cobranca_enviada"}
                  onClick={() => setIsEnvioModalOpen(true)}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <Send className="w-4 h-4 text-orange-600" />
                    Registrar Envio da Cobrança
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {titulo.status === "cobranca_enviada"
                      ? "Envio já registrado anteriormente"
                      : "Declara que a fatura foi encaminhada ao cliente"}
                  </span>
                </Button>

                {/* Ação 3: Alterar Vencimento */}
                <Button
                  variant="outline"
                  className="h-auto p-3.5 flex flex-col items-start text-left gap-1 border-border hover:border-blue-500/50"
                  onClick={() => {
                    setNovoVencimento(titulo.vencimento);
                    setIsVencimentoModalOpen(true);
                  }}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <CalendarDays className="w-4 h-4 text-blue-600" />
                    Alterar Vencimento
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Altera a data de vencimento do título
                  </span>
                </Button>

                {/* Ação 4: Central de Receitas */}
                <Button
                  variant="outline"
                  className="h-auto p-3.5 flex flex-col items-start text-left gap-1 border-border hover:border-emerald-500/50"
                  onClick={handleGoToReceitas}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-foreground">
                    <ExternalLink className="w-4 h-4 text-emerald-600" />
                    Abrir na Central de Receitas
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Liquidação, conciliação e governança de receitas
                  </span>
                </Button>
              </div>
            </div>

            {/* Seção: Lançamentos Vinculados */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Lançamentos Vinculados ({titulo.itens.length})
              </h4>

              <div className="space-y-2">
                {titulo.itens.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg bg-card border border-border flex items-center justify-between text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">{item.refOrigem}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {item.tipoOrigem}
                        </Badge>
                      </div>
                      <p className="text-foreground">{item.descricao}</p>
                      <span className="text-[10px] text-muted-foreground">Data: {formatDate(item.data)}</span>
                    </div>

                    <span className="font-bold text-foreground">{formatCurrency(item.valor)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Seção: Trilha de Histórico do Título */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Histórico do Título
              </h4>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                {titulo.historico.map((h, i) => (
                  <div key={i} className="flex items-start gap-3 text-xs border-b border-border/50 last:border-0 pb-2.5 last:pb-0">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-foreground font-semibold">{h.acao}</strong>
                        <span className="text-[10px] text-muted-foreground">{h.dataHora}</span>
                      </div>
                      <p className="text-muted-foreground text-[11px]">{h.detalhes || "Operação registrada no sistema."}</p>
                      <span className="text-[10px] text-muted-foreground block">Por: {h.usuario}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Modal: Registrar Envio da Cobrança */}
      <Dialog open={isEnvioModalOpen} onOpenChange={setIsEnvioModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Send className="w-5 h-5 text-orange-600" />
              Registrar Envio da Cobrança
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              Confirme apenas após a cobrança ter sido efetivamente enviada ao cliente por um canal externo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 text-xs text-orange-800 dark:text-orange-300">
              Título: <strong>{titulo.id}</strong> — Valor: <strong>{formatCurrency(titulo.valorTotal)}</strong>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Observação / Canal de Envio (Opcional)</Label>
              <Textarea
                placeholder="Ex: Fatura enviada por e-mail para o setor financeiro do cliente."
                value={envioObs}
                onChange={(e) => setEnvioObs(e.target.value)}
                className="text-xs resize-none h-20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsEnvioModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleConfirmEnvio}>
              Confirmar Registro de Envio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Alterar Vencimento */}
      <Dialog open={isVencimentoModalOpen} onOpenChange={setIsVencimentoModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-blue-600" />
              Alterar Vencimento do Título
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-2">
              A alteração modifica a data de vencimento do título. Não cria acordo, parcelamento, juros ou desconto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Vencimento Atual</span>
                <strong className="text-foreground text-sm">{formatDate(titulo.vencimento)}</strong>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Atraso Atual</span>
                <strong className="text-amber-600 text-sm">{dias} dias</strong>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold">Nova Data de Vencimento *</Label>
              <Input
                type="date"
                value={novoVencimento}
                onChange={(e) => setNovoVencimento(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Justificativa / Observação</Label>
              <Textarea
                placeholder="Ex: Alinhamento com o cliente para atualização da data de liquidação."
                value={vencimentoJustificativa}
                onChange={(e) => setVencimentoJustificativa(e.target.value)}
                className="text-xs resize-none h-20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setIsVencimentoModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleConfirmAlterarVencimento}>
              Salvar Novo Vencimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
