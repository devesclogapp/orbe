import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
    Building2,
    Calendar as CalendarIcon,
    History,
    Loader2,
    LucideIcon,
    Package,
    RefreshCw,
    Wallet,
    BarChart3,
    AlertTriangle,
    Plus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
    EmpresaService,
    ServicosExtrasOperacionaisService,
} from "@/services/base.service";
import { ServicosExtrasTableBlock } from "@/components/operacoes/ServicosExtrasTableBlock";
import { NovoServicoExtraDialog } from "@/components/operacoes/NovoServicoExtraDialog";

// ─── Constants ────────────────────────────────────────────────────────────────

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const MONTH_FILTER_OPTIONS = [
    { value: "all", label: "Todos" },
    ...Array.from({ length: 12 }, (_, i) => ({
        value: String(i + 1).padStart(2, "0"),
        label: format(new Date(2026, i, 1), "MMMM", { locale: ptBR }).replace(/^\w/, (c) => c.toUpperCase()),
    })),
];

const YEAR_OPTIONS = Array.from(new Set(Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i)))).sort((a, b) => Number(b) - Number(a));

type TopKpiCardProps = {
    label: string;
    value: string;
    helper?: string;
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

const TopKpiCard = ({ label, value, helper, size = "large", variant = "default", icon: Icon, iconColor = "bg-primary-soft text-primary" }: TopKpiCardProps) => (
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
                        "font-medium uppercase tracking-widest",
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
            {size !== "xs" && helper && (
                <div className={cn(
                    "truncate text-[13px] leading-snug font-inter",
                    variant === "primary" ? "text-white/70" : "text-[#4D4D4D]"
                )}>
                    {helper}
                </div>
            )}
        </div>
    </div>
);

const ServicosExtrasRecebidos = () => {
    const navigate = useNavigate();
    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "MM"));
    const [filterYear, setFilterYear] = useState<string>(format(new Date(), "yyyy"));
    const [isNovoServicoModalOpen, setIsNovoServicoModalOpen] = useState(false);
    const [serviceToEdit, setServiceToEdit] = useState<any>(null);

    useEffect(() => {
        const handleOpenEdit = (e: any) => {
            setServiceToEdit(e.detail);
            setIsNovoServicoModalOpen(true);
        };
        window.addEventListener("open-edit-servico-extra", handleOpenEdit);
        return () => window.removeEventListener("open-edit-servico-extra", handleOpenEdit);
    }, []);

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas_all"], queryFn: () => EmpresaService.getAll() });

    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ["servicos_extras_historico", filterEmpresaId, filterMonth, filterYear],
        queryFn: () => ServicosExtrasOperacionaisService.getWithEmpresas(filterEmpresaId === "all" ? undefined : filterEmpresaId, `${filterYear}-${filterMonth}`).catch(() => []),
    });

    const kpis = useMemo(() => {
        const total = historico.reduce((acc, item: any) => acc + Number(item.total ?? 0), 0);
        const count = historico.length;
        return { total, count };
    }, [historico]);

    return (
        <AppShell
            title="Serviços Extras Recebidos"
            subtitle="Gestão e análise de serviços extraordinários lançados"
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
                        <div className="flex items-center self-end gap-2 pb-0.5 ml-auto">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-9 w-9 text-[#A3A3A3] hover:text-primary transition-colors" onClick={() => { setFilterMonth(format(new Date(), "MM")); setFilterYear(format(new Date(), "yyyy")); }}>
                                        <RefreshCw className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Resetar para hoje</TooltipContent>
                            </Tooltip>

                            <Button
                                className="bg-primary hover:bg-[#E54300] text-white font-manrope font-semibold h-9 px-4 rounded-[6px]"
                                onClick={() => setIsNovoServicoModalOpen(true)}
                            >
                                <Plus className="h-4 w-4 mr-2 text-white" />
                                Novo Lançamento
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <TopKpiCard label="Faturamento Total" value={formatCurrency(kpis.total)} icon={Wallet} iconColor="bg-purple-50 text-purple-600" helper="Total na competência selecionada" />
                    <TopKpiCard label="Total de Serviços" value={String(kpis.count)} icon={Package} iconColor="bg-blue-50 text-blue-600" helper="Quantidade de lançamentos" />
                    <TopKpiCard label="Média por Serviço" value={formatCurrency(kpis.count > 0 ? kpis.total / kpis.count : 0)} icon={BarChart3} iconColor="bg-amber-50 text-amber-600" helper="Valor médio dos serviços" />
                </div>

                <div className="bg-white border border-[#DEDEDE] rounded-[12px] overflow-hidden shadow-sm min-h-[500px]">
                    <div className="p-4 border-b border-[#EBEBEB] bg-[#EBEBEB] flex items-center justify-between">
                        <h3 className="font-manrope font-bold text-sm text-[#4D4D4D] uppercase tracking-widest flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" />
                            Listagem de Serviços Extras
                        </h3>
                    </div>
                    <div className="p-0">
                        {isLoadingHistorico ? (
                            <div className="p-20 flex flex-col items-center justify-center text-[#737373] space-y-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm font-medium font-inter">Carregando serviços...</p>
                            </div>
                        ) : (
                            <ServicosExtrasTableBlock data={historico} />
                        )}
                    </div>
                </div>
            </section>

            <NovoServicoExtraDialog
                open={isNovoServicoModalOpen}
                onOpenChange={(open) => {
                    setIsNovoServicoModalOpen(open);
                    if (!open) setServiceToEdit(null);
                }}
                initialData={serviceToEdit}
            />
        </AppShell >
    );
};

export default ServicosExtrasRecebidos;
