import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, AlertTriangle, Loader2 } from 'lucide-react';

interface JustificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (justification: string) => void;
    title?: string;
    description?: string;
    status?: string;
    isLoading?: boolean;
}

export const JustificationModal: React.FC<JustificationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title = "Justificativa de Alteração (Override)",
    description = "Este registro está em um estado bloqueado. Como administrador, você pode realizar a alteração, mas deve fornecer uma justificativa clara para auditoria.",
    status,
    isLoading = false
}) => {
    const [justification, setJustification] = useState('');

    const handleConfirm = () => {
        if (justification.trim().length < 5) {
            return;
        }
        onConfirm(justification.trim());
        setJustification('');
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-warning-strong">
                        <ShieldAlert className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription className="py-2">
                        <div className="flex items-start gap-3 p-3 bg-warning-soft/20 rounded-lg border border-warning-strong/10 mb-4">
                            <AlertTriangle className="h-5 w-5 text-warning-strong shrink-0 mt-0.5" />
                            <div className="text-sm text-foreground">
                                {description}
                                {status && (
                                    <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Status Atual: <span className="text-warning-strong">{status}</span>
                                    </p>
                                )}
                            </div>
                        </div>
                        Por favor, descreva o motivo desta alteração:
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <Textarea
                        placeholder="Ex: Correção de valor após auditoria manual..."
                        className="min-h-[120px] esc-input focus:ring-warning-strong"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                        * Mínimo de 5 caracteres. Esta justificativa será gravada permanentemente no log de auditoria.
                    </p>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={onClose} className="esc-btn-ghost">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={justification.trim().length < 5 || isLoading}
                        className="bg-warning-strong hover:bg-warning-strong/90 text-white border-0"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            "Confirmar e Salvar"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
