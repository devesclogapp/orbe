import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Building2, Calendar, FileText, Search, Filter, RefreshCw, AlertTriangle,
    Wallet, TrendingUp, DollarSign, ArrowRight, Layers, Receipt, Zap, CheckCircle2,
    Clock, Package, AlertCircle, CreditCard, FileSpreadsheet, Lock, Plus,
    LayoutList, LayoutGrid, Info, List, Kanban, ShieldCheck, ChevronRight
} from "lucide-react";

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
import { EmpresaService } from "@/services/domain/cadastros.service";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
    ReceitaItemUI,
    EstagioFinanceiroUX,
    ModalidadeReceitaReal,
    OrigemReceitaReal,
    ReceitasOficialService,
    getEstagioUX,
    getEstagioUXLabel,
    getModalidadeLabel,
    getStatusLabel,
    getSituacaoVencimento,
    calcularKpisReceitas,
    formatCompetencia,
    formatCurrency,
    formatDate,
} from "@/services/receitasOficial.service";
import { ReceitaDrawerOficial } from "./components/ReceitaDrawerOficial";
import { ReceitaKanbanCard } from "./components/ReceitaKanbanCard";

export const VIEW_MODE_STORAGE_KEY = "orbe.financeiro.receitas.viewMode";
export const DENSITY_STORAGE_KEY = "orbe.financeiro.receitas.cardDensity";

const KANBAN_CONFIGS = {
    CAIXA_IMEDIATO: [
        { id: "pendente_recebimento", label: "Em aberto", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
    DUPLICATA: [
        { id: "pendente_cobranca", label: "Cobrança gerada", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
        { id: "cobranca_enviada", label: "Cobrança enviada", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
    FATURAMENTO_MENSAL: [
        { id: "aguardando_fechamento", label: "Em aberto", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
        { id: "pendente_cobranca", label: "Cobrança gerada", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
        { id: "cobranca_enviada", label: "Cobrança enviada", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
};

export default function ReceitasPipeline() {
    const queryClient = useQueryClient();
    const { tenantId, loading: isTenantLoading } = useTenant();
    const location = useLocation();
    const navigate = useNavigate();

    // 1. Contexto Principal (Invariante dos KPIs): Tenant + Empresa + Competência
    const currentMonth = useMemo(() => new Date().toISOString().substring(0, 7), []);
    const [competenciaContexto, setCompetenciaContexto] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const sp = new URLSearchParams(window.location.search);
            const comp = sp.get("competencia");
            if (comp && /^\d{4}-\d{2}$/.test(comp)) return comp;
        }
        return currentMonth;
    });
    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");

    // 2. Filtros Exploratórios (NÃO alteram os KPIs)
    const [estagioFiltro, setEstagioFiltro] = useState<EstagioFinanceiroUX>("TODOS");
    const [modalidadeFiltro, setModalidadeFiltro] = useState<string>("TODAS");
    const [origemFiltro, setOrigemFiltro] = useState<string>("TODAS");
    const [vencimentoFiltro, setVencimentoFiltro] = useState<string>("TODOS");
    const [clienteFiltro, setClienteFiltro] = useState<string>("ALL");
    const [searchTerm, setSearchTerm] = useState("");

    // Contexto de Origem Operacional via Query Param (OPERACAO, SERVICO_EXTRA ou fallback GLOBAL)
    const origemParam = useMemo<'OPERACAO' | 'SERVICO_EXTRA' | null>(() => {
        if (typeof window !== "undefined") {
            const searchParams = new URLSearchParams(location.search);
            const raw = searchParams.get('origem');
            if (raw === 'OPERACAO' || raw === 'SERVICO_EXTRA') {
                return raw as 'OPERACAO' | 'SERVICO_EXTRA';
            }
        }
        return null;
    }, [location.search]);

    // Tab de compatibilidade retroativa para rotas legadas
    const [activeTab, setActiveTab] = useState<"CAIXA_IMEDIATO" | "DUPLICATA" | "FATURAMENTO_MENSAL">(() => {
        if (typeof window !== "undefined") {
            const searchParams = new URLSearchParams(location.search);
            const tabParam = searchParams.get('tab');
            if (tabParam && ["CAIXA_IMEDIATO", "DUPLICATA", "FATURAMENTO_MENSAL"].includes(tabParam)) {
                return tabParam as any;
            }
        }
        return location.state?.activeTab || "CAIXA_IMEDIATO";
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            const searchParams = new URLSearchParams(location.search);
            const tabParam = searchParams.get('tab');
            if (tabParam && ["CAIXA_IMEDIATO", "DUPLICATA", "FATURAMENTO_MENSAL"].includes(tabParam)) {
                setActiveTab(tabParam as any);
            }
        }
    }, [location.search]);

    // Drawer Oficial Integrado
    const [selectedReceita, setSelectedReceita] = useState<ReceitaItemUI | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    // Alternador de Visualização: Lista (Padrão Oficial UX11) vs Kanban
    const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
            if (saved === "list" || saved === "kanban") {
                return saved;
            }
        }
        return "list";
    });

    const handleViewModeChange = (mode: "list" | "kanban") => {
        setViewMode(mode);
        if (typeof window !== "undefined") {
            localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
        }
    };

    // Densidade do Kanban
    const [density, setDensity] = useState<"compact" | "detailed">(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
            if (saved === "compact" || saved === "detailed") {
                return saved;
            }
        }
        return "detailed";
    });

    const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

    const handleDensityChange = (newDensity: "compact" | "detailed") => {
        setDensity(newDensity);
        setExpandedCardIds(new Set());
        if (typeof window !== "undefined") {
            localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
        }
    };

    const toggleCardExpansion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedCardIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    // Busca de Empresas do Tenant
    const { data: empresas = [], isLoading: isEmpresasLoading } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    // Busca de Receitas Reais da Competência / Empresa
    const {
        data: receitasContextuais = [],
        isLoading: isReceitasLoading,
        isRefetching,
        error: errorReceitas,
        refetch,
    } = useQuery<ReceitaItemUI[]>({
        queryKey: ["receitas-pipeline", tenantId, filterEmpresaId, competenciaContexto],
        queryFn: () =>
            ReceitasOficialService.getReceitasContextuais(
                tenantId!,
                filterEmpresaId === "all" ? undefined : filterEmpresaId,
                competenciaContexto === "all" ? undefined : competenciaContexto
            ),
        enabled: Boolean(tenantId),
        placeholderData: (previousData) => previousData,
    });

    const isGlobalLoading = isEmpresasLoading || isTenantLoading || isReceitasLoading;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["receita-detalhes"] });
        queryClient.invalidateQueries({ queryKey: ["receita-detalhes-historico"] });
        toast.success("Dados do funil financeiro atualizados com sucesso!");
    };

    // Sincronização de query params e highlight recebido de outras rotas
    const handledHighlightRef = useRef<string | null>(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tabParam = searchParams.get('tab');
        if (tabParam && ["CAIXA_IMEDIATO", "DUPLICATA", "FATURAMENTO_MENSAL"].includes(tabParam)) {
            setActiveTab(tabParam as any);
            setModalidadeFiltro(tabParam);
        } else if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab as any);
            setModalidadeFiltro(location.state.activeTab);
        }

        const highlightRecId = location.state?.highlightReceitaId;
        const highlightSeId = location.state?.highlightServicoExtraId;
        const targetId = highlightRecId || highlightSeId;

        if (targetId && handledHighlightRef.current !== targetId && receitasContextuais.length > 0) {
            const found = receitasContextuais.find((r) => {
                if (highlightRecId && r.id === highlightRecId) return true;
                if (highlightSeId) {
                    return (r.itens || []).some((it) => it.servico_extra_id === highlightSeId);
                }
                return false;
            });
            if (found) {
                handledHighlightRef.current = targetId;
                if (found.modalidade && found.modalidade !== activeTab) {
                    setActiveTab(found.modalidade);
                }
                setSelectedReceita(found);
                setDrawerOpen(true);
            }
        }
    }, [location.state, location.search, receitasContextuais, activeTab]);

    // 3. KPIs Canônicos: calculados ESTRITAMENTE sobre receitasContextuais (INVARIANTE a filtros exploratórios)
    const kpis = useMemo(() => {
        return calcularKpisReceitas(receitasContextuais);
    }, [receitasContextuais]);

    // Contagens para os Pills de Estágio
    const contagensEstagio = useMemo(() => {
        const ativas = receitasContextuais.filter((r) => r.status !== "cancelado");
        return {
            TODOS: ativas.length,
            A_FATURAR_FECHAR: ativas.filter((r) => getEstagioUX(r.status) === "A_FATURAR_FECHAR").length,
            COBRANCA_PENDENTE: ativas.filter((r) => getEstagioUX(r.status) === "COBRANCA_PENDENTE").length,
            A_RECEBER: ativas.filter((r) => getEstagioUX(r.status) === "A_RECEBER").length,
            RECEBIDAS: ativas.filter((r) => getEstagioUX(r.status) === "RECEBIDAS").length,
        };
    }, [receitasContextuais]);

    // Clientes únicos para filtro da FilterBar
    const clientesDisponiveis = useMemo(() => {
        const map = new Map<string, string>();
        receitasContextuais.forEach((r) => {
            if (r.clienteId && r.clienteNome) {
                map.set(r.clienteId, r.clienteNome);
            }
        });
        return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
    }, [receitasContextuais]);

    // 4. Filtragem da Tabela por Filtros Exploratórios
    const filteredReceitas = useMemo(() => {
        return receitasContextuais.filter((r) => {
            // Filtro por Estágio
            if (estagioFiltro !== "TODOS") {
                if (getEstagioUX(r.status) !== estagioFiltro) return false;
            }

            // Filtro por Modalidade
            if (modalidadeFiltro !== "TODAS") {
                if (r.modalidade !== modalidadeFiltro) return false;
            }

            // Filtro por Origem
            if (origemFiltro !== "TODAS") {
                if (r.origemPrincipal !== origemFiltro) return false;
            }

            // Filtro Contextual de Origem (query param origem=OPERACAO ou SERVICO_EXTRA)
            if (origemParam === 'OPERACAO') {
                const temOp = (r.itens || []).some((it) => it.operacao_id != null);
                if (!temOp) return false;
            }
            if (origemParam === 'SERVICO_EXTRA') {
                const temSe = (r.itens || []).some((it) => it.servico_extra_id != null);
                if (!temSe) return false;
            }

            // Filtro por Cliente
            if (clienteFiltro !== "ALL") {
                if (r.clienteId !== clienteFiltro) return false;
            }

            // Filtro por Vencimento
            if (vencimentoFiltro !== "TODOS") {
                const sit = getSituacaoVencimento(r);
                if (vencimentoFiltro === "VENCIDOS" && !sit.isVencido) return false;
                if (vencimentoFiltro === "A_VENCER" && sit.isVencido) return false;
            }

            // Busca Textual
            if (searchTerm.trim()) {
                const termo = searchTerm.toLowerCase();
                const matchNome = (r.clienteNome || "").toLowerCase().includes(termo);
                const matchId = (r.id || "").toLowerCase().includes(termo);
                const matchObs = (r.observacao || "").toLowerCase().includes(termo);
                const matchItens = (r.itens || []).some(
                    (it) => it.refOrigem.toLowerCase().includes(termo) || it.descricao.toLowerCase().includes(termo)
                );
                if (!matchNome && !matchId && !matchObs && !matchItens) return false;
            }

            return true;
        });
    }, [
        receitasContextuais,
        estagioFiltro,
        modalidadeFiltro,
        origemFiltro,
        origemParam,
        clienteFiltro,
        vencimentoFiltro,
        searchTerm,
    ]);

    // Agrupamento para modo Kanban (quando ativado)
    const currentKanbanStages = KANBAN_CONFIGS[activeTab] || KANBAN_CONFIGS["CAIXA_IMEDIATO"];
    const kanbanColumns = useMemo(() => {
        const cols: Record<string, ReceitaItemUI[]> = {};
        currentKanbanStages.forEach((col) => (cols[col.id] = []));

        filteredReceitas.forEach((r) => {
            let st = r.status || currentKanbanStages[0].id;
            if (st === "pago" || st === "conciliado") st = "recebido";
            if (st === "cobranca_gerada") st = "pendente_cobranca";

            if (cols[st]) {
                cols[st].push(r);
            } else if (cols[currentKanbanStages[0].id]) {
                cols[currentKanbanStages[0].id].push(r);
            }
        });
        return cols;
    }, [filteredReceitas, currentKanbanStages]);

    const cardsByCols = (stageId: string) => kanbanColumns[stageId] || [];

    const handleOpenDrawer = (rec: ReceitaItemUI) => {
        setSelectedReceita(rec);
        setDrawerOpen(true);
    };

    const pageSubtitle = origemParam === 'OPERACAO'
        ? "Visão contextualizada: exibindo receitas originadas de Operações por Volume"
        : origemParam === 'SERVICO_EXTRA'
        ? "Visão contextualizada: exibindo receitas originadas de Serviços Extras"
        : "Gestão do faturamento, cobranças e recebimentos originados das operações da empresa.";

    const pageBadge = origemParam === 'OPERACAO'
        ? "OPERAÇÕES POR VOLUME / FATURAMENTO"
        : origemParam === 'SERVICO_EXTRA'
        ? "SERVIÇOS EXTRAS / FATURAMENTO"
        : undefined;

    return (
        <AppShell
            title="Central de Receitas & Contas a Receber"
            subtitle={pageSubtitle}
            badge={pageBadge}
        >
            <div className="space-y-5 max-w-[1700px] mx-auto pb-12">
                {/* 1. TOPBAR CONTEXTUAL: Competência e Empresa */}
                <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        {/* Seletor de Competência */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                                <Calendar className="h-3.5 w-3.5" />
                                Competência:
                            </span>
                            <Select
                                value={competenciaContexto}
                                onValueChange={(val) => setCompetenciaContexto(val)}
                            >
                                <SelectTrigger className="w-[190px] h-9 text-xs font-semibold bg-background border-border">
                                    <SelectValue placeholder="Competência" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Competências</SelectItem>
                                    <SelectItem value="2026-10">Outubro / 2026</SelectItem>
                                    <SelectItem value="2026-09">Setembro / 2026</SelectItem>
                                    <SelectItem value="2026-08">Agosto / 2026</SelectItem>
                                    <SelectItem value="2026-07">Julho / 2026</SelectItem>
                                    <SelectItem value="2026-06">Junho / 2026</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Seletor de Empresa */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                                <Building2 className="h-3.5 w-3.5" />
                                Empresa:
                            </span>
                            <Select
                                value={filterEmpresaId}
                                onValueChange={(val) => setFilterEmpresaId(val)}
                            >
                                <SelectTrigger className="w-[240px] h-9 text-xs font-semibold bg-background border-border">
                                    <SelectValue placeholder="Todas as Empresas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Empresas</SelectItem>
                                    {empresas.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>
                                            {emp.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isRefetching}
                            onClick={handleRefresh}
                            className="h-9 px-3 text-xs gap-1.5 font-medium"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5", isRefetching ? "animate-spin" : "")} />
                            <span>Atualizar</span>
                        </Button>
                    </div>
                </div>

                {/* Banner de Contexto Operacional Ativo (quando vindo com ?origem=) */}
                {origemParam && (
                    <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-lg p-3 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200 shadow-2xs">
                        <div className="flex items-center gap-2.5">
                            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                            <span>
                                Visão contextualizada: exibindo receitas originadas de{" "}
                                <strong className="font-semibold">
                                    {origemParam === "OPERACAO" ? "Operações por Volume" : "Serviços Extras"}
                                </strong>
                                .
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 hover:bg-blue-100/70 font-semibold shrink-0"
                            onClick={() => {
                                const sp = new URLSearchParams(location.search);
                                sp.delete("origem");
                                const q = sp.toString();
                                navigate(`${location.pathname}${q ? `?${q}` : ""}`);
                            }}
                        >
                            Exibir Visão Global
                        </Button>
                    </div>
                )}

                {errorReceitas && (
                    <div className="bg-destructive/10 border border-destructive/30 text-destructive p-5 rounded-xl text-xs space-y-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="space-y-1">
                            <strong className="font-bold flex items-center gap-1.5 text-sm">
                                <AlertTriangle className="h-4 w-4 text-destructive" /> Erro ao carregar receitas operacionais
                            </strong>
                            <p className="text-muted-foreground">{errorReceitas instanceof Error ? errorReceitas.message : "Ocorreu uma falha ao consultar as receitas financeiras no banco de dados."}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => refetch()}
                            className="text-xs shrink-0 font-semibold"
                        >
                            Tentar novamente
                        </Button>
                    </div>
                )}

                {/* 2. OS 4 KPIS FINANCEIROS CANÔNICOS DA UX11 (Invariantes a filtros exploratórios) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    {/* KPI 1: RECEITA RECONHECIDA */}
                    <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Receita Reconhecida
                            </span>
                            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Receipt className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black font-display text-blue-600 dark:text-blue-400 tracking-tight">
                            {formatCurrency(kpis.totalReconhecido)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            competência ({formatCompetencia(competenciaContexto)})
                        </p>
                    </div>

                    {/* KPI 2: A FATURAR / COBRAR */}
                    <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                A Faturar / Cobrar
                            </span>
                            <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                                <FileText className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black font-display text-foreground tracking-tight">
                            {formatCurrency(kpis.aFaturarCobrar)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            {formatCurrency(kpis.valorAFaturarFechar)} a fechar • {formatCurrency(kpis.valorCobrancaPendente)} em cobrança
                        </p>
                    </div>

                    {/* KPI 3: A RECEBER */}
                    <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                A Receber
                            </span>
                            <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                                <Clock className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black font-display text-foreground tracking-tight">
                            {formatCurrency(kpis.aReceber)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            cobranças enviadas e caixa pendente
                        </p>
                    </div>

                    {/* KPI 4: RECEBIDO */}
                    <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Recebido
                            </span>
                            <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                        </div>
                        <div className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400 tracking-tight">
                            {formatCurrency(kpis.recebido)}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                            liquidado no período
                        </p>
                    </div>
                </div>

                {/* INDICADOR SECUNDÁRIO DISCRETO DE CONCILIAÇÃO */}
                <div className="bg-muted/30 border border-border/70 rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        <span>
                            Do valor recebido, <strong className="text-foreground font-semibold">{formatCurrency(kpis.conciliado)}</strong> já está conciliado no extrato bancário.
                        </span>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2.5 text-xs text-primary hover:text-primary-strong hover:bg-primary/5 font-semibold shrink-0 gap-1"
                        onClick={() => navigate("/financeiro/retorno")}
                    >
                        Abrir Central Bancária <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>

                {/* 3. NAVEGAÇÃO POR ESTÁGIO (PILLS COMPACTOS UX11) */}
                <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-1">
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                        {(
                            [
                                { id: "TODOS", label: "Todos", count: contagensEstagio.TODOS },
                                { id: "A_FATURAR_FECHAR", label: "A Faturar / Fechar", count: contagensEstagio.A_FATURAR_FECHAR },
                                { id: "COBRANCA_PENDENTE", label: "Cobrança Pendente", count: contagensEstagio.COBRANCA_PENDENTE },
                                { id: "A_RECEBER", label: "A Receber", count: contagensEstagio.A_RECEBER },
                                { id: "RECEBIDAS", label: "Recebidas", count: contagensEstagio.RECEBIDAS },
                            ] as const
                        ).map((tab) => {
                            const isSelected = estagioFiltro === tab.id;
                            return (
                                <Button
                                    key={tab.id}
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEstagioFiltro(tab.id)}
                                    className={cn(
                                        "h-8 px-3 text-xs font-semibold rounded-lg transition-colors gap-2 shrink-0",
                                        isSelected
                                            ? "bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:text-primary-foreground"
                                            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                    )}
                                >
                                    <span>{tab.label}</span>
                                    <span
                                        className={cn(
                                            "text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold",
                                            isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                        )}
                                    >
                                        {tab.count}
                                    </span>
                                </Button>
                            );
                        })}
                    </div>

                    {/* Alternador Secundário de Visualização Lista / Kanban */}
                    <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/40 shrink-0">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewModeChange("list")}
                            aria-label="Visualização em lista"
                            className={cn(
                                "h-7 px-2.5 gap-1.5 text-xs font-medium transition-all",
                                viewMode === "list"
                                    ? "bg-background shadow-2xs text-foreground border border-border font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <List className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Lista</span>
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewModeChange("kanban")}
                            aria-label="Visualização em kanban"
                            className={cn(
                                "h-7 px-2.5 gap-1.5 text-xs font-medium transition-all",
                                viewMode === "kanban"
                                    ? "bg-background shadow-2xs text-foreground border border-border font-semibold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Kanban className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Kanban</span>
                        </Button>
                    </div>
                </div>

                {/* 4. FILTERBAR COMPACTA DA UX11 */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
                    <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
                        {/* Busca Textual */}
                        <div className="relative flex-1 min-w-[220px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                            <Input
                                placeholder="Buscar cliente, código ou item..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-8.5 text-xs bg-background"
                            />
                        </div>

                        {/* Modalidade */}
                        <Select value={modalidadeFiltro} onValueChange={setModalidadeFiltro}>
                            <SelectTrigger className="h-8.5 min-w-[200px] w-auto text-xs bg-background shrink-0">
                                <SelectValue placeholder="Modalidade" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODAS">Todas as Modalidades</SelectItem>
                                <SelectItem value="CAIXA_IMEDIATO">Caixa Imediato</SelectItem>
                                <SelectItem value="DUPLICATA">Duplicata</SelectItem>
                                <SelectItem value="FATURAMENTO_MENSAL">Faturamento Mensal</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Origem */}
                        <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                            <SelectTrigger className="h-8.5 min-w-[190px] w-auto text-xs bg-background shrink-0">
                                <SelectValue placeholder="Origem" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODAS">Todas as Origens</SelectItem>
                                <SelectItem value="Operação por Volume">Operação por Volume</SelectItem>
                                <SelectItem value="Serviço Extra">Serviço Extra</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Vencimento */}
                        <Select value={vencimentoFiltro} onValueChange={setVencimentoFiltro}>
                            <SelectTrigger className="h-8.5 min-w-[190px] w-auto text-xs bg-background shrink-0">
                                <SelectValue placeholder="Vencimento" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="TODOS">Todos os Vencimentos</SelectItem>
                                <SelectItem value="VENCIDOS">Vencidos</SelectItem>
                                <SelectItem value="A_VENCER">A Vencer</SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Cliente */}
                        <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
                            <SelectTrigger className="h-8.5 min-w-[190px] w-auto text-xs bg-background shrink-0">
                                <SelectValue placeholder="Cliente" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Todos os Clientes</SelectItem>
                                {clientesDisponiveis.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>
                                        {c.nome}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex items-center gap-2">
                        {(modalidadeFiltro !== "TODAS" ||
                            origemFiltro !== "TODAS" ||
                            vencimentoFiltro !== "TODOS" ||
                            clienteFiltro !== "ALL" ||
                            searchTerm.trim() !== "" ||
                            estagioFiltro !== "TODOS") && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setModalidadeFiltro("TODAS");
                                    setOrigemFiltro("TODAS");
                                    setVencimentoFiltro("TODOS");
                                    setClienteFiltro("ALL");
                                    setSearchTerm("");
                                    setEstagioFiltro("TODOS");
                                }}
                            >
                                Limpar Filtros
                            </Button>
                        )}
                        <span className="text-xs text-muted-foreground font-medium">
                            {filteredReceitas.length} {filteredReceitas.length === 1 ? "receita" : "receitas"}
                        </span>
                    </div>
                </div>

                {/* 5. VISUALIZAÇÃO: TABELA DENSA UX11 (PADRÃO OFICIAL) OU KANBAN */}
                {viewMode === "list" ? (
                    <div className="bg-card rounded-xl border border-border shadow-2xs overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                                        <th className="px-4 py-3.5">Cliente / Referência</th>
                                        <th className="px-4 py-3.5">Origem</th>
                                        <th className="px-4 py-3.5">Modalidade</th>
                                        <th className="px-4 py-3.5">Competência</th>
                                        <th className="px-4 py-3.5">Vencimento</th>
                                        <th className="px-4 py-3.5 text-right">Valor</th>
                                        <th className="px-4 py-3.5 text-center">Estágio</th>
                                        <th className="px-4 py-3.5 text-right">Ação</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30 font-medium">
                                    {isGlobalLoading && filteredReceitas.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-16 text-center text-muted-foreground">
                                                <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin text-primary opacity-60" />
                                                <p className="text-sm font-semibold text-foreground">Carregando painel de receitas...</p>
                                            </td>
                                        </tr>
                                    ) : filteredReceitas.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-16 text-center text-muted-foreground">
                                                <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                <p className="font-semibold text-foreground text-sm">Nenhuma receita operacional encontrada</p>
                                                <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou selecionar outra competência.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredReceitas.map((r) => {
                                            const estagioRow = getEstagioUX(r.status);
                                            const sitVenc = getSituacaoVencimento(r);

                                            let badgeClass = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
                                            if (estagioRow === "COBRANCA_PENDENTE") {
                                                badgeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
                                            } else if (estagioRow === "A_RECEBER") {
                                                badgeClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
                                            } else if (estagioRow === "RECEBIDAS") {
                                                badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
                                            }

                                            const isSelected = selectedReceita?.id === r.id;

                                            return (
                                                <tr
                                                    key={r.id}
                                                    onClick={() => handleOpenDrawer(r)}
                                                    className={cn(
                                                        "hover:bg-muted/20 cursor-pointer transition-colors group",
                                                        isSelected ? "bg-primary/[0.04] ring-1 ring-inset ring-primary/20" : ""
                                                    )}
                                                >
                                                    {/* CLIENTE / REFERÊNCIA */}
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="space-y-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-bold text-foreground group-hover:text-primary transition-colors text-[13px]">
                                                                    {r.clienteNome}
                                                                </span>
                                                                {r.observacao === "FATURA_COMPLEMENTAR" && (
                                                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 font-bold">
                                                                        COMPLEMENTAR
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                                                                <span>{r.id.substring(0, 8).toUpperCase()}</span>
                                                                {r.itens.length === 1 && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>{r.itens[0].refOrigem}</span>
                                                                    </>
                                                                )}
                                                                {r.itens.length > 1 && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>{r.itens.length} lançamentos</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>

                                                    {/* ORIGEM */}
                                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                                                        {r.origemPrincipal}
                                                    </td>

                                                    {/* MODALIDADE */}
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <Badge variant="outline" className="text-[11px] font-medium bg-muted/30 border-border">
                                                            {getModalidadeLabel(r.modalidade)}
                                                        </Badge>
                                                    </td>

                                                    {/* COMPETÊNCIA */}
                                                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-medium text-xs">
                                                        {r.competenciaFormatada}
                                                    </td>

                                                    {/* VENCIMENTO */}
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <div className="space-y-0.5">
                                                            <span className="text-foreground font-medium block">
                                                                {formatDate(r.vencimento)}
                                                            </span>
                                                            {sitVenc.isVencido && (
                                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 font-bold">
                                                                    {sitVenc.label}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* VALOR */}
                                                    <td className="px-4 py-3 whitespace-nowrap text-right font-display font-bold text-foreground text-[13px]">
                                                        {formatCurrency(r.valorTotal)}
                                                    </td>

                                                    {/* ESTÁGIO */}
                                                    <td className="px-4 py-3 whitespace-nowrap text-center">
                                                        <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase px-2 py-0.5", badgeClass)}>
                                                            {getEstagioUXLabel(estagioRow)}
                                                        </Badge>
                                                    </td>

                                                    {/* AÇÃO */}
                                                    <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 px-2.5 text-xs text-primary hover:text-primary-strong hover:bg-primary/5 font-semibold"
                                                            onClick={() => handleOpenDrawer(r)}
                                                        >
                                                            Abrir
                                                        </Button>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    /* KANBAN (Compatibilidade Preservada) */
                    <div className="space-y-4">
                        <div className="flex items-center justify-between pb-2">
                            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setActiveTab("CAIXA_IMEDIATO");
                                        setModalidadeFiltro("CAIXA_IMEDIATO");
                                    }}
                                    className={cn("h-8 px-3 text-xs", activeTab === "CAIXA_IMEDIATO" ? "bg-background shadow-2xs font-bold" : "text-muted-foreground")}
                                >
                                    Caixa Imediato
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setActiveTab("DUPLICATA");
                                        setModalidadeFiltro("DUPLICATA");
                                    }}
                                    className={cn("h-8 px-3 text-xs", activeTab === "DUPLICATA" ? "bg-background shadow-2xs font-bold" : "text-muted-foreground")}
                                >
                                    Duplicata
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setActiveTab("FATURAMENTO_MENSAL");
                                        setModalidadeFiltro("FATURAMENTO_MENSAL");
                                    }}
                                    className={cn("h-8 px-3 text-xs", activeTab === "FATURAMENTO_MENSAL" ? "bg-background shadow-2xs font-bold" : "text-muted-foreground")}
                                >
                                    Faturamento Mensal
                                </Button>
                            </div>

                            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDensityChange("compact")}
                                    className={cn("h-7 px-2 text-xs", density === "compact" ? "bg-background shadow-2xs font-bold" : "text-muted-foreground")}
                                >
                                    <LayoutList className="h-3 w-3 mr-1" /> Compacto
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDensityChange("detailed")}
                                    className={cn("h-7 px-2 text-xs", density === "detailed" ? "bg-background shadow-2xs font-bold" : "text-muted-foreground")}
                                >
                                    <LayoutGrid className="h-3 w-3 mr-1" /> Detalhado
                                </Button>
                            </div>
                        </div>

                        <div className={cn("grid gap-4 items-start", currentKanbanStages.length <= 2 ? "grid-cols-1 md:grid-cols-2" : currentKanbanStages.length === 3 ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-4")}>
                            {currentKanbanStages.map((col) => {
                                const items = cardsByCols(col.id);
                                const totalMoney = items.reduce((acc, curr) => acc + (Number(curr.valorTotal) || 0), 0);

                                return (
                                    <div key={col.id} className="flex flex-col bg-muted/20 rounded-2xl border border-border p-3.5 min-h-[480px]">
                                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-border/50">
                                            <div className="flex items-center gap-2">
                                                <col.icon className={cn("h-4 w-4", col.color.split(" ")[1])} />
                                                <h3 className="font-semibold text-xs text-foreground">{col.label}</h3>
                                            </div>
                                            <span className="bg-muted text-muted-foreground text-[10px] font-bold py-0.5 px-2 rounded-full">
                                                {items.length}
                                            </span>
                                        </div>

                                        <div className="mb-3">
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
                                            <p className="text-base font-bold font-display text-foreground">
                                                {formatCurrency(totalMoney)}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto">
                                            {items.length === 0 ? (
                                                <div className="text-center p-6 border border-dashed border-border/60 rounded-xl text-muted-foreground text-xs">
                                                    Nenhum registro.
                                                </div>
                                            ) : (
                                                items.map((r) => (
                                                    <ReceitaKanbanCard
                                                        key={r.id}
                                                        receita={r.raw || r}
                                                        density={density}
                                                        isExpanded={expandedCardIds.has(r.id)}
                                                        onToggleExpand={(e) => toggleCardExpansion(r.id, e)}
                                                        onClick={() => handleOpenDrawer(r)}
                                                        isHighlighted={location.state?.highlightReceitaId === r.id}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 6. DRAWER OFICIAL INTEGRADO */}
                <ReceitaDrawerOficial
                    receita={selectedReceita}
                    open={drawerOpen}
                    onOpenChange={setDrawerOpen}
                    onSuccess={handleRefresh}
                />
            </div>
        </AppShell>
    );
}
