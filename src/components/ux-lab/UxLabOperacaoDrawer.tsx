import React from "react";
import {
  X,
  Clock,
  Users,
  Package,
  Truck,
  Building2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Trash2,
  Receipt,
  Info,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { OperacaoVolumeMock } from "@/pages/UxLab/operacoesVolumeMockData";

interface UxLabOperacaoDrawerProps {
  operacao: OperacaoVolumeMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UxLabOperacaoDrawer({
  operacao,
  open,
  onOpenChange
}: UxLabOperacaoDrawerProps) {
  if (!operacao) return null;

  const isFechadaOuFaturada = [
    "AGUARDANDO_FATURAMENTO",
    "FATURADO",
    "RECEBIDO_FINANCEIRO",
    "CONCLUIDO"
  ].includes(operacao.status);

  // Normalização semântica do campo de Nota Fiscal (auditado na Fase 01.1)
  const formatNotaFiscalLabel = (raw: string) => {
    const val = (raw || "").trim().toUpperCase();
    if (!val || val === "NAO" || val === "NÃO" || val === "0" || val === "FALSE") {
      return "Não Aplicável (Sem retenção ISS)";
    }
    if (val === "SIM" || val === "S" || val === "TRUE") {
      return "Emissão Solicitada (Aguardando número SEFAZ)";
    }
    return `NF ${raw}`;
  };

  // Helper de badge de status operacional (Royal Blue / Amber / Emerald / Rose)
  const renderStatusBadge = (status: OperacaoVolumeMock["status"]) => {
    switch (status) {
      case "RECEBIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            Recebido (Aberto)
          </span>
        );
      case "EM_VALIDACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Em Validação
          </span>
        );
      case "EM_RESTRICAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Em Restrição
          </span>
        );
      case "AGUARDANDO_FATURAMENTO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            Aguardando Faturamento
          </span>
        );
      case "FATURADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
            <Receipt className="w-3.5 h-3.5 text-purple-600" />
            Faturado
          </span>
        );
      case "RECEBIDO_FINANCEIRO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Recebido Financeiro
          </span>
        );
      case "CONCLUIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Concluído
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper de badge de status RH
  const renderStatusRhBadge = (statusRh: OperacaoVolumeMock["status_rh"]) => {
    switch (statusRh) {
      case "VALIDADO_RH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            RH: Validado
          </span>
        );
      case "DEVOLVIDO_RH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
            RH: Devolvido
          </span>
        );
      case "EM_ANALISE_RH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            RH: Em Análise
          </span>
        );
      case "PENDENTE_RH":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
            RH: Pendente
          </span>
        );
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton={true}
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl"
      >
        {/* CABEÇALHO DO DRAWER */}
        <SheetHeader className="p-5 border-b border-border bg-card/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-bold text-foreground">
                {operacao.codigo}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(operacao.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
              <Badge variant="outline" className="text-[10px] tracking-wide uppercase font-semibold">
                Simulação UX Lab
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {renderStatusBadge(operacao.status)}
              {renderStatusRhBadge(operacao.status_rh)}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <SheetTitle className="text-lg font-semibold text-foreground tracking-tight">
              {operacao.tipo_servico_nome}
            </SheetTitle>
            <span className="text-xs text-muted-foreground">
              por {operacao.responsavel_nome}
            </span>
          </div>

          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              {operacao.empresa_nome}
            </span>
            <span>•</span>
            <span>{operacao.unidade_nome}</span>
          </SheetDescription>
        </SheetHeader>

        {/* CORPO ROLÁVEL DO DRAWER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar-operacoes">
          {/* BANNER DE RESTRIÇÃO / INCONSISTÊNCIA (Se houver) */}
          {operacao.status === "EM_RESTRICAO" && (
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">
                    Operação em Restrição
                  </h4>
                  <p className="text-sm font-medium text-rose-800 dark:text-rose-300 leading-snug">
                    {operacao.motivo_restricao || "Apontamento irregular detectado pelo motor operacional."}
                  </p>
                  {operacao.motivo_devolucao_rh && (
                    <p className="text-xs text-rose-700 dark:text-rose-400 bg-white/60 dark:bg-black/30 p-2 rounded border border-rose-200/50 dark:border-rose-900/30 mt-2">
                      <span className="font-semibold">Devolução pelo RH:</span> {operacao.motivo_devolucao_rh}
                    </p>
                  )}
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                    Responsável atual: <span className="font-semibold">{operacao.responsavel_pendencia || "Operação / Campo"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                  onClick={() => toast.info("Despacho operacional: encaminhando para tela especialista de apontamentos (Simulação UX Lab)")}
                >
                  Resolver inconsistência
                </Button>
              </div>
            </div>
          )}

          {/* BANNER DE ASSIMETRIA RH × FINANCEIRO (Se aplicável) */}
          {operacao.status_pagamento === "RECEBIDO" && operacao.status_rh !== "VALIDADO_RH" && (
            <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                <span className="font-semibold">Atenção ao encerramento:</span> O recebimento financeiro já foi confirmado ({operacao.data_pagamento || "recente"}), porém o status geral permanece retido até que a equipe seja validada pelo RH.
              </p>
            </div>
          )}

          {/* 1. CONTEXTO OPERACIONAL */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
              Contexto da Carga & Transporte
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-card p-3.5 rounded-lg border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Fornecedor / Cliente</span>
                <span className="font-semibold text-foreground text-sm">{operacao.fornecedor_nome}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Transportadora</span>
                <span className="font-semibold text-foreground">{operacao.transportadora_nome}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Placa do Veículo</span>
                <span className="font-mono font-bold text-foreground text-sm">{operacao.placa}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Produto da Carga</span>
                <span className="text-foreground">{operacao.produto_carga_nome || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Volume Movimentado</span>
                <span className="font-bold text-foreground text-sm">
                  {operacao.quantidade.toLocaleString("pt-BR")} {operacao.unidade_medida}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Documento Fiscal</span>
                <span className="text-foreground font-medium">
                  {formatNotaFiscalLabel(operacao.nf_numero_raw)}
                </span>
              </div>
              {operacao.ctrc && (
                <div>
                  <span className="text-muted-foreground block text-[11px]">CTRC</span>
                  <span className="font-mono text-foreground">{operacao.ctrc}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground block text-[11px]">Início na Doca</span>
                <span className="font-mono font-medium text-foreground">{operacao.entrada_ponto || "Não informado"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Término na Doca</span>
                <span className="font-mono font-medium text-foreground">{operacao.saida_ponto || "Não informado"}</span>
              </div>
            </div>
          </div>

          {/* 2. EQUIPE OPERACIONAL (Headcount vs Vinculados) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
                Equipe Alocada
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Headcount Declarado:</span>
                <span className="font-bold text-foreground px-2 py-0.5 bg-muted rounded border border-border">
                  {operacao.quantidade_colaboradores} pessoas
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">Nominais:</span>
                <span className="font-bold text-foreground">
                  {operacao.colaboradores_vinculados.length}
                </span>
              </div>
            </div>

            {/* Aviso neutro se divergente */}
            {operacao.quantidade_colaboradores !== operacao.colaboradores_vinculados.length && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border border-border/60">
                <Info className="w-3 h-3 inline-block mr-1 text-muted-foreground" />
                Divergência entre headcount total declarado ({operacao.quantidade_colaboradores}) e colaboradores vinculados nominalmente ({operacao.colaboradores_vinculados.length}). Comum quando há contratação de terceiros/chapas avulsos sem cadastro prévio.
              </p>
            )}

            <div className="bg-card rounded-lg border border-border divide-y divide-border overflow-hidden">
              {operacao.colaboradores_vinculados.length > 0 ? (
                operacao.colaboradores_vinculados.map((colab) => (
                  <div key={colab.id} className="p-3 flex items-center justify-between text-xs hover:bg-muted/30">
                    <div className="space-y-0.5">
                      <div className="font-medium text-foreground flex items-center gap-2">
                        {colab.nome}
                        {colab.had_infraction && (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                            Infração
                          </Badge>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{colab.cargo}</span>
                        <span>•</span>
                        <span className="font-mono text-muted-foreground">{colab.cpf}</span>
                      </div>
                    </div>
                    <div className="text-right font-mono text-[11px] text-muted-foreground">
                      {colab.entrada_ponto && colab.saida_ponto ? (
                        <span>{colab.entrada_ponto} às {colab.saida_ponto}</span>
                      ) : (
                        <span className="text-rose-600 font-medium">Horário incompleto</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-muted-foreground italic">
                  Nenhum colaborador individual vinculado nominalmente (Qtd declarada: {operacao.quantidade_colaboradores}).
                </div>
              )}
            </div>
          </div>

          {/* 3. COMPOSIÇÃO DE VALORES & REGRA COMERCIAL */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
              Composição do Valor da Operação
            </h4>
            <div className="bg-card p-4 rounded-lg border border-border space-y-3 text-xs">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Regra Comercial:</span>
                <span className="font-medium text-foreground">{operacao.regra_comercial_aplicada || "Regra Geral de Contrato"}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Valor Unitário Aplicado:</span>
                <span className="font-mono font-medium text-foreground">
                  R$ {operacao.valor_unitario_snapshot.toFixed(2)} / {operacao.unidade_medida}
                </span>
              </div>
              <Separator />

              {/* Subtotais */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground">
                  <span>Descarga ({operacao.quantidade} × R$ {operacao.valor_unitario_snapshot.toFixed(2)})</span>
                  <span className="font-mono font-medium">R$ {operacao.valor_descarga.toFixed(2)}</span>
                </div>

                {operacao.valor_total_materiais > 0 && (
                  <div className="flex justify-between text-foreground">
                    <span className="flex items-center gap-1">
                      Materiais / Insumos
                      <span className="text-[10px] text-muted-foreground">
                        ({operacao.materiais.map(m => `${m.quantidade} ${m.unidade_snapshot} de ${m.nome_snapshot}`).join(", ")})
                      </span>
                    </span>
                    <span className="font-mono font-medium">R$ {operacao.valor_total_materiais.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-foreground">
                  <span>ISS ({operacao.percentual_iss > 0 ? `${(operacao.percentual_iss * 100).toFixed(0)}%` : "0%"})</span>
                  <span className="font-mono font-medium">R$ {operacao.custo_com_iss.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-baseline pt-1">
                <span className="font-bold text-sm text-foreground">Valor Total da Operação</span>
                <span className="font-mono font-bold text-base text-foreground">
                  R$ {operacao.valor_total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* 4. MODALIDADE FINANCEIRA & STATUS DE COBRANÇA */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
              Pipeline Financeiro & Cobrança
            </h4>
            <div className="bg-card p-3.5 rounded-lg border border-border space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Modalidade:</span>
                <Badge variant="outline" className="font-semibold text-xs">
                  {operacao.forma_pagamento_nome}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Relação Financeira:</span>
                <span className="text-foreground font-medium">
                  {operacao.modalidade === "FATURAMENTO_MENSAL"
                    ? "Agregação Mensal (N operações : 1 fatura)"
                    : "Individual (1 operação : 1 título)"}
                </span>
              </div>

              {operacao.fatura_referencia && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Referência da Fatura:</span>
                  <span className="font-mono font-semibold text-foreground text-xs">
                    {operacao.fatura_referencia}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-muted-foreground">Status da Cobrança:</span>
                <span className="font-semibold text-foreground">
                  {operacao.status_pagamento === "RECEBIDO" ? (
                    <span className="text-emerald-600 dark:text-emerald-400">Liquidado / Recebido</span>
                  ) : isFechadaOuFaturada ? (
                    <span className="text-indigo-600 dark:text-indigo-400">Em Cobrança / Aguardando</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">Aguardando Validação Operacional</span>
                  )}
                </span>
              </div>

              {/* CTA para Financeiro */}
              <div className="pt-2 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-royal-blue dark:text-royal-blue-light hover:underline p-0 flex items-center gap-1"
                  onClick={() => toast.info("Despacho contextual para a Central Financeira (Simulação UX Lab)")}
                >
                  Ver Fatura no Financeiro
                  <ArrowRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO DRAWER COM AÇÕES REAIS */}
        <SheetFooter className="p-4 border-t border-border bg-card/80 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            {!isFechadaOuFaturada ? (
              <Button
                variant="outline"
                size="sm"
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-border"
                onClick={() => toast.success("Operação excluída com sucesso (Simulação UX Lab)")}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Excluir
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant={isFechadaOuFaturada ? "outline" : "default"}
                      size="sm"
                      disabled={isFechadaOuFaturada}
                      className={!isFechadaOuFaturada ? "bg-royal-blue hover:bg-royal-blue/90 text-white" : ""}
                      onClick={() => toast.info("Edição da operação aberta (Simulação UX Lab)")}
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      Editar Operação
                    </Button>
                  </span>
                </TooltipTrigger>
                {isFechadaOuFaturada && (
                  <TooltipContent>
                    <p className="text-xs">
                      Operação faturada/recebida não aceita edições abertas (Regra ESTADO_FECHADO).
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>

            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
