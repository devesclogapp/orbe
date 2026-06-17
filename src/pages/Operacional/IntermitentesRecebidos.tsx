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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { cn, decimalParaHora } from "@/lib/utils";
import { EmpresaService } from "@/services/base.service";
import { supabase } from "@/lib/supabase";

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

    // Filtragem no cliente por texto (busca)
    const filteredData = useMemo(() => {
        return intermitentes.filter(item => {
            if (!filterText) return true;
            const search = filterText.toLowerCase();
            const colabName = (item.colaboradores?.nome || item.nome_colaborador || "").toLowerCase();
            const empName = (item.empresas?.nome || item.departamento || "").toLowerCase();
            const cargo = (item.cargo || "").toLowerCase();
            const provoc = (item.convocacao || "").toLowerCase();

            return colabName.includes(search) || empName.includes(search) || cargo.includes(search) || provoc.includes(search);
        });
    }, [intermitentes, filterText]);

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
        };
    }, [filteredData]);

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

                <div className="bg-white border border-[#DEDEDE] rounded-[12px] overflow-hidden shadow-sm min-h-[500px]">
                    <div className="p-4 border-b border-[#EBEBEB] bg-[#EBEBEB] flex items-center justify-between">
                        <h3 className="font-manrope font-bold text-sm text-[#4D4D4D] uppercase tracking-widest flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" />
                            Listagem de Apuração Tio Digital
                        </h3>
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
                </div>
            </section>
        </AppShell>
    );
};

export default IntermitentesRecebidos;
