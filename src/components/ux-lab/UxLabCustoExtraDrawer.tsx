import React from "react";
import {
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Receipt,
  Calendar,
  Layers,
  ShieldCheck,
  ShieldAlert,
  Coins,
  ArrowRight,
  RotateCcw,
  User,
  CreditCard,
  Building,
  History,
  FileText
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
import { toast } from "sonner";
import { UxPipelineStepper } from "@/components/ux-lab/UxPipelineStepper";
import {
  CustoExtraMock,
  PipelineStatusCustoExtra,
  StatusPagamentoCustoExtra,
  OrigemRecursoCustoExtra,
  getFriendlyOrigemRecurso,
  getFriendlyPipelineStatus,
  getFriendlyStatusPagamento,
  getFriendlyCategoria,
  CUSTOS_EXTRAS_PIPELINE_STEPS,
} from "@/pages/UxLab/custosExtrasMockData";

interface UxLabCustoExtraDrawerProps {
  custo: CustoExtraMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UxLabCustoExtraDrawer({
  custo,
  open,
  onOpenChange
}: UxLabCustoExtraDrawerProps) {
  if (!custo) return null;

  const isAprovadoOuProtegido = [
    "APROVADO_OPERACAO",
    "ENVIADO_FINANCEIRO",
    "FINALIZADO"
  ].includes(custo.pipeline_status);

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val || 0);
  };

  // Formatação de Data
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Helper de Badge de Pipeline Status (Semântico e Monocromático institucional)
  const renderPipelineBadge = (status: PipelineStatusCustoExtra) => {
    switch (status) {
      case "RECEBIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Recebido
          </span>
        );
      case "EM_VALIDACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Em Validação
          </span>
        );
      case "REPROVADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Reprovado
          </span>
        );
      case "APROVADO_OPERACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Aprovado Operação
          </span>
        );
      case "ENVIADO_FINANCEIRO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
            <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Enviado ao Financeiro
          </span>
        );
      case "FINALIZADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Finalizado
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper de Badge de Status Pagamento (Semântico e Desacoplado)
  const renderPagamentoBadge = (pag: StatusPagamentoCustoExtra, origem?: OrigemRecursoCustoExtra) => {
    if (origem === "PAGO_EMPRESA") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Pago
        </span>
      );
    }
    switch (pag) {
      case "PAGO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Pago
          </span>
        );
      case "A_PAGAR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            A Pagar
          </span>
        );
      case "ATRASADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            Atrasado
          </span>
        );
      case "CANCELADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
            Cancelado
          </span>
        );
      default:
        return <Badge variant="outline">{pag}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        hideCloseButton={true}
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border"
      >
        {/* CABEÇALHO DO DRAWER */}
        <SheetHeader className="p-5 border-b border-border bg-card/60 sticky top-0 z-10 backdrop-blur-sm space-y-2">
          <SheetTitle className="sr-only">
            Detalhes do Custo Extra {custo.codigo}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Diagnóstico e informações detalhadas da despesa operacional
          </SheetDescription>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-royal-blue dark:text-royal-blue-light">
                {custo.codigo}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold text-muted-foreground border-border">
                {getFriendlyCategoria(custo.categoria_custo)}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pipeline:
                </span>
                {renderPipelineBadge(custo.pipeline_status)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pagamento:
                </span>
                {renderPagamentoBadge(custo.status_pagamento, custo.origem_recurso)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span className="font-medium text-foreground">{custo.empresa_nome}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>Data do custo: <strong className="text-foreground">{formatDate(custo.data)}</strong></span>
            </div>
            <span>•</span>
            <span>{custo.unidade_nome}</span>
          </div>
        </SheetHeader>

        {/* CORPO DO DRAWER */}
        <div className="p-5 space-y-6 flex-1 text-xs">
          {/* SEÇÃO 1: DIAGNÓSTICO DA DESPESA */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Diagnóstico da Despesa
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] bg-background">
                {getFriendlyPipelineStatus(custo.pipeline_status)}
              </Badge>
            </div>

            {/* SE REPROVADO: DESTAQUE CLARO DA JUSTIFICATIVA DE DEVOLUÇÃO */}
            {custo.pipeline_status === "REPROVADO" && (
              <div className="rounded-md border border-rose-200 dark:border-rose-900/60 bg-rose-50/80 dark:bg-rose-950/30 p-3 space-y-1.5 text-rose-800 dark:text-rose-300">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-rose-700 dark:text-rose-400">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Justificativa de Devolução / Bloqueio:</span>
                </div>
                <p className="text-xs leading-relaxed pl-5 font-normal">
                  {custo.justificativa_devolucao || "Despesa devolvida para saneamento de pendências documentais."}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Responsável Atual
                </span>
                <span className="font-medium text-foreground">
                  {custo.diagnostico.responsavelAtual}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Próximo Passo Recomendado
                </span>
                <span className="font-medium text-foreground">
                  {custo.diagnostico.proximoPasso}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span className="font-medium text-foreground">Orientação Operacional: </span>
              {custo.diagnostico.orientacaoOperacional}
            </div>
          </div>

          {/* SEÇÃO 2: ETAPAS DO PROCESSO (ESTEIRA HORIZONTAL DETALHADA) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <UxPipelineStepper
              steps={CUSTOS_EXTRAS_PIPELINE_STEPS}
              currentStepKey={custo.pipeline_status}
              exceptionState={
                custo.pipeline_status === "REPROVADO"
                  ? {
                      isException: true,
                      label: "Reprovado",
                      stepKey: "EM_VALIDACAO",
                      description: custo.justificativa_devolucao || undefined,
                    }
                  : null
              }
              variant="detailed"
            />
          </div>

          {/* SEÇÃO 3: ORIGEM DO RECURSO (DESTAQUE CRÍTICO) */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
                Origem do Recurso & Modelo Financeiro
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-semibold ${
                  custo.origem_recurso === "PAGO_EMPRESA"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                    : custo.origem_recurso === "REEMBOLSO_COLABORADOR"
                    ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                    : custo.origem_recurso === "PAGAMENTO_PENDENTE"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40"
                    : "border-border text-muted-foreground"
                }`}
              >
                {getFriendlyOrigemRecurso(custo.origem_recurso)}
              </Badge>
            </div>

            {/* CASO A: PAGO_EMPRESA */}
            {custo.origem_recurso === "PAGO_EMPRESA" && (
              <div className="space-y-2 rounded-md bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 p-3">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="font-semibold text-xs text-foreground">
                    Pago diretamente pela empresa
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O desembolso já ocorreu no ato através dos recursos da empresa (caixinha de filial ou cartão corporativo).
                  <strong className="block text-foreground mt-0.5">
                    Este lançamento não gera obrigação futura a pagar no financeiro.
                  </strong>
                </p>
                <div className="pt-1 text-[11px] text-muted-foreground">
                  Meio de pagamento utilizado: <strong className="text-foreground">{custo.forma_pagamento_nome}</strong>
                </div>
              </div>
            )}

            {/* CASO B: REEMBOLSO_COLABORADOR */}
            {custo.origem_recurso === "REEMBOLSO_COLABORADOR" && (
              <div className="space-y-2 rounded-md bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 p-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="font-semibold text-xs text-foreground">
                    Reembolso a colaborador
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O colaborador antecipou o valor com recursos próprios em caráter emergencial no pátio.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Colaborador Favorecido
                    </span>
                    <span className="font-bold text-foreground">
                      {custo.favorecido_colaborador_nome || "Colaborador não identificado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Forma de Reembolso
                    </span>
                    <span className="font-medium text-foreground">
                      {custo.forma_pagamento_nome}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CASO C: PAGAMENTO_PENDENTE */}
            {custo.origem_recurso === "PAGAMENTO_PENDENTE" && (
              <div className="space-y-2 rounded-md bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3">
                <div className="flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-semibold text-xs text-foreground">
                    Pagamento a fornecedor
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Despesa contratada a prazo, com emissão de boleto bancário ou fatura comercial do fornecedor.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Fornecedor Favorecido
                    </span>
                    <span className="font-bold text-foreground">
                      {custo.favorecido_fornecedor_nome || "Fornecedor não informado"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Data de Vencimento
                    </span>
                    <span className={`font-bold ${custo.status_pagamento === "ATRASADO" ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                      {formatDate(custo.data_vencimento)}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Condição / Forma de Pagamento
                    </span>
                    <span className="font-medium text-foreground">
                      {custo.forma_pagamento_nome}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CASO D: LEGACY */}
            {custo.origem_recurso === "LEGACY" && (
              <div className="space-y-2 rounded-md bg-zinc-50 dark:bg-zinc-800/40 border border-border p-3">
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold text-xs text-foreground">
                    Registro histórico
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Registro migrado da base operacional anterior para conferência histórica e conciliação contábil.
                </p>
              </div>
            )}
          </div>

          {/* SEÇÃO 3: DESPESA & CONTEXTO */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Despesa & Contexto
            </span>
            <div className="space-y-2">
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Descrição do Gasto
                </span>
                <p className="text-xs text-foreground font-medium leading-relaxed">
                  {custo.descricao}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground block">
                    Classificação / Categoria
                  </span>
                  <Badge variant="outline" className="text-[11px] mt-0.5 border-border text-foreground">
                    {getFriendlyCategoria(custo.categoria_custo)}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground block">
                    Encarregado / Responsável
                  </span>
                  <span className="text-xs text-foreground">
                    {custo.responsavel_nome}
                  </span>
                </div>
              </div>

              {custo.observacao && (
                <div className="pt-2">
                  <span className="text-[10px] font-semibold text-muted-foreground block">
                    Observações e Recibos
                  </span>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {custo.observacao}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SEÇÃO 4: COMPOSIÇÃO DO VALOR */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Composição do Valor
            </span>
            <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
              <span className="text-muted-foreground">Quantidade Adquirida:</span>
              <span className="font-mono font-semibold text-foreground">
                {custo.quantidade} un
              </span>
            </div>
            <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
              <span className="text-muted-foreground">Valor Unitário:</span>
              <span className="font-mono font-semibold text-foreground">
                {formatCurrency(custo.valor_unitario)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm pt-1">
              <span className="font-bold text-foreground">Valor Total do Custo:</span>
              <span className="font-mono font-bold text-royal-blue dark:text-royal-blue-light text-base">
                {formatCurrency(custo.total)}
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground text-right">
              {custo.quantidade} × {formatCurrency(custo.valor_unitario)} = {formatCurrency(custo.total)}
            </div>
          </div>

          {/* SEÇÃO 5: FLUXO FINANCEIRO */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Fluxo Financeiro & Obrigações
            </span>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Etapa no Pipeline
                </span>
                <span className="font-semibold text-foreground">
                  {getFriendlyPipelineStatus(custo.pipeline_status)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Situação Financeira
                </span>
                <span className="font-semibold text-foreground">
                  {getFriendlyStatusPagamento(custo.status_pagamento)}
                </span>
              </div>
            </div>

            {/* Detalhe da obrigação futura se for a pagar */}
            {custo.status_pagamento === "A_PAGAR" && custo.origem_recurso !== "PAGO_EMPRESA" && (
              <div className="rounded border border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-2.5 text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Obrigação Futura a Pagar:</span>
                  <strong className="text-foreground font-mono">{formatCurrency(custo.total)}</strong>
                </div>
                {custo.data_vencimento && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vencimento Programado:</span>
                    <strong className="text-foreground">{formatDate(custo.data_vencimento)}</strong>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Favorecido do Pagamento:</span>
                  <strong className="text-foreground">
                    {custo.favorecido_colaborador_nome || custo.favorecido_fornecedor_nome || "—"}
                  </strong>
                </div>
              </div>
            )}

            {custo.status_pagamento === "ATRASADO" && (
              <div className="rounded border border-rose-200 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 p-2.5 text-[11px] space-y-1 text-rose-800 dark:text-rose-300">
                <div className="flex justify-between font-bold">
                  <span>Obrigação Atrasada:</span>
                  <span className="font-mono">{formatCurrency(custo.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Vencimento Expirado em:</span>
                  <span>{formatDate(custo.data_vencimento)}</span>
                </div>
              </div>
            )}

            {custo.status_pagamento === "PAGO" && (
              <div className="rounded border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 text-[11px] space-y-1 text-emerald-800 dark:text-emerald-300">
                <div className="flex justify-between font-bold">
                  <span>Total Desembolsado / Liquidado:</span>
                  <span className="font-mono">{formatCurrency(custo.total)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Situação:</span>
                  <span>Pago e integrado na contabilidade</span>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 6: INTEGRIDADE (LINGUAGEM DE NEGÓCIO SEM INFRA TÉCNICA) */}
          {isAprovadoOuProtegido && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Valores protegidos após aprovação.
              </span>
            </div>
          )}
        </div>

        {/* RODAPÉ DO DRAWER: BOTÃO FECHAR + AÇÕES DE DESPACHO */}
        <SheetFooter className="p-4 border-t border-border bg-card/60 sticky bottom-0 z-10 backdrop-blur-sm flex flex-row items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs h-8 border-border"
          >
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            {custo.pipeline_status === "REPROVADO" && (
              <Button
                size="sm"
                className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1.5"
                onClick={() =>
                  toast.info("Resolver Pendência de Custo Extra", {
                    description: "O formulário de reapresentação estará integrado na próxima fase."
                  })
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resolver pendência
              </Button>
            )}

            {(custo.pipeline_status === "RECEBIDO" || custo.pipeline_status === "EM_VALIDACAO") && (
              <Button
                size="sm"
                className="text-xs h-8 bg-royal-blue hover:bg-royal-blue/90 text-white font-medium flex items-center gap-1.5"
                onClick={() =>
                  toast.info("Central de Aprovações RH / Operação", {
                    description: "Redirecionando para a fila de conferência e homologação de custos extras."
                  })
                }
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Ir para Aprovações
              </Button>
            )}

            {(custo.pipeline_status === "APROVADO_OPERACAO" || custo.pipeline_status === "ENVIADO_FINANCEIRO") && custo.status_pagamento !== "PAGO" && (
              <Button
                size="sm"
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5"
                onClick={() =>
                  toast.info("Central Financeira / Contas a Pagar", {
                    description: "Abrindo fila de liberação de pagamentos e reembolsos no Financeiro."
                  })
                }
              >
                <Receipt className="w-3.5 h-3.5" />
                Abrir no Financeiro
              </Button>
            )}

            {custo.status_pagamento === "PAGO" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5 border-border"
                onClick={() =>
                  toast.info("Consulta Financeira", {
                    description: "Exibindo registro conciliado de desembolso no extrato da competência."
                  })
                }
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                Consultar pagamento
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
