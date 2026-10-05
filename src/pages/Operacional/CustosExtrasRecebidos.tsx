import React, { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  History,
  Loader2
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import { UxPipelineStepper } from "@/components/ux-lab/UxPipelineStepper";
import {
  EmpresaService,
  CustoExtraOperacionalService,
} from "@/services/base.service";
import { useTenant } from "@/contexts/TenantContext";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { CustosExtrasForm } from "@/components/forms/CustosExtrasForm";
import {
  CustosExtrasDetalhesDrawer,
  CustoExtraItemReal,
  CUSTOS_EXTRAS_PIPELINE_STEPS,
  getFriendlyOrigemRecurso,
  getFriendlyPipelineStatus,
  getFriendlyStatusPagamento,
  getFriendlyCategoria,
} from "@/components/operacoes/CustosExtrasDetalhesDrawer";
import { cn } from "@/lib/utils";

// ─── Constants & Options ────────────────────────────────────────────────────────

export const CATEGORIAS_CUSTO_OPTIONS = [
  { id: "todos", nome: "Todas as Categorias" },
  { id: "MERENDA/LANCHE", nome: "Merenda / Lanche" },
  { id: "OPERACIONAL", nome: "Operacional" },
  { id: "ADMINISTRATIVO", nome: "Administrativo" },
  { id: "MANUTENCAO", nome: "Manutenção" },
  { id: "TRANSPORTE", nome: "Transporte" },
  { id: "COMUNICACAO", nome: "Comunicação" },
  { id: "OUTROS", nome: "Outros Custos" },
];

export const ORIGEM_RECURSO_OPTIONS = [
  { id: "todos", nome: "Todas as Origens" },
  { id: "PAGO_EMPRESA", nome: "Pago pela Empresa" },
  { id: "REEMBOLSO_COLABORADOR", nome: "Reembolso a Colaborador" },
  { id: "PAGAMENTO_PENDENTE", nome: "Pagamento a Fornecedor" },
  { id: "LEGACY", nome: "Registro Legado" },
];

export const PIPELINE_STATUS_OPTIONS = [
  { id: "todos", nome: "Todos os Status de Pipeline" },
  { id: "RECEBIDO", nome: "Recebido" },
  { id: "EM_VALIDACAO", nome: "Em Validação" },
  { id: "APROVADO_OPERACAO", nome: "Aprovado Operação" },
  { id: "ENVIADO_FINANCEIRO", nome: "Enviado ao Financeiro" },
  { id: "FINALIZADO", nome: "Finalizado" },
  { id: "REPROVADO", nome: "Reprovado" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const formatCurrency = (val?: number | null) => currencyFormatter.format(Number.isFinite(val) ? (val as number) : 0);

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  const cleanDate = String(dateStr).split("T")[0];
  const parts = cleanDate.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
};

export default function CustosExtrasRecebidos() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { tenantId, loading: isTenantLoading } = useTenant();
  const { role, isAdmin } = useAccessControl();

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

  // Modais e Drawers
  const [isNovoCustoModalOpen, setIsNovoCustoModalOpen] = useState<boolean>(false);
  const [selectedCusto, setSelectedCusto] = useState<CustoExtraItemReal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Navegação Interativa pelos Cards de Síntese
  const [activeKpiNav, setActiveKpiNav] = useState<"todos" | "requer_acao" | "a_pagar" | "pagos">("todos");
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // URL Action: ?action=novo-custo-extra
  useEffect(() => {
    if (searchParams.get("action") === "novo-custo-extra") {
      setIsNovoCustoModalOpen(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("action");
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [searchParams, navigate]);

  // ─── 1. Queries Oficiais do Supabase (Zero Mock) ──────────────────────────────

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas", tenantId],
    queryFn: () => EmpresaService.getAll(),
    enabled: !isTenantLoading,
  });

  const {
    data: custosRaw = [],
    isLoading: isLoadingCustos,
    isError: isErrorCustos,
    refetch: refetchCustos,
  } = useQuery({
    queryKey: ["custos-extras", empresaFiltro, tenantId],
    queryFn: () =>
      CustoExtraOperacionalService.getAll(
        empresaFiltro === "todas" || empresaFiltro === "all" ? undefined : empresaFiltro,
        tenantId
      ).catch(() => []),
    placeholderData: (previousData) => previousData,
  });

  // ─── 2. Contexto Macro: Empresa + Período Temporal (data canônica) ────────────

  const custosContextuais = useMemo(() => {
    return (custosRaw || []).filter((c: any) => {
      // Ignora soft delete
      if (c.deleted_at) return false;

      // 1. Filtro de Empresa
      if (empresaFiltro !== "todas" && empresaFiltro !== "all" && c.empresa_id !== empresaFiltro) {
        return false;
      }

      // 2. Filtro Temporal Híbrido baseado estritamente na data do fato gerador do custo
      const dataCusto = String(c.data || "").split("T")[0];
      if (!dataCusto) return false;

      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje") {
          const today = format(new Date(), "yyyy-MM-dd");
          if (dataCusto !== today) return false;
        } else if (filtroTemporal.preset === "mes-atual" || filtroTemporal.preset === "outubro") {
          const currentMonth = format(new Date(), "yyyy-MM");
          if (!dataCusto.startsWith(currentMonth)) return false;
        } else if (filtroTemporal.preset === "mes-anterior" || filtroTemporal.preset === "setembro") {
          const prevMonthDate = new Date();
          prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
          const prevMonth = format(prevMonthDate, "yyyy-MM");
          if (!dataCusto.startsWith(prevMonth)) return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const targetDate = format(filtroTemporal.data, "yyyy-MM-dd");
        if (dataCusto !== targetDate) return false;
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const fromStr = format(filtroTemporal.range.from, "yyyy-MM-dd");
        const toStr = filtroTemporal.range.to
          ? format(filtroTemporal.range.to, "yyyy-MM-dd")
          : fromStr;
        if (dataCusto < fromStr || dataCusto > toStr) return false;
      }

      return true;
    });
  }, [custosRaw, empresaFiltro, filtroTemporal]);

  // ─── 3. Síntese Operacional (4 Indicadores Canônicos) ─────────────────────────

  const kpis = useMemo(() => {
    // 1. Total no Período
    const totalCount = custosContextuais.length;
    const totalValor = custosContextuais.reduce((acc, curr: any) => acc + Number(curr.total || 0), 0);

    // 2. Requer Ação: REPROVADO | EM_VALIDACAO | RECEBIDO
    const itensRequerAcao = custosContextuais.filter((c: any) =>
      ["REPROVADO", "EM_VALIDACAO", "RECEBIDO"].includes(String(c.pipeline_status || "RECEBIDO").toUpperCase())
    );
    const requerAcaoCount = itensRequerAcao.length;
    const requerAcaoValor = itensRequerAcao.reduce((acc, curr: any) => acc + Number(curr.total || 0), 0);
    const reprovadosCount = custosContextuais.filter(
      (c: any) => String(c.pipeline_status || "").toUpperCase() === "REPROVADO"
    ).length;

    // 3. A Pagar / Financeiro:
    // Obrigação financeira real aberta (APROVADO_OPERACAO ou ENVIADO_FINANCEIRO com status_pagamento = A_PAGAR ou ATRASADO)
    // EXCLUI TERMINANTEMENTE PAGO_EMPRESA
    const itensAPagar = custosContextuais.filter((c: any) => {
      const orig = String(c.origem_recurso || "").toUpperCase();
      const stPag = String(c.status_pagamento || "A_PAGAR").toUpperCase();
      const stPip = String(c.pipeline_status || "RECEBIDO").toUpperCase();

      return (
        orig !== "PAGO_EMPRESA" &&
        ["A_PAGAR", "ATRASADO"].includes(stPag) &&
        ["APROVADO_OPERACAO", "ENVIADO_FINANCEIRO"].includes(stPip)
      );
    });
    const aPagarCount = itensAPagar.length;
    const aPagarValor = itensAPagar.reduce((acc, curr: any) => acc + Number(curr.total || 0), 0);

    // 4. Pagos / Liquidados:
    // Desembolso já ocorrido: PAGO_EMPRESA OU obrigação liquidada com status_pagamento = PAGO
    const itensPagos = custosContextuais.filter((c: any) => {
      const orig = String(c.origem_recurso || "").toUpperCase();
      const stPag = String(c.status_pagamento || "").toUpperCase();
      const stPip = String(c.pipeline_status || "").toUpperCase();

      return (
        stPag === "PAGO" ||
        (orig === "PAGO_EMPRESA" && stPip === "FINALIZADO") ||
        orig === "PAGO_EMPRESA"
      );
    });
    const pagosCount = itensPagos.length;
    const pagosValor = itensPagos.reduce((acc, curr: any) => acc + Number(curr.total || 0), 0);

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
  }, [custosContextuais]);

  // ─── 4. Filtros Exploratórios da Tabela ────────────────────────────────────────

  const custosFiltrados = useMemo(() => {
    return custosContextuais.filter((c: any) => {
      const stPip = String(c.pipeline_status || "RECEBIDO").toUpperCase();
      const stPag = String(c.status_pagamento || (c.origem_recurso === "PAGO_EMPRESA" ? "PAGO" : "A_PAGAR")).toUpperCase();
      const orig = String(c.origem_recurso || "PAGO_EMPRESA").toUpperCase();

      // 1. Filtro por Active KPI Nav
      if (activeKpiNav === "requer_acao") {
        if (!["REPROVADO", "EM_VALIDACAO", "RECEBIDO"].includes(stPip)) return false;
      } else if (activeKpiNav === "a_pagar") {
        if (
          orig === "PAGO_EMPRESA" ||
          !["A_PAGAR", "ATRASADO"].includes(stPag) ||
          !["APROVADO_OPERACAO", "ENVIADO_FINANCEIRO"].includes(stPip)
        ) {
          return false;
        }
      } else if (activeKpiNav === "pagos") {
        if (stPag !== "PAGO" && !(orig === "PAGO_EMPRESA" && stPip === "FINALIZADO") && orig !== "PAGO_EMPRESA") {
          return false;
        }
      }

      // 2. Filtro de Categoria de Custo
      if (categoriaFiltro !== "todos") {
        const catNorm = String(c.categoria_custo || "").toUpperCase();
        if (categoriaFiltro === "MERENDA/LANCHE") {
          if (!["MERENDA", "LANCHE", "MERENDA/LANCHE"].includes(catNorm)) return false;
        } else if (catNorm !== categoriaFiltro) {
          return false;
        }
      }

      // 3. Filtro de Origem do Recurso
      if (origemRecursoFiltro !== "todos") {
        if (orig !== origemRecursoFiltro) return false;
      }

      // 4. Filtro de Pipeline Status
      if (pipelineStatusFiltro !== "todos") {
        if (stPip !== pipelineStatusFiltro) return false;
      }

      // 5. Busca textual por código, descrição, favorecido, empresa, categoria e responsável
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const codigoFormatado = c.id ? `ce-${c.id.substring(0, 8)}` : "";
        const matchCodigo = codigoFormatado.includes(query) || String(c.id || "").toLowerCase().includes(query);
        const matchDesc = String(c.descricao || "").toLowerCase().includes(query);
        const matchEmpresa = String(c.empresas?.nome || c.empresa_nome || "").toLowerCase().includes(query);
        const matchCategoria = getFriendlyCategoria(c.categoria_custo).toLowerCase().includes(query);
        const matchColab = String(c.favorecido_colaborador?.nome || "").toLowerCase().includes(query);
        const matchForn = String(c.favorecido_fornecedor?.nome || "").toLowerCase().includes(query);
        const matchResponsavel = String(c.responsavel_nome || "").toLowerCase().includes(query);

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
  }, [custosContextuais, activeKpiNav, categoriaFiltro, origemRecursoFiltro, pipelineStatusFiltro, busca]);

  // Handlers dos Cards de Síntese
  const handleCardClick = (kpi: "todos" | "requer_acao" | "a_pagar" | "pagos") => {
    setActiveKpiNav((prev) => (prev === kpi ? "todos" : kpi));
    if (tableContainerRef.current) {
      if (typeof tableContainerRef.current.scrollTo === "function") {
        tableContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        tableContainerRef.current.scrollTop = 0;
      }
    }
  };

  const hasActiveFilters =
    empresaFiltro !== "todas" ||
    categoriaFiltro !== "todos" ||
    origemRecursoFiltro !== "todos" ||
    pipelineStatusFiltro !== "todos" ||
    filtroTemporal.preset !== "todos" ||
    activeKpiNav !== "todos" ||
    busca.trim() !== "";

  const handleResetFilters = () => {
    setEmpresaFiltro("todas");
    setCategoriaFiltro("todos");
    setOrigemRecursoFiltro("todos");
    setPipelineStatusFiltro("todos");
    setFiltroTemporal({ type: "preset", preset: "todos" });
    setActiveKpiNav("todos");
    setBusca("");
    toast.success("Filtros redefinidos para o padrão.");
  };

  const handleOpenDrawer = (custo: CustoExtraItemReal) => {
    setSelectedCusto(custo);
    setDrawerOpen(true);
  };

  const handleOpenNovoCusto = () => {
    setIsNovoCustoModalOpen(true);
  };

  return (
    <AppShell
      title="Custos Extras"
      subtitle="Acompanhe despesas extraordinárias, validações e obrigações financeiras."
      badge="OPERAÇÕES DE CAMPO"
    >
      <div className="space-y-6 pb-16">
        {/* CABEÇALHO OPERACIONAL */}
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
                    OFICIAL
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
              <SelectContent align="end">
                <SelectItem value="todas" className="text-xs">
                  Todas as Empresas
                </SelectItem>
                {(empresas as any[]).map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              size="sm"
              className="h-9 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-1.5"
              onClick={handleOpenNovoCusto}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Novo Custo Extra</span>
            </Button>
          </div>
        </div>

        {/* 4 CARDS DE SÍNTESE OPERACIONAL (VALOR EM R$ + CONTAGEM) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* CARD 1: CUSTOS NO PERÍODO */}
          <button
            type="button"
            onClick={() => handleCardClick("todos")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-royal-blue/50",
              activeKpiNav === "todos"
                ? "border-royal-blue/70 dark:border-royal-blue/80 ring-1 ring-royal-blue/30"
                : "border-border"
            )}
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
            onClick={() => handleCardClick("requer_acao")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50",
              activeKpiNav === "requer_acao"
                ? "border-amber-500 dark:border-amber-500/90 ring-1 ring-amber-500/30"
                : "border-border"
            )}
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
            onClick={() => handleCardClick("a_pagar")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/50",
              activeKpiNav === "a_pagar"
                ? "border-indigo-500 dark:border-indigo-500/90 ring-1 ring-indigo-500/30"
                : "border-border"
            )}
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
            onClick={() => handleCardClick("pagos")}
            className={cn(
              "p-4 rounded-xl border text-left transition-all duration-150 bg-card hover:bg-muted/40 shadow-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/50",
              activeKpiNav === "pagos"
                ? "border-emerald-500 dark:border-emerald-500/90 ring-1 ring-emerald-500/30"
                : "border-border"
            )}
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

            {/* 2. Filtro Temporal Híbrido (data do fato gerador) */}
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
                {CATEGORIAS_CUSTO_OPTIONS.map((cat) => (
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
                {ORIGEM_RECURSO_OPTIONS.map((orig) => (
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
                {PIPELINE_STATUS_OPTIONS.map((st) => (
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
                Limpar Filtros
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
                  <th className="py-2.5 px-3 w-[95px] whitespace-nowrap">Código</th>
                  <th className="py-2.5 px-3 w-[85px] whitespace-nowrap">Data</th>
                  <th className="py-2.5 px-3 w-[150px] max-w-[150px]">Empresa / Unidade</th>
                  <th className="py-2.5 px-3 w-[110px] whitespace-nowrap">Categoria</th>
                  <th className="py-2.5 px-3 min-w-[160px] max-w-[240px]">Descrição / Favorecido</th>
                  <th className="py-2.5 px-3 w-[135px] whitespace-nowrap">Origem do Recurso</th>
                  <th className="py-2.5 px-3 w-[100px] text-left whitespace-nowrap">Valor Total</th>
                  <th className="py-2.5 px-2.5 w-[115px] text-left whitespace-nowrap">Pipeline</th>
                  <th className="py-2.5 px-2.5 w-[95px] text-left whitespace-nowrap">Pagamento</th>
                  <th className="py-2.5 px-2 w-[40px] text-center whitespace-nowrap">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoadingCustos ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Loader2 className="h-7 w-7 animate-spin text-royal-blue" />
                        <p className="font-medium text-xs">Carregando custos extras...</p>
                      </div>
                    </td>
                  </tr>
                ) : isErrorCustos ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-rose-600 bg-rose-50/20">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertTriangle className="h-7 w-7 text-rose-500" />
                        <p className="font-semibold text-sm">Falha ao carregar custos extras</p>
                        <p className="text-xs text-muted-foreground">Tente recarregar os dados.</p>
                        <Button variant="outline" size="sm" onClick={() => refetchCustos()} className="mt-2 text-xs">
                          Tentar novamente
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : custosContextuais.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Wallet className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-semibold text-sm text-foreground">
                          Nenhum custo extra registrado para o período e empresa selecionados.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Utilize o botão acima para registrar um novo lançamento.
                        </p>
                        <Button
                          size="sm"
                          onClick={handleOpenNovoCusto}
                          className="mt-2 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Novo Custo Extra
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : custosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground/40" />
                        <p className="font-semibold text-sm text-foreground">
                          Nenhum custo encontrado com os filtros selecionados.
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Tente ajustar a busca ou limpar os filtros aplicados.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleResetFilters}
                          className="mt-2 text-xs"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" />
                          Limpar Filtros
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  custosFiltrados.map((c: any) => {
                    const displayCode = c.id ? `CE-${c.id.substring(0, 8).toUpperCase()}` : "CE-000";
                    const empresaNome = c.empresas?.nome || c.empresa_nome || "Empresa";
                    const unidadeNome = c.unidades?.nome || c.unidade_nome || "Unidade";
                    const orig = String(c.origem_recurso || "PAGO_EMPRESA").toUpperCase();
                    const stPip = String(c.pipeline_status || "RECEBIDO").toUpperCase();
                    const stPag = String(c.status_pagamento || (orig === "PAGO_EMPRESA" ? "PAGO" : "A_PAGAR")).toUpperCase();
                    const formaNome = c.forma_pagamento_ref?.nome || c.forma_pagamento || "Padrão";

                    return (
                      <tr
                        key={c.id}
                        id={`row-custo-${c.id}`}
                        onClick={() => handleOpenDrawer(c)}
                        className="group cursor-pointer scroll-mt-12 transition-colors duration-150 hover:bg-muted/50"
                      >
                        {/* 1. Código */}
                        <td className="py-2.5 px-3 w-[95px] font-mono font-bold text-royal-blue dark:text-royal-blue-light whitespace-nowrap">
                          {displayCode}
                        </td>

                        {/* 2. Data */}
                        <td className="py-2.5 px-3 w-[85px] whitespace-nowrap text-foreground">
                          {formatDate(c.data)}
                        </td>

                        {/* 3. Empresa / Unidade */}
                        <td className="py-2.5 px-3 w-[150px] max-w-[150px]">
                          <div className="font-semibold text-foreground truncate" title={empresaNome}>
                            {empresaNome}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate" title={unidadeNome}>
                            {unidadeNome}
                          </div>
                        </td>

                        {/* 4. Categoria */}
                        <td className="py-2.5 px-3 w-[110px] whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="bg-muted/60 text-foreground border-border text-[10px] font-medium"
                          >
                            {getFriendlyCategoria(c.categoria_custo)}
                          </Badge>
                        </td>

                        {/* 5. Descrição / Favorecido */}
                        <td className="py-2.5 px-3 min-w-[160px] max-w-[240px]">
                          <div
                            className="font-medium text-foreground truncate whitespace-nowrap overflow-hidden text-ellipsis"
                            title={c.descricao}
                          >
                            {c.descricao}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate whitespace-nowrap overflow-hidden text-ellipsis flex items-center gap-1 mt-0.5 min-w-0">
                            {orig === "REEMBOLSO_COLABORADOR" && (
                              <>
                                <User className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                <span className="truncate" title={c.favorecido_colaborador?.nome || "Colaborador"}>
                                  {c.favorecido_colaborador?.nome || "Colaborador"}
                                </span>
                              </>
                            )}
                            {orig === "PAGAMENTO_PENDENTE" && (
                              <>
                                <Building className="w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" />
                                <span className="truncate" title={c.favorecido_fornecedor?.nome || "Fornecedor"}>
                                  {c.favorecido_fornecedor?.nome || "Fornecedor"}
                                </span>
                              </>
                            )}
                            {orig === "PAGO_EMPRESA" && (
                              <span className="truncate" title={`Pago no ato (${formaNome})`}>
                                Pago no ato ({formaNome})
                              </span>
                            )}
                            {orig !== "PAGO_EMPRESA" && c.data_vencimento && (
                              <span className="ml-1 shrink-0 text-[10px] text-muted-foreground">
                                · Venc: {formatDate(c.data_vencimento)}
                              </span>
                            )}
                            {orig === "LEGACY" && (
                              <span className="truncate" title="Histórico migrado">
                                Histórico migrado
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 6. Origem do Recurso */}
                        <td className="py-2.5 px-3 w-[135px] whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border",
                              orig === "PAGO_EMPRESA"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40"
                                : orig === "REEMBOLSO_COLABORADOR"
                                ? "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40"
                                : orig === "PAGAMENTO_PENDENTE"
                                ? "bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-900/40"
                                : "bg-muted text-muted-foreground border-border"
                            )}
                          >
                            {getFriendlyOrigemRecurso(orig)}
                          </span>
                        </td>

                        {/* 7. Valor Total */}
                        <td className="py-2.5 px-3 w-[100px] text-left font-mono font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(c.total)}
                        </td>

                        {/* 8. Pipeline Status (Stepper Compacto) */}
                        <td className="py-2.5 px-2.5 w-[115px] text-left whitespace-nowrap">
                          <UxPipelineStepper
                            steps={CUSTOS_EXTRAS_PIPELINE_STEPS as any}
                            currentStepKey={stPip}
                            exceptionState={
                              stPip === "REPROVADO"
                                ? {
                                    isException: true,
                                    label: "Reprovado",
                                    stepKey: "EM_VALIDACAO",
                                    description: c.justificativa_devolucao || undefined,
                                  }
                                : null
                            }
                            variant="compact"
                          />
                        </td>

                        {/* 9. Status Pagamento (Desacoplado da Esteira) */}
                        <td className="py-2.5 px-2.5 w-[95px] text-left whitespace-nowrap">
                          {orig === "PAGO_EMPRESA" || stPag === "PAGO" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Pago
                            </span>
                          ) : stPag === "A_PAGAR" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/40">
                              A Pagar
                            </span>
                          ) : stPag === "ATRASADO" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              Atrasado
                            </span>
                          ) : stPag === "CANCELADO" ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800/60 dark:text-zinc-400 dark:border-zinc-700">
                              Cancelado
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                              {stPag}
                            </span>
                          )}
                        </td>

                        {/* 10. Ação */}
                        <td className="py-2.5 px-2 w-[40px] text-center whitespace-nowrap">
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

          {/* RODAPÉ DA TABELA */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Valores aprovados ficam protegidos contra alteração.</span>
            </div>
            <div>
              Exibindo <strong className="text-foreground">{custosFiltrados.length}</strong> de{" "}
              <strong>{custosContextuais.length}</strong> despesas no contexto
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DE CRIAÇÃO ADMIN (Reutiliza CustosExtrasForm) */}
      <Dialog open={isNovoCustoModalOpen} onOpenChange={setIsNovoCustoModalOpen}>
        <DialogContent className="sm:max-w-[540px] overflow-y-auto max-h-[90vh]">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 font-display">
              <Plus className="h-5 w-5 text-primary" />
              Novo Custo Extra
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre despesas operacionais extraordinárias que serão submetidas à validação.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <CustosExtrasForm
              onSuccess={() => {
                setIsNovoCustoModalOpen(false);
                queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
              }}
              empresaPadraoId={empresaFiltro !== "todas" && empresaFiltro !== "all" ? empresaFiltro : undefined}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* DRAWER LATERAL DE DETALHES & DIAGNÓSTICO */}
      <CustosExtrasDetalhesDrawer
        custo={selectedCusto}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onReabrirForm={() => setIsNovoCustoModalOpen(true)}
      />
    </AppShell>
  );
}
