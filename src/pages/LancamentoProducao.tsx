import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    Save,
    Loader2,
    History
} from "lucide-react";
import { toast } from "sonner";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

// Modular Components
import { useProductionForm } from "@/components/operacoes/lancamento/hooks/useProductionForm";
import { FormStepSelector } from "@/components/operacoes/lancamento/FormStepSelector";
import { FormStepContext } from "@/components/operacoes/lancamento/FormStepContext";
import { FormStepSummary } from "@/components/operacoes/lancamento/FormStepSummary";
import { FormStepTeam } from "@/components/operacoes/lancamento/FormStepTeam";
import { DEFAULT_PRODUCTION_VALUES, type ProductionFormValues } from "@/components/operacoes/lancamento/schema";
import { RecentLaunchesList } from "@/components/operacoes/lancamento/RecentLaunchesList";

const LancamentoProducao = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [etapa, setEtapa] = useState(1);
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
        defaultValues: DEFAULT_PRODUCTION_VALUES,
    });

    const currentEmpresaId = form.watch("empresa_id") || empresaId;
    const currentModalidade = form.watch("modalidade_financeira") as "CAIXA_IMEDIATO" | "DUPLICATA" | undefined;

    // Queries globais necessárias para os selects nas sub-telas
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
    // Filtra formas de pagamento pela modalidade selecionada no passo 1
    const { data: formasPagamento = [] } = useQuery({
        queryKey: ["formas_pagamento", currentModalidade],
        queryFn: () => currentModalidade
            ? FormaPagamentoOperacionalService.getByModalidade(currentModalidade)
            : FormaPagamentoOperacionalService.getAllActive(),
        enabled: etapa >= 3, // só carrega quando chega no passo 3
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

            // Nunca mostrar CLT em lançamentos manuais do encarregado
            if (tipo === 'CLT') return false;

            if (currentTipoLancamento === 'diaristas') {
                return tipo === 'DIARISTA';
            }

            // Para operações de volume/específicos: mostrar Intermitentes, etc, EXCETO Diaristas
            return tipo !== 'DIARISTA';
        });
    }, [allColaboradores, currentTipoLancamento]);

    const mutation = useMutation({
        mutationFn: async (formData: any) => {
            // Destructuring exato para NUNCA enviar campos que não existem no banco
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
                nf_emite, // Campo local para controle da UI
                valor_unitario_manual,
                descricao_servico,
                categoria_servico,
                justificativa_data,
                placa_veiculo,
                status_financeiro,
                data_vencimento,
                horario_inicio,
                horario_fim,
                ...rest
            } = formData;

            const payload = {
                ...rest,
                data_operacao: data,
                placa: placa_veiculo || rest.placa || null,
                // Mapeamento de nomes de campo do esquema para nomes de campo do banco
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
                status: "aguardando_validacao",
                origem_dado: "manual",
                responsavel_nome: user?.user_metadata?.full_name || "Encarregado",
                colaborador_id: selectedColaboradores[0] || null,
                regra_id: formData.regra_periodo_id || null, // Para serviços específicos
                codigo_operacional: selectedPeriodo ? `${selectedPeriodo.codigo}C${formData.quantidade_colaboradores}` : null,
                horario_inicio: horario_inicio || null,
                horario_fim: horario_fim || null,
            };

            const colabPayload = selectedColaboradores.map(id => ({
                collaborator_id: id,
                had_infraction: false,
                entrada_ponto: colaboradorTimings[id]?.entrada_ponto || null,
                saida_almoco: colaboradorTimings[id]?.saida_almoco || null,
                retorno_almoco: colaboradorTimings[id]?.retorno_almoco || null,
                saida_ponto: colaboradorTimings[id]?.saida_ponto || null,
            }));

            return OperacaoProducaoService.createWithColaboradores(payload, colabPayload, selectedMateriais);
        },
        onSuccess: () => {
            toast.success("Produção lançada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });

            // Resetar para novo lançamento
            setEtapa(1);
            form.reset(DEFAULT_PRODUCTION_VALUES);
            setSelectedColaboradores([]);
            setColaboradorTimings({});
            setSelectedMateriais([]);
            navigate('/producao');

            // Garantir que a lista de hoje de baixo atualize
            queryClient.refetchQueries({ queryKey: ["producao_recente"] });
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
        <OperationalShell
            title="Lançamento Operacional"
            hideFab
        >
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => etapa === 1 ? navigate(-1) : setEtapa(prev => prev - 1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Passo {etapa} de 4</h1>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-2">
                                {etapa === 1 ? "Opções" : etapa === 2 ? "Contexto Operacional" : etapa === 3 ? "Detalhamento e Valores" : "Equipe / Colaboradores"}
                            </p>
                        </div>
                    </div>
                    <div className="hidden md:block w-48">
                        <Progress value={(etapa / 4) * 100} className="h-2" />
                    </div>
                </div>

                <form
                    onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                    className="space-y-6"
                    onKeyDown={(e) => {
                        // Impedir que o Enter submeta o formulário acidentalmente, exceto em campos de texto área
                        if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                            e.preventDefault();
                        }
                    }}
                >
                    {etapa === 1 && (
                        <FormStepSelector
                            form={form}
                            onNext={(preset) => {
                                if (preset.tipo === "diaristas") {
                                    navigate("/producao/diaristas");
                                } else if (preset.tipo === "transbordo_servico_extra") {
                                    navigate("/producao/servicos-extras");
                                } else if (preset.tipo === "custos_extras") {
                                    navigate("/producao/custos-extras");
                                } else {
                                    setEtapa(2);
                                }
                            }}
                        />
                    )}

                    {etapa === 2 && (
                        <div className="esc-card p-6">
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
                        <div className="esc-card p-6">
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
                        <div className="esc-card p-6">
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
                        <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-between gap-4 z-50 lg:left-64">
                            <Button type="button" variant="outline" className="flex-1" onClick={() => setEtapa(prev => prev - 1)}>
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
                                    Finalizar Lançamento
                                </Button>
                            )}
                        </div>
                    )}
                </form>

                {/* Seção de Lançamentos Recentes */}
                <div className="space-y-4 pt-10 border-t border-slate-200">
                    <div className="flex items-center gap-2 px-2">
                        <History className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-lg font-bold">Lançamentos de Hoje</h2>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                        <RecentLaunchesList
                            date={new Date().toLocaleDateString('en-CA')} // Formato YYYY-MM-DD local
                            empresaId={currentEmpresaId}
                            unidadeId={form.watch("unidade_id")}
                        />
                    </div>
                </div>
            </div>
        </OperationalShell>
    );
};

export default LancamentoProducao;
