import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Building2, Calendar, FileText, Search, Filter, RefreshCw, AlertTriangle,
    Wallet, TrendingUp, DollarSign, ArrowRight, Layers, Receipt, Zap, CheckCircle2,
    Clock, Package, AlertCircle, CreditCard, FileSpreadsheet, Lock, Plus,
    LayoutList, LayoutGrid, Info, List, Kanban
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import { ModalReceitaOperacional } from "./components/ModalReceitaOperacional";
import { ReceitaKanbanCard } from "./components/ReceitaKanbanCard";
import { useToast } from "@/components/ui/use-toast";

export const VIEW_MODE_STORAGE_KEY = 'orbe.financeiro.receitas.viewMode';
export const DENSITY_STORAGE_KEY = 'orbe.financeiro.receitas.cardDensity';

const KANBAN_CONFIGS = {
    'CAIXA_IMEDIATO': [
        { id: "pendente_recebimento", label: "Em aberto", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
    'DUPLICATA': [
        { id: "pendente_cobranca", label: "Cobrança gerada", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
        { id: "cobranca_enviada", label: "Cobrança enviada", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
    'FATURAMENTO_MENSAL': [
        { id: "aguardando_fechamento", label: "Em aberto", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
        { id: "pendente_cobranca", label: "Cobrança gerada", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
        { id: "cobranca_enviada", label: "Cobrança enviada", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ]
};

export default function ReceitasPipeline() {
    const queryClient = useQueryClient();
    const { tenantId, loading: isTenantLoading } = useTenant();
    const { toast } = useToast();

    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const location = useLocation();
    const navigate = useNavigate();

    // Contexto de Origem Operacional (OPERACAO, SERVICO_EXTRA ou fallback GLOBAL)
    const origemParam = useMemo<'OPERACAO' | 'SERVICO_EXTRA' | null>(() => {
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(location.search);
            const raw = searchParams.get('origem');
            if (raw === 'OPERACAO' || raw === 'SERVICO_EXTRA') {
                return raw as 'OPERACAO' | 'SERVICO_EXTRA';
            }
        }
        return null; // Regra: valores desconhecidos ou ausência de origem => fallback GLOBAL
    }, [location.search]);
    const [activeTab, setActiveTab] = useState<'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL'>(() => {
        if (typeof window !== 'undefined') {
            const searchParams = new URLSearchParams(location.search);
            const tabParam = searchParams.get('tab');
            if (tabParam && ['CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL'].includes(tabParam)) {
                return tabParam as any;
            }
        }
        return location.state?.activeTab || 'CAIXA_IMEDIATO';
    });
    const [selectedReceita, setSelectedReceita] = useState<any>(null);

    // Alternador Principal de Visualização: Lista (Padrão) vs Kanban
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
            if (saved === 'list' || saved === 'kanban') {
                return saved;
            }
        }
        return 'list'; // Regra UX-2B.12: Lista deve ser o padrão
    });

    const handleViewModeChange = (mode: 'list' | 'kanban') => {
        setViewMode(mode);
        if (typeof window !== 'undefined') {
            localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
        }
    };

    // Controle de Densidade de Visualização dos Cards (Compacto vs Detalhado no Kanban)
    const [density, setDensity] = useState<'compact' | 'detailed'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(DENSITY_STORAGE_KEY);
            if (saved === 'compact' || saved === 'detailed') {
                return saved;
            }
        }
        return 'detailed'; // Regra: Default Detalhado para usuários sem preferência salva
    });

    const [expandedCardIds, setExpandedCardIds] = useState<Set<string>>(new Set());

    const handleDensityChange = (newDensity: 'compact' | 'detailed') => {
        setDensity(newDensity);
        setExpandedCardIds(new Set()); // Regra: Resetar expansões individuais ao alternar modo global
        if (typeof window !== 'undefined') {
            localStorage.setItem(DENSITY_STORAGE_KEY, newDensity);
        }
    };

    const toggleCardExpansion = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedCardIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const { data: empresas = [], isLoading: isEmpresasLoading } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: receitas = [], isLoading: isReceitasLoading, error: errorReceitas } = useQuery({
        queryKey: ["receitas-pipeline", tenantId, filterEmpresaId],
        queryFn: () => ReceitasService.getPipelinePainel(tenantId!, filterEmpresaId === "all" ? undefined : filterEmpresaId, undefined),
        enabled: !!tenantId,
    });

    const isGlobalLoading = isEmpresasLoading || isTenantLoading || isReceitasLoading;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["receita-detalhes"] });
    };

    const handledHighlightRef = useRef<string | null>(null);

    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        const tabParam = searchParams.get('tab');
        if (tabParam && ['CAIXA_IMEDIATO', 'DUPLICATA', 'FATURAMENTO_MENSAL'].includes(tabParam)) {
            setActiveTab(tabParam as any);
        } else if (location.state?.activeTab) {
            setActiveTab(location.state.activeTab as any);
        }

        const highlightRecId = location.state?.highlightReceitaId;
        const highlightSeId = location.state?.highlightServicoExtraId;
        const targetId = highlightRecId || highlightSeId;

        if (targetId && handledHighlightRef.current !== targetId && receitas && receitas.length > 0) {
            const found = receitas.find((r: any) => {
                if (highlightRecId && r.id === highlightRecId) return true;
                if (highlightSeId) {
                    const itens = r.receitas_operacionais_itens || [];
                    return itens.some((it: any) => it.servico_extra_id === highlightSeId);
                }
                return false;
            });
            if (found) {
                handledHighlightRef.current = targetId;
                if (found.modalidade && found.modalidade !== activeTab) {
                    setActiveTab(found.modalidade);
                }
                setSelectedReceita(found);
            }
        }
    }, [location.state, location.search, receitas]);

    const handleNovaReceita = () => {
        toast({ title: "Aviso", description: "Criação avulsa de receitas será disponibilizada em breve.", variant: "default" });
    }

    const filteredReceitas = useMemo(() => {
        return receitas.filter((r: any) => {
            const matchSearch = !searchTerm || String(r.empresas?.nome || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchModalidade = r.modalidade === activeTab;
            if (!matchSearch || !matchModalidade) return false;

            // Filtro contextual de origem derivado dos itens da receita
            if (origemParam === 'OPERACAO') {
                return (r.receitas_operacionais_itens || []).some(
                    (it: any) => it.operacao_id != null || it.operacoes_producao != null
                );
            }
            if (origemParam === 'SERVICO_EXTRA') {
                return (r.receitas_operacionais_itens || []).some(
                    (it: any) => it.servico_extra_id != null || it.servicos_extras_operacionais != null
                );
            }

            return true; // GLOBAL
        });
    }, [receitas, searchTerm, activeTab, origemParam]);

    const kpis = useMemo(() => {
        let count = 0;
        let total = 0;
        let recebido = 0;
        let aberto = 0;
        let vencidas = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // REFINAMENTO: O dashboard deve ser aderente ao Funil atualmente ativo (filtered)
        filteredReceitas.forEach((r: any) => {
            count++;
            const valor = Number(r.valor_total || 0);
            total += valor;
            if (r.status === 'recebido' || r.status === 'pago' || r.status === 'conciliado') {
                recebido += valor;
            } else {
                aberto += valor;
                if (r.vencimento) {
                    const [ano, mes, dia] = r.vencimento.split('-');
                    const vDate = new Date(Number(ano), Number(mes) - 1, Number(dia));
                    if (vDate.getTime() < today.getTime()) {
                        vencidas += valor;
                    }
                }
            }
        });

        return { count, total, recebido, aberto, vencidas };
    }, [filteredReceitas]);

    const currentKanbanStages = KANBAN_CONFIGS[activeTab];
    const kanbanColumns = useMemo(() => {
        const cols: Record<string, any[]> = {};
        currentKanbanStages.forEach(col => cols[col.id] = []);

        filteredReceitas.forEach((r: any) => {
            let st = r.status || currentKanbanStages[0].id;
            // Normalizar os status de liquidação final para caírem na coluna de recebido
            if (st === 'pago' || st === 'conciliado' || st === 'fechado') {
                st = 'recebido';
            }
            if (st === 'cobranca_gerada') {
                st = 'pendente_cobranca';
            }

            if (cols[st]) {
                cols[st].push(r);
            } else if (cols[currentKanbanStages[0].id]) {
                cols[currentKanbanStages[0].id].push(r);
            }
        });
        return cols;
    }, [filteredReceitas, currentKanbanStages]);

    const cardsByCols = (stageId: string) => kanbanColumns[stageId] || [];

    const pageSubtitle = origemParam === 'OPERACAO'
        ? "Faturamento contextualizado em Operações por Volume"
        : origemParam === 'SERVICO_EXTRA'
            ? "Faturamento contextualizado em Serviços Extras"
            : "Funil Financeiro Operacional";

    const pageBadge = origemParam === 'OPERACAO'
        ? "OPERAÇÕES POR VOLUME / FATURAMENTO"
        : origemParam === 'SERVICO_EXTRA'
            ? "SERVIÇOS EXTRAS / FATURAMENTO"
            : undefined;

    return (
        <AppShell
            title="Receitas e Contas a Receber"
            subtitle={pageSubtitle}
            badge={pageBadge}
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                    </Button>
                    <Button variant="default" size="sm" onClick={handleNovaReceita} className="bg-primary hover:bg-primary/90 h-9">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Receita
                    </Button>
                </div>
            }
        >
            {isGlobalLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Carregando painel financeiro...</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-[1700px] mx-auto pb-12 px-4 md:px-6">

                    {errorReceitas && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Erro do Supabase: </strong>
                            <span className="block sm:inline">{errorReceitas instanceof Error ? errorReceitas.message : JSON.stringify(errorReceitas)}</span>
                        </div>
                    )}

                    {/* Banner de Contexto Operacional Ativo */}
                    {origemParam && (
                        <div className="bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-900/40 rounded-lg p-3 flex items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200 shadow-sm">
                            <div className="flex items-center gap-2.5">
                                <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                <span>
                                    Visão contextualizada: exibindo receitas originadas de{" "}
                                    <strong className="font-semibold">
                                        {origemParam === 'OPERACAO' ? 'Operações por Volume' : 'Serviços Extras'}
                                    </strong>
                                    . Lançamentos mistos (com ambas as origens) também são contemplados.
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2.5 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-900 hover:bg-blue-100/70 dark:hover:bg-blue-900/50 font-semibold shrink-0"
                                onClick={() => {
                                    const sp = new URLSearchParams(location.search);
                                    sp.delete('origem');
                                    const q = sp.toString();
                                    navigate(`${location.pathname}${q ? `?${q}` : ''}`);
                                }}
                            >
                                Exibir Visão Global (todas as origens)
                            </Button>
                        </div>
                    )}

                    {/* KPI Headers */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Receitas</span>
                            <span className="text-2xl font-black text-gray-800">{kpis.count}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Valor Total</span>
                            <span className="text-2xl font-black text-blue-600">R$ {kpis.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Recebido</span>
                            <span className="text-2xl font-black text-emerald-600">R$ {kpis.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">A Receber</span>
                            <span className="text-2xl font-black text-orange-500">R$ {kpis.aberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-transparent shadow-sm flex flex-col bg-red-50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2"><AlertCircle className="h-4 w-4 text-red-300" /></div>
                            <span className="text-red-700 text-xs font-bold uppercase tracking-wider mb-1">Vencidas</span>
                            <span className="text-2xl font-black text-red-600">R$ {kpis.vencidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-3 border-y border-border/60">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('CAIXA_IMEDIATO')}
                                    className={cn("h-9 px-4 gap-2 text-sm font-medium", activeTab === 'CAIXA_IMEDIATO' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700')}
                                >
                                    <Zap className="h-4 w-4" /> Caixa Imediato
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('DUPLICATA')}
                                    className={cn("h-9 px-4 gap-2 text-sm font-medium", activeTab === 'DUPLICATA' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700')}
                                >
                                    <FileText className="h-4 w-4" /> Duplicata
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('FATURAMENTO_MENSAL')}
                                    className={cn("h-9 px-4 gap-2 text-sm font-medium", activeTab === 'FATURAMENTO_MENSAL' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700')}
                                >
                                    <Calendar className="h-4 w-4" /> Faturamento Mensal
                                </Button>
                            </div>

                            <select
                                value={filterEmpresaId}
                                onChange={(e) => setFilterEmpresaId(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                <option value="all">Todas as Empresas</option>
                                {empresas.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                ))}
                            </select>

                            <div className="relative group w-full md:w-auto">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                <Input
                                    placeholder="Pesquisar cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-10 w-full md:w-[240px] rounded-lg border-border bg-card font-medium"
                                />
                            </div>
                        </div>

                        {/* Alternador Principal: Lista (Padrão) | Kanban */}
                        <div className="flex items-center gap-2 self-start xl:self-auto shrink-0">
                            <span className="text-xs font-semibold text-gray-500 hidden sm:inline">Visualização:</span>
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-border/40">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewModeChange('list')}
                                    aria-label="Visualização em lista"
                                    className={cn(
                                        "h-8 px-3 gap-1.5 text-xs font-medium transition-all",
                                        viewMode === 'list'
                                            ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                    )}
                                >
                                    <List className="h-3.5 w-3.5" />
                                    <span>Lista</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewModeChange('kanban')}
                                    aria-label="Visualização em kanban"
                                    className={cn(
                                        "h-8 px-3 gap-1.5 text-xs font-medium transition-all",
                                        viewMode === 'kanban'
                                            ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                                            : 'text-gray-500 hover:text-gray-700'
                                    )}
                                >
                                    <Kanban className="h-3.5 w-3.5" />
                                    <span>Kanban</span>
                                </Button>
                            </div>

                            {/* Sub-seletor de Densidade (exibido quando no modo Kanban) */}
                            {viewMode === 'kanban' && (
                                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg border border-border/40 animate-in fade-in duration-200">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDensityChange('compact')}
                                        aria-label="Visualização compacta dos cards"
                                        className={cn(
                                            "h-8 px-2.5 gap-1 text-xs font-medium transition-all",
                                            density === 'compact'
                                                ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                                                : 'text-gray-500 hover:text-gray-700'
                                        )}
                                    >
                                        <LayoutList className="h-3 w-3" />
                                        <span className="hidden sm:inline">Compacto</span>
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDensityChange('detailed')}
                                        aria-label="Visualização detalhada dos cards"
                                        className={cn(
                                            "h-8 px-2.5 gap-1 text-xs font-medium transition-all",
                                            density === 'detailed'
                                                ? 'bg-white shadow-sm text-gray-900 border border-gray-200'
                                                : 'text-gray-500 hover:text-gray-700'
                                        )}
                                    >
                                        <LayoutGrid className="h-3 w-3" />
                                        <span className="hidden sm:inline">Detalhado</span>
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Visualização Lista (Padrão) ou Kanban */}
                    {viewMode === 'list' ? (
                        <div className="bg-white dark:bg-card rounded-xl shadow-sm border border-border overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-[13px] border-collapse">
                                    <thead>
                                        <tr className="border-b border-border/40 bg-muted/20">
                                            <th className="px-4 py-3.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Data</th>
                                            <th className="px-4 py-3.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Cliente</th>
                                            <th className="px-4 py-3.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Origem</th>
                                            <th className="px-4 py-3.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Competência / Vencimento</th>
                                            <th className="px-4 py-3.5 text-left font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Modalidade</th>
                                            <th className="px-4 py-3.5 text-right font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Valor</th>
                                            <th className="px-4 py-3.5 text-center font-semibold text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/20">
                                        {filteredReceitas.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                                                    <Receipt className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                                    <p className="text-sm font-medium">Nenhuma receita encontrada para os filtros selecionados.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredReceitas.map((r: any) => {
                                                const itens = r.receitas_operacionais_itens || [];
                                                const temOp = itens.some((it: any) => it.operacao_id != null || it.operacoes_producao != null);
                                                const temSe = itens.some((it: any) => it.servico_extra_id != null || it.servicos_extras_operacionais != null);

                                                let origemBadge = {
                                                    label: "Operação por Volume",
                                                    badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
                                                };
                                                if (temSe && !temOp) {
                                                    origemBadge = {
                                                        label: "Serviço Extra",
                                                        badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
                                                    };
                                                } else if (temSe && temOp) {
                                                    origemBadge = {
                                                        label: "Origem Mista",
                                                        badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
                                                    };
                                                } else if (r.modalidade === 'FATURAMENTO_MENSAL' && itens.length > 1) {
                                                    origemBadge = {
                                                        label: "Faturamento Mensal",
                                                        badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
                                                    };
                                                }

                                                let modBadge = {
                                                    label: "Caixa Imediato",
                                                    icon: Zap,
                                                    badgeClass: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300",
                                                };
                                                if (r.modalidade === 'DUPLICATA') {
                                                    modBadge = {
                                                        label: "Duplicata",
                                                        icon: FileText,
                                                        badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
                                                    };
                                                } else if (r.modalidade === 'FATURAMENTO_MENSAL') {
                                                    modBadge = {
                                                        label: "Faturamento Mensal",
                                                        icon: Calendar,
                                                        badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
                                                    };
                                                }
                                                const ModIcon = modBadge.icon;

                                                const isLiquidado = r.status === 'recebido' || r.status === 'pago' || r.status === 'conciliado';
                                                let statusBadge = {
                                                    label: "Em aberto",
                                                    badgeClass: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300",
                                                };
                                                if (isLiquidado) {
                                                    statusBadge = {
                                                        label: "Recebido",
                                                        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300",
                                                    };
                                                } else if (r.status === 'cobranca_enviada') {
                                                    statusBadge = {
                                                        label: "Cobrança enviada",
                                                        badgeClass: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
                                                    };
                                                } else if (r.status === 'pendente_cobranca' || r.status === 'cobranca_gerada') {
                                                    statusBadge = {
                                                        label: "Cobrança gerada",
                                                        badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
                                                    };
                                                } else if (r.status === 'aguardando_fechamento') {
                                                    statusBadge = {
                                                        label: "Aguardando fechamento",
                                                        badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300",
                                                    };
                                                }

                                                const rawDate = r.created_at || r.data;
                                                let formattedDate = "-";
                                                if (rawDate) {
                                                    const clean = String(rawDate).split('T')[0];
                                                    const parts = clean.split('-');
                                                    if (parts.length === 3) {
                                                        formattedDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
                                                    }
                                                }

                                                let compVencStr = "-";
                                                if (r.competencia && r.vencimento) {
                                                    const [vy, vm, vd] = String(r.vencimento).split('-');
                                                    compVencStr = `${r.competencia} • Venc: ${vd}/${vm}/${vy}`;
                                                } else if (r.competencia) {
                                                    compVencStr = r.competencia;
                                                } else if (r.vencimento) {
                                                    const [vy, vm, vd] = String(r.vencimento).split('-');
                                                    compVencStr = `Venc: ${vd}/${vm}/${vy}`;
                                                }

                                                const isHighlighted = location.state?.highlightReceitaId === r.id ||
                                                    Boolean(location.state?.highlightServicoExtraId && itens.some((it: any) => it.servico_extra_id === location.state.highlightServicoExtraId));
                                                const isSelected = selectedReceita?.id === r.id;

                                                return (
                                                    <tr
                                                        key={r.id}
                                                        onClick={() => setSelectedReceita(r)}
                                                        className={cn(
                                                            "hover:bg-primary/[0.04] cursor-pointer transition-colors group",
                                                            isSelected ? "bg-primary/[0.05] ring-1 ring-inset ring-primary/20" : "",
                                                            isHighlighted ? "bg-amber-50/60 dark:bg-amber-950/20" : ""
                                                        )}
                                                    >
                                                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground font-mono text-xs">
                                                            {formattedDate}
                                                        </td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                                            <div className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                                                {r.empresas?.nome || "Cliente não informado"}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                                            <Badge variant="outline" className={cn("text-[10px] font-semibold h-5 px-2", origemBadge.badgeClass)}>
                                                                {origemBadge.label}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap text-muted-foreground text-xs font-medium">
                                                            {compVencStr}
                                                        </td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap">
                                                            <Badge variant="outline" className={cn("text-[10px] font-semibold h-5 px-2 gap-1", modBadge.badgeClass)}>
                                                                <ModIcon className="h-3 w-3" />
                                                                {modBadge.label}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap text-right font-bold text-foreground font-display">
                                                            R$ {Number(r.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-4 py-3.5 whitespace-nowrap text-center">
                                                            <Badge variant="outline" className={cn("text-[10px] font-semibold h-5 px-2", statusBadge.badgeClass)}>
                                                                {statusBadge.label}
                                                            </Badge>
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
                        <div className={cn("grid gap-6 items-start", currentKanbanStages.length <= 2 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2' : currentKanbanStages.length === 3 ? 'grid-cols-1 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4')}>
                            {currentKanbanStages.map((col) => {
                                const items = cardsByCols(col.id);
                                const totalMoney = items.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);

                                return (
                                    <div key={col.id} className="flex flex-col bg-gray-50/50 rounded-2xl border border-border p-4 min-h-[500px]">
                                        <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
                                            <div className="flex items-center gap-2">
                                                <col.icon className={cn("h-5 w-5", col.color.split(' ')[1])} />
                                                <h3 className="font-semibold text-gray-700">{col.label}</h3>
                                            </div>
                                            <span className="bg-gray-200 text-gray-600 text-xs font-bold py-1 px-2.5 rounded-full">
                                                {items.length}
                                            </span>
                                        </div>

                                        <div className="mb-4">
                                            <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Total</p>
                                            <p className={cn("text-xl font-bold font-display", col.color.split(' ')[1])}>
                                                R$ {totalMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>

                                        <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
                                            {items.length === 0 ? (
                                                <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                                                    Nenhum registro.
                                                </div>
                                            ) : (
                                                items.map((r: any) => (
                                                    <ReceitaKanbanCard
                                                        key={r.id}
                                                        receita={r}
                                                        density={density}
                                                        isExpanded={expandedCardIds.has(r.id)}
                                                        onToggleExpand={(e) => toggleCardExpansion(r.id, e)}
                                                        onClick={() => setSelectedReceita(r)}
                                                        isHighlighted={location.state?.highlightReceitaId === r.id || Boolean(location.state?.highlightServicoExtraId && (r.receitas_operacionais_itens || []).some((it: any) => it.servico_extra_id === location.state.highlightServicoExtraId))}
                                                    />
                                                ))
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {selectedReceita && (
                        <ModalReceitaOperacional
                            isOpen={!!selectedReceita}
                            receita={selectedReceita}
                            onClose={() => setSelectedReceita(null)}
                            onSuccess={handleRefresh}
                        />
                    )}
                </div>
            )}
        </AppShell>
    );
}
