import React, { useEffect, useMemo, useRef, useState } from "react";
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
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  HandCoins,
  History,
  Info,
  Loader2,
  Lock,
  PanelRightOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Timer,
  TrendingDown,
  TrendingUp,
  Upload,
  UserCheck,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import {
  OrbePageContainer,
  OrbePageHeader,
  OrbeKpiCard,
  OrbeFilterBar,
  OrbeTable,
  OrbeDrawer,
  OrbeButton,
  OrbeBadge,
  OrbeStatusBadge,
  OrbeCard,
} from "@/components/ux-lab/design-system";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { ColaboradorService, EmpresaService, PontoService } from "@/services/base.service";
import { BHEventoService, BHRegraService } from "@/services/v4.service";
import { processRhPeriod, reprocessRhPeriod, rhProcessingUtils } from "@/services/rhProcessing.service";
import {
  resolvePontoPresentation,
  formatFactualPunches,
  type PontoPresentationInfo,
} from "@/services/rhPresentation.service";
import { RegularizarMarcacaoModal } from "@/components/modals/RegularizarMarcacaoModal";
import { DecidirPontoModal } from "@/components/modals/DecidirPontoModal";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { SpreadsheetUploadModal } from "@/components/shared/SpreadsheetUploadModal";
import { PontoRegularizacaoService } from "@/services/operationalEngine/pontoRegularizacao.service";
import { PontoDecisaoService } from "@/services/operationalEngine/pontoDecisao.service";
import type { PontoRegularizacao } from "@/types/pontoRegularizacao.types";
import type { PontoDecisao, TipoDecisaoPonto } from "@/types/pontoDecisao.types";
import { ensurePreCadastrosFromImportedPontos } from "@/services/preCadastroColaborador.service";

// Helpers
const minutesToTime = (totalMinutes: number) => {
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${hours}h ${minutes}m`;
};

const formatSignedMinutes = (mins: number) => {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${mins < 0 ? "-" : "+"}${h}h${String(m).padStart(2, "0")}m`;
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

const formatCompetenciaLabel = (competencia: string) => {
  if (!competencia || !competencia.includes("-")) return competencia;
  const [year, month] = competencia.split("-").map(Number);
  const date = new Date(year, month - 1, 1);
  const label = format(date, "MMMM/yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

const currentMonthDefault = format(new Date(), "yyyy-MM");

const getBhEventMinutes = (evento: any) => Number(evento?.minutos ?? evento?.quantidade_minutos ?? 0);
const getBhEventType = (evento: any) => String(evento?.tipo_evento ?? evento?.tipo ?? "").trim().toLowerCase();
const getBhEventDate = (evento: any) => String(evento?.data_evento ?? evento?.data ?? evento?.created_at ?? "");
const getBhEventStatus = (evento: any) => String(evento?.status ?? "ativo").trim().toLowerCase();

type ViewTab = "apuracao" | "saldos_bh";
type DrawerTab = "apuracao" | "acoes_rh" | "historico";

export const PontoJornadasClt: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { tenantId } = useTenant();

  // URL state synchronization
  const [viewTab, setViewTab] = useState<ViewTab>(() => {
    const tabParam = searchParams.get("tab");
    return tabParam === "saldos_bh" ? "saldos_bh" : "apuracao";
  });
  const [selectedEmpresa, setSelectedEmpresa] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthDefault);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("all");

  // Modals & Drawer State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("apuracao");
  const [selectedColaboradorItem, setSelectedColaboradorItem] = useState<any | null>(null);
  const [selectedPontoDia, setSelectedPontoDia] = useState<any | null>(null);

  // Processing & Actions
  const [isReprocessingPeriod, setIsReprocessingPeriod] = useState(false);
  const [isReprocessingIndividual, setIsReprocessingIndividual] = useState(false);

  // Submodals
  const [regularizacaoModalOpen, setRegularizacaoModalOpen] = useState(false);
  const [regularizacaoPontoTarget, setRegularizacaoPontoTarget] = useState<any | null>(null);
  const [decisaoModalOpen, setDecisaoModalOpen] = useState(false);
  const [decisaoPontoTarget, setDecisaoPontoTarget] = useState<any | null>(null);
  const [decisaoTipoDefault, setDecisaoTipoDefault] = useState<TipoDecisaoPonto | null>(null);
  const [justificationTarget, setJustificationTarget] = useState<any | null>(null);
  const [isSavingJustification, setIsSavingJustification] = useState(false);

  // Direct RH operational adjustment dialog
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionDialogType, setActionDialogType] = useState<string>("compensacao");
  const [actionDialogMinutes, setActionDialogMinutes] = useState("0");
  const [actionDialogObservation, setActionDialogObservation] = useState("");
  const [actionDialogDate, setActionDialogDate] = useState(new Date().toISOString().slice(0, 10));
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  // 1. Data queries
  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores_all"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
  });

  const { data: regras = [] } = useQuery({
    queryKey: ["bh_regras_all"],
    queryFn: () => BHRegraService.getWithEmpresa(),
  });

  const { data: jornadas = [] } = useQuery({
    queryKey: ["jornadas_trabalho_all", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("jornadas_trabalho")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("status", "ativo");
      if (error) return [];
      return data || [];
    },
  });

  // Meses com registros
  const { data: mesesComRegistros = [] } = useQuery({
    queryKey: ["rh_meses_com_registros", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      let query = supabase
        .from("registros_ponto")
        .select("data")
        .eq("tenant_id", tenantId)
        .order("data", { ascending: false })
        .limit(500);

      const env = localStorage.getItem("esc-log-environment") || "PRODUCAO";
      if (env === "HOMOLOGACAO") {
        query = query.eq("is_teste", true);
      } else if (env === "PRODUCAO") {
        query = query.or("is_teste.is.null,is_teste.eq.false");
      }

      const { data, error } = await query;
      if (error) return [];
      const meses = new Set<string>();
      for (const row of data ?? []) {
        if (row.data) meses.add(row.data.slice(0, 7));
      }
      return Array.from(meses).sort().reverse();
    },
    staleTime: 30_000,
  });

  // Auto-select latest month if current has no data
  useEffect(() => {
    if (mesesComRegistros.length === 0) return;
    const mostRecent = mesesComRegistros[0];
    if (mostRecent && mostRecent !== currentMonthDefault && selectedMonth === currentMonthDefault) {
      setSelectedMonth(mostRecent);
    }
  }, [mesesComRegistros, selectedMonth]);

  // Raw punches for period
  const { data: pontos = [], isLoading: isLoadingPontos, refetch: refetchPontos } = useQuery({
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

      const env = localStorage.getItem("esc-log-environment") || "PRODUCAO";
      if (env === "HOMOLOGACAO") {
        query = query.eq("is_teste", true);
      } else if (env === "PRODUCAO") {
        query = query.or("is_teste.is.null,is_teste.eq.false");
      }

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  // Regularizações ativas
  const { data: regularizacoes = [], refetch: refetchRegularizacoes } = useQuery({
    queryKey: ["registros_ponto_regularizacoes", selectedMonth, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];
      return PontoRegularizacaoService.getRegularizacoesAtivasPorPeriodo({
        dataInicio: startDate,
        dataFim: endDate,
        tenantId,
      });
    },
  });

  // Decisões ativas
  const { data: decisoes = [], refetch: refetchDecisoes } = useQuery({
    queryKey: ["registros_ponto_decisoes", selectedMonth, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];
      return PontoDecisaoService.getDecisoesAtivasPorPeriodo({
        dataInicio: startDate,
        dataFim: endDate,
        tenantId,
      });
    },
  });

  // Inconsistências
  const { data: inconsistencias = [] } = useQuery({
    queryKey: ["rh_inconsistencias_periodo", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];

      let query = supabase
        .from("inconsistencias")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("data_registro", startDate)
        .lte("data_registro", endDate)
        .order("created_at", { ascending: false });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  // Saldos consolidados de Banco de Horas
  const { data: saldosGerais = [], isLoading: isLoadingSaldos, refetch: refetchSaldos } = useQuery({
    queryKey: ["banco_horas_saldos_gerais", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      return BHEventoService.getSaldosGerais();
    },
  });

  // Maps com multi-indexação de colaboradores (ID, Matrícula, CPF)
  const empresaMap = useMemo(() => new Map(empresas.map((e: any) => [e.id, e.nome])), [empresas]);
  const colaboradorMap = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of colaboradores as any[]) {
      if (c.id) map.set(c.id, c);
      if (c.matricula) map.set(`mat:${c.matricula}`, c);
      if (c.cpf) map.set(`cpf:${c.cpf}`, c);
    }
    return map;
  }, [colaboradores]);

  const regularizacoesMap = useMemo(
    () => PontoRegularizacaoService.mapearRegularizacoesPorPonto(regularizacoes),
    [regularizacoes]
  );
  const decisoesMap = useMemo(
    () => PontoDecisaoService.mapearDecisoesPorPonto(decisoes),
    [decisoes]
  );

  // Presentational Pontos with effective punches and Gates
  const pontosWithPresentation = useMemo(() => {
    return pontos.map((ponto: any) => {
      const colab =
        (ponto.colaborador_id ? colaboradorMap.get(ponto.colaborador_id) : null) ||
        (ponto.matricula ? colaboradorMap.get(`mat:${ponto.matricula}`) : null) ||
        (ponto.matricula_colaborador ? colaboradorMap.get(`mat:${ponto.matricula_colaborador}`) : null) ||
        (ponto.cpf_colaborador ? colaboradorMap.get(`cpf:${ponto.cpf_colaborador}`) : null) ||
        null;

      let pontoEfetivo = PontoRegularizacaoService.anexarRegularizacoes(
        ponto,
        regularizacoesMap.get(ponto.id)
      );
      pontoEfetivo = PontoDecisaoService.anexarDecisao(pontoEfetivo, decisoesMap.get(ponto.id));

      const presentation = resolvePontoPresentation({
        ponto: pontoEfetivo,
        colaborador: colab,
        regras: regras as any[],
        jornadas: jornadas as any[],
        tenantId: tenantId || undefined,
      });

      const factualPunches = formatFactualPunches(pontoEfetivo);

      return {
        ...pontoEfetivo,
        colaboradorObj: colab,
        presentation,
        factualPunches,
      };
    });
  }, [pontos, colaboradorMap, regularizacoesMap, decisoesMap, regras, jornadas, tenantId]);

  // Grouped Colaboradores for aggregated metrics
  const groupedColaboradores = useMemo(() => {
    const groups = new Map<string, any>();

    for (const ponto of pontosWithPresentation) {
      const colabKey = ponto.colaborador_id || ponto.nome_colaborador || `ponto-${ponto.id}`;
      const colabObj = colaboradorMap.get(ponto.colaborador_id);
      const colabNome = colabObj?.nome || ponto.nome_colaborador || "Colaborador não identificado";
      const colabEmpresa = ponto.empresa_id || colabObj?.empresa_id || "all";

      if (!groups.has(colabKey)) {
        groups.set(colabKey, {
          key: colabKey,
          colaborador_id: ponto.colaborador_id,
          nome: colabNome,
          matricula: colabObj?.matricula || ponto.matricula || "—",
          cargo: colabObj?.cargo || "Operacional CLT",
          empresa_id: colabEmpresa,
          empresa_nome: empresaMap.get(colabEmpresa) || "—",
          pontos: [],
          diasApurados: 0,
          diasPendentes: 0,
          horasTrabalhadasMin: 0,
          horasExtrasMin: 0,
          saldoPeriodoMin: 0,
          saldoGeralMin: 0,
          temPendencia: false,
          ultimoProcessamento: null,
        });
      }

      const current = groups.get(colabKey)!;
      current.pontos.push(ponto);
      current.diasApurados++;

      const isProcessado = ponto.presentation?.isProcessado;
      const isBloqueado = ponto.presentation?.isBloqueado;

      if (isBloqueado) {
        current.diasPendentes++;
        current.temPendencia = true;
      }

      if (isProcessado) {
        const worked = rhProcessingUtils.calculateWorkedMinutes(ponto);
        current.horasTrabalhadasMin += worked;
        current.horasExtrasMin += Number(ponto.minutos_extra || 0);
        current.saldoPeriodoMin += Number(ponto.saldo_dia || 0);
      }

      if (ponto.processado_em && (!current.ultimoProcessamento || ponto.processado_em > current.ultimoProcessamento)) {
        current.ultimoProcessamento = ponto.processado_em;
      }
    }

    // Attach current consolidated balance from saldosGerais
    for (const group of groups.values()) {
      const matchingSaldo = saldosGerais.find((s: any) => s.id === group.colaborador_id || s.colaborador_id === group.colaborador_id);
      if (matchingSaldo) {
        group.saldoGeralMin = Number(matchingSaldo.saldo_minutos || matchingSaldo.saldo_atual_minutos || 0);
      }
    }

    return Array.from(groups.values());
  }, [pontosWithPresentation, colaboradorMap, empresaMap, saldosGerais]);

  // Filtered Pontos Table Data
  const filteredPontos = useMemo(() => {
    return pontosWithPresentation.filter((p: any) => {
      const colabNome = (p.nome_colaborador || colaboradorMap.get(p.colaborador_id)?.nome || "").toLowerCase();
      const matricula = String(p.matricula || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchSearch = !searchTerm || colabNome.includes(search) || matricula.includes(search);
      const matchEmpresa = selectedEmpresa === "all" || p.empresa_id === selectedEmpresa;

      let matchStatus = true;
      if (selectedStatusFilter === "processados") {
        matchStatus = p.presentation?.isProcessado;
      } else if (selectedStatusFilter === "inconsistentes") {
        matchStatus = p.presentation?.isBloqueado;
      } else if (selectedStatusFilter === "pendentes") {
        matchStatus = !p.presentation?.isProcessado && !p.presentation?.isBloqueado;
      }

      return matchSearch && matchEmpresa && matchStatus;
    });
  }, [pontosWithPresentation, searchTerm, selectedEmpresa, selectedStatusFilter, colaboradorMap]);

  // Filtered Saldos BH Data
  const filteredSaldosBh = useMemo(() => {
    return saldosGerais.filter((s: any) => {
      const nome = String(s.nome || "").toLowerCase();
      const matricula = String(s.matricula || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchSearch = !searchTerm || nome.includes(search) || matricula.includes(search);
      const matchEmpresa = selectedEmpresa === "all" || s.empresa === selectedEmpresa || s.empresa_id === selectedEmpresa;

      let matchStatus = true;
      if (selectedStatusFilter === "positivo") matchStatus = (s.saldo_minutos || 0) > 0;
      if (selectedStatusFilter === "negativo") matchStatus = (s.saldo_minutos || 0) < 0;
      if (selectedStatusFilter === "critico") matchStatus = s.status === "debito_critico" || s.status === "horas_a_vencer";

      return matchSearch && matchEmpresa && matchStatus;
    });
  }, [saldosGerais, searchTerm, selectedEmpresa, selectedStatusFilter]);

  // Top 4 Compact KPIs (strictly computed from real factual domain data)
  const kpiData = useMemo(() => {
    const totalColaboradores = groupedColaboradores.length;
    const colaboradoresComPendencia = groupedColaboradores.filter((g) => g.temPendencia || g.diasPendentes > 0).length;
    const totalMinutosExtra = groupedColaboradores.reduce((acc, g) => acc + g.horasExtrasMin, 0);
    const saldoLiquidoMinutos = groupedColaboradores.reduce((acc, g) => acc + g.saldoGeralMin, 0);

    return {
      colaboradoresApurados: totalColaboradores,
      jornadasComPendencia: colaboradoresComPendencia,
      horasExtrasPeriodo: minutesToTime(totalMinutosExtra),
      saldoBancoHoras: minutesToTime(saldoLiquidoMinutos),
      saldoLiquidoMinutos,
    };
  }, [groupedColaboradores]);

  // Reprocess period handler
  const handleReprocessPeriod = async () => {
    if (isReprocessingPeriod) return;
    try {
      setIsReprocessingPeriod(true);
      const [year, month] = selectedMonth.split("-").map(Number);
      const res = await reprocessRhPeriod({
        competencia: selectedMonth,
        dataInicio: new Date(year, month - 1, 1).toISOString().split("T")[0],
        dataFim: new Date(year, month, 0).toISOString().split("T")[0],
        empresaId: selectedEmpresa === "all" ? undefined : selectedEmpresa,
        tenantId,
        actorRole: "RH",
      });

      toast.success("Apuração CLT reprocessada com sucesso!", {
        description: `${res.processados} marcações analisadas pelo motor de regras.`,
      });

      await Promise.all([
        refetchPontos(),
        refetchSaldos(),
        refetchRegularizacoes(),
        refetchDecisoes(),
        queryClient.invalidateQueries({ queryKey: ["rh_pontos_periodo"] }),
        queryClient.invalidateQueries({ queryKey: ["banco_horas_saldos_gerais"] }),
      ]);
    } catch (err: any) {
      toast.error("Erro ao reprocessar período CLT", {
        description: err.message || "Verifique os registros e tente novamente.",
      });
    } finally {
      setIsReprocessingPeriod(false);
    }
  };

  // Open Drawer for Colaborador
  const handleOpenColaboradorDrawer = (colabItemOrPonto: any) => {
    const colabId = colabItemOrPonto.colaborador_id || colabItemOrPonto.id;
    const foundGroup = groupedColaboradores.find((g) => g.colaborador_id === colabId || g.key === colabItemOrPonto.key);

    if (foundGroup) {
      setSelectedColaboradorItem(foundGroup);
      const initialPonto = colabItemOrPonto.pontos ? colabItemOrPonto.pontos[0] : colabItemOrPonto;
      setSelectedPontoDia(initialPonto || foundGroup.pontos[0] || null);
    } else {
      setSelectedColaboradorItem({
        colaborador_id: colabId,
        nome: colabItemOrPonto.nome_colaborador || colabItemOrPonto.nome || "Colaborador",
        matricula: colabItemOrPonto.matricula || "—",
        cargo: "Operacional CLT",
        empresa_id: colabItemOrPonto.empresa_id || "all",
        empresa_nome: empresaMap.get(colabItemOrPonto.empresa_id) || "—",
        pontos: [colabItemOrPonto],
        diasApurados: 1,
        diasPendentes: 0,
        horasTrabalhadasMin: 0,
        horasExtrasMin: 0,
        saldoPeriodoMin: 0,
        saldoGeralMin: 0,
      });
      setSelectedPontoDia(colabItemOrPonto);
    }

    setDrawerTab("apuracao");
    setDrawerOpen(true);
  };

  // Modal Handlers
  const handleOpenRegularizacao = (ponto: any) => {
    setRegularizacaoPontoTarget(ponto);
    setRegularizacaoModalOpen(true);
  };

  const handleOpenDecisao = (ponto: any, defaultTipo?: TipoDecisaoPonto) => {
    setDecisaoPontoTarget(ponto);
    setDecisaoTipoDefault(defaultTipo || null);
    setDecisaoModalOpen(true);
  };

  const handleSaveJustification = async (justificativa: string) => {
    if (!justificationTarget) return;
    try {
      setIsSavingJustification(true);
      const { error } = await supabase
        .from("inconsistencias")
        .update({
          observacao: justificativa,
          status: "JUSTIFICADA",
          updated_at: new Date().toISOString(),
        })
        .eq("id", justificationTarget.id);

      if (error) throw error;
      toast.success("Justificativa registrada com sucesso!");
      setJustificationTarget(null);
      queryClient.invalidateQueries({ queryKey: ["rh_inconsistencias_periodo"] });
    } catch (err: any) {
      toast.error("Erro ao salvar justificativa", { description: err.message });
    } finally {
      setIsSavingJustification(false);
    }
  };

  // Direct RH balance adjustment
  const handleConfirmDirectRhAction = async () => {
    if (!selectedColaboradorItem?.colaborador_id) return;
    if (actionDialogObservation.trim().length < 5) {
      toast.error("Observação obrigatória com no mínimo 5 caracteres.");
      return;
    }

    try {
      setIsSubmittingAction(true);
      const mins = Number(actionDialogMinutes) || 0;

      await BHEventoService.createEvento({
        colaborador_id: selectedColaboradorItem.colaborador_id,
        tipo_evento: actionDialogType,
        minutos: actionDialogType === "compensacao" ? -Math.abs(mins) : mins,
        observacao: actionDialogObservation,
        data_evento: actionDialogDate,
        origem: "ajuste_rh_central_clt",
      });

      toast.success("Ação RH executada e registrada na auditoria!");
      setActionDialogOpen(false);
      setActionDialogObservation("");
      setActionDialogMinutes("0");
      refetchSaldos();
      refetchPontos();
    } catch (err: any) {
      toast.error("Erro ao executar ação RH", { description: err.message });
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Upload Modal Handler
  const handleImportSpreadsheet = async (data: any[], optionValue?: string) => {
    if (!tenantId) return;
    try {
      const res = await PontoService.importarPontos({
        registros: data,
        empresaId: selectedEmpresa === "all" ? undefined : selectedEmpresa,
        tenantId,
      });

      // Auto ensure pre-cadastros if needed
      await ensurePreCadastrosFromImportedPontos(tenantId);

      toast.success("Importação de marcações concluída com sucesso!", {
        description: `${res.totalProcessados || data.length} linhas importadas para a base oficial.`,
      });

      setImportModalOpen(false);
      refetchPontos();
      refetchSaldos();
    } catch (err: any) {
      toast.error("Erro ao importar planilha de pontos", {
        description: err.message || "Verifique a formatação do arquivo.",
      });
    }
  };

  // Table Columns for View 1: Apuração & Batidas
  const apuracaoColumns = [
    {
      id: "colaborador",
      header: "Colaborador",
      render: (row: any) => (
        <div className="flex flex-col min-w-[160px]">
          <span className="font-semibold text-foreground text-xs">{row.nome_colaborador || "—"}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {row.matricula ? `Mat: ${row.matricula}` : empresaMap.get(row.empresa_id) || "ESC Log"}
          </span>
        </div>
      ),
    },
    {
      id: "data",
      header: "Data",
      render: (row: any) => (
        <div className="flex flex-col text-xs font-mono">
          <span>{row.data ? format(new Date(`${row.data}T12:00:00`), "dd/MM/yyyy") : "—"}</span>
          <span className="text-[10px] text-muted-foreground lowercase">
            {row.data ? format(new Date(`${row.data}T12:00:00`), "EEEE", { locale: ptBR }) : ""}
          </span>
        </div>
      ),
    },
    {
      id: "jornada",
      header: "Jornada Aplicada",
      render: (row: any) => {
        const pres = row.presentation as PontoPresentationInfo | undefined;
        const label =
          pres?.statusVisual === "CADASTRO_PENDENTE"
            ? "Aguardando cadastro"
            : pres?.jornadaNome && pres.jornadaNome !== "—" && pres.jornadaNome !== "SEM_JORNADA"
            ? pres.jornadaNome
            : row.regra_aplicada || (pres?.isProcessado ? "Jornada Padrão" : "Não apurada");

        return (
          <div className="flex items-center gap-1.5">
            <OrbeBadge variant="neutral" size="sm" className="font-mono text-[10px]">
              {label}
            </OrbeBadge>
          </div>
        );
      },
    },
    {
      id: "entrada",
      header: "Entrada",
      align: "center" as const,
      render: (row: any) => (
        <span className={cn("font-mono text-xs", !row.factualPunches?.entrada && "text-muted-foreground/50")}>
          {row.factualPunches?.entrada || "—"}
        </span>
      ),
    },
    {
      id: "intervalo",
      header: "Intervalo (Almoço)",
      align: "center" as const,
      render: (row: any) => (
        <span className={cn("font-mono text-xs", !row.factualPunches?.saidaAlmoco && "text-muted-foreground/50")}>
          {row.factualPunches?.saidaAlmoco || "—"} às {row.factualPunches?.retornoAlmoco || "—"}
        </span>
      ),
    },
    {
      id: "saida",
      header: "Saída",
      align: "center" as const,
      render: (row: any) => (
        <span className={cn("font-mono text-xs", !row.factualPunches?.saidaFinal && "text-muted-foreground/50")}>
          {row.factualPunches?.saidaFinal || "—"}
        </span>
      ),
    },
    {
      id: "horas_trabalhadas",
      header: "Trabalhadas",
      align: "center" as const,
      render: (row: any) => {
        const mins = rhProcessingUtils.calculateWorkedMinutes(row);
        return <span className="font-mono font-medium text-xs">{minutesToTime(mins)}</span>;
      },
    },
    {
      id: "saldo_dia",
      header: "Saldo Dia / HE",
      align: "center" as const,
      render: (row: any) => {
        const sDia = Number(row.saldo_dia || 0);
        const he = Number(row.minutos_extra || 0);
        return (
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "font-mono font-semibold text-xs",
                sDia > 0 ? "text-emerald-600 dark:text-emerald-400" : sDia < 0 ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"
              )}
            >
              {minutesToTime(sDia)}
            </span>
            {he > 0 && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">+{minutesToTime(he)} HE</span>}
          </div>
        );
      },
    },
    {
      id: "situacao",
      header: "Situação",
      render: (row: any) => {
        const pres = row.presentation as PontoPresentationInfo;
        if (pres.isBloqueado) {
          return (
            <OrbeStatusBadge
              status="danger"
              label={pres.badgeLabel || "Inconsistente"}
              size="sm"
            />
          );
        }
        if (pres.isProcessado) {
          return (
            <OrbeStatusBadge
              status="success"
              label={pres.badgeLabel || "Processado"}
              size="sm"
            />
          );
        }
        return (
          <OrbeStatusBadge
            status="warning"
            label="Aguardando RH"
            size="sm"
          />
        );
      },
    },
    {
      id: "acoes",
      header: "Ação",
      align: "right" as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1">
          <OrbeButton
            variant="ghost"
            size="sm"
            onClick={() => handleOpenColaboradorDrawer(row)}
            className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Apuração
          </OrbeButton>
        </div>
      ),
    },
  ];

  // Table Columns for View 2: Saldos & Banco de Horas
  const saldosBhColumns = [
    {
      id: "colaborador",
      header: "Colaborador",
      render: (row: any) => (
        <div className="flex flex-col min-w-[180px]">
          <span className="font-semibold text-foreground text-xs">{row.nome || "—"}</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            {row.matricula ? `Mat: ${row.matricula}` : row.empresa || "ESC Log"}
          </span>
        </div>
      ),
    },
    {
      id: "empresa",
      header: "Empresa",
      render: (row: any) => <span className="text-xs text-muted-foreground">{row.empresa || "—"}</span>,
    },
    {
      id: "saldo_atual",
      header: "Saldo Atual",
      align: "center" as const,
      render: (row: any) => {
        const mins = Number(row.saldo_minutos || row.saldo_atual_minutos || 0);
        return (
          <div className="inline-flex items-center gap-1">
            <span
              className={cn(
                "font-mono font-bold text-xs px-2 py-0.5 rounded-md",
                mins > 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40"
                  : mins < 0
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {minutesToTime(mins)}
            </span>
          </div>
        );
      },
    },
    {
      id: "creditos",
      header: "Créditos (+)",
      align: "center" as const,
      render: (row: any) => (
        <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
          +{minutesToTime(Number(row.creditos_minutos || 0))}
        </span>
      ),
    },
    {
      id: "debitos",
      header: "Débitos (-)",
      align: "center" as const,
      render: (row: any) => (
        <span className="font-mono text-xs text-rose-600 dark:text-rose-400">
          -{minutesToTime(Math.abs(Number(row.debitos_minutos || 0)))}
        </span>
      ),
    },
    {
      id: "horas_vencer",
      header: "A Vencer (30d)",
      align: "center" as const,
      render: (row: any) => {
        const v = Number(row.minutos_a_vencer_30d || 0);
        return v > 0 ? (
          <span className="font-mono text-xs text-amber-600 dark:text-amber-400 font-semibold">
            {minutesToTime(v)}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        );
      },
    },
    {
      id: "situacao",
      header: "Situação",
      render: (row: any) => {
        const mins = Number(row.saldo_minutos || row.saldo_atual_minutos || 0);
        if (row.status === "debito_critico" || mins < -600) {
          return <OrbeStatusBadge status="danger" label="Débito Crítico" size="sm" />;
        }
        if (row.status === "horas_a_vencer") {
          return <OrbeStatusBadge status="warning" label="Horas a Vencer" size="sm" />;
        }
        if (mins > 0) {
          return <OrbeStatusBadge status="success" label="Saldo Positivo" size="sm" />;
        }
        return <OrbeStatusBadge status="neutral" label="Equilibrado" size="sm" />;
      },
    },
    {
      id: "acoes",
      header: "Ação",
      align: "right" as const,
      render: (row: any) => (
        <div className="flex items-center justify-end gap-1">
          <OrbeButton
            variant="ghost"
            size="sm"
            onClick={() => handleOpenColaboradorDrawer(row)}
            className="h-7 px-2 text-xs text-blue-600 dark:text-blue-400"
          >
            <Eye className="h-3.5 w-3.5 mr-1" />
            Extrato / Ações
          </OrbeButton>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <OrbePageContainer maxWidth="1560px" className="space-y-4">
        {/* Page Header */}
        <OrbePageHeader
          badge={<OrbeBadge variant="primary">Módulo Pessoas & RH</OrbeBadge>}
          title="Ponto & Jornadas CLT"
          description="Apuração de jornadas, marcações e banco de horas."
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <OrbeButton
                variant="outline"
                size="sm"
                icon={FileSpreadsheet}
                onClick={() => setImportModalOpen(true)}
              >
                Importar marcações
              </OrbeButton>

              <OrbeButton
                variant="outline"
                size="sm"
                icon={AlertTriangle}
                onClick={() => navigate("/inconsistencias")}
              >
                Central de Inconsistências
              </OrbeButton>

              <OrbeButton
                variant="primary"
                size="sm"
                icon={Send}
                onClick={() => navigate("/banco-horas/fechamento")}
              >
                Ir para Fechamento Mensal
              </OrbeButton>
            </div>
          }
        />

        {/* Síntese Superior — 4 Compact KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <OrbeKpiCard
            label="Colaboradores Apurados"
            value={kpiData.colaboradoresApurados}
            subValue="Ativos na competência"
            icon={Users}
            status="info"
          />
          <OrbeKpiCard
            label="Jornadas com Pendência"
            value={kpiData.jornadasComPendencia}
            subValue="Aguardando decisão/regularização"
            icon={AlertTriangle}
            status={kpiData.jornadasComPendencia > 0 ? "warning" : "success"}
          />
          <OrbeKpiCard
            label="Horas Extras no Período"
            value={kpiData.horasExtrasPeriodo}
            subValue="Acúmulo total faturável/banco"
            icon={Clock}
            status="info"
          />
          <OrbeKpiCard
            label="Saldo de Banco de Horas"
            value={kpiData.saldoBancoHoras}
            subValue="Saldo líquido consolidado"
            icon={Wallet}
            status={kpiData.saldoLiquidoMinutos >= 0 ? "success" : "danger"}
          />
        </div>

        {/* View Switcher Tabs & Filters */}
        <div className="space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-border pb-2">
            {/* 2 Main Views: Apuração & Batidas / Saldos & Banco de Horas */}
            <div className="flex items-center gap-2 bg-muted/40 p-1 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setViewTab("apuracao")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  viewTab === "apuracao"
                    ? "bg-card text-foreground shadow-xs border border-border font-bold text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                Apuração & Batidas
              </button>

              <button
                type="button"
                onClick={() => setViewTab("saldos_bh")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  viewTab === "saldos_bh"
                    ? "bg-card text-foreground shadow-xs border border-border font-bold text-blue-600 dark:text-blue-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Wallet className="h-3.5 w-3.5" />
                Saldos & Banco de Horas
              </button>
            </div>

            {/* Global Context Selectors */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Competência Selector */}
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="h-8 text-xs w-[160px]">
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    {mesesComRegistros.map((mes) => (
                      <SelectItem key={mes} value={mes} className="text-xs">
                        {formatCompetenciaLabel(mes)}
                      </SelectItem>
                    ))}
                    {!mesesComRegistros.includes(currentMonthDefault) && (
                      <SelectItem value={currentMonthDefault} className="text-xs">
                        {formatCompetenciaLabel(currentMonthDefault)}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Empresa Selector */}
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue placeholder="Todas as empresas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas as empresas</SelectItem>
                    {empresas.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-xs">
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reprocess Button */}
              {viewTab === "apuracao" && (
                <OrbeButton
                  variant="outline"
                  size="sm"
                  onClick={handleReprocessPeriod}
                  disabled={isReprocessingPeriod}
                  icon={RefreshCw}
                  className={cn("h-8 text-xs", isReprocessingPeriod && "animate-spin")}
                >
                  {isReprocessingPeriod ? "Processando..." : "Reprocessar"}
                </OrbeButton>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <OrbeFilterBar
            activeCount={
              (searchTerm ? 1 : 0) +
              (selectedStatusFilter !== "all" ? 1 : 0) +
              (selectedEmpresa !== "all" ? 1 : 0)
            }
            onClear={() => {
              setSearchTerm("");
              setSelectedStatusFilter("all");
              setSelectedEmpresa("all");
            }}
          >
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador ou matrícula..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Status Filter */}
            <Select value={selectedStatusFilter} onValueChange={setSelectedStatusFilter}>
              <SelectTrigger className="h-8 text-xs w-[160px]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas situações</SelectItem>
                {viewTab === "apuracao" ? (
                  <>
                    <SelectItem value="processados" className="text-xs">Processados</SelectItem>
                    <SelectItem value="inconsistentes" className="text-xs">Inconsistentes / Bloqueados</SelectItem>
                    <SelectItem value="pendentes" className="text-xs">Aguardando RH</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="positivo" className="text-xs">Saldo Positivo</SelectItem>
                    <SelectItem value="negativo" className="text-xs">Saldo Devedor</SelectItem>
                    <SelectItem value="critico" className="text-xs">Débito Crítico / A Vencer</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </OrbeFilterBar>

          {/* Table Container */}
          {viewTab === "apuracao" ? (
            <OrbeTable
              columns={apuracaoColumns}
              data={filteredPontos}
              keyExtractor={(row) => row.id}
              loading={isLoadingPontos}
              emptyMessage="Nenhuma marcação encontrada para o período e filtros selecionados."
            />
          ) : (
            <OrbeTable
              columns={saldosBhColumns}
              data={filteredSaldosBh}
              keyExtractor={(row) => row.id || row.colaborador_id}
              loading={isLoadingSaldos}
              emptyMessage="Nenhum saldo consolidado encontrado para os filtros selecionados."
            />
          )}
        </div>

        {/* Colaborador Drawer (Canônico do Design System) */}
        <OrbeDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title={selectedColaboradorItem?.nome || "Colaborador CLT"}
          subtitle={`${selectedColaboradorItem?.empresa_nome || "ESC Log"} • Competência ${formatCompetenciaLabel(selectedMonth)}`}
          badge={
            <OrbeBadge variant={selectedColaboradorItem?.temPendencia ? "warning" : "primary"}>
              {selectedColaboradorItem?.matricula ? `Mat: ${selectedColaboradorItem.matricula}` : "CLT"}
            </OrbeBadge>
          }
          size="xl"
          footerActions={
            <div className="flex items-center justify-end w-full">
              <OrbeButton variant="outline" size="sm" onClick={() => setDrawerOpen(false)}>
                Fechar
              </OrbeButton>
            </div>
          }
        >
          <div className="space-y-4">
            {/* Drawer Internal 3-Tab Navigator */}
            <div className="flex items-center gap-1 border-b border-border pb-2">
              <button
                type="button"
                onClick={() => setDrawerTab("apuracao")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  drawerTab === "apuracao"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                1. Apuração da Competência
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab("acoes_rh")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  drawerTab === "acoes_rh"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Edit3 className="h-3.5 w-3.5" />
                2. Ações RH
              </button>

              <button
                type="button"
                onClick={() => setDrawerTab("historico")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5",
                  drawerTab === "historico"
                    ? "bg-primary text-primary-foreground font-bold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <History className="h-3.5 w-3.5" />
                3. Histórico & Auditoria
              </button>
            </div>

            {/* TAB 1: Apuração da Competência */}
            {drawerTab === "apuracao" && (
              <div className="space-y-4">
                {/* Colaborador & Read-only Jornada Context */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Jornada Contratada
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold font-mono">
                        {(() => {
                          const pres = selectedPontoDia?.presentation as PontoPresentationInfo | undefined;
                          return pres?.statusVisual === "CADASTRO_PENDENTE"
                            ? "Aguardando cadastro"
                            : pres?.jornadaNome && pres.jornadaNome !== "—" && pres.jornadaNome !== "SEM_JORNADA"
                            ? pres.jornadaNome
                            : selectedPontoDia?.regra_aplicada || (pres?.isProcessado ? "Jornada Padrão" : "Não apurada");
                        })()}
                      </span>
                      <Lock className="h-3 w-3 text-muted-foreground" title="Jornada Read-only" />
                    </div>
                  </div>

                  <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Horas Trabalhadas
                    </span>
                    <p className="text-xs font-bold font-mono">
                      {minutesToTime(selectedColaboradorItem?.horasTrabalhadasMin || 0)}
                    </p>
                  </div>

                  <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Saldo Consolidado
                    </span>
                    <p
                      className={cn(
                        "text-xs font-bold font-mono",
                        (selectedColaboradorItem?.saldoGeralMin || 0) >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      )}
                    >
                      {minutesToTime(selectedColaboradorItem?.saldoGeralMin || 0)}
                    </p>
                  </div>
                </div>

                {/* Link contextual para Configurar Jornadas */}
                <div className="flex items-center justify-between px-3 py-2 bg-muted/20 border border-border rounded-lg">
                  <span className="text-xs text-muted-foreground">
                    Regras e jornadas contratuais
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate("/cadastros/regras-operacionais")}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Configurar jornadas
                  </button>
                </div>

                {/* Day by Day Selector / Punches */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Marcações do Mês ({selectedColaboradorItem?.pontos?.length || 0} dias)
                  </h4>

                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {(selectedColaboradorItem?.pontos || []).map((ponto: any) => {
                      const colab =
                        colaboradorMap.get(ponto.colaborador_id) ||
                        colaboradorMap.get(`mat:${ponto.matricula}`) ||
                        colaboradorMap.get(`cpf:${ponto.cpf}`);
                      const pres =
                        ponto.presentation ||
                        (ponto.id
                          ? resolvePontoPresentation({
                              ponto,
                              colaborador: colab,
                              regras: regras as any[],
                              jornadas: jornadas as any[],
                              tenantId: tenantId || undefined,
                            })
                          : null) || {
                          isBloqueado: false,
                          isProcessado: true,
                          badgeLabel: "Apurado",
                        };
                      const punches = ponto.factualPunches || formatFactualPunches(ponto);
                      const isSelected = selectedPontoDia?.id === ponto.id;

                      return (
                        <div
                          key={ponto.id || `ponto-${Math.random()}`}
                          onClick={() => setSelectedPontoDia(ponto)}
                          className={cn(
                            "p-3 flex items-center justify-between gap-3 text-xs cursor-pointer transition-all hover:bg-muted/30",
                            isSelected && "bg-blue-50/40 dark:bg-blue-950/20 border-l-4 border-l-blue-600"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-semibold">
                              {ponto.data ? format(new Date(`${ponto.data}T12:00:00`), "dd/MM (EEE)", { locale: ptBR }) : "—"}
                            </span>
                            <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
                              <span>{punches?.entrada || "—"}</span>
                              <span>•</span>
                              <span>{punches?.saidaAlmoco || "—"} - {punches?.retornoAlmoco || "—"}</span>
                              <span>•</span>
                              <span>{punches?.saidaFinal || "—"}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "font-mono font-bold",
                                Number(ponto.saldo_dia || 0) > 0
                                  ? "text-emerald-600"
                                  : Number(ponto.saldo_dia || 0) < 0
                                  ? "text-rose-600"
                                  : "text-muted-foreground"
                              )}
                            >
                              {minutesToTime(Number(ponto.saldo_dia || 0))}
                            </span>

                            <OrbeStatusBadge
                              status={pres.isBloqueado ? "danger" : pres.isProcessado ? "success" : "warning"}
                              label={pres.badgeLabel || "Status"}
                              size="sm"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Calculation Transparency for Selected Day */}
                {selectedPontoDia && (
                  <div className="bg-card border border-border rounded-lg p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <Info className="h-3.5 w-3.5 text-blue-600" />
                        Transparência do Cálculo — {selectedPontoDia.data ? format(new Date(`${selectedPontoDia.data}T12:00:00`), "dd/MM/yyyy") : ""}
                      </h4>

                      {selectedPontoDia.presentation?.isBloqueado && (
                        <OrbeButton
                          variant="outline"
                          size="sm"
                          icon={Edit3}
                          onClick={() => handleOpenRegularizacao(selectedPontoDia)}
                          className="h-7 text-xs border-amber-300 text-amber-700 dark:text-amber-400"
                        >
                          Regularizar este dia
                        </OrbeButton>
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedPontoDia.presentation?.explicacao ||
                        `Jornada padrão aplicada. Horas apuradas: ${minutesToTime(rhProcessingUtils.calculateWorkedMinutes(selectedPontoDia))}.`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Ações RH */}
            {drawerTab === "acoes_rh" && (
              <div className="space-y-4">
                <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
                  <h4 className="text-xs font-bold text-foreground">Ações Especialistas Homologadas</h4>
                  <p className="text-xs text-muted-foreground">
                    Todas as intervenções são gravadas com trilha de auditoria e justificativa obrigatória.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Regularização */}
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <Edit3 className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-bold">Regularizar Batida</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Corrige marcação faltante ou inconsistente sem sobrescrever o dado original.
                    </p>
                    <OrbeButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenRegularizacao(selectedPontoDia || selectedColaboradorItem?.pontos?.[0])}
                      className="w-full text-xs"
                    >
                      Abrir Regularização
                    </OrbeButton>
                  </div>

                  {/* Decisão RH */}
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold">Decisão RH / Abonar</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Aplica abono, falta justificada ou direcionamento de DSR.
                    </p>
                    <OrbeButton
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDecisao(selectedPontoDia || selectedColaboradorItem?.pontos?.[0])}
                      className="w-full text-xs"
                    >
                      Aplicar Decisão
                    </OrbeButton>
                  </div>

                  {/* Compensar Banco de Horas */}
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <HandCoins className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold">Compensar Saldo BH</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Abate minutos positivos diretamente do saldo do colaborador.
                    </p>
                    <OrbeButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActionDialogType("compensacao");
                        setActionDialogOpen(true);
                      }}
                      className="w-full text-xs"
                    >
                      Lançar Compensação
                    </OrbeButton>
                  </div>

                  {/* Registrar Folga */}
                  <div className="border border-border rounded-lg p-3 space-y-2 bg-card">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-bold">Registrar Folga</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Converte saldo positivo em dia de descanso programado.
                    </p>
                    <OrbeButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setActionDialogType("folga");
                        setActionDialogOpen(true);
                      }}
                      className="w-full text-xs"
                    >
                      Lançar Folga
                    </OrbeButton>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Histórico & Auditoria */}
            {drawerTab === "historico" && (
              <div className="space-y-3">
                <div className="bg-muted/20 border border-border rounded-lg p-3">
                  <h4 className="text-xs font-bold text-foreground">Trilha de Auditoria & Alterações</h4>
                  <p className="text-xs text-muted-foreground">
                    Registro cronológico de importações, regularizações, decisões e intervenções do RH.
                  </p>
                </div>

                <div className="space-y-2">
                  {/* Regularizações auditadas */}
                  {regularizacoes
                    .filter((r: any) => r.colaborador_id === selectedColaboradorItem?.colaborador_id)
                    .map((reg: any) => (
                      <div key={reg.id} className="border border-border rounded-lg p-3 bg-card space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-foreground">
                            Regularização: {reg.campo_alterado}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {reg.created_at ? format(new Date(reg.created_at), "dd/MM/yyyy HH:mm") : "—"}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Original: <span className="font-mono">{reg.valor_original || "—"}</span> → Regularizado: <span className="font-mono font-bold text-foreground">{reg.valor_regularizado}</span>
                        </p>
                        <p className="text-[11px] text-foreground bg-muted/30 p-1.5 rounded">
                          Justificativa: {reg.justificativa}
                        </p>
                      </div>
                    ))}

                  {/* Decisões auditadas */}
                  {decisoes
                    .filter((d: any) => d.colaborador_id === selectedColaboradorItem?.colaborador_id)
                    .map((dec: any) => (
                      <div key={dec.id} className="border border-border rounded-lg p-3 bg-card space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-emerald-600">
                            Decisão RH: {dec.tipo_decisao}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {dec.created_at ? format(new Date(dec.created_at), "dd/MM/yyyy HH:mm") : "—"}
                          </span>
                        </div>
                        <p className="text-[11px] text-foreground bg-muted/30 p-1.5 rounded">
                          Justificativa: {dec.justificativa}
                        </p>
                      </div>
                    ))}

                  {regularizacoes.filter((r: any) => r.colaborador_id === selectedColaboradorItem?.colaborador_id).length === 0 &&
                    decisoes.filter((d: any) => d.colaborador_id === selectedColaboradorItem?.colaborador_id).length === 0 && (
                      <div className="text-center p-6 border border-dashed border-border rounded-lg text-xs text-muted-foreground">
                        Nenhuma regularização ou decisão manual registrada para este colaborador.
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </OrbeDrawer>

        {/* Submodal 1: Spreadsheet Upload */}
        <SpreadsheetUploadModal
          open={importModalOpen}
          onOpenChange={setImportModalOpen}
          title="Importar Marcações de Ponto CLT"
          description="Selecione o arquivo com as batidas brutas extraídas do relógio de ponto ou REP."
          expectedColumns={["DATA", "COLABORADOR", "ENTRADA", "INTERVALO_SAIDA", "INTERVALO_RETORNO", "SAIDA"]}
          onUpload={handleImportSpreadsheet}
        />

        {/* Submodal 2: Regularizar Marcação */}
        <RegularizarMarcacaoModal
          open={regularizacaoModalOpen}
          onOpenChange={(open) => {
            setRegularizacaoModalOpen(open);
            if (!open) setRegularizacaoPontoTarget(null);
          }}
          ponto={regularizacaoPontoTarget}
          colaboradorNome={selectedColaboradorItem?.nome || regularizacaoPontoTarget?.nome_colaborador || "Colaborador"}
          onSuccess={async () => {
            await Promise.all([refetchRegularizacoes(), refetchPontos()]);
            toast.success("Regularização auditada salva com sucesso!");
          }}
        />

        {/* Submodal 3: Decidir Ponto Modal */}
        <DecidirPontoModal
          open={decisaoModalOpen}
          onOpenChange={(open) => {
            setDecisaoModalOpen(open);
            if (!open) {
              setDecisaoPontoTarget(null);
              setDecisaoTipoDefault(null);
            }
          }}
          ponto={decisaoPontoTarget}
          colaboradorNome={selectedColaboradorItem?.nome || decisaoPontoTarget?.nome_colaborador || "Colaborador"}
          defaultTipoDecisao={decisaoTipoDefault}
          onSuccess={async () => {
            await Promise.all([refetchDecisoes(), refetchRegularizacoes(), refetchPontos()]);
            toast.success("Decisão RH auditada salva com sucesso!");
          }}
        />

        {/* Submodal 4: Inconsistency Justification Modal */}
        <JustificationModal
          isOpen={Boolean(justificationTarget)}
          onClose={() => setJustificationTarget(null)}
          onConfirm={handleSaveJustification}
          isLoading={isSavingJustification}
          title="Justificar Inconsistência CLT"
          description="Registre a justificativa operacional desta inconsistência para auditoria."
        />

        {/* Submodal 5: Direct RH Action Dialog */}
        <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold">
                {actionDialogType === "compensacao" ? "Compensar Saldo de Banco de Horas" : "Registrar Folga Programada"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {actionDialogType === "compensacao"
                  ? "Informe os minutos a serem abatidos do saldo positivo."
                  : "Informe a data da folga e os minutos convertidos."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1">
                <Label htmlFor="action_minutes">Minutos a abater</Label>
                <Input
                  id="action_minutes"
                  type="number"
                  value={actionDialogMinutes}
                  onChange={(e) => setActionDialogMinutes(e.target.value)}
                  placeholder="Ex: 480 (para 8h)"
                  className="h-8 text-xs font-mono"
                />
              </div>

              {actionDialogType === "folga" && (
                <div className="space-y-1">
                  <Label htmlFor="action_date">Data da Folga</Label>
                  <Input
                    id="action_date"
                    type="date"
                    value={actionDialogDate}
                    onChange={(e) => setActionDialogDate(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label htmlFor="action_obs">Justificativa Operacional (Obrigatória)</Label>
                <Textarea
                  id="action_obs"
                  rows={3}
                  value={actionDialogObservation}
                  onChange={(e) => setActionDialogObservation(e.target.value)}
                  placeholder="Descreva o motivo desta ação para fins de auditoria..."
                  className="text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <OrbeButton variant="outline" size="sm" onClick={() => setActionDialogOpen(false)}>
                Cancelar
              </OrbeButton>
              <OrbeButton
                variant="primary"
                size="sm"
                onClick={handleConfirmDirectRhAction}
                disabled={isSubmittingAction || actionDialogObservation.trim().length < 5}
              >
                {isSubmittingAction ? "Registrando..." : "Confirmar Ação"}
              </OrbeButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </OrbePageContainer>
    </AppShell>
  );
};

export default PontoJornadasClt;
