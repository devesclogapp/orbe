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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { QuickRegisterDialog } from "./QuickRegisterDialog";

interface FormStepContextProps {
    form: UseFormReturn<ProductionFormValues>;
    empresas: any[];
    unidades: any[];
    tiposServico: any[];
    transportadoras: any[];
    fornecedores: any[];
}

export function FormStepContext({ form, empresas, unidades, tiposServico, transportadoras, fornecedores }: FormStepContextProps) {
    const { register, watch, formState: { errors } } = form;
    const empresaId = watch("empresa_id");

    const [quickReg, setQuickReg] = useState<{ open: boolean; type: "transportadora" | "fornecedor" | "produto" }>({
        open: false,
        type: "transportadora"
    });

    const openQuickReg = (type: "transportadora" | "fornecedor" | "produto") => {
        setQuickReg({ open: true, type });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Empresa */}
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Empresa
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("empresa_id", val)}
                        defaultValue={form.getValues("empresa_id")}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                        <SelectContent>
                            {empresas.map((e) => (
                                <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.empresa_id && <p className="text-xs text-red-500">{errors.empresa_id.message}</p>}
                </div>

                {/* Data */}
                <div className="space-y-2">
                    <Label>Data da Operação</Label>
                    <Input type="date" {...register("data")} />
                    {errors.data && <p className="text-xs text-red-500">{errors.data.message}</p>}
                </div>

                {/* Tipo de Serviço */}
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Tipo de Serviço / Operação
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("tipo_servico", val)}
                        defaultValue={form.getValues("tipo_servico")}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione o serviço" />
                        </SelectTrigger>
                        <SelectContent>
                            {tiposServico.map((s) => (
                                <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.tipo_servico && <p className="text-xs text-red-500">{errors.tipo_servico.message}</p>}
                </div>

                {/* Transportadora */}
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Transportadora
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-primary"
                            onClick={() => openQuickReg("transportadora")}
                            disabled={!empresaId}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("transportadora", val)}
                        key={`transportadora-${form.getValues("transportadora")}`}
                        defaultValue={form.getValues("transportadora") || undefined}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione transportadora" />
                        </SelectTrigger>
                        <SelectContent>
                            {transportadoras.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma encontrada</div>
                            ) : (
                                transportadoras.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Fornecedor */}
                <div className="space-y-2">
                    <Label className="flex justify-between items-center">
                        Fornecedor
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 text-primary"
                            onClick={() => openQuickReg("fornecedor")}
                            disabled={!empresaId}
                        >
                            <Plus className="h-3 w-3" />
                        </Button>
                    </Label>
                    <Select
                        onValueChange={(val) => form.setValue("fornecedor", val)}
                        key={`fornecedor-${form.getValues("fornecedor")}`}
                        defaultValue={form.getValues("fornecedor") || undefined}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Selecione fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                            {fornecedores.length === 0 ? (
                                <div className="px-3 py-2 text-xs text-muted-foreground">Nenhum encontrado</div>
                            ) : (
                                fornecedores.map((f) => (
                                    <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>

                {/* Placa */}
                <div className="space-y-2">
                    <Label>Placa do Veículo (Opcional)</Label>
                    <Input {...register("placa_veiculo")} placeholder="Ex: ABC-1234" />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea {...register("observacao")} placeholder="Detalhes adicionais da operação..." />
            </div>

            <QuickRegisterDialog
                open={quickReg.open}
                onOpenChange={(open) => setQuickReg(prev => ({ ...prev, open }))}
                type={quickReg.type}
                empresaId={empresaId}
                onSuccess={(id) => {
                    if (quickReg.type === "transportadora") form.setValue("transportadora", id);
                    if (quickReg.type === "fornecedor") form.setValue("fornecedor", id);
                }}
            />
        </div>
    );
}
