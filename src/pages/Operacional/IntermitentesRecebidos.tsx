import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    AlertTriangle,
    Building2,
    Calendar as CalendarIcon,
    Loader2,
    RefreshCw,
    Users,
    Clock,
    DollarSign,
    Moon,
    CheckCircle2,
    Pencil,
    UserPlus,
    FolderKanban,
    Search,
    Layers,
    FilterX,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { IntermitentesTableBlock, IntermitenteItem } from "@/components/operacoes/IntermitentesTableBlock";
import { ExecutiveMetricCard } from "@/components/dashboard/ExecutiveMetricCard";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn, decimalParaHora } from "@/lib/utils";
import { EmpresaService } from "@/services/base.service";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { EnvironmentService } from "@/services/environment/EnvironmentService";
import { EnvironmentQueryFilter } from "@/services/environment/EnvironmentQueryFilter";
import { getCurrentTenantId } from "@/services/domain/base.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const MONTH_FILTER_OPTIONS = [
    ...Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1).padStart(2, "0"),
        label: format(new Date(2026, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
    })),
];

const YEAR_OPTIONS = Array.from(new Set(Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)))).sort((a, b) => Number(b) - Number(a));

const IntermitentesRecebidos = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    // Contexto de navegação recebido (via location.state ou query params)
    const navState = location.state as {
        competencia?: string;
        empresaId?: string;
        loteId?: string;
        origem?: string;
    } | null;

    const navCompetencia = navState?.competencia || searchParams.get("competencia");
    const navEmpresaId = navState?.empresaId || searchParams.get("empresaId");

    // Inicialização do mês/ano a partir da competência recebida (ex: "2026-08") ou fallback para data atual
    const initialMonthYear = useMemo(() => {
        if (navCompetencia && /^\d{4}-\d{2}$/.test(navCompetencia)) {
            const [y, m] = navCompetencia.split("-");
            return { month: m, year: y };
        }
        return {
            month: format(new Date(), "MM"),
            year: format(new Date(), "yyyy"),
        };
    }, [navCompetencia]);

    const [filterEmpresaId, setFilterEmpresaId] = useState<string>(navEmpresaId || "all");
    const [filterMonth, setFilterMonth] = useState<string>(initialMonthYear.month);
    const [filterYear, setFilterYear] = useState<string>(initialMonthYear.year);
    const [filterText, setFilterText] = useState("");
    const [lotesFechados, setLotesFechados] = useState<any[] | null>(null);
    const [activeTab, setActiveTab] = useState("pendentes");

    // Sincroniza dinamicamente se novos parâmetros contextuais forem recebidos via navegação
    useEffect(() => {
        if (navCompetencia && /^\d{4}-\d{2}$/.test(navCompetencia)) {
            const [y, m] = navCompetencia.split("-");
            setFilterYear(y);
            setFilterMonth(m);
        }
        if (navEmpresaId) {
            setFilterEmpresaId(navEmpresaId);
        }
    }, [navCompetencia, navEmpresaId]);

    // Edição
    const [editingItem, setEditingItem] = useState<IntermitenteItem | null>(null);
    const [editEmpresaId, setEditEmpresaId] = useState<string>("all");
    const [editHoras, setEditHoras] = useState<string>("");
    const [editTotal, setEditTotal] = useState<string>("");

    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas-all"], queryFn: () => EmpresaService.getAll() });

    // Buscar registros da tabela de pontos que vieram do Tio Digital
    const { data: intermitentesData, isLoading, isError } = useQuery({
        queryKey: ["intermitentes-recebidos", filterEmpresaId, filterMonth, filterYear],
        queryFn: async () => {
            const startDate = `${filterYear}-${filterMonth}-01`;
            const endDate = new Date(Number(filterYear), Number(filterMonth), 0).toISOString().split('T')[0];

            let query = supabase
                .from('lancamentos_intermitentes')
                .select(`
          *,
          empresas:empresa_id(nome),
          colaboradores:colaborador_id(nome)
        `)
                .gte('data_referencia', startDate)
                .lte('data_referencia', endDate)
                .order('data_referencia', { ascending: false });

            if (filterEmpresaId !== "all") {
                query = query.eq('empresa_id', filterEmpresaId);
            }

            const tenantId = await getCurrentTenantId();
            const testIds = await EnvironmentService.getTestEmpresaIds(tenantId);
            query = EnvironmentQueryFilter.applyEmpresaScope(query, {
                tenantId,
                column: 'empresa_id',
                includeNullInProduction: false,
                testIds
            });

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });

    const intermitentes: IntermitenteItem[] = intermitentesData || [];

    const { data: lotesDevolvidos = [] } = useQuery({
        queryKey: ["lotes-intermitentes-devolvidos", filterEmpresaId, filterMonth, filterYear],
        queryFn: async () => {
            let res = await IntermitentesLoteService.listarLotes({
                status: "DEVOLVIDO",
                competencia: `${filterYear}-${filterMonth}`
            });
            if (filterEmpresaId !== "all") {
                res = res.filter(r => r.empresa_id === filterEmpresaId);
            }
            return res;
        },
    });

    // Filtragem no cliente por abas e busca
    const filteredData = useMemo(() => {
        return intermitentes.filter(item => {
            if (activeTab === "pendentes" && item.status_pipeline !== 'RECEBIDO') return false;
            if (activeTab === "historico" && item.status_pipeline === 'RECEBIDO') return false;

            if (!filterText) return true;
            const search = filterText.toLowerCase();
            const colabName = (item.colaboradores?.nome || item.nome_colaborador || "").toLowerCase();
            const empName = (item.empresas?.nome || item.departamento || "").toLowerCase();
            const cargo = (item.cargo || "").toLowerCase();
            const convocacao = (item.convocacao || "").toLowerCase();

            return colabName.includes(search) || empName.includes(search) || cargo.includes(search) || convocacao.includes(search);
        });
    }, [intermitentes, filterText, activeTab]);

    const totalAbertosGeral = useMemo(() => {
        return intermitentes.filter(d => !d.lote_fechamento_id && d.status_pipeline === 'RECEBIDO').length;
    }, [intermitentes]);

    const totalFechadosGeral = useMemo(() => {
        return intermitentes.filter(d => d.status_pipeline !== 'RECEBIDO').length;
    }, [intermitentes]);

    const kpis = useMemo(() => {
        const totalRegistros = filteredData.length;
        const colabsSet = new Set(filteredData.map(d => d.colaborador_id || d.nome_colaborador).filter(Boolean));
        const totalColaboradores = colabsSet.size;

        const valorApurado = filteredData.reduce((acc, item) => acc + Number(item.total || 0), 0);

        const sumHours = (key: keyof IntermitenteItem) => {
            return filteredData.reduce((acc, item) => {
                const val = item[key];
                if (!val) return acc;
                return acc + Number(val);
            }, 0);
        };

        const he50Decimal = sumHours("he_50");
        const he100Decimal = sumHours("he_100");
        const totalHeDecimal = he50Decimal + he100Decimal;
        const noturnaDecimal = sumHours("hora_noturna");

        return {
            totalRegistros,
            totalColaboradores,
            valorApurado,
            horasTrabalhadas: decimalParaHora(sumHours("horas_trabalhadas")),
            horasNormais: decimalParaHora(sumHours("horas_normais")),
            totalHorasExtras: decimalParaHora(totalHeDecimal),
            he50: decimalParaHora(he50Decimal),
            he100: decimalParaHora(he100Decimal),
            horaNoturna: decimalParaHora(noturnaDecimal),
            pendentesEnvio: filteredData.filter(d => !d.lote_fechamento_id && d.status_pipeline === 'RECEBIDO').length
        };
    }, [filteredData]);

    const fecharPeriodoMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Usuário não autenticado.");
            if (filterEmpresaId === "all") {
                throw new Error("Para fechar o período, selecione uma empresa.");
            }
            const startDate = `${filterYear}-${filterMonth}-01`;
            const endDate = new Date(Number(filterYear), Number(filterMonth), 0).toISOString().split('T')[0];

            return await IntermitentesLoteService.fecharPeriodo({
                empresaId: filterEmpresaId,
                periodoInicio: startDate,
                periodoFim: endDate,
                fechadoPor: user.id,
                observacoes: "Fechamento automático via painel de Intermitentes Recebidos."
            });
        },
        onSuccess: (data) => {
            setLotesFechados(data);
            queryClient.invalidateQueries({ queryKey: ["intermitentes-recebidos"] });
            setActiveTab("historico");
        },
        onError: (err: any) => {
            toast.error("Erro ao fechar período.", { description: err?.message || "" });
        }
    });

    const reabrirLoteMutation = useMutation({
        mutationFn: async (id: string) => {
            return await IntermitentesLoteService.reabrirLote(id);
        },
        onSuccess: () => {
            toast.success("Lote reaberto com sucesso. Os registros retornaram para a fila.");
            queryClient.invalidateQueries({ queryKey: ["intermitentes-recebidos"] });
            queryClient.invalidateQueries({ queryKey: ["lotes-intermitentes-devolvidos"] });
            queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lotes"] });
            queryClient.invalidateQueries({ queryKey: ["lotes-intermitentes-financeiro"] });
        },
        onError: (err: any) => {
            toast.error("Erro ao reabrir lote.", { description: err?.message || "" });
        }
    });

    const editItemMutation = useMutation({
        mutationFn: async () => {
            if (!editingItem) return;
            return await IntermitentesLoteService.atualizarLancamento(editingItem.id, {
                empresa_id: editEmpresaId === "all" ? null : editEmpresaId,
                total: parseFloat(editTotal.replace(",", ".")) || 0,
                horas_trabalhadas: parseFloat(editHoras.replace(",", ".")) || 0,
                status_pipeline: 'RECEBIDO'
            });
        },
        onSuccess: () => {
            toast.success("Registro atualizado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["intermitentes-recebidos"] });
            setEditingItem(null);
        },
        onError: (err: any) => toast.error("Erro ao salvar", { description: err?.message })
    });

    const hasActiveFilters = filterEmpresaId !== "all" || filterText.trim() !== "";
    const resetFilters = () => {
        setFilterEmpresaId("all");
        setFilterText("");
        setFilterMonth(format(new Date(), "MM"));
        setFilterYear(format(new Date(), "yyyy"));
    };

    const selectedEmpresaObj = useMemo(() => {
        return (empresas as any[]).find(e => e.id === filterEmpresaId);
    }, [empresas, filterEmpresaId]);

    return (
        <AppShell
            title="Intermitentes Recebidos"
            subtitle="Visualização e conciliação dos dados de colaboradores intermitentes vindos do Tio Digital"
            badge="ENTRADAS / CAPTURA"
        >
            <div className="space-y-5">
                {/* ─── BARRA DE AÇÕES SUPERIOR / CONTEXTO ───────────────────────────── */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-medium">
                            <Layers className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                            Regime Intermitente (Tio Digital)
                        </span>
                        <span>•</span>
                        <span>Competência: <strong className="text-foreground font-semibold">{filterMonth}/{filterYear}</strong></span>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5 border-border hover:bg-muted"
                            onClick={() => navigate("/operacional/intermitentes/lotes")}
                        >
                            <FolderKanban className="h-3.5 w-3.5 text-primary" />
                            Gestão de Lotes
                        </Button>
                    </div>
                </div>

                {/* ─── BARRA COMPACTA DE FILTROS ────────────────────────────────────── */}
                <div className="bg-card border border-border rounded-xl p-4 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-end gap-3">
                        {/* Seletor de Empresa */}
                        <div className="flex-1 min-w-[220px] space-y-1.5">
                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Empresa
                            </Label>
                            <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                                <SelectTrigger className="h-9 bg-background border-border">
                                    <Building2 className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                                    <SelectValue placeholder="Selecione a empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas as Empresas</SelectItem>
                                    {(empresas as any[]).map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Busca Textual */}
                        <div className="flex-1 min-w-[240px] space-y-1.5">
                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Busca Rápida
                            </Label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
                                <Input
                                    placeholder="Buscar por colaborador, cargo ou convocação..."
                                    className="h-9 pl-9 bg-background border-border text-xs"
                                    value={filterText}
                                    onChange={(e) => setFilterText(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Mês */}
                        <div className="w-[140px] space-y-1.5">
                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Mês
                            </Label>
                            <Select value={filterMonth} onValueChange={setFilterMonth}>
                                <SelectTrigger className="h-9 bg-background border-border">
                                    <CalendarIcon className="h-3.5 w-3.5 mr-2 text-primary shrink-0" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MONTH_FILTER_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Ano */}
                        <div className="w-[100px] space-y-1.5">
                            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Ano
                            </Label>
                            <Select value={filterYear} onValueChange={setFilterYear}>
                                <SelectTrigger className="h-9 bg-background border-border">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {YEAR_OPTIONS.map((y) => (
                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Botões de Reset */}
                        <div className="flex items-center gap-1 pb-0.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-9 w-9 text-muted-foreground hover:text-primary transition-colors"
                                        onClick={() => {
                                            setFilterMonth(format(new Date(), "MM"));
                                            setFilterYear(format(new Date(), "yyyy"));
                                        }}
                                    >
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Restaurar mês atual</TooltipContent>
                            </Tooltip>

                            {hasActiveFilters && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            className="h-9 w-9 text-muted-foreground hover:text-rose-600 transition-colors"
                                            onClick={resetFilters}
                                        >
                                            <FilterX className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Limpar todos os filtros</TooltipContent>
                                </Tooltip>
                            )}
                        </div>
                    </div>

                    {hasActiveFilters && (
                        <div className="flex items-center gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">Filtros aplicados:</span>
                            {filterEmpresaId !== "all" && (
                                <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                                    Empresa: {selectedEmpresaObj?.nome || "Selecionada"}
                                </span>
                            )}
                            {filterText.trim() && (
                                <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                                    Termo: "{filterText}"
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* ─── 4 INDICADORES EXECUTIVOS SEMÂNTICOS (CONV-17) ───────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ExecutiveMetricCard
                        label="Colaboradores Convocados"
                        value={String(kpis.totalColaboradores)}
                        subtitle={`${kpis.totalRegistros} apontamentos capturados`}
                        badge={
                            kpis.pendentesEnvio > 0
                                ? { text: `${kpis.pendentesEnvio} abertos`, variant: "warning" }
                                : { text: "Sem pendências", variant: "success" }
                        }
                        icon={Users}
                    />

                    <ExecutiveMetricCard
                        label="Jornada Total Trabalhada"
                        value={kpis.horasTrabalhadas}
                        subtitle={`${kpis.horasNormais} em jornada regular`}
                        icon={Clock}
                    />

                    <ExecutiveMetricCard
                        label="Horas Extras & Noturna"
                        value={kpis.totalHorasExtras}
                        subtitle={`50%: ${kpis.he50} • 100%: ${kpis.he100} • Noturna: ${kpis.horaNoturna}`}
                        badge={
                            kpis.horaNoturna !== "00:00"
                                ? { text: `Noturna: ${kpis.horaNoturna}`, variant: "info" }
                                : undefined
                        }
                        icon={Moon}
                    />

                    <ExecutiveMetricCard
                        label="Valor Total Apurado"
                        value={formatCurrency(kpis.valorApurado)}
                        subtitle={
                            kpis.totalColaboradores > 0
                                ? `Média: ${formatCurrency(kpis.valorApurado / kpis.totalColaboradores)} / colab.`
                                : "Nenhum valor a pagar"
                        }
                        icon={DollarSign}
                    />
                </div>

                {/* ─── FITA SECUNDÁRIA CONTEXTUAL (RITMO VISUAL & PRESERVAÇÃO INTEGRAL) ─── */}
                <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-4 text-xs shadow-xs">
                    <div className="flex flex-wrap items-center gap-3">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                            Detalhamento da Jornada:
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 border border-border/60 font-mono text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                <span className="text-muted-foreground font-sans">Normais:</span>
                                <strong className="text-foreground">{kpis.horasNormais}</strong>
                            </span>

                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-mono text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                <span className="font-sans text-amber-700 dark:text-amber-400">HE 50%:</span>
                                <strong className="font-semibold">{kpis.he50}</strong>
                            </span>

                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-800 dark:text-orange-300 border border-orange-500/20 font-mono text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                <span className="font-sans text-orange-700 dark:text-orange-400">HE 100%:</span>
                                <strong className="font-semibold">{kpis.he100}</strong>
                            </span>

                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-violet-500/10 text-violet-800 dark:text-violet-300 border border-violet-500/20 font-mono text-[11px]">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                <span className="font-sans text-violet-700 dark:text-violet-400">Noturna:</span>
                                <strong className="font-semibold">{kpis.horaNoturna}</strong>
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 sm:pt-0 border-t sm:border-t-0 border-border/50">
                        <div className="flex items-center gap-1.5">
                            <span>Total Apontamentos:</span>
                            <strong className="font-mono text-foreground">{kpis.totalRegistros}</strong>
                        </div>
                        <div className="h-3 w-[1px] bg-border" />
                        <div className="flex items-center gap-1.5">
                            <span>Pendentes de Fechamento:</span>
                            <strong className="font-mono text-amber-600 dark:text-amber-400">{kpis.pendentesEnvio}</strong>
                        </div>
                    </div>
                </div>

                {/* ─── BANNER DE LOTES DEVOLVIDOS ──────────────────────────────────── */}
                {lotesDevolvidos.length > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 shadow-xs space-y-3">
                        <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <h3 className="font-semibold text-xs uppercase tracking-wider">
                                Lotes Devolvidos pelo RH ({lotesDevolvidos.length})
                            </h3>
                        </div>
                        <div className="grid gap-3">
                            {lotesDevolvidos.map((lote: any) => (
                                <div
                                    key={lote.id}
                                    className="bg-card rounded-lg p-3.5 border border-rose-500/20 flex flex-wrap items-center justify-between gap-3"
                                >
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold text-foreground border-l-2 border-rose-500 pl-2">
                                            {lote.empresa?.nome || "Empresa"} — Competência: {lote.competencia}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground pl-2.5">
                                            {lote.quantidade_registros} registros • Valor Total: {formatCurrency(lote.valor_total)}
                                        </div>
                                        <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium pl-2.5">
                                            Motivo: {lote.observacoes || "Não informado"}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground/80 pl-2.5">
                                            Devolvido em: {new Date(lote.updated_at).toLocaleString('pt-BR')}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 text-xs h-8"
                                        disabled={reabrirLoteMutation.isPending}
                                        onClick={() => {
                                            if (confirm("Deseja realmente reabrir este período? Os registros voltarão para a fila operacional.")) {
                                                reabrirLoteMutation.mutate(lote.id);
                                            }
                                        }}
                                    >
                                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                                        Reabrir Período
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── ÁREA PRINCIPAL DE TRABALHO (ABAS + TABELA) ───────────────────── */}
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="p-3.5 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-3">
                            {/* Abas com Contadores */}
                            <div className="flex items-center gap-3">
                                <TabsList className="bg-muted/80 h-9 p-1">
                                    <TabsTrigger
                                        value="pendentes"
                                        className="text-xs uppercase font-semibold tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-xs px-3"
                                    >
                                        Pendentes ({totalAbertosGeral})
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="historico"
                                        className="text-xs uppercase font-semibold tracking-wider data-[state=active]:bg-background data-[state=active]:shadow-xs px-3"
                                    >
                                        Histórico ({totalFechadosGeral})
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            {/* Botão de Fechamento de Período (Preservando Regra Canônica) */}
                            <Button
                                className={cn(
                                    "gap-2 font-semibold uppercase tracking-wider text-xs h-9",
                                    filterEmpresaId === "all"
                                        ? "bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
                                        : "bg-emerald-600 hover:bg-emerald-700 text-white"
                                )}
                                size="sm"
                                disabled={isLoading || kpis.pendentesEnvio === 0 || fecharPeriodoMutation.isPending || filterEmpresaId === "all"}
                                onClick={() => {
                                    if (filterEmpresaId === "all") {
                                        toast.warning("Para fechar o período, selecione uma empresa no filtro.");
                                        return;
                                    }
                                    const nomeEmpresa = selectedEmpresaObj?.nome || "a empresa selecionada";
                                    if (confirm(`Confirmar o fechamento de ${kpis.pendentesEnvio} lançamentos em aberto da empresa ${nomeEmpresa} neste período? Eles serão enviados para Validação do RH.`)) {
                                        fecharPeriodoMutation.mutate();
                                    }
                                }}
                            >
                                {fecharPeriodoMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckCircle2 className="h-4 w-4" />
                                )}
                                {filterEmpresaId === "all" ? (
                                    "Selecione uma Empresa para Fechar"
                                ) : (
                                    `Fechar Período Intermitente (${kpis.pendentesEnvio} abertos)`
                                )}
                            </Button>
                        </div>

                        {/* Conteúdo da Tabela */}
                        <div className="p-0">
                            {isLoading ? (
                                <div className="p-20 flex flex-col items-center justify-center text-muted-foreground space-y-3">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    <p className="text-sm font-medium">Carregando dados dos intermitentes...</p>
                                </div>
                            ) : isError ? (
                                <div className="p-16 flex flex-col items-center justify-center text-rose-500 space-y-3 bg-rose-50/20">
                                    <AlertTriangle className="h-8 w-8 text-rose-500" />
                                    <p className="text-sm font-semibold text-rose-600">Falha ao carregar registros</p>
                                    <p className="text-xs text-rose-500/80 text-center max-w-md">
                                        Não foi possível buscar a listagem do Tio Digital. Tente recarregar a página ou contate o suporte.
                                    </p>
                                </div>
                            ) : (
                                <IntermitentesTableBlock
                                    data={filteredData}
                                    onEdit={
                                        activeTab === 'pendentes'
                                            ? (item) => {
                                                setEditingItem(item);
                                                setEditEmpresaId(item.empresa_id || "all");
                                                setEditTotal(item.total ? String(item.total).replace(".", ",") : "0,00");
                                                setEditHoras(item.horas_trabalhadas ? String(item.horas_trabalhadas).replace(".", ",") : "0");
                                            }
                                            : undefined
                                    }
                                />
                            )}
                        </div>
                    </Tabs>
                </div>
            </div>

            {/* ─── MODAL DE FECHAMENTO DE SUCESSO ─────────────────────────────────── */}
            <Dialog open={!!lotesFechados} onOpenChange={(open) => !open && setLotesFechados(null)}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="h-5 w-5" />
                            {lotesFechados && lotesFechados.length > 1 ? "Períodos fechados com sucesso" : "Período fechado com sucesso"}
                        </DialogTitle>
                        <DialogDescription>
                            Os registros foram agrupados nas filiais abaixo e encaminhados para a Validação RH.
                        </DialogDescription>
                    </DialogHeader>
                    {lotesFechados && lotesFechados.length > 0 && (
                        <div className="space-y-3 my-2">
                            {lotesFechados.map((loteFechado, i) => (
                                <div key={loteFechado.id || i} className="bg-muted/40 p-3.5 rounded-lg space-y-2 text-xs border border-border">
                                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                                        <span className="text-muted-foreground">Lote:</span>
                                        <span className="font-semibold font-mono text-primary">
                                            INT-{loteFechado.competencia}-{loteFechado.id?.substring(0, 4).toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                                        <span className="text-muted-foreground">Registros:</span>
                                        <span className="font-semibold">{loteFechado.quantidade_registros}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-border/50 pb-1.5">
                                        <span className="text-muted-foreground">Valor Total:</span>
                                        <span className="font-semibold text-emerald-600 font-mono">{formatCurrency(loteFechado.valor_total)}</span>
                                    </div>
                                    <div className="flex justify-between pt-0.5">
                                        <span className="text-muted-foreground">Status Atual:</span>
                                        <span className="font-semibold text-amber-600">Aguardando validação RH</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setLotesFechados(null)} className="w-full">
                            Entendi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ─── MODAL DE EDIÇÃO (CORREÇÃO DE REGISTRO) ─────────────────────────── */}
            <Dialog open={!!editingItem} onOpenChange={(v) => !v && setEditingItem(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Pencil className="h-4 w-4 text-primary" />
                            Corrigir Registro Intermitente
                        </DialogTitle>
                        <DialogDescription>
                            Para validar no fluxo oficial, o colaborador {editingItem?.nome_colaborador || "—"} precisa ter uma empresa vinculada.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-semibold">Empresa / Operação</Label>
                            <Select value={editEmpresaId} onValueChange={setEditEmpresaId}>
                                <SelectTrigger className="h-9 bg-background border-border">
                                    <SelectValue placeholder="Sem empresa vinculada" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Sem empresa vinculada</SelectItem>
                                    {(empresas as any[]).map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Horas Trabalhadas</Label>
                                <Input
                                    value={editHoras}
                                    onChange={(e) => setEditHoras(e.target.value)}
                                    placeholder="Ex: 8,50"
                                    className="h-9 bg-background border-border text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Valor Total (R$)</Label>
                                <Input
                                    value={editTotal}
                                    onChange={(e) => setEditTotal(e.target.value)}
                                    placeholder="Ex: 120,00"
                                    className="h-9 bg-background border-border text-xs"
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter className="flex items-center justify-between sm:justify-between pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary hover:text-primary hover:bg-primary/10 text-xs"
                            onClick={() => {
                                const colabId = editingItem?.colaborador_id;
                                setEditingItem(null);
                                navigate('/colaboradores', {
                                    state: colabId ? {
                                        openEditId: colabId
                                    } : {
                                        openNew: true,
                                        initialName: editingItem?.nome_colaborador,
                                        initialTipo: 'Intermitente'
                                    }
                                });
                            }}
                        >
                            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                            {editingItem?.colaborador_id ? "Completar no RH" : "Cadastrar no RH"}
                        </Button>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingItem(null)}
                                disabled={editItemMutation.isPending}
                            >
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={() => editItemMutation.mutate()}
                                disabled={editItemMutation.isPending}
                            >
                                {editItemMutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : null}
                                Salvar Correção
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default IntermitentesRecebidos;
