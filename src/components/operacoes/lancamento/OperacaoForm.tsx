import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
    ChevronRight,
    ChevronLeft,
    Save,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Form } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import {
    EmpresaService,
    ColaboradorService,
    UnidadeOperacionalService,
    TipoServicoOperacionalService,
    ProdutoCargaService,
    FormaPagamentoOperacionalService,
    TransportadoraClienteService,
    FornecedorService,
    MateriaisOperacionaisService
} from "@/services/base.service";

import { useProductionForm } from "@/components/operacoes/lancamento/hooks/useProductionForm";
import { FormStepSelector } from "@/components/operacoes/lancamento/FormStepSelector";
import { FormStepContext } from "@/components/operacoes/lancamento/FormStepContext";
import { FormStepSummary } from "@/components/operacoes/lancamento/FormStepSummary";
import { FormStepTeam } from "@/components/operacoes/lancamento/FormStepTeam";
import { DEFAULT_PRODUCTION_VALUES } from "@/components/operacoes/lancamento/schema";

export interface OperacaoFormProps {
    mode: "admin" | "encarregado";
    initialData?: any;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const OperacaoForm = ({ mode, initialData, onSuccess, onCancel }: OperacaoFormProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [etapa, setEtapa] = useState(1);

    // Quick initialize from initialData if editing
    useEffect(() => {
        if (initialData && initialData.id) {
            setEtapa(2); // Pula a escolha do tipo se for edição
            if (initialData.colaborador_id) {
                setSelectedColaboradores([initialData.colaborador_id]);
            }
        }
    }, [initialData]);

    const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
    const [colaboradorTimings, setColaboradorTimings] = useState<Record<string, { entrada_ponto?: string, saida_almoco?: string, retorno_almoco?: string, saida_ponto?: string }>>({});
    const [selectedMateriais, setSelectedMateriais] = useState<Array<{
        material_id: string;
        nome_snapshot: string;
        unidade_snapshot: string;
        valor_unitario_snapshot: number;
        quantidade: number;
        valor_total: number;
    }>>([]);
    const empresaId = user?.user_metadata?.empresa_id || "";

    const { form, loadingPreco, regrasPeriodo, selectedPeriodo } = useProductionForm({
        empresaId,
        defaultValues: initialData || DEFAULT_PRODUCTION_VALUES,
    });

    const currentEmpresaId = form.watch("empresa_id") || empresaId;
    const currentModalidade = form.watch("modalidade_financeira") as "CAIXA_IMEDIATO" | "DUPLICATA" | undefined;

    // Queries globais
    const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => EmpresaService.getAll() });
    const { data: unidades = [] } = useQuery({
        queryKey: ["unidades", currentEmpresaId],
        queryFn: () => UnidadeOperacionalService.getByEmpresa(currentEmpresaId),
        enabled: !!currentEmpresaId
    });
    const { data: tiposServico = [] } = useQuery({ queryKey: ["tipos_servico"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
    const { data: transportadoras = [] } = useQuery({
        queryKey: ["transportadoras", currentEmpresaId],
        queryFn: () => TransportadoraClienteService.getByEmpresa(currentEmpresaId),
        enabled: !!currentEmpresaId
    });
    const { data: fornecedores = [] } = useQuery({
        queryKey: ["fornecedores", currentEmpresaId],
        queryFn: () => FornecedorService.getByEmpresa(currentEmpresaId),
        enabled: !!currentEmpresaId
    });
    const { data: produtos = [] } = useQuery({ queryKey: ["produtos"], queryFn: () => ProdutoCargaService.getAll() });
    const { data: formasPagamento = [] } = useQuery({
        queryKey: ["formas_pagamento", currentModalidade],
        queryFn: () => currentModalidade
            ? FormaPagamentoOperacionalService.getByModalidade(currentModalidade)
            : FormaPagamentoOperacionalService.getAllActive(),
        enabled: etapa >= 3,
    });
    const { data: allColaboradores = [] } = useQuery({
        queryKey: ["colaboradores_prod", currentEmpresaId],
        queryFn: () => ColaboradorService.getWithEmpresa(currentEmpresaId),
        enabled: !!currentEmpresaId
    });
    const { data: materiaisDisponiveis = [] } = useQuery({
        queryKey: ["materiais_ativos"],
        queryFn: () => MateriaisOperacionaisService.getAllActive()
    });

    const currentTipoLancamento = form.watch("tipo_lancamento");

    const colaboradores = useMemo(() => {
        return allColaboradores.filter(c => {
            const tipo = String(c.tipo_colaborador || '').toUpperCase();

            // Regra base: Encarregados nunca lançam CLT manualmente via tela de encarregado.
            // Para admin, relaxamos se for edição ou explicitamente admin, se necessário futuramente.
            if (tipo === 'CLT' && mode === 'encarregado') return false;

            if (currentTipoLancamento === 'diaristas') {
                return tipo === 'DIARISTA';
            }
            return tipo !== 'DIARISTA';
        });
    }, [allColaboradores, currentTipoLancamento, mode]);

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            const {
                data,
                quantidade_colaboradores,
                tipo_lancamento,
                tipo_servico,
                transportadora,
                fornecedor,
                produto,
                forma_pagamento,
                valor_unitario,
                iss_percentual,
                valor_iss,
                valor_total_liquido,
                nf_emite,
                valor_unitario_manual,
                descricao_servico,
                categoria_servico,
                justificativa_data,
                placa_veiculo,
                status_financeiro,
                data_vencimento,
                horario_inicio,
                horario_fim,
                regra_periodo_id,
                ...rest
            } = formData;

            const payload = {
                ...rest,
                data_operacao: data,
                placa: placa_veiculo || rest.placa || null,
                tipo_servico_id: tipo_servico,
                transportadora_id: transportadora,
                fornecedor_id: fornecedor,
                produto_carga_id: produto,
                forma_pagamento_id: forma_pagamento,
                valor_unitario_snapshot: valor_unitario,
                percentual_iss: (iss_percentual || 0) / 100,
                custo_com_iss: valor_iss || 0,
                valor_total_materiais: selectedMateriais.reduce((acc, m) => acc + m.valor_total, 0),
                valor_total: (valor_total_liquido || (formData.quantidade * (valor_unitario || 0))) + selectedMateriais.reduce((acc, m) => acc + m.valor_total, 0),
                valor_descarga: formData.quantidade * (valor_unitario || 0),
                tipo_calculo_snapshot: "volume",
                status: initialData?.id ? undefined : "RECEBIDO",
                status_pagamento: initialData?.id ? undefined : "PENDENTE",
                origem_dado: "manual",
                responsavel_nome: user?.user_metadata?.full_name || (mode === "admin" ? "Admin" : "Encarregado"),
                colaborador_id: selectedColaboradores[0] || null,
                regra_id: regra_periodo_id || null,
                codigo_operacional: selectedPeriodo ? `${selectedPeriodo.codigo}C${quantidade_colaboradores}` : null,
                horario_inicio: horario_inicio || null,
                horario_fim: horario_fim || null,
            };

            // Clean undefineds to avoid overrides of current DB values if updating
            Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

            const colabPayload = selectedColaboradores.map(id => ({
                collaborator_id: id,
                had_infraction: false,
                entrada_ponto: colaboradorTimings[id]?.entrada_ponto || null,
                saida_almoco: colaboradorTimings[id]?.saida_almoco || null,
                retorno_almoco: colaboradorTimings[id]?.retorno_almoco || null,
                saida_ponto: colaboradorTimings[id]?.saida_ponto || null,
            }));

            if (initialData?.id) {
                // Modo de Edição
                await OperacaoProducaoService.update(initialData.id, payload);
                // Auditoria da ação de edição administrativa:
                // Pode disparar outro service de log futuramente.
                return { isEdit: true };
            } else {
                // Modo de Criação
                return OperacaoProducaoService.createWithColaboradores(payload, colabPayload, selectedMateriais);
            }
        },
        onSuccess: (data: any) => {
            toast.success(data?.isEdit ? "Operação atualizada com sucesso!" : "Produção lançada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes"] });
            queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });

            if (data?.isEdit && onSuccess) {
                onSuccess();
            } else {
                setEtapa(1);
                form.reset(DEFAULT_PRODUCTION_VALUES);
                setSelectedColaboradores([]);
                setColaboradorTimings({});
                setSelectedMateriais([]);
                if (onSuccess) onSuccess();
            }
        },
        onError: (err: any) => toast.error("Erro ao salvar: " + err.message)
    });

    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (etapa === 2) {
            fieldsToValidate = ['empresa_id', 'data', 'tipo_servico'];
        } else if (etapa === 3) {
            fieldsToValidate = ['quantidade', 'quantidade_colaboradores', 'forma_pagamento'];
            if (currentTipoLancamento === 'servicos_especificos') {
                fieldsToValidate.push('regra_periodo_id');
            }
        }
        const isValid = await form.trigger(fieldsToValidate);
        if (isValid) {
            setEtapa(prev => prev + 1);
        } else {
            toast.warning("Por favor, preencha todos os campos obrigatórios para continuar.");
        }
    };

    const handleToggleColaborador = (id: string) => {
        setSelectedColaboradores(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <div className="w-full flex-1 flex flex-col h-full bg-background rounded-b-lg">
            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                    className="space-y-6 flex-1"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }}
                >
                    <div className="flex items-center justify-between px-2 mb-6">
                        <div className="flex items-center gap-4">
                            {mode === 'encarregado' && onCancel && etapa === 1 && (
                                <Button variant="ghost" size="icon" onClick={onCancel}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                            )}
                            {(etapa > 1 || (mode === 'admin' && initialData)) && (
                                <Button variant="ghost" size="icon" onClick={() => setEtapa(prev => (prev > 1 ? prev - 1 : prev))}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                            )}
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Passo {etapa} de 4</h1>
                                <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2">
                                    {etapa === 1 ? "Opções" : etapa === 2 ? "Contexto Operacional" : etapa === 3 ? "Detalhamento e Valores" : "Equipe / Colaboradores"}
                                </p>
                            </div>
                        </div>
                        <div className="hidden md:block w-32 md:w-48">
                            <Progress value={(etapa / 4) * 100} className="h-2" />
                        </div>
                    </div>
                    {etapa === 1 && (
                        <FormStepSelector
                            form={form}
                            onNext={(preset) => {
                                // Se for Admin nós não roteamos.
                                // Mas `diaristas`, `custos-extras` não estariam acessíveis aqui se não rotear.
                                // Para o Admin manter no mesmo modal, nós apenas pulamos a etapa. O fluxo original manda pra páginas soltas. 
                                setEtapa(2);
                            }}
                        />
                    )}

                    {etapa === 2 && (
                        <div className="esc-card p-4 sm:p-6 shadow-sm border border-slate-100 rounded-xl bg-white">
                            <FormStepContext
                                form={form}
                                empresas={empresas}
                                unidades={unidades}
                                tiposServico={tiposServico}
                                transportadoras={transportadoras}
                                fornecedores={fornecedores}
                            />
                        </div>
                    )}

                    {etapa === 3 && (
                        <div className="esc-card p-4 sm:p-6 shadow-sm border border-slate-100 rounded-xl bg-white">
                            <FormStepSummary
                                form={form}
                                produtos={produtos}
                                formasPagamento={formasPagamento}
                                loadingPreco={loadingPreco}
                                regrasPeriodo={regrasPeriodo}
                                selectedPeriodo={selectedPeriodo}
                                materiaisDisponiveis={materiaisDisponiveis}
                                selectedMateriais={selectedMateriais}
                                setSelectedMateriais={setSelectedMateriais}
                            />
                        </div>
                    )}

                    {etapa === 4 && (
                        <div className="esc-card p-4 sm:p-6 shadow-sm border border-slate-100 rounded-xl bg-white min-h-[300px]">
                            <FormStepTeam
                                form={form}
                                colaboradores={colaboradores}
                                selectedIds={selectedColaboradores}
                                colaboradorTimings={colaboradorTimings}
                                setColaboradorTimings={setColaboradorTimings}
                                onToggleColaborador={handleToggleColaborador}
                            />
                        </div>
                    )}

                    {etapa > 1 && (
                        <div className={
                            mode === 'encarregado'
                                ? "fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between gap-4 z-50 lg:left-64"
                                : "mt-6 pt-4 border-t flex justify-between gap-4"
                        }>
                            <Button type="button" variant="outline" className="flex-1" onClick={() => {
                                if (etapa > 1) setEtapa(prev => prev - 1);
                                else if (onCancel) onCancel();
                            }}>
                                <ChevronLeft className="h-4 w-4 mr-2" /> Voltar
                            </Button>

                            {etapa < 4 ? (
                                <Button type="button" className="flex-1" onClick={handleNext}>
                                    Próximo <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    className="flex-1 bg-primary"
                                    disabled={mutation.isPending || selectedColaboradores.length === 0}
                                >
                                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    {initialData ? "Salvar Alterações" : "Finalizar Lançamento"}
                                </Button>
                            )}
                        </div>
                    )}
                </form>
            </Form>
        </div>
    );
}
