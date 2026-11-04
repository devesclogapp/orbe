import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  Wallet,
  Activity,
  TrendingUp,
  Clock,
  Download,
  Printer,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  Sparkles,
  SlidersHorizontal,
  Layers,
  Building2,
  Calendar,
  X,
  ExternalLink,
  ChevronDown,
  Info,
  Check,
  RotateCcw,
  Boxes,
  Receipt,
  CircleDollarSign,
  UserCheck,
  CalendarDays,
  FileSpreadsheet,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { FerramentasContabeisMenu } from "@/pages/Relatorios/components/FerramentasContabeisMenu";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { EmpresaService } from "@/services/base.service";
import {
  RelatoriosOficialAdapter,
  RELATORIOS_CATALOGO_OFICIAL,
  checkReportAccess,
  formatBRL,
  formatMinutosToHourString,
  getStatusLoteDiaristaLabel,
  getStatusCustoExtraLabel,
  getCategoriaCustoLabel,
  getPipelineStatusServicoExtraLabel,
  getStatusReceitaLabel,
  getModalidadeLabel,
  getSituacaoDerivadaReceita,
  ReportMeta,
  OperacaoVolumeRow,
  DiaristaFechamentoRow,
  FaturamentoReceitaRow,
  CustoExtraRow,
  BancoHorasRow,
  ServicoExtraRow,
} from "@/services/adapters/relatoriosOficialAdapter";

interface KpiDrawerInfo {
  title: string;
  subtitle: string;
  metricLabel: string;
  metricValue: string;
  description: string;
  sourceTable: string;
  breakdown: Array<{ label: string; value: string; detail?: string }>;
}

const COMPETENCIAS_DISPONIVEIS = [
  { value: "2026-10", label: "Outubro / 2026 (Em Aberto)" },
  { value: "2026-09", label: "Setembro / 2026 (Oficial Homologado)" },
  { value: "2026-08", label: "Agosto / 2026 (Arquivado)" },
];

export default function CentralRelatoriosV2() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAccessControl();

  // 1. Carregar Empresas
  const { data: empresasCadastradas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas_cadastradas_relatorios_v2"],
    queryFn: () => EmpresaService.getAll(),
  });

  const defaultEmpresaId = empresasCadastradas[0]?.id || "";
  const urlEmpresa = searchParams.get("empresa") || defaultEmpresaId;
  const urlCompetencia = searchParams.get("competencia") || "2026-09";
  const urlReport = searchParams.get("report") || "dashboard";

  const [empresaId, setEmpresaId] = useState(urlEmpresa);
  const [competencia, setCompetencia] = useState(urlCompetencia);
  const [activeReportId, setActiveReportId] = useState<string>(urlReport);

  // Sincronizar primeira empresa
  useEffect(() => {
    if (!empresaId && empresasCadastradas.length > 0) {
      setEmpresaId(empresasCadastradas[0].id);
    }
  }, [empresasCadastradas, empresaId]);

  // Sincronizar parâmetros na URL
  const updateUrl = (newEmpresa: string, newComp: string, newReport: string) => {
    const params: Record<string, string> = {
      empresa: newEmpresa,
      competencia: newComp,
      report: newReport,
    };
    setSearchParams(params);
  };

  const handleEmpresaChange = (val: string) => {
    setEmpresaId(val);
    updateUrl(val, competencia, activeReportId);
  };

  const handleCompetenciaChange = (val: string) => {
    setCompetencia(val);
    updateUrl(empresaId, val, activeReportId);
  };

  const handleSelectNav = (reportKey: string) => {
    setActiveReportId(reportKey);
    resetFiltrosEspecificos();
    updateUrl(empresaId, competencia, reportKey);
  };

  const empresaSelecionada = useMemo(() => {
    return empresasCadastradas.find((e: any) => e.id === empresaId) || {
      id: empresaId,
      nome: isLoadingEmpresas ? "Carregando empresa..." : "ESC LOG Matriz",
    };
  }, [empresasCadastradas, empresaId, isLoadingEmpresas]);

  // 2. Consulta de Dados Consolidados via Adapter Oficial
  const {
    data: hubData,
    isLoading: isLoadingHub,
    refetch: refetchHub,
  } = useQuery({
    queryKey: ["relatorios_hub_consolidado_v2", empresaId, competencia],
    queryFn: () => RelatoriosOficialAdapter.getCentralHubConsolidado(empresaId, competencia),
    enabled: !!empresaId,
  });

  // Metadados do relatório ativo
  const currentReportMeta = useMemo(() => {
    if (activeReportId === "dashboard") return null;
    return (
      RELATORIOS_CATALOGO_OFICIAL.find((r) => r.id === activeReportId || r.code === activeReportId) || null
    );
  }, [activeReportId]);

  // Permissão de acesso ao relatório ativo
  const isCurrentReportAllowed = useMemo(() => {
    if (activeReportId === "dashboard") return true;
    if (activeReportId === "r06-produtividade-individual" || activeReportId === "R06") return false;
    return checkReportAccess(activeReportId, role);
  }, [activeReportId, role]);

  // Estados locais do visualizador analítico
  const [searchTerm, setSearchTerm] = useState("");
  const [tableFilterStatus, setTableFilterStatus] = useState("all");

  // Filtros específicos por caderno analítico
  const [filtroTransportadora, setFiltroTransportadora] = useState("all");
  const [filtroServico, setFiltroServico] = useState("all");
  const [filtroStatus, setFiltroStatus] = useState("all");

  const [filtroFuncaoDiarista, setFiltroFuncaoDiarista] = useState("all");
  const [filtroStatusDiarista, setFiltroStatusDiarista] = useState("all");

  const [filtroModalidade, setFiltroModalidade] = useState("all");
  const [filtroStatusReceita, setFiltroStatusReceita] = useState("all");

  const [filtroCategoriaCusto, setFiltroCategoriaCusto] = useState("all");
  const [filtroStatusCusto, setFiltroStatusCusto] = useState("all");

  const [filtroStatusBH, setFiltroStatusBH] = useState("all");

  const [filtroTipoServicoExtra, setFiltroTipoServicoExtra] = useState("all");
  const [filtroPipelineStatusExtra, setFiltroPipelineStatusExtra] = useState("all");

  // Helper para abrir Drawer com auditoria do KPI
  const handleOpenKpiDrawer = (data: KpiDrawerInfo) => {
    setKpiDrawerData(data);
    setKpiDrawerOpen(true);
  };

  // Helper para resetar filtros ao trocar de relatório ou pelo botão Limpar
  const resetFiltrosEspecificos = () => {
    setSearchTerm("");
    setTableFilterStatus("all");
    setFiltroTransportadora("all");
    setFiltroServico("all");
    setFiltroStatus("all");
    setFiltroFuncaoDiarista("all");
    setFiltroStatusDiarista("all");
    setFiltroModalidade("all");
    setFiltroStatusReceita("all");
    setFiltroCategoriaCusto("all");
    setFiltroStatusCusto("all");
    setFiltroStatusBH("all");
    setFiltroTipoServicoExtra("all");
    setFiltroPipelineStatusExtra("all");
    setCurrentPage(1);
  };

  const isAnyFilterActive = useMemo(() => {
    return (
      searchTerm.trim() !== "" ||
      tableFilterStatus !== "all" ||
      filtroTransportadora !== "all" ||
      filtroServico !== "all" ||
      filtroStatus !== "all" ||
      filtroFuncaoDiarista !== "all" ||
      filtroStatusDiarista !== "all" ||
      filtroModalidade !== "all" ||
      filtroStatusReceita !== "all" ||
      filtroCategoriaCusto !== "all" ||
      filtroStatusCusto !== "all" ||
      filtroStatusBH !== "all" ||
      filtroTipoServicoExtra !== "all" ||
      filtroPipelineStatusExtra !== "all"
    );
  }, [
    searchTerm,
    tableFilterStatus,
    filtroTransportadora,
    filtroServico,
    filtroStatus,
    filtroFuncaoDiarista,
    filtroStatusDiarista,
    filtroModalidade,
    filtroStatusReceita,
    filtroCategoriaCusto,
    filtroStatusCusto,
    filtroStatusBH,
    filtroTipoServicoExtra,
    filtroPipelineStatusExtra,
  ]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Drawer de Detalhamento / Auditoria (suporta tanto linha quanto KPI)
  const [rowDrawerOpen, setRowDrawerOpen] = useState(false);
  const [selectedRowDetail, setSelectedRowDetail] = useState<any>(null);

  const [kpiDrawerOpen, setKpiDrawerOpen] = useState(false);
  const [kpiDrawerData, setKpiDrawerData] = useState<KpiDrawerInfo | null>(null);

  // Modal Dossiê
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [selectedDossierReports, setSelectedDossierReports] = useState<string[]>([
    "r01-operacoes-volume",
    "r04-custos-extras",
    "r07-servicos-extras",
    "r02-fechamento-diaristas",
    "r05-banco-horas",
    "r03-faturamento-receitas",
  ]);

  // Extração das linhas ativas com filtros
  const { activeRows, filteredRows, paginatedRows, totalPages } = useMemo(() => {
    if (!hubData?.datasets || activeReportId === "dashboard") {
      return { activeRows: [], filteredRows: [], paginatedRows: [], totalPages: 1 };
    }

    let rawRows: any[] = [];
    if (activeReportId === "r01-operacoes-volume") rawRows = hubData.datasets.r01Rows;
    else if (activeReportId === "r02-fechamento-diaristas") rawRows = hubData.datasets.r02Rows;
    else if (activeReportId === "r03-faturamento-receitas") rawRows = hubData.datasets.r03Rows;
    else if (activeReportId === "r04-custos-extras") rawRows = hubData.datasets.r04Rows;
    else if (activeReportId === "r05-banco-horas") rawRows = hubData.datasets.r05Rows;
    else if (activeReportId === "r07-servicos-extras") rawRows = hubData.datasets.r07Rows;

    let filtered = [...rawRows];

    // 1. Filtro por busca textual global do caderno
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return Object.values(row).some((val) =>
          String(val || "").toLowerCase().includes(term)
        );
      });
    }

    // 2. Filtros específicos por tipo de relatório
    if (activeReportId === "r01-operacoes-volume") {
      filtered = filtered.filter((row: OperacaoVolumeRow) => {
        if (filtroTransportadora !== "all" && row.transportadora !== filtroTransportadora) return false;
        if (filtroServico !== "all" && row.tipoServico !== filtroServico) return false;
        if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
        return true;
      });
    } else if (activeReportId === "r02-fechamento-diaristas") {
      filtered = filtered.filter((row: DiaristaFechamentoRow) => {
        if (filtroFuncaoDiarista !== "all" && row.funcao !== filtroFuncaoDiarista) return false;
        if (filtroStatusDiarista !== "all" && row.statusLote !== filtroStatusDiarista) return false;
        return true;
      });
    } else if (activeReportId === "r03-faturamento-receitas") {
      filtered = filtered.filter((row: FaturamentoReceitaRow) => {
        if (filtroModalidade !== "all" && row.modalidade !== filtroModalidade) return false;
        if (filtroStatusReceita !== "all" && row.status !== filtroStatusReceita) return false;
        return true;
      });
    } else if (activeReportId === "r04-custos-extras") {
      filtered = filtered.filter((row: CustoExtraRow) => {
        if (filtroCategoriaCusto !== "all" && row.categoriaCusto !== filtroCategoriaCusto) return false;
        if (filtroStatusCusto !== "all" && row.status !== filtroStatusCusto) return false;
        return true;
      });
    } else if (activeReportId === "r05-banco-horas") {
      filtered = filtered.filter((row: BancoHorasRow) => {
        if (filtroStatusBH !== "all" && row.status !== filtroStatusBH) return false;
        return true;
      });
    } else if (activeReportId === "r07-servicos-extras") {
      filtered = filtered.filter((row: ServicoExtraRow) => {
        if (filtroTipoServicoExtra !== "all" && row.tipoServico !== filtroTipoServicoExtra) return false;
        if (filtroPipelineStatusExtra !== "all" && row.pipelineStatus !== filtroPipelineStatusExtra) return false;
        return true;
      });
    }

    const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const startIdx = (currentPage - 1) * pageSize;
    const paginated = filtered.slice(startIdx, startIdx + pageSize);

    return {
      activeRows: rawRows,
      filteredRows: filtered,
      paginatedRows: paginated,
      totalPages: pages,
    };
  }, [
    hubData,
    activeReportId,
    searchTerm,
    filtroTransportadora,
    filtroServico,
    filtroStatus,
    filtroFuncaoDiarista,
    filtroStatusDiarista,
    filtroModalidade,
    filtroStatusReceita,
    filtroCategoriaCusto,
    filtroStatusCusto,
    filtroStatusBH,
    filtroTipoServicoExtra,
    filtroPipelineStatusExtra,
    currentPage,
  ]);

  // Exportação CSV do caderno ativo
  const handleExportCSV = () => {
    if (!currentReportMeta || activeRows.length === 0) {
      toast.info("Não há dados para exportar neste caderno.");
      return;
    }
    try {
      RelatoriosOficialAdapter.exportReportToCSV(
        currentReportMeta.id,
        filteredRows.length > 0 ? filteredRows : activeRows,
        empresaSelecionada.nome,
        competencia
      );
      toast.success("Documento emitido em CSV", {
        description: `Caderno ${currentReportMeta.code} exportado com sucesso.`,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar CSV");
    }
  };

  // Exportação de Dossiê da Competência
  const handleExportDossier = () => {
    if (!hubData) return;
    try {
      RelatoriosOficialAdapter.exportDossierToCSV({
        empresaNome: empresaSelecionada.nome,
        competencia,
        kpis: hubData.kpis,
        selectedReports: selectedDossierReports,
      });
      toast.success("Dossiê compilado com sucesso", {
        description: `Exportado arquivo consolidado em CSV (UTF-8 BOM).`,
      });
      setIsDossierOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao emitir Dossiê");
    }
  };

  const kpis = hubData?.kpis || {
    totalRegistros: 0,
    relatoriosAtivos: 0,
    volumeOperacional: 0,
    receitasReportadas: 0,
    despesasApuradas: 0,
    diaristasTotal: 0,
    custosExtrasTotal: 0,
    bancoHorasSaldoMinutos: 0,
    bancoHorasAVencerMinutos: 0,
  };

  const counts = hubData?.counts || {};

  // Listas de opções dinâmicas para filtros dos relatórios
  const r01Transportadoras = useMemo(() => {
    if (activeReportId !== "r01-operacoes-volume" || !hubData?.datasets?.r01Rows) return [];
    return Array.from(new Set(hubData.datasets.r01Rows.map((r) => r.transportadora))).filter(Boolean);
  }, [activeReportId, hubData]);

  const r01Servicos = useMemo(() => {
    if (activeReportId !== "r01-operacoes-volume" || !hubData?.datasets?.r01Rows) return [];
    return Array.from(new Set(hubData.datasets.r01Rows.map((r) => r.tipoServico))).filter(Boolean);
  }, [activeReportId, hubData]);

  const r02Funcoes = useMemo(() => {
    if (activeReportId !== "r02-fechamento-diaristas" || !hubData?.datasets?.r02Rows) return [];
    return Array.from(new Set(hubData.datasets.r02Rows.map((r) => r.funcao))).filter(Boolean);
  }, [activeReportId, hubData]);

  const r07Tipos = useMemo(() => {
    if (activeReportId !== "r07-servicos-extras" || !hubData?.datasets?.r07Rows) return [];
    return Array.from(new Set(hubData.datasets.r07Rows.map((r) => r.tipoServico))).filter(Boolean);
  }, [activeReportId, hubData]);

  // Dados para gráficos gerenciais
  const chartDataDominios = useMemo(() => {
    if (!hubData?.infograficos) return [];
    return [
      { name: "Operacional", registros: hubData.infograficos.registrosOperacional, fill: "#10b981" },
      { name: "Pessoas & RH", registros: hubData.infograficos.registrosRH, fill: "#8b5cf6" },
      { name: "Financeiro", registros: hubData.infograficos.registrosFinanceiro, fill: "#3b82f6" },
    ];
  }, [hubData]);

  const chartDataCadernos = useMemo(() => {
    return [
      { code: "R01", nome: "Operações", qtd: counts["r01-operacoes-volume"] || 0 },
      { code: "R04", nome: "Custos", qtd: counts["r04-custos-extras"] || 0 },
      { code: "R07", nome: "Serv. Extras", qtd: counts["r07-servicos-extras"] || 0 },
      { code: "R02", nome: "Diaristas", qtd: counts["r02-fechamento-diaristas"] || 0 },
      { code: "R05", nome: "Banco Horas", qtd: counts["r05-banco-horas"] || 0 },
      { code: "R03", nome: "Receitas", qtd: counts["r03-faturamento-receitas"] || 0 },
    ];
  }, [counts]);

  // =========================================================================
  // CÁLCULO DINÂMICO DOS INDICADORES ANALÍTICOS ESPECÍFICOS DO RELATÓRIO ATIVO
  // (Calculados sobre filteredRows: reagem aos filtros e são imunes à paginação)
  // =========================================================================
  const specificKpis = useMemo(() => {
    if (activeReportId === "dashboard" || !currentReportMeta) return null;

    if (activeReportId === "r01-operacoes-volume") {
      const rows = filteredRows as OperacaoVolumeRow[];
      const totalCargas = rows.length;
      const volumeTotal = rows.reduce((acc, r) => acc + (r.quantidade || 0), 0);
      const totalBruto = rows.reduce((acc, r) => acc + (r.totalBruto || 0), 0);
      const totalMateriais = rows.reduce((acc, r) => acc + (r.materiais || 0), 0);

      return [
        {
          id: "r01-cargas",
          label: "Cargas Totais",
          value: totalCargas.toLocaleString("pt-BR"),
          unit: "cargas",
          subtext: "Operações no filtro",
          icon: Package,
          color: "text-blue-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Cargas Realizadas",
              subtitle: "Operações por Volume no Período",
              metricLabel: "Total de Cargas Filtradas",
              metricValue: `${totalCargas} cargas`,
              description: "Total de registros operacionais de descargas lançados no intervalo temporal filtrado.",
              sourceTable: "operacoes_producao",
              breakdown: [
                { label: "Cargas Filtradas", value: `${totalCargas}` },
                { label: "Unidade Principal", value: rows[0]?.unidade || "Matriz" },
                { label: "Total no Período (sem filtros)", value: `${activeRows.length}` },
              ],
            }),
        },
        {
          id: "r01-volume",
          label: "Volume Físico",
          value: volumeTotal.toLocaleString("pt-BR"),
          unit: "cx",
          subtext: `Média ${Math.round(volumeTotal / (totalCargas || 1))} cx/carga`,
          icon: Boxes,
          color: "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Volume Movimentado",
              subtitle: "Soma de Caixas / Volumes Descarregados",
              metricLabel: "Volume Total Filtrado",
              metricValue: `${volumeTotal.toLocaleString("pt-BR")} cx`,
              description: "Soma consolidada de caixas descarregadas segundo os filtros ativos.",
              sourceTable: "operacoes_producao (quantidade)",
              breakdown: [
                { label: "Volume Filtrado", value: `${volumeTotal.toLocaleString("pt-BR")} cx` },
                { label: "Média por Carga", value: `${Math.round(volumeTotal / (totalCargas || 1))} cx` },
              ],
            }),
        },
        {
          id: "r01-bruto",
          label: "Total Bruto",
          value: formatBRL(totalBruto),
          subtext: "Faturamento operacional",
          icon: Wallet,
          color: "text-indigo-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria do Faturamento Bruto",
              subtitle: "Valor Total das Descargas no Período",
              metricLabel: "Faturamento Bruto Filtrado",
              metricValue: formatBRL(totalBruto),
              description: "Soma do valor total das operações antes de deduções ou retenções de impostos.",
              sourceTable: "operacoes_producao (valor_total)",
              breakdown: [
                { label: "Bruto Filtrado", value: formatBRL(totalBruto) },
                { label: "Insumos (Filme Stretch)", value: formatBRL(totalMateriais) },
              ],
            }),
        },
        {
          id: "r01-materiais",
          label: "Materiais (Insumos)",
          value: formatBRL(totalMateriais),
          subtext: "Filme stretch / insumos",
          icon: Receipt,
          color: "text-amber-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Insumos e Materiais",
              subtitle: "Consumo de Filme Stretch e Suprimentos",
              metricLabel: "Total de Insumos Filtrados",
              metricValue: formatBRL(totalMateriais),
              description: "Total faturado ou apurado em materiais aplicados nas descargas e transbordos.",
              sourceTable: "operacoes_producao (valor_total_materiais)",
              breakdown: [
                { label: "Total Materiais", value: formatBRL(totalMateriais) },
                { label: "Proporção s/ Bruto", value: `${((totalMateriais / (totalBruto || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
      ];
    }

    if (activeReportId === "r02-fechamento-diaristas") {
      const rows = filteredRows as DiaristaFechamentoRow[];
      const totalDiarias = rows.reduce((acc, r) => acc + (r.quantidadeDiarias || 0), 0);
      const totalAPagar = rows.reduce((acc, r) => acc + (r.total || 0), 0);
      const diariaMedia = totalDiarias > 0 ? totalAPagar / totalDiarias : 0;
      const diaristasUnicos = new Set(rows.map((r) => r.colaboradorNome)).size;

      return [
        {
          id: "r02-diarias",
          label: "Total de Diárias",
          value: totalDiarias.toLocaleString("pt-BR"),
          unit: "diárias",
          subtext: `${rows.length} apontamentos`,
          icon: CalendarDays,
          color: "text-purple-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Diárias Apuradas",
              subtitle: "Consolidação de Diárias no Período",
              metricLabel: "Total de Diárias",
              metricValue: `${totalDiarias} diárias`,
              description: "Total consolidado de diárias registradas e aprovadas para o fechamento semanal.",
              sourceTable: "lancamentos_diaristas",
              breakdown: [
                { label: "Diárias Filtradas", value: `${totalDiarias}` },
                { label: "Apontamentos Registrados", value: `${rows.length}` },
              ],
            }),
        },
        {
          id: "r02-total",
          label: "Total a Pagar",
          value: formatBRL(totalAPagar),
          subtext: "Folha de diaristas",
          icon: Wallet,
          color: "text-rose-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Folha de Diaristas",
              subtitle: "Consolidação Financeira a Liquidar",
              metricLabel: "Total a Pagar",
              metricValue: formatBRL(totalAPagar),
              description: "Valor bruto devido aos diaristas nos lotes selecionados.",
              sourceTable: "diaristas_lotes_fechamento + lancamentos_diaristas",
              breakdown: [
                { label: "Total Filtrado", value: formatBRL(totalAPagar) },
                { label: "Valor Médio por Diária", value: formatBRL(diariaMedia) },
              ],
            }),
        },
        {
          id: "r02-media",
          label: "Diária Média",
          value: formatBRL(diariaMedia),
          subtext: "Ticket médio por diária",
          icon: CircleDollarSign,
          color: "text-indigo-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Diária Média",
              subtitle: "Valor Médio Base por Diária Efetiva",
              metricLabel: "Diária Média",
              metricValue: formatBRL(diariaMedia),
              description: "Custo médio apurado por diária individual executada.",
              sourceTable: "lancamentos_diaristas (valor_calculado / quantidade)",
              breakdown: [
                { label: "Média Calculada", value: formatBRL(diariaMedia) },
                { label: "Total Geral", value: formatBRL(totalAPagar) },
              ],
            }),
        },
        {
          id: "r02-headcount",
          label: "Diaristas Únicos",
          value: diaristasUnicos.toLocaleString("pt-BR"),
          unit: "pessoas",
          subtext: "Profissionais ativos",
          icon: UserCheck,
          color: "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Headcount de Diaristas",
              subtitle: "Colaboradores Únicos Ativos no Período",
              metricLabel: "Diaristas Únicos",
              metricValue: `${diaristasUnicos} colaboradores`,
              description: "Quantidade de diaristas distintos com lançamentos no período.",
              sourceTable: "colaboradores (tipo diarista)",
              breakdown: [
                { label: "Headcount Único", value: `${diaristasUnicos}` },
                { label: "Média de Diárias/Diarista", value: `${(totalDiarias / (diaristasUnicos || 1)).toFixed(1)}` },
              ],
            }),
        },
      ];
    }

    if (activeReportId === "r03-faturamento-receitas") {
      const rows = filteredRows as FaturamentoReceitaRow[];
      const totalFaturado = rows.reduce((acc, r) => acc + (r.valorFaturado || 0), 0);
      const liquidado = rows
        .filter((r) => r.status === "conciliado" || r.status === "recebido" || r.status === "pago")
        .reduce((acc, r) => acc + (r.valorFaturado || 0), 0);
      const pendente = rows
        .filter((r) => r.status !== "conciliado" && r.status !== "recebido" && r.status !== "pago")
        .reduce((acc, r) => acc + (r.valorFaturado || 0), 0);
      const ticketMedio = rows.length > 0 ? totalFaturado / rows.length : 0;

      return [
        {
          id: "r03-faturado",
          label: "Receitas Faturadas",
          value: formatBRL(totalFaturado),
          subtext: `${rows.length} títulos faturados`,
          icon: Wallet,
          color: "text-blue-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria do Livro de Receitas",
              subtitle: "Receitas Reconhecidas no Período",
              metricLabel: "Total Faturado",
              metricValue: formatBRL(totalFaturado),
              description: "Total de receitas contratuais emitidas e faturadas para a empresa.",
              sourceTable: "receitas_operacionais",
              breakdown: [
                { label: "Total Faturado", value: formatBRL(totalFaturado) },
                { label: "Títulos Emitidos", value: `${rows.length}` },
              ],
            }),
        },
        {
          id: "r03-liquidado",
          label: "Liquidado / Conciliado",
          value: formatBRL(liquidado),
          subtext: `${totalFaturado > 0 ? ((liquidado / totalFaturado) * 100).toFixed(1) : 0}% recebido`,
          icon: CheckCircle2,
          color: "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Receitas Liquidadas",
              subtitle: "Títulos com Baixa e Conciliação Bancária",
              metricLabel: "Total Liquidado",
              metricValue: formatBRL(liquidado),
              description: "Valores efetivamente compensados e liquidados na conta da transportadora/empresa.",
              sourceTable: "receitas_operacionais (status conciliado/recebido)",
              breakdown: [
                { label: "Total Liquidado", value: formatBRL(liquidado) },
                { label: "Percentual Liquidado", value: `${((liquidado / (totalFaturado || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
        {
          id: "r03-pendente",
          label: "Pendente Recebimento",
          value: formatBRL(pendente),
          subtext: "A receber em carteira",
          icon: Clock,
          color: "text-amber-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Títulos em Aberto",
              subtitle: "Contas a Receber em Carteira",
              metricLabel: "Total Pendente",
              metricValue: formatBRL(pendente),
              description: "Valores faturados aguardando vencimento, liquidação ou conciliação bancária.",
              sourceTable: "receitas_operacionais (status pendente)",
              breakdown: [
                { label: "Total Pendente", value: formatBRL(pendente) },
                { label: "Percentual em Aberto", value: `${((pendente / (totalFaturado || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
        {
          id: "r03-ticket",
          label: "Ticket Médio",
          value: formatBRL(ticketMedio),
          subtext: "Por título faturado",
          icon: TrendingUp,
          color: "text-indigo-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Ticket Médio",
              subtitle: "Valor Médio por Fatura Emitida",
              metricLabel: "Ticket Médio",
              metricValue: formatBRL(ticketMedio),
              description: "Valor médio das notas fiscais e títulos financeiros gerados no período.",
              sourceTable: "receitas_operacionais (valor_faturado / quantidade)",
              breakdown: [
                { label: "Ticket Médio", value: formatBRL(ticketMedio) },
                { label: "Total de Faturas", value: `${rows.length}` },
              ],
            }),
        },
      ];
    }

    if (activeReportId === "r04-custos-extras") {
      const rows = filteredRows as CustoExtraRow[];
      const totalDespesas = rows.reduce((acc, r) => acc + (r.total || 0), 0);
      const pago = rows
        .filter((r) => (r.status || "").toUpperCase() === "PAGO")
        .reduce((acc, r) => acc + (r.total || 0), 0);
      const pendente = rows
        .filter((r) => (r.status || "").toUpperCase() === "PENDENTE" || (r.status || "").toUpperCase() === "ATRASADO")
        .reduce((acc, r) => acc + (r.total || 0), 0);
      const custoMedio = rows.length > 0 ? totalDespesas / rows.length : 0;

      return [
        {
          id: "r04-total",
          label: "Total Despesas",
          value: formatBRL(totalDespesas),
          subtext: `${rows.length} lançamentos`,
          icon: Activity,
          color: "text-rose-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Despesas de Campo",
              subtitle: "Custos Extras e Despesas Operacionais",
              metricLabel: "Total de Despesas",
              metricValue: formatBRL(totalDespesas),
              description: "Soma de despesas operacionais e extraordinárias registradas no campo.",
              sourceTable: "custos_extras_operacionais",
              breakdown: [
                { label: "Total Filtrado", value: formatBRL(totalDespesas) },
                { label: "Lançamentos", value: `${rows.length}` },
              ],
            }),
        },
        {
          id: "r04-pago",
          label: "Pago Liquidado",
          value: formatBRL(pago),
          subtext: "Baixa realizada",
          icon: CheckCircle2,
          color: "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Despesas Pagas",
              subtitle: "Custos já Liquidados ou Reembolsados",
              metricLabel: "Total Liquidado",
              metricValue: formatBRL(pago),
              description: "Custos extras quitados via transferência, caixinha ou reembolso aprovado.",
              sourceTable: "custos_extras_operacionais (status PAGO)",
              breakdown: [
                { label: "Total Pago", value: formatBRL(pago) },
                { label: "Percentual Liquidado", value: `${((pago / (totalDespesas || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
        {
          id: "r04-pendente",
          label: "Pendente / Em Aberto",
          value: formatBRL(pendente),
          subtext: "A liquidar no financeiro",
          icon: AlertTriangle,
          color: "text-amber-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Custos Pendentes",
              subtitle: "Despesas Aguardando Baixa ou Reembolso",
              metricLabel: "Total Pendente",
              metricValue: formatBRL(pendente),
              description: "Custos extras em validação operacional ou pendentes de quitação financeira.",
              sourceTable: "custos_extras_operacionais (status PENDENTE)",
              breakdown: [
                { label: "Total Pendente", value: formatBRL(pendente) },
                { label: "Percentual Pendente", value: `${((pendente / (totalDespesas || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
        {
          id: "r04-medio",
          label: "Custo Médio",
          value: formatBRL(custoMedio),
          subtext: "Por despesa lançada",
          icon: CircleDollarSign,
          color: "text-indigo-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Custo Médio",
              subtitle: "Valor Médio por Despesa Lançada",
              metricLabel: "Custo Médio",
              metricValue: formatBRL(custoMedio),
              description: "Média aritmética das despesas de campo registradas.",
              sourceTable: "custos_extras_operacionais (total / quantidade)",
              breakdown: [
                { label: "Custo Médio", value: formatBRL(custoMedio) },
                { label: "Total de Lançamentos", value: `${rows.length}` },
              ],
            }),
        },
      ];
    }

    if (activeReportId === "r05-banco-horas") {
      const rows = filteredRows as BancoHorasRow[];
      const saldoTotal = rows.reduce((acc, r) => acc + (r.saldoMinutos || 0), 0);
      const creditosTotal = rows.reduce((acc, r) => acc + (r.creditosMinutos || 0), 0);
      const debitosTotal = rows.reduce((acc, r) => acc + (r.debitosMinutos || 0), 0);
      const aVencerTotal = rows.reduce((acc, r) => acc + (r.aVencer30dMinutos || 0), 0);

      return [
        {
          id: "r05-saldo",
          label: "Saldo Líquido",
          value: formatMinutosToHourString(saldoTotal),
          subtext: `${rows.length} colaboradores CLT`,
          icon: Clock,
          color: saldoTotal < 0 ? "text-rose-500" : "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Saldo de Banco de Horas",
              subtitle: "Balanço Líquido Acumulado CLT",
              metricLabel: "Saldo Líquido",
              metricValue: formatMinutosToHourString(saldoTotal),
              description: "Balanço temporal líquido acumulado entre horas positivas e horas negativas dos colaboradores CLT.",
              sourceTable: "banco_horas_saldos",
              breakdown: [
                { label: "Saldo Líquido", value: formatMinutosToHourString(saldoTotal) },
                { label: "Colaboradores Filtrados", value: `${rows.length}` },
              ],
            }),
        },
        {
          id: "r05-creditos",
          label: "Créditos Acumulados",
          value: formatMinutosToHourString(creditosTotal),
          subtext: "Horas positivas apuradas",
          icon: TrendingUp,
          color: "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Créditos de Horas",
              subtitle: "Horas Positivas Acumuladas no Banco",
              metricLabel: "Total de Créditos",
              metricValue: formatMinutosToHourString(creditosTotal),
              description: "Total de horas extras creditadas em banco de horas e ainda não compensadas.",
              sourceTable: "banco_horas_saldos (horas_positivas)",
              breakdown: [
                { label: "Créditos Acumulados", value: formatMinutosToHourString(creditosTotal) },
              ],
            }),
        },
        {
          id: "r05-debitos",
          label: "Débitos Acumulados",
          value: formatMinutosToHourString(debitosTotal),
          subtext: "Atrasos e ausências",
          icon: AlertTriangle,
          color: "text-rose-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Débitos de Horas",
              subtitle: "Horas Negativas a Compensar",
              metricLabel: "Total de Débitos",
              metricValue: formatMinutosToHourString(debitosTotal),
              description: "Total de atrasos e faltas que debitaram saldo de banco de horas.",
              sourceTable: "banco_horas_saldos (horas_negativas)",
              breakdown: [
                { label: "Débitos Acumulados", value: formatMinutosToHourString(debitosTotal) },
              ],
            }),
        },
        {
          id: "r05-vencer",
          label: "A Vencer (Janela 30d)",
          value: formatMinutosToHourString(aVencerTotal),
          subtext: "Risco de prescrição",
          icon: Calendar,
          color: "text-amber-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Horas a Vencer",
              subtitle: "Eventos Próximos da Validade Limite",
              metricLabel: "Horas a Vencer (30d)",
              metricValue: formatMinutosToHourString(aVencerTotal),
              description: "Horas positivas acumuladas cujo prazo contratual de compensação expira nos próximos 30 dias.",
              sourceTable: "banco_horas_eventos (data_vencimento <= 30d)",
              breakdown: [
                { label: "Horas a Vencer (30d)", value: formatMinutosToHourString(aVencerTotal) },
              ],
            }),
        },
      ];
    }

    if (activeReportId === "r07-servicos-extras") {
      const rows = filteredRows as ServicoExtraRow[];
      const volumeServicos = rows.reduce((acc, r) => acc + (r.quantidade || 0), 0);
      const totalBruto = rows.reduce((acc, r) => acc + (r.total || 0), 0);
      const concluidos = rows.filter((r) => r.pipelineStatus === "CONCLUIDO" || r.pipelineStatus === "FATURADO").length;
      const emAberto = rows.filter((r) => r.pipelineStatus !== "CONCLUIDO" && r.pipelineStatus !== "FATURADO").length;

      return [
        {
          id: "r07-volume",
          label: "Volume de Serviços",
          value: volumeServicos.toLocaleString("pt-BR"),
          unit: "un",
          subtext: `${rows.length} apontamentos`,
          icon: Layers,
          color: "text-sky-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Volume de Serviços Extras",
              subtitle: "Quantidade Física de Serviços Extras",
              metricLabel: "Volume Total",
              metricValue: `${volumeServicos.toLocaleString("pt-BR")} un`,
              description: "Total de unidades de serviços extraordinários executados no período.",
              sourceTable: "servicos_extras_operacionais (quantidade)",
              breakdown: [
                { label: "Volume Total", value: `${volumeServicos.toLocaleString("pt-BR")} un` },
                { label: "Apontamentos", value: `${rows.length}` },
              ],
            }),
        },
        {
          id: "r07-faturamento",
          label: "Faturamento Bruto",
          value: formatBRL(totalBruto),
          subtext: "Receita extraordinária",
          icon: Wallet,
          color: "text-blue-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Faturamento de Serviços Extras",
              subtitle: "Receitas Extras Apuradas no Período",
              metricLabel: "Total Faturado",
              metricValue: formatBRL(totalBruto),
              description: "Total apurado com transbordos, enlonamentos e serviços avulsos.",
              sourceTable: "servicos_extras_operacionais (total)",
              breakdown: [
                { label: "Faturamento Filtrado", value: formatBRL(totalBruto) },
                { label: "Ticket Médio", value: formatBRL(totalBruto / (rows.length || 1)) },
              ],
            }),
        },
        {
          id: "r07-concluidos",
          label: "Concluídos / Faturados",
          value: concluidos.toLocaleString("pt-BR"),
          unit: "serviços",
          subtext: "Pipeline finalizado",
          icon: CheckCircle2,
          color: "text-emerald-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Pipeline Concluído",
              subtitle: "Serviços com Ciclo Operacional Finalizado",
              metricLabel: "Serviços Concluídos",
              metricValue: `${concluidos} serviços`,
              description: "Serviços extras aprovados e encaminhados para faturamento ou já concluídos.",
              sourceTable: "servicos_extras_operacionais (pipeline_status CONCLUIDO/FATURADO)",
              breakdown: [
                { label: "Concluídos", value: `${concluidos}` },
                { label: "Percentual", value: `${((concluidos / (rows.length || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
        {
          id: "r07-aberto",
          label: "Em Aberto / Validação",
          value: emAberto.toLocaleString("pt-BR"),
          unit: "serviços",
          subtext: "Aguardando aprovação",
          icon: Clock,
          color: "text-amber-500",
          onOpenDrawer: () => handleOpenKpiDrawer({
              title: "Auditoria de Pipeline em Aberto",
              subtitle: "Serviços Pendentes de Aprovação ou Faturamento",
              metricLabel: "Serviços em Aberto",
              metricValue: `${emAberto} serviços`,
              description: "Serviços extras lançados aguardando validação de campo ou aprovação financeira.",
              sourceTable: "servicos_extras_operacionais (pipeline_status pendente/validação)",
              breakdown: [
                { label: "Em Aberto", value: `${emAberto}` },
                { label: "Percentual", value: `${((emAberto / (rows.length || 1)) * 100).toFixed(1)}%` },
              ],
            }),
        },
      ];
    }

    return null;
  }, [activeReportId, currentReportMeta, filteredRows, activeRows]);

  return (
    <AppShell
      title="Central de Relatórios v2.0"
      subtitle="Cockpit analítico unificado, navegação integrada e inteligência operacional"
    >
      <div className="space-y-4 pb-16">
        {/* BARRA SUPERIOR DE COMANDOS */}
        <header className="rounded-xl border border-border/80 bg-card p-3 shadow-xs backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Empresa Selector */}
            <div className="w-56">
              <Select value={empresaId} onValueChange={handleEmpresaChange} disabled={isLoadingEmpresas}>
                <SelectTrigger className="h-8.5 text-xs bg-background/60 font-medium">
                  <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent>
                  {empresasCadastradas.map((e: any) => (
                    <SelectItem key={e.id} value={e.id} className="text-xs">
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Competência Selector */}
            <div className="w-52">
              <Select value={competencia} onValueChange={handleCompetenciaChange}>
                <SelectTrigger className="h-8.5 text-xs bg-background/60 font-medium">
                  <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPETENCIAS_DISPONIVEIS.map((c) => (
                    <SelectItem key={c.value} value={c.value} className="text-xs">
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Badge variant="outline" className="h-8 text-[11px] gap-1 px-2.5 font-normal bg-muted/40 border-border/60">
              <Sparkles className="h-3 w-3 text-primary animate-pulse" />
              Arquitetura Híbrida 2.0
            </Badge>
          </div>

          {/* Ações Globais */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8.5 text-xs font-semibold gap-1.5"
              onClick={() => setIsDossierOpen(true)}
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              Dossiê Consolidado
            </Button>

            <FerramentasContabeisMenu />

            <Button
              variant="ghost"
              size="sm"
              className="h-8.5 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => navigate(`/relatorios/classico?empresa=${empresaId}&competencia=${competencia}`)}
              title="Alternar para a visualização clássica em cards"
            >
              <RotateCcw className="h-3 w-3" />
              Visão Clássica
            </Button>
          </div>
        </header>

        {/* ESTRUTURA HÍBRIDA SPLIT: SUB-SIDEBAR + WORKSPACE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* ======================================================== */}
          {/* SUB-SIDEBAR NAVEGÁVEL POR RELATÓRIOS (COLUNA ESQUERDA)   */}
          {/* ======================================================== */}
          <aside className="lg:col-span-3 rounded-xl border border-border/80 bg-card p-3 shadow-xs space-y-3 sticky top-4">
            <div className="px-2 py-1 flex items-center justify-between text-xs border-b border-border/40 pb-2">
              <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                Navegação Analítica
              </span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold">
                {kpis.totalRegistros} reg.
              </Badge>
            </div>

            {/* Item 0: Visão Geral / Dashboard */}
            <button
              onClick={() => handleSelectNav("dashboard")}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-between transition-all ${
                activeReportId === "dashboard"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-foreground hover:bg-muted/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                <span>Dashboard Gerencial</span>
              </div>
              <ChevronRight className={`h-3.5 w-3.5 ${activeReportId === "dashboard" ? "opacity-100" : "opacity-40"}`} />
            </button>

            {/* GRUPO 1: OPERACIONAL */}
            <div className="space-y-1 pt-1">
              <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Operacional
              </div>

              {/* R01 */}
              <button
                onClick={() => handleSelectNav("r01-operacoes-volume")}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                  activeReportId === "r01-operacoes-volume"
                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    R01
                  </Badge>
                  <span className="truncate">Operações por Volume</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {counts["r01-operacoes-volume"] ?? 0}
                </span>
              </button>

              {/* R04 */}
              <button
                onClick={() => handleSelectNav("r04-custos-extras")}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                  activeReportId === "r04-custos-extras"
                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-amber-500/30 text-amber-600 dark:text-amber-400">
                    R04
                  </Badge>
                  <span className="truncate">Custos Extras</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {counts["r04-custos-extras"] ?? 0}
                </span>
              </button>

              {/* R07 */}
              <button
                onClick={() => handleSelectNav("r07-servicos-extras")}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                  activeReportId === "r07-servicos-extras"
                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-sky-500/30 text-sky-600 dark:text-sky-400">
                    R07
                  </Badge>
                  <span className="truncate">Serviços Extras</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {counts["r07-servicos-extras"] ?? 0}
                </span>
              </button>

              {/* R06 (Bloqueado) */}
              <button
                onClick={() => handleSelectNav("r06-produtividade-individual")}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/30"
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 opacity-50">
                    R06
                  </Badge>
                  <span className="truncate italic">Produtividade</span>
                </div>
                <Lock className="h-3 w-3 opacity-60" />
              </button>
            </div>

            {/* GRUPO 2: PESSOAS & RH */}
            <div className="space-y-1 pt-1">
              <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Pessoas & RH
              </div>

              {/* R02 */}
              <button
                onClick={() => handleSelectNav("r02-fechamento-diaristas")}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                  activeReportId === "r02-fechamento-diaristas"
                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-purple-500/30 text-purple-600 dark:text-purple-400">
                    R02
                  </Badge>
                  <span className="truncate">Fechamento Diaristas</span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {counts["r02-fechamento-diaristas"] ?? 0}
                </span>
              </button>

              {/* R05 */}
              <button
                onClick={() => handleSelectNav("r05-banco-horas")}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                  activeReportId === "r05-banco-horas"
                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-indigo-500/30 text-indigo-600 dark:text-indigo-400">
                    R05
                  </Badge>
                  <span className="truncate">Banco de Horas CLT</span>
                </div>
                {!checkReportAccess("r05-banco-horas", role) ? (
                  <Lock className="h-3 w-3 text-muted-foreground/60" />
                ) : (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {counts["r05-banco-horas"] ?? 0}
                  </span>
                )}
              </button>
            </div>

            {/* GRUPO 3: FINANCEIRO & FATURAMENTO */}
            <div className="space-y-1 pt-1">
              <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                Financeiro
              </div>

              {/* R03 */}
              <button
                onClick={() => handleSelectNav("r03-faturamento-receitas")}
                className={`w-full text-left px-2.5 py-2 rounded-lg text-xs flex items-center justify-between transition-all ${
                  activeReportId === "r03-faturamento-receitas"
                    ? "bg-primary/10 text-primary font-bold border border-primary/30"
                    : "text-foreground hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 border-blue-500/30 text-blue-600 dark:text-blue-400">
                    R03
                  </Badge>
                  <span className="truncate">Faturamento & Receitas</span>
                </div>
                {!checkReportAccess("r03-faturamento-receitas", role) ? (
                  <Lock className="h-3 w-3 text-muted-foreground/60" />
                ) : (
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {counts["r03-faturamento-receitas"] ?? 0}
                  </span>
                )}
              </button>
            </div>

            {/* RODAPÉ DA SIDEBAR: STATUS DE PERFIL */}
            <div className="pt-3 border-t border-border/40 text-[11px] text-muted-foreground flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                <span>Perfil: <strong className="text-foreground uppercase">{role || "Admin"}</strong></span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground/80">{competencia}</span>
            </div>
          </aside>

          {/* ======================================================== */}
          {/* ÁREA DE TRABALHO PRINCIPAL (COLUNA DIREITA)              */}
          {/* ======================================================== */}
          <main className="lg:col-span-9 space-y-4">
            {/* CENÁRIO 1: DASHBOARD GERENCIAL (VISÃO GERAL) */}
            {activeReportId === "dashboard" && (
              <div className="space-y-4">
                {/* 4 KPIS OFICIAIS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* KPI 1 */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">Volume Operacional</span>
                      <Package className="h-4 w-4 text-emerald-500" />
                    </div>
                    {isLoadingHub ? (
                      <Skeleton className="h-7 w-24 my-1" />
                    ) : (
                      <div className="text-2xl font-black text-foreground tracking-tight">
                        {kpis.volumeOperacional.toLocaleString("pt-BR")}
                        <span className="text-xs font-semibold text-muted-foreground ml-1">unid.</span>
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
                      <span>R01 · Descargas</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Ativo</span>
                    </div>
                  </div>

                  {/* KPI 2 */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">Receitas Reconhecidas</span>
                      <Wallet className="h-4 w-4 text-blue-500" />
                    </div>
                    {isLoadingHub ? (
                      <Skeleton className="h-7 w-28 my-1" />
                    ) : checkReportAccess("r03-faturamento-receitas", role) ? (
                      <div className="text-2xl font-black text-foreground tracking-tight">
                        {formatBRL(kpis.receitasReportadas)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground my-2">
                        <Lock className="h-3.5 w-3.5" /> Acesso Financeiro
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
                      <span>R03 · Faturamento</span>
                      <span className="font-semibold text-blue-600 dark:text-blue-400">Oficial</span>
                    </div>
                  </div>

                  {/* KPI 3 */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">Despesas de Campo</span>
                      <Activity className="h-4 w-4 text-rose-500" />
                    </div>
                    {isLoadingHub ? (
                      <Skeleton className="h-7 w-28 my-1" />
                    ) : (
                      <div className="text-2xl font-black text-foreground tracking-tight">
                        {formatBRL(kpis.despesasApuradas)}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
                      <span>Diaristas + Custos</span>
                      <span className="font-mono text-foreground font-semibold">{counts["r02-fechamento-diaristas"] || 0} lotes</span>
                    </div>
                  </div>

                  {/* KPI 4 */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase">Banco de Horas (CLT)</span>
                      <Clock className="h-4 w-4 text-indigo-500" />
                    </div>
                    {isLoadingHub ? (
                      <Skeleton className="h-7 w-24 my-1" />
                    ) : checkReportAccess("r05-banco-horas", role) ? (
                      <div className="text-2xl font-black text-foreground tracking-tight">
                        {formatMinutosToHourString(kpis.bancoHorasSaldoMinutos)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground my-2">
                        <Lock className="h-3.5 w-3.5" /> Acesso RH
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground flex justify-between mt-1">
                      <span>Saldo Líquido</span>
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">Tempo</span>
                    </div>
                  </div>
                </div>

                {/* GRÁFICOS RECHARTS GERENCIAIS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gráfico 1: Volume de Registros por Caderno */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">Distribuição de Lançamentos</h4>
                        <p className="text-[11px] text-muted-foreground">Volume de registros por caderno oficial</p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {kpis.totalRegistros} total
                      </Badge>
                    </div>

                    <div className="h-56 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartDataCadernos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                          <XAxis dataKey="code" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: "12px", borderRadius: "8px" }}
                            formatter={(val: any, _name: any, item: any) => [`${val} registros`, item.payload.nome]}
                          />
                          <Bar dataKey="qtd" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Gráfico 2: Composição por Domínio */}
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="text-xs font-bold text-foreground">Composição por Domínio</h4>
                        <p className="text-[11px] text-muted-foreground">Proporção Operacional vs RH vs Financeiro</p>
                      </div>
                      <span className="text-[11px] font-mono text-muted-foreground">{competencia}</span>
                    </div>

                    <div className="h-56 w-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartDataDominios}
                            dataKey="registros"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={4}
                          >
                            {chartDataDominios.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", fontSize: "12px", borderRadius: "8px" }}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* TABELA DE ACESSO RÁPIDO AOS CADERNOS DOCUMENTAIS */}
                <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Cadernos Documentais Homologados</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Clique em um caderno para abrir o visualizador analítico integrado
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {RELATORIOS_CATALOGO_OFICIAL.map((report) => {
                      const count = counts[report.id] || 0;
                      const allowed = checkReportAccess(report.id, role);

                      return (
                        <div
                          key={report.id}
                          onClick={() => {
                            if (allowed) handleSelectNav(report.id);
                          }}
                          className={`rounded-lg border p-3 flex flex-col justify-between transition-all ${
                            allowed
                              ? "border-border/60 hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
                              : "border-border/30 opacity-60 cursor-not-allowed bg-muted/10"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <Badge variant="outline" className="font-mono text-[10px] font-bold">
                                {report.code}
                              </Badge>
                              {!allowed ? (
                                <Badge variant="secondary" className="text-[9px] gap-1 py-0">
                                  <Lock className="h-2.5 w-2.5" /> Restrito
                                </Badge>
                              ) : (
                                <span className="text-[11px] font-mono text-muted-foreground">
                                  {count} reg.
                                </span>
                              )}
                            </div>
                            <h5 className="text-xs font-bold text-foreground line-clamp-1">{report.title}</h5>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                              {report.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                              {report.category}
                            </span>
                            <span className="font-semibold text-primary flex items-center text-xs">
                              Abrir <ChevronRight className="h-3 w-3 ml-0.5" />
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* CENÁRIO 2: CADERNO BLOQUEADO (R06 OU PAPEL NÃO AUTORIZADO) */}
            {activeReportId !== "dashboard" && !isCurrentReportAllowed && (
              <div className="rounded-xl border border-destructive/30 bg-card p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <Lock className="h-6 w-6" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {activeReportId.includes("r06") ? "Caderno em Homologação (Bloqueado)" : "Acesso Restrito ao Caderno"}
                </h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {activeReportId.includes("r06")
                    ? "O caderno R06 (Produtividade Individual) permanece estritamente bloqueado até a homologação canônica das regras de rateio e confidencialidade operacional."
                    : `O seu perfil atual (${role || "Usuário"}) não possui autorização de governança para visualizar este caderno documental.`}
                </p>
                <div className="pt-2">
                  <Button variant="outline" size="sm" onClick={() => handleSelectNav("dashboard")} className="text-xs">
                    Voltar para o Dashboard
                  </Button>
                </div>
              </div>
            )}

            {/* CENÁRIO 3: VISUALIZADOR ANALÍTICO INTEGRADO DO CADERNO */}
            {activeReportId !== "dashboard" && isCurrentReportAllowed && currentReportMeta && (
              <div className="space-y-4">
                {/* ========================================================================= */}
                {/* FAIXA DE INDICADORES ESPECÍFICOS DO RELATÓRIO ATIVO (RESTAURADOS)        */}
                {/* ========================================================================= */}
                {specificKpis && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {specificKpis.map((kpi) => {
                      const IconComp = kpi.icon;
                      return (
                        <div
                          key={kpi.id}
                          role="button"
                          tabIndex={0}
                          onClick={kpi.onOpenDrawer}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              kpi.onOpenDrawer();
                            }
                          }}
                          className="rounded-xl border border-border/80 bg-card p-3.5 shadow-xs hover:border-primary/50 hover:bg-muted/20 transition-all cursor-pointer group flex flex-col justify-between focus:outline-none focus:ring-2 focus:ring-primary/40"
                          title="Clique para auditar detalhamento e regras de cálculo deste indicador"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {kpi.label}
                              </span>
                              <div className="flex items-center gap-1">
                                <IconComp className={`h-3.5 w-3.5 ${kpi.color}`} />
                                <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                            <div className="text-xl font-black text-foreground tracking-tight font-mono">
                              {kpi.value}
                              {kpi.unit && (
                                <span className="text-xs font-normal text-muted-foreground ml-1">
                                  {kpi.unit}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground flex items-center justify-between">
                            <span>{kpi.subtext}</span>
                            <span className="text-primary font-semibold group-hover:underline">Auditar</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* PAINEL DA TABELA COM FILTROS E AÇÕES */}
                <div className="rounded-xl border border-border/80 bg-card shadow-xs overflow-hidden">
                  {/* CABEÇALHO DO RELATÓRIO INTEGRADO */}
                  <div className="p-4 border-b border-border/60 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="font-mono font-bold text-xs bg-primary/10 text-primary border-primary/30">
                          {currentReportMeta.code}
                        </Badge>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {currentReportMeta.category}
                        </span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="text-xs font-semibold text-foreground">{empresaSelecionada.nome}</span>
                      </div>
                      <h3 className="text-base font-bold text-foreground">{currentReportMeta.title}</h3>
                      <p className="text-xs text-muted-foreground">{currentReportMeta.description}</p>
                    </div>

                    {/* Ações do Caderno */}
                    <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={handleExportCSV}
                        disabled={activeRows.length === 0}
                      >
                        <Download className="h-3.5 w-3.5" />
                        Exportar CSV
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() => window.print()}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Imprimir
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 text-xs gap-1.5"
                        onClick={() =>
                          navigate(
                            `/relatorios/${currentReportMeta.id}?empresa=${empresaId}&competencia=${competencia}`
                          )
                        }
                        title="Abrir no visualizador de página inteira"
                      >
                        <Maximize2 className="h-3.5 w-3.5" />
                        Tela Cheia
                      </Button>
                    </div>
                  </div>

                  {/* BARRA DE FILTROS E BUSCA DO CADERNO */}
                  <div className="p-3 border-b border-border/60 bg-background/50 flex flex-wrap items-center justify-between gap-2.5">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                      {/* Campo de Busca Rápida */}
                      <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Buscar registros..."
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                          }}
                          className="h-8 pl-8 text-xs bg-background"
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* FILTROS ESPECÍFICOS R01 */}
                      {activeReportId === "r01-operacoes-volume" && (
                        <>
                          <Select
                            value={filtroTransportadora}
                            onValueChange={(val) => {
                              setFiltroTransportadora(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[170px] bg-background">
                              <SelectValue placeholder="Transportadora" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todas as Transportadoras</SelectItem>
                              {r01Transportadoras.map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filtroServico}
                            onValueChange={(val) => {
                              setFiltroServico(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[150px] bg-background">
                              <SelectValue placeholder="Serviço" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Serviços</SelectItem>
                              {r01Servicos.map((s) => (
                                <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filtroStatus}
                            onValueChange={(val) => {
                              setFiltroStatus(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                              <SelectItem value="CONCLUIDO" className="text-xs">Concluído</SelectItem>
                              <SelectItem value="FATURADO" className="text-xs">Faturado</SelectItem>
                              <SelectItem value="AGUARDANDO_FATURAMENTO" className="text-xs">Aguard. Faturamento</SelectItem>
                              <SelectItem value="EM_VALIDACAO" className="text-xs">Em Validação</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      {/* FILTROS ESPECÍFICOS R02 */}
                      {activeReportId === "r02-fechamento-diaristas" && (
                        <>
                          <Select
                            value={filtroFuncaoDiarista}
                            onValueChange={(val) => {
                              setFiltroFuncaoDiarista(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                              <SelectValue placeholder="Função" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todas as Funções</SelectItem>
                              {r02Funcoes.map((f) => (
                                <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filtroStatusDiarista}
                            onValueChange={(val) => {
                              setFiltroStatusDiarista(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[150px] bg-background">
                              <SelectValue placeholder="Status Lote" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                              <SelectItem value="pago" className="text-xs">Pago</SelectItem>
                              <SelectItem value="enviado_financeiro" className="text-xs">Enviado Financeiro</SelectItem>
                              <SelectItem value="fechado_para_pagamento" className="text-xs">Fechado p/ Pgto</SelectItem>
                              <SelectItem value="em_aberto" className="text-xs">Em Aberto</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      {/* FILTROS ESPECÍFICOS R03 */}
                      {activeReportId === "r03-faturamento-receitas" && (
                        <>
                          <Select
                            value={filtroModalidade}
                            onValueChange={(val) => {
                              setFiltroModalidade(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                              <SelectValue placeholder="Modalidade" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todas as Modalidades</SelectItem>
                              <SelectItem value="FATURAMENTO_MENSAL" className="text-xs">Faturamento Mensal</SelectItem>
                              <SelectItem value="DUPLICATA" className="text-xs">Duplicata</SelectItem>
                              <SelectItem value="CAIXA_IMEDIATO" className="text-xs">Caixa Imediato</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={filtroStatusReceita}
                            onValueChange={(val) => {
                              setFiltroStatusReceita(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                              <SelectValue placeholder="Status Financeiro" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                              <SelectItem value="conciliado" className="text-xs">Conciliado</SelectItem>
                              <SelectItem value="recebido" className="text-xs">Recebido</SelectItem>
                              <SelectItem value="cobranca_enviada" className="text-xs">Cobrança Enviada</SelectItem>
                              <SelectItem value="pendente_cobranca" className="text-xs">Pendente Cobrança</SelectItem>
                              <SelectItem value="aguardando_fechamento" className="text-xs">Aguardando Fechamento</SelectItem>
                              <SelectItem value="pendente_recebimento" className="text-xs">Pendente Recebimento</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      {/* FILTROS ESPECÍFICOS R04 */}
                      {activeReportId === "r04-custos-extras" && (
                        <>
                          <Select
                            value={filtroCategoriaCusto}
                            onValueChange={(val) => {
                              setFiltroCategoriaCusto(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                              <SelectValue placeholder="Categoria" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todas as Categorias</SelectItem>
                              <SelectItem value="MERENDA" className="text-xs">Merenda / Lanche</SelectItem>
                              <SelectItem value="OPERACIONAL" className="text-xs">Operacional</SelectItem>
                              <SelectItem value="ADMINISTRATIVO" className="text-xs">Administrativo</SelectItem>
                              <SelectItem value="FORNECEDOR" className="text-xs">Fornecedor</SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={filtroStatusCusto}
                            onValueChange={(val) => {
                              setFiltroStatusCusto(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[140px] bg-background">
                              <SelectValue placeholder="Status Pgto" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                              <SelectItem value="PAGO" className="text-xs">Pago</SelectItem>
                              <SelectItem value="PENDENTE" className="text-xs">Pendente</SelectItem>
                              <SelectItem value="ATRASADO" className="text-xs">Atrasado</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      {/* FILTROS ESPECÍFICOS R05 */}
                      {activeReportId === "r05-banco-horas" && (
                        <Select
                          value={filtroStatusBH}
                          onValueChange={(val) => {
                            setFiltroStatusBH(val);
                            setCurrentPage(1);
                          }}
                        >
                          <SelectTrigger className="h-8 text-xs w-[170px] bg-background">
                            <SelectValue placeholder="Situação Banco de Horas" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all" className="text-xs">Todas as Situações</SelectItem>
                            <SelectItem value="A Vencer" className="text-xs">A Vencer (Janela 30d)</SelectItem>
                            <SelectItem value="Débito Crítico" className="text-xs">Débito Crítico</SelectItem>
                            <SelectItem value="Saldo Positivo" className="text-xs">Saldo Positivo</SelectItem>
                            <SelectItem value="OK" className="text-xs">Regular / OK</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {/* FILTROS ESPECÍFICOS R07 */}
                      {activeReportId === "r07-servicos-extras" && (
                        <>
                          <Select
                            value={filtroTipoServicoExtra}
                            onValueChange={(val) => {
                              setFiltroTipoServicoExtra(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                              <SelectValue placeholder="Tipo de Serviço" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Serviços</SelectItem>
                              {r07Tipos.map((t) => (
                                <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>

                          <Select
                            value={filtroPipelineStatusExtra}
                            onValueChange={(val) => {
                              setFiltroPipelineStatusExtra(val);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs w-[160px] bg-background">
                              <SelectValue placeholder="Status Pipeline" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                              <SelectItem value="PENDENTE" className="text-xs">Pendente</SelectItem>
                              <SelectItem value="EM_VALIDACAO" className="text-xs">Em Validação</SelectItem>
                              <SelectItem value="APROVADO_OPERACAO" className="text-xs">Aprovado Operação</SelectItem>
                              <SelectItem value="APROVADO_FINANCEIRO" className="text-xs">Aprovado Financeiro</SelectItem>
                              <SelectItem value="FATURADO" className="text-xs">Faturado</SelectItem>
                              <SelectItem value="CONCLUIDO" className="text-xs">Concluído</SelectItem>
                            </SelectContent>
                          </Select>
                        </>
                      )}

                      {/* Botão Limpar Filtros quando ativo */}
                      {isAnyFilterActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={resetFiltrosEspecificos}
                          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                          title="Restaurar todos os filtros para o padrão"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Limpar
                        </Button>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      <span>
                        Exibindo <strong>{filteredRows.length}</strong> de {activeRows.length} registros
                      </span>
                    </div>
                  </div>

                  {/* TABELA ANALÍTICA DINÂMICA */}
                  <div className="overflow-x-auto">
                    {paginatedRows.length === 0 ? (
                      <div className="py-12 text-center text-xs text-muted-foreground">
                        Nenhum registro encontrado para os filtros selecionados na competência {competencia}.
                      </div>
                    ) : (
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-border/60 bg-muted/30 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            {/* HEADERS ESPECÍFICOS POR CADERNO */}
                            {activeReportId === "r01-operacoes-volume" && (
                              <>
                                <th className="py-2.5 px-3">Data</th>
                                <th className="py-2.5 px-3">Código</th>
                                <th className="py-2.5 px-3">Transportadora</th>
                                <th className="py-2.5 px-3">Serviço / Carga</th>
                                <th className="py-2.5 px-3 text-right">Qtd</th>
                                <th className="py-2.5 px-3 text-right">Total Bruto</th>
                                <th className="py-2.5 px-3">Placa / NF</th>
                                <th className="py-2.5 px-3">Status</th>
                              </>
                            )}

                            {activeReportId === "r02-fechamento-diaristas" && (
                              <>
                                <th className="py-2.5 px-3">Data</th>
                                <th className="py-2.5 px-3">Colaborador</th>
                                <th className="py-2.5 px-3">CPF</th>
                                <th className="py-2.5 px-3">Função</th>
                                <th className="py-2.5 px-3 text-center">Diárias</th>
                                <th className="py-2.5 px-3 text-right">Valor Diária</th>
                                <th className="py-2.5 px-3 text-right">Total</th>
                                <th className="py-2.5 px-3">Status Lote</th>
                              </>
                            )}

                            {activeReportId === "r03-faturamento-receitas" && (
                              <>
                                <th className="py-2.5 px-3">Competência</th>
                                <th className="py-2.5 px-3">Cliente</th>
                                <th className="py-2.5 px-3">Modalidade</th>
                                <th className="py-2.5 px-3">Origem</th>
                                <th className="py-2.5 px-3 text-right">Valor Faturado</th>
                                <th className="py-2.5 px-3">Vencimento</th>
                                <th className="py-2.5 px-3">Status</th>
                                <th className="py-2.5 px-3">Situação</th>
                              </>
                            )}

                            {activeReportId === "r04-custos-extras" && (
                              <>
                                <th className="py-2.5 px-3">Data</th>
                                <th className="py-2.5 px-3">Categoria</th>
                                <th className="py-2.5 px-3">Descrição</th>
                                <th className="py-2.5 px-3">Favorecido</th>
                                <th className="py-2.5 px-3 text-right">Valor</th>
                                <th className="py-2.5 px-3">Origem</th>
                                <th className="py-2.5 px-3">Status Pagamento</th>
                              </>
                            )}

                            {activeReportId === "r05-banco-horas" && (
                              <>
                                <th className="py-2.5 px-3">Matrícula</th>
                                <th className="py-2.5 px-3">Colaborador</th>
                                <th className="py-2.5 px-3 text-right">Saldo Líquido</th>
                                <th className="py-2.5 px-3 text-right">Créditos</th>
                                <th className="py-2.5 px-3 text-right">Débitos</th>
                                <th className="py-2.5 px-3 text-right">A Vencer (30d)</th>
                                <th className="py-2.5 px-3">Situação</th>
                              </>
                            )}

                            {activeReportId === "r07-servicos-extras" && (
                              <>
                                <th className="py-2.5 px-3">Data</th>
                                <th className="py-2.5 px-3">Tipo Serviço</th>
                                <th className="py-2.5 px-3">Tomador</th>
                                <th className="py-2.5 px-3 text-right">Qtd</th>
                                <th className="py-2.5 px-3 text-right">Total</th>
                                <th className="py-2.5 px-3">NF</th>
                                <th className="py-2.5 px-3">Status Pipeline</th>
                              </>
                            )}
                            <th className="py-2.5 px-3 text-center">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {paginatedRows.map((row: any, idx: number) => (
                            <tr
                              key={row.id || idx}
                              className="hover:bg-muted/30 transition-colors cursor-pointer"
                              onClick={() => {
                                setSelectedRowDetail(row);
                                setRowDrawerOpen(true);
                              }}
                            >
                              {/* R01 Operações */}
                              {activeReportId === "r01-operacoes-volume" && (
                                <>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.dataOperacao}</td>
                                  <td className="py-2.5 px-3 font-mono font-bold text-primary">{row.codigoOperacional}</td>
                                  <td className="py-2.5 px-3 truncate max-w-[140px]">{row.transportadora}</td>
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold">{row.tipoServico}</div>
                                    <div className="text-[10px] text-muted-foreground">{row.produtoCarga}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">{row.quantidade}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                                    {formatBRL(row.totalBruto)}
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">
                                    {row.placa} {row.nfNumero ? `· NF ${row.nfNumero}` : ""}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                                      {row.status}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {/* R02 Diaristas */}
                              {activeReportId === "r02-fechamento-diaristas" && (
                                <>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.dataLancamento}</td>
                                  <td className="py-2.5 px-3 font-bold text-foreground">{row.colaboradorNome}</td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">{row.cpfMascarado}</td>
                                  <td className="py-2.5 px-3 text-muted-foreground">{row.funcao}</td>
                                  <td className="py-2.5 px-3 text-center font-mono font-bold">{row.quantidadeDiarias}</td>
                                  <td className="py-2.5 px-3 text-right font-mono">{formatBRL(row.valorDiariaBase)}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.total)}</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className={`text-[10px] ${getStatusLoteDiaristaLabel(row.statusLote).className}`}>
                                      {getStatusLoteDiaristaLabel(row.statusLote).label}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {/* R03 Receitas */}
                              {activeReportId === "r03-faturamento-receitas" && (
                                <>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.competenciaFormatada}</td>
                                  <td className="py-2.5 px-3 font-bold text-foreground">{row.clienteNome}</td>
                                  <td className="py-2.5 px-3 text-muted-foreground">{getModalidadeLabel(row.modalidade)}</td>
                                  <td className="py-2.5 px-3 text-muted-foreground">{row.origem}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.valorFaturado)}</td>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.vencimento}</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className="text-[10px]">
                                      {getStatusReceitaLabel(row.status)}
                                    </Badge>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {(() => {
                                      const sit = getSituacaoDerivadaReceita(row);
                                      return (
                                        <Badge variant="outline" className={`text-[10px] ${sit.isAtrasado ? "border-red-500/30 text-red-500 bg-red-500/10" : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"}`}>
                                          {sit.descricao}
                                        </Badge>
                                      );
                                    })()}
                                  </td>
                                </>
                              )}

                              {/* R04 Custos Extras */}
                              {activeReportId === "r04-custos-extras" && (
                                <>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.data}</td>
                                  <td className="py-2.5 px-3 font-semibold">{getCategoriaCustoLabel(row.categoriaCusto)}</td>
                                  <td className="py-2.5 px-3 truncate max-w-[160px] text-muted-foreground">{row.descricao}</td>
                                  <td className="py-2.5 px-3">{row.favorecidoNome}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.total)}</td>
                                  <td className="py-2.5 px-3 text-[11px] text-muted-foreground">{row.origemRecurso}</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className={`text-[10px] ${getStatusCustoExtraLabel(row.status).className}`}>
                                      {getStatusCustoExtraLabel(row.status).label}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {/* R05 Banco de Horas */}
                              {activeReportId === "r05-banco-horas" && (
                                <>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.matricula}</td>
                                  <td className="py-2.5 px-3 font-bold text-foreground">{row.colaboradorNome}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">
                                    <span className={row.saldoMinutos < 0 ? "text-red-500" : "text-emerald-600"}>
                                      {row.saldoFormatado}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600">{row.creditosFormatado}</td>
                                  <td className="py-2.5 px-3 text-right font-mono text-red-500">{row.debitosFormatado}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-amber-600">{row.aVencer30dFormatado}</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className={`text-[10px] ${row.status === "Crítico" ? "border-red-500 text-red-500 bg-red-500/10" : row.status === "A Vencer" ? "border-amber-500 text-amber-500 bg-amber-500/10" : "border-emerald-500 text-emerald-600 bg-emerald-500/10"}`}>
                                      {row.status}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              {/* R07 Serviços Extras */}
                              {activeReportId === "r07-servicos-extras" && (
                                <>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.data}</td>
                                  <td className="py-2.5 px-3 font-bold text-foreground">{row.tipoServico}</td>
                                  <td className="py-2.5 px-3 text-muted-foreground">{row.tomadorNome}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold">{row.quantidade}</td>
                                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.total)}</td>
                                  <td className="py-2.5 px-3 font-mono text-[11px]">{row.nfNumero || "—"}</td>
                                  <td className="py-2.5 px-3">
                                    <Badge variant="outline" className={`text-[10px] ${getPipelineStatusServicoExtraLabel(row.pipelineStatus).className}`}>
                                      {getPipelineStatusServicoExtraLabel(row.pipelineStatus).label}
                                    </Badge>
                                  </td>
                                </>
                              )}

                              <td className="py-2.5 px-3 text-center">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" title="Ver detalhes do registro">
                                  <Info className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {/* PAGINAÇÃO */}
                  {totalPages > 1 && (
                    <div className="p-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                      <div>
                        Página <strong>{currentPage}</strong> de {totalPages}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          disabled={currentPage <= 1}
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                          <ChevronLeft className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          disabled={currentPage >= totalPages}
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        >
                          <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>

        {/* MODAL DO DOSSIÊ DA COMPETÊNCIA */}
        <Dialog open={isDossierOpen} onOpenChange={setIsDossierOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Dossiê Consolidado da Competência
              </DialogTitle>
              <DialogDescription className="text-xs">
                Compilação documental e resumo executivo para {empresaSelecionada.nome} ({competencia}).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Empresa:</span>
                  <span className="font-semibold text-foreground">{empresaSelecionada.nome}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Competência:</span>
                  <span className="font-semibold text-foreground">{competencia}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total de Registros:</span>
                  <span className="font-bold text-foreground">{kpis.totalRegistros} apurações</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-2">Cadernos a Incluir:</label>
                <div className="space-y-2 text-xs">
                  {RELATORIOS_CATALOGO_OFICIAL.filter((r) => checkReportAccess(r.id, role)).map((r) => (
                    <label key={r.id} className="flex items-center gap-2 cursor-pointer text-muted-foreground hover:text-foreground">
                      <Checkbox
                        checked={selectedDossierReports.includes(r.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDossierReports((prev) => [...prev, r.id]);
                          } else {
                            setSelectedDossierReports((prev) => prev.filter((id) => id !== r.id));
                          }
                        }}
                      />
                      <span>{r.code} — {r.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setIsDossierOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleExportDossier} className="font-semibold">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Emitir Dossiê CSV
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DRAWER 1: AUDITORIA DO INDICADOR / KPI CLICADO */}
        <Sheet open={kpiDrawerOpen} onOpenChange={setKpiDrawerOpen}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader className="border-b border-border/60 pb-3">
              <SheetTitle className="text-sm font-bold flex items-center gap-2">
                <Info className="h-4 w-4 text-primary" />
                {kpiDrawerData?.title || "Auditoria do Indicador"}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {kpiDrawerData?.subtitle || "Rastreabilidade e regras de consolidação"}
              </SheetDescription>
            </SheetHeader>

            {kpiDrawerData && (
              <div className="py-4 space-y-4 text-xs">
                {/* Cartão de Destaque */}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    {kpiDrawerData.metricLabel}
                  </span>
                  <div className="text-2xl font-black text-foreground font-mono">
                    {kpiDrawerData.metricValue}
                  </div>
                </div>

                {/* Descrição e Origem */}
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2">
                  <div>
                    <span className="font-semibold text-foreground block">Definição Operacional:</span>
                    <p className="text-muted-foreground mt-0.5">{kpiDrawerData.description}</p>
                  </div>
                  <div className="pt-2 border-t border-border/30 flex justify-between items-center text-[11px]">
                    <span className="text-muted-foreground font-semibold">Tabela Canônica:</span>
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {kpiDrawerData.sourceTable}
                    </Badge>
                  </div>
                </div>

                {/* Breakdown Analítico */}
                <div className="space-y-2">
                  <span className="font-bold text-foreground text-xs uppercase tracking-wider block">
                    Composição Analítica:
                  </span>
                  <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden">
                    {kpiDrawerData.breakdown.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex justify-between items-center bg-card">
                        <span className="text-muted-foreground">{item.label}</span>
                        <span className="font-bold font-mono text-foreground">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* DRAWER 2: AUDITORIA DO LANÇAMENTO INDIVIDUAL (LINHA DA TABELA) */}
        <Sheet open={rowDrawerOpen} onOpenChange={setRowDrawerOpen}>
          <SheetContent className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader className="border-b border-border/60 pb-3">
              <SheetTitle className="text-sm font-bold flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                Auditoria do Lançamento
              </SheetTitle>
              <SheetDescription className="text-xs">
                Metadados brutos persistidos no banco de dados para este registro.
              </SheetDescription>
            </SheetHeader>

            {selectedRowDetail && (
              <div className="py-4 space-y-3 text-xs">
                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 font-mono">
                  {Object.entries(selectedRowDetail).map(([key, value]) => {
                    if (value === null || value === undefined) return null;
                    return (
                      <div key={key} className="flex justify-between items-start gap-2 border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
                        <span className="text-muted-foreground font-sans capitalize">{key.replace(/([A-Z])/g, " $1")}:</span>
                        <span className="font-bold text-foreground text-right break-all">
                          {typeof value === "object" ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AppShell>
  );
}
