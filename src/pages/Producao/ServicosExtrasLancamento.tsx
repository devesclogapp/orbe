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
    Save,
    Settings2,
    Truck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    EmpresaService,
    FormaPagamentoOperacionalService,
    OperacaoProducaoService,
    TipoServicoOperacionalService,
    TransportadoraClienteService,
} from "@/services/base.service";
import { toast } from "sonner";
import { useOperationalPipeline, buildServicosExtrasPipeline } from "@/contexts/OperationalPipelineContext";
import { ServicosExtrasOperacionaisService } from "@/services/base.service";
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
    forma_cobranca: "",
    forma_pagamento_id: "",
    nf_numero: "",
    transportadora_id: "",
    responsavel_nome: "",
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

const ServicosExtrasLancamento = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState<ServicosExtrasFormState>({ ...INITIAL_FORM });
    const [activeTab, setActiveTab] = useState("historico");
    const [errors, setErrors] = useState<Partial<Record<keyof ServicosExtrasFormState, string>>>({});

    const setField = <K extends keyof ServicosExtrasFormState>(key: K, value: ServicosExtrasFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_all"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: tiposServico = [] } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
    });

    const { data: transportadoras = [] } = useQuery({
        queryKey: ["transportadoras_servicos", form.empresa_id],
        queryFn: () => TransportadoraClienteService.getByEmpresa(form.empresa_id),
        enabled: !!form.empresa_id,
    });

    const { data: formasPagamento = [] } = useQuery({
        queryKey: ["formas_pagamento_operacional"],
        queryFn: () => FormaPagamentoOperacionalService.getAllActive(),
    });

    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ["servicos_extras_historico", form.empresa_id],
        queryFn: () =>
            ServicosExtrasOperacionaisService.getWithEmpresas(form.empresa_id).catch(() => []),
        enabled: !!form.empresa_id && activeTab === "historico",
    });

    // ─── Calculations ─────────────────────────────────────────────────────────

    const quantidade = parseNumeric(form.quantidade);
    const valorUnitario = parseNumeric(form.valor_unitario);
    const valorTotal = quantidade * valorUnitario;

    const isDataRetroativa = form.data < today;

    const tipoServicoSelecionado = useMemo(
        () => (tiposServico as any[]).find((t: any) => t.id === form.tipo_servico_id),
        [tiposServico, form.tipo_servico_id]
    );

    const transportadoraSelecionada = useMemo(
        () => (transportadoras as any[]).find((t: any) => t.id === form.transportadora_id),
        [transportadoras, form.transportadora_id]
    );

    // ─── Validation ───────────────────────────────────────────────────────────

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof ServicosExtrasFormState, string>> = {};

        if (!form.empresa_id) newErrors.empresa_id = "Selecione a empresa.";
        if (!form.data) newErrors.data = "Informe a data.";
        if (!form.tipo_servico_id) newErrors.tipo_servico_id = "Selecione o tipo de serviço.";
        if (!form.descricao.trim()) newErrors.descricao = "Informe a descrição do serviço extra.";
        if (quantidade <= 0) newErrors.quantidade = "Quantidade deve ser maior que zero.";
        if (valorUnitario <= 0) newErrors.valor_unitario = "Informe o valor unitário.";
        if (!form.forma_cobranca) newErrors.forma_cobranca = "Selecione a forma de cobrança.";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    // ─── Mutation ────────────────────────────────────────────────────────────

    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!validate()) throw new Error("Corrija os campos obrigatórios.");

            // Serviços Extras sempre entram como recebimento imediato (CAIXA_IMEDIATO)
            // categoria_servico = 'SERVICO_EXTRA' identifica este tipo no sistema
            const operacao = {
                empresa_id: form.empresa_id,
                data_operacao: form.data,
                tipo_servico_id: form.tipo_servico_id,
                descricao_servico: form.descricao.trim(),
                quantidade: quantidade,
                valor_unitario_snapshot: valorUnitario,
                tipo_calculo_snapshot: "volume",
                valor_descarga: valorTotal,
                custo_com_iss: 0,
                valor_unitario_filme: 0,
                quantidade_filme: 0,
                valor_total_filme: 0,
                valor_total: valorTotal,
                percentual_iss: 0,
                transportadora_id: form.transportadora_id || null,
                forma_pagamento_id: form.forma_pagamento_id || null,
                nf_numero: form.nf_numero.trim() || null,
                observacao: form.observacao.trim() || null,
                status: "pendente",
                origem_dado: "manual",
                responsavel_id: user?.id ?? null,
                // Chave de classificação financeira
                modalidade_financeira: "CAIXA_IMEDIATO",
                // categoria_servico é removida automaticamente pelo sanitizeOperacaoPayload interno
                // mas precisamos indicar via avaliacao_json
                avaliacao_json: {
                    categoria_servico: "SERVICO_EXTRA",
                    contexto_operacional: {
                        total_previsto: valorTotal,
                        quantidade,
                        valor_unitario: valorUnitario,
                        base_calculo: `${quantidade} × ${formatCurrency(valorUnitario)}`,
                        forma_cobranca: form.forma_cobranca,
                        responsavel_nome: form.responsavel_nome.trim() || null,
                    },
                },
            };

            return OperacaoProducaoService.createWithColaboradores(operacao, []);
        },
        onSuccess: () => {
            toast.success("Serviço extra registrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
            queryClient.invalidateQueries({ queryKey: ["servicos_extras_historico"] });

            // Reset form but keep empresa and data
            setForm(prev => ({
                ...INITIAL_FORM,
                data: prev.data,
                empresa_id: prev.empresa_id,
            }));
            setErrors({});
        },
        onError: (err: any) => {
            toast.error("Erro ao salvar serviço extra.", { description: err.message });
        },
    });

    // ─── Rendering ───────────────────────────────────────────────────────────

    return (
        <AppShell title="Serviços Extras" subtitle="Gestão e lançamento de serviços operacionais adicionais">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <TabsList className="w-fit p-1 bg-muted/60 border border-border">
                        <TabsTrigger value="historico" className="text-xs font-bold uppercase tracking-wider">
                            <History className="h-3.5 w-3.5 mr-2" /> Tabela de Lançamentos
                        </TabsTrigger>
                        <TabsTrigger value="lancamento" className="text-xs font-bold uppercase tracking-wider">
                            <Package className="h-3.5 w-3.5 mr-2" /> Novo Lançamento
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Select value={form.empresa_id} onValueChange={v => setField("empresa_id", v)}>
                            <SelectTrigger className="w-full sm:w-[280px] h-10 border-border bg-card">
                                <Building2 className="h-4 w-4 mr-2 text-primary" />
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
                        <Button variant="outline" className="hidden sm:flex" onClick={() => navigate("/producao")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>
                    </div>
                </div>

                <TabsContent value="lancamento" className="m-0">
                    <div className="max-w-3xl mx-auto space-y-6 pb-28 pt-4">
                        {/* Seção 1 — Identificação */}
                        <section className="esc-card p-6 space-y-4">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Identificação do Serviço
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
                                        className={cn(errors.data && "border-destructive")}
                                    />
                                    {isDataRetroativa && (
                                        <p className="text-xs text-amber-600 flex items-center gap-1">
                                            <AlertCircle className="h-3 w-3" /> Data retroativa
                                        </p>
                                    )}
                                    {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
                                </div>

                                {/* Empresa fixa e read-only aqui se quiser (removido para evitar duplo selector) */}
                                <div className="space-y-1.5 hidden">
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

                                {/* Tipo de Serviço */}
                                <div className="space-y-1.5">
                                    <Label>
                                        Serviço Extra <span className="text-destructive">*</span>
                                    </Label>
                                    <Select
                                        value={form.tipo_servico_id}
                                        onValueChange={v => setField("tipo_servico_id", v)}
                                    >
                                        <SelectTrigger className={cn(errors.tipo_servico_id && "border-destructive")}>
                                            <SelectValue placeholder="Selecione o serviço" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(tiposServico as any[]).map((s: any) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {errors.tipo_servico_id && (
                                        <p className="text-xs text-destructive">{errors.tipo_servico_id}</p>
                                    )}
                                </div>

                                {/* Transportadora */}
                                <div className="space-y-1.5">
                                    <Label>
                                        Transportadora{" "}
                                        <span className="text-xs text-muted-foreground">(opcional)</span>
                                    </Label>
                                    <Select
                                        value={form.transportadora_id}
                                        onValueChange={v => setField("transportadora_id", v)}
                                        disabled={!form.empresa_id}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="">Nenhuma</SelectItem>
                                            {(transportadoras as any[]).map((t: any) => (
                                                <SelectItem key={t.id} value={t.id}>
                                                    {t.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </section>

                        {/* Seção 2 — Detalhes */}
                        <section className="esc-card p-6 space-y-4">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Detalhes do Serviço
                            </h3>

                            {/* Descrição */}
                            <div className="space-y-1.5">
                                <Label>
                                    Descrição <span className="text-destructive">*</span>
                                </Label>
                                <Textarea
                                    placeholder="Descreva exatamente o serviço realizado..."
                                    value={form.descricao}
                                    onChange={e => setField("descricao", e.target.value)}
                                    rows={3}
                                    className={cn(errors.descricao && "border-destructive")}
                                />
                                {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
                            </div>

                            {/* Quantidade / Valor */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                    <Label>
                                        Quantidade <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
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
                                    {errors.valor_unitario && (
                                        <p className="text-xs text-destructive">{errors.valor_unitario}</p>
                                    )}
                                </div>

                                {/* Total automático */}
                                <div className="space-y-1.5">
                                    <Label>Valor Total</Label>
                                    <div
                                        className={cn(
                                            "h-10 flex items-center px-3 rounded-md border text-sm font-mono font-bold",
                                            valorTotal > 0
                                                ? "bg-purple-50 border-purple-300 text-purple-700"
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

                            {/* NF e Responsável */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label>NF / Referência <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                                    <Input
                                        placeholder="Número da NF ou referência..."
                                        value={form.nf_numero}
                                        onChange={e => setField("nf_numero", e.target.value)}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Responsável <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                                    <Input
                                        placeholder="Nome do responsável pelo serviço..."
                                        value={form.responsavel_nome}
                                        onChange={e => setField("responsavel_nome", e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Observação <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                                <Textarea
                                    placeholder="Informações adicionais..."
                                    value={form.observacao}
                                    onChange={e => setField("observacao", e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </section>

                        {/* Seção 3 — Cobrança */}
                        <section className="esc-card p-6 space-y-4">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Forma de Cobrança
                            </h3>

                            <p className="text-xs text-muted-foreground">
                                Serviços extras são liquidados em <strong>depósito imediato</strong> — o valor entra no caixa
                                do dia da operação.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {FORMAS_COBRANCA.map(fc => (
                                    <button
                                        key={fc.value}
                                        type="button"
                                        onClick={() => setField("forma_cobranca", fc.value)}
                                        className={cn(
                                            "p-4 rounded-xl border-2 text-left transition-all",
                                            form.forma_cobranca === fc.value
                                                ? "border-purple-500 bg-purple-50"
                                                : "border-border hover:border-purple-300 hover:bg-purple-50/30"
                                        )}
                                    >
                                        <p className="font-bold text-sm text-foreground">{fc.label}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{fc.description}</p>
                                    </button>
                                ))}
                            </div>
                            {errors.forma_cobranca && (
                                <p className="text-xs text-destructive flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {errors.forma_cobranca}
                                </p>
                            )}

                            {/* Forma de pagamento */}
                            <div className="space-y-1.5">
                                <Label>Forma de Pagamento <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                                <Select
                                    value={form.forma_pagamento_id}
                                    onValueChange={v => setField("forma_pagamento_id", v)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="">Não especificada</SelectItem>
                                        {(formasPagamento as any[]).map((fp: any) => (
                                            <SelectItem key={fp.id} value={fp.id}>
                                                {fp.nome}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </section>

                        {/* Preview */}
                        {form.empresa_id && form.tipo_servico_id && valorTotal > 0 && (
                            <section className="esc-card p-5 border-l-4 border-l-purple-500 bg-purple-50/30">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                                    Resumo do serviço extra
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Serviço</p>
                                        <p className="text-sm font-bold text-foreground truncate">
                                            {tipoServicoSelecionado?.nome ?? "—"}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Qtd</p>
                                        <p className="text-sm font-bold text-foreground">{quantidade}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Vlr. Unit.</p>
                                        <p className="text-sm font-mono font-bold text-foreground">
                                            {formatCurrency(valorUnitario)}
                                        </p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[10px] uppercase text-muted-foreground mb-0.5">Total</p>
                                        <p className="text-base font-mono font-bold text-purple-600">
                                            {formatCurrency(valorTotal)}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-purple-200/60 flex items-center gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-purple-600" />
                                    <p className="text-xs text-purple-700 font-medium">
                                        Modalidade: Caixa Imediato — receita gerada no dia da operação.
                                    </p>
                                </div>
                            </section>
                        )}

                        {/* Sticky Actions */}
                        {/* Sticky Actions */}
                        <div className="sticky bottom-4 z-20">
                            <div className="flex justify-end items-center bg-card/95 backdrop-blur p-4 rounded-xl border border-border shadow-lg">
                                <div className="flex items-center gap-3">
                                    {Object.keys(errors).length > 0 && (
                                        <span className="text-xs text-destructive hidden md:flex items-center gap-1 font-medium">
                                            <AlertCircle className="w-3 h-3" /> Corrija os campos obrigatórios
                                        </span>
                                    )}
                                    <Button
                                        size="lg"
                                        className="min-w-[180px] font-display font-bold bg-purple-600 hover:bg-purple-700"
                                        onClick={() => salvarMutation.mutate()}
                                        disabled={salvarMutation.isPending}
                                    >
                                        <Save className="h-4 w-4 mr-2" />
                                        {salvarMutation.isPending ? "Salvando..." : "Salvar Serviço Extra"}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="historico" className="m-0">
                    <div className="space-y-4 pt-4">
                        {/* Empty state ou loading */}
                        {!form.empresa_id ? (
                            <div className="esc-card p-16 text-center space-y-3">
                                <Building2 className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
                                <p className="text-sm font-medium text-foreground">Selecione uma empresa para começar</p>
                                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                                    Escolha a <span className="font-semibold text-primary">Empresa</span> no topo da tela para carregar a tabela.
                                </p>
                            </div>
                        ) : (
                            <div className="esc-card min-h-[500px] p-0 overflow-hidden">
                                <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <h3 className="font-display font-bold text-lg flex items-center gap-2">
                                        <History className="h-5 w-5 text-purple-600" />
                                        Listagem de Serviços
                                    </h3>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" onClick={() => setActiveTab("lancamento")}>
                                            <Package className="h-4 w-4 mr-2" />
                                            Novo Lançamento
                                        </Button>
                                    </div>
                                </div>

                                {isLoadingHistorico ? (
                                    <div className="text-center p-12 text-muted-foreground animate-pulse text-sm font-medium">
                                        Carregando dados da tabela...
                                    </div>
                                ) : (
                                    <ServicosExtrasTableBlock data={historico as any[]} />
                                )}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </AppShell>
    );
};

export default ServicosExtrasLancamento;
