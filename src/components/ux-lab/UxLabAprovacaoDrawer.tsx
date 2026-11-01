import React, { useState } from "react";
import {
  X,
  Clock,
  Users,
  Wrench,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Coins,
  Package,
  FileSpreadsheet,
  RotateCcw,
  Wallet,
  ExternalLink,
  Ban,
  Check,
  Sparkles
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ItemAprovacaoMock, DominioAprovacao, SituacaoDecisao } from "@/pages/UxLab/aprovacoesMockData";
import { useNavigate } from "react-router-dom";

interface UxLabAprovacaoDrawerProps {
  item: ItemAprovacaoMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAprovar: (id: string) => void;
  onDevolver: (id: string, motivo: string) => void;
}

export function UxLabAprovacaoDrawer({
  item,
  open,
  onOpenChange,
  onAprovar,
  onDevolver,
}: UxLabAprovacaoDrawerProps) {
  const navigate = useNavigate();
  const [modalDevolucaoOpen, setModalDevolucaoOpen] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");

  if (!item) return null;

  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "—";
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return isoStr;
    }
  };

  const getDominioBadge = (dom: DominioAprovacao) => {
    switch (dom) {
      case "OPERACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            <Package className="w-3.5 h-3.5 text-muted-foreground" />
            Operação por Volume
          </span>
        );
      case "SERVICO_EXTRA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            <Wrench className="w-3.5 h-3.5 text-muted-foreground" />
            Serviço Extra
          </span>
        );
      case "CUSTO_EXTRA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
            Custo Extra
          </span>
        );
      case "DIARISTA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            Lote Diaristas
          </span>
        );
      case "INTERMITENTE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-muted text-foreground border border-border">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            Lote Intermitentes
          </span>
        );
    }
  };

  const getSituacaoBadge = (sit: SituacaoDecisao) => {
    switch (sit) {
      case "PENDENTE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <Clock className="w-3.5 h-3.5" />
            Aguardando Decisão
          </span>
        );
      case "REQUER_ATENCAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            Requer Atenção
          </span>
        );
      case "DEVOLVIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <RotateCcw className="w-3.5 h-3.5" />
            Devolvido
          </span>
        );
      case "BLOQUEADO_INCONSISTENCIA":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800 font-bold">
            <Ban className="w-3.5 h-3.5" />
            Bloqueado (Inconsistência)
          </span>
        );
      case "APROVADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Aprovado
          </span>
        );
    }
  };

  const handleConfirmarDevolucao = () => {
    if (!motivoDevolucao.trim()) {
      toast.error("A justificativa de devolução é obrigatória.");
      return;
    }
    onDevolver(item.id, motivoDevolucao);
    setModalDevolucaoOpen(false);
    setMotivoDevolucao("");
    onOpenChange(false);
  };

  const handleAprovarClick = () => {
    if (item.isFailClosed) {
      toast.error("Esta decisão está bloqueada por pendências cadastrais/operacionais.", {
        description: item.motivoBloqueio || "Corrija os dados impeditivos antes de autorizar.",
      });
      return;
    }
    onAprovar(item.id);
    onOpenChange(false);
  };

  const handleAbrirModuloEspecialista = () => {
    onOpenChange(false);
    navigate(item.rotaEspecialista);
    toast.info(`Navegando para o módulo especialista: ${item.rotaEspecialista}`);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-card border-l border-border text-foreground transition-colors duration-200">
          {/* Header do Drawer */}
          <div className="sticky top-0 z-20 bg-card/95 backdrop-blur border-b border-border p-5 pb-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {getDominioBadge(item.dominio)}
                <span className="font-mono text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded">
                  {item.codigo}
                </span>
                {getSituacaoBadge(item.situacao)}
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
                {item.titulo}
              </h2>
              <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                  {item.empresaNome}
                </span>
                {item.unidadeNome && (
                  <>
                    <span>•</span>
                    <span>{item.unidadeNome}</span>
                  </>
                )}
                <span>•</span>
                <span>{item.origem}</span>
              </div>
            </div>
          </div>

          {/* Conteúdo Rolável */}
          <div className="flex-1 p-5 space-y-6">
            {/* Bloco de Alerta Fail-Closed se houver inconsistência impeditiva */}
            {item.isFailClosed && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-sm">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  Decisão Bloqueada por Inconsistência (Fail-Closed)
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-300/90 leading-relaxed">
                  {item.motivoBloqueio || "Existem pendências factuais que impedem a aprovação direta desta decisão."}
                </p>
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAbrirModuloEspecialista}
                    className="h-8 text-xs font-bold border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                  >
                    Resolver no Módulo Especialista
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* A. "O que estou aprovando?" */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                O que está sendo autorizado?
              </h3>
              <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm text-foreground leading-relaxed font-medium">
                  {item.descricaoResumida}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 border-t border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Valor / Impacto:</span>
                    <span className="font-bold text-sm text-foreground font-mono">
                      {item.valorFormatado || formatCurrency(item.valorMonetario)}
                    </span>
                  </div>
                  {item.grandezaFisica && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Grandeza Física:</span>
                      <span className="font-semibold text-foreground">
                        {item.grandezaFisica}
                      </span>
                    </div>
                  )}
                  {item.origemRecurso && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Origem Recurso:</span>
                      <Badge variant="outline" className="text-[10px] font-semibold mt-0.5">
                        {item.origemRecurso}
                      </Badge>
                    </div>
                  )}
                  {item.modalidadeFinanceira && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Modalidade:</span>
                      <Badge variant="outline" className="text-[10px] font-semibold mt-0.5">
                        {item.modalidadeFinanceira}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* B. Checklist de Integridade / Regras Suportadas */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Validação de Integridade & Regras de Negócio
              </h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {item.checklist.map((chk, idx) => (
                    <div key={idx} className="flex items-start justify-between p-3 text-xs gap-3 bg-card hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-2 min-w-0">
                        {chk.valido ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className={chk.valido ? "font-medium text-foreground" : "font-bold text-rose-700 dark:text-rose-400"}>
                            {chk.item}
                          </span>
                          {chk.detalhe && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{chk.detalhe}</p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          chk.valido
                            ? "border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400 text-[10px]"
                            : "border-rose-300 text-rose-700 dark:border-rose-800 dark:text-rose-400 text-[10px] font-bold"
                        }
                      >
                        {chk.valido ? "Conforme" : "Irregular"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* C. Composição Específica do Domínio */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Composição do Item / Lote ({item.composicao.length})
                </span>
                {item.dominio === "DIARISTA" && (
                  <span className="text-[10px] text-muted-foreground font-normal">Unidade: Lote Semanal</span>
                )}
                {item.dominio === "INTERMITENTE" && (
                  <span className="text-[10px] text-muted-foreground font-normal">Unidade: Lote de Convocação</span>
                )}
              </h3>

              <div className="rounded-xl border border-border overflow-hidden bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="text-left px-3.5 py-2 font-medium">Colaborador / Evento</th>
                      <th className="text-left px-3 py-2 font-medium">Função / Categoria</th>
                      <th className="text-center px-3 py-2 font-medium">Qtd / Horas</th>
                      <th className="text-right px-3.5 py-2 font-medium">Valor (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {item.composicao.map((comp) => (
                      <tr key={comp.id} className="hover:bg-muted/20">
                        <td className="px-3.5 py-2.5 font-medium text-foreground">
                          {comp.nome}
                          {comp.detalhe && (
                            <span className="block text-[10px] text-muted-foreground font-normal">
                              {comp.detalhe}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-muted-foreground">
                          {comp.cargoOuFuncao || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-center text-foreground font-medium">
                          {comp.horasOuDias || (comp.quantidade ? `${comp.quantidade} un` : "—")}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                          {formatCurrency(comp.valor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/40 border-t border-border font-bold">
                    <tr>
                      <td colSpan={3} className="px-3.5 py-2 text-right text-xs text-muted-foreground">
                        Total Consolidado da Decisão:
                      </td>
                      <td className="px-3.5 py-2 text-right font-mono text-sm text-foreground">
                        {item.valorFormatado || formatCurrency(item.valorMonetario)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* D. Histórico e Rastreabilidade */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Histórico de Eventos & Auditoria
              </h3>
              <div className="rounded-xl border border-border bg-card p-3.5 space-y-3">
                <div className="space-y-3 text-xs">
                  {item.historico.map((h) => (
                    <div key={h.id} className="flex items-start gap-2.5 relative pl-4 border-l-2 border-blue-500/50">
                      <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                          <span className="font-bold text-foreground">
                            {h.acao} · <span className="font-normal text-muted-foreground">{h.usuario} ({h.papel})</span>
                          </span>
                          <span className="text-muted-foreground text-[10px] font-mono">
                            {formatDate(h.data)}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">{h.descricao}</p>
                        {h.motivo && (
                          <div className="mt-1.5 p-2 rounded-lg bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300 font-medium">
                            <span className="font-bold">Motivo:</span> {h.motivo}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Fixo de Despacho */}
          <div className="sticky bottom-0 z-20 bg-card border-t border-border p-4 px-5 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbrirModuloEspecialista}
              className="w-full sm:w-auto text-xs font-medium text-muted-foreground hover:text-foreground border-border"
            >
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
              {item.isFailClosed ? "Resolver no Módulo Especialista" : "Ver no Módulo Especialista"}
            </Button>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {item.situacao !== "DEVOLVIDO" && !item.isFailClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setModalDevolucaoOpen(true)}
                  className="flex-1 sm:flex-none text-xs font-bold border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Devolver
                </Button>
              )}

              {item.situacao === "DEVOLVIDO" ? (
                <div className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5 py-1 px-2.5 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                  <RotateCcw className="w-3.5 h-3.5" />
                  Registro em Correção na Origem
                </div>
              ) : item.isFailClosed ? (
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
                  className="flex-1 sm:flex-none text-xs font-bold bg-[#2563EB] hover:bg-[#2563EB]/90 text-white shadow-sm dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  {item.dominio === "DIARISTA"
                    ? `Aprovar Lote (${item.valorFormatado || "R$ 0,00"})`
                    : item.dominio === "INTERMITENTE"
                    ? `Aprovar Lote (${item.valorFormatado || "R$ 0,00"})`
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
              Informe o motivo detalhado para que o responsável na base operacional realize as correções necessárias.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="p-2.5 rounded-lg bg-muted/40 border border-border text-xs">
              <span className="font-bold text-foreground">{item.codigo}</span> · {item.titulo}
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
              disabled={!motivoDevolucao.trim()}
              className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirmar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
