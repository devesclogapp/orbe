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
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CalendarDays,
  Clock,
  DollarSign,
  FileText,
  Send,
  ExternalLink,
  Layers,
  History,
  Info,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import {
  TituloInadimplenteUI,
  calcularDiasAtraso,
  getFaixaAging,
  getFaixaAgingBadgeClass,
  getFaixaAgingLabel,
  getStatusCobrancaBadgeClass,
  getStatusCobrancaLabel,
  getContextoCobrancaDescricao,
  getModalidadeLabel,
  formatCurrency,
  formatDate,
} from "@/services/inadimplenciaOficial.service";
import { ReceitasOficialService } from "@/services/receitasOficial.service";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { generateCobrancaPDF } from "@/utils/pdfCobranca";
import { useTenant } from "@/contexts/TenantContext";

interface InadimplenciaDrawerOficialProps {
  isOpen: boolean;
  onClose: () => void;
  titulo: TituloInadimplenteUI | null;
  onSuccess?: () => void;
}

export function InadimplenciaDrawerOficial({
  isOpen,
  onClose,
  titulo,
  onSuccess,
}: InadimplenciaDrawerOficialProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { tenantId, role } = useTenant();

  const isFinanceiroOrAdmin = role === "admin" || role === "financeiro";

  // Modais de Ação Controlada
  const [isEnvioModalOpen, setIsEnvioModalOpen] = useState(false);
  const [envioObs, setEnvioObs] = useState("");
  const [isEnviando, setIsEnviando] = useState(false);

  const [isVencimentoModalOpen, setIsVencimentoModalOpen] = useState(false);
  const [novoVencimento, setNovoVencimento] = useState("");
  const [vencimentoJustificativa, setVencimentoJustificativa] = useState("");
  const [isAlterandoVenc, setIsAlterandoVenc] = useState(false);

  // Carregamento detalhado sob demanda do histórico real da tabela receitas_operacionais_historico
  const { data: detalhesEHistorico, isLoading: isLoadingDetalhes } = useQuery({
    queryKey: ["inadimplencia-detalhes-historico", titulo?.id],
    queryFn: () => ReceitasOficialService.getReceitaDetalhesEHistorico(titulo!.id),
    enabled: isOpen && Boolean(titulo?.id),
    staleTime: 1000 * 30,
  });

  if (!titulo) return null;

  const dias = calcularDiasAtraso(titulo.vencimento);
  const faixa = getFaixaAging(dias);
  const hasDocumentoGerado = titulo.status !== "pendente_cobranca";
  const detalhesRaw = detalhesEHistorico?.detalhes || titulo.raw;
  const historicoReal = detalhesEHistorico?.historico || [];

  // AÇÃO 1: Gerar / Reemitir Fatura PDF Real com memória de cálculo
  const handleGerarPDF = () => {
    try {
      generateCobrancaPDF(
        titulo.raw || titulo,
        detalhesRaw,
        "Fatura Comercial (PDF)",
        titulo.vencimento
      );

      if (tenantId) {
        ReceitasOficialService.logEvent(
          tenantId,
          titulo.id,
          "GERAR_COBRANCA",
          `Fatura Comercial emitida para ${titulo.clienteNome}. Vencimento: ${formatDate(titulo.vencimento)}.`,
          { formato: "Fatura Comercial (PDF)", vencimento: titulo.vencimento }
        )
          .then(() => {
            queryClient.invalidateQueries({
              queryKey: ["inadimplencia-detalhes-historico", titulo.id],
            });
          })
          .catch((e) => console.warn("Falha ao registrar log de fatura:", e));
      }

      toast.success(
        hasDocumentoGerado
          ? `Reemissão da Fatura Comercial PDF #${titulo.id} concluída com sucesso.`
          : `Emissão da Fatura Comercial PDF #${titulo.id} concluída com sucesso.`
      );
    } catch (err: any) {
      toast.error("Erro ao gerar fatura PDF", {
        description: err.message || "Falha na emissão do documento.",
      });
    }
  };

  // AÇÃO 2: Registrar Envio da Cobrança via RPC oficial
  const handleConfirmEnvio = async () => {
    if (!tenantId) return;
    setIsEnviando(true);
    try {
      await ReceitasOficialService.registrarEnvioCobranca(tenantId, titulo.id);

      if (envioObs.trim()) {
        await ReceitasOficialService.logEvent(
          tenantId,
          titulo.id,
          "ENVIO_COBRANCA_DETALHE",
          `Canal/Observação declarada: ${envioObs.trim()}`,
          { observacao: envioObs.trim() }
        );
      }

      toast.success("Envio de cobrança registrado com sucesso!", {
        description: "Status atualizado para Cobrança Enviada. Registro inserido na trilha de auditoria.",
      });

      queryClient.invalidateQueries({ queryKey: ["inadimplencia_oficial"] });
      queryClient.invalidateQueries({ queryKey: ["inadimplencia-detalhes-historico", titulo.id] });
      setIsEnvioModalOpen(false);
      setEnvioObs("");
      onSuccess?.();
    } catch (err: any) {
      toast.error("Erro ao registrar envio da cobrança", {
        description: err.message || "Falha ao processar envio.",
      });
    } finally {
      setIsEnviando(false);
    }
  };

  // AÇÃO 3: Alterar Vencimento (Repactuação controlada de data)
  const handleConfirmAlterarVencimento = async () => {
    if (!tenantId) return;
    if (!novoVencimento) {
      toast.error("Informe a nova data de vencimento.");
      return;
    }

    setIsAlterandoVenc(true);
    try {
      await ReceitasService.updateReceita(tenantId, titulo.id, {
        vencimento: novoVencimento,
      });

      await ReceitasOficialService.logEvent(
        tenantId,
        titulo.id,
        "ALTERACAO_VENCIMENTO",
        `Vencimento alterado de ${formatDate(titulo.vencimento)} para ${formatDate(novoVencimento)}. Justificativa: ${vencimentoJustificativa.trim() || "Repactuação comercial"}`,
        {
          vencimento_anterior: titulo.vencimento,
          novo_vencimento: novoVencimento,
          justificativa: vencimentoJustificativa.trim(),
        }
      );

      const novosDias = calcularDiasAtraso(novoVencimento);
      if (novosDias <= 0) {
        toast.success("Vencimento alterado com sucesso!", {
          description: `O título agora vence em ${formatDate(novoVencimento)} e deixou de integrar a carteira inadimplente.`,
        });
        onClose();
      } else {
        toast.success("Vencimento atualizado com sucesso!", {
          description: `Novo atraso recalculado: ${novosDias} dias (${getFaixaAgingLabel(getFaixaAging(novosDias))}).`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["inadimplencia_oficial"] });
      queryClient.invalidateQueries({ queryKey: ["inadimplencia-detalhes-historico", titulo.id] });
      setIsVencimentoModalOpen(false);
      setNovoVencimento("");
      setVencimentoJustificativa("");
      onSuccess?.();
    } catch (err: any) {
      toast.error("Erro ao alterar data de vencimento", {
        description: err.message || "Falha na atualização do vencimento.",
      });
    } finally {
      setIsAlterandoVenc(false);
    }
  };

  // AÇÃO 4: Navegar para Central de Receitas com contexto do título
  const handleGoToReceitas = () => {
    onClose();
    navigate("/financeiro/receitas", {
      state: {
        highlightReceitaId: titulo.id,
      },
    });
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
                  onClick={handleGerarPDF}
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
                  disabled={titulo.status === "cobranca_enviada" || !isFinanceiroOrAdmin}
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
                  disabled={!isFinanceiroOrAdmin}
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
                {titulo.itens.length === 0 ? (
                  <div className="p-4 rounded-lg bg-card border border-border text-center text-xs text-muted-foreground">
                    Nenhum item individual discriminado.
                  </div>
                ) : (
                  titulo.itens.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-lg bg-card border border-border flex items-center justify-between text-xs hover:bg-muted/10 transition-colors"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{item.refOrigem}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            {item.tipoOrigem}
                          </Badge>
                        </div>
                        <p className="text-foreground truncate">{item.descricao}</p>
                        <span className="text-[10px] text-muted-foreground">
                          Data: {formatDate(item.data)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-bold text-foreground font-display">
                          {formatCurrency(item.valor)}
                        </span>
                        {item.operacao_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            title="Ver Operação por Volume"
                            onClick={() => {
                              onClose();
                              navigate("/operacoes-volume", {
                                state: { highlight: item.operacao_id },
                              });
                            }}
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                        {item.servico_extra_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-primary"
                            title="Ver Serviço Extra"
                            onClick={() => {
                              onClose();
                              navigate("/operacional/servicos-extras", {
                                state: { highlight: item.servico_extra_id },
                              });
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

            {/* Seção: Trilha de Histórico do Título */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Histórico do Título ({historicoReal.length} {historicoReal.length === 1 ? "evento" : "eventos"})
              </h4>

              <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3 text-xs">
                {isLoadingDetalhes ? (
                  <p className="text-muted-foreground text-center py-2">
                    Carregando histórico auditado...
                  </p>
                ) : historicoReal.length === 0 ? (
                  <p className="text-muted-foreground text-center py-2">
                    Nenhum evento registrado ainda.
                  </p>
                ) : (
                  historicoReal.map((h, i) => (
                    <div
                      key={h.id || i}
                      className="flex items-start gap-3 border-b border-border/50 last:border-0 pb-2.5 last:pb-0"
                    >
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-foreground font-semibold">{h.acao}</strong>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {h.dataHora}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-[11px]">
                          {h.detalhes || "Operação registrada no sistema."}
                        </p>
                        <span className="text-[10px] text-muted-foreground/80 block">
                          Por: {h.usuario}
                        </span>
                      </div>
                    </div>
                  ))
                )}
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
            <Button
              variant="outline"
              size="sm"
              disabled={isEnviando}
              onClick={() => setIsEnvioModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold"
              disabled={isEnviando}
              onClick={handleConfirmEnvio}
            >
              {isEnviando ? "Registrando..." : "Confirmar Registro de Envio"}
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
              A alteração modifica unicamente a data de vencimento da fatura no sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Vencimento Atual
                </span>
                <strong className="text-foreground text-sm">{formatDate(titulo.vencimento)}</strong>
              </div>

              <div className="p-3 rounded-lg bg-muted/40 border border-border">
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold">
                  Atraso Atual
                </span>
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
            <Button
              variant="outline"
              size="sm"
              disabled={isAlterandoVenc}
              onClick={() => setIsVencimentoModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={isAlterandoVenc}
              onClick={handleConfirmAlterarVencimento}
            >
              {isAlterandoVenc ? "Salvando..." : "Salvar Novo Vencimento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
