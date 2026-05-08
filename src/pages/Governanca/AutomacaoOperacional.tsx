/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
    Activity,
    AlertTriangle,
    ArrowDownRight,
    ArrowRight,
    CheckCircle,
    Clock,
    HeartPulse,
    PlayCircle,
    RefreshCcw,
    RotateCcw,
    Sparkles,
    Unlock,
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTenant } from "@/contexts/TenantContext";
import { OperationalAutomationEngine } from "@/services/automation/OperationalAutomationEngine";
import { AutomationWorker } from "@/services/automation/AutomationWorker";

const localWorker = new AutomationWorker();

const severityClass = (severidade: string) => {
    if (severidade === "critical") return "border-destructive text-destructive";
    if (severidade === "high") return "border-orange-500 text-orange-500";
    if (severidade === "medium") return "border-warning text-warning";
    if (severidade === "resolvido") return "border-success text-success";
    return "border-muted-foreground text-muted-foreground";
};

const formatMinutes = (value?: number) => {
    if (!value) return "0 min";
    if (value < 60) return `${value} min`;
    const hours = Math.floor(value / 60);
    const minutes = value % 60;
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
};

export default function AutomacaoOperacional() {
    const { tenant } = useTenant();
    const navigate = useNavigate();
    const [isWorkerRunning, setIsWorkerRunning] = useState(false);
    const [isAutoHealing, setIsAutoHealing] = useState(false);

    const {
        data: alertasAtivos = [],
        refetch: refetchAlertas,
    } = useQuery({
        queryKey: ["automacao_alertas_ativos", tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarAlertas(tenant!.id),
        enabled: !!tenant?.id,
        refetchInterval: 5000,
    });

    const {
        data: timelineAutoCura = [],
        refetch: refetchTimeline,
    } = useQuery({
        queryKey: ["automacao_alertas_timeline", tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarAlertas(tenant!.id, { incluirResolvidos: true, limit: 30 }),
        enabled: !!tenant?.id,
        refetchInterval: 8000,
    });

    const {
        data: execucoes = [],
        refetch: refetchExecucoes,
    } = useQuery({
        queryKey: ["automacao_execucoes", tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarExecucoes(tenant!.id),
        enabled: !!tenant?.id,
        refetchInterval: 3000,
    });

    const {
        data: saude,
        refetch: refetchSaude,
    } = useQuery({
        queryKey: ["automacao_saude", tenant?.id],
        queryFn: () => OperationalAutomationEngine.getSaudeOperacional(tenant!.id),
        enabled: !!tenant?.id,
        refetchInterval: 8000,
    });

    useEffect(() => {
        setIsWorkerRunning(true);
        localWorker.start();
        return () => {
            localWorker.stop();
            setIsWorkerRunning(false);
        };
    }, []);

    const countPendentes = useMemo(
        () => execucoes.filter((execucao: any) => execucao.status === "pendente" || execucao.status === "executando").length,
        [execucoes],
    );

    const refreshAll = () => {
        refetchAlertas();
        refetchTimeline();
        refetchExecucoes();
        refetchSaude();
    };

    const enqueueAllAutomatons = async () => {
        if (!tenant?.id) return;
        await OperationalAutomationEngine.agendarLoteAssincrono(tenant.id);

        if (!isWorkerRunning) {
            setIsWorkerRunning(true);
            localWorker.start();
        }

        refreshAll();
    };

    const executarAutoCura = async () => {
        if (!tenant?.id) return;
        setIsAutoHealing(true);
        try {
            await OperationalAutomationEngine.executarAutoCura(tenant.id);
            refreshAll();
        } finally {
            setIsAutoHealing(false);
        }
    };

    const handleAcaoGuiada = (alerta: any) => {
        switch (alerta.tipo) {
            case "colaborador_sem_regra":
            case "cpf_invalido":
                navigate(`/cadastros/colaboradores`);
                break;
            case "conta_bancaria_invalida":
                navigate(`/financeiro/contas`);
                break;
            case "falta_nao_justificada":
            case "excesso_horas":
            case "ponto_incompleto":
                navigate(`/rh/pontos?colaborador_id=${alerta.contexto_json?.colaborador_id || ""}`);
                break;
            case "ciclo_invalidado_automaticamente":
            case "ciclo_sem_aprovacao":
            case "fechamento_atrasado":
                navigate(`/operacional/fechamento`);
                break;
            default:
                break;
        }
    };

    return (
        <AppShell title="Automacao Operacional" subtitle="Motor de auto-cura supervisionada, validacao e reducao de ruido">
            <div className="space-y-6">
                <section className="esc-card p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                            <Activity className={`h-5 w-5 ${countPendentes > 0 ? "text-warning animate-pulse" : "text-success"}`} />
                            Status do Motor: {countPendentes > 0 ? "Processando fila" : "Ocioso"}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            O Orbe detecta inconsistencias, percebe correcoes, limpa alertas e libera ciclos sem executar acoes financeiras criticas.
                        </p>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                        <Button onClick={executarAutoCura} disabled={isAutoHealing} variant="outline">
                            <HeartPulse className="h-4 w-4 mr-2" />
                            {isAutoHealing ? "Auto-curando..." : "Executar Auto-Cura"}
                        </Button>
                        <Button onClick={enqueueAllAutomatons} disabled={countPendentes > 0}>
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Enfileirar Varredura Global
                        </Button>
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-3">
                        <HeartPulse className="h-5 w-5 text-success" />
                        <h3 className="text-lg font-semibold">Saude Operacional</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                        <div className="esc-card p-4">
                            <p className="text-xs text-muted-foreground">Alertas ativos</p>
                            <strong className="text-2xl">{saude?.alertasAtivos ?? 0}</strong>
                        </div>
                        <div className="esc-card p-4">
                            <p className="text-xs text-muted-foreground">Alertas auto-curados</p>
                            <strong className="text-2xl text-success">{saude?.alertasAutoCurados ?? 0}</strong>
                        </div>
                        <div className="esc-card p-4">
                            <p className="text-xs text-muted-foreground">Bloqueios removidos</p>
                            <strong className="text-2xl">{saude?.bloqueiosRemovidos ?? 0}</strong>
                        </div>
                        <div className="esc-card p-4">
                            <p className="text-xs text-muted-foreground">Severidade media</p>
                            <strong className="text-2xl">{saude?.severidadeMedia ?? 0}</strong>
                        </div>
                        <div className="esc-card p-4">
                            <p className="text-xs text-muted-foreground">Tempo medio resolucao</p>
                            <strong className="text-2xl">{formatMinutes(saude?.tempoMedioResolucaoMinutos)}</strong>
                        </div>
                    </div>
                </section>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <section className="esc-card flex flex-col h-full">
                        <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
                            <span>Alertas ativos e travas</span>
                            <Badge variant="destructive">{alertasAtivos.length}</Badge>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[480px]">
                            {alertasAtivos.length > 0 ? (
                                <ul className="space-y-3">
                                    {alertasAtivos.map((alerta: any) => (
                                        <li key={alerta.id} className="p-3 border border-border rounded-lg bg-background flex flex-col gap-2">
                                            <div className="flex items-start justify-between gap-2 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {alerta.severidade === "critical" ? (
                                                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                                                    ) : alerta.severidade === "high" ? (
                                                        <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                                                    ) : (
                                                        <CheckCircle className="h-4 w-4 text-warning shrink-0" />
                                                    )}
                                                    <span className="text-sm">{String(alerta.tipo).replace(/_/g, " ").toUpperCase()}</span>
                                                </div>
                                                <Badge variant="outline" className={`text-[10px] uppercase ${severityClass(alerta.severidade)}`}>
                                                    {alerta.severidade}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                                            {(alerta.severidade_anterior || alerta.reducoes_severidade > 0) && (
                                                <div className="flex items-center gap-1 text-xs text-success">
                                                    <ArrowDownRight className="h-3.5 w-3.5" />
                                                    Severidade reduzida: {alerta.severidade_original || alerta.severidade_anterior} para {alerta.severidade}
                                                </div>
                                            )}

                                            <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => handleAcaoGuiada(alerta)}>
                                                Resolver Pendencia <ArrowRight className="h-4 w-4 ml-2" />
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                                    <CheckCircle className="h-10 w-10 mb-2 opacity-50" />
                                    <p>Nenhuma inconsistencia ativa detectada.</p>
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="esc-card flex flex-col h-full">
                        <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
                            <span>Timeline de auto-cura</span>
                            <Sparkles className="h-4 w-4 text-success" />
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[480px]">
                            {timelineAutoCura.length > 0 ? (
                                <ul className="space-y-3">
                                    {timelineAutoCura.map((alerta: any) => (
                                        <li key={alerta.id} className="p-3 border border-border rounded-lg bg-background flex flex-col gap-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    {alerta.resolvido_automaticamente ? (
                                                        <RotateCcw className="h-4 w-4 text-success" />
                                                    ) : (
                                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    <span className="font-medium text-sm">{String(alerta.tipo).replace(/_/g, " ")}</span>
                                                </div>
                                                {alerta.resolvido_automaticamente ? (
                                                    <Badge variant="outline" className="border-success text-success">
                                                        Auto-curado
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className={severityClass(alerta.severidade)}>
                                                        {alerta.severidade}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{alerta.mensagem}</p>
                                            {alerta.resolvido_automaticamente && (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                                    <span className="rounded-md bg-success-soft px-2 py-1 text-success-strong">
                                                        Antes: {alerta.severidade_original || alerta.severidade_anterior || "n/a"}
                                                    </span>
                                                    <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                                                        Depois: resolvido
                                                    </span>
                                                </div>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-muted-foreground">
                                    <Unlock className="h-10 w-10 mb-2 opacity-50" />
                                    <p>Nenhum evento de auto-cura registrado ainda.</p>
                                </div>
                            )}
                        </div>
                    </section>
                </div>

                <section className="esc-card flex flex-col h-full">
                    <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
                        <span>Fila de background e historico</span>
                        <Clock className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[360px]">
                        {execucoes.length > 0 ? (
                            <ul className="space-y-3">
                                {execucoes.map((execucao: any) => (
                                    <li key={execucao.id} className="p-3 border border-border rounded-lg bg-background flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-medium text-sm">{execucao.tipo}</span>
                                            <Badge
                                                variant={
                                                    execucao.status === "concluido"
                                                        ? "success"
                                                        : execucao.status === "falhou"
                                                          ? "destructive"
                                                          : execucao.status === "executando"
                                                            ? "warning"
                                                            : "default"
                                                }
                                            >
                                                {execucao.status}
                                            </Badge>
                                        </div>
                                        <div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
                                            <span>{new Date(execucao.created_at).toLocaleString("pt-BR")}</span>
                                            {execucao.tentativas > 0 && <span>Tentativas: {execucao.tentativas}</span>}
                                        </div>
                                        {execucao.status === "falhou" && (
                                            <p className="text-xs text-destructive mt-1">{execucao.erro}</p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <div className="min-h-[160px] flex flex-col items-center justify-center text-muted-foreground">
                                Nenhuma execucao registrada
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </AppShell>
    );
}
