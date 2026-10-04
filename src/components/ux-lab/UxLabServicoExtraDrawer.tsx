import React from "react";
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
  RotateCcw
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
import {
  ServicoExtraMock,
  PipelineStatusServicoExtra,
  ModalidadeFinanceiraServicoExtra
} from "@/pages/UxLab/servicosExtrasMockData";

interface UxLabServicoExtraDrawerProps {
  servico: ServicoExtraMock | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UxLabServicoExtraDrawer({
  servico,
  open,
  onOpenChange
}: UxLabServicoExtraDrawerProps) {
  if (!servico) return null;

  const isFechadoOuImutavel = [
    "APROVADO_FINANCEIRO",
    "FATURADO",
    "CONCLUIDO"
  ].includes(servico.pipeline_status);

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(val || 0);
  };

  // Formatação de Data
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Helper de Badge de Pipeline Status (Semântico e Monocromático institucional)
  const renderPipelineBadge = (status: PipelineStatusServicoExtra) => {
    switch (status) {
      case "PENDENTE":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendente
          </span>
        );
      case "EM_VALIDACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Em Validação
          </span>
        );
      case "DEVOLVIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Devolvido
          </span>
        );
      case "APROVADO_OPERACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            Aprovado Operação
          </span>
        );
      case "APROVADO_FINANCEIRO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
            <Receipt className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            Aprovado Financeiro
          </span>
        );
      case "FATURADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-900/40">
            <FileSpreadsheet className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            Faturado
          </span>
        );
      case "CONCLUIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Concluído
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Helper de Modalidade Financeira
  const renderModalidadeBadge = (mod: ModalidadeFinanceiraServicoExtra) => {
    switch (mod) {
      case "CAIXA_IMEDIATO":
        return (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-[11px] font-semibold">
            Caixa Imediato (Spot)
          </Badge>
        );
      case "DUPLICATA":
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-[11px] font-semibold">
            Duplicata a Prazo
          </Badge>
        );
      case "FATURAMENTO_MENSAL":
        return (
          <Badge variant="outline" className="border-purple-300 bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-[11px] font-semibold">
            Faturamento Mensal
          </Badge>
        );
      default:
        return <Badge variant="outline">{mod}</Badge>;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto p-0 flex flex-col bg-background border-l border-border"
      >
        {/* CABEÇALHO DO DRAWER */}
        <SheetHeader className="p-5 border-b border-border bg-card/60 sticky top-0 z-10 backdrop-blur-sm space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-royal-blue dark:text-royal-blue-light">
                {servico.codigo}
              </span>
              <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                Serviço Extra
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pipeline:
                </span>
                {renderPipelineBadge(servico.pipeline_status)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pagamento:
                </span>
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    servico.status_pagamento === "RECEBIDO"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40"
                      : servico.status_pagamento === "ATRASADO"
                      ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {servico.status_pagamento === "RECEBIDO"
                    ? "Recebido"
                    : servico.status_pagamento === "ATRASADO"
                    ? "Atrasado"
                    : "Pendente"}
                </span>
              </div>
            </div>
          </div>

          <div>
            <SheetTitle className="text-base font-bold text-foreground">
              {servico.tipo_servico_nome}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>{servico.empresa_nome}</span>
              <span>•</span>
              <span>{servico.unidade_nome}</span>
              <span>•</span>
              <span className="font-mono font-medium text-foreground">{formatDate(servico.data)}</span>
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* CORPO DO DRAWER */}
        <div className="p-5 space-y-6 flex-1 text-xs">
          {/* 1. DIAGNÓSTICO OPERACIONAL (DIAGNOSTICAR → DESPACHAR) */}
          <section
            className={`p-3.5 rounded-lg border space-y-2 ${
              servico.diagnostico.categoria === "bloqueio"
                ? "bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/40"
                : servico.diagnostico.categoria === "atencao"
                ? "bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40"
                : servico.diagnostico.categoria === "concluido"
                ? "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40"
                : "bg-muted/40 border-border"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold uppercase tracking-wider text-[10px] text-muted-foreground flex items-center gap-1.5">
                {servico.diagnostico.categoria === "bloqueio" ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                ) : servico.diagnostico.categoria === "atencao" ? (
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                )}
                Diagnóstico da Esteira
              </span>
              <span className="text-[11px] font-medium text-foreground">
                Responsável: <strong className="font-semibold">{servico.diagnostico.responsavelAtual}</strong>
              </span>
            </div>

            {servico.justificativa_devolucao && (
              <div className="p-2.5 rounded bg-background/80 border border-rose-200 dark:border-rose-900/50 space-y-1">
                <span className="font-semibold text-rose-700 dark:text-rose-400 text-[11px] block">
                  Motivo da Devolução / Ajuste Solicitado:
                </span>
                <p className="text-[11px] text-foreground leading-relaxed italic">
                  "{servico.justificativa_devolucao}"
                </p>
              </div>
            )}

            <div className="space-y-1 pt-0.5">
              <div className="flex items-center gap-1.5 text-foreground font-medium text-[11px]">
                <ArrowRight className="w-3 h-3 text-royal-blue shrink-0" />
                <span>Próximo passo: {servico.diagnostico.proximoPasso}</span>
              </div>
              <p className="text-[11px] text-muted-foreground pl-4.5">
                {servico.diagnostico.orientacaoOperacional}
              </p>
            </div>
          </section>

          {/* 2. CONTEXTO & ESCOPO DO SERVIÇO */}
          <section className="space-y-3">
            <h4 className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-royal-blue" />
              Escopo & Identificação
            </h4>
            <div className="bg-card rounded-lg border border-border p-3.5 space-y-3">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Tomador do Serviço (Cliente / Transportadora)
                </span>
                <span className="text-xs font-semibold text-foreground">
                  {servico.tomador_nome}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Descrição Operacional do Trabalho
                </span>
                <p className="text-xs text-foreground leading-relaxed mt-0.5">
                  {servico.descricao_servico}
                </p>
              </div>
              {servico.observacao && (
                <div className="pt-2 border-t border-border">
                  <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                    Observação de Campo
                  </span>
                  <p className="text-xs text-muted-foreground italic mt-0.5">
                    "{servico.observacao}"
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* 3. EXECUÇÃO & HEADCOUNT (REGRA OBRIGATÓRIA: SEM NOMES/CPFS FICTÍCIOS) */}
          <section className="space-y-3">
            <h4 className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-royal-blue" />
              Execução & Equipe
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card p-3 rounded-lg border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Quantidade Realizada
                </span>
                <div className="text-sm font-bold text-foreground font-mono">
                  {servico.quantidade} {servico.unidade_cobranca_snapshot}
                </div>
              </div>

              {/* Headcount estritamente numérico conforme contrato auditado */}
              <div className="bg-card p-3 rounded-lg border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Headcount Alocado
                </span>
                <div className="text-sm font-bold text-royal-blue font-mono flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  {servico.quantidade_colaboradores} pessoas
                </div>
                <span className="text-[9px] text-muted-foreground block">
                  (Dimensionamento auditado)
                </span>
              </div>

              <div className="bg-card p-3 rounded-lg border border-border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Período Operacional
                </span>
                <div className="text-sm font-semibold text-foreground font-mono">
                  {servico.regra_periodo_codigo}
                </div>
                <span className="text-[9px] text-muted-foreground block">
                  Peso: {servico.multiplicador_periodo.toFixed(2)}x
                </span>
              </div>
            </div>
          </section>

          {/* 4. COMPOSIÇÃO EXPLICATIVA DO VALOR */}
          <section className="space-y-3">
            <h4 className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-royal-blue" />
              Composição do Valor
            </h4>
            <div className="bg-card rounded-lg border border-border p-3.5 space-y-3">
              {/* Fórmula Base */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Base: {servico.quantidade} {servico.unidade_cobranca_snapshot} × {formatCurrency(servico.valor_unitario_base)}
                    {servico.multiplicador_periodo > 1 && ` × ${servico.multiplicador_periodo.toFixed(2)} (${servico.regra_periodo_codigo})`}
                  </span>
                  <span className="font-mono font-medium text-foreground">
                    {formatCurrency(servico.quantidade * servico.valor_unitario_efetivo)}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground italic">
                  Valor unitário aplicado: {formatCurrency(servico.valor_unitario_snapshot)}/{servico.unidade_cobranca_snapshot}
                </div>
              </div>

              {/* Materiais Extras Consumidos (se houver) */}
              {servico.materiais && servico.materiais.length > 0 && (
                <div className="pt-2 border-t border-border space-y-1.5">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                    Materiais & Insumos Utilizados no Serviço:
                  </span>
                  {servico.materiais.map((mat) => (
                    <div key={mat.material_id} className="flex items-center justify-between text-xs pl-2">
                      <span className="text-muted-foreground">
                        + {mat.nome_snapshot} ({mat.quantidade} {mat.unidade_snapshot} × {formatCurrency(mat.valor_unitario_snapshot)})
                      </span>
                      <span className="font-mono text-muted-foreground">
                        {formatCurrency(mat.valor_total)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs font-semibold text-royal-blue pl-2 pt-1">
                    <span>Subtotal Materiais Extras:</span>
                    <span className="font-mono">{formatCurrency(servico.custo_materiais)}</span>
                  </div>
                </div>
              )}

              {/* Total Bruto */}
              <div className="pt-2.5 border-t border-border flex items-center justify-between text-sm font-bold">
                <span className="text-foreground">Valor Total Bruto:</span>
                <span className="text-base text-foreground font-mono">
                  {formatCurrency(servico.total)}
                </span>
              </div>

              {/* Dedução Fiscal / ISS (se aplicável) */}
              {servico.emite_nf && (
                <div className="pt-2 border-t border-border/80 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
                    ISS Apurado ({servico.iss_percentual.toFixed(1)}%):
                  </span>
                  <span className="font-mono text-rose-600 dark:text-rose-400">
                    - {formatCurrency(servico.valor_iss)}
                  </span>
                </div>
              )}
            </div>
          </section>

          {/* 5. MODALIDADE FINANCEIRA & CONTEXTO DE RECEITA */}
          <section className="space-y-3">
            <h4 className="font-semibold uppercase tracking-wider text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Receipt className="w-3.5 h-3.5 text-royal-blue" />
              Faturamento & Cobrança
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card p-3 rounded-lg border border-border space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Modalidade de Cobrança
                </span>
                <div>{renderModalidadeBadge(servico.modalidade_financeira)}</div>
                <span className="text-[10px] text-muted-foreground block">
                  Forma: {servico.forma_pagamento_nome}
                </span>
              </div>

              <div className="bg-card p-3 rounded-lg border border-border space-y-1.5">
                <span className="text-[10px] text-muted-foreground uppercase font-medium block">
                  Documento Fiscal & Liquidação
                </span>
                <div className="text-xs font-semibold text-foreground font-mono">
                  {servico.nf_numero ? `NF ${servico.nf_numero}` : servico.emite_nf ? "NF em Processamento" : "Sem Emissão de NF"}
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-muted-foreground">Status Liquidação:</span>
                  <span
                    className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                      servico.status_pagamento === "RECEBIDO"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {servico.status_pagamento}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 6. GOVERNANÇA & IMUTABILIDADE */}
          {isFechadoOuImutavel && (
            <section className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-900/40 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-blue-800 dark:text-blue-300 text-[11px] block">
                  Bloqueio de Imutabilidade Financeira Ativo
                </span>
                <p className="text-[10px] text-blue-700/90 dark:text-blue-400 leading-relaxed">
                  Este serviço extra já atingiu a esteira de cobrança/faturamento. Alterações de valores, insumos ou quantidade estão bloqueadas no banco de dados para preservar a integridade contábil.
                </p>
              </div>
            </section>
          )}
        </div>

        {/* RODAPÉ & AÇÕES DO DRAWER */}
        <SheetFooter className="p-4 border-t border-border bg-card/60 sticky bottom-0 z-10 backdrop-blur-sm flex flex-row items-center justify-between sm:justify-between">
          <div className="text-[11px] text-muted-foreground">
            Lançado por: <span className="font-medium text-foreground">{servico.responsavel_nome}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8"
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>

            {servico.pipeline_status === "DEVOLVIDO" && (
              <Button
                size="sm"
                className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1.5"
                onClick={() =>
                  toast.info("Ajuste de Serviços Extras", {
                    description: "O formulário de reenvio com justificativa estará integrado na próxima fase."
                  })
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Sanar Inconsistência
              </Button>
            )}

            {servico.pipeline_status === "PENDENTE" && (
              <Button
                size="sm"
                className="text-xs h-8 bg-royal-blue hover:bg-royal-blue/90 text-white font-medium flex items-center gap-1.5"
                onClick={() =>
                  toast.info("Validação Operacional", {
                    description: "Para validar e atestar este serviço extra, acerte na Central de Aprovações RH/Operação."
                  })
                }
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Encaminhar p/ Validação
              </Button>
            )}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
