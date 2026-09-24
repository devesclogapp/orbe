import React, { useMemo } from "react";
import {
  Building2,
  Calendar,
  DollarSign,
  FileText,
  Receipt,
  Tag,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  RotateCcw,
  Pencil,
  ArrowRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import {
  PipelineHorizontalBar,
  type PipelineStageItem,
} from "@/components/continuity/PipelineHorizontalBar";
import { resolveServicoExtraModalidade } from "@/contexts/OperationalPipelineContext";

export interface ServicoExtraItemData {
  id: string;
  data?: string | null;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  empresas?: { nome?: string | null } | null;
  formas_pagamento_operacional?: { nome?: string | null; modalidade?: string | null } | null;
  tipos_servico_operacional?: { nome?: string | null } | null;
  cliente?: string | null;
  tipo_servico: string;
  descricao_servico: string;
  quantidade?: number | null;
  valor_unitario?: number | null;
  total?: number | null;
  forma_pagamento?: string | null;
  forma_pagamento_id?: string | null;
  modalidade_financeira?: string | null;
  data_vencimento?: string | null;
  status_pagamento?: string | null;
  pipeline_status?: string | null;
  justificativa_devolucao?: string | null;
  nf_numero?: string | null;
  responsavel_nome?: string | null;
  observacao?: string | null;
  operacao_id?: string | null;
  origem_dado?: string | null;
  created_at?: string | null;
  criado_em?: string | null;
}

export interface ServicoExtraDetalhesDrawerProps {
  item: ServicoExtraItemData | null;
  isOpen: boolean;
  onClose: () => void;
  onVerFluxoCompleto?: () => void;
  onBack?: () => void;
  onAdvance?: () => void;
  onDevolve?: () => void;
  onEdit?: () => void;
  canAdvance?: boolean;
  canDevolve?: boolean;
  isPendingAdvance?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
};

// ─── 5 Estágios Horizontais de Serviços Extras ───────────────────────────────
export const SERVICOS_EXTRAS_HORIZONTAL_STAGES = [
  {
    id: "lancamento",
    key: "RECEBIDO",
    label: "Recebido",
    compactLabel: "Recebido",
    responsible: "Encarregado",
    description: "Serviço extra registrado e capturado pelo sistema.",
  },
  {
    id: "validacao_operacional",
    key: "EM_VALIDACAO",
    label: "Em validação",
    compactLabel: "Em validação",
    responsible: "Operação / ADM",
    description: "Conferência técnica e validação dos dados operacionais.",
  },
  {
    id: "aprovacao",
    key: "APROVADO_OPERACAO",
    label: "Aprovado",
    compactLabel: "Aprovado",
    responsible: "Gestor Operacional",
    description: "Serviço validado e aprovado. Receita gerada no financeiro.",
  },
  {
    id: "faturamento",
    key: "FATURAMENTO",
    label: "A receber / Faturamento",
    compactLabel: "A receber",
    responsible: "Financeiro",
    description: "Disponível na Central de Receitas para cobrança e faturamento.",
  },
  {
    id: "concluido",
    key: "CONCLUIDO",
    label: "Recebido",
    compactLabel: "Recebido",
    responsible: "Financeiro / Tesouraria",
    description: "Receita liquidada e fluxo de serviço extra concluído.",
  },
] as const;

export const ServicoExtraDetalhesDrawer: React.FC<ServicoExtraDetalhesDrawerProps> = ({
  item,
  isOpen,
  onClose,
  onVerFluxoCompleto,
  onAdvance,
  onDevolve,
  onEdit,
  canAdvance,
  canDevolve,
  isPendingAdvance,
}) => {
  if (!item) return null;

  const currentStatus = String(item.pipeline_status || "PENDENTE").toUpperCase();
  const currentStatusPgto = String(item.status_pagamento || "").toUpperCase();

  const isFlowDone =
    currentStatus === "CONCLUIDO" ||
    currentStatus === "FINALIZADO" ||
    currentStatus === "RECEBIDO" ||
    currentStatus === "PAGO" ||
    currentStatusPgto === "PAGO" ||
    currentStatusPgto === "RECEBIDO";

  const isDevolved = currentStatus === "DEVOLVIDO" || currentStatus === "RECUSADO";

  // Índice da etapa atual (0 a 4)
  const currentStageIndex = useMemo(() => {
    if (isFlowDone) return 4;
    switch (currentStatus) {
      case "EM_VALIDACAO":
      case "EM_ANALISE":
        return 1;
      case "APROVADO_OPERACAO":
        return 2;
      case "APROVADO_FINANCEIRO":
      case "FATURADO":
      case "AGUARDANDO_PAGAMENTO":
        return 3;
      case "CONCLUIDO":
      case "RECEBIDO":
      case "FINALIZADO":
      case "PAGO":
        return 4;
      default:
        return 0;
    }
  }, [currentStatus, isFlowDone]);

  // Resolução da modalidade financeira via regras de negócio canônicas
  const resolvedModalidade = useMemo(() => {
    const candidate =
      item.modalidade_financeira ||
      item.formas_pagamento_operacional?.modalidade ||
      item.forma_pagamento ||
      item.formas_pagamento_operacional?.nome;
    return resolveServicoExtraModalidade(candidate);
  }, [
    item.modalidade_financeira,
    item.formas_pagamento_operacional?.modalidade,
    item.forma_pagamento,
    item.formas_pagamento_operacional?.nome,
  ]);

  const modalidadeInfo = useMemo(() => {
    if (resolvedModalidade.isValid && resolvedModalidade.modalidade) {
      switch (resolvedModalidade.modalidade) {
        case "CAIXA_IMEDIATO":
          return {
            label: "Caixa Imediato",
            badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
            isValid: true,
            route: resolvedModalidade.route,
          };
        case "DUPLICATA":
          return {
            label: "Duplicata",
            badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
            isValid: true,
            route: resolvedModalidade.route,
          };
        case "FATURAMENTO_MENSAL":
          return {
            label: "Faturamento Mensal",
            badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
            isValid: true,
            route: resolvedModalidade.route,
          };
      }
    }
    const fallbackLabel =
      item.formas_pagamento_operacional?.nome ||
      item.forma_pagamento ||
      item.modalidade_financeira ||
      "Não determinada";
    return {
      label: fallbackLabel,
      badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      isValid: false,
      route: undefined,
    };
  }, [resolvedModalidade, item.formas_pagamento_operacional, item.forma_pagamento, item.modalidade_financeira]);

  // Mapeamento dos 5 estágios horizontais compactos (Drawer Primário)
  const horizontalStages = useMemo<PipelineStageItem[]>(() => {
    return SERVICOS_EXTRAS_HORIZONTAL_STAGES.map((st, idx) => {
      let status: "done" | "current" | "pending" | "devolved" = "pending";
      if (isFlowDone) {
        status = "done";
      } else if (isDevolved && idx === currentStageIndex) {
        status = "devolved";
      } else if (idx < currentStageIndex) {
        status = "done";
      } else if (idx === currentStageIndex) {
        status = "current";
      } else {
        status = "pending";
      }
      return {
        id: st.id,
        label: st.label,
        compactLabel: st.compactLabel,
        status,
      };
    });
  }, [currentStageIndex, isFlowDone, isDevolved]);

  const empresaNome = item.empresas?.nome || item.empresa_nome || "—";
  const valorTotalStr = item.total != null ? currencyFormatter.format(Number(item.total)) : "—";
  const valorUnitarioStr = item.valor_unitario != null ? currencyFormatter.format(Number(item.valor_unitario)) : "—";

  return (
    <DrawerPrimarioShell
      isOpen={isOpen}
      onClose={onClose}
      tagline="Continuidade Operacional"
      badge={
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            isFlowDone
              ? "bg-zinc-100 text-zinc-700 border-zinc-300"
              : isDevolved
              ? "bg-rose-50 text-rose-700 border-rose-200"
              : "bg-blue-50 text-blue-700 border-blue-200"
          )}
        >
          {isFlowDone ? "RECEBIDO / CONCLUÍDO" : isDevolved ? "DEVOLVIDO" : currentStatus.replace(/_/g, " ")}
        </Badge>
      }
      title="Detalhes do Serviço Extra"
      subtitle="Informações operacionais e financeiras consolidadas deste lançamento."
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Fechar
          </Button>

          <div className="flex items-center gap-2">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="text-xs gap-1.5 h-9"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>Editar</span>
              </Button>
            )}

            {!isFlowDone && canDevolve && onDevolve && (
              <Button
                variant="outline"
                size="sm"
                onClick={onDevolve}
                className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs gap-1.5 h-9"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Devolver</span>
              </Button>
            )}

            {!isFlowDone && canAdvance && onAdvance && (
              <Button
                size="sm"
                onClick={onAdvance}
                disabled={isPendingAdvance}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-9 shadow-sm"
              >
                <PlayCircle className="h-4 w-4" />
                <span>
                  {currentStatus === "PENDENTE"
                    ? "Encaminhar para Validação"
                    : currentStatus === "EM_VALIDACAO"
                    ? "Aprovar Serviço Extra"
                    : "Avançar Etapa"}
                </span>
              </Button>
            )}

            {isFlowDone && (
              <Button
                size="sm"
                variant="outline"
                onClick={onClose}
                className="text-xs font-semibold h-9"
              >
                Concluir Visualização
              </Button>
            )}
          </div>
        </div>
      }
    >
      {/* 1. Pipeline Horizontal Compacto com gatilho "Ver fluxo completo →" */}
      <PipelineHorizontalBar
        stages={horizontalStages}
        onVerFluxoCompleto={onVerFluxoCompleto}
        isFlowDone={isFlowDone}
        title="Fluxo do Serviço Extra"
        actionLabel="Ver fluxo completo →"
      />

      {/* 2. Grid de Status e Classificação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/70 text-xs">
        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Pipeline Operacional
          </span>
          <button
            type="button"
            onClick={onVerFluxoCompleto}
            className="group inline-flex items-center gap-1 focus:outline-none"
            title="Clique para ver a linha do tempo completa"
          >
            <Badge
              variant="outline"
              className={cn(
                "border font-semibold uppercase px-2 py-0.5 text-[11px] group-hover:ring-1 group-hover:ring-primary/40 cursor-pointer transition-all",
                isFlowDone
                  ? "bg-zinc-100 text-zinc-700 border-zinc-300"
                  : isDevolved
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-blue-50 text-blue-700 border-blue-200"
              )}
            >
              {isFlowDone ? "RECEBIDO / CONCLUÍDO" : isDevolved ? "DEVOLVIDO" : currentStatus.replace(/_/g, " ")}
            </Badge>
          </button>
        </div>

        <div className="space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Status Financeiro
          </span>
          <div>
            <Badge
              variant="outline"
              className={cn(
                "border font-medium px-2 py-0.5 text-[11px]",
                isFlowDone
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-amber-50 text-amber-700 border-amber-200"
              )}
            >
              {item.status_pagamento || (isFlowDone ? "PAGO" : "PENDENTE")}
            </Badge>
          </div>
        </div>

        <div className="space-y-1 sm:col-span-2 pt-1 border-t border-border/50">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Modalidade Financeira
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-[10px] font-semibold h-4 px-1.5", modalidadeInfo.badgeClass)}>
              {modalidadeInfo.label}
            </Badge>
            {!modalidadeInfo.isValid && !isFlowDone && (
              <span className="text-[10px] text-amber-700 dark:text-amber-400 italic">
                (Aguardando definição da modalidade para direcionamento)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Card de Valor Total em Destaque */}
      <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-2.5 min-w-0">
        <div className="flex items-baseline justify-between gap-2 min-w-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
            Total Final
          </span>
          <span className="text-2xl font-bold font-display text-emerald-700 dark:text-emerald-400 tracking-tight truncate">
            {valorTotalStr}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-2 border-t border-border/60 min-w-0">
          <span className="truncate">
            Qtd: <strong className="text-foreground font-medium">{item.quantidade != null ? Number(item.quantidade).toLocaleString("pt-BR") : "1"}</strong> × Un: <strong className="text-foreground font-medium">{valorUnitarioStr}</strong>
          </span>
          <Badge variant="outline" className="text-[11px] font-medium uppercase shrink-0">
            {item.tipos_servico_operacional?.nome || item.tipo_servico || "OPERACIONAL"}
          </Badge>
        </div>
      </div>

      {/* 4. Grid de Dados Operacionais */}
      <section className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-4 border border-border/80 space-y-3 text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
          Dados Consolidados
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">Empresa / Unidade</div>
              <div className="font-semibold text-foreground truncate" title={empresaNome}>
                {empresaNome}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">Data Operacional</div>
              <div className="font-semibold text-foreground truncate">
                {formatDate(item.data)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <div className="flex items-center gap-2">
            <Tag className="h-3.5 w-3.5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">Tipo de Serviço</div>
              <div className="font-medium text-foreground truncate">
                {item.tipos_servico_operacional?.nome || item.tipo_servico || "—"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Receipt className="h-3.5 w-3.5 text-purple-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">Modalidade</div>
              <div className="font-medium text-foreground truncate">
                {modalidadeInfo.label}
              </div>
            </div>
          </div>
        </div>

        {item.descricao_servico && (
          <div className="pt-2 border-t border-border/60 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Descrição do Serviço</span>
            </div>
            <p className="text-xs text-foreground bg-background/60 p-2.5 rounded-lg border border-border/40 leading-relaxed whitespace-pre-wrap break-words">
              {item.descricao_servico}
            </p>
          </div>
        )}

        {(item.responsavel_nome || item.observacao) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60 text-[11px]">
            {item.responsavel_nome && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">Resp: <strong className="text-foreground">{item.responsavel_nome}</strong></span>
              </div>
            )}
            {item.observacao && (
              <div className="col-span-2 text-muted-foreground italic truncate">
                Obs: {item.observacao}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 5. Alerta de Devolução Anterior se houver */}
      {item.justificativa_devolucao && (
        <div className="p-3.5 rounded-xl bg-orange-50/80 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 text-xs text-orange-900 dark:text-orange-200 space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold text-orange-800 dark:text-orange-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <span>Motivo do Retorno / Devolução</span>
          </div>
          <p className="pl-5.5 text-xs text-orange-800/90 dark:text-orange-300/90 break-words">
            {item.justificativa_devolucao}
          </p>
        </div>
      )}

      {/* 6. Situação Contextual do Fluxo */}
      <section className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pb-0.5 border-b border-border/60">
          Situação do Fluxo
        </div>

        {isFlowDone ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900 p-3.5 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Receita liquidada e fluxo de serviço extra concluído.</span>
            </div>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
              O recebimento foi confirmado no financeiro e o ciclo operacional está encerrado.
            </p>
          </div>
        ) : isDevolved ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/30 dark:border-rose-900 p-3.5 space-y-1">
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-800 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>Serviço extra devolvido para correção</span>
            </div>
            <p className="text-[11px] text-rose-700/80 dark:text-rose-400/80 leading-relaxed">
              {item.justificativa_devolucao || "O lançamento retornou à etapa anterior para ajustes operacionais."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 dark:bg-blue-950/30 dark:border-blue-900 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-800 dark:text-blue-300">
                <Clock className="h-4 w-4 text-blue-600" />
                <span>Etapa Atual: {currentStatus.replace(/_/g, " ")}</span>
              </div>
            </div>
            <p className="text-[11px] text-blue-700/80 dark:text-blue-400/80 leading-relaxed">
              {currentStatus === "EM_VALIDACAO"
                ? "Conferência técnica e validação dos dados operacionais em andamento."
                : currentStatus === "APROVADO_OPERACAO"
                ? "Serviço aprovado operacionalmente. Pronto para faturamento e receitas."
                : currentStatus === "APROVADO_FINANCEIRO" || currentStatus === "FATURADO"
                ? "Receita gerada na Central de Receitas aguardando liquidação."
                : "Lançamento capturado no sistema. Aguardando encaminhamento para validação."}
            </p>
          </div>
        )}
      </section>

      {/* 7. Ação explícita para consultar o fluxo completo */}
      <section className="pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onVerFluxoCompleto}
          className="w-full text-xs font-semibold gap-2 h-9 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border-border/80 text-foreground shadow-2xs hover:border-primary/50 transition-all justify-between"
        >
          <span className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-primary" />
            <span>Consultar Linha do Tempo e Responsáveis</span>
          </span>
          <span className="text-primary font-bold flex items-center gap-0.5">
            <span>Ver fluxo completo</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Button>
      </section>
    </DrawerPrimarioShell>
  );
};
