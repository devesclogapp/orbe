import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
    EmpresaService,
    UnidadeOperacionalService,
    FormaPagamentoOperacionalService,
    CustoExtraOperacionalService,
} from "@/services/base.service";
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

    const setFormField = (field: string, value: any) => {
        setForm((prev) => {
            const next = { ...prev, [field]: value };
            if (field === "empresa_id") {
                next.unidade_id = "";
            }
            return next;
        });
    };

    const totalCalculado = useMemo(() => {
        return (form.valor_unitario || 0) * (form.quantidade || 0);
    }, [form.valor_unitario, form.quantidade]);

    const validateStep1 = () => {
        if (!form.empresa_id) { toast.error("Selecione a empresa"); return false; }
        if (!form.categoria) { toast.error("Selecione a categoria"); return false; }
        return true;
    };

    const validateFinal = () => {
        if (!form.descricao) { toast.error("Informe a descrição do custo"); return false; }
        if (form.valor_unitario === undefined || form.valor_unitario === null) { toast.error("Informe o valor unitário"); return false; }
        if (!form.quantidade || form.quantidade <= 0) { toast.error("Informe uma quantidade válida"); return false; }
        if (!form.forma_pagamento_id) { toast.error("Selecione a forma de pagamento"); return false; }
        return true;
    };

    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!validateFinal()) throw new Error("Dados incompletos");
            const payload = {
                ...form,
                tenant_id: user?.user_metadata?.tenant_id,
                categoria_custo: form.categoria,
                status_pagamento: "PENDENTE",
                pipeline_status: "EM_VALIDACAO",
                origem_dado: "manual",
                origem_lancamento: user?.user_metadata?.role === 'encarregado' ? "encarregado" : "admin",
                total: totalCalculado,
                responsavel_id: user?.id,
            };
            delete (payload as any).categoria;
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
                <div className={cn("h-2 flex-1 rounded-full", currentStep >= 1 ? "bg-primary" : "bg-slate-200")} />
                <div className={cn("h-2 flex-1 rounded-full", currentStep >= 2 ? "bg-primary" : "bg-slate-200")} />
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
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-slate-500">Forma de Pagamento <span className="text-destructive">*</span></Label>
                            <Select value={form.forma_pagamento_id} onValueChange={(v) => setFormField("forma_pagamento_id", v)}>
                                <SelectTrigger className="h-12"><SelectValue placeholder="Selecione a forma de pagamento" /></SelectTrigger>
                                <SelectContent>
                                    {formasPagamento.map((f: any) => (
                                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
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
