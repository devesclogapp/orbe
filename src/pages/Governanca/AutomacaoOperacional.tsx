import { useState, useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { OperationalAutomationEngine } from "@/services/automation/OperationalAutomationEngine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, PlayCircle, RefreshCcw, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function AutomacaoOperacional() {
    const { tenant } = useAuth();

    const { data: alertas, refetch: refetchAlertas } = useQuery({
        queryKey: ['automacao_alertas', tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarAlertas(tenant?.id!),
        enabled: !!tenant?.id,
    });

    const { data: execucoes, refetch: refetchExecucoes } = useQuery({
        queryKey: ['automacao_execucoes', tenant?.id],
        queryFn: () => OperationalAutomationEngine.listarExecucoes(tenant?.id!),
        enabled: !!tenant?.id,
    });

    const runAllAutomatons = async () => {
        if (!tenant?.id) return;

        // Agendar jobs
        await OperationalAutomationEngine.agendarExecucao({
            empresa_id: tenant.id,
            tipo: 'PROCESSAMENTO_RH',
            prioridade: 10
        });

        await OperationalAutomationEngine.agendarExecucao({
            empresa_id: tenant.id,
            tipo: 'SUGESTAO_FECHAMENTO',
            prioridade: 5
        });

        await OperationalAutomationEngine.agendarExecucao({
            empresa_id: tenant.id,
            tipo: 'VALIDACAO_FINANCEIRA',
            prioridade: 1
        });

        // Processa fila
        await OperationalAutomationEngine.processarFila(tenant.id);

        refetchAlertas();
        refetchExecucoes();
    };

    return (
        <AppShell title="Automação Operacional" subtitle="Motor semi-autônomo de análise e validação">
            <div className="space-y-6">
                <section className="esc-card p-5 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div>
                        <h2 className="font-display font-semibold text-lg flex items-center gap-2">
                            <RefreshCcw className="h-5 w-5 text-primary" /> Motor Operacional Ativo
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            O motor varre inconsistências de RH, pendências financeiras e gera sugestões de fechamento automaticamente.
                        </p>
                    </div>
                    <Button onClick={runAllAutomatons}>
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Rodar Ciclo Completo
                    </Button>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* ALERTAS GERADOS */}
                    <section className="esc-card flex flex-col h-full">
                        <div className="p-4 border-b border-border font-semibold flex items-center justify-between">
                            <span>Alertas e Sugestões Pendentes</span>
                            <Badge variant="destructive">{alertas?.length || 0}</Badge>
                        </div>
                        <div className="p-4 flex-1 overflow-y-auto max-h-[400px]">
                            {alertas && alertas.length > 0 ? (
                                <ul className="space-y-3">
                                    {alertas.map(a => (
                                        <li key={a.id} className="p-3 border border-border rounded-lg bg-background flex flex-col gap-1">
                                            <div className="flex items-center gap-2 font-medium">
                                                {a.severidade === 'critical' || a.severidade === 'error' ? (
                                                    <AlertTriangle className="h-4 w-4 text-destructive" />
                                                ) : (
                                                    <CheckCircle className="h-4 w-4 text-warning" />
                                                )}
                                                <span>{a.tipo.replace(/_/g, ' ').toUpperCase()}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{a.mensagem}</p>
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
                            <span>Histórico de Execuções</span>
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
                                                    variant={e.status === 'concluido' ? 'success' : e.status === 'falhou' ? 'destructive' : 'default'}
                                                    className={e.status === 'concluido' ? 'bg-success-soft text-success-strong' : ''}
                                                >
                                                    {e.status}
                                                </Badge>
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {new Date(e.created_at).toLocaleString('pt-BR')}
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
