import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useTenant } from "@/contexts/TenantContext";
import {
    CheckCircle, FileText, Send, Clock, Receipt, Calculator,
    Banknote, ListPlus, Mail, MessageCircle, Link, Paperclip, ChevronLeft,
    Zap, Layers, FileSpreadsheet
} from "lucide-react";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { cn } from "@/lib/utils";

interface ModalReceitaOperacionalProps {
    isOpen: boolean;
    receita: any; // Basic info from Pipeline
    onClose: () => void;
    onSuccess: () => void;
}

export function ModalReceitaOperacional({ isOpen, receita, onClose, onSuccess }: ModalReceitaOperacionalProps) {
    const { toast } = useToast();
    const { tenantId } = useTenant();
    const queryClient = useQueryClient();

    // UI States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionView, setActionView] = useState<'main' | 'gerar_cobranca' | 'enviar_cobranca' | 'consolidar' | 'confirmar_pix'>('main');

    // Forms
    const [pixForm, setPixForm] = useState({ data: new Date().toISOString().split('T')[0], banco: '', observacao: '' });

    // Data Load
    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ['receita-historico', receita?.id],
        queryFn: () => ReceitasService.getHistorico(receita!.id),
        enabled: isOpen && !!receita?.id
    });

    const { data: detalhesReceita, isLoading: isLoadingDetalhes } = useQuery({
        queryKey: ['receita-detalhes', receita?.id],
        queryFn: () => ReceitasService.getReceitaDetalhes(receita!.id),
        enabled: isOpen && !!receita?.id
    });

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: (newStatus: string) => ReceitasService.updateStatus(tenantId!, receita.id, newStatus),
        onSuccess: () => finishMutationSuccess()
    });

    const logEventMutation = useMutation({
        mutationFn: ({ acao, detalhesText, json }: any) => ReceitasService.logEvent(tenantId!, receita.id, acao, detalhesText, json),
        onSuccess: () => {
            // For PIX confirm flow, we chain the updateStatus manually if coming from handleConfirmPix
            if (actionView !== 'confirmar_pix') {
                finishMutationSuccess();
            }
        }
    });

    const finishMutationSuccess = () => {
        toast({ title: "Operação registrada com sucesso!" });
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["receita-historico"] });
        setIsSubmitting(false);
        setActionView('main');
        onSuccess();
    }

    const handleError = (err: any) => {
        toast({ title: "Erro na operação", description: err.message || "Erro desconhecido", variant: "destructive" });
        setIsSubmitting(false);
    }

    if (!receita) return null;

    // Derived info for Display
    const itemOps = detalhesReceita?.receitas_operacionais_itens?.[0]?.operacoes_producao;
    const servicoNome = isLoadingDetalhes ? "..." : (itemOps?.servicos?.nome || 'Múltiplas / Avulsa');
    const compStr = receita.competencia ? `${receita.competencia.slice(5, 7)}/${receita.competencia.slice(0, 4)}` : 'N/A';
    const valorStr = `R$ ${Number(receita.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const clienteNome = receita.empresas?.nome || 'N/A';

    // --- Action Handlers --- 
    const handleConfirmRecebimento = () => {
        setIsSubmitting(true);
        updateStatusMutation.mutate('pago', { onError: handleError });
    };

    const handleConfirmPix = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Atualiza history and then status
        logEventMutation.mutate({
            acao: 'Recebimento Confirmado',
            detalhesText: `Data do Recebimento: ${pixForm.data} | Banco: ${pixForm.banco} | Comprovante: ${pixForm.observacao}`,
            json: pixForm
        }, {
            onSuccess: () => {
                updateStatusMutation.mutate('pago', { onError: handleError });
            },
            onError: handleError
        });
    }

    const handleConfirmGerarCobranca = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // De acordo com as regras: "Cobrança Gerada" não vai alterar status da tabela se inflar o DB for evitado. Vai logar.
        logEventMutation.mutate({
            acao: 'Cobrança Gerada',
            detalhesText: 'Documentos de cobrança (PDF/Boleto) gerados.',
            json: { tipo: 'Documento' }
        }, { onError: handleError });
    };

    const handleConfirmEnviarCobranca = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Atualiza status e loga nativamente o update
        updateStatusMutation.mutate('faturado', { onError: handleError });
    };

    const handleConfirmConsolidar = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Apenas para fat mensal, loga competencia fechada ou altera status.
        logEventMutation.mutate({
            acao: 'Competência Fechada',
            detalhesText: 'Competência consolidada. Pronta para Geração de Cobrança.',
            json: { acao_interna: true }
        }, { onError: handleError });
    }

    // --- Sub-Views (Forms embutidos) ---
    const renderConfirmarPixForm = () => (
        <form onSubmit={handleConfirmPix} className="space-y-4 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-2 mb-4">
                <Button type="button" variant="ghost" size="icon" className="-ml-3" onClick={() => setActionView('main')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h4 className="font-semibold text-gray-800">Confirmar Recebimento (PIX / Depósito)</h4>
            </div>

            <div className="space-y-4">
                <div><Label>Data do PIX / Recebimento</Label> <Input type="date" className="mt-1" required value={pixForm.data} onChange={e => setPixForm(p => ({ ...p, data: e.target.value }))} /></div>
                <div><Label>Banco / Conta Destino</Label> <Input placeholder="Ex: Itaú, Santander, Banco Cora..." className="mt-1" required value={pixForm.banco} onChange={e => setPixForm(p => ({ ...p, banco: e.target.value }))} /></div>
                <div><Label>Observação / ID do Comprovante</Label> <Textarea placeholder="PIX recebido conforme comprovante..." className="mt-1" required value={pixForm.observacao} onChange={e => setPixForm(p => ({ ...p, observacao: e.target.value }))} /></div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActionView('main')}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirmar Recebimento</Button>
            </div>
        </form>
    );

    const renderGerarCobrancaForm = () => (
        <form onSubmit={handleConfirmGerarCobranca} className="space-y-4 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-2 mb-4">
                <Button type="button" variant="ghost" size="icon" className="-ml-3" onClick={() => setActionView('main')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h4 className="font-semibold text-gray-800">Gerar Documentos de Cobrança</h4>
            </div>

            <div className="space-y-4">
                <div>
                    <Label>Formato do Documento</Label>
                    <div className="flex gap-2 mt-1">
                        <Button type="button" variant="outline" className="flex-1 bg-white">Boleto (PDF)</Button>
                        <Button type="button" variant="outline" className="flex-1 bg-white">Nota Fiscal</Button>
                        <Button type="button" variant="outline" className="flex-1 bg-white">Link Pix</Button>
                    </div>
                </div>
                <div><Label>Vencimento Programado</Label> <Input type="date" className="mt-1" /></div>
                <div><Label>Anexos de Suporte</Label>
                    <div className="border border-dashed p-4 rounded-md mt-1 text-center text-gray-500 bg-gray-50/50 cursor-pointer hover:bg-gray-50">
                        <Paperclip className="h-4 w-4 mx-auto mb-2" />
                        <p className="text-xs">Anexar Memória de Cálculo ou Relatório Operacional</p>
                    </div>
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActionView('main')}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">Confirmar Geração</Button>
            </div>
        </form>
    );

    const renderEnviarCobrancaForm = () => (
        <form onSubmit={handleConfirmEnviarCobranca} className="space-y-4 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-2 mb-4">
                <Button type="button" variant="ghost" size="icon" className="-ml-3" onClick={() => setActionView('main')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h4 className="font-semibold text-gray-800">Envio de Cobrança para o Cliente</h4>
            </div>

            <div className="space-y-4">
                <div>
                    <Label>Canais de Envio Opcionais (Integrações Futuras)</Label>
                    <div className="flex gap-2 mt-1">
                        <Button type="button" variant="outline" className="flex-1 gap-2"><Mail className="h-4 w-4" /> E-mail</Button>
                        <Button type="button" variant="outline" className="flex-1 gap-2 border-green-200 text-green-700 hover:bg-green-50"><MessageCircle className="h-4 w-4" /> WhatsApp</Button>
                        <Button type="button" variant="outline" className="flex-1 gap-2"><Link className="h-4 w-4" /> Link Seguro</Button>
                    </div>
                </div>
                <div><Label>Contato de Cobrança</Label> <Input defaultValue="financeiro@cliente.com" className="mt-1" /></div>
                <div><Label>Mensagem Anexada</Label> <Textarea placeholder="Descreva observações de corpo de email ou whatsapp..." className="mt-1" /></div>
            </div>

            <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActionView('main')}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white">Registrar Envio</Button>
            </div>
        </form>
    );

    const renderConsolidarForm = () => (
        <form onSubmit={handleConfirmConsolidar} className="space-y-4 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-2 mb-4">
                <Button type="button" variant="ghost" size="icon" className="-ml-3" onClick={() => setActionView('main')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h4 className="font-semibold text-gray-800">Consolidar Faturamento Mensal (Fechamento)</h4>
            </div>

            <div className="bg-orange-50 border border-orange-100 text-orange-800 p-3 rounded-lg text-sm mb-4">
                Você agrupará {(detalhesReceita?.receitas_operacionais_itens || []).length} operações pendentes para esta Empresa e gravará o fechamento deste ciclo.
            </div>

            <div className="space-y-3">
                <div className="flex justify-between font-medium border-b pb-1 text-sm"><span className="text-gray-500">Valor Total Consolidado</span><span className="text-gray-900">R$ {Number(detalhesReceita?.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                <div><Label>Ciclo de Competência</Label> <Input defaultValue={detalhesReceita?.competencia || ""} className="mt-1 bg-gray-50" readOnly /></div>
                <div><Label>Aplicar Vencimento Padrão</Label> <Input type="date" className="mt-1" /></div>
            </div>
            <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActionView('main')}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">Confirmar Fechamento</Button>
            </div>
        </form>
    );

    // --- Main Buttons ---
    const renderActionButtons = () => {
        switch (receita.modalidade) {
            case 'CAIXA_IMEDIATO':
                return (
                    <div className="flex flex-col gap-3">
                        <Button
                            onClick={() => setActionView('confirmar_pix')}
                            disabled={receita.status === 'pago' || isSubmitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Confirmar Conferência e Recebimento
                        </Button>
                    </div>
                );
            case 'DUPLICATA':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            onClick={() => setActionView('gerar_cobranca')}
                            disabled={receita.status === 'pago' || isSubmitting}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 col-span-2"
                        >
                            <Calculator className="h-4 w-4" />
                            Gerar Cobrança (Eventos / Docs)
                        </Button>
                        <Button
                            onClick={() => setActionView('enviar_cobranca')}
                            disabled={receita.status === 'pago' || isSubmitting}
                            variant="secondary"
                            className="w-full gap-2 h-11"
                        >
                            <Send className="h-4 w-4" />
                            Registrar Envio
                        </Button>
                        <Button
                            onClick={handleConfirmRecebimento}
                            disabled={receita.status === 'pago' || isSubmitting}
                            variant="outline"
                            className="w-full gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 h-11"
                        >
                            <Banknote className="h-4 w-4" />
                            Confirmar Pagamento Realizado
                        </Button>
                    </div>
                );
            case 'FATURAMENTO_MENSAL':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 border p-3 rounded-md text-sm text-gray-700 col-span-2 flex items-start gap-3">
                            <ListPlus className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                            <p>Este painel agrupa operações do mês. Operações individuais atreladas ao agrupamento são descritas abaixo.</p>
                        </div>
                        <Button
                            onClick={() => setActionView('consolidar')}
                            disabled={receita.status === 'pago' || isSubmitting}
                            className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 h-11 col-span-2"
                        >
                            <ListPlus className="h-4 w-4" />
                            Consolidar Competência & Fechamento
                        </Button>
                        <Button
                            onClick={() => setActionView('gerar_cobranca')}
                            disabled={receita.status === 'pago' || isSubmitting}
                            variant="outline"
                            className="w-full gap-2 h-11 bg-white"
                        >
                            <Calculator className="h-4 w-4" />
                            Gerar Doc. Consolidado
                        </Button>
                        <Button
                            onClick={() => setActionView('enviar_cobranca')}
                            disabled={receita.status === 'pago' || isSubmitting}
                            variant="secondary"
                            className="w-full gap-2 h-11"
                        >
                            <Send className="h-4 w-4" />
                            Enviar ao Cliente
                        </Button>
                        <Button
                            onClick={handleConfirmRecebimento}
                            disabled={receita.status === 'pago' || isSubmitting}
                            variant="outline"
                            className="w-full gap-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 h-11 col-span-2"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Pago / Conciliado integralmente
                        </Button>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl bg-gray-50 p-0 border-none shadow-xl overflow-hidden flex flex-col md:max-h-[90vh]">
                <DialogHeader className="bg-white px-6 py-4 border-b">
                    <DialogTitle className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-xl font-bold font-display text-gray-800">
                            <Receipt className="h-5 w-5 text-primary" />
                            Receita Operacional
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-normal text-gray-500 mt-1">
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Cliente</span><br /> <span className="text-gray-900">{clienteNome}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Operação</span><br /> <span className="text-gray-900">{servicoNome.toUpperCase()}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Competência</span><br /> <span className="text-gray-900">{compStr}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Valor Total</span><br /> <span className="font-bold text-gray-900 text-sm">{valorStr}</span></div>
                        </div>
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="detalhes" className="w-full h-full flex flex-col overflow-hidden">
                    <div className="bg-white px-6 pt-2 pb-0 border-b">
                        <TabsList className="grid w-[400px] grid-cols-3 bg-gray-100/80 mb-2">
                            <TabsTrigger value="detalhes">Operacional</TabsTrigger>
                            <TabsTrigger value="documentos">Documentos</TabsTrigger>
                            <TabsTrigger value="historico">Timeline</TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="detalhes" className="flex-1 overflow-y-auto p-6 m-0 focus-visible:ring-0">

                        {actionView !== 'main' ? (
                            <div className="bg-white p-6 rounded-xl border shadow-sm">
                                {actionView === 'gerar_cobranca' && renderGerarCobrancaForm()}
                                {actionView === 'enviar_cobranca' && renderEnviarCobrancaForm()}
                                {actionView === 'consolidar' && renderConsolidarForm()}
                                {actionView === 'confirmar_pix' && renderConfirmarPixForm()}
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* DADOS GERAIS */}
                                <div className="grid grid-cols-2 md:grid-cols-2 gap-4 bg-white p-5 rounded-xl border shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Situação Financeira</p>
                                        {receita.status === 'pago' ? (
                                            <div className="inline-flex bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded gap-1"><CheckCircle className="h-3.5 w-3.5" /> Pago / Conciliado</div>
                                        ) : (
                                            <div className="inline-flex bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                                {receita.status?.replace('_', ' ').toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Modalidade</p>
                                        <div className="inline-flex bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">
                                            {receita.modalidade?.replace('_', ' ')}
                                        </div>
                                    </div>
                                </div>

                                {/* AÇÕES DISPONÍVEIS */}
                                <div>
                                    <h4 className="text-sm font-bold text-gray-800 mb-3 ml-1 flex items-center gap-2"><Zap className="h-4 w-4 text-orange-500" /> Ações do Fluxo</h4>
                                    {renderActionButtons()}
                                </div>

                                {/* OPERAÇÕES VINCULADAS (Lazy Loaded) */}
                                <div>
                                    <div className="flex items-center justify-between mb-3 mx-1">
                                        <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                            <Layers className="h-4 w-4 text-gray-500" /> Detalhes das Operações Base
                                        </h4>
                                        {isLoadingDetalhes && <span className="text-xs text-gray-400 animate-pulse">Carregando dados...</span>}
                                    </div>

                                    {detalhesReceita?.receitas_operacionais_itens?.length > 0 ? (
                                        <div className="space-y-3">
                                            {detalhesReceita.receitas_operacionais_itens.map((item: any) => {
                                                const op = item.operacoes_producao;
                                                return (
                                                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-sm">
                                                        {op ? (
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-y-3 gap-x-2">
                                                                <div><span className="text-gray-400 text-xs block">Data Op.</span> <span className="font-medium text-gray-700">{op.data_operacao ? new Date(op.data_operacao).toLocaleDateString() : 'N/A'}</span></div>
                                                                <div><span className="text-gray-400 text-xs block">Volume</span> <span className="font-medium text-gray-700">{op.quantidade}</span></div>
                                                                <div><span className="text-gray-400 text-xs block">Produto</span> <span className="font-medium text-gray-700 truncate block">{op.produtos?.nome || '-'}</span></div>
                                                                <div><span className="text-gray-400 text-xs block">Serviço</span> <span className="font-medium text-gray-700 truncate block">{op.servicos?.nome || '-'}</span></div>

                                                                <div className="col-span-2"><span className="text-gray-400 text-xs block">Transportadora / Fornecedor</span> <span className="font-medium text-gray-700 truncate block">{op.transportadoras?.nome_fantasia || op.fornecedores?.nome_fantasia || '-'}</span></div>
                                                                <div className="col-span-2"><span className="text-gray-400 text-xs block">Forma Pgto</span> <span className="font-medium text-gray-700">{op.formas_pagamento_operacional?.nome || '-'}</span></div>

                                                                {op.observacao && (
                                                                    <div className="col-span-4 mt-1 bg-yellow-50/50 p-2 rounded text-gray-600 text-xs border border-yellow-100">
                                                                        <strong className="text-yellow-700">Obs:</strong> {op.observacao}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-500">Item sem operação referenciada (Avulso). Valor: R$ {item.valor_item}</div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        !isLoadingDetalhes && (
                                            <div className="text-center p-6 border border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-400 text-sm">
                                                Nenhum registro base anexado.
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="documentos" className="flex-1 overflow-y-auto p-6 m-0 focus-visible:ring-0 bg-gray-50">
                        <div className="bg-white p-8 rounded-xl border border-dashed text-center flex flex-col items-center justify-center">
                            <FileSpreadsheet className="h-10 w-10 text-gray-300 mb-3" />
                            <h4 className="font-bold text-gray-700">Central de Documentos</h4>
                            <p className="text-gray-500 text-sm mt-1 max-w-sm mb-4">Boletos, Notas Fiscais e Memórias de Cálculo vinculados a este recebimento ficarão salvos aqui.</p>
                            <Button variant="outline"><Paperclip className="w-4 h-4 mr-2" /> Anexar Documento</Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="historico" className="flex-1 overflow-y-auto p-6 m-0 bg-white">
                        <div className="max-w-2xl mx-auto py-2">
                            {isLoadingHistorico ? (
                                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                                    <Clock className="h-6 w-6 text-gray-300 animate-spin" />
                                    <div className="text-sm text-gray-500">Recuperando timeline...</div>
                                </div>
                            ) : historico.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed rounded-xl border-gray-100">
                                    <Clock className="h-10 w-10 text-gray-200 mb-3" />
                                    <p className="text-sm text-gray-400 font-medium">Nenhum evento registrado nesta receita ainda.</p>
                                    <p className="text-xs text-gray-400 mt-1">Ações futuras irão alimentar esta linha do tempo.</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    {historico.map((h: any, i: number) => {
                                        const isStatusChange = !!h.status_novo;
                                        const dateLabel = new Date(h.created_at).toLocaleDateString('pt-BR');
                                        const timeLabel = new Date(h.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                                        return (
                                            <div key={h.id} className="flex gap-4">
                                                {/* Timeline spine */}
                                                <div className="flex flex-col items-center mt-1">
                                                    <div className={cn("h-3.5 w-3.5 rounded-full border-2 bg-white flex items-center justify-center",
                                                        isStatusChange ? "border-blue-500" : "border-amber-500 z-10"
                                                    )}>
                                                        {!isStatusChange && <div className="h-1.5 w-1.5 bg-amber-500 rounded-full" />}
                                                    </div>
                                                    {i !== historico.length - 1 && (
                                                        <div className="w-px h-full bg-border -mb-6 mt-1"></div>
                                                    )}
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 bg-white border shadow-sm rounded-lg p-3 -mt-1.5 hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-1">
                                                        <p className="font-bold text-gray-800 text-sm">{h.acao}</p>
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded font-mono font-bold">
                                                            {dateLabel} {timeLabel}
                                                        </span>
                                                    </div>

                                                    {isStatusChange && (
                                                        <p className="text-gray-500 text-xs mb-2">
                                                            Status alterado para <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded">{h.status_novo}</span>
                                                        </p>
                                                    )}

                                                    {h.descricao && (
                                                        <div className="bg-gray-50 border border-gray-100 p-2 mt-2 rounded">
                                                            <p className="text-gray-600 text-[13px]">{h.descricao}</p>
                                                        </div>
                                                    )}

                                                    {h.detalhes?.texto && !h.descricao && (
                                                        <div className="bg-gray-50 border border-gray-100 p-2 mt-2 rounded">
                                                            <p className="text-gray-600 text-[13px]">{h.detalhes.texto}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
