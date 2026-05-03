import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@shadcn/ui/button";
import { ActionButton } from "./ActionButton";
import { LoadingButton } from "./LoadingButton";
import { Check as LucideCheck, X as LucideX, Truck as LucideTruck } from "lucide-react";

const schema = z.object({
  tipoServico: z.enum(["Volume", "Carro"], { errorMap: () => ({ message: "Selecione o tipo de serviço" }) }),
  quantidade: z.number().positive({ message: "Quantidade deve ser positiva" }),
  transportadora: z.string().min(1, { message: "Transportadora obrigatória" }),
  responsavelId: z.uuid({ required_error: "Responsável é obrigatório" }),
});

export type OperationFormData = z.infer<typeof schema>;

export const OperationForm = ({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: OperationFormData) => Promise<void>;
  onCancel: () => void;
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OperationFormData>({
    resolver: zodResolver(schema),
  });

  return (
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 gap-2">
        <label className="flex items-center gap-2">
          <span>Tipo de Serviço</span>
          <select {...register("tipoServico")}> 
            <option value="">Selecione</option>
            <option value="Volume">Volume</option>
            <option value="Carro">Carro</option>
          </select>
          {errors.tipoServico && <p className="text-destructive text-sm">{errors.tipoServico.message}</p>}
        </label>
        <label>
          <span>Quantidade</span>
          <input type="number" {...register("quantidade", { valueAsNumber: true })} />
          {errors.quantidade && <p className="text-destructive text-sm">{errors.quantidade.message}</p>}
        </label>
        <label>
          <span>Transportadora</span>
          <input type="text" {...register("transportadora")}/>
          {errors.transportadora && <p className="text-destructive text-sm">{errors.transportadora.message}</p>}
        </label>
        <label>
          <span>Responsável</span>
          <input type="text" {...register("responsavelId")}/>
          {errors.responsavelId && <p className="text-destructive text-sm">{errors.responsavelId.message}</p>}
        </label>
      </div>
      <div className="flex gap-4 justify-end">
        <ActionButton onClick={onCancel} variant="secondary">
          <LucideX className="h-4 w-4" /> Cancelar
        </ActionButton>
        <LoadingButton onClick={async()=>{}}
          disabled={isSubmitting}
        ><LucideCheck className="h-4 w-4" /> Salvar</LoadingButton>
      </div>
    </form>
  );
};
