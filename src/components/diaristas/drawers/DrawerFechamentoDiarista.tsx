import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileCheck, AlertTriangle, Sparkles } from "lucide-react";

export interface DrawerFechamentoDiaristaProps {
    isOpen: boolean;
    onClose: () => void;
    empresaNome?: string;
    periodoInicio?: string;
    periodoFim?: string;
    totalEmAberto: number;
    isPending?: boolean;
    onConfirm: (obs: string) => void;
    isSimulation?: boolean;
}

export const DrawerFechamentoDiarista: React.FC<DrawerFechamentoDiaristaProps> = ({
    isOpen,
    onClose,
    empresaNome = "Empresa Atual",
    periodoInicio,
    periodoFim,
    totalEmAberto,
    isPending = false,
    onConfirm,
    isSimulation = false,
}) => {
    const [confirmText, setConfirmText] = useState("");
    const [obsLote, setObsLote] = useState("");

    useEffect(() => {
        if (isOpen) {
            setConfirmText("");
            setObsLote("");
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (confirmText !== "FECHAR") return;
        onConfirm(obsLote);
    };

    const isConfirmDisabled = confirmText !== "FECHAR" || isPending;

    return (
        <DrawerPrimarioShell
            isOpen={isOpen}
            onClose={onClose}
            title="Confirmar Fechamento de Período"
            subtitle={`Período: ${periodoInicio ? format(new Date(periodoInicio + "T12:00:00"), "dd/MM/yyyy") : ""} a ${periodoFim ? format(new Date(periodoFim + "T12:00:00"), "dd/MM/yyyy") : ""}`}
            badge={
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-300 dark:border-amber-800">
                    Ação Crítica
                </Badge>
            }
            tagline="Consolidação e Envio ao RH"
            footer={
                <div className="flex items-center gap-2 w-full">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="h-9 flex-1 text-xs"
                        disabled={isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        className="h-9 flex-[2] text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                        disabled={isConfirmDisabled}
                        onClick={handleConfirm}
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                Consolidando Lote...
                            </>
                        ) : (
                            "Confirmar e Fechar"
                        )}
                    </Button>
                </div>
            }
        >
            <div className="space-y-4 pb-6">
                {/* Alerta de simulação no preview */}
                {isSimulation && (
                    <div className="p-2.5 bg-muted/40 border border-border/70 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <div>
                            <span className="font-semibold text-foreground">Modo de Pré-visualização Segura:</span> O fechamento não gerará lotes reais nem bloqueará apontamentos na ponta.
                        </div>
                    </div>
                )}

                {/* Bloco 1: Contexto */}
                <div className="p-3 bg-muted/20 border border-border/60 rounded-lg space-y-2">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                        <FileCheck className="h-3 w-3 text-amber-600" /> Resumo da Consolidação
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Empresa</span>
                            <span className="font-semibold text-foreground truncate block">
                                {empresaNome}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Período Fechado</span>
                            <span className="font-mono font-medium text-foreground block">
                                {periodoInicio ? format(new Date(periodoInicio + "T12:00:00"), "dd/MM") : ""} → {periodoFim ? format(new Date(periodoFim + "T12:00:00"), "dd/MM") : ""}
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Apontamentos em Aberto</span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                {totalEmAberto} registro(s)
                            </span>
                        </div>
                        <div>
                            <span className="text-muted-foreground block text-[11px]">Status Após Fechamento</span>
                            <span className="font-semibold text-primary">
                                AGUARDANDO_VALIDACAO_RH
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bloco 2: Consequências & Impacto */}
                <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-1.5 text-xs text-amber-900 dark:text-amber-300">
                    <span className="font-bold flex items-center gap-1.5 text-xs">
                        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /> Consequências Operacionais
                    </span>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] leading-relaxed">
                        <li>Todos os apontamentos em aberto no intervalo serão consolidados em um único lote.</li>
                        <li>O encarregado não poderá mais lançar ou alterar marcações deste ciclo na ponta.</li>
                        <li>O lote será disponibilizado imediatamente para a fila de conferência e validação do RH.</li>
                    </ul>
                </div>

                {/* Bloco 3: Observações do Lote */}
                <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground">Observações do Lote (opcional)</Label>
                    <Input
                        value={obsLote}
                        onChange={(e) => setObsLote(e.target.value)}
                        placeholder="Ex: Fechamento regular da semana 40/2026..."
                        className="h-9 text-xs"
                    />
                </div>

                {/* Bloco 4: Próxima Ação (Confirmação Textual Crítica — Padrão de Alinhamento Homologado ORBE) */}
                <div className="space-y-2 p-3 bg-muted/20 border border-border/70 rounded-lg">
                    <Label htmlFor="fechamento-confirmacao" className="text-xs font-bold text-foreground flex items-center justify-between">
                        <span>Confirmação Textual Obrigatória <span className="text-rose-500">*</span></span>
                    </Label>
                    
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2.5 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground text-[11px]">Palavra-chave de segurança:</span>
                        <span className="font-mono font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800 tracking-wider">
                            FECHAR
                        </span>
                    </div>

                    <Input
                        id="fechamento-confirmacao"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        className="h-9 font-mono text-xs font-semibold tracking-wider uppercase bg-background"
                        placeholder="FECHAR"
                        autoFocus
                    />
                    <p className="text-[10px] text-muted-foreground">
                        O botão de confirmação permanecerá bloqueado até que a palavra seja digitada exatamente como exibida.
                    </p>
                </div>
            </div>
        </DrawerPrimarioShell>
    );
};
