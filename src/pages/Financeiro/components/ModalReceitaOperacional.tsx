import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { generateCobrancaPDF } from "@/utils/pdfCobranca";
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
    const navigate = useNavigate();

    // UI States
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [actionView, setActionView] = useState<'main' | 'gerar_cobranca' | 'enviar_cobranca' | 'consolidar' | 'confirmar_pix'>('main');

    // Forms
    const [pixForm, setPixForm] = useState({ data: new Date().toISOString().split('T')[0], banco: '', observacao: '' });
    const [cobrancaForm, setCobrancaForm] = useState({ formato: 'Boleto (PDF)', vencimento: receita?.vencimento || '' });
    const [consolidarForm, setConsolidarForm] = useState({ vencimento: receita?.vencimento || '' });
    const [enviarForm, setEnviarForm] = useState({ contato: 'financeiro@cliente.com', mensagem: '' });

    // Data Load
    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ['receita-historico', receita?.id],
        queryFn: () => ReceitasService.getHistorico(receita!.id),
        enabled: isOpen && !!receita?.id
    });

    const { data: detalhesReceita, isLoading: isLoadingDetalhes, error: errDetalhes } = useQuery({
        queryKey: ['receita-detalhes', receita?.id],
        queryFn: () => ReceitasService.getReceitaDetalhes(receita!.id),
        enabled: isOpen && !!receita?.id
    });

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: (newStatus: string) => ReceitasService.updateStatus(tenantId!, receita.id, newStatus),
    });

    const updateReceitaMutation = useMutation({
        mutationFn: (payload: any) => ReceitasService.updateReceita(tenantId!, receita.id, payload),
    });

    const logEventMutation = useMutation({
        mutationFn: ({ acao, detalhesText, json }: any) => ReceitasService.logEvent(tenantId!, receita.id, acao, detalhesText, json),
    });

    const finishMutationSuccess = () => {
        toast({ title: "Operação registrada com sucesso!" });
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["receita-historico"] });
        setIsSubmitting(false);
        setActionView('main');
        onSuccess();
        onClose();
    }

    const handleError = (err: any) => {
        toast({ title: "Erro na operação", description: err.message || "Erro desconhecido", variant: "destructive" });
        setIsSubmitting(false);
    }

    if (!receita) return null;

    // Derived info for Display
    const itemOps = detalhesReceita?.receitas_operacionais_itens?.[0]?.operacoes_producao;
    const itemCount = detalhesReceita?.receitas_operacionais_itens?.length || 0;
    const servicoNome = isLoadingDetalhes ? "..." : (itemCount > 1 ? `Consolidada (${itemCount} lançamentos)` : (itemOps?.servicos?.nome || 'Operação Avulsa'));

    let compStr = "";
    if (receita.competencia) {
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        const ano = receita.competencia.slice(0, 4);
        const mes = receita.competencia.slice(5, 7);
        compStr = `${meses[parseInt(mes) - 1] || mes}/${ano}`;
    } else if (itemOps?.data_operacao) { // REFINAMENTO 01
        const dt = new Date(itemOps.data_operacao);
        const dtUTC = new Date(dt.getTime() + dt.getTimezoneOffset() * 60000);
        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        compStr = `${meses[dtUTC.getMonth()] || (dtUTC.getMonth() + 1).toString().padStart(2, '0')}/${dtUTC.getFullYear()}`;
    } else {
        compStr = "N/A";
    }

    const valorStr = `R$ ${Number(receita.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const clienteNome = receita.empresas?.nome || 'N/A';

    // --- Action Handlers --- 
    const handleConfirmRecebimento = () => {
        setIsSubmitting(true);
        updateStatusMutation.mutate('recebido', {
            onSuccess: finishMutationSuccess,
            onError: handleError
        });
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
                updateStatusMutation.mutate('recebido', {
                    onSuccess: finishMutationSuccess,
                    onError: handleError
                });
            },
            onError: handleError
        });
    }

    const handleConfirmGerarCobranca = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        // Let's resolve the next status. If it's aguardando_fechamento for a duplicata (legacy bug or just generated), we move it to pendente_cobranca.
        let proximoStatus = receita.status;
        if (receita.modalidade === 'DUPLICATA' && receita.status === 'aguardando_fechamento') {
            proximoStatus = 'pendente_cobranca';
        }

        updateReceitaMutation.mutate({ vencimento: cobrancaForm.vencimento, status: proximoStatus }, {
            onSuccess: () => {
                // Dispara o download do arquivo imediatamente
                generateCobrancaPDF(receita, detalhesReceita, cobrancaForm.formato, cobrancaForm.vencimento);

                logEventMutation.mutate({
                    acao: 'Cobrança Gerada',
                    detalhesText: `Documentos gerados em formato: ${cobrancaForm.formato}. Vencimento: ${cobrancaForm.vencimento ? new Date(cobrancaForm.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Imediato'}.`,
                    json: { tipo: 'Documento', formato: cobrancaForm.formato, vencimento: cobrancaForm.vencimento }
                }, {
                    onSuccess: finishMutationSuccess,
                    onError: handleError
                });
            },
            onError: handleError
        });
    };

    const handleConfirmEnviarCobranca = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Atualiza status e loga nativamente o update
        updateStatusMutation.mutate('cobranca_enviada', {
            onSuccess: () => {
                logEventMutation.mutate({
                    acao: 'Cobrança Enviada ao Cliente',
                    detalhesText: `Contato: ${enviarForm.contato} | Mensagem: ${enviarForm.mensagem || 'N/A'}`,
                    json: enviarForm
                }, {
                    onSuccess: finishMutationSuccess,
                    onError: handleError
                });
            },
            onError: handleError
        });
    };

    const handleConfirmConsolidar = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        updateReceitaMutation.mutate({ vencimento: consolidarForm.vencimento, status: 'pendente_cobranca' }, {
            onSuccess: () => {
                logEventMutation.mutate({
                    acao: 'Competência Fechada',
                    detalhesText: `Competência consolidada. Pronta para Geração de Cobrança. Vencimento Padrão: ${consolidarForm.vencimento ? new Date(consolidarForm.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Imediato'}.`,
                    json: { acao_interna: true, vencimento: consolidarForm.vencimento }
                }, {
                    onSuccess: finishMutationSuccess,
                    onError: handleError
                });
            },
            onError: handleError
        });
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
                        <Button type="button" variant="outline" className={cn("flex-1", cobrancaForm.formato === 'Boleto (PDF)' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white")} onClick={() => setCobrancaForm(p => ({ ...p, formato: 'Boleto (PDF)' }))}>Boleto (PDF)</Button>
                        <Button type="button" variant="outline" className={cn("flex-1", cobrancaForm.formato === 'Nota Fiscal' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white")} onClick={() => setCobrancaForm(p => ({ ...p, formato: 'Nota Fiscal' }))}>Nota Fiscal</Button>
                        <Button type="button" variant="outline" className={cn("flex-1", cobrancaForm.formato === 'Link Pix' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white")} onClick={() => setCobrancaForm(p => ({ ...p, formato: 'Link Pix' }))}>Link Pix</Button>
                    </div>
                </div>
                <div><Label>Vencimento Programado</Label> <Input type="date" className="mt-1" required value={cobrancaForm.vencimento} onChange={e => setCobrancaForm(p => ({ ...p, vencimento: e.target.value }))} /></div>
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
                <div><Label>Contato de Cobrança</Label> <Input className="mt-1" required value={enviarForm.contato} onChange={e => setEnviarForm(p => ({ ...p, contato: e.target.value }))} /></div>
                <div><Label>Mensagem Anexada</Label> <Textarea placeholder="Descreva observações de corpo de email ou whatsapp..." className="mt-1" value={enviarForm.mensagem} onChange={e => setEnviarForm(p => ({ ...p, mensagem: e.target.value }))} /></div>
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
                <div><Label>Aplicar Vencimento Padrão</Label> <Input type="date" className="mt-1" required value={consolidarForm.vencimento} onChange={e => setConsolidarForm(p => ({ ...p, vencimento: e.target.value }))} /></div>
            </div>
            <div className="pt-4 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActionView('main')}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-purple-600 hover:bg-purple-700">Confirmar Fechamento</Button>
            </div>
        </form>
    );

    // --- Main Buttons ---
    const renderActionButtons = () => {
        // REFINAMENTO 03
        if (receita.status === 'recebido' || receita.status === 'pago' || receita.status === 'conciliado') {
            const auditReceb = historico?.reverse().find((h: any) =>
                h.acao?.includes('Recebimento') ||
                h.status_novo === 'recebido' ||
                h.status_novo === 'pago' ||
                h.status_novo === 'conciliado'
            );

            return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full mt-0.5">
                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                        <h4 className="font-bold text-emerald-800 text-sm">Recebido</h4>
                        <div className="text-emerald-700/80 text-xs mt-1.5 leading-relaxed space-y-1">
                            <p>A receita foi liquidada e o valor contabilizado.</p>
                            {auditReceb ? (
                                <ul className="pl-0 flex flex-wrap items-center gap-x-4 pt-1 mt-2 border-t border-emerald-200/50">
                                    <li><span className="font-semibold text-emerald-700">Data e Hora:</span> {new Date(auditReceb.created_at).toLocaleDateString('pt-BR')} às {new Date(auditReceb.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</li>
                                    <li><span className="font-semibold text-emerald-700">Usuário Responsável:</span> {auditReceb.detalhes?.usuario_email || 'Sistema'}</li>
                                </ul>
                            ) : (
                                <p><span className="font-semibold text-emerald-700">Data de Atualização:</span> {new Date(receita.updated_at || new Date()).toLocaleString('pt-BR')}</p>
                            )}
                        </div>
                        <div className="mt-4 border-t border-emerald-200/50 pt-3 flex gap-2">
                            {itemOps?.id && (
                                <Button size="sm" variant="outline" className="text-emerald-800 border-emerald-300 hover:bg-emerald-200" onClick={() => { onClose(); navigate("/operacional/operacoes", { state: { highlight: itemOps.id } }); }}>
                                    Visualizar Operação Original
                                </Button>
                            )}
                            <Button size="sm" variant="outline" className="text-gray-600 border-gray-200 hover:bg-gray-100" onClick={onClose}>
                                Voltar ao Kanban
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        switch (receita.modalidade) {
            case 'CAIXA_IMEDIATO':
                return (
                    <div className="flex flex-col gap-3">
                        <Button onClick={() => setActionView('confirmar_pix')} disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11">
                            <CheckCircle className="h-4 w-4" /> Confirmar Conferência e Recebimento
                        </Button>
                    </div>
                );
            case 'DUPLICATA':
                return (
                    <div className="grid grid-cols-2 gap-3">
                        <Button onClick={() => setActionView('gerar_cobranca')} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2 h-11 col-span-2">
                            <Calculator className="h-4 w-4" /> Gerar Cobrança (Eventos / Docs)
                        </Button>
                        <Button onClick={() => setActionView('enviar_cobranca')} disabled={isSubmitting} variant="secondary" className="w-full gap-2 h-11">
                            <Send className="h-4 w-4" /> Registrar Envio
                        </Button>
                        <Button onClick={handleConfirmRecebimento} disabled={isSubmitting} variant="outline" className="w-full gap-2 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-800 h-11">
                            <Banknote className="h-4 w-4" /> Confirmar Recebimento
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
                        <Button onClick={() => setActionView('consolidar')} disabled={isSubmitting} className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2 h-11 col-span-2">
                            <ListPlus className="h-4 w-4" /> Consolidar Competência & Fechamento
                        </Button>
                        <Button onClick={() => setActionView('gerar_cobranca')} disabled={isSubmitting} variant="outline" className="w-full gap-2 h-11 bg-white">
                            <Calculator className="h-4 w-4" /> Gerar Doc. Consolidado
                        </Button>
                        <Button onClick={() => setActionView('enviar_cobranca')} disabled={isSubmitting} variant="secondary" className="w-full gap-2 h-11">
                            <Send className="h-4 w-4" /> Enviar ao Cliente
                        </Button>
                        <Button onClick={handleConfirmRecebimento} disabled={isSubmitting} variant="outline" className="w-full gap-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 h-11 col-span-2">
                            <CheckCircle className="h-4 w-4" /> Confirmar Recebimento
                        </Button>
                    </div>
                );
            default: return null;
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
                        {/* REFINAMENTO 06 */}
                        <div className="text-[11px] text-gray-500 font-normal">
                            Receita originada automaticamente a partir {itemCount > 1 ? `de ${itemCount} Operações por Volume agrupadas` : `da Operação por Volume ${itemOps?.id?.substring(0, 8) || 'Desconhecida'}`}.
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-normal text-gray-500 mt-1">
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Cliente</span><br /> <span className="text-gray-900 font-medium">{clienteNome}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Valor</span><br /> <span className="font-bold text-gray-900 text-sm">{valorStr}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Competência</span><br /> <span className="text-gray-900 font-medium">{compStr}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Modalidade</span><br /> <span className="text-gray-900 font-medium">{receita.modalidade?.replace('_', ' ')}</span></div>
                            <div className="w-px h-6 bg-gray-200"></div>
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Situação Financeira</span><br /> <span className="inline-block mt-0.5 text-blue-700 font-bold uppercase text-[11px] bg-blue-50 px-2 py-0.5 rounded">{(receita.status === 'recebido' || receita.status === 'pago' || receita.status === 'conciliado') ? 'RECEBIDO' : receita.status?.replace('_', ' ')}</span></div>
                        </div>

                        {/* Pipeline de Receita e Última Atualização */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-gray-100 pt-3 mt-1 gap-2">
                            <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-400">
                                <span className={cn("flex items-center gap-1", itemOps ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" : "")}><CheckCircle className="h-3.5 w-3.5" /> Operação</span>
                                <span>↓</span>
                                <span className={cn("flex items-center gap-1", receita ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" : "")}><CheckCircle className="h-3.5 w-3.5" /> Receita</span>
                                {receita.modalidade !== 'CAIXA_IMEDIATO' && (
                                    <>
                                        <span>↓</span>
                                        <span className={cn("flex items-center gap-1", (receita.status === 'cobranca_enviada' || receita.status === 'recebido' || receita.status === 'pago' || receita.status === 'conciliado') ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" : (receita.status === 'pendente_cobranca' ? "text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded" : ""))}><CheckCircle className="h-3.5 w-3.5" /> Cobrança</span>
                                    </>
                                )}
                                <span>↓</span>
                                <span className={cn("flex items-center gap-1", (receita.status === 'recebido' || receita.status === 'pago' || receita.status === 'conciliado') ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" : ((receita.status === 'pendente_recebimento' || receita.status === 'aguardando_fechamento') ? "text-orange-500 bg-orange-50 px-1.5 py-0.5 rounded animate-pulse" : ""))}><CheckCircle className="h-3.5 w-3.5" /> Recebimento</span>
                                {receita.modalidade !== 'CAIXA_IMEDIATO' && (
                                    <>
                                        <span>↓</span>
                                        <span className={cn("flex items-center gap-1", (receita.status === 'recebido' || receita.status === 'pago' || receita.status === 'conciliado') ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" : "")}><CheckCircle className="h-3.5 w-3.5" /> Conciliação</span>
                                    </>
                                )}
                            </div>

                            <div className="text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                <span>Última atualização: <span className="font-semibold text-gray-700">{new Date(receita.updated_at || new Date()).toLocaleString('pt-BR')}</span></span>
                            </div>
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
                                {/* BLOCO 01: RESUMO FINANCEIRO */}
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                        <Receipt className="h-4 w-4 text-gray-500" /> Resumo Financeiro
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-white p-5 rounded-xl border shadow-sm">
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Situação Financeira</p>
                                            {receita.status === 'recebido' || receita.status === 'pago' || receita.status === 'conciliado' ? (
                                                <div className="inline-flex bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-1 rounded gap-1"><CheckCircle className="h-3.5 w-3.5" /> RECEBIDO</div>
                                            ) : (
                                                <div className="inline-flex bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                                                    {receita.status?.replace('_', ' ').toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Modalidade</p>
                                            <div className="inline-flex bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded">
                                                {receita.modalidade?.replace('_', ' ')}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Competência</p>
                                            <p className="font-medium text-gray-800 text-sm mt-1">{compStr}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Vencimento (Previsão)</p>
                                            <p className="font-medium text-gray-800 text-sm mt-1">{receita.vencimento ? new Date(receita.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Imediato'}</p>
                                        </div>
                                        <div className="space-y-1 md:text-right">
                                            <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Valor Total</p>
                                            <p className="font-bold text-blue-700 text-base mt-0.5">{valorStr}</p>
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

                                    {errDetalhes && (
                                        <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-xs font-mono">
                                            <strong>ERRO API:</strong> {errDetalhes instanceof Error ? errDetalhes.message : JSON.stringify(errDetalhes)}
                                        </div>
                                    )}

                                    {detalhesReceita?.receitas_operacionais_itens?.length > 0 ? (
                                        <div className="space-y-3">
                                            {detalhesReceita.receitas_operacionais_itens.map((item: any) => {
                                                const op = item.operacoes_producao;
                                                return (
                                                    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-sm">
                                                        {op ? (
                                                            <div className="flex flex-col gap-6">
                                                                {/* BLOCO 02: Origem */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Origem da Receita</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Origem</span> <span className="font-medium text-gray-700 block">Operação por Volume</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Nº Operação</span> <button type="button" onClick={() => { onClose(); navigate("/operacional/operacoes", { state: { highlight: op.id } }); }} className="font-bold text-blue-600 hover:underline truncate tracking-wide block cursor-pointer">{op.id?.substring(0, 8) || '-'}</button></div>
                                                                        <div><span className="text-gray-400 text-xs block">Data Op.</span> <span className="font-medium text-gray-700">{op.data_operacao ? new Date(op.data_operacao).toLocaleDateString('pt-BR') : 'N/A'}</span></div>
                                                                        <div>
                                                                            <span className="text-gray-400 text-xs block mb-0.5">Status Operacional</span>
                                                                            <span className="font-medium text-gray-700 uppercase text-[10px] bg-gray-100 px-2 py-0.5 rounded border">{op.status?.replace('_', ' ') || 'Processada'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 03: Dados Operacionais */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Dados Operacionais</h5>
                                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                                        <div className="col-span-2"><span className="text-gray-400 text-xs block">Serviço</span> <span className="font-medium text-gray-700 truncate block">{op.servicos?.nome || op.servicos?.descricao || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Produto</span> <span className="font-medium text-gray-700 truncate block">{op.produtos?.nome || op.produtos?.descricao || '-'}</span></div>
                                                                        <div>
                                                                            <span className="text-gray-400 text-xs block">Quantidade</span>
                                                                            <span className="font-medium text-gray-700">{op.quantidade || 0}</span>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-gray-400 text-xs block">V. Unitário</span>
                                                                            <span className="font-medium text-gray-700">R$ {Number(Number(op.valor_unitario || 0) === 0 && Number(op.quantidade || 0) > 0 && Number(op.valor_total || 0) > 0 ? (Number(op.valor_total) / Number(op.quantidade)) : (op.valor_unitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                        <div><span className="text-gray-400 text-xs block">Materiais</span> <span className="font-medium text-gray-700">R$ {Number(op.valor_materiais || op.custo_materiais || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">V. ISS</span> <span className="font-medium text-gray-700">R$ {Number(op.valor_iss || op.iss || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Forma Pgto</span> <span className="font-medium text-gray-700 truncate block">{op.formas_pagamento_operacional?.nome || op.formas_pagamento_operacional?.descricao || '-'}</span></div>
                                                                        <div className="col-span-2 border-t pt-2 md:border-none md:pt-0">
                                                                            <span className="text-gray-400 text-[11px] font-semibold uppercase block">Valor Total Origem</span>
                                                                            <span className="font-bold text-blue-700 text-lg">R$ {Number(op.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* BLOCO 04: Responsáveis */}
                                                                <div>
                                                                    <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Responsáveis</h5>
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div><span className="text-gray-400 text-xs block">Empresa Faturada</span> <span className="font-medium text-gray-700 truncate block">{receita.empresas?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Encarregado</span> <span className="font-medium text-gray-700 truncate tracking-wide">{op.encarregado?.nome || op.encarregado_id?.substring(0, 8) || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Fornecedor (Mão de Obra)</span> <span className="font-medium text-gray-700 truncate block">{op.fornecedores?.nome_fantasia || op.fornecedores?.razao_social || op.fornecedores?.nome || '-'}</span></div>
                                                                        <div><span className="text-gray-400 text-xs block">Transportadora Cliente</span> <span className="font-medium text-gray-700 truncate block">{op.transportadoras?.nome_fantasia || op.transportadoras?.razao_social || op.transportadoras?.nome || '-'}</span></div>
                                                                    </div>
                                                                </div>

                                                                <div className="pt-2 flex items-center justify-between">
                                                                    {op.observacao ? (
                                                                        <div className="bg-yellow-50/50 px-3 py-2 rounded text-gray-600 text-xs border border-yellow-100 flex-1 mr-4">
                                                                            <strong className="text-yellow-700">Obs:</strong> {op.observacao}
                                                                        </div>
                                                                    ) : <div className="flex-1"></div>}

                                                                    <Button type="button" variant="outline" size="sm" className="h-8 gap-2 text-xs bg-white shrink-0 shadow-sm border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => { onClose(); navigate("/operacional/operacoes", { state: { highlight: op.id } }); }}>
                                                                        <Layers className="h-3.5 w-3.5" />
                                                                        Ir para Operação Original
                                                                    </Button>
                                                                </div>
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
                        {historico.filter((h: any) => h.acao === 'Cobrança Gerada').length > 0 ? (
                            <div className="space-y-4">
                                <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-3">
                                    <FileSpreadsheet className="h-5 w-5 text-blue-500" /> Documentos Faturados
                                </h4>
                                {historico.filter((h: any) => h.acao === 'Cobrança Gerada').map((h: any) => (
                                    <div key={h.id} className="bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between hover:border-blue-200 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                                                <Receipt className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <h5 className="font-bold text-gray-800 text-sm">{h.detalhes?.formato || 'Documento PDF'} <span className="text-gray-400 font-normal text-xs ml-2">#{h.id.substring(0, 8).toUpperCase()}</span></h5>
                                                <p className="text-xs text-gray-500 mt-0.5">Gerado em: {new Date(h.created_at).toLocaleString('pt-BR')} por {h.detalhes?.usuario_email || 'Sistema'}</p>
                                                {h.detalhes?.vencimento && <p className="text-xs text-gray-600 font-medium mt-1">Vencimento registrado: {new Date(h.detalhes.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')}</p>}
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50" onClick={() => generateCobrancaPDF(receita, detalhesReceita, h.detalhes?.formato || 'Fatura (2ª Via)', h.detalhes?.vencimento || receita.vencimento)}>
                                            <Paperclip className="h-3.5 w-3.5" />
                                            Baixar 2ª Via
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="bg-white p-8 rounded-xl border border-dashed text-center flex flex-col items-center justify-center">
                                <FileSpreadsheet className="h-10 w-10 text-gray-300 mb-3" />
                                <h4 className="font-bold text-gray-700">Central de Documentos</h4>
                                <p className="text-gray-500 text-sm mt-1 max-w-sm mb-4">Boletos, Notas Fiscais e Memórias de Cálculo vinculados a este recebimento ficarão salvos aqui.</p>
                                <Button variant="outline"><Paperclip className="w-4 h-4 mr-2" /> Anexar Documento</Button>
                            </div>
                        )}
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
                                                <div className="flex-1 bg-white border shadow-sm rounded-lg p-4 -mt-2 hover:shadow-md transition-shadow">
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-2">
                                                            {h.acao?.toLowerCase().includes('recebimento') || h.acao?.toLowerCase().includes('concilia') ? (
                                                                <CheckCircle className="h-4 w-4 text-emerald-500" />
                                                            ) : h.acao?.toLowerCase().includes('cobrança') || h.acao?.toLowerCase().includes('fatura') ? (
                                                                <FileText className="h-4 w-4 text-blue-500" />
                                                            ) : h.acao?.toLowerCase().includes('envia') ? (
                                                                <Send className="h-4 w-4 text-orange-500" />
                                                            ) : (
                                                                <Clock className="h-4 w-4 text-gray-500" />
                                                            )}
                                                            <p className="font-bold text-gray-800 text-sm">{h.acao}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="block text-[11px] font-bold text-gray-700">{dateLabel}</span>
                                                            <span className="block text-[10px] text-gray-500 font-mono mt-0.5">{timeLabel}</span>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3 border-t border-gray-100 pt-3">
                                                        <div>
                                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-0.5">Usuário</span>
                                                            <span className="text-xs font-medium text-gray-700">{h.detalhes?.usuario_email || 'Sistema'}</span>
                                                        </div>

                                                        <div className="md:text-right">
                                                            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest block mb-0.5">Origem</span>
                                                            <span className="text-xs font-medium text-gray-700">{h.detalhes?.origem || 'Financeiro -> Contas a Receber'}</span>
                                                        </div>
                                                    </div>

                                                    {isStatusChange && (
                                                        <div className="flex items-center gap-2 bg-gray-50 p-2.5 rounded-lg border border-gray-100 mb-3 text-xs w-full">
                                                            <span className="text-gray-500 truncate">{h.status_anterior === 'recebido' || h.status_anterior === 'pago' || h.status_anterior === 'conciliado' ? 'Recebido' : (h.status_anterior?.replace('_', ' ') || 'Indefinido')}</span>
                                                            <span className="text-gray-400 text-[10px] px-1">↓</span>
                                                            <span className="font-bold text-emerald-700">{h.status_novo === 'recebido' || h.status_novo === 'pago' || h.status_novo === 'conciliado' ? 'Recebido' : (h.status_novo?.replace('_', ' ') || 'Indefinido')}</span>
                                                        </div>
                                                    )}

                                                    {h.descricao && (
                                                        <p className="text-gray-600 text-[13px] leading-relaxed">{h.descricao}</p>
                                                    )}

                                                    {h.detalhes?.texto && !h.descricao && (
                                                        <p className="text-gray-600 text-[13px] leading-relaxed">{h.detalhes.texto}</p>
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
