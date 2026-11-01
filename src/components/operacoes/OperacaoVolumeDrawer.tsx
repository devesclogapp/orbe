import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Clock,
  Users,
  Package,
  Truck,
  Building2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Edit3,
  Trash2,
  Receipt,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  FileText,
  TrendingUp,
  ArrowRightLeft,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { UxPipelineStepper, PipelineStep } from "@/components/ux-lab/UxPipelineStepper";
import { OperacaoProducaoService } from "@/services/base.service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { supabase } from "@/lib/supabase";

export const OPERACOES_VOLUME_PIPELINE_STEPS: PipelineStep[] = [
  { key: "RECEBIDO", label: "Recebido", shortLabel: "Rec." },
  { key: "EM_VALIDACAO", label: "Validação", shortLabel: "Val." },
  { key: "AGUARDANDO_FATURAMENTO", label: "Aguard. Faturamento", shortLabel: "Faturar" },
  { key: "FATURADO", label: "Faturado", shortLabel: "Fat." },
  { key: "RECEBIDO_FINANCEIRO", label: "Recebido Fin.", shortLabel: "Liq." },
  { key: "CONCLUIDO", label: "Concluído", shortLabel: "Conc." },
];

export interface ColaboradorVinculadoReal {
  id: string;
  collaborator_id?: string;
  nome: string;
  cargo: string;
  cpf?: string | null;
  entrada_ponto?: string | null;
  saida_ponto?: string | null;
  had_infraction?: boolean;
  infraction_notes?: string | null;
}

export interface MaterialConsumidoReal {
  id?: string;
  nome_snapshot: string;
  unidade_snapshot: string;
  quantidade: number;
  valor_unitario_snapshot: number;
  valor_total: number;
}

export interface OperacaoVolumeReal {
  id: string;
  codigo?: string;
  empresa_id: string;
  empresa_nome?: string;
  empresas?: { id?: string; nome?: string } | null;
  unidade_id?: string;
  unidade_nome?: string;
  unidades?: { id?: string; nome?: string } | null;
  data_operacao: string;
  tipo_servico_id?: string;
  tipo_servico_nome?: string;
  tipos_servico_operacional?: { nome?: string } | null;
  transportadora_id?: string;
  transportadora_nome?: string;
  transportadoras_clientes?: { nome?: string } | null;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  fornecedores?: { nome?: string } | null;
  produto_carga_id?: string;
  produto_carga_nome?: string;
  produtos_carga?: { nome?: string } | null;
  placa?: string | null;
  ctrc?: string | null;
  nf_numero?: string | null;
  quantidade_colaboradores: number;
  production_entry_collaborators?: Array<{
    had_infraction?: boolean;
    infraction_type_id?: string | null;
    infraction_notes?: string | null;
    entrada_ponto?: string | null;
    saida_ponto?: string | null;
    colaboradores?: {
      id?: string;
      nome?: string;
      cargo?: string;
      cpf?: string;
    } | null;
  }>;
  entrada_ponto?: string | null;
  saida_ponto?: string | null;
  tipo_calculo_snapshot?: string;
  quantidade: number;
  unidade_medida?: string;
  valor_unitario_snapshot?: number;
  valor_descarga?: number;
  percentual_iss?: number;
  custo_com_iss?: number;
  valor_total_materiais?: number;
  valor_total?: number;
  operacao_producao_materiais?: Array<{
    id?: string;
    material_id?: string;
    nome_snapshot?: string;
    unidade_snapshot?: string;
    valor_unitario_snapshot?: number;
    quantidade?: number;
    valor_total?: number;
  }>;
  status: string;
  status_rh?: string | null;
  status_pagamento?: string | null;
  status_conciliacao?: string | null;
  receita_status?: string | null;
  data_pagamento?: string | null;
  forma_pagamento_id?: string;
  forma_pagamento_nome?: string;
  formas_pagamento_operacional?: { nome?: string } | null;
  modalidadeFinanceira?: string;
  modalidade?: string;
  fatura_referencia?: string | null;
  avaliacao_json?: {
    motivo_restricao?: string | null;
    motivo_devolucao_rh?: string | null;
    responsavel_pendencia?: string | null;
    contexto_importacao?: Record<string, any>;
    [key: string]: any;
  } | null;
  observacao?: string | null;
  responsavel_nome?: string;
  criado_em?: string;
  atualizado_em?: string;
}

interface OperacaoVolumeDrawerProps {
  operacao: OperacaoVolumeReal | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditRequest?: (op: OperacaoVolumeReal) => void;
  onNavigateRh?: () => void;
  onOperacaoUpdated?: (op: OperacaoVolumeReal) => void;
}

const maskCpf = (cpf?: string | null) => {
  if (!cpf) return "—";
  const clean = cpf.replace(/\D/g, "");
  if (clean.length === 11) {
    return `${clean.slice(0, 3)}.***.***-${clean.slice(9)}`;
  }
  return cpf;
};

const formatNotaFiscalLabel = (raw?: string | null) => {
  const val = (raw || "").trim().toUpperCase();
  if (!val || val === "NAO" || val === "NÃO" || val === "0" || val === "FALSE") {
    return "Não Aplicável (Sem retenção ISS)";
  }
  if (val === "SIM" || val === "S" || val === "TRUE") {
    return "Emissão Solicitada (Aguardando número SEFAZ)";
  }
  return `NF ${raw}`;
};

export const renderOperationalStatusBadge = (status: string) => {
  const s = (status || "RECEBIDO").toUpperCase();
  switch (s) {
    case "RECEBIDO":
    case "PENDENTE":
    case "ABERTO":
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
          Recebido
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
    case "INCONSISTENTE":
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
    case "FECHADO":
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

export const renderStatusRhBadge = (statusRh?: string | null) => {
  const s = (statusRh || "PENDENTE_RH").toUpperCase();
  switch (s) {
    case "VALIDADO_RH":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
          <ShieldCheck className="w-3 h-3 text-emerald-600" />
          RH: Validado
        </span>
      );
    case "DEVOLVIDO_RH":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
          <ShieldAlert className="w-3 h-3 text-rose-600" />
          RH: Devolvido
        </span>
      );
    case "EM_ANALISE_RH":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
          <Clock className="w-3 h-3 text-amber-600" />
          RH: Em Análise
        </span>
      );
    case "PENDENTE_RH":
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
          <Clock className="w-3 h-3 text-muted-foreground" />
          RH: Pendente
        </span>
      );
  }
};

export function OperacaoVolumeDrawer({
  operacao: propOperacao,
  open,
  onOpenChange,
  onEditRequest,
  onNavigateRh,
  onOperacaoUpdated,
}: OperacaoVolumeDrawerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAprovando, setIsAprovando] = useState(false);
  const [confirmAprovarOpen, setConfirmAprovarOpen] = useState(false);
  const [operacao, setOperacao] = useState<OperacaoVolumeReal | null>(propOperacao);

  useEffect(() => {
    setOperacao(propOperacao);
  }, [propOperacao]);

  // Contexto de controle de acesso (RBAC canônico do Orbe)
  let userRole = "";
  let isAdmin = false;
  try {
    const ac = useAccessControl();
    userRole = (ac.role || "").toLowerCase();
    isAdmin = Boolean(ac.isAdmin);
  } catch {
    userRole = "";
    isAdmin = false;
  }

  // Perfis autorizados pelo backend (rpc_operacao_validar_aprovar): admin, super_admin, gestor, financeiro
  const canApproveOperation =
    isAdmin || ["admin", "super_admin", "gestor", "financeiro"].includes(userRole);

  const handleNavigateRh = () => {
    onOpenChange(false);
    if (onNavigateRh) {
      onNavigateRh();
    } else {
      navigate(`/rh/aprovacoes?tipo=OPERAÇÃO&empresaId=${operacao?.empresa_id || ""}&operacaoId=${operacao?.id || ""}`, {
        state: { selectedLoteId: operacao?.id, operacaoId: operacao?.id, empresaId: operacao?.empresa_id },
      });
    }
  };

  const handleNavigateReceitas = () => {
    onOpenChange(false);
    navigate(`/financeiro/receitas?operacaoId=${operacao?.id || ""}&empresa=${operacao?.empresa_id || ""}`, {
      state: { highlightOperacaoId: operacao?.id },
    });
  };

  const handleNavigateDre = () => {
    onOpenChange(false);
    const comp = operacao?.data_operacao ? operacao.data_operacao.slice(0, 7) : undefined;
    navigate(`/financeiro/dre?mes=${comp || ""}&empresa=${operacao?.empresa_id || ""}`);
  };

  const isFechadaOuFaturada = [
    "AGUARDANDO_FATURAMENTO",
    "FATURADO",
    "RECEBIDO_FINANCEIRO",
    "CONCLUIDO",
    "FECHADO",
  ].includes((operacao?.status || "").toUpperCase());

  // Consulta canônica da receita vinculada e status real da conciliação bancária (separação de responsabilidade)
  const { data: vinculoReceita } = useQuery({
    queryKey: ["operacao-vinculo-receita", operacao?.id],
    queryFn: async () => {
      if (!operacao?.id) return null;
      const { data, error } = await supabase
        .from("receitas_operacionais_itens")
        .select("id, receita_id, valor_item, receitas_operacionais (id, status, modalidade, valor_total, data_recebimento, created_at)")
        .eq("operacao_id", operacao.id)
        .maybeSingle();

      if (error) {
        return null;
      }
      return data;
    },
    enabled: !!operacao?.id && isFechadaOuFaturada,
    staleTime: 1000 * 30,
  });

  const receitaObj = (vinculoReceita as any)?.receitas_operacionais;
  const statusReceita = (receitaObj?.status || (operacao as any)?.receita_status || "").toLowerCase();

  // Status de conciliação bancária rigorosamente separado do status operacional
  const isConciliado =
    statusReceita === "conciliado" ||
    (operacao as any)?.status_conciliacao === "conciliado";

  const isRecebimentoConfirmado =
    statusReceita === "recebido" ||
    statusReceita === "conciliado" ||
    (operacao?.status_pagamento || "").toUpperCase() === "RECEBIDO" ||
    operacao?.status === "RECEBIDO_FINANCEIRO" ||
    operacao?.status === "CONCLUIDO" ||
    operacao?.status === "FECHADO";

  const handleNavigateConciliacao = () => {
    onOpenChange(false);
    const receitaId = vinculoReceita?.receita_id || receitaObj?.id;
    const receitaParam = receitaId ? `&receita=${receitaId}` : "";
    const empresaParam = operacao?.empresa_id ? `&empresaId=${operacao.empresa_id}` : "";
    navigate(`/financeiro/retorno?tab=receitas&origem=operacoes${empresaParam}${receitaParam}`, {
      state: {
        activeTab: "receitas",
        highlightReceitaId: receitaId,
        empresaId: operacao?.empresa_id,
      },
    });
  };

  if (!operacao) return null;

  const codigo = operacao.codigo || `OP-${operacao.id.slice(0, 8).toUpperCase()}`;
  const empresaNome = operacao.empresa_nome || operacao.empresas?.nome || "Empresa";
  const unidadeNome = operacao.unidade_nome || operacao.unidades?.nome || "Unidade Operacional";
  const tipoServicoNome = operacao.tipo_servico_nome || operacao.tipos_servico_operacional?.nome || "Operação por Volume";
  const fornecedorNome = operacao.fornecedor_nome || operacao.fornecedores?.nome || "—";
  const transportadoraNome = operacao.transportadora_nome || operacao.transportadoras_clientes?.nome || "—";
  const produtoCargaNome = operacao.produto_carga_nome || operacao.produtos_carga?.nome || "—";
  const formaPagamentoNome = operacao.forma_pagamento_nome || operacao.formas_pagamento_operacional?.nome || "Faturamento Padrão";



  const isHorarioIncompleto = !operacao.entrada_ponto || !operacao.saida_ponto;
  const isEmRestricao =
    operacao.status === "EM_RESTRICAO" ||
    operacao.status === "inconsistente" ||
    operacao.status_rh === "DEVOLVIDO_RH" ||
    isHorarioIncompleto;

  const isElegivelAprovacao =
    !isFechadaOuFaturada &&
    !isEmRestricao &&
    ["RECEBIDO", "EM_VALIDACAO", "ABERTO", "PENDENTE"].includes((operacao.status || "").toUpperCase());

  const colaboradoresNominais = (operacao.production_entry_collaborators || []).map((pec, idx) => ({
    id: pec.colaboradores?.id || `col-${idx}`,
    nome: pec.colaboradores?.nome || `Colaborador ${idx + 1}`,
    cargo: pec.colaboradores?.cargo || "Ajudante Operacional",
    cpf: pec.colaboradores?.cpf || null,
    entrada_ponto: pec.entrada_ponto ? pec.entrada_ponto.slice(0, 5) : null,
    saida_ponto: pec.saida_ponto ? pec.saida_ponto.slice(0, 5) : null,
    had_infraction: Boolean(pec.had_infraction),
    infraction_notes: pec.infraction_notes || null,
  }));

  const materiaisConsumidos = (operacao.operacao_producao_materiais || []).map((m) => ({
    id: m.id || m.material_id,
    nome_snapshot: m.nome_snapshot || "Insumo",
    unidade_snapshot: m.unidade_snapshot || "un",
    quantidade: Number(m.quantidade || 0),
    valor_unitario_snapshot: Number(m.valor_unitario_snapshot || 0),
    valor_total: Number(m.valor_total || 0),
  }));

  const motivoRestricao =
    operacao.avaliacao_json?.motivo_restricao ||
    (!operacao.entrada_ponto || !operacao.saida_ponto
      ? "Horário de início e/ou término não informado pelo encarregado."
      : null);
  const motivoDevolucaoRh = operacao.avaliacao_json?.motivo_devolucao_rh || null;

  const valorUnitario = Number(operacao.valor_unitario_snapshot || 0);
  const quantidade = Number(operacao.quantidade || 0);
  const valorDescarga = Number(operacao.valor_descarga ?? quantidade * valorUnitario);
  const valorMateriais = Number(operacao.valor_total_materiais || 0);
  const custoIss = Number(operacao.custo_com_iss || 0);
  const percentualIss = Number(operacao.percentual_iss || 0);
  const valorTotal = Number(operacao.valor_total ?? (valorDescarga + valorMateriais + custoIss));

  const handleDelete = async () => {
    if (isFechadaOuFaturada) {
      toast.error("Operação fechada ou em faturamento não pode ser excluída.");
      return;
    }
    if (!window.confirm("Deseja realmente remover esta operação operacional?")) {
      return;
    }
    setIsDeleting(true);
    try {
      await OperacaoProducaoService.delete(operacao.id, operacao.atualizado_em);
      toast.success("Operação excluída com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["operacoes-producao"] });
      await queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      onOpenChange(false);
    } catch (error: any) {
      toast.error("Erro ao excluir operação", { description: error?.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmAprovar = async () => {
    if (!operacao) return;

    if (!canApproveOperation) {
      toast.error("Permissão Negada", {
        description: "Seu perfil de usuário não possui autorização para aprovação operacional.",
      });
      setConfirmAprovarOpen(false);
      return;
    }

    if (!isElegivelAprovacao) {
      toast.error("Operação Inelegível", {
        description: "Esta operação possui restrições ou já encontra-se processada.",
      });
      setConfirmAprovarOpen(false);
      return;
    }

    setIsAprovando(true);
    try {
      const res = await OperacaoProducaoService.aprovar(
        operacao.id,
        operacao.atualizado_em
      );

      // Recarrega o registro real e íntegro do banco
      const { data: freshRecord, error: freshErr } = await supabase
        .from("operacoes_producao")
        .select(`
          *,
          colaboradores:colaborador_id(nome, cargo),
          production_entry_collaborators(had_infraction, infraction_type_id, infraction_notes, entrada_ponto, saida_ponto, colaboradores:collaborator_id(id, nome, cargo, cpf)),
          tipos_servico_operacional:tipo_servico_id(nome),
          transportadoras_clientes:transportadora_id(nome),
          fornecedores:fornecedor_id(nome),
          produtos_carga:produto_carga_id(nome),
          formas_pagamento_operacional:forma_pagamento_id(nome),
          unidades:unidade_id(nome),
          empresas:empresa_id(id, nome),
          operacao_producao_materiais!operacao_id(*)
        `)
        .eq("id", operacao.id)
        .maybeSingle();

      const updatedRecord: OperacaoVolumeReal = freshRecord && !freshErr
        ? {
          ...operacao,
          ...freshRecord,
          status: freshRecord.status || "AGUARDANDO_FATURAMENTO",
          status_rh: freshRecord.status_rh || "PENDENTE_RH",
          atualizado_em: freshRecord.atualizado_em,
        }
        : {
          ...operacao,
          status: (res as any)?.status || "AGUARDANDO_FATURAMENTO",
          status_rh: (res as any)?.status_rh || "PENDENTE_RH",
          atualizado_em: (res as any)?.updated_at || new Date().toISOString(),
        };

      setOperacao(updatedRecord);
      if (onOperacaoUpdated) {
        onOperacaoUpdated(updatedRecord);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["operacoes-producao"] }),
        queryClient.invalidateQueries({ queryKey: ["operacoes-base"] }),
        queryClient.invalidateQueries({ queryKey: ["operacoes-pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["operacoes"] }),
        queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] }),
        queryClient.invalidateQueries({ queryKey: ["inconsistencias"] }),
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] }),
        queryClient.invalidateQueries({ queryKey: ["aprovacoes-rh"] }),
        queryClient.invalidateQueries({ queryKey: ["aprovacoes-kpis"] }),
      ]);

      toast.success("Operação aprovada com sucesso!", {
        description: "A operação avançou para faturamento e validação pelo RH.",
      });

      setConfirmAprovarOpen(false);
    } catch (error: any) {
      console.error("[OperacaoVolumeDrawer] Erro ao aprovar operação:", error);
      const message = error instanceof Error ? error.message : String(error || "Erro desconhecido");

      if (message.includes("CONCURRENCY_CONFLICT")) {
        toast.error("Conflito de Concorrência", {
          description: "Esta operação foi alterada por outro usuário ou processo. Por favor, recarregue os dados.",
        });
      } else if (
        message.includes("PERMISSION_DENIED") ||
        message.includes("AUTH_REQUIRED") ||
        message.includes("AUTH_PROFILE_INVALID")
      ) {
        toast.error("Permissão Negada", {
          description: "Seu perfil de usuário não possui autorização para aprovação operacional.",
        });
      } else if (message.includes("ESTADO_FECHADO")) {
        toast.error("Operação Imutável", {
          description: "Esta operação já encontra-se processada ou vinculada ao fluxo financeiro.",
        });
      } else if (
        message.includes("OPERACAO_EM_RESTRICAO") ||
        message.includes("HORARIOS_OBRIGATORIOS_AUSENTES") ||
        message.includes("HORARIOS_INVALIDOS")
      ) {
        toast.error("Restrição Operacional", {
          description: "A operação possui pendências operacionais ou horários incompletos.",
        });
      } else if (message.includes("OP_NOT_FOUND") || message.includes("NOT_FOUND_OR_CONFLICT")) {
        toast.error("Operação Não Encontrada", {
          description: "O registro da operação não foi localizado no banco de dados.",
        });
      } else {
        toast.error("Falha ao aprovar operação", {
          description: message,
        });
      }
    } finally {
      setIsAprovando(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl p-0 flex flex-col h-full bg-background border-l border-border shadow-2xl"
      >
        {/* CABEÇALHO DO DRAWER */}
        <SheetHeader className="p-5 border-b border-border bg-card/60 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-bold text-foreground">
                {codigo}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(operacao.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")}
              </span>
              <Badge variant="outline" className="text-[10px] tracking-wide uppercase font-semibold">
                Oficial
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {renderOperationalStatusBadge(operacao.status)}
              {renderStatusRhBadge(operacao.status_rh)}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <SheetTitle className="text-lg font-semibold text-foreground tracking-tight">
              {tipoServicoNome}
            </SheetTitle>
            <span className="text-xs text-muted-foreground">
              por {operacao.responsavel_nome || "Encarregado"}
            </span>
          </div>

          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              {empresaNome}
            </span>
            <span>•</span>
            <span>{unidadeNome}</span>
          </SheetDescription>
        </SheetHeader>

        {/* CORPO ROLÁVEL DO DRAWER */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar-operacoes">
          {/* BANNER DE RESTRIÇÃO / INCONSISTÊNCIA (Se houver) */}
          {isEmRestricao && (
            <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">
                    Operação em Restrição
                  </h4>
                  <p className="text-sm font-medium text-rose-800 dark:text-rose-300 leading-snug">
                    {motivoRestricao || "Restrição operacional detectada nos apontamentos."}
                  </p>
                  {motivoDevolucaoRh && (
                    <p className="text-xs text-rose-700 dark:text-rose-400 bg-white/60 dark:bg-black/30 p-2 rounded border border-rose-200/50 dark:border-rose-900/30 mt-2">
                      <span className="font-semibold">Devolução pelo RH:</span> {motivoDevolucaoRh}
                    </p>
                  )}
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 mt-1">
                    Responsável atual: <span className="font-semibold">{operacao.avaliacao_json?.responsavel_pendencia || "Operação / Doca"}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-rose-200/60 dark:border-rose-900/40">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs border-rose-300 text-rose-800 dark:border-rose-800 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40"
                  onClick={() => {
                    if (onEditRequest) {
                      onEditRequest(operacao);
                    }
                  }}
                >
                  Regularizar apontamento
                </Button>
              </div>
            </div>
          )}

          {/* BANNER DE ASSIMETRIA RH × FINANCEIRO */}
          {isFechadaOuFaturada && operacao.status_pagamento === "RECEBIDO" && operacao.status_rh !== "VALIDADO_RH" && (
            <div className="p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                  <span className="font-semibold">Atenção ao encerramento:</span> O recebimento financeiro já foi confirmado ({operacao.data_pagamento || "recente"}), porém o encerramento do ciclo permanece pendente de validação final pelo RH.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 shrink-0 font-medium"
                onClick={handleNavigateRh}
              >
                Abrir Validação RH
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            </div>
          )}

          {/* ETAPAS DO PROCESSO (ESTEIRA HORIZONTAL DETALHADA) */}
          <div className="rounded-lg border border-border bg-card p-4">
            <UxPipelineStepper
              steps={OPERACOES_VOLUME_PIPELINE_STEPS}
              currentStepKey={operacao.status}
              exceptionState={
                isEmRestricao
                  ? {
                    isException: true,
                    label: "Em Restrição",
                    stepKey: "EM_VALIDACAO",
                    description: motivoRestricao || "Operação com bloqueio operacional",
                  }
                  : null
              }
              variant="detailed"
              subtitle="Acompanhamento da esteira operacional desta operação."
            />
          </div>

          {/* PAINEL DE NAVEGAÇÃO CONTEXTUAL & PRÓXIMA ETAPA */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
                Situação no Processo & Próxima Etapa
              </h4>
              <Badge variant="outline" className="text-[10px] font-semibold">
                {operacao.status === "CONCLUIDO" || operacao.status === "FECHADO"
                  ? isConciliado
                    ? "Ciclo Concluído & Conciliado"
                    : "Concluído (Conciliação Pendente)"
                  : operacao.status === "RECEBIDO_FINANCEIRO"
                    ? isConciliado
                      ? "Recebido & Conciliado"
                      : "Recebido (Conciliação Pendente)"
                    : isFechadaOuFaturada
                      ? "Etapa Financeira / RH"
                      : isEmRestricao
                        ? "Ajuste Operacional"
                        : "Aprovação Operacional"}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-muted/30 p-3 rounded-lg border border-border/60">
              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">Onde está no processo:</span>
                <span className="font-medium text-foreground">
                  {operacao.status === "CONCLUIDO" || operacao.status === "FECHADO"
                    ? isConciliado
                      ? "Ciclo 100% concluído e conciliado"
                      : "Operação concluída — Aguardando conciliação bancária"
                    : operacao.status === "RECEBIDO" || operacao.status === "EM_VALIDACAO" || operacao.status === "ABERTO" || operacao.status === "PENDENTE"
                      ? isEmRestricao
                        ? "Bloqueada por pendência ou horário incompleto"
                        : "Lançamento inicial concluído na doca"
                      : operacao.status === "AGUARDANDO_FATURAMENTO"
                        ? "Aprovada operacionalmente / Pronta para Faturamento"
                        : operacao.status === "FATURADO"
                          ? "Faturada / Título gerado em cobrança"
                          : isConciliado
                            ? "Recebimento financeiro conciliado"
                            : "Recebimento confirmado no Financeiro"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">Responsável atual:</span>
                <span className="font-medium text-foreground">
                  {operacao.status === "CONCLUIDO" || operacao.status === "FECHADO"
                    ? isConciliado
                      ? "Processo finalizado (Sem ações pendentes)"
                      : "Controladoria / Conciliação Bancária"
                    : operacao.status === "RECEBIDO" || operacao.status === "EM_VALIDACAO"
                      ? isEmRestricao
                        ? "Encarregado / Operação (Doca)"
                        : "Gestor / Supervisor Operacional"
                      : operacao.status === "AGUARDANDO_FATURAMENTO"
                        ? "Financeiro (Faturamento) & RH (Validação de Folha)"
                        : operacao.status === "FATURADO"
                          ? "Financeiro (Cobrança) & RH (se pendente)"
                          : isConciliado
                            ? "Processo finalizado"
                            : "Conciliação Bancária / Controladoria"}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">O que já foi concluído:</span>
                <span className="text-muted-foreground">
                  {operacao.status === "CONCLUIDO" || operacao.status === "FECHADO"
                    ? isConciliado
                      ? "Execução física, aprovação operacional, validação RH, faturamento, recebimento financeiro e conciliação bancária."
                      : "Execução física, aprovação operacional, validação RH, faturamento e confirmação de recebimento."
                    : operacao.status === "RECEBIDO" || operacao.status === "EM_VALIDACAO"
                      ? "Registro de volumes, cliente, insumos e apontamento de equipe."
                      : operacao.status === "AGUARDANDO_FATURAMENTO"
                        ? "Execução física conferida e aprovada pela supervisão operacional."
                        : operacao.status === "FATURADO"
                          ? "Execução aprovada e receita classificada/faturada."
                          : isConciliado
                            ? "Execução, faturamento, recebimento e conciliação bancária."
                            : "Execução, faturamento e confirmação de recebimento financeiro."}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-muted-foreground block">O que falta fazer:</span>
                <span className="text-muted-foreground">
                  {operacao.status === "CONCLUIDO" || operacao.status === "FECHADO"
                    ? isConciliado
                      ? "Nenhuma pendência. Crédito conciliado no extrato e ciclo arquivado."
                      : "Localizar crédito no extrato bancário e confirmar a conciliação na Central Bancária."
                    : operacao.status === "RECEBIDO" || operacao.status === "EM_VALIDACAO"
                      ? isEmRestricao
                        ? "Regularizar horários e apontamentos para liberar aprovação."
                        : "Supervisor/Gestor confirmar aprovação operacional."
                      : operacao.status === "AGUARDANDO_FATURAMENTO"
                        ? "Faturar título no módulo de Receitas e validar no RH."
                        : operacao.status === "FATURADO"
                          ? "Aguardar liquidação pelo cliente e validação RH."
                          : isConciliado
                            ? "Ciclo financeiro liquidado."
                            : "Conciliar crédito no extrato bancário."}
                </span>
              </div>
            </div>

            {/* Ações contextuais de avanço / encaminhamento centralizadas */}
            <div className="flex items-center justify-end gap-2 pt-1 flex-wrap">
              {isFechadaOuFaturada && (
                <>
                  {/* Se recebido/concluído mas conciliação ainda pendente: ação primária prioritária é Abrir Conciliação */}
                  {isRecebimentoConfirmado && !isConciliado && (
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleNavigateConciliacao}
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Abrir Conciliação
                    </Button>
                  )}

                  {/* Se aguardando faturamento ou faturado: ação primária é Acompanhar em Receitas */}
                  {(operacao.status === "AGUARDANDO_FATURAMENTO" || operacao.status === "FATURADO") && (
                    <Button
                      size="sm"
                      className="h-8 text-xs font-semibold gap-1.5 bg-royal-blue hover:bg-royal-blue/90 text-white"
                      onClick={handleNavigateReceitas}
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      Acompanhar em Receitas
                    </Button>
                  )}

                  {/* Validação RH se pendente */}
                  {operacao.status !== "CONCLUIDO" && operacao.status !== "FECHADO" && operacao.status_rh !== "VALIDADO_RH" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-medium gap-1.5 border-amber-300 text-amber-900 dark:border-amber-700 dark:text-amber-200"
                      onClick={handleNavigateRh}
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                      Ir para Validação RH
                    </Button>
                  )}

                  {/* Ação secundária: Ver em Receitas (quando recebimento já confirmado) */}
                  {isRecebimentoConfirmado && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-medium gap-1.5"
                      onClick={handleNavigateReceitas}
                    >
                      <Receipt className="w-3.5 h-3.5 text-royal-blue" />
                      Ver em Receitas
                    </Button>
                  )}

                  {/* Ver no DRE: Ação primária se conciliado, ou secundária se pendente de conciliação */}
                  {isRecebimentoConfirmado && (
                    <Button
                      size="sm"
                      variant={isConciliado ? "default" : "outline"}
                      className={`h-8 text-xs gap-1.5 ${isConciliado
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          : "font-medium"
                        }`}
                      onClick={handleNavigateDre}
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      Ver no DRE
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 1. CONTEXTO OPERACIONAL */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-royal-blue dark:text-royal-blue-light" />
              Contexto da Carga & Transporte
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-card p-3.5 rounded-lg border border-border text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Fornecedor / Cliente</span>
                <span className="font-semibold text-foreground text-sm">{fornecedorNome}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Transportadora</span>
                <span className="font-semibold text-foreground">{transportadoraNome}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Placa do Veículo</span>
                <span className="font-mono font-bold text-foreground text-sm">{operacao.placa || "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Produto da Carga</span>
                <span className="text-foreground">{produtoCargaNome}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Volume Movimentado</span>
                <span className="font-bold text-foreground text-sm">
                  {quantidade.toLocaleString("pt-BR")} {operacao.unidade_medida || "cx"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Documento Fiscal</span>
                <span className="text-foreground font-medium">
                  {formatNotaFiscalLabel(operacao.nf_numero)}
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
                <span className="font-mono font-medium text-foreground">
                  {operacao.entrada_ponto ? operacao.entrada_ponto.slice(0, 5) : "Não informado"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Término na Doca</span>
                <span className="font-mono font-medium text-foreground">
                  {operacao.saida_ponto ? operacao.saida_ponto.slice(0, 5) : "Não informado"}
                </span>
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
                {operacao.status_rh !== "VALIDADO_RH" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[11px] text-royal-blue dark:text-royal-blue-light hover:underline p-0 px-1 flex items-center gap-1 font-medium"
                    onClick={handleNavigateRh}
                  >
                    Abrir Validação RH
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                )}
                <span className="text-muted-foreground">Headcount:</span>
                <span className="font-bold text-foreground px-2 py-0.5 bg-muted rounded border border-border">
                  {operacao.quantidade_colaboradores || 1}
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">Nominais:</span>
                <span className="font-bold text-foreground">
                  {colaboradoresNominais.length}
                </span>
              </div>
            </div>

            {operacao.quantidade_colaboradores !== colaboradoresNominais.length && (
              <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded border border-border/60">
                <Info className="w-3 h-3 inline-block mr-1 text-muted-foreground" />
                Divergência entre headcount total declarado ({operacao.quantidade_colaboradores}) e colaboradores vinculados nominalmente ({colaboradoresNominais.length}). Comum quando há chapas avulsos ou terceiros sem cadastro prévio.
              </p>
            )}

            <div className="bg-card rounded-lg border border-border divide-y divide-border overflow-hidden">
              {colaboradoresNominais.length > 0 ? (
                colaboradoresNominais.map((colab) => (
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
                        <span className="font-mono text-muted-foreground">{maskCpf(colab.cpf)}</span>
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
                  Nenhum colaborador individual vinculado nominalmente (Qtd declarada: {operacao.quantidade_colaboradores || 1}).
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
                <span>Valor Unitário Aplicado:</span>
                <span className="font-mono font-medium text-foreground">
                  R$ {valorUnitario.toFixed(2)} / {operacao.unidade_medida || "cx"}
                </span>
              </div>
              <Separator />

              {/* Subtotais */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-foreground">
                  <span>Descarga ({quantidade} × R$ {valorUnitario.toFixed(2)})</span>
                  <span className="font-mono font-medium">R$ {valorDescarga.toFixed(2)}</span>
                </div>

                {valorMateriais > 0 && (
                  <div className="flex justify-between text-foreground">
                    <span className="flex items-center gap-1">
                      Materiais / Insumos
                      {materiaisConsumidos.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          ({materiaisConsumidos.map(m => `${m.quantidade} ${m.unidade_snapshot} de ${m.nome_snapshot}`).join(", ")})
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-medium">R$ {valorMateriais.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between text-foreground">
                  <span>ISS ({percentualIss > 0 ? `${(percentualIss * 100).toFixed(0)}%` : "0%"})</span>
                  <span className="font-mono font-medium">R$ {custoIss.toFixed(2)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-baseline pt-1">
                <span className="font-bold text-sm text-foreground">Valor Total da Operação</span>
                <span className="font-mono font-bold text-base text-foreground">
                  R$ {valorTotal.toFixed(2)}
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
                  {formaPagamentoNome}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Relação Financeira:</span>
                <span className="text-foreground font-medium">
                  {operacao.modalidadeFinanceira === "FECHAMENTO_MENSAL_EMPRESA" || operacao.modalidade === "FATURAMENTO_MENSAL"
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
            </div>
          </div>
        </div>

        {/* RODAPÉ DO DRAWER COM AÇÕES REAIS */}
        <SheetFooter className="p-4 border-t border-border bg-card/80 flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            {!isFechadaOuFaturada && (
              <Button
                variant="outline"
                size="sm"
                disabled={isDeleting || isAprovando}
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border-border"
                onClick={handleDelete}
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1" />}
                Excluir
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {canApproveOperation && isElegivelAprovacao && (
              <Button
                size="sm"
                disabled={isAprovando}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
                onClick={() => setConfirmAprovarOpen(true)}
              >
                {isAprovando ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Aprovar Operação
              </Button>
            )}

            {!canApproveOperation && isElegivelAprovacao && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button
                        size="sm"
                        disabled
                        className="bg-muted text-muted-foreground cursor-not-allowed opacity-60 text-xs font-medium"
                      >
                        <ShieldAlert className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
                        Aprovação Restrita ao Gestor
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">
                      Seu perfil de usuário ({userRole || "operacional"}) não possui autorização para aprovação operacional.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}



            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant={isFechadaOuFaturada ? "outline" : "default"}
                      size="sm"
                      disabled={isFechadaOuFaturada || isAprovando}
                      className={!isFechadaOuFaturada ? "bg-royal-blue hover:bg-royal-blue/90 text-white" : ""}
                      onClick={() => {
                        if (onEditRequest) {
                          onEditRequest(operacao);
                        }
                      }}
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
              disabled={isAprovando}
              onClick={() => onOpenChange(false)}
            >
              Fechar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>

      {/* MODAL DE CONFIRMAÇÃO DE APROVAÇÃO OPERACIONAL */}
      <AlertDialog open={confirmAprovarOpen} onOpenChange={setConfirmAprovarOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              Aprovar Operação Operacional?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed space-y-2 pt-1">
              <p>
                Deseja confirmar a execução operacional da operação{" "}
                <strong className="text-foreground font-mono">{codigo}</strong> referente a{" "}
                <strong className="text-foreground">{tipoServicoNome}</strong> (
                {Number(operacao.quantidade || 0).toLocaleString("pt-BR")}{" "}
                {operacao.unidade_medida || "cx"}) no valor de{" "}
                <strong className="text-foreground">
                  {valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </strong>{" "}
                na empresa <strong className="text-foreground">{empresaNome}</strong>?
              </p>
              <p className="bg-muted/60 p-2.5 rounded border border-border">
                Esta ação validará os horários e apontamentos da equipe na doca e avançará a operação para as etapas de{" "}
                <strong className="text-foreground">Faturamento / Receitas</strong> e{" "}
                <strong className="text-foreground">Validação pelo RH</strong>.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="pt-2">
            <AlertDialogCancel disabled={isAprovando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirmAprovar();
              }}
              disabled={isAprovando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {isAprovando ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aprovando...
                </>
              ) : (
                "Confirmar Aprovação"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
