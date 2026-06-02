import { UseFormReturn } from "react-hook-form";
import { ProductionFormValues } from "./schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface FormStepSummaryProps {
    form: UseFormReturn<ProductionFormValues>;
    produtos: any[];
    formasPagamento: any[];
    loadingPreco?: boolean;
}

export function FormStepSummary({ form, produtos, formasPagamento, loadingPreco }: FormStepSummaryProps) {
    const { register, watch, formState: { errors } } = form;
    const values = watch();

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Produto / Carga</Label>
                    <Select
                        onValueChange={(val) => form.setValue("produto", val)}
                        defaultValue={form.getValues("produto")}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                            {produtos.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Quantidade (Volumes/Diárias)</Label>
                    <Input type="number" {...register("quantidade")} />
                    {errors.quantidade && <p className="text-xs text-red-500">{errors.quantidade.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select
                        onValueChange={(val) => form.setValue("forma_pagamento", val)}
                        defaultValue={form.getValues("forma_pagamento")}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione a forma" />
                        </SelectTrigger>
                        <SelectContent>
                            {formasPagamento.map((f) => (
                                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.forma_pagamento && <p className="text-xs text-red-500">{errors.forma_pagamento.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Valor Unitário (Automático)</Label>
                    <div className="relative">
                        <Input
                            type="number"
                            {...register("valor_unitario")}
                            readOnly
                            className="bg-slate-50 border-dashed"
                        />
                        {loadingPreco && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-primary animate-pulse">Buscando...</div>}
                    </div>
                </div>
            </div>

            <Card className="p-4 bg-primary/5 border-primary/20">
                <div className="flex justify-between items-center text-sm font-medium text-primary">
                    <span>Total Previsto:</span>
                    <span className="text-lg font-bold">
                        {formatCurrency((Number(values.quantidade || 0) * Number(values.valor_unitario || 0)))}
                    </span>
                </div>
            </Card>
        </div>
    );
}
