import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OnboardingSuccessModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onContinue: () => void;
}

export function OnboardingSuccessModal({
    open,
    onOpenChange,
    onContinue,
}: OnboardingSuccessModalProps) {
    const navigate = useNavigate();

    const handleReturnToOnboarding = () => {
        onOpenChange(false);
        navigate("/onboarding");
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md text-center">
                <DialogHeader>
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                        </div>
                    </div>
                    <DialogTitle className="text-2xl text-center">Cadastro concluído</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                    <p className="text-muted-foreground">
                        O que você deseja fazer agora?
                    </p>
                </div>
                <DialogFooter className="sm:justify-center gap-3">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onOpenChange(false);
                            onContinue();
                        }}
                        className="flex-1"
                    >
                        Continuar cadastrando
                    </Button>
                    <Button
                        onClick={handleReturnToOnboarding}
                        className="flex-1"
                    >
                        Voltar ao onboarding
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
