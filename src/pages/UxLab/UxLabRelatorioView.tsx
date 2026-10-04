import React, { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
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
  ArrowUpDown,
  ExternalLink,
  ChevronRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  X,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  RELATORIOS_CATALOGO,
  EMPRESAS_DISPONIVEIS,
  MOCK_R01_DATA,
  MOCK_R05_DATA,
  MOCK_R03_DATA,
  MOCK_R02_DATA,
  MOCK_R04_DATA,
  MOCK_R07_DATA,
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
} from "./relatoriosMockData";

export default function UxLabRelatorioView() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const urlEmpresa = searchParams.get("empresa");
  const urlCompetencia = searchParams.get("competencia");

  const report = useMemo(() => {
    return RELATORIOS_CATALOGO.find((r) => r.id === reportId) || RELATORIOS_CATALOGO[0];
  }, [reportId]);

  // Filtro Estrutural Obrigatório 1: Empresa
  const [empresaId, setEmpresaId] = useState(urlEmpresa || "emp-01");

  // Filtro Estrutural 2: Período / Competência
  const [dataDe, setDataDe] = useState(urlCompetencia ? `${urlCompetencia}-01` : "2026-09-01");
  const [dataAte, setDataAte] = useState(urlCompetencia ? `${urlCompetencia}-30` : "2026-09-30");
  const [competencia, setCompetencia] = useState(urlCompetencia || "2026-09");

  // Filtros Específicos por Relatório
  const [filtroStatus, setFiltroStatus] = useState("all");
  const [filtroTransportadora, setFiltroTransportadora] = useState("all");
  const [filtroModalidade, setFiltroModalidade] = useState("all");
  const [filtroServico, setFiltroServico] = useState("all");

  // Filtros R02 (Diaristas)
  const [filtroCiclo, setFiltroCiclo] = useState("all");
  const [filtroFuncaoDiarista, setFiltroFuncaoDiarista] = useState("all");
  const [filtroStatusDiarista, setFiltroStatusDiarista] = useState("all");

  // Filtros R04 (Custos Extras)
  const [filtroCategoriaCusto, setFiltroCategoriaCusto] = useState("all");
  const [filtroStatusCusto, setFiltroStatusCusto] = useState("all");

  // Filtros R07 (Serviços Extras)
  const [filtroTipoServicoExtra, setFiltroTipoServicoExtra] = useState("all");
  const [filtroPipelineStatusExtra, setFiltroPipelineStatusExtra] = useState("all");

  const empresaSelecionada = useMemo(
    () => EMPRESAS_DISPONIVEIS.find((e) => e.id === empresaId) || EMPRESAS_DISPONIVEIS[0],
    [empresaId]
  );

  // Paginação canônica compacta
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Detecção de filtros ativos (recorte em relação ao padrão)
  React.useEffect(() => {
    if (searchParams.get("print") === "true") {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const hasActiveFilters = useMemo(() => {
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
    report.id,
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
    toast.info("Filtros redefinidos", {
      description: "Os parâmetros temporais e específicos retornaram aos valores padrão.",
    });
  };

  // Reset de página sempre que empresa ou qualquer filtro for alterado
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

  // ----------------------------------------------------
  // DATASETS FILTRADOS
  // ----------------------------------------------------
  const r01Data = useMemo(() => {
    return MOCK_R01_DATA.filter((row) => {
      if (row.empresaId !== empresaId) return false;
      if (dataDe && row.dataOperacao < dataDe) return false;
      if (dataAte && row.dataOperacao > dataAte) return false;
      if (filtroTransportadora !== "all" && row.transportadora !== filtroTransportadora) return false;
      if (filtroServico !== "all" && row.tipoServico !== filtroServico) return false;
      if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
      return true;
    });
  }, [empresaId, dataDe, dataAte, filtroTransportadora, filtroServico, filtroStatus]);

  const r05Data = useMemo(() => {
    return MOCK_R05_DATA.filter((row) => {
      if (row.empresaId !== empresaId) return false;
      if (competencia && row.competencia !== competencia) return false;
      if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
      return true;
    });
  }, [empresaId, competencia, filtroStatus]);

  const r03Data = useMemo(() => {
    return MOCK_R03_DATA.filter((row) => {
      if (row.empresaId !== empresaId) return false;
      if (competencia && row.competencia !== competencia) return false;
      if (filtroModalidade !== "all" && row.modalidade !== filtroModalidade) return false;
      if (filtroStatus !== "all" && row.status !== filtroStatus) return false;
      return true;
    });
  }, [empresaId, competencia, filtroModalidade, filtroStatus]);

  const r02Data = useMemo(() => {
    return MOCK_R02_DATA.filter((row) => {
      if (row.empresaId !== empresaId) return false;
      if (filtroCiclo !== "all" && row.cicloId !== filtroCiclo) return false;
      if (filtroFuncaoDiarista !== "all" && row.funcao !== filtroFuncaoDiarista) return false;
      if (filtroStatusDiarista !== "all" && row.statusLote !== filtroStatusDiarista) return false;
      return true;
    });
  }, [empresaId, filtroCiclo, filtroFuncaoDiarista, filtroStatusDiarista]);

  const r04Data = useMemo(() => {
    return MOCK_R04_DATA.filter((row) => {
      if (row.empresaId !== empresaId) return false;
      if (dataDe && row.data < dataDe) return false;
      if (dataAte && row.data > dataAte) return false;
      if (filtroCategoriaCusto !== "all" && row.categoriaCusto !== filtroCategoriaCusto) return false;
      if (filtroStatusCusto !== "all" && row.status !== filtroStatusCusto) return false;
      return true;
    });
  }, [empresaId, dataDe, dataAte, filtroCategoriaCusto, filtroStatusCusto]);

  const r07Data = useMemo(() => {
    return MOCK_R07_DATA.filter((row) => {
      if (row.empresaId !== empresaId) return false;
      if (dataDe && row.data < dataDe) return false;
      if (dataAte && row.data > dataAte) return false;
      if (filtroTipoServicoExtra !== "all" && row.tipoServico !== filtroTipoServicoExtra) return false;
      if (filtroPipelineStatusExtra !== "all" && row.pipelineStatus !== filtroPipelineStatusExtra) return false;
      return true;
    });
  }, [empresaId, dataDe, dataAte, filtroTipoServicoExtra, filtroPipelineStatusExtra]);

  // ----------------------------------------------------
  // METADADOS DOCUMENTAIS E DISTRIBUIÇÕES ANALÍTICAS
  // ----------------------------------------------------
  const dataEmissaoFormatada = useMemo(() => {
    const agora = new Date();
    const data = agora.toLocaleDateString("pt-BR");
    const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    return `${data} às ${hora}`;
  }, []);

  const competenciaLabel = useMemo(() => {
    if (report.id === "r01-operacoes-volume" || report.id === "r04-custos-extras" || report.id === "r07-servicos-extras") {
      if (dataDe.startsWith("2026-09") && dataAte.startsWith("2026-09")) {
        return "Setembro/2026";
      }
      return `${formatDateBR(dataDe)} a ${formatDateBR(dataAte)}`;
    }
    if (report.id === "r02-fechamento-diaristas") {
      return filtroCiclo === "all" ? "Setembro/2026" : filtroCiclo;
    }
    const [ano, mes] = competencia.split("-");
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const mesIndex = parseInt(mes, 10) - 1;
    return `${meses[mesIndex] || mes}/${ano}`;
  }, [report.id, dataDe, dataAte, filtroCiclo, competencia]);

  const r01DistribuicaoServico = useMemo(() => {
    const map = new Map<string, { tipoServico: string; volume: number; totalBruto: number; count: number }>();
    r01Data.forEach((row) => {
      const existing = map.get(row.tipoServico) || { tipoServico: row.tipoServico, volume: 0, totalBruto: 0, count: 0 };
      existing.volume += row.quantidade;
      existing.totalBruto += row.totalBruto;
      existing.count += 1;
      map.set(row.tipoServico, existing);
    });
    const totalVol = r01Data.reduce((acc, r) => acc + r.quantidade, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalVol > 0 ? (item.volume / totalVol) * 100 : 0,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [r01Data]);

  const r01DistribuicaoTransportadora = useMemo(() => {
    const map = new Map<string, { transportadora: string; volume: number; totalBruto: number; count: number }>();
    r01Data.forEach((row) => {
      const existing = map.get(row.transportadora) || { transportadora: row.transportadora, volume: 0, totalBruto: 0, count: 0 };
      existing.volume += row.quantidade;
      existing.totalBruto += row.totalBruto;
      existing.count += 1;
      map.set(row.transportadora, existing);
    });
    const totalVol = r01Data.reduce((acc, r) => acc + r.quantidade, 0);
    return Array.from(map.values())
      .map((item) => ({
        ...item,
        percentual: totalVol > 0 ? (item.volume / totalVol) * 100 : 0,
      }))
      .sort((a, b) => b.volume - a.volume);
  }, [r01Data]);

  const r01DistribuicaoStatus = useMemo(() => {
    const map = new Map<string, { status: string; count: number; totalBruto: number; volume: number }>();
    r01Data.forEach((row) => {
      const existing = map.get(row.status) || { status: row.status, count: 0, totalBruto: 0, volume: 0 };
      existing.count += 1;
      existing.totalBruto += row.totalBruto;
      existing.volume += row.quantidade;
      map.set(row.status, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [r01Data]);

  // ----------------------------------------------------
  // EXPORTAÇÃO CSV CLIENT-SIDE (UTF-8 BOM, DELIMITADOR ;)
  // ----------------------------------------------------
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    const sanitize = (val: unknown) => `"${String(val ?? "").replaceAll('"', '""')}"`;

    if (report.id === "r01-operacoes-volume") {
      headers = [
        "Data",
        "Código",
        "Unidade",
        "Transportadora",
        "Serviço",
        "Carga",
        "Quantidade",
        "Valor Unitário (R$)",
        "Total Bruto (R$)",
        "Materiais (R$)",
        "ISS (R$)",
        "Placa",
        "NF",
        "Status",
      ];
      rows = r01Data.map((r) => [
        r.dataOperacao,
        r.codigoOperacional,
        r.unidade,
        r.transportadora,
        r.tipoServico,
        r.produtoCarga,
        r.quantidade,
        r.valorUnitario.toFixed(2),
        r.totalBruto.toFixed(2),
        r.materiais.toFixed(2),
        r.iss.toFixed(2),
        r.placa,
        r.nfNumero || "—",
        r.status,
      ]);
    } else if (report.id === "r05-banco-horas") {
      headers = [
        "Matrícula",
        "Colaborador",
        "Competência",
        "Saldo Atual",
        "Créditos",
        "Débitos",
        "A Vencer (30d)",
        "Vencidas",
        "Status",
      ];
      rows = r05Data.map((r) => [
        r.matricula,
        r.colaboradorNome,
        r.competencia,
        r.saldoFormatado,
        r.creditosFormatado,
        r.debitosFormatado,
        r.aVencer30dFormatado,
        r.vencidasFormatado,
        r.status,
      ]);
    } else if (report.id === "r03-faturamento-receitas") {
      headers = [
        "Competência",
        "Cliente",
        "Modalidade",
        "Origem",
        "Valor Faturado (R$)",
        "Vencimento",
        "Data Recebimento",
        "Status Persistido",
        "Situação (Derivada)",
      ];
      rows = r03Data.map((r) => [
        r.competenciaFormatada,
        r.clienteNome,
        getModalidadeLabel(r.modalidade),
        r.origem,
        r.valorFaturado.toFixed(2),
        r.vencimento,
        r.dataRecebimento || "—",
        getStatusReceitaLabel(r.status),
        getSituacaoDerivadaReceita(r).descricao,
      ]);
    } else if (report.id === "r02-fechamento-diaristas") {
      headers = [
        "Data",
        "Colaborador",
        "CPF",
        "Função",
        "Código",
        "Quantidade de Diárias",
        "Valor da Diária (R$)",
        "Total (R$)",
        "Lote",
        "Status do Lote",
      ];
      rows = r02Data.map((r) => [
        r.dataLancamento,
        r.colaboradorNome,
        r.cpfMascarado,
        r.funcao,
        r.codigoMarcacao,
        r.quantidadeDiarias,
        r.valorDiariaBase.toFixed(2),
        r.total.toFixed(2),
        r.loteCodigo,
        getStatusLoteDiaristaLabel(r.statusLote).label,
      ]);
    } else if (report.id === "r04-custos-extras") {
      headers = [
        "Data",
        "Unidade",
        "Categoria",
        "Descrição",
        "Favorecido",
        "Tipo Favorecido",
        "Quantidade",
        "Valor Unitário (R$)",
        "Total (R$)",
        "Origem do Recurso",
        "Lançador",
        "Status",
      ];
      rows = r04Data.map((r) => [
        r.data,
        r.unidade,
        getCategoriaCustoLabel(r.categoriaCusto),
        r.descricao,
        r.favorecidoNome,
        r.favorecidoTipo,
        r.quantidade,
        r.valorUnitario.toFixed(2),
        r.total.toFixed(2),
        r.origemRecurso,
        r.lancadorNome,
        getStatusCustoExtraLabel(r.status).label,
      ]);
    } else if (report.id === "r07-servicos-extras") {
      headers = [
        "Data",
        "Tipo de Serviço",
        "Descrição",
        "Cliente / Tomador",
        "Quantidade",
        "Valor Unitário (R$)",
        "Total (R$)",
        "Modalidade Financeira",
        "NF",
        "Status Pipeline",
      ];
      rows = r07Data.map((r) => [
        r.data,
        r.tipoServico,
        r.descricao,
        r.tomadorNome,
        r.quantidade,
        r.valorUnitario.toFixed(2),
        r.total.toFixed(2),
        r.modalidadeFinanceira,
        r.nfNumero || "—",
        getPipelineStatusServicoExtraLabel(r.pipelineStatus).label,
      ]);
    } else {
      toast.info("Relatório não suportado.");
      return;
    }

    const csvContent =
      "\uFEFF" +
      [headers.map(sanitize).join(";"), ...rows.map((row) => row.map(sanitize).join(";"))].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${report.code}_${empresaSelecionada.name.slice(0, 10).trim()}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exportado com sucesso!", {
      description: `Arquivo gerado com ${rows.length} registros respeitando os filtros ativos.`,
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSidebarSelect = (id: string, label: string) => {
    if (id === "relatorios") {
      navigate("/ux-lab/relatorios");
      return;
    }
    if (id === "dashboard") {
      navigate("/ux-lab");
      return;
    }
    if (id === "torre-operacional") {
      navigate("/ux-lab/torre");
      return;
    }
    if (id === "operacoes-volume") {
      navigate("/ux-lab/operacoes-volume");
      return;
    }
    if (id === "dre") {
      navigate("/ux-lab/dre");
      return;
    }
    toast.info(`Módulo em planejamento: ${label}`, {
      description: "Este módulo especialista será prototipado em sua própria fase do UX Lab.",
    });
  };

  return (
    <UxLabShell
      activeItem="relatorios"
      onSelectItem={handleSidebarSelect}
      title={report.title}
      subtitle={report.description}
      empresa={empresaId}
      onEmpresaChange={setEmpresaId}
      competencia={competencia}
      onCompetenciaChange={setCompetencia}
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
            to={`/ux-lab/relatorios?empresa=${empresaId}&competencia=${competencia}`}
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

        {/* ============================================================ */}
        {/* FAIXA DOCUMENTAL OFICIAL (SEM H1 DUPLICADO)                  */}
        {/* ============================================================ */}
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
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-muted-foreground pt-0.5">
                <span className="font-semibold text-foreground">ESC Logística</span>
                <span className="text-border">·</span>
                <span>
                  Empresa:{" "}
                  <strong className="text-foreground font-medium">
                    {empresaSelecionada.name.replace(/^ESC LOG — /, "")}
                  </strong>
                </span>
                <span className="text-border">·</span>
                <span>
                  Competência:{" "}
                  <strong className="text-foreground font-medium">
                    {competenciaLabel}
                  </strong>
                </span>
                <span className="text-border">·</span>
                <span>
                  Emitido em:{" "}
                  <strong className="text-foreground font-medium font-mono">
                    {dataEmissaoFormatada}
                  </strong>
                </span>
              </div>
            </div>

            {/* Ações Documentais Diretas e Únicas */}
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
                Empresa: {empresaSelecionada.name} ({empresaSelecionada.document})
              </p>
            </div>
            <div className="text-right text-xs text-gray-500">
              <p>Gerado em: {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</p>
              <p>
                Período:{" "}
                {report.id === "r01-operacoes-volume" ||
                report.id === "r04-custos-extras" ||
                report.id === "r07-servicos-extras"
                  ? `${dataDe} a ${dataAte}`
                  : report.id === "r02-fechamento-diaristas"
                  ? (filtroCiclo === "all" ? "Todos os Ciclos da Empresa" : filtroCiclo)
                  : competencia}
              </p>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS ESTRUTURAIS — UMA LINHA EM DESKTOP PARA R01 */}
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

          <div className={report.id === "r01-operacoes-volume" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5"}>
            {/* 1. Empresa (Obrigatória em todos) */}
            <div className="space-y-1">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span>Empresa / Filial</span>
              </label>
              <Select value={empresaId} onValueChange={setEmpresaId}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {EMPRESAS_DISPONIVEIS.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs">
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. Parâmetro Temporal Semântico */}
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
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>Ciclo / Período Semanal</span>
                </label>
                <Select value={filtroCiclo} onValueChange={setFiltroCiclo}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Selecione o ciclo..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todos os Ciclos</SelectItem>
                    <SelectItem value="ciclo-39-2026" className="text-xs">Ciclo 39/2026 (21/09 a 27/09)</SelectItem>
                    <SelectItem value="ciclo-38-2026" className="text-xs">Ciclo 38/2026 (14/09 a 20/09)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span>Competência (Mês/Ano)</span>
                </label>
                <Select value={competencia} onValueChange={setCompetencia}>
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue placeholder="Competência..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2026-09" className="text-xs">Setembro / 2026</SelectItem>
                    <SelectItem value="2026-08" className="text-xs">Agosto / 2026</SelectItem>
                    <SelectItem value="2026-07" className="text-xs">Julho / 2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 3. Filtros Específicos por Entidade */}
            {report.id === "r01-operacoes-volume" && (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Serviço
                  </label>
                  <Select value={filtroServico} onValueChange={setFiltroServico}>
                    <SelectTrigger className="h-8 text-xs bg-background">
                      <SelectValue placeholder="Todos os serviços" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Serviços</SelectItem>
                      <SelectItem value="Descarga" className="text-xs">Descarga</SelectItem>
                      <SelectItem value="Carga" className="text-xs">Carga</SelectItem>
                      <SelectItem value="Transbordo" className="text-xs">Transbordo</SelectItem>
                      <SelectItem value="Movimentação" className="text-xs">Movimentação</SelectItem>
                      <SelectItem value="Separação" className="text-xs">Separação</SelectItem>
                      <SelectItem value="Apoio Operacional" className="text-xs">Apoio Operacional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Status
                  </label>
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
                      <SelectItem value="RECEBIDO" className="text-xs">Recebido</SelectItem>
                      <SelectItem value="EM_RESTRICAO" className="text-xs">Em Restrição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {report.id === "r02-fechamento-diaristas" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Função</label>
                  <Select value={filtroFuncaoDiarista} onValueChange={setFiltroFuncaoDiarista}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Todas as funções" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todas as Funções</SelectItem>
                      <SelectItem value="Diarista" className="text-xs">Diarista</SelectItem>
                      <SelectItem value="Auxiliar de carga" className="text-xs">Auxiliar de carga</SelectItem>
                      <SelectItem value="Ajudante" className="text-xs">Ajudante</SelectItem>
                      <SelectItem value="Conferente" className="text-xs">Conferente</SelectItem>
                      <SelectItem value="Operador eventual" className="text-xs">Operador eventual</SelectItem>
                      <SelectItem value="Serviço extra" className="text-xs">Serviço extra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Status do Lote</label>
                  <Select value={filtroStatusDiarista} onValueChange={setFiltroStatusDiarista}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                      <SelectItem value="pago" className="text-xs">Pago</SelectItem>
                      <SelectItem value="enviado_financeiro" className="text-xs">Enviado Financeiro</SelectItem>
                      <SelectItem value="fechado_para_pagamento" className="text-xs">Fechado p/ Pgto</SelectItem>
                      <SelectItem value="em_aberto" className="text-xs">Em Aberto</SelectItem>
                      <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {report.id === "r04-custos-extras" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Categoria de Custo</label>
                  <Select value={filtroCategoriaCusto} onValueChange={setFiltroCategoriaCusto}>
                    <SelectTrigger className="h-9 text-xs bg-background">
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
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Status do Pagamento</label>
                  <Select value={filtroStatusCusto} onValueChange={setFiltroStatusCusto}>
                    <SelectTrigger className="h-9 text-xs bg-background">
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

            {report.id === "r07-servicos-extras" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Tipo de Serviço</label>
                  <Select value={filtroTipoServicoExtra} onValueChange={setFiltroTipoServicoExtra}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Todos os serviços" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Serviços</SelectItem>
                      <SelectItem value="Conserto de Pallets" className="text-xs">Conserto de Pallets</SelectItem>
                      <SelectItem value="Transbordo de Carga" className="text-xs">Transbordo de Carga</SelectItem>
                      <SelectItem value="Pintura de Pallets" className="text-xs">Pintura de Pallets</SelectItem>
                      <SelectItem value="Enlonamento de Carga" className="text-xs">Enlonamento de Carga</SelectItem>
                      <SelectItem value="Montagem de Estrutura" className="text-xs">Montagem de Estrutura</SelectItem>
                      <SelectItem value="Apoio Operacional Noturno" className="text-xs">Apoio Operacional Noturno</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Status do Pipeline</label>
                  <Select value={filtroPipelineStatusExtra} onValueChange={setFiltroPipelineStatusExtra}>
                    <SelectTrigger className="h-9 text-xs bg-background">
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">Todos os Status</SelectItem>
                      <SelectItem value="CONCLUIDO" className="text-xs">Concluído</SelectItem>
                      <SelectItem value="FATURADO" className="text-xs">Faturado</SelectItem>
                      <SelectItem value="APROVADO_FINANCEIRO" className="text-xs">Aprov. Financeiro</SelectItem>
                      <SelectItem value="APROVADO_RH" className="text-xs">Aprovado RH</SelectItem>
                      <SelectItem value="PENDENTE" className="text-xs">Pendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {report.id === "r05-banco-horas" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Situação de Risco</label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                  <SelectTrigger className="h-9 text-xs bg-background">
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

            {report.id === "r03-faturamento-receitas" && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Modalidade</label>
                  <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
                    <SelectTrigger className="h-9 text-xs bg-background">
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
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">Status Financeiro (Persistido)</label>
                  <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                    <SelectTrigger className="h-9 text-xs bg-background">
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
                      <SelectItem value="cancelado" className="text-xs">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ============================================================ */}
        {/* FAIXA ANALÍTICA INTEGRADA 50 / 50 (PILOTO OFICIAL R01)       */}
        {/* ============================================================ */}
        {report.status === "ready" && report.id === "r01-operacoes-volume" && (
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* -------------------------------------------------------- */}
            {/* COLUNA ESQUERDA (50%) — RESUMO DO PERÍODO                */}
            {/* -------------------------------------------------------- */}
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
                  <span className="text-border">·</span>
                  <span>{r01Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} unidades</span>
                </div>
              </div>

              {/* Grid 2x2 de Indicadores Compactos */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* Linha 1 */}
                <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total de Operações
                  </span>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {r01Data.length}
                  </div>
                </div>

                <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Volume Movimentado
                  </span>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {r01Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")}{" "}
                    <span className="text-xs font-normal text-muted-foreground">un</span>
                  </div>
                </div>

                {/* Linha 2 */}
                <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Total Bruto Apurado
                  </span>
                  <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r01Data.reduce((acc, r) => acc + r.totalBruto, 0)
                    )}
                  </div>
                </div>

                <div className="bg-muted/20 border border-border/60 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Materiais Agregados
                  </span>
                  <div className="text-xl font-bold font-mono text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r01Data.reduce((acc, r) => acc + r.materiais, 0)
                    )}
                  </div>
                </div>
              </div>

              {/* Linha sintética com ISS e métricas complementares */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>ISS Retido Estimado:</span>
                <span className="font-mono font-medium text-foreground">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                    r01Data.reduce((acc, r) => acc + r.iss, 0)
                  )}
                </span>
              </div>
            </div>

            {/* -------------------------------------------------------- */}
            {/* COLUNA DIREITA (50%) — ANÁLISE / DISTRIBUIÇÃO            */}
            {/* -------------------------------------------------------- */}
            <div className="bg-card border border-border/80 rounded-xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Análise / Distribuição
                  </h3>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {r01Data.length} registros analisados
                </span>
              </div>

              {/* Linha 1 da Coluna Direita: Serviço + Cliente lado a lado */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Por Tipo de Serviço */}
                <div className="p-2.5 rounded-lg border border-border/50 bg-muted/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                      Por Tipo de Serviço
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {r01DistribuicaoServico.length} tipos
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {r01DistribuicaoServico.slice(0, 3).map((item) => (
                      <div key={item.tipoServico} className="space-y-0.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-medium text-foreground truncate max-w-[110px]" title={item.tipoServico}>
                            {item.tipoServico}
                          </span>
                          <span className="font-mono text-muted-foreground text-[10px]">
                            {item.volume.toLocaleString("pt-BR")} ({item.percentual.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(5, item.percentual))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Por Cliente / Transportadora */}
                <div className="p-2.5 rounded-lg border border-border/50 bg-muted/15 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                      Por Cliente / Transportadora
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground">
                      {r01DistribuicaoTransportadora.length} tomadores
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {r01DistribuicaoTransportadora.slice(0, 3).map((item) => (
                      <div key={item.transportadora} className="space-y-0.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <span className="font-medium text-foreground truncate max-w-[110px]" title={item.transportadora}>
                            {item.transportadora}
                          </span>
                          <span className="font-mono text-muted-foreground text-[10px]">
                            {item.volume.toLocaleString("pt-BR")} ({item.percentual.toFixed(0)}%)
                          </span>
                        </div>
                        <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-400 dark:bg-blue-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, Math.max(5, item.percentual))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Linha 2 da Coluna Direita: Status Operacional (100% da coluna direita) */}
              <div className="p-2.5 rounded-lg border border-border/50 bg-muted/15 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                    Status Operacional
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    distribuição por estágio
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {r01DistribuicaoStatus.map((item) => (
                    <div
                      key={item.status}
                      className="p-1.5 rounded-md bg-background border border-border/40 text-center space-y-0.5"
                    >
                      <StatusBadge status={item.status} />
                      <div className="text-[10px] font-mono font-bold text-foreground">
                        {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(
                          item.totalBruto
                        )}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground">
                        {item.count} {item.count === 1 ? "op" : "ops"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* RESUMO DOS DEMAIS RELATÓRIOS (PRESERVADOS ATÉ SUAS RESPECTIVAS FASES) */}
        {report.status === "ready" && report.id !== "r01-operacoes-volume" && (
          <section className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Resumo do Período
                </h3>
              </div>

              {/* Faixa sintética com separadores verticais no estilo editorial */}
              <div className="flex flex-wrap items-center gap-x-2 text-xs font-mono text-muted-foreground">
                {report.id === "r05-banco-horas" && (
                  <>
                    <span className="font-semibold text-foreground">{r05Data.length} colaboradores</span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-primary">
                      Saldo {formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.saldoMinutos, 0))}
                    </span>
                    <span className="text-border">|</span>
                    <span className="text-amber-600 dark:text-amber-400">
                      {formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.aVencer30dMinutos, 0))} em alerta
                    </span>
                  </>
                )}
                {report.id === "r03-faturamento-receitas" && (
                  <>
                    <span className="font-semibold text-foreground">{r03Data.length} faturas</span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        r03Data.reduce((acc, r) => acc + r.valorFaturado, 0)
                      )} faturado
                    </span>
                  </>
                )}
                {report.id === "r02-fechamento-diaristas" && (
                  <>
                    <span className="font-semibold text-foreground">
                      {new Set(r02Data.map((r) => r.colaboradorNome)).size} diaristas
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-foreground">
                      {r02Data.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)} diárias
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        r02Data.reduce((acc, r) => acc + r.total, 0)
                      )}
                    </span>
                  </>
                )}
                {report.id === "r04-custos-extras" && (
                  <>
                    <span className="font-semibold text-foreground">{r04Data.length} custos</span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        r04Data.reduce((acc, r) => acc + r.total, 0)
                      )} despesas
                    </span>
                  </>
                )}
                {report.id === "r07-servicos-extras" && (
                  <>
                    <span className="font-semibold text-foreground">{r07Data.length} serviços extras</span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-foreground">
                      {r07Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} unidades
                    </span>
                    <span className="text-border">|</span>
                    <span className="font-semibold text-primary">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                        r07Data.reduce((acc, r) => acc + r.total, 0)
                      )}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Totalizadores Contextuais */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {report.id === "r05-banco-horas" && (
                <>
                  <KpiSummaryBox label="Colaboradores no Período" value={String(r05Data.length)} />
                  <KpiSummaryBox
                    label="Saldo Líquido da Empresa"
                    value={formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.saldoMinutos, 0))}
                    highlight
                  />
                  <KpiSummaryBox
                    label="Horas em Alerta (30d)"
                    value={formatMinutosToHourString(r05Data.reduce((acc, r) => acc + r.aVencer30dMinutos, 0))}
                    status="warning"
                  />
                  <KpiSummaryBox
                    label="Débito Crítico"
                    value={`${r05Data.filter((r) => r.status === "Débito Crítico").length} colab.`}
                    status="danger"
                  />
                </>
              )}

              {report.id === "r03-faturamento-receitas" && (
                <>
                  <KpiSummaryBox label="Faturas Emitidas" value={String(r03Data.length)} />
                  <KpiSummaryBox
                    label="Faturamento Total"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r03Data.reduce((acc, r) => acc + r.valorFaturado, 0)
                    )}
                    highlight
                  />
                  <KpiSummaryBox
                    label="Recebido / Liquidado"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r03Data
                        .filter((r) => r.status === "recebido" || r.status === "conciliado")
                        .reduce((acc, r) => acc + r.valorFaturado, 0)
                    )}
                    status="success"
                  />
                  <KpiSummaryBox
                    label="Aguardando Liquidação"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r03Data
                        .filter((r) => r.status !== "recebido" && r.status !== "conciliado" && r.status !== "cancelado")
                        .reduce((acc, r) => acc + r.valorFaturado, 0)
                    )}
                  />
                </>
              )}

              {report.id === "r02-fechamento-diaristas" && (
                <>
                  <KpiSummaryBox
                    label="Diaristas no Período"
                    value={`${new Set(r02Data.map((r) => r.colaboradorNome)).size} colab.`}
                  />
                  <KpiSummaryBox
                    label="Total de Diárias"
                    value={`${r02Data.reduce((acc, r) => acc + r.quantidadeDiarias, 0).toFixed(1)} diárias`}
                  />
                  <KpiSummaryBox
                    label="Valor Consolidado"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r02Data.reduce((acc, r) => acc + r.total, 0)
                    )}
                    highlight
                  />
                  <KpiSummaryBox
                    label="Lotes de Pagamento"
                    value={`${new Set(r02Data.map((r) => r.loteCodigo)).size} lotes`}
                  />
                </>
              )}

              {report.id === "r04-custos-extras" && (
                <>
                  <KpiSummaryBox label="Lançamentos de Custos" value={String(r04Data.length)} />
                  <KpiSummaryBox
                    label="Despesas Consolidadas"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r04Data.reduce((acc, r) => acc + r.total, 0)
                    )}
                    highlight
                  />
                  <KpiSummaryBox
                    label="Categorias Ativas"
                    value={`${new Set(r04Data.map((r) => r.categoriaCusto)).size} categ.`}
                  />
                  <KpiSummaryBox
                    label="Despesas Pendentes"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r04Data
                        .filter((r) => r.status === "PENDENTE" || r.status === "ATRASADO")
                        .reduce((acc, r) => acc + r.total, 0)
                    )}
                    status="warning"
                  />
                </>
              )}

              {report.id === "r07-servicos-extras" && (
                <>
                  <KpiSummaryBox label="Total de Serviços" value={String(r07Data.length)} />
                  <KpiSummaryBox
                    label="Volume / Unidades"
                    value={`${r07Data.reduce((acc, r) => acc + r.quantidade, 0).toLocaleString("pt-BR")} unid.`}
                  />
                  <KpiSummaryBox
                    label="Total Operacional"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r07Data.reduce((acc, r) => acc + r.total, 0)
                    )}
                    highlight
                  />
                  <KpiSummaryBox
                    label="Faturado / Concluído"
                    value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
                      r07Data
                        .filter((r) => r.pipelineStatus === "FATURADO" || r.pipelineStatus === "CONCLUIDO")
                        .reduce((acc, r) => acc + r.total, 0)
                    )}
                    status="success"
                  />
                </>
              )}
            </div>
          </section>
        )}

        {/* ============================================================ */}
        {/* CORPO DO RELATÓRIO (TABELA CANÔNICA OU ESTADO DE PREPARAÇÃO) */}
        {/* ============================================================ */}
        {report.status === "in_preparation" ? (
          <section className="bg-card border border-border/80 rounded-xl p-10 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto border border-primary/20">
              <Clock className="h-6 w-6" />
            </div>
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-base font-bold text-foreground font-display">
                Protótipo em Preparação no UX Lab
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Este relatório foi <strong>auditado e estruturalmente homologado</strong> na Fase 01.1. O dataset canônico está sendo modelado para a próxima iteração.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground border border-border/60 bg-muted/30 px-3 py-1.5 rounded-lg">
              <Info className="h-3.5 w-3.5 text-primary" />
              <span>Campos e relacionamentos validados no schema PostgreSQL.</span>
            </div>
          </section>
        ) : (
          <section className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
            {/* Header da Tabela */}
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 no-print">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="h-4 w-4 text-primary" />
                <div>
                  <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Registros que Compõem o Relatório
                  </h3>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">Dataset de Consulta</span>
                    <span>·</span>
                    <span>Registros oficiais apurados na competência</span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium font-mono">
                {report.id === "r01-operacoes-volume" && `${r01Data.length} operações encontradas`}
                {report.id === "r05-banco-horas" && `${r05Data.length} colaboradores apurados`}
                {report.id === "r03-faturamento-receitas" && `${r03Data.length} faturas localizadas`}
                {report.id === "r02-fechamento-diaristas" && `${r02Data.length} apontamentos de diaristas`}
                {report.id === "r04-custos-extras" && `${r04Data.length} custos extras registrados`}
                {report.id === "r07-servicos-extras" && `${r07Data.length} serviços extras apurados`}
              </span>
            </div>

            {/* TABELA R01 — OPERAÇÕES POR VOLUME */}
            {report.id === "r01-operacoes-volume" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse print-table text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">Data</th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">
                        <span className="hidden sm:inline">Operação / </span>
                        <span>Código</span>
                      </th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">Unidade</th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">
                        <span className="hidden sm:inline">Cliente / </span>
                        <span>Transportadora</span>
                      </th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">Serviço</th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">Produto / Carga</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">
                        <span>Volume</span>{" "}
                        <span className="text-[9px] text-muted-foreground font-normal">(Qtd)</span>
                      </th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Unitário</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap font-bold text-foreground">Total Bruto</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">Materiais</th>
                      <th className="py-2 px-2.5 text-right whitespace-nowrap">ISS</th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">Placa</th>
                      <th className="py-2 px-2.5 whitespace-nowrap text-left">NF</th>
                      <th className="py-2 px-2.5 text-center whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {r01Data.map((row, index) => {
                      const isVisible = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE;
                      return (
                        <tr
                          key={row.id}
                          className={`${isVisible ? "" : "hidden print:table-row"} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="py-2 px-2.5 whitespace-nowrap text-muted-foreground font-mono text-left">
                            {formatDateBR(row.dataOperacao)}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap font-mono font-medium text-foreground text-left">
                            {row.codigoOperacional}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap text-left">{row.unidade}</td>
                          <td className="py-2 px-2.5 whitespace-nowrap font-medium text-foreground text-left truncate max-w-[160px]" title={row.transportadora}>
                            {row.transportadora}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap text-left">{row.tipoServico}</td>
                          <td className="py-2 px-2.5 whitespace-nowrap text-muted-foreground text-left truncate max-w-[150px]" title={row.produtoCarga}>
                            {row.produtoCarga}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-medium">
                            {row.quantidade.toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-muted-foreground">
                            R$ {row.valorUnitario.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono font-bold text-foreground">
                            R$ {row.totalBruto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-muted-foreground">
                            {row.materiais > 0 ? `R$ ${row.materiais.toFixed(2)}` : "-"}
                          </td>
                          <td className="py-2 px-2.5 text-right font-mono text-muted-foreground">
                            R$ {row.iss.toFixed(2)}
                          </td>
                          <td className="py-2 px-2.5 whitespace-nowrap font-mono text-[11px] text-left">{row.placa}</td>
                          <td className="py-2 px-2.5 whitespace-nowrap font-mono text-[11px] text-left">
                            {row.nfNumero ? (
                              <span className="font-semibold text-foreground">{row.nfNumero}</span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="py-2 px-2.5 text-center whitespace-nowrap">
                            <StatusBadge status={row.status} />
                          </td>
                        </tr>
                      );
                    })}
                    {r01Data.length === 0 && (
                      <EmptyReportState colSpan={14} onClearFilters={handleClearFilters} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TABELA R05 — BANCO DE HORAS */}
            {report.id === "r05-banco-horas" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse print-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-4 whitespace-nowrap">Matrícula</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Colaborador</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap font-bold text-foreground">Saldo Atual</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap text-emerald-600 dark:text-emerald-400">Créditos</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap text-rose-600 dark:text-rose-400">Débitos</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap text-amber-600 dark:text-amber-400">A Vencer (30d)</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap text-muted-foreground">Vencidas</th>
                      <th className="py-2.5 px-4 text-center whitespace-nowrap">Situação de Risco</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {r05Data.map((row, index) => {
                      const isVisible = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE;
                      return (
                        <tr
                          key={row.id}
                          className={`${isVisible ? "" : "hidden print:table-row"} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap font-mono text-muted-foreground">
                            {row.matricula}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap font-medium text-foreground">
                            {row.colaboradorNome}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                            {row.saldoFormatado}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-emerald-600 dark:text-emerald-400">
                            {row.creditosFormatado}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-rose-600 dark:text-rose-400">
                            {row.debitosFormatado}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-medium text-amber-600 dark:text-amber-400">
                            {row.aVencer30dFormatado}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                            {row.vencidasFormatado}
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <BhStatusBadge status={row.status} />
                          </td>
                        </tr>
                      );
                    })}
                    {r05Data.length === 0 && (
                      <EmptyReportState colSpan={8} onClearFilters={handleClearFilters} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TABELA R03 — FATURAMENTO E RECEITAS */}
            {report.id === "r03-faturamento-receitas" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse print-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-4 whitespace-nowrap">Competência</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Cliente Tomador</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Modalidade</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Origem do Faturamento</th>
                      <th className="py-2.5 px-4 text-right whitespace-nowrap font-bold text-foreground">Valor Faturado</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Vencimento</th>
                      <th className="py-2.5 px-4 whitespace-nowrap">Recebimento</th>
                      <th className="py-2.5 px-4 text-center whitespace-nowrap">Status Financeiro</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {r03Data.map((row, index) => {
                      const isVisible = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE;
                      return (
                        <tr
                          key={row.id}
                          className={`${isVisible ? "" : "hidden print:table-row"} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="py-2.5 px-4 whitespace-nowrap font-mono text-muted-foreground">
                            {row.competenciaFormatada}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap font-medium text-foreground">
                            {row.clienteNome}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-muted text-foreground border border-border/60">
                              {getModalidadeLabel(row.modalidade)}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <Badge variant="outline" className="text-[10px] font-normal">
                              {row.origem}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-foreground">
                            R$ {row.valorFaturado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap font-mono text-muted-foreground">
                            {formatDateBR(row.vencimento)}
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap font-mono text-muted-foreground">
                            {row.dataRecebimento ? formatDateBR(row.dataRecebimento) : "—"}
                          </td>
                          <td className="py-2.5 px-4 text-center whitespace-nowrap">
                            <FinanceiroStatusBadge
                              status={row.status}
                              isAtrasado={getSituacaoDerivadaReceita(row).isAtrasado}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {r03Data.length === 0 && (
                      <EmptyReportState colSpan={8} onClearFilters={handleClearFilters} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TABELA R02 — FECHAMENTO DE DIARISTAS */}
            {report.id === "r02-fechamento-diaristas" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse print-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3 whitespace-nowrap">Data</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Colaborador</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">CPF</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Função</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Código</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Qtd Diárias</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Valor Diária</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-foreground">Total</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Lote</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Status do Lote</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {r02Data.map((row, index) => {
                      const isVisible = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE;
                      return (
                        <tr
                          key={row.id}
                          className={`${isVisible ? "" : "hidden print:table-row"} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-muted-foreground">
                            {formatDateBR(row.dataLancamento)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-medium text-foreground">
                            {row.colaboradorNome}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-muted-foreground">
                            {row.cpfMascarado}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-foreground border border-border/60">
                              {row.funcao}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-foreground">
                            {row.codigoMarcacao}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {row.quantidadeDiarias.toFixed(1)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            R$ {row.valorDiariaBase.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                            R$ {row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                            {row.loteCodigo}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <Badge className={`${getStatusLoteDiaristaLabel(row.statusLote).className} text-[10px]`}>
                              {getStatusLoteDiaristaLabel(row.statusLote).label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {r02Data.length === 0 && (
                      <EmptyReportState colSpan={10} onClearFilters={handleClearFilters} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TABELA R04 — CUSTOS EXTRAS OPERACIONAIS (DESPESAS) */}
            {report.id === "r04-custos-extras" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse print-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3 whitespace-nowrap">Data</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Unidade</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Categoria</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Descrição</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Favorecido</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Qtd</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Valor Unit.</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-foreground">Total</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Origem Recurso</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Lançador</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {r04Data.map((row, index) => {
                      const isVisible = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE;
                      return (
                        <tr
                          key={row.id}
                          className={`${isVisible ? "" : "hidden print:table-row"} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-muted-foreground">
                            {formatDateBR(row.data)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-foreground font-medium">
                            {row.unidade}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted text-foreground border border-border/60">
                              {getCategoriaCustoLabel(row.categoriaCusto)}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-foreground">
                            {row.descricao}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground">{row.favorecidoNome}</span>
                              <Badge variant="outline" className="text-[9px] px-1 py-0 text-muted-foreground">
                                {row.favorecidoTipo}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {row.quantidade}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            R$ {row.valorUnitario.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                            R$ {row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                            <span className="bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                              {row.origemRecurso}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap text-muted-foreground text-[11px]">
                            {row.lancadorNome}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <Badge className={`${getStatusCustoExtraLabel(row.status).className} text-[10px]`}>
                              {getStatusCustoExtraLabel(row.status).label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {r04Data.length === 0 && (
                      <EmptyReportState colSpan={11} onClearFilters={handleClearFilters} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TABELA R07 — ANALÍTICO DE SERVIÇOS EXTRAS */}
            {report.id === "r07-servicos-extras" && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse print-table">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      <th className="py-2.5 px-3 whitespace-nowrap">Data</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Tipo de Serviço</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Descrição</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Cliente / Tomador</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Qtd</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Valor Unit.</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap font-bold text-foreground">Total</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Modalidade</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">NF</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap">Status Pipeline</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60 text-xs">
                    {r07Data.map((row, index) => {
                      const isVisible = index >= (currentPage - 1) * PAGE_SIZE && index < currentPage * PAGE_SIZE;
                      return (
                        <tr
                          key={row.id}
                          className={`${isVisible ? "" : "hidden print:table-row"} hover:bg-muted/30 transition-colors`}
                        >
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-muted-foreground">
                            {formatDateBR(row.data)}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-foreground border border-border/60">
                              {row.tipoServico}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-foreground">
                            {row.descricao}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-medium text-foreground">
                            {row.tomadorNome}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-medium">
                            {row.quantidade.toLocaleString("pt-BR")}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                            R$ {row.valorUnitario.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                            R$ {row.total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border/60">
                              {getModalidadeLabel(row.modalidadeFinanceira)}
                            </span>
                          </td>
                          <td className="py-2 px-3 whitespace-nowrap font-mono text-[11px]">
                            {row.nfNumero ? (
                              <span className="font-semibold text-foreground">{row.nfNumero}</span>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <Badge className={`${getPipelineStatusServicoExtraLabel(row.pipelineStatus).className} text-[10px]`}>
                              {getPipelineStatusServicoExtraLabel(row.pipelineStatus).label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                    {r07Data.length === 0 && (
                      <EmptyReportState colSpan={10} onClearFilters={handleClearFilters} />
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Rodapé da Tabela com Paginação Compacta Canônica */}
            <TablePaginationFooter
              totalRows={
                report.id === "r01-operacoes-volume"
                  ? r01Data.length
                  : report.id === "r05-banco-horas"
                  ? r05Data.length
                  : report.id === "r03-faturamento-receitas"
                  ? r03Data.length
                  : report.id === "r02-fechamento-diaristas"
                  ? r02Data.length
                  : report.id === "r04-custos-extras"
                  ? r04Data.length
                  : r07Data.length
              }
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              onPageChange={setCurrentPage}
              empresaNome={empresaSelecionada.name}
            />
          </section>
        )}

        {/* ============================================================ */}
        {/* CONTROLE DOCUMENTAL COMPACTO (FINAL DO DOCUMENTO)            */}
        {/* ============================================================ */}
        {report.status === "ready" && (
          <section className="bg-card border border-border/80 rounded-xl px-4 py-3 shadow-2xs space-y-2 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-border/40 pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <h4 className="text-[10px] font-bold uppercase tracking-wider text-foreground">
                  Controle Documental
                </h4>
                <span className="text-border">·</span>
                <span className="font-mono text-[11px] text-muted-foreground font-semibold">
                  {report.code} ·{" "}
                  {report.id === "r01-operacoes-volume"
                    ? `${r01Data.length} operações apuradas`
                    : report.id === "r05-banco-horas"
                    ? `${r05Data.length} colaboradores`
                    : report.id === "r03-faturamento-receitas"
                    ? `${r03Data.length} faturas`
                    : report.id === "r02-fechamento-diaristas"
                    ? `${r02Data.length} apontamentos`
                    : report.id === "r04-custos-extras"
                    ? `${r04Data.length} custos extras`
                    : `${r07Data.length} serviços extras`}
                </span>
                <span className="text-border">·</span>
                <span className="text-[11px] text-muted-foreground">
                  {report.id === "r01-operacoes-volume" && "Operações por Volume (operacoes_producao)"}
                  {report.id === "r05-banco-horas" && "Banco de Horas (banco_horas_consolidado)"}
                  {report.id === "r03-faturamento-receitas" && "Faturamento e Receitas (financeiro_receitas)"}
                  {report.id === "r02-fechamento-diaristas" && "Fechamento de Diaristas (diaristas_fechamento_lotes)"}
                  {report.id === "r04-custos-extras" && "Custos Extras (custos_extras)"}
                  {report.id === "r07-servicos-extras" && "Serviços Extras (servicos_extras)"}
                </span>
              </div>
              <div className="text-[10px] font-mono text-muted-foreground shrink-0">
                Rastreabilidade: ORBE-DOC-{report.code}-202609-0841
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <span>
                  Empresa: <strong className="text-foreground">{empresaSelecionada.name} ({empresaSelecionada.document})</strong>
                </span>
                <span className="text-border">·</span>
                <span>
                  Competência: <strong className="text-foreground font-mono">{competenciaLabel}</strong>
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Critérios aplicados: validação por encarregado, conciliação de docas e governança auditada no ERP ORBE.</span>
              </div>
            </div>
          </section>
        )}

        {/* RODAPÉ EXCLUSIVO PARA IMPRESSÃO (@media print) */}
        <div className="print-footer hidden">
          <div className="flex justify-between items-center text-[8pt] text-gray-600 border-t border-gray-400 pt-2 mt-6">
            <span>ORBE ERP — Relatório Gerencial de Uso Interno · ESC Logística</span>
            <span>{empresaSelecionada.name} · {competencia}</span>
            <span>Documento gerencial emitido em {new Date().toLocaleDateString("pt-BR")} às {new Date().toLocaleTimeString("pt-BR")}</span>
          </div>
        </div>
      </div>
    </UxLabShell>
  );
}

// ============================================================
// COMPONENTES AUXILIARES DE UI
// ============================================================

function KpiSummaryBox({
  label,
  value,
  status = "default",
  highlight = false,
}: {
  label: string;
  value: string;
  status?: "default" | "success" | "warning" | "danger";
  highlight?: boolean;
}) {
  return (
    <div className="bg-card border border-border/80 rounded-xl p-3.5 space-y-1 shadow-2xs">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <div
        className={`text-lg font-bold font-mono ${
          status === "danger"
            ? "text-rose-600 dark:text-rose-400"
            : status === "warning"
            ? "text-amber-600 dark:text-amber-400"
            : status === "success"
            ? "text-emerald-600 dark:text-emerald-400"
            : highlight
            ? "text-primary"
            : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "CONCLUIDO") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-mono">
        CONCLUÍDO
      </Badge>
    );
  }
  if (status === "FATURADO") {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px] font-mono">
        FATURADO
      </Badge>
    );
  }
  if (status === "AGUARDANDO_FATURAMENTO") {
    return (
      <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20 text-[10px] font-mono">
        AGUARD. FATURAMENTO
      </Badge>
    );
  }
  if (status === "EM_VALIDACAO") {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-mono">
        EM VALIDAÇÃO
      </Badge>
    );
  }
  if (status === "RECEBIDO") {
    return (
      <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 text-[10px] font-mono">
        RECEBIDO
      </Badge>
    );
  }
  if (status === "EM_RESTRICAO") {
    return (
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px] font-mono">
        EM RESTRIÇÃO
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-[10px] font-mono">
      {status}
    </Badge>
  );
}

function BhStatusBadge({ status }: { status: string }) {
  if (status === "Débito Crítico") {
    return (
      <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
        Débito Crítico
      </Badge>
    );
  }
  if (status === "A Vencer") {
    return (
      <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
        A Vencer (30d)
      </Badge>
    );
  }
  if (status === "Saldo Positivo") {
    return (
      <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
        Saldo Positivo
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
      Regular
    </Badge>
  );
}

function FinanceiroStatusBadge({
  status,
  isAtrasado,
}: {
  status: string;
  isAtrasado?: boolean;
}) {
  const renderPersistedBadge = () => {
    switch (status) {
      case "conciliado":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Conciliado
          </Badge>
        );
      case "recebido":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px]">
            Recebido
          </Badge>
        );
      case "cobranca_enviada":
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[10px]">
            Cobrança Enviada
          </Badge>
        );
      case "pendente_cobranca":
        return (
          <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20 text-[10px]">
            Pendente Cobrança
          </Badge>
        );
      case "aguardando_fechamento":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
            Aguardando Fechamento
          </Badge>
        );
      case "pendente_recebimento":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px]">
            Pendente Recebimento
          </Badge>
        );
      case "cancelado":
        return (
          <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[10px]">
            Cancelado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {renderPersistedBadge()}
      {isAtrasado && (
        <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 text-[9px] font-semibold">
          Em Atraso (Derivado)
        </Badge>
      )}
    </div>
  );
}

function formatDateBR(dateString: string) {
  if (!dateString) return "-";
  const [y, m, d] = dateString.split("-");
  if (!d) return dateString;
  return `${d}/${m}/${y}`;
}

function formatMinutosToHourString(minutos: number) {
  const sign = minutos < 0 ? "-" : "+";
  const abs = Math.abs(minutos);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
}

function EmptyReportState({
  colSpan,
  onClearFilters,
}: {
  colSpan: number;
  onClearFilters: () => void;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-12 px-4 text-center">
        <div className="max-w-xs mx-auto space-y-2.5">
          <div className="text-sm font-semibold text-foreground">
            Nenhum registro encontrado
          </div>
          <p className="text-xs text-muted-foreground">
            Não existem dados para os filtros selecionados.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-xs h-8 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
            <span>Limpar filtros</span>
          </Button>
        </div>
      </td>
    </tr>
  );
}

function TablePaginationFooter({
  totalRows,
  currentPage,
  pageSize,
  onPageChange,
  empresaNome,
}: {
  totalRows: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  empresaNome: string;
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const startRow = totalRows === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endRow = Math.min(currentPage * pageSize, totalRows);

  return (
    <div className="px-5 py-3 border-t border-border bg-muted/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-muted-foreground no-print">
      <div className="flex items-center gap-2 flex-wrap">
        <span>
          Mostrando {startRow} a {endRow} de {totalRows} {totalRows === 1 ? "registro" : "registros"}
        </span>
        <span className="text-border">|</span>
        <span className="text-muted-foreground/80">Empresa: {empresaNome}</span>
      </div>

      <div className="flex items-center gap-2 self-end sm:self-auto">
        <span className="text-[11px] font-medium mr-1 font-mono">
          Página {currentPage} de {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          className="h-7 px-2.5 text-xs gap-1"
          aria-label="Página anterior"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span>Anterior</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          className="h-7 px-2.5 text-xs gap-1"
          aria-label="Próxima página"
        >
          <span>Próxima</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Padrão canônico de Skeleton para carregamento futuro de dados
 */
export function ReportTableSkeleton({
  columnsCount = 8,
  rowsCount = 6,
}: {
  columnsCount?: number;
  rowsCount?: number;
}) {
  return (
    <div className="w-full space-y-2 p-4 animate-pulse">
      {Array.from({ length: rowsCount }).map((_, rIdx) => (
        <div key={rIdx} className="flex items-center gap-3 py-2 border-b border-border/40">
          {Array.from({ length: columnsCount }).map((_, cIdx) => (
            <div
              key={cIdx}
              className="h-4 bg-muted rounded flex-1"
              style={{ opacity: 1 - rIdx * 0.12 }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * Padrão canônico de Estado de Erro para consultas futuras
 */
export function ReportErrorState({
  onRetry,
}: {
  onRetry?: () => void;
}) {
  return (
    <div className="py-12 px-4 text-center space-y-3">
      <div className="h-10 w-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <h4 className="text-sm font-semibold text-foreground">Não foi possível carregar os dados.</h4>
        <p className="text-xs text-muted-foreground">Ocorreu uma falha na consulta aos registros da empresa.</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="text-xs h-8 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Tentar novamente</span>
        </Button>
      )}
    </div>
  );
}
