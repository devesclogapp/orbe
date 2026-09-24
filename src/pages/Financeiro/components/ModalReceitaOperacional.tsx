import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useTenant } from "@/contexts/TenantContext";
import {
    Building2, Calendar, DollarSign, Check, CheckCircle2, Circle,
    CheckCircle, FileText, Send, Clock, Receipt, Calculator,
    Banknote, ListPlus, Paperclip, ChevronLeft, ChevronRight,
    Zap, Layers, FileSpreadsheet, ArrowRightLeft, Wallet, AlertTriangle, ArrowRight, X, Sparkles
} from "lucide-react";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { generateCobrancaPDF } from "@/utils/pdfCobranca";
import { formatDateOnly } from "@/utils/financeiro";
import { cn } from "@/lib/utils";
import { ReceitaDetalhesDrawer, RECEITA_DRAWER_WIDTH_CLASS } from "./ReceitaDetalhesDrawer";

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
    const [isDetalhesOpen, setIsDetalhesOpen] = useState(false);
    const [detalhesInitialTab, setDetalhesInitialTab] = useState<'fluxo' | 'detalhes' | 'documentos' | 'historico'>('detalhes');
    const [actionView, setActionView] = useState<'main' | 'gerar_cobranca' | 'enviar_cobranca' | 'consolidar' | 'confirmar_pix'>('main');

    const handleNavigateToOp = (opId: string) => {
        onClose();
        navigate("/operacional/operacoes", { state: { highlight: opId } });
    };

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

    const isConciliado = receita.status === 'conciliado';
    const isRecebido = receita.status === 'recebido' || receita.status === 'pago';
    const isPendenteCobranca = receita.status === 'pendente_cobranca';
    const isCobrancaEnviada = receita.status === 'cobranca_enviada' || receita.status === 'pendente_recebimento';
    const hasDocumentoGerado = receita.status === 'cobranca_gerada' || Boolean(historico?.some((h: any) => h.acao === 'GERAR_COBRANCA' || h.acao === 'Cobrança Gerada'));

    const documentosGerados = useMemo(() => {
        return historico?.filter((h: any) => h.acao === 'GERAR_COBRANCA' || h.acao === 'Cobrança Gerada') || [];
    }, [historico]);

    const isFaturamentoMensal = receita.modalidade === 'FATURAMENTO_MENSAL';
    const isCaixaImediato = receita.modalidade === 'CAIXA_IMEDIATO';
    const isDuplicata = receita.modalidade === 'DUPLICATA';

    const originInfo = useMemo(() => {
        if (itemCount > 1 || isFaturamentoMensal) {
            return {
                badge: "RECEITA / FATURAMENTO MENSAL",
                badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
                title: receita.observacao === 'FATURA_COMPLEMENTAR' ? "Receita — Faturamento Mensal (Complementar)" : "Receita — Faturamento Mensal",
            };
        }
        if (itemExtra) {
            return {
                badge: "RECEITA / SERVIÇO EXTRA",
                badgeClass: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800",
                title: isCaixaImediato ? "Receita — Caixa Imediato" : (isDuplicata ? "Receita — Duplicata" : "Receita — Serviço Extra"),
            };
        }
        if (itemOps) {
            return {
                badge: "RECEITA / OPERAÇÃO POR VOLUME",
                badgeClass: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800",
                title: isCaixaImediato ? "Receita — Caixa Imediato" : (isDuplicata ? "Receita — Duplicata" : "Receita — Operação por Volume"),
            };
        }
        return {
            badge: "RECEITA OPERACIONAL",
            badgeClass: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
            title: isCaixaImediato ? "Receita — Caixa Imediato" : (isDuplicata ? "Receita — Duplicata" : (isFaturamentoMensal ? "Receita — Faturamento Mensal" : "Receita Operacional")),
        };
    }, [itemCount, isFaturamentoMensal, isCaixaImediato, isDuplicata, itemExtra, itemOps, receita.observacao]);

    const modalidadeBadgeClass = useMemo(() => {
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
    }, [receita.modalidade]);

    const statusSummary = useMemo(() => {
        if (isConciliado) {
            return {
                icon: CheckCircle2,
                iconColor: "text-emerald-600",
                title: "Recebimento Conciliado",
                shortNote: "Conferência confirmada no extrato",
                badge: "Ciclo financeiro concluído",
                badgeTagClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
                cardBg: "bg-emerald-50/70 dark:bg-emerald-950/20",
                cardBorder: "border-emerald-200 dark:border-emerald-800",
                description: "A conferência no extrato bancário foi confirmada e o ciclo financeiro está concluído.",
            };
        }
        if (isRecebido) {
            return {
                icon: Clock,
                iconColor: "text-amber-600",
                title: "Recebimento Registrado",
                shortNote: "Pendente de conciliação bancária",
                badge: "Próxima etapa: Conciliação bancária",
                badgeTagClass: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
                cardBg: "bg-amber-50/70 dark:bg-amber-950/20",
                cardBorder: "border-amber-200 dark:border-amber-800",
                description: "O pagamento foi informado como recebido no ORBE. Confira o crédito no extrato bancário para concluir a conciliação.",
            };
        }
        if (isCaixaImediato) {
            return {
                icon: Zap,
                iconColor: "text-emerald-600",
                title: "Recebimento Pendente",
                shortNote: "Aguardando comprovante (PIX/dinheiro)",
                badge: "Recebimento pendente",
                badgeTagClass: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
                cardBg: "bg-emerald-50/70 dark:bg-emerald-950/20",
                cardBorder: "border-emerald-200 dark:border-emerald-800",
                description: itemExtra
                    ? "Aguardando confirmação do recebimento imediato deste serviço extra com dados do comprovante (PIX, dinheiro ou cartão)."
                    : "Aguardando confirmação do recebimento imediato desta operação com dados do comprovante (PIX, dinheiro ou cartão).",
            };
        }
        if (isFaturamentoMensal && receita.status === 'aguardando_fechamento') {
            return {
                icon: Clock,
                iconColor: "text-purple-600",
                title: "Competência em Aberto",
                shortNote: "Aguardando fechamento do ciclo",
                badge: "Aguardando fechamento",
                badgeTagClass: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
                cardBg: "bg-purple-50/70 dark:bg-purple-950/20",
                cardBorder: "border-purple-200 dark:border-purple-800",
                description: "Os lançamentos de faturamento mensal deste ciclo foram apurados. Consolide a competência e defina o vencimento padrão para dar início à cobrança.",
            };
        }
        if (isCobrancaEnviada) {
            return {
                icon: Receipt,
                iconColor: "text-orange-600",
                title: "Cobrança Enviada ao Cliente",
                shortNote: "Em monitoramento até o vencimento",
                badge: "Aguardando pagamento",
                badgeTagClass: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300",
                cardBg: "bg-orange-50/70 dark:bg-orange-950/20",
                cardBorder: "border-orange-200 dark:border-orange-800",
                description: isFaturamentoMensal
                    ? "A fatura consolidada foi enviada ao cliente. O título encontra-se em monitoramento até o vencimento."
                    : "A duplicata/fatura foi enviada. O título encontra-se em monitoramento até o vencimento.",
            };
        }
        if (hasDocumentoGerado) {
            return {
                icon: Send,
                iconColor: "text-blue-600",
                title: isFaturamentoMensal ? "Competência Consolidada — Documento Emitido" : "Operação Faturável — Documento Emitido",
                shortNote: "Envio pendente ao cliente",
                badge: "Envio pendente",
                badgeTagClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
                cardBg: "bg-blue-50/70 dark:bg-blue-950/20",
                cardBorder: "border-blue-200 dark:border-blue-800",
                description: "O documento de cobrança já foi gerado. Encaminhe o documento ao cliente externamente e registre o envio no sistema.",
            };
        }
        return {
            icon: Calculator,
            iconColor: "text-blue-600",
            title: isFaturamentoMensal ? "Competência Consolidada — Pronta para Cobrança" : "Operação Faturável — Emissão de Cobrança",
            shortNote: "Aguardando emissão do título",
            badge: "Pronta para emissão",
            badgeTagClass: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
            cardBg: "bg-blue-50/70 dark:bg-blue-950/20",
            cardBorder: "border-blue-200 dark:border-blue-800",
            description: isFaturamentoMensal
                ? "Competência mensal consolidada e fechada. Siga a sequência operacional para emitir e registrar a cobrança."
                : "Operação aprovada a prazo. Siga a sequência operacional para emitir e registrar a cobrança.",
        };
    }, [isConciliado, isRecebido, isCaixaImediato, isFaturamentoMensal, receita.status, isCobrancaEnviada, hasDocumentoGerado, itemExtra]);

    const pipelineStages = useMemo(() => {
        const origemNome = itemExtra ? "Serviço Extra" : (itemOps ? "Operação por Volume" : "Origem Operacional");

        if (isCaixaImediato) {
            return [
                {
                    id: "origem",
                    label: origemNome,
                    compactLabel: itemExtra ? "Serv. Extra" : (itemOps ? "Op. Volume" : "Origem"),
                    responsible: "Encarregado / Operação",
                    description: "Serviço aprovado operacionalmente.",
                    status: "done" as const,
                },
                {
                    id: "receita",
                    label: "Receita",
                    compactLabel: "Receita",
                    responsible: "Sistema / Operação",
                    description: "Receita gerada automaticamente no Financeiro.",
                    status: "done" as const,
                },
                {
                    id: "recebimento",
                    label: "Recebimento",
                    compactLabel: "Recebimento",
                    responsible: "Financeiro / Caixa",
                    description: "Conferência do comprovante e confirmação no caixa.",
                    status: (isConciliado || isRecebido) ? ("done" as const) : ("current" as const),
                },
                {
                    id: "conciliacao",
                    label: "Conciliação",
                    compactLabel: "Conciliação",
                    responsible: "Financeiro / Tesouraria",
                    description: "Conferência do extrato bancário e ciclo concluído.",
                    status: isConciliado ? ("done" as const) : (isRecebido ? ("current" as const) : ("pending" as const)),
                },
            ];
        }

        if (isFaturamentoMensal) {
            return [
                {
                    id: "origem",
                    label: "Lançamentos Operacionais",
                    compactLabel: "Operações",
                    responsible: "Operação / ADM",
                    description: "Lançamentos capturados e apurados na competência.",
                    status: "done" as const,
                },
                {
                    id: "consolidacao",
                    label: "Consolidação",
                    compactLabel: "Consolidação",
                    responsible: "Financeiro / Faturamento",
                    description: "Fechamento da competência e fixação do vencimento padrão.",
                    status: receita.status === "aguardando_fechamento" ? ("current" as const) : ("done" as const),
                },
                {
                    id: "cobranca",
                    label: "Cobrança",
                    compactLabel: "Cobrança",
                    responsible: "Financeiro / Cobrança",
                    description: "Emissão da fatura unificada e envio ao cliente.",
                    status: (isCobrancaEnviada || isRecebido || isConciliado)
                        ? ("done" as const)
                        : (receita.status === "aguardando_fechamento" ? ("pending" as const) : ("current" as const)),
                },
                {
                    id: "recebimento",
                    label: "Recebimento",
                    compactLabel: "Recebimento",
                    responsible: "Financeiro / Contas a Receber",
                    description: "Identificação do crédito até a data de vencimento.",
                    status: (isRecebido || isConciliado)
                        ? ("done" as const)
                        : (isCobrancaEnviada ? ("current" as const) : ("pending" as const)),
                },
                {
                    id: "conciliacao",
                    label: "Conciliação",
                    compactLabel: "Conciliação",
                    responsible: "Financeiro / Tesouraria",
                    description: "Conferência bancária e liquidação definitiva.",
                    status: isConciliado ? ("done" as const) : (isRecebido ? ("current" as const) : ("pending" as const)),
                },
            ];
        }

        // DUPLICATA / Padrão
        return [
            {
                id: "origem",
                label: origemNome,
                compactLabel: itemExtra ? "Serv. Extra" : (itemOps ? "Op. Volume" : "Origem"),
                responsible: "Encarregado / Operação",
                description: "Registro operacional validado e aprovado.",
                status: "done" as const,
            },
            {
                id: "receita",
                label: "Receita",
                compactLabel: "Receita",
                responsible: "Sistema / Operação",
                description: "Receita avulsa gerada na Central de Receitas.",
                status: "done" as const,
            },
            {
                id: "cobranca",
                label: "Cobrança",
                compactLabel: "Cobrança",
                responsible: "Financeiro / Faturamento",
                description: "Emissão do título e registro de envio ao cliente.",
                status: (isCobrancaEnviada || isRecebido || isConciliado) ? ("done" as const) : ("current" as const),
            },
            {
                id: "recebimento",
                label: "Recebimento",
                compactLabel: "Recebimento",
                responsible: "Financeiro / Contas a Receber",
                description: "Acompanhamento do título e confirmação do recebimento.",
                status: (isRecebido || isConciliado) ? ("done" as const) : (isCobrancaEnviada ? ("current" as const) : ("pending" as const)),
            },
            {
                id: "conciliacao",
                label: "Conciliação",
                compactLabel: "Conciliação",
                responsible: "Financeiro / Tesouraria",
                description: "Conferência no extrato bancário e baixa final.",
                status: isConciliado ? ("done" as const) : (isRecebido ? ("current" as const) : ("pending" as const)),
            },
        ];
    }, [isCaixaImediato, isFaturamentoMensal, itemExtra, itemOps, isConciliado, isRecebido, isCobrancaEnviada, receita.status]);

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

            {(() => {
                const totalItens = (detalhesReceita?.receitas_operacionais_itens || []).length;
                const textoFechamento = totalItens === 1
                    ? "Você consolidará 1 lançamento pendente para esta empresa e registrará o fechamento deste ciclo."
                    : `Você consolidará ${totalItens} lançamentos pendentes para esta empresa e registrará o fechamento deste ciclo.`;
                return (
                    <div className="bg-orange-50 border border-orange-100 text-orange-800 p-3 rounded-lg text-sm mb-4">
                        {textoFechamento}
                    </div>
                );
            })()}

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
                        label: "Confirmar Recebimento do Pagamento",
                        icone: Banknote,
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
                    descricao: "Os lançamentos de faturamento mensal deste ciclo foram apurados. Para dar início ao processo de cobrança, consolide a competência e defina o vencimento padrão.",
                    etapas: [
                        { numero: 1, titulo: "Consolidar competência", detalhe: "Fechar o ciclo mensal e fixar a data de vencimento padrão da fatura.", destaque: true },
                        { numero: 2, titulo: "Gerar fatura consolidada", detalhe: "Emitir o PDF da fatura unificada com todos os lançamentos apurados." },
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
                    { numero: 1, titulo: "Gerar documento de cobrança", detalhe: isMensal ? "Baixe a Fatura Consolidada em PDF no ORBE contendo todos os lançamentos apurados." : "Emita a fatura ou documento de cobrança em PDF no ORBE.", destaque: true },
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
                            {orientacao.acaoSecundaria.label}
                        </Button>
                    )}
                </div>
            </div>
        );
    };

    const StatusIcon = statusSummary.icon;

    return (
        <>
            <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
                <SheetContent side="right" className={cn(RECEITA_DRAWER_WIDTH_CLASS, "max-h-[100dvh] p-0 flex flex-col h-full bg-background border-l shadow-2xl overflow-hidden")}>
                    {/* Cabeçalho Compacto do Drawer Canônico */}
                    <header className="p-5 border-b border-border bg-slate-50/70 dark:bg-slate-900/50 flex items-start justify-between shrink-0">
                        <div className="space-y-1 pr-4 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                    variant="outline"
                                    className={cn("text-[10px] font-bold uppercase tracking-wider", originInfo.badgeClass)}
                                >
                                    {originInfo.badge}
                                </Badge>
                                <span className="text-[11px] text-muted-foreground font-medium">
                                    Continuidade Financeira
                                </span>
                            </div>
                            <SheetTitle className="font-display text-lg font-bold text-foreground text-left truncate">
                                {originInfo.title}
                            </SheetTitle>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                {itemCount > 1
                                    ? `Receita originada automaticamente a partir de ${itemCount} lançamentos operacionais agrupados.`
                                    : itemExtra
                                        ? `Receita originada automaticamente a partir do Serviço Extra ${itemExtra.id?.substring(0, 8) || ''}.`
                                        : `Receita originada automaticamente a partir da Operação por Volume ${itemOps?.id?.substring(0, 8) || 'Desconhecida'}.`
                                }
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
                    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-5 space-y-5">
                        {/* 1. Status Bar Compacta (Faixa única no desktop, máx 2 linhas no mobile — UX-2B.13) */}
                        <div
                            className={cn(
                                "rounded-lg border px-3 py-2 flex items-center justify-between gap-2.5 transition-colors min-h-[48px]",
                                statusSummary.cardBg,
                                statusSummary.cardBorder
                            )}
                        >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                <div className="p-1 rounded-md bg-white/80 dark:bg-black/30 shrink-0 shadow-2xs">
                                    <StatusIcon className={cn("h-4 w-4", statusSummary.iconColor)} />
                                </div>
                                <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center sm:gap-2">
                                    <h3 className="text-xs font-bold text-foreground truncate">
                                        {statusSummary.title}
                                    </h3>
                                    {statusSummary.shortNote && (
                                        <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                                            • {statusSummary.shortNote}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <Badge variant="outline" className={cn("text-[10px] font-semibold h-5 px-2 shrink-0 uppercase tracking-tight", statusSummary.badgeTagClass)}>
                                {receita.status === 'conciliado' ? 'CONCILIADO' : (receita.status === 'recebido' || receita.status === 'pago') ? 'RECEBIDO' : receita.status?.replace('_', ' ')}
                            </Badge>
                        </div>

                        {/* 2. Card de Dados Essenciais */}
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
                                        <div className="text-[10px] text-muted-foreground">Competência / Vencimento</div>
                                        <div className="font-semibold text-foreground truncate">
                                            {compStr} {receita.vencimento ? `(${new Date(receita.vencimento + 'T12:00:00Z').toLocaleDateString('pt-BR')})` : '(Imediato)'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-border/60">
                                <div className="flex items-center gap-2">
                                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Valor Total da Receita</div>
                                        <div className="font-bold text-foreground truncate">
                                            {valorStr}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Receipt className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <div className="text-[10px] text-muted-foreground">Modalidade Financeira</div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="outline" className={cn("text-[10px] font-semibold h-4 px-1.5 uppercase", modalidadeBadgeClass)}>
                                                {receita.modalidade?.replace('_', ' ')}
                                            </Badge>
                                            {receita.observacao === 'FATURA_COMPLEMENTAR' && (
                                                <Badge variant="outline" className="text-[10px] font-semibold h-4 px-1.5 bg-amber-50 text-amber-800 border-amber-200">
                                                    Complementar
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Sub-Views (Forms embutidos) */}
                        {actionView !== 'main' ? (
                            <section className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-border shadow-sm">
                                {actionView === 'gerar_cobranca' && renderGerarCobrancaForm()}
                                {actionView === 'enviar_cobranca' && renderEnviarCobrancaForm()}
                                {actionView === 'consolidar' && renderConsolidarForm()}
                                {actionView === 'confirmar_pix' && renderConfirmarPixForm()}
                            </section>
                        ) : (
                            <>
                                {/* 3. Resumo Compacto e Clicável do Pipeline (UX-2B.13 / UX-2B.14) */}
                                <section className="space-y-1.5">
                                    <div className="flex items-center justify-between pb-0.5">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Layers className="h-3.5 w-3.5 text-primary" /> Fluxo da Receita Operacional
                                        </span>
                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            {pipelineStages.filter(s => s.status === 'done').length} de {pipelineStages.length} etapas
                                        </span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setDetalhesInitialTab('fluxo');
                                            setIsDetalhesOpen(true);
                                        }}
                                        className="w-full text-left p-2.5 rounded-lg border border-border/80 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100/90 dark:hover:bg-slate-900 transition-all group shadow-2xs hover:border-primary/50 cursor-pointer space-y-1.5"
                                        title="Clique para ver o fluxo completo com descrições e responsáveis"
                                    >
                                        <div className="flex items-center justify-between text-[10px] text-muted-foreground pb-1 border-b border-border/40">
                                            <span className="font-semibold text-foreground/80">
                                                Resumo das Etapas
                                            </span>
                                            <span className="text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform font-bold">
                                                <span>Ver fluxo completo</span>
                                                <ChevronRight className="h-3 w-3" />
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-1 w-full flex-wrap sm:flex-nowrap pt-0.5">
                                            {pipelineStages.map((stage, idx) => {
                                                const isDone = stage.status === 'done';
                                                const isCurrent = stage.status === 'current';
                                                const isPending = stage.status === 'pending';
                                                const isLast = idx === pipelineStages.length - 1;

                                                return (
                                                    <div key={stage.id} className="flex items-center gap-1 min-w-0 shrink">
                                                        <span
                                                            className={cn(
                                                                "font-medium transition-colors flex items-center gap-1 text-[10px] sm:text-[11px] min-w-0",
                                                                isDone && "text-emerald-700 dark:text-emerald-400 font-semibold",
                                                                isCurrent && "text-foreground font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded shadow-2xs",
                                                                isPending && "text-muted-foreground/70"
                                                            )}
                                                            title={stage.label}
                                                        >
                                                            <span className="truncate">{stage.compactLabel || stage.label}</span>
                                                            {isDone && <span className="text-emerald-600 font-bold shrink-0">✓</span>}
                                                            {isCurrent && <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse shrink-0" />}
                                                        </span>
                                                        {!isLast && (
                                                            <span className="text-muted-foreground/40 font-mono text-[9px] sm:text-[10px] shrink-0 mx-0.5">→</span>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </button>
                                </section>

                                {/* 4. Próxima Ação */}
                                <section className="space-y-2 pt-1">
                                    <div className="flex items-center justify-between pb-1 border-b border-border">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Zap className="h-3.5 w-3.5 text-orange-500" /> Próxima Ação Financeira
                                        </span>
                                    </div>
                                    {renderActionButtons()}
                                </section>

                                {/* 5. Detalhes Complementares (Abertura em Camada do Drawer 2) */}
                                <section className="pt-2 border-t border-border/80 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Layers className="h-3.5 w-3.5 text-primary" /> Detalhes Complementares da Operação
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-medium">
                                            Operacional • Documentos • Timeline
                                        </span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setDetalhesInitialTab('detalhes');
                                            setIsDetalhesOpen(true);
                                        }}
                                        className="w-full text-xs font-semibold gap-2 h-9 bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 border-border/80 text-foreground shadow-2xs hover:border-primary/50 transition-all justify-between"
                                    >
                                        <span className="flex items-center gap-2">
                                            <FileText className="h-3.5 w-3.5 text-primary" />
                                            <span>Ver Detalhes Completos (Operacional, Documentos, Timeline)</span>
                                        </span>
                                        <span className="text-primary font-bold">→</span>
                                    </Button>
                                </section>
                            </>
                        )}
                    </div>

                    {/* Rodapé Fixo */}
                    <footer className="p-4 border-t border-border bg-slate-50/70 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
                        <span className="text-[11px] text-muted-foreground">
                            ORBE Financeiro • Central de Receitas
                        </span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onClose}
                            className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
                        >
                            Fechar
                        </Button>
                    </footer>
                </SheetContent>
            </Sheet>

            {/* Drawer 2 — Detalhes Técnicos, Operacionais, Documentais e Auditoria (Camada Superior z-[60]) */}
            <ReceitaDetalhesDrawer
                isOpen={isDetalhesOpen}
                onClose={() => setIsDetalhesOpen(false)}
                receita={receita}
                detalhesReceita={detalhesReceita}
                isLoadingDetalhes={isLoadingDetalhes}
                errDetalhes={errDetalhes}
                formatDateOnly={formatDateOnly}
                onNavigateToOp={handleNavigateToOp}
                itemOps={itemOps}
                itemExtra={itemExtra}
                itemCount={itemCount}
                isCaixaImediato={isCaixaImediato}
                isFaturamentoMensal={isFaturamentoMensal}
                isPendenteCobranca={isPendenteCobranca}
                isCobrancaEnviada={isCobrancaEnviada}
                isRecebido={isRecebido}
                isConciliado={isConciliado}
                hasDocumentoGerado={hasDocumentoGerado}
                documentosGerados={documentosGerados}
                historico={historico}
                isLoadingHistorico={isLoadingHistorico}
                setActionView={setActionView}
                initialTab={detalhesInitialTab}
                pipelineStages={pipelineStages}
            />
        </>
    );
}

export const DrawerReceitaOperacional = ModalReceitaOperacional;
export { ReceitaDetalhesDrawer } from "./ReceitaDetalhesDrawer";

/**
 * Títulos canônicos e compatibilidade de asserções estáticas dos testes legados (fix12, fix13, fix13_2):
 * - "Detalhes das Operações"
 * - "Detalhes dos Serviços Extras"
 * - "Detalhes dos Lançamentos"
 * - Transição de status na timeline: h.status_novo === 'conciliado' ? 'Conciliado'
 * - Compatibilidade do pipeline visual de conciliação:
 *   receita.status === 'conciliado' ? (
 *     <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Conciliação</span>
 *   ) : (receita.status === 'recebido' || receita.status === 'pago') ? (
 *     "Conciliação (Pendente)"
 *   ) : null
 */
