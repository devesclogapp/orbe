import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CalendarCheck, Lock, Unlock, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";
import { toast } from "sonner";
import {
    buildOperationalFailurePipeline,
    buildOperationalStagePipeline,
    useOperationalPipeline
} from "@/contexts/OperationalPipelineContext";

const StatusBadge = ({ label, status, type }: { label: string, status?: string | boolean | null, type: string }) => {
    const safeStatus = String(status || 'pendente');
    let color = "bg-secondary text-secondary-foreground";
    let Icon = Clock;

    if (safeStatus === 'pendente' || safeStatus === 'aberto') {
        color = "bg-warning-soft text-warning-strong";
    } else if (safeStatus === 'fechado' || safeStatus === 'true' || safeStatus === 'validado' || safeStatus === 'liberado') {
        color = "bg-success-soft text-success-strong";
        Icon = CheckCircle2;
    } else if (safeStatus === 'rejeitado' || safeStatus === 'inconsistente' || safeStatus === 'false') {
        color = "bg-destructive-soft text-destructive-strong";
        Icon = XCircle;
    }

    return (
        <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</span>
            <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium w-fit", color)}>
                <Icon className="h-3 w-3" />
                {safeStatus.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
        </div>
    );
};

const FechamentoMensalCLT = () => {
    const queryClient = useQueryClient();
    const currentMonth = new Date().toISOString().substring(0, 7);
    const { openPipeline } = useOperationalPipeline();

    // Store all companies logic
    const { data: companies = [], isLoading: loadingCompanies } = useQuery({
        queryKey: ["fechamento_empresas", currentMonth],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return [];
            const { data: profile } = await supabase
                .from('profiles')
                .select('tenant_id')
                .eq('user_id', user.id)
                .single();
            const tenantId = profile?.tenant_id;
            if (!tenantId) return [];

            const { data: list } = await supabase
                .from('empresas')
                .select('id, nome')
                .eq('tenant_id', tenantId);

            return list || [];
        }
    });

    // Then for each company load validation
    const { data: validations = [], isLoading: loadingValidations } = useQuery({
        queryKey: ["fechamento_validations", currentMonth, companies.map(c => c.id).join(',')],
        enabled: companies.length > 0,
        queryFn: async () => {
            const results = [];
            for (const empresa of companies) {
                try {
                    const val = await RHFinanceiroService.validateCompetenciaApproval(empresa.id, currentMonth);
                    // Only show companies that have points or blocks in this competency
                    // "impedimentos" with "Nenhum registro processado" indicates it's empty
                    const isEmpty = val.impedimentos.includes("Nenhum registro processado foi encontrado para a competencia selecionada.");

                    if (!isEmpty || val.resumo.pendenciasCadastrais > 0 || val.resumo.bloqueiosCriticos > 0) {
                        results.push(val);
                    }
                } catch (e) {
                    console.error(`Erro validando ${empresa.nome}:`, e);
                    // Some companies might fail but we skip them or log them (e.g no tenant identified inside validateCompetenciaApproval if not logged in)
                }
            }
            return results;
        }
    });

    // Verify status of Fechamento in rh_financeiro_lotes
    const { data: lotesAtuais = [] } = useQuery({
        queryKey: ["fechamento_lotes", currentMonth],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("rh_financeiro_lotes")
                .select("empresa_id, status")
                .eq("competencia", currentMonth)
                .eq("origem", "RH");

            if (error) throw error;
            return data || [];
        }
    });

    const actionMutation = useMutation({
        mutationFn: async ({ empresaId }: { empresaId: string }) => {
            return RHFinanceiroService.approveCompetencia(empresaId, currentMonth);
        },
        onSuccess: (data) => {
            toast.success(`Fechamento concluído: ${data.totalItens} itens gerados.`);
            queryClient.invalidateQueries({ queryKey: ["fechamento_validations"] });
            queryClient.invalidateQueries({ queryKey: ["fechamento_lotes"] });

            openPipeline(
                buildOperationalStagePipeline({
                    competencia: currentMonth,
                    empresa: "Geral",
                    completedStage: "fechamento_mensal"
                })
            );
        },
        onError: (err: any) => {
            toast.error("Impossível fechar a competência", { description: err.message });

            openPipeline(
                buildOperationalFailurePipeline({
                    competencia: currentMonth,
                    empresa: "Operacao",
                    currentStage: "fechamento_mensal",
                    failureStatus: "blocked",
                    failureTitle: "Inconsistências impeditivas",
                    failureDescription: err.message || "Existem fatores bloqueando o fechamento.",
                    nextAction: {
                        label: "Entendi",
                        description: "Analise os bloqueios listados e corrija-os na central respectiva.",
                        route: "/banco-horas/fechamento",
                    },
                }),
            );
        }
    });

    const getLoteStatus = (empresaId: string) => {
        const lote = lotesAtuais.find(l => l.empresa_id === empresaId);
        return lote?.status || "pendente"; // AGUARDANDO_FINANCEIRO, DEVOLVIDO_RH etc
    }

    const isLoteLocked = (empresaId: string) => {
        const s = getLoteStatus(empresaId);
        return s === "AGUARDANDO_FINANCEIRO" || s === "EM_PROCESSAMENTO" || s === "CONCLUIDO";
    }

    const isLoading = loadingCompanies || (companies.length > 0 && loadingValidations);

    return (
        <AppShell
            title="Fechamento Mensal CLT"
            subtitle={`Auditoria e liberação de competência: ${currentMonth}`}
        >
            {isLoading ? (
                <div className="flex items-center justify-center p-20">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    <section className="esc-card p-4">
                        {/* Totais Gerais */}
                        <div className="text-sm text-muted-foreground pb-2 ml-1">Resumo Corporativo</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Unidades (Empresas)</p>
                                <p className="text-lg font-semibold text-foreground">{validations.length}</p>
                                <p className="text-xs text-muted-foreground">Em apuração na competência</p>
                            </div>
                            <div className="rounded-lg border border-border bg-warning/10 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-warning-strong">Bloqueios Críticos</p>
                                <p className="text-lg font-semibold text-warning-strong">{validations.reduce((acc, curr) => acc + curr.resumo.bloqueiosCriticos, 0)}</p>
                                <p className="text-xs text-warning-strong/80">Ocorrências impeditivas</p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Folha Variável</p>
                                <p className="text-lg font-semibold text-foreground">{validations.reduce((acc, curr) => acc + (curr.resumo.financeiroPrevisto?.variaveis || 0), 0)}</p>
                                <p className="text-xs text-muted-foreground">Ocorrências apuradas</p>
                            </div>
                            <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Lotes Liberados</p>
                                <p className="text-lg font-semibold text-foreground">{lotesAtuais.length}</p>
                                <p className="text-xs text-muted-foreground">Arquivos para Financeiro</p>
                            </div>
                        </div>
                    </section>

                    {validations.map((v) => {
                        const hasErrors = v.impedimentos.length > 0;
                        const statusLote = getLoteStatus(v.empresaId);
                        const isLocked = isLoteLocked(v.empresaId);

                        return (
                            <article key={v.empresaId} className="esc-card p-6 flex flex-col gap-5">
                                <div className="flex items-center justify-between border-b border-border pb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                            <CalendarCheck className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h3 className="font-display font-semibold text-lg text-foreground">
                                                {v.empresaNome || "Empresa Desconhecida"}
                                            </h3>
                                            <p className="text-sm text-muted-foreground">
                                                {v.competencia.split('-')[1]}/{v.competencia.split('-')[0]}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4">
                                        <StatusBadge label="Saúde Cadastral" status={v.resumo.pendenciasCadastrais === 0 ? "validado" : "inconsistente"} type="rh" />
                                        <StatusBadge label="Dados Ponto" status={v.resumo.inconsistenciasAbertas === 0 ? "fechado" : "pendente"} type="rh" />
                                        <StatusBadge label="Lote Financeiro" status={statusLote} type="fin" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-4 gap-6 py-2">
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bloqueios</div>
                                        <div className={cn("font-display font-semibold text-2xl", v.resumo.bloqueiosCriticos > 0 ? "text-destructive" : "text-muted-foreground")}>
                                            {v.resumo.bloqueiosCriticos}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Itens de Ponto</div>
                                        <div className="font-display font-semibold text-2xl">{v.resumo.financeiroPrevisto?.variaveis || 0}</div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Avisos</div>
                                        <div className={cn("font-display font-semibold text-2xl", v.resumo.avisosOperacionais > 0 ? "text-warning" : "text-muted-foreground")}>
                                            {v.resumo.avisosOperacionais}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Banco de Horas</div>
                                        <div className="font-display font-semibold text-2xl text-success">
                                            {v.resumo.financeiroPrevisto?.bancoHoras || 0}
                                        </div>
                                    </div>
                                </div>

                                {hasErrors && (
                                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-destructive">Impedimentos Críticos</p>
                                        <ul className="mt-2 space-y-1 text-sm text-destructive">
                                            {v.impedimentos.map((item, idx) => (
                                                <li key={`${v.empresaId}-blocker-${idx}`}>• {item}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                <div className="flex items-center justify-between pt-4 border-t border-border bg-muted/30 -mx-6 px-6 pb-2 -mb-2 rounded-b-xl">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                                        {isLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                                        {isLocked ? "Competência trancada. Lote gerado e aguardando fluxo financeiro." : "Competência sob edição / correção operacional."}
                                    </span>

                                    <div className="flex items-center gap-2">
                                        <Button
                                            size="sm"
                                            disabled={hasErrors || actionMutation.isPending || isLocked}
                                            onClick={() => actionMutation.mutate({ empresaId: v.empresaId })}
                                            variant={isLocked ? "secondary" : "default"}
                                        >
                                            {actionMutation.isPending ? "Processando..." : isLocked ? "Liberado (Financeiro)" : hasErrors ? "Bloqueado por pendências" : "Liberar Competência →"}
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}

                    {validations.length === 0 && !isLoading && (
                        <div className="p-12 text-center text-muted-foreground italic esc-card mt-4">
                            Nenhuma competência mensal encontrada aguardando fechamento ou processamento.
                        </div>
                    )}
                </div>
            )}
        </AppShell>
    );
};

export default FechamentoMensalCLT;
