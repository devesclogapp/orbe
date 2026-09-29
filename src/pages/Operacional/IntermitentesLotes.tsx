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
  ExternalLink,
  ChevronRight,
  Lock,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { cn, decimalParaHora } from "@/lib/utils";
import { EmpresaService } from "@/services/base.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import { DrawerSecundarioShell } from "@/components/continuity/DrawerSecundarioShell";

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
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Aprovado RH
        </Badge>
      );
    case "AGUARDANDO_VALIDACAO_RH":
    case "EM_ANALISE_RH":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold gap-1">
          <Clock className="w-3 h-3 text-amber-600" />
          Em análise RH
        </Badge>
      );
    case "DEVOLVIDO":
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold gap-1">
          <AlertTriangle className="w-3 h-3 text-rose-600" />
          Devolvido RH
        </Badge>
      );
    case "CANCELADO":
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold">
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
        <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold gap-1">
          <Clock className="w-3 h-3 text-blue-600" />
          Aguardando Financeiro
        </Badge>
      );
    case "AGUARDANDO_PAGAMENTO":
    case "FECHADO_FINANCEIRO":
      return (
        <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3 h-3 text-purple-600" />
          Aprovado Financeiro
        </Badge>
      );
    case "CNAB_GERADO":
      return (
        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold gap-1">
          <Banknote className="w-3 h-3 text-indigo-600" />
          Remessa Gerada
        </Badge>
      );
    case "PAGO":
    case "FINALIZADO":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          Pago / Conciliado
        </Badge>
      );
    case "PENDENTE_RH":
    case "AGUARDANDO_VALIDACAO_RH":
      return (
        <Badge className="bg-slate-50 text-slate-600 border-slate-200 text-xs font-medium">
          Pendente RH
        </Badge>
      );
    case "DEVOLVIDO_RH":
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold">
          Devolvido
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
    return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold text-[11px]">Aprovado</Badge>;
  }
  if (["AGUARDANDO_VALIDACAO_RH", "EM_ANALISE_RH"].includes(status)) {
    return <Badge className="bg-amber-100 text-amber-800 border-amber-300 font-semibold text-[11px]">Em análise</Badge>;
  }
  if (["DEVOLVIDO", "CANCELADO"].includes(status)) {
    return <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-semibold text-[11px]">Devolvido</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
};

export const getLoteDrawerBadge = (status?: string) => {
  const s = String(status || "").toUpperCase();
  switch (s) {
    case "PAGO":
      return (
        <Badge className="bg-emerald-600 text-white font-bold text-xs gap-1 shadow-sm">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
          Pago
        </Badge>
      );
    case "CNAB_GERADO":
      return (
        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs font-semibold gap-1">
          <Banknote className="w-3.5 h-3.5 text-indigo-600" />
          Remessa Gerada
        </Badge>
      );
    case "FECHADO_FINANCEIRO":
    case "AGUARDANDO_PAGAMENTO":
      return (
        <Badge className="bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
          Aprovado Financeiro
        </Badge>
      );
    case "VALIDADO_RH":
    case "APROVADO_RH":
      return (
        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          Aprovado RH
        </Badge>
      );
    case "AGUARDANDO_VALIDACAO_RH":
    case "EM_ANALISE_RH":
      return (
        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          Em análise RH
        </Badge>
      );
    case "DEVOLVIDO":
    case "DEVOLVIDO_RH":
      return (
        <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold gap-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          Devolvido RH
        </Badge>
      );
    case "CANCELADO":
      return (
        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs font-semibold">
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
  const canAprovarFinanceiro = s === "VALIDADO_RH";
  const canAvancarRemessa = ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(s);
  const canVerConciliacao = s === "CNAB_GERADO";
  const hasAvancoAction = canAprovarFinanceiro || canAvancarRemessa || canVerConciliacao;
  const canVerFluxoCompleto = true;
  return {
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
  const isPago = s === "PAGO";
  const isCnab = s === "CNAB_GERADO";
  const isFin = ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO"].includes(s);
  const isRhValidado = ["VALIDADO_RH", "APROVADO_RH"].includes(s);
  const isRhAnalise = ["AGUARDANDO_VALIDACAO_RH", "EM_ANALISE_RH"].includes(s);
  const isDevolvido = ["DEVOLVIDO", "DEVOLVIDO_RH"].includes(s);

  // 1. Recebido (sempre done)
  const recebido: PipelineStageState = { id: "recebido", label: "Recebido", status: "done" };

  // 2. Fechamento (sempre done quando lote existe)
  const fechamento: PipelineStageState = { id: "fechamento", label: "Fechamento", status: "done" };

  // 3. Validação RH
  let rhStatus: "done" | "current" | "pending" | "error" = "done";
  if (isRhAnalise) rhStatus = "current";
  else if (isDevolvido) rhStatus = "error";
  else if (isRhValidado || isFin || isCnab || isPago) rhStatus = "done";
  else rhStatus = "pending";
  const validacaoRh: PipelineStageState = { id: "validacao_rh", label: "Validação RH", status: rhStatus };

  // 4. Financeiro
  let finStatus: "done" | "current" | "pending" = "pending";
  if (isFin || isCnab || isPago) finStatus = "done";
  else if (isRhValidado) finStatus = "current";
  const financeiro: PipelineStageState = { id: "financeiro", label: "Financeiro", status: finStatus };

  // 5. CNAB / Pago
  let cnabPagoStatus: "done" | "current" | "pending" = "pending";
  if (isPago) cnabPagoStatus = "done";
  else if (isCnab) cnabPagoStatus = "current";
  const cnabPago: PipelineStageState = { id: "cnab_pago", label: "CNAB/Pago", status: cnabPagoStatus };

  const stages = [recebido, fechamento, validacaoRh, financeiro, cnabPago];
  const allCompleted = stages.every((st) => st.status === "done");

  return {
    stages,
    allCompleted,
    connector1: true,
    connector2: validacaoRh.status === "done",
    connector3: financeiro.status === "done",
    connector4: cnabPago.status === "done",
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
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]",
      state: "done",
      description: `${qtdRegistros} jornadas recebidas com convocação e apuração calculada (Total: ${valorTotal}).`,
    },
    {
      number: 2,
      title: "2. Fechamento de Período",
      badgeText: "Concluído",
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]",
      state: "done",
      description: `Período fechado com escopo empresarial exclusivo para ${empresaNome}. Lote gerado e enviado à validação do RH.`,
    },
    {
      number: 3,
      title: "3. Validação do RH",
      badgeText: isPago || isCnab || isFin ? "Concluído" : isRhValidado ? "Você está aqui (Aprovado)" : isRhAnalise ? "Você está aqui (Em análise)" : "Pendente",
      badgeClass: isPago || isCnab || isFin
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
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
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
        : isFin
        ? "bg-purple-600 text-white text-[10px] font-bold"
        : isRhValidado
        ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
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
        ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]"
        : isCnab
        ? "bg-indigo-600 text-white text-[10px] font-bold"
        : isFin
        ? "bg-purple-50 text-purple-700 border-purple-200 text-[10px]"
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
        ? "bg-emerald-600 text-white text-[10px] font-bold shadow-sm"
        : isCnab
        ? "bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]"
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
  const [isSecondaryDrawerOpen, setIsSecondaryDrawerOpen] = useState(false);
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
    refetch: refetchLotes,
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

  // KPIs consolidados
  const kpis = useMemo(() => {
    const totalLotes = filteredLotes.length;
    const totalRegistros = filteredLotes.reduce((acc, l) => acc + Number(l.quantidade_registros || 0), 0);
    const totalValor = filteredLotes.reduce((acc, l) => acc + Number(l.valor_total || 0), 0);
    const totalHorasTrab = filteredLotes.reduce((acc, l) => acc + Number(l.horas_trabalhadas || 0), 0);
    const totalHorasNorm = filteredLotes.reduce((acc, l) => acc + Number(l.horas_normais || 0), 0);
    const totalHe50 = filteredLotes.reduce((acc, l) => acc + Number(l.he_50 || 0), 0);

    return {
      totalLotes,
      totalRegistros,
      totalValor,
      horasTrab: decimalParaHora(totalHorasTrab),
      horasNorm: decimalParaHora(totalHorasNorm),
      he50: decimalParaHora(totalHe50),
    };
  }, [filteredLotes]);

  const handleCloseDrawers = () => {
    setSelectedLoteId(null);
    setIsSecondaryDrawerOpen(false);
  };

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CalendarCheck className="w-5 h-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-display">
                Lotes de Intermitentes
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Acompanhamento de lotes fechados, consolidação contábil, aprovações e ciclo de pagamento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5"
              onClick={() => navigate("/operacional/intermitentes")}
            >
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Jornadas / Processamento
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              onClick={() => navigate("/bancario?tab=intermitentes&origem=INTERMITENTE")}
            >
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              Pagamentos e Remessas
            </Button>
          </div>
        </div>

        {/* KPIs Consolidados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white border border-[#DEDEDE] rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Total de Lotes
                </p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {kpis.totalLotes}
                </p>
              </div>
              <span className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                <CalendarCheck className="w-5 h-5" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Competência {filterMonth}/{filterYear}</p>
          </div>

          <div className="p-4 bg-white border border-[#DEDEDE] rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Registros Fechados
                </p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {kpis.totalRegistros}
                </p>
              </div>
              <span className="p-2.5 rounded-lg bg-blue-50 text-blue-700">
                <Users className="w-5 h-5" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Total de jornadas no ciclo</p>
          </div>

          <div className="p-4 bg-white border border-[#DEDEDE] rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Horas Consolidadas
                </p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  {kpis.horasTrab}
                </p>
              </div>
              <span className="p-2.5 rounded-lg bg-amber-50 text-amber-700">
                <Clock className="w-5 h-5" />
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {kpis.horasNorm} normais · {kpis.he50} HE50
            </p>
          </div>

          <div className="p-4 bg-white border border-emerald-200 bg-emerald-50/30 rounded-xl shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-emerald-800 uppercase tracking-wider">
                  Montante Total
                </p>
                <p className="text-2xl font-bold font-mono text-emerald-700 mt-1">
                  {formatCurrency(kpis.totalValor)}
                </p>
              </div>
              <span className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
                <DollarSign className="w-5 h-5" />
              </span>
            </div>
            <p className="text-xs text-emerald-700 mt-2 font-medium">Apurado operacionalmente</p>
          </div>
        </div>

        {/* Barra de Filtros */}
        <div className="p-4 bg-white border border-[#DEDEDE] rounded-xl shadow-sm flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[220px]">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por código do lote ou empresa..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          <div className="w-[200px]">
            <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
              <SelectTrigger className="h-9 text-xs">
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

          <div className="flex items-center gap-2">
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[130px] h-9 text-xs">
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_FILTER_OPTIONS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[90px] h-9 text-xs">
                <SelectValue placeholder="Ano" />
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

          <div className="w-[160px]">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs">
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
        </div>

        {/* Tabela de Lotes */}
        <div className="bg-white border border-[#DEDEDE] rounded-xl shadow-sm overflow-hidden">
          {isLoadingLotes ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Carregando lotes de intermitentes...</p>
            </div>
          ) : filteredLotes.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
              <CalendarCheck className="w-12 h-12 text-slate-300" />
              <div className="space-y-1">
                <p className="font-semibold text-slate-700">Nenhum lote encontrado</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Não foram localizados lotes fechados para a competência {filterMonth}/{filterYear} com os filtros informados.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-border/60 text-muted-foreground uppercase font-mono tracking-wider text-[11px]">
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
                <tbody className="divide-y divide-border/40">
                  {filteredLotes.map((lote) => {
                    const loteCodigoVisual = `INT-${lote.competencia}-${lote.id.substring(0, 4)}`;
                    const loteNomeRef = `Lote ${lote.id.substring(0, 6)}`;

                    return (
                      <tr
                        key={lote.id}
                        onClick={() => setSelectedLoteId(lote.id)}
                        className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4 font-medium">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 group-hover:text-primary transition-colors">
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
                            <span className="font-medium text-slate-800 truncate max-w-[200px]">
                              {lote.empresa?.nome || "Empresa não informada"}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                          {lote.competencia}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-800">
                          {lote.quantidade_registros}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold font-mono text-slate-800">
                              {decimalParaHora(lote.horas_trabalhadas || 0)} trab
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {decimalParaHora(lote.horas_normais || 0)} norm · {decimalParaHora(lote.he_50 || 0)} HE50
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 text-sm">
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
                            className="h-8 px-2.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1"
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
              <span className="font-semibold text-slate-800">
                {loteDetalhe.empresa?.nome || "Empresa"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Competência: {loteDetalhe.competencia} · Fechado em: {loteDetalhe.created_at ? format(new Date(loteDetalhe.created_at), "dd/MM/yyyy HH:mm") : "—"}
              </span>
            </div>
          ) : undefined
        }
        badge={loteDetalhe ? getLoteDrawerBadge(loteDetalhe.status) : null}
        footer={
          (() => {
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1.5"
                    onClick={() => setIsSecondaryDrawerOpen(true)}
                  >
                    <span>Ver fluxo completo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>

                  {footerActions.canAprovarFinanceiro && (
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
                      onClick={() => setOpenConfirmarAprovacaoFinanceira(true)}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Aprovar Financeiro</span>
                    </Button>
                  )}

                  {footerActions.canAvancarRemessa && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
                      onClick={() => {
                        handleCloseDrawers();
                        navigate("/bancario?tab=intermitentes&origem=INTERMITENTE");
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
                      className="text-xs font-semibold gap-1.5 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                      onClick={() => {
                        handleCloseDrawers();
                        navigate("/bancario?tab=retorno&origem=INTERMITENTE");
                      }}
                    >
                      <Banknote className="w-3.5 h-3.5" />
                      <span>Ver Conciliação Bancária</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })()
        }
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
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-mono">
                      Pipeline do Lote
                    </p>
                    {pipeline.allCompleted && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full font-mono">
                        5/5 Concluído
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-xs font-medium gap-1">
                    {/* 1. Recebido */}
                    <div className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Recebido</span>
                    </div>

                    <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector1 ? "bg-emerald-300" : "bg-slate-200")} />

                    {/* 2. Fechamento */}
                    <div className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Fechamento</span>
                    </div>

                    <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector2 ? "bg-emerald-300" : "bg-slate-200")} />

                    {/* 3. Validação RH */}
                    <div className={cn(
                      "flex items-center gap-1.5",
                      pipeline.stages[2].status === "done"
                        ? "text-emerald-700"
                        : pipeline.stages[2].status === "current"
                        ? "text-amber-700 font-bold"
                        : pipeline.stages[2].status === "error"
                        ? "text-rose-700 font-bold"
                        : "text-slate-500"
                    )}>
                      {pipeline.stages[2].status === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : pipeline.stages[2].status === "error" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                      )}
                      <span>Validação RH</span>
                    </div>

                    <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector3 ? "bg-emerald-300" : "bg-slate-200")} />

                    {/* 4. Financeiro */}
                    <div className={cn(
                      "flex items-center gap-1.5",
                      pipeline.stages[3].status === "done"
                        ? "text-emerald-700"
                        : pipeline.stages[3].status === "current"
                        ? "text-blue-700 font-bold"
                        : "text-slate-500"
                    )}>
                      {pipeline.stages[3].status === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Clock className={cn("w-3.5 h-3.5", pipeline.stages[3].status === "current" ? "text-blue-600" : "text-slate-400")} />
                      )}
                      <span>Financeiro</span>
                    </div>

                    <div className={cn("h-0.5 flex-1 mx-1", pipeline.connector4 ? "bg-emerald-300" : "bg-slate-200")} />

                    {/* 5. CNAB / Pago */}
                    <div className={cn(
                      "flex items-center gap-1.5",
                      pipeline.stages[4].status === "done"
                        ? "text-emerald-700 font-bold"
                        : pipeline.stages[4].status === "current"
                        ? "text-indigo-700 font-bold"
                        : "text-slate-500"
                    )}>
                      {pipeline.stages[4].status === "done" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <Banknote className={cn("w-3.5 h-3.5", pipeline.stages[4].status === "current" ? "text-indigo-600" : "text-slate-400")} />
                      )}
                      <span>CNAB/Pago</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Governança Contábil / Estado do Lote */}
            {loteDetalhe.status === "VALIDADO_RH" && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-xs text-emerald-900 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Lote Homologado pelo RH</p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Este lote foi validado pelo RH e aguarda aprovação financeira para liberação da remessa CNAB. Edições nos lançamentos estão bloqueadas por governança.
                  </p>
                </div>
              </div>
            )}

            {loteDetalhe.status === "CNAB_GERADO" && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-lg flex items-start gap-2.5 text-xs text-indigo-950 leading-relaxed">
                <Banknote className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-indigo-900">Remessa CNAB Gerada</p>
                  <p className="text-indigo-700 text-[11px] mt-0.5">
                    Arquivo de remessa bancária gerado e transmitido. Aguardando processamento bancário e importação do arquivo de retorno para liquidação e conciliação.
                  </p>
                </div>
              </div>
            )}

            {loteDetalhe.status === "PAGO" && (
              <div className="p-3 bg-emerald-50/90 border border-emerald-300 rounded-lg flex items-start gap-2.5 text-xs text-emerald-950 leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-900">Ciclo Operacional & Financeiro Quitado</p>
                  <p className="text-emerald-700 text-[11px] mt-0.5">
                    Este lote foi integralmente liquidado e conciliado via retorno bancário CNAB 240. Todos os lançamentos foram pagos e o lote encontra-se arquivado no estado terminal.
                  </p>
                </div>
              </div>
            )}

            {/* Totais do Lote */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 border border-border/60 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                  Valor Total
                </span>
                <p className="text-base font-bold font-mono text-emerald-700 mt-0.5">
                  {formatCurrency(Number(loteDetalhe.valor_total || 0))}
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-border/60 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                  Registros
                </span>
                <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {loteDetalhe.quantidade_registros}
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-border/60 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                  Horas Totais
                </span>
                <p className="text-base font-bold font-mono text-slate-900 mt-0.5">
                  {decimalParaHora(loteDetalhe.horas_trabalhadas || 0)}
                </p>
              </div>

              <div className="p-3 bg-slate-50 border border-border/60 rounded-lg">
                <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                  Horas Extras (50%)
                </span>
                <p className="text-base font-bold font-mono text-amber-700 mt-0.5">
                  {decimalParaHora(loteDetalhe.he_50 || 0)}
                </p>
              </div>
            </div>

            {/* Composição Individual dos Colaboradores */}
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-600" />
                  <h3 className="font-bold text-slate-900 text-sm">
                    Composição do Lote ({loteDetalhe.itens?.length || 0} lançamentos)
                  </h3>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {decimalParaHora(loteDetalhe.horas_normais || 0)} normais · {decimalParaHora(loteDetalhe.he_50 || 0)} HE50
                </span>
              </div>

              <div className="space-y-2">
                {loteDetalhe.itens?.map((item: any) => (
                  <div
                    key={item.id}
                    className="p-3.5 bg-white border border-border/70 rounded-lg shadow-sm flex flex-col gap-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-slate-900 text-xs">
                          {item.nome_colaborador || "Colaborador"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {item.cargo || "Auxiliar"} · {item.convocacao || "Sem Convocação"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-emerald-700">
                          {formatCurrency(Number(item.total || item.valor_calculado || 0))}
                        </span>
                        <p className="text-[10px] text-muted-foreground font-mono">
                          {item.data_referencia ? format(new Date(item.data_referencia.includes("T") ? item.data_referencia : item.data_referencia + "T12:00:00"), "dd/MM/yyyy") : "—"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] font-mono text-slate-600">
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
            </div>

            {/* Informações de Auditoria e Fechamento */}
            <div className="p-3 bg-slate-50 border border-border/50 rounded-lg text-xs space-y-1 text-slate-600">
              <p className="flex justify-between">
                <span className="text-muted-foreground">Status no Financeiro:</span>
                <span className="font-semibold text-slate-800">
                  {loteDetalhe.status_financeiro || "AGUARDANDO_FINANCEIRO"}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Validado por RH em:</span>
                <span className="font-semibold text-slate-800">
                  {loteDetalhe.validated_at ? format(new Date(loteDetalhe.validated_at), "dd/MM/yyyy HH:mm:ss") : "—"}
                </span>
              </p>
              <p className="flex justify-between">
                <span className="text-muted-foreground">Observações:</span>
                <span className="italic text-slate-700">
                  {loteDetalhe.observacoes || "Nenhuma observação registrada."}
                </span>
              </p>
            </div>
          </div>
        )}
      </DrawerPrimarioShell>

      {/* ── DRAWER SECUNDÁRIO: LINHA DO TEMPO / FLUXO COMPLETO ── */}
      <DrawerSecundarioShell
        isOpen={isSecondaryDrawerOpen}
        onBack={() => setIsSecondaryDrawerOpen(false)}
        onClose={handleCloseDrawers}
        title="Linha do Tempo — Intermitentes"
        widthClass="w-full sm:max-w-2xl"
        badge={loteDetalhe ? getLoteDrawerBadge(loteDetalhe.status) : null}
        hideOverlay={true}
        subtitle={
          loteDetalhe ? (
            <span>
              Lote #{loteDetalhe.id.substring(0, 8)} · Período: {loteDetalhe.periodo_inicio} até {loteDetalhe.periodo_fim}
            </span>
          ) : undefined
        }
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-semibold"
              onClick={() => setIsSecondaryDrawerOpen(false)}
            >
              ← Voltar aos detalhes
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={handleCloseDrawers}
            >
              Fechar
            </Button>
          </div>
        }
      >
        <div className="p-6 space-y-6">
          <div className="p-4 bg-muted/30 rounded-lg border border-border/50 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                Empresa / Lote
              </p>
              <p className="font-semibold text-sm text-foreground">
                {loteDetalhe?.empresa?.nome || "Empresa"}
              </p>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                INT-{loteDetalhe?.competencia}-{loteDetalhe?.id.substring(0, 4)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-mono">
                Valor Total do Lote
              </p>
              <p className="font-mono font-bold text-lg text-emerald-600">
                {formatCurrency(Number(loteDetalhe?.valor_total || 0))}
              </p>
            </div>
          </div>

          {/* Stepper Vertical Canônico */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
              Etapas do Ciclo Operacional & Financeiro
            </h4>

            {(() => {
              const timelineSteps = getIntermitentesTimelineSteps(loteDetalhe?.status, loteDetalhe);
              const isLotePago = loteDetalhe?.status === "PAGO";

              return (
                <div
                  className={cn(
                    "relative border-l-2 ml-4 pl-6 space-y-8 transition-colors",
                    isLotePago ? "border-emerald-300" : "border-slate-200"
                  )}
                >
                  {timelineSteps.map((step) => {
                    const isStepDone = step.state === "done";
                    const isStepCurrent = step.state === "current";
                    const isStepError = step.state === "error";

                    return (
                      <div key={step.number} className="relative">
                        <div
                          className={cn(
                            "absolute -left-[31px] top-0 p-1 rounded-full border-2 transition-all",
                            step.number === 6 && isLotePago
                              ? "bg-emerald-600 border-emerald-700 text-white shadow-md ring-2 ring-emerald-200"
                              : isStepDone
                              ? "bg-emerald-100 border-emerald-600 text-emerald-600"
                              : isStepCurrent
                              ? "bg-blue-100 border-blue-500 text-blue-600"
                              : isStepError
                              ? "bg-rose-100 border-rose-500 text-rose-600"
                              : "bg-slate-100 border-slate-300 text-slate-400"
                          )}
                        >
                          {step.number === 5 && !isStepDone ? (
                            <Banknote className="w-3.5 h-3.5" />
                          ) : isStepCurrent ? (
                            <Clock className="w-3.5 h-3.5" />
                          ) : isStepError ? (
                            <AlertTriangle className="w-3.5 h-3.5" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-bold text-sm",
                                isStepDone
                                  ? "text-slate-900"
                                  : isStepCurrent
                                  ? "text-blue-900"
                                  : "text-slate-500"
                              )}
                            >
                              {step.title}
                            </span>
                            <Badge className={step.badgeClass}>{step.badgeText}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {step.description}
                          </p>
                          {step.timestamp && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              Data: {step.timestamp}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </DrawerSecundarioShell>
      {/* ── MODAL: CONFIRMAR APROVAÇÃO FINANCEIRA ── */}
      <Dialog open={openConfirmarAprovacaoFinanceira} onOpenChange={setOpenConfirmarAprovacaoFinanceira}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-display">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              Confirmar Aprovação Financeira
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Aprovação formal da obrigação contábil para liberação de remessa bancária.
            </DialogDescription>
          </DialogHeader>

          {loteDetalhe && (
            <div className="space-y-3 py-2 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-semibold text-slate-900">{loteDetalhe.empresa?.nome || "Empresa"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Identificador do Lote:</span>
                  <span className="font-mono font-bold text-slate-800">
                    INT-{loteDetalhe.competencia}-{loteDetalhe.id.substring(0, 4)} ({`Lote ${loteDetalhe.id.substring(0, 6)}`})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registros:</span>
                  <span className="font-semibold text-slate-900">{loteDetalhe.quantidade_registros} registros</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-muted-foreground font-medium">Valor Total:</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    {formatCurrency(Number(loteDetalhe.valor_total || 0))}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-lg text-blue-900 leading-relaxed text-[11px]">
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
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
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
    </AppShell>
  );
}
