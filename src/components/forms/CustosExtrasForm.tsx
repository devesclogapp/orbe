import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Save, Check, User, Building2, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
    EmpresaService,
    UnidadeOperacionalService,
    FormaPagamentoOperacionalService,
    FornecedorService,
    CustoExtraOperacionalService,
} from "@/services/base.service";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
    OPCOES_ORIGEM_RECURSO,
    buildCustoExtraInsertPayload,
    type OrigemRecursoCustoExtra,
} from "@/types/custosExtrasForm";

type CategoriaCustoExtra = "OPERACIONAL" | "ADMINISTRATIVO" | "MERENDA/LANCHE" | "MANUTENCAO" | "TRANSPORTE" | "COMUNICACAO" | "OUTROS";

const CATEGORIAS_CUSTO: { value: CategoriaCustoExtra; label: string }[] = [
    { value: "MERENDA/LANCHE", label: "Merenda/Lanche" },
    { value: "COMUNICACAO", label: "Comunicação" },
    { value: "MANUTENCAO", label: "Manutenção" },
    { value: "TRANSPORTE", label: "Transporte" },
    { value: "OPERACIONAL", label: "Operacional" },
    { value: "ADMINISTRATIVO", label: "Administrativo" },
    { value: "OUTROS", label: "Outros" },
];

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatCurrency = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

interface CustosExtrasFormProps {
    onSuccess?: () => void;
    empresaPadraoId?: string;
}

export const CustosExtrasForm = ({ onSuccess, empresaPadraoId }: CustosExtrasFormProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const today = format(new Date(), "yyyy-MM-dd");

    const [currentStep, setCurrentStep] = useState(1);
    const [form, setForm] = useState({
        empresa_id: empresaPadraoId || "",
        unidade_id: "",
        data: today,
        categoria: "MERENDA/LANCHE" as CategoriaCustoExtra,
        descricao: "",
        valor_unitario: 0,
        quantidade: 1,
        forma_pagamento_id: "",
        origem_recurso: "PAGO_EMPRESA" as OrigemRecursoCustoExtra,
        favorecido_colaborador_id: "",
        favorecido_fornecedor_id: "",
        data_vencimento: "",
        observacao: "",
    });

    const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => EmpresaService.getAll() });
    const { data: unidades = [], isFetching: isFetchingUnidades } = useQuery({
        queryKey: ["unidades-operacionais", form.empresa_id],
        queryFn: async () => {
            if (!form.empresa_id) return [];
            return UnidadeOperacionalService.getByEmpresa(form.empresa_id);
        },
        enabled: !!form.empresa_id
    });
    const { data: formasPagamento = [] } = useQuery({
        queryKey: ["formas_pagamento_ativas"],
        queryFn: () => FormaPagamentoOperacionalService.getAllActive()
    });

    // Colaboradores (quando REEMBOLSO_COLABORADOR)
    const { data: colaboradores = [], isLoading: isLoadingColabs } = useQuery({
        queryKey: ["colaboradores-ativos", form.empresa_id],
        queryFn: async () => {
            let q = supabase
                .from("colaboradores")
                .select("id, nome, cpf, status")
                .eq("status", "ativo");
            if (form.empresa_id) {
                q = q.or(`empresa_id.eq.${form.empresa_id},empresa_id.is.null`);
            }
            const { data, error } = await q.order("nome");
            if (error) {
                console.warn("Erro ao buscar colaboradores:", error);
                return [];
            }
            return data ?? [];
        },
        enabled: form.origem_recurso === "REEMBOLSO_COLABORADOR",
    });

    // Fornecedores (quando PAGAMENTO_PENDENTE)
    const { data: fornecedores = [], isLoading: isLoadingFornecedores } = useQuery({
        queryKey: ["fornecedores-ativos", form.empresa_id],
        queryFn: async () => {
            return FornecedorService.getByEmpresa(form.empresa_id);
        },
        enabled: form.origem_recurso === "PAGAMENTO_PENDENTE",
    });

    const setFormField = (field: string, value: any) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === "empresa_id") {
                next.unidade_id = "";
            }
            return next;
        });
    };

    const handleOrigemChange = (origem: OrigemRecursoCustoExtra) => {
        setForm((prev) => ({
            ...prev,
            origem_recurso: origem,
            favorecido_colaborador_id: origem === "REEMBOLSO_COLABORADOR" ? prev.favorecido_colaborador_id : "",
            favorecido_fornecedor_id: origem === "PAGAMENTO_PENDENTE" ? prev.favorecido_fornecedor_id : "",
            data_vencimento: origem === "PAGAMENTO_PENDENTE" ? prev.data_vencimento : "",
        }));
    };

    const totalCalculado = useMemo(() => {
        return (form.valor_unitario || 0) * (form.quantidade || 0);
    }, [form.valor_unitario, form.quantidade]);

    const validateStep1 = () => {
        if (!form.empresa_id) { toast.error("Selecione a empresa"); return false; }
        if (!form.categoria) { toast.error("Selecione a categoria"); return false; }
        return true;
    };

    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!form.descricao?.trim()) throw new Error("Informe a descrição do custo.");
            if (form.valor_unitario === undefined || form.valor_unitario === null || form.valor_unitario <= 0) {
                throw new Error("Informe um valor unitário válido maior que zero.");
            }
            if (!form.quantidade || form.quantidade <= 0) throw new Error("Informe uma quantidade válida.");
            if (!form.forma_pagamento_id) throw new Error("Selecione a forma de pagamento.");
            if (form.origem_recurso === "REEMBOLSO_COLABORADOR" && !form.favorecido_colaborador_id) {
                throw new Error("Selecione o colaborador que realizou o pagamento.");
            }

            const payload = buildCustoExtraInsertPayload(
                {
                    empresa_id: form.empresa_id,
                    unidade_id: form.unidade_id || null,
                    data: form.data,
                    categoria: form.categoria,
                    descricao: form.descricao,
                    quantidade: form.quantidade,
                    valor_unitario: form.valor_unitario,
                    forma_pagamento_id: form.forma_pagamento_id,
                    origem_recurso: form.origem_recurso,
                    favorecido_colaborador_id: form.favorecido_colaborador_id || null,
                    favorecido_fornecedor_id: form.favorecido_fornecedor_id || null,
                    data_vencimento: form.data_vencimento || null,
                    observacao: form.observacao || null,
                },
                {
                    tenantId: user?.user_metadata?.tenant_id,
                    userId: user?.id,
                    origemLancamento: user?.user_metadata?.role === 'encarregado' ? "encarregado" : "admin",
                }
            );

            return CustoExtraOperacionalService.createMany([payload]);
        },
        onSuccess: () => {
            toast.success("Custo extra registrado com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["custos-extras"] });
            queryClient.invalidateQueries({ queryKey: ["custos-extras-hoje"] });
            onSuccess?.();
        },
        onError: (err: any) => toast.error("Erro ao salvar lançamento", { description: err.message }),
    });

    return (
        <div className="space-y-6">
            {/* Stepper Header */}
            <div className="flex items-center justify-center gap-4 mb-8">
                <div className={cn("h-2 flex-1 rounded-full transition-colors", currentStep >= 1 ? "bg-primary" : "bg-slate-200")} />
                <div className={cn("h-2 flex-1 rounded-full transition-colors", currentStep >= 2 ? "bg-primary" : "bg-slate-200")} />
            </div>

            {currentStep === 1 ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Empresa <span className="text-destructive">*</span></Label>
                            <Select value={form.empresa_id} onValueChange={(v) => setFormField("empresa_id", v)}>
                                <SelectTrigger className="h-12"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                                <SelectContent>{empresas.map((emp: any) => (<SelectItem key={emp.id} value={emp.id}>{emp.nome}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Unidade (Opcional)</Label>
                            <Select value={form.unidade_id} onValueChange={(v) => setFormField("unidade_id", v)} disabled={!form.empresa_id || isFetchingUnidades}>
                                <SelectTrigger className="h-12">
                                    <SelectValue placeholder={isFetchingUnidades ? "Carregando unidades..." : "Selecione a unidade"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {unidades.length === 0 && !isFetchingUnidades ? (
                                        <div className="p-2 text-xs text-muted-foreground italic text-center">Nenhuma unidade encontrada</div>
                                    ) : (
                                        unidades.map((u: any) => (
                                            <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Categoria <span className="text-destructive">*</span></Label>
                            <Select value={form.categoria} onValueChange={(v: any) => setFormField("categoria", v)}>
                                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                                <SelectContent>{CATEGORIAS_CUSTO.map(c => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <Button className="w-full h-12 font-bold" onClick={() => validateStep1() && setCurrentStep(2)}>
                        Continuar
                    </Button>
                </div>
            ) : (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Descrição <span className="text-destructive">*</span></Label>
                            <Input className="h-12" placeholder="O que foi gasto?" value={form.descricao} onChange={(e) => setFormField("descricao", e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-500">Quantidade</Label>
                                <Input className="h-12" type="number" value={form.quantidade} onChange={(e) => setFormField("quantidade", Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase text-slate-500">Valor Unit.</Label>
                                <Input
                                    className="h-12"
                                    type="number"
                                    step="0.01"
                                    value={form.valor_unitario}
                                    onChange={(e) => setFormField("valor_unitario", Number(e.target.value))}
                                />
                            </div>
                        </div>
                        <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5 flex items-center justify-between">
                            <span className="text-xs font-bold uppercase text-primary">Total Estimado</span>
                            <span className="text-xl font-bold text-primary font-mono">{formatCurrency(totalCalculado)}</span>
                        </div>

                        {/* Quem pagou esta despesa? */}
                        <div className="space-y-2 pt-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">
                                Quem pagou esta despesa? <span className="text-destructive">*</span>
                            </Label>
                            <div className="grid grid-cols-1 gap-2.5">
                                {OPCOES_ORIGEM_RECURSO.map((opcao) => {
                                    const isSelected = form.origem_recurso === opcao.value;
                                    return (
                                        <button
                                            key={opcao.value}
                                            type="button"
                                            onClick={() => handleOrigemChange(opcao.value)}
                                            className={cn(
                                                "w-full text-left p-3 rounded-xl border-2 transition-all flex items-start gap-3",
                                                isSelected
                                                    ? "border-primary bg-primary/5 shadow-sm"
                                                    : "border-slate-200 bg-white hover:border-slate-300"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 shrink-0 transition-colors",
                                                isSelected ? "border-primary bg-primary text-white" : "border-slate-300 bg-white"
                                            )}>
                                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                            </div>
                                            <div className="space-y-0.5 flex-1">
                                                <div className="flex items-center justify-between">
                                                    <span className={cn("text-xs font-bold", isSelected ? "text-primary" : "text-slate-900")}>
                                                        {opcao.label}
                                                    </span>
                                                    <span className={cn(
                                                        "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-full",
                                                        opcao.value === "PAGO_EMPRESA" ? "bg-blue-100 text-blue-700" :
                                                        opcao.value === "REEMBOLSO_COLABORADOR" ? "bg-amber-100 text-amber-700" :
                                                        "bg-purple-100 text-purple-700"
                                                    )}>
                                                        {opcao.value === "PAGO_EMPRESA" ? "Empresa" : opcao.value === "REEMBOLSO_COLABORADOR" ? "Reembolso" : "Pendente"}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-muted-foreground leading-snug">
                                                    {opcao.descricao}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Se REEMBOLSO_COLABORADOR: Selecionar Colaborador */}
                        {form.origem_recurso === "REEMBOLSO_COLABORADOR" && (
                            <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2 animate-in fade-in duration-200">
                                <Label className="text-xs font-bold uppercase text-amber-800 flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5" />
                                    Colaborador a ser reembolsado <span className="text-destructive">*</span>
                                </Label>
                                <Select
                                    value={form.favorecido_colaborador_id}
                                    onValueChange={(v) => setFormField("favorecido_colaborador_id", v)}
                                >
                                    <SelectTrigger className="h-11 bg-white">
                                        <SelectValue placeholder={isLoadingColabs ? "Carregando colaboradores..." : "Selecione o colaborador que pagou"} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colaboradores.length === 0 && !isLoadingColabs ? (
                                            <div className="p-2 text-xs text-muted-foreground italic text-center">Nenhum colaborador ativo encontrado</div>
                                        ) : (
                                            colaboradores.map((colab: any) => (
                                                <SelectItem key={colab.id} value={colab.id}>
                                                    {colab.nome} {colab.cpf ? `(${colab.cpf})` : ""}
                                                </SelectItem>
                                            ))
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-[10px] text-amber-700">
                                    O colaborador receberá o valor de {formatCurrency(totalCalculado)} a título de reembolso.
                                </p>
                            </div>
                        )}

                        {/* Se PAGAMENTO_PENDENTE: Fornecedor e Vencimento */}
                        {form.origem_recurso === "PAGAMENTO_PENDENTE" && (
                            <div className="p-3.5 rounded-xl bg-purple-50/60 border border-purple-200 space-y-3 animate-in fade-in duration-200">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-purple-800 flex items-center gap-1.5">
                                            <Building2 className="h-3.5 w-3.5" />
                                            Fornecedor (Opcional)
                                        </Label>
                                        <Select
                                            value={form.favorecido_fornecedor_id}
                                            onValueChange={(v) => setFormField("favorecido_fornecedor_id", v)}
                                        >
                                            <SelectTrigger className="h-11 bg-white">
                                                <SelectValue placeholder={isLoadingFornecedores ? "Carregando..." : "Selecione o fornecedor"} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fornecedores.length === 0 && !isLoadingFornecedores ? (
                                                    <div className="p-2 text-xs text-muted-foreground italic text-center">Nenhum fornecedor encontrado</div>
                                                ) : (
                                                    fornecedores.map((forn: any) => (
                                                        <SelectItem key={forn.id} value={forn.id}>
                                                            {forn.nome} {forn.cnpj ? `(${forn.cnpj})` : ""}
                                                        </SelectItem>
                                                    ))
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-purple-800 flex items-center gap-1.5">
                                            <Clock className="h-3.5 w-3.5" />
                                            Vencimento (Opcional)
                                        </Label>
                                        <Input
                                            type="date"
                                            className="h-11 bg-white"
                                            value={form.data_vencimento}
                                            onChange={(e) => setFormField("data_vencimento", e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Forma de Pagamento */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">
                                Forma de Pagamento <span className="text-destructive">*</span>
                            </Label>
                            <Select value={form.forma_pagamento_id} onValueChange={(v) => setFormField("forma_pagamento_id", v)}>
                                <SelectTrigger className="h-12"><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
                                <SelectContent>
                                    {formasPagamento.map((f: any) => (
                                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Observações */}
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Observação (Opcional)</Label>
                            <Input className="h-12" placeholder="Detalhes adicionais..." value={form.observacao} onChange={(e) => setFormField("observacao", e.target.value)} />
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="h-12 px-6" onClick={() => setCurrentStep(1)}>
                            Voltar
                        </Button>
                        <Button
                            className="flex-1 h-12 font-bold"
                            onClick={() => salvarMutation.mutate()}
                            disabled={salvarMutation.isPending}
                        >
                            {salvarMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Save className="h-5 w-5 mr-2" />}
                            Salvar Lançamento
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};
