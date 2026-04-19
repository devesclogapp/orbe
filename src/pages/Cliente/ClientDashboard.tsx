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

const ClientDashboard = () => {
    const kpis = [
        { label: "Valor Faturado (Mês)", value: "R$ 45.820,00", icon: <TrendingUp className="text-emerald-500" />, trend: "+12%", trendUp: true },
        { label: "Aguardando Aprovação", value: "3", icon: <Clock className="text-amber-500" /> },
        { label: "Consolidados", value: "12", icon: <CheckCircle2 className="text-blue-500" /> },
    ];

    return (
        <PortalShell title="Painel de Controle">
            <div className="space-y-8">
                {/* Welcome Section */}
                <div className="bg-[#1e293b] text-white p-8 rounded-2xl relative overflow-hidden shadow-xl shadow-slate-200">
                    <div className="relative z-10">
                        <h2 className="text-2xl font-bold mb-2">Bem-vindo, Logística Global! 👋</h2>
                        <p className="text-slate-400 max-w-lg">Seu faturamento da competência **Abril/2024** já está disponível para conferência.</p>
                        <button className="mt-6 px-6 py-3 bg-[#FD4C00] hover:bg-[#FD4C00]/90 text-white rounded-xl font-bold flex items-center gap-2 transition-all">
                            Ver Detalhamento <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-[#FD4C00]/20 to-transparent pointer-events-none"></div>
                    <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-[#FD4C00]/10 rounded-full blur-3xl"></div>
                </div>

                {/* KPIs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {kpis.map((kpi, i) => (
                        <Card key={i} className="p-6 border-none shadow-sm hover:shadow-md transition-all shadow-slate-100">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-slate-50 rounded-xl">
                                    {kpi.icon}
                                </div>
                                {kpi.trend && (
                                    <span className={`text-xs font-bold px-2 py-1 rounded-full ${kpi.trendUp ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                        {kpi.trend}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{kpi.label}</p>
                            <h3 className="text-2xl font-bold text-slate-800">{kpi.value}</h3>
                        </Card>
                    ))}
                </div>

                {/* Middle Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Last Activity */}
                    <Card className="p-6 border-none shadow-sm shadow-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-slate-800">Últimos Fechamentos</h3>
                            <button className="text-xs font-bold text-[#FD4C00] flex items-center gap-1">Ver histórico <ChevronRight className="w-3 h-3" /></button>
                        </div>

                        <div className="space-y-4">
                            {[
                                { month: "Março 2024", value: "R$ 42.150,00", status: "Pago", statusColor: "bg-emerald-50 text-emerald-600" },
                                { month: "Fevereiro 2024", value: "R$ 39.800,00", status: "Pago", statusColor: "bg-emerald-50 text-emerald-600" },
                                { month: "Janeiro 2024", value: "R$ 44.200,00", status: "Pago", statusColor: "bg-emerald-50 text-emerald-600" },
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-xl border border-slate-50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-slate-400 border border-slate-100">
                                            <BarChart3 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{item.month}</p>
                                            <p className="text-xs text-slate-400">Processado em 05/{i + 1}/24</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-slate-900">{item.value}</p>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter ${item.statusColor}`}>
                                            {item.status}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>

                    {/* Pending Alerts */}
                    <Card className="p-6 border-none shadow-sm shadow-slate-100 bg-gradient-to-br from-white to-orange-50/10">
                        <h3 className="font-bold text-slate-800 mb-6">Ações Pendentes</h3>
                        <div className="space-y-4">
                            <div className="p-5 bg-white rounded-xl border border-orange-100 flex gap-4 items-start shadow-sm shadow-orange-50">
                                <div className="mt-1">
                                    <div className="w-8 h-8 bg-orange-100 text-[#FD4C00] rounded-full flex items-center justify-center">
                                        <Clock className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">Aprovação de Faturamento - Abril</p>
                                    <p className="text-xs text-slate-500 mb-3">O fechamento do mês de Abril precisa de sua validação técnica para seguir para cobrança.</p>
                                    <button className="text-xs font-bold text-[#FD4C00] underline">Revisar Agora</button>
                                </div>
                            </div>

                            <div className="p-5 bg-white rounded-xl border border-slate-100 flex gap-4 items-start">
                                <div className="mt-1">
                                    <div className="w-8 h-8 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                                        <BarChart3 className="w-4 h-4" />
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">Novo Relatório de Horas</p>
                                    <p className="text-xs text-slate-500 mb-3">Um novo consolidado de horas extras foi publicado pelo operacional.</p>
                                    <button className="text-xs font-bold text-blue-500 underline">Baixar PDF</button>
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
