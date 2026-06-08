import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    AlertTriangle,
    BarChart3,
    Building2,
    Calendar as CalendarIcon,
    FileUp,
    History,
    Loader2,
    LucideIcon,
    Plus,
    RefreshCw,
    Truck,
    Wallet,
    UtensilsCrossed,
    ShoppingCart,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { CustosExtrasTableBlock } from "@/components/operacoes/CustosExtrasTableBlock";
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
    CustoExtraOperacionalService,
    EmpresaService,
} from "@/services/base.service";

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

const CustosExtrasRecebidos = () => {
    const navigate = useNavigate();
    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "MM"));
    const [filterYear, setFilterYear] = useState<string>(format(new Date(), "yyyy"));

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas-all"], queryFn: () => EmpresaService.getAll() });

    const { data: custosExtras = [], isLoading: isLoadingCustos } = useQuery({
        queryKey: ["custos-extras", filterEmpresaId, filterMonth, filterYear],
        queryFn: () => CustoExtraOperacionalService.getByCompetencia(`${filterYear}-${filterMonth}`, filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const kpis = useMemo(() => {
        const total = custosExtras.reduce((acc, item) => acc + Number(item.total ?? 0), 0);
        const operacional = custosExtras.filter((i: any) => i.categoria_custo === 'OPERACIONAL').reduce((acc, item) => acc + Number(item.total ?? 0), 0);
        const administrativo = custosExtras.filter((i: any) => i.categoria_custo === 'ADMINISTRATIVO').reduce((acc, item) => acc + Number(item.total ?? 0), 0);
        const merenda = custosExtras.filter((i: any) => i.categoria_custo === 'MERENDA').reduce((acc, item) => acc + Number(item.total ?? 0), 0);
        return { total, operacional, administrativo, merenda, count: custosExtras.length };
    }, [custosExtras]);

    return (
        <AppShell
            title="Custos Extras Recebidos"
            subtitle="Gestão e análise de despesas operacionais e administrativas"
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
                                onClick={() => navigate("/producao/custos-extras")}
                            >
                                <Plus className="h-4 w-4 mr-2 text-white" />
                                Novo Lançamento
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                    <TopKpiCard label="Total Competência" value={formatCurrency(kpis.total)} icon={Wallet} iconColor="bg-blue-50 text-blue-600" size="small" />
                    <TopKpiCard label="Custo Médio p/ Item" value={formatCurrency(kpis.count > 0 ? kpis.total / kpis.count : 0)} icon={BarChart3} iconColor="bg-amber-50 text-amber-600" size="small" />
                    <TopKpiCard label="Operacional" value={formatCurrency(kpis.operacional)} icon={Truck} iconColor="bg-emerald-50 text-emerald-600" size="small" />
                    <TopKpiCard label="Administrativo" value={formatCurrency(kpis.administrativo)} icon={Building2} iconColor="bg-purple-50 text-purple-600" size="small" />
                    <TopKpiCard label="Merenda" value={formatCurrency(kpis.merenda)} icon={UtensilsCrossed} iconColor="bg-amber-50 text-amber-600" size="small" />
                </div>

                <div className="bg-white border border-[#DEDEDE] rounded-[12px] overflow-hidden shadow-sm min-h-[500px]">
                    <div className="p-4 border-b border-[#EBEBEB] bg-[#EBEBEB] flex items-center justify-between">
                        <h3 className="font-manrope font-bold text-sm text-[#4D4D4D] uppercase tracking-widest flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" />
                            Listagem de Custos Extras
                        </h3>
                    </div>
                    <div className="p-0">
                        {isLoadingCustos ? (
                            <div className="p-20 flex flex-col items-center justify-center text-[#737373] space-y-4">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm font-medium font-inter">Carregando custos...</p>
                            </div>
                        ) : (
                            <CustosExtrasTableBlock data={custosExtras} />
                        )}
                    </div>
                </div>
            </section>
        </AppShell>
    );
};

export default CustosExtrasRecebidos;
