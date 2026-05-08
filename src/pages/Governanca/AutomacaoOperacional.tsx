import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { OperationalAutomationEngine } from "@/services/automation/OperationalAutomationEngine";
import { AutomationWorker } from "@/services/automation/AutomationWorker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, PlayCircle, RefreshCcw, CheckCircle, Activity, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

// Worker singleton simplificado para rodar background tasks enquanto estamos na tela (Simulando Edge Functions)
const localWorker = new AutomationWorker();

export default function AutomacaoOperacional() {
    const { tenant } = useAuth();
    const navigate = useNavigate();
    const [isWorkerRunning, setIsWorkerRunning] = useState(false);

    // Polling ativo para mostrar tempo real a execucao
    const { data: alertas, refetch: refetchAlertas } = useQuery({
        queryKey: ['automacao_alertas', tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarAlertas(tenant?.id!),
        enabled: !!tenant?.id,
        refetchInterval: 5000 // poll
    });

    const { data: execucoes, refetch: refetchExecucoes } = useQuery({
        queryKey: ['automacao_execucoes', tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarExecucoes(tenant?.id!),
        enabled: !!tenant?.id,
        refetchInterval: 3000 // poll mais rapido
    });

    // Inicia worker no background ao entrar (Para testes, ideal seria serverless)
    useEffect(() => {
        setIsWorkerRunning(true);
        localWorker.start();
        return () => {
            localWorker.stop();
            setIsWorkerRunning(false);
        };
    }, []);

    const enqueueAllAutomatons = async () => {
        if (!tenant?.id) return;
        await OperationalAutomationEngine.agendarLoteAssincrono(tenant.id);
        
        // Ativa o worker localmente para testar se ele ja não estiver pegando
        if (!isWorkerRunning) {
            setIsWorkerRunning(true);
            localWorker.start();
        }
        
        refetchAlertas();
        refetchExecucoes();
    };

    const handleAcaoGuiada = (alerta: any) => {
        switch(alerta.tipo) {
            case 'colaborador_sem_regra':
                navigate(`/cadastros/colaboradores/${alerta.contexto_json?.colaborador_id}?tab=regras`);
                break;
            case 'conta_bancaria_invalida':
                navigate(`/financeiro/contas`);
                break;
            case 'falta_nao_justificada':
            case 'excesso_horas':
            case 'ponto_incompleto':
                navigate(`/rh/pontos?colaborador_id=${alerta.contexto_json?.colaborador_id}`);
                break;
            case 'ciclo_invalidado_automaticamente':
            case 'ciclo_sem_aprovacao':
            case 'fechamento_atrasado':
                navigate(`/operacional/fechamento`);
                break;
            default:
                break;
        }
    };

    const countPendentes = execucoes?.filter(e => e.status === 'pendente' || e.status === 'executando').length || 0;

    return (
        <AppShell title="Automação Operacional" subtitle="Motor semi-autônomo de análise e validação">
            <div className="space-y-6">
                <section className="esc-card p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                            <Activity className={`h-5 w-5 ${countPendentes > 0 ? 'text-warning animate-pulse' : 'text-success'}`} /> 
                            Status do Motor: {countPendentes > 0 ? 'Processando Fila...' : 'Ocioso'}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            O motor varre inconsistências de RH, pendências financeiras e gera sugestões e travas automaticamente.
                        </p>
                    </div>
                    <Button onClick={enqueueAllAutomatons} disabled={countPendentes > 0}>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Enfileirar Varredura Global
                    </Button>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ALERTAS GERADOS */}
                    <section className="esc-card flex flex-col h-full">
                        <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
                            <span>Alertas (Travas de Fechamento)</span>
                            <Badge variant="destructive">{alertas?.length || 0}</Badge>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
                            {alertas && alertas.length > 0 ? (
                                <ul className="space-y-3">
                                    {alertas.map(a => (
                                        <li key={a.id} className="p-3 border border-border rounded-lg bg-background flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-2 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {a.severidade === 'critical' ? (
                                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                                    ) : a.severidade === 'high' ? (
                                                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4 text-warning shrink-0" />
                                                    )}
                                                    <span className="text-sm">{a.tipo.replace(/_/g, ' ').toUpperCase()}</span>
                                                </div>
                                                <Badge variant="outline" className={`text-[10px] uppercase ${a.severidade === 'critical' ? 'border-destructive text-destructive' : a.severidade === 'high' ? 'border-orange-500 text-orange-500' : ''}`}>{a.severidade}</Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{a.mensagem}</p>
                                            
                                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleAcaoGuiada(a)}>
                                                Resolver Pendência <ArrowRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    <CheckCircle className="h-10 w-10 mb-2 opacity-50" />
                                    <p>Nenhuma inconsistência ou pendência detectada.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* HISTORICO EXECUCOES */}
                    <section className="esc-card flex flex-col h-full">
                        <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
                            <span>Fila de Background e Histórico</span>
                            <Clock className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
                            {execucoes && execucoes.length > 0 ? (
                                <ul className="space-y-3">
                                    {execucoes.map(e => (
                                        <li key={e.id} className="p-3 border border-border rounded-lg bg-background flex flex-col gap-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-medium text-sm">{e.tipo}</span>
                                                <Badge
                                                    variant={e.status === 'concluido' ? 'success' : e.status === 'falhou' ? 'destructive' : e.status === 'executando' ? 'warning' : 'default'}
                                                >
                                                    {e.status}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                                                <span>{new Date(e.created_at).toLocaleString('pt-BR')}</span>
                                                {e.tentativas > 0 && <span>Tentativas: {e.tentativas}</span>}
                                            </div>
                                            {e.status === 'falhou' && (
                                                <p className="text-xs text-destructive mt-1">{e.erro}</p>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                                    Nenhuma execução registrada
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            </div>
        </AppShell>
    );
}
