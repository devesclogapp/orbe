import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    AlertCircle,
    ArrowLeft,
    Building2,
    CheckCircle2,
    DollarSign,
    FileText,
    History,
    Package,
    Plus,
    Receipt,
    Save,
    Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { OperationalShell } from "@/components/layout/OperationalShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
    CustoExtraOperacionalService,
    EmpresaService,
    FornecedorService,
} from "@/services/base.service";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoriaCusto =
    | "OPERACIONAL"
    | "ADMINISTRATIVO"
    | "MERENDA"
    | "FORNECEDOR"
    | "MANUTENCAO"
    | "TRANSPORTE"
    | "OUTROS";

type FormaPagamento =
    | "PIX"
    | "DEPOSITO"
    | "TRANSFERENCIA"
    | "BOLETO"
    | "DINHEIRO"
    | "CARTAO";

type StatusPagamento = "PENDENTE" | "RECEBIDO" | "ATRASADO";

interface CustoExtrasFormState {
    data: string;
    empresa_id: string;
    categoria_custo: CategoriaCusto | "";
    fornecedor_id: string;
    descricao: string;
    quantidade: string;
    valor_unitario: string;
    forma_pagamento: FormaPagamento | "";
    data_vencimento: string;
    comprovante_obs: string;
    observacao: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIAS: Array<{ value: CategoriaCusto; label: string; icon: string }> = [
    { value: "OPERACIONAL", label: "Operacional", icon: "⚙️" },
    { value: "ADMINISTRATIVO", label: "Administrativo", icon: "📋" },
    { value: "MERENDA", label: "Merenda / Refeição", icon: "🍽️" },
    { value: "FORNECEDOR", label: "Fornecedor", icon: "🏭" },
    { value: "MANUTENCAO", label: "Manutenção", icon: "🔧" },
    { value: "TRANSPORTE", label: "Transporte", icon: "🚛" },
    { value: "OUTROS", label: "Outros", icon: "📦" },
];

const FORMAS_PAGAMENTO: Array<{ value: FormaPagamento; label: string }> = [
    { value: "PIX", label: "PIX" },
    { value: "DEPOSITO", label: "Depósito Bancário" },
    { value: "TRANSFERENCIA", label: "Transferência" },
    { value: "BOLETO", label: "Boleto" },
    { value: "DINHEIRO", label: "Dinheiro" },
    { value: "CARTAO", label: "Cartão" },
];

const INITIAL_FORM: CustoExtrasFormState = {
    data: format(new Date(), "yyyy-MM-dd"),
    empresa_id: "",
    categoria_custo: "",
    fornecedor_id: "",
    descricao: "",
    quantidade: "1",
    valor_unitario: "",
    forma_pagamento: "",
    data_vencimento: "",
    comprovante_obs: "",
    observacao: "",
};

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

const parseNumeric = (value: string): number => {
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

// ─── Component ────────────────────────────────────────────────────────────────

const CustosExtrasLancamento = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState<CustoExtrasFormState>({ ...INITIAL_FORM });
    const [openHistorico, setOpenHistorico] = useState(false);
    const [errors, setErrors] = useState<Partial<Record<keyof CustoExtrasFormState, string>>>({});

    const setField = <K extends keyof CustoExtrasFormState>(key: K, value: CustoExtrasFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_all"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: fornecedores = [] } = useQuery({
        queryKey: ["fornecedores_custo", form.empresa_id],
        queryFn: () => FornecedorService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id,
    });

    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ["custos_extras_historico", form.empresa_id],
        queryFn: () => CustoExtraOperacionalService.getAll(form.empresa_id),
        enabled: !!form.empresa_id && openHistorico,
    });

    // ─── Calculations ─────────────────────────────────────────────────────────

    const quantidade = parseNumeric(form.quantidade);
    const valorUnitario = parseNumeric(form.valor_unitario);
    const valorTotal = quantidade * valorUnitario;

    const isDataRetroativa = form.data < today;
    const categoriaLabel = CATEGORIAS.find(c => c.value === form.categoria_custo)?.label ?? "";
    const categoriaIcon = CATEGORIAS.find(c => c.value === form.categoria_custo)?.icon ?? "📦";

    // ─── Validation ───────────────────────────────────────────────────────────

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof CustoExtrasFormState, string>> = {};

        if (!form.empresa_id) newErrors.empresa_id = "Selecione a empresa.";
        if (!form.data) newErrors.data = "Informe a data.";
        if (!form.categoria_custo) newErrors.categoria_custo = "Selecione a categoria do custo.";
        if (!form.descricao.trim()) newErrors.descricao = "Informe a descrição do custo.";
        if (quantidade <= 0) newErrors.quantidade = "Quantidade deve ser maior que zero.";
        if (valorUnitario <= 0) newErrors.valor_unitario = "Informe o valor unitário.";
        if (!form.forma_pagamento) newErrors.forma_pagamento = "Selecione a forma de pagamento.";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ─── Mutation ────────────────────────────────────────────────────────────

    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!validate()) throw new Error("Corrija os campos obrigatórios.");

            const payload = {
                data: form.data,
                empresa_id: form.empresa_id,
                categoria_custo: form.categoria_custo,
                fornecedor_id: form.fornecedor_id || null,
                descricao: form.descricao.trim(),
                quantidade: quantidade,
                valor_unitario: valorUnitario,
                total: valorTotal,
                forma_pagamento: form.forma_pagamento,
                data_vencimento: form.data_vencimento || null,
                observacao: [form.comprovante_obs, form.observacao].filter(Boolean).join(" | ") || null,
                tipo_lancamento: "custo_extra",
                status_pagamento: "PENDENTE" as StatusPagamento,
                origem_dado: "manual",
                responsavel_id: user?.id ?? null,
            };

            return CustoExtraOperacionalService.createMany([payload]);
        },
        onSuccess: () => {
            toast.success("Custo extra registrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["custos_extras_historico"] });
            // Reset form but keep empresa and data
            setForm(prev => ({
                ...INITIAL_FORM,
                data: prev.data,
                empresa_id: prev.empresa_id,
            }));
            setErrors({});
        },
        onError: (err: any) => {
            toast.error("Erro ao salvar custo extra.", { description: err.message });
        },
    });

    // ─── Rendering ───────────────────────────────────────────────────────────

    return (
        <OperationalShell title="Custos Extras" showBack={false} onBack={() => navigate("/producao")} hideFab={true}>
            <div className="max-w-3xl mx-auto space-y-6 pb-28">
                {/* Header with back navigation */}
                <div className="flex items-center gap-3 px-1">
                    <button
                        onClick={() => navigate("/producao")}
                        className="text-muted-foreground hover:text-foreground p-1 transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-orange-500" />
                            Lançamento de Custo Extra
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            Registre despesas e custos operacionais.
                        </p>
                    </div>
                </div>

                {/* Seção 1 — Identificação */}
                <section className="esc-card p-6 space-y-4">
                    <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Identificação
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Data */}
                        <div className="space-y-1.5">
                            <Label>
                                Data <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="date"
                                value={form.data}
                                onChange={e => setField("data", e.target.value)}
                                max={today}
                                className={cn(errors.data && "border-destructive focus-visible:ring-destructive")}
                            />
                            {isDataRetroativa && (
                                <p className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> Data retroativa — será registrada como pendente de validação.
                                </p>
                            )}
                            {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
                        </div>

                        {/* Empresa */}
                        <div className="space-y-1.5">
                            <Label>
                                Empresa <span className="text-destructive">*</span>
                            </Label>
                            <Select value={form.empresa_id} onValueChange={v => setField("empresa_id", v)}>
                                <SelectTrigger className={cn(errors.empresa_id && "border-destructive")}>
                                    <SelectValue placeholder="Selecione a empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(empresas as any[]).map((e: any) => (
                                        <SelectItem key={e.id} value={e.id}>
                                            {e.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.empresa_id && <p className="text-xs text-destructive">{errors.empresa_id}</p>}
                        </div>

                        {/* Categoria */}
                        <div className="space-y-1.5">
                            <Label>
                                Tipo de Custo <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={form.categoria_custo}
                                onValueChange={v => setField("categoria_custo", v as CategoriaCusto)}
                            >
                                <SelectTrigger className={cn(errors.categoria_custo && "border-destructive")}>
                                    <SelectValue placeholder="Selecione a categoria" />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIAS.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>
                                            {cat.icon} {cat.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.categoria_custo && <p className="text-xs text-destructive">{errors.categoria_custo}</p>}
                        </div>

                        {/* Fornecedor */}
                        <div className="space-y-1.5">
                            <Label>Fornecedor <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                            <Select
                                value={form.fornecedor_id}
                                onValueChange={v => setField("fornecedor_id", v)}
                                disabled={!form.empresa_id}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione o fornecedor" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">Nenhum</SelectItem>
                                    {(fornecedores as any[]).map((f: any) => (
                                        <SelectItem key={f.id} value={f.id}>
                                            {f.nome}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </section>

                {/* Seção 2 — Detalhes do Custo */}
                <section className="esc-card p-6 space-y-4">
                    <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Detalhes do Custo
                    </h3>

                    {/* Descrição */}
                    <div className="space-y-1.5">
                        <Label>
                            Descrição do Custo <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            placeholder="Descreva o custo ou despesa em detalhes..."
                            value={form.descricao}
                            onChange={e => setField("descricao", e.target.value)}
                            rows={3}
                            className={cn(errors.descricao && "border-destructive focus-visible:ring-destructive")}
                        />
                        {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
                    </div>

                    {/* Quantidade e Valor Unitário */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label>
                                Quantidade <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="number"
                                min="1"
                                step="1"
                                value={form.quantidade}
                                onChange={e => setField("quantidade", e.target.value)}
                                placeholder="1"
                                className={cn(errors.quantidade && "border-destructive")}
                            />
                            {errors.quantidade && <p className="text-xs text-destructive">{errors.quantidade}</p>}
                        </div>

                        <div className="space-y-1.5">
                            <Label>
                                Valor Unitário <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={form.valor_unitario}
                                onChange={e => setField("valor_unitario", e.target.value)}
                                placeholder="0,00"
                                className={cn(errors.valor_unitario && "border-destructive")}
                            />
                            {errors.valor_unitario && <p className="text-xs text-destructive">{errors.valor_unitario}</p>}
                        </div>

                        {/* Total calculado automaticamente */}
                        <div className="space-y-1.5">
                            <Label>Valor Total</Label>
                            <div
                                className={cn(
                                    "h-10 flex items-center px-3 rounded-md border text-sm font-mono font-bold",
                                    valorTotal > 0
                                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                                        : "bg-muted/50 border-border text-muted-foreground"
                                )}
                            >
                                {formatCurrency(valorTotal)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {quantidade > 0 && valorUnitario > 0
                                    ? `${quantidade} × ${formatCurrency(valorUnitario)}`
                                    : "Calculado automaticamente"}
                            </p>
                        </div>
                    </div>

                    {/* Comprovante / Referência */}
                    <div className="space-y-1.5">
                        <Label>Comprovante / Referência <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                        <Input
                            placeholder="Número da NF, recibo, protocolo..."
                            value={form.comprovante_obs}
                            onChange={e => setField("comprovante_obs", e.target.value)}
                        />
                    </div>
                </section>

                {/* Seção 3 — Financeiro */}
                <section className="esc-card p-6 space-y-4">
                    <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Informações Financeiras
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Forma de Pagamento */}
                        <div className="space-y-1.5">
                            <Label>
                                Forma de Pagamento <span className="text-destructive">*</span>
                            </Label>
                            <Select
                                value={form.forma_pagamento}
                                onValueChange={v => setField("forma_pagamento", v as FormaPagamento)}
                            >
                                <SelectTrigger className={cn(errors.forma_pagamento && "border-destructive")}>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    {FORMAS_PAGAMENTO.map(fp => (
                                        <SelectItem key={fp.value} value={fp.value}>
                                            {fp.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.forma_pagamento && <p className="text-xs text-destructive">{errors.forma_pagamento}</p>}
                        </div>

                        {/* Vencimento */}
                        <div className="space-y-1.5">
                            <Label>Data de Vencimento <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                            <Input
                                type="date"
                                value={form.data_vencimento}
                                onChange={e => setField("data_vencimento", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                {form.forma_pagamento === "BOLETO"
                                    ? "Recomendado para boleto."
                                    : "Se houver prazo de liquidação."}
                            </p>
                        </div>
                    </div>

                    {/* Observação geral */}
                    <div className="space-y-1.5">
                        <Label>Observação <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                        <Textarea
                            placeholder="Alguma informação adicional sobre este custo..."
                            value={form.observacao}
                            onChange={e => setField("observacao", e.target.value)}
                            rows={2}
                        />
                    </div>
                </section>

                {/* Preview do registro */}
                {form.empresa_id && form.categoria_custo && valorTotal > 0 && (
                    <section className="esc-card p-5 border-l-4 border-l-orange-500 bg-orange-50/30">
                        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                            Resumo do lançamento
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="text-center">
                                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Categoria</p>
                                <p className="text-sm font-bold text-foreground">{categoriaIcon} {categoriaLabel}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Quantidade</p>
                                <p className="text-sm font-bold text-foreground">{quantidade}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Vlr. Unit.</p>
                                <p className="text-sm font-mono font-bold text-foreground">{formatCurrency(valorUnitario)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Total</p>
                                <p className="text-base font-mono font-bold text-emerald-600">{formatCurrency(valorTotal)}</p>
                            </div>
                        </div>
                    </section>
                )}

                {/* Sticky Actions */}
                <div className="sticky bottom-4 z-20">
                    <div className="flex justify-between items-center bg-card/95 backdrop-blur p-4 rounded-xl border border-border shadow-lg">
                        <Button
                            variant="outline"
                            onClick={() => setOpenHistorico(true)}
                            disabled={!form.empresa_id}
                        >
                            <History className="h-4 w-4 md:mr-2" />
                            <span className="hidden md:inline">Histórico recente</span>
                        </Button>

                        <div className="flex items-center gap-3">
                            {Object.keys(errors).length > 0 && (
                                <span className="text-xs text-destructive hidden md:flex items-center gap-1 font-medium">
                                    <AlertCircle className="w-3 h-3" /> Corrija os campos obrigatórios
                                </span>
                            )}
                            <Button
                                size="lg"
                                className="min-w-[160px] font-display font-bold"
                                onClick={() => salvarMutation.mutate()}
                                disabled={salvarMutation.isPending}
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {salvarMutation.isPending ? "Salvando..." : "Salvar Custo"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Histórico Modal */}
            <Dialog open={openHistorico} onOpenChange={setOpenHistorico}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Custos Extras Recentes</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        {isLoadingHistorico ? (
                            <div className="text-center p-8 text-muted-foreground animate-pulse text-sm">
                                Carregando histórico...
                            </div>
                        ) : (historico as any[]).length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                                Nenhum custo extra registrado para esta empresa.
                            </div>
                        ) : (
                            <div className="divide-y divide-border border rounded-lg overflow-hidden">
                                {(historico as any[]).slice(0, 30).map((h: any) => (
                                    <div
                                        key={h.id}
                                        className="p-4 bg-card flex items-center justify-between hover:bg-muted/50 transition-colors"
                                    >
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{h.descricao}</p>
                                            <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                                <span>{h.data || "—"}</span>
                                                <span>•</span>
                                                <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                                    {h.categoria_custo}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-mono font-bold text-sm text-foreground">
                                                {formatCurrency(Number(h.total ?? 0))}
                                            </p>
                                            <span
                                                className={cn(
                                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                                    h.status_pagamento === "RECEBIDO"
                                                        ? "bg-emerald-100 text-emerald-700"
                                                        : h.status_pagamento === "ATRASADO"
                                                            ? "bg-amber-100 text-amber-700"
                                                            : "bg-muted text-muted-foreground"
                                                )}
                                            >
                                                {h.status_pagamento || "PENDENTE"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </OperationalShell>
    );
};

export default CustosExtrasLancamento;
