import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Sheet,
    SheetContent,
    SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
    Building2, Calendar, DollarSign, Receipt, Clock,
    CheckCircle2, X, ChevronRight, Layers, FileText,
    Loader2, Hash, ArrowRightLeft
} from "lucide-react";
import {
    ReceitaDetalhesDrawer,
    RECEITA_DRAWER_WIDTH_CLASS,
    type PipelineStageItem
} from "./ReceitaDetalhesDrawer";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { formatDateOnly } from "@/utils/financeiro";
import { ReceitaOperacional } from "@/types/receitas.types";

const formatCurrency = (value?: number | null) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value || 0));

const formatDateTime = (value?: string | null) => {
    if (!value) return "—";
    return new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

export interface ConciliacaoReceitaDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    receita: (ReceitaOperacional & { empresas?: { nome: string } }) | null;
    onConfirmConciliacao: (id: string) => void;
    isSubmitting: boolean;
    canConciliar: boolean;
}

export function ConciliacaoReceitaDrawer({
    isOpen,
    onClose,
    receita,
    onConfirmConciliacao,
    isSubmitting,
    canConciliar,
}: ConciliacaoReceitaDrawerProps) {
    const [isDetalhesOpen, setIsDetalhesOpen] = useState(false);

    // Carregamento de detalhes da receita para resolução precisa de origem e itens
    const { data: detalhesReceita, isLoading: isLoadingDetalhes, error: errDetalhes } = useQuery({
        queryKey: ['receita-detalhes', receita?.id],
        queryFn: () => ReceitasService.getReceitaDetalhes(receita!.id),
        enabled: isOpen && !!receita?.id,
        staleTime: 0
    });

    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ['receita-historico', receita?.id],
        queryFn: () => ReceitasService.getHistorico(receita!.id),
        enabled: isOpen && !!receita?.id
    });

    const isConciliado = receita?.status === 'conciliado';
    const isRecebido = receita?.status === 'recebido';

    const itemOps = useMemo(() => {
        return detalhesReceita?.receitas_operacionais_itens?.[0]?.operacoes_producao || null;
    }, [detalhesReceita]);

    const itemExtra = useMemo(() => {
        return detalhesReceita?.receitas_operacionais_itens?.[0]?.servicos_extras_operacionais || null;
    }, [detalhesReceita]);

    const itemCount = useMemo(() => {
        return detalhesReceita?.receitas_operacionais_itens?.length || 1;
    }, [detalhesReceita]);

    const origemInfo = useMemo(() => {
        if (!receita) return { label: "Receita Operacional", ref: "—" };
        if (receita.modalidade === 'FATURAMENTO_MENSAL' || itemCount > 1) {
            return {
                label: "Faturamento Mensal",
                ref: `FAT MENSAL (${itemCount} lançamentos)`,
            };
        }
        if (itemExtra) {
            return {
                label: "Serviço Extra",
                ref: `SE #${itemExtra.id?.substring(0, 8)}`,
            };
        }
        if (itemOps) {
            return {
                label: "Operação por Volume",
                ref: `OP #${itemOps.id?.substring(0, 8)}`,
            };
        }
        return {
            label: "Receita Operacional",
            ref: `REC #${receita.id?.substring(0, 8)}`,
        };
    }, [receita, itemExtra, itemOps, itemCount]);

    const modalidadeBadgeClass = useMemo(() => {
        if (!receita) return "";
        switch (receita.modalidade) {
            case "CAIXA_IMEDIATO":
                return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300";
            case "DUPLICATA":
                return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300";
            case "FATURAMENTO_MENSAL":
                return "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300";
            default:
                return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300";
        }
    }, [receita?.modalidade]);

    // Etapas para o Drawer 2 (Detalhes Técnicos / Fluxo Completo)
    const pipelineStages: PipelineStageItem[] = useMemo(() => {
        const origemNome = itemExtra ? "Serviço Extra" : (itemOps ? "Operação por Volume" : "Origem Operacional");
        return [
            {
                id: "origem",
                label: origemNome,
                compactLabel: itemExtra ? "Serv. Extra" : (itemOps ? "Op. Volume" : "Origem"),
                responsible: "Operação / Encarregado",
                description: "Serviço ou operação executada e validada operacionalmente.",
                status: "done",
            },
            {
                id: "receita",
                label: "Receita",
                compactLabel: "Receita",
                responsible: "Sistema / Operação",
                description: "Receita classificada e registrada no módulo Financeiro.",
                status: "done",
            },
            {
                id: "recebimento",
                label: "Recebimento",
                compactLabel: "Recebimento",
                responsible: "Financeiro / Caixa",
                description: "Comprovante informado e crédito inicial registrado no ORBE.",
                status: "done",
            },
            {
                id: "conciliacao",
                label: "Conciliação",
                compactLabel: "Conciliação",
                responsible: "Financeiro / Tesouraria",
                description: "Conferência no extrato bancário real e liquidação definitiva.",
                status: isConciliado ? "done" : "current",
            },
        ];
    }, [itemExtra, itemOps, isConciliado]);

    if (!receita) return null;

    const clienteNome = receita.empresas?.nome || "Sem identificação";
    const valorStr = formatCurrency(receita.valor_total);
    const compStr = receita.competencia || "Avulso";
    const dataRecebimentoStr = formatDateTime(receita.updated_at);

    return (
        <>
            <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <SheetContent
                    side="right"
                    className={cn(
                        RECEITA_DRAWER_WIDTH_CLASS,
                        "p-0 flex flex-col h-full bg-background border-l shadow-2xl overflow-hidden"
                    )}
                >
                    {/* Cabeçalho Compacto do Drawer Canônico */}
                    <header className="p-5 border-b border-border bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between shrink-0">
                        <div className="space-y-1 pr-4 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                    variant="outline"
                                    className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300"
                                >
                                    CONCILIAÇÃO BANCÁRIA
                                </Badge>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    Auditoria de Faturamento
                                </span>
                            </div>
                            <SheetTitle className="font-display text-lg font-bold text-foreground text-left truncate">
                                Conciliação da Receita
                            </SheetTitle>
                            <p className="text-xs text-muted-foreground leading-relaxed truncate">
                                Conferência prévia antes da baixa e conciliação definitiva no extrato.
                            </p>
                        </div>

                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                            onClick={onClose}
                            aria-label="Fechar painel"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </header>

                    {/* Corpo com Scroll */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-4">
                        {/* 1. Status Bar Compacta (Faixa única no desktop, máx 2 linhas no mobile — UX-2B.13 / UX-2B.15) */}
                        <div
                            className={cn(
                                "rounded-lg border px-3 py-2 flex items-center justify-between gap-2.5 transition-colors min-h-[48px]",
                                isConciliado
                                    ? "bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800"
                                    : "bg-blue-50/70 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800"
                            )}
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="p-1 rounded-md bg-white/80 dark:bg-black/30 shrink-0 shadow-2xs">
                                    {isConciliado ? (
                                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    ) : (
                                        <Clock className="h-4 w-4 text-blue-600" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                    <h3 className="text-xs font-bold text-foreground truncate">
                                        {isConciliado ? "Recebimento Conciliado" : "Recebido / Aguardando conciliação"}
                                    </h3>
                                    <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                                        • {isConciliado ? "Conferência confirmada no extrato" : "Pendente de conciliação bancária"}
                                    </span>
                                </div>
                            </div>
                            <Badge
                                variant="outline"
                                className={cn(
                                    "text-[10px] font-semibold h-5 px-2 shrink-0 uppercase tracking-tight",
                                    isConciliado
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                                        : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300"
                                )}
                            >
                                {isConciliado ? "CONCILIADO" : "AGUARDANDO CONCILIAÇÃO"}
                            </Badge>
                        </div>

                        {/* 2. Orientação Curta de Conferência Bancária (UX-2B.15) */}
                        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200/80 bg-amber-50/70 dark:bg-amber-950/20 text-xs text-amber-900 dark:text-amber-200">
                            <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="space-y-0.5 leading-relaxed">
                                <span className="font-semibold block">
                                    Confira o crédito no extrato bancário antes de concluir a conciliação.
                                </span>
                                <span className="text-[11px] text-amber-800/80 dark:text-amber-300/80 block">
                                    Confirme somente após verificar que este recebimento consta no extrato bancário real.
                                </span>
                            </div>
                        </div>

                        {/* 3. Card de Dados Essenciais da Receita */}
                        <section className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3.5 border border-border/80 space-y-2.5 text-xs">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-1 border-b border-border/60">
                                Dados Essenciais da Receita
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                                <div className="flex items-center gap-2">
                                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Cliente / Empresa</div>
                                        <div className="font-semibold text-foreground truncate">
                                            {clienteNome}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Competência</div>
                                        <div className="font-semibold text-foreground truncate">
                                            {compStr}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Valor Total</div>
                                        <div className="font-bold text-foreground truncate text-emerald-700 dark:text-emerald-400">
                                            {valorStr}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Receipt className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Modalidade</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="outline" className={cn("text-[10px] font-semibold h-4 px-1.5 uppercase", modalidadeBadgeClass)}>
                                                {receita.modalidade?.replace(/_/g, ' ')}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Data do Recebimento</div>
                                        <div className="font-semibold text-foreground truncate">
                                            {dataRecebimentoStr}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Layers className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Origem Operacional</div>
                                        <div className="font-semibold text-foreground truncate">
                                            {origemInfo.label}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-1 border-t border-border/60 flex items-center gap-2">
                                <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <div className="text-[10px] text-muted-foreground">Referência do Lançamento</div>
                                    <div className="font-mono text-xs text-foreground truncate font-medium">
                                        {origemInfo.ref}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 4. Resumo Compacto do Pipeline (UX-2B.15: Receita ✓ → Recebimento ✓ → Conciliação ●) */}
                        <section className="space-y-1.5">
                            <div className="flex items-center justify-between pb-0.5">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <ArrowRightLeft className="h-3.5 w-3.5 text-primary" /> Contexto do Pipeline
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground">
                                    {isConciliado ? "3 de 3 concluídas" : "2 de 3 concluídas"}
                                </span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsDetalhesOpen(true)}
                                className="w-full text-left p-2.5 rounded-lg border border-border/80 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100/90 dark:hover:bg-slate-900 transition-all group shadow-2xs hover:border-primary/50 cursor-pointer space-y-1.5"
                                title="Clique para ver os detalhes completos da operação"
                            >
                                <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-1 border-b border-border/40">
                                    <span className="font-semibold text-foreground/80">
                                        Etapas do Fluxo
                                    </span>
                                    <span className="text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform font-bold">
                                        <span>Ver detalhes completos</span>
                                        <ChevronRight className="h-3 w-3" />
                                    </span>
                                </div>

                                <div className="flex items-center justify-between gap-1 w-full flex-wrap sm:flex-nowrap pt-0.5">
                                    {/* Etapa 1: Receita ✓ */}
                                    <div className="flex items-center gap-1 min-w-0 shrink">
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-[11px] flex items-center gap-1">
                                            <span>Receita</span>
                                            <span className="text-emerald-600 font-bold shrink-0">✓</span>
                                        </span>
                                        <span className="text-muted-foreground/40 font-mono text-[9px] sm:text-[10px] shrink-0 mx-0.5">→</span>
                                    </div>

                                    {/* Etapa 2: Recebimento ✓ */}
                                    <div className="flex items-center gap-1 min-w-0 shrink">
                                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-[10px] sm:text-[11px] flex items-center gap-1">
                                            <span>Recebimento</span>
                                            <span className="text-emerald-600 font-bold shrink-0">✓</span>
                                        </span>
                                        <span className="text-muted-foreground/40 font-mono text-[9px] sm:text-[10px] shrink-0 mx-0.5">→</span>
                                    </div>

                                    {/* Etapa 3: Conciliação ● */}
                                    <div className="flex items-center gap-1 min-w-0 shrink">
                                        <span
                                            className={cn(
                                                "font-medium flex items-center gap-1 text-[10px] sm:text-[11px]",
                                                isConciliado
                                                    ? "text-emerald-700 dark:text-emerald-400 font-semibold"
                                                    : "text-foreground font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded shadow-2xs"
                                            )}
                                        >
                                            <span>Conciliação</span>
                                            {isConciliado ? (
                                                <span className="text-emerald-600 font-bold shrink-0">✓</span>
                                            ) : (
                                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </button>
                        </section>
                    </div>

                    {/* Rodapé Fixo com Ação Definitiva */}
                    <footer className="p-4 border-t border-border bg-slate-50/70 dark:bg-slate-900/50 space-y-2 shrink-0">
                        {!isConciliado ? (
                            <Button
                                onClick={() => onConfirmConciliacao(receita.id)}
                                disabled={isSubmitting || !canConciliar}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 gap-2 shadow-sm"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Conciliando Receita...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span>Confirmar Conciliação</span>
                                    </>
                                )}
                            </Button>
                        ) : (
                            <div className="text-center py-2 text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                Receita conciliada no extrato bancário
                            </div>
                        )}

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="w-full text-xs text-muted-foreground hover:text-foreground h-8"
                        >
                            Fechar
                        </Button>
                    </footer>
                </SheetContent>
            </Sheet>

            {/* Segundo Nível Reutilizável: ReceitaDetalhesDrawer (z-[60]) */}
            <ReceitaDetalhesDrawer
                isOpen={isDetalhesOpen}
                onClose={() => setIsDetalhesOpen(false)}
                receita={receita}
                detalhesReceita={detalhesReceita}
                isLoadingDetalhes={isLoadingDetalhes}
                errDetalhes={errDetalhes}
                formatDateOnly={formatDateOnly}
                itemOps={itemOps}
                itemExtra={itemExtra}
                itemCount={itemCount}
                isCaixaImediato={receita?.modalidade === 'CAIXA_IMEDIATO'}
                isFaturamentoMensal={receita?.modalidade === 'FATURAMENTO_MENSAL'}
                isPendenteCobranca={false}
                isCobrancaEnviada={false}
                isRecebido={isRecebido}
                isConciliado={isConciliado}
                historico={historico}
                isLoadingHistorico={isLoadingHistorico}
                initialTab="detalhes"
                pipelineStages={pipelineStages}
            />
        </>
    );
}
