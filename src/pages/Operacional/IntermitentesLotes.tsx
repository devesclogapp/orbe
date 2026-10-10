import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarCheck,
  Building2,
  Clock,
  DollarSign,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Layers,
  Banknote,
  Calendar,
  ChevronRight,
  FilterX,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ExecutiveMetricCard } from "@/components/dashboard/ExecutiveMetricCard";
import { cn, decimalParaHora } from "@/lib/utils";
import { EmpresaService } from "@/services/base.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";

// ─── Constants & Formatters ───────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const MONTH_FILTER_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: format(new Date(2026, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
}));

const YEAR_OPTIONS = Array.from(
  new Set(Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)))
).sort((a, b) => Number(b) - Number(a));

// ─── Status Badges Helpers (Exported for Testing) ───────────────────────────

export const getRhStatusBadge = (status: string) => {
  switch (status) {
    case "VALIDADO_RH":
    case "APROVADO_RH":
    case "FECHADO_FINANCEIRO":
    case "CNAB_GERADO":
    case "PAGO":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Aprovado RH
        </Badge>
      );
    case "AGUARDANDO_VALIDACAO_RH":
    case "EM_ANALISE_RH":
      return (
        <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-xs font-semibold gap-1">
          <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Em análise RH
        </Badge>
      );
    case "DEVOLVIDO":
      return (
        <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs font-semibold gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
          Devolvido RH
        </Badge>
      );
    case "CANCELADO":
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-xs font-semibold">
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
};

export const getFinanceiroStatusBadge = (statusFin?: string, statusLote?: string) => {
  const s = statusFin || statusLote;
  switch (s) {
    case "AGUARDANDO_FINANCEIRO":
    case "VALIDADO_RH":
      return (
        <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-xs font-semibold gap-1">
          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
          Aguardando Financeiro
        </Badge>
      );
    case "AGUARDANDO_PAGAMENTO":
    case "FECHADO_FINANCEIRO":
      return (
        <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3 h-3 text-purple-600 dark:text-purple-400" />
          Aprovado Financeiro
        </Badge>
      );
    case "CNAB_GERADO":
      return (
        <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 text-xs font-semibold gap-1">
          <Banknote className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
          Remessa Gerada
        </Badge>
      );
    case "PAGO":
    case "FINALIZADO":
      return (
        <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
          Pago / Conciliado
        </Badge>
      );
    case "PENDENTE_RH":
    case "AGUARDANDO_VALIDACAO_RH":
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-xs font-medium">
          Pendente RH
        </Badge>
      );
    case "DEVOLVIDO_RH":
      return (
        <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 text-xs font-semibold">
          Devolvido
        </Badge>
      );
    case "CANCELADO":
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-xs font-semibold">
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {s || "Aguardando"}
        </Badge>
      );
  }
};

export const getSituacaoBadge = (status: string) => {
  if (status === "PAGO") {
    return <Badge className="bg-emerald-600 text-white font-bold text-[11px]">Pago</Badge>;
  }
  if (["VALIDADO_RH", "FECHADO_FINANCEIRO", "CNAB_GERADO"].includes(status)) {
    return <Badge className="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30 font-semibold text-[11px]">Aprovado</Badge>;
  }
  if (["AGUARDANDO_VALIDACAO_RH", "EM_ANALISE_RH"].includes(status)) {
    return <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30 font-semibold text-[11px]">Em análise</Badge>;
  }
  if (["DEVOLVIDO", "CANCELADO"].includes(status)) {
    return <Badge className="bg-rose-500/15 text-rose-800 dark:text-rose-300 border-rose-500/30 font-semibold text-[11px]">Devolvido</Badge>;
  }
  return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
};

export const getLoteDrawerBadge = (status?: string) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PAGO":
      return (
        <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1 shadow-xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          Pago
        </Badge>
      );
    case "CNAB_GERADO":
      return (
        <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-xs font-semibold gap-1">
          <Banknote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          Remessa Gerada
        </Badge>
      );
    case "FECHADO_FINANCEIRO":
    case "AGUARDANDO_PAGAMENTO":
      return (
        <Badge className="bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          Aprovado Financeiro
        </Badge>
      );
    case "VALIDADO_RH":
    case "APROVADO_RH":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          Aprovado RH
        </Badge>
      );
    case "AGUARDANDO_VALIDACAO_RH":
    case "EM_ANALISE_RH":
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-xs font-semibold gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          Em análise RH
        </Badge>
      );
    case "DEVOLVIDO":
    case "DEVOLVIDO_RH":
      return (
        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-xs font-semibold gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          Devolvido RH
        </Badge>
      );
    case "CANCELADO":
      return (
        <Badge className="bg-muted text-muted-foreground border-border text-xs font-semibold">
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status || "—"}
        </Badge>
      );
  }
};

export const getDrawerFooterActions = (status?: string) => {
  const s = String(status || "").toUpperCase();
  const canIrValidacaoRh = ["AGUARDANDO_VALIDACAO_RH", "EM_ANALISE_RH"].includes(s);
  const canConsultarDevolvidas = ["CANCELADO", "DEVOLVIDO", "DEVOLVIDO_RH"].includes(s);
  const canAprovarFinanceiro = ["VALIDADO_RH", "APROVADO_RH"].includes(s);
  const canAvancarRemessa = ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(s);
  const canVerConciliacao = s === "CNAB_GERADO";
  const hasAvancoAction = canIrValidacaoRh || canConsultarDevolvidas || canAprovarFinanceiro || canAvancarRemessa || canVerConciliacao;
  const canVerFluxoCompleto = false;
  return {
    canIrValidacaoRh,
    canConsultarDevolvidas,
    canAprovarFinanceiro,
    canAvancarRemessa,
    canVerConciliacao,
    hasAvancoAction,
    canVerFluxoCompleto,
  };
};

export interface PipelineStageState {
  id: string;
  label: string;
  status: "done" | "current" | "pending" | "error";
}

export const getIntermitentesPipelineStages = (status?: string) => {
  const s = String(status || "").toUpperCase();
  const isPago = s === "PAGO" || s === "FINALIZADO";
  const isCnab = s === "CNAB_GERADO";
  const isFin = ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(s);
  const isRhValidado = ["VALIDADO_RH", "APROVADO_RH"].includes(s);
  const isRhAnalise = ["AGUARDANDO_VALIDACAO_RH", "EM_ANALISE_RH"].includes(s);
  const isCancelado = s === "CANCELADO";
  const isDevolvido = ["DEVOLVIDO", "DEVOLVIDO_RH"].includes(s);

  // 1. Recebido (sempre done)
  const recebido: PipelineStageState = { id: "recebido", label: "Recebido", status: "done" };

  // 2. Fechamento (sempre done quando lote existe)
  const fechamento: PipelineStageState = { id: "fechamento", label: "Fechamento", status: "done" };

  // 3. Validação RH
  let rhStatus: "done" | "current" | "pending" | "error" = "done";
  let rhLabel = "Validação RH";
  if (isRhAnalise) {
    rhStatus = "current";
    rhLabel = "Validação RH";
  } else if (isCancelado) {
    rhStatus = "error";
    rhLabel = "Cancelado RH";
  } else if (isDevolvido) {
    rhStatus = "error";
    rhLabel = "Devolvido RH";
  } else if (isRhValidado || isFin || isCnab || isPago) {
    rhStatus = "done";
    rhLabel = "Validação RH";
  } else {
    rhStatus = "pending";
    rhLabel = "Validação RH";
  }
  const validacaoRh: PipelineStageState = { id: "validacao_rh", label: rhLabel, status: rhStatus };

  // 4. Financeiro
  let finStatus: "done" | "current" | "pending" = "pending";
  if (isCancelado || isDevolvido) {
    finStatus = "pending";
  } else if (isFin || isCnab || isPago) {
    finStatus = "done";
  } else if (isRhValidado) {
    finStatus = "current";
  }
  const financeiro: PipelineStageState = { id: "financeiro", label: "Financeiro", status: finStatus };

  // 5. CNAB / Pago
  let cnabPagoStatus: "done" | "current" | "pending" = "pending";
  if (isCancelado || isDevolvido) {
    cnabPagoStatus = "pending";
  } else if (isPago) {
    cnabPagoStatus = "done";
  } else if (isCnab) {
    cnabPagoStatus = "current";
  }
  const cnabPago: PipelineStageState = { id: "cnab_pago", label: "CNAB/Pago", status: cnabPagoStatus };

  const stages = [recebido, fechamento, validacaoRh, financeiro, cnabPago];
  const allCompleted = stages.every((st) => st.status === "done");

  return {
    stages,
    allCompleted,
    connector1: true,
    connector2: validacaoRh.status === "done",
    connector3: validacaoRh.status === "done" && financeiro.status === "done",
    connector4: validacaoRh.status === "done" && financeiro.status === "done" && cnabPago.status === "done",
  };
};

export interface TimelineStepItem {
  number: number;
  title: string;
  badgeText: string;
  badgeClass: string;
  state: "done" | "current" | "pending" | "error";
  description: string;
  timestamp?: string | null;
}

export const getIntermitentesTimelineSteps = (status?: string, loteDetalhe?: any): TimelineStepItem[] => {
  const s = String(status || "").toUpperCase();
  const isPago = s === "PAGO";
  const isCnab = s === "CNAB_GERADO";
  const isFin = ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(s);
  const isRhValidado = ["VALIDADO_RH", "APROVADO_RH"].includes(s);
  const isRhAnalise = ["AGUARDANDO_VALIDACAO_RH", "EM_ANALISE_RH"].includes(s);

  const qtdRegistros = loteDetalhe?.quantidade_registros || 2;
  const valorTotal = formatCurrency(Number(loteDetalhe?.valor_total || 570));
  const empresaNome = loteDetalhe?.empresa?.nome || "Empresa";

  return [
    {
      number: 1,
      title: "1. Importação Tio Digital",
      badgeText: "Concluído",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]",
      state: "done",
      description: `${qtdRegistros} jornadas recebidas com convocação e apuração calculada (Total: ${valorTotal}).`,
    },
    {
      number: 2,
      title: "2. Fechamento de Período",
      badgeText: "Concluído",
      badgeClass: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]",
      state: "done",
      description: `Período fechado com escopo empresarial exclusivo para ${empresaNome}. Lote gerado e enviado à validação do RH.`,
    },
    {
      number: 3,
      title: "3. Validação do RH",
      badgeText: isPago || isCnab || isFin ? "Concluído" : isRhValidado ? "Você está aqui (Aprovado)" : isRhAnalise ? "Você está aqui (Em análise)" : "Pendente",
      badgeClass: isPago || isCnab || isFin
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
        : isRhValidado
        ? "bg-emerald-600 text-white text-[10px] font-bold"
        : isRhAnalise
        ? "bg-amber-600 text-white text-[10px] font-bold"
        : "text-muted-foreground text-[10px]",
      state: isPago || isCnab || isFin || isRhValidado ? "done" : isRhAnalise ? "current" : "pending",
      description: "Lote conferido e aprovado pelo RH. Valores e jornadas homologados para quitação financeira.",
      timestamp: loteDetalhe?.validated_at ? format(new Date(loteDetalhe.validated_at), "dd/MM/yyyy HH:mm") : null,
    },
    {
      number: 4,
      title: "4. Aprovação Financeira / Remessa",
      badgeText: isPago || isCnab ? "Concluído" : isFin ? "Você está aqui (Aprovado)" : isRhValidado ? "Próxima Etapa" : "Pendente",
      badgeClass: isPago || isCnab
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
        : isFin
        ? "bg-purple-600 text-white text-[10px] font-bold"
        : isRhValidado
        ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20 text-[10px]"
        : "text-muted-foreground text-[10px]",
      state: isPago || isCnab || isFin ? "done" : isRhValidado ? "current" : "pending",
      description: isPago || isCnab || isFin
        ? "Obrigação contábil homologada e liberada pelo Financeiro para liberação da remessa CNAB."
        : "O lote sincronizou em rh_financeiro_lotes como AGUARDANDO_FINANCEIRO e aguarda aprovação financeira para liberação da obrigação e remessa CNAB.",
    },
    {
      number: 5,
      title: "5. Geração de Arquivo CNAB 240",
      badgeText: isPago ? "Concluído" : isCnab ? "Você está aqui (Remessa Gerada)" : isFin ? "Próxima Etapa" : "Pendente",
      badgeClass: isPago
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
        : isCnab
        ? "bg-indigo-600 text-white text-[10px] font-bold"
        : isFin
        ? "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 text-[10px]"
        : "text-muted-foreground text-[10px]",
      state: isPago || isCnab ? "done" : isFin ? "current" : "pending",
      description: isPago || isCnab
        ? "Arquivo de remessa bancária gerado com sucesso e transmitido ao banco."
        : "Geração do arquivo de remessa bancária com os dados dos colaboradores intermitentes.",
    },
    {
      number: 6,
      title: "6. Retorno Bancário & Quitação (PAGO)",
      badgeText: isPago ? "Concluído (Liquidado)" : isCnab ? "Aguardando Retorno" : "Pendente",
      badgeClass: isPago
        ? "bg-emerald-600 text-white text-[10px] font-bold shadow-xs"
        : isCnab
        ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 text-[10px]"
        : "text-muted-foreground text-[10px]",
      state: isPago ? "done" : isCnab ? "current" : "pending",
      description: isPago
        ? "Arquivo de retorno bancário processado com sucesso. Todos os lançamentos foram conciliados e liquidados integralmente."
        : isCnab
        ? "Aguardando importação do arquivo de retorno (.RET) para conciliação e liquidação final do lote."
        : "Importação do arquivo RET, conciliação e liquidação final do lote.",
    },
  ];
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function IntermitentesLotes() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Filtros
  const [filterMonth, setFilterMonth] = useState<string>("10");
  const [filterYear, setFilterYear] = useState<string>("2026");
  const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterText, setFilterText] = useState<string>("");

  // Drawers & Modals state
  const [selectedLoteId, setSelectedLoteId] = useState<string | null>(null);
  const [openConfirmarAprovacaoFinanceira, setOpenConfirmarAprovacaoFinanceira] = useState(false);

  // Auto-selecionar lote vindo de navigation state
  useEffect(() => {
    if (location.state && (location.state as any).selectedLoteId) {
      setSelectedLoteId((location.state as any).selectedLoteId);
    }
  }, [location.state]);

  // Busca de Empresas com isolamento de ambiente nativo
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas-intermitentes-lotes"],
    queryFn: () => EmpresaService.getAll(),
  });

  const selectedCompetencia = `${filterYear}-${filterMonth}`;

  // Query principal de lotes de intermitentes
  const {
    data: lotes = [],
    isLoading: isLoadingLotes,
  } = useQuery({
    queryKey: ["intermitentes-lotes", filterEmpresaId, selectedCompetencia, filterStatus],
    queryFn: async () => {
      const result = await IntermitentesLoteService.listarLotes({
        competencia: selectedCompetencia !== "all" ? selectedCompetencia : undefined,
        status: filterStatus !== "all" ? filterStatus : undefined,
        empresaId: filterEmpresaId !== "all" ? filterEmpresaId : undefined,
      });
      return result || [];
    },
  });

  // Query do detalhe do lote selecionado
  const {
    data: loteDetalhe,
    isLoading: isLoadingDetalhe,
  } = useQuery({
    queryKey: ["intermitente-lote-detalhe", selectedLoteId],
    queryFn: async () => {
      if (!selectedLoteId) return null;
      return await IntermitentesLoteService.getLoteDetalhe(selectedLoteId);
    },
    enabled: !!selectedLoteId,
  });

  // Mutation: Aprovação Financeira Canônica
  const aprovarFinanceiroMutation = useMutation({
    mutationFn: async () => {
      if (!loteDetalhe?.id) throw new Error("Nenhum lote selecionado.");
      return IntermitentesLoteService.aprovarFinanceiro(loteDetalhe.id, user?.id || "financeiro");
    },
    onSuccess: () => {
      toast.success("Lote aprovado financeiramente com sucesso!", {
        description: "A obrigação foi homologada e está liberada para remessa CNAB 240.",
      });
      setOpenConfirmarAprovacaoFinanceira(false);
      queryClient.invalidateQueries({ queryKey: ["intermitente-lote-detalhe", selectedLoteId] });
      queryClient.invalidateQueries({ queryKey: ["intermitentes-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["intermitentes_lotes_bancario"] });
      queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lotes"] });
      queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lotes-bancario"] });
    },
    onError: (err: any) => {
      toast.error(`Falha ao aprovar financeiramente: ${err.message}`);
    },
  });

  // Filtragem no cliente para busca por texto
  const filteredLotes = useMemo(() => {
    return (lotes as any[]).filter((lote) => {
      if (!filterText) return true;
      const search = filterText.toLowerCase();
      const empNome = (lote.empresa?.nome || "").toLowerCase();
      const loteRef = `lote ${lote.id.substring(0, 6)}`.toLowerCase();
      const codInt = `int-${lote.competencia}-${lote.id.substring(0, 4)}`.toLowerCase();
      return empNome.includes(search) || loteRef.includes(search) || codInt.includes(search);
    });
  }, [lotes, filterText]);

  // KPIs consolidados (exclui lotes CANCELADO dos acumuladores de registros, horas e montante)
  const kpis = useMemo(() => {
    const totalLotes = filteredLotes.length;
    const lotesCancelados = filteredLotes.filter((l) => l.status === "CANCELADO");
    const countCancelados = lotesCancelados.length;
    const lotesAtivos = filteredLotes.filter((l) => l.status !== "CANCELADO");
    const countAtivos = lotesAtivos.length;

    // Acumuladores excluem lotes CANCELADO para integridade operacional
    const totalRegistros = lotesAtivos.reduce((acc, l) => acc + Number(l.quantidade_registros || 0), 0);
    const totalValor = lotesAtivos.reduce((acc, l) => acc + Number(l.valor_total || 0), 0);
    const totalHorasTrab = lotesAtivos.reduce((acc, l) => acc + Number(l.horas_trabalhadas || 0), 0);
    const totalHorasNorm = lotesAtivos.reduce((acc, l) => acc + Number(l.horas_normais || 0), 0);
    const totalHe50 = lotesAtivos.reduce((acc, l) => acc + Number(l.he_50 || 0), 0);

    return {
      totalLotes,
      countAtivos,
      countCancelados,
      totalRegistros,
      totalValor,
      horasTrab: decimalParaHora(totalHorasTrab),
      horasNorm: decimalParaHora(totalHorasNorm),
      he50: decimalParaHora(totalHe50),
    };
  }, [filteredLotes]);

  const resetFilters = () => {
    setFilterEmpresaId("all");
    setFilterStatus("all");
    setFilterText("");
    setFilterMonth(format(new Date(), "MM"));
    setFilterYear(format(new Date(), "yyyy"));
  };

  const hasActiveFilters = filterEmpresaId !== "all" || filterStatus !== "all" || filterText.trim() !== "";

  const selectedEmpresaObj = useMemo(() => {
    return (empresas as any[]).find((e) => e.id === filterEmpresaId);
  }, [empresas, filterEmpresaId]);

  const handleCloseDrawers = () => {
    setSelectedLoteId(null);
  };

  return (
    <AppShell
      title="Lotes de Intermitentes"
      subtitle="Acompanhamento de lotes fechados, consolidação contábil, aprovações e ciclo de pagamento"
      badge="FECHAMENTOS / OPERAÇÃO"
    >
      <TooltipProvider>
        <div className="space-y-5">
          {/* ─── BARRA DE AÇÕES SUPERIOR / CONTEXTO ───────────────────────────── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium">
                <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Regime Intermitente (Lotes Fechados)
              </span>
              <span>•</span>
              <span>
                Competência:{" "}
                <strong className="text-foreground font-semibold">
                  {filterMonth}/{filterYear}
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 border-border hover:bg-muted"
                onClick={() => navigate("/operacional/intermitentes")}
              >
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                Jornadas / Processamento
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-semibold gap-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                onClick={() => navigate("/bancario?tab=intermitentes&origem=INTERMITENTE")}
              >
                <Banknote className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                Pagamentos e Remessas
              </Button>
            </div>
          </div>

          {/* ─── 4 INDICADORES EXECUTIVOS SEMÂNTICOS ───────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ExecutiveMetricCard
              label="Total de Lotes"
              value={String(kpis.totalLotes)}
              subtitle={
                kpis.countCancelados > 0
                  ? `${kpis.countAtivos} ativos • ${kpis.countCancelados} cancelados`
                  : `Competência ${filterMonth}/${filterYear}`
              }
              badge={
                kpis.countCancelados > 0
                  ? { text: `${kpis.countAtivos} ativos`, variant: "info" }
                  : kpis.totalLotes > 0
                  ? { text: `${kpis.totalLotes} no ciclo`, variant: "info" }
                  : { text: "Sem lotes", variant: "neutral" }
              }
              icon={CalendarCheck}
            />

            <ExecutiveMetricCard
              label="Registros Fechados"
              value={String(kpis.totalRegistros)}
              subtitle={
                kpis.countCancelados > 0
                  ? "Jornadas em lotes ativos no ciclo"
                  : "Total de jornadas no ciclo"
              }
              icon={Users}
            />

            <ExecutiveMetricCard
              label="Horas Consolidadas"
              value={kpis.horasTrab}
              subtitle={`${kpis.horasNorm} normais • ${kpis.he50} HE 50%`}
              icon={Clock}
            />

            <ExecutiveMetricCard
              label="Montante Total"
              value={formatCurrency(kpis.totalValor)}
              subtitle={
                kpis.countCancelados > 0
                  ? "Apurado em lotes ativos"
                  : "Apurado operacionalmente"
              }
              icon={DollarSign}
            />
          </div>

          {/* ─── BARRA COMPACTA DE FILTROS ────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              {/* Seletor de Empresa */}
              <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Empresa
                </Label>
                <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                  <SelectTrigger className="h-9 bg-background border-border text-xs">
                    <Building2 className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                    <SelectValue placeholder="Todas as Empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas</SelectItem>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Busca Textual */}
              <div className="flex-1 min-w-[220px] space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Busca Rápida
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Buscar por código do lote ou empresa..."
                    className="h-9 pl-9 bg-background border-border text-xs"
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                  />
                </div>
              </div>

              {/* Mês */}
              <div className="w-[130px] space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mês
                </Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="h-9 bg-background border-border text-xs">
                    <Calendar className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_FILTER_OPTIONS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Ano */}
              <div className="w-[95px] space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Ano
                </Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="h-9 bg-background border-border text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEAR_OPTIONS.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="w-[160px] space-y-1.5">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Status
                </Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-9 bg-background border-border text-xs">
                    <SelectValue placeholder="Todos os Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="AGUARDANDO_VALIDACAO_RH">Em análise RH</SelectItem>
                    <SelectItem value="VALIDADO_RH">Aprovado RH</SelectItem>
                    <SelectItem value="FECHADO_FINANCEIRO">Aprovado Financeiro</SelectItem>
                    <SelectItem value="CNAB_GERADO">Remessa Gerada</SelectItem>
                    <SelectItem value="PAGO">Pago</SelectItem>
                    <SelectItem value="DEVOLVIDO">Devolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Botões de Reset */}
              <div className="flex items-center gap-1 pb-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => {
                        setFilterMonth(format(new Date(), "MM"));
                        setFilterYear(format(new Date(), "yyyy"));
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restaurar mês atual</TooltipContent>
                </Tooltip>

                {hasActiveFilters && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-muted-foreground hover:text-rose-600 transition-colors"
                        onClick={resetFilters}
                      >
                        <FilterX className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Limpar todos os filtros</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Filtros aplicados:</span>
                {filterEmpresaId !== "all" && (
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                    Empresa: {selectedEmpresaObj?.nome || "Selecionada"}
                  </span>
                )}
                {filterStatus !== "all" && (
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                    Status: {filterStatus}
                  </span>
                )}
                {filterText.trim() && (
                  <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                    Termo: "{filterText}"
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ─── TABELA DE LOTES ─────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {isLoadingLotes ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Carregando lotes de intermitentes...</p>
              </div>
            ) : filteredLotes.length === 0 ? (
              <div className="py-12 px-4 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                  <CalendarCheck className="w-6 h-6 text-muted-foreground/70" />
                </div>
                <div className="space-y-1 max-w-md">
                  <p className="font-semibold text-foreground text-sm">Nenhum lote encontrado</p>
                  <p className="text-xs text-muted-foreground">
                    Não foram localizados lotes fechados para a competência{" "}
                    <strong className="text-foreground">
                      {filterMonth}/{filterYear}
                    </strong>{" "}
                    com os filtros informados.
                  </p>
                  <p className="text-xs text-muted-foreground/80 pt-1">
                    Ajuste os filtros de busca ou consulte os apontamentos em aberto para novo fechamento.
                  </p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs gap-1.5"
                      onClick={resetFilters}
                    >
                      <FilterX className="w-3.5 h-3.5" />
                      Limpar Filtros
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-border hover:bg-muted"
                    onClick={() => navigate("/operacional/intermitentes")}
                  >
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    Jornadas / Processamento
                  </Button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto scrollbar-thin">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/70 border-b border-border text-muted-foreground uppercase font-mono tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Lote</th>
                      <th className="py-3 px-4 font-semibold">Empresa</th>
                      <th className="py-3 px-4 font-semibold">Competência</th>
                      <th className="py-3 px-4 font-semibold text-center">Registros</th>
                      <th className="py-3 px-4 font-semibold">Composição Horas</th>
                      <th className="py-3 px-4 font-semibold text-right">Valor Total</th>
                      <th className="py-3 px-4 font-semibold">Status RH</th>
                      <th className="py-3 px-4 font-semibold">Status Financeiro</th>
                      <th className="py-3 px-4 font-semibold text-center">Situação</th>
                      <th className="py-3 px-4 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filteredLotes.map((lote) => {
                      const loteCodigoVisual = `INT-${lote.competencia}-${lote.id.substring(0, 4)}`;
                      const loteNomeRef = `Lote ${lote.id.substring(0, 6)}`;

                      return (
                        <tr
                          key={lote.id}
                          onClick={() => setSelectedLoteId(lote.id)}
                          className="hover:bg-muted/40 transition-colors cursor-pointer group"
                        >
                          <td className="py-3.5 px-4 font-medium">
                            <div className="flex flex-col">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors">
                                {loteNomeRef}
                              </span>
                              <span className="text-[11px] font-mono text-muted-foreground">
                                {loteCodigoVisual}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-foreground truncate max-w-[200px]">
                                {lote.empresa?.nome || "Empresa não informada"}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono font-medium text-foreground">
                            {lote.competencia}
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-bold text-foreground">
                            {lote.quantidade_registros}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold font-mono text-foreground">
                                {decimalParaHora(lote.horas_trabalhadas || 0)} trab
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {decimalParaHora(lote.horas_normais || 0)} norm · {decimalParaHora(lote.he_50 || 0)} HE50
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground text-sm">
                            {formatCurrency(Number(lote.valor_total || 0))}
                          </td>

                          <td className="py-3.5 px-4">
                            {getRhStatusBadge(lote.status)}
                          </td>

                          <td className="py-3.5 px-4">
                            {getFinanceiroStatusBadge(lote.status_financeiro, lote.status)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {getSituacaoBadge(lote.status)}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-md transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLoteId(lote.id);
                              }}
                            >
                              <span>Detalhes</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── DRAWER PRIMÁRIO: DETALHES DO LOTE ── */}
        <DrawerPrimarioShell
          isOpen={!!selectedLoteId}
          onClose={handleCloseDrawers}
          widthClass="w-full sm:max-w-2xl"
          title={
            loteDetalhe ? (
              <div className="flex items-center gap-2">
                <span>Lote {loteDetalhe.id.substring(0, 6)}</span>
                <span className="text-xs font-normal text-muted-foreground font-mono">
                  (INT-{loteDetalhe.competencia}-{loteDetalhe.id.substring(0, 4)})
                </span>
              </div>
            ) : (
              "Carregando lote..."
            )
          }
          subtitle={
            loteDetalhe ? (
              <div className="flex flex-col gap-0.5 mt-1">
                <span className="font-semibold text-foreground">
                  {loteDetalhe.empresa?.nome || "Empresa"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Competência: {loteDetalhe.competencia} · Fechado em:{" "}
                  {loteDetalhe.created_at ? format(new Date(loteDetalhe.created_at), "dd/MM/yyyy HH:mm") : "—"}
                </span>
              </div>
            ) : undefined
          }
          badge={loteDetalhe ? getLoteDrawerBadge(loteDetalhe.status) : null}
          footer={(() => {
            const footerActions = getDrawerFooterActions(loteDetalhe?.status);
            return (
              <div className="flex items-center justify-between w-full">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold"
                  onClick={handleCloseDrawers}
                >
                  Fechar
                </Button>

                <div className="flex items-center gap-2">
                  {footerActions.canIrValidacaoRh && (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                      onClick={() => {
                        handleCloseDrawers();
                        navigate("/intermitentes/aprovacoes", {
                          state: {
                            selectedLoteId: loteDetalhe.id,
                            loteId: loteDetalhe.id,
                            empresaId: loteDetalhe.empresa_id,
                            competencia: loteDetalhe.competencia,
                          },
                        });
                      }}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ir para Validação RH</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {footerActions.canConsultarDevolvidas && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold gap-1.5 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-700/50 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      onClick={() => {
                        handleCloseDrawers();
                        const query = new URLSearchParams();
                        if (loteDetalhe.competencia) query.set("competencia", loteDetalhe.competencia);
                        if (loteDetalhe.empresa_id) query.set("empresaId", loteDetalhe.empresa_id);
                        if (loteDetalhe.id) query.set("loteId", loteDetalhe.id);
                        query.set("origem", "lote_cancelado");
                        const searchStr = query.toString();
                        navigate(`/operacional/intermitentes${searchStr ? `?${searchStr}` : ""}`, {
                          state: {
                            loteId: loteDetalhe.id,
                            empresaId: loteDetalhe.empresa_id,
                            competencia: loteDetalhe.competencia,
                            origem: "lote_cancelado",
                          },
                        });
                      }}
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Consultar Jornadas Devolvidas</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {footerActions.canAprovarFinanceiro && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                      onClick={() => setOpenConfirmarAprovacaoFinanceira(true)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Aprovar Financeiro</span>
                    </Button>
                  )}

                  {footerActions.canAvancarRemessa && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                      onClick={() => {
                        handleCloseDrawers();
                        navigate(
                          `/bancario?tab=remessa&origem=INTERMITENTE${
                            loteDetalhe.empresa_id ? `&empresaId=${loteDetalhe.empresa_id}` : ""
                          }${loteDetalhe.competencia ? `&competencia=${loteDetalhe.competencia}` : ""}`,
                          {
                            state: {
                              selectedLoteId: loteDetalhe.id,
                              loteId: loteDetalhe.id,
                            },
                          }
                        );
                      }}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Avançar para Remessa</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}

                  {footerActions.canVerConciliacao && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs font-semibold gap-1.5 text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                      onClick={() => {
                        handleCloseDrawers();
                        navigate(
                          `/bancario?tab=retorno&origem=INTERMITENTE${
                            loteDetalhe.empresa_id ? `&empresaId=${loteDetalhe.empresa_id}` : ""
                          }${loteDetalhe.competencia ? `&competencia=${loteDetalhe.competencia}` : ""}`,
                          {
                            state: {
                              selectedLoteId: loteDetalhe.id,
                              loteId: loteDetalhe.id,
                            },
                          }
                        );
                      }}
                    >
                      <Banknote className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>Ver Conciliação Bancária</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        >
          {isLoadingDetalhe || !loteDetalhe ? (
            <div className="py-20 text-center flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Carregando composição do lote...</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* Pipeline Horizontal Compacto */}
              {(() => {
                const pipeline = getIntermitentesPipelineStages(loteDetalhe.status);
                return (
                  <div className="p-3.5 bg-muted/40 border border-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                        Pipeline do Lote
                      </p>
                      {pipeline.allCompleted && (
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full font-mono">
                          5/5 Concluído
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium gap-1">
                      {/* 1. Recebido */}
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Recebido</span>
                      </div>

                      <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector1 ? "bg-emerald-500/40" : "bg-border")} />

                      {/* 2. Fechamento */}
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>Fechamento</span>
                      </div>

                      <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector2 ? "bg-emerald-500/40" : "bg-border")} />

                      {/* 3. Validação RH */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          pipeline.stages[2].status === "done"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : pipeline.stages[2].status === "current"
                            ? "text-amber-600 dark:text-amber-400 font-bold"
                            : pipeline.stages[2].status === "error"
                            ? "text-rose-600 dark:text-rose-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {pipeline.stages[2].status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : pipeline.stages[2].status === "error" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        )}
                        <span>{pipeline.stages[2].label}</span>
                      </div>

                      <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector3 ? "bg-emerald-500/40" : "bg-border")} />

                      {/* 4. Financeiro */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          pipeline.stages[3].status === "done"
                            ? "text-emerald-600 dark:text-emerald-400"
                            : pipeline.stages[3].status === "current"
                            ? "text-blue-600 dark:text-blue-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {pipeline.stages[3].status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Clock className={cn("w-3.5 h-3.5", pipeline.stages[3].status === "current" ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/60")} />
                        )}
                        <span>Financeiro</span>
                      </div>

                      <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector4 ? "bg-emerald-500/40" : "bg-border")} />

                      {/* 5. CNAB / Pago */}
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          pipeline.stages[4].status === "done"
                            ? "text-emerald-600 dark:text-emerald-400 font-bold"
                            : pipeline.stages[4].status === "current"
                            ? "text-indigo-600 dark:text-indigo-400 font-bold"
                            : "text-muted-foreground"
                        )}
                      >
                        {pipeline.stages[4].status === "done" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Banknote className={cn("w-3.5 h-3.5", pipeline.stages[4].status === "current" ? "text-indigo-600 dark:text-indigo-400" : "text-muted-foreground/60")} />
                        )}
                        <span>CNAB/Pago</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Governança Contábil / Diagnóstico Operacional */}
              {loteDetalhe.status === "VALIDADO_RH" && (
                <div className="p-3.5 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Lote Homologado pelo RH — Aguardando Financeiro</p>
                      <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30">
                        Ação Necessária
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Lote conferido pelo RH e sincronizado como obrigação contábil.<br />
                      <strong>Impacto:</strong> Lançamentos operacionais congelados contra alterações.<br />
                      <strong>Próxima Ação:</strong> Executar aprovação financeira para autorizar a geração da remessa bancária.<br />
                      <strong>Destino:</strong> Central Bancária (CNAB 240 / Lotes RH).
                    </p>
                  </div>
                </div>
              )}

              {["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(loteDetalhe.status) && (
                <div className="p-3.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Aprovado pelo Financeiro — Liberado para Remessa</p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Obrigação contábil aprovada pelo Financeiro.<br />
                      <strong>Impacto:</strong> Lote apto para inclusão em remessa bancária CNAB 240.<br />
                      <strong>Próxima Ação:</strong> Gerar arquivo de remessa ou incluir em lote bancário.<br />
                      <strong>Destino:</strong> Módulo Bancário → Remessas Intermitentes.
                    </p>
                  </div>
                </div>
              )}

              {loteDetalhe.status === "CNAB_GERADO" && (
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <Banknote className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Remessa CNAB Gerada — Aguardando Retorno</p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Remessa bancária emitida e transmitida à instituição pagadora.<br />
                      <strong>Impacto:</strong> Pagamento em processamento interbancário.<br />
                      <strong>Próxima Ação:</strong> Importar o arquivo de retorno (.RET) para quitação definitiva.<br />
                      <strong>Destino:</strong> Retorno Bancário & Conciliação.
                    </p>
                  </div>
                </div>
              )}

              {loteDetalhe.status === "PAGO" && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Ciclo Operacional & Financeiro Liquidado (PAGO)</p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Retorno bancário conciliado com sucesso.<br />
                      <strong>Impacto:</strong> Quitação integral confirmada para todos os colaboradores do lote.<br />
                      <strong>Próxima Ação:</strong> Arquivado como histórico contábil e operacional.<br />
                      <strong>Destino:</strong> Terminal do Pipeline.
                    </p>
                  </div>
                </div>
              )}

              {["DEVOLVIDO", "DEVOLVIDO_RH"].includes(loteDetalhe.status) && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Lote Devolvido pelo RH</p>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> O RH identificou inconsistências nas jornadas ou valores e devolveu o lote.<br />
                      <strong>Impacto:</strong> O lote não pode avançar para o Financeiro até o reprocessamento.<br />
                      <strong>Próxima Ação:</strong> Reabrir lote em Recebidos ou ajustar apontamentos apontados.<br />
                      <strong>Destino:</strong> Intermitentes Recebidos.
                    </p>
                  </div>
                </div>
              )}

              {loteDetalhe.status === "CANCELADO" && (
                <div className="p-3.5 bg-muted/60 border border-border rounded-xl flex items-start gap-3 text-xs leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">Lote Cancelado / Devolvido pelo RH</p>
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border">
                        Cancelado
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      <strong>Diagnóstico:</strong> Este lote foi cancelado após devolução da validação pelo RH.<br />
                      <strong>Impacto:</strong> Os lançamentos operacionais foram desvinculados deste lote e retornados à esteira de Recebidos para novo processamento.<br />
                      <strong>Registros Históricos do Lote:</strong> {loteDetalhe.quantidade_registros || 0} registros no fechamento original.<br />
                      <strong>Registros Atualmente Vinculados:</strong> {loteDetalhe.itens?.length || 0} registros ativos.
                    </p>
                  </div>
                </div>
              )}

              {/* Totais do Lote */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Valor Total
                  </span>
                  <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(Number(loteDetalhe.valor_total || 0))}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    {loteDetalhe.status === "CANCELADO" ? "Registros Históricos" : "Registros"}
                  </span>
                  <p className="text-base font-bold font-mono text-foreground mt-0.5">
                    {loteDetalhe.quantidade_registros}
                  </p>
                  {loteDetalhe.status === "CANCELADO" && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      (0 atualmente vinculados)
                    </span>
                  )}
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Horas Totais
                  </span>
                  <p className="text-base font-bold font-mono text-foreground mt-0.5">
                    {decimalParaHora(loteDetalhe.horas_trabalhadas || 0)}
                  </p>
                </div>

                <div className="p-3 bg-muted/30 border border-border rounded-lg">
                  <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                    Horas Extras (50%)
                  </span>
                  <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {decimalParaHora(loteDetalhe.he_50 || 0)}
                  </p>
                </div>
              </div>

              {/* Composição Individual dos Colaboradores */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <h3 className="font-bold text-foreground text-sm">
                      Composição do Lote ({loteDetalhe.status === "CANCELADO" && (!loteDetalhe.itens || loteDetalhe.itens.length === 0) ? "0 lançamentos vinculados" : `${loteDetalhe.itens?.length || 0} lançamentos`})
                    </h3>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {decimalParaHora(loteDetalhe.horas_normais || 0)} normais · {decimalParaHora(loteDetalhe.he_50 || 0)} HE50
                  </span>
                </div>

                {loteDetalhe.status === "CANCELADO" && (!loteDetalhe.itens || loteDetalhe.itens.length === 0) ? (
                  <div className="p-4 bg-muted/30 border border-dashed border-border rounded-lg text-center space-y-2">
                    <p className="text-xs font-semibold text-foreground">
                      Lançamentos desvinculados durante a devolução do RH
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-md mx-auto leading-relaxed">
                      Este lote registrou historicamente <strong>{loteDetalhe.quantidade_registros || 0} lançamentos</strong> no momento do fechamento original. Durante a devolução pelo RH, os lançamentos operacionais foram desvinculados deste lote e retornaram para a esteira de <em>Intermitentes Recebidos</em> para ajuste e novo fechamento.
                    </p>
                    <div className="pt-2 flex items-center justify-center gap-4 text-[11px] font-mono text-muted-foreground">
                      <span>Registros históricos: <strong className="text-foreground">{loteDetalhe.quantidade_registros || 0}</strong></span>
                      <span>•</span>
                      <span>Registros atualmente vinculados: <strong className="text-foreground">0</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {loteDetalhe.itens?.map((item: any) => (
                      <div
                        key={item.id}
                        className="p-3.5 bg-card border border-border rounded-lg shadow-xs flex flex-col gap-2 hover:border-border/80 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-foreground text-xs">
                              {item.nome_colaborador || "Colaborador"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {item.cargo || "Auxiliar"} · {item.convocacao || "Sem Convocação"}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(Number(item.total || item.valor_calculado || 0))}
                            </span>
                            <p className="text-[10px] text-muted-foreground font-mono">
                              {item.data_referencia ? format(new Date(item.data_referencia.includes("T") ? item.data_referencia : item.data_referencia + "T12:00:00"), "dd/MM/yyyy") : "—"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-border/50 text-[11px] font-mono text-muted-foreground">
                          <span>
                            Jornada: {decimalParaHora(item.horas_trabalhadas || 0)} trab ({decimalParaHora(item.horas_normais || 0)} norm{Number(item.he_50 || 0) > 0 ? ` · ${decimalParaHora(item.he_50)} HE50` : ""})
                          </span>
                          <Badge variant="outline" className="text-[10px] font-medium py-0">
                            {item.status_pipeline}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Informações de Auditoria e Fechamento */}
              <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1 text-muted-foreground">
                <p className="flex justify-between">
                  <span>Status no Financeiro:</span>
                  <span className="font-semibold text-foreground">
                    {loteDetalhe.status_financeiro || "AGUARDANDO_FINANCEIRO"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Validado por RH em:</span>
                  <span className="font-semibold text-foreground">
                    {loteDetalhe.validated_at ? format(new Date(loteDetalhe.validated_at), "dd/MM/yyyy HH:mm:ss") : "—"}
                  </span>
                </p>
                <p className="flex justify-between">
                  <span>Observações:</span>
                  <span className="italic text-foreground">
                    {loteDetalhe.observacoes || "Nenhuma observação registrada."}
                  </span>
                </p>
              </div>
            </div>
          )}
        </DrawerPrimarioShell>

        {/* ── MODAL: CONFIRMAR APROVAÇÃO FINANCEIRA ── */}
        <Dialog open={openConfirmarAprovacaoFinanceira} onOpenChange={setOpenConfirmarAprovacaoFinanceira}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground font-display">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                Confirmar Aprovação Financeira
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Aprovação formal da obrigação contábil para liberação de remessa bancária.
              </DialogDescription>
            </DialogHeader>

            {loteDetalhe && (
              <div className="space-y-3 py-2 text-xs">
                <div className="p-3.5 bg-muted/40 border border-border rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Empresa:</span>
                    <span className="font-semibold text-foreground">{loteDetalhe.empresa?.nome || "Empresa"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Identificador do Lote:</span>
                    <span className="font-mono font-bold text-foreground">
                      INT-{loteDetalhe.competencia}-{loteDetalhe.id.substring(0, 4)} ({`Lote ${loteDetalhe.id.substring(0, 6)}`})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registros:</span>
                    <span className="font-semibold text-foreground">{loteDetalhe.quantidade_registros} registros</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground font-medium">Valor Total:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatCurrency(Number(loteDetalhe.valor_total || 0))}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-900 dark:text-blue-300 leading-relaxed text-[11px]">
                  <p className="font-semibold mb-1">Efeito desta ação:</p>
                  <p>
                    O status do lote avançará para <strong>AGUARDANDO_PAGAMENTO</strong> (FECHADO_FINANCEIRO). A obrigação será homologada e liberada formalmente para emissão da remessa CNAB 240 na Central Bancária.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setOpenConfirmarAprovacaoFinanceira(false)}
                disabled={aprovarFinanceiroMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-xs"
                onClick={() => aprovarFinanceiroMutation.mutate()}
                disabled={aprovarFinanceiroMutation.isPending}
              >
                {aprovarFinanceiroMutation.isPending ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Aprovando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Aprovação Financeira</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </AppShell>
  );
}
