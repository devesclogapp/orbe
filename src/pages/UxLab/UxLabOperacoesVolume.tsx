import React, { useState, useMemo, useEffect } from "react";
import {
  Package,
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
  ArrowUpDown,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabOperacaoDrawer } from "@/components/ux-lab/UxLabOperacaoDrawer";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "sonner";
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import {
  OPERACOES_VOLUME_MOCKS,
  MOCK_EMPRESAS,
  MOCK_SERVICOS,
  MOCK_STATUS_OPTIONS,
  MOCK_STATUS_RH_OPTIONS,
  OperacaoVolumeMock,
  OPERACOES_VOLUME_PIPELINE_STEPS,
} from "./operacoesVolumeMockData";
import { UxPipelineStepper } from "@/components/ux-lab/UxPipelineStepper";

export default function UxLabOperacoesVolume() {
  // Filtros de Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [statusFiltro, setStatusFiltro] = useState<string>("todos");
  const [statusRhFiltro, setStatusRhFiltro] = useState<string>("todos");
  const [servicoFiltro, setServicoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState<string>("");

  // Drawer de Detalhes
  const [selectedOp, setSelectedOp] = useState<OperacaoVolumeMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Navegação Interativa pelos Cards de Síntese
  const [activeKpiNav, setActiveKpiNav] = useState<"todos" | "validacao" | "restricao" | "prontas">("todos");
  const [highlightedOpId, setHighlightedOpId] = useState<string | null>(null);
  const [cycleIndices, setCycleIndices] = useState<{
    validacao: number;
    restricao: number;
    prontas: number;
  }>({ validacao: 0, restricao: 0, prontas: 0 });
  const tableContainerRef = React.useRef<HTMLDivElement>(null);

  // Resetar índices sequenciais sempre que filtros ou busca mudarem (Requisitos 7 & 8)
  useEffect(() => {
    setCycleIndices({ validacao: 0, restricao: 0, prontas: 0 });
  }, [empresaFiltro, filtroTemporal, statusFiltro, statusRhFiltro, servicoFiltro, busca]);

  // Filtragem dos dados mock (preserva estritamente filtros manuais de empresa, período, etc.)
  const operacoesFiltradas = useMemo(() => {
    return OPERACOES_VOLUME_MOCKS.filter((op) => {
      // 1. Empresa
      if (empresaFiltro !== "todas" && op.empresa_id !== empresaFiltro) {
        return false;
      }
      // 2. Serviço
      if (servicoFiltro !== "todos" && op.tipo_servico_id !== servicoFiltro) {
        return false;
      }
      // 3. Status Operacional Manual
      if (statusFiltro !== "todos" && op.status !== statusFiltro) {
        return false;
      }
      // 4. Status RH Manual
      if (statusRhFiltro !== "todos" && op.status_rh !== statusRhFiltro) {
        return false;
      }
      // 5. Filtro Temporal Híbrido (Preset, Data Única ou Range)
      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje" && op.data_operacao !== "2026-10-03") {
          return false;
        }
        if (filtroTemporal.preset === "setembro" && !op.data_operacao.startsWith("2026-09")) {
          return false;
        }
        if (filtroTemporal.preset === "outubro" && !op.data_operacao.startsWith("2026-10")) {
          return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const opDate = new Date(op.data_operacao + "T12:00:00");
        const targetYear = filtroTemporal.data.getFullYear();
        const targetMonth = filtroTemporal.data.getMonth();
        const targetDay = filtroTemporal.data.getDate();
        if (
          opDate.getFullYear() !== targetYear ||
          opDate.getMonth() !== targetMonth ||
          opDate.getDate() !== targetDay
        ) {
          return false;
        }
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const opDate = new Date(op.data_operacao + "T12:00:00");
        const fromDate = new Date(filtroTemporal.range.from);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = filtroTemporal.range.to ? new Date(filtroTemporal.range.to) : new Date(filtroTemporal.range.from);
        toDate.setHours(23, 59, 59, 999);

        if (opDate < fromDate || opDate > toDate) {
          return false;
        }
      }
      // 6. Busca textual por múltiplos identificadores auditados
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const matchCodigo = op.codigo.toLowerCase().includes(query);
        const matchCliente = op.fornecedor_nome.toLowerCase().includes(query);
        const matchTransp = op.transportadora_nome.toLowerCase().includes(query);
        const matchPlaca = op.placa.toLowerCase().includes(query);
        const matchNf = op.nf_numero_raw.toLowerCase().includes(query);
        const matchCtrc = (op.ctrc || "").toLowerCase().includes(query);
        if (!matchCodigo && !matchCliente && !matchTransp && !matchPlaca && !matchNf && !matchCtrc) {
          return false;
        }
      }
      return true;
    });
  }, [empresaFiltro, filtroTemporal, statusFiltro, statusRhFiltro, servicoFiltro, busca]);

  // Síntese Operacional (No máximo 4 KPIs compactos, foco estrito no estado do trabalho)
  const kpis = useMemo(() => {
    const total = operacoesFiltradas.length;
    const aguardandoValidacao = operacoesFiltradas.filter(
      (o) => o.status === "RECEBIDO" || o.status === "EM_VALIDACAO"
    ).length;
    const comRestricao = operacoesFiltradas.filter(
      (o) => o.status === "EM_RESTRICAO" || o.status_rh === "DEVOLVIDO_RH"
    ).length;
    const prontasFaturamento = operacoesFiltradas.filter(
      (o) => o.status === "AGUARDANDO_FATURAMENTO"
    ).length;

    return { total, aguardandoValidacao, comRestricao, prontasFaturamento };
  }, [operacoesFiltradas]);

  // Função para executar scroll e aplicar destaque temporário na primeira ocorrência
  const scrollToAndHighlight = (opId: string) => {
    setHighlightedOpId(opId);
    setTimeout(() => {
      const element = document.getElementById(`op-row-${opId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);

    // Fade-out do destaque após 1.8 segundos
    setTimeout(() => {
      setHighlightedOpId((current) => (current === opId ? null : current));
    }, 1800);
  };

  // Semântica de destaque baseada exclusivamente no estado real da linha localizada (Requisito 6)
  const getHighlightClasses = (op: OperacaoVolumeMock) => {
    // 1. Condição impeditiva / restrição (Rose)
    if (op.status === "EM_RESTRICAO" || op.status_rh === "DEVOLVIDO_RH") {
      return "bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/70 dark:ring-rose-500/80";
    }
    // 2. Em validação operacional ou análise RH (Âmbar)
    if (op.status === "EM_VALIDACAO" || op.status_rh === "EM_ANALISE_RH") {
      return "bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/70 dark:ring-amber-500/80";
    }
    // 3. Recebido operacional / aberto (Azul)
    if (op.status === "RECEBIDO") {
      return "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/70 dark:ring-blue-500/80";
    }
    // 4. Aguardando faturamento (Índigo)
    if (op.status === "AGUARDANDO_FATURAMENTO") {
      return "bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/70 dark:ring-indigo-500/80";
    }
    // 5. Faturado (Púrpura)
    if (op.status === "FATURADO") {
      return "bg-purple-50/70 dark:bg-purple-950/40 ring-2 ring-purple-500/70 dark:ring-purple-500/80";
    }
    // 6. Concluído / Recebido Financeiro (Esmeralda)
    if (op.status === "CONCLUIDO" || op.status === "RECEBIDO_FINANCEIRO") {
      return "bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/70 dark:ring-emerald-500/80";
    }
    // Fallback institucional neutro
    return "bg-royal-blue/10 dark:bg-royal-blue/20 ring-2 ring-royal-blue/70 dark:ring-royal-blue/80";
  };

  // Handlers dos cards superiores de navegação rápida (Navegação Circular Sequencial)
  const handleCardClickOperacoesPeriodo = () => {
    setActiveKpiNav("todos");
    // Leva suavemente ao início da tabela
    if (tableContainerRef.current) {
      if (typeof tableContainerRef.current.scrollTo === "function") {
        tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        tableContainerRef.current.scrollTop = 0;
      }
    }
  };

  const handleCardClickRequerValidacao = () => {
    setActiveKpiNav("validacao");
    // Prioriza primeiro EM_VALIDACAO, depois RECEBIDO (Requisito 3)
    const emVal = operacoesFiltradas.filter((o) => o.status === "EM_VALIDACAO");
    const recebidos = operacoesFiltradas.filter((o) => o.status === "RECEBIDO");
    const alvos = [...emVal, ...recebidos];

    if (alvos.length === 0) {
      toast.info("Nenhuma operação que requer validação nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.validacao % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      validacao: (currentIndex + 1) % alvos.length,
    }));
    scrollToAndHighlight(target.id);
  };

  const handleCardClickRestricao = () => {
    setActiveKpiNav("restricao");
    // Prioriza primeiro EM_RESTRICAO, depois DEVOLVIDO_RH (Requisito 4)
    const emRestricao = operacoesFiltradas.filter((o) => o.status === "EM_RESTRICAO");
    const devolvidos = operacoesFiltradas.filter(
      (o) => o.status_rh === "DEVOLVIDO_RH" && o.status !== "EM_RESTRICAO"
    );
    const alvos = [...emRestricao, ...devolvidos];

    if (alvos.length === 0) {
      toast.info("Nenhuma operação com restrição nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.restricao % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      restricao: (currentIndex + 1) % alvos.length,
    }));
    scrollToAndHighlight(target.id);
  };

  const handleCardClickProntas = () => {
    setActiveKpiNav("prontas");
    // Localiza exclusivamente AGUARDANDO_FATURAMENTO (Requisito 5)
    const alvos = operacoesFiltradas.filter((o) => o.status === "AGUARDANDO_FATURAMENTO");

    if (alvos.length === 0) {
      toast.info("Nenhuma operação pronta para faturamento nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.prontas % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      prontas: (currentIndex + 1) % alvos.length,
    }));
    scrollToAndHighlight(target.id);
  };

  const handleOpenOpDetails = (op: OperacaoVolumeMock) => {
    setSelectedOp(op);
    setDrawerOpen(true);
  };

  const handleResetFilters = () => {
    setEmpresaFiltro("todas");
    setFiltroTemporal({ type: "preset", preset: "todos" });
    setStatusFiltro("todos");
    setStatusRhFiltro("todos");
    setServicoFiltro("todos");
    setBusca("");
    setActiveKpiNav("todos");
    setHighlightedOpId(null);
    setCycleIndices({ validacao: 0, restricao: 0, prontas: 0 });
  };

  const hasActiveFilters =
    empresaFiltro !== "todas" ||
    filtroTemporal.type !== "preset" ||
    (filtroTemporal.preset && filtroTemporal.preset !== "todos") ||
    statusFiltro !== "todos" ||
    statusRhFiltro !== "todos" ||
    servicoFiltro !== "todos" ||
    busca.trim() !== "";

  // Renderizadores de badges com semântica de cores oficial
  const renderStatusBadge = (status: OperacaoVolumeMock["status"]) => {
    switch (status) {
      case "RECEBIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
            Recebido
          </span>
        );
      case "EM_VALIDACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Em Validação
          </span>
        );
      case "EM_RESTRICAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            Em Restrição
          </span>
        );
      case "AGUARDANDO_FATURAMENTO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
            Aguardando Faturamento
          </span>
        );
      case "FATURADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40">
            <Receipt className="w-3.5 h-3.5 text-purple-600" />
            Faturado
          </span>
        );
      case "RECEBIDO_FINANCEIRO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Recebido Financeiro
          </span>
        );
      case "CONCLUIDO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Concluído
          </span>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderStatusRhBadge = (statusRh: OperacaoVolumeMock["status_rh"]) => {
    switch (statusRh) {
      case "VALIDADO_RH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            Validado
          </span>
        );
      case "DEVOLVIDO_RH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            Devolvido
          </span>
        );
      case "EM_ANALISE_RH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <Clock className="w-3 h-3 text-amber-600" />
            Em Análise
          </span>
        );
      case "PENDENTE_RH":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border border-border">
            <Clock className="w-3 h-3 text-muted-foreground" />
            Pendente
          </span>
        );
    }
  };

  return (
    <UxLabShell
      activeItem="operacoes-volume"
      onSidebarSelect={(id) => {
        // Redirecionamento canônico tratado pela Sidebar
      }}
    >
      <div className="flex-1 min-h-0 flex flex-col w-full space-y-4">
        {/* CABEÇALHO OPERACIONAL */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Package className="w-5 h-5 text-royal-blue dark:text-royal-blue-light" />
                Operações por Volume
              </h1>
              <Badge variant="outline" className="text-[10px] tracking-wide uppercase font-semibold">
                UX Lab V2
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Acompanhe lançamentos, validações in loco e avanço das operações no pátio.
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
                {MOCK_EMPRESAS.map((e) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* CTA Estrutural: Nova Operação */}
            <Button
              size="sm"
              className="h-9 text-xs bg-royal-blue hover:bg-royal-blue/90 text-white font-medium shadow-sm flex items-center gap-1.5"
              onClick={() =>
                toast.info(
                  "Fluxo de Novo Lançamento V2 em desenvolvimento para a próxima fase. Foco atual: gestão de operações existentes."
                )
              }
            >
              <Plus className="w-4 h-4" />
              Nova Operação
            </Button>
          </div>
        </header>

        {/* SÍNTESE OPERACIONAL INTERATIVA (ATALHOS DE NAVEGAÇÃO OPERACIONAL) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Operações no período */}
          <button
            type="button"
            onClick={handleCardClickOperacoesPeriodo}
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "todos"
                ? "bg-card border-royal-blue/70 dark:border-royal-blue/60 shadow-xs ring-1 ring-royal-blue/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
            title="Mostrar todas as operações do período e ir ao topo"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block">
                Operações no Período
              </span>
              <div className="text-lg font-bold text-foreground font-mono">
                {kpis.total}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </button>

          {/* 2. Requer Validação */}
          <button
            type="button"
            onClick={handleCardClickRequerValidacao}
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "validacao"
                ? "bg-card border-amber-500/70 dark:border-amber-500/60 shadow-xs ring-1 ring-amber-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
            title="Localizar operações que requerem validação (prioriza Em Validação)"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider block">
                Requer Validação
              </span>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400 font-mono">
                {kpis.aguardandoValidacao}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </button>

          {/* 3. Com Restrição */}
          <button
            type="button"
            onClick={handleCardClickRestricao}
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "restricao"
                ? "bg-card border-rose-500/70 dark:border-rose-500/60 shadow-xs ring-1 ring-rose-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
            title="Localizar operações com restrição no pátio ou RH"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-rose-700 dark:text-rose-400 font-medium uppercase tracking-wider block">
                Com Restrição
              </span>
              <div className="text-lg font-bold text-rose-700 dark:text-rose-400 font-mono">
                {kpis.comRestricao}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </button>

          {/* 4. Prontas para Faturamento */}
          <button
            type="button"
            onClick={handleCardClickProntas}
            className={`p-3 rounded-lg border text-left flex items-center justify-between transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-royal-blue ${
              activeKpiNav === "prontas"
                ? "bg-card border-indigo-500/70 dark:border-indigo-500/60 shadow-xs ring-1 ring-indigo-500/30"
                : "bg-card border-border hover:border-border/80 hover:bg-muted/30"
            }`}
            title="Localizar operações prontas para faturamento"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium uppercase tracking-wider block">
                Prontas p/ Faturar
              </span>
              <div className="text-lg font-bold text-foreground font-mono">
                {kpis.prontasFaturamento}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Receipt className="w-4 h-4" />
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
                placeholder="Buscar código, cliente, placa, NF..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 h-8 text-xs bg-card border-border"
              />
            </div>

            {/* Filtro Temporal Híbrido ORBE (Atalhos, Dia Único e Range) */}
            <UxLabFiltroTemporal
              value={filtroTemporal}
              onChange={setFiltroTemporal}
            />

            {/* Status Operacional */}
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border">
                <SelectValue placeholder="Status Operação" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_STATUS_OPTIONS.map((st) => (
                  <SelectItem key={st.value} value={st.value} className="text-xs">
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Serviço */}
            <Select value={servicoFiltro} onValueChange={setServicoFiltro}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border">
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_SERVICOS.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mais Filtros (Popover) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs border-border flex items-center gap-1.5 ${
                    statusRhFiltro !== "todos" ? "border-royal-blue text-royal-blue font-semibold" : ""
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Mais filtros
                  {statusRhFiltro !== "todos" && (
                    <span className="w-1.5 h-1.5 rounded-full bg-royal-blue" />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3 space-y-3" align="start">
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">Status do RH</span>
                  <Select value={statusRhFiltro} onValueChange={setStatusRhFiltro}>
                    <SelectTrigger className="w-full h-8 text-xs">
                      <SelectValue placeholder="Status RH" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_STATUS_RH_OPTIONS.map((rh) => (
                        <SelectItem key={rh.value} value={rh.value} className="text-xs">
                          {rh.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </PopoverContent>
            </Popover>

            {/* Limpar Filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2"
                onClick={handleResetFilters}
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-right shrink-0">
            Exibindo <span className="font-semibold text-foreground">{operacoesFiltradas.length}</span> operações
          </div>
        </div>

        {/* TABELA OPERACIONAL DE ALTA DENSIDADE (PROTAGONISTA) */}
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col shadow-sm">
          <div ref={tableContainerRef} className="overflow-x-auto flex-1 custom-scrollbar-operacoes scroll-smooth">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-10 border-b border-border">
                <tr>
                  <th className="py-2 px-2.5 w-[90px] whitespace-nowrap">Operação</th>
                  <th className="py-2 px-2 w-[75px] whitespace-nowrap">Data</th>
                  <th className="py-2 px-2.5 max-w-[140px] truncate">Unidade / Contexto</th>
                  <th className="py-2 px-2.5 max-w-[160px] truncate">Fornecedor & Transporte</th>
                  <th className="py-2 px-2.5 whitespace-nowrap">Serviço & Volume</th>
                  <th className="py-2 px-2 whitespace-nowrap">Equipe</th>
                  <th className="py-2 px-2 w-[115px] whitespace-nowrap">Pipeline Operação</th>
                  <th className="py-2 px-2 whitespace-nowrap">Status RH</th>
                  <th className="py-2 px-2.5 max-w-[130px] truncate">Pendência</th>
                  <th className="py-2 px-2 text-right whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground font-sans">
                {operacoesFiltradas.length > 0 ? (
                  operacoesFiltradas.map((op) => {
                    const isHighlighted = highlightedOpId === op.id;
                    const rowHighlightClass = isHighlighted
                      ? getHighlightClasses(op)
                      : "hover:bg-muted/40";
                    return (
                      <tr
                        key={op.id}
                        id={`op-row-${op.id}`}
                        onClick={() => handleOpenOpDetails(op)}
                        className={`cursor-pointer transition-all duration-200 group ${rowHighlightClass}`}
                      >
                        {/* Código */}
                        <td className="py-2 px-2.5 w-[90px] font-mono font-bold text-royal-blue dark:text-royal-blue-light group-hover:underline whitespace-nowrap">
                          {op.codigo}
                        </td>

                      {/* Data */}
                      <td className="py-2 px-2 w-[75px] font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(op.data_operacao + "T12:00:00").toLocaleDateString("pt-BR")}
                      </td>

                      {/* Unidade */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <div className="font-medium text-foreground truncate max-w-[140px]" title={op.unidade_nome}>
                          {op.unidade_nome.split(" - ")[0]}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {op.empresa_nome}
                        </div>
                      </td>

                      {/* Fornecedor & Transportadora */}
                      <td className="py-2 px-2.5">
                        <div className="font-medium text-foreground truncate max-w-[160px]" title={op.fornecedor_nome}>
                          {op.fornecedor_nome}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono flex items-center gap-1.5">
                          <span>{op.placa}</span>
                          <span>•</span>
                          <span className="truncate max-w-[90px]">{op.transportadora_nome}</span>
                        </div>
                      </td>

                      {/* Serviço & Volume */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {op.tipo_servico_nome}
                        </div>
                        <div className="text-[10px] font-mono text-muted-foreground">
                          {op.quantidade.toLocaleString("pt-BR")} {op.unidade_medida}
                        </div>
                      </td>

                      {/* Equipe (Headcount vs Vinculados) */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-foreground">
                            {op.quantidade_colaboradores} pess.
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            ({op.colaboradores_vinculados.length} nom.)
                          </span>
                        </div>
                      </td>

                      {/* Pipeline Operacional (Stepper Compacto Transversal) */}
                      <td className="py-2 px-2 w-[115px] whitespace-nowrap">
                        <UxPipelineStepper
                          steps={OPERACOES_VOLUME_PIPELINE_STEPS}
                          currentStepKey={op.status}
                          exceptionState={
                            op.status === "EM_RESTRICAO"
                              ? {
                                  isException: true,
                                  label: "Em Restrição",
                                  stepKey: "EM_VALIDACAO",
                                  description: op.motivo_restricao || "Operação em restrição — bloqueio operacional",
                                }
                              : null
                          }
                          variant="compact"
                        />
                      </td>

                      {/* Status RH */}
                      <td className="py-2 px-2 whitespace-nowrap">
                        {renderStatusRhBadge(op.status_rh)}
                      </td>

                      {/* Pendência / Restrição Localizada */}
                      <td className="py-2 px-2.5 max-w-[130px] whitespace-nowrap">
                        {op.status === "EM_RESTRICAO" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 truncate" title={op.motivo_restricao || "Restrição"}>
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            {op.motivo_restricao?.slice(0, 18)}...
                          </span>
                        ) : op.status_rh === "DEVOLVIDO_RH" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                            <ShieldAlert className="w-3 h-3 shrink-0" />
                            Devolvido RH
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>

                      {/* Ação */}
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground group-hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenOpDetails(op);
                          }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground space-y-2">
                      <Package className="w-8 h-8 mx-auto text-muted-foreground/50" />
                      <p className="text-sm font-medium">Nenhuma operação encontrada com os filtros selecionados.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-8 border-border"
                        onClick={handleResetFilters}
                      >
                        Limpar Filtros
                      </Button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* DRAWER LATERAL DE DETALHE & DIAGNÓSTICO */}
        <UxLabOperacaoDrawer
          operacao={selectedOp}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      </div>
    </UxLabShell>
  );
}
