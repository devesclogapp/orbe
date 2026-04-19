import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    BarChart3,
    TrendingUp,
    Clock,
    CheckCircle2,
    ChevronRight,
    ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";

const ClientDashboard = () => {
    const kpis = [
        { label: "Valor Faturado (Mês)", value: "R$ 45.820,00", icon: <TrendingUp className="text-success" />, trend: "+12%", trendUp: true },
        { label: "Aguardando Aprovação", value: "3", icon: <Clock className="text-warning" /> },
        { label: "Consolidados", value: "12", icon: <CheckCircle2 className="text-info" /> },
    ];

    return (
        <PortalShell title="Painel de Controle">
            <div className="space-y-8">
                {/* Welcome Section */}
                <div className="bg-gray-900 text-white p-8 rounded-2xl relative overflow-hidden shadow-xl shadow-gray-200">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2">Bem-vindo, Logística Global! 👋</h2>
                        <p className="text-gray-400 max-w-lg">Seu faturamento da competência **Abril/2024** já está disponível para conferência.</p>
                        <Button className="mt-6 bg-brand hover:bg-brand/90 text-white h-12 px-8 rounded-xl font-bold flex items-center gap-2 transition-all">
                            Ver Detalhamento <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-primary/20 to-transparent pointer-events-none"></div>
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
                </div>

                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {kpis.map((kpi, i) => (
                        <Card key={i} className="p-6 border-none shadow-sm hover:shadow-md transition-all shadow-gray-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-gray-50 rounded-xl">
                                    {kpi.icon}
                                </div>
                                {kpi.trend && (
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpi.trendUp ? 'bg-success/10 text-success-strong' : 'bg-destructive/10 text-destructive-strong'}`}>
                                        {kpi.trend}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">{kpi.label}</p>
                            <h3 className="text-2xl font-bold text-gray-900">{kpi.value}</h3>
                        </Card>
                    ))}
                </div>

                {/* Middle Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Last Activity */}
                    <Card className="p-6 border-none shadow-sm shadow-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-900">Últimos Fechamentos</h3>
                            <button className="text-xs font-bold text-brand flex items-center gap-1">Ver histórico <ChevronRight className="w-3 h-3" /></button>
                        </div>

                        <div className="space-y-4">
                            {[
                                { month: "Março 2024", value: "R$ 42.150,00", status: "Pago", statusColor: "bg-success/10 text-success-strong" },
                                { month: "Fevereiro 2024", value: "R$ 39.800,00", status: "Pago", statusColor: "bg-success/10 text-success-strong" },
                                { month: "Janeiro 2024", value: "R$ 44.200,00", status: "Pago", statusColor: "bg-success/10 text-success-strong" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-gray-50/50 rounded-xl border border-gray-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-gray-400 border border-gray-100">
                                            <BarChart3 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">{item.month}</p>
                                            <p className="text-xs text-muted-foreground">Processado em 05/{i + 1}/24</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-gray-900">{item.value}</p>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${item.statusColor}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Pending Alerts */}
                    <Card className="p-6 border-none shadow-sm shadow-gray-100 bg-gradient-to-br from-white to-primary/5">
                        <h3 className="font-bold text-gray-900 mb-6">Ações Pendentes</h3>
                        <div className="space-y-4">
                            <div className="p-5 bg-white rounded-xl border border-primary/10 flex gap-4 items-start shadow-sm shadow-gray-50">
                                <div className="mt-1">
                                    <div className="w-8 h-8 bg-primary/10 text-brand rounded-full flex items-center justify-center">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900">Aprovação de Faturamento - Abril</p>
                                    <p className="text-xs text-muted-foreground mb-3">O fechamento do mês de Abril precisa de sua validação técnica para seguir para cobrança.</p>
                                    <button className="text-xs font-bold text-brand underline">Revisar Agora</button>
                                </div>
                            </div>

                            <div className="p-5 bg-white rounded-xl border border-gray-100 flex gap-4 items-start">
                                <div className="mt-1">
                                    <div className="w-8 h-8 bg-info/10 text-info rounded-full flex items-center justify-center">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-gray-900">Novo Relatório de Horas</p>
                                    <p className="text-xs text-muted-foreground mb-3">Um novo consolidado de horas extras foi publicado pelo operacional.</p>
                                    <button className="text-xs font-bold text-info underline">Baixar PDF</button>
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        </PortalShell>
    );
};

export default ClientDashboard;
