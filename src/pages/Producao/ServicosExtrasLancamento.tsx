import { useState, useMemo, useEffect } from "react";
import { format, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    BarChart3,
    Building2,
    Calendar as CalendarIcon,
    CheckCircle2,
    DollarSign,
    FileText,
    History,
    Loader2,
    LucideIcon,
    Package,
    Plus,
    RefreshCw,
    Save,
    Settings2,
    Truck,
    Wallet,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
    EmpresaService,
    FormaPagamentoOperacionalService,
    OperacaoProducaoService,
    TipoServicoOperacionalService,
    TransportadoraClienteService,
    ServicosExtrasOperacionaisService,
} from "@/services/base.service";
import { useOperationalPipeline, buildServicosExtrasPipeline } from "@/contexts/OperationalPipelineContext";
import { ServicosExtrasTableBlock } from "@/components/operacoes/ServicosExtrasTableBlock";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormaCobranca = "CAIXA_IMEDIATO" | "DEPOSITO_IMEDIATO";

interface ServicosExtrasFormState {
    data: string;
    empresa_id: string;
    tipo_servico_id: string;
    descricao: string;
    quantidade: string;
    valor_unitario: string;
    forma_cobranca: FormaCobranca | "";
    forma_pagamento_id: string;
    nf_numero: string;
    transportadora_id: string;
    responsavel_nome: string;
    observacao: string;
}

type TopKpiCardProps = {
    label: string;
    value: string;
    helper?: string;
    size?: "large" | "small" | "xs";
    variant?: "default" | "primary" | "warning" | "success" | "muted" | "info";
    icon?: LucideIcon;
    iconColor?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FORMAS_COBRANCA: Array<{ value: FormaCobranca; label: string; description: string }> = [
    {
        value: "CAIXA_IMEDIATO",
        label: "Recebimento Imediato",
        description: "Pago no ato — entra no caixa imediatamente.",
    },
    {
        value: "DEPOSITO_IMEDIATO",
        label: "Depósito / PIX",
        description: "Recebimento via depósito ou PIX no mesmo dia.",
    },
];

const INITIAL_FORM: ServicosExtrasFormState = {
    data: format(new Date(), "yyyy-MM-dd"),
    empresa_id: "",
    tipo_servico_id: "",
    descricao: "",
    quantidade: "1",
    valor_unitario: "",
    forma_cobranca: "DEPOSITO_IMEDIATO",
    forma_pagamento_id: "",
    nf_numero: "",
    transportadora_id: "",
    responsavel_nome: "",
    observacao: "",
};

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

const topKpiCardClasses: Record<NonNullable<TopKpiCardProps["size"]>, string> = { large: "p-5 min-h-[148px]", small: "p-4 min-h-[108px]", xs: "p-3 min-h-[80px]" };

const TopKpiCard = ({ label, value, helper, size = "large", variant = "default", icon: Icon, iconColor = "bg-primary-soft text-primary" }: TopKpiCardProps) => (
    <div className={cn("group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5", variant === "primary" ? "esc-card bg-primary text-primary-foreground border-primary shadow-lg" : variant === "muted" ? "bg-muted/30 border border-border rounded-xl" : "esc-card shadow-sm hover:shadow-md", topKpiCardClasses[size])}>
        <div className="flex h-full flex-col justify-between gap-4">
            <div className="flex items-start justify-between gap-3">
                <div className={cn("space-y-1.5", size === "xs" && "space-y-0.5")}>
                    <div className={cn("font-display font-medium", size === "xs" ? "text-xs" : "text-sm", variant === "primary" ? "text-primary-foreground/90" : "text-muted-foreground")}>{label}</div>
                    <div className={cn("font-display font-bold leading-none", size === "large" ? "text-[28px]" : size === "small" ? "text-2xl" : "text-xl", variant === "primary" ? "text-primary-foreground" : "text-foreground")}>{value}</div>
                </div>
                {Icon && <div className={cn("shrink-0 rounded-md flex items-center justify-center", iconColor, size === "xs" ? "h-8 w-8" : "h-10 w-10")}><Icon className={size === "xs" ? "h-4 w-4" : "h-5 w-5"} /></div>}
            </div>
            {size !== "xs" && helper && <div className={cn("truncate text-[13px] leading-snug", variant === "primary" ? "text-primary-foreground/80" : "text-muted-foreground")}>{helper}</div>}
        </div>
    </div>
);

const ServicosExtrasLancamento = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { openPipeline } = useOperationalPipeline();
    const today = format(new Date(), "yyyy-MM-dd");

    const [activeTab, setActiveTab] = useState("historico");
    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "MM"));
    const [filterYear, setFilterYear] = useState<string>(format(new Date(), "yyyy"));

    const [form, setForm] = useState<ServicosExtrasFormState>({ ...INITIAL_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof ServicosExtrasFormState, string>>>({});

    const setField = <K extends keyof ServicosExtrasFormState>(key: K, value: ServicosExtrasFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas_all"], queryFn: () => EmpresaService.getAll() });
    const { data: tiposServico = [] } = useQuery({ queryKey: ["tipos_servico_operacional"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
    const { data: transportadoras = [] } = useQuery({ queryKey: ["transportadoras_servicos", form.empresa_id], queryFn: () => TransportadoraClienteService.getByEmpresa(form.empresa_id), enabled: !!form.empresa_id });
    const { data: formasPagamento = [] } = useQuery({ queryKey: ["formas_pagamento_operacional"], queryFn: () => FormaPagamentoOperacionalService.getAllActive() });

    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ["servicos_extras_historico", filterEmpresaId, filterMonth, filterYear],
        queryFn: () => ServicosExtrasOperacionaisService.getWithEmpresas(filterEmpresaId === "all" ? undefined : filterEmpresaId, `${filterYear}-${filterMonth}`).catch(() => []),
    });

    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => { if (!user?.id) return null; const { data } = await OperacaoProducaoService.getProfile(user.id); return data; },
        enabled: !!user?.id,
    });

    useEffect(() => {
        if (form.responsavel_nome) return;
        const nome = perfil?.nome || perfil?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || "";
        if (nome) setForm(prev => ({ ...prev, responsavel_nome: nome }));
    }, [perfil, user, form.responsavel_nome]);

    // ─── Calculations ─────────────────────────────────────────────────────────

    const parseNumeric = (value: string): number => {
        const normalized = value.replace(/\./g, "").replace(",", ".");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const quantidade = parseNumeric(form.quantidade);
    const valorUnitario = parseNumeric(form.valor_unitario);
    const valorTotal = quantidade * valorUnitario;

    const kpis = useMemo(() => {
        const total = historico.reduce((acc, item: any) => acc + Number(item.total ?? 0), 0);
        const count = historico.length;
        return { total, count };
    }, [historico]);

    const tipoServicoSelecionado = useMemo(() => (tiposServico as any[]).find((t: any) => t.id === form.tipo_servico_id), [tiposServico, form.tipo_servico_id]);

    // ─── Validation ───────────────────────────────────────────────────────────

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof ServicosExtrasFormState, string>> = {};
        if (!form.empresa_id) newErrors.empresa_id = "Selecione a empresa.";
        if (!form.data) newErrors.data = "Informe a data.";
        if (!form.tipo_servico_id) newErrors.tipo_servico_id = "Selecione o tipo de serviço.";
        if (!form.descricao.trim()) newErrors.descricao = "Informe a descrição.";
        if (quantidade <= 0) newErrors.quantidade = "Quantidade inválida.";
        if (valorUnitario <= 0) newErrors.valor_unitario = "Informe o valor.";
        if (!form.forma_cobranca) newErrors.forma_cobranca = "Selecione a forma de cobrança.";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ─── Mutation ────────────────────────────────────────────────────────────

    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!validate()) throw new Error("Corrija os campos obrigatórios.");
            const operacao = {
                empresa_id: form.empresa_id,
                data_operacao: form.data,
                tipo_servico_id: form.tipo_servico_id,
                descricao_servico: form.descricao.trim(),
                quantidade: quantidade,
                valor_unitario_snapshot: valorUnitario,
                tipo_calculo_snapshot: "volume",
                valor_descarga: valorTotal,
                valor_total: valorTotal,
                transportadora_id: form.transportadora_id || null,
                forma_pagamento_id: form.forma_pagamento_id || null,
                nf_numero: form.nf_numero.trim() || null,
                observacao: form.observacao.trim() || null,
                status: "pendente",
                origem_dado: "manual",
                responsavel_id: user?.id ?? null,
                modalidade_financeira: form.forma_cobranca,
                avaliacao_json: { categoria_servico: "SERVICO_EXTRA", criado_por: user?.email },
                responsavel_nome: (form.responsavel_nome.trim() || perfil?.nome || user?.email || "N/A").trim(),
            };
            return OperacaoProducaoService.createWithColaboradores(operacao, []);
        },
        onSuccess: () => {
            toast.success("Serviço extra registrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["servicos_extras_historico"] });
            setForm(prev => ({ ...INITIAL_FORM, data: prev.data, empresa_id: prev.empresa_id, responsavel_nome: prev.responsavel_nome }));
            setErrors({});
            setActiveTab("historico");
        },
        onError: (err: any) => toast.error("Erro ao salvar serviço extra.", { description: err.message }),
    });

    return (
        <AppShell title="Serviços Extras" subtitle="Gestão e lançamento de serviços operacionais adicionais">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <TabsList className="w-fit p-1 bg-muted/60 border border-border">
                        <TabsTrigger value="historico" className="text-xs font-bold uppercase tracking-wider">
                            <History className="h-3.5 w-3.5 mr-2" /> Histórico
                        </TabsTrigger>
                        <TabsTrigger value="lancamento" className="text-xs font-bold uppercase tracking-wider">
                            <Plus className="h-3.5 w-3.5 mr-2" /> Novo Lançamento
                        </TabsTrigger>
                    </TabsList>
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => navigate("/producao")}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                </div>

                <TabsContent value="historico" className="m-0 space-y-6">
                    <div className="flex flex-col lg:flex-row gap-4">
                        <section className="flex-1 space-y-6">
                            <div className="esc-card p-6">
                                <div className="flex flex-wrap items-center gap-6">
                                    <div className="flex-1 min-w-[240px] space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Empresa</Label>
                                        <Select value={filterEmpresaId} onValueChange={setFilterEmpresaId}>
                                            <SelectTrigger className="bg-muted/30 border-muted">
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
                                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Mês</Label>
                                            <Select value={filterMonth} onValueChange={setFilterMonth}>
                                                <SelectTrigger className="w-[140px] bg-muted/30 border-muted">
                                                    <CalendarIcon className="h-4 w-4 mr-2 text-primary" />
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>{MONTH_FILTER_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Ano</Label>
                                            <Select value={filterYear} onValueChange={setFilterYear}>
                                                <SelectTrigger className="w-[110px] bg-muted/30 border-muted"><SelectValue /></SelectTrigger>
                                                <SelectContent>{YEAR_OPTIONS.map((y) => (<SelectItem key={y} value={y}>{y}</SelectItem>))}</SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <div className="self-end pb-0.5">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-primary transition-colors" onClick={() => { setFilterMonth(format(new Date(), "MM")); setFilterYear(format(new Date(), "yyyy")); }}>
                                                    <RefreshCw className="h-4 w-4" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Resetar para hoje</TooltipContent>
                                        </Tooltip>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <TopKpiCard label="Faturamento Total (Competência)" value={formatCurrency(kpis.total)} icon={Wallet} iconColor="bg-purple-50 text-purple-600" />
                                <TopKpiCard label="Total de Serviços" value={String(kpis.count)} icon={Package} iconColor="bg-blue-50 text-blue-600" />
                            </div>

                            <div className="esc-card min-h-[500px] overflow-hidden">
                                <div className="p-4 border-b bg-muted/10 flex items-center justify-between">
                                    <h3 className="font-display font-bold text-base flex items-center gap-2"><History className="h-4 w-4 text-primary" />Listagem de Serviços Extras</h3>
                                </div>
                                {isLoadingHistorico ? (
                                    <div className="p-20 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="text-sm font-medium">Carregando serviços...</p>
                                    </div>
                                ) : (
                                    <ServicosExtrasTableBlock data={historico} />
                                )}
                            </div>
                        </section>

                        <aside className="w-full lg:w-[340px] space-y-6">
                            <section className="esc-card p-5 border-l-4 border-l-primary bg-primary-soft/10">
                                <div className="flex items-center gap-2 text-primary mb-4"><BarChart3 className="h-5 w-5" /><h4 className="font-display font-bold text-sm uppercase tracking-wider">Análise Operacional</h4></div>
                                <div className="space-y-4">
                                    <div className="p-3 rounded-lg bg-card border border-border/60">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Média por Serviço</p>
                                        <p className="text-lg font-display font-bold">{formatCurrency(kpis.count > 0 ? kpis.total / kpis.count : 0)}</p>
                                    </div>
                                </div>
                            </section>
                            <section className="esc-card p-5">
                                <div className="flex items-center gap-2 text-amber-600 mb-4"><AlertTriangle className="h-5 w-5" /><h4 className="font-display font-bold text-sm uppercase tracking-wider">Observações</h4></div>
                                <p className="text-xs text-muted-foreground leading-relaxed italic">"Serviços extras representam faturamento imediato e devem ser validados pelo gestor antes do fechamento financeiro."</p>
                            </section>
                        </aside>
                    </div>
                </TabsContent>

                <TabsContent value="lancamento" className="m-0">
                    <div className="max-w-3xl mx-auto space-y-6 pb-28 pt-4">
                        <section className="esc-card p-6 space-y-6">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><Building2 className="h-4 w-4" />Identificação do Serviço</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Empresa <span className="text-destructive">*</span></Label>
                                    <Select value={form.empresa_id} onValueChange={(v) => setField("empresa_id", v)}>
                                        <SelectTrigger className={cn(errors.empresa_id && "border-destructive")}><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                        <SelectContent>{(empresas as any[]).map((emp: any) => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}</SelectContent>
                                    </Select>
                                    {errors.empresa_id && <p className="text-xs text-destructive">{errors.empresa_id}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Data <span className="text-destructive">*</span></Label>
                                    <Input type="date" value={form.data} onChange={(e) => setField("data", e.target.value)} className={cn(errors.data && "border-destructive")} />
                                    {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Tipo de Serviço <span className="text-destructive">*</span></Label>
                                    <Select value={form.tipo_servico_id} onValueChange={(v) => setField("tipo_servico_id", v)}>
                                        <SelectTrigger className={cn(errors.tipo_servico_id && "border-destructive")}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                                        <SelectContent>{(tiposServico as any[]).map((s: any) => (<SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>))}</SelectContent>
                                    </Select>
                                    {errors.tipo_servico_id && <p className="text-xs text-destructive">{errors.tipo_servico_id}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Transportadora <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                                    <Select value={form.transportadora_id} onValueChange={(v) => setField("transportadora_id", v)} disabled={!form.empresa_id}>
                                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                        <SelectContent><SelectItem value=" ">Nenhuma</SelectItem>{(transportadoras as any[]).map((t: any) => (<SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>

                        <section className="esc-card p-6 space-y-6">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><FileText className="h-4 w-4" />Detalhes e Valores</h3>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Descrição <span className="text-destructive">*</span></Label>
                                <Textarea placeholder="Descreva o serviço realizado..." value={form.descricao} onChange={(e) => setField("descricao", e.target.value)} className={cn(errors.descricao && "border-destructive")} rows={3} />
                                {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Quantidade <span className="text-destructive">*</span></Label>
                                    <Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setField("quantidade", e.target.value)} className={cn(errors.quantidade && "border-destructive")} />
                                    {errors.quantidade && <p className="text-xs text-destructive">{errors.quantidade}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Valor Unitário <span className="text-destructive">*</span></Label>
                                    <div className="relative"><span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span><Input type="number" step="0.01" className={cn("pl-9", errors.valor_unitario && "border-destructive")} value={form.valor_unitario} onChange={(e) => setField("valor_unitario", e.target.value)} /></div>
                                    {errors.valor_unitario && <p className="text-xs text-destructive">{errors.valor_unitario}</p>}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Total</Label>
                                    <div className="h-10 flex items-center px-3 rounded-md border-2 border-primary/20 bg-primary/5 text-primary font-mono font-bold">{formatCurrency(valorTotal)}</div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">NF / Referência</Label>
                                    <Input value={form.nf_numero} onChange={(e) => setField("nf_numero", e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Responsável</Label>
                                    <Input value={form.responsavel_nome} onChange={(e) => setField("responsavel_nome", e.target.value)} />
                                </div>
                            </div>
                        </section>

                        <section className="esc-card p-6 space-y-6">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Cobrança</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {FORMAS_COBRANCA.map(fc => (
                                    <button key={fc.value} type="button" onClick={() => setField("forma_cobranca", fc.value)} className={cn("p-4 rounded-xl border-2 text-left transition-all", form.forma_cobranca === fc.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30")}><p className="font-bold text-sm text-foreground">{fc.label}</p><p className="text-xs text-muted-foreground mt-0.5">{fc.description}</p></button>
                                ))}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase">Forma de Pagamento</Label>
                                <Select value={form.forma_pagamento_id} onValueChange={(v) => setField("forma_pagamento_id", v)}>
                                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                                    <SelectContent><SelectItem value=" ">Não especificada</SelectItem>{(formasPagamento as any[]).map((fp: any) => (<SelectItem key={fp.id} value={fp.id}>{fp.nome}</SelectItem>))}</SelectContent>
                                </Select>
                            </div>
                        </section>

                        <div className="sticky bottom-6 z-20">
                            <div className="flex justify-end items-center bg-card/95 backdrop-blur p-4 rounded-2xl border border-border shadow-2xl">
                                <div className="flex items-center gap-4">
                                    <Button size="lg" className="min-w-[200px] font-display font-bold shadow-lg shadow-primary/20" onClick={() => salvarMutation.mutate()} disabled={salvarMutation.isPending}><Save className="h-4 w-4 mr-2" />{salvarMutation.isPending ? "Salvando..." : "Salvar Serviço Extra"}</Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </AppShell>
    );
};
export default ServicosExtrasLancamento;
