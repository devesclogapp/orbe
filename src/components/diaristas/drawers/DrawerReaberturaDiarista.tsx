import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { formatCurrency } from "./types";
import { StatusDiaristaBadge } from "./StatusDiaristaBadge";
import {
    Loader2, RefreshCw, Lock, AlertTriangle, ShieldCheck, FileCheck, Sparkles
} from "lucide-react";

export interface LoteReaberturaData {
    id: string;
    periodo_inicio: string;
    periodo_fim: string;
    empresa_id?: string;
    empresa?: { nome: string; [key: string]: any };
    total_registros?: number;
    valor_total?: number;
    status?: string;
    [key: string]: any;
}

export interface DrawerReaberturaDiaristaProps {
    isOpen: boolean;
    onClose: () => void;
    lote: LoteReaberturaData | null;
    usuarioNome?: string;
    isPending?: boolean;
    onConfirm: (data: { loteId: string; motivo: string; tipo: 'operacional' | 'administrativa' }) => void;
    isSimulation?: boolean;
}

export const DrawerReaberturaDiarista: React.FC<DrawerReaberturaDiaristaProps> = ({
    isOpen,
    onClose,
    lote,
    usuarioNome = "Usuário",
    isPending = false,
    onConfirm,
    isSimulation = false,
}) => {
    const [motivoReabertura, setMotivoReabertura] = useState("");
    const [tipoReabertura, setTipoReabertura] = useState<'operacional' | 'administrativa'>('operacional');

    useEffect(() => {
        if (isOpen) {
            setMotivoReabertura("");
            setTipoReabertura('operacional');
        }
    }, [isOpen, lote?.id]);

    const handleConfirm = () => {
        if (!lote) return;
        if (!motivoReabertura.trim()) {
            toast.error("Informe o motivo da reabertura.");
            return;
        }

        onConfirm({
            loteId: lote.id,
            motivo: motivoReabertura.trim(),
            tipo: tipoReabertura,
        });
    };

    return (
        <DrawerPrimarioShell
            isOpen={isOpen && !!lote}
            onClose={onClose}
            title="Reabrir Período Operacional"
            subtitle={lote ? `Lote #${lote.id.slice(0, 8)} — ${format(new Date(lote.periodo_inicio + "T12:00:00"), "dd/MM/yy")} a ${format(new Date(lote.periodo_fim + "T12:00:00"), "dd/MM/yy")}` : undefined}
            badge={
                <Badge variant="outline" className="text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-300 dark:border-amber-800">
                    Reabertura de Ciclo
                </Badge>
            }
            tagline={lote?.empresa?.nome ?? lote?.empresa_id}
            footer={
                <div className="flex items-center gap-2 w-full">
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="flex-1 h-9 text-xs"
                        disabled={isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isPending || !motivoReabertura.trim()}
                        className={cn(
                            "flex-[2] h-9 text-xs font-bold",
                            tipoReabertura === 'administrativa'
                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                : "bg-blue-600 hover:bg-blue-700 text-white"
                        )}
                    >
                        {isPending ? (
                            <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Reabrindo...</>
                        ) : tipoReabertura === 'administrativa' ? (
                            <>🔒 Confirmar Reabertura Administrativa</>
                        ) : (
                            <>🔄 Confirmar Reabertura Operacional</>
                        )}
                    </Button>
                </div>
            }
        >
            {lote && (
                <div className="space-y-4 pb-6">
                    {/* Alerta de simulação no preview */}
                    {isSimulation && (
                        <div className="p-2.5 bg-muted/40 border border-border/70 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <div>
                                <span className="font-semibold text-foreground">Modo de Pré-visualização Segura:</span> Nenhuma mutação ou alteração será gravada no banco de dados.
                            </div>
                        </div>
                    )}

                    {/* Bloco 1: Contexto */}
                    <div className="p-3 bg-muted/20 border border-border/60 rounded-lg space-y-2">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider flex items-center gap-1.5">
                            <FileCheck className="h-3 w-3 text-primary" /> Contexto do Lote Selecionado
                        </p>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Empresa</span>
                                <span className="font-semibold text-foreground truncate block">
                                    {lote.empresa?.nome ?? lote.empresa_id ?? "—"}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Período</span>
                                <span className="font-mono font-medium text-foreground block">
                                    {format(new Date(lote.periodo_inicio + "T12:00:00"), "dd/MM/yyyy")} → {format(new Date(lote.periodo_fim + "T12:00:00"), "dd/MM/yyyy")}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Apontamentos</span>
                                <span className="font-mono font-bold text-foreground">
                                    {lote.total_registros ?? "—"} registros
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground block text-[11px]">Valor Consolidado</span>
                                <span className="font-mono font-bold text-foreground">
                                    {lote.valor_total != null ? formatCurrency(lote.valor_total) : "—"}
                                </span>
                            </div>
                        </div>
                        <div className="pt-1.5 border-t border-border/50 flex items-center justify-between">
                            <span className="text-[11px] text-muted-foreground">Status Atual:</span>
                            <StatusDiaristaBadge status={lote.status} />
                        </div>
                    </div>

                    {/* Bloco 2: Diagnóstico & Modalidade */}
                    <div className="space-y-2.5">
                        <Label className="text-xs font-bold text-foreground uppercase tracking-wider block">
                            Modalidade de Reabertura <span className="text-rose-500">*</span>
                        </Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div
                                onClick={() => setTipoReabertura('operacional')}
                                className={cn(
                                    "p-3 rounded-lg border cursor-pointer transition-all space-y-1 text-left",
                                    tipoReabertura === 'operacional'
                                        ? "border-blue-500 bg-blue-500/10 shadow-xs"
                                        : "border-border/70 hover:bg-muted/30"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <RefreshCw className="h-3.5 w-3.5 text-blue-600" /> Operacional
                                    </span>
                                    <input type="radio" checked={tipoReabertura === 'operacional'} readOnly />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Devolve os apontamentos para o Encarregado em <em>Em Aberto</em> para ajustes na ponta.
                                </p>
                            </div>

                            <div
                                onClick={() => setTipoReabertura('administrativa')}
                                className={cn(
                                    "p-3 rounded-lg border cursor-pointer transition-all space-y-1 text-left",
                                    tipoReabertura === 'administrativa'
                                        ? "border-amber-500 bg-amber-500/10 shadow-xs"
                                        : "border-border/70 hover:bg-muted/30"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                        <Lock className="h-3.5 w-3.5 text-amber-600" /> Administrativa
                                    </span>
                                    <input type="radio" checked={tipoReabertura === 'administrativa'} readOnly />
                                </div>
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Encarregado bloqueado. O RH ou Admin realiza as correções e revalida diretamente.
                                </p>
                            </div>
                        </div>

                        {tipoReabertura === 'administrativa' && (
                            <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 font-medium leading-relaxed flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                <div>
                                    <strong>Modo Administrativo Restrito:</strong> O encarregado na operação não terá permissão para fechar ou alterar este período. Todas as edições e a nova revalidação serão registradas em nome do RH/Administração.
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bloco 3: Impacto & Auditoria — Comunicação diferenciada Produção vs Preview */}
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border/60 space-y-1 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Trilha de Governança
                        </span>
                        <p className="text-[11px] leading-relaxed">
                            {isSimulation ? (
                                "Ambiente demonstrativo de homologação: nenhuma ação ou justificativa será gravada nos logs de auditoria ou no banco de dados."
                            ) : (
                                `Esta ação será registrada com data, hora, usuário (${usuarioNome}), perfil funcional e motivo nos logs imutáveis de auditoria.`
                            )}
                        </p>
                    </div>

                    {/* Bloco 4: Próxima Ação (Justificativa Obrigatória) */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>Motivo da Reabertura <span className="text-rose-500">*</span></span>
                            <span className="text-[10px] text-muted-foreground font-normal">Obrigatório para prosseguir</span>
                        </Label>
                        <Textarea
                            placeholder="Descreva a justificativa operacional ou administrativa para a auditoria..."
                            value={motivoReabertura}
                            onChange={(e) => setMotivoReabertura(e.target.value)}
                            className="resize-none text-xs min-h-[80px]"
                            rows={3}
                        />
                    </div>
                </div>
            )}
        </DrawerPrimarioShell>
    );
};
