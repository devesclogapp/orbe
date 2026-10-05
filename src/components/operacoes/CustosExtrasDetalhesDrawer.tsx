import React from "react";
import { useNavigate } from "react-router-dom";
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
import { UxPipelineStepper, PipelineStepConfig } from "@/components/ux-lab/UxPipelineStepper";

export interface CustoExtraItemReal {
  id: string;
  data?: string | null;
  empresa_id?: string | null;
  empresa_nome?: string | null;
  empresas?: { nome?: string | null } | null;
  unidades?: { nome?: string | null } | null;
  unidade_id?: string | null;
  unidade_nome?: string | null;
  categoria_custo: string;
  descricao: string;
  valor_unitario?: number | null;
  quantidade?: number | null;
  total?: number | null;
  forma_pagamento?: string | null;
  forma_pagamento_id?: string | null;
  forma_pagamento_ref?: { nome?: string | null } | null;
  data_vencimento?: string | null;
  status_pagamento?: string | null;
  operacao_id?: string | null;
  tipo_lancamento?: string | null;
  origem_dado?: string | null;
  origem_recurso?: "PAGO_EMPRESA" | "REEMBOLSO_COLABORADOR" | "PAGAMENTO_PENDENTE" | "LEGACY" | null;
  favorecido_colaborador_id?: string | null;
  favorecido_fornecedor_id?: string | null;
  favorecido_colaborador?: { nome?: string | null } | null;
  favorecido_fornecedor?: { nome?: string | null } | null;
  pipeline_status?: "RECEBIDO" | "EM_VALIDACAO" | "APROVADO_OPERACAO" | "REPROVADO" | "ENVIADO_FINANCEIRO" | "FINALIZADO" | null;
  justificativa_devolucao?: string | null;
  responsavel?: { full_name?: string | null } | null;
  responsavel_nome?: string | null;
  observacao?: string | null;
  atualizado_em?: string | null;
  criado_em?: string | null;
}

export const CUSTOS_EXTRAS_PIPELINE_STEPS: readonly PipelineStepConfig[] = [
  {
    key: "RECEBIDO",
    label: "Recebido",
    shortLabel: "Recebido",
    responsible: "Encarregado",
    description: "Custo extra registrado e capturado pelo sistema.",
  },
  {
    key: "EM_VALIDACAO",
    label: "Em validação",
    shortLabel: "Validação",
    responsible: "Operação / ADM",
    description: "Análise técnica operacional e conferência de dados.",
  },
  {
    key: "APROVADO_OPERACAO",
    label: "Aprovado",
    shortLabel: "Aprovado",
    responsible: "Gestor Operacional",
    description: "Despesa aprovada operacionalmente para pagamento.",
  },
  {
    key: "ENVIADO_FINANCEIRO",
    label: "Financeiro",
    shortLabel: "Financeiro",
    responsible: "Financeiro",
    description: "Disponível na Central de Pagamentos para liquidação.",
  },
  {
    key: "FINALIZADO",
    label: "Finalizado",
    shortLabel: "Finalizado",
    responsible: "Financeiro",
    description: "Despesa liquidada e fluxo operacional concluído.",
  },
] as const;

export function getFriendlyOrigemRecurso(origem?: string | null): string {
  switch (origem) {
    case "PAGO_EMPRESA":
      return "Pago pela Empresa";
    case "REEMBOLSO_COLABORADOR":
      return "Reembolso";
    case "PAGAMENTO_PENDENTE":
      return "Pagamento a Fornecedor";
    case "LEGACY":
      return "Registro Legado";
    default:
      return origem || "Não informado";
  }
}

export function getFriendlyPipelineStatus(status?: string | null): string {
  switch (status) {
    case "RECEBIDO":
      return "Recebido";
    case "EM_VALIDACAO":
      return "Em Validação";
    case "APROVADO_OPERACAO":
      return "Aprovado Operação";
    case "ENVIADO_FINANCEIRO":
      return "Enviado ao Financeiro";
    case "FINALIZADO":
      return "Finalizado";
    case "REPROVADO":
      return "Reprovado";
    default:
      return status || "Pendente";
  }
}

export function getFriendlyStatusPagamento(status?: string | null): string {
  switch (status) {
    case "A_PAGAR":
      return "A Pagar";
    case "PAGO":
      return "Pago";
    case "ATRASADO":
      return "Atrasado";
    case "CANCELADO":
      return "Cancelado";
    default:
      return status || "Pendente";
  }
}

export function getFriendlyCategoria(cat?: string | null): string {
  switch (cat) {
    case "OPERACIONAL":
      return "Operacional";
    case "ADMINISTRATIVO":
      return "Administrativo";
    case "MERENDA":
    case "MERENDA/LANCHE":
      return "Merenda / Lanche";
    case "MANUTENCAO":
      return "Manutenção";
    case "TRANSPORTE":
      return "Transporte";
    case "COMUNICACAO":
      return "Comunicação";
    case "OUTROS":
      return "Outros Custos";
    default:
      return cat || "Outros";
  }
}

export interface CustosExtrasDetalhesDrawerProps {
  custo: CustoExtraItemReal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReabrirForm?: () => void;
}

export function CustosExtrasDetalhesDrawer({
  custo,
  open,
  onOpenChange,
  onReabrirForm,
}: CustosExtrasDetalhesDrawerProps) {
  const navigate = useNavigate();

  if (!custo) return null;

  const pipelineStatus = custo.pipeline_status || "RECEBIDO";
  const statusPagamento = custo.status_pagamento || (custo.origem_recurso === "PAGO_EMPRESA" ? "PAGO" : "A_PAGAR");
  const origemRecurso = custo.origem_recurso || "PAGO_EMPRESA";

  const isAprovadoOuProtegido = [
    "APROVADO_OPERACAO",
    "ENVIADO_FINANCEIRO",
    "FINALIZADO"
  ].includes(pipelineStatus);

  // Formatação de Moeda
  const formatCurrency = (val?: number | null) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL"
    }).format(Number.isFinite(val) ? (val as number) : 0);
  };

  // Formatação de Data
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const cleanDate = String(dateStr).split("T")[0];
    const parts = cleanDate.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // Código formatado para apresentação
  const displayCode = custo.id ? `CE-${custo.id.substring(0, 8).toUpperCase()}` : "CE-000";
  const empresaNome = custo.empresas?.nome || custo.empresa_nome || "Empresa";
  const unidadeNome = custo.unidades?.nome || custo.unidade_nome || "Unidade Operacional";
  const formaPagamentoNome = custo.forma_pagamento_ref?.nome || custo.forma_pagamento || "Forma de Pagamento Padrão";
  const colaboradorFavorecidoNome = custo.favorecido_colaborador?.nome || (custo as any).favorecido_colaborador_nome || "Colaborador";
  const fornecedorFavorecidoNome = custo.favorecido_fornecedor?.nome || (custo as any).favorecido_fornecedor_nome || "Fornecedor";

  // Diagnóstico derivado com dados factuais
  const getDiagnostico = () => {
    switch (pipelineStatus) {
      case "REPROVADO":
        return {
          responsavelAtual: custo.responsavel_nome || "Encarregado / Solicitante",
          proximoPasso: "Apresentar comprovante fiscal válido ou ajustar solicitação de despesa.",
          orientacaoOperacional: "Bloqueio impeditivo. Nenhum pagamento será efetuado enquanto a pendência persistir.",
        };
      case "RECEBIDO":
        return {
          responsavelAtual: "Gestor Operacional / RH",
          proximoPasso: "Atestar recibo e encaminhar para validação de despesa extraordinária.",
          orientacaoOperacional: origemRecurso === "PAGO_EMPRESA"
            ? "Despesa desembolsada no ato pela empresa. Não gera passivo futuro após aprovação."
            : "Lançamento recebido em campo aguardando primeira conferência operacional.",
        };
      case "EM_VALIDACAO":
        return {
          responsavelAtual: "Supervisão Operacional / ADM",
          proximoPasso: "Validar nota fiscal e homologar conclusão da despesa.",
          orientacaoOperacional: "Conferência técnica e comprovação de valores em andamento.",
        };
      case "APROVADO_OPERACAO":
        return {
          responsavelAtual: "Central de Despesas / Financeiro",
          proximoPasso: "Enviar para fila de pagamentos e liquidação.",
          orientacaoOperacional: "Valores operacionais protegidos após aprovação.",
        };
      case "ENVIADO_FINANCEIRO":
        return {
          responsavelAtual: "Contas a Pagar / Tesouraria",
          proximoPasso: "Agendar pagamento no banco e realizar baixa após conciliação.",
          orientacaoOperacional: `Obrigação financeira confirmada para o favorecido.${custo.data_vencimento ? ` Vencimento em ${formatDate(custo.data_vencimento)}.` : ""}`,
        };
      case "FINALIZADO":
      default:
        return {
          responsavelAtual: "Ciclo Concluído",
          proximoPasso: "Nenhuma ação pendente. Registro consolidado no resultado operacional.",
          orientacaoOperacional: "Despesa quitada e ciclo operacional concluído.",
        };
    }
  };

  const diagnostico = getDiagnostico();

  // Helper de Badge de Pipeline Status
  const renderPipelineBadge = (status: string) => {
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

  // Helper de Badge de Status Pagamento
  const renderPagamentoBadge = (pag: string, origem?: string | null) => {
    if (origem === "PAGO_EMPRESA" || pag === "PAGO") {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Pago
        </span>
      );
    }
    switch (pag) {
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

  // Handlers de Despacho
  const handleDespachoAprovacoes = () => {
    onOpenChange(false);
    navigate("/rh/aprovacoes?flowType=CUSTO EXTRA");
  };

  const handleDespachoFinanceiro = () => {
    onOpenChange(false);
    navigate("/financeiro?tab=custos-extras");
  };

  const handleConsultarPagamento = () => {
    onOpenChange(false);
    navigate("/financeiro?tab=custos-extras");
  };

  const handleResolverPendencia = () => {
    onOpenChange(false);
    if (onReabrirForm) {
      onReabrirForm();
    } else {
      navigate("/operacional/custos-extras?action=novo-custo-extra");
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
          <SheetTitle className="sr-only">
            Detalhes do Custo Extra {displayCode}
          </SheetTitle>
          <SheetDescription className="sr-only">
            Diagnóstico e informações detalhadas da despesa operacional
          </SheetDescription>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-royal-blue dark:text-royal-blue-light">
                {displayCode}
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
                {renderPipelineBadge(pipelineStatus)}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Pagamento:
                </span>
                {renderPagamentoBadge(statusPagamento, origemRecurso)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <div className="flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span className="font-medium text-foreground">{empresaNome}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>Data do custo: <strong className="text-foreground">{formatDate(custo.data)}</strong></span>
            </div>
            <span>•</span>
            <span>{unidadeNome}</span>
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
                {getFriendlyPipelineStatus(pipelineStatus)}
              </Badge>
            </div>

            {/* SE REPROVADO: DESTAQUE CLARO DA JUSTIFICATIVA DE DEVOLUÇÃO */}
            {pipelineStatus === "REPROVADO" && (
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
                  {diagnostico.responsavelAtual}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Próximo Passo Recomendado
                </span>
                <span className="font-medium text-foreground">
                  {diagnostico.proximoPasso}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              <span className="font-medium text-foreground">Orientação Operacional: </span>
              {diagnostico.orientacaoOperacional}
            </div>
          </div>

          {/* SEÇÃO 2: ETAPAS DO PROCESSO (ESTEIRA HORIZONTAL DETALHADA) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <UxPipelineStepper
              steps={CUSTOS_EXTRAS_PIPELINE_STEPS as any}
              currentStepKey={pipelineStatus}
              exceptionState={
                pipelineStatus === "REPROVADO"
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
                  origemRecurso === "PAGO_EMPRESA"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                    : origemRecurso === "REEMBOLSO_COLABORADOR"
                    ? "border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                    : origemRecurso === "PAGAMENTO_PENDENTE"
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40"
                    : "border-border text-muted-foreground"
                }`}
              >
                {getFriendlyOrigemRecurso(origemRecurso)}
              </Badge>
            </div>

            {/* CASO A: PAGO_EMPRESA */}
            {origemRecurso === "PAGO_EMPRESA" && (
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
                  Meio de pagamento utilizado: <strong className="text-foreground">{formaPagamentoNome}</strong>
                </div>
              </div>
            )}

            {/* CASO B: REEMBOLSO_COLABORADOR */}
            {origemRecurso === "REEMBOLSO_COLABORADOR" && (
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
                      {colaboradorFavorecidoNome}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Forma de Reembolso
                    </span>
                    <span className="font-medium text-foreground">
                      {formaPagamentoNome}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CASO C: PAGAMENTO_PENDENTE */}
            {origemRecurso === "PAGAMENTO_PENDENTE" && (
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
                      {fornecedorFavorecidoNome}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Data de Vencimento
                    </span>
                    <span className={`font-bold ${statusPagamento === "ATRASADO" ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}>
                      {formatDate(custo.data_vencimento)}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[10px] font-semibold text-muted-foreground block">
                      Condição / Forma de Pagamento
                    </span>
                    <span className="font-medium text-foreground">
                      {formaPagamentoNome}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* CASO D: LEGACY */}
            {origemRecurso === "LEGACY" && (
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

          {/* SEÇÃO 4: DESPESA & CONTEXTO */}
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
                  <span className="text-xs text-foreground font-medium">
                    {custo.responsavel_nome || "Responsável Operacional"}
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

          {/* SEÇÃO 5: COMPOSIÇÃO DO VALOR */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Composição do Valor
            </span>
            <div className="flex items-center justify-between text-xs py-1 border-b border-border/40">
              <span className="text-muted-foreground">Quantidade Adquirida:</span>
              <span className="font-mono font-semibold text-foreground">
                {custo.quantidade ?? 1} un
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
              {custo.quantidade ?? 1} × {formatCurrency(custo.valor_unitario)} = {formatCurrency(custo.total)}
            </div>
          </div>

          {/* SEÇÃO 6: FLUXO FINANCEIRO */}
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
                  {getFriendlyPipelineStatus(pipelineStatus)}
                </span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground block">
                  Situação Financeira
                </span>
                <span className="font-semibold text-foreground">
                  {getFriendlyStatusPagamento(statusPagamento)}
                </span>
              </div>
            </div>

            {/* Detalhe da obrigação futura se for a pagar */}
            {statusPagamento === "A_PAGAR" && origemRecurso !== "PAGO_EMPRESA" && (
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
                    {colaboradorFavorecidoNome || fornecedorFavorecidoNome || "—"}
                  </strong>
                </div>
              </div>
            )}

            {statusPagamento === "ATRASADO" && (
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

            {(statusPagamento === "PAGO" || origemRecurso === "PAGO_EMPRESA") && (
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

          {/* SEÇÃO 7: INTEGRIDADE */}
          {isAprovadoOuProtegido && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/40 dark:bg-emerald-950/10 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                Valores operacionais e favorecido protegidos contra alteração após aprovação.
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
            {pipelineStatus === "REPROVADO" && (
              <Button
                size="sm"
                className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1.5"
                onClick={handleResolverPendencia}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Resolver pendência
              </Button>
            )}

            {(pipelineStatus === "RECEBIDO" || pipelineStatus === "EM_VALIDACAO") && (
              <Button
                size="sm"
                className="text-xs h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-medium flex items-center gap-1.5"
                onClick={handleDespachoAprovacoes}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                Ir para Aprovações
              </Button>
            )}

            {(pipelineStatus === "APROVADO_OPERACAO" || pipelineStatus === "ENVIADO_FINANCEIRO") && statusPagamento !== "PAGO" && origemRecurso !== "PAGO_EMPRESA" && (
              <Button
                size="sm"
                className="text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-medium flex items-center gap-1.5"
                onClick={handleDespachoFinanceiro}
              >
                <Receipt className="w-3.5 h-3.5" />
                Abrir no Financeiro
              </Button>
            )}

            {statusPagamento === "PAGO" && origemRecurso !== "PAGO_EMPRESA" && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-8 text-muted-foreground hover:text-foreground font-medium flex items-center gap-1.5 border-border"
                onClick={handleConsultarPagamento}
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
