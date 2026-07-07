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
import { useOperationalPipeline, buildOperacaoVolumePipeline } from "@/contexts/OperationalPipelineContext";

export interface OperacaoFormProps {
    mode: "admin" | "encarregado";
    initialData?: any;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export const OperacaoForm = ({ mode, initialData, onSuccess, onCancel }: OperacaoFormProps) => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { openPipeline } = useOperationalPipeline();
    const [etapa, setEtapa] = useState(1);

    const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);

    const [selecionouSemAlteracao, setSelecionouSemAlteracao] = useState(false);
    const [justificativa, setJustificativa] = useState("");
    const [justificativaError, setJustificativaError] = useState("");
    const [concurrencyError, setConcurrencyError] = useState(false);

    // Quick initialize from initialData if editing
    useEffect(() => {
        if (initialData && initialData.id) {
            setEtapa(2); // Pula a escolha do tipo se for edição

            // Popula os colaboradores vinculados a esta operação da nova relação: production_entry_collaborators
            if (initialData.production_entry_collaborators && Array.isArray(initialData.production_entry_collaborators)) {
                const colabs = initialData.production_entry_collaborators.map((c: any) => c.colaboradores?.id || c.collaborator_id);
                setSelectedColaboradores(Array.from(new Set(colabs.filter(Boolean))));
            } else if (initialData.colaborador_id) {
                // Fallback legado
                setSelectedColaboradores([initialData.colaborador_id]);
            }

            // Popula os materiais se houver
            if (initialData.operacao_producao_materiais && Array.isArray(initialData.operacao_producao_materiais)) {
                setSelectedMateriais(initialData.operacao_producao_materiais);
            }
        }
    }, [initialData]);

    const [selectedMateriais, setSelectedMateriais] = useState<Array<{
        material_id: string;
        nome_snapshot: string;
        unidade_snapshot: string;
        valor_unitario_snapshot: number;
        quantidade: number;
        valor_total: number;
    }>>([]);
    const empresaId = user?.user_metadata?.empresa_id || "";

    const cleanInitialData = initialData
        ? Object.fromEntries(Object.entries(initialData).filter(([_, v]) => v !== null))
        : {};

    const { form, loadingPreco, regrasPeriodo, selectedPeriodo } = useProductionForm({
        empresaId,
        defaultValues: initialData ? { ...DEFAULT_PRODUCTION_VALUES, ...cleanInitialData } : DEFAULT_PRODUCTION_VALUES,
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

            if (currentTipoLancamento === 'diaristas') {
                return tipo === 'DIARISTA';
            }

            // Para operações por volume e demais serviços operacionais,
            // apenas colaboradores INTERMITENTES podem ser lançados.
            return tipo === 'INTERMITENTE';
        });
    }, [allColaboradores, currentTipoLancamento]);

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
                nf_numero: formData.nf_emite
                    ? (!rest.nf_numero || rest.nf_numero === "NÃO" || rest.nf_numero === "NAO" ? "SIM" : rest.nf_numero)
                    : "NÃO",
                status: initialData?.id ? undefined : "RECEBIDO",
                status_pagamento: initialData?.id ? undefined : "PENDENTE",
                updated_at_frontend: initialData?.updated_at,
                origem_dado: "manual",
                responsavel_nome: user?.user_metadata?.full_name || (mode === "admin" ? "Admin" : "Encarregado"),
                colaborador_id: selectedColaboradores[0] || null,
                regra_id: regra_periodo_id || null,
                codigo_operacional: selectedPeriodo ? `${selectedPeriodo.codigo}C${quantidade_colaboradores}` : null,
                quantidade_colaboradores: quantidade_colaboradores,
                horario_inicio: horario_inicio || null,
                horario_fim: horario_fim || null,
            };

            // Clean undefineds, strictly sanitize against known columns to avoid 400 Bad Request
            // AND remove any nested relational objects that might have come from `initialData`
            const uuidColumns = [
                'empresa_id', 'unidade_id', 'tipo_servico_id', 'transportadora_id',
                'fornecedor_id', 'produto_carga_id', 'forma_pagamento_id',
                'colaborador_id', 'regra_id', 'tenant_id'
            ];
            Object.keys(payload).forEach(key => {
                if (payload[key] === undefined) {
                    delete payload[key];
                } else if (payload[key] === "" && uuidColumns.includes(key)) {
                    payload[key] = null;
                } else if (payload[key] !== null && typeof payload[key] === 'object' && !Array.isArray(payload[key])) {
                    // Remove relational objects like `empresas`, `colaboradores`, etc. that are not arrays or primitive types
                    // We also want to skip Date objects but Supabase results don't have them as Date objects yet.
                    // Just in case, check if it's a generic plain object
                    if (Object.prototype.toString.call(payload[key]) === '[object Object]') {
                        delete payload[key];
                    }
                }
            });

            const uniqueSelectedColabs = Array.from(new Set(selectedColaboradores)).filter(Boolean);

            console.log("==========================================");
            console.log("[DEBUG] Payload Final para Update: ", JSON.stringify(payload, null, 2));
            console.log("==========================================");
            const colabPayload = uniqueSelectedColabs.map(id => ({
                collaborator_id: id,
                had_infraction: false,
                entrada_ponto: null,
                saida_almoco: null,
                retorno_almoco: null,
                saida_ponto: null,
            }));

            if (initialData?.id) {
                // Modo de Edição
                await OperacaoProducaoService.updateWithColaboradores(initialData.id, payload, colabPayload, selectedMateriais);
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
            queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
            queryClient.invalidateQueries({ queryKey: ["resumo_producao_dia"] });

            // Trigger the operational progress modal natively if it's a new launch (Volume)
            if (!data?.isEdit && (form.getValues().tipo_lancamento === 'volume' || !form.getValues().tipo_lancamento)) {
                const currentEmpresa = empresas.find(e => e.id === (form.getValues().empresa_id || empresaId));

                // Evita new Date() plain em GMT negativo. Parse puramente lexicográfico:
                const dataForm = form.getValues().data_operacao || form.getValues().data || new Date().toISOString().split('T')[0];
                const compMatch = dataForm.match(/^(\d{4})-(\d{2})/);
                const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                const compStr = compMatch ? `${meses[parseInt(compMatch[2], 10) - 1]} / ${compMatch[1]}` : "Competência Atual";

                openPipeline(buildOperacaoVolumePipeline({
                    competencia: compStr,
                    empresa: currentEmpresa?.nome || "Operacional",
                    currentStep: mode === "admin" ? "validacao" : "lancamento"
                }));
            }

            if (data?.isEdit && onSuccess) {
                onSuccess();
            } else {
                setEtapa(1);
                form.reset(DEFAULT_PRODUCTION_VALUES);
                setSelectedColaboradores([]);
                setSelectedMateriais([]);
                if (onSuccess) onSuccess();
            }
        },
        onError: (err: any) => {
            if (err.message === 'CONCURRENCY_CONFLICT') {
                setConcurrencyError(true);
            } else {
                toast.error("Erro ao salvar: " + err.message);
            }
        }
    });

    const onError = (errors: any) => {
        console.error("Form validation errors:", errors);
        const errorFields = Object.keys(errors).join(', ');
        toast.error("Erro de validação. Verifique os campos: " + errorFields, {
            description: "Um ou mais campos obrigatórios estão ausentes ou inválidos."
        });
    };

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
                    onSubmit={(e) => {
                        e.preventDefault();
                    }}
                    className="space-y-6 flex-1"
                >
                    <div className="flex items-center justify-between px-2 mb-6">
                        <div className="flex items-center gap-4">
                            {mode === 'encarregado' && onCancel && etapa === 1 && (
                                <Button type="button" variant="ghost" size="icon" onClick={onCancel}>
                                    <ChevronLeft className="h-5 w-5" />
                                </Button>
                            )}
                            {(etapa > 1 || (mode === 'admin' && initialData)) && (
                                <Button type="button" variant="ghost" size="icon" onClick={() => setEtapa(prev => (prev > 1 ? prev - 1 : prev))}>
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
                                onToggleColaborador={handleToggleColaborador}
                            />
                        </div>
                    )}

                    {etapa === 4 && initialData && (
                        <div className="esc-card p-4 sm:p-6 shadow-sm border border-slate-100 rounded-xl bg-white mt-4">
                            <h3 className="font-semibold text-foreground mb-3 text-sm">Justificativa da Edição</h3>
                            <div className="space-y-2">
                                <label className="text-xs text-muted-foreground block">
                                    Descreva o motivo desta alteração (ex: "Correção de transporte", "Ajuste na data"). Este registro ficará salvo na auditoria geral.
                                </label>
                                <textarea
                                    className={`flex min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${justificativaError ? 'border-destructive' : 'border-input'}`}
                                    placeholder="Digite a justificativa da alteração..."
                                    value={justificativa}
                                    onChange={(e) => {
                                        setJustificativa(e.target.value);
                                        if (e.target.value.trim().length > 0) setJustificativaError("");
                                    }}
                                />
                                {justificativaError && <p className="text-[0.8rem] font-medium text-destructive">{justificativaError}</p>}
                            </div>
                        </div>
                    )}

                    {etapa > 1 && concurrencyError ? (
                        <div className="mt-6 pt-4 border-t border-destructive flex flex-col sm:flex-row justify-between gap-4 p-4 bg-destructive/10 rounded-lg">
                            <div className="flex-1">
                                <h4 className="font-semibold text-destructive mb-1 font-sans">Conflito de Concorrência Detectado</h4>
                                <p className="text-sm text-foreground/80 leading-snug">Esta operação foi alterada por outro usuário enquanto você realizava a edição. Atualize os dados antes de salvar novamente.</p>
                            </div>
                            <div className="flex gap-2 min-w-max items-end">
                                <Button type="button" variant="outline" onClick={() => onCancel && onCancel()}>Cancelar</Button>
                                <Button type="button" variant="destructive" onClick={() => {
                                    queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
                                    queryClient.invalidateQueries({ queryKey: ["operacoes"] });
                                    queryClient.invalidateQueries({ queryKey: ["operacoes-grid"] });
                                    queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
                                    if (onCancel) onCancel();
                                    toast.info("A tabela foi atualizada com os novos dados.");
                                }}>Atualizar Dados</Button>
                            </div>
                        </div>
                    ) : etapa > 1 && (
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
                                    type="button"
                                    onClick={() => {
                                        // Checker manual antes de chamar handleSubmit
                                        if (initialData) {
                                            const hasMainDirty = Object.keys(form.formState.dirtyFields).length > 0;

                                            const initColabs = (initialData.production_entry_collaborators || []).map((c: any) => c.colaboradores?.id || c.collaborator_id).filter(Boolean);
                                            const hasColabChanged = JSON.stringify(initColabs.sort()) !== JSON.stringify([...selectedColaboradores].sort());

                                            // Materiais
                                            const initMateriais = (initialData.operacao_producao_materiais || []).map((m: any) => ({
                                                material_id: m.material_id, quantidade: m.quantidade, valor_total: m.valor_total
                                            }));
                                            const curMateriais = selectedMateriais.map(m => ({
                                                material_id: m.material_id, quantidade: m.quantidade, valor_total: m.valor_total
                                            }));
                                            const hasMateriaisChanged = JSON.stringify(initMateriais) !== JSON.stringify(curMateriais);

                                            const isChanged = hasMainDirty || hasColabChanged || hasMateriaisChanged;

                                            if (!isChanged) {
                                                toast.info("Nenhuma alteração identificada. Não foi necessário salvar.");
                                                if (onCancel) onCancel();
                                                return;
                                            }

                                            if (justificativa.trim().length === 0) {
                                                setJustificativaError("Justificativa é obrigatória para salvar as edições.");
                                                toast.warning("Forneça uma justificativa para as alterações.");
                                                return;
                                            }
                                        }
                                        form.handleSubmit((data) => mutation.mutate({ ...data, justificativa_retroativa: justificativa.trim() }), onError)();
                                    }}
                                    className="flex-1 bg-primary"
                                    disabled={mutation.isPending || (selectedColaboradores.length === 0 && !initialData)}
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
