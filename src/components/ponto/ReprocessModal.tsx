import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RotateCcw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ReprocessModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (motivo: string) => Promise<void>;
    importacao: any;
}

export const ReprocessModal: React.FC<ReprocessModalProps> = ({
    open,
    onOpenChange,
    onConfirm,
    importacao
}) => {
    const [motivo, setMotivo] = useState("");
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!motivo.trim()) {
            toast.error("O motivo do reprocessamento é obrigatório.");
            return;
        }

        setLoading(true);
        try {
            await onConfirm(motivo);
            onOpenChange(false);
            setMotivo("");
        } catch (err: any) {
            console.error("Erro ao reprocessar:", err);
            toast.error("Falha ao reprocessar: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <RotateCcw className="h-5 w-5 text-primary" />
                        Confirmar Reprocessamento
                    </DialogTitle>
                    <DialogDescription>
                        Isso criará uma nova execução da importação <strong>{importacao?.nome_arquivo}</strong>.
                        Os registros anteriores serão invalidados e substituídos.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-warning-soft/30 border border-warning-strong/20 p-3 rounded-md flex gap-3 text-sm text-warning-strong">
                        <AlertCircle className="h-5 w-5 shrink-0" />
                        <p>
                            Esta ação preservará o histórico atual mas marcará os registros antigos como superados.
                            Todo o processamento de RH será recalculado para estes colaboradores.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="motivo" className="after:content-['*'] after:ml-0.5 after:text-destructive">
                            Motivo do Reprocessamento
                        </Label>
                        <Textarea
                            id="motivo"
                            placeholder="Ex: Correção de jornada em massa, ajuste de cargo no arquivo original..."
                            className="min-h-[100px]"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={loading}
                        className="bg-primary hover:bg-primary/90"
                    >
                        {loading ? "Processando..." : "Iniciar Reprocessamento"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
