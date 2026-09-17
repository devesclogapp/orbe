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
import { ToastAction } from "@/components/ui/toast";
import { useTenant } from "@/contexts/TenantContext";
import {
    CheckCircle, FileText, Send, Clock, Receipt, Calculator,
    Banknote, ListPlus, Paperclip, ChevronLeft,
    Zap, Layers, FileSpreadsheet, ArrowRightLeft, Wallet
} from "lucide-react";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { generateCobrancaPDF } from "@/utils/pdfCobranca";
import { formatDateOnly } from "@/utils/financeiro";
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
    const [cobrancaForm, setCobrancaForm] = useState({ formato: 'Fatura Comercial (PDF)', vencimento: receita?.vencimento || '' });
    const [consolidarForm, setConsolidarForm] = useState({ vencimento: receita?.vencimento || '' });

    // Data Load
    const { data: historico = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ['receita-historico', receita?.id],
        queryFn: () => ReceitasService.getHistorico(receita!.id),
        enabled: isOpen && !!receita?.id
    });

    const { data: detalhesReceita, isLoading: isLoadingDetalhes, error: errDetalhes } = useQuery({
        queryKey: ['receita-detalhes', receita?.id],
        queryFn: () => ReceitasService.getReceitaDetalhes(receita!.id),
        enabled: isOpen && !!receita?.id,
        staleTime: 0,
        refetchOnMount: 'always'
    });

    // Mutations
    const updateStatusMutation = useMutation({
        mutationFn: (newStatus: string) => ReceitasService.updateStatus(tenantId!, receita.id, newStatus),
    });

    const fecharCompetenciaMutation = useMutation({
        mutationFn: ({ vencimento }: { vencimento?: string }) =>
            ReceitasService.fecharCompetenciaMensal(tenantId!, receita.id, vencimento),
    });

    const updateReceitaMutation = useMutation({
        mutationFn: (payload: any) => ReceitasService.updateReceita(tenantId!, receita.id, payload),
    });

    const logEventMutation = useMutation({
        mutationFn: ({ acao, detalhesText, json, statusAnterior, statusNovo }: any) =>
            ReceitasService.logEvent(tenantId!, receita.id, acao, detalhesText, json, statusAnterior, statusNovo),
    });

    const finishMutationSuccess = () => {
        toast({
            title: "Operação registrada com sucesso!",
            description: "O pipeline financeiro foi atualizado.",
            action: (
                <ToastAction altText="Ir para Dashboard" onClick={() => navigate('/dashboard')} className="bg-primary text-white hover:bg-primary/90 hover:text-white border-transparent">
                    Ver Dashboard
                </ToastAction>
            )
        });
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["receita-historico"] });
        queryClient.invalidateQueries({ queryKey: ["receita-detalhes"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes"] });
        setIsSubmitting(false);
        setActionView('main');
        onSuccess();
        onClose();
    }

    const finishRecebimentoSuccess = () => {
        const receitaId = receita?.id;
        toast({
            title: "Recebimento registrado",
            description: "O pagamento foi marcado como recebido no ORBE, mas ainda precisa ser conferido no extrato bancário. Próxima etapa: Conciliação bancária.",
            action: (
                <ToastAction
                    altText="Ir para Conciliação"
                    onClick={() => navigate('/financeiro/retorno', {
                        state: {
                            activeTab: 'receitas',
                            highlightReceitaId: receitaId
                        }
                    })}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white border-transparent"
                >
                    Ir para Conciliação
                </ToastAction>
            ),
            duration: 8000,
        });
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["receita-historico"] });
        queryClient.invalidateQueries({ queryKey: ["receita-detalhes"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes"] });
        queryClient.invalidateQueries({ queryKey: ["receitas_para_conciliacao"] });
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
    const firstItem = detalhesReceita?.receitas_operacionais_itens?.[0];
    const itemOps = firstItem?.operacoes_producao;
    const itemExtra = firstItem?.servicos_extras_operacionais;
    const itemCount = detalhesReceita?.receitas_operacionais_itens?.length || 0;

    let servicoNome = "...";
    if (!isLoadingDetalhes) {
        if (itemCount > 1) {
            servicoNome = `Consolidada (${itemCount} lançamentos)`;
        } else if (itemOps?.servicos?.nome) {
            servicoNome = itemOps.servicos.nome;
        } else if (itemExtra?.tipo_servico) {
            servicoNome = itemExtra.tipo_servico;
        } else {
            servicoNome = 'Operação Avulsa';
        }
    }

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
    } else if (itemExtra?.data || itemExtra?.data_servico) {
        const rawDate = itemExtra.data || itemExtra.data_servico;
        const dt = new Date(rawDate);
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
            onSuccess: finishRecebimentoSuccess,
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
                    onSuccess: finishRecebimentoSuccess,
                    onError: handleError
                });
            },
            onError: handleError
        });
    }

    const handleConfirmGerarCobranca = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const proceedWithGeneration = () => {
            // Dispara o download do arquivo imediatamente
            generateCobrancaPDF(receita, detalhesReceita, cobrancaForm.formato, cobrancaForm.vencimento);

            logEventMutation.mutate({
                acao: 'GERAR_COBRANCA',
                detalhesText: `Documentos gerados em formato: ${cobrancaForm.formato}. Vencimento: ${cobrancaForm.vencimento ? new Date(cobrancaForm.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Imediato'}.`,
                json: { tipo: 'Documento', formato: cobrancaForm.formato, vencimento: cobrancaForm.vencimento || null },
                statusAnterior: receita.status,
                statusNovo: receita.status
            }, {
                onSuccess: () => {
                    toast({
                        title: "Documento de cobrança gerado",
                        description: "O documento foi emitido com sucesso e o registro foi atualizado no histórico.",
                    });
                    queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
                    queryClient.invalidateQueries({ queryKey: ["receita-historico", receita?.id] });
                    queryClient.invalidateQueries({ queryKey: ["receita-detalhes", receita?.id] });
                    queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
                    queryClient.invalidateQueries({ queryKey: ["operacoes"] });
                    setIsSubmitting(false);
                    setActionView('main');
                    onSuccess();
                },
                onError: handleError
            });
        };

        if (cobrancaForm.vencimento && cobrancaForm.vencimento !== receita.vencimento) {
            updateReceitaMutation.mutate({ vencimento: cobrancaForm.vencimento }, {
                onSuccess: proceedWithGeneration,
                onError: handleError
            });
        } else {
            proceedWithGeneration();
        }
    };

    const handleConfirmEnviarCobranca = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        updateStatusMutation.mutate('cobranca_enviada', {
            onSuccess: () => {
                toast({
                    title: "Cobrança registrada como enviada",
                    description: "O status da receita foi atualizado no pipeline.",
                });
                queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
                queryClient.invalidateQueries({ queryKey: ["receita-historico"] });
                queryClient.invalidateQueries({ queryKey: ["receita-detalhes"] });
                queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
                queryClient.invalidateQueries({ queryKey: ["operacoes"] });
                setIsSubmitting(false);
                setActionView('main');
                onSuccess();
                onClose();
            },
            onError: handleError
        });
    };

    const handleConfirmConsolidar = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        fecharCompetenciaMutation.mutate({ vencimento: consolidarForm.vencimento }, {
            onSuccess: () => {
                toast({
                    title: "Competência consolidada com sucesso!",
                    description: "A receita de faturamento mensal foi fechada e está pronta para cobrança.",
                });
                queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
                queryClient.invalidateQueries({ queryKey: ["receita-detalhes"] });
                queryClient.invalidateQueries({ queryKey: ["receita-historico"] });
                queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
                queryClient.invalidateQueries({ queryKey: ["operacoes"] });
                setIsSubmitting(false);
                setActionView('main');
                onSuccess();
                onClose();
            },
            onError: handleError
        });
    };

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
                        <Button type="button" variant="outline" className={cn("flex-1", cobrancaForm.formato === 'Fatura Comercial (PDF)' ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white")} onClick={() => setCobrancaForm(p => ({ ...p, formato: 'Fatura Comercial (PDF)' }))}>Fatura Comercial (PDF)</Button>
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
        <form onSubmit={handleConfirmEnviarCobranca} className="space-y-5 animate-in slide-in-from-right-4">
            <div className="flex items-center gap-2 mb-2">
                <Button type="button" variant="ghost" size="icon" className="-ml-3" onClick={() => setActionView('main')}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <h4 className="font-semibold text-gray-800">Registrar Envio de Cobrança</h4>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-5 space-y-3">
                <div className="flex items-start gap-3">
                    <div className="bg-amber-100 p-2 rounded-lg text-amber-700 mt-0.5 shrink-0">
                        <Send className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-gray-900">
                            Confirma que esta cobrança já foi enviada ao cliente por um canal externo?
                        </p>
                        <p className="text-xs text-gray-600 leading-relaxed">
                            O ORBE não realiza o envio automaticamente. Esta ação apenas registra que o documento foi enviado externamente.
                        </p>
                    </div>
                </div>

                <div className="border-t border-amber-200/50 pt-3 mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                    <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Cliente</span>
                        <span className="font-medium text-gray-800">{clienteNome}</span>
                    </div>
                    <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Valor Total</span>
                        <span className="font-bold text-blue-700">{valorStr}</span>
                    </div>
                </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setActionView('main')} disabled={isSubmitting}>
                    Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
                    <Send className="h-4 w-4" />
                    {isSubmitting ? "Registrando..." : "Confirmar Envio"}
                </Button>
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
        // FIX 13.2: Semântica precisa de Recebido vs Conciliado
        if (receita.status === 'conciliado') {
            const auditConcil = historico?.slice().reverse().find((h: any) =>
                h.acao?.includes('Conciliação') ||
                h.status_novo === 'conciliado'
            );

            return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5 flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full mt-0.5">
                        <CheckCircle className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-emerald-800 text-sm">Recebimento Conciliado</h4>
                            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                                Ciclo financeiro concluído
                            </span>
                        </div>
                        <div className="text-emerald-700/80 text-xs mt-1.5 leading-relaxed space-y-1">
                            <p>A conferência no extrato bancário foi confirmada e o ciclo financeiro está concluído.</p>
                            {auditConcil ? (
                                <ul className="pl-0 flex flex-wrap items-center gap-x-4 pt-1 mt-2 border-t border-emerald-200/50">
                                    <li><span className="font-semibold text-emerald-700">Data e Hora:</span> {new Date(auditConcil.created_at).toLocaleDateString('pt-BR')} às {new Date(auditConcil.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</li>
                                    <li><span className="font-semibold text-emerald-700">Conciliado por:</span> {auditConcil.detalhes?.usuario_email || 'Sistema'}</li>
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

        if (receita.status === 'recebido' || receita.status === 'pago') {
            const auditReceb = historico?.slice().reverse().find((h: any) =>
                h.acao?.includes('Recebimento') ||
                h.status_novo === 'recebido' ||
                h.status_novo === 'pago'
            );

            return (
                <div className="bg-amber-50/70 border border-amber-200 rounded-lg p-5 flex items-start gap-4">
                    <div className="bg-amber-100 p-2 rounded-full mt-0.5">
                        <Clock className="h-6 w-6 text-amber-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                            <h4 className="font-bold text-amber-900 text-sm">Recebimento registrado</h4>
                            <span className="text-[11px] font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                                Próxima etapa: Conciliação bancária
                            </span>
                        </div>
                        <div className="text-amber-800/90 text-xs mt-1.5 leading-relaxed space-y-1">
                            <p>O pagamento foi informado como recebido no ORBE. Confira o crédito no extrato bancário para concluir a conciliação.</p>
                            {auditReceb ? (
                                <ul className="pl-0 flex flex-wrap items-center gap-x-4 pt-1 mt-2 border-t border-amber-200/60 text-amber-800">
                                    <li><span className="font-semibold">Data e Hora:</span> {new Date(auditReceb.created_at).toLocaleDateString('pt-BR')} às {new Date(auditReceb.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</li>
                                    <li><span className="font-semibold">Registrado por:</span> {auditReceb.detalhes?.usuario_email || 'Sistema'}</li>
                                </ul>
                            ) : (
                                <p><span className="font-semibold">Data de Atualização:</span> {new Date(receita.updated_at || new Date()).toLocaleString('pt-BR')}</p>
                            )}
                        </div>
                        <div className="mt-4 border-t border-amber-200/60 pt-3 flex flex-wrap items-center gap-2">
                            <Button
                                size="sm"
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5 shadow-sm"
                                onClick={() => {
                                    onClose();
                                    navigate('/financeiro/retorno', {
                                        state: {
                                            activeTab: 'receitas',
                                            highlightReceitaId: receita.id
                                        }
                                    });
                                }}
                            >
                                <ArrowRightLeft className="h-4 w-4" />
                                Ir para Conciliação
                            </Button>
                            {itemOps?.id && (
                                <Button size="sm" variant="outline" className="text-gray-700 border-gray-300 hover:bg-gray-100" onClick={() => { onClose(); navigate("/operacional/operacoes", { state: { highlight: itemOps.id } }); }}>
                                    Visualizar Operação Original
                                </Button>
                            )}
                            <Button size="sm" variant="ghost" className="text-gray-500 hover:text-gray-800" onClick={onClose}>
                                Voltar ao Kanban
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        // ---------------------------------------------------------------------
        // CONFIGURAÇÃO GENÉRICA DE ORIENTAÇÃO SEQUENCIAL DAS AÇÕES DO FLUXO
        // Determinada pela modalidade e status canônico da receita
        // ---------------------------------------------------------------------
        interface EtapaFluxoSequencial {
            numero: number;
            titulo: string;
            detalhe: string;
            destaque?: boolean;
        }

        interface OrientacaoFluxo {
            titulo: string;
            badge: string;
            badgeClasses: string;
            cardBorder: string;
            cardBg: string;
            icone: React.ComponentType<{ className?: string }>;
            iconeColor: string;
            descricao: string;
            alertaContextual?: string;
            etapas?: EtapaFluxoSequencial[];
            proximaAcao?: {
                label: string;
                icone: React.ComponentType<{ className?: string }>;
                onClick: () => void;
                className: string;
                disabled?: boolean;
            };
            acaoSecundaria?: {
                label: string;
                icone?: React.ComponentType<{ className?: string }>;
                onClick: () => void;
                variant?: 'outline' | 'ghost' | 'secondary';
                className?: string;
                disabled?: boolean;
            };
        }

        const isPendenteCobranca = receita.status === 'pendente_cobranca';
        const isCobrancaEnviada = receita.status === 'cobranca_enviada' || receita.status === 'pendente_recebimento';
        const hasDocumentoGerado = receita.status === 'cobranca_gerada' || Boolean(historico?.some((h: any) => h.acao === 'GERAR_COBRANCA' || h.acao === 'Cobrança Gerada'));

        const getOrientacaoFluxo = (): OrientacaoFluxo | null => {
            const modalidade = receita.modalidade;
            const status = receita.status;

            // 1. CAIXA_IMEDIATO
            if (modalidade === 'CAIXA_IMEDIATO') {
                return {
                    titulo: "Recebimento Imediato (À Vista)",
                    badge: "Próxima etapa: Confirmar recebimento imediato",
                    badgeClasses: "text-emerald-800 bg-emerald-100 border-emerald-200",
                    cardBorder: "border-emerald-200",
                    cardBg: "bg-emerald-50/50",
                    icone: Zap,
                    iconeColor: "text-emerald-600",
                    descricao: "Operação com liquidação imediata. Confirme a conferência e o recebimento com os dados do comprovante (PIX, dinheiro ou cartão).",
                    etapas: [
                        { numero: 1, titulo: "Conferência do pagamento", detalhe: "Conferir o comprovante ou crédito imediato da operação.", destaque: true },
                        { numero: 2, titulo: "Confirmação no ORBE", detalhe: "Registrar o recebimento à vista para alimentar o fluxo de caixa." }
                    ],
                    proximaAcao: {
                        label: "Confirmar Conferência e Recebimento",
                        icone: CheckCircle,
                        onClick: () => setActionView('confirmar_pix'),
                        className: "bg-emerald-600 hover:bg-emerald-700 text-white",
                        disabled: isSubmitting
                    }
                };
            }

            // 2. FATURAMENTO_MENSAL — aguardando_fechamento
            if (modalidade === 'FATURAMENTO_MENSAL' && status === 'aguardando_fechamento') {
                return {
                    titulo: "Competência em Aberto",
                    badge: "Próxima etapa: Consolidar e fechar a competência",
                    badgeClasses: "text-purple-800 bg-purple-100 border-purple-200",
                    cardBorder: "border-purple-200",
                    cardBg: "bg-purple-50/60",
                    icone: Clock,
                    iconeColor: "text-purple-600",
                    descricao: "As operações de faturamento mensal deste ciclo foram apuradas. Para dar início ao processo de cobrança, consolide a competência e defina o vencimento padrão.",
                    etapas: [
                        { numero: 1, titulo: "Consolidar competência", detalhe: "Fechar o ciclo mensal e fixar a data de vencimento padrão da fatura.", destaque: true },
                        { numero: 2, titulo: "Gerar fatura consolidada", detalhe: "Emitir o PDF da fatura unificada com todas as operações apuradas." },
                        { numero: 3, titulo: "Enviar externamente e registrar no ORBE", detalhe: "Encaminhar ao cliente e registrar o envio no sistema." }
                    ],
                    proximaAcao: {
                        label: "1. Consolidar Competência & Fechamento",
                        icone: ListPlus,
                        onClick: () => setActionView('consolidar'),
                        className: "bg-purple-600 hover:bg-purple-700 text-white",
                        disabled: isSubmitting
                    },
                    acaoSecundaria: {
                        label: "Pré-visualizar Documento Consolidado (Rascunho)",
                        icone: FileText,
                        onClick: () => setActionView('gerar_cobranca'),
                        variant: "ghost",
                        className: "text-gray-500 hover:text-gray-800",
                        disabled: isSubmitting
                    }
                };
            }

            // 3. DUPLICATA ou FATURAMENTO_MENSAL — cobranca_enviada
            if (isCobrancaEnviada) {
                const isMensal = modalidade === 'FATURAMENTO_MENSAL';
                return {
                    titulo: "Cobrança Enviada ao Cliente",
                    badge: "Próxima etapa: Confirmar recebimento",
                    badgeClasses: "text-orange-800 bg-orange-100 border-orange-200",
                    cardBorder: "border-orange-200",
                    cardBg: "bg-orange-50/50",
                    icone: Receipt,
                    iconeColor: "text-orange-600",
                    descricao: isMensal
                        ? "A fatura consolidada foi enviada ao cliente. O título encontra-se em monitoramento até o vencimento."
                        : "A duplicata/fatura foi enviada. O título encontra-se em monitoramento até o vencimento.",
                    alertaContextual: "Atenção: Somente confirme o recebimento após o pagamento ter sido efetivamente identificado (comprovante ou liquidação bancária).",
                    etapas: [
                        { numero: 1, titulo: "Cobrança enviada ao cliente", detalhe: "Documento emitido e encaminhado pelos canais comerciais.", destaque: false },
                        { numero: 2, titulo: "Identificação do pagamento", detalhe: "Aguardar compensação ou comprovante de pagamento real.", destaque: true },
                        { numero: 3, titulo: "Confirmar recebimento", detalhe: "Registrar a liquidação no ORBE para liberar a conciliação bancária.", destaque: false }
                    ],
                    proximaAcao: {
                        label: "Confirmar Recebimento do Pagamento",
                        icone: Banknote,
                        onClick: handleConfirmRecebimento,
                        className: "bg-emerald-600 hover:bg-emerald-700 text-white",
                        disabled: isSubmitting
                    },
                    acaoSecundaria: {
                        label: isMensal ? "Reemitir Doc. Consolidado" : "Reemitir Documento de Cobrança",
                        icone: FileText,
                        onClick: () => setActionView('gerar_cobranca'),
                        variant: "ghost",
                        className: "text-gray-500 hover:text-gray-800",
                        disabled: isSubmitting
                    }
                };
            }

            // 4. DUPLICATA ou FATURAMENTO_MENSAL — pendente_cobranca / cobranca_gerada (ou padrão)
            const isMensal = modalidade === 'FATURAMENTO_MENSAL';

            if (hasDocumentoGerado) {
                return {
                    titulo: isMensal ? "Competência Consolidada — Documento Emitido" : "Operação Faturável — Documento Emitido",
                    badge: "Próxima etapa: 2. Enviar e Registrar Cobrança",
                    badgeClasses: "text-blue-800 bg-blue-100 border-blue-200",
                    cardBorder: "border-blue-200",
                    cardBg: "bg-blue-50/50",
                    icone: Wallet,
                    iconeColor: "text-blue-600",
                    descricao: isMensal
                        ? "O documento de cobrança já foi gerado. Conclua a sequência operacional encaminhando o documento ao cliente e registrando o envio no sistema:"
                        : "O documento de cobrança já foi gerado. Conclua a sequência operacional encaminhando a fatura ao cliente e registrando o envio no sistema:",
                    etapas: [
                        { numero: 1, titulo: "Gerar documento de cobrança", detalhe: "Documento emitido com sucesso.", destaque: false },
                        { numero: 2, titulo: "Enviar externamente ao cliente", detalhe: "Encaminhe o documento emitido por e-mail ou WhatsApp ao setor financeiro do cliente.", destaque: true },
                        { numero: 3, titulo: "Registrar envio no ORBE", detalhe: "Marque a cobrança como enviada para iniciar o monitoramento do prazo de vencimento.", destaque: false }
                    ],
                    proximaAcao: {
                        label: "2. Registrar como Enviado ao Cliente",
                        icone: Send,
                        onClick: () => setActionView('enviar_cobranca'),
                        className: "bg-blue-600 hover:bg-blue-700 text-white",
                        disabled: isSubmitting
                    },
                    acaoSecundaria: {
                        label: isMensal ? "Reemitir Doc. Consolidado" : "Reemitir Documento de Cobrança",
                        icone: FileText,
                        onClick: () => setActionView('gerar_cobranca'),
                        variant: "ghost",
                        className: "text-gray-500 hover:text-gray-800",
                        disabled: isSubmitting
                    }
                };
            }

            return {
                titulo: isMensal ? "Competência Consolidada — Pronta para Cobrança" : "Operação Faturável — Emissão de Cobrança",
                badge: "Fluxo sequencial de cobrança",
                badgeClasses: "text-blue-800 bg-blue-100 border-blue-200",
                cardBorder: "border-blue-200",
                cardBg: "bg-blue-50/50",
                icone: Wallet,
                iconeColor: "text-blue-600",
                descricao: isMensal
                    ? "Competência mensal consolidada e fechada. O ORBE não realiza o envio automático; siga a sequência operacional para emitir e registrar a cobrança:"
                    : "Operação a prazo faturável. O ORBE não realiza o envio automático; siga a sequência operacional para emitir e registrar a cobrança:",
                etapas: [
                    { numero: 1, titulo: "Gerar documento de cobrança", detalhe: isMensal ? "Baixe a Fatura Consolidada em PDF no ORBE contendo todas as operações apuradas." : "Emita a fatura ou documento de cobrança em PDF no ORBE.", destaque: true },
                    { numero: 2, titulo: "Enviar externamente ao cliente", detalhe: "Encaminhe o documento emitido por e-mail ou WhatsApp ao setor financeiro do cliente.", destaque: false },
                    { numero: 3, titulo: "Registrar envio no ORBE", detalhe: "Marque a cobrança como enviada para iniciar o monitoramento do prazo de vencimento.", destaque: false }
                ],
                proximaAcao: {
                    label: "1. Gerar Documento de Cobrança",
                    icone: Calculator,
                    onClick: () => setActionView('gerar_cobranca'),
                    className: "bg-blue-600 hover:bg-blue-700 text-white",
                    disabled: isSubmitting
                },
                acaoSecundaria: {
                    label: "2. Registrar como Enviado ao Cliente",
                    icone: Send,
                    onClick: () => setActionView('enviar_cobranca'),
                    variant: "outline",
                    className: "border-blue-200 text-blue-800 bg-white hover:bg-blue-50",
                    disabled: isSubmitting
                }
            };
        };

        const orientacao = getOrientacaoFluxo();
        if (!orientacao) return null;

        const IconeHeader = orientacao.icone;

        return (
            <div className={cn("border rounded-lg p-4 space-y-3", orientacao.cardBg, orientacao.cardBorder)}>
                <div className="flex items-center justify-between gap-2">
                    <h5 className="font-bold text-gray-900 text-sm flex items-center gap-1.5">
                        <IconeHeader className={cn("h-4 w-4", orientacao.iconeColor)} /> {orientacao.titulo}
                    </h5>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded border", orientacao.badgeClasses)}>
                        {orientacao.badge}
                    </span>
                </div>

                <p className="text-xs text-gray-600 leading-relaxed">
                    {orientacao.descricao}
                </p>

                {/* Linha das Etapas Sequenciais */}
                {orientacao.etapas && orientacao.etapas.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
                        {orientacao.etapas.map((etapa) => (
                            <div
                                key={etapa.numero}
                                className={cn(
                                    "p-2.5 rounded border text-xs transition-colors",
                                    etapa.destaque
                                        ? "bg-white border-blue-300 shadow-sm ring-1 ring-blue-100"
                                        : "bg-white/60 border-gray-200 opacity-75"
                                )}
                            >
                                <div className="flex items-center gap-1.5 font-bold mb-1">
                                    <span
                                        className={cn(
                                            "h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-extrabold",
                                            etapa.destaque
                                                ? "bg-blue-600 text-white"
                                                : "bg-gray-200 text-gray-700"
                                        )}
                                    >
                                        {etapa.numero}
                                    </span>
                                    <span className={etapa.destaque ? "text-blue-950" : "text-gray-700"}>
                                        {etapa.titulo}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-500 leading-tight">
                                    {etapa.detalhe}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Alerta contextual se houver */}
                {orientacao.alertaContextual && (
                    <div className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded p-2.5">
                        <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{orientacao.alertaContextual}</span>
                    </div>
                )}

                <div className="space-y-2 pt-1">
                    {/* Botão de Ação Primária para Cobrança Enviada */}
                    {isCobrancaEnviada && (
                        <Button
                            onClick={handleConfirmRecebimento}
                            disabled={isSubmitting}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-11 font-semibold shadow-sm"
                        >
                            <Banknote className="h-4 w-4" />
                            Confirmar Recebimento do Pagamento
                        </Button>
                    )}

                    {/* Botão de Ação Primária para demais estados */}
                    {!isCobrancaEnviada && orientacao.proximaAcao && (
                        <Button
                            onClick={orientacao.proximaAcao.onClick}
                            disabled={orientacao.proximaAcao.disabled}
                            className={cn("w-full gap-2 h-11 font-semibold shadow-sm", orientacao.proximaAcao.className)}
                        >
                            <orientacao.proximaAcao.icone className="h-4 w-4" />
                            {orientacao.proximaAcao.label}
                        </Button>
                    )}

                    {/* Ação secundária para antes da emissão: Registrar como Enviado */}
                    {isPendenteCobranca && (
                        !hasDocumentoGerado && (
                            <Button
                                onClick={() => setActionView('enviar_cobranca')}
                                disabled={isSubmitting}
                                variant="outline"
                                className="w-full gap-2 h-10 border-blue-200 text-blue-800 bg-white hover:bg-blue-50"
                            >
                                <Send className="h-4 w-4 text-blue-600" />
                                2. Registrar como Enviado ao Cliente
                            </Button>
                        )
                    )}

                    {/* Outras Ações Secundárias (ex: Reemissão quando gerado, pré-visualização) */}
                    {(!isPendenteCobranca || hasDocumentoGerado) && orientacao.acaoSecundaria && (
                        <Button
                            onClick={orientacao.acaoSecundaria.onClick}
                            disabled={orientacao.acaoSecundaria.disabled}
                            variant={orientacao.acaoSecundaria.variant || "ghost"}
                            size="sm"
                            className={cn("w-full text-xs gap-1.5 h-8", orientacao.acaoSecundaria.className)}
                        >
                            {orientacao.acaoSecundaria.icone && <orientacao.acaoSecundaria.icone className="h-3.5 w-3.5" />}
                            {orientacao.acaoSecundaria.label}
                        </Button>
                    )}
                </div>
            </div>
        );
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
                            {itemCount > 1 
                                ? `Receita originada automaticamente a partir de ${itemCount} lançamentos operacionais agrupados.`
                                : itemExtra 
                                    ? `Receita originada automaticamente a partir do Serviço Extra ${itemExtra.id?.substring(0, 8) || ''}.`
                                    : `Receita originada automaticamente a partir da Operação por Volume ${itemOps?.id?.substring(0, 8) || 'Desconhecida'}.`
                            }
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
                            <div><span className="font-semibold text-gray-700 uppercase tracking-widest text-[10px]">Situação Financeira</span><br /> <span className="inline-block mt-0.5 text-blue-700 font-bold uppercase text-[11px] bg-blue-50 px-2 py-0.5 rounded">{receita.status === 'conciliado' ? 'CONCILIADO' : (receita.status === 'recebido' || receita.status === 'pago') ? 'RECEBIDO' : receita.status?.replace('_', ' ')}</span></div>
                        </div>

                        {/* Pipeline de Receita e Última Atualização */}
                        <div className="flex flex-col md:flex-row md:items-center justify-between border-t border-gray-100 pt-3 mt-1 gap-2">
                            <div className="flex items-center space-x-2 text-[11px] font-bold text-gray-400">
                                <span className={cn("flex items-center gap-1", (itemOps || itemExtra) ? "text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded" : "")}>
                                    <CheckCircle className="h-3.5 w-3.5" /> {itemExtra ? "Serviço Extra" : "Operação"}
                                </span>
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
                                        {receita.status === 'conciliado' ? (
                                            <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                                <CheckCircle className="h-3.5 w-3.5" /> Conciliação
                                            </span>
                                        ) : (receita.status === 'recebido' || receita.status === 'pago') ? (
                                            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded animate-pulse font-semibold" title="Conciliação pendente de conferência no extrato bancário">
                                                <Clock className="h-3.5 w-3.5 text-amber-600" /> Conciliação (Pendente)
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-gray-400">
                                                <CheckCircle className="h-3.5 w-3.5" /> Conciliação
                                            </span>
                                        )}
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
                                    <div className="flex flex-wrap items-start gap-4 md:gap-5 bg-white p-5 rounded-xl border shadow-sm">
                                        <div className="space-y-1.5 flex-[1_1_auto] min-w-max">
                                            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase leading-tight">Situação Financeira</p>
                                            {receita.status === 'conciliado' ? (
                                                <div className="inline-flex bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded gap-1 whitespace-nowrap items-center min-h-[22px]">
                                                    <CheckCircle className="h-3 w-3" /> CONCILIADO
                                                </div>
                                            ) : (receita.status === 'recebido' || receita.status === 'pago') ? (
                                                <div className="inline-flex bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded gap-1 whitespace-nowrap items-center min-h-[22px]" title="Recebimento registrado — aguardando conferência bancária">
                                                    <Clock className="h-3 w-3 text-amber-700" /> RECEBIMENTO REGISTRADO
                                                </div>
                                            ) : (
                                                <div className="inline-flex bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap items-center min-h-[22px]">
                                                    {receita.status?.replace('_', ' ').toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-1.5 flex-[1_1_auto] min-w-max">
                                            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase leading-tight">Modalidade</p>
                                            <div className="inline-flex bg-gray-100 text-gray-800 text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap items-center min-h-[22px] uppercase">
                                                {receita.modalidade?.replace('_', ' ')}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 flex-[1_1_auto] min-w-max">
                                            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase leading-tight">Competência</p>
                                            <p className="font-semibold text-gray-800 text-[15px] pt-0.5">{compStr}</p>
                                        </div>
                                        <div className="space-y-1.5 flex-[1_1_auto] min-w-max">
                                            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase leading-tight">Venc. <span className="opacity-70">(Prev)</span></p>
                                            <p className="font-semibold text-gray-800 text-[15px] whitespace-nowrap pt-0.5">
                                                {receita.vencimento ? new Date(receita.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR') : 'Imediato'}
                                            </p>
                                        </div>
                                        <div className="space-y-1.5 flex-[1_1_auto] min-w-max md:text-right">
                                            <p className="text-[10px] font-bold text-gray-400 tracking-wider uppercase leading-tight">Valor Total</p>
                                            <p className="font-black text-blue-700 text-[17px] whitespace-nowrap pt-0.5">{valorStr}</p>
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
                                        receita.modalidade === 'FATURAMENTO_MENSAL' ? (
                                            <div className="space-y-4">
                                                {/* TABELA CONSOLIDADA DE ITENS MENSAL (FIX 14) */}
                                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                                    <div className="bg-gray-50/80 px-4 py-3 border-b flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                                            Lançamentos Consolidados da Competência ({detalhesReceita.receitas_operacionais_itens.length})
                                                        </span>
                                                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                            Faturamento Mensal
                                                        </span>
                                                    </div>
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
                                                        <tbody className="divide-y divide-gray-100 text-gray-700">
                                                            {detalhesReceita.receitas_operacionais_itens.map((item: any) => {
                                                                const op = item.operacoes_producao;
                                                                const se = item.servicos_extras_operacionais;
                                                                const dataStr = op?.data_operacao ? formatDateOnly(op.data_operacao) : formatDateOnly(se?.data || se?.data_servico);
                                                                const servicoNome = op?.servicos?.nome || op?.servicos?.descricao || se?.tipo_servico || 'Serviço Operacional';
                                                                const prodNome = op?.produtos?.nome ? ` - ${op.produtos.nome}` : (se?.descricao && se?.tipo_servico ? ` (${se.descricao})` : (se?.descricao ? ` - ${se.descricao}` : ''));
                                                                const qtd = op?.quantidade || se?.quantidade || 1;
                                                                const vUnit = Number(op?.valor_unitario_snapshot ?? op?.valor_unitario ?? se?.valor_unitario ?? 0);
                                                                const valItem = Number(item.valor_item || op?.valor_total || se?.valor_total || 0);

                                                                return (
                                                                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                                                                        <td className="px-4 py-3 font-medium whitespace-nowrap">
                                                                            {dataStr}
                                                                        </td>
                                                                        <td className="px-3 py-3">
                                                                            {op ? (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => { onClose(); navigate("/operacional/operacoes", { state: { highlight: op.id } }); }}
                                                                                    className="font-bold text-blue-600 hover:underline tracking-wide"
                                                                                    title="Ver na Recepção Operacional"
                                                                                >
                                                                                    #{op.id?.substring(0, 8)}
                                                                                </button>
                                                                            ) : se ? (
                                                                                <span className="font-bold text-purple-600 tracking-wide" title="Serviço Extra">
                                                                                    SE #{se.id?.substring(0, 8)}
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-gray-400">-</span>
                                                                            )}
                                                                        </td>
                                                                        <td className="px-3 py-3 truncate max-w-[220px]">
                                                                            <span className="font-semibold text-gray-800">{servicoNome}</span>
                                                                            <span className="text-gray-500">{prodNome}</span>
                                                                        </td>
                                                                        <td className="px-3 py-3 text-center font-medium">
                                                                            {qtd}
                                                                        </td>
                                                                        <td className="px-3 py-3 text-right text-gray-500 whitespace-nowrap">
                                                                            R$ {vUnit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </td>
                                                                        <td className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                                                            R$ {valItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                        <tfoot className="bg-gray-50 border-t font-semibold text-gray-800">
                                                            <tr>
                                                                <td colSpan={4} className="px-4 py-3 text-xs text-gray-500 uppercase tracking-wide">
                                                                    Total da Competência ({detalhesReceita.receitas_operacionais_itens.length} {detalhesReceita.receitas_operacionais_itens.length === 1 ? 'item' : 'itens'})
                                                                </td>
                                                                <td className="px-3 py-3 text-right text-xs uppercase text-gray-500">
                                                                    TOTAL:
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-black text-blue-700 text-sm whitespace-nowrap">
                                                                    {valorStr}
                                                                </td>
                                                            </tr>
                                                        </tfoot>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {detalhesReceita.receitas_operacionais_itens.map((item: any) => {
                                                    const op = item.operacoes_producao;
                                                    const se = item.servicos_extras_operacionais;
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
                                                                            <div><span className="text-gray-400 text-xs block">Data Op.</span> <span className="font-medium text-gray-700">{formatDateOnly(op.data_operacao)}</span></div>
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
                                                                                <span className="font-medium text-gray-700">R$ {Number(op.valor_unitario_snapshot ?? op.valor_unitario_label ?? op.valor_unitario ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                            <div><span className="text-gray-400 text-xs block">Materiais</span> <span className="font-medium text-gray-700">R$ {Number(op.valor_total_materiais ?? op.valor_materiais ?? op.custo_materiais ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">V. ISS</span> <span className="font-medium text-gray-700">R$ {Number(op.custo_com_iss ?? op.valor_iss ?? op.iss ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Forma Pgto</span> <span className="font-medium text-gray-700 truncate block">{op.formas_pagamento_operacional?.nome || op.formas_pagamento_operacional?.descricao || '-'}</span></div>

                                                                            {/* Campos Operacionais do Encarregado */}
                                                                            <div><span className="text-gray-400 text-xs block">Placa</span> <span className="font-medium text-gray-700">{op.placa || '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Nº Nota Fiscal</span> <span className="font-medium text-gray-700">{op.nf_numero || (op.possui_nf ? 'SIM (Sem Nº)' : 'NÃO')}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Horário (In / Out)</span> <span className="font-medium text-gray-700">{op.entrada_ponto ? `${op.entrada_ponto.substring(0, 5)} até ${op.saida_ponto?.substring(0, 5) || '?'}` : '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Qtd Colabs (Prod.)</span> <span className="font-medium text-gray-700">{op.quantidade_colaboradores || 0}</span></div>

                                                                            <div className="col-span-2 border-t pt-2 md:border-none md:pt-0">
                                                                                <span className="text-gray-400 text-[11px] font-semibold uppercase block">Valor Total Origem</span>
                                                                                <span className="font-bold text-blue-700 text-lg">R$ {Number(op.total_final ?? op.valor_total ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* BLOCO 04: Responsáveis */}
                                                                    <div>
                                                                        <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Responsáveis</h5>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div><span className="text-gray-400 text-xs block">Empresa Faturada</span> <span className="font-medium text-gray-700 truncate block">{receita.empresas?.nome || '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Encarregado</span> <span className="font-medium text-gray-700 truncate tracking-wide">{op.responsavel_nome || op.encarregado?.nome || op.encarregado_id?.substring(0, 8) || '-'}</span></div>
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
                                                                            <Layers className="h-3.5 w-3.5" /> Detalhar Operação Completa
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            ) : se ? (
                                                                <div className="flex flex-col gap-6">
                                                                    {/* BLOCO 02: Origem Serviço Extra */}
                                                                    <div>
                                                                        <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Origem da Receita</h5>
                                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                            <div><span className="text-gray-400 text-xs block">Origem</span> <span className="font-semibold text-purple-700 block">Serviço Extra</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Nº Registro</span> <span className="font-bold text-gray-800 tracking-wide block">SE #{se.id?.substring(0, 8) || '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Data Serv.</span> <span className="font-medium text-gray-700">{formatDateOnly(se.data || se.data_servico)}</span></div>
                                                                            <div>
                                                                                <span className="text-gray-400 text-xs block mb-0.5">Status Aprovação</span>
                                                                                <span className="font-medium text-emerald-700 uppercase text-[10px] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">{se.pipeline_status?.replace('_', ' ') || 'Aprovado'}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* BLOCO 03: Dados do Serviço Extra */}
                                                                    <div>
                                                                        <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Dados do Serviço Extra</h5>
                                                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                            <div className="col-span-2"><span className="text-gray-400 text-xs block">Tipo de Serviço</span> <span className="font-semibold text-gray-800 truncate block">{se.tipo_servico || '-'}</span></div>
                                                                            <div className="col-span-2"><span className="text-gray-400 text-xs block">Descrição</span> <span className="font-medium text-gray-700 truncate block">{se.descricao || '-'}</span></div>
                                                                            <div>
                                                                                <span className="text-gray-400 text-xs block">Quantidade</span>
                                                                                <span className="font-medium text-gray-700">{se.quantidade || 1}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-gray-400 text-xs block">V. Unitário</span>
                                                                                <span className="font-medium text-gray-700">R$ {Number(se.valor_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-gray-400 text-xs block">Forma Pgto</span>
                                                                                <span className="font-medium text-gray-700 truncate block">{se.formas_pagamento_operacional?.nome || se.formas_pagamento_operacional?.descricao || '-'}</span>
                                                                            </div>
                                                                            <div>
                                                                                <span className="text-gray-400 text-xs block">Modalidade</span>
                                                                                <span className="font-medium text-gray-700 truncate block">{se.modalidade_financeira || '-'}</span>
                                                                            </div>
                                                                            <div className="col-span-2 border-t pt-2 md:border-none md:pt-0">
                                                                                <span className="text-gray-400 text-[11px] font-semibold uppercase block">Valor Total</span>
                                                                                <span className="font-bold text-blue-700 text-lg">R$ {Number(se.valor_total || item.valor_item || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* BLOCO 04: Responsáveis */}
                                                                    <div>
                                                                        <h5 className="text-xs font-bold text-gray-800 uppercase tracking-widest border-b pb-2 mb-3">Responsáveis & Local</h5>
                                                                        <div className="grid grid-cols-2 gap-4">
                                                                            <div><span className="text-gray-400 text-xs block">Empresa Faturada</span> <span className="font-medium text-gray-700 truncate block">{receita.empresas?.nome || '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Encarregado / Solicitante</span> <span className="font-medium text-gray-700 truncate tracking-wide">{se.encarregado?.nome || se.encarregado_id?.substring(0, 8) || '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Colaborador / Terceiro</span> <span className="font-medium text-gray-700 truncate block">{se.colaborador?.nome || se.colaborador_externo || '-'}</span></div>
                                                                            <div><span className="text-gray-400 text-xs block">Unidade / Local</span> <span className="font-medium text-gray-700 truncate block">{se.unidade?.nome || se.local_servico || '-'}</span></div>
                                                                        </div>
                                                                    </div>

                                                                    {se.observacao && (
                                                                        <div className="bg-yellow-50/50 px-3 py-2 rounded text-gray-600 text-xs border border-yellow-100">
                                                                            <strong className="text-yellow-700">Obs:</strong> {se.observacao}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="text-gray-500">Item sem operação ou serviço extra referenciado. Valor: R$ {item.valor_item}</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )
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
                                                            <span className="text-gray-500 truncate">{h.status_anterior === 'conciliado' ? 'Conciliado' : (h.status_anterior === 'recebido' || h.status_anterior === 'pago' ? 'Recebido' : (h.status_anterior?.replace('_', ' ') || 'Indefinido'))}</span>
                                                            <span className="text-gray-400 text-[10px] px-1">↓</span>
                                                            <span className="font-bold text-emerald-700">{h.status_novo === 'conciliado' ? 'Conciliado' : (h.status_novo === 'recebido' || h.status_novo === 'pago' ? 'Recebido' : (h.status_novo?.replace('_', ' ') || 'Indefinido'))}</span>
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
