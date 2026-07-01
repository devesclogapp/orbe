import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2, Calendar, FileText, Search, Filter, RefreshCw, AlertTriangle,
    Wallet, TrendingUp, DollarSign, ArrowRight, Layers, Receipt, Zap, CheckCircle2,
    Clock, Package, AlertCircle
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";

const KANBAN_STAGES = [
    { id: "pendente", label: "Não Faturado", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
    { id: "aguardando_faturamento", label: "Aguardando", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
    { id: "faturado", label: "Faturado / Cobrado", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
    { id: "pago", label: "Recebido (Pago)", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
];

export default function ReceitasPipeline() {
    const queryClient = useQueryClient();
    const { tenantId, loading: isTenantLoading } = useTenant();

    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterCompetencia, setFilterCompetencia] = useState(new Date().toISOString().substring(0, 7));
    const [searchTerm, setSearchTerm] = useState("");

    const { data: empresas = [], isLoading: isEmpresasLoading } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: receitas = [], isLoading: isReceitasLoading } = useQuery({
        queryKey: ["receitas-pipeline", tenantId, filterEmpresaId],
        queryFn: () => ReceitasService.getPipelinePainel(tenantId!, filterEmpresaId === "all" ? undefined : filterEmpresaId, undefined),
        enabled: !!tenantId,
    });

    const isGlobalLoading = isEmpresasLoading || isTenantLoading || isReceitasLoading;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
    };

    const filteredReceitas = useMemo(() => {
        return receitas.filter((r: any) => {
            const matchSearch = !searchTerm || String(r.empresas?.nome || "").toLowerCase().includes(searchTerm.toLowerCase());
            return matchSearch;
        });
    }, [receitas, searchTerm]);

    // Aggregate columns
    const kanbanColumns = useMemo(() => {
        const cols: Record<string, any[]> = {
            "pendente": [],
            "aguardando_faturamento": [],
            "faturado": [],
            "pago": []
        };
        filteredReceitas.forEach((r: any) => {
            const st = r.status || "pendente";
            if (cols[st]) cols[st].push(r);
        });
        return cols;
    }, [filteredReceitas]);

    const cardsByCols = (stageId: string) => kanbanColumns[stageId] || [];

    return (
        <AppShell
            title="Receitas e Contas a Receber"
            subtitle="Funil Financeiro Operacional"
        >
            {isGlobalLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Carregando painel financeiro...</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-[1700px] mx-auto pb-12 px-4 md:px-6">
                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-4 border-y border-border/60">
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={filterEmpresaId}
                                onChange={(e) => setFilterEmpresaId(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                <option value="all">Todas as Empresas</option>
                                {empresas.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                ))}
                            </select>

                            <div className="relative group w-full md:w-auto">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                <Input
                                    placeholder="Pesquisar cliente..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-10 w-full md:w-[240px] rounded-lg border-border bg-card font-medium"
                                />
                            </div>
                        </div>

                        <Button
                            variant="default"
                            size="sm"
                            className="bg-[#FD4C00] hover:bg-[#E54300] h-10 gap-2 font-semibold px-6 shadow-sm rounded-lg"
                            onClick={handleRefresh}
                        >
                            <RefreshCw className="h-4 w-4" />
                            Atualizar
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
                        {KANBAN_STAGES.map((col) => {
                            const items = cardsByCols(col.id);
                            const totalMoney = items.reduce((acc, curr) => acc + (Number(curr.valor_total) || 0), 0);

                            return (
                                <div key={col.id} className="flex flex-col bg-gray-50/50 rounded-2xl border border-border p-4 min-h-[500px]">
                                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/50">
                                        <div className="flex items-center gap-2">
                                            <col.icon className={cn("h-5 w-5", col.color.split(' ')[1])} />
                                            <h3 className="font-semibold text-gray-700">{col.label}</h3>
                                        </div>
                                        <span className="bg-gray-200 text-gray-600 text-xs font-bold py-1 px-2.5 rounded-full">
                                            {items.length}
                                        </span>
                                    </div>

                                    <div className="mb-4">
                                        <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold mb-1">Total</p>
                                        <p className={cn("text-xl font-bold font-display", col.color.split(' ')[1])}>
                                            R$ {totalMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                        </p>
                                    </div>

                                    <div className="flex flex-col gap-3 h-full overflow-y-auto pr-1">
                                        {items.length === 0 ? (
                                            <div className="text-center p-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                                                Nenhum registro.
                                            </div>
                                        ) : (
                                            items.map((r: any) => (
                                                <div key={r.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow group relative">
                                                    <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl", col.color.split(' ')[0], col.color.split(' ')[2])} />
                                                    <div className="pl-2">
                                                        <p className="text-xs font-bold text-gray-400 mb-1">
                                                            {new Date(r.created_at).toLocaleDateString("pt-BR")}
                                                        </p>
                                                        <p className="font-semibold text-gray-700 leading-tight mb-2 truncate" title={r.empresas?.nome}>
                                                            {r.empresas?.nome || "Empresa não vinculada"}
                                                        </p>
                                                        <div className="flex items-center justify-between">
                                                            <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold", r.modalidade === 'CAIXA_IMEDIATO' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700')}>
                                                                {r.modalidade?.replace('_', ' ')}
                                                            </span>
                                                            <span className="font-bold text-gray-900 text-sm">
                                                                R$ {Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                </div>
            )}
        </AppShell>
    );
}
