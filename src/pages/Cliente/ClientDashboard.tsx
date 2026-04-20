import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    TrendingUp,
    Clock,
    CheckCircle2,
    ChevronRight,
    ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { PortalService } from "@/services/financial.service";
import { Link } from "react-router-dom";

const ClientDashboard = () => {
    const { data: stats, isLoading: loadingStats } = useQuery({
        queryKey: ["portal_stats"],
        queryFn: () => PortalService.getClientStats(),
    });

    const { data: consolidados = [], isLoading: loadingConsolid } = useQuery({
        queryKey: ["portal_consolidados"],
        queryFn: () => PortalService.getConsolidados(),
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const kpis = [
        {
            label: "Faturado (Mês Atual)",
            value: loadingStats ? "..." : formatCurrency(stats?.totalFaturadoMes || 0),
            icon: <TrendingUp className="text-success" />,
            trend: null,
            trendUp: true,
        },
        {
            label: "Aguardando Aprovação",
            value: loadingStats ? "..." : String(stats?.pendentes || 0),
            icon: <Clock className="text-warning" />,
            cta: stats?.pendentes ? "/cliente/aprovacoes" : null,
        },
        {
            label: "Consolidados",
            value: loadingStats ? "..." : String(stats?.consolidados || 0),
            icon: <CheckCircle2 className="text-info" />,
        },
    ];

    const statusColors: Record<string, string> = {
        pendente: "bg-warning-soft text-warning-strong",
        aprovado: "bg-success-soft text-success-strong",
        rejeitado: "bg-destructive-soft text-destructive-strong",
        pago: "bg-info-soft text-info-strong",
    };

    return (
        <PortalShell title="Visão Geral">
            <div className="space-y-8">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {kpis.map((kpi) => (
                        <Card key={kpi.label} className="p-6 border-none shadow-sm shadow-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                                    {kpi.label}
                                </span>
                                <div className="w-9 h-9 bg-muted/30 rounded-xl flex items-center justify-center">
                                    {kpi.icon}
                                </div>
                            </div>
                            <div className="flex items-end justify-between">
                                <h2 className="text-3xl font-black font-display text-gray-900">{kpi.value}</h2>
                                {(kpi as any).cta && (
                                    <Link to={(kpi as any).cta}>
                                        <Button size="sm" variant="outline" className="gap-1 rounded-xl text-xs font-bold">
                                            Ver <ArrowUpRight className="w-3 h-3" />
                                        </Button>
                                    </Link>
                                )}
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Histórico de Fechamentos */}
                <Card className="border-none shadow-sm shadow-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-border/50 flex items-center justify-between">
                        <h3 className="font-bold text-gray-900">Histórico de Fechamentos</h3>
                        <Link to="/cliente/relatorios">
                            <Button variant="ghost" size="sm" className="text-brand gap-1 font-bold">
                                Ver todos <ChevronRight className="w-4 h-4" />
                            </Button>
                        </Link>
                    </div>

                    {loadingConsolid ? (
                        <div className="p-12 text-center text-muted-foreground text-sm">Carregando...</div>
                    ) : consolidados.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-10" />
                            <p className="font-bold">Nenhum fechamento registrado ainda.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50">
                            {consolidados.slice(0, 6).map((c: any) => (
                                <div key={c.id} className="flex items-center justify-between px-6 py-4 hover:bg-muted/20 transition-colors">
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">
                                            Competência {c.competencia}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            Publicado em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-display font-bold text-gray-900">
                                            {formatCurrency(Number(c.valor_total || 0))}
                                        </span>
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full ${statusColors[c.status] || "bg-muted text-muted-foreground"}`}>
                                            {c.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>
        </PortalShell>
    );
};

export default ClientDashboard;
