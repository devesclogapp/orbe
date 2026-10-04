import React, { useState, useMemo, useRef, useEffect } from "react";
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
  Coins
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabServicoExtraDrawer } from "@/components/ux-lab/UxLabServicoExtraDrawer";
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
import { toast } from "sonner";
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import {
  SERVICOS_EXTRAS_MOCKS,
  MOCK_EMPRESAS_SERVICOS_EXTRAS,
  MOCK_TIPOS_SERVICO_EXTRAS,
  MOCK_PIPELINE_STATUS_OPTIONS,
  ServicoExtraMock,
  PipelineStatusServicoExtra,
  SERVICOS_EXTRAS_PIPELINE_STEPS,
} from "./servicosExtrasMockData";
import { UxPipelineStepper } from "@/components/ux-lab/UxPipelineStepper";

export default function UxLabServicosExtras() {
  // Filtros de Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [pipelineStatusFiltro, setPipelineStatusFiltro] = useState<string>("todos");
  const [tipoServicoFiltro, setTipoServicoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState<string>("");

  // Drawer de Detalhes
  const [selectedServico, setSelectedServico] = useState<ServicoExtraMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Navegação Interativa pelos Cards de Síntese
  const [activeKpiNav, setActiveKpiNav] = useState<"todos" | "requer_acao" | "financeiro" | "concluidos">("todos");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [cycleIndices, setCycleIndices] = useState<Record<string, number>>({
    requerAcao: 0,
    aguardandoFinanceiro: 0,
    faturadosConcluidos: 0,
  });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Reset de ciclos ao alterar filtros ou busca (Requisito Canônico de Coerência)
  useEffect(() => {
    setCycleIndices({
      requerAcao: 0,
      aguardandoFinanceiro: 0,
      faturadosConcluidos: 0,
    });
  }, [empresaFiltro, tipoServicoFiltro, pipelineStatusFiltro, filtroTemporal, busca]);

  // Formatação de Moeda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val || 0);
  };

  // Formatação de Data
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  // Filtragem dos dados mock (preserva filtros manuais de empresa, período, etc.)
  const servicosFiltrados = useMemo(() => {
    return SERVICOS_EXTRAS_MOCKS.filter((s) => {
      // 1. Empresa
      if (empresaFiltro !== "todas" && s.empresa_id !== empresaFiltro) {
        return false;
      }
      // 2. Tipo de Serviço Extra
      if (tipoServicoFiltro !== "todos" && s.tipo_servico_id !== tipoServicoFiltro) {
        return false;
      }
      // 3. Pipeline Status
      if (pipelineStatusFiltro !== "todos" && s.pipeline_status !== pipelineStatusFiltro) {
        return false;
      }
      // 4. Filtro Temporal Híbrido Reutilizado (data do serviço)
      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje" && s.data !== "2026-10-03") {
          return false;
        }
        if (filtroTemporal.preset === "setembro" && !s.data.startsWith("2026-09")) {
          return false;
        }
        if (filtroTemporal.preset === "outubro" && !s.data.startsWith("2026-10")) {
          return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const sDate = new Date(s.data + "T12:00:00");
        const targetYear = filtroTemporal.data.getFullYear();
        const targetMonth = filtroTemporal.data.getMonth();
        const targetDay = filtroTemporal.data.getDate();
        if (
          sDate.getFullYear() !== targetYear ||
          sDate.getMonth() !== targetMonth ||
          sDate.getDate() !== targetDay
        ) {
          return false;
        }
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const sDate = new Date(s.data + "T12:00:00");
        const fromDate = new Date(filtroTemporal.range.from);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = filtroTemporal.range.to
          ? new Date(filtroTemporal.range.to)
          : new Date(filtroTemporal.range.from);
        toDate.setHours(23, 59, 59, 999);

        if (sDate < fromDate || sDate > toDate) {
          return false;
        }
      }
      // 5. Busca textual por múltiplos identificadores auditados
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const matchCodigo = s.codigo.toLowerCase().includes(query);
        const matchTipo = s.tipo_servico_nome.toLowerCase().includes(query);
        const matchDesc = s.descricao_servico.toLowerCase().includes(query);
        const matchTomador = s.tomador_nome.toLowerCase().includes(query);
        const matchEmpresa = s.empresa_nome.toLowerCase().includes(query);
        if (!matchCodigo && !matchTipo && !matchDesc && !matchTomador && !matchEmpresa) {
          return false;
        }
      }
      return true;
    });
  }, [empresaFiltro, filtroTemporal, pipelineStatusFiltro, tipoServicoFiltro, busca]);

  // Síntese Operacional Orientada ao Processo (4 Indicadores Canônicos)
  const kpis = useMemo(() => {
    const total = servicosFiltrados.length;
    // Requer Ação: PENDENTE | EM_VALIDACAO | DEVOLVIDO (intervenções de triagem, conferência ou ajuste)
    const requerAcao = servicosFiltrados.filter((s) =>
      ["PENDENTE", "EM_VALIDACAO", "DEVOLVIDO"].includes(s.pipeline_status)
    ).length;
    // Aguardando Financeiro: APROVADO_OPERACAO | APROVADO_FINANCEIRO
    const aguardandoFinanceiro = servicosFiltrados.filter((s) =>
      ["APROVADO_OPERACAO", "APROVADO_FINANCEIRO"].includes(s.pipeline_status)
    ).length;
    // Faturados / Concluídos: FATURADO | CONCLUIDO
    const faturadosConcluidos = servicosFiltrados.filter((s) =>
      ["FATURADO", "CONCLUIDO"].includes(s.pipeline_status)
    ).length;

    return { total, requerAcao, aguardandoFinanceiro, faturadosConcluidos };
  }, [servicosFiltrados]);

  // Função para executar scroll e aplicar destaque temporário na ocorrência localizada
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

  // Semântica de destaque baseada exclusivamente no estado real da linha localizada
  const getHighlightClasses = (s: ServicoExtraMock) => {
    // 1. Condição impeditiva / devolução operacional (Rose)
    if (s.pipeline_status === "DEVOLVIDO") {
      return "bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/70 dark:ring-rose-500/80";
    }
    // 2. Novo lançamento pendente de triagem (Âmbar)
    if (s.pipeline_status === "PENDENTE") {
      return "bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/70 dark:ring-amber-500/80";
    }
    // 3. Em validação técnica e conferência de insumos (Azul)
    if (s.pipeline_status === "EM_VALIDACAO") {
      return "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/70 dark:ring-blue-500/80";
    }
    // 4. Aprovado na operação (Esmeralda)
    if (s.pipeline_status === "APROVADO_OPERACAO") {
      return "bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/70 dark:ring-emerald-500/80";
    }
    // 5. Aprovado no financeiro (Índigo)
    if (s.pipeline_status === "APROVADO_FINANCEIRO") {
      return "bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/70 dark:ring-indigo-500/80";
    }
    // 6. Faturado com NF emitida (Sky)
    if (s.pipeline_status === "FATURADO") {
      return "bg-sky-50/70 dark:bg-sky-950/40 ring-2 ring-sky-500/70 dark:ring-sky-500/80";
    }
    // 7. Concluído e liquidado (Zinc)
    if (s.pipeline_status === "CONCLUIDO") {
      return "bg-zinc-100/70 dark:bg-zinc-800/60 ring-2 ring-zinc-500/70 dark:ring-zinc-500/80";
    }
    // Fallback institucional neutro
    return "bg-royal-blue/10 dark:bg-royal-blue/20 ring-2 ring-royal-blue/70 dark:ring-royal-blue/80";
  };

  // Handlers dos Cards de Síntese (Navegação Circular Sequencial)
  const handleCardClickServicosPeriodo = () => {
    setActiveKpiNav("todos");
    if (tableContainerRef.current) {
      if (typeof tableContainerRef.current.scrollTo === "function") {
        tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        tableContainerRef.current.scrollTop = 0;
      }
    } else if (servicosFiltrados.length > 0) {
      scrollToTarget(servicosFiltrados[0].id);
    } else {
      toast.info("Nenhum serviço correspondente nos filtros atuais.");
    }
  };

  const handleCardClickRequerAcao = () => {
    setActiveKpiNav("requer_acao");
    // Prioriza primeiro DEVOLVIDO (bloqueio/ajuste pendente), depois EM_VALIDACAO, depois PENDENTE
    const devolvidos = servicosFiltrados.filter((s) => s.pipeline_status === "DEVOLVIDO");
    const emVal = servicosFiltrados.filter((s) => s.pipeline_status === "EM_VALIDACAO");
    const pendentes = servicosFiltrados.filter((s) => s.pipeline_status === "PENDENTE");
    const alvos = [...devolvidos, ...emVal, ...pendentes];

    if (alvos.length === 0) {
      toast.info("Nenhum serviço que requer ação nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.requerAcao % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      requerAcao: (currentIndex + 1) % alvos.length,
    }));
    scrollToTarget(target.id);
  };

  const handleCardClickAguardandoFinanceiro = () => {
    setActiveKpiNav("financeiro");
    // Prioriza primeiro APROVADO_OPERACAO, depois APROVADO_FINANCEIRO
    const aprovOp = servicosFiltrados.filter((s) => s.pipeline_status === "APROVADO_OPERACAO");
    const aprovFin = servicosFiltrados.filter((s) => s.pipeline_status === "APROVADO_FINANCEIRO");
    const alvos = [...aprovOp, ...aprovFin];

    if (alvos.length === 0) {
      toast.info("Nenhum serviço aguardando financeiro nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.aguardandoFinanceiro % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      aguardandoFinanceiro: (currentIndex + 1) % alvos.length,
    }));
    scrollToTarget(target.id);
  };

  const handleCardClickFaturadosConcluidos = () => {
    setActiveKpiNav("concluidos");
    // Prioriza primeiro FATURADO, depois CONCLUIDO
    const faturados = servicosFiltrados.filter((s) => s.pipeline_status === "FATURADO");
    const concluidos = servicosFiltrados.filter((s) => s.pipeline_status === "CONCLUIDO");
    const alvos = [...faturados, ...concluidos];

    if (alvos.length === 0) {
      toast.info("Nenhum serviço faturado ou concluído nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.faturadosConcluidos % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      faturadosConcluidos: (currentIndex + 1) % alvos.length,
    }));
    scrollToTarget(target.id);
  };

  const hasActiveFilters =
    empresaFiltro !== "todas" ||
    tipoServicoFiltro !== "todos" ||
    pipelineStatusFiltro !== "todos" ||
    filtroTemporal.preset !== "todos" ||
    busca.trim() !== "";

  const handleResetFilters = () => {
    setEmpresaFiltro("todas");
    setTipoServicoFiltro("todos");
    setPipelineStatusFiltro("todos");
    setFiltroTemporal({ type: "preset", preset: "todos" });
    setBusca("");
    setActiveKpiNav("todos");
    setHighlightedId(null);
    setCycleIndices({
      requerAcao: 0,
      aguardandoFinanceiro: 0,
      faturadosConcluidos: 0,
    });
    toast.success("Filtros redefinidos para o padrão geral.");
  };

  // Renderizador de Badge de Pipeline Status na Tabela
  const renderPipelineBadgeTable = (status: PipelineStatusServicoExtra) => {
    switch (status) {
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
            <Receipt className="w-3 h-3 text-sky-600" />
            Faturado
          </span>
        );
      case "CONCLUIDO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Concluído
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <UxLabShell
      activeItem="servicos-extras"
      onSidebarSelect={(id) => {
        // Redirecionamento canônico tratado pela Sidebar
      }}
    >
      <div className="flex-1 min-h-0 flex flex-col w-full space-y-4">
        {/* CABEÇALHO OPERACIONAL (MESMO EIXO E HIERARQUIA DA UX05) */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Wrench className="w-5 h-5 text-royal-blue dark:text-royal-blue-light" />
                Serviços Extras
              </h1>
              <Badge variant="outline" className="text-[10px] tracking-wide uppercase font-semibold">
                UX Lab V2
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
              <SelectTrigger aria-label="Seletor de Empresa" className="w-[200px] h-9 text-xs bg-card border-border">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_EMPRESAS_SERVICOS_EXTRAS.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* CTA Estrutural: Novo Serviço Extra */}
            <Button
              size="sm"
              className="h-9 text-xs bg-royal-blue hover:bg-royal-blue/90 text-white font-medium shadow-sm flex items-center gap-1.5"
              onClick={() =>
                toast.info(
                  "Fluxo de Lançamento de Serviço Extra V2 em desenvolvimento para a próxima fase. Foco atual: gestão e diagnóstico da esteira existente."
                )
              }
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
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "todos"
                ? "bg-card border-royal-blue/70 dark:border-royal-blue/60 shadow-xs ring-1 ring-royal-blue/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
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
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "requer_acao"
                ? "bg-card border-amber-500/70 dark:border-amber-500/60 shadow-xs ring-1 ring-amber-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
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
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "financeiro"
                ? "bg-card border-indigo-500/70 dark:border-indigo-500/60 shadow-xs ring-1 ring-indigo-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
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
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "concluidos"
                ? "bg-card border-emerald-500/70 dark:border-emerald-500/60 shadow-xs ring-1 ring-emerald-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
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

        {/* BARRA DE TRABALHO & FILTROS DIÁRIOS */}
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

            {/* Filtro Temporal Híbrido ORBE Reutilizado */}
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
                {MOCK_PIPELINE_STATUS_OPTIONS.map((opt) => (
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
                {MOCK_TIPOS_SERVICO_EXTRAS.map((s) => (
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
                title="Limpar todos os filtros ativos"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 self-end md:self-auto">
            <span>Mostrando:</span>
            <strong className="text-foreground font-mono">{servicosFiltrados.length}</strong>
            <span>de {SERVICOS_EXTRAS_MOCKS.length} serviços</span>
          </div>
        </div>

        {/* TABELA ESPECIALISTA DE ALTA DENSIDADE */}
        <div
          ref={tableContainerRef}
          className="flex-1 min-h-[380px] bg-card rounded-lg border border-border overflow-hidden flex flex-col shadow-xs"
        >
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-2 px-2 w-[85px] whitespace-nowrap">Código</th>
                  <th className="py-2 px-2 w-[75px] whitespace-nowrap">Data</th>
                  <th className="py-2 px-2 max-w-[140px] truncate">Empresa / Tomador</th>
                  <th className="py-2 px-2 max-w-[150px] truncate">Tipo de Serviço Extra</th>
                  <th className="py-2 px-2 w-[80px] text-left whitespace-nowrap">Qtd. Executada</th>
                  <th className="py-2 px-2 w-[80px] whitespace-nowrap">Headcount</th>
                  <th className="py-2 px-2 w-[85px] text-left whitespace-nowrap">Valor Total</th>
                  <th className="py-2 px-2 w-[110px] text-left whitespace-nowrap">Pipeline Status</th>
                  <th className="py-2 px-2 w-[100px] whitespace-nowrap">Modalidade / Pgto</th>
                  <th className="py-2 px-2 max-w-[130px] truncate">Pendência / Diagnóstico</th>
                  <th className="py-2 px-2 w-[75px] text-center whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {servicosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                        <Wrench className="w-6 h-6 text-muted-foreground/50" />
                        <span className="font-medium text-xs text-foreground">
                          Nenhum serviço extra encontrado
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          Ajuste os filtros de busca, período ou status para localizar os lançamentos.
                        </p>
                        {hasActiveFilters && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetFilters}
                            className="mt-1 h-7 text-xs"
                          >
                            Redefinir Filtros
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  servicosFiltrados.map((s) => {
                    const isHighlighted = highlightedId === s.id;
                    const isSelected = selectedServico?.id === s.id;

                    return (
                      <tr
                        key={s.id}
                        id={`row-servico-${s.id}`}
                        onClick={() => {
                          setSelectedServico(s);
                          setDrawerOpen(true);
                        }}
                        className={`group transition-all duration-150 cursor-pointer ${
                          isHighlighted
                            ? getHighlightClasses(s)
                            : isSelected
                            ? "bg-royal-blue/5 dark:bg-royal-blue/10"
                            : "hover:bg-muted/40"
                        }`}
                      >
                        {/* Código */}
                        <td className="py-2 px-2 w-[85px] font-mono font-bold text-royal-blue dark:text-royal-blue-light whitespace-nowrap">
                          {s.codigo}
                        </td>

                        {/* Data */}
                        <td className="py-2 px-2 w-[75px] font-mono text-muted-foreground whitespace-nowrap">
                          {formatDate(s.data)}
                        </td>

                        {/* Empresa / Tomador */}
                        <td className="py-2 px-2 max-w-[140px]">
                          <div className="font-medium text-foreground truncate" title={s.tomador_nome}>{s.tomador_nome}</div>
                          <div className="text-[10px] text-muted-foreground truncate" title={s.empresa_nome}>{s.empresa_nome}</div>
                        </td>

                        {/* Tipo de Serviço Extra */}
                        <td className="py-2 px-2 max-w-[150px]">
                          <div className="font-semibold text-foreground truncate" title={s.tipo_servico_nome}>{s.tipo_servico_nome}</div>
                          <div className="text-[10px] text-muted-foreground truncate" title={s.descricao_servico}>
                            {s.descricao_servico}
                          </div>
                        </td>

                        {/* Qtd. Executada */}
                        <td className="py-2 px-2 w-[80px] text-left font-mono font-medium whitespace-nowrap">
                          {s.quantidade} {s.unidade_cobranca_snapshot}
                        </td>

                        {/* Headcount (Regra estrita: "X pessoas", sem nomes/CPFs) */}
                        <td className="py-2 px-2 w-[80px] whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 font-mono text-[10.5px] font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {s.quantidade_colaboradores} pessoas
                          </span>
                        </td>

                        {/* Valor Total */}
                        <td className="py-2 px-2 w-[85px] text-left font-mono font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(s.total)}
                        </td>

                        {/* Pipeline Status (Stepper Compacto Transversal) */}
                        <td className="py-2 px-2 w-[110px] whitespace-nowrap">
                          <UxPipelineStepper
                            steps={SERVICOS_EXTRAS_PIPELINE_STEPS}
                            currentStepKey={s.pipeline_status}
                            exceptionState={
                              s.pipeline_status === "DEVOLVIDO"
                                ? {
                                    isException: true,
                                    label: "Devolvido",
                                    stepKey: "EM_VALIDACAO",
                                    description: s.justificativa_devolucao || undefined,
                                  }
                                : null
                            }
                            variant="compact"
                          />
                        </td>

                        {/* Modalidade / Pagamento (Leitura protegida, sem dropdown solto) */}
                        <td className="py-2 px-2 w-[100px] whitespace-nowrap">
                          <div className="text-[11px] font-medium text-foreground">
                            {s.modalidade_financeira === "CAIXA_IMEDIATO"
                              ? "Caixa Imediato"
                              : s.modalidade_financeira === "DUPLICATA"
                              ? "Duplicata"
                              : "Faturamento Mensal"}
                          </div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                s.status_pagamento === "RECEBIDO"
                                  ? "bg-emerald-500"
                                  : "bg-amber-500"
                              }`}
                            />
                            {s.status_pagamento}
                          </div>
                        </td>

                        {/* Pendência / Diagnóstico */}
                        <td className="py-2 px-2 max-w-[130px]">
                          {s.pipeline_status === "DEVOLVIDO" ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 dark:text-rose-400 truncate" title={s.justificativa_devolucao || "Ajuste necessário"}>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Ajuste necessário
                            </span>
                          ) : s.pipeline_status === "PENDENTE" ? (
                            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium truncate" title="Triagem operacional">
                              Triagem operacional
                            </span>
                          ) : s.pipeline_status === "EM_VALIDACAO" ? (
                            <span className="text-[11px] text-blue-700 dark:text-blue-400 font-medium truncate" title="Conferência técnica">
                              Conferência técnica
                            </span>
                          ) : s.pipeline_status === "CONCLUIDO" ? (
                            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 truncate" title="Liquidado">
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              Liquidado
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground truncate" title="Regular em esteira">
                              Regular em esteira
                            </span>
                          )}
                        </td>

                        {/* Ação: Diagnosticar */}
                        <td className="py-2 px-2 w-[75px] text-center whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px] text-royal-blue hover:text-royal-blue hover:bg-royal-blue/10 flex items-center gap-0.5 mx-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedServico(s);
                              setDrawerOpen(true);
                            }}
                          >
                            <span>Diagnosticar</span>
                            <ChevronRight className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé Informativo da Tabela */}
          <div className="p-2.5 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between text-[11px] text-muted-foreground gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-royal-blue shrink-0" />
              <span>Registros faturados possuem valores protegidos contra alteração.</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Exibindo {servicosFiltrados.length} de {SERVICOS_EXTRAS_MOCKS.length} registros
            </div>
          </div>
        </div>

        {/* DRAWER ESPECIALISTA DE SERVIÇOS EXTRAS */}
        <UxLabServicoExtraDrawer
          servico={selectedServico}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
    </UxLabShell>
  );
}
