import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    ChevronRight,
    ChevronLeft,
    Save,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import { OperationalShell } from "@/components/layout/OperationalShell";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/contexts/AuthContext";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { EmpresaService, ColaboradorService } from "@/services/domain/cadastros.service";
import { UnidadeOperacionalService, TipoServicoOperacionalService, ProdutoCargaService, FormaPagamentoOperacionalService } from "@/services/domain/core.service";

// Modular Components
import { useProductionForm } from "@/components/operacoes/lancamento/hooks/useProductionForm";
import { FormStepSelector } from "@/components/operacoes/lancamento/FormStepSelector";
import { FormStepContext } from "@/components/operacoes/lancamento/FormStepContext";
import { FormStepSummary } from "@/components/operacoes/lancamento/FormStepSummary";
import { FormStepTeam } from "@/components/operacoes/lancamento/FormStepTeam";
import { DEFAULT_PRODUCTION_VALUES } from "@/components/operacoes/lancamento/schema";

const LancamentoProducao = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [etapa, setEtapa] = useState(1);
    const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
    const empresaId = user?.user_metadata?.empresa_id || "";

    const { form, loadingPreco } = useProductionForm({
        empresaId,
        defaultValues: DEFAULT_PRODUCTION_VALUES,
    });

    // Queries globais necessárias para os selects nas sub-telas
    const { data: empresas = [] } = useQuery({ queryKey: ["empresas"], queryFn: () => EmpresaService.getAll() });
    const { data: unidades = [] } = useQuery({
        queryKey: ["unidades", form.watch("empresa_id")],
        queryFn: () => UnidadeOperacionalService.getByEmpresa(form.watch("empresa_id")),
        enabled: !!form.watch("empresa_id")
    });
    const { data: tiposServico = [] } = useQuery({ queryKey: ["tipos_servico"], queryFn: () => TipoServicoOperacionalService.getAllActive() });
    const { data: produtos = [] } = useQuery({ queryKey: ["produtos"], queryFn: () => ProdutoCargaService.getAll() });
    const { data: formasPagamento = [] } = useQuery({ queryKey: ["formas_pagamento"], queryFn: () => FormaPagamentoOperacionalService.getAllActive() });
    const { data: colaboradores = [] } = useQuery({
        queryKey: ["colaboradores_prod", form.watch("empresa_id")],
        queryFn: () => ColaboradorService.getWithEmpresa(form.watch("empresa_id")),
        enabled: !!form.watch("empresa_id")
    });

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = {
                ...data,
                valor_total: data.quantidade * (data.valor_unitario || 0),
                status: "Pendente",
                origem_dado: "manual",
                responsavel_nome: user?.user_metadata?.full_name || "Encarregado",
            };

            const colabPayload = selectedColaboradores.map(id => ({
                collaborator_id: id,
                had_infraction: false
            }));

            return OperacaoProducaoService.createWithColaboradores(payload, colabPayload);
        },
        onSuccess: () => {
            toast.success("Produção lançada com sucesso!");
            queryClient.invalidateQueries({ queryKey: ["producao_recente"] });
            navigate("/operacional/pipeline");
        },
        onError: (err: any) => toast.error("Erro ao salvar: " + err.message)
    });

    const handleNext = async () => {
        setEtapa(prev => prev + 1);
    };

    const handleToggleColaborador = (id: string) => {
        setSelectedColaboradores(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    return (
        <OperationalShell
            title="Lançamento Operacional"
        >
            <div className="max-w-4xl mx-auto space-y-6 pb-20">
                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => etapa === 1 ? navigate(-1) : setEtapa(prev => prev - 1)}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Passo {etapa} de 4</h1>
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                                {etapa === 1 ? "Seleção de Fluxo" : etapa === 2 ? "Contexto Operacional" : etapa === 3 ? "Valores e Faturamento" : "Equipe e Conduta"}
                            </p>
                        </div>
                    </div>
                    <div className="hidden md:block w-48">
                        <Progress value={(etapa / 4) * 100} className="h-2" />
                    </div>
                </div>

                <form onSubmit={form.handleSubmit((data) => mutation.mutate(data))} className="space-y-6">
                    {etapa === 1 && (
                        <FormStepSelector
                            form={form}
                            onNext={(preset) => {
                                if (preset.tipo === "diaristas") {
                                    navigate("/producao/diaristas");
                                } else if (preset.tipo === "servicos_especificos") {
                                    navigate("/producao/servicos-especificos");
                                } else if (preset.id === "servicos_extras") {
                                    navigate("/producao/servicos-extras");
                                } else if (preset.id === "custos_operacionais") {
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
                            />
                        </div>
                    )}

                    {etapa === 4 && (
                        <div className="esc-card p-6">
                            <FormStepTeam
                                form={form}
                                colaboradores={colaboradores}
                                selectedIds={selectedColaboradores}
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
                                <Button type="submit" className="flex-1 bg-primary" disabled={mutation.isPending}>
                                    {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                    Finalizar Lançamento
                                </Button>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </OperationalShell>
    );
};

export default LancamentoProducao;
