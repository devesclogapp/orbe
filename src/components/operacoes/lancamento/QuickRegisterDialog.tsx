import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Loader2, Plus } from "lucide-react";
import { TransportadoraClienteService, FornecedorService, ProdutoCargaService, TipoServicoOperacionalService } from "@/services/base.service";
import { toast } from "sonner";

type QuickRegisterType = "transportadora" | "fornecedor" | "produto" | "servico";

interface QuickRegisterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: QuickRegisterType;
    empresaId: string;
    fornecedorId?: string;
    onSuccess: (id: string, nome: string) => void;
}

export function QuickRegisterDialog({ open, onOpenChange, type, empresaId, fornecedorId, onSuccess }: QuickRegisterDialogProps) {
    const queryClient = useQueryClient();
    const [nome, setNome] = useState("");

    const titleMap = {
        transportadora: "Nova Transportadora (Rápido)",
        fornecedor: "Novo Fornecedor (Rápido)",
        produto: "Novo Produto / Carga (Rápido)",
        servico: "Novo Serviço (Rápido)"
    };

    const mutation = useMutation({
        mutationFn: async () => {
            if (!nome.trim()) throw new Error("Informe o nome.");

            const basePayload = {
                nome: nome.trim(),
                ativo: false, // Mark as pending curadoria
            };

            if (type === "transportadora") {
                return TransportadoraClienteService.create({ ...basePayload, empresa_id: empresaId });
            } else if (type === "fornecedor") {
                return FornecedorService.create({ ...basePayload, empresa_id: empresaId });
            } else if (type === "servico") {
                return TipoServicoOperacionalService.create({ nome: nome.trim(), ativo: true });
            } else {
                // Products need a supplier
                return ProdutoCargaService.create({
                    ...basePayload,
                    fornecedor_id: fornecedorId
                });
            }
        },
        onSuccess: (data: any) => {
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} registrado!`, {
                description: "Aguardando curadoria do Admin."
            });
            // Update queries
            const queryKey = type === "produto"
                ? ["produtos", fornecedorId]
                : type === "servico"
                    ? ["tipos_servico_operacional"]
                    : [type + "s", empresaId];

            queryClient.setQueryData(queryKey, (old: any) => {
                if (!old) return [data];
                return [data, ...old];
            });
            queryClient.invalidateQueries({ queryKey });

            onSuccess(data.id, data.nome);
            setNome("");
            onOpenChange(false);
        },
        onError: (err: any) => toast.error("Erro ao cadastrar: " + err.message)
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle>{titleMap[type]}</DialogTitle>
                    <DialogDescription>
                        {type === "servico"
                            ? "Criação rápida para novo serviço básico. Pode ser editado posteriormente com todas as propriedades."
                            : "Criação rápida para continuidade operacional. Este registro ficará **inativo** até ser aprovado pelo Admin."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>
                            {type === "servico" ? "Nome do serviço" : "Nome / Razão Social"}
                        </Label>
                        <Input
                            autoFocus
                            placeholder="Digite o nome..."
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending || !nome.trim()}
                    >
                        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                        Cadastrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
