import { useQuery } from "@tanstack/react-query";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { formatCurrency } from "@/lib/utils";
import {
    Clock,
    Package,
    Truck,
    User,
    CheckCircle2,
    Hourglass,
    AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RecentLaunchesListProps {
    date: string;
    empresaId: string;
}

export function RecentLaunchesList({ date, empresaId }: RecentLaunchesListProps) {
    const { data: launches = [], isLoading } = useQuery({
        queryKey: ["producao_recente", date, empresaId],
        queryFn: () => OperacaoProducaoService.getByDate(date, empresaId),
        enabled: !!empresaId
    });

    if (isLoading) {
        return (
            <div className="p-8 text-center text-muted-foreground animate-pulse">
                Carregando lançamentos...
            </div>
        );
    }

    if (launches.length === 0) {
        return (
            <div className="p-8 text-center text-muted-foreground border-2 border-dashed border-slate-100 rounded-2xl">
                Nenhum lançamento realizado hoje.
            </div>
        );
    }

    return (
        <div className="overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 text-[10px] uppercase tracking-widest text-muted-foreground font-bold border-y border-slate-100">
                            <th className="px-4 py-3">Horário</th>
                            <th className="px-4 py-3">Operação</th>
                            <th className="px-4 py-3">Detalhes</th>
                            <th className="px-4 py-3 text-right">Qtd</th>
                            <th className="px-4 py-3 text-right">Valor</th>
                            <th className="px-4 py-3 text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {launches.map((op: any) => {
                            const status = op.status?.toLowerCase();
                            const isAwaiting = status === 'aguardando_validacao' || status === 'pendente';
                            const isOk = status === 'processado' || status === 'ok' || status === 'validado';
                            const isAlert = status === 'com_alerta' || status === 'bloqueado';

                            return (
                                <tr key={op.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-4">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3 w-3 text-slate-400" />
                                            <span className="text-xs font-medium">
                                                {new Date(op.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="space-y-0.5">
                                            <div className="text-xs font-bold text-slate-900 line-clamp-1">
                                                {op.fornecedores?.nome || op.fornecedor_label || "Fornecedor s/ nome"}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Package className="h-2.5 w-2.5" />
                                                {op.tipos_servico_operacional?.nome || op.tipo_servico_label || "Serviço"}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-[10px] text-muted-foreground capitalize">
                                        <div className="flex flex-col gap-0.5">
                                            <span className="flex items-center gap-1">
                                                <Truck className="h-2.5 w-2.5" />
                                                {op.transportadoras_clientes?.nome || op.transportadora_label || "-"}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <User className="h-2.5 w-2.5" />
                                                Manual: {op.quantidade_colaboradores || 1}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="text-xs font-bold text-slate-900">
                                            {op.quantidade?.toLocaleString('pt-BR')}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right">
                                        <span className="text-xs font-black text-primary">
                                            {formatCurrency(op.valor_total || 0)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4">
                                        <div className="flex justify-center">
                                            {isOk ? (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded uppercase">
                                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                                    OK
                                                </div>
                                            ) : isAlert ? (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded uppercase">
                                                    <AlertCircle className="h-2.5 w-2.5" />
                                                    Alerta
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase leading-none text-center max-w-[80px]">
                                                    <Hourglass className="h-2.5 w-2.5 shrink-0" />
                                                    Aguardando RH
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="bg-slate-50/50 p-3 flex justify-between items-center border-t border-slate-100">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Total do Dia</span>
                <span className="text-sm font-black text-slate-900 tabular-nums">
                    {formatCurrency(launches.reduce((acc: number, op: any) => acc + (op.valor_total || 0), 0))}
                </span>
            </div>
        </div>
    );
}
