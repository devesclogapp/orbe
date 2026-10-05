import React, { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Wrench,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Receipt,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  ShieldCheck,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  Users,
  Coins,
  Loader2,
  Package,
  PlayCircle,
  FileSpreadsheet,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import {
  EmpresaService,
  ServicosExtrasOperacionaisService,
  TipoServicoOperacionalService,
} from "@/services/base.service";
import { useTenant } from "@/contexts/TenantContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import {
  useOperationalPipeline,
  buildServicosExtrasPipeline,
  buildServicosExtrasDevolvidoPipeline,
  type ServicoExtraStepId,
} from "@/contexts/OperationalPipelineContext";
import { ServicoExtraDetalhesDrawer, ServicoExtraItemData } from "@/components/operacoes/ServicoExtraDetalhesDrawer";
import { ServicosExtrasContinuityDrawer } from "@/components/operacoes/ServicosExtrasContinuityDrawer";
import { NovoServicoExtraDialog } from "@/components/operacoes/NovoServicoExtraDialog";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { cn } from "@/lib/utils";

// ─── Constants & Options ────────────────────────────────────────────────────────

export const PIPELINE_STATUS_FILTER_OPTIONS = [
  { id: "todos", label: "Todos os Status", value: "todos" },
  { id: "pendente", label: "Pendente", value: "PENDENTE" },
  { id: "em_validacao", label: "Em Validação", value: "EM_VALIDACAO" },
  { id: "devolvido", label: "Devolvido (Ajuste)", value: "DEVOLVIDO" },
  { id: "aprovado_operacao", label: "Aprovado Operação", value: "APROVADO_OPERACAO" },
  { id: "aprovado_financeiro", label: "Aprovado Financeiro", value: "APROVADO_FINANCEIRO" },
  { id: "faturado", label: "Faturado", value: "FATURADO" },
  { id: "concluido", label: "Concluído", value: "CONCLUIDO" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrency = (val: number) => currencyFormatter.format(Number.isFinite(val) ? val : 0);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("T")[0].split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

// Map pipeline_status → ServicoExtraStepId
const pipelineStatusToStepId = (status: string | null | undefined): ServicoExtraStepId => {
  switch (status) {
    case "EM_VALIDACAO":
      return "validacao_operacional";
    case "APROVADO_OPERACAO":
      return "aprovacao";
    case "APROVADO_FINANCEIRO":
      return "financeiro";
    case "FATURADO":
      return "faturamento";
    case "CONCLUIDO":
      return "concluido";
    default:
      return "lancamento";
  }
};

const getNextStatus = (current: string | null | undefined): string | null => {
  switch (current ?? "PENDENTE") {
    case "PENDENTE":
    case "DEVOLVIDO":
    case "RECUSADO":
    case "EM_ANALISE":
      return "EM_VALIDACAO";
    case "EM_VALIDACAO":
      return "APROVADO_OPERACAO";
    case "APROVADO_OPERACAO":
      return "APROVADO_FINANCEIRO";
    case "APROVADO_FINANCEIRO":
      return "FATURADO";
    case "FATURADO":
      return "CONCLUIDO";
    default:
      return null;
  }
};

export default function ServicosExtrasRecebidos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { tenantId, loading: isTenantLoading } = useTenant();
  const { role, isAdmin } = useAccessControl();
  const { openPipeline } = useOperationalPipeline();

  // Filtros de Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [pipelineStatusFiltro, setPipelineStatusFiltro] = useState<string>("todos");
  const [tipoServicoFiltro, setTipoServicoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState<string>("");

  // Modais e Drawers
  const [isNovoServicoModalOpen, setIsNovoServicoModalOpen] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<ServicoExtraItemData | null>(null);
  const [isFlowDrawerOpen, setIsFlowDrawerOpen] = useState(false);

  // Navegação Interativa pelos Cards de Síntese
  const [activeKpiNav, setActiveKpiNav] = useState<"todos" | "requer_acao" | "financeiro" | "concluidos">("todos");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [cycleIndices, setCycleIndices] = useState<Record<string, number>>({
    requerAcao: 0,
    aguardandoFinanceiro: 0,
    faturadosConcluidos: 0,
  });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Modal de Justificativa para Devolução
  const [justificationModal, setJustificationModal] = useState<{
    open: boolean;
    itemId: string | null;
  }>({ open: false, itemId: null });

  // URL Action: ?action=novo-servico-extra
  useEffect(() => {
    if (searchParams.get("action") === "novo-servico-extra") {
      setServiceToEdit(null);
      setIsNovoServicoModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("action");
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  // Listener para evento customizado de edição
  useEffect(() => {
    const handleOpenEdit = (e: any) => {
      setServiceToEdit(e.detail);
      setIsNovoServicoModalOpen(true);
    };
    window.addEventListener("open-edit-servico-extra", handleOpenEdit);
    return () => window.removeEventListener("open-edit-servico-extra", handleOpenEdit);
  }, []);

  // Reset de ciclos ao alterar filtros contextuais ou de busca
  useEffect(() => {
    setCycleIndices({
      requerAcao: 0,
      aguardandoFinanceiro: 0,
      faturadosConcluidos: 0,
    });
  }, [empresaFiltro, tipoServicoFiltro, pipelineStatusFiltro, filtroTemporal, busca]);

  // ─── 1. Queries Oficiais do Supabase (Zero Mock) ──────────────────────────────

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas", tenantId],
    queryFn: () => EmpresaService.getAll(),
    enabled: !isTenantLoading,
  });

  const { data: todosTiposServico = [] } = useQuery({
    queryKey: ["tipos_servico_operacional"],
    queryFn: () => TipoServicoOperacionalService.getAllActive(),
  });

  const tiposServicoExtras = useMemo(() =>
    (todosTiposServico as any[]).filter(t => t.is_extra_service),
    [todosTiposServico]
  );

  const {
    data: servicosRaw = [],
    isLoading: isLoadingServicos,
    isError: isErrorServicos,
    refetch: refetchServicos,
  } = useQuery({
    queryKey: ["servicos_extras_historico", empresaFiltro, tenantId],
    queryFn: () =>
      ServicosExtrasOperacionaisService.getWithEmpresas(
        empresaFiltro === "todas" || empresaFiltro === "all" ? undefined : empresaFiltro
      ).catch(() => []),
    placeholderData: (previousData) => previousData,
  });

  // ─── 2. Contexto Macro: Empresa + Período Temporal ────────────────────────────

  const servicosContextuais = useMemo(() => {
    return (servicosRaw || []).filter((s: any) => {
      // 1. Filtro de Empresa
      if (empresaFiltro !== "todas" && empresaFiltro !== "all" && s.empresa_id !== empresaFiltro) {
        return false;
      }

      // 2. Filtro Temporal Híbrido baseado estritamente na data de prestação do serviço
      const dataServico = String(s.data || "").split("T")[0];
      if (!dataServico) return false;

      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje") {
          const today = format(new Date(), "yyyy-MM-dd");
          if (dataServico !== today) return false;
        } else if (filtroTemporal.preset === "mes-atual") {
          const currentMonth = format(new Date(), "yyyy-MM");
          if (!dataServico.startsWith(currentMonth)) return false;
        } else if (filtroTemporal.preset === "mes-anterior") {
          const prevMonthDate = new Date();
          prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
          const prevMonth = format(prevMonthDate, "yyyy-MM");
          if (!dataServico.startsWith(prevMonth)) return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const targetDate = format(filtroTemporal.data, "yyyy-MM-dd");
        if (dataServico !== targetDate) return false;
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const fromStr = format(filtroTemporal.range.from, "yyyy-MM-dd");
        const toStr = filtroTemporal.range.to
          ? format(filtroTemporal.range.to, "yyyy-MM-dd")
          : fromStr;
        if (dataServico < fromStr || dataServico > toStr) return false;
      }

      return true;
    });
  }, [servicosRaw, empresaFiltro, filtroTemporal]);

  // ─── 3. Síntese Operacional (4 Indicadores Macro de Processo) ─────────────────

  const kpis = useMemo(() => {
    const total = servicosContextuais.length;
    const requerAcao = servicosContextuais.filter((s: any) =>
      ["PENDENTE", "EM_VALIDACAO", "DEVOLVIDO", "RECUSADO"].includes(String(s.pipeline_status || "PENDENTE").toUpperCase())
    ).length;
    const aguardandoFinanceiro = servicosContextuais.filter((s: any) =>
      ["APROVADO_OPERACAO", "APROVADO_FINANCEIRO"].includes(String(s.pipeline_status || "").toUpperCase())
    ).length;
    const faturadosConcluidos = servicosContextuais.filter((s: any) =>
      ["FATURADO", "CONCLUIDO", "PAGO", "FINALIZADO"].includes(String(s.pipeline_status || "").toUpperCase())
    ).length;

    return { total, requerAcao, aguardandoFinanceiro, faturadosConcluidos };
  }, [servicosContextuais]);

  // ─── 4. Filtros Exploratórios da Tabela ────────────────────────────────────────

  const servicosFiltrados = useMemo(() => {
    return servicosContextuais.filter((s: any) => {
      const statusNorm = String(s.pipeline_status || "PENDENTE").toUpperCase();

      // 1. Filtro por Active KPI Nav
      if (activeKpiNav === "requer_acao") {
        if (!["PENDENTE", "EM_VALIDACAO", "DEVOLVIDO", "RECUSADO"].includes(statusNorm)) return false;
      } else if (activeKpiNav === "financeiro") {
        if (!["APROVADO_OPERACAO", "APROVADO_FINANCEIRO"].includes(statusNorm)) return false;
      } else if (activeKpiNav === "concluidos") {
        if (!["FATURADO", "CONCLUIDO", "PAGO", "FINALIZADO"].includes(statusNorm)) return false;
      }

      // 2. Filtro por Status Pipeline
      if (pipelineStatusFiltro !== "todos" && statusNorm !== pipelineStatusFiltro) {
        return false;
      }

      // 3. Filtro por Tipo de Serviço Extra
      if (tipoServicoFiltro !== "todos" && s.tipo_servico_id !== tipoServicoFiltro && s.tipo_servico !== tipoServicoFiltro) {
        return false;
      }

      // 4. Busca Textual Rápida
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const codigo = `SX-${String(s.id || "").slice(0, 8).toUpperCase()}`.toLowerCase();
        const tipoNome = (s.tipos_servico_operacional?.nome || s.tipo_servico || "").toLowerCase();
        const desc = (s.descricao_servico || s.descricao || "").toLowerCase();
        const empNome = (s.empresas?.nome || s.empresa_nome || "").toLowerCase();
        const cliente = (s.cliente || "").toLowerCase();
        const resp = (s.responsavel_nome || "").toLowerCase();

        const match =
          codigo.includes(query) ||
          tipoNome.includes(query) ||
          desc.includes(query) ||
          empNome.includes(query) ||
          cliente.includes(query) ||
          resp.includes(query);

        if (!match) return false;
      }

      return true;
    });
  }, [servicosContextuais, activeKpiNav, pipelineStatusFiltro, tipoServicoFiltro, busca]);

  // ─── 5. Navegação Circular e Scroll com Destaque ─────────────────────────────

  const scrollToTarget = (targetId: string) => {
    setHighlightedId(targetId);
    setTimeout(() => {
      const el = document.getElementById(`row-servico-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);

    setTimeout(() => {
      setHighlightedId((current) => (current === targetId ? null : current));
    }, 1800);
  };

  const getHighlightClasses = (status?: string | null) => {
    const s = String(status || "PENDENTE").toUpperCase();
    if (s === "DEVOLVIDO" || s === "RECUSADO") {
      return "bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/70";
    }
    if (s === "PENDENTE") {
      return "bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/70";
    }
    if (s === "EM_VALIDACAO") {
      return "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/70";
    }
    if (s === "APROVADO_OPERACAO") {
      return "bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/70";
    }
    if (s === "APROVADO_FINANCEIRO" || s === "FATURADO") {
      return "bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/70";
    }
    if (s === "CONCLUIDO" || s === "PAGO") {
      return "bg-zinc-100/70 dark:bg-zinc-800/60 ring-2 ring-zinc-500/70";
    }
    return "bg-primary/10 ring-2 ring-primary/70";
  };

  // Handlers dos Cards de Síntese
  const handleCardClickServicosPeriodo = () => {
    setActiveKpiNav("todos");
    if (tableContainerRef.current) {
      tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleCardClickRequerAcao = () => {
    setActiveKpiNav((prev) => (prev === "requer_acao" ? "todos" : "requer_acao"));
    const alvos = servicosContextuais.filter((s: any) =>
      ["DEVOLVIDO", "RECUSADO", "EM_VALIDACAO", "PENDENTE"].includes(String(s.pipeline_status || "PENDENTE").toUpperCase())
    );
    if (alvos.length === 0) {
      toast.info("Nenhum serviço que requer ação no período atual.");
      return;
    }
    const idx = cycleIndices.requerAcao % alvos.length;
    setCycleIndices((prev) => ({ ...prev, requerAcao: idx + 1 }));
    scrollToTarget(alvos[idx].id);
  };

  const handleCardClickAguardandoFinanceiro = () => {
    setActiveKpiNav((prev) => (prev === "financeiro" ? "todos" : "financeiro"));
    const alvos = servicosContextuais.filter((s: any) =>
      ["APROVADO_OPERACAO", "APROVADO_FINANCEIRO"].includes(String(s.pipeline_status || "").toUpperCase())
    );
    if (alvos.length === 0) {
      toast.info("Nenhum serviço aguardando financeiro no período atual.");
      return;
    }
    const idx = cycleIndices.aguardandoFinanceiro % alvos.length;
    setCycleIndices((prev) => ({ ...prev, aguardandoFinanceiro: idx + 1 }));
    scrollToTarget(alvos[idx].id);
  };

  const handleCardClickFaturadosConcluidos = () => {
    setActiveKpiNav((prev) => (prev === "concluidos" ? "todos" : "concluidos"));
    const alvos = servicosContextuais.filter((s: any) =>
      ["FATURADO", "CONCLUIDO", "PAGO", "FINALIZADO"].includes(String(s.pipeline_status || "").toUpperCase())
    );
    if (alvos.length === 0) {
      toast.info("Nenhum serviço faturado ou concluído no período atual.");
      return;
    }
    const idx = cycleIndices.faturadosConcluidos % alvos.length;
    setCycleIndices((prev) => ({ ...prev, faturadosConcluidos: idx + 1 }));
    scrollToTarget(alvos[idx].id);
  };

  const hasActiveFilters =
    pipelineStatusFiltro !== "todos" ||
    tipoServicoFiltro !== "todos" ||
    busca.trim() !== "" ||
    activeKpiNav !== "todos";

  const handleResetFilters = () => {
    setPipelineStatusFiltro("todos");
    setTipoServicoFiltro("todos");
    setBusca("");
    setActiveKpiNav("todos");
    setHighlightedId(null);
    toast.success("Filtros exploratórios redefinidos.");
  };

  // ─── 6. Mutações Canônicas de Pipeline (Avanço & Devolução) ───────────────────

  const canAdvance = (item: ServicoExtraItemData) => {
    if (isAdmin) return true;
    const s = String(item.pipeline_status ?? "PENDENTE").toUpperCase();
    if (s === "PENDENTE" && (role === "encarregado" || role === "gestor")) return true;
    if ((s === "DEVOLVIDO" || s === "RECUSADO" || s === "EM_ANALISE") && (role === "encarregado" || role === "gestor")) return true;
    if (s === "EM_VALIDACAO" && role === "gestor") return true;
    if (s === "APROVADO_OPERACAO" && (role === "gestor" || role === "admin" || role === "financeiro")) return true;
    if ((s === "APROVADO_FINANCEIRO" || s === "FATURADO") && role === "financeiro") return true;
    return false;
  };

  const canDevolve = (item: ServicoExtraItemData) => {
    if (isAdmin) return true;
    const s = String(item.pipeline_status || "").toUpperCase();
    if (!s || s === "PENDENTE" || s === "CONCLUIDO" || s === "PAGO") return false;
    if (s === "EM_VALIDACAO" && role === "gestor") return true;
    if (s === "APROVADO_OPERACAO" && (role === "gestor" || role === "financeiro")) return true;
    if ((s === "APROVADO_FINANCEIRO" || s === "FATURADO") && role === "financeiro") return true;
    return false;
  };

  const updatePipelineMutation = useMutation({
    mutationFn: async ({ id, status, justification }: { id: string; status: string; justification?: string }) =>
      ServicosExtrasOperacionaisService.update(id, {
        pipeline_status: status as any,
        ...(justification ? { justificativa_devolucao: justification } : {}),
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["servicos_extras_historico"] });
      queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
      queryClient.invalidateQueries({ queryKey: ["servicos_extras_hoje"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      if (selectedItem && variables.id === selectedItem.id) {
        setSelectedItem((prev) => (prev ? { ...prev, pipeline_status: variables.status as any } : null));
      }
      toast.success("Pipeline atualizado com sucesso.");
    },
    onError: () => toast.error("Erro ao atualizar pipeline."),
  });

  const handleAdvance = (item: ServicoExtraItemData) => {
    const next = getNextStatus(item.pipeline_status);
    if (!next) return;
    updatePipelineMutation.mutate({ id: item.id, status: next });

    const nextStepId = pipelineStatusToStepId(next);
    const competencia = item.data ? format(new Date(item.data), "yyyy-MM") : format(new Date(), "yyyy-MM");

    openPipeline(
      buildServicosExtrasPipeline({
        competencia,
        empresa: item.empresas?.nome ?? item.empresa_nome ?? "Empresa",
        currentStep: nextStepId,
        pipelineStatus: next,
        modalidade_financeira: item.modalidade_financeira,
        registroId: item.id,
        descricao: item.descricao_servico,
        valor: item.total !== null && item.total !== undefined ? Number(item.total) : undefined,
        data: item.data || undefined,
      })
    );
  };

  const handleDevolve = (item: ServicoExtraItemData) => {
    setJustificationModal({ open: true, itemId: item.id });
  };

  const confirmDevolve = (justification: string) => {
    if (!justificationModal.itemId) return;
    const item = servicosContextuais.find((d: any) => d.id === justificationModal.itemId);

    updatePipelineMutation.mutate({
      id: justificationModal.itemId,
      status: "DEVOLVIDO",
      justification,
    });

    if (item) {
      const competencia = item.data ? format(new Date(item.data), "yyyy-MM") : format(new Date(), "yyyy-MM");
      openPipeline(
        buildServicosExtrasDevolvidoPipeline({
          competencia,
          empresa: item.empresas?.nome ?? item.empresa_nome ?? "Empresa",
          motivo: justification,
          stage: pipelineStatusToStepId(item.pipeline_status),
        })
      );
    }

    setJustificationModal({ open: false, itemId: null });
  };

  // ─── 7. Renderizador de Badge de Pipeline Status ─────────────────────────────

  const renderPipelineBadge = (status?: string | null) => {
    const s = String(status || "PENDENTE").toUpperCase();
    switch (s) {
      case "PENDENTE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            Pendente
          </span>
        );
      case "EM_VALIDACAO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            Em Validação
          </span>
        );
      case "DEVOLVIDO":
      case "RECUSADO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            Devolvido
          </span>
        );
      case "APROVADO_OPERACAO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Aprov. Operação
          </span>
        );
      case "APROVADO_FINANCEIRO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
            <Receipt className="w-3 h-3 text-indigo-600" />
            Aprov. Financeiro
          </span>
        );
      case "FATURADO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200 dark:border-sky-900/40">
            <FileSpreadsheet className="w-3 h-3 text-sky-600" />
            Faturado
          </span>
        );
      case "CONCLUIDO":
      case "PAGO":
      case "FINALIZADO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Concluído
          </span>
        );
      default:
        return <Badge variant="outline">{status || "Pendente"}</Badge>;
    }
  };

  return (
    <AppShell
      title="Serviços Extras"
      subtitle="Acompanhe serviços extraordinários, validações e avanço até o faturamento."
      badge="ENTRADAS / CAPTURA"
    >
      <div className="flex-1 min-h-0 flex flex-col w-full space-y-4">
        {/* CABEÇALHO OPERACIONAL (UX06) */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-primary" />
                Serviços Extras
              </h1>
              <Badge variant="outline" className="text-[10px] tracking-wide uppercase font-semibold">
                Oficial
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Acompanhe serviços extraordinários, validações e avanço até o faturamento.
            </p>
          </div>

          {/* Contexto Estrutural & CTA */}
          <div className="flex items-center gap-2.5">
            {/* Seletor de Contexto: Empresa */}
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger aria-label="Seletor de Empresa" className="w-[220px] h-9 text-xs bg-card border-border">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">
                  Todas as Empresas
                </SelectItem>
                {(empresas as any[]).map((e: any) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* CTA Estrutural: Novo Serviço Extra */}
            <Button
              size="sm"
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-white font-semibold shadow-sm flex items-center gap-1.5"
              onClick={() => {
                setServiceToEdit(null);
                setIsNovoServicoModalOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Novo Serviço Extra
            </Button>
          </div>
        </header>

        {/* SÍNTESE OPERACIONAL INTERATIVA (4 CARDS DE PROCESSO DA ESTEIRA) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Serviços no Período */}
          <button
            type="button"
            onClick={handleCardClickServicosPeriodo}
            className={cn(
              "p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeKpiNav === "todos"
                ? "bg-card border-primary/70 dark:border-primary/60 shadow-xs ring-1 ring-primary/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            )}
            title="Mostrar todos os serviços extras do período e ir ao topo"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">
                Serviços no Período
              </span>
              <div className="text-lg font-bold text-foreground font-mono">
                {kpis.total}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Requer Ação */}
          <button
            type="button"
            onClick={handleCardClickRequerAcao}
            className={cn(
              "p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeKpiNav === "requer_acao"
                ? "bg-card border-amber-500/70 dark:border-amber-500/60 shadow-xs ring-1 ring-amber-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            )}
            title="Localizar serviços que requerem ação (prioriza Devolvidos e Em Validação)"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider block">
                Requer Ação
              </span>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400 font-mono">
                {kpis.requerAcao}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Aguardando Financeiro */}
          <button
            type="button"
            onClick={handleCardClickAguardandoFinanceiro}
            className={cn(
              "p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeKpiNav === "financeiro"
                ? "bg-card border-indigo-500/70 dark:border-indigo-500/60 shadow-xs ring-1 ring-indigo-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            )}
            title="Localizar serviços aguardando financeiro (prioriza Aprov. Operação)"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium uppercase tracking-wider block">
                Aguardando Financeiro
              </span>
              <div className="text-lg font-bold text-foreground font-mono">
                {kpis.aguardandoFinanceiro}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Faturados / Concluídos */}
          <button
            type="button"
            onClick={handleCardClickFaturadosConcluidos}
            className={cn(
              "p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              activeKpiNav === "concluidos"
                ? "bg-card border-emerald-500/70 dark:border-emerald-500/60 shadow-xs ring-1 ring-emerald-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            )}
            title="Localizar serviços faturados ou concluídos (prioriza Faturados)"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium uppercase tracking-wider block">
                Faturados / Concluídos
              </span>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                {kpis.faturadosConcluidos}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* BARRA DE TRABALHO & FILTROS EXPLORATÓRIOS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 bg-card/40 p-2.5 rounded-lg border border-border">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Busca Rápida */}
            <div className="relative min-w-[220px] flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar código, serviço, tomador..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 h-8 text-xs bg-card border-border"
              />
            </div>

            {/* Filtro Temporal Híbrido Reutilizado */}
            <UxLabFiltroTemporal
              value={filtroTemporal}
              onChange={setFiltroTemporal}
            />

            {/* Pipeline Status */}
            <Select value={pipelineStatusFiltro} onValueChange={setPipelineStatusFiltro}>
              <SelectTrigger className="w-[170px] h-8 text-xs bg-card border-border">
                <SelectValue placeholder="Status Pipeline" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.id} value={opt.value} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo de Serviço Extra */}
            <Select value={tipoServicoFiltro} onValueChange={setTipoServicoFiltro}>
              <SelectTrigger className="w-[180px] h-8 text-xs bg-card border-border">
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os tipos
                </SelectItem>
                {tiposServicoExtras.map((s: any) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Botão de Limpar Filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1"
                title="Limpar todos os filtros exploratórios ativos"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 self-end md:self-auto">
            <span>Mostrando:</span>
            <strong className="text-foreground font-mono">{servicosFiltrados.length}</strong>
            <span>de {servicosContextuais.length} serviços</span>
          </div>
        </div>

        {/* TABELA ESPECIALISTA DE ALTA DENSIDADE (11 COLUNAS CANÔNICAS UX06) */}
        <div
          ref={tableContainerRef}
          className="flex-1 min-h-[420px] bg-card rounded-lg border border-border overflow-hidden flex flex-col shadow-xs"
        >
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left border-collapse min-w-[1050px]">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2 px-2.5 w-[85px] whitespace-nowrap">Código</th>
                  <th className="py-2 px-2 w-[80px] whitespace-nowrap">Data</th>
                  <th className="py-2 px-2 max-w-[140px] truncate">Empresa / Tomador</th>
                  <th className="py-2 px-2 max-w-[150px] truncate">Tipo de Serviço Extra</th>
                  <th className="py-2 px-2 w-[85px] text-left whitespace-nowrap">Qtd. Executada</th>
                  <th className="py-2 px-2 w-[80px] whitespace-nowrap">Headcount</th>
                  <th className="py-2 px-2 w-[90px] text-left whitespace-nowrap">Valor Total</th>
                  <th className="py-2 px-2 w-[115px] text-left whitespace-nowrap">Pipeline Status</th>
                  <th className="py-2 px-2 w-[110px] whitespace-nowrap">Modalidade / Pgto</th>
                  <th className="py-2 px-2 max-w-[150px] truncate">Pendência / Diagnóstico</th>
                  <th className="py-2 px-2 w-[75px] text-center whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoadingServicos ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                        <span className="text-xs font-medium">Carregando serviços extras...</span>
                      </div>
                    </td>
                  </tr>
                ) : servicosContextuais.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Package className="w-7 h-7 text-muted-foreground/40" />
                        <span className="font-semibold text-xs text-foreground">
                          Nenhum serviço extra registrado para o período e empresa selecionados.
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Utilize o botão acima para registrar um novo serviço extraordinário.
                        </p>
                        <Button
                          size="sm"
                          className="mt-2 h-8 text-xs bg-primary hover:bg-primary/90 text-white font-semibold"
                          onClick={() => {
                            setServiceToEdit(null);
                            setIsNovoServicoModalOpen(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Novo Serviço Extra
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : servicosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Wrench className="w-7 h-7 text-muted-foreground/40" />
                        <span className="font-semibold text-xs text-foreground">
                          Nenhum serviço encontrado com os filtros selecionados.
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Ajuste os filtros de busca, status ou tipo para localizar os registros.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-2 h-8 text-xs"
                        >
                          Redefinir Filtros
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  servicosFiltrados.map((s: any) => {
                    const isHighlighted = highlightedId === s.id;
                    const isSelected = selectedItem?.id === s.id;
                    const codigo = `SX-${String(s.id || "").slice(0, 8).toUpperCase()}`;
                    const empresaNome = s.empresas?.nome || s.empresa_nome || "—";
                    const tipoNome = s.tipos_servico_operacional?.nome || s.tipo_servico || "—";
                    const headcountNum = Number(s.quantidade_colaboradores || 1);
                    const headcountStr = `${headcountNum} ${headcountNum === 1 ? "pessoa" : "pessoas"}`;
                    const valorTotal = s.total !== null && s.total !== undefined ? Number(s.total) : 0;
                    const statusPagamento = String(s.status_pagamento || "PENDENTE").toUpperCase();
                    const modalidadeStr = s.modalidade_financeira?.replace(/_/g, " ") || s.formas_pagamento_operacional?.nome || "—";

                    return (
                      <tr
                        key={s.id}
                        id={`row-servico-${s.id}`}
                        onClick={() => setSelectedItem(s)}
                        className={cn(
                          "group transition-all duration-150 cursor-pointer",
                          isHighlighted
                            ? getHighlightClasses(s.pipeline_status)
                            : isSelected
                            ? "bg-primary/5 dark:bg-primary/10"
                            : "hover:bg-muted/40"
                        )}
                      >
                        {/* 1. Código */}
                        <td className="py-2 px-2.5 font-mono font-bold text-primary whitespace-nowrap">
                          {codigo}
                        </td>

                        {/* 2. Data */}
                        <td className="py-2 px-2 font-mono text-muted-foreground whitespace-nowrap">
                          {formatDate(s.data)}
                        </td>

                        {/* 3. Empresa / Tomador */}
                        <td className="py-2 px-2 max-w-[140px] truncate">
                          <div className="font-semibold text-foreground truncate" title={empresaNome}>
                            {empresaNome}
                          </div>
                          {s.cliente && (
                            <div className="text-[10px] text-muted-foreground truncate" title={s.cliente}>
                              {s.cliente}
                            </div>
                          )}
                        </td>

                        {/* 4. Tipo de Serviço Extra */}
                        <td className="py-2 px-2 max-w-[150px] truncate">
                          <div className="font-medium text-foreground truncate" title={tipoNome}>
                            {tipoNome}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate" title={s.descricao_servico || s.descricao}>
                            {s.descricao_servico || s.descricao || "—"}
                          </div>
                        </td>

                        {/* 5. Qtd. Executada */}
                        <td className="py-2 px-2 text-left whitespace-nowrap font-medium text-foreground">
                          {s.quantidade !== null && s.quantidade !== undefined ? Number(s.quantidade).toLocaleString("pt-BR") : "1"}
                          <span className="text-[10px] text-muted-foreground ml-0.5">
                            {s.unidade_cobranca_snapshot || "un"}
                          </span>
                        </td>

                        {/* 6. Headcount */}
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Users className="w-3 h-3 text-indigo-500" />
                            <span className="font-medium text-foreground">{headcountStr}</span>
                          </span>
                        </td>

                        {/* 7. Valor Total */}
                        <td className="py-2 px-2 font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                          {formatCurrency(valorTotal)}
                        </td>

                        {/* 8. Pipeline Status */}
                        <td className="py-2 px-2 whitespace-nowrap">
                          {renderPipelineBadge(s.pipeline_status)}
                        </td>

                        {/* 9. Modalidade / Status Pgto (Somente Leitura — SEM dropdown destrutivo) */}
                        <td className="py-2 px-2 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-muted-foreground truncate font-medium">
                              {modalidadeStr}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "border text-[9px] px-1 py-0 h-4 w-fit font-semibold",
                                statusPagamento === "RECEBIDO" || statusPagamento === "PAGO"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : statusPagamento === "ATRASADO"
                                  ? "bg-amber-50 text-amber-700 border-amber-300"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              )}
                            >
                              {statusPagamento}
                            </Badge>
                          </div>
                        </td>

                        {/* 10. Pendência / Diagnóstico */}
                        <td className="py-2 px-2 max-w-[150px] truncate text-[11px]">
                          {s.justificativa_devolucao ? (
                            <span className="text-rose-600 dark:text-rose-400 font-medium truncate flex items-center gap-1" title={s.justificativa_devolucao}>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {s.justificativa_devolucao}
                            </span>
                          ) : s.observacao ? (
                            <span className="text-muted-foreground italic truncate" title={s.observacao}>
                              {s.observacao}
                            </span>
                          ) : (
                            <span className="text-muted-foreground truncate">
                              Resp: {s.responsavel_nome || "Operação"}
                            </span>
                          )}
                        </td>

                        {/* 11. Ação */}
                        <td className="py-2 px-2 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {s.pipeline_status !== "CONCLUIDO" && canAdvance(s) && (
                              <button
                                className="h-6 w-6 rounded hover:bg-emerald-50 flex items-center justify-center text-emerald-600 hover:text-emerald-700 transition-colors"
                                onClick={() => handleAdvance(s)}
                                title="Avançar Pipeline"
                                disabled={updatePipelineMutation.isPending}
                              >
                                {updatePipelineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
                              </button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted"
                              onClick={() => setSelectedItem(s)}
                            >
                              Ver Detalhes
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Drawer Primário — Detalhes do Serviço Extra */}
      <ServicoExtraDetalhesDrawer
        item={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => {
          setSelectedItem(null);
          setIsFlowDrawerOpen(false);
        }}
        onVerFluxoCompleto={() => setIsFlowDrawerOpen(true)}
        onAdvance={selectedItem && canAdvance(selectedItem) ? () => handleAdvance(selectedItem) : undefined}
        onDevolve={selectedItem && canDevolve(selectedItem) ? () => handleDevolve(selectedItem) : undefined}
        onEdit={
          selectedItem
            ? () => {
                setServiceToEdit(selectedItem);
                setIsNovoServicoModalOpen(true);
                setSelectedItem(null);
              }
            : undefined
        }
        canAdvance={selectedItem ? canAdvance(selectedItem) : false}
        canDevolve={selectedItem ? canDevolve(selectedItem) : false}
        isPendingAdvance={updatePipelineMutation.isPending}
      />

      {/* Drawer Secundário — Linha do Tempo e Status Completo */}
      <ServicosExtrasContinuityDrawer
        isOpen={isFlowDrawerOpen}
        item={selectedItem}
        zIndexClass="z-[60]"
        onBack={() => setIsFlowDrawerOpen(false)}
        onClose={() => {
          setIsFlowDrawerOpen(false);
          setSelectedItem(null);
        }}
      />

      {/* Modal de Criação / Edição Admin */}
      <NovoServicoExtraDialog
        open={isNovoServicoModalOpen}
        onOpenChange={(open) => {
          setIsNovoServicoModalOpen(open);
          if (!open) setServiceToEdit(null);
        }}
        initialData={serviceToEdit}
      />

      {/* Modal de Justificativa de Devolução */}
      <JustificationModal
        isOpen={justificationModal.open}
        onClose={() => setJustificationModal({ open: false, itemId: null })}
        onConfirm={confirmDevolve}
        title="Justificar Devolução"
        description="Informe o motivo da devolução do serviço extra para revisão."
      />
    </AppShell>
  );
}
