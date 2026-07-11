import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    AlertTriangle,
    Building2,
    Calendar as CalendarIcon,
    History,
    Loader2,
    LucideIcon,
    RefreshCw,
    Users,
    Clock,
    DollarSign,
    Moon,
    CheckCircle2,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { IntermitentesTableBlock } from "@/components/operacoes/IntermitentesTableBlock";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn, decimalParaHora } from "@/lib/utils";
import { EmpresaService } from "@/services/base.service";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";

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

type TopKpiCardProps = {
    label: string;
    value: string | number;
    size?: "large" | "small" | "xs";
    variant?: "default" | "primary" | "warning" | "success" | "muted" | "info";
    icon?: LucideIcon;
    iconColor?: string;
};

const topKpiCardClasses: Record<NonNullable<TopKpiCardProps["size"]>, string> = {
    large: "p-5 min-h-[120px]",
    small: "p-4 min-h-[100px]",
    xs: "p-3 min-h-[80px]"
};

const TopKpiCard = ({ label, value, size = "large", variant = "default", icon: Icon, iconColor = "bg-primary-soft text-primary" }: TopKpiCardProps) => (
    <div className={cn(
        "group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5",
        variant === "primary" ? "bg-primary text-white border-primary shadow-lg" : "bg-white border border-[#DEDEDE] shadow-sm hover:shadow-md",
        topKpiCardClasses[size],
        "rounded-[12px]"
    )}>
        <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
                <div className={cn("space-y-1.5", size === "xs" && "space-y-0.5")}>
                    <div className={cn(
                        "font-medium uppercase tracking-widest leading-tight",
                        size === "xs" ? "text-[10px]" : "text-[12px]",
                        variant === "primary" ? "text-white/80" : "text-[#737373]",
                        "font-inter"
                    )}>
                        {label}
                    </div>
                    <div className={cn(
                        "font-bold leading-none",
                        size === "large" ? "text-[30px]" : size === "small" ? "text-2xl" : "text-xl",
                        variant === "primary" ? "text-white" : "text-[#171717]",
                        "font-manrope"
                    )}>
                        {value}
                    </div>
                </div>
                {Icon && (
                    <div className={cn(
                        "shrink-0 rounded-lg flex items-center justify-center",
                        iconColor,
                        size === "xs" ? "h-8 w-8" : "h-10 w-10"
                    )}>
                        <Icon className={size === "xs" ? "h-4 w-4" : "h-5 w-5"} />
                    </div>
                )}
            </div>
        </div>
    </div>
);

const IntermitentesRecebidos = () => {
    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "MM"));
    const [filterYear, setFilterYear] = useState<string>(format(new Date(), "yyyy"));
    const [filterText, setFilterText] = useState("");
    const [loteFechado, setLoteFechado] = useState<any>(null);
    const [activeTab, setActiveTab] = useState("pendentes");
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas-all"], queryFn: () => EmpresaService.getAll() });

    // Buscar registros da tabela de pontos que vieram do Tio Digital
    const { data: intermitentesData, isLoading, isError } = useQuery({
        queryKey: ["intermitentes-recebidos", filterEmpresaId, filterMonth, filterYear],
        queryFn: async () => {
            // Formata a data de inicio e fim do mês
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

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
    });

    const intermitentes = intermitentesData || [];

    const { data: lotesDevolvidos = [], isLoading: isLoadingDevolvidos } = useQuery({
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
            // Aba logic
            if (activeTab === "pendentes" && item.status_pipeline !== 'RECEBIDO') return false;
            if (activeTab === "historico" && item.status_pipeline === 'RECEBIDO') return false;

            // Busca logic
            if (!filterText) return true;
            const search = filterText.toLowerCase();
            const colabName = (item.colaboradores?.nome || item.nome_colaborador || "").toLowerCase();
            const empName = (item.empresas?.nome || item.departamento || "").toLowerCase();
            const cargo = (item.cargo || "").toLowerCase();
            const provoc = (item.convocacao || "").toLowerCase();

            return colabName.includes(search) || empName.includes(search) || cargo.includes(search) || provoc.includes(search);
        });
    }, [intermitentes, filterText, activeTab]);

    const kpis = useMemo(() => {
        const totalRegistros = filteredData.length;
        const colabsSet = new Set(filteredData.map(d => d.colaborador_id || d.nome_colaborador).filter(Boolean));
        const totalColaboradores = colabsSet.size;

        // Total Valor
        const valorApurado = filteredData.reduce((acc, item) => acc + Number(item.total || 0), 0);

        const sumHours = (key: keyof typeof filteredData[0]) => {
            return filteredData.reduce((acc, item) => {
                const val = item[key];
                if (!val) return acc;
                return acc + Number(val);
            }, 0);
        };

        return {
            totalRegistros,
            totalColaboradores,
            valorApurado,
            horasTrabalhadas: decimalParaHora(sumHours("horas_trabalhadas")),
            horasNormais: decimalParaHora(sumHours("horas_normais")),
            he50: decimalParaHora(sumHours("he_50")),
            he100: decimalParaHora(sumHours("he_100")),
            horaNoturna: decimalParaHora(sumHours("hora_noturna")),
            pendentesEnvio: filteredData.filter(d => !d.lote_fechamento_id && d.status_pipeline === 'RECEBIDO').length
        };
    }, [filteredData]);

    const fecharPeriodoMutation = useMutation({
        mutationFn: async () => {
            if (!user) throw new Error("Usuário não autenticado.");
            const startDate = `${filterYear}-${filterMonth}-01`;
            const endDate = new Date(Number(filterYear), Number(filterMonth), 0).toISOString().split('T')[0];

            return await IntermitentesLoteService.fecharPeriodo({
                empresaId: filterEmpresaId === "all" ? null : filterEmpresaId,
                periodoInicio: startDate,
                periodoFim: endDate,
                fechadoPor: user.id,
                observacoes: "Fechamento automático via painel de Intermitentes Recebidos."
            });
        },
        onSuccess: (data) => {
            setLoteFechado(data);
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

    return (
        <AppShell
            title="Intermitentes Recebidos"
            subtitle="Visualização dos dados de colaboradores intermitentes vindos do Tio Digital"
            badge="ENTRADAS / CAPTURA"
        >
            <section className="space-y-6">
                <div className="bg-white border border-[#DEDEDE] rounded-[12px] p-6 shadow-sm">
                    <div className="flex flex-wrap items-center gap-6">
                        <div className="flex-1 min-w-[240px] space-y-2">
                            <Label className="text-[12px] font-medium uppercase tracking-widest text-[#737373] font-inter">Empresa</Label>
                            <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                                <SelectTrigger className="h-9 border-[#DEDEDE] bg-white rounded-[6px]">
                                    <Building2 className="h-4 w-4 mr-2 text-primary" />
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

                        <div className="flex-1 min-w-[240px] space-y-2">
                            <Label className="text-[12px] font-medium uppercase tracking-widest text-[#737373] font-inter">Busca Rápida</Label>
                            <Input
                                placeholder="Buscar por colaborador, cargo ou convocação..."
                                className="h-9 w-full bg-white border-[#DEDEDE]"
                                value={filterText}
                                onChange={(e) => setFilterText(e.target.value)}
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="space-y-2">
                                <Label className="text-[12px] font-medium uppercase tracking-widest text-[#737373] font-inter">Mês</Label>
                                <Select value={filterMonth} onValueChange={setFilterMonth}>
                                    <SelectTrigger className="w-[140px] h-9 border-[#DEDEDE] bg-white rounded-[6px]">
                                        <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>{MONTH_FILTER_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[12px] font-medium uppercase tracking-widest text-[#737373] font-inter">Ano</Label>
                                <Select value={filterYear} onValueChange={setFilterYear}>
                                    <SelectTrigger className="w-[110px] h-9 border-[#DEDEDE] bg-white rounded-[6px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>{YEAR_OPTIONS.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="flex items-center self-end pb-0.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-9 w-9 text-[#A3A3A3] hover:text-primary transition-colors" onClick={() => { setFilterMonth(format(new Date(), "MM")); setFilterYear(format(new Date(), "yyyy")); }}>
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Resetar para hoje</TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    <TopKpiCard label="Colaboradores" value={kpis.totalColaboradores} icon={Users} iconColor="bg-blue-50 text-blue-600" size="xs" />
                    <TopKpiCard label="Registros" value={kpis.totalRegistros} icon={History} iconColor="bg-indigo-50 text-indigo-600" size="xs" />
                    <TopKpiCard label="H. Trabalhadas" value={kpis.horasTrabalhadas} icon={Clock} iconColor="bg-sky-50 text-sky-600" size="xs" />
                    <TopKpiCard label="H. Normais" value={kpis.horasNormais} icon={Clock} iconColor="bg-slate-50 text-slate-600" size="xs" />
                    <TopKpiCard label="HE 50%" value={kpis.he50} icon={Clock} iconColor="bg-amber-50 text-amber-600" size="xs" />
                    <TopKpiCard label="HE 100%" value={kpis.he100} icon={Clock} iconColor="bg-orange-50 text-orange-600" size="xs" />
                    <TopKpiCard label="H. Noturna" value={kpis.horaNoturna} icon={Moon} iconColor="bg-violet-50 text-violet-600" size="xs" />
                    <TopKpiCard label="Valor" value={formatCurrency(kpis.valorApurado)} icon={DollarSign} iconColor="bg-emerald-50 text-emerald-600" size="xs" />
                </div>

                {lotesDevolvidos.length > 0 && (
                    <div className="bg-rose-50 border border-rose-200 rounded-[12px] p-6 shadow-sm space-y-4">
                        <div className="flex items-center gap-2 text-rose-700">
                            <AlertTriangle className="h-5 w-5" />
                            <h3 className="font-manrope font-bold text-sm uppercase tracking-widest">Lotes Devolvidos</h3>
                        </div>
                        <div className="grid gap-4">
                            {lotesDevolvidos.map((lote: any) => (
                                <div key={lote.id} className="bg-white rounded-lg p-4 border border-rose-100 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <div className="text-sm font-semibold text-gray-900 border-l-2 border-rose-500 pl-2">
                                            {lote.empresa?.nome || "Empresa"} — Competência: {lote.competencia}
                                        </div>
                                        <div className="text-xs text-gray-500 pl-2.5">
                                            {lote.quantidade_registros} registros • Valor Total: {formatCurrency(lote.valor_total)}
                                        </div>
                                        <div className="text-xs text-rose-600 font-medium pl-2.5">
                                            Motivo: {lote.observacoes || "Não informado"}
                                        </div>
                                        <div className="text-xs text-gray-400 pl-2.5">
                                            Devolvido em: {new Date(lote.updated_at).toLocaleString('pt-BR')}
                                        </div>
                                    </div>
                                    <Button
                                        variant="outline"
                                        className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                        disabled={reabrirLoteMutation.isPending}
                                        onClick={() => {
                                            if (confirm("Deseja realmente reabrir este período? Os registros voltarão para a fila operacional.")) {
                                                reabrirLoteMutation.mutate(lote.id);
                                            }
                                        }}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Reabrir Período
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white border border-[#DEDEDE] rounded-[12px] overflow-hidden shadow-sm min-h-[500px]">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="p-4 border-b border-[#EBEBEB] bg-[#EBEBEB] flex flex-wrap items-center justify-between gap-4">
                            <div className="flex flex-wrap items-center gap-4">
                                <h3 className="font-manrope font-bold text-[11px] leading-tight text-[#4D4D4D] uppercase tracking-wider flex items-center gap-2">
                                    <div className="flex items-center justify-center bg-white/70 p-1.5 rounded-md shrink-0">
                                        <History className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="max-w-[130px]">Listagem de Apuração Tio Digital</span>
                                </h3>
                                <TabsList className="bg-white/60">
                                    <TabsTrigger value="pendentes" className="text-xs uppercase font-bold tracking-wider data-[state=active]:bg-white">
                                        Pendentes
                                    </TabsTrigger>
                                    <TabsTrigger value="historico" className="text-xs uppercase font-bold tracking-wider data-[state=active]:bg-white">
                                        Histórico (Fechados)
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold uppercase tracking-wider text-xs"
                                size="sm"
                                disabled={isLoading || kpis.pendentesEnvio === 0 || fecharPeriodoMutation.isPending}
                                onClick={() => {
                                    if (confirm(`Confirmar o fechamento de ${kpis.pendentesEnvio} lançamentos em aberto neste período? Eles serão enviados para Validação do RH.`)) {
                                        fecharPeriodoMutation.mutate();
                                    }
                                }}
                            >
                                {fecharPeriodoMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Fechar Período Intermitente ({kpis.pendentesEnvio} abertos)
                            </Button>
                        </div>
                        <div className="p-0">
                            {isLoading ? (
                                <div className="p-20 flex flex-col items-center justify-center text-[#737373] space-y-4">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm font-medium font-inter">Carregando dados dos intermitentes...</p>
                                </div>
                            ) : isError ? (
                                <div className="p-20 flex flex-col items-center justify-center text-rose-500 space-y-4 bg-rose-50/50">
                                    <AlertTriangle className="h-10 w-10 text-rose-500 mb-2" />
                                    <p className="text-base font-semibold font-inter text-rose-600">Falha ao carregar registros</p>
                                    <p className="text-sm text-rose-500/80 text-center max-w-md">Não foi possível buscar a listagem do Tio Digital. Tente recarregar a página ou contate o suporte.</p>
                                </div>
                            ) : (
                                <IntermitentesTableBlock data={filteredData} />
                            )}
                        </div>
                    </Tabs>
                </div>
            </section>

            {/* Modal de Sucesso */}
            <Dialog open={!!loteFechado} onOpenChange={(open) => !open && setLoteFechado(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-600">
                            <CheckCircle2 className="h-5 w-5" />
                            Período fechado com sucesso
                        </DialogTitle>
                        <DialogDescription>
                            Os registros foram agrupados no lote abaixo e encaminhados para a Validação RH.
                        </DialogDescription>
                    </DialogHeader>
                    {loteFechado && (
                        <div className="bg-muted/50 p-4 rounded-lg space-y-3 text-sm">
                            <div className="flex justify-between border-b border-border/50 pb-2">
                                <span className="text-muted-foreground">Lote:</span>
                                <span className="font-semibold font-mono text-primary">INT-{loteFechado.competencia}-{loteFechado.id?.substring(0, 4).toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between border-b border-border/50 pb-2">
                                <span className="text-muted-foreground">Registros:</span>
                                <span className="font-semibold">{loteFechado.quantidade_registros}</span>
                            </div>
                            <div className="flex justify-between border-b border-border/50 pb-2">
                                <span className="text-muted-foreground">Valor Total:</span>
                                <span className="font-semibold text-emerald-600">{formatCurrency(loteFechado.valor_total)}</span>
                            </div>
                            <div className="flex justify-between border-b border-border/50 pb-2">
                                <span className="text-muted-foreground">Status Atual:</span>
                                <span className="font-semibold text-amber-600">Aguardando validação RH</span>
                            </div>
                            <div className="flex justify-between border-b border-border/50 pb-2">
                                <span className="text-muted-foreground">Data do Fechamento:</span>
                                <span className="font-semibold">
                                    {loteFechado.created_at ? new Date(loteFechado.created_at).toLocaleString("pt-BR") : new Date().toLocaleString("pt-BR")}
                                </span>
                            </div>
                            <div className="flex justify-between pb-1">
                                <span className="text-muted-foreground">Responsável:</span>
                                <span className="font-semibold max-w-[150px] truncate" title={(user as any)?.nome || user?.email || "Usuário"}>
                                    {(user as any)?.nome || user?.email || "Usuário"}
                                </span>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setLoteFechado(null)} className="w-full">
                            Entendi
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default IntermitentesRecebidos;
