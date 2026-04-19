import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, Users, Clock, AlertCircle } from "lucide-react";
import { BHEventoService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

const PainelGeral = () => {
    const queryClient = useQueryClient();

    const { data: saldos = [], isLoading } = useQuery({
        queryKey: ["bh_saldos"],
        queryFn: () => BHEventoService.getSaldosGerais(),
    });

    const stats = [
        {
            label: "Total Acumulado",
            value: "1.240h",
            icon: Clock,
            color: "text-primary",
            bg: "bg-primary-soft",
        },
        {
            label: "Prestes a Vencer",
            value: "45h",
            icon: AlertCircle,
            color: "text-warning",
            bg: "bg-warning-soft",
        },
        {
            label: "Colaboradores em Risco",
            value: "12",
            icon: Users,
            color: "text-error",
            bg: "bg-destructive-soft",
        },
    ];

    return (
        <AppShell title="Banco de Horas" subtitle="Painel geral de saldos e compensações">
            <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stats.map((s, i) => (
                        <div key={i} className="esc-card p-5 flex items-start justify-between">
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                    {s.label}
                                </p>
                                <h3 className="text-2xl font-bold font-display text-foreground">{s.value}</h3>
                            </div>
                            <div className={cn("p-2 rounded-lg", s.bg)}>
                                <s.icon className={cn("h-5 w-5", s.color)} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex justify-between items-center gap-2">
                    <div className="flex gap-2">
                        <Button variant="secondary" size="sm">Filtros</Button>
                        <Button variant="secondary" size="sm">Exportar</Button>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => queryClient.invalidateQueries({ queryKey: ["bh_saldos"] })}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                    </Button>
                </div>

                <section className="esc-card overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Colaborador</th>
                                    <th className="px-3 h-11 font-medium">Empresa</th>
                                    <th className="px-3 h-11 font-medium text-center">Saldo Atual</th>
                                    <th className="px-3 h-11 font-medium text-center">Vencido</th>
                                    <th className="px-3 h-11 font-medium text-center">A Vencer</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {saldos.map((s: any) => (
                                    <tr key={s.id} className="border-t border-muted hover:bg-background group">
                                        <td className="px-5 h-[52px]">
                                            <Link to={`/banco-horas/extrato/${s.id}`} className="hover:underline">
                                                <div className="font-medium text-foreground">{s.nome}</div>
                                                <div className="text-xs text-muted-foreground">Mat. {s.matricula}</div>
                                            </Link>
                                        </td>
                                        <td className="px-3 text-muted-foreground">{s.empresa || "—"}</td>
                                        <td className="px-3 text-center">
                                            <div className={cn(
                                                "inline-flex items-center gap-1 font-display font-semibold",
                                                s.saldo_minutos > 0 ? "text-success" : s.saldo_minutos < 0 ? "text-error" : "text-muted-foreground"
                                            )}>
                                                {s.saldo_minutos > 0 && <ArrowUpRight className="h-3 w-3" />}
                                                {s.saldo_minutos < 0 && <ArrowDownRight className="h-3 w-3" />}
                                                {s.saldo_formatado}
                                            </div>
                                        </td>
                                        <td className="px-3 text-center text-error font-display font-medium">0h 00m</td>
                                        <td className="px-3 text-center text-muted-foreground font-display">0h 00m</td>
                                        <td className="px-5 text-center">
                                            <StatusChip status={s.status === 'crítico' ? 'inconsistente' : s.status} />
                                        </td>
                                    </tr>
                                ))}
                                {saldos.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                                            Nenhum saldo processado ainda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </AppShell>
    );
};

export default PainelGeral;
