import React, { useMemo } from "react";
import {
  Building2,
  Calendar,
  FileText,
  Tag,
  User,
  Clock,
  CheckCircle2,
  AlertTriangle,
  PlayCircle,
  RotateCcw,
  Pencil,
  ArrowRight,
  Package,
  Users,
  Check,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
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
  quantidade_colaboradores?: number | null;
  valor_unitario?: number | null;
  valor_unitario_snapshot?: number | null;
  unidade_cobranca_snapshot?: string | null;
  tipo_calculo_snapshot?: string | null;
  materiais_snapshot?: Array<{
    material_id?: string;
    nome_snapshot?: string;
    unidade_snapshot?: string;
    quantidade?: number;
    valor_unitario_snapshot?: number;
    valor_total?: number;
  }> | null;
  custo_materiais?: number | null;
  emite_nf?: boolean | null;
  nf_numero?: string | null;
  iss_percentual?: number | null;
  valor_iss?: number | null;
  total?: number | null;
  forma_pagamento?: string | null;
  forma_pagamento_id?: string | null;
  modalidade_financeira?: string | null;
  data_vencimento?: string | null;
  status_pagamento?: string | null;
  pipeline_status?: string | null;
  justificativa_devolucao?: string | null;
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

// ─── 5 Etapas Canônicas da Esteira de Serviços Extras ────────────────────────
export const SERVICOS_EXTRAS_PIPELINE_STEPS = [
  { key: "RECEBIDO", label: "Recebido" },
  { key: "EM_VALIDACAO", label: "Validação" },
  { key: "APROVADO_OPERACAO", label: "Aprovado" },
  { key: "FATURADO", label: "Faturamento" },
  { key: "CONCLUIDO", label: "Concluído" },
] as const;

export const ServicoExtraDetalhesDrawer: React.FC<ServicoExtraDetalhesDrawerProps> = (props) => {
  if (!props.item) return null;
  return <ServicoExtraDetalhesContent {...props} item={props.item} />;
};

const ServicoExtraDetalhesContent: React.FC<ServicoExtraDetalhesDrawerProps & { item: ServicoExtraItemData }> = ({
  item,
  isOpen,
  onClose,
  onAdvance,
  onDevolve,
  onEdit,
  canAdvance,
  canDevolve,
  isPendingAdvance,
}) => {
  const navigate = useNavigate();

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
            badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
            isValid: true,
            route: resolvedModalidade.route,
          };
        case "DUPLICATA":
          return {
            label: "Duplicata a Prazo",
            badgeClass: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
            isValid: true,
            route: resolvedModalidade.route,
          };
        case "FATURAMENTO_MENSAL":
          return {
            label: "Faturamento Mensal",
            badgeClass: "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
            isValid: true,
            route: resolvedModalidade.route,
          };
      }
    }
    const fallbackLabel =
      item.formas_pagamento_operacional?.nome ||
      item.forma_pagamento ||
      item.modalidade_financeira ||
      "Padrão";
    return {
      label: fallbackLabel,
      badgeClass: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300",
      isValid: false,
      route: undefined,
    };
  }, [resolvedModalidade, item.formas_pagamento_operacional, item.forma_pagamento, item.modalidade_financeira]);

  // Diagnóstico Operacional Orientado a Processo
  const diagnostico = useMemo(() => {
    if (isDevolved) {
      return {
        categoria: "bloqueio" as const,
        responsavelAtual: "Encarregado / Lançador",
        proximoPasso: "Corrigir dados operacionais conforme justificativa",
        orientacao: item.justificativa_devolucao || "Serviço extra devolvido pela conferência técnica.",
      };
    }
    if (currentStatus === "PENDENTE") {
      return {
        categoria: "normal" as const,
        responsavelAtual: "Operação / Gestor de Pátio",
        proximoPasso: "Encaminhar para validação técnica de turno",
        orientacao: "Verificar se a quantidade executada, insumos e headcount conferem com o diário de bordo.",
      };
    }
    if (currentStatus === "EM_VALIDACAO") {
      return {
        categoria: "normal" as const,
        responsavelAtual: "Operação / Gestor",
        proximoPasso: "Aprovar serviço para geração de receita operacional",
        orientacao: "Conferir regras de período e precificação antes de aprovar para a Central de Receitas.",
      };
    }
    if (currentStatus === "APROVADO_OPERACAO") {
      return {
        categoria: "normal" as const,
        responsavelAtual: "Financeiro / Faturamento",
        proximoPasso: "Receita gerada. Aguardando emissão de NF ou fechamento mensal",
        orientacao: "Disponível na Central de Receitas para cobrança e faturamento.",
      };
    }
    if (currentStatus === "APROVADO_FINANCEIRO" || currentStatus === "FATURADO") {
      return {
        categoria: "normal" as const,
        responsavelAtual: "Financeiro / Tesouraria",
        proximoPasso: "Acompanhar liquidação no Contas a Receber",
        orientacao: "Faturamento emitido. Aguardando retorno bancário / baixa.",
      };
    }
    return {
      categoria: "concluido" as const,
      responsavelAtual: "Finalizado",
      proximoPasso: "Receita liquidada e conciliada",
      orientacao: "Fluxo operacional e financeiro encerrado com sucesso.",
    };
  }, [currentStatus, isDevolved, item.justificativa_devolucao]);

  const empresaNome = item.empresas?.nome || item.empresa_nome || "—";
  const valorTotalStr = item.total != null ? currencyFormatter.format(Number(item.total)) : "—";
  const valorUnitarioStr = item.valor_unitario != null ? currencyFormatter.format(Number(item.valor_unitario)) : "—";
  const headcountNum = Number(item.quantidade_colaboradores || 1);
  const headcountStr = `${headcountNum} ${headcountNum === 1 ? "pessoa" : "pessoas"}`;
  const codigo = `SX-${String(item.id || "").slice(0, 8).toUpperCase()}`;

  const isEditable = !isFlowDone && (currentStatus === "PENDENTE" || isDevolved);

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
              ? "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200"
              : isDevolved
              ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300"
              : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300"
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
            {isEditable && onEdit && (
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
      {/* 1. Esteira do Processo Compacta (UX06 - Linha de Progresso) */}
      <div className="p-4 rounded-xl bg-card border border-border/70 shadow-2xs space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Esteira do Processo
          </span>
          {isDevolved ? (
            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 text-[10px] font-bold">
              Devolvido para Ajuste
            </Badge>
          ) : (
            <span className="text-[11px] text-muted-foreground font-medium">
              Etapa {currentStageIndex + 1} de 5
            </span>
          )}
        </div>

        {/* Linha Compacta de Progresso */}
        <div className="relative flex items-center justify-between pt-1 pb-0.5">
          {/* Linha de fundo */}
          <div className="absolute top-[17px] left-4 right-4 h-0.5 bg-muted z-0" />
          
          {/* Linha de progresso preenchida */}
          <div
            className={cn(
              "absolute top-[17px] left-4 h-0.5 transition-all duration-300 z-0",
              isDevolved ? "bg-rose-500" : "bg-primary"
            )}
            style={{
              width: isFlowDone
                ? "calc(100% - 32px)"
                : `calc(${(currentStageIndex / 4) * 100}% - 16px)`,
            }}
          />

          {SERVICOS_EXTRAS_PIPELINE_STEPS.map((step, idx) => {
            const isDone = isFlowDone || idx < currentStageIndex;
            const isCurrent = !isFlowDone && idx === currentStageIndex;

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all",
                    isDevolved && isCurrent
                      ? "bg-rose-600 text-white ring-4 ring-rose-100 dark:ring-rose-950/60"
                      : isCurrent
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/20 shadow-xs"
                      : isDone
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground border border-border/80"
                  )}
                >
                  {isDevolved && isCurrent ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-white" />
                  ) : isDone ? (
                    <Check className="w-3.5 h-3.5 text-primary-foreground stroke-[3]" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] tracking-tight whitespace-nowrap",
                    isCurrent
                      ? isDevolved
                        ? "text-rose-700 dark:text-rose-400 font-bold"
                        : "text-foreground font-bold"
                      : isDone
                      ? "text-foreground/80 font-medium"
                      : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Faixa de Metadados de Status (Sem Nested Cards) */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-muted/30 border border-border/70 text-xs">
        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Status Operacional
          </span>
          <div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-semibold uppercase px-2 py-0.5",
                isFlowDone
                  ? "bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200"
                  : isDevolved
                  ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300"
              )}
            >
              {isFlowDone ? "RECEBIDO" : isDevolved ? "DEVOLVIDO" : currentStatus.replace(/_/g, " ")}
            </Badge>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Status Financeiro
          </span>
          <div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] font-medium px-2 py-0.5",
                isFlowDone || currentStatusPgto === "RECEBIDO" || currentStatusPgto === "PAGO"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300"
                  : currentStatusPgto === "ATRASADO"
                  ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
              )}
            >
              {item.status_pagamento || (isFlowDone ? "RECEBIDO" : "PENDENTE")}
            </Badge>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Modalidade
          </span>
          <div>
            <Badge
              variant="outline"
              className={cn("text-[10px] font-medium px-2 py-0.5 truncate max-w-full block text-center", modalidadeInfo.badgeClass)}
              title={modalidadeInfo.label}
            >
              {modalidadeInfo.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* 3. Total Final (Design System Oficial) */}
      <div className="p-4 rounded-xl bg-card border border-border/80 shadow-2xs flex items-baseline justify-between gap-3 min-w-0">
        <div className="space-y-0.5 min-w-0">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
            Total Final
          </span>
          <div className="text-xs text-muted-foreground truncate">
            <strong className="text-foreground font-medium">{item.quantidade != null ? Number(item.quantidade).toLocaleString("pt-BR") : "1"}</strong> {item.unidade_cobranca_snapshot || "un"} × <strong className="text-foreground font-medium">{valorUnitarioStr}</strong>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-2xl font-bold font-display text-emerald-700 dark:text-emerald-400 tracking-tight block">
            {valorTotalStr}
          </span>
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            {item.tipos_servico_operacional?.nome || item.tipo_servico || "OPERACIONAL"}
          </span>
        </div>
      </div>

      {/* 4. Dados Consolidados */}
      <section className="bg-card rounded-xl p-4 border border-border/80 shadow-2xs space-y-3 text-xs">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1.5 border-b border-border/60 flex items-center justify-between">
          <span>Dados Consolidados</span>
          <span className="font-mono text-primary font-semibold">{codigo}</span>
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
            <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">Headcount (Equipe)</div>
              <div className="font-medium text-foreground truncate">
                {headcountStr}
              </div>
            </div>
          </div>
        </div>

        {item.cliente && (
          <div className="pt-2 border-t border-border/60 text-[11px]">
            <span className="text-muted-foreground">Tomador / Cliente: </span>
            <strong className="text-foreground">{item.cliente}</strong>
          </div>
        )}

        {item.descricao_servico && (
          <div className="pt-2 border-t border-border/60 space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span>Descrição do Serviço</span>
            </div>
            <p className="text-xs text-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 leading-relaxed whitespace-pre-wrap break-words">
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

      {/* 5. Materiais Consumidos (se houver) */}
      {((item.materiais_snapshot && item.materiais_snapshot.length > 0) || Number(item.custo_materiais || 0) > 0) && (
        <section className="bg-card rounded-xl p-4 border border-border/80 shadow-2xs space-y-2 text-xs">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
            <span className="flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5 text-primary" />
              Materiais & Insumos Utilizados
            </span>
            <span className="text-foreground font-mono font-bold">
              {currencyFormatter.format(Number(item.custo_materiais || 0))}
            </span>
          </div>

          {item.materiais_snapshot && item.materiais_snapshot.length > 0 ? (
            <div className="divide-y divide-border/60">
              {item.materiais_snapshot.map((mat, idx) => (
                <div key={idx} className="py-1.5 flex items-center justify-between text-[11px]">
                  <div>
                    <span className="font-medium text-foreground">{mat.nome_snapshot || "Insumo"}</span>
                    <span className="text-muted-foreground text-[10px] ml-1">
                      ({mat.quantidade || 1} {mat.unidade_snapshot || "un"} × {currencyFormatter.format(Number(mat.valor_unitario_snapshot || 0))})
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-foreground">
                    {currencyFormatter.format(Number(mat.valor_total || 0))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground italic">
              Custo total de materiais registrado no lançamento: {currencyFormatter.format(Number(item.custo_materiais || 0))}.
            </p>
          )}
        </section>
      )}

      {/* 6. Diagnóstico do Processo & Próximos Passos (Alinhado a Torre/Operações) */}
      <section className="rounded-xl border border-border/80 bg-card p-4 shadow-2xs space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
            {diagnostico.categoria === "bloqueio" ? (
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            ) : diagnostico.categoria === "concluido" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <Clock className="h-4 w-4 text-blue-600" />
            )}
            <span>Diagnóstico do Processo</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            Resp: <strong className="text-foreground">{diagnostico.responsavelAtual}</strong>
          </span>
        </div>

        <p className="text-[11px] text-foreground font-medium leading-relaxed">
          👉 {diagnostico.proximoPasso}
        </p>
        <p className="text-[11px] text-muted-foreground leading-relaxed italic">
          {diagnostico.orientacao}
        </p>

        {/* Despachos Inter-Módulos Canônicos */}
        <div className="pt-2 border-t border-border/60 flex flex-wrap gap-2">
          {isDevolved && (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-7 gap-1 text-rose-700 dark:text-rose-400 border-rose-300 hover:bg-rose-50"
              onClick={() => {
                onClose();
                navigate("/inconsistencias");
              }}
            >
              Ver em Inconsistências <ArrowRight className="w-3 h-3" />
            </Button>
          )}

          {(currentStatus === "PENDENTE" || currentStatus === "EM_VALIDACAO") && (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-7 gap-1 text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => {
                onClose();
                navigate("/rh/aprovacoes");
              }}
            >
              Abrir na Central de Aprovações <ArrowRight className="w-3 h-3" />
            </Button>
          )}

          {(currentStatus === "APROVADO_OPERACAO" || currentStatus === "APROVADO_FINANCEIRO" || currentStatus === "FATURADO" || isFlowDone) && (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-7 gap-1 text-emerald-700 dark:text-emerald-400 border-emerald-300 hover:bg-emerald-50"
              onClick={() => {
                onClose();
                navigate("/financeiro/receitas");
              }}
            >
              Ver na Central de Receitas <ArrowRight className="w-3 h-3" />
            </Button>
          )}
        </div>
      </section>
    </DrawerPrimarioShell>
  );
};
