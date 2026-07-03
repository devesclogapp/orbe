import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { OperacaoForm } from "@/components/operacoes/lancamento/OperacaoForm";

interface NovaOperacaoDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialData?: any;
}

export const NovaOperacaoDialog = ({ open, onOpenChange, initialData }: NovaOperacaoDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-background p-2 sm:p-6">
                <DialogHeader className="mb-2 px-2">
                    <DialogTitle>{initialData ? "Editar Lançamento Operacional" : "Nova Operação por Volume"}</DialogTitle>
                    <DialogDescription>
                        Lançamento administrativo completo. Após salvar, o lançamento entra no pipeline com todas as validações já registradas.
                        {!initialData && (
                            <span className="block mt-1">
                                Status padrão: <Badge variant="outline" className="text-amber-600 border-amber-300">Recebido</Badge>.
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="w-full">
                    {/* Renderiza apenas se modal open preventively to avoid unneeded API calls */}
                    {open && (
                        <OperacaoForm
                            mode="admin"
                            initialData={initialData}
                            onSuccess={() => onOpenChange(false)}
                            onCancel={() => onOpenChange(false)}
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
