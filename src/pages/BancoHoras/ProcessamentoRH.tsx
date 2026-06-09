import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  Calendar,
  CalendarClock,
  CheckCircle,
  Clock,
  Edit3,
  Eye,
  ExternalLink,
  FileCheck,
  HandCoins,
  History,
  Loader2,
  MessageSquareQuote,
  PanelRightOpen,
  Play,
  RotateCw,
  Send,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { ColaboradorService, EmpresaService } from "@/services/base.service";
import { BHEventoService, BHRegraService } from "@/services/v4.service";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";
import { processRhPeriod, reprocessRhPeriod, rhProcessingUtils } from "@/services/rhProcessing.service";
import { buildFolhaVariavelPipeline, buildOperationalStagePipeline, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { buildOperationalPipelineSeenKey, useOperationalPipelineAutoTrigger } from "@/hooks/useOperationalPipelineAutoTrigger";
import { getOperationalStatus } from "@/constants/operationalStatus";

const ENGINE_EVENT_TYPES = new Set([
  "motor_regra_aplicada",
  "colaborador_criado_automaticamente",
  "empresa_criada_automaticamente",
  "regra_padrao_aplicada",
  "bloqueio_cadastral",
]);

const inconsistenciaLabelMap: Record<string, string> = {
  atraso_excessivo: "Atraso excessivo",
  bloqueio_cadastral: "Bloqueio cadastral",
  colaborador_criado_automaticamente: "Colaborador criado automaticamente",
  empresa_criada_automaticamente: "Empresa criada automaticamente",
  entrada_ausente: "Ponto incompleto",
  falta: "Falta",
  intervalo_invalido: "Jornada inválida",
  jornada_invalida: "Jornada inválida",
  motor_regra_aplicada: "Motor: regra aplicada",
  regra_inexistente: "Regra ausente",
  regra_padrao_aplicada: "Motor: regra padrão aplicada",
  saida_ausente: "Ponto incompleto",
};

const getInconsistenciaLabel = (tipo?: string | null) => {
  if (!tipo) return "—";
  return inconsistenciaLabelMap[tipo] || tipo.split("_").join(" ");
};

const minutesToTime = (totalMinutes: number) => {
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${hours}h ${minutes}m`;
};

const currentMonthDefault = format(new Date(), "yyyy-MM");

const formatCompetenciaLabel = (competencia: string) => {
  const [year, month] = competencia.split("-").map(Number);
  return format(new Date(year, month - 1, 1), "MMMM/yyyy", { locale: ptBR });
};

const formatPipelineTimestamp = (value?: string | null) => {
  if (!value) return undefined;
  return format(new Date(value), "dd 'de' MMM, HH:mm", { locale: ptBR });
};

const DEFAULT_RULE_NAME = "Regra padrão automática 8h";

const parseHourMinuteString = (value?: string | null) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(-)?(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const sign = match[1] ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3]));
};

const formatCompactMinutes = (value: number) => {
  const abs = Math.abs(value);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;

  if (hours > 0 && minutes > 0) return `${hours}h${String(minutes).padStart(2, "0")}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
};

const formatRuleMinutes = (value: number) => (value > 0 ? formatCompactMinutes(value) : "0min");

const resolveRuleForPonto = (ponto: any, regras: any[]) => {
  const regraAplicada = String(ponto.regra_aplicada || "").trim();
  if (!regraAplicada) return null;

  const regraDaEmpresa = regras.find(
    (regra: any) => regra.nome === regraAplicada && regra.empresa_id === (ponto.empresa_id || null),
  );

  if (regraDaEmpresa) return regraDaEmpresa;

  const regraGlobal = regras.find(
    (regra: any) => regra.nome === regraAplicada && (regra.empresa_id === null || regra.empresa_id === undefined),
  );

  if (regraGlobal) return regraGlobal;

  if (regraAplicada === DEFAULT_RULE_NAME) {
    return {
      nome: DEFAULT_RULE_NAME,
      carga_horaria_diaria: 8,
      jornada_contratada: 8,
      tolerancia_atraso: 10,
      tolerancia_hora_extra: 10,
      limite_diario_banco: 120,
    };
  }

  return null;
};

const buildRuleExplanation = (ponto: any, regra: any) => {
  const workedMinutes =
    parseHourMinuteString(ponto.horas_calculadas) ?? rhProcessingUtils.calculateWorkedMinutes(ponto);
  const jornadaHours =
    Number(ponto.jornada_calculada ?? regra?.carga_horaria_diaria ?? regra?.jornada_contratada ?? 8) || 8;
  const jornadaMinutes = Math.round(jornadaHours * 60);
  const toleranciaExtra = Number(regra?.tolerancia_hora_extra ?? (ponto.regra_aplicada === DEFAULT_RULE_NAME ? 10 : 0)) || 0;
  const toleranciaAtraso = Number(regra?.tolerancia_atraso ?? (ponto.regra_aplicada === DEFAULT_RULE_NAME ? 10 : 5)) || 0;
  const limiteDiarioBanco = Number(regra?.limite_diario_banco ?? (ponto.regra_aplicada === DEFAULT_RULE_NAME ? 120 : 480)) || 480;
  const saldoBase = workedMinutes - jornadaMinutes;
  const saldoFinal = Number(ponto.saldo_dia || 0);
  const minutosExtra = Number(ponto.minutos_extra || 0);
  const minutosAtraso = Number(ponto.minutos_atraso || 0);
  const excedente = Math.max(saldoBase, 0);
  const deficit = Math.max(-saldoBase, 0);
  const descontoTolerancia = excedente > 0 ? Math.min(excedente, toleranciaExtra) : Math.min(deficit, toleranciaAtraso);
  const brutoPosTolerancia = excedente > 0 ? Math.max(excedente - toleranciaExtra, 0) : Math.max(deficit - toleranciaAtraso, 0);
  const descontoLimite = excedente > 0 ? Math.max(brutoPosTolerancia - minutosExtra, 0) : 0;

  let resumo = `Jornada padrão ${jornadaHours}h sem desconto aplicado.`;

  if (excedente > 0) {
    resumo =
      minutosExtra > 0
        ? `Jornada padrão ${jornadaHours}h com tolerância de ${formatRuleMinutes(toleranciaExtra)}. Excedente de ${formatCompactMinutes(excedente)} -> ${formatCompactMinutes(minutosExtra)} convertidos em banco.`
        : `Jornada padrão ${jornadaHours}h com tolerância de ${formatRuleMinutes(toleranciaExtra)}. Excedente de ${formatCompactMinutes(excedente)} ficou dentro da política e não virou banco.`;
  } else if (deficit > 0) {
    resumo =
      minutosAtraso > 0
        ? `Jornada padrão ${jornadaHours}h com tolerância de atraso de ${formatRuleMinutes(toleranciaAtraso)}. Déficit de ${formatCompactMinutes(deficit)} -> ${formatCompactMinutes(minutosAtraso)} descontados do banco.`
        : `Jornada padrão ${jornadaHours}h com tolerância de atraso de ${formatRuleMinutes(toleranciaAtraso)}. Déficit de ${formatCompactMinutes(deficit)} ficou dentro da tolerância.`;
  }

  return {
    regraNome: ponto.regra_aplicada || regra?.nome || "—",
    resumo,
    workedMinutes,
    jornadaHours,
    jornadaMinutes,
    saldoBase,
    saldoFinal,
    minutosExtra,
    minutosAtraso,
    excedente,
    deficit,
    toleranciaExtra,
    toleranciaAtraso,
    descontoTolerancia,
    descontoLimite,
    limiteDiarioBanco,
  };
};

type OperationalActionType = "ajuste_manual" | "compensacao" | "pagamento" | "folga";
type RhDirectActionType =
  | "credito_manual"
  | "debito_manual"
  | "compensacao"
  | "pagamento"
  | "folga"
  | "zerar_saldo";
type RhDrawerTab = "visao_geral" | "ajustes_rh" | "historico_auditoria";

type RhActionComposerState = {
  mode: "evento" | "direto";
  action: RhDirectActionType;
  evento: any;
} | null;

const getBhEventMinutes = (evento: any) => Number(evento?.minutos ?? evento?.quantidade_minutos ?? 0);
const getBhEventType = (evento: any) => String(evento?.tipo_evento ?? evento?.tipo ?? "").trim().toLowerCase();
const getBhEventDate = (evento: any) => String(evento?.data_evento ?? evento?.data ?? evento?.created_at ?? "");
const getBhEventStatus = (evento: any) => String(evento?.status ?? "ativo").trim().toLowerCase();
const getBhEventDescription = (evento: any) => String(evento?.observacao ?? evento?.descricao ?? "").trim();

const formatSignedMinutes = (mins: number) => {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${mins < 0 ? "-" : "+"}${h}h${String(m).padStart(2, "0")}m`;
};

const formatEventDate = (value?: string | null) => {
  if (!value) return "—";
  return format(new Date(`${value}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
};

const getAvailableOperationalActions = (evento: any): Array<{ key: OperationalActionType; label: string }> => {
  const status = getBhEventStatus(evento);
  const tipo = getBhEventType(evento);
  const minutos = getBhEventMinutes(evento);

  if (["pago", "compensado", "ajustado", "cancelado"].includes(status)) {
    return [];
  }

  const actions: Array<{ key: OperationalActionType; label: string }> = [];

  if (minutos > 0 && tipo !== "pagamento") {
    actions.push({ key: "compensacao", label: "Compensar saldo" });
    actions.push({ key: "pagamento", label: "Marcar pagamento" });
    actions.push({ key: "folga", label: "Registrar folga" });
  }

  if (tipo !== "ajuste_manual") {
    actions.push({ key: "ajuste_manual", label: "Ajuste manual" });
  }

  return actions;
};

const directRhActionOptions: Array<{
  key: RhDirectActionType;
  label: string;
  description: string;
  needsMinutes?: boolean;
  usesFolgaDate?: boolean;
}> = [
    { key: "compensacao", label: "Compensar saldo", description: "Abate saldo positivo diretamente do banco.", needsMinutes: true },
    { key: "credito_manual", label: "Adicionar crédito manual", description: "Lança crédito manual com justificativa obrigatória.", needsMinutes: true },
    { key: "debito_manual", label: "Lançar débito", description: "Registra débito manual direto no saldo do colaborador.", needsMinutes: true },
    { key: "pagamento", label: "Converter em pagamento", description: "Envia saldo para reflexo financeiro futuro.", needsMinutes: true },
    { key: "folga", label: "Lançar folga", description: "Converte saldo em descanso com data definida.", needsMinutes: true, usesFolgaDate: true },
    { key: "zerar_saldo", label: "Zerar saldo", description: "Cria contrapartida total para estabilizar o saldo atual." },
  ];

const directRhActionMetaMap: Record<
  RhDirectActionType,
  { title: string; confirmLabel: string; icon: any }
> = {
  compensacao: {
    title: "Compensar saldo",
    confirmLabel: "Compensar agora",
    icon: HandCoins,
  },
  credito_manual: {
    title: "Adicionar crédito manual",
    confirmLabel: "Lançar crédito",
    icon: TrendingUp,
  },
  debito_manual: {
    title: "Lançar débito manual",
    confirmLabel: "Lançar débito",
    icon: TrendingDown,
  },
  pagamento: {
    title: "Converter saldo em pagamento",
    confirmLabel: "Enviar para financeiro",
    icon: Banknote,
  },
  folga: {
    title: "Lançar folga",
    confirmLabel: "Registrar folga",
    icon: CalendarClock,
  },
  zerar_saldo: {
    title: "Zerar saldo atual",
    confirmLabel: "Zerar saldo",
    icon: RefreshCw,
  },
};

const operationalActionMetaMap: Record<
  OperationalActionType,
  { title: string; description: string; confirmLabel: string; icon: any }
> = {
  ajuste_manual: {
    title: "Lançar ajuste manual",
    description: "Registre minutos positivos ou negativos e deixe a justificativa para auditoria operacional.",
    confirmLabel: "Salvar ajuste",
    icon: Edit3,
  },
  compensacao: {
    title: "Compensar saldo",
    description: "O saldo selecionado será abatido do banco de horas do colaborador.",
    confirmLabel: "Confirmar compensação",
    icon: HandCoins,
  },
  pagamento: {
    title: "Encaminhar para pagamento",
    description: "O evento será abatido do banco e sinalizado para reflexo financeiro posterior.",
    confirmLabel: "Marcar para pagamento",
    icon: Banknote,
  },
  folga: {
    title: "Registrar folga",
    description: "Escolha a data da folga para converter o saldo em descanso com trilha de auditoria.",
    confirmLabel: "Confirmar folga",
    icon: CalendarClock,
  },
};

const ProcessamentoRH = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenantId } = useTenant();
  const { openPipeline } = useOperationalPipeline();
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(currentMonthDefault);
  const [searchTerm, setSearchTerm] = useState("");
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pontos");
  const [isProcessing, setIsProcessing] = useState(false);
  const processingLockRef = useRef(false);
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalValidation, setApprovalValidation] = useState<any>(null);
  const [isApprovingCompetencia, setIsApprovingCompetencia] = useState(false);
  const [financialEligibilityError, setFinancialEligibilityError] = useState<{ message: string, details: Array<{ nome: string; problemas: string[] }> } | null>(null);
  const [selectedRuleExplanation, setSelectedRuleExplanation] = useState<any | null>(null);
  const [selectedColaboradorKey, setSelectedColaboradorKey] = useState<string | null>(null);
  const [selectedPontoId, setSelectedPontoId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<RhDrawerTab>("visao_geral");
  const [actionComposer, setActionComposer] = useState<RhActionComposerState>(null);
  const [actionMinutes, setActionMinutes] = useState("0");
  const [actionObservation, setActionObservation] = useState("");
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));
  const [actionLoading, setActionLoading] = useState<Record<string, RhDirectActionType | null>>({});
  const [justificationTarget, setJustificationTarget] = useState<any | null>(null);
  const [isSavingJustification, setIsSavingJustification] = useState(false);
  const [isReprocessingIndividual, setIsReprocessingIndividual] = useState(false);

  // Governança Admin
  const [adminJustificationModalOpen, setAdminJustificationModalOpen] = useState(false);
  const [adminJustificationPayload, setAdminJustificationPayload] = useState<{
    actionType: string;
    actionLabel: string;
    callback: (justificativa: string) => Promise<void>;
  } | null>(null);

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores_all"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles_log_names", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("tenant_id", tenantId);
      if (error) return [];
      return data || [];
    },
  });

  const profileNameMap = useMemo(
    () => new Map((profiles as any[]).map((profile: any) => [String(profile.user_id), String(profile.full_name || "Usuário interno")])),
    [profiles],
  );

  const { data: regras = [] } = useQuery({
    queryKey: ["bh_regras_all"],
    queryFn: () => BHRegraService.getWithEmpresa(),
  });

  // Detect the most recent month with ponto records to auto-select it
  const { data: mesesComRegistros = [] } = useQuery({
    queryKey: ["rh_meses_com_registros", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("registros_ponto")
        .select("data")
        .eq("tenant_id", tenantId)
        .order("data", { ascending: false })
        .limit(500);
      if (error) return [];
      const meses = new Set<string>();
      for (const row of data ?? []) {
        if (row.data) meses.add(row.data.slice(0, 7));
      }
      return Array.from(meses).sort().reverse();
    },
    staleTime: 30_000,
  });

  // Auto-select the most recent month with records if current month has none
  useEffect(() => {
    if (mesesComRegistros.length === 0) return;
    const mostRecent = mesesComRegistros[0];
    if (mostRecent && mostRecent !== currentMonthDefault) {
      // Only auto-switch if we haven't manually changed the month
      setSelectedMonth((prev) => (prev === currentMonthDefault ? mostRecent : prev));
    }
  }, [mesesComRegistros]);

  const { data: pontos = [], isLoading: isLoadingPontos, refetch } = useQuery({
    queryKey: ["rh_pontos_periodo", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];

      let query = supabase
        .from("registros_ponto")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["banco_horas_saldos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("banco_horas_saldos")
        .select("*")
        .eq("tenant_id", tenantId);
      if (error) return [];
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["processamento_rh_logs", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);

      let query = (supabase as any)
        .from("processamento_rh_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("periodo_mes", month)
        .eq("periodo_ano", year)
        .order("executado_em", { ascending: false });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  const { data: inconsistencias = [] } = useQuery({
    queryKey: ["processamento_rh_inconsistencias", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0).toISOString();

      let query = (supabase as any)
        .from("processamento_rh_inconsistencias")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  const saldoMap = useMemo(
    () => new Map((saldos as any[]).map((saldo) => [saldo.colaborador_id, saldo])),
    [saldos],
  );

  const empresaMap = useMemo(
    () => new Map((empresas as any[]).map((empresa) => [empresa.id, empresa.nome])),
    [empresas],
  );

  const profileMap = useMemo(
    () => new Map((profiles as any[]).map((profile) => [profile.user_id, profile.full_name])),
    [profiles],
  );

  const filteredPontos = useMemo(() => {
    return (pontos as any[]).filter((ponto) => {
      const nome = ponto.nome_colaborador || "";
      if (!searchTerm) return true;
      return rhProcessingUtils
        .normalizeText(nome)
        .includes(rhProcessingUtils.normalizeText(searchTerm));
    });
  }, [pontos, searchTerm]);

  const groupedColaboradores = useMemo(() => {
    const groups = new Map<string, any>();

    filteredPontos.forEach((ponto: any) => {
      const key = ponto.colaborador_id || ponto.matricula_colaborador || ponto.cpf_colaborador || ponto.nome_colaborador || ponto.id;
      const current = groups.get(key) || {
        key,
        colaborador_id: ponto.colaborador_id || null,
        nome: ponto.nome_colaborador || "Sem vínculo",
        empresa_id: ponto.empresa_id || null,
        diasProcessados: 0,
        positivas: 0,
        negativas: 0,
        saldoPeriodo: 0,
        saldoAtual: 0,
        ultimoProcessamento: null as string | null,
      };

      if (ponto.status_processamento === "processado" || ponto.status_processamento === "inconsistente") {
        current.diasProcessados += 1;
      }

      const saldoDia = Number(ponto.saldo_dia || 0);
      current.positivas += Math.max(saldoDia, 0);
      current.negativas += Math.max(-saldoDia, 0);
      current.saldoPeriodo += saldoDia;

      const saldoAtual = saldoMap.get(ponto.colaborador_id || "")?.saldo_atual_minutos;
      if (typeof saldoAtual === "number") {
        current.saldoAtual = saldoAtual;
      }

      if (ponto.processado_em) {
        if (!current.ultimoProcessamento || new Date(ponto.processado_em) > new Date(current.ultimoProcessamento)) {
          current.ultimoProcessamento = ponto.processado_em;
        }
      }

      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filteredPontos, saldoMap]);

  const selectedColaborador = useMemo(
    () => groupedColaboradores.find((item) => item.key === selectedColaboradorKey) ?? null,
    [groupedColaboradores, selectedColaboradorKey],
  );

  const selectedColaboradorPontos = useMemo(() => {
    if (!selectedColaborador) return [];
    return filteredPontos
      .filter((ponto: any) => {
        const key =
          ponto.colaborador_id ||
          ponto.matricula_colaborador ||
          ponto.cpf_colaborador ||
          ponto.nome_colaborador ||
          ponto.id;
        return key === selectedColaborador.key;
      })
      .sort((a: any, b: any) => {
        const dateDiff = new Date(b.data).getTime() - new Date(a.data).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
  }, [filteredPontos, selectedColaborador]);

  const selectedPonto = useMemo(() => {
    if (selectedColaboradorPontos.length === 0) return null;
    return (
      selectedColaboradorPontos.find((ponto: any) => ponto.id === selectedPontoId) ??
      selectedColaboradorPontos[0]
    );
  }, [selectedColaboradorPontos, selectedPontoId]);

  const selectedColaboradorCompetencia = selectedPonto?.competencia || selectedMonth;

  const selectedColaboradorRule = useMemo(() => {
    if (!selectedPonto) return null;
    return resolveRuleForPonto(selectedPonto, regras as any[]);
  }, [selectedPonto, regras]);

  const selectedColaboradorRuleBreakdown = useMemo(() => {
    if (!selectedPonto) return null;
    return buildRuleExplanation(selectedPonto, selectedColaboradorRule);
  }, [selectedPonto, selectedColaboradorRule]);

  const selectedMonthRange = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    return {
      from: new Date(year, month - 1, 1),
      to: new Date(year, month, 0),
    };
  }, [selectedMonth]);

  const { data: selectedColaboradorFicha } = useQuery({
    queryKey: ["colaborador", selectedColaborador?.colaborador_id],
    queryFn: () => ColaboradorService.getById(selectedColaborador!.colaborador_id),
    enabled: Boolean(selectedColaborador?.colaborador_id),
  });

  const { data: selectedColaboradorEventos = [], isLoading: isLoadingSelectedEventos } = useQuery({
    queryKey: ["bh_eventos_processamento_rh", selectedColaborador?.colaborador_id, selectedMonth],
    queryFn: () =>
      BHEventoService.getByColaborador(
        selectedColaborador!.colaborador_id,
        selectedMonthRange.from,
        selectedMonthRange.to,
      ),
    enabled: Boolean(selectedColaborador?.colaborador_id),
  });

  const { data: selectedColaboradorEventosHistorico = [] } = useQuery({
    queryKey: ["bh_eventos_historico_processamento_rh", selectedColaborador?.colaborador_id],
    queryFn: () => BHEventoService.getByColaborador(selectedColaborador!.colaborador_id),
    enabled: Boolean(selectedColaborador?.colaborador_id),
  });

  const processedSelectedEventos = useMemo(() => {
    return [...selectedColaboradorEventos]
      .sort((a: any, b: any) => {
        const dateDiff = new Date(getBhEventDate(b)).getTime() - new Date(getBhEventDate(a)).getTime();
        if (dateDiff !== 0) return dateDiff;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .map((evento: any) => ({
        ...evento,
        displayDate: formatEventDate(getBhEventDate(evento).slice(0, 10)),
        displayMinutes: formatSignedMinutes(getBhEventMinutes(evento)),
        displayStatus: getBhEventStatus(evento),
        description: getBhEventDescription(evento),
        actions: getAvailableOperationalActions(evento),
      }));
  }, [selectedColaboradorEventos]);

  const pendingCount = useMemo(
    () => filteredPontos.filter((ponto: any) => ponto.status_processamento === "PENDENTE_PROCESSAMENTO").length,
    [filteredPontos],
  );

  const colaboradoresPendentesComplemento = useMemo(() => {
    return (colaboradores as any[]).filter((colaborador) => {
      const matchesEmpresa =
        selectedEmpresa === "all" || colaborador.empresa_id === selectedEmpresa;

      return (
        matchesEmpresa &&
        colaborador.tipo_colaborador !== "DIARISTA" &&
        (colaborador.status_cadastro === "pendente_complemento" ||
          colaborador.cadastro_provisorio)
      );
    });
  }, [colaboradores, selectedEmpresa]);

  const hasPendentesComplemento = colaboradoresPendentesComplemento.length > 0;

  const eventosMotor = useMemo(
    () => (inconsistencias as any[]).filter((item) => ENGINE_EVENT_TYPES.has(item.tipo)),
    [inconsistencias],
  );

  const inconsistenciasReais = useMemo(
    () => (inconsistencias as any[]).filter((item) => !ENGINE_EVENT_TYPES.has(item.tipo)),
    [inconsistencias],
  );

  const selectedColaboradorInconsistencias = useMemo(() => {
    if (!selectedColaborador) return [];
    return inconsistenciasReais
      .filter((item: any) => {
        if (selectedPonto?.id) {
          return item.registro_ponto_id === selectedPonto.id;
        }
        return item.colaborador_id && item.colaborador_id === selectedColaborador.colaborador_id;
      })
      .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [inconsistenciasReais, selectedColaborador, selectedPonto]);

  const selectedColaboradorHistoricoAuditoria = useMemo(() => {
    const eventos = (selectedColaboradorEventosHistorico as any[]).map((evento: any) => ({
      id: `evento-${evento.id}`,
      tipo: "evento",
      dataOrdenacao: getBhEventDate(evento),
      titulo: getBhEventDescription(evento) || `Evento ${getBhEventType(evento) || "operacional"}`,
      detalhe: `${formatSignedMinutes(getBhEventMinutes(evento))} · ${getBhEventType(evento) || "evento"}`,
      responsavel:
        evento.executado_por_nome ||
        profileNameMap.get(String(evento.executado_por || "")) ||
        "Sistema",
      origem: evento.origem || "processamento_rh",
      status: getBhEventStatus(evento),
    }));

    const inconsistenciasAudit = selectedColaboradorInconsistencias.map((item: any) => ({
      id: `inconsistencia-${item.id}`,
      tipo: "inconsistencia",
      dataOrdenacao: String(item.created_at || item.updated_at || ""),
      titulo: getInconsistenciaLabel(item.tipo),
      detalhe: item.observacao || item.descricao || "Sem justificativa registrada.",
      responsavel: "RH",
      origem: "processamento_rh_inconsistencias",
      status: item.observacao ? "justificada" : "aberta",
    }));

    return [...eventos, ...inconsistenciasAudit].sort(
      (a, b) => new Date(b.dataOrdenacao || 0).getTime() - new Date(a.dataOrdenacao || 0).getTime(),
    );
  }, [profileNameMap, selectedColaboradorEventosHistorico, selectedColaboradorInconsistencias]);

  const stats = useMemo(() => {
    const processados = (pontos as any[]).filter((ponto) => ponto.status_processamento === "PROCESSADO").length;
    const inconsistentes = (pontos as any[]).filter((ponto) => ponto.status_processamento === "INCONSISTENTE").length;
    const pendentes = (pontos as any[]).filter((ponto) => ponto.status_processamento === "PENDENTE_PROCESSAMENTO").length;
    const horasPositivas = (pontos as any[]).reduce((acc, ponto) => acc + Math.max(Number(ponto.saldo_dia || 0), 0), 0);
    const horasNegativas = (pontos as any[]).reduce((acc, ponto) => acc + Math.max(-Number(ponto.saldo_dia || 0), 0), 0);
    const faltas = (pontos as any[]).filter((ponto) => ponto.status === "Ausente" || ponto.status === "Falta").length;
    const saldoAcumuladoTotal = (saldos as any[]).reduce((acc, saldo) => acc + Number(saldo.saldo_atual_minutos || 0), 0);
    const colaboradoresPositivos = (saldos as any[]).filter((saldo) => Number(saldo.saldo_atual_minutos || 0) > 0).length;
    const colaboradoresNegativos = (saldos as any[]).filter((saldo) => Number(saldo.saldo_atual_minutos || 0) < 0).length;

    return {
      total: (pontos as any[]).length,
      processados,
      inconsistentes,
      pendentes,
      regrasAtivas: (regras as any[]).filter((regra) => regra.bh_ativo !== false).length,
      horasPositivas,
      horasNegativas,
      faltas,
      saldoAcumuladoTotal,
      colaboradoresPositivos,
      colaboradoresNegativos,
    };
  }, [pontos, regras, saldos]);

  const processamentoEmpresaNome = useMemo(
    () => (empresas as any[]).find((empresa) => empresa.id === selectedEmpresa)?.nome || "Empresa",
    [empresas, selectedEmpresa],
  );

  const selectedCompetenciaLabel = useMemo(
    () => formatCompetenciaLabel(selectedMonth),
    [selectedMonth],
  );
  const activeCompetencia = selectedMonth;
  const importacaoTimestamp = useMemo(() => {
    const importedAt = (pontos as any[])
      .map((ponto) => ponto.created_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    return formatPipelineTimestamp(importedAt);
  }, [pontos]);

  const processamentoRhTimestamp = useMemo(() => {
    const executedAt = (logs as any[])
      .find((log) => !log.reprocessado)?.executado_em;
    return formatPipelineTimestamp(executedAt);
  }, [logs]);
  const processPipelineReviewTrigger = useMemo(
    () =>
      buildFolhaVariavelPipeline({
        competencia: activeCompetencia,
        empresa: selectedEmpresa === "all" ? "Todas as Empresas" : processamentoEmpresaNome,
        currentStep: "fechamento_rh",
        completedStage: "rh_processado",
        timestamps: {
          importacao: importacaoTimestamp,
          rh_processado: processamentoRhTimestamp,
        },
      }),
    [activeCompetencia, importacaoTimestamp, processamentoEmpresaNome, processamentoRhTimestamp, selectedEmpresa],
  );

  const processamentoRhConcluido =
    selectedEmpresa !== "all" &&
    stats.total > 0 &&
    stats.processados > 0 &&
    stats.pendentes === 0 &&
    !hasPendentesComplemento &&
    inconsistenciasReais.length === 0;

  const processamentoRhTrigger = useMemo(
    () =>
      processamentoRhConcluido
        ? buildOperationalStagePipeline({
          competencia: activeCompetencia,
          empresa: processamentoEmpresaNome,
          completedStage: "processamento_rh",
        })
        : null,
    [activeCompetencia, processamentoRhConcluido, processamentoEmpresaNome],
  );

  useOperationalPipelineAutoTrigger({
    enabled: processamentoRhConcluido,
    storageKey: buildOperationalPipelineSeenKey({
      etapa: "processamento_rh_concluido",
      competencia: activeCompetencia,
      empresa: selectedEmpresa,
    }),
    trigger: processamentoRhTrigger,
  });

  const { data: reprocessGuard } = useQuery({
    queryKey: ["rh_reprocess_guard", selectedEmpresa, activeCompetencia],
    queryFn: () => RHFinanceiroService.validateReprocessPeriod(selectedEmpresa, activeCompetencia),
    enabled: selectedEmpresa !== "all",
    staleTime: 30_000,
  });

  // O período passa a ser tratado como fechado quando já existe trilha persistida no fluxo financeiro.
  const isPeriodoFechado = useMemo(() => {
    if (selectedEmpresa === "all") return false;
    return reprocessGuard?.permitido === false;
  }, [reprocessGuard, selectedEmpresa]);

  const requiresAdminJustification = async (actionFn: (justificativa: string) => Promise<void>, actionLabel: string, actionType: string) => {
    // Se o período está fechado e a ação vai afetar dados financeiros passados
    // Necessita justificativa obrigatória e registro na tabela de auditoria overrides
    setAdminJustificationPayload({
      actionType,
      actionLabel,
      callback: actionFn
    });
    setAdminJustificationModalOpen(true);
  };

  const invalidateRhQueries = async () => {
    await Promise.allSettled([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["processamento_rh_logs"] }),
      queryClient.invalidateQueries({ queryKey: ["processamento_rh_inconsistencias"] }),
      queryClient.invalidateQueries({ queryKey: ["banco_horas_saldos"] }),
      queryClient.invalidateQueries({ queryKey: ["bh_saldos"] }),
      queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lotes"] }),
      queryClient.invalidateQueries({ queryKey: ["rh_reprocess_guard"] }),
      queryClient.invalidateQueries({ queryKey: ["operational-pulse"] }),
    ]);
  };

  const validarAprovacaoCompetencia = async () => {
    if (selectedEmpresa === "all") {
      toast.error("Selecione uma empresa especifica para aprovar a competencia.");
      return;
    }

    setIsApprovingCompetencia(true);
    try {
      setFinancialEligibilityError(null);
      const validation = await RHFinanceiroService.validateCompetenciaApproval(selectedEmpresa, activeCompetencia);
      setApprovalValidation(validation);
      setApprovalModalOpen(true);
    } catch (error: any) {
      toast.error(error.message || "Nao foi possivel validar a aprovacao da competencia.");
    } finally {
      setIsApprovingCompetencia(false);
    }
  };

  const aprovarCompetencia = async () => {
    if (selectedEmpresa === "all") {
      toast.error("Selecione uma empresa especifica para aprovar a competencia.");
      return;
    }

    setIsApprovingCompetencia(true);
    try {
      const result = await RHFinanceiroService.approveCompetencia(selectedEmpresa, activeCompetencia);
      await invalidateRhQueries();

      const mensagens: string[] = [];
      if (result.lotesCriados.length > 0) {
        mensagens.push(`${result.lotesCriados.length} lote(s) criado(s)`);
      }
      if (result.lotesExistentes.length > 0) {
        mensagens.push(`${result.lotesExistentes.length} lote(s) ja existiam`);
      }

      toast.success("Competencia aprovada e entregue ao Financeiro.", {
        description: mensagens.join(" · ") || "A fila financeira foi atualizada.",
      });

      setApprovalModalOpen(false);
      setApprovalValidation(null);

      // Trigger Pipeline Modal
      const empresaNome = (empresas as any[]).find((e) => e.id === selectedEmpresa)?.nome || "Empresa";
      openPipeline(
        buildFolhaVariavelPipeline({
          competencia: activeCompetencia,
          empresa: empresaNome,
          currentStep: "aprovacao_financeira",
          completedStage: "envio_financeiro",
          timestamps: {
            importacao: importacaoTimestamp,
            rh_processado: processamentoRhTimestamp,
            envio_financeiro: formatPipelineTimestamp(result.approvedAt),
          },
        })
      );
    } catch (error: any) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.code === "FINANCIAL_INELIGIBILITY") {
          setFinancialEligibilityError(parsed);
          return;
        }
      } catch {
        // Ignore parse failures and fall back to the generic error toast below.
      }

      toast.error(error.message || "Nao foi possivel aprovar a competencia.");
    } finally {
      setIsApprovingCompetencia(false);
    }
  };

  const processarPontos = async () => {
    if (processingLockRef.current) return;

    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    processingLockRef.current = true;
    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const result = await processRhPeriod({
        tenantId,
        month: activeCompetencia,
        empresaId: selectedEmpresa === "all" ? null : selectedEmpresa,
        empresas: empresas as any[],
        colaboradores: colaboradores as any[],
        regras: regras as any[],
        executionType: "manual",
      });

      setProcessingResult(result);
      await invalidateRhQueries();

      if (result.totalProcessados === 0) {
        toast.info("Nenhum registro pendente encontrado para processar.");
      } else {
        const parts: string[] = [`${result.totalProcessados} registros processados`];
        if (result.pendentesCadastrais > 0) {
          parts.push(`${result.pendentesCadastrais} pendentes cadastrais`);
        }
        if (result.totalInconsistencias > 0) {
          parts.push(`${result.totalInconsistencias} inconsistência(s)`);
        }
        toast.success(`Processamento concluído: ${parts.join(" · ")}`);

        // Trigger Pipeline Modal if successful
        const empresaNome =
          selectedEmpresa === "all"
            ? "Todas as Empresas"
            : (empresas as any[]).find((e) => e.id === selectedEmpresa)?.nome || "Empresa";

        openPipeline(
          buildFolhaVariavelPipeline({
            competencia: activeCompetencia,
            empresa: empresaNome,
            currentStep: "fechamento_rh",
            completedStage: "rh_processado",
            timestamps: {
              importacao: importacaoTimestamp,
              rh_processado: formatPipelineTimestamp(result.processedAt),
            },
          })
        );
      }

      setProcessModalOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao processar: ${error.message}`);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const reprocessarPontos = async (forcedJustificativa?: string) => {
    if (processingLockRef.current) return;

    if (!tenantId) {
      toast.error("Tenant não identificado");
      return;
    }

    if (!forcedJustificativa) {
      if (selectedEmpresa === "all") {
        return requiresAdminJustification(
          async (j) => reprocessarPontos(j),
          "Reprocessar período (todas as empresas)",
          "reprocessamento_periodo_global",
        );
      }

      const guard = await RHFinanceiroService.validateReprocessPeriod(selectedEmpresa, activeCompetencia);
      if (!guard.permitido) {
        return requiresAdminJustification(
          async (j) => reprocessarPontos(j),
          "Reprocessar período fechado",
          "reprocessamento_periodo",
        );
      }
    }

    processingLockRef.current = true;
    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const result = await reprocessRhPeriod({
        tenantId,
        month: activeCompetencia,
        empresaId: selectedEmpresa === "all" ? null : selectedEmpresa,
        colaboradores: colaboradores as any[],
        executionType: forcedJustificativa ? "override_admin" as any : "manual",
      });

      await invalidateRhQueries();
      toast.warning(`Período reaberto: ${result.registrosLimpados} registros limpos para novo processamento.`);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao reprocessar: ${error.message}`);
    } finally {
      processingLockRef.current = false;
      setIsProcessing(false);
    }
  };

  const openColaboradorDrawer = (item: any, pontoId?: string | null) => {
    setSelectedColaboradorKey(item.key);
    setSelectedPontoId(pontoId || null);

    const nextParams = new URLSearchParams(searchParams);
    if (item.colaborador_id) {
      nextParams.set("colaborador", item.colaborador_id);
    }
    if (pontoId) {
      nextParams.set("ponto", pontoId);
    } else {
      nextParams.delete("ponto");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const closeColaboradorDrawer = (open: boolean) => {
    if (open) return;
    setSelectedColaboradorKey(null);
    setSelectedPontoId(null);
    setDrawerTab("visao_geral");
    setActionComposer(null);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("colaborador");
    nextParams.delete("ponto");
    setSearchParams(nextParams, { replace: true });
  };

  const openOperationalActionComposer = (evento: any, action: OperationalActionType) => {
    setDrawerTab("ajustes_rh");
    setActionComposer({ mode: "evento", evento, action });
    setActionObservation("");
    setActionMinutes(String(Math.abs(getBhEventMinutes(evento)) || 0));
    setActionDate(new Date().toISOString().slice(0, 10));
  };

  const openDirectRhActionComposer = (action: RhDirectActionType) => {
    setDrawerTab("ajustes_rh");
    setActionComposer({ mode: "direto", action, evento: null });
    setActionObservation("");
    if (action === "zerar_saldo") {
      setActionMinutes(String(Math.abs(Number(selectedColaborador?.saldoAtual || 0))));
    } else if (action === "credito_manual" || action === "debito_manual") {
      setActionMinutes("60");
    } else {
      const suggested = Math.max(Math.min(Number(selectedColaborador?.saldoAtual || 0), 480), 0);
      setActionMinutes(String(suggested || 60));
    }
    setActionDate(new Date().toISOString().slice(0, 10));
  };

  const closeOperationalActionComposer = () => {
    setActionComposer(null);
    setActionObservation("");
    setActionMinutes("0");
    setActionDate(new Date().toISOString().slice(0, 10));
  };

  const openOperationalActionDialog = openOperationalActionComposer;
  const closeOperationalActionDialog = closeOperationalActionComposer;
  const actionDialog =
    actionComposer?.mode === "evento"
      ? { action: actionComposer.action as OperationalActionType, evento: actionComposer.evento }
      : null;

  const handleConfirmOperationalAction = async (forcedJustificativa?: string) => {
    if (!actionComposer || !selectedColaborador?.colaborador_id) return;

    const { evento, action, mode } = actionComposer;
    const actionKey = evento?.id || `direto:${selectedColaborador.colaborador_id}`;

    // Se o período está fechado e ainda não temos uma justificativa validada, 
    // paramos o fluxo aqui e chamamos o modal
    if (isPeriodoFechado && !forcedJustificativa) {
      return requiresAdminJustification(
        async (j) => handleConfirmOperationalAction(j),
        mode === "evento"
          ? operationalActionMetaMap[action as OperationalActionType].title
          : directRhActionMetaMap[action].title,
        action
      );
    }

    setActionLoading((current) => ({ ...current, [actionKey]: action }));

    try {
      const finalObservation = forcedJustificativa
        ? `${actionObservation} | Motivo Override: ${forcedJustificativa}`
        : actionObservation;

      if (mode === "evento" && evento) {
        await BHEventoService.registrarAcaoExtrato({
          eventoId: evento.id,
          tipo: action as OperationalActionType,
          observacao: finalObservation,
          minutos: action === "ajuste_manual" ? Number(actionMinutes) : undefined,
          dataFolga: action === "folga" ? actionDate : undefined,
        });
      } else {
        await BHEventoService.registrarAcaoRhDireta({
          colaboradorId: selectedColaborador.colaborador_id,
          empresaId: selectedColaborador.empresa_id || null,
          tipo: action,
          observacao: finalObservation,
          minutos: action === "zerar_saldo" ? undefined : Math.abs(Number(actionMinutes)),
          dataFolga: action === "folga" ? actionDate : undefined,
          dataEvento: new Date().toISOString().slice(0, 10),
        });
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bh_eventos_processamento_rh", selectedColaborador.colaborador_id] }),
        queryClient.invalidateQueries({ queryKey: ["bh_eventos_historico_processamento_rh", selectedColaborador.colaborador_id] }),
        queryClient.invalidateQueries({ queryKey: ["banco_horas_saldos"] }),
        queryClient.invalidateQueries({ queryKey: ["bh_saldos"] }),
        queryClient.invalidateQueries({ queryKey: ["processamento_rh_logs"] }),
        queryClient.invalidateQueries({ queryKey: ["rh_financeiro_lotes"] }),
        refetch(),
      ]);

      toast.success("Ação RH registrada com sucesso.", {
        description:
          mode === "evento"
            ? `${operationalActionMetaMap[action as OperationalActionType].title} aplicada ao colaborador ${selectedColaborador.nome}.`
            : `${directRhActionMetaMap[action].title} aplicada ao colaborador ${selectedColaborador.nome}.`,
      });
      if (action === "pagamento") {
        openPipeline(
          buildFolhaVariavelPipeline({
            competencia: selectedColaboradorCompetencia,
            empresa: empresaMap.get(selectedColaborador.empresa_id) || "Sem empresa",
            currentStep: "envio_financeiro",
            completedStage: "rh_processado",
            timestamps: {
              rh_processado: formatPipelineTimestamp(new Date().toISOString()),
            },
          }),
        );
      }
      closeOperationalActionComposer();
    } catch (error: any) {
      toast.error("Não foi possível concluir a ação.", {
        description: error?.message || "Verifique o período e tente novamente.",
      });
    } finally {
      setActionLoading((current) => ({ ...current, [actionKey]: null }));
    }
  };

  const handleSaveInconsistenciaJustification = async (justification: string) => {
    if (!justificationTarget) return;

    setIsSavingJustification(true);
    try {
      const observacaoAtual = String(justificationTarget.observacao || "").trim();
      const observacaoNova = observacaoAtual
        ? `${observacaoAtual} | Justificativa RH: ${justification}`
        : `Justificativa RH: ${justification}`;

      const { error } = await (supabase as any)
        .from("processamento_rh_inconsistencias")
        .update({
          observacao: observacaoNova,
        })
        .eq("id", justificationTarget.id);

      if (error) throw error;

      await queryClient.invalidateQueries({ queryKey: ["processamento_rh_inconsistencias"] });
      toast.success("Justificativa registrada para a inconsistência.");
      setJustificationTarget(null);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível salvar a justificativa.");
    } finally {
      setIsSavingJustification(false);
    }
  };

  const handleReprocessarColaborador = async (forcedJustificativa?: string) => {
    if (!tenantId || !selectedColaborador?.colaborador_id) return;

    if (isPeriodoFechado && !forcedJustificativa) {
      return requiresAdminJustification(
        async (j) => handleReprocessarColaborador(j),
        "Reprocessar Lançamentos (Período Fechado)",
        "reprocessamento_colaborador"
      );
    }

    setIsReprocessingIndividual(true);
    try {
      const result = await reprocessRhPeriod({
        tenantId,
        month: activeCompetencia,
        empresaId: selectedEmpresa === "all" ? null : selectedEmpresa,
        colaboradorId: selectedColaborador.colaborador_id,
        colaboradores: colaboradores as any[],
        executionType: forcedJustificativa ? "override_admin" as any : "manual",
      });

      await processRhPeriod({
        tenantId,
        month: activeCompetencia,
        empresaId: selectedEmpresa === "all" ? null : selectedEmpresa,
        colaboradorId: selectedColaborador.colaborador_id,
        empresas: empresas as any[],
        colaboradores: colaboradores as any[],
        regras: regras as any[],
        executionType: forcedJustificativa ? "override_admin" as any : "manual",
      });

      await invalidateRhQueries();
      toast.success("Registro individual reprocessado.", {
        description: `${result.registrosLimpados} lançamento(s) do colaborador foram recalculados nesta competência.`,
      });
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível reprocessar este colaborador.");
    } finally {
      setIsReprocessingIndividual(false);
    }
  };

  useEffect(() => {
    const colaboradorFromQuery = searchParams.get("colaborador");
    if (!colaboradorFromQuery || groupedColaboradores.length === 0) return;

    const match = groupedColaboradores.find((item) => item.colaborador_id === colaboradorFromQuery);
    if (!match) return;

    setSelectedColaboradorKey(match.key);
    setSelectedPontoId(searchParams.get("ponto"));
  }, [groupedColaboradores, searchParams]);

  useEffect(() => {
    if (!selectedPonto && selectedColaboradorPontos.length > 0) {
      setSelectedPontoId(selectedColaboradorPontos[0].id);
    }
  }, [selectedPonto, selectedColaboradorPontos]);

  const isLoading = isLoadingEmpresas || isLoadingPontos;

  return (
    <AppShell
      title="Processamento RH"
      subtitle="Fluxo diário acumulativo de ponto, banco de horas e fechamento mensal"
      pipelineTrigger={processPipelineReviewTrigger}
    >
      <div className="space-y-6">
        <section className="esc-card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="w-[220px] h-10">
                <Building2 className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {(empresas as any[]).map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-10">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  // Build a dynamic month range: past 6 months + next 3 months, always including months with records
                  const now = new Date();
                  const monthSet = new Set<string>();
                  for (let offset = -6; offset <= 3; offset++) {
                    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
                    monthSet.add(format(d, "yyyy-MM"));
                  }
                  // Always include months that actually have records
                  for (const m of mesesComRegistros) {
                    monthSet.add(m);
                  }
                  // Always include selected month
                  monthSet.add(selectedMonth);
                  return Array.from(monthSet)
                    .sort()
                    .reverse()
                    .map((monthValue) => {
                      const [y, m] = monthValue.split("-").map(Number);
                      const date = new Date(y, m - 1, 1);
                      const hasRecords = mesesComRegistros.includes(monthValue);
                      return (
                        <SelectItem key={monthValue} value={monthValue}>
                          {format(date, "MMMM/yyyy", { locale: ptBR })}
                          {hasRecords ? " ●" : ""}
                        </SelectItem>
                      );
                    });
                })()}
              </SelectContent>
            </Select>

            <Button
              onClick={() => setProcessModalOpen(true)}
              disabled={isLoading || pendingCount === 0 || isProcessing}
            >
              <Play className="mr-2 h-4 w-4" />
              Processar Pendentes
            </Button>

            <Button
              variant="outline"
              onClick={reprocessarPontos}
              disabled={isLoading || isProcessing || stats.total === 0}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reprocessar Período
            </Button>

            <Button
              variant="secondary"
              onClick={validarAprovacaoCompetencia}
              disabled={isLoading || isProcessing || isApprovingCompetencia || stats.processados === 0}
            >
              {isApprovingCompetencia ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Aprovar Competência
            </Button>

            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </section>

        {hasPendentesComplemento ? (
          <section className="esc-card border border-warning/30 bg-warning-soft/40 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-warning-soft p-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display font-semibold text-foreground">
                    Processamento executado parcialmente.
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Existem colaboradores pendentes de complemento cadastral.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Os registros válidos foram processados normalmente.
                  </p>
                  <p className="hidden">
                    O processamento RH foi bloqueado até que o cadastro seja completado na Central de Cadastros.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {colaboradoresPendentesComplemento.length} colaborador(es) pendente(s) no filtro atual.
                  </p>
                </div>
              </div>

              <Button variant="outline" onClick={() => navigate("/cadastros")}>
                Ir para Central de Cadastros
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-soft">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pontos</p>
              <p className="text-xl font-bold font-display">{stats.total}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-soft">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Processados</p>
              <p className="text-xl font-bold font-display text-success">{stats.processados}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-soft">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inconsistências</p>
              <p className="text-xl font-bold font-display text-warning">{stats.inconsistentes}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold font-display">{stats.pendentes}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info-soft">
              <Users className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Positivos</p>
              <p className="text-xl font-bold font-display">{stats.colaboradoresPositivos}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-error-soft">
              <XCircle className="h-5 w-5 text-error" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Negativos</p>
              <p className="text-xl font-bold font-display text-error">{stats.colaboradoresNegativos}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-soft">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Positivas</p>
              <p className="text-xl font-bold font-display text-success">{minutesToTime(stats.horasPositivas)}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-error-soft">
              <TrendingDown className="h-5 w-5 text-error" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Negativas</p>
              <p className="text-xl font-bold font-display text-error">{minutesToTime(stats.horasNegativas)}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-soft">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-xl font-bold font-display text-warning">{stats.faltas}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-soft">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Banco Total</p>
              <p className={cn("text-xl font-bold font-display", stats.saldoAcumuladoTotal >= 0 ? "text-primary" : "text-error")}>
                {minutesToTime(stats.saldoAcumuladoTotal)}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="pontos">Histórico Diário</TabsTrigger>
            <TabsTrigger value="colaboradores">Acumulado por Colaborador</TabsTrigger>
            <TabsTrigger value="inconsistencias">Inconsistências ({inconsistenciasReais.length})</TabsTrigger>
            <TabsTrigger value="eventos">Eventos do Motor ({eventosMotor.length})</TabsTrigger>
            <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pontos" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted flex items-center justify-between">
                <h3 className="font-semibold text-sm">Histórico diário processado</h3>
                <span className="text-xs text-muted-foreground">O saldo acumulado segue entre os meses até compensação ou ajuste.</span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="text-center">
                        <th className="px-4 py-3 font-medium text-center">Data</th>
                        <th className="px-4 py-3 font-medium text-center">Colaborador</th>
                        <th className="px-4 py-3 font-medium text-center">Empresa</th>
                        <th className="px-4 py-3 font-medium text-center">Regra Aplicada</th>
                        <th className="px-4 py-3 font-medium text-center">Entrada</th>
                        <th className="px-4 py-3 font-medium text-center">Saída</th>
                        <th className="px-4 py-3 font-medium text-center">Horas</th>
                        <th className="px-4 py-3 font-medium text-center">Extra</th>
                        <th className="px-4 py-3 font-medium text-center">Atraso</th>
                        <th className="px-4 py-3 font-medium text-center">Saldo Dia</th>
                        <th className="px-4 py-3 font-medium text-center">Saldo Acum.</th>
                        <th className="px-4 py-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPontos.map((ponto: any) => {
                        const workedMinutes = rhProcessingUtils.calculateWorkedMinutes(ponto);
                        const saldoDia = Number(ponto.saldo_dia || 0);
                        const saldoAcumulado = Number(ponto.saldo_acumulado_minutos || 0);
                        const empresaNome =
                          empresaMap.get(ponto.empresa_id) || ponto.empresa_nome || ponto.nome_empresa || "—";
                        const regraRelacionada = resolveRuleForPonto(ponto, regras as any[]);
                        const ruleExplanation = buildRuleExplanation(ponto, regraRelacionada);

                        return (
                          <tr key={ponto.id} className="border-t border-muted hover:bg-muted/20">
                            <td className="px-4 py-3 text-center">{format(new Date(ponto.data), "dd/MM/yyyy")}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="font-medium">{ponto.nome_colaborador || "Sem vínculo"}</div>
                              <div className="text-xs text-muted-foreground">{ponto.matricula_colaborador || "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-center text-muted-foreground">{empresaNome}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      type="button"
                                      className="inline-flex rounded-full border border-muted-foreground/15 bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                                      onClick={() => setSelectedRuleExplanation({
                                        ...ruleExplanation,
                                        ponto,
                                        empresaNome,
                                      })}
                                    >
                                      {ponto.regra_aplicada || "—"}
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-sm text-left text-xs leading-5">
                                    {ruleExplanation.resumo}
                                  </TooltipContent>
                                </Tooltip>
                                <span className="max-w-[240px] text-[11px] leading-4 text-muted-foreground">
                                  {ruleExplanation.resumo}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-mono">{ponto.entrada?.slice(0, 5) || "-"}</td>
                            <td className="px-4 py-3 text-center font-mono">{ponto.saida?.slice(0, 5) || "-"}</td>
                            <td className="px-4 py-3 text-center">{minutesToTime(workedMinutes)}</td>
                            <td className="px-4 py-3 text-center text-success">{minutesToTime(Number(ponto.minutos_extra || 0))}</td>
                            <td className="px-4 py-3 text-center text-error">{minutesToTime(Number(ponto.minutos_atraso || 0))}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("font-display font-semibold", saldoDia > 0 ? "text-success" : saldoDia < 0 ? "text-error" : "text-muted-foreground")}>
                                {minutesToTime(saldoDia)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("font-display font-semibold", saldoAcumulado > 0 ? "text-primary" : saldoAcumulado < 0 ? "text-error" : "text-muted-foreground")}>
                                {minutesToTime(saldoAcumulado)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge
                                variant={getOperationalStatus(ponto.status_processamento).variant as any}
                                className={cn(getOperationalStatus(ponto.status_processamento).bg, getOperationalStatus(ponto.status_processamento).color, "shadow-none border-0 h-6 px-2 text-[11px] font-medium")}
                              >
                                {getOperationalStatus(ponto.status_processamento).label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredPontos.length === 0 && (
                        <tr>
                          <td colSpan={12} className="p-12 text-center text-muted-foreground">
                            Nenhum ponto encontrado no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="colaboradores" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Visão agrupada por colaborador</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Colaborador</th>
                      <th className="px-4 py-3 font-medium">Empresa</th>
                      <th className="px-4 py-3 font-medium text-center">Dias Processados</th>
                      <th className="px-4 py-3 font-medium text-center">Positivas</th>
                      <th className="px-4 py-3 font-medium text-center">Negativas</th>
                      <th className="px-4 py-3 font-medium text-center">Saldo no Período</th>
                      <th className="px-4 py-3 font-medium text-center">Saldo Atual</th>
                      <th className="px-4 py-3 font-medium text-center">Último Processamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedColaboradores.map((item) => (
                      <tr
                        key={item.key}
                        className="group cursor-pointer border-t border-muted transition-all hover:bg-muted/35 hover:shadow-[inset_4px_0_0_0_rgba(253,76,0,0.95)]"
                        title="Ver detalhes do processamento"
                        onClick={() => openColaboradorDrawer(item)}
                      >
                        <td className="px-4 py-3 font-medium">
                          <div className="flex items-center gap-2">
                            <span className="transition-colors group-hover:text-primary">{item.nome}</span>
                            <PanelRightOpen className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" />
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Eye className="h-3 w-3" />
                            Ver detalhes do processamento
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{empresaMap.get(item.empresa_id) || "—"}</td>
                        <td className="px-4 py-3 text-center">{item.diasProcessados}</td>
                        <td className="px-4 py-3 text-center text-success">{minutesToTime(item.positivas)}</td>
                        <td className="px-4 py-3 text-center text-error">{minutesToTime(item.negativas)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex min-w-[112px] flex-col rounded-xl border border-success/20 bg-success-soft/60 px-3 py-2">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-success/80">Período</span>
                            <span className={cn("font-display font-semibold", item.saldoPeriodo > 0 ? "text-success" : item.saldoPeriodo < 0 ? "text-error" : "text-muted-foreground")}>
                              {minutesToTime(item.saldoPeriodo)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="inline-flex min-w-[112px] flex-col rounded-xl border border-primary/20 bg-primary-soft/60 px-3 py-2">
                            <span className="text-[11px] uppercase tracking-[0.12em] text-primary/80">Atual</span>
                            <span className={cn("font-display font-semibold", item.saldoAtual > 0 ? "text-primary" : item.saldoAtual < 0 ? "text-error" : "text-muted-foreground")}>
                              {minutesToTime(item.saldoAtual)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {item.ultimoProcessamento ? format(new Date(item.ultimoProcessamento), "dd/MM/yyyy HH:mm") : "—"}
                        </td>
                      </tr>
                    ))}

                    {groupedColaboradores.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-muted-foreground">
                          Nenhum colaborador encontrado para o filtro atual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="eventos" className="mt-4">
            <section className="esc-card overflow-hidden mb-4">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Eventos do Motor</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventosMotor.map((item) => (
                      <tr key={item.id} className="border-t border-muted">
                        <td className="px-4 py-3">{item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm") : "—"}</td>
                        <td className="px-4 py-3">{getInconsistenciaLabel(item.tipo)}</td>
                        <td className="px-4 py-3">{item.descricao}</td>
                        <td className="px-4 py-3">
                          <Badge className="bg-primary-soft text-primary">Evento</Badge>
                        </td>
                      </tr>
                    ))}

                    {eventosMotor.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          Nenhum evento do motor encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="inconsistencias" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Histórico de inconsistências</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inconsistenciasReais.map((item) => (
                      <tr key={item.id} className="border-t border-muted">
                        <td className="px-4 py-3">{item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm") : "—"}</td>
                        <td className="px-4 py-3">{getInconsistenciaLabel(item.tipo)}</td>
                        <td className="px-4 py-3">{item.descricao}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn(item.resolvida ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                            {item.resolvida ? "Resolvida" : item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                    {inconsistenciasReais.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          Nenhuma inconsistência encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Logs de execução</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Execução</th>
                      <th className="px-4 py-3 font-medium">Usuário Executor</th>
                      <th className="px-4 py-3 font-medium">Empresa</th>
                      <th className="px-4 py-3 font-medium">Período Processado</th>
                      <th className="px-4 py-3 font-medium">Tipo Execução</th>
                      <th className="px-4 py-3 font-medium">Registros</th>
                      <th className="px-4 py-3 font-medium">Processados</th>
                      <th className="px-4 py-3 font-medium">Inconsistências</th>
                      <th className="px-4 py-3 font-medium">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs as any[]).map((log) => (
                      <tr key={log.id} className="border-t border-muted">
                        <td className="px-4 py-3">
                          <div>{log.executado_em ? format(new Date(log.executado_em), "dd/MM/yyyy HH:mm") : "—"}</div>
                          <div className="text-xs text-muted-foreground">{log.reprocessado ? "Reprocessamento" : "Processamento incremental"}</div>
                        </td>
                        <td className="px-4 py-3">{profileMap.get(log.usuario_id) || "Sistema"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{empresaMap.get(log.empresa_id) || "Todas"}</td>
                        <td className="px-4 py-3">{`${String(log.periodo_mes || "").padStart(2, "0")}/${log.periodo_ano || "—"}`}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn(log.tipo_execucao === "automatica" ? "bg-primary-soft text-primary" : "bg-muted text-foreground")}>
                            {log.tipo_execucao === "automatica" ? "Automática" : "Manual"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">{log.total_registros}</td>
                        <td className="px-4 py-3 text-success">{log.total_processados}</td>
                        <td className="px-4 py-3 text-warning">{log.total_inconsistencias}</td>
                        <td className="px-4 py-3 text-muted-foreground">{Number(log.duracao_ms || 0) > 0 ? `${(Number(log.duracao_ms) / 1000).toFixed(1)}s` : "—"}</td>
                      </tr>
                    ))}

                    {(logs as any[]).length === 0 && (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-muted-foreground">
                          Nenhum log de processamento encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={Boolean(selectedColaborador)} onOpenChange={closeColaboradorDrawer}>
        <SheetContent side="right" className="w-full border-l bg-background p-0 sm:max-w-3xl">
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-muted px-6 py-5">
              <SheetTitle className="flex items-center gap-2">
                <PanelRightOpen className="h-4 w-4 text-primary" />
                {selectedColaborador?.nome || "Detalhe operacional RH"}
              </SheetTitle>
              <SheetDescription>
                {selectedColaborador
                  ? `${empresaMap.get(selectedColaborador.empresa_id) || "Sem empresa"} · ${formatCompetenciaLabel(selectedColaboradorCompetencia)}${selectedColaboradorFicha?.matricula ? ` · Mat. ${selectedColaboradorFicha.matricula}` : ""}`
                  : "Selecione um colaborador para abrir o processamento detalhado."}
              </SheetDescription>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="space-y-6 px-6 py-5">
                <section className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-2xl border border-primary/15 bg-primary-soft/50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-primary/80">Saldo acumulado</p>
                    <p className={cn("mt-2 font-display text-2xl font-semibold", (selectedColaborador?.saldoAtual || 0) > 0 ? "text-primary" : (selectedColaborador?.saldoAtual || 0) < 0 ? "text-error" : "text-muted-foreground")}>
                      {minutesToTime(Number(selectedColaborador?.saldoAtual || 0))}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-success/15 bg-success-soft/50 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-success/80">Saldo do período</p>
                    <p className={cn("mt-2 font-display text-2xl font-semibold", (selectedColaborador?.saldoPeriodo || 0) > 0 ? "text-success" : (selectedColaborador?.saldoPeriodo || 0) < 0 ? "text-error" : "text-muted-foreground")}>
                      {minutesToTime(Number(selectedColaborador?.saldoPeriodo || 0))}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Dias processados</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-foreground">{selectedColaborador?.diasProcessados || 0}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/30 p-4">
                    <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Histórico BH</p>
                    <p className="mt-2 font-display text-2xl font-semibold text-foreground">{selectedColaboradorEventosHistorico.length}</p>
                  </div>
                </section>

                <section className="rounded-2xl border border-muted bg-background">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-muted px-4 py-3">
                    <div>
                      <h3 className="font-semibold text-foreground">Ações RH</h3>
                      <p className="text-xs text-muted-foreground">A operação individual acontece aqui, sem duplicação no Banco de Horas consolidado.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" className="gap-2" onClick={() => setJustificationTarget(selectedColaboradorInconsistencias[0] || null)} disabled={selectedColaboradorInconsistencias.length === 0}>
                        <MessageSquareQuote className="h-4 w-4" />
                        Justificar inconsistência
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2" onClick={handleReprocessarColaborador} disabled={isReprocessingIndividual || !selectedColaborador?.colaborador_id}>
                        {isReprocessingIndividual ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Reprocessar individual
                      </Button>
                      {selectedColaborador?.colaborador_id ? (
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate(`/banco-horas/extrato/${selectedColaborador.colaborador_id}?from=processamento-rh`)}>
                          <History className="h-4 w-4" />
                          Visualizar histórico
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-muted bg-background p-3">
                  <Tabs value={drawerTab} onValueChange={(value) => setDrawerTab(value as RhDrawerTab)}>
                    <TabsList className="w-full justify-start">
                      <TabsTrigger value="visao_geral">Visão Geral</TabsTrigger>
                      <TabsTrigger value="ajustes_rh">Ajustes RH</TabsTrigger>
                      <TabsTrigger value="historico_auditoria">Histórico/Auditoria</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </section>

                {drawerTab === "visao_geral" ? (
                  <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-foreground">Dias processados</h3>
                        <Badge className="bg-muted text-foreground">{selectedColaboradorPontos.length}</Badge>
                      </div>
                      <div className="space-y-2">
                        {selectedColaboradorPontos.map((ponto: any) => {
                          const isActive = selectedPonto?.id === ponto.id;
                          const saldoDia = Number(ponto.saldo_dia || 0);
                          return (
                            <button
                              key={ponto.id}
                              type="button"
                              onClick={() => setSelectedPontoId(ponto.id)}
                              className={cn(
                                "w-full rounded-2xl border px-3 py-3 text-left transition-all",
                                isActive ? "border-primary bg-primary-soft/40 shadow-sm" : "border-muted hover:border-primary/30 hover:bg-muted/35",
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{format(new Date(ponto.data), "dd/MM/yyyy")}</p>
                                  <p className="text-xs text-muted-foreground">{ponto.entrada?.slice(0, 5) || "--:--"} → {ponto.saida?.slice(0, 5) || "--:--"}</p>
                                </div>
                                <Badge className={cn(saldoDia > 0 ? "bg-success-soft text-success" : saldoDia < 0 ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground")}>
                                  {minutesToTime(saldoDia)}
                                </Badge>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <section className="rounded-2xl border border-muted bg-background">
                        <div className="border-b border-muted px-4 py-3">
                          <h3 className="font-semibold text-foreground">Dados do dia e processamento</h3>
                        </div>
                        {selectedPonto ? (
                          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Entrada</p><p className="mt-1 font-medium">{selectedPonto.entrada?.slice(0, 5) || "—"}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Saída</p><p className="mt-1 font-medium">{selectedPonto.saida?.slice(0, 5) || "—"}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Jornada</p><p className="mt-1 font-medium">{selectedColaboradorRuleBreakdown ? minutesToTime(selectedColaboradorRuleBreakdown.jornadaMinutes) : "—"}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Horas extras</p><p className="mt-1 font-medium text-success">{minutesToTime(Number(selectedPonto.minutos_extra || 0))}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Saldo do dia</p><p className={cn("mt-1 font-medium", Number(selectedPonto.saldo_dia || 0) > 0 ? "text-success" : Number(selectedPonto.saldo_dia || 0) < 0 ? "text-error" : "text-muted-foreground")}>{minutesToTime(Number(selectedPonto.saldo_dia || 0))}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Saldo acumulado</p><p className="mt-1 font-medium">{minutesToTime(Number(selectedPonto.saldo_acumulado_minutos || 0))}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Competência</p><p className="mt-1 font-medium">{formatCompetenciaLabel(selectedColaboradorCompetencia)}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Regra aplicada</p><p className="mt-1 font-medium">{selectedPonto.regra_aplicada || "—"}</p></div>
                          </div>
                        ) : (
                          <div className="p-6 text-sm text-muted-foreground">Selecione um dia para ver o detalhe operacional.</div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-muted bg-background">
                        <div className="border-b border-muted px-4 py-3">
                          <h3 className="font-semibold text-foreground">Transparência do cálculo</h3>
                        </div>
                        {selectedColaboradorRuleBreakdown ? (
                          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Tolerância</p><p className="mt-1 font-medium">{formatRuleMinutes(Number(selectedColaboradorRuleBreakdown.toleranciaExtra || 0))} extra / {formatRuleMinutes(Number(selectedColaboradorRuleBreakdown.toleranciaAtraso || 0))} atraso</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Excedente</p><p className="mt-1 font-medium">{formatCompactMinutes(Number(selectedColaboradorRuleBreakdown.excedente || 0))}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Desconto</p><p className="mt-1 font-medium">{formatCompactMinutes(Number(selectedColaboradorRuleBreakdown.minutosAtraso || 0))}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3"><p className="text-xs text-muted-foreground">Banco gerado</p><p className={cn("mt-1 font-medium", Number(selectedColaboradorRuleBreakdown.saldoFinal || 0) > 0 ? "text-success" : Number(selectedColaboradorRuleBreakdown.saldoFinal || 0) < 0 ? "text-error" : "text-muted-foreground")}>{minutesToTime(Number(selectedColaboradorRuleBreakdown.saldoFinal || 0))}</p></div>
                            <div className="rounded-xl border border-muted bg-muted/20 p-3 md:col-span-2 xl:col-span-4">
                              <p className="text-xs text-muted-foreground">Regra explicável</p>
                              <p className="mt-1 text-sm leading-6 text-foreground">{selectedColaboradorRuleBreakdown.resumo}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-6 text-sm text-muted-foreground">O detalhamento da regra aparecerá aqui quando houver um dia selecionado.</div>
                        )}
                      </section>

                      <section className="rounded-2xl border border-muted bg-background">
                        <div className="flex items-center justify-between border-b border-muted px-4 py-3">
                          <div>
                            <h3 className="font-semibold text-foreground">Movimentações operacionais do banco</h3>
                            <p className="text-xs text-muted-foreground">Saldo operacional do colaborador dentro da competência filtrada.</p>
                          </div>
                          {isLoadingSelectedEventos ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                        </div>
                        <div className="space-y-3 p-4">
                          {processedSelectedEventos.length > 0 ? processedSelectedEventos.map((evento: any) => (
                            <div key={evento.id} className="rounded-2xl border border-muted p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{evento.displayDate}</p>
                                  <p className="text-sm text-muted-foreground">{evento.description || "Movimentação operacional registrada."}</p>
                                </div>
                                <div className="text-right">
                                  <p className={cn("font-display text-lg font-semibold", getBhEventMinutes(evento) >= 0 ? "text-success" : "text-error")}>{evento.displayMinutes}</p>
                                  <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{getBhEventType(evento) || "evento"}</p>
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {evento.actions.map((action: any) => (
                                  <Button key={action.key} variant="outline" size="sm" onClick={() => openOperationalActionDialog(evento, action.key)}>
                                    {action.label}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-muted p-6 text-sm text-muted-foreground">
                              Nenhuma movimentação individual encontrada para este colaborador na competência selecionada.
                            </div>
                          )}
                        </div>
                      </section>

                      <section className="rounded-2xl border border-muted bg-background">
                        <div className="border-b border-muted px-4 py-3">
                          <h3 className="font-semibold text-foreground">Inconsistências do dia</h3>
                        </div>
                        <div className="space-y-3 p-4">
                          {selectedColaboradorInconsistencias.length > 0 ? selectedColaboradorInconsistencias.map((item: any) => (
                            <div key={item.id} className="rounded-2xl border border-warning/20 bg-warning-soft/20 p-4">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium text-foreground">{getInconsistenciaLabel(item.tipo)}</p>
                                  <p className="text-sm text-muted-foreground">{item.descricao}</p>
                                  {item.observacao ? <p className="mt-2 text-xs text-foreground">Justificativa: {item.observacao}</p> : null}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => setJustificationTarget(item)}>
                                  Justificar
                                </Button>
                              </div>
                            </div>
                          )) : (
                            <div className="rounded-2xl border border-dashed border-muted p-6 text-sm text-muted-foreground">
                              Nenhuma inconsistência aberta para o dia selecionado.
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  </section>
                ) : null}

                {drawerTab === "ajustes_rh" ? (
                  <section className="space-y-6">
                    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {directRhActionOptions.map((item) => {
                        const ActionIcon = directRhActionMetaMap[item.key].icon;
                        const isActive = actionComposer?.mode === "direto" && actionComposer.action === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => openDirectRhActionComposer(item.key)}
                            className={cn(
                              "rounded-2xl border p-4 text-left transition-all",
                              isActive ? "border-primary bg-primary-soft/35 shadow-sm" : "border-muted hover:border-primary/35 hover:bg-muted/30",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className="rounded-xl bg-background p-2 shadow-sm">
                                <ActionIcon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium text-foreground">{item.label}</p>
                                <p className="text-xs text-muted-foreground">{item.description}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </section>

                    <section className="rounded-2xl border border-muted bg-background">
                      <div className="border-b border-muted px-4 py-3">
                        <h3 className="font-semibold text-foreground">
                          {actionComposer
                            ? actionComposer.mode === "evento"
                              ? operationalActionMetaMap[actionComposer.action as OperationalActionType].title
                              : directRhActionMetaMap[actionComposer.action].title
                            : "Formulário operacional RH"}
                        </h3>
                        <p className="text-xs text-muted-foreground">Justificativa, usuário responsável, timestamp e reflexos operacionais ficam registrados automaticamente.</p>
                      </div>
                      <div className="space-y-4 p-4">
                        {actionComposer?.mode === "evento" && actionComposer.evento ? (
                          <div className="rounded-xl border border-muted bg-muted/20 p-3 text-sm">
                            <p className="font-medium text-foreground">{formatEventDate(getBhEventDate(actionComposer.evento).slice(0, 10))}</p>
                            <p className="text-muted-foreground">Evento base: {formatSignedMinutes(getBhEventMinutes(actionComposer.evento))} · {getBhEventType(actionComposer.evento) || "evento"}</p>
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed border-muted p-3 text-sm text-muted-foreground">
                            Escolha uma ação rápida acima ou use os botões de uma movimentação para operar sobre um evento específico.
                          </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="rh_action_minutes_inline">Minutos</Label>
                            <Input
                              id="rh_action_minutes_inline"
                              value={actionMinutes}
                              onChange={(e) => setActionMinutes(e.target.value)}
                              placeholder="Ex: 60"
                              disabled={actionComposer?.action === "zerar_saldo"}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rh_action_date_inline">Data da folga</Label>
                            <Input
                              id="rh_action_date_inline"
                              type="date"
                              value={actionDate}
                              onChange={(e) => setActionDate(e.target.value)}
                              disabled={actionComposer?.action !== "folga"}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="rh_action_observation_inline">Justificativa obrigatória</Label>
                          <Textarea
                            id="rh_action_observation_inline"
                            rows={4}
                            value={actionObservation}
                            onChange={(e) => setActionObservation(e.target.value)}
                            placeholder="Explique a correção, autorização ou decisão operacional."
                          />
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={closeOperationalActionComposer}>Limpar</Button>
                          <Button
                            onClick={handleConfirmOperationalAction}
                            disabled={
                              !actionComposer ||
                              actionObservation.trim().length < 5 ||
                              ((actionComposer.action === "ajuste_manual" ||
                                actionComposer.action === "credito_manual" ||
                                actionComposer.action === "debito_manual" ||
                                actionComposer.action === "compensacao" ||
                                actionComposer.action === "pagamento" ||
                                actionComposer.action === "folga") &&
                                Math.abs(Number(actionMinutes)) === 0) ||
                              (actionComposer.action === "folga" && !actionDate) ||
                              Boolean(actionLoading[actionComposer.evento?.id || `direto:${selectedColaborador?.colaborador_id}`])
                            }
                          >
                            {actionComposer && actionLoading[actionComposer.evento?.id || `direto:${selectedColaborador?.colaborador_id}`] === actionComposer.action ? (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : null}
                            {actionComposer
                              ? actionComposer.mode === "evento"
                                ? operationalActionMetaMap[actionComposer.action as OperationalActionType].confirmLabel
                                : directRhActionMetaMap[actionComposer.action].confirmLabel
                              : "Executar ação"}
                          </Button>
                        </div>
                      </div>
                    </section>

                    <section className="rounded-2xl border border-muted bg-background">
                      <div className="flex items-center justify-between border-b border-muted px-4 py-3">
                        <div>
                          <h3 className="font-semibold text-foreground">Movimentações operacionais</h3>
                          <p className="text-xs text-muted-foreground">Use eventos já processados para compensar, pagar, folgar ou ajustar com contrapartida individual.</p>
                        </div>
                        {isLoadingSelectedEventos ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
                      </div>
                      <div className="space-y-3 p-4">
                        {processedSelectedEventos.length > 0 ? processedSelectedEventos.map((evento: any) => (
                          <div key={evento.id} className="rounded-2xl border border-muted p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="font-medium text-foreground">{evento.displayDate}</p>
                                <p className="text-sm text-muted-foreground">{evento.description || "Movimentação operacional registrada."}</p>
                              </div>
                              <div className="text-right">
                                <p className={cn("font-display text-lg font-semibold", getBhEventMinutes(evento) >= 0 ? "text-success" : "text-error")}>{evento.displayMinutes}</p>
                                <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{getBhEventType(evento) || "evento"}</p>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {evento.actions.map((action: any) => (
                                <Button key={action.key} variant="outline" size="sm" onClick={() => openOperationalActionComposer(evento, action.key)}>
                                  {action.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-muted p-6 text-sm text-muted-foreground">
                            Nenhuma movimentação individual encontrada para este colaborador na competência selecionada.
                          </div>
                        )}
                      </div>
                    </section>
                  </section>
                ) : null}

                {drawerTab === "historico_auditoria" ? (
                  <section className="space-y-3">
                    {selectedColaboradorHistoricoAuditoria.length > 0 ? selectedColaboradorHistoricoAuditoria.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-muted bg-background p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-foreground">{item.titulo}</p>
                            <p className="text-sm text-muted-foreground">{item.detalhe}</p>
                          </div>
                          <Badge className={cn(
                            item.status === "pago" ? "bg-success-soft text-success" :
                              ["compensado", "justificada", "PROCESSADO"].includes(item.status) ? "bg-primary-soft text-primary" :
                                "bg-muted text-foreground"
                          )}>
                            {item.status}
                          </Badge>
                        </div>
                        <div className="mt-3 grid gap-3 text-xs text-muted-foreground md:grid-cols-3">
                          <div>
                            <span className="block uppercase tracking-[0.12em]">Responsável</span>
                            <span className="text-foreground">{item.responsavel}</span>
                          </div>
                          <div>
                            <span className="block uppercase tracking-[0.12em]">Origem</span>
                            <span className="text-foreground">{item.origem}</span>
                          </div>
                          <div>
                            <span className="block uppercase tracking-[0.12em]">Data/Hora</span>
                            <span className="text-foreground">{item.dataOrdenacao ? format(new Date(item.dataOrdenacao), "dd/MM/yyyy HH:mm") : "—"}</span>
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="rounded-2xl border border-dashed border-muted p-6 text-sm text-muted-foreground">
                        Nenhuma alteração manual ou trilha de auditoria encontrada para este colaborador.
                      </div>
                    )}
                  </section>
                ) : null}
              </div>
            </ScrollArea>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && closeOperationalActionDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionDialog ? (
                <>
                  {(() => {
                    const ActionIcon = operationalActionMetaMap[actionDialog.action].icon;
                    return <ActionIcon className="h-4 w-4 text-primary" />;
                  })()}
                  {operationalActionMetaMap[actionDialog.action].title}
                </>
              ) : "Ação RH"}
            </DialogTitle>
            <DialogDescription>
              {actionDialog ? operationalActionMetaMap[actionDialog.action].description : ""}
            </DialogDescription>
          </DialogHeader>

          {actionDialog ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-muted bg-muted/20 p-3 text-sm">
                <p className="font-medium text-foreground">{formatEventDate(getBhEventDate(actionDialog.evento).slice(0, 10))}</p>
                <p className="text-muted-foreground">Referência: {formatSignedMinutes(getBhEventMinutes(actionDialog.evento))}</p>
              </div>

              {actionDialog.action === "ajuste_manual" ? (
                <div className="space-y-2">
                  <Label htmlFor="rh_action_minutes">Minutos do ajuste</Label>
                  <Input id="rh_action_minutes" value={actionMinutes} onChange={(e) => setActionMinutes(e.target.value)} placeholder="Ex: 30 ou -60" />
                </div>
              ) : null}

              {actionDialog.action === "folga" ? (
                <div className="space-y-2">
                  <Label htmlFor="rh_action_date">Data da folga</Label>
                  <Input id="rh_action_date" type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)} />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="rh_action_observation">Observação obrigatória</Label>
                <Textarea
                  id="rh_action_observation"
                  rows={4}
                  value={actionObservation}
                  onChange={(e) => setActionObservation(e.target.value)}
                  placeholder="Descreva o motivo operacional desta ação."
                />
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={closeOperationalActionDialog}>Cancelar</Button>
            <Button
              onClick={handleConfirmOperationalAction}
              disabled={
                !actionDialog ||
                actionObservation.trim().length < 5 ||
                (actionDialog.action === "ajuste_manual" && Number(actionMinutes) === 0) ||
                (actionDialog.action === "folga" && !actionDate) ||
                Boolean(actionDialog ? actionLoading[actionDialog.evento.id] : null)
              }
            >
              {actionDialog && actionLoading[actionDialog.evento.id] === actionDialog.action ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              {actionDialog ? operationalActionMetaMap[actionDialog.action].confirmLabel : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JustificationModal
        isOpen={Boolean(justificationTarget)}
        onClose={() => setJustificationTarget(null)}
        onConfirm={handleSaveInconsistenciaJustification}
        isLoading={isSavingJustification}
        title="Justificar inconsistência do Processamento RH"
        description="Registre a justificativa operacional desta inconsistência para manter a trilha auditável sem tirar a ação do Processamento RH."
        status={justificationTarget?.status}
      />

      <Dialog open={Boolean(selectedRuleExplanation)} onOpenChange={(open) => !open && setSelectedRuleExplanation(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Rastreabilidade da regra aplicada</DialogTitle>
            <DialogDescription>
              {selectedRuleExplanation
                ? `${selectedRuleExplanation.ponto?.nome_colaborador || "Colaborador"} · ${format(new Date(selectedRuleExplanation.ponto?.data), "dd/MM/yyyy")} · ${selectedRuleExplanation.empresaNome || "Sem empresa"}`
                : "Detalhes do cálculo"}
            </DialogDescription>
          </DialogHeader>

          {selectedRuleExplanation && (
            <div className="space-y-4">
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                <div className="font-medium text-primary">{selectedRuleExplanation.regraNome}</div>
                <p className="mt-1 leading-6">{selectedRuleExplanation.resumo}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Jornada base</div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">
                    {selectedRuleExplanation.jornadaHours}h
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Horas trabalhadas</div>
                  <div className="mt-1 font-display text-xl font-bold text-foreground">
                    {minutesToTime(selectedRuleExplanation.workedMinutes)}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                  <div className="space-y-3 p-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Tolerância extra</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatRuleMinutes(selectedRuleExplanation.toleranciaExtra)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Excedente bruto</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{minutesToTime(selectedRuleExplanation.excedente)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Desconto aplicado</div>
                      <div className="mt-1 text-sm font-medium text-foreground">
                        {minutesToTime(selectedRuleExplanation.descontoTolerancia)}
                        {selectedRuleExplanation.descontoLimite > 0 ? ` + ${minutesToTime(selectedRuleExplanation.descontoLimite)} por limite diário` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Saldo final do dia</div>
                      <div className="mt-1 text-sm font-semibold text-success">{minutesToTime(selectedRuleExplanation.saldoFinal)}</div>
                    </div>
                  </div>

                  <div className="space-y-3 p-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Tolerância atraso</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{formatRuleMinutes(selectedRuleExplanation.toleranciaAtraso)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Déficit bruto</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{minutesToTime(selectedRuleExplanation.deficit)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Crédito em banco</div>
                      <div className="mt-1 text-sm font-medium text-success">{minutesToTime(selectedRuleExplanation.minutosExtra)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Débito em banco</div>
                      <div className="mt-1 text-sm font-medium text-destructive">{minutesToTime(selectedRuleExplanation.minutosAtraso)}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                Limite diário para crédito em banco: <strong className="text-foreground">{formatRuleMinutes(selectedRuleExplanation.limiteDiarioBanco)}</strong>. O mesmo saldo processado aqui alimenta o Banco de Horas acumulado e os itens enviados ao Financeiro.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={processModalOpen} onOpenChange={setProcessModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar processamento diário</DialogTitle>
            <DialogDescription>
              O motor processará apenas registros com status <strong>pendente</strong> no mês {selectedCompetenciaLabel}, manterá o histórico diário e continuará acumulando o banco de horas por colaborador.
            </DialogDescription>
          </DialogHeader>

          {processingResult && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="rounded-lg bg-success-soft p-4 text-center">
                <p className="text-sm text-success">Processados</p>
                <p className="text-2xl font-bold text-success">{processingResult.totalProcessados}</p>
              </div>
              <div className="rounded-lg bg-warning-soft p-4 text-center">
                <p className="text-sm text-warning">Inconsistências</p>
                <p className="text-2xl font-bold text-warning">{processingResult.totalInconsistencias}</p>
              </div>
              <div className="rounded-lg bg-primary-soft p-4 text-center">
                <p className="text-sm text-primary">Créditos</p>
                <p className="text-2xl font-bold text-primary">{minutesToTime(Number(processingResult.totalCreditos || 0))}</p>
              </div>
              <div className="rounded-lg bg-destructive-soft p-4 text-center">
                <p className="text-sm text-destructive">Débitos</p>
                <p className="text-2xl font-bold text-destructive">{minutesToTime(Number(processingResult.totalDebitos || 0))}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessModalOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={processarPontos} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Processamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approvalModalOpen} onOpenChange={(open) => {
        setApprovalModalOpen(open);
        if (!open) {
          setFinancialEligibilityError(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {financialEligibilityError ? (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              ) : approvalValidation?.impedimentos?.length ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-success" />
              )}
              {financialEligibilityError ? "Bloqueio Financeiro Identificado" : "Aprovar competência do RH"}
            </DialogTitle>
            <DialogDescription>
              {financialEligibilityError
                ? "O processamento operacional foi concluído, mas o Motor Financeiro interceptou inconsistências que impedem a geração dos lotes monetários."
                : `A aprovação oficializa a entrega do resultado processado ao Financeiro na competência ${selectedCompetenciaLabel} (${activeCompetencia}).`
              }
            </DialogDescription>
          </DialogHeader>

          {financialEligibilityError ? (
            <div className="space-y-5">
              <div className="rounded-xl border border-red-200/60 bg-red-50/50 p-4">
                <p className="font-semibold text-red-900">Nenhum colaborador apto para geração financeira.</p>
                <div className="mt-1.5 text-sm text-red-800/80 space-y-3">
                  <p>
                    Nenhuma verba variável encontrada nesta competência.
                  </p>
                  <div>
                    <span className="font-medium">Os colaboradores ainda podem gerar lote financeiro através:</span>
                    <ul className="list-inside mt-1 ml-2 space-y-1">
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-600" /> salário base</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-600" /> folha CLT mensal</li>
                      <li className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-600" /> remuneração fixa</li>
                    </ul>
                  </div>
                  <p className="font-medium text-xs">Variáveis operacionais são complementares.</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Detalhamento de Inelegibilidade
                </h3>
                <div className="overflow-hidden rounded-xl border border-muted bg-card">
                  <div className="max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                        <tr>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Colaborador</th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">Problemas identificados</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-muted">
                        {financialEligibilityError.details.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium text-foreground">{item.nome}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1.5">
                                {item.problemas.map((prob, pIdx) => (
                                  <Badge key={pIdx} variant="secondary" className="bg-red-100 text-red-800 hover:bg-red-100">
                                    {prob}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2 border-t">
                <Button
                  onClick={() => {
                    setApprovalModalOpen(false);
                    setFinancialEligibilityError(null);
                    navigate("/cadastros");
                  }}
                  className="gap-2"
                >
                  Ir para Central de Cadastros
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : approvalValidation ? (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-red-300/70 bg-red-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-red-700/80">Bloqueios críticos</p>
                  <p className="mt-2 text-2xl font-display font-bold text-red-700">{approvalValidation.resumo.bloqueiosCriticos}</p>
                  <p className="mt-1 text-xs text-red-700/75">Impedem a aprovação da competência.</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-slate-50 p-4">
                  <p className="text-xs uppercase tracking-[0.14em] text-sky-700/80">Avisos operacionais</p>
                  <p className="mt-2 text-2xl font-display font-bold text-sky-800">{approvalValidation.resumo.avisosOperacionais}</p>
                  <p className="mt-1 text-xs text-slate-600">Apenas informativos. Não bloqueiam a aprovação.</p>
                </div>
              </div>

              {approvalValidation.impedimentos.length > 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                  <p className="font-semibold text-foreground">A competência não pode ser aprovada agora.</p>
                  <p className="mt-1 text-xs text-muted-foreground">Resolva os bloqueios abaixo e clique em <strong>Revalidar</strong> para verificar novamente.</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {approvalValidation.impedimentos.map((item: string, index: number) => (
                      <li key={`${item}-${index}`}>• {item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-xl border border-success/30 bg-success-soft/40 p-4 space-y-3">
                  <div>
                    <p className="font-semibold text-foreground flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      Nenhum bloqueio crítico encontrado.
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A aprovação permanece liberada. Ao confirmar, o RH vai criar o lote financeiro em status <strong>AGUARDANDO_FINANCEIRO</strong>.
                    </p>
                  </div>

                  {approvalValidation.resumo?.financeiroPrevisto && (
                    <div className="mt-3 bg-white/60 rounded-lg p-3 border border-success/20">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Resumo Financeiro Previsto</p>
                      <ul className="space-y-1.5 text-sm text-slate-700">
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <strong>{approvalValidation.resumo.financeiroPrevisto.folhaBase}</strong> salários base elegíveis (Folha Base)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <strong>{approvalValidation.resumo.financeiroPrevisto.variaveis}</strong> horas extras/atrasos/faltas (Variáveis)
                        </li>
                        <li className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <strong>{approvalValidation.resumo.financeiroPrevisto.bancoHoras}</strong> ajustes de banco de horas (Banco de Horas)
                        </li>
                      </ul>
                      <div className="mt-3 pt-3 border-t border-success/20">
                        <p className="text-sm font-medium text-success flex items-center gap-2">
                          <FileCheck className="h-4 w-4" />
                          Lote financeiro apto para geração
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {approvalValidation.bloqueiosCriticos.length > 0 ? (
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Bloqueios críticos</h3>
                      <p className="text-xs text-muted-foreground">Clique em um bloqueio para ir à tela de resolução.</p>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto rounded-xl border border-red-200/70 bg-gradient-to-b from-red-50/60 to-amber-50/40">
                    <div className="divide-y divide-red-200/50">
                      {approvalValidation.bloqueiosCriticos.map((item: any) => (
                        <button
                          key={item.id}
                          type="button"
                          className="group flex w-full items-start gap-3 px-4 py-3.5 text-left transition-all hover:bg-red-100/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                          onClick={() => {
                            const rota = item.rota || "/cadastros";
                            setApprovalModalOpen(false);
                            navigate(rota);
                            toast.info(`Navegando para resolver: ${item.nome}`, {
                              description: item.acao || "Resolva o bloqueio e volte para revalidar.",
                            });
                          }}
                        >
                          <div className="mt-0.5 rounded-lg bg-red-100 p-1.5 text-red-600 transition-colors group-hover:bg-red-200">
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground">{item.nome}</span>
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-[10px] px-1.5 py-0">{item.categoria}</Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{item.motivo}</p>
                            {item.acao && (
                              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-primary">
                                <ExternalLink className="h-3 w-3" />
                                {item.acao}
                              </p>
                            )}
                          </div>
                          <div className="mt-1 text-muted-foreground/40 transition-all group-hover:text-primary group-hover:translate-x-0.5">
                            <ArrowRight className="h-4 w-4" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}

              {approvalValidation.avisosOperacionais.length > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">Avisos operacionais</h3>
                  <p className="text-xs text-muted-foreground">Apenas informativos.</p>
                  <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70">
                    <div className="divide-y divide-slate-200/70">
                      {approvalValidation.avisosOperacionais.map((item: any) => (
                        <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{item.nome}</span>
                              <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 text-[10px] px-1.5 py-0">{item.categoria}</Badge>
                            </div>
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.motivo}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {!financialEligibilityError && (
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="outline" onClick={() => setApprovalModalOpen(false)} disabled={isApprovingCompetencia}>
                Fechar
              </Button>

              {approvalValidation?.impedimentos?.length ? (
                <Button
                  variant="secondary"
                  onClick={validarAprovacaoCompetencia}
                  disabled={isApprovingCompetencia}
                  className="gap-2"
                >
                  {isApprovingCompetencia ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RotateCw className="h-4 w-4" />
                  )}
                  Revalidar
                </Button>
              ) : null}

              <Button
                onClick={aprovarCompetencia}
                disabled={isApprovingCompetencia || Boolean(approvalValidation?.impedimentos?.length)}
              >
                {isApprovingCompetencia ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aprovando...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Confirmar aprovação
                  </>
                )}
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
      {adminJustificationPayload && (
        <JustificationModal
          isOpen={adminJustificationModalOpen}
          onClose={() => {
            setAdminJustificationModalOpen(false);
            setAdminJustificationPayload(null);
          }}
          onConfirm={async (justificativa) => {
            await adminJustificationPayload.callback(justificativa);
            setAdminJustificationModalOpen(false);
            setAdminJustificationPayload(null);
          }}
          title={adminJustificationPayload.actionLabel}
          description="ATENÇÃO: A competência selecionada já possui validação e/ou fechamento. Esta alteração será registrada no log de auditoria operacional do Admin."
        />
      )}
    </AppShell>
  );
};

export default ProcessamentoRH;
