import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Clock,
    CheckCircle2,
    AlertTriangle,
    Users,
    Search,
    Activity,
    DollarSign,
    RefreshCw,
    ChevronRight,
    History,
    CalendarDays,
    Download,
    Check,
    RotateCcw,
    Info,
    X,
    Calendar,
    Loader2,
    ExternalLink,
    Layers,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { EmpresaService } from "@/services/domain/cadastros.service";
import { PontoService } from "@/services/domain/producao.service";
import { OperacaoService } from "@/services/domain/core.service";
import {
    CustoExtraOperacionalService,
    ServicosExtrasOperacionaisService
} from "@/services/domain/despesas.service";
import {
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService
} from "@/services/domain/diaristas.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { AprovacoesService } from "@/services/domain/aprovacoes.service";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

// ────────────────────────────────────────────────────
// Tipo unificado de item de aprovação
// ────────────────────────────────────────────────────
type TipoItem = "PONTO" | "DIARISTA" | "INTERMITENTE" | "CUSTO EXTRA" | "SERVIÇO EXTRA" | "OPERAÇÃO";
type SituacaoItem = "Em análise" | "Aprovado" | "Devolvido" | "Pendente";

interface ApprovalItem {
    id: string;
    tipo: TipoItem;
    referencia: string;
    colaborador: string;
    descricao: string;
    empresa: string;
    operacao: string;
    valor: number;
    horas?: string;
    competencia: string;
    data_recebimento: string;
    situacao: SituacaoItem;
    raw_status?: string;
    raw_lote_id?: string;
}

// ────────────────────────────────────────────────────
// Formatadores
// ────────────────────────────────────────────────────
const fmt = (v: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d?: string) => {
    if (!d) return "—";
    try { return format(new Date(d.includes("T") ? d : d + "T12:00:00"), "dd/MM/yyyy HH:mm", { locale: ptBR }); } catch { return d; }
};

// ────────────────────────────────────────────────────
// Mapeamento de situação
// ────────────────────────────────────────────────────
const situacaoMap = (status?: string): SituacaoItem => {
    if (!status) return "Em análise";
    const s = status.toUpperCase();
    const emAnalise = ["EM_ABERTO", "PENDENTE", "AGUARDANDO_VALIDACAO_RH", "EM_ANALISE", "DETALHADO", "REGISTRADO"].some(k => s === k.toUpperCase());
    if (emAnalise) return "Em análise";

    const aprovado = [
        "APROVADO", "VALIDADO_RH", "VALIDADO", "FECHADO_FINANCEIRO", "PAGO", "PROCESSADO",
        "CNAB_GERADO", "AGUARDANDO_PAGAMENTO", "CONCLUIDO", "FINALIZADO", "FECHADO",
        "APROVADO_OPERACAO", "EM_VALIDACAO"
    ].some(k => s === k.toUpperCase());
    if (aprovado) return "Aprovado";

    if (["DEVOLVIDO", "CANCELADO", "CANCELADO_RH", "RETORNADO", "RECUSADO", "REPROVADO"].some(k => s === k.toUpperCase())) return "Devolvido";

    return "Em análise";
};

const SITUACAO_COLORS: Record<SituacaoItem, string> = {
    "Em análise": "bg-amber-100 text-amber-700 border-amber-200",
    "Aprovado": "bg-emerald-100 text-emerald-700 border-emerald-200",
    "Devolvido": "bg-rose-100 text-rose-700 border-rose-200",
    "Pendente": "bg-slate-100 text-slate-600 border-slate-200",
};

const TIPO_COLORS: Record<TipoItem, string> = {
    "PONTO": "bg-blue-100 text-blue-700",
    "DIARISTA": "bg-emerald-100 text-emerald-700",
    "INTERMITENTE": "bg-indigo-100 text-indigo-700",
    "CUSTO EXTRA": "bg-orange-100 text-orange-700",
    "SERVIÇO EXTRA": "bg-purple-100 text-purple-700",
    "OPERAÇÃO": "bg-cyan-100 text-cyan-700",
};

// ────────────────────────────────────────────────────
// Página principal
// ────────────────────────────────────────────────────
export default function AprovacoesRh() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // ── Filtros ──────────────────────────────────────
    const [periodo, setPeriodo] = useState<string>("semana-atual");
    const [inicio, setInicio] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    const [fim, setFim] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    const [filterEmpresaId, setFilterEmpresaId] = useState("all");
    const [filterType, setFilterType] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<string>("fila");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const [selectedItems, setSelectedItems] = useState<string[]>([]);
    const [activeItem, setActiveItem] = useState<ApprovalItem | null>(null);

    // ── Derivar mês da competência a partir do período ──
    const competenciaMes = useMemo(() => inicio.substring(0, 7), [inicio]);

    // ════ QUERIES ════════════════════════════════════

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => EmpresaService.getAll() });

    const empresaFiltro = filterEmpresaId === "all" ? undefined : filterEmpresaId;
    const mappedSituacao: SituacaoItem = activeTab === "fila" ? "Em análise" : (activeTab === "aprovados" ? "Aprovado" : "Devolvido");

    const { data: results, isLoading: loadData } = useQuery({
        queryKey: ["aprovacoes-rh", currentPage, itemsPerPage, filterType, filterEmpresaId, searchTerm, activeTab, inicio, fim],
        queryFn: async () => {
            if (activeTab === "historico") {
                // historico fetches all without situacao filter
                return AprovacoesService.getAprovacoesRh({
                    page: currentPage,
                    itemsPerPage,
                    tipo: filterType,
                    empresaId: filterEmpresaId,
                    searchTerm,
                    situacao: undefined as any,
                    inicioCompetencia: inicio,
                    fimCompetencia: fim
                });
            }
            return AprovacoesService.getAprovacoesRh({
                page: currentPage,
                itemsPerPage,
                tipo: filterType,
                empresaId: filterEmpresaId,
                searchTerm,
                situacao: mappedSituacao,
                inicioCompetencia: inicio,
                fimCompetencia: fim
            });
        }
    });

    const { data: kpisData, isLoading: loadKpis } = useQuery({
        queryKey: ["aprovacoes-kpis", filterType, filterEmpresaId, inicio, fim],
        queryFn: () => AprovacoesService.getKpis({
            tipo: filterType,
            empresaId: filterEmpresaId,
            inicioCompetencia: inicio,
            fimCompetencia: fim
        })
    });

    const isLoading = loadData || loadKpis;

    const currentTabItems = (results?.data || []) as unknown as ApprovalItem[];
    const allItems = currentTabItems;
    const totalPages = Math.ceil((results?.count || 0) / itemsPerPage);
    const paginatedItems = currentTabItems;

    const kpis = {
        pontos: kpisData?.pontos || 0,
        pontosValor: undefined,
        diaristas: kpisData?.diaristas || 0,
        diaristasValor: undefined,
        intermitentes: kpisData?.intermitentes || 0,
        intermitentesValor: undefined,
        custos: kpisData?.custos || 0,
        custosValor: undefined,
        servicos: kpisData?.servicos || 0,
        servicosValor: undefined,
        atrasados: kpisData?.devolvidos || 0,
        atrasadosValor: undefined,
    };

    // ────────────────────────────────────────────────────
    // Mutações de aprovação/devolução
    // ────────────────────────────────────────────────────
    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["aprovacoes-rh"] });
        queryClient.invalidateQueries({ queryKey: ["aprovacoes-kpis"] });
    };

    const aprovarMutation = useMutation({
        mutationFn: async (item: ApprovalItem) => {
            // Diaristas: valida via LoteFechamento
            if (item.tipo === "DIARISTA" && item.raw_lote_id) {
                const { error } = await supabase.from("diaristas_lotes_fechamento" as any)
                    .update({ status: "VALIDADO_RH", updated_at: new Date().toISOString() })
                    .eq("id", item.raw_lote_id);
                if (error) throw error;

                await supabase.from("lancamentos_diaristas")
                    .update({ status: "VALIDADO_RH" })
                    .eq("lote_fechamento_id", item.raw_lote_id);
                return;
            }
            if (item.tipo === "INTERMITENTE") {
                await IntermitentesLoteService.validarLote(item.id, user?.id || "");
                return;
            }
            // Pontos
            if (item.tipo === "PONTO") {
                const { error } = await supabase.from("registros_ponto")
                    .update({ status_processamento: "PROCESSADO" })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
            // Custos extras
            if (item.tipo === "CUSTO EXTRA") {
                const { error } = await supabase.from("custos_extras_operacionais" as any)
                    .update({ pipeline_status: "EM_VALIDACAO", atualizado_em: new Date().toISOString() })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
            // Serviços extras
            if (item.tipo === "SERVIÇO EXTRA") {
                const { error } = await supabase.from("servicos_extras_operacionais" as any)
                    .update({ pipeline_status: "APROVADO_OPERACAO", atualizado_em: new Date().toISOString() })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
            // Operações por Volume
            if (item.tipo === "OPERAÇÃO") {
                const { error } = await supabase.from("operacoes_producao")
                    .update({ status: "VALIDADO_RH", atualizado_em: new Date().toISOString() })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
        },
        onSuccess: () => {
            toast.success("Item aprovado com sucesso!");
            invalidate();
            setSelectedItems([]);
        },
        onError: (err: any) => toast.error("Erro ao aprovar.", { description: err?.message }),
    });

    const devolverMutation = useMutation({
        mutationFn: async (item: ApprovalItem) => {
            if (item.tipo === "DIARISTA" && item.raw_lote_id) {
                const { error } = await supabase.from("diaristas_lotes_fechamento" as any)
                    .update({ status: "AGUARDANDO_VALIDACAO_RH", updated_at: new Date().toISOString() })
                    .eq("id", item.raw_lote_id);
                if (error) throw error;

                await supabase.from("lancamentos_diaristas")
                    .update({ status: "AGUARDANDO_VALIDACAO_RH" })
                    .eq("lote_fechamento_id", item.raw_lote_id);
                return;
            }
            if (item.tipo === "INTERMITENTE") {
                await IntermitentesLoteService.devolverLote(item.id, "Devolvido pelo RH via Painel Global");
                return;
            }
            if (item.tipo === "PONTO") {
                const { error } = await supabase.from("registros_ponto")
                    .update({ status_processamento: "INCONSISTENTE" })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
            if (item.tipo === "CUSTO EXTRA") {
                const { error } = await supabase.from("custos_extras_operacionais" as any)
                    .update({ pipeline_status: "REPROVADO", atualizado_em: new Date().toISOString() })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
            if (item.tipo === "SERVIÇO EXTRA") {
                const { error } = await supabase.from("servicos_extras_operacionais" as any)
                    .update({ pipeline_status: "DEVOLVIDO", atualizado_em: new Date().toISOString() })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
            // Operações por Volume
            if (item.tipo === "OPERAÇÃO") {
                const { error } = await supabase.from("operacoes_producao")
                    .update({ status: "PENDENTE", atualizado_em: new Date().toISOString() })
                    .eq("id", item.id);
                if (error) throw error;
                return;
            }
        },
        onSuccess: () => {
            toast.success("Item devolvido.");
            invalidate();
            setSelectedItems([]);
        },
        onError: (err: any) => toast.error("Erro ao devolver.", { description: err?.message }),
    });

    // Ações em lote
    const handleBulkAprovar = async () => {
        const items = paginatedItems.filter(i => selectedItems.includes(i.id));
        for (const item of items) await aprovarMutation.mutateAsync(item).catch(() => null);
        setSelectedItems([]);
    };

    const handleBulkDevolver = async () => {
        const items = paginatedItems.filter(i => selectedItems.includes(i.id));
        for (const item of items) await devolverMutation.mutateAsync(item).catch(() => null);
        setSelectedItems([]);
    };

    // ── Seleção ──────────────────────────────────────
    const toggleSelectAll = () => {
        if (selectedItems.length === paginatedItems.length) setSelectedItems([]);
        else setSelectedItems(paginatedItems.map(i => i.id));
    };

    const toggleSelectItem = (id: string) =>
        setSelectedItems(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

    // ── Período Rápido ───────────────────────────────
    const handlePeriodo = (value: string) => {
        setPeriodo(value);
        const hoje = new Date();
        if (value === "semana-atual") {
            setInicio(format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
            setFim(format(endOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        } else if (value === "semana-anterior") {
            const ant = subWeeks(hoje, 1);
            setInicio(format(startOfWeek(ant, { weekStartsOn: 1 }), "yyyy-MM-dd"));
            setFim(format(endOfWeek(ant, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        } else if (value === "mes-atual") {
            setInicio(format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), "yyyy-MM-dd"));
            setFim(format(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0), "yyyy-MM-dd"));
        }
        setCurrentPage(1);
    };

    const handleRefresh = () => {
        invalidate();
        toast.success("Dados atualizados.");
    };

    // ── Exportar ─────────────────────────────────────
    const handleExport = async () => {
        try {
            const { utils, writeFile } = await import("xlsx");
            const rows = currentTabItems.map(i => ({
                Tipo: i.tipo,
                Referência: i.referencia,
                Colaborador: i.colaborador,
                Empresa: i.empresa,
                Operação: i.operacao,
                "Valor (R$)": i.valor,
                Competência: i.competencia,
                "Data Recebimento": fmtDate(i.data_recebimento),
                Situação: i.situacao,
            }));
            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Aprovações");
            writeFile(wb, `Aprovacoes_RH_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
            toast.success("Exportado com sucesso!");
        } catch {
            toast.error("Erro ao exportar.");
        }
    };

    const APPROVAL_TYPES = [
        { id: "all", label: "Fila Geral", icon: Layers, color: "text-primary" },
        { id: "PONTO", label: "Folha de Ponto", icon: Clock, color: "text-blue-500" },
        { id: "DIARISTA", label: "Diaristas", icon: Users, color: "text-emerald-500" },
        { id: "INTERMITENTE", label: "Intermitentes", icon: Users, color: "text-indigo-500" },
        { id: "CUSTO EXTRA", label: "Custos Extras", icon: DollarSign, color: "text-orange-500" },
        { id: "SERVIÇO EXTRA", label: "Serviços Extras", icon: Activity, color: "text-purple-500" },
        { id: "OPERAÇÃO", label: "Operações", icon: CheckCircle2, color: "text-cyan-500" },
    ];

    // ── Render ───────────────────────────────────────
    return (
        <AppShell
            title="Aprovações RH"
            subtitle="Fila de aprovações do RH - decisões pendentes"
            badge="PROCESSAMENTO / PIPELINE"
        >
            <div className="flex flex-col gap-6 max-w-[1700px] mx-auto pb-12 px-4 md:px-6">

                {/* FILTROS TIPO (Pills horizontais) */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    {APPROVAL_TYPES.map((type) => {
                        const Icon = type.icon;
                        const isActive = filterType === type.id;
                        const count = type.id === "all"
                            ? allItems.filter(i => i.situacao === "Em análise").length
                            : allItems.filter(i => i.tipo === type.id && i.situacao === "Em análise").length;

                        return (
                            <button
                                key={type.id}
                                onClick={() => {
                                    setFilterType(type.id);
                                    setCurrentPage(1);
                                }}
                                className={cn(
                                    "h-9 px-4 rounded-full flex items-center gap-2 border transition-all whitespace-nowrap text-xs font-medium",
                                    isActive
                                        ? "bg-[#FFF1EC] text-[#FD4C00] border-[#FD4C00]/20 shadow-sm"
                                        : "bg-white text-muted-foreground border-border hover:bg-bg-subtle"
                                )}
                            >
                                <Icon className={cn("h-3.5 w-3.5", isActive ? "text-[#FD4C00]" : "text-muted-foreground/60")} />
                                <span>{type.label}</span>
                                {count > 0 && (
                                    <span className={cn(
                                        "ml-1 h-4 min-w-[16px] px-1 rounded-full text-[9px] flex items-center justify-center font-bold",
                                        isActive ? "bg-[#FD4C00] text-white" : "bg-gray-100 text-gray-600"
                                    )}>
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                    <KPICard label="Pontos Pendentes" value={String(kpis.pontos)} subtext={fmt(kpis.pontosValor)} icon={Clock} iconColor="text-blue-600" iconBg="bg-blue-50" loading={isLoading} />
                    <KPICard label="Diaristas" value={String(kpis.diaristas)} subtext={fmt(kpis.diaristasValor)} icon={Users} iconColor="text-emerald-600" iconBg="bg-emerald-50" loading={isLoading} />
                    <KPICard label="Intermitentes" value={String(kpis.intermitentes)} subtext={fmt(kpis.intermitentesValor)} icon={Users} iconColor="text-indigo-600" iconBg="bg-indigo-50" loading={isLoading} />
                    <KPICard label="Custos Extras" value={String(kpis.custos)} subtext={fmt(kpis.custosValor)} icon={DollarSign} iconColor="text-orange-600" iconBg="bg-orange-50" loading={isLoading} />
                    <KPICard label="Serviços Extras" value={String(kpis.servicos)} subtext={fmt(kpis.servicosValor)} icon={Activity} iconColor="text-purple-600" iconBg="bg-purple-50" loading={isLoading} />
                    <KPICard label="Devolvidos" value={String(kpis.atrasados)} subtext={fmt(kpis.atrasadosValor)} icon={AlertTriangle} iconColor="text-rose-600" iconBg="bg-rose-50" isAlert />
                    <KPICard label="Atualização" value={format(new Date(), "HH:mm", { locale: ptBR })} subtext={format(new Date(), "dd/MM/yyyy", { locale: ptBR })} icon={CalendarDays} iconColor="text-slate-600" iconBg="bg-slate-50" />
                </div>

                {/* Filters Row */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4 border-y border-border/60">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Select value={periodo} onValueChange={handlePeriodo}>
                                <SelectTrigger className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground cursor-pointer min-w-[160px]">
                                    <SelectValue placeholder="Período" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="semana-atual">Semana atual</SelectItem>
                                    <SelectItem value="semana-anterior">Semana anterior</SelectItem>
                                    <SelectItem value="mes-atual">Mês atual</SelectItem>
                                    <SelectItem value="personalizado">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input type="date" value={inicio} onChange={e => { setInicio(e.target.value); setPeriodo("personalizado"); setCurrentPage(1); }} className="h-10 w-[140px] font-medium" />
                            <Input type="date" value={fim} onChange={e => { setFim(e.target.value); setPeriodo("personalizado"); setCurrentPage(1); }} className="h-10 w-[140px] font-medium" />
                        </div>

                        <Select value={filterEmpresaId} onValueChange={v => { setFilterEmpresaId(v); setCurrentPage(1); }}>
                            <SelectTrigger className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground cursor-pointer min-w-[200px]">
                                <SelectValue placeholder="Todas as empresas" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as empresas</SelectItem>
                                {(empresas as any[]).map(e => (
                                    <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="relative group min-w-[240px]">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                            <Input
                                placeholder="Pesquisa rápida..."
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                                className="pl-10 h-10 w-full rounded-lg border-border bg-card font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleRefresh} className="h-10 gap-2 border-border/40 hover:bg-white shadow-sm" disabled={isLoading}>
                            <RotateCcw size={14} className={cn("text-muted-foreground", isLoading && "animate-spin")} />
                            <span>Sincronizar</span>
                        </Button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-col lg:flex-row gap-6 items-start">
                    <div className="flex-1 min-w-0 w-full">
                        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setCurrentPage(1); setSelectedItems([]); }} className="w-full">
                            <div className="flex flex-col md:flex-row items-center justify-between border-b border-border/40 mb-0 bg-white/60 backdrop-blur-sm rounded-t-xl px-4 gap-4 py-2 md:py-0">
                                <TabsList className="bg-transparent h-14 p-0 gap-6">
                                    {[
                                        { value: "fila", label: "Fila de Aprovação", icon: Activity, count: filaItems.length, color: "data-[state=active]:border-orange-500 data-[state=active]:text-orange-600" },
                                        { value: "aprovados", label: "Aprovados", icon: CheckCircle2, count: aprovadosItems.length, color: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700" },
                                        { value: "devolvidos", label: "Devolvidos", icon: RotateCcw, count: devolvidosItems.length, color: "data-[state=active]:border-rose-500 data-[state=active]:text-rose-600" },
                                        { value: "historico", label: "Histórico", icon: History, count: filtered.length, color: "data-[state=active]:border-primary" },
                                    ].map(tab => (
                                        <TabsTrigger key={tab.value} value={tab.value} className={cn("bg-transparent border-b-2 border-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-[11px] uppercase tracking-wider font-bold px-0 h-14 gap-2 transition-all opacity-70 data-[state=active]:opacity-100", tab.color)}>
                                            <tab.icon size={14} />
                                            {tab.label}
                                            <span className="ml-1 text-[9px] bg-muted/60 rounded-full px-1.5 py-0.5 font-bold">{tab.count}</span>
                                        </TabsTrigger>
                                    ))}
                                </TabsList>

                                <div className="flex items-center gap-2 pb-2 md:pb-0">
                                    <Button size="sm" className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 px-4 shadow-sm font-bold text-xs" disabled={selectedItems.length === 0 || aprovarMutation.isPending} onClick={handleBulkAprovar}>
                                        {aprovarMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                        Validar Selecionados
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-9 border-orange-200 text-orange-600 hover:bg-orange-50 gap-2 px-4 font-bold text-xs" disabled={selectedItems.length === 0 || devolverMutation.isPending} onClick={handleBulkDevolver}>
                                        {devolverMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                                        Devolver
                                    </Button>
                                    <Button variant="outline" size="sm" className="h-9 gap-2 px-4 font-bold text-xs border-border/60" onClick={handleExport}>
                                        <Download size={14} className="text-muted-foreground" />
                                        Excel
                                    </Button>
                                </div>
                            </div>

                            {["fila", "aprovados", "devolvidos", "historico"].map(tabValue => (
                                <TabsContent key={tabValue} value={tabValue} className="mt-0">
                                    <ItensTable
                                        items={paginatedItems}
                                        allItemsCount={currentTabItems.length}
                                        selectedItems={selectedItems}
                                        activeItem={activeItem}
                                        onSelectAll={toggleSelectAll}
                                        onSelectItem={toggleSelectItem}
                                        onRowClick={item => setActiveItem(prev => prev?.id === item.id ? null : item)}
                                        currentPage={currentPage}
                                        itemsPerPage={itemsPerPage}
                                        totalPages={totalPages}
                                        onPageChange={setCurrentPage}
                                        onItemsPerPageChange={v => { setItemsPerPage(v); setCurrentPage(1); }}
                                        isLoading={isLoading}
                                    />
                                </TabsContent>
                            ))}
                        </Tabs>
                    </div>

                    {/* Detail Panel */}
                    {activeItem && (
                        <DetailPanel
                            item={activeItem}
                            onClose={() => setActiveItem(null)}
                            onAprovar={() => aprovarMutation.mutate(activeItem)}
                            onDevolver={() => devolverMutation.mutate(activeItem)}
                            isAprovando={aprovarMutation.isPending}
                            isDevolvendo={devolverMutation.isPending}
                        />
                    )}
                </div>
            </div>
        </AppShell>
    );
}

// ──────────────────────────────────────────────────────────────
// Sub-componentes
// ──────────────────────────────────────────────────────────────

function ItensTable({
    items, allItemsCount, selectedItems, activeItem,
    onSelectAll, onSelectItem, onRowClick,
    currentPage, itemsPerPage, totalPages, onPageChange, onItemsPerPageChange,
    isLoading,
}: {
    items: ApprovalItem[];
    allItemsCount: number;
    selectedItems: string[];
    activeItem: ApprovalItem | null;
    onSelectAll: () => void;
    onSelectItem: (id: string) => void;
    onRowClick: (item: ApprovalItem) => void;
    currentPage: number;
    itemsPerPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onItemsPerPageChange: (n: number) => void;
    isLoading: boolean;
}) {
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, allItemsCount);

    return (
        <div className="bg-white rounded-b-xl rounded-tr-xl shadow-sm border border-border/40 border-t-0 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                    <thead>
                        <tr className="border-b border-border/40 bg-muted/15">
                            <th className="w-12 px-5 py-4 text-left">
                                <Checkbox checked={items.length > 0 && selectedItems.length === items.length} onCheckedChange={onSelectAll} />
                            </th>
                            {["Tipo", "Referência / Lote", "Colaborador / Descrição", "Empresa / Operação", "Valor / Horas", "Competência", "Data Recebimento", "Situação"].map(h => (
                                <th key={h} className="px-4 py-4 text-left font-medium text-muted-foreground uppercase tracking-wider text-[10px] whitespace-nowrap">{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                        {isLoading ? (
                            <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                                <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin opacity-30" />
                                <p className="text-sm font-medium">Carregando dados...</p>
                            </td></tr>
                        ) : items.length === 0 ? (
                            <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                                <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                <p className="text-sm font-medium">Nenhum registro encontrado.</p>
                            </td></tr>
                        ) : items.map(item => (
                            <tr
                                key={item.id}
                                className={cn(
                                    "hover:bg-primary/[0.04] cursor-pointer transition-colors",
                                    activeItem?.id === item.id ? "bg-primary/[0.03] ring-1 ring-inset ring-primary/10" : ""
                                )}
                                onClick={() => onRowClick(item)}
                            >
                                <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                                    <Checkbox checked={selectedItems.includes(item.id)} onCheckedChange={() => onSelectItem(item.id)} />
                                </td>
                                <td className="px-4 py-3">
                                    <Badge variant="outline" className={cn("text-[10px] font-black uppercase border-none px-2 py-0.5 whitespace-nowrap", TIPO_COLORS[item.tipo])}>
                                        {item.tipo}
                                    </Badge>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="font-medium text-slate-700 whitespace-nowrap">{item.referencia}</span>
                                </td>
                                <td className="px-4 py-3 max-w-[200px]">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-foreground truncate">{item.colaborador}</span>
                                        <span className="text-[11px] text-muted-foreground uppercase">{item.descricao}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 max-w-[180px]">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-slate-800 text-[11px] uppercase truncate">{item.empresa}</span>
                                        <span className="text-[11px] text-muted-foreground truncate">{item.operacao}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <div className="flex flex-col items-end">
                                        {item.horas && <span className="font-medium text-slate-700 text-[11px]">{item.horas}</span>}
                                        <span className="font-medium text-slate-900">{fmt(item.valor)}</span>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                    <span className="font-medium text-slate-600">{item.competencia}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                    <span className="text-[12px] font-medium text-slate-700">{item.dataRecebimento}</span>
                                </td>
                                <td className="px-4 py-3 text-center whitespace-nowrap">
                                    <Badge className={cn("border px-3 font-bold text-[10px] shadow-none hover:opacity-80", SITUACAO_COLORS[item.situacao])}>
                                        <div className="flex items-center gap-1.5">
                                            {item.situacao === "Em análise" && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                            {item.situacao}
                                        </div>
                                    </Badge>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-4 flex items-center justify-between border-t border-border/30 bg-slate-50/50">
                <span className="text-xs text-muted-foreground font-medium">
                    {allItemsCount === 0 ? "Nenhum registro" : `Mostrando ${start} a ${end} de ${allItemsCount} registros`}
                </span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Registros por página</span>
                        <Select value={String(itemsPerPage)} onValueChange={v => onItemsPerPageChange(Number(v))}>
                            <SelectTrigger className="h-8 w-20 bg-white border-muted font-medium text-xs cursor-pointer w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 25, 50, 100].map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-white" disabled={currentPage === 1} onClick={() => onPageChange(1)}>«</Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-white" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
                                <ChevronRight className="h-4 w-4 rotate-180" />
                            </Button>
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                const pg = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                                return (
                                    <Button key={pg} variant={currentPage === pg ? "default" : "ghost"} className={cn("h-8 w-8 p-0 text-xs font-medium", currentPage === pg && "bg-orange-600 border-none")} onClick={() => onPageChange(pg)}>
                                        {pg}
                                    </Button>
                                );
                            })}
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-white" disabled={currentPage >= totalPages} onClick={() => onPageChange(currentPage + 1)}>
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8 bg-white" disabled={currentPage >= totalPages} onClick={() => onPageChange(totalPages)}>»</Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function DetailPanel({
    item, onClose, onAprovar, onDevolver, isAprovando, isDevolvendo,
}: {
    item: ApprovalItem;
    onClose: () => void;
    onAprovar: () => void;
    onDevolver: () => void;
    isAprovando: boolean;
    isDevolvendo: boolean;
}) {
    return (
        <Sheet open={true} onOpenChange={(open) => { if (!open) onClose() }}>
            <SheetContent side="right" className="w-[400px] sm:max-w-md p-0 flex flex-col shadow-2xl bg-white overflow-hidden">
                <div className="p-5 pr-14 border-b border-border/40 bg-slate-50/60 flex items-center justify-between shadow-sm relative z-10">
                    <h3 className="font-bold text-slate-800 tracking-tight">Detalhes do Item</h3>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                    {/* Type + status */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <Badge variant="outline" className={cn("text-[10px] font-black uppercase border-none px-2 py-0.5", TIPO_COLORS[item.tipo])}>
                                {item.tipo}
                            </Badge>
                            <Badge className={cn("border text-[10px] font-bold uppercase", SITUACAO_COLORS[item.situacao])}>
                                {item.situacao}
                            </Badge>
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 leading-tight mb-2">{item.colaborador}</h2>
                        <div className="space-y-1">
                            {[
                                { label: "Referência", v: item.referencia },
                                { label: "Empresa", v: item.empresa },
                                { label: "Operação", v: item.operacao },
                            ].map(r => (
                                <p key={r.label} className="text-xs text-muted-foreground font-medium uppercase flex gap-2">
                                    {r.label}: <span className="text-slate-800 normal-case font-medium">{r.v}</span>
                                </p>
                            ))}
                        </div>
                    </div>

                    <Separator className="bg-border/40" />

                    {/* Período */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Calendar size={15} />
                            <span className="text-xs font-bold uppercase tracking-wide">Período / Competência</span>
                        </div>
                        <div className="bg-slate-50 border border-border/30 rounded-lg px-4 py-3">
                            <span className="text-[13px] font-medium text-slate-800">{item.competencia}</span>
                        </div>
                    </div>

                    {/* Resumo */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Activity size={15} />
                            <span className="text-xs font-bold uppercase tracking-wide">Resumo</span>
                        </div>
                        <div className="space-y-2 bg-slate-50 border border-border/30 rounded-lg px-4 py-3">
                            {item.horas && <SummaryLine label="Horas / Diárias" value={item.horas} />}
                            <SummaryLine label="Valor total" value={fmt(item.valor)} isBold />
                        </div>
                    </div>

                    {/* Informações */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-slate-700">
                            <Info size={15} />
                            <span className="text-xs font-bold uppercase tracking-wide">Informações</span>
                        </div>
                        <div className="space-y-2 bg-slate-50 border border-border/30 rounded-lg px-4 py-3">
                            <SummaryLine label="Recebido em" value={item.dataRecebimento} />
                            <SummaryLine label="Referência" value={item.referencia} />
                        </div>
                    </div>

                    {/* Ações */}
                    <div className="pt-2 flex flex-col gap-2">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.15em]">Ações</label>
                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 gap-2" onClick={onAprovar} disabled={isAprovando || item.situacao === "Aprovado"}>
                            {isAprovando ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                            Aprovar
                        </Button>
                        <Button variant="outline" className="w-full border-orange-200 text-orange-600 hover:bg-orange-50 font-bold h-11 gap-2" onClick={onDevolver} disabled={isDevolvendo || item.situacao === "Devolvido"}>
                            {isDevolvendo ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Devolver
                        </Button>
                        <Button variant="outline" className="w-full border-rose-200 text-rose-500 hover:bg-rose-50 font-bold h-11 gap-2" onClick={() => toast.info("Funcionalidade em desenvolvimento.")}>
                            <AlertTriangle size={16} />
                            Solicitar Correção
                        </Button>
                        <Button variant="ghost" className="w-full text-muted-foreground font-bold h-11 gap-2" onClick={() => toast.info("Abrindo detalhes completos...")}>
                            <ExternalLink size={16} />
                            Ver Detalhes Completos
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function KPICard({ label, value, subtext, icon: Icon, iconColor, iconBg, isAlert, loading }: {
    label: string;
    value: string;
    subtext: string;
    icon: any;
    iconColor: string;
    iconBg: string;
    isAlert?: boolean;
    loading?: boolean;
}) {
    return (
        <Card className={cn(
            "esc-card p-5 transition-all hover:shadow-md hover:-translate-y-0.5 bg-white",
            isAlert ? "border-l-4 border-l-rose-500" : ""
        )}>
            <div className="flex items-start justify-between">
                <div className="flex flex-col">
                    <span className={cn(
                        "text-[10px] font-bold uppercase tracking-[0.1em]",
                        isAlert ? "text-rose-600" : "text-slate-500"
                    )}>{label}</span>
                    <div className="mt-3">
                        {loading ? (
                            <div className="h-9 w-16 bg-slate-100 animate-pulse rounded" />
                        ) : (
                            <span className={cn(
                                "text-3xl font-bold font-display leading-none",
                                isAlert ? "text-rose-600" : "text-slate-900"
                            )}>
                                {value}
                            </span>
                        )}
                    </div>
                </div>
                <div className={cn("p-2 rounded-lg opacity-40 shrink-0", iconColor)}>
                    <Icon size={24} strokeWidth={1.5} />
                </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-50">
                <span className="text-xs font-bold text-slate-400">
                    {loading ? "Sincronizando..." : subtext}
                </span>
            </div>
        </Card>
    );
}

function SummaryLine({ label, value, isBold }: { label: string; value: string; isBold?: boolean }) {
    return (
        <div className="flex justify-between items-center text-[13px]">
            <span className="text-muted-foreground font-medium">{label}</span>
            <span className={cn("text-slate-800", isBold ? "font-black text-sm" : "font-bold")}>{value}</span>
        </div>
    );
}
