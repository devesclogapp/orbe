import React, { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  DollarSign,
  AlertTriangle,
  Receipt,
  X,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";

import {
  useOperationalPipeline,
  buildServicosExtrasPipeline,
  resolveServicoExtraModalidade,
  type ServicoExtraStepId,
} from "@/contexts/OperationalPipelineContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  TimelineVerticalStepper,
  type TimelineStageItem,
} from "@/components/continuity/TimelineVerticalStepper";
import { DrawerSecundarioShell } from "@/components/continuity/DrawerSecundarioShell";

// ─── 5 Estágios Canônicos Apresentados com Linguagem de Negócio (Receitas) ───────
export const SERVICOS_EXTRAS_STAGES = [
  {
    id: "lancamento",
    key: "RECEBIDO",
    label: "Recebido",
    responsible: "Encarregado / Operação",
    description: "Serviço extra registrado e capturado pelo sistema.",
  },
  {
    id: "validacao_operacional",
    key: "EM_VALIDACAO",
    label: "Em validação",
    responsible: "Operação / ADM",
    description: "Conferência técnica e validação dos dados operacionais.",
  },
  {
    id: "aprovacao",
    key: "APROVADO_OPERACAO",
    label: "Aprovado",
    responsible: "Gestor Operacional",
    description: "Serviço validado e aprovado. Receita gerada no financeiro.",
  },
  {
    id: "faturamento",
    key: "FATURAMENTO",
    label: "A receber / Faturamento",
    responsible: "Financeiro",
    description: "Disponível na Central de Receitas para cobrança e faturamento.",
  },
  {
    id: "concluido",
    key: "CONCLUIDO",
    label: "Recebido",
    responsible: "Financeiro / Tesouraria",
    description: "Receita liquidada e fluxo de serviço extra concluído.",
  },
] as const;

export interface ServicosExtrasContinuityDrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  onBack?: () => void;
  item?: any;
  zIndexClass?: string;
}

const pipelineStatusToStepId = (status?: string | null): ServicoExtraStepId => {
  switch (String(status || "").toUpperCase()) {
    case "EM_VALIDACAO":
    case "EM_ANALISE":
      return "validacao_operacional";
    case "APROVADO_OPERACAO":
      return "aprovacao";
    case "APROVADO_FINANCEIRO":
    case "FATURADO":
      return "faturamento";
    case "CONCLUIDO":
    case "RECEBIDO":
    case "FINALIZADO":
    case "PAGO":
      return "concluido";
    default:
      return "lancamento";
  }
};

export const ServicosExtrasContinuityDrawer: React.FC<ServicosExtrasContinuityDrawerProps> = ({
  isOpen: propIsOpen,
  onClose: propOnClose,
  onBack,
  item,
  zIndexClass,
}) => {
  const { isOpen: pipelineIsOpen, payload: contextPayload, closePipeline } = useOperationalPipeline();
  const navigate = useNavigate();
  const location = useLocation();

  // Se controlado por prop, usa prop; senão, usa context
  const isOpen = propIsOpen !== undefined ? propIsOpen : pipelineIsOpen;
  const handleClose = propOnClose || closePipeline;

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleClose]);

  // Payload ativo derivado das props ou do contexto
  const payload = useMemo(() => {
    if (item) {
      const competencia = item.data
        ? format(new Date(item.data), "yyyy-MM")
        : format(new Date(), "yyyy-MM");

      return buildServicosExtrasPipeline({
        competencia,
        empresa: item.empresas?.nome ?? item.empresa_nome ?? "Empresa",
        currentStep: pipelineStatusToStepId(item.pipeline_status),
        pipelineStatus: item.pipeline_status || "PENDENTE",
        modalidade_financeira: item.modalidade_financeira,
        registroId: item.id,
        descricao: item.descricao_servico,
        valor: item.total != null ? Number(item.total) : undefined,
        data: item.data || undefined,
      });
    }
    return contextPayload;
  }, [item, contextPayload]);

  const context = payload?.context;
  const rawSteps = payload?.steps ?? [];
  const nextAction = payload?.nextAction;

  // Resolução segura do índice atual e estado de conclusão
  const { currentStageIndex, isFlowDone, isDevolved } = useMemo(() => {
    if (!payload) return { currentStageIndex: 2, isFlowDone: false, isDevolved: false };

    const devolvido = rawSteps.some((s) => s.status === "devolved");
    const concluidoStep =
      rawSteps.every((s) => s.status === "done") ||
      (rawSteps[rawSteps.length - 1]?.status === "done" &&
        rawSteps[rawSteps.length - 1]?.id === "concluido");

    const statusStr = String(context?.pipelineStatus || "").toUpperCase();
    const isConcluidoStatus = ["CONCLUIDO", "RECEBIDO", "FINALIZADO", "PAGO"].includes(statusStr);

    let idx = 2; // Default para Aprovações: Aprovado
    const activeStep = rawSteps.find((s) => s.status === "current");
    if (activeStep) {
      const foundIdx = SERVICOS_EXTRAS_STAGES.findIndex((st) => st.id === activeStep.id);
      if (foundIdx !== -1) idx = foundIdx;
    } else if (concluidoStep || isConcluidoStatus) {
      idx = 4; // Recebido / Concluído
    }

    const flowDone = concluidoStep || isConcluidoStatus || idx === 4;

    return {
      currentStageIndex: idx,
      isFlowDone: flowDone,
      isDevolved: devolvido,
    };
  }, [payload, rawSteps, context?.pipelineStatus]);

  // Modalidade Financeira
  const rawModalidade = String(context?.modalidade_financeira || context?.modalidade || "").trim().toUpperCase();
  const modalidadeInfo = useMemo(() => {
    const res = resolveServicoExtraModalidade(rawModalidade);
    if (res.isValid && res.modalidade) {
      switch (res.modalidade) {
        case "CAIXA_IMEDIATO":
          return {
            key: "CAIXA_IMEDIATO",
            label: "Caixa Imediato",
            badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
            complement: "Recebimento imediato gerado. O valor está pronto para confirmação no caixa.",
            isValid: true,
          };
        case "DUPLICATA":
          return {
            key: "DUPLICATA",
            label: "Duplicata",
            badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
            complement: "Cobrança avulsa gerada. O título está pronto para emissão e envio.",
            isValid: true,
          };
        case "FATURAMENTO_MENSAL":
          return {
            key: "FATURAMENTO_MENSAL",
            label: "Faturamento Mensal",
            badgeClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
            complement: "Serviço integrado à fatura mensal da competência aguardando fechamento.",
            isValid: true,
          };
      }
    }
    return {
      key: null,
      label: rawModalidade || "Não determinada",
      badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
      complement: "Destino financeiro não pôde ser determinado. Verifique a modalidade de pagamento configurada.",
      isValid: false,
    };
  }, [rawModalidade]);

  // Título e subtítulo dinâmicos conforme estágio real
  const headerInfo = useMemo(() => {
    if (isDevolved) {
      return {
        title: "Serviço Devolvido",
        subtitle: "Serviço extra retornado à etapa anterior para ajustes operacionais.",
      };
    }
    if (isFlowDone || currentStageIndex === 4) {
      return {
        title: "Receita Liquidada / Concluído",
        subtitle: "Receita confirmada e fluxo de serviço extra finalizado.",
      };
    }
    switch (currentStageIndex) {
      case 0:
        return {
          title: "Serviço Registrado",
          subtitle: "Serviço extra capturado. Aguardando encaminhamento para validação operacional.",
        };
      case 1:
        return {
          title: "Serviço em Validação",
          subtitle: "Conferência técnica e validação dos dados operacionais em andamento.",
        };
      case 2:
        return {
          title: "Serviço Aprovado",
          subtitle: "Acompanhe a geração da receita e o encaminhamento financeiro.",
        };
      case 3:
        return {
          title: "Serviço em Faturamento / A Receber",
          subtitle: "Disponível na Central de Receitas para cobrança e faturamento.",
        };
      default:
        return {
          title: "Status do Serviço Extra",
          subtitle: "Acompanhe o fluxo operacional e financeiro do serviço.",
        };
    }
  }, [currentStageIndex, isDevolved, isFlowDone]);

  // Derivação do banner de resultado
  const resultSummary = useMemo(() => {
    if (isFlowDone || currentStageIndex === 4) {
      return {
        icon: CheckCircle2,
        title: "Receita liquidada e fluxo de serviço extra concluído.",
        description: "O recebimento foi confirmado no financeiro e o ciclo operacional está encerrado.",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
      };
    }
    if (isDevolved) {
      return {
        icon: AlertTriangle,
        title: "Serviço extra devolvido para correção",
        description: context?.devolucaoMotivo || "O lançamento retornou à etapa anterior para ajustes operacionais.",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
      };
    }
    if (currentStageIndex === 0) {
      return {
        icon: Sparkles,
        title: "Serviço extra registrado no sistema.",
        description: "Lançamento inicial capturado, aguardando início da validação técnica e operacional.",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      };
    }
    if (currentStageIndex === 1) {
      return {
        icon: AlertTriangle,
        title: "Serviço aguardando validação técnica e operacional.",
        description: "O lançamento está em análise pela equipe operacional antes de ser aprovado para o financeiro.",
        badgeClass: "bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800",
      };
    }
    // A partir do estágio 2 (Aprovado)
    if (!modalidadeInfo.isValid) {
      return {
        icon: AlertTriangle,
        title: "Serviço aprovado, mas modalidade financeira requer atenção.",
        description: modalidadeInfo.complement,
        badgeClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
      };
    }
    return {
      icon: CheckCircle2,
      title: "Serviço aprovado e encaminhado para o fluxo financeiro.",
      description: modalidadeInfo.complement,
      badgeClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
    };
  }, [isFlowDone, isDevolved, currentStageIndex, modalidadeInfo, context?.devolucaoMotivo]);

  // CTA direciona para o Financeiro com o identificador no state
  const handleCtaClick = () => {
    if (!nextAction?.route) return;
    const registroId = context?.registroId || (nextAction as any)?.actionPayload?.highlightServicoExtraId;
    handleClose();
    navigate(nextAction.route, {
      state: {
        highlightServicoExtraId: registroId,
        activeTab: modalidadeInfo.key,
      },
    });
  };

  const valorFormatado = useMemo(() => {
    if (context?.valor === undefined || context?.valor === null) return undefined;
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(Number(context.valor));
  }, [context?.valor]);

  // Conversão para a lista de etapas do TimelineVerticalStepper
  const stepperStages = useMemo<TimelineStageItem[]>(() => {
    return SERVICOS_EXTRAS_STAGES.map((st, idx) => {
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
        responsible: st.responsible,
        description: st.description,
        status,
      };
    });
  }, [currentStageIndex, isFlowDone, isDevolved]);

  if (!isOpen) return null;

  const ResultIcon = resultSummary.icon;

  // Layout Canônico de 3 Camadas Herdado do DrawerSecundarioShell: h-[100dvh] max-h-[100dvh] flex-1 min-h-0 overflow-y-auto overflow-x-hidden
  return (
    <DrawerSecundarioShell
      isOpen={isOpen}
      onClose={handleClose}
      onBack={onBack}
      zIndexClass={zIndexClass || "z-[60]"}
      widthClass="w-full sm:max-w-lg"
      className="h-[100dvh] max-h-[100dvh]"
      title="Linha do Tempo — Serviço Extra"
      subtitle={headerInfo.subtitle || "Acompanhamento das 5 etapas operacionais e financeiras deste lançamento."}
      badge={
        <Badge variant="outline" className="text-[10px] font-semibold h-4 px-1.5 shrink-0">
          {headerInfo.title}
        </Badge>
      }
      footer={
        isFlowDone ? (
          <div className="space-y-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Receita liquidada e fluxo de serviço extra concluído.</span>
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Não há pendências adicionais para este serviço extra.
              </p>
            </div>
            <div className="flex items-center justify-between gap-2">
              {onBack && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 h-8 px-2"
                >
                  ← Voltar aos detalhes
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleClose}
                className={cn("text-xs font-medium h-9", !onBack && "w-full")}
              >
                Fechar
              </Button>
            </div>
          </div>
        ) : modalidadeInfo.isValid && nextAction?.route ? (
          <>
            <Button
              onClick={handleCtaClick}
              className="w-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm h-10"
            >
              <span>{nextAction.label || "Continuar para Financeiro →"}</span>
              <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
              <span>Direciona para o Kanban de Receitas filtrado</span>
              <div className="flex items-center gap-2">
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    Voltar aos detalhes
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Fechar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {!modalidadeInfo.isValid && (
              <div className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-2.5">
                Modalidade financeira não configurada. O serviço foi aprovado, mas não foi possível direcionar automaticamente para o financeiro.
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              {onBack && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onBack}
                  className="text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 h-8 px-2"
                >
                  ← Voltar aos detalhes
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleClose}
                className={cn("text-xs font-medium h-9", !onBack && "w-full")}
              >
                Fechar
              </Button>
            </div>
          </div>
        )
      }
    >
      <div className="space-y-4">
        {/* Card Resumo do Status */}
        <div
          className={cn(
            "rounded-xl border p-4 flex items-start gap-3 transition-colors",
            resultSummary.badgeClass
          )}
        >
          <div className="p-1 rounded-md bg-white/80 dark:bg-black/30 shrink-0">
            <ResultIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold leading-tight">
              {resultSummary.title}
            </h3>
            <p className="mt-1 text-[11px] opacity-90 leading-relaxed">
              {resultSummary.description}
            </p>
          </div>
        </div>

        {/* Dados Essenciais do Serviço */}
        <section className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-border/80 space-y-2.5 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
            Dados do Serviço Extra
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted-foreground">Empresa</div>
                <div className="font-semibold text-foreground truncate">
                  {context?.empresa || "—"}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted-foreground">Competência / Data</div>
                <div className="font-semibold text-foreground truncate">
                  {context?.competencia || context?.data || "—"}
                </div>
              </div>
            </div>
          </div>

          {context?.descricao && (
            <div className="flex items-start gap-2 pt-1">
              <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted-foreground">Descrição do Serviço</div>
                <div className="font-medium text-foreground line-clamp-2">
                  {context.descricao}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
            {valorFormatado && (
              <div className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] text-muted-foreground">Valor</div>
                  <div className="font-bold text-foreground truncate">
                    {valorFormatado}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Receipt className="h-3.5 w-3.5 text-purple-600 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted-foreground">Modalidade</div>
                <div>
                  <Badge variant="outline" className={cn("text-[10px] font-semibold h-4 px-1.5", modalidadeInfo.badgeClass)}>
                    {modalidadeInfo.label}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stepper com os 5 Estágios Canônicos via TimelineVerticalStepper */}
        <TimelineVerticalStepper
          stages={stepperStages}
          isFlowDone={isFlowDone}
          concludedMessage={{
            title: "Receita liquidada e fluxo de serviço extra concluído.",
            description: "O recebimento foi confirmado no financeiro e o ciclo operacional está encerrado.",
          }}
        />
      </div>
    </DrawerSecundarioShell>
  );
};
