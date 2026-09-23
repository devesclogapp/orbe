import React, { useState, useEffect } from "react";
import {
    Building2, Calendar, FileText, Send, CheckCircle, Clock,
    Layers, User, Truck, ShieldAlert, ArrowLeft, X, ExternalLink,
    Check, Circle
} from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface PipelineStageItem {
    id: string;
    label: string;
    compactLabel?: string;
    responsible: string;
    description: string;
    status: 'done' | 'current' | 'pending';
}

/**
 * Largura canônica padronizada compartilhada entre Drawer 1 (Receita) e Drawer 2 (Detalhes Técnicos / Fluxo Completo).
 * Garante que ambos os drawers possuam exatamente a mesma largura visual (UX-2B.14).
 */
export const RECEITA_DRAWER_WIDTH_CLASS = "w-full sm:max-w-md md:max-w-[480px]";

export interface ReceitaDetalhesDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    receita: any;
    detalhesReceita: any;
    isLoadingDetalhes: boolean;
    errDetalhes: any;
    formatDateOnly: (date: any) => string;
    onNavigateToOp?: (opId: string) => void;
    itemOps?: any;
    itemExtra?: any;
    itemCount?: number;
    isCaixaImediato?: boolean;
    isFaturamentoMensal?: boolean;
    isPendenteCobranca?: boolean;
    isCobrancaEnviada?: boolean;
    isRecebido?: boolean;
    isConciliado?: boolean;
    hasDocumentoGerado?: boolean;
    documentosGerados?: any[];
    historico?: any[];
    isLoadingHistorico?: boolean;
    setActionView?: (view: any) => void;
    initialTab?: 'fluxo' | 'detalhes' | 'documentos' | 'historico';
    pipelineStages?: PipelineStageItem[];
}

export const ReceitaDetalhesDrawer: React.FC<ReceitaDetalhesDrawerProps> = ({
    isOpen,
    onClose,
    receita,
    detalhesReceita,
    isLoadingDetalhes,
    errDetalhes,
    formatDateOnly,
    onNavigateToOp,
    itemOps,
    itemExtra,
    itemCount = 0,
    isCaixaImediato = false,
    isFaturamentoMensal = false,
    isPendenteCobranca = false,
    isCobrancaEnviada = false,
    isRecebido = false,
    isConciliado = false,
    hasDocumentoGerado = false,
    documentosGerados = [],
    historico = [],
    isLoadingHistorico = false,
    setActionView,
    initialTab = 'detalhes',
    pipelineStages = [],
}) => {
    if (!receita) return null;

    const op = itemOps;
    const se = itemExtra;

    const [activeTab, setActiveTab] = useState<'fluxo' | 'detalhes' | 'documentos' | 'historico'>(initialTab);

    useEffect(() => {
        if (isOpen && initialTab) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    return (
        <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <SheetContent
                side="right"
                className={cn(RECEITA_DRAWER_WIDTH_CLASS, "z-[60] bg-background p-0 border-l border-border shadow-2xl flex flex-col h-full overflow-hidden")}
            >
                {/* Cabeçalho do Drawer 2 com Ação de Voltar ao Drawer 1 */}
                <header className="p-4 border-b border-border bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            <span>Voltar ao Fluxo</span>
                        </Button>
                        <div className="h-4 w-px bg-border mx-1" />
                        <div>
                            <SheetTitle className="text-sm font-bold text-foreground leading-tight">
                                Detalhes Técnicos & Auditoria
                            </SheetTitle>
                            <span className="text-[11px] text-muted-foreground">
                                {se ? `Serviço Extra SE #${se.id?.substring(0, 8)}` : op ? `Operação OP #${op.id?.substring(0, 8)}` : 'Receita Operacional'}
                            </span>
                        </div>
                    </div>

                    <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground shrink-0"
                        onClick={onClose}
                        aria-label="Fechar detalhes"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </header>

                {/* Conteúdo com Abas Especializadas */}
                <div className="flex-1 overflow-y-auto p-5">
                    <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-full space-y-4">
                        <TabsList className="grid w-full grid-cols-4 bg-slate-100 dark:bg-slate-900 mb-2">
                            <TabsTrigger value="fluxo">Fluxo</TabsTrigger>
                            <TabsTrigger value="detalhes">Operacional</TabsTrigger>
                            <TabsTrigger value="documentos">Documentos</TabsTrigger>
                            <TabsTrigger value="historico">Timeline</TabsTrigger>
                        </TabsList>

                        {/* ABA 00: FLUXO COMPLETO DETALHADO */}
                        <TabsContent value="fluxo" className="m-0 focus-visible:ring-0 space-y-4">
                            <div>
                                <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-primary" /> Fluxo Completo da Receita Operacional
                                        </h4>
                                        <p className="text-xs text-gray-500 leading-relaxed mt-0.5">
                                            Visão detalhada de cada etapa do pipeline, responsáveis, status e contexto de continuidade.
                                        </p>
                                    </div>
                                    {pipelineStages.length > 0 && (
                                        <span className="text-[11px] font-medium text-muted-foreground bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                            {pipelineStages.filter(s => s.status === 'done').length} de {pipelineStages.length} etapas
                                        </span>
                                    )}
                                </div>

                                {/* Stepper Vertical Detalhado Completo */}
                                <div className="space-y-1 pt-2">
                                    {pipelineStages.map((stage, idx) => {
                                        const isStepDone = stage.status === "done";
                                        const isStepCurrent = stage.status === "current";
                                        const isStepPending = stage.status === "pending";
                                        const isLast = idx === pipelineStages.length - 1;

                                        return (
                                            <div key={stage.id} className="flex gap-3 relative">
                                                <div className="flex flex-col items-center">
                                                    {isStepDone ? (
                                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs">
                                                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                                                        </div>
                                                    ) : isStepCurrent ? (
                                                        <div className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white ring-3 ring-primary/20 ring-offset-1 ring-offset-background shadow-xs">
                                                            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping opacity-75" />
                                                            <Circle className="h-2.5 w-2.5 fill-white text-white" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 dark:border-slate-700 bg-muted/40">
                                                            <Circle className="h-1.5 w-1.5 fill-slate-300 text-slate-300 dark:fill-slate-600 dark:text-slate-600" />
                                                        </div>
                                                    )}

                                                    {!isLast && (
                                                        <div
                                                            className={cn(
                                                                "w-0.5 my-1 flex-1 min-h-[36px]",
                                                                isStepDone ? "bg-emerald-400/80" : "bg-border/70"
                                                            )}
                                                        />
                                                    )}
                                                </div>

                                                <div
                                                    className={cn(
                                                        "flex-1 pb-4 min-w-0 transition-all p-3.5 -mt-1 rounded-lg border",
                                                        isStepCurrent
                                                            ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary border-border shadow-xs"
                                                            : isStepDone
                                                            ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30"
                                                            : "bg-slate-50/50 dark:bg-slate-900/30 border-border/60",
                                                        isLast && "pb-2"
                                                    )}
                                                >
                                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span
                                                                className={cn(
                                                                    "text-xs",
                                                                    isStepDone && "font-semibold text-emerald-700 dark:text-emerald-400",
                                                                    isStepCurrent && "font-bold text-foreground text-sm",
                                                                    isStepPending && "font-medium text-muted-foreground/70"
                                                                )}
                                                            >
                                                                {stage.label}
                                                            </span>

                                                            {isStepDone && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] font-semibold h-4 px-1.5 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                                >
                                                                    ✓ Concluído
                                                                </Badge>
                                                            )}

                                                            {isStepCurrent && (
                                                                <Badge
                                                                    className="text-[10px] font-bold uppercase tracking-tight h-5 px-2 bg-primary text-primary-foreground shadow-xs animate-pulse"
                                                                >
                                                                    ● Você está aqui
                                                                </Badge>
                                                            )}

                                                            {isStepPending && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] font-medium h-4 px-1.5 bg-muted/80 text-muted-foreground border-border"
                                                                >
                                                                    Pendente
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        <span className="text-[11px] text-muted-foreground font-medium bg-background/80 px-2 py-0.5 rounded border border-border/50">
                                                            {stage.responsible}
                                                        </span>
                                                    </div>

                                                    <p
                                                        className={cn(
                                                            "mt-1.5 text-xs leading-relaxed",
                                                            isStepCurrent ? "text-foreground/90 font-medium" : "text-muted-foreground/80"
                                                        )}
                                                    >
                                                        {stage.description}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Contexto da Continuidade */}
                                <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg">
                                    <h5 className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider mb-1">
                                        Contexto de Continuidade Operacional
                                    </h5>
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Este pipeline é sincronizado em tempo real. As alterações realizadas no Caixa, Cobrança ou Conciliação avançam automaticamente os nós de estado sem perder o rastreamento da origem.
                                    </p>
                                </div>
                            </div>
                        </TabsContent>

                        {/* ABA 01: OPERACIONAL */}
                        <TabsContent value="detalhes" className="m-0 focus-visible:ring-0 space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-3 mx-1">
                                    {(() => {
                                        const itens = detalhesReceita?.receitas_operacionais_itens || [];
                                        let tituloSecao = "Detalhes dos Lançamentos";
                                        if (itens.length > 0) {
                                            const temOp = itens.some((i: any) => i.operacao_id || i.operacoes_producao);
                                            const temSe = itens.some((i: any) => i.servico_extra_id || i.servicos_extras_operacionais);
                                            if (temOp && !temSe) tituloSecao = "Detalhes das Operações";
                                            else if (temSe && !temOp) tituloSecao = "Detalhes dos Serviços Extras";
                                            else tituloSecao = "Detalhes dos Lançamentos";
                                        }
                                        return (
                                            <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-gray-500" /> {tituloSecao}
                                            </h4>
                                        );
                                    })()}
                                    {isLoadingDetalhes && <span className="text-xs text-gray-400 animate-pulse">Carregando dados...</span>}
                                </div>

                                {errDetalhes && (
                                    <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-xs font-mono">
                                        <strong>ERRO API:</strong> {errDetalhes instanceof Error ? errDetalhes.message : JSON.stringify(errDetalhes)}
                                    </div>
                                )}

                                {detalhesReceita?.receitas_operacionais_itens?.length > 0 ? (
                                    receita.modalidade === 'FATURAMENTO_MENSAL' ? (
                                        <div className="space-y-4">
                                            {/* TABELA CONSOLIDADA DE ITENS MENSAL */}
                                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-sm">
                                                <div className="bg-gray-50/80 dark:bg-slate-800/60 px-4 py-3 border-b flex items-center justify-between">
                                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                                                        Lançamentos Consolidados da Competência ({detalhesReceita.receitas_operacionais_itens.length})
                                                    </span>
                                                    <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                        {receita.observacao === 'FATURA_COMPLEMENTAR' ? 'Faturamento Mensal (Complementar)' : 'Faturamento Mensal'}
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-gray-50/50 text-gray-500 border-b border-gray-100 font-semibold uppercase text-[10px]">
                                                            <tr>
                                                                <th className="px-4 py-2.5">Data</th>
                                                                <th className="px-3 py-2.5">Origem / ID</th>
                                                                <th className="px-3 py-2.5">Serviço / Descrição</th>
                                                                <th className="px-3 py-2.5 text-center">Qtd</th>
                                                                <th className="px-3 py-2.5 text-right">V. Unitário</th>
                                                                <th className="px-4 py-2.5 text-right font-bold text-gray-700">Subtotal</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100 text-gray-700 dark:text-gray-300">
                                                            {detalhesReceita.receitas_operacionais_itens.map((item: any) => {
                                                                const itOp = item.operacoes_producao;
                                                                const itSe = item.servicos_extras_operacionais;
                                                                const dataStr = itOp?.data_operacao ? formatDateOnly(itOp.data_operacao) : formatDateOnly(itSe?.data || itSe?.data_servico);
                                                                const servicoNome = itOp?.servicos?.nome || itOp?.servicos?.descricao || itSe?.tipo_servico || 'Serviço Operacional';
                                                                const prodNome = itOp?.produtos?.nome ? ` - ${itOp.produtos.nome}` : (itSe?.descricao && itSe?.tipo_servico ? ` (${itSe.descricao})` : (itSe?.descricao ? ` - ${itSe.descricao}` : ''));
                                                                const qtd = itOp?.quantidade || itSe?.quantidade || 1;
                                                                const vUnit = Number(itOp?.valor_unitario_snapshot ?? itOp?.valor_unitario ?? itSe?.valor_unitario ?? 0);
                                                                const valItem = Number(item.valor_item || itOp?.valor_total || itSe?.valor_total || 0);

                                                                return (
                                                                    <tr key={item.id} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition-colors">
                                                                        <td className="px-4 py-3 font-medium whitespace-nowrap">{dataStr}</td>
                                                                        <td className="px-3 py-3">
                                                                            {itOp ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => onNavigateToOp?.(itOp.id)}
                                                                                    className="font-bold text-blue-600 hover:underline tracking-wide"
                                                                                    title="Ver na Recepção Operacional"
                                                                                >
                                                                                    OP #{itOp.id.substring(0, 8)}
                                                                                </button>
                                                                            ) : itSe ? (
                                                                                <span className="font-bold text-purple-600 tracking-wide">
                                                                                    SE #{itSe.id.substring(0, 8)}
                                                                                </span>
                                                                            ) : '-'}
                                                                        </td>
                                                                        <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">
                                                                            {servicoNome}{prodNome}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-center">{qtd}</td>
                                                                        <td className="px-3 py-3 text-right">R$ {vUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                        <td className="px-4 py-3 text-right font-bold text-blue-700">R$ {valItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* LANÇAMENTO AVULSO DETALHADO (Operação ou Serviço Extra) */
                                        <div className="space-y-4">
                                            {detalhesReceita.receitas_operacionais_itens.map((item: any) => {
                                                const itOp = item.operacoes_producao;
                                                const itSe = item.servicos_extras_operacionais;

                                                return (
                                                    <div key={item.id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 shadow-sm space-y-5">
                                                        {itOp ? (
                                                            <div className="flex flex-col gap-5">
                                                                {/* BLOCO 02: Origem Operacional */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">Origem da Receita</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Origem</span> <span className="font-semibold text-blue-700 block">Operação por Volume</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Nº Registro</span> <span className="font-bold text-gray-800 dark:text-gray-200 tracking-wide block">OP #{itOp.id?.substring(0, 8) || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Data Operação</span> <span className="font-medium text-gray-700 dark:text-gray-300">{formatDateOnly(itOp.data_operacao)}</span></div>
                                                                        <div>
                                                                            <span className="text-gray-400 text-xs block mb-0.5">Status Aprovação</span>
                                                                            <span className="font-medium text-emerald-700 uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{itOp.status?.replace('_', ' ') || 'Aprovado'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 03: Detalhamento Operacional */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">Detalhamento Operacional</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Tipo de Serviço</span> <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">{itOp.servicos?.nome || itOp.servicos?.descricao || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Produto / Carga</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itOp.produtos?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Fornecedor</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itOp.fornecedores?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Transportadora</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itOp.transportadoras?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Quantidade (Volume)</span> <span className="font-bold text-gray-800 dark:text-gray-200">{itOp.quantidade || 0}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Valor Unitário</span> <span className="font-medium text-gray-700 dark:text-gray-300">R$ {Number(itOp.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Placa</span> <span className="font-mono text-gray-700 dark:text-gray-300">{itOp.placa || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Nota Fiscal (NF)</span> <span className="font-medium text-gray-700 dark:text-gray-300">{itOp.nota_fiscal ? 'Sim' : 'Não'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Horário Entrada</span> <span className="font-mono text-gray-700 dark:text-gray-300">{itOp.entrada_ponto || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Horário Saída</span> <span className="font-mono text-gray-700 dark:text-gray-300">{itOp.saida_ponto || '-'}</span></div>
                                                                        <div className="col-span-2 border-t pt-2 md:border-none md:pt-0">
                                                                            <span className="text-gray-400 text-[11px] font-semibold uppercase block">Valor Total Operação</span>
                                                                            <span className="font-bold text-blue-700 text-lg">R$ {Number(itOp.valor_total || item.valor_item || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 04: Localização & Responsáveis */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">Localização & Responsáveis</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Empresa Cliente</span> <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">{itOp.empresas?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Unidade / Local</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itOp.unidades?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Encarregado Lançador</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itOp.usuarios?.nome || itOp.usuarios?.email || '-'}</span></div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 05: Colaboradores Alocados */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">
                                                                        Colaboradores Alocados ({itOp.operacoes_colaboradores?.length || itOp.quantidade_colaboradores || 0})
                                                                    </h5>
                                                                    {itOp.operacoes_colaboradores && itOp.operacoes_colaboradores.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {itOp.operacoes_colaboradores.map((colab: any, cIdx: number) => (
                                                                                <span key={cIdx} className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded text-xs flex items-center gap-1.5 shadow-2xs">
                                                                                    <User className="h-3 w-3 text-gray-400" />
                                                                                    <strong className="font-medium">{colab.colaboradores?.nome || colab.colaborador_nome || 'Colaborador'}</strong>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400 italic">Nenhum colaborador individual vinculado nominalmente (Qtd declarada: {itOp.quantidade_colaboradores || 1}).</p>
                                                                    )}
                                                                </div>

                                                                {/* Link de Navegação Externa */}
                                                                {onNavigateToOp && (
                                                                    <div className="pt-2 border-t flex justify-end">
                                                                        <Button
                                                                            type="button"
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-8 gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                                                                            onClick={() => onNavigateToOp(itOp.id)}
                                                                        >
                                                                            <ExternalLink className="h-3.5 w-3.5" /> Detalhar Operação Completa
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : itSe ? (
                                                            <div className="flex flex-col gap-5">
                                                                {/* BLOCO 02: Origem Serviço Extra */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">Origem da Receita</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Origem</span> <span className="font-semibold text-purple-700 block">Serviço Extra</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Nº Registro</span> <span className="font-bold text-gray-800 dark:text-gray-200 tracking-wide block">SE #{itSe.id?.substring(0, 8) || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Data Serv.</span> <span className="font-medium text-gray-700 dark:text-gray-300">{formatDateOnly(itSe.data || itSe.data_servico)}</span></div>
                                                                        <div>
                                                                            <span className="text-gray-400 text-xs block mb-0.5">Status Aprovação</span>
                                                                            <span className="font-medium text-emerald-700 uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{itSe.pipeline_status?.replace('_', ' ') || 'Aprovado'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 03: Dados do Serviço Extra */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">Dados do Serviço Extra</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        <div className="col-span-2"><span className="text-gray-400 text-xs block">Tipo de Serviço</span> <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">{itSe.tipo_servico || '-'}</span></div>
                                                                        <div className="col-span-2"><span className="text-gray-400 text-xs block">Descrição</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itSe.descricao || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Quantidade</span> <span className="font-medium text-gray-700 dark:text-gray-300">{itSe.quantidade || 1}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">V. Unitário</span> <span className="font-medium text-gray-700 dark:text-gray-300">R$ {Number(itSe.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Forma Pgto</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itSe.formas_pagamento_operacional?.nome || itSe.formas_pagamento_operacional?.descricao || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Modalidade</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itSe.modalidade_financeira || '-'}</span></div>
                                                                        <div className="col-span-2 border-t pt-2 md:border-none md:pt-0">
                                                                            <span className="text-gray-400 text-[11px] font-semibold uppercase block">Valor Total</span>
                                                                            <span className="font-bold text-blue-700 text-lg">R$ {Number(itSe.valor_total || item.valor_item || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 04: Responsáveis */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">Responsáveis & Local</h5>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Empresa Cliente</span> <span className="font-semibold text-gray-800 dark:text-gray-200 truncate block">{itSe.empresas?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Encarregado Lançador</span> <span className="font-medium text-gray-700 dark:text-gray-300 truncate block">{itSe.usuarios?.nome || itSe.usuarios?.email || '-'}</span></div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 05: Colaboradores Alocados */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-widest border-b pb-2 mb-3">
                                                                        Colaboradores Alocados ({itSe.servicos_extras_colaboradores?.length || itSe.quantidade_colaboradores || 0})
                                                                    </h5>
                                                                    {itSe.servicos_extras_colaboradores && itSe.servicos_extras_colaboradores.length > 0 ? (
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {itSe.servicos_extras_colaboradores.map((colab: any, cIdx: number) => (
                                                                                <span key={cIdx} className="bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded text-xs flex items-center gap-1.5 shadow-2xs">
                                                                                    <User className="h-3 w-3 text-gray-400" />
                                                                                    <strong className="font-medium">{colab.colaboradores?.nome || colab.colaborador_nome || 'Colaborador'}</strong>
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    ) : (
                                                                        <p className="text-xs text-gray-400 italic">Nenhum colaborador individual vinculado nominalmente (Qtd declarada: {itSe.quantidade_colaboradores || 1}).</p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="text-xs text-gray-500 py-3 text-center">
                                                                Sem dados detalhados vinculados a este lançamento.
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )
                                ) : (
                                    <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                                        Nenhum lançamento operacional detalhado retornado para esta receita.
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ABA 02: DOCUMENTOS */}
                        <TabsContent value="documentos" className="m-0 focus-visible:ring-0 space-y-4">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" /> Documentos de Cobrança e Faturamento
                                    </h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Histórico de documentos, notas ou faturas vinculadas à cobrança desta receita.
                                    </p>
                                </div>

                                {Array.isArray(documentosGerados) && documentosGerados.length > 0 ? (
                                    <div className="space-y-3">
                                        {documentosGerados.map((doc, idx) => (
                                            <div key={idx} className="p-4 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-xl flex items-center justify-between shadow-2xs">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                        <FileText className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-900 dark:text-gray-100">
                                                            Fatura #{doc?.detalhes?.numero_documento || (doc?.id ? String(doc.id).substring(0, 8) : String(idx + 1).padStart(4, '0'))}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500">
                                                            Gerado em {doc?.criado_em ? new Date(doc.criado_em).toLocaleString('pt-BR') : 'Data não informada'} por {doc?.detalhes?.usuario_email || 'Sistema'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                                                    Registrado
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                                        Nenhum documento de cobrança formal gerado no ORBE até o momento.
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ABA 03: TIMELINE (HISTÓRICO DE AUDITORIA) */}
                        <TabsContent value="historico" className="m-0 focus-visible:ring-0 space-y-4">
                            <div>
                                <h4 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1 flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-gray-500" /> Linha do Tempo e Histórico de Auditoria
                                </h4>
                                <p className="text-xs text-gray-500 leading-relaxed mb-4">
                                    Trilha cronológica auditável de alterações, emissões e recebimentos desta receita.
                                </p>

                                {isLoadingHistorico ? (
                                    <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">Carregando histórico...</div>
                                ) : historico.length === 0 ? (
                                    <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl border-dashed">
                                        Nenhum evento registrado nesta linha do tempo.
                                    </div>
                                ) : (
                                    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {historico.map((h: any, hIdx: number) => {
                                            const isStatusChange = Boolean(h.status_anterior && h.status_novo);
                                            const d = new Date(h.criado_em);
                                            const dateLabel = d.toLocaleDateString('pt-BR');
                                            const timeLabel = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                            return (
                                                <div key={h.id || hIdx} className="relative flex items-start gap-3">
                                                    <div className="absolute -left-6 mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-background border-2 border-primary shadow-xs">
                                                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                                                    </div>

                                                    <div className="flex-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 shadow-2xs space-y-2">
                                                        <div className="flex items-center justify-between gap-2 flex-wrap">
                                                            <span className="font-bold text-xs text-gray-800 dark:text-gray-200">
                                                                {h.acao || 'Transição de Estado'}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                                {dateLabel} às {timeLabel}
                                                            </span>
                                                        </div>

                                                        {isStatusChange && (
                                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-slate-50 dark:bg-slate-800/60 p-2 rounded border border-border/60">
                                                                <span className="font-medium text-gray-500">{h.status_anterior}</span>
                                                                <span>→</span>
                                                                <span className="font-bold text-foreground">{h.status_novo}</span>
                                                            </div>
                                                        )}

                                                        {h.detalhes?.texto && (
                                                            <p className="text-xs text-muted-foreground leading-relaxed">
                                                                {h.detalhes.texto}
                                                            </p>
                                                        )}

                                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                                                            <span>Usuário: {h.detalhes?.usuario_email || 'Sistema'}</span>
                                                            <span>Origem: {h.detalhes?.origem || 'Financeiro'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>

                {/* Rodapé Fixo do Drawer 2 */}
                <footer className="p-4 border-t border-border bg-slate-50/80 dark:bg-slate-900/60 flex items-center justify-between shrink-0">
                    <span className="text-[11px] text-muted-foreground">
                        ORBE Financeiro • Detalhamento Técnico
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onClose}
                        className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
                    >
                        Fechar Detalhes
                    </Button>
                </footer>
            </SheetContent>
        </Sheet>
    );
};
