import { useQuery } from "@tanstack/react-query";
import { CompetenciaService, ConsolidadoService } from "@/services/base.service";
import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Wallet, Users, Building2, AlertTriangle, ArrowRight, Loader2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const FinanceiroGeral = () => {
    const { data: comp, isLoading: loadingComp } = useQuery({
        queryKey: ["competencia_atual"],
        queryFn: () => CompetenciaService.getAtual(),
    });

    const { data: consolidado, isLoading: loadingCons } = useQuery({
        queryKey: ["consolidado", comp?.competencia],
        queryFn: () => ConsolidadoService.getByCompetencia(comp!.competencia),
        enabled: !!comp?.competencia,
    });

    const isLoading = loadingComp || loadingCons;

    const totalFaturavel = comp?.valor_total_faturado || 0;
    const clientesCount = consolidado?.clientes?.length || 0;
    const colabsCount = consolidado?.colaboradores?.length || 0;

    return (
        <AppShell
            title="Financeiro Geral"
            subtitle={`Visão consolidada por competência · ${comp ? new Date(comp.competencia).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : 'Carregando...'}`}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="h-9 px-3 border-border bg-card text-muted-foreground flex items-center gap-2">
                            <Filter className="h-3.5 w-3.5" /> Abril 2024
                        </Badge>
                        <Badge className={cn(
                            "h-9 px-3 font-semibold",
                            comp?.status === 'aberta' ? "bg-info-soft text-info-strong" : "bg-success-soft text-success-strong"
                        )}>
                            Status: {comp?.status || 'Aguardando'}
                        </Badge>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm">Reprocessar competência</Button>
                        <Button size="sm">Consolidar faturamento</Button>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center p-20">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <MetricCard label="Total Faturável" value={`R$ ${totalFaturavel.toLocaleString('pt-BR')}`} icon={Wallet} accent />
                            <MetricCard label="Total por Clientes" value={clientesCount.toString()} icon={Building2} />
                            <MetricCard label="Total por Colaboradores" value={colabsCount.toString()} icon={Users} />
                            <MetricCard label="Inconsistências" value={comp?.contagem_inconsistencias?.toString() || "0"} icon={AlertTriangle} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Lista de Clientes */}
                            <section className="esc-card">
                                <header className="px-5 py-4 border-b border-border flex items-center justify-between">
                                    <h3 className="font-display font-semibold text-foreground">Faturamento por Cliente</h3>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs">Ver todos <ArrowRight className="h-3 w-3 ml-1" /></Button>
                                </header>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="esc-table-header">
                                            <tr className="text-left text-muted-foreground">
                                                <th className="px-5 h-10 font-medium">Cliente</th>
                                                <th className="px-3 h-10 font-medium text-right">Valor</th>
                                                <th className="px-5 h-10 font-medium text-center">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {consolidado?.clientes?.map((c: any) => (
                                                <tr key={c.id} className="border-t border-muted hover:bg-background transition-colors cursor-pointer">
                                                    <td className="px-5 h-12 font-medium text-foreground">{c.clientes?.nome}</td>
                                                    <td className="px-3 text-right font-display font-semibold">R$ {Number(c.valor_total).toLocaleString('pt-BR')}</td>
                                                    <td className="px-5 text-center">
                                                        <span className={cn(
                                                            "esc-chip",
                                                            c.status === 'aprovado' ? "bg-success-soft text-success-strong" : "bg-warning-soft text-warning-strong"
                                                        )}>{c.status}</span>
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!consolidado?.clientes?.length) && (
                                                <tr>
                                                    <td colSpan={3} className="p-8 text-center text-muted-foreground italic">Nenhum cliente consolidado nesta competência.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>

                            {/* Lista de Colaboradores */}
                            <section className="esc-card">
                                <header className="px-5 py-4 border-b border-border flex items-center justify-between">
                                    <h3 className="font-display font-semibold text-foreground">Top Colaboradores (Geração de Valor)</h3>
                                    <Button variant="ghost" size="sm" className="h-8 text-xs">Ver Auditoria <ArrowRight className="h-3 w-3 ml-1" /></Button>
                                </header>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="esc-table-header">
                                            <tr className="text-left text-muted-foreground">
                                                <th className="px-5 h-10 font-medium">Colaborador</th>
                                                <th className="px-3 h-10 font-medium text-right">Valor mensal</th>
                                                <th className="px-5 h-10 font-medium text-center">Dias</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {consolidado?.colaboradores?.sort((a: any, b: any) => b.valor_total - a.valor_total).slice(0, 5).map((c: any) => (
                                                <tr key={c.id} className="border-t border-muted hover:bg-background transition-colors cursor-pointer">
                                                    <td className="px-5 h-12 truncate">
                                                        <div className="font-medium text-foreground">{c.colaboradores?.nome}</div>
                                                        <div className="text-[11px] text-muted-foreground">{c.colaboradores?.cargo}</div>
                                                    </td>
                                                    <td className="px-3 text-right font-display font-semibold text-foreground">
                                                        R$ {Number(c.valor_total).toLocaleString('pt-BR')}
                                                    </td>
                                                    <td className="px-5 text-center text-muted-foreground">
                                                        {(c.eventos_financeiros as any)?.length || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!consolidado?.colaboradores?.length) && (
                                                <tr>
                                                    <td colSpan={3} className="p-8 text-center text-muted-foreground italic">Nenhum colaborador processado ainda.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </AppShell>
    );
};

export default FinanceiroGeral;
