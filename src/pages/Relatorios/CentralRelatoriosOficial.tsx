import React, { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  ArrowRight,
  FileSpreadsheet,
  FileText,
  Clock,
  Layers,
  Building2,
  Calendar,
  Sparkles,
  BarChart3,
  X,
  Filter,
  CheckCircle2,
  Users,
  Wallet,
  Package,
  TrendingUp,
  Info,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
  Star,
  Printer,
  Download,
  Check,
  AlertCircle,
  Activity,
  SlidersHorizontal,
  Lock,
} from "lucide-react";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { EmpresaService } from "@/services/base.service";
import {
  RelatoriosOficialAdapter,
  RELATORIOS_CATALOGO_OFICIAL,
  FLUXOS_DISPONIVEIS,
  FluxoId,
  checkReportAccess,
  formatBRL,
  formatMinutosToHourString,
  ReportMeta,
} from "@/services/adapters/relatoriosOficialAdapter";

const COMPETENCIAS_DISPONIVEIS = [
  { value: "2026-10", label: "Outubro / 2026 (Em Aberto)" },
  { value: "2026-09", label: "Setembro / 2026 (Oficial Homologado)" },
  { value: "2026-08", label: "Agosto / 2026 (Arquivado)" },
];

export default function CentralRelatoriosOficial() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAccessControl();

  // 1. Carregar Empresas Oficiais
  const { data: empresasCadastradas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas_cadastradas_relatorios"],
    queryFn: () => EmpresaService.getAll(),
  });

  const defaultEmpresaId = empresasCadastradas[0]?.id || "";

  // Filtros Globais da Central (Empresa + Competência + Fluxo)
  const urlEmpresa = searchParams.get("empresa") || defaultEmpresaId;
  const urlCompetencia = searchParams.get("competencia") || "2026-09";
  const urlFluxo = (searchParams.get("fluxo") as FluxoId) || "todos";

  const [empresaId, setEmpresaId] = useState(urlEmpresa);
  const [competencia, setCompetencia] = useState(urlCompetencia);
  const [fluxo, setFluxo] = useState<FluxoId>(urlFluxo);

  // Efeito para sincronizar defaultEmpresaId caso não haja empresa na URL
  React.useEffect(() => {
    if (!empresaId && empresasCadastradas.length > 0) {
      setEmpresaId(empresasCadastradas[0].id);
    }
  }, [empresasCadastradas, empresaId]);

  // Busca e Filtros do Catálogo
  const [searchTerm, setSearchTerm] = useState("");
  const [domainFilter, setDomainFilter] = useState<"all" | "OPERACIONAL" | "PESSOAS & RH" | "FINANCEIRO & FATURAMENTO">("all");
  const [quickFilter, setQuickFilter] = useState<"todos" | "favoritos">("todos");

  // Favoritos persistidos no localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("orbe_report_favorites");
      return saved ? JSON.parse(saved) : ["r01-operacoes-volume", "r03-faturamento-receitas"];
    } catch {
      return ["r01-operacoes-volume", "r03-faturamento-receitas"];
    }
  });

  const toggleFavorite = (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = prev.includes(reportId) ? prev.filter((id) => id !== reportId) : [...prev, reportId];
      try {
        localStorage.setItem("orbe_report_favorites", JSON.stringify(next));
      } catch {
        // fallback
      }
      return next;
    });
  };

  // Dossiê da Competência
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [selectedDossierReports, setSelectedDossierReports] = useState<string[]>([
    "r01-operacoes-volume",
    "r04-custos-extras",
    "r07-servicos-extras",
    "r02-fechamento-diaristas",
    "r05-banco-horas",
    "r03-faturamento-receitas",
  ]);

  // Atualizar URL
  const updateUrlParams = (newEmpresa: string, newComp: string, newFluxo: FluxoId) => {
    const params: Record<string, string> = {
      empresa: newEmpresa,
      competencia: newComp,
    };
    if (newFluxo !== "todos") params.fluxo = newFluxo;
    setSearchParams(params);
  };

  const handleEmpresaChange = (newEmpresa: string) => {
    setEmpresaId(newEmpresa);
    updateUrlParams(newEmpresa, competencia, fluxo);
  };

  const handleCompetenciaChange = (newComp: string) => {
    setCompetencia(newComp);
    updateUrlParams(empresaId, newComp, fluxo);
  };

  const handleFluxoChange = (newFluxo: FluxoId) => {
    setFluxo(newFluxo);
    updateUrlParams(empresaId, competencia, newFluxo);
  };

  const empresaSelecionada = useMemo(() => {
    if (!empresaId) return empresasCadastradas[0] || { id: "", nome: "Selecione a empresa" };
    const found = empresasCadastradas.find((e: any) => e.id === empresaId);
    return (
      found || {
        id: empresaId,
        nome: isLoadingEmpresas ? "Carregando empresa..." : "Empresa não localizada",
      }
    );
  }, [empresasCadastradas, empresaId, isLoadingEmpresas]);

  // 2. Consulta Real dos Dados do Hub via Adapter
  const { data: hubData, isLoading: isLoadingHub, error: hubError } = useQuery({
    queryKey: ["relatorios_hub_consolidado", empresaId, competencia],
    queryFn: () => RelatoriosOficialAdapter.getCentralHubConsolidado(empresaId, competencia),
    enabled: !!empresaId,
  });

  // Filtragem dos relatórios pelo papel do usuário (Segregação RBAC)
  const allowedReports = useMemo(() => {
    return RELATORIOS_CATALOGO_OFICIAL.filter((r) => checkReportAccess(r.id, role));
  }, [role]);

  // Filtragem do catálogo por busca, domínio, favoritos e fluxo
  const filteredReports = useMemo(() => {
    return allowedReports.filter((report) => {
      if (domainFilter !== "all" && report.category !== domainFilter) return false;
      if (quickFilter === "favoritos" && !favorites.includes(report.id)) return false;

      if (fluxo !== "todos") {
        const fluxoMeta = FLUXOS_DISPONIVEIS.find((f) => f.id === fluxo);
        if (fluxoMeta?.reportCode && report.code !== fluxoMeta.reportCode) return false;
      }

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesTitle = report.title.toLowerCase().includes(term);
        const matchesCode = report.code.toLowerCase().includes(term);
        const matchesDesc = report.description.toLowerCase().includes(term);
        if (!matchesTitle && !matchesCode && !matchesDesc) return false;
      }

      return true;
    });
  }, [allowedReports, domainFilter, quickFilter, favorites, fluxo, searchTerm]);

  // Exportação rápida de CSV
  const handleQuickExportCSV = (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!hubData) return;

    let rows: any[] = [];
    if (reportId === "r01-operacoes-volume") rows = hubData.datasets.r01Rows;
    else if (reportId === "r02-fechamento-diaristas") rows = hubData.datasets.r02Rows;
    else if (reportId === "r03-faturamento-receitas") rows = hubData.datasets.r03Rows;
    else if (reportId === "r04-custos-extras") rows = hubData.datasets.r04Rows;
    else if (reportId === "r05-banco-horas") rows = hubData.datasets.r05Rows;
    else if (reportId === "r07-servicos-extras") rows = hubData.datasets.r07Rows;

    if (!rows || rows.length === 0) {
      toast.info("Caderno sem registros no período filtrado para exportação.");
      return;
    }

    try {
      RelatoriosOficialAdapter.exportReportToCSV(reportId, rows, empresaSelecionada.nome, competencia);
      toast.success("Documento emitido em CSV", {
        description: `Arquivo estruturado exportado para a empresa ${empresaSelecionada.nome}.`,
      });
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar CSV");
    }
  };

  // Geração de Dossiê da Competência
  const handleExportDossier = () => {
    if (!hubData) return;
    try {
      RelatoriosOficialAdapter.exportDossierToCSV({
        empresaNome: empresaSelecionada.nome,
        competencia,
        kpis: hubData.kpis,
        selectedReports: selectedDossierReports,
      });
      toast.success("Dossiê gerado com sucesso", {
        description: "Caderno compilado em arquivo estruturado CSV (UTF-8 BOM).",
      });
      setIsDossierOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao exportar Dossiê");
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

  const infograficos = hubData?.infograficos || {
    registrosOperacional: 0,
    registrosRH: 0,
    registrosFinanceiro: 0,
    pctOperacional: 0,
    pctRH: 0,
    pctFinanceiro: 0,
  };

  const counts = hubData?.counts || {};

  return (
    <AppShell
      title="Central de Relatórios"
      subtitle="Radiografia analítica, cadernos oficiais e exportação documental consolidada"
    >
      <div className="space-y-6 pb-20">
        {/* BARRA SUPERIOR DE FILTROS GLOBAIS + AÇÕES DE INTEGRAÇÃO */}
        <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm backdrop-blur">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Filtros Estruturais: Empresa + Competência + Fluxo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Empresa / Filial
                </label>
                <Select value={empresaId} onValueChange={handleEmpresaChange} disabled={isLoadingEmpresas}>
                  <SelectTrigger className="h-9 bg-background/60">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresasCadastradas.map((emp: any) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Competência Econômica
                </label>
                <Select value={competencia} onValueChange={handleCompetenciaChange}>
                  <SelectTrigger className="h-9 bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPETENCIAS_DISPONIVEIS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Fluxo Operacional
                </label>
                <Select value={fluxo} onValueChange={(val) => handleFluxoChange(val as FluxoId)}>
                  <SelectTrigger className="h-9 bg-background/60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FLUXOS_DISPONIVEIS.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ações Técnicas: Dossiê e Links para Ferramentas Contábeis */}
            <div className="flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 text-xs font-semibold"
                onClick={() => setIsDossierOpen(true)}
              >
                <FileText className="h-3.5 w-3.5 text-primary" />
                Dossiê da Competência
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-xs text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Ferramentas Contábeis
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Sincronização & Agendamentos
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/relatorios/integracao")}>
                    <Activity className="h-3.5 w-3.5 mr-2 text-primary" /> Integração Contábil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/relatorios/agendamentos")}>
                    <Clock className="h-3.5 w-3.5 mr-2 text-primary" /> Agendamentos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/relatorios/layouts")}>
                    <Layers className="h-3.5 w-3.5 mr-2 text-primary" /> Layouts de Exportação
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/relatorios/mapeamento")}>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-2 text-primary" /> Mapeamento Contábil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/relatorios/integracao/logs")}>
                    <FileSpreadsheet className="h-3.5 w-3.5 mr-2 text-primary" /> Logs de Integração
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/relatorios/legado")} className="text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 mr-2" /> Central de Relatórios Legada
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* FAIXA DE SÍNTESE ANALÍTICA — 4 KPIS CANÔNICOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 01 — Registros Consolidados */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                01 · Registros Consolidados
              </span>
              <FileSpreadsheet className="h-4 w-4 text-primary" />
            </div>
            {isLoadingHub ? (
              <Skeleton className="h-8 w-24 my-1" />
            ) : (
              <div className="text-2xl font-black text-foreground tracking-tight">
                {kpis.totalRegistros.toLocaleString("pt-BR")}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
              <span>{kpis.relatoriosAtivos}/6 relatórios com movimentação</span>
              <span className="font-semibold text-foreground/80">{competencia}</span>
            </div>
          </div>

          {/* KPI 02 — Volume Operacional (Exclusivamente R01) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                02 · Volume Operacional
              </span>
              <Package className="h-4 w-4 text-emerald-500" />
            </div>
            {isLoadingHub ? (
              <Skeleton className="h-8 w-28 my-1" />
            ) : (
              <div className="text-2xl font-black text-foreground tracking-tight">
                {kpis.volumeOperacional.toLocaleString("pt-BR")}
                <span className="text-xs font-semibold text-muted-foreground ml-1.5">unid.</span>
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
              <span>Operações por Volume · R01</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">Descargas</span>
            </div>
          </div>

          {/* KPI 03 — Receitas Reportadas (Exclusivamente R03) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                03 · Receitas Reportadas
              </span>
              <Wallet className="h-4 w-4 text-blue-500" />
            </div>
            {isLoadingHub ? (
              <Skeleton className="h-8 w-32 my-1" />
            ) : checkReportAccess("r03-faturamento-receitas", role) ? (
              <div className="text-2xl font-black text-foreground tracking-tight">
                {formatBRL(kpis.receitasReportadas)}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground my-1.5">
                <Lock className="h-4 w-4 text-muted-foreground" />
                Acesso restrito ao Financeiro
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
              <span>Livro de Faturamento · R03</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">Reconhecido</span>
            </div>
          </div>

          {/* KPI 04 — Despesas Apuradas (Diaristas R02 + Custos Extras R04) */}
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                04 · Despesas Apuradas
              </span>
              <Activity className="h-4 w-4 text-rose-500" />
            </div>
            {isLoadingHub ? (
              <Skeleton className="h-8 w-32 my-1" />
            ) : (
              <div className="text-2xl font-black text-foreground tracking-tight">
                {formatBRL(kpis.despesasApuradas)}
              </div>
            )}
            <div className="mt-1 text-xs text-muted-foreground flex items-center justify-between">
              <span>Diaristas: {formatBRL(kpis.diaristasTotal)}</span>
              <span>Custos: {formatBRL(kpis.custosExtrasTotal)}</span>
            </div>
          </div>
        </div>

        {/* MICROINDICADOR SECUNDÁRIO — BANCO DE HORAS CLT (SE PERMITIDO) */}
        {checkReportAccess("r05-banco-horas", role) && (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">Banco de Horas (CLT) · R05:</span>
              <span>Saldo líquido acumulado da empresa:</span>
              <span className="font-bold text-foreground">
                {formatMinutosToHourString(kpis.bancoHorasSaldoMinutos)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Horas a vencer (30d): <strong className="text-foreground">{formatMinutosToHourString(kpis.bancoHorasAVencerMinutos)}</strong></span>
              <span className="text-muted-foreground/60">•</span>
              <span className="italic">Apuração estritamente temporal (horas/minutos), sem passivo financeiro em R$</span>
            </div>
          </div>
        )}

        {/* INFOGRÁFICO DE ATIVIDADE DOCUMENTAL DO PERÍODO */}
        <div className="rounded-xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-bold text-foreground">Atividade Documental do Período</h3>
              <p className="text-xs text-muted-foreground">
                Origem e proporção dos registros apurados nos livros oficiais da {empresaSelecionada.nome}
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold self-start sm:self-auto">
              {kpis.totalRegistros} lançamentos apurados
            </Badge>
          </div>

          {/* Barra de Proporção Tripla */}
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden flex my-2">
            <div
              style={{ width: `${infograficos.pctOperacional}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Operacional: ${infograficos.pctOperacional}%`}
            />
            <div
              style={{ width: `${infograficos.pctRH}%` }}
              className="bg-purple-500 transition-all duration-300"
              title={`Pessoas & RH: ${infograficos.pctRH}%`}
            />
            <div
              style={{ width: `${infograficos.pctFinanceiro}%` }}
              className="bg-blue-500 transition-all duration-300"
              title={`Financeiro: ${infograficos.pctFinanceiro}%`}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Operacional:</span>
              <strong className="text-foreground">{infograficos.registrosOperacional}</strong>
              <span className="text-muted-foreground">({infograficos.pctOperacional}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
              <span className="text-muted-foreground">Pessoas & RH:</span>
              <strong className="text-foreground">{infograficos.registrosRH}</strong>
              <span className="text-muted-foreground">({infograficos.pctRH}%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Financeiro:</span>
              <strong className="text-foreground">{infograficos.registrosFinanceiro}</strong>
              <span className="text-muted-foreground">({infograficos.pctFinanceiro}%)</span>
            </div>
          </div>
        </div>

        {/* CATÁLOGO DE CADERNOS DOCUMENTAIS OFICIAIS */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div>
              <h2 className="text-base font-bold text-foreground">Catálogo de Cadernos Homologados</h2>
              <p className="text-xs text-muted-foreground">
                Documentos analíticos e livros fiscais oficiais do ERP ORBE
              </p>
            </div>

            {/* Filtros do Catálogo */}
            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-64">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar relatório..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 pl-8 text-xs bg-background/60"
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

              <Button
                variant={quickFilter === "favoritos" ? "secondary" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setQuickFilter((prev) => (prev === "favoritos" ? "todos" : "favoritos"))}
              >
                <Star className={`h-3.5 w-3.5 ${quickFilter === "favoritos" ? "fill-amber-400 text-amber-500" : ""}`} />
                Favoritos
              </Button>
            </div>
          </div>

          {/* Grid dos Cards de Relatório */}
          {filteredReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
              Nenhum caderno documental encontrado para os filtros selecionados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map((report) => {
                const count = counts[report.id] || 0;
                const isFav = favorites.includes(report.id);

                return (
                  <div
                    key={report.id}
                    onClick={() => {
                      const targetEmpresa = empresaId || defaultEmpresaId || (empresasCadastradas[0]?.id || "");
                      navigate(`/relatorios/${report.id}?empresa=${targetEmpresa}&competencia=${competencia}`);
                    }}
                    className="rounded-xl border border-border/80 bg-card p-5 shadow-sm hover:border-primary/50 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative"
                  >
                    <div>
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono font-bold text-xs px-2 py-0.5 bg-primary/10 text-primary border-primary/30">
                            {report.code}
                          </Badge>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {report.category}
                          </span>
                        </div>

                        <button
                          onClick={(e) => toggleFavorite(report.id, e)}
                          className="text-muted-foreground hover:text-amber-500 transition-colors p-1"
                          title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                        >
                          <Star className={`h-4 w-4 ${isFav ? "fill-amber-400 text-amber-500" : ""}`} />
                        </button>
                      </div>

                      <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {report.title}
                      </h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {report.description}
                      </p>
                    </div>

                    {/* Rodapé do Card */}
                    <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-bold text-foreground">{count}</span> registros
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={(e) => handleQuickExportCSV(report.id, e)}
                          title="Exportar CSV imediato"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          CSV
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 px-2.5 text-xs font-semibold group-hover:bg-primary group-hover:text-primary-foreground transition-all"
                        >
                          Abrir
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* DIALOG DO DOSSIÊ DA COMPETÊNCIA */}
        <Dialog open={isDossierOpen} onOpenChange={setIsDossierOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Dossiê Consolidado da Competência
              </DialogTitle>
              <DialogDescription className="text-xs">
                Compilação executiva e resumo documental para {empresaSelecionada.nome} ({competencia}).
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
                  <span className="text-muted-foreground">Registros Consolidados:</span>
                  <span className="font-bold text-foreground">{kpis.totalRegistros} apurações</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-2">
                  Cadernos a Compilar:
                </label>
                <div className="space-y-2 text-xs">
                  {allowedReports.map((r) => (
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

              <div className="text-[11px] text-muted-foreground bg-muted/20 p-2.5 rounded border border-border/40">
                O arquivo será gerado no formato <strong>CSV (UTF-8 BOM)</strong> compatível com Excel e LibreOffice. A compilação em PDF multipágina permanece registrada no backlog arquitetural (UX04-FUTURE-DOSSIER-01).
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
      </div>
    </AppShell>
  );
}
