import { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
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
    ServicosExtrasOperacionaisService,
    ServicosEspecificosRegrasService,
    FornecedorValorServicoService,
} from "@/services/base.service";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface NovoServicoExtraDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: any;
}

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
    responsavel_nome: string;
    observacao: string;
    unidade_cobranca_snapshot?: string;
    tipo_calculo_snapshot?: string;
    valor_unitario_snapshot?: number;
    iss_percentual: string;
}

const INITIAL_FORM: ServicosExtrasFormState = {
    data: format(new Date(), "yyyy-MM-dd"),
    empresa_id: "",
    tipo_servico_id: "",
    descricao: "",
    quantidade: "",
    quantidade_colaboradores: "",
    regra_periodo_id: "",
    valor_unitario: "",
    forma_cobranca: "DEPOSITO_IMEDIATO",
    forma_pagamento_id: "",
    nf_emite: false,
    nf_numero: "",
    responsavel_nome: "",
    observacao: "",
    tipo_calculo_snapshot: "por_operacao",
    unidade_cobranca_snapshot: "op",
    valor_unitario_snapshot: 0,
    iss_percentual: "0",
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

export const NovoServicoExtraDialog = ({ open, onOpenChange, initialData }: NovoServicoExtraDialogProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [form, setForm] = useState<ServicosExtrasFormState>({ ...INITIAL_FORM });
    const [errors, setErrors] = useState<Partial<Record<keyof ServicosExtrasFormState, string>>>({});

    const setField = <K extends keyof ServicosExtrasFormState>(key: K, value: ServicosExtrasFormState[K]) => {
        setForm(prev => ({ ...prev, [key]: value }));
        setErrors(prev => ({ ...prev, [key]: undefined }));
    };

    // ─── Queries ─────────────────────────────────────────────────────────────

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_all"],
        queryFn: () => EmpresaService.getAll(),
        enabled: open
    });

    const { data: todosTiposServico = [] } = useQuery({
        queryKey: ["tipos_servico_operacional"],
        queryFn: () => TipoServicoOperacionalService.getAllActive(),
        enabled: open
    });

    const tiposServico = useMemo(() =>
        (todosTiposServico as any[]).filter(t => t.is_extra_service),
        [todosTiposServico]
    );

    const { data: formasPagamento = [] } = useQuery({
        queryKey: ["formas_pagamento_operacional"],
        queryFn: () => FormaPagamentoOperacionalService.getAllActive(),
        enabled: open
    });

    const { data: regrasPeriodo = [] } = useQuery({
        queryKey: ["regras_operacionais"],
        queryFn: () => ServicosEspecificosRegrasService.getAll(),
        enabled: open
    });

    const { data: regraIss } = useQuery({
        queryKey: ["resolver_iss_extra", form.empresa_id, form.tipo_servico_id, form.data],
        queryFn: () => FornecedorValorServicoService.resolverIss({
            empresaId: form.empresa_id,
            tipoServicoId: form.tipo_servico_id || null,
            dataOperacao: form.data,
        }),
        enabled: !!form.empresa_id && form.nf_emite && open,
    });

    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => { if (!user?.id) return null; const { data } = await OperacaoProducaoService.getProfile(user.id); return data; },
        enabled: !!user?.id && open,
    });

    useEffect(() => {
        if (!open) {
            setForm({ ...INITIAL_FORM });
            setErrors({});
            return;
        }
        if (initialData) {
            setForm({
                data: initialData.data || format(new Date(), "yyyy-MM-dd"),
                empresa_id: initialData.empresa_id || "",
                tipo_servico_id: initialData.tipo_servico_id || "",
                descricao: initialData.descricao_servico || initialData.descricao || "",
                quantidade: initialData.quantidade !== null && initialData.quantidade !== undefined ? String(initialData.quantidade) : "1",
                quantidade_colaboradores: initialData.quantidade_colaboradores ? String(initialData.quantidade_colaboradores) : "",
                regra_periodo_id: initialData.regra_id || "",
                valor_unitario: initialData.valor_unitario !== null ? String(initialData.valor_unitario) : "",
                forma_cobranca: (initialData.modalidade_financeira as FormaCobranca) || "DEPOSITO_IMEDIATO",
                forma_pagamento_id: initialData.forma_pagamento_id || "",
                nf_emite: initialData.emite_nf || false,
                nf_numero: initialData.nf_numero || "",
                responsavel_nome: initialData.responsavel_nome || "",
                observacao: initialData.observacao || "",
                tipo_calculo_snapshot: initialData.tipo_calculo_snapshot || "por_operacao",
                unidade_cobranca_snapshot: initialData.unidade_cobranca_snapshot || "op",
                valor_unitario_snapshot: initialData.valor_unitario_snapshot || 0,
                iss_percentual: initialData.iss_percentual ? String(Number(initialData.iss_percentual) * 100) : "0",
            });
        }
    }, [open, initialData]);

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
    const quantidade = parseNumeric(form.quantidade || "1");
    const valorUnitarioBase = parseNumeric(form.valor_unitario);
    const valorUnitarioEfetivo = valorUnitarioBase * multiplicadorPeriodo;
    const valorTotalServico = quantidade * valorUnitarioEfetivo;

    const issPercentual = parseNumeric(form.iss_percentual);
    const valorIss = form.nf_emite ? (valorTotalServico * (issPercentual / 100)) : 0;
    const valorTotalServicoLiquido = valorTotalServico - valorIss;

    const tipoServicoSelecionado = useMemo(() =>
        (tiposServico as any[]).find((t: any) => t.id === form.tipo_servico_id),
        [tiposServico, form.tipo_servico_id]
    );

    useEffect(() => {
        if (tipoServicoSelecionado && open) {
            setField("valor_unitario", String(tipoServicoSelecionado.valor_unitario || "0"));
            setField("valor_unitario_snapshot", tipoServicoSelecionado.valor_unitario || 0);
            if (tipoServicoSelecionado.tipo_calculo) {
                setField("tipo_calculo_snapshot", tipoServicoSelecionado.tipo_calculo);
            }
            if (tipoServicoSelecionado.unidade_cobranca) {
                setField("unidade_cobranca_snapshot", tipoServicoSelecionado.unidade_cobranca);
            }
        }
    }, [tipoServicoSelecionado, open]);

    useEffect(() => {
        if (form.nf_emite && open) {
            if (regraIss?.regra_encontrada) {
                setField("iss_percentual", (Number(regraIss.percentual_iss) * 100).toString());
            } else if (Number(form.iss_percentual) === 0) {
                setField("iss_percentual", "5");
            }
        } else {
            setField("iss_percentual", "0");
        }
    }, [form.nf_emite, regraIss, open]);

    // ─── Validation ───────────────────────────────────────────────────────────

    const validate = (): boolean => {
        const newErrors: Partial<Record<keyof ServicosExtrasFormState, string>> = {};
        if (!form.empresa_id) newErrors.empresa_id = "Selecione a empresa.";
        if (!form.data) newErrors.data = "Informe a data.";
        if (!form.tipo_servico_id) newErrors.tipo_servico_id = "Selecione o tipo de serviço.";
        if (!form.descricao.trim()) newErrors.descricao = "Informe a descrição.";
        if (quantidade <= 0) newErrors.quantidade = "Inválido.";
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
                total: valorTotalServico,
                tipo_servico: tipoServicoSelecionado?.nome || "Outro",
                tipo_servico_id: form.tipo_servico_id,
                descricao_servico: form.descricao.trim(),
                descricao: form.descricao.trim(),
                modalidade_financeira: form.forma_cobranca || "DEPOSITO_IMEDIATO",
                forma_pagamento_id: form.forma_pagamento_id,
                responsavel_nome: (form.responsavel_nome.trim() || perfil?.nome || user?.email || "Admin").trim(),
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
                materiais_snapshot: null,
                custo_materiais: 0,
                transportadora_id: null,
                // Status direto como PENDENTE para aparecer na lista do RH/Admin, se aplicável
            };

            if (initialData) {
                return ServicosExtrasOperacionaisService.update(initialData.id, payload as any);
            }
            return ServicosExtrasOperacionaisService.create(payload);
        },
        onSuccess: () => {
            toast.success(initialData ? "Serviço extra atualizado com sucesso!" : "Serviço extra registrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["servicos_extras_historico"] });
            queryClient.invalidateQueries({ queryKey: ["servicos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["servicos_extras_hoje"] });
            onOpenChange(false);
        },
        onError: (err: any) => toast.error("Erro ao salvar serviço extra.", { description: err.message }),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{initialData ? "Editar Serviço Extra" : "Novo Lançamento de Serviço Extra"}</DialogTitle>
                    <DialogDescription>
                        {initialData ? "Atualize as informações do serviço extra. Alguns campos podem estar bloqueados dependendo do estágio financeiro." : "Registro administrativo de serviços extraordinários."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Identificação */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold border-b pb-1">Identificação</h4>
                        <div className="space-y-2">
                            <Label>Empresa <span className="text-red-500">*</span></Label>
                            <Select value={form.empresa_id} onValueChange={(v) => setField("empresa_id", v)}>
                                <SelectTrigger className={cn(errors.empresa_id && "border-destructive")}>
                                    <SelectValue placeholder="Selecione a empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(empresas as any[]).map((emp: any) => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {errors.empresa_id && <p className="text-xs text-destructive">{errors.empresa_id}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Data <span className="text-red-500">*</span></Label>
                                <Input type="date" value={form.data} onChange={(e) => setField("data", e.target.value)} className={cn(errors.data && "border-destructive")} />
                                {errors.data && <p className="text-xs text-destructive">{errors.data}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label>Tipo de Serviço <span className="text-red-500">*</span></Label>
                                <Select value={form.tipo_servico_id} onValueChange={(v) => setField("tipo_servico_id", v)}>
                                    <SelectTrigger className={cn(errors.tipo_servico_id && "border-destructive")}>
                                        <SelectValue placeholder="Selecione o tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(tiposServico as any[]).map((s: any) => (
                                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.tipo_servico_id && <p className="text-xs text-destructive">{errors.tipo_servico_id}</p>}
                            </div>
                        </div>
                    </div>

                    {/* Detalhes */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold border-b pb-1">Detalhes e Valores</h4>
                        <div className="space-y-2">
                            <Label>Descrição do Serviço <span className="text-red-500">*</span></Label>
                            <Textarea placeholder="Descreva o serviço realizado..." value={form.descricao} onChange={(e) => setField("descricao", e.target.value)} className={cn(errors.descricao && "border-destructive")} rows={2} />
                            {errors.descricao && <p className="text-xs text-destructive">{errors.descricao}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>
                                    Quantidade {form.unidade_cobranca_snapshot && <span className="text-muted-foreground font-normal">({form.unidade_cobranca_snapshot})</span>} <span className="text-red-500">*</span>
                                </Label>
                                <Input type="number" step="0.01" placeholder="1" value={form.quantidade} onChange={(e) => setField("quantidade", e.target.value)} className={cn(errors.quantidade && "border-destructive")} />
                            </div>
                            <div className="space-y-2">
                                <Label>Período Operacional</Label>
                                <Select value={form.regra_periodo_id} onValueChange={(v) => setField("regra_periodo_id", v)}>
                                    <SelectTrigger><SelectValue placeholder="Selecione o período" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Padrão</SelectItem>
                                        {regrasPeriodo.map((r: any) => (
                                            <SelectItem key={r.id} value={r.id}>
                                                {r.codigo} ({Number(r.peso_multiplicador).toFixed(2)}x)
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Qtd. Colaboradores</Label>
                                <Input type="number" placeholder="Opcional" value={form.quantidade_colaboradores} onChange={(e) => setField("quantidade_colaboradores", e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Valor Unitário</Label>
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

                    {/* Financeiro */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold border-b pb-1">Financeiro</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Forma de Pagamento <span className="text-red-500">*</span></Label>
                                <Select value={form.forma_pagamento_id} onValueChange={(v) => setField("forma_pagamento_id", v)}>
                                    <SelectTrigger className={cn(errors.forma_pagamento_id && "border-destructive")}>
                                        <SelectValue placeholder="Selecione a forma" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(formasPagamento as any[]).map((f: any) => (
                                            <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Emitir Nota Fiscal?</Label>
                                <div className="flex items-center h-10 px-3 bg-slate-50 border rounded-md">
                                    <input
                                        type="checkbox"
                                        checked={form.nf_emite}
                                        onChange={(e) => setField("nf_emite", e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-300 text-primary"
                                    />
                                    <span className="ml-2 text-sm">Sim, exige faturamento</span>
                                </div>
                            </div>
                        </div>

                        {form.nf_emite && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                                <Label>Número da NF <span className="text-xs text-muted-foreground">(opcional)</span></Label>
                                <Input placeholder="Opcional" value={form.nf_numero} onChange={(e) => setField("nf_numero", e.target.value)} />
                            </div>
                        )}
                    </div>

                    {/* Resumo Financeiro */}
                    {quantidade && valorUnitarioEfetivo > 0 && (
                        <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">Total Previsto:</span>
                            <span className="text-lg font-bold text-primary">
                                {formatCurrency(valorTotalServico)}
                            </span>
                        </div>
                    )}

                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={() => salvarMutation.mutate()}
                        disabled={salvarMutation.isPending}
                    >
                        {salvarMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                        {initialData ? "Salvar Alterações" : "Lançar Serviço Extra"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
