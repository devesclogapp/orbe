import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  Download,
  Printer,
  Filter,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  Building2,
  Calendar,
  Layers,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  RefreshCw,
  ShieldCheck,
  Coins,
  FileText,
  Users,
  Percent,
  Lock,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { EmpresaService } from "@/services/base.service";
import {
  RelatoriosOficialAdapter,
  RELATORIOS_CATALOGO_OFICIAL,
  checkReportAccess,
  formatBRL,
  formatMinutosToHourString,
  getModalidadeLabel,
  getStatusReceitaLabel,
  getSituacaoDerivadaReceita,
  getStatusLoteDiaristaLabel,
  getStatusCustoExtraLabel,
  getCategoriaCustoLabel,
  getPipelineStatusServicoExtraLabel,
  OperacaoVolumeRow,
  BancoHorasRow,
  FaturamentoReceitaRow,
  DiaristaFechamentoRow,
  CustoExtraRow,
  ServicoExtraRow,
} from "@/services/adapters/relatoriosOficialAdapter";

interface DrawerInfo {
  isOpen: boolean;
  title: string;
  subtitle: string;
  metricLabel: string;
  metricValue: string;
  description: string;
  sourceTable: string;
  breakdown: Array<{ label: string; value: string; detail?: string }>;
}

export default function RelatorioVisualizadorOficial() {
  const { reportId } = useParams<{ reportId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAccessControl();

  const urlEmpresa = searchParams.get("empresa");
  const urlCompetencia = searchParams.get("competencia");

  // Localizar metadados do relatório no catálogo oficial
  const report = useMemo(() => {
    return (
      RELATORIOS_CATALOGO_OFICIAL.find(
        (r) => r.id === reportId || r.code.toLowerCase() === reportId?.toLowerCase()
      ) || null
    );
  }, [reportId]);

  // Carregar lista canônica de empresas do tenant
  const { data: empresasCadastradas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas_cadastradas_relatorios"],
    queryFn: () => EmpresaService.getAll(),
  });

  const defaultEmpresaId = urlEmpresa || empresasCadastradas[0]?.id || "";
  const [empresaId, setEmpresaId] = useState<string>(defaultEmpresaId);

  // Sincronizar primeira empresa assim que carregada se ainda não definida e atualizar URL
  React.useEffect(() => {
    if (!empresaId && empresasCadastradas.length > 0) {
      const firstId = empresasCadastradas[0].id;
      setEmpresaId(firstId);
      if (!searchParams.get("empresa")) {
        const next = new URLSearchParams(searchParams);
        next.set("empresa", firstId);
        setSearchParams(next, { replace: true });
      }
    }
  }, [empresasCadastradas, empresaId, searchParams, setSearchParams]);

  // Parâmetros Temporais
  const [dataDe, setDataDe] = useState<string>(urlCompetencia ? `${urlCompetencia}-01` : "2026-09-01");
  const [dataAte, setDataAte] = useState<string>(urlCompetencia ? `${urlCompetencia}-30` : "2026-09-30");
  const [competencia, setCompetencia] = useState<string>(urlCompetencia || "2026-09");

  // Handlers sincronizados com a URL para preservar contexto em refresh e navegação
  const handleEmpresaChange = (newEmpresaId: string) => {
    setEmpresaId(newEmpresaId);
    const next = new URLSearchParams(searchParams);
    next.set("empresa", newEmpresaId);
    setSearchParams(next);
  };

  const handleCompetenciaChange = (newComp: string) => {
    setCompetencia(newComp);
    const next = new URLSearchParams(searchParams);
    next.set("competencia", newComp);
    setSearchParams(next);
  };

  // Filtros Secundários
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroTransportadora, setFiltroTransportadora] = useState("all");
  const [filtroModalidade, setFiltroModalidade] = useState("all");
  const [filtroServico, setFiltroServico] = useState("all");

  // R02 Diaristas
  const [filtroCiclo, setFiltroCiclo] = useState("all");
  const [filtroFuncaoDiarista, setFiltroFuncaoDiarista] = useState("all");
  const [filtroStatusDiarista, setFiltroStatusDiarista] = useState("all");

  // R04 Custos
  const [filtroCategoriaCusto, setFiltroCategoriaCusto] = useState("all");
  const [filtroStatusCusto, setFiltroStatusCusto] = useState("all");

  // R07 Serviços Extras
  const [filtroTipoServicoExtra, setFiltroTipoServicoExtra] = useState("all");
  const [filtroPipelineStatusExtra, setFiltroPipelineStatusExtra] = useState("all");

  // Drawer de Auditoria Analítica
  const [drawerData, setDrawerData] = useState<DrawerInfo | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Auto-print por query param
  React.useEffect(() => {
    if (searchParams.get("print") === "true") {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Reset de página ao alterar filtros
  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    empresaId,
    dataDe,
    dataAte,
    competencia,
    filtroStatus,
    filtroTransportadora,
    filtroModalidade,
    filtroServico,
    filtroCiclo,
    filtroFuncaoDiarista,
    filtroStatusDiarista,
    filtroCategoriaCusto,
    filtroStatusCusto,
    filtroTipoServicoExtra,
    filtroPipelineStatusExtra,
  ]);

  // Consulta Segura via Adapter Oficial
  const isAuthorized = useMemo(() => {
    if (!report) return false;
    if (report.id === "r06-produtividade-individual") return false;
    return checkReportAccess(report.id, role);
  }, [report, role]);

  const {
    data: rawData = [],
    isLoading: isLoadingData,
    isFetching: isFetchingData,
    refetch,
  } = useQuery({
    queryKey: [
      "relatorio_oficial_dados",
      report?.id,
      empresaId,
      dataDe,
      dataAte,
      competencia,
      filtroCiclo,
    ],
    queryFn: async () => {
      if (!report || !empresaId) return [];
      switch (report.id) {
        case "r01-operacoes-volume":
          return await RelatoriosOficialAdapter.getR01Data(empresaId, { dataDe, dataAte, competencia });
        case "r02-fechamento-diaristas":
          return await RelatoriosOficialAdapter.getR02Data(empresaId, {
            competencia,
            dataDe,
            dataAte,
            cicloId: filtroCiclo === "all" ? undefined : filtroCiclo,
          });
        case "r03-faturamento-receitas":
          return await RelatoriosOficialAdapter.getR03Data(empresaId, { competencia });
        case "r04-custos-extras":
          return await RelatoriosOficialAdapter.getR04Data(empresaId, { dataDe, dataAte, competencia });
        case "r05-banco-horas":
          return await RelatoriosOficialAdapter.getR05Data(empresaId, { competencia });
        case "r07-servicos-extras":
          return await RelatoriosOficialAdapter.getR07Data(empresaId, { dataDe, dataAte, competencia });
        default:
          return [];
      }
    },
    enabled: Boolean(isAuthorized && report && empresaId),
  });

  const empresaSelecionada = useMemo(() => {
    return (
      empresasCadastradas.find((e) => e.id === empresaId) || {
        id: empresaId,
        nome: isLoadingEmpresas ? "Carregando empresa..." : (empresaId ? "Empresa Não Localizada" : "Selecione a Empresa"),
      }
    );
  }, [empresasCadastradas, empresaId, isLoadingEmpresas]);

  // Nome canônico da empresa SEM fallback genérico silencioso
  const empresaNomeExibicao =
    empresaSelecionada.nome ||
    empresaSelecionada.nome_fantasia ||
    empresaSelecionada.razao_social ||
    (empresaId ? "Empresa Não Localizada" : "Selecione a Empresa");

  // Ciclos disponíveis dinamicamente calculados a partir dos dados reais do R02
  const ciclosDisponiveis = useMemo(() => {
    if (report?.id !== "r02-fechamento-diaristas") return [];
    const set = new Map<string, string>();
    (rawData as DiaristaFechamentoRow[]).forEach((r) => {
      if (r.cicloId && !set.has(r.cicloId)) {
        set.set(r.cicloId, r.cicloLabel || r.loteCodigo || r.cicloId);
      }
    });
    return Array.from(set.entries()).map(([id, label]) => ({ id, label }));
  }, [report?.id, rawData]);

  // ----------------------------------------------------
  // APLICAÇÃO DOS FILTROS EM MEMÓRIA
  // ----------------------------------------------------
  const r01Data = useMemo(() => {
    if (report?.id !== "r01-operacoes-volume") return [];
    return (rawData as OperacaoVolumeRow[]).filter((row) => {
      if (filtroTransportadora !== "all" && row.transportadora !== filtroTransportadora) return false;
      if (filtroServico !== "all" && row.tipoServico !== filtroServico) return false;
      if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
      return true;
    });
  }, [report?.id, rawData, filtroTransportadora, filtroServico, filtroStatus]);

  const r02Data = useMemo(() => {
    if (report?.id !== "r02-fechamento-diaristas") return [];
    return (rawData as DiaristaFechamentoRow[]).filter((row) => {
      if (filtroFuncaoDiarista !== "all" && row.funcao !== filtroFuncaoDiarista) return false;
      if (filtroStatusDiarista !== "all" && row.statusLote !== filtroStatusDiarista) return false;
      return true;
    });
  }, [report?.id, rawData, filtroFuncaoDiarista, filtroStatusDiarista]);

  const r03Data = useMemo(() => {
    if (report?.id !== "r03-faturamento-receitas") return [];
    return (rawData as FaturamentoReceitaRow[]).filter((row) => {
      if (filtroModalidade !== "all" && row.modalidade !== filtroModalidade) return false;
      if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
      return true;
    });
  }, [report?.id, rawData, filtroModalidade, filtroStatus]);

  const r04Data = useMemo(() => {
    if (report?.id !== "r04-custos-extras") return [];
    return (rawData as CustoExtraRow[]).filter((row) => {
      if (filtroCategoriaCusto !== "all" && row.categoriaCusto !== filtroCategoriaCusto) return false;
      if (filtroStatusCusto !== "all" && row.status !== filtroStatusCusto) return false;
      return true;
    });
  }, [report?.id, rawData, filtroCategoriaCusto, filtroStatusCusto]);

  const r05Data = useMemo(() => {
    if (report?.id !== "r05-banco-horas") return [];
    return (rawData as BancoHorasRow[]).filter((row) => {
      if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
      return true;
    });
  }, [report?.id, rawData, filtroStatus]);

  const r07Data = useMemo(() => {
    if (report?.id !== "r07-servicos-extras") return [];
    return (rawData as ServicoExtraRow[]).filter((row) => {
      if (filtroTipoServicoExtra !== "all" && row.tipoServico !== filtroTipoServicoExtra) return false;
      if (filtroPipelineStatusExtra !== "all" && row.pipelineStatus !== filtroPipelineStatusExtra) return false;
      return true;
    });
  }, [report?.id, rawData, filtroTipoServicoExtra, filtroPipelineStatusExtra]);

  // Lista dinâmica de opções para filtros
  const r01Transportadoras = useMemo(() => {
    if (report?.id !== "r01-operacoes-volume") return [];
    return Array.from(new Set((rawData as OperacaoVolumeRow[]).map((r) => r.transportadora))).filter(Boolean);
  }, [report?.id, rawData]);

  const r01Servicos = useMemo(() => {
    if (report?.id !== "r01-operacoes-volume") return [];
    return Array.from(new Set((rawData as OperacaoVolumeRow[]).map((r) => r.tipoServico))).filter(Boolean);
  }, [report?.id, rawData]);

  const r02Funcoes = useMemo(() => {
    if (report?.id !== "r02-fechamento-diaristas") return [];
    return Array.from(new Set((rawData as DiaristaFechamentoRow[]).map((r) => r.funcao))).filter(Boolean);
  }, [report?.id, rawData]);

  const r07Tipos = useMemo(() => {
    if (report?.id !== "r07-servicos-extras") return [];
    return Array.from(new Set((rawData as ServicoExtraRow[]).map((r) => r.tipoServico))).filter(Boolean);
  }, [report?.id, rawData]);

  // ----------------------------------------------------
  // DISTRIBUIÇÕES & INFOGRÁFICOS POR RELATÓRIO
  // ----------------------------------------------------
  const r01DistribuicaoTransportadora = useMemo(() => {
    const map = new Map<string, { transportadora: string; volume: number; total: number; count: number }>();
    r01Data.forEach((row) => {
      const existing = map.get(row.transportadora) || { transportadora: row.transportadora, volume: 0, total: 0, count: 0 };
      existing.volume += row.quantidade;
      existing.total += row.totalBruto;
      existing.count += 1;
      map.set(row.transportadora, existing);
    });
    const totalGeral = r01Data.reduce((acc, r) => acc + r.totalBruto, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? (item.total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [r01Data]);

  const r01DistribuicaoStatus = useMemo(() => {
    const map = new Map<string, { status: string; count: number; total: number }>();
    r01Data.forEach((row) => {
      const existing = map.get(row.status) || { status: row.status, count: 0, total: 0 };
      existing.count += 1;
      existing.total += row.totalBruto;
      map.set(row.status, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [r01Data]);

  const r02DistribuicaoFuncao = useMemo(() => {
    const map = new Map<string, { funcao: string; total: number; count: number; diarias: number }>();
    r02Data.forEach((row) => {
      const existing = map.get(row.funcao) || { funcao: row.funcao, total: 0, count: 0, diarias: 0 };
      existing.total += row.total;
      existing.count += 1;
      existing.diarias += row.quantidadeDiarias;
      map.set(row.funcao, existing);
    });
    const totalGeral = r02Data.reduce((acc, r) => acc + r.total, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? (item.total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [r02Data]);

  const r02DistribuicaoStatus = useMemo(() => {
    const map = new Map<string, { status: string; count: number; total: number }>();
    r02Data.forEach((row) => {
      const existing = map.get(row.statusLote) || { status: row.statusLote, count: 0, total: 0 };
      existing.count += 1;
      existing.total += row.total;
      map.set(row.statusLote, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [r02Data]);

  const r03DistribuicaoModalidade = useMemo(() => {
    const map = new Map<string, { modalidade: string; total: number; count: number }>();
    r03Data.forEach((row) => {
      const existing = map.get(row.modalidade) || { modalidade: row.modalidade, total: 0, count: 0 };
      existing.total += row.valorFaturado;
      existing.count += 1;
      map.set(row.modalidade, existing);
    });
    const totalGeral = r03Data.reduce((acc, r) => acc + r.valorFaturado, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? (item.total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [r03Data]);

  const r03DistribuicaoStatus = useMemo(() => {
    const map = new Map<string, { status: string; count: number; totalFaturado: number }>();
    r03Data.forEach((row) => {
      const existing = map.get(row.status) || { status: row.status, count: 0, totalFaturado: 0 };
      existing.count += 1;
      existing.totalFaturado += row.valorFaturado;
      map.set(row.status, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [r03Data]);

  const r04DistribuicaoCategoria = useMemo(() => {
    const map = new Map<string, { categoria: string; total: number; count: number }>();
    r04Data.forEach((row) => {
      const catLabel = getCategoriaCustoLabel(row.categoriaCusto);
      const existing = map.get(catLabel) || { categoria: catLabel, total: 0, count: 0 };
      existing.total += row.total;
      existing.count += 1;
      map.set(catLabel, existing);
    });
    const totalGeral = r04Data.reduce((acc, r) => acc + r.total, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? (item.total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [r04Data]);

  const r04DistribuicaoStatus = useMemo(() => {
    const map = new Map<string, { status: string; count: number; total: number }>();
    r04Data.forEach((row) => {
      const existing = map.get(row.status) || { status: row.status, count: 0, total: 0 };
      existing.count += 1;
      existing.total += row.total;
      map.set(row.status, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [r04Data]);

  const r05DistribuicaoFaixa = useMemo(() => {
    const faixas = [
      { label: "Saldo Positivo (>10h)", count: 0, minutos: 0 },
      { label: "Saldo Positivo (0 a 10h)", count: 0, minutos: 0 },
      { label: "Regular / Equilibrado (0h)", count: 0, minutos: 0 },
      { label: "Débito Crítico (<0h)", count: 0, minutos: 0 },
    ];
    r05Data.forEach((row) => {
      if (row.saldoMinutos > 600) {
        faixas[0].count += 1;
        faixas[0].minutos += row.saldoMinutos;
      } else if (row.saldoMinutos > 0) {
        faixas[1].count += 1;
        faixas[1].minutos += row.saldoMinutos;
      } else if (row.saldoMinutos === 0) {
        faixas[2].count += 1;
      } else {
        faixas[3].count += 1;
        faixas[3].minutos += row.saldoMinutos;
      }
    });
    const totalColabs = r05Data.length;
    return faixas
      .map((f) => ({
        ...f,
        percentual: totalColabs > 0 ? (f.count / totalColabs) * 100 : 0,
      }))
      .filter((f) => f.count > 0);
  }, [r05Data]);

  const r07DistribuicaoTipo = useMemo(() => {
    const map = new Map<string, { tipoServico: string; volume: number; total: number; count: number }>();
    r07Data.forEach((row) => {
      const existing = map.get(row.tipoServico) || { tipoServico: row.tipoServico, volume: 0, total: 0, count: 0 };
      existing.volume += row.quantidade;
      existing.total += row.total;
      existing.count += 1;
      map.set(row.tipoServico, existing);
    });
    const totalGeral = r07Data.reduce((acc, r) => acc + r.total, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalGeral > 0 ? (item.total / totalGeral) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [r07Data]);

  const r07DistribuicaoPipeline = useMemo(() => {
    const map = new Map<string, { pipelineStatus: string; count: number; total: number }>();
    r07Data.forEach((row) => {
      const existing = map.get(row.pipelineStatus) || { pipelineStatus: row.pipelineStatus, count: 0, total: 0 };
      existing.count += 1;
      existing.total += row.total;
      map.set(row.pipelineStatus, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [r07Data]);

  // Status de filtros ativos
  const hasActiveFilters = useMemo(() => {
    if (!report) return false;
    if (report.id === "r01-operacoes-volume") {
      return (
        dataDe !== "2026-09-01" ||
        dataAte !== "2026-09-30" ||
        filtroTransportadora !== "all" ||
        filtroServico !== "all" ||
        filtroStatus !== "all"
      );
    }
    if (report.id === "r05-banco-horas") {
      return competencia !== "2026-09" || filtroStatus !== "all";
    }
    if (report.id === "r03-faturamento-receitas") {
      return competencia !== "2026-09" || filtroModalidade !== "all" || filtroStatus !== "all";
    }
    if (report.id === "r02-fechamento-diaristas") {
      return filtroCiclo !== "all" || filtroFuncaoDiarista !== "all" || filtroStatusDiarista !== "all";
    }
    if (report.id === "r04-custos-extras") {
      return (
        dataDe !== "2026-09-01" ||
        dataAte !== "2026-09-30" ||
        filtroCategoriaCusto !== "all" ||
        filtroStatusCusto !== "all"
      );
    }
    if (report.id === "r07-servicos-extras") {
      return (
        dataDe !== "2026-09-01" ||
        dataAte !== "2026-09-30" ||
        filtroTipoServicoExtra !== "all" ||
        filtroPipelineStatusExtra !== "all"
      );
    }
    return false;
  }, [
    report,
    dataDe,
    dataAte,
    competencia,
    filtroTransportadora,
    filtroServico,
    filtroStatus,
    filtroModalidade,
    filtroCiclo,
    filtroFuncaoDiarista,
    filtroStatusDiarista,
    filtroCategoriaCusto,
    filtroStatusCusto,
    filtroTipoServicoExtra,
    filtroPipelineStatusExtra,
  ]);

  const handleClearFilters = () => {
    setDataDe("2026-09-01");
    setDataAte("2026-09-30");
    setCompetencia("2026-09");
    setFiltroStatus("all");
    setFiltroTransportadora("all");
    setFiltroModalidade("all");
    setFiltroServico("all");
    setFiltroCiclo("all");
    setFiltroFuncaoDiarista("all");
    setFiltroStatusDiarista("all");
    setFiltroCategoriaCusto("all");
    setFiltroStatusCusto("all");
    setFiltroTipoServicoExtra("all");
    setFiltroPipelineStatusExtra("all");
    setCurrentPage(1);
    toast.info("Filtros redefinidos aos valores padrão");
  };

  // Ações de Exportação
  const handleExportCSV = () => {
    if (!report) return;
    let targetRows: any[] = [];
    if (report.id === "r01-operacoes-volume") targetRows = r01Data;
    else if (report.id === "r02-fechamento-diaristas") targetRows = r02Data;
    else if (report.id === "r03-faturamento-receitas") targetRows = r03Data;
    else if (report.id === "r04-custos-extras") targetRows = r04Data;
    else if (report.id === "r05-banco-horas") targetRows = r05Data;
    else if (report.id === "r07-servicos-extras") targetRows = r07Data;

    if (targetRows.length === 0) {
      toast.warning("Nenhum registro para exportar com os filtros atuais.");
      return;
    }

    RelatoriosOficialAdapter.exportReportToCSV(
      report.id,
      targetRows,
      empresaNomeExibicao,
      competencia || dataDe
    );

    toast.success("CSV exportado com sucesso!", {
      description: `${targetRows.length} registros exportados com proteção de fórmulas.`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // ----------------------------------------------------
  // TRATAMENTO DE ACESSO NEGADO OU NÃO ENCONTRADO
  // ----------------------------------------------------
  if (!report || reportId === "r06-produtividade-individual" || !isAuthorized) {
    const isR06 = reportId === "r06-produtividade-individual" || reportId?.toLowerCase() === "r06";
    return (
      <AppShell
        title="Acesso Restrito"
        subtitle="Controle de governança de relatórios"
        backPath="/relatorios"
      >
        <div className="w-full max-w-4xl mx-auto py-12 px-4">
          <div className="bg-card border border-border/80 rounded-2xl p-8 text-center shadow-sm space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/20">
              <Lock className="h-7 w-7" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-xl font-bold text-foreground">
                {isR06 ? "Caderno em Homologação (Bloqueado)" : "Acesso Restrito ao Caderno"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isR06
                  ? "O caderno R06 (Produtividade Individual) permanece estritamente bloqueado até a homologação canônica das regras de rateio e confidencialidade operacional."
                  : `Seu perfil atual de acesso (${role || "indefinido"}) não possui autorização de governança para emitir ou auditar o caderno documental solicitado.`}
              </p>
            </div>
            <div className="pt-4 flex justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate("/relatorios")}
                className="gap-2 text-xs"
              >
                <ChevronLeft className="h-4 w-4" />
                <span>Retornar à Central de Relatórios</span>
              </Button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // Dados paginados canônicos
  let activeDataset: any[] = [];
  if (report.id === "r01-operacoes-volume") activeDataset = r01Data;
  else if (report.id === "r02-fechamento-diaristas") activeDataset = r02Data;
  else if (report.id === "r03-faturamento-receitas") activeDataset = r03Data;
  else if (report.id === "r04-custos-extras") activeDataset = r04Data;
  else if (report.id === "r05-banco-horas") activeDataset = r05Data;
  else if (report.id === "r07-servicos-extras") activeDataset = r07Data;

  const totalPages = Math.max(1, Math.ceil(activeDataset.length / PAGE_SIZE));
  const paginatedRows = activeDataset.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <AppShell
      title={report.title}
      subtitle={report.description}
      badge={report.code}
      backPath="/relatorios"
    >
      {/* Estilo dedicado de Impressão @media print */}
      <style>{`
        @page {
          size: A4 portrait;
          margin: 15mm 12mm 15mm 12mm;
        }
        @media print {
          body {
            background: white !important;
            color: black !important;
            font-size: 9pt !important;
          }
          aside, header, nav, .no-print {
            display: none !important;
          }
          .print-header {
            display: block !important;
            margin-bottom: 16px;
            border-bottom: 2px solid #000;
            padding-bottom: 8px;
          }
          .print-footer {
            display: block !important;
            margin-top: 20px;
            border-top: 1px solid #777;
            padding-top: 8px;
          }
          .print-table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          .print-table th, .print-table td {
            border: 1px solid #ddd !important;
            padding: 4px 6px !important;
            font-size: 8.5pt !important;
          }
          .print-table th {
            background-color: #f2f2f2 !important;
            color: #000 !important;
          }
          thead {
            display: table-header-group;
          }
          tr {
            page-break-inside: avoid;
          }
        }
        .print-header, .print-footer {
          display: none;
        }
      `}</style>

      <div className="w-full space-y-4 pb-12 animate-in fade-in-50 duration-200">
        {/* Breadcrumb Navegação */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground no-print">
          <Link
            to={`/relatorios?empresa=${empresaId}&competencia=${competencia}`}
            className="inline-flex items-center gap-1 hover:text-foreground transition-colors font-medium"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span>Central de Relatórios</span>
          </Link>
          <span>/</span>
          <span className="font-semibold text-foreground">{report.category}</span>
          <span>/</span>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {report.code}
          </Badge>
        </div>

        {/* FAIXA DOCUMENTAL OFICIAL */}
        <section className="bg-card border border-border/80 rounded-xl px-4 sm:px-5 py-3.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className="font-mono text-xs px-2.5 py-0.5 font-bold bg-blue-600 text-white tracking-wider">
                  {report.code}
                </Badge>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  RELATÓRIO ANALÍTICO OFICIAL
                </span>
                <span className="text-border hidden sm:inline">·</span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {report.category}
                </span>
                {isFetchingData && (
                  <Badge variant="outline" className="text-[10px] gap-1 text-blue-600 border-blue-500/20 bg-blue-500/5">
                    <RefreshCw className="h-2.5 w-2.5 animate-spin" />
                    Sincronizando
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground pt-0.5">
                <span>
                  Empresa / Filial:{" "}
                  <strong className="text-foreground font-semibold">
                    {empresaNomeExibicao}
                  </strong>
                </span>
                <span className="text-border">·</span>
                <span>
                  Período:{" "}
                  <strong className="text-foreground font-medium font-mono">
                    {report.primaryTemporalType === "competencia" || report.id === "r02-fechamento-diaristas"
                      ? competencia
                      : `${dataDe} até ${dataAte}`}
                  </strong>
                </span>
                <span className="text-border">·</span>
                <span>
                  Emitido em:{" "}
                  <strong className="text-foreground font-medium font-mono">
                    {new Date().toLocaleDateString("pt-BR")}
                  </strong>
                </span>
              </div>
            </div>

            {/* Ações Documentais */}
            <div className="flex items-center gap-2 self-start sm:self-center no-print shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                className="h-8 px-3 text-xs gap-1.5 font-medium border-border shadow-xs hover:bg-muted"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Exportar CSV</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="h-8 px-3 text-xs gap-1.5 font-medium border-border shadow-xs hover:bg-muted"
              >
                <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Gerar PDF</span>
              </Button>
              <Button
                size="sm"
                onClick={handlePrint}
                className="h-8 px-3 text-xs gap-1.5 font-medium shadow-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Imprimir</span>
              </Button>
            </div>
          </div>
        </section>

        {/* CABEÇALHO PARA IMPRESSÃO (@media print) */}
        <div className="print-header">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold">ORBE ERP — ESC LOGÍSTICA</h1>
              <h2 className="text-base font-semibold">{report.code} — {report.title}</h2>
              <p className="text-xs text-gray-600">
                Empresa: {empresaNomeExibicao}
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Gerado em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
              <p>Período: {competencia || `${dataDe} a ${dataAte}`}</p>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS ESTRUTURAIS */}
        <section className="bg-card border border-border/80 rounded-xl px-4 py-3 shadow-xs space-y-2.5 no-print">
          <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <Filter className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span>Parâmetros de Consulta</span>
            </div>

            {hasActiveFilters && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  Filtros Ativos
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Limpar filtros</span>
                </Button>
              </div>
            )}
          </div>

          <div
            className={
              report.id === "r01-operacoes-volume" ||
              report.id === "r04-custos-extras" ||
              report.id === "r07-servicos-extras"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end"
                : report.id === "r05-banco-horas"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 items-end"
                : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 items-end"
            }
          >
            {/* 1. Empresa Obrigatória */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span>Empresa / Filial</span>
              </label>
              <Select value={empresaId} onValueChange={handleEmpresaChange} disabled={isLoadingEmpresas}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {empresasCadastradas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.nome || emp.nome_fantasia || emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Parâmetro Temporal */}
            {report.id === "r01-operacoes-volume" ||
            report.id === "r04-custos-extras" ||
            report.id === "r07-servicos-extras" ? (
              <>
                <div className="space-y-1">
                  <label
                    htmlFor="filtro-data-de"
                    className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span>Data Inicial (De)</span>
                  </label>
                  <input
                    id="filtro-data-de"
                    aria-label="Data Inicial (De)"
                    type="date"
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={dataDe}
                    onChange={(e) => setDataDe(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="filtro-data-ate"
                    className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                    <span>Data Final (Até)</span>
                  </label>
                  <input
                    id="filtro-data-ate"
                    aria-label="Data Final (Até)"
                    type="date"
                    className="w-full h-8 rounded-md border border-input bg-background px-2.5 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={dataAte}
                    onChange={(e) => setDataAte(e.target.value)}
                  />
                </div>
              </>
            ) : report.id === "r02-fechamento-diaristas" ? (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>Competência</span>
                  </label>
                  <Select value={competencia} onValueChange={handleCompetenciaChange}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Competência..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026-10" className="text-xs">Outubro / 2026</SelectItem>
                      <SelectItem value="2026-09" className="text-xs">Setembro / 2026</SelectItem>
                      <SelectItem value="2026-08" className="text-xs">Agosto / 2026</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    <span>Ciclo / Período Semanal</span>
                  </label>
                  <Select value={filtroCiclo} onValueChange={setFiltroCiclo}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Selecione o ciclo..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Ciclos</SelectItem>
                      {ciclosDisponiveis.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="text-xs">
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>Competência (Mês/Ano)</span>
                </label>
                <Select value={competencia} onValueChange={handleCompetenciaChange}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Selecione a competência..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-10" className="text-xs">Outubro / 2026</SelectItem>
                    <SelectItem value="2026-09" className="text-xs">Setembro / 2026</SelectItem>
                    <SelectItem value="2026-08" className="text-xs">Agosto / 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 3. Filtros Específicos por Relatório */}
            {report.id === "r01-operacoes-volume" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Transportadora</label>
                  <Select value={filtroTransportadora} onValueChange={setFiltroTransportadora}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todas as transportadoras" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todas as Transportadoras</SelectItem>
                      {r01Transportadoras.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                      <SelectItem value="CONCLUIDO" className="text-xs">Concluído</SelectItem>
                      <SelectItem value="FATURADO" className="text-xs">Faturado</SelectItem>
                      <SelectItem value="AGUARDANDO_FATURAMENTO" className="text-xs">Aguardando Faturamento</SelectItem>
                      <SelectItem value="EM_VALIDACAO" className="text-xs">Em Validação</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {report.id === "r02-fechamento-diaristas" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Função</label>
                  <Select value={filtroFuncaoDiarista} onValueChange={setFiltroFuncaoDiarista}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todas as funções" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todas as Funções</SelectItem>
                      {r02Funcoes.map((f) => (
                        <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status do Lote</label>
                  <Select value={filtroStatusDiarista} onValueChange={setFiltroStatusDiarista}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                      <SelectItem value="pago" className="text-xs">Pago</SelectItem>
                      <SelectItem value="enviado_financeiro" className="text-xs">Enviado Financeiro</SelectItem>
                      <SelectItem value="fechado_para_pagamento" className="text-xs">Fechado p/ Pgto</SelectItem>
                      <SelectItem value="em_aberto" className="text-xs">Em Aberto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {report.id === "r03-faturamento-receitas" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Modalidade</label>
                  <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todas as modalidades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todas as Modalidades</SelectItem>
                      <SelectItem value="FATURAMENTO_MENSAL" className="text-xs">Faturamento Mensal</SelectItem>
                      <SelectItem value="DUPLICATA" className="text-xs">Duplicata</SelectItem>
                      <SelectItem value="CAIXA_IMEDIATO" className="text-xs">Caixa Imediato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status Financeiro</label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
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
                </div>
              </>
            )}

            {report.id === "r04-custos-extras" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categoria</label>
                  <Select value={filtroCategoriaCusto} onValueChange={setFiltroCategoriaCusto}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todas as categorias" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todas as Categorias</SelectItem>
                      <SelectItem value="MERENDA" className="text-xs">Merenda / Lanche</SelectItem>
                      <SelectItem value="OPERACIONAL" className="text-xs">Operacional</SelectItem>
                      <SelectItem value="ADMINISTRATIVO" className="text-xs">Administrativo</SelectItem>
                      <SelectItem value="FORNECEDOR" className="text-xs">Fornecedor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status do Pagamento</label>
                  <Select value={filtroStatusCusto} onValueChange={setFiltroStatusCusto}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                      <SelectItem value="PAGO" className="text-xs">Pago</SelectItem>
                      <SelectItem value="PENDENTE" className="text-xs">Pendente</SelectItem>
                      <SelectItem value="ATRASADO" className="text-xs">Atrasado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {report.id === "r05-banco-horas" && (
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Situação de Risco</label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder="Todas as situações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas as Situações</SelectItem>
                    <SelectItem value="A Vencer" className="text-xs">A Vencer (Janela 30d)</SelectItem>
                    <SelectItem value="Débito Crítico" className="text-xs">Débito Crítico</SelectItem>
                    <SelectItem value="Saldo Positivo" className="text-xs">Saldo Positivo</SelectItem>
                    <SelectItem value="OK" className="text-xs">Regular / OK</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {report.id === "r07-servicos-extras" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tipo de Serviço</label>
                  <Select value={filtroTipoServicoExtra} onValueChange={setFiltroTipoServicoExtra}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os serviços" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Serviços</SelectItem>
                      {r07Tipos.map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Status Pipeline</label>
                  <Select value={filtroPipelineStatusExtra} onValueChange={setFiltroPipelineStatusExtra}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                      <SelectItem value="PENDENTE" className="text-xs">Pendente</SelectItem>
                      <SelectItem value="EM_VALIDACAO" className="text-xs">Em Validação</SelectItem>
                      <SelectItem value="APROVADO_OPERACAO" className="text-xs">Aprovado Operação</SelectItem>
                      <SelectItem value="APROVADO_FINANCEIRO" className="text-xs">Aprov. Financeiro</SelectItem>
                      <SelectItem value="FATURADO" className="text-xs">Faturado</SelectItem>
                      <SelectItem value="CONCLUIDO" className="text-xs">Concluído</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </section>

        {/* FAIXA ANALÍTICA EDITORIAL 50 / 50 */}
        {isLoadingData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <>
            {/* R01 — OPERAÇÕES POR VOLUME */}
            {report.id === "r01-operacoes-volume" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 50% ESQUERDA: RESUMO 2x2 */}
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Resumo do Período
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                      <span className="font-semibold text-foreground">{r01Data.length} operações</span>
                    </div>
                  </div>

                  {/* Grid 2x2 Métricas */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDrawerData({
                          isOpen: true,
                          title: "Auditoria de Cargas Realizadas",
                          subtitle: "Operações por Volume no Período",
                          metricLabel: "Total de Cargas",
                          metricValue: `${r01Data.length} cargas`,
                          description: "Total de registros de produção lançados e aprovados para a empresa.",
                          sourceTable: "operacoes_producao",
                          breakdown: [
                            { label: "Cargas Filtradas", value: `${r01Data.length}` },
                            { label: "Unidade Principal", value: r01Data[0]?.unidade || "Principal" },
                          ],
                        })
                      }
                      className="bg-muted/40 hover:bg-muted/70 p-3 rounded-lg border border-border/60 text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">Cargas Totais</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-lg font-bold font-mono tracking-tight text-foreground mt-1">
                        {r01Data.length}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDrawerData({
                          isOpen: true,
                          title: "Auditoria de Volume Movimentado",
                          subtitle: "Soma de Caixas / Volumes",
                          metricLabel: "Volume Total",
                          metricValue: `${r01Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} cx`,
                          description: "Soma consolidada de caixas descarregadas no intervalo temporal.",
                          sourceTable: "operacoes_producao (quantidade)",
                          breakdown: [
                            { label: "Volume Total", value: `${r01Data.reduce((acc, r) => acc + r.quantidade, 0)} cx` },
                            { label: "Média por Carga", value: `${Math.round(r01Data.reduce((acc, r) => acc + r.quantidade, 0) / (r01Data.length || 1))} cx` },
                          ],
                        })
                      }
                      className="bg-muted/40 hover:bg-muted/70 p-3 rounded-lg border border-border/60 text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">Volume Físico</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-lg font-bold font-mono tracking-tight text-foreground mt-1">
                        {r01Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} <span className="text-xs text-muted-foreground font-normal">cx</span>
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDrawerData({
                          isOpen: true,
                          title: "Auditoria do Faturamento Bruto",
                          subtitle: "Valor Total das Descargas",
                          metricLabel: "Faturamento Bruto",
                          metricValue: formatBRL(r01Data.reduce((acc, r) => acc + r.totalBruto, 0)),
                          description: "Soma de valor total antes de retenções de impostos e insumos.",
                          sourceTable: "operacoes_producao (valor_total)",
                          breakdown: [
                            { label: "Bruto Consolidado", value: formatBRL(r01Data.reduce((acc, r) => acc + r.totalBruto, 0)) },
                            { label: "Materiais (Filme)", value: formatBRL(r01Data.reduce((acc, r) => acc + r.materiais, 0)) },
                          ],
                        })
                      }
                      className="bg-muted/40 hover:bg-muted/70 p-3 rounded-lg border border-border/60 text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">Total Bruto</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-lg font-bold font-mono tracking-tight text-foreground mt-1">
                        {formatBRL(r01Data.reduce((acc, r) => acc + r.totalBruto, 0))}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDrawerData({
                          isOpen: true,
                          title: "Retenções e Insumos",
                          subtitle: "ISS e Filme Stretch",
                          metricLabel: "Total Retenções",
                          metricValue: formatBRL(r01Data.reduce((acc, r) => acc + r.iss + r.materiais, 0)),
                          description: "Total acumulado de ISS e insumos operacionais.",
                          sourceTable: "operacoes_producao",
                          breakdown: [
                            { label: "ISS Estimado", value: formatBRL(r01Data.reduce((acc, r) => acc + r.iss, 0)) },
                            { label: "Filme Stretch", value: formatBRL(r01Data.reduce((acc, r) => acc + r.materiais, 0)) },
                          ],
                        })
                      }
                      className="bg-muted/40 hover:bg-muted/70 p-3 rounded-lg border border-border/60 text-left transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-muted-foreground">Retenções & Insumos</span>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <p className="text-lg font-bold font-mono tracking-tight text-foreground mt-1">
                        {formatBRL(r01Data.reduce((acc, r) => acc + r.iss + r.materiais, 0))}
                      </p>
                    </button>
                  </div>
                </div>

                {/* 50% DIREITA: DISTRIBUIÇÃO */}
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Concentração por Transportadora
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r01DistribuicaoTransportadora.length} transportadoras
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {r01DistribuicaoTransportadora.slice(0, 4).map((item) => (
                      <div key={item.transportadora} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate max-w-[200px]">
                            {item.transportadora}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatBRL(item.total)} ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {r01DistribuicaoTransportadora.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* R02 — FECHAMENTO DE DIARISTAS */}
            {report.id === "r02-fechamento-diaristas" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Resumo de Diárias
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {r02Data.length} lançamentos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Total Diárias</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {r02Data.reduce((acc, r) => acc + r.quantidadeDiarias, 0)} <span className="text-xs font-normal">diárias</span>
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Total a Pagar</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(r02Data.reduce((acc, r) => acc + r.total, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Diária Média</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(
                          r02Data.reduce((acc, r) => acc + r.total, 0) /
                            (r02Data.reduce((acc, r) => acc + r.quantidadeDiarias, 0) || 1)
                        )}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Diaristas Únicos</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {new Set(r02Data.map((r) => r.colaboradorNome)).size}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Distribuição por Função
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r02DistribuicaoFuncao.length} funções
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {r02DistribuicaoFuncao.slice(0, 4).map((item) => (
                      <div key={item.funcao} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate max-w-[200px]">
                            {item.funcao}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatBRL(item.total)} ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {r02DistribuicaoFuncao.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* R03 — FATURAMENTO E RECEITAS */}
            {report.id === "r03-faturamento-receitas" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Resumo do Faturamento
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {r03Data.length} títulos
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Receitas Faturadas</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(r03Data.reduce((acc, r) => acc + r.valorFaturado, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Liquidado / Conciliado</span>
                      <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatBRL(
                          r03Data
                            .filter((r) => r.status === "conciliado" || r.status === "recebido" || r.status === "pago")
                            .reduce((acc, r) => acc + r.valorFaturado, 0)
                        )}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Pendente Recebimento</span>
                      <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        {formatBRL(
                          r03Data
                            .filter((r) => r.status !== "conciliado" && r.status !== "recebido" && r.status !== "pago")
                            .reduce((acc, r) => acc + r.valorFaturado, 0)
                        )}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Ticket Médio</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(
                          r03Data.reduce((acc, r) => acc + r.valorFaturado, 0) / (r03Data.length || 1)
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-violet-600 dark:bg-violet-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Modalidade de Cobrança
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r03DistribuicaoModalidade.length} modalidades
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {r03DistribuicaoModalidade.map((item) => (
                      <div key={item.modalidade} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">
                            {getModalidadeLabel(item.modalidade)}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatBRL(item.total)} ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-violet-600 dark:bg-violet-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {r03DistribuicaoModalidade.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* R04 — CUSTOS EXTRAS */}
            {report.id === "r04-custos-extras" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Resumo de Custos
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {r04Data.length} despesas
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Total Despesas</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(r04Data.reduce((acc, r) => acc + r.total, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Pago Liquidado</span>
                      <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatBRL(
                          r04Data.filter((r) => r.status === "PAGO").reduce((acc, r) => acc + r.total, 0)
                        )}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Pendente / Em Aberto</span>
                      <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        {formatBRL(
                          r04Data.filter((r) => r.status === "PENDENTE").reduce((acc, r) => acc + r.total, 0)
                        )}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Custo Médio</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(
                          r04Data.reduce((acc, r) => acc + r.total, 0) / (r04Data.length || 1)
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-rose-600 dark:bg-rose-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Distribuição por Categoria
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r04DistribuicaoCategoria.length} categorias
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {r04DistribuicaoCategoria.map((item) => (
                      <div key={item.categoria} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{item.categoria}</span>
                          <span className="font-mono text-muted-foreground">
                            {formatBRL(item.total)} ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-rose-600 dark:bg-rose-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {r04DistribuicaoCategoria.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* R05 — BANCO DE HORAS */}
            {report.id === "r05-banco-horas" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Resumo do Banco de Horas
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {r05Data.length} colaboradores
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Saldo Líquido</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.saldoMinutos, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Créditos Acumulados</span>
                      <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.creditosMinutos, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Débitos Acumulados</span>
                      <p className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-1">
                        {formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.debitosMinutos, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">A Vencer (Janela 30d)</span>
                      <p className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-1">
                        {formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.aVencer30dMinutos, 0))}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-cyan-600 dark:bg-cyan-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Distribuição por Faixa de Saldo
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r05DistribuicaoFaixa.length} faixas
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {r05DistribuicaoFaixa.map((item) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground">{item.label}</span>
                          <span className="font-mono text-muted-foreground">
                            {item.count} colabs ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-cyan-600 dark:bg-cyan-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {r05DistribuicaoFaixa.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* R07 — SERVIÇOS EXTRAS */}
            {report.id === "r07-servicos-extras" && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Resumo de Serviços Extras
                      </h3>
                    </div>
                    <span className="text-xs font-mono font-semibold text-foreground">
                      {r07Data.length} registros
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Volume de Serviços</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {r07Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} <span className="text-xs font-normal">un</span>
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Faturamento Extra</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(r07Data.reduce((acc, r) => acc + r.total, 0))}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Concluído / Faturado</span>
                      <p className="text-lg font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                        {formatBRL(
                          r07Data
                            .filter((r) => r.pipelineStatus === "CONCLUIDO" || r.pipelineStatus === "FATURADO")
                            .reduce((acc, r) => acc + r.total, 0)
                        )}
                      </p>
                    </div>
                    <div className="bg-muted/40 p-3 rounded-lg border border-border/60">
                      <span className="text-[11px] font-medium text-muted-foreground">Ticket Médio</span>
                      <p className="text-lg font-bold font-mono text-foreground mt-1">
                        {formatBRL(
                          r07Data.reduce((acc, r) => acc + r.total, 0) / (r07Data.length || 1)
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
                  <div className="flex items-center justify-between border-b border-border/40 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                        Distribuição por Serviço
                      </h3>
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {r07DistribuicaoTipo.length} tipos
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {r07DistribuicaoTipo.slice(0, 4).map((item) => (
                      <div key={item.tipoServico} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-foreground truncate max-w-[200px]">
                            {item.tipoServico}
                          </span>
                          <span className="font-mono text-muted-foreground">
                            {formatBRL(item.total)} ({item.percentual.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, item.percentual)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                    {r07DistribuicaoTipo.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">Sem dados no período.</p>
                    )}
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {/* TABELA ANALÍTICA OFICIAL */}
        <section className="bg-card border border-border/80 rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between bg-muted/20">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                Detalhamento Analítico de Registros
              </h3>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              Mostrando {paginatedRows.length} de {activeDataset.length} registros
            </span>
          </div>

          <div className="overflow-x-auto">
            {isLoadingData ? (
              <div className="p-6 space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : paginatedRows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs space-y-1">
                <AlertCircle className="h-6 w-6 mx-auto text-muted-foreground/60 mb-2" />
                <p className="font-medium text-foreground">
                  {report.id === "r05-banco-horas"
                    ? "Nenhum colaborador CLT com Banco de Horas ativo"
                    : "Nenhum registro encontrado"}
                </p>
                <p className="max-w-md mx-auto">
                  {report.id === "r05-banco-horas"
                    ? `A empresa selecionada (${empresaNomeExibicao}) não possui colaboradores sob regime CLT ativos com Banco de Horas habilitado para apuração. Diaristas e intermitentes não são elegíveis a Banco de Horas.`
                    : "Não há dados correspondentes aos filtros selecionados para esta empresa e período."}
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse print-table">
                <thead>
                  <tr className="border-b border-border/80 bg-muted/40 font-semibold text-muted-foreground text-[11px] uppercase tracking-wider">
                    {report.id === "r01-operacoes-volume" && (
                      <>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Código</th>
                        <th className="py-2.5 px-3">Transportadora</th>
                        <th className="py-2.5 px-3">Serviço / Produto</th>
                        <th className="py-2.5 px-3 text-right">Volume</th>
                        <th className="py-2.5 px-3 text-right">Unitário</th>
                        <th className="py-2.5 px-3 text-right">Total Bruto</th>
                        <th className="py-2.5 px-3">Placa / NF</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </>
                    )}
                    {report.id === "r02-fechamento-diaristas" && (
                      <>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Colaborador</th>
                        <th className="py-2.5 px-3">Função</th>
                        <th className="py-2.5 px-3 text-center">Marcação</th>
                        <th className="py-2.5 px-3 text-right">Diárias</th>
                        <th className="py-2.5 px-3 text-right">Valor Base</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3">Lote</th>
                        <th className="py-2.5 px-3 text-center">Status Lote</th>
                      </>
                    )}
                    {report.id === "r03-faturamento-receitas" && (
                      <>
                        <th className="py-2.5 px-3">Competência</th>
                        <th className="py-2.5 px-3">Tomador / Cliente</th>
                        <th className="py-2.5 px-3">Modalidade</th>
                        <th className="py-2.5 px-3">Origem</th>
                        <th className="py-2.5 px-3 text-right">Valor Faturado</th>
                        <th className="py-2.5 px-3">Vencimento</th>
                        <th className="py-2.5 px-3">Recebimento</th>
                        <th className="py-2.5 px-3 text-center">Situação</th>
                      </>
                    )}
                    {report.id === "r04-custos-extras" && (
                      <>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Categoria</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Favorecido</th>
                        <th className="py-2.5 px-3 text-right">Qtd</th>
                        <th className="py-2.5 px-3 text-right">Unitário</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3">Origem Recurso</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </>
                    )}
                    {report.id === "r05-banco-horas" && (
                      <>
                        <th className="py-2.5 px-3">Matrícula</th>
                        <th className="py-2.5 px-3">Colaborador</th>
                        <th className="py-2.5 px-3">Competência</th>
                        <th className="py-2.5 px-3 text-right">Saldo Atual</th>
                        <th className="py-2.5 px-3 text-right">Créditos</th>
                        <th className="py-2.5 px-3 text-right">Débitos</th>
                        <th className="py-2.5 px-3 text-right">A Vencer (30d)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </>
                    )}
                    {report.id === "r07-servicos-extras" && (
                      <>
                        <th className="py-2.5 px-3">Data</th>
                        <th className="py-2.5 px-3">Tipo Serviço</th>
                        <th className="py-2.5 px-3">Descrição</th>
                        <th className="py-2.5 px-3">Tomador / Cliente</th>
                        <th className="py-2.5 px-3 text-right">Quantidade</th>
                        <th className="py-2.5 px-3 text-right">Unitário</th>
                        <th className="py-2.5 px-3 text-right">Total</th>
                        <th className="py-2.5 px-3">Modalidade</th>
                        <th className="py-2.5 px-3 text-center">Pipeline</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {/* R01 ROWS */}
                  {report.id === "r01-operacoes-volume" &&
                    paginatedRows.map((row: OperacaoVolumeRow) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{row.dataOperacao}</td>
                        <td className="py-2 px-3 font-mono font-medium text-foreground">{row.codigoOperacional}</td>
                        <td className="py-2 px-3 font-medium text-foreground">{row.transportadora}</td>
                        <td className="py-2 px-3 text-muted-foreground">{row.tipoServico} - {row.produtoCarga}</td>
                        <td className="py-2 px-3 text-right font-mono font-medium">{row.quantidade.toLocaleString("pt-BR")}</td>
                        <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatBRL(row.valorUnitario)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.totalBruto)}</td>
                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">{row.placa} {row.nfNumero ? `· NF ${row.nfNumero}` : ""}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                  {/* R02 ROWS */}
                  {report.id === "r02-fechamento-diaristas" &&
                    paginatedRows.map((row: DiaristaFechamentoRow) => {
                      const st = getStatusLoteDiaristaLabel(row.statusLote);
                      return (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.dataLancamento}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-foreground">{row.colaboradorNome}</div>
                            <div className="text-[10px] font-mono text-muted-foreground">{row.cpfMascarado}</div>
                          </td>
                          <td className="py-2 px-3 text-muted-foreground">{row.funcao}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {row.codigoMarcacao}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">{row.quantidadeDiarias}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatBRL(row.valorDiariaBase)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.total)}</td>
                          <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{row.loteCodigo}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.color} ${st.border}`}>
                              {st.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}

                  {/* R03 ROWS */}
                  {report.id === "r03-faturamento-receitas" &&
                    paginatedRows.map((row: FaturamentoReceitaRow) => {
                      const sit = getSituacaoDerivadaReceita(row);
                      return (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.competenciaFormatada}</td>
                          <td className="py-2 px-3 font-medium text-foreground">{row.clienteNome}</td>
                          <td className="py-2 px-3 text-muted-foreground">{getModalidadeLabel(row.modalidade)}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.origem}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.valorFaturado)}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.vencimento}</td>
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.dataRecebimento || "—"}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${
                                sit.isAtrasado
                                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              }`}
                            >
                              {sit.descricao}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}

                  {/* R04 ROWS */}
                  {report.id === "r04-custos-extras" &&
                    paginatedRows.map((row: CustoExtraRow) => {
                      const st = getStatusCustoExtraLabel(row.status);
                      return (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.data}</td>
                          <td className="py-2 px-3">
                            <Badge variant="outline" className="text-[10px]">
                              {getCategoriaCustoLabel(row.categoriaCusto)}
                            </Badge>
                          </td>
                          <td className="py-2 px-3 font-medium text-foreground">{row.descricao}</td>
                          <td className="py-2 px-3 text-muted-foreground">{row.favorecidoNome} ({row.favorecidoTipo})</td>
                          <td className="py-2 px-3 text-right font-mono">{row.quantidade}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatBRL(row.valorUnitario)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.total)}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">{row.origemRecurso}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.color} ${st.border}`}>
                              {st.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}

                  {/* R05 ROWS */}
                  {report.id === "r05-banco-horas" &&
                    paginatedRows.map((row: BancoHorasRow) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{row.matricula}</td>
                        <td className="py-2 px-3 font-medium text-foreground">{row.colaboradorNome}</td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">{row.competencia}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{row.saldoFormatado}</td>
                        <td className="py-2 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">{row.creditosFormatado}</td>
                        <td className="py-2 px-3 text-right font-mono text-rose-600 dark:text-rose-400">{row.debitosFormatado}</td>
                        <td className="py-2 px-3 text-right font-mono text-amber-600 dark:text-amber-400">{row.aVencer30dFormatado}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              row.status === "Crítico" || row.status === "Débito"
                                ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                : row.status === "A Vencer"
                                ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            }`}
                          >
                            {row.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                  {/* R07 ROWS */}
                  {report.id === "r07-servicos-extras" &&
                    paginatedRows.map((row: ServicoExtraRow) => {
                      const st = getPipelineStatusServicoExtraLabel(row.pipelineStatus);
                      return (
                        <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-muted-foreground">{row.data}</td>
                          <td className="py-2 px-3 font-medium text-foreground">{row.tipoServico}</td>
                          <td className="py-2 px-3 text-muted-foreground truncate max-w-[200px]">{row.descricao}</td>
                          <td className="py-2 px-3 font-medium text-foreground">{row.tomadorNome}</td>
                          <td className="py-2 px-3 text-right font-mono font-medium">{row.quantidade}</td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">{formatBRL(row.valorUnitario)}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">{formatBRL(row.total)}</td>
                          <td className="py-2 px-3 text-muted-foreground text-[11px]">{getModalidadeLabel(row.modalidadeFinanceira)}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="outline" className={`text-[10px] ${st.bg} ${st.color} ${st.border}`}>
                              {st.label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-border/60 flex items-center justify-between no-print">
              <span className="text-xs text-muted-foreground font-mono">
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2.5 text-xs"
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-7 px-2.5 text-xs"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* RODAPÉ DE CONTROLE DOCUMENTAL */}
        <footer className="mt-8 pt-4 border-t border-border/60 text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>Documento emitido com integridade operacional e isolamento de tenant.</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span>ORBE v2.6.0</span>
            <span>·</span>
            <span>Autenticado ({role})</span>
          </div>
        </footer>
      </div>

      {/* DRAWER ANALÍTICO DE DETALHAMENTO */}
      <Sheet open={Boolean(drawerData?.isOpen)} onOpenChange={(open) => !open && setDrawerData(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {drawerData && (
            <div className="space-y-6 pt-4">
              <SheetHeader>
                <SheetTitle className="text-base font-bold">{drawerData.title}</SheetTitle>
                <SheetDescription className="text-xs">{drawerData.subtitle}</SheetDescription>
              </SheetHeader>

              <div className="bg-muted/40 p-4 rounded-xl border border-border/60 space-y-1">
                <span className="text-xs text-muted-foreground font-medium">{drawerData.metricLabel}</span>
                <p className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {drawerData.metricValue}
                </p>
                <p className="text-xs text-muted-foreground pt-1">{drawerData.description}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Origem Canônica dos Dados
                </h4>
                <div className="p-3 rounded-lg bg-card border border-border/60 font-mono text-xs text-foreground">
                  {drawerData.sourceTable}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Detalhamento dos Critérios
                </h4>
                <div className="space-y-2">
                  {drawerData.breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 text-xs"
                    >
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-mono font-bold text-foreground">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}
