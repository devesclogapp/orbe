import { useState } from "react";
import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    CheckCircle2,
    XCircle,
    Clock,
    Info,
    ChevronRight,
    MessageSquare,
    History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const ClientApprovals = () => {
    const [approvals, setApprovals] = useState([
        {
            id: "APP-01",
            title: "Fechamento Operacional - Abril",
            description: "Resumo total faturado referente ao período de 01/04 a 15/04.",
            value: "R$ 45.820,00",
            status: "pendente",
            date: "19/04/2024"
        }
    ]);

    const handleAction = (id: string, action: 'approve' | 'reject') => {
        if (action === 'approve') {
            toast.success("Faturamento aprovado com sucesso!");
        } else {
            toast.error("Faturamento reprovado. Por favor, adicione um comentário.");
        }
        setApprovals(prev => prev.filter(a => a.id !== id));
    };

    return (
        <PortalShell title="Aprovações Pendentes">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Items */}
                <div className="lg:col-span-2 space-y-6">
                    {approvals.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                            <CheckCircle2 className="w-16 h-16 mb-4 opacity-10" />
                            <p className="font-bold">Nada para aprovar no momento!</p>
                            <p className="text-sm">Você está em dia com suas validações.</p>
                        </div>
                    ) : (
                        approvals.map((item) => (
                            <Card key={item.id} className="p-8 border-none shadow-sm shadow-slate-100 overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4">
                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-none uppercase tracking-tighter text-[10px] font-bold">
                                        <Clock className="w-3 h-3 mr-1" /> Aguardando Você
                                    </Badge>
                                </div>

                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div className="space-y-2">
                                        <h3 className="text-xl font-bold text-slate-800">{item.title}</h3>
                                        <p className="text-slate-500 text-sm max-w-sm">{item.description}</p>
                                        <div className="flex items-center gap-4 pt-2">
                                            <div className="text-xs text-slate-400 flex items-center gap-1 font-medium">
                                                <History className="w-3 h-3" /> Publicado em {item.date}
                                            </div>
                                            <button className="text-xs font-bold text-blue-500 flex items-center gap-1">
                                                Ver detalhes técnicos <ChevronRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 p-6 rounded-2xl text-center min-w-[180px] border border-slate-100">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block mb-1">Valor Total</span>
                                        <span className="text-2xl font-black text-slate-900">{item.value}</span>
                                    </div>
                                </div>

                                <div className="mt-8 pt-8 border-t border-slate-100 flex flex-wrap gap-3">
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8 rounded-xl"
                                        onClick={() => handleAction(item.id, 'approve')}
                                    >
                                        <CheckCircle2 className="w-4 h-4" /> Aprovar Faturamento
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="text-red-600 border-red-100 hover:bg-red-50 gap-2 px-8 rounded-xl"
                                        onClick={() => handleAction(item.id, 'reject')}
                                    >
                                        <XCircle className="w-4 h-4" /> Solicitar Revisão
                                    </Button>
                                    <Button variant="ghost" className="text-slate-400 gap-2 ml-auto rounded-xl">
                                        <MessageSquare className="w-4 h-4" /> Comentar
                                    </Button>
                                </div>
                            </Card>
                        ))
                    )}
                </div>

                {/* Right Column: Info & History */}
                <div className="space-y-6">
                    <Card className="p-6 border-none shadow-sm shadow-slate-100 bg-[#FD4C00] text-white">
                        <h4 className="font-bold mb-3 flex items-center gap-2">
                            <Info className="w-5 h-5" /> Importante
                        </h4>
                        <p className="text-sm text-white/80 leading-relaxed">
                            Ao clicar em **Aprovar**, você valida que todos os serviços prestados estão em conformidade e libera o sistema para gerar a cobrança bancária oficial.
                        </p>
                    </Card>

                    <Card className="p-6 border-none shadow-sm shadow-slate-100">
                        <h4 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <History className="w-5 h-5 text-slate-400" /> Histórico Recente
                        </h4>
                        <div className="space-y-6">
                            {[1, 2].map((i) => (
                                <div key={i} className="flex gap-4 relative">
                                    {i === 1 && <div className="absolute left-[7px] top-4 bottom-[-24px] w-0.5 bg-slate-100"></div>}
                                    <div className={`w-4 h-4 rounded-full mt-1.5 shrink-0 z-10 ${i === 1 ? 'bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.1)]' : 'bg-emerald-500'}`}></div>
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">Fechamento Março/2024</p>
                                        <p className="text-[10px] text-slate-400">Aprovado em 05/04/2024 por João Silva</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </PortalShell>
    );
};

export default ClientApprovals;
