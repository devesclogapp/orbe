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

interface FormStepContextProps {
    form: UseFormReturn<ProductionFormValues>;
    empresas: any[];
    unidades: any[];
    tiposServico: any[];
}

export function FormStepContext({ form, empresas, unidades, tiposServico }: FormStepContextProps) {
    const { register, formState: { errors } } = form;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Empresa</Label>
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

                <div className="space-y-2">
                    <Label>Data da Operação</Label>
                    <Input type="date" {...register("data")} />
                    {errors.data && <p className="text-xs text-red-500">{errors.data.message}</p>}
                </div>

                <div className="space-y-2">
                    <Label>Tipo de Serviço</Label>
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

                <div className="space-y-2">
                    <Label>Placa do Veículo (Opcional)</Label>
                    <Input {...register("placa_veiculo")} placeholder="Ex: ABC-1234" />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea {...register("observacao")} placeholder="Detalhes adicionais da operação..." />
            </div>
        </div>
    );
}
