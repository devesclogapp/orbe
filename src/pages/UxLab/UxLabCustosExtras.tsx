import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Wallet,
  Plus,
  Search,
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
  Coins,
  CreditCard,
  User,
  Building,
  History
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabCustoExtraDrawer } from "@/components/ux-lab/UxLabCustoExtraDrawer";
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
  CUSTOS_EXTRAS_MOCKS,
  MOCK_EMPRESAS_CUSTOS_EXTRAS,
  MOCK_CATEGORIAS_CUSTOS,
  MOCK_ORIGEM_RECURSO_OPTIONS,
  MOCK_PIPELINE_STATUS_OPTIONS,
  CustoExtraMock,
  PipelineStatusCustoExtra,
  OrigemRecursoCustoExtra,
  CategoriaCustoExtra,
  getFriendlyOrigemRecurso,
  getFriendlyPipelineStatus,
  getFriendlyStatusPagamento,
  getFriendlyCategoria
} from "./custosExtrasMockData";

export default function UxLabCustosExtras() {
  // Filtros de Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("todas");
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [pipelineStatusFiltro, setPipelineStatusFiltro] = useState<string>("todos");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todos");
  const [origemRecursoFiltro, setOrigemRecursoFiltro] = useState<string>("todos");
  const [busca, setBusca] = useState<string>("");

  // Drawer de Detalhes
  const [selectedCusto, setSelectedCusto] = useState<CustoExtraMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Navegação Interativa pelos Cards de Síntese
  const [activeKpiNav, setActiveKpiNav] = useState<"todos" | "requer_acao" | "a_pagar" | "pagos">("todos");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [cycleIndices, setCycleIndices] = useState<Record<string, number>>({
    requerAcao: 0,
    aPagar: 0,
    pagos: 0,
  });
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Reset de ciclos ao alterar filtros ou busca (Requisito Canônico de Coerência)
  useEffect(() => {
    setCycleIndices({
      requerAcao: 0,
      aPagar: 0,
      pagos: 0,
    });
  }, [empresaFiltro, categoriaFiltro, origemRecursoFiltro, pipelineStatusFiltro, filtroTemporal, busca]);

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
  const custosFiltrados = useMemo(() => {
    return CUSTOS_EXTRAS_MOCKS.filter((c) => {
      // 1. Empresa
      if (empresaFiltro !== "todas" && c.empresa_id !== empresaFiltro) {
        return false;
      }
      // 2. Categoria de Custo
      if (categoriaFiltro !== "todos" && c.categoria_custo !== categoriaFiltro) {
        return false;
      }
      // 3. Origem do Recurso
      if (origemRecursoFiltro !== "todos" && c.origem_recurso !== origemRecursoFiltro) {
        return false;
      }
      // 4. Pipeline Status
      if (pipelineStatusFiltro !== "todos" && c.pipeline_status !== pipelineStatusFiltro) {
        return false;
      }
      // 5. Filtro Temporal Híbrido Reutilizado (data da despesa / competência)
      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje" && c.data !== "2026-10-03") {
          return false;
        }
        if (filtroTemporal.preset === "setembro" && !c.data.startsWith("2026-09")) {
          return false;
        }
        if (filtroTemporal.preset === "outubro" && !c.data.startsWith("2026-10")) {
          return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const cDate = new Date(c.data + "T12:00:00");
        const targetYear = filtroTemporal.data.getFullYear();
        const targetMonth = filtroTemporal.data.getMonth();
        const targetDay = filtroTemporal.data.getDate();
        if (
          cDate.getFullYear() !== targetYear ||
          cDate.getMonth() !== targetMonth ||
          cDate.getDate() !== targetDay
        ) {
          return false;
        }
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const cDate = new Date(c.data + "T12:00:00");
        const fromDate = new Date(filtroTemporal.range.from);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = filtroTemporal.range.to
          ? new Date(filtroTemporal.range.to)
          : new Date(filtroTemporal.range.from);
        toDate.setHours(23, 59, 59, 999);

        if (cDate < fromDate || cDate > toDate) {
          return false;
        }
      }
      // 6. Busca textual por código, descrição, favorecido, empresa e categoria
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const matchCodigo = c.codigo.toLowerCase().includes(query);
        const matchDesc = c.descricao.toLowerCase().includes(query);
        const matchEmpresa = c.empresa_nome.toLowerCase().includes(query);
        const matchCategoria = getFriendlyCategoria(c.categoria_custo).toLowerCase().includes(query);
        const matchColab = c.favorecido_colaborador_nome?.toLowerCase().includes(query) || false;
        const matchForn = c.favorecido_fornecedor_nome?.toLowerCase().includes(query) || false;
        const matchResponsavel = c.responsavel_nome.toLowerCase().includes(query);

        if (
          !matchCodigo &&
          !matchDesc &&
          !matchEmpresa &&
          !matchCategoria &&
          !matchColab &&
          !matchForn &&
          !matchResponsavel
        ) {
          return false;
        }
      }

      return true;
    });
  }, [empresaFiltro, filtroTemporal, categoriaFiltro, origemRecursoFiltro, pipelineStatusFiltro, busca]);

  // Síntese Operacional com R$ e Contagem (4 Indicadores Canônicos)
  const kpis = useMemo(() => {
    // 1. Total no Período
    const totalCount = custosFiltrados.length;
    const totalValor = custosFiltrados.reduce((acc, curr) => acc + curr.total, 0);

    // 2. Requer Ação: REPROVADO | EM_VALIDACAO | RECEBIDO
    const itensRequerAcao = custosFiltrados.filter((c) =>
      ["REPROVADO", "EM_VALIDACAO", "RECEBIDO"].includes(c.pipeline_status)
    );
    const requerAcaoCount = itensRequerAcao.length;
    const requerAcaoValor = itensRequerAcao.reduce((acc, curr) => acc + curr.total, 0);
    const reprovadosCount = custosFiltrados.filter((c) => c.pipeline_status === "REPROVADO").length;

    // 3. A Pagar / Financeiro:
    // Obrigação financeira real aberta (APROVADO_OPERACAO ou ENVIADO_FINANCEIRO com status_pagamento = A_PAGAR ou ATRASADO)
    // EXCLUI ESTRITAMENTE PAGO_EMPRESA (gasto já desembolsado pela empresa que não gera passivo futuro)
    const itensAPagar = custosFiltrados.filter((c) => {
      const isObrigacaoAberta = c.status_pagamento === "A_PAGAR" || c.status_pagamento === "ATRASADO";
      const isOrigemPassivo = c.origem_recurso !== "PAGO_EMPRESA";
      const isAprovado = ["APROVADO_OPERACAO", "ENVIADO_FINANCEIRO"].includes(c.pipeline_status);
      return isObrigacaoAberta && isOrigemPassivo && isAprovado;
    });
    const aPagarCount = itensAPagar.length;
    const aPagarValor = itensAPagar.reduce((acc, curr) => acc + curr.total, 0);

    // 4. Pagos / Liquidados:
    // Desembolso já ocorrido: PAGO_EMPRESA (gasto direto da empresa) OU obrigação liquidada com status_pagamento = PAGO
    const itensPagos = custosFiltrados.filter((c) => {
      const isPagoEmpresa = c.origem_recurso === "PAGO_EMPRESA" && c.pipeline_status === "FINALIZADO";
      const isLiquidado = c.status_pagamento === "PAGO";
      return isPagoEmpresa || isLiquidado;
    });
    const pagosCount = itensPagos.length;
    const pagosValor = itensPagos.reduce((acc, curr) => acc + curr.total, 0);

    return {
      totalCount,
      totalValor,
      requerAcaoCount,
      requerAcaoValor,
      reprovadosCount,
      aPagarCount,
      aPagarValor,
      pagosCount,
      pagosValor,
    };
  }, [custosFiltrados]);

  // Função para executar scroll suave e aplicar destaque temporário na ocorrência localizada
  const scrollToTarget = (targetId: string) => {
    setHighlightedId(targetId);
    setTimeout(() => {
      const container = tableContainerRef.current;
      const el = document.getElementById(`row-custo-${targetId}`);
      if (!container || !el) return;
      // Rola SOMENTE o container da tabela (não a página)
      const headerH = container.querySelector("thead")?.getBoundingClientRect().height ?? 0;
      const cRect = container.getBoundingClientRect();
      const eRect = el.getBoundingClientRect();
      const offsetTop = eRect.top - cRect.top + container.scrollTop;
      const top = Math.max(
        0,
        offsetTop - headerH - (container.clientHeight - headerH - eRect.height) / 2
      );
      if (typeof container.scrollTo === "function") {
        container.scrollTo({ top, behavior: "smooth" });
      } else {
        container.scrollTop = top;
      }
    }, 50);

    setTimeout(() => {
      setHighlightedId((current) => (current === targetId ? null : current));
    }, 1800);
  };

  // Semântica de destaque baseada exclusivamente no estado real da linha localizada (Card != Badge != Highlight)
  const getHighlightClasses = (c: CustoExtraMock) => {
    // 1. Reprovado / Devolvido (Rose/Vermelho)
    if (c.pipeline_status === "REPROVADO") {
      return "bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/70 dark:ring-rose-500/80";
    }
    // 2. Obrigação Atrasada (Rose/Vermelho)
    if (c.status_pagamento === "ATRASADO") {
      return "bg-rose-50/70 dark:bg-rose-950/40 ring-2 ring-rose-500/70 dark:ring-rose-500/80";
    }
    // 3. Em Validação (Âmbar)
    if (c.pipeline_status === "EM_VALIDACAO") {
      return "bg-amber-50/70 dark:bg-amber-950/40 ring-2 ring-amber-500/70 dark:ring-amber-500/80";
    }
    // 4. Recebido (Azul)
    if (c.pipeline_status === "RECEBIDO") {
      return "bg-blue-50/70 dark:bg-blue-950/40 ring-2 ring-blue-500/70 dark:ring-blue-500/80";
    }
    // 5. Aprovado na operação (Esmeralda)
    if (c.pipeline_status === "APROVADO_OPERACAO") {
      return "bg-emerald-50/70 dark:bg-emerald-950/40 ring-2 ring-emerald-500/70 dark:ring-emerald-500/80";
    }
    // 6. Enviado ao Financeiro (Índigo)
    if (c.pipeline_status === "ENVIADO_FINANCEIRO") {
      return "bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/70 dark:ring-indigo-500/80";
    }
    // 7. Finalizado / Concluído (Zinc/Neutro)
    if (c.pipeline_status === "FINALIZADO") {
      return "bg-zinc-100/70 dark:bg-zinc-800/60 ring-2 ring-zinc-500/70 dark:ring-zinc-500/80";
    }
    // Fallback institucional
    return "bg-royal-blue/10 dark:bg-royal-blue/20 ring-2 ring-royal-blue/70 dark:ring-royal-blue/80";
  };

  // Handlers dos Cards de Síntese (Navegação Circular Sequencial)
  const handleCardClickCustosPeriodo = () => {
    setActiveKpiNav("todos");
    if (tableContainerRef.current) {
      if (typeof tableContainerRef.current.scrollTo === "function") {
        tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        tableContainerRef.current.scrollTop = 0;
      }
    } else if (custosFiltrados.length > 0) {
      scrollToTarget(custosFiltrados[0].id);
    } else {
      toast.info("Nenhum custo extra correspondente nos filtros atuais.");
    }
  };

  const handleCardClickRequerAcao = () => {
    setActiveKpiNav("requer_acao");
    // Prioridade estrita: 1º REPROVADO, 2º EM_VALIDACAO, 3º RECEBIDO
    const reprovados = custosFiltrados.filter((c) => c.pipeline_status === "REPROVADO");
    const emVal = custosFiltrados.filter((c) => c.pipeline_status === "EM_VALIDACAO");
    const recebidos = custosFiltrados.filter((c) => c.pipeline_status === "RECEBIDO");
    const alvos = [...reprovados, ...emVal, ...recebidos];

    if (alvos.length === 0) {
      toast.info("Nenhum custo extra que requer ação nos filtros atuais.");
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

  const handleCardClickAPagar = () => {
    setActiveKpiNav("a_pagar");
    // Obrigações em aberto (exclui PAGO_EMPRESA)
    const atrasados = custosFiltrados.filter(
      (c) =>
        c.status_pagamento === "ATRASADO" &&
        c.origem_recurso !== "PAGO_EMPRESA" &&
        ["APROVADO_OPERACAO", "ENVIADO_FINANCEIRO"].includes(c.pipeline_status)
    );
    const enviadosFin = custosFiltrados.filter(
      (c) =>
        c.status_pagamento === "A_PAGAR" &&
        c.origem_recurso !== "PAGO_EMPRESA" &&
        c.pipeline_status === "ENVIADO_FINANCEIRO"
    );
    const aprovadosOp = custosFiltrados.filter(
      (c) =>
        c.status_pagamento === "A_PAGAR" &&
        c.origem_recurso !== "PAGO_EMPRESA" &&
        c.pipeline_status === "APROVADO_OPERACAO"
    );
    const alvos = [...atrasados, ...enviadosFin, ...aprovadosOp];

    if (alvos.length === 0) {
      toast.info("Nenhuma obrigação a pagar nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.aPagar % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      aPagar: (currentIndex + 1) % alvos.length,
    }));
    scrollToTarget(target.id);
  };

  const handleCardClickPagos = () => {
    setActiveKpiNav("pagos");
    const alvos = custosFiltrados.filter(
      (c) =>
        (c.origem_recurso === "PAGO_EMPRESA" && c.pipeline_status === "FINALIZADO") ||
        c.status_pagamento === "PAGO"
    );

    if (alvos.length === 0) {
      toast.info("Nenhum custo pago ou liquidado nos filtros atuais.");
      return;
    }

    const currentIndex = cycleIndices.pagos % alvos.length;
    const target = alvos[currentIndex];
    setCycleIndices((prev) => ({
      ...prev,
      pagos: (currentIndex + 1) % alvos.length,
    }));
    scrollToTarget(target.id);
  };

  const hasActiveFilters =
    empresaFiltro !== "todas" ||
    categoriaFiltro !== "todos" ||
    origemRecursoFiltro !== "todos" ||
    pipelineStatusFiltro !== "todos" ||
    filtroTemporal.preset !== "todos" ||
    busca.trim() !== "";

  const handleResetFilters = () => {
    setEmpresaFiltro("todas");
    setCategoriaFiltro("todos");
    setOrigemRecursoFiltro("todos");
    setPipelineStatusFiltro("todos");
    setFiltroTemporal({ type: "preset", preset: "todos" });
    setBusca("");
    toast.success("Filtros redefinidos para o padrão.");
  };

  const handleOpenDrawer = (custo: CustoExtraMock) => {
    setSelectedCusto(custo);
    setDrawerOpen(true);
  };

  return (
    <UxLabShell activeItem="custos-extras">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* CABEÇALHO ESPECIALISTA */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-royal-blue/10 dark:bg-royal-blue/20 text-royal-blue dark:text-royal-blue-light">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl font-display">
                    Custos Extras
                  </h1>
                  <Badge
                    variant="outline"
                    className="border-royal-blue/30 bg-royal-blue/10 text-royal-blue dark:text-royal-blue-light text-[10px] font-bold px-1.5 py-0"
                  >
                    UX LAB V2
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Acompanhe despesas extraordinárias, validações e obrigações financeiras.
                </p>
              </div>
            </div>
          </div>

          {/* CONTROLES DO CABEÇALHO */}
          <div className="flex items-center gap-2.5">
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger
                aria-label="Seletor de Empresa"
                className="h-9 w-[220px] text-xs font-medium bg-card border-border"
              >
                <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_EMPRESAS_CUSTOS_EXTRAS.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-9 text-xs font-semibold bg-royal-blue hover:bg-royal-blue/90 text-white shadow-sm flex items-center gap-1.5"
              onClick={() =>
                toast.info("Cadastro de Custo Extra V2", {
                  description: "O formulário em etapas estará disponível na próxima fase do UX Lab.",
                })
              }
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Custo Extra</span>
            </Button>
          </div>
        </div>

        {/* CARDS DE SÍNTESE OPERACIONAL (VALOR EM R$ + CONTAGEM) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* CARD 1: CUSTOS NO PERÍODO */}
          <button
            type="button"
            onClick={handleCardClickCustosPeriodo}
            className={`p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-royal-blue/50 ${
              activeKpiNav === "todos"
                ? "border-royal-blue/70 dark:border-royal-blue/80 ring-1 ring-royal-blue/30"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Custos no Período
              </span>
              <Coins className="h-4 w-4 text-royal-blue dark:text-royal-blue-light" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatCurrency(kpis.totalValor)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{kpis.totalCount} lançamentos registrados</span>
            </div>
          </button>

          {/* CARD 2: REQUER AÇÃO */}
          <button
            type="button"
            onClick={handleCardClickRequerAcao}
            className={`p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 ${
              activeKpiNav === "requer_acao"
                ? "border-amber-500 dark:border-amber-500/90 ring-1 ring-amber-500/30"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Requer Ação
              </span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatCurrency(kpis.requerAcaoValor)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
              <span>{kpis.requerAcaoCount} pendências</span>
              {kpis.reprovadosCount > 0 && (
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
                  {kpis.reprovadosCount} reprovada(s)
                </span>
              )}
            </div>
          </button>

          {/* CARD 3: A PAGAR / FINANCEIRO (EXCLUI PAGO_EMPRESA) */}
          <button
            type="button"
            onClick={handleCardClickAPagar}
            className={`p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${
              activeKpiNav === "a_pagar"
                ? "border-indigo-500 dark:border-indigo-500/90 ring-1 ring-indigo-500/30"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                A Pagar / Financeiro
              </span>
              <Receipt className="h-4 w-4 text-indigo-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatCurrency(kpis.aPagarValor)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{kpis.aPagarCount} obrigações abertas</span>
            </div>
          </button>

          {/* CARD 4: PAGOS / LIQUIDADOS */}
          <button
            type="button"
            onClick={handleCardClickPagos}
            className={`p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
              activeKpiNav === "pagos"
                ? "border-emerald-500 dark:border-emerald-500/90 ring-1 ring-emerald-500/30"
                : "border-border"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Pagos / Liquidados
              </span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold font-mono text-foreground tracking-tight">
              {formatCurrency(kpis.pagosValor)}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <span>{kpis.pagosCount} despesas liquidadas</span>
            </div>
          </button>
        </div>

        {/* BARRA DE TRABALHO E FILTROS */}
        <div className="rounded-xl border border-border bg-card p-3.5 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Busca por Texto */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar código, descrição, fornecedor, colaborador..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 pl-8 text-xs bg-background border-border"
              />
            </div>

            {/* 2. Filtro Temporal Híbrido (data da despesa) */}
            <UxLabFiltroTemporal
              value={filtroTemporal}
              onChange={setFiltroTemporal}
              className="w-auto"
            />

            {/* 3. Filtro de Categoria de Custo */}
            <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <SelectTrigger className="h-9 w-[170px] text-xs bg-background border-border">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_CATEGORIAS_CUSTOS.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className="text-xs">
                    {cat.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 4. Filtro de Origem do Recurso */}
            <Select value={origemRecursoFiltro} onValueChange={setOrigemRecursoFiltro}>
              <SelectTrigger className="h-9 w-[190px] text-xs bg-background border-border">
                <SelectValue placeholder="Origem do Recurso" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_ORIGEM_RECURSO_OPTIONS.map((orig) => (
                  <SelectItem key={orig.id} value={orig.id} className="text-xs">
                    {orig.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 5. Filtro de Pipeline Status */}
            <Select value={pipelineStatusFiltro} onValueChange={setPipelineStatusFiltro}>
              <SelectTrigger className="h-9 w-[180px] text-xs bg-background border-border">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_PIPELINE_STATUS_OPTIONS.map((st) => (
                  <SelectItem key={st.id} value={st.id} className="text-xs">
                    {st.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* 6. Botão de Redefinir Filtros */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="h-9 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* TABELA ESPECIALISTA DE ALTA DENSIDADE */}
        <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
          <div ref={tableContainerRef} className="overflow-x-auto max-h-[640px]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-muted border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground sticky top-0 z-20 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className="py-3 px-3.5">Código</th>
                  <th className="py-3 px-3.5">Data</th>
                  <th className="py-3 px-3.5">Empresa / Unidade</th>
                  <th className="py-3 px-3.5">Categoria</th>
                  <th className="py-3 px-3.5">Descrição / Favorecido</th>
                  <th className="py-3 px-3.5">Origem do Recurso</th>
                  <th className="py-3 px-3.5 text-right">Valor Total</th>
                  <th className="py-3 px-3.5 text-center">Pipeline</th>
                  <th className="py-3 px-3.5 text-center">Pagamento</th>
                  <th className="py-3 px-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {custosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wallet className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-medium text-sm">Nenhum custo extra encontrado.</p>
                        <p className="text-xs">Tente ajustar a busca ou os filtros aplicados.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  custosFiltrados.map((c) => {
                    const isHighlighted = highlightedId === c.id;

                    return (
                      <tr
                        key={c.id}
                        id={`row-custo-${c.id}`}
                        onClick={() => handleOpenDrawer(c)}
                        className={`group cursor-pointer scroll-mt-12 transition-colors duration-150 hover:bg-muted/50 ${
                          isHighlighted ? getHighlightClasses(c) : ""
                        }`}
                      >
                        {/* 1. Código */}
                        <td className="py-3 px-3.5 font-mono font-bold text-royal-blue dark:text-royal-blue-light whitespace-nowrap">
                          {c.codigo}
                        </td>

                        {/* 2. Data */}
                        <td className="py-3 px-3.5 whitespace-nowrap text-foreground">
                          {formatDate(c.data)}
                        </td>

                        {/* 3. Empresa / Unidade */}
                        <td className="py-3 px-3.5 max-w-[200px]">
                          <div className="font-semibold text-foreground truncate">
                            {c.empresa_nome}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {c.unidade_nome}
                          </div>
                        </td>

                        {/* 4. Categoria (Monocromático Institucional) */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="bg-muted/60 text-foreground border-border text-[10px] font-medium"
                          >
                            {getFriendlyCategoria(c.categoria_custo)}
                          </Badge>
                        </td>

                        {/* 5. Descrição / Favorecido */}
                        <td className="py-3 px-3.5 max-w-[280px]">
                          <div className="font-medium text-foreground truncate" title={c.descricao}>
                            {c.descricao}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                            {c.origem_recurso === "REEMBOLSO_COLABORADOR" && (
                              <>
                                <User className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span>{c.favorecido_colaborador_nome || "Colaborador"}</span>
                              </>
                            )}
                            {c.origem_recurso === "PAGAMENTO_PENDENTE" && (
                              <>
                                <Building className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span>{c.favorecido_fornecedor_nome || "Fornecedor"}</span>
                              </>
                            )}
                            {c.origem_recurso === "PAGO_EMPRESA" && (
                              <span className="text-muted-foreground/80">Pago no ato ({c.forma_pagamento_nome})</span>
                            )}
                            {c.origem_recurso === "LEGACY" && (
                              <span className="text-muted-foreground/80">Histórico migrado</span>
                            )}
                          </div>
                        </td>

                        {/* 6. Origem do Recurso */}
                        <td className="py-3 px-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                              c.origem_recurso === "PAGO_EMPRESA"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                                : c.origem_recurso === "REEMBOLSO_COLABORADOR"
                                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                                : c.origem_recurso === "PAGAMENTO_PENDENTE"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40"
                                : "bg-muted text-muted-foreground border-border"
                            }`}
                          >
                            {getFriendlyOrigemRecurso(c.origem_recurso)}
                          </span>
                        </td>

                        {/* 7. Valor Total */}
                        <td className="py-3 px-3.5 text-right font-mono font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(c.total)}
                        </td>

                        {/* 8. Pipeline Status */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {c.pipeline_status === "RECEBIDO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                              Recebido
                            </span>
                          )}
                          {c.pipeline_status === "EM_VALIDACAO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
                              <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              Em Validação
                            </span>
                          )}
                          {c.pipeline_status === "REPROVADO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              Reprovado
                            </span>
                          )}
                          {c.pipeline_status === "APROVADO_OPERACAO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              Aprovado Op.
                            </span>
                          )}
                          {c.pipeline_status === "ENVIADO_FINANCEIRO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40">
                              <Receipt className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                              Enviado Fin.
                            </span>
                          )}
                          {c.pipeline_status === "FINALIZADO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Finalizado
                            </span>
                          )}
                        </td>

                        {/* 9. Status Pagamento (Desacoplado) */}
                        <td className="py-3 px-3.5 text-center whitespace-nowrap">
                          {c.status_pagamento === "PAGO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Pago
                            </span>
                          )}
                          {c.status_pagamento === "A_PAGAR" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40">
                              A Pagar
                            </span>
                          )}
                          {c.status_pagamento === "ATRASADO" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Atrasado
                            </span>
                          )}
                          {c.status_pagamento === "CANCELADO" && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700">
                              Cancelado
                            </span>
                          )}
                        </td>

                        {/* 10. Ação */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDrawer(c);
                            }}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Abrir detalhes da despesa"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* RODAPÉ DA TABELA (SEM TERMOS TÉCNICOS DE INFRA) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Valores aprovados ficam protegidos contra alteração.</span>
            </div>
            <div>
              Exibindo <strong className="text-foreground">{custosFiltrados.length}</strong> de{" "}
              <strong>{CUSTOS_EXTRAS_MOCKS.length}</strong> despesas registradas
            </div>
          </div>
        </div>
      </div>

      {/* DRAWER LATERAL DE CONTINUIDADE */}
      <UxLabCustoExtraDrawer
        custo={selectedCusto}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </UxLabShell>
  );
}
