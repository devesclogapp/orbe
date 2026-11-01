import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "./types";
import { StatusDiaristaBadge } from "./StatusDiaristaBadge";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Sparkles, CheckCircle2 } from "lucide-react";

export interface LancamentoEdicaoData {
    id: string;
    nome_colaborador: string;
    funcao_colaborador?: string;
    status?: string;
    data_lancamento: string;
    codigo_marcacao?: string;
    quantidade_diaria?: number;
    valor_diaria_base?: number;
    valor_calculado?: number;
    observacao?: string;
    lote_fechamento_id?: string;
    [key: string]: any;
}

export interface DrawerEdicaoDiaristaProps {
    isOpen: boolean;
    onClose: () => void;
    lancamento: LancamentoEdicaoData | null;
    loteContext?: {
        id: string;
        periodo_inicio: string;
        periodo_fim: string;
        [key: string]: any;
    } | null;
    valorAnterior?: number;
    isPending?: boolean;
    onConfirm: (formData: {
        id?: string;
        data_lancamento: string;
        codigo_marcacao: string;
        quantidade_diaria: number;
        valor_diaria_base: number;
        valor_calculado: number;
        observacao?: string;
        motivo_edicao: string;
    }) => void;
    isSimulation?: boolean;
}

export const DrawerEdicaoDiarista: React.FC<DrawerEdicaoDiaristaProps> = ({
    isOpen,
    onClose,
    lancamento,
    loteContext,
    valorAnterior: propValorAnterior,
    isPending = false,
    onConfirm,
    isSimulation = false,
}) => {
    const [editForm, setEditForm] = useState<{
        id?: string;
        data_lancamento: string;
        codigo_marcacao: string;
        quantidade_diaria: number;
        valor_diaria_base: number;
        valor_calculado: number;
        observacao?: string;
        motivo_edicao?: string;
    }>({
        data_lancamento: "",
        codigo_marcacao: "P",
        quantidade_diaria: 1,
        valor_diaria_base: 0,
        valor_calculado: 0,
        observacao: "",
        motivo_edicao: "",
    });

    const valorOriginal = propValorAnterior ?? Number(lancamento?.valor_calculado ?? 0);

    useEffect(() => {
        if (lancamento && isOpen) {
            setEditForm({
                id: lancamento.id,
                data_lancamento: lancamento.data_lancamento || "",
                codigo_marcacao: lancamento.codigo_marcacao || "P",
                quantidade_diaria: Number(lancamento.quantidade_diaria ?? 1),
                valor_diaria_base: Number(lancamento.valor_diaria_base ?? 0),
                valor_calculado: Number(lancamento.valor_calculado ?? 0),
                observacao: lancamento.observacao || "",
                motivo_edicao: "",
            });
        }
    }, [lancamento, isOpen]);

    const recalcularValor = (qtd: number, base: number) => {
        const total = Number((qtd * base).toFixed(2));
        setEditForm((prev) => ({
            ...prev,
            quantidade_diaria: qtd,
            valor_diaria_base: base,
            valor_calculado: total,
        }));
    };

    const handleConfirm = () => {
        if (!editForm.motivo_edicao || editForm.motivo_edicao.trim().length < 5) return;
        onConfirm({
            id: editForm.id,
            data_lancamento: editForm.data_lancamento,
            codigo_marcacao: editForm.codigo_marcacao,
            quantidade_diaria: editForm.quantidade_diaria,
            valor_diaria_base: editForm.valor_diaria_base,
            valor_calculado: editForm.valor_calculado,
            observacao: editForm.observacao,
            motivo_edicao: editForm.motivo_edicao.trim(),
        });
    };

    const isMotivoValido = !!editForm.motivo_edicao && editForm.motivo_edicao.trim().length >= 5;

    return (
        <DrawerPrimarioShell
            isOpen={isOpen && !!lancamento}
            onClose={onClose}
            title="Edição Administrativa de Lançamento"
            subtitle={lancamento ? `Apontamento de ${lancamento.nome_colaborador}` : undefined}
            badge={
                <Badge variant="outline" className="text-blue-700 dark:text-blue-400 bg-blue-500/10 border-blue-300 dark:border-blue-800">
                    Ajuste Autorizado
                </Badge>
            }
            tagline={lancamento?.funcao_colaborador ?? "Diarista"}
            widthClass="w-full sm:max-w-lg"
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
                        onClick={handleConfirm}
                        disabled={isPending || !isMotivoValido}
                        className="h-9 flex-[2] text-xs font-bold bg-[#2563EB] hover:bg-blue-700 text-white"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                Salvando Ajuste...
                            </>
                        ) : (
                            "Confirmar Alteração"
                        )}
                    </Button>
                </div>
            }
        >
            {lancamento && (
                <div className="space-y-4 pb-8">
                    {/* Alerta de simulação no preview */}
                    {isSimulation && (
                        <div className="p-2.5 bg-muted/40 border border-border/70 rounded-lg flex items-center gap-2 text-xs text-muted-foreground">
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                            <div>
                                <span className="font-semibold text-foreground">Modo de Pré-visualização Segura:</span> Nenhuma alteração real ou recálculo será disparado no banco de dados.
                            </div>
                        </div>
                    )}

                    {/* Bloco 1: Contexto com Nome Completo sem truncamento (Correção A) */}
                    <div className="p-3 bg-muted/20 border border-border/60 rounded-lg space-y-2">
                        <div className="flex items-start justify-between gap-3 pb-2 border-b border-border/50">
                            <div className="space-y-0.5 shrink-0">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Status Atual</p>
                                <StatusDiaristaBadge status={lancamento.status} />
                            </div>
                            <div className="text-right space-y-0.5 max-w-[65%] min-w-0">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Colaborador</p>
                                <p className="text-sm font-semibold text-foreground break-words leading-tight">{lancamento.nome_colaborador}</p>
                            </div>
                        </div>

                        {loteContext && (
                            <div className="grid grid-cols-2 gap-2 text-xs pt-0.5">
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Lote Vinculado</span>
                                    <span className="font-mono font-medium text-foreground">#{loteContext.id.slice(0, 8)}</span>
                                </div>
                                <div>
                                    <span className="text-muted-foreground block text-[11px]">Período</span>
                                    <span className="font-medium text-foreground">
                                        {format(new Date(loteContext.periodo_inicio + "T12:00:00"), "dd/MM")} - {format(new Date(loteContext.periodo_fim + "T12:00:00"), "dd/MM")}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Bloco 2: Parâmetros Editáveis */}
                    <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-foreground">Código de Marcação</Label>
                                <Select
                                    value={editForm.codigo_marcacao}
                                    onValueChange={(v) => {
                                        const qtd = v === "P" ? 1 : v === "MP" ? 0.5 : 0;
                                        recalcularValor(qtd, editForm.valor_diaria_base);
                                        setEditForm((prev) => ({ ...prev, codigo_marcacao: v }));
                                    }}
                                >
                                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="P" className="text-xs">P (Completa - 1.0)</SelectItem>
                                        <SelectItem value="MP" className="text-xs">MP (Meia - 0.5)</SelectItem>
                                        <SelectItem value="AUS" className="text-xs">AUS (Ausente - 0.0)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-foreground">Quantidade</Label>
                                <Input
                                    type="number"
                                    step="0.1"
                                    value={editForm.quantidade_diaria}
                                    onChange={(e) => recalcularValor(Number(e.target.value), editForm.valor_diaria_base)}
                                    className="h-9 font-mono text-xs"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-foreground">Data do Lançamento</Label>
                                <Input
                                    type="date"
                                    value={editForm.data_lancamento}
                                    onChange={(e) => setEditForm((prev) => ({ ...prev, data_lancamento: e.target.value }))}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-foreground">Valor Base (R$)</Label>
                                <Input
                                    type="number"
                                    value={editForm.valor_diaria_base}
                                    onChange={(e) => recalcularValor(editForm.quantidade_diaria, Number(e.target.value))}
                                    className="h-9 font-mono text-xs"
                                />
                            </div>
                        </div>

                        {/* Recálculo Visual (Correção C — Resumo Financeiro com Identificação de Prévia) */}
                        <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border/60">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prévia do Valor Calculado</Label>
                            <div className="flex items-center justify-between">
                                <span className="text-lg font-mono font-bold text-foreground">
                                    {formatCurrency(editForm.valor_calculado)}
                                </span>
                                <Badge variant="outline" className="font-mono text-[10px] bg-background">
                                    {editForm.quantidade_diaria} x {formatCurrency(editForm.valor_diaria_base)}
                                </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Cálculo preliminar em tempo real. O recálculo definitivo do lote será consolidado na confirmação.
                            </p>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-bold text-foreground">Observação Operacional</Label>
                            <Input
                                value={editForm.observacao ?? ""}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, observacao: e.target.value }))}
                                className="h-9 text-xs"
                                placeholder="Notas sobre o serviço..."
                            />
                        </div>
                    </div>

                    {/* Bloco 3: Impacto & Snapshot — Diferenciação Produção vs Preview */}
                    <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50 text-xs text-muted-foreground space-y-1">
                        <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                            <RefreshCw className="h-3 w-3 text-primary" /> Trilha de Auditoria & Recálculo
                        </span>
                        <p className="text-[11px] leading-relaxed">
                            {isSimulation ? (
                                "Ambiente demonstrativo de homologação: simulação em memória sem persistência de snapshot ou execução de RPC no banco de dados."
                            ) : (
                                `A alteração captura um snapshot com o valor anterior (${formatCurrency(valorOriginal)}), grava na trilha de auditoria e aciona o recálculo automático via RPC no banco de dados.`
                            )}
                        </p>
                    </div>

                    {/* Bloco 4: Próxima Ação (Justificativa Obrigatória — Correção B com Margem e Acessibilidade) */}
                    <div className="space-y-1.5 p-3 rounded-lg border border-border/70 bg-muted/10">
                        <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                            <span>Motivo da Alteração Administrativa <span className="text-rose-500">*</span></span>
                            <span className={cn(
                                "text-[10px] font-medium transition-colors",
                                isMotivoValido ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-muted-foreground"
                            )}>
                                {isMotivoValido ? (
                                    <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Válido</span>
                                ) : (
                                    "Mínimo 5 caracteres"
                                )}
                            </span>
                        </Label>
                        <Textarea
                            value={editForm.motivo_edicao ?? ""}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, motivo_edicao: e.target.value }))}
                            placeholder="Justificativa obrigatória para auditoria (ex: Ajuste autorizado de presença de 0.5 para 1.0)..."
                            className="bg-background resize-none text-xs min-h-[75px]"
                            rows={3}
                        />
                    </div>
                </div>
            )}
        </DrawerPrimarioShell>
    );
};
