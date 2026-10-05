import React, { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  RotateCcw,
  Loader2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
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
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import { UxPipelineStepper } from "@/components/ux-lab/UxPipelineStepper";
import { NovaOperacaoDialog } from "@/components/operacoes/NovaOperacaoDialog";
import {
  OperacaoVolumeDrawer,
  OperacaoVolumeReal,
  OPERACOES_VOLUME_PIPELINE_STEPS,
  renderOperationalStatusBadge,
  renderStatusRhBadge,
} from "@/components/operacoes/OperacaoVolumeDrawer";
import {
  EmpresaService,
  OperacaoProducaoService,
  TipoServicoOperacionalService,
} from "@/services/base.service";
import { useTenant } from "@/contexts/TenantContext";

export const STATUS_OPERACIONAL_OPTIONS = [
  { value: "todos", label: "Todos os Status" },
  { value: "RECEBIDO", label: "Recebido (Aberto)" },
  { value: "EM_VALIDACAO", label: "Em Validação" },
  { value: "EM_RESTRICAO", label: "Em Restrição" },
  { value: "AGUARDANDO_FATURAMENTO", label: "Aguardando Faturamento" },
  { value: "FATURADO", label: "Faturado" },
  { value: "RECEBIDO_FINANCEIRO", label: "Recebido Financeiro" },
  { value: "CONCLUIDO", label: "Concluído" },
];

export const STATUS_RH_OPTIONS = [
  { value: "todos", label: "Todos do RH" },
  { value: "PENDENTE_RH", label: "Pendente RH" },
  { value: "EM_ANALISE_RH", label: "Em Análise RH" },
  { value: "VALIDADO_RH", label: "Validado pelo RH" },
  { value: "DEVOLVIDO_RH", label: "Devolvido pelo RH" },
];

export default function Operacoes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { tenantId, loading: isTenantLoading } = useTenant();

  // Filtros de Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>(() => {
    return searchParams.get("empresa") || "todas";
  });
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [statusFiltro, setStatusFiltro] = useState<string>(() => {
    return searchParams.get("status") || "todos";
  });
  const [statusRhFiltro, setStatusRhFiltro] = useState<string>("todos");
  const [servicoFiltro, setServicoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState<string>(() => {
    return searchParams.get("search") || "";
  });

  // Modais e Drawers
  const [novaOpOpen, setNovaOpOpen] = useState(false);
  const [editOpData, setEditOpData] = useState<any>(null);
  const [selectedOp, setSelectedOp] = useState<OperacaoVolumeReal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Navegação Interativa pelos 4 Cards Operacionais
  const [activeKpiNav, setActiveKpiNav] = useState<"todos" | "validacao" | "restricao" | "prontas">("todos");
  const [highlightedOpId, setHighlightedOpId] = useState<string | null>(null);
  const [cycleIndices, setCycleIndices] = useState<{
    validacao: number;
    restricao: number;
    prontas: number;
  }>({ validacao: 0, restricao: 0, prontas: 0 });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Tratamento de URL Query Action: ?action=nova-operacao
  useEffect(() => {
    if (searchParams.get("action") === "nova-operacao") {
      setEditOpData(null);
      setNovaOpOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("action");
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  // Resetar índices sequenciais sempre que filtros ou busca mudarem
  useEffect(() => {
    setCycleIndices({ validacao: 0, restricao: 0, prontas: 0 });
  }, [empresaFiltro, filtroTemporal, statusFiltro, statusRhFiltro, servicoFiltro, busca]);

  // 1. Fetch de Empresas
  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas", tenantId],
    queryFn: () => EmpresaService.getAll(),
    enabled: !isTenantLoading && !!tenantId,
  });

  // 2. Fetch de Tipos de Serviço Ativos
  const { data: servicos = [] } = useQuery({
    queryKey: ["tipos-servico-operacional"],
    queryFn: () => TipoServicoOperacionalService.getAllActive(),
  });

  // 3. Fetch Principal de Operações por Volume (Real do Supabase)
  const {
    data: operacoesRaw = [],
    isLoading: isLoadingOperacoes,
    isError: isErrorOperacoes,
    error: errorOperacoes,
    refetch: refetchOperacoes,
  } = useQuery({
    queryKey: ["operacoes-producao", empresaFiltro, tenantId],
    queryFn: () =>
      OperacaoProducaoService.getAll(
        empresaFiltro === "todas" ? undefined : empresaFiltro,
        tenantId
      ),
    enabled: !isTenantLoading && !!tenantId,
    placeholderData: (previousData) => previousData,
  });

  // Normalização e Enriquecimento das Operações Reais
  const operacoesNormalizadas: OperacaoVolumeReal[] = useMemo(() => {
    return (operacoesRaw || []).map((item: any) => {
      const codigo = `OP-${String(item.id || "").slice(0, 8).toUpperCase()}`;
      const empresaNome =
        item.empresas?.nome ||
        empresas.find((e: any) => e.id === item.empresa_id)?.nome ||
        "Empresa";
      const unidadeNome = item.unidades?.nome || "Unidade Operacional";
      const tipoServicoNome = item.tipos_servico_operacional?.nome || item.tipo_servico_label || "Descarga";
      const fornecedorNome = item.fornecedores?.nome || item.fornecedor_label || "—";
      const transportadoraNome = item.transportadoras_clientes?.nome || item.transportadora_label || "—";
      const produtoCargaNome = item.produtos_carga?.nome || item.produto_label || "—";
      const formaPagamentoNome = item.formas_pagamento_operacional?.nome || "Faturamento Padrão";

      return {
        ...item,
        codigo,
        empresa_nome: empresaNome,
        unidade_nome: unidadeNome,
        tipo_servico_nome: tipoServicoNome,
        fornecedor_nome: fornecedorNome,
        transportadora_nome: transportadoraNome,
        produto_carga_nome: produtoCargaNome,
        forma_pagamento_nome: formaPagamentoNome,
        status: item.status || "RECEBIDO",
        status_rh: item.status_rh || "PENDENTE_RH",
      };
    });
  }, [operacoesRaw, empresas]);

  // 1. Contexto Estrutural e Temporal (Empresa + Período)
  const operacoesContextuais = useMemo(() => {
    return operacoesNormalizadas.filter((op) => {
      // 1. Empresa
      if (empresaFiltro !== "todas" && op.empresa_id !== empresaFiltro) {
        return false;
      }
      // 2. Filtro Temporal Híbrido (Estritamente data_operacao)
      if (op.data_operacao) {
        if (filtroTemporal.type === "preset") {
          const now = new Date();
          const todayStr = now.toISOString().split("T")[0];
          const currentMonthStr = todayStr.slice(0, 7);
          const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`;

          if (filtroTemporal.preset === "hoje" && op.data_operacao !== todayStr) {
            return false;
          }
          if (filtroTemporal.preset === "mes_atual" && !op.data_operacao.startsWith(currentMonthStr)) {
            return false;
          }
          if (filtroTemporal.preset === "mes_anterior" && !op.data_operacao.startsWith(lastMonthStr)) {
            return false;
          }
        } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
          const targetStr = filtroTemporal.data.toISOString().split("T")[0];
          if (op.data_operacao !== targetStr) {
            return false;
          }
        } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
          const fromStr = filtroTemporal.range.from.toISOString().split("T")[0];
          const toStr = (filtroTemporal.range.to || filtroTemporal.range.from).toISOString().split("T")[0];
          if (op.data_operacao < fromStr || op.data_operacao > toStr) {
            return false;
          }
        }
      }
      return true;
    });
  }, [operacoesNormalizadas, empresaFiltro, filtroTemporal]);

  // 2. 4 Cards de Síntese Operacional (Derivados do contexto macro Empresa + Período)
  const kpis = useMemo(() => {
    const total = operacoesContextuais.length;
    const aguardandoValidacao = operacoesContextuais.filter((o) => {
      const s = (o.status || "").toUpperCase();
      return s === "RECEBIDO" || s === "PENDENTE" || s === "ABERTO" || s === "EM_VALIDACAO";
    }).length;
    const comRestricao = operacoesContextuais.filter((o) => {
      const s = (o.status || "").toUpperCase();
      const sRh = (o.status_rh || "").toUpperCase();
      return s === "EM_RESTRICAO" || s === "INCONSISTENTE" || sRh === "DEVOLVIDO_RH" || !o.entrada_ponto || !o.saida_ponto;
    }).length;
    const prontasFaturamento = operacoesContextuais.filter((o) => {
      const s = (o.status || "").toUpperCase();
      return s === "AGUARDANDO_FATURAMENTO";
    }).length;

    return { total, aguardandoValidacao, comRestricao, prontasFaturamento };
  }, [operacoesContextuais]);

  // 3. Filtragem Exploratória da Tabela (operacoesContextuais + Filtros Locais e Card Ativo)
  const operacoesFiltradas = useMemo(() => {
    return operacoesContextuais.filter((op) => {
      // 1. Filtro Contextual por Card Ativo
      if (activeKpiNav === "validacao") {
        const s = (op.status || "").toUpperCase();
        if (s !== "RECEBIDO" && s !== "PENDENTE" && s !== "ABERTO" && s !== "EM_VALIDACAO") {
          return false;
        }
      } else if (activeKpiNav === "restricao") {
        const s = (op.status || "").toUpperCase();
        const sRh = (op.status_rh || "").toUpperCase();
        if (s !== "EM_RESTRICAO" && s !== "INCONSISTENTE" && sRh !== "DEVOLVIDO_RH" && op.entrada_ponto && op.saida_ponto) {
          return false;
        }
      } else if (activeKpiNav === "prontas") {
        const s = (op.status || "").toUpperCase();
        if (s !== "AGUARDANDO_FATURAMENTO") {
          return false;
        }
      }

      // 2. Serviço
      if (servicoFiltro !== "todos" && op.tipo_servico_id !== servicoFiltro) {
        return false;
      }
      // 3. Status Operacional
      if (statusFiltro !== "todos") {
        const opStatus = (op.status || "").toUpperCase();
        if (statusFiltro === "RECEBIDO" && opStatus !== "RECEBIDO" && opStatus !== "PENDENTE" && opStatus !== "ABERTO") {
          return false;
        }
        if (statusFiltro === "EM_RESTRICAO" && opStatus !== "EM_RESTRICAO" && opStatus !== "INCONSISTENTE") {
          return false;
        }
        if (statusFiltro === "CONCLUIDO" && opStatus !== "CONCLUIDO" && opStatus !== "FECHADO") {
          return false;
        }
        if (statusFiltro !== "RECEBIDO" && statusFiltro !== "EM_RESTRICAO" && statusFiltro !== "CONCLUIDO" && opStatus !== statusFiltro) {
          return false;
        }
      }
      // 4. Status RH
      if (statusRhFiltro !== "todos" && op.status_rh !== statusRhFiltro) {
        return false;
      }

      // 5. Busca Textual por Múltiplos Campos
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const matchCodigo = (op.codigo || "").toLowerCase().includes(query);
        const matchCliente = (op.fornecedor_nome || "").toLowerCase().includes(query);
        const matchTransp = (op.transportadora_nome || "").toLowerCase().includes(query);
        const matchPlaca = (op.placa || "").toLowerCase().includes(query);
        const matchNf = (op.nf_numero || "").toLowerCase().includes(query);
        const matchCtrc = (op.ctrc || "").toLowerCase().includes(query);
        if (!matchCodigo && !matchCliente && !matchTransp && !matchPlaca && !matchNf && !matchCtrc) {
          return false;
        }
      }
      return true;
    });
  }, [operacoesContextuais, activeKpiNav, servicoFiltro, statusFiltro, statusRhFiltro, busca]);

  // Scroll e Destaque Visual Interativo
  const scrollToAndHighlight = (opId: string) => {
    setHighlightedOpId(opId);
    setTimeout(() => {
      const element = document.getElementById(`op-row-${opId}`);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 50);

    setTimeout(() => {
      setHighlightedOpId((current) => (current === opId ? null : current));
    }, 1800);
  };

  const getHighlightClasses = (op: OperacaoVolumeReal) => {
    const s = (op.status || "").toUpperCase();
    const sRh = (op.status_rh || "").toUpperCase();

    if (s === "EM_RESTRICAO" || s === "INCONSISTENTE" || sRh === "DEVOLVIDO_RH" || !op.entrada_ponto || !op.saida_ponto) {
      return "bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/70 dark:ring-rose-500/80";
    }
    if (s === "EM_VALIDACAO" || sRh === "EM_ANALISE_RH") {
      return "bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/70 dark:ring-amber-500/80";
    }
    if (s === "RECEBIDO" || s === "PENDENTE" || s === "ABERTO") {
      return "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/70 dark:ring-blue-500/80";
    }
    if (s === "AGUARDANDO_FATURAMENTO") {
      return "bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/70 dark:ring-indigo-500/80";
    }
    if (s === "FATURADO") {
      return "bg-purple-50/70 dark:bg-purple-950/40 ring-2 ring-purple-500/70 dark:ring-purple-500/80";
    }
    if (s === "CONCLUIDO" || s === "RECEBIDO_FINANCEIRO" || s === "FECHADO") {
      return "bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/70 dark:ring-emerald-500/80";
    }
    return "bg-royal-blue/10 dark:bg-royal-blue/20 ring-2 ring-royal-blue/70 dark:ring-royal-blue/80";
  };

  // Handlers dos 4 Cards de Síntese Operacional (Filtro contextual sem zerar os números macro)
  const handleCardClickOperacoesPeriodo = () => {
    setActiveKpiNav("todos");
    if (tableContainerRef.current) {
      if (typeof tableContainerRef.current.scrollTo === "function") {
        tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        tableContainerRef.current.scrollTop = 0;
      }
    }
  };

  const handleCardClickRequerValidacao = () => {
    setActiveKpiNav((current) => (current === "validacao" ? "todos" : "validacao"));
  };

  const handleCardClickRestricao = () => {
    setActiveKpiNav((current) => (current === "restricao" ? "todos" : "restricao"));
  };

  const handleCardClickProntas = () => {
    setActiveKpiNav((current) => (current === "prontas" ? "todos" : "prontas"));
  };

  const handleOpenOpDetails = (op: OperacaoVolumeReal) => {
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
    activeKpiNav !== "todos" ||
    busca.trim() !== "";

  const isLoading = isLoadingEmpresas || isLoadingOperacoes;

  return (
    <AppShell
      title="Operações por Volume"
      subtitle="Acompanhe lançamentos, validações in loco e avanço das operações no pátio."
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
                Oficial
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Acompanhe lançamentos, validações in loco e avanço das operações no pátio.
            </p>
          </div>

          {/* Contexto Estrutural & CTA */}
          <div className="flex items-center gap-2.5">
            {/* Seletor de Empresa */}
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger aria-label="Seletor de Empresa" className="w-[200px] h-9 text-xs bg-card border-border">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas" className="text-xs">
                  Todas as empresas
                </SelectItem>
                {empresas.map((e: any) => (
                  <SelectItem key={e.id} value={e.id} className="text-xs">
                    {e.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* CTA Estrutural: Nova Operação */}
            <Button
              size="sm"
              className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm flex items-center gap-1.5"
              onClick={() => {
                setEditOpData(null);
                setNovaOpOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              Nova Operação
            </Button>
          </div>
        </header>

        {/* 4 CARDS OPERACIONAIS (SÍNTESE DE ESTADO DO TRABALHO) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* 1. Operações no Período */}
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
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin my-1" /> : kpis.total}
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
            title="Localizar operações que requerem validação"
          >
            <div className="space-y-0.5">
              <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium uppercase tracking-wider block">
                Requer Validação
              </span>
              <div className="text-lg font-bold text-amber-700 dark:text-amber-400 font-mono">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin my-1" /> : kpis.aguardandoValidacao}
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
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin my-1" /> : kpis.comRestricao}
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
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin my-1" /> : kpis.prontasFaturamento}
              </div>
            </div>
            <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-950/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
              <Receipt className="w-4 h-4" />
            </div>
          </button>
        </div>

        {/* BARRA DE TRABALHO & FILTROS */}
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

            {/* Filtro Temporal Híbrido ORBE */}
            <UxLabFiltroTemporal
              value={filtroTemporal}
              onChange={setFiltroTemporal}
            />

            {/* Status Operacional */}
            <Select value={statusFiltro} onValueChange={setStatusFiltro}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border shrink-0">
                <SelectValue placeholder="Status Operação" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPERACIONAL_OPTIONS.map((st) => (
                  <SelectItem key={st.value} value={st.value} className="text-xs">
                    {st.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Tipo de Serviço */}
            <Select value={servicoFiltro} onValueChange={setServicoFiltro}>
              <SelectTrigger className="w-[160px] h-8 text-xs bg-card border-border shrink-0">
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">
                  Todos os Serviços
                </SelectItem>
                {servicos.map((s: any) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    {s.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mais Filtros (Popover com Status RH) */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 text-xs border-border flex items-center gap-1.5 shrink-0 ${
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
                      {STATUS_RH_OPTIONS.map((rh) => (
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
                className="h-8 text-xs text-muted-foreground hover:text-foreground px-2 shrink-0"
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

        {/* TABELA OPERACIONAL DE ALTA DENSIDADE */}
        <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col shadow-sm">
          {isLoading && operacoesRaw.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-24 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-royal-blue" />
              <p className="text-xs font-medium text-muted-foreground animate-pulse">
                Carregando operações por volume...
              </p>
            </div>
          ) : isErrorOperacoes ? (
            <div className="flex flex-col items-center justify-center p-20 space-y-3 text-center">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Não foi possível carregar as operações.</p>
                <p className="text-xs text-muted-foreground">{(errorOperacoes as any)?.message || "Erro de conexão com o banco de dados."}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => refetchOperacoes()}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Tentar novamente
              </Button>
            </div>
          ) : (
            <div ref={tableContainerRef} className="overflow-x-auto flex-1 custom-scrollbar-operacoes scroll-smooth">
              <table className="w-full text-xs text-left border-collapse min-w-[950px]">
                <thead className="bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-10 border-b border-border">
                  <tr>
                    <th className="py-2 px-2.5 w-[90px] min-w-[90px] whitespace-nowrap">Operação</th>
                    <th className="py-2 px-2 w-[80px] min-w-[80px] whitespace-nowrap">Data</th>
                    <th className="py-2 px-2.5 w-[140px] min-w-[140px] max-w-[140px] truncate">Unidade / Contexto</th>
                    <th className="py-2 px-2.5 w-[160px] min-w-[160px] max-w-[160px] truncate">Fornecedor & Transporte</th>
                    <th className="py-2 px-2.5 w-[130px] min-w-[130px] whitespace-nowrap">Serviço & Volume</th>
                    <th className="py-2 px-2 w-[95px] min-w-[95px] whitespace-nowrap">Equipe</th>
                    <th className="py-2 px-2 w-[125px] min-w-[125px] whitespace-nowrap">Pipeline Operação</th>
                    <th className="py-2 px-2 w-[105px] min-w-[105px] whitespace-nowrap">Status RH</th>
                    <th className="py-2 px-2.5 w-[130px] min-w-[130px] max-w-[130px] truncate">Pendência</th>
                    <th className="py-2 px-2 w-[50px] min-w-[50px] text-right whitespace-nowrap">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground font-sans">
                  {operacoesFiltradas.length > 0 ? (
                    operacoesFiltradas.map((op) => {
                      const isHighlighted = highlightedOpId === op.id;
                      const rowHighlightClass = isHighlighted
                        ? getHighlightClasses(op)
                        : "hover:bg-muted/40";

                      const isHorarioIncompleto = !op.entrada_ponto || !op.saida_ponto;
                      const motivoRestricao =
                        op.avaliacao_json?.motivo_restricao ||
                        (isHorarioIncompleto ? "Horários incompletos" : null);

                      const colaboradoresCount = op.production_entry_collaborators?.length || 0;

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
                            {op.data_operacao ? new Date(op.data_operacao + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </td>

                          {/* Unidade & Empresa */}
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            <div className="font-medium text-foreground truncate max-w-[140px]" title={op.unidade_nome}>
                              {op.unidade_nome}
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
                              <span>{op.placa || "—"}</span>
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
                              {Number(op.quantidade || 0).toLocaleString("pt-BR")} {op.unidade_medida || "cx"}
                            </div>
                          </td>

                          {/* Equipe (Headcount vs Vinculados Nominais) */}
                          <td className="py-2 px-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-foreground">
                                {op.quantidade_colaboradores || 1} pess.
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                ({colaboradoresCount} nom.)
                              </span>
                            </div>
                          </td>

                          {/* Pipeline Operacional (Stepper Compacto) */}
                          <td className="py-2 px-2 w-[115px] whitespace-nowrap">
                            <UxPipelineStepper
                              steps={OPERACOES_VOLUME_PIPELINE_STEPS}
                              currentStepKey={op.status}
                              exceptionState={
                                op.status === "EM_RESTRICAO" || isHorarioIncompleto
                                  ? {
                                      isException: true,
                                      label: "Em Restrição",
                                      stepKey: "EM_VALIDACAO",
                                      description: motivoRestricao || "Operação em restrição — bloqueio operacional",
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
                            {op.status === "EM_RESTRICAO" || isHorarioIncompleto ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 truncate" title={motivoRestricao || "Restrição"}>
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                {motivoRestricao ? motivoRestricao.slice(0, 18) + "..." : "Restrição"}
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
                  ) : operacoesContextuais.length > 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground space-y-2">
                        <Package className="w-8 h-8 mx-auto text-muted-foreground/50" />
                        <p className="text-sm font-medium text-foreground">Nenhuma operação encontrada com os filtros selecionados.</p>
                        <p className="text-xs text-muted-foreground">Tente ajustar seus termos de busca ou filtros exploratórios.</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 border-border"
                          onClick={handleResetFilters}
                        >
                          <RotateCcw className="w-3 h-3 mr-1.5" />
                          Limpar Filtros
                        </Button>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground space-y-2">
                        <Package className="w-8 h-8 mx-auto text-muted-foreground/50" />
                        <p className="text-sm font-medium text-foreground">Nenhuma operação registrada para o período e empresa selecionados.</p>
                        <p className="text-xs text-muted-foreground">Inicie um novo apontamento para alimentar a base operacional.</p>
                        <Button
                          size="sm"
                          className="text-xs h-8 bg-royal-blue hover:bg-royal-blue/90 text-white"
                          onClick={() => {
                            setEditOpData(null);
                            setNovaOpOpen(true);
                          }}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" />
                          Nova Operação
                        </Button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* DRAWER ESPECIALISTA OFICIAL */}
        <OperacaoVolumeDrawer
          operacao={selectedOp}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onEditRequest={(op) => {
            setDrawerOpen(false);
            setEditOpData(op);
            setNovaOpOpen(true);
          }}
        />

        {/* DIALOG REAL DE CRIAÇÃO / EDIÇÃO */}
        <NovaOperacaoDialog
          open={novaOpOpen}
          onOpenChange={(open) => {
            setNovaOpOpen(open);
            if (!open) {
              setTimeout(() => setEditOpData(null), 200);
            }
          }}
          initialData={editOpData}
        />
      </div>
    </AppShell>
  );
}
