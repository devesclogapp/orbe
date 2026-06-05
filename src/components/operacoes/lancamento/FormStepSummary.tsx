import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuickRegisterDialog } from "./QuickRegisterDialog";

interface FormStepSummaryProps {
    form: UseFormReturn<ProductionFormValues>;
    produtos: any[];
    formasPagamento: any[];
    loadingPreco?: boolean;
}

export function FormStepSummary({ form, produtos, formasPagamento, loadingPreco }: FormStepSummaryProps) {
    const { register, watch, formState: { errors } } = form;
    const values = watch();
    const empresaId = watch("empresa_id");

    const [quickRegOpen, setQuickRegOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Produto / Carga
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-primary"
                            onClick={() => setQuickRegOpen(true)}
                            disabled={!empresaId || !watch("fornecedor")}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("produto", val)}
                        key={`produto-${form.getValues("produto")}`}
                        defaultValue={form.getValues("produto") || undefined}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o produto" />
                        </SelectTrigger>
                        <SelectContent>
                            {produtos.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum encontrado</div>
                            ) : (
                                produtos.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                                ))
                            )}
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

            <QuickRegisterDialog
                open={quickRegOpen}
                onOpenChange={setQuickRegOpen}
                type="produto"
                empresaId={empresaId}
                fornecedorId={watch("fornecedor")}
                onSuccess={(id) => form.setValue("produto", id)}
            />
        </div>
    );
}
