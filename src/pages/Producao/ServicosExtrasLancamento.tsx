import { useState, useMemo, useEffect } from "react";
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
    Loader2,
    Package,
    Plus,
    Receipt,
    Save,
    Truck,
    Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

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
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import {
    EmpresaService,
    FormaPagamentoOperacionalService,
    OperacaoProducaoService,
    TipoServicoOperacionalService,
    TransportadoraClienteService,
    ServicosExtrasOperacionaisService,
    ServicosEspecificosRegrasService,
    MateriaisOperacionaisService,
    FornecedorValorServicoService,
} from "@/services/base.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type FormaCobranca = "CAIXA_IMEDIATO" | "DEPOSITO_IMEDIATO";

interface ServicosExtrasFormState {
    data: string;
    empresa_id: string;
    tipo_servico_id: string;
    descricao: string;
    quantidade: string;
    quantidade_colaboradores: string;
    regra_periodo_id: string;
    valor_unitario: string;
    forma_cobranca: FormaCobranca | "";
    forma_pagamento_id: string;
    nf_emite: boolean;
    nf_numero: string;
    transportadora_id: string;
    responsavel_nome: string;
    observacao: string;
    unidade_cobranca_snapshot?: string;
    tipo_calculo_snapshot?: string;
    valor_unitario_snapshot?: number;
    iss_percentual: string;
}

interface MaterialItem {
    material_id: string;
    nome_snapshot: string;
    unidade_snapshot: string;
    valor_unitario_snapshot: number;
    quantidade: number;
    valor_total: number;
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
    quantidade_colaboradores: "",
    regra_periodo_id: "",
    valor_unitario: "",
    forma_cobranca: "DEPOSITO_IMEDIATO",
    forma_pagamento_id: "",
    nf_emite: false,
    nf_numero: "",
    transportadora_id: "",
    responsavel_nome: "",
    observacao: "",
    tipo_calculo_snapshot: "por_operacao",
    unidade_cobranca_snapshot: "op",
    valor_unitario_snapshot: 0,
    iss_percentual: "0",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

const ServicosExtrasLancamento = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [form, setForm] = useState<ServicosExtrasFormState>({ ...INITIAL_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof ServicosExtrasFormState, string>>>({});
    const [selectedMateriais, setSelectedMateriais] = useState<MaterialItem[]>([]);
    const [usouMateriais, setUsouMateriais] = useState(false);

    const setField = <K extends keyof ServicosExtrasFormState>(key: K, value: ServicosExtrasFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas_all"], queryFn: () => EmpresaService.getAll() });
    const { data: todosTiposServico = [] } = useQuery({ queryKey: ["tipos_servico_operacional"], queryFn: () => TipoServicoOperacionalService.getAllActive() });

    const tiposServico = useMemo(() =>
        (todosTiposServico as any[]).filter(t => t.is_extra_service && t.ativo_encarregado),
        [todosTiposServico]
    );

    const { data: transportadoras = [] } = useQuery({ queryKey: ["transportadoras_servicos", form.empresa_id], queryFn: () => TransportadoraClienteService.getByEmpresa(form.empresa_id), enabled: !!form.empresa_id });
    const { data: formasPagamento = [] } = useQuery({ queryKey: ["formas_pagamento_operacional"], queryFn: () => FormaPagamentoOperacionalService.getAllActive() });
    const { data: regrasPeriodo = [] } = useQuery({ queryKey: ["regras_operacionais"], queryFn: () => ServicosEspecificosRegrasService.getAll() });
    const { data: materiaisDisponiveis = [] } = useQuery({ queryKey: ["materiais_ativos"], queryFn: () => MateriaisOperacionaisService.getAllActive() });

    const { data: regraIss } = useQuery({
        queryKey: ["resolver_iss_extra", form.empresa_id, form.tipo_servico_id, form.data],
        queryFn: () => FornecedorValorServicoService.resolverIss({
            empresaId: form.empresa_id,
            tipoServicoId: form.tipo_servico_id || null,
            dataOperacao: form.data,
        }),
        enabled: !!form.empresa_id && form.nf_emite,
    });


    const { data: historicoHoje = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ["servicos_extras_hoje", today],
        queryFn: () => ServicosExtrasOperacionaisService.getWithEmpresas(undefined, today),
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
        const normalized = String(value).replace(/\./g, "").replace(",", ".");
        const parsed = Number(normalized);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    };

    const periodSelecionado = useMemo(() =>
        regrasPeriodo.find((r: any) => r.id === form.regra_periodo_id),
        [regrasPeriodo, form.regra_periodo_id]
    );

    const multiplicadorPeriodo = Number(periodSelecionado?.peso_multiplicador || 1);
    const quantidade = parseNumeric(form.quantidade);
    const valorUnitarioBase = parseNumeric(form.valor_unitario);
    const valorUnitarioEfetivo = valorUnitarioBase * multiplicadorPeriodo;
    const valorTotalServico = quantidade * valorUnitarioEfetivo;

    const issPercentual = parseNumeric(form.iss_percentual);
    const valorIss = form.nf_emite ? (valorTotalServico * (issPercentual / 100)) : 0;
    const valorTotalServicoLiquido = valorTotalServico - valorIss;

    const valorTotalMateriais = selectedMateriais.reduce((acc, m) => acc + m.valor_total, 0);
    const valorTotalGeral = valorTotalServico + valorTotalMateriais;
    const valorLiquidoTotal = valorTotalServicoLiquido + valorTotalMateriais;

    const tipoServicoSelecionado = useMemo(() =>
        (tiposServico as any[]).find((t: any) => t.id === form.tipo_servico_id),
        [tiposServico, form.tipo_servico_id]
    );

    useEffect(() => {
        if (tipoServicoSelecionado) {
            setField("valor_unitario", String(tipoServicoSelecionado.valor_unitario || "0"));
            setField("valor_unitario_snapshot", tipoServicoSelecionado.valor_unitario || 0);
            if (tipoServicoSelecionado.tipo_calculo) {
                setField("tipo_calculo_snapshot", tipoServicoSelecionado.tipo_calculo);
            }
            if (tipoServicoSelecionado.unidade_cobranca) {
                setField("unidade_cobranca_snapshot", tipoServicoSelecionado.unidade_cobranca);
            }
        }
    }, [tipoServicoSelecionado]);

    // Aplica ISS automaticamente quando NF é ligada
    useEffect(() => {
        if (form.nf_emite) {
            if (regraIss?.regra_encontrada) {
                setField("iss_percentual", (Number(regraIss.percentual_iss) * 100).toString());
            } else if (Number(form.iss_percentual) === 0) {
                // Fallback de 5% se não houver regra mas NF estiver ligada
                setField("iss_percentual", "5");
            }
        } else {
            setField("iss_percentual", "0");
        }
    }, [form.nf_emite, regraIss]);

    // ─── Validation ───────────────────────────────────────────────────────────

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof ServicosExtrasFormState, string>> = {};
        if (!form.empresa_id) newErrors.empresa_id = "Selecione a empresa.";
        if (!form.data) newErrors.data = "Informe a data.";
        if (!form.tipo_servico_id) newErrors.tipo_servico_id = "Selecione o tipo de serviço.";
        if (!form.descricao.trim()) newErrors.descricao = "Informe a descrição.";
        if (quantidade <= 0) newErrors.quantidade = "Quantidade inválida.";
        if (valorUnitarioBase <= 0 && form.tipo_calculo_snapshot !== "manual") newErrors.valor_unitario = "Informe o valor.";
        if (!form.forma_pagamento_id) newErrors.forma_pagamento_id = "Informe a forma de pagamento.";
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
                quantidade: quantidade,
                valor_unitario: valorUnitarioEfetivo,
                total: valorTotalGeral,
                tipo_servico: tipoServicoSelecionado?.nome || "Outro",
                tipo_servico_id: form.tipo_servico_id,
                descricao_servico: form.descricao.trim(),
                descricao: form.descricao.trim(),
                modalidade_financeira: form.forma_cobranca || "DEPOSITO_IMEDIATO",
                forma_pagamento_id: form.forma_pagamento_id,
                responsavel_nome: (form.responsavel_nome.trim() || perfil?.nome || user?.email || "N/A").trim(),
                observacao: form.observacao.trim(),
                tipo_calculo_snapshot: form.tipo_calculo_snapshot,
                unidade_cobranca_snapshot: form.unidade_cobranca_snapshot,
                valor_unitario_snapshot: form.valor_unitario_snapshot,
                quantidade_colaboradores: parseNumeric(form.quantidade_colaboradores) || null,
                iss_percentual: issPercentual / 100,
                valor_iss: valorIss,
                regra_id: (form.regra_periodo_id && form.regra_periodo_id !== "none") ? form.regra_periodo_id : null,
                emite_nf: form.nf_emite,
                nf_numero: form.nf_numero,
                materiais_snapshot: selectedMateriais.length > 0 ? selectedMateriais : null,
                custo_materiais: valorTotalMateriais,
                transportadora_id: (form.transportadora_id && form.transportadora_id !== "none") ? form.transportadora_id : null,
            };

            return ServicosExtrasOperacionaisService.create(payload);
        },
        onSuccess: () => {
            toast.success("Serviço extra registrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["servicos_extras_hoje"] });
            setForm({ ...INITIAL_FORM, responsavel_nome: form.responsavel_nome });
            setSelectedMateriais([]);
            setUsouMateriais(false);
        },
        onError: (err: any) => toast.error("Erro ao salvar serviço extra.", { description: err.message }),
    });

    return (
        <OperationalShell title="Lançamento de Serviço Extra">
            <div className="max-w-4xl mx-auto space-y-8 pb-20 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Plus className="h-5 w-5 text-primary" />
                        Novo Lançamento
                    </h2>
                    <Button variant="outline" size="sm" onClick={() => navigate("/producao")}>
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* FORMULÁRIO */}
                    <div className="space-y-6">
                        <section className="esc-card p-6 space-y-6 shadow-sm">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Identificação
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Empresa <span className="text-destructive">*</span></Label>
                                    <Select value={form.empresa_id} onValueChange={(v) => setField("empresa_id", v)}>
                                        <SelectTrigger className={cn(errors.empresa_id && "border-destructive")}><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                        <SelectContent>{(empresas as any[]).map((emp: any) => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}</SelectContent>
                                    </Select>
                                    {errors.empresa_id && <p className="text-xs text-destructive">{errors.empresa_id}</p>}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Data <span className="text-destructive">*</span></Label>
                                        <Input type="date" value={form.data} onChange={(e) => setField("data", e.target.value)} className={cn(errors.data && "border-destructive")} />
                                        {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Tipo de Serviço <span className="text-destructive">*</span></Label>
                                        <Select value={form.tipo_servico_id} onValueChange={(v) => setField("tipo_servico_id", v)}>
                                            <SelectTrigger className={cn(errors.tipo_servico_id && "border-destructive")}><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                                            <SelectContent>{(tiposServico as any[]).map((s: any) => (
                                                <SelectItem key={s.id} value={s.id}>
                                                    {s.nome}
                                                </SelectItem>
                                            ))}</SelectContent>
                                        </Select>
                                        {errors.tipo_servico_id && <p className="text-xs text-destructive">{errors.tipo_servico_id}</p>}
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="esc-card p-6 space-y-6 shadow-sm">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Detalhes e Valores
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Descrição do Serviço <span className="text-destructive">*</span></Label>
                                    <Textarea placeholder="Descreva o serviço realizado..." value={form.descricao} onChange={(e) => setField("descricao", e.target.value)} className={cn(errors.descricao && "border-destructive")} rows={2} />
                                    {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">
                                            Quantidade {form.unidade_cobranca_snapshot && <span className="text-muted-foreground font-normal">({form.unidade_cobranca_snapshot})</span>} <span className="text-destructive">*</span>
                                        </Label>
                                        <Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setField("quantidade", e.target.value)} className={cn(errors.quantidade && "border-destructive")} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Período Operacional</Label>
                                        <Select value={form.regra_periodo_id} onValueChange={(v) => setField("regra_periodo_id", v)}>
                                            <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Padrão (1.00x)</SelectItem>
                                                {regrasPeriodo.map((r: any) => (
                                                    <SelectItem key={r.id} value={r.id}>
                                                        {r.codigo} - {r.descricao} ({Number(r.peso_multiplicador).toFixed(2)}x)
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Qtd. Colaboradores</Label>
                                        <Input type="number" placeholder="Opcional" value={form.quantidade_colaboradores} onChange={(e) => setField("quantidade_colaboradores", e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase">Valor Unitário</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">R$</span>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className={cn("pl-9 font-bold", form.tipo_calculo_snapshot === "manual" ? "bg-background" : "bg-muted text-primary")}
                                                value={form.valor_unitario}
                                                onChange={(e) => form.tipo_calculo_snapshot === "manual" && setField("valor_unitario", e.target.value)}
                                                readOnly={form.tipo_calculo_snapshot !== "manual"}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <section className="esc-card p-6 space-y-6 shadow-sm">
                            <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4" />
                                Financeiro
                            </h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold uppercase">Forma de Pagamento <span className="text-destructive">*</span></Label>
                                    <Select value={form.forma_pagamento_id} onValueChange={(v) => setField("forma_pagamento_id", v)}>
                                        <SelectTrigger className={cn(errors.forma_pagamento_id && "border-destructive")}><SelectValue placeholder="Selecione a forma" /></SelectTrigger>
                                        <SelectContent>{(formasPagamento as any[]).map((f: any) => (<SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <div className="space-y-0.5">
                                        <Label className="text-xs font-bold uppercase">Emitir Nota Fiscal (NF)?</Label>
                                        <p className="text-[10px] text-muted-foreground italic">Marque se este serviço exige faturamento oficial.</p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={form.nf_emite}
                                        onChange={(e) => setField("nf_emite", e.target.checked)}
                                        className="h-5 w-5 rounded border-slate-300 text-primary focus:ring-primary"
                                    />
                                </div>

                                {form.nf_emite && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                        <Label className="text-xs font-bold uppercase text-primary">Número da NF</Label>
                                        <Input placeholder="Opcional" value={form.nf_numero} onChange={(e) => setField("nf_numero", e.target.value)} />
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* SEÇÃO DE MATERIAIS EXTRAS */}
                        <section className="esc-card p-6 space-y-4 shadow-sm border-l-4 border-l-blue-400">
                            <div className="flex items-center justify-between">
                                <h3 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                    <Package className="h-4 w-4" />
                                    Materiais Extras
                                </h3>
                                <input
                                    type="checkbox"
                                    checked={usouMateriais}
                                    onChange={(e) => setUsouMateriais(e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-500"
                                />
                            </div>

                            {usouMateriais && (
                                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                                    <Select
                                        onValueChange={(matId) => {
                                            const mat = materiaisDisponiveis.find((m: any) => m.id === matId);
                                            if (mat && !selectedMateriais.find(sm => sm.material_id === matId)) {
                                                setSelectedMateriais([...selectedMateriais, {
                                                    material_id: mat.id,
                                                    nome_snapshot: mat.nome,
                                                    unidade_snapshot: mat.unidade,
                                                    valor_unitario_snapshot: mat.valor_unitario,
                                                    quantidade: 1,
                                                    valor_total: mat.valor_unitario
                                                }]);
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="h-9"><SelectValue placeholder="Adicionar material..." /></SelectTrigger>
                                        <SelectContent>
                                            {materiaisDisponiveis.map((m: any) => (
                                                <SelectItem key={m.id} value={m.id}>{m.nome} ({formatCurrency(m.valor_unitario)})</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>

                                    <div className="space-y-2 max-h-40 overflow-y-auto">
                                        {selectedMateriais.map((mat, idx) => (
                                            <div key={mat.material_id} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                                                <div className="flex-1">
                                                    <p className="text-[10px] font-bold truncate">{mat.nome_snapshot}</p>
                                                    <p className="text-[8px] text-muted-foreground">{formatCurrency(mat.valor_unitario_snapshot)}/{mat.unidade_snapshot}</p>
                                                </div>
                                                <Input
                                                    type="number"
                                                    className="w-16 h-7 text-[10px] text-center"
                                                    value={mat.quantidade}
                                                    onChange={(e) => {
                                                        const q = Number(e.target.value);
                                                        const newMats = [...selectedMateriais];
                                                        newMats[idx] = { ...mat, quantidade: q, valor_total: q * mat.valor_unitario_snapshot };
                                                        setSelectedMateriais(newMats);
                                                    }}
                                                />
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setSelectedMateriais(selectedMateriais.filter((_, i) => i !== idx))}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        <div className="space-y-4 sticky bottom-6 z-10 transition-all">
                            <div className="p-4 rounded-2xl border-2 border-primary/20 bg-primary/5 flex flex-col gap-1 backdrop-blur-md shadow-lg shadow-primary/5">
                                <div className="flex items-center justify-between text-muted-foreground text-[10px] uppercase font-bold tracking-wider px-1">
                                    <span>Base: {quantidade} x R$ {valorUnitarioEfetivo.toFixed(2)}</span>
                                    {valorTotalMateriais > 0 && <span>+ R$ {formatCurrency(valorTotalMateriais)} Mat.</span>}
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase text-primary">Total Bruto</span>
                                    <span className="text-2xl font-black text-primary font-mono">{formatCurrency(valorTotalGeral)}</span>
                                </div>
                                {form.nf_emite && (
                                    <div className="flex flex-col gap-0.5 mt-1 pt-2 border-t border-primary/10">
                                        <div className="flex justify-between items-center text-[10px] text-destructive/70 italic px-1">
                                            <span>ISS ({form.iss_percentual}%):</span>
                                            <span>-{formatCurrency(valorIss)}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] font-bold text-primary px-1">
                                            <span className="uppercase">Líquido Estimado:</span>
                                            <span>{formatCurrency(valorLiquidoTotal)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Button
                                className="w-full size-lg font-bold py-7 text-xl shadow-xl shadow-primary/30 rounded-2xl"
                                onClick={() => salvarMutation.mutate()}
                                disabled={salvarMutation.isPending}
                            >
                                {salvarMutation.isPending ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : <Save className="h-6 w-6 mr-2" />}
                                Finalizar Lançamento
                            </Button>
                        </div>
                    </div>

                    {/* HISTÓRICO DE HOJE */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 px-2 sticky top-4">
                            <History className="h-5 w-5 text-muted-foreground" />
                            <h2 className="text-lg font-bold">Lançamentos de Hoje</h2>
                        </div>

                        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden divide-y divide-slate-50 min-h-[400px]">
                            {isLoadingHistorico ? (
                                <div className="p-12 text-center text-muted-foreground animate-pulse flex flex-col items-center gap-2">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary/30" />
                                    Carregando histórico...
                                </div>
                            ) : historicoHoje.length === 0 ? (
                                <div className="p-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-4">
                                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                                        <History className="h-8 w-8 text-slate-200" />
                                    </div>
                                    <span className="italic">Nenhum serviço registrado hoje.</span>
                                </div>
                            ) : (
                                (historicoHoje as any[]).map((item) => (
                                    <div key={item.id} className="p-5 hover:bg-slate-50/50 transition-all border-l-4 border-l-transparent hover:border-l-primary duration-300">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="text-xs font-bold text-slate-900 line-clamp-1">{item.empresas?.nome || "Empresa"}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-[10px] text-primary font-bold flex items-center gap-1 uppercase bg-primary/5 px-1.5 py-0.5 rounded">
                                                        <Package className="h-2.5 w-2.5" />
                                                        {item.tipo_servico || "Serviço"}
                                                    </p>
                                                    <span className="text-[9px] text-muted-foreground uppercase">{item.data}</span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-900">{formatCurrency(item.total)}</p>
                                                <Badge
                                                    variant="secondary"
                                                    className={cn(
                                                        "text-[8px] h-4 px-1 uppercase font-bold",
                                                        item.pipeline_status === 'FECHADO' ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
                                                    )}
                                                >
                                                    {item.pipeline_status || 'PENDENTE'}
                                                </Badge>
                                            </div>
                                        </div>
                                        {item.descricao_servico && (
                                            <p className="text-[10px] text-muted-foreground line-clamp-2 italic leading-relaxed">
                                                "{item.descricao_servico}"
                                            </p>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </OperationalShell>
    );
};

export default ServicosExtrasLancamento;
