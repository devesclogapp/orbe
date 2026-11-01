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
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { QuickRegisterDialog } from "./QuickRegisterDialog";
import { cn } from "@/lib/utils";

interface FormStepContextProps {
    form: UseFormReturn<ProductionFormValues>;
    empresas: any[];
    unidades: any[];
    tiposServico: any[];
    transportadoras: any[];
    fornecedores: any[];
    isPendenciaHorario?: boolean;
}

export function FormStepContext({ form, empresas, unidades, tiposServico, transportadoras, fornecedores, isPendenciaHorario }: FormStepContextProps) {
    const { register, watch, formState: { errors } } = form;
    const empresaId = watch("empresa_id");
    const horarioInicio = watch("horario_inicio");
    const horarioFim = watch("horario_fim");

    const faltaInicio = Boolean(isPendenciaHorario && (!horarioInicio || String(horarioInicio).trim() === ""));
    const faltaFim = Boolean(isPendenciaHorario && (!horarioFim || String(horarioFim).trim() === ""));
    const pendenciaAtiva = faltaInicio || faltaFim;

    const [quickReg, setQuickReg] = useState<{ open: boolean; type: "transportadora" | "fornecedor" | "produto" }>({
        open: false,
        type: "transportadora"
    });

    const openQuickReg = (type: "transportadora" | "fornecedor" | "produto") => {
        setQuickReg({ open: true, type });
    };

    return (
        <div className="space-y-6">
            {isPendenciaHorario && (
                <div className={cn(
                    "p-4 rounded-xl border flex items-start gap-3 transition-colors",
                    pendenciaAtiva
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                )}>
                    {pendenciaAtiva ? (
                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    ) : (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-0.5">
                        <p className="text-sm font-semibold">
                            {pendenciaAtiva
                                ? "Pendência operacional: informe o horário de início e término da operação para liberar o registro."
                                : "Horários informados com sucesso! Clique em 'Salvar e liberar pendência' para regularizar."}
                        </p>
                        <p className="text-xs opacity-90">
                            {pendenciaAtiva
                                ? "Os horários delimitam a janela operacional da carga na doca. Preencha os campos destacados abaixo para liberar o registro."
                                : "Os campos de início e término foram preenchidos. Clique no botão abaixo para concluir o saneamento e liberar o registro."}
                        </p>
                    </div>
                </div>
            )}

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
                        Tipo de Operação
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

                {/* Horário Início */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                        {isPendenciaHorario ? "Horário Início" : "Horário Início (Opcional)"}
                        {faltaInicio && <span className="text-amber-600 font-bold">*</span>}
                    </Label>
                    <Input
                        type="time"
                        {...register("horario_inicio")}
                        className={cn(
                            faltaInicio && "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 focus-visible:ring-amber-500"
                        )}
                    />
                    {faltaInicio && (
                        <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5 mt-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Campo necessário para resolver esta pendência.
                        </p>
                    )}
                </div>

                {/* Horário Fim */}
                <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                        {isPendenciaHorario ? "Horário Fim" : "Horário Fim (Opcional)"}
                        {faltaFim && <span className="text-amber-600 font-bold">*</span>}
                    </Label>
                    <Input
                        type="time"
                        {...register("horario_fim")}
                        className={cn(
                            faltaFim && "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/30 focus-visible:ring-amber-500"
                        )}
                    />
                    {faltaFim && (
                        <p className="text-xs text-amber-600 font-medium flex items-center gap-1.5 mt-1">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            Campo necessário para resolver esta pendência.
                        </p>
                    )}
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
