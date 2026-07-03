import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2, Calendar, FileText, Search, Filter, RefreshCw, AlertTriangle,
    Wallet, TrendingUp, DollarSign, ArrowRight, Layers, Receipt, Zap, CheckCircle2,
    Clock, Package, AlertCircle, CreditCard, FileSpreadsheet, Lock, Plus
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { ReceitasService } from "@/services/receitas/receitas.service";
import { useTenant } from "@/contexts/TenantContext";
import { cn } from "@/lib/utils";
import { ModalReceitaOperacional } from "./components/ModalReceitaOperacional";
import { useToast } from "@/components/ui/use-toast";

const KANBAN_CONFIGS = {
    'CAIXA_IMEDIATO': [
        { id: "pendente_recebimento", label: "Recebimento a Confirmar", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
    'DUPLICATA': [
        { id: "pendente_cobranca", label: "Pronto para Cobrança", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
        { id: "cobranca_enviada", label: "Cobrança Enviada", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ],
    'FATURAMENTO_MENSAL': [
        { id: "aguardando_fechamento", label: "Competência Aberta", color: "bg-gray-100 text-gray-500 border-gray-200", icon: Clock },
        { id: "pendente_cobranca", label: "Pronto para Cobrança", color: "bg-blue-50 text-blue-600 border-blue-200", icon: Wallet },
        { id: "cobranca_enviada", label: "Cobrança Enviada", color: "bg-orange-50 text-orange-600 border-orange-200", icon: Receipt },
        { id: "recebido", label: "Recebido", color: "bg-emerald-50 text-emerald-600 border-emerald-200", icon: CheckCircle2 },
    ]
};

export default function ReceitasPipeline() {
    const queryClient = useQueryClient();
    const { tenantId, loading: isTenantLoading } = useTenant();
    const { toast } = useToast();

    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<'CAIXA_IMEDIATO' | 'DUPLICATA' | 'FATURAMENTO_MENSAL'>('DUPLICATA');
    const [selectedReceita, setSelectedReceita] = useState<any>(null);

    const { data: empresas = [], isLoading: isEmpresasLoading } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: receitas = [], isLoading: isReceitasLoading, error: errorReceitas } = useQuery({
        queryKey: ["receitas-pipeline", tenantId, filterEmpresaId],
        queryFn: () => ReceitasService.getPipelinePainel(tenantId!, filterEmpresaId === "all" ? undefined : filterEmpresaId, undefined),
        enabled: !!tenantId,
    });

    const isGlobalLoading = isEmpresasLoading || isTenantLoading || isReceitasLoading;

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: ["receitas-pipeline"] });
    };

    const handleNovaReceita = () => {
        toast({ title: "Aviso", description: "Criação avulsa de receitas será disponibilizada em breve.", variant: "default" });
    }

    const filteredReceitas = useMemo(() => {
        return receitas.filter((r: any) => {
            const matchSearch = !searchTerm || String(r.empresas?.nome || "").toLowerCase().includes(searchTerm.toLowerCase());
            const matchModalidade = r.modalidade === activeTab;
            return matchSearch && matchModalidade;
        });
    }, [receitas, searchTerm, activeTab]);

    const kpis = useMemo(() => {
        let count = 0;
        let total = 0;
        let recebido = 0;
        let aberto = 0;
        let vencidas = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        receitas.forEach((r: any) => {
            count++;
            const valor = Number(r.valor_total || 0);
            total += valor;
            if (r.status === 'recebido') {
                recebido += valor;
            } else {
                aberto += valor;
                if (r.vencimento) {
                    const [ano, mes, dia] = r.vencimento.split('-');
                    const vDate = new Date(Number(ano), Number(mes) - 1, Number(dia));
                    if (vDate.getTime() < today.getTime()) {
                        vencidas += valor;
                    }
                }
            }
        });

        return { count, total, recebido, aberto, vencidas };
    }, [receitas]);

    const currentKanbanStages = KANBAN_CONFIGS[activeTab];
    const kanbanColumns = useMemo(() => {
        const cols: Record<string, any[]> = {};
        currentKanbanStages.forEach(col => cols[col.id] = []);

        filteredReceitas.forEach((r: any) => {
            const st = r.status || currentKanbanStages[0].id;
            if (cols[st]) {
                cols[st].push(r);
            } else if (cols[currentKanbanStages[0].id]) {
                cols[currentKanbanStages[0].id].push(r);
            }
        });
        return cols;
    }, [filteredReceitas, currentKanbanStages]);

    const cardsByCols = (stageId: string) => kanbanColumns[stageId] || [];

    return (
        <AppShell
            title="Receitas e Contas a Receber"
            subtitle="Funil Financeiro Operacional"
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleRefresh} className="h-9">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Atualizar
                    </Button>
                    <Button variant="default" size="sm" onClick={handleNovaReceita} className="bg-primary hover:bg-primary/90 h-9">
                        <Plus className="h-4 w-4 mr-2" />
                        Nova Receita
                    </Button>
                </div>
            }
        >
            {isGlobalLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Carregando painel financeiro...</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-[1700px] mx-auto pb-12 px-4 md:px-6">

                    {errorReceitas && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Erro do Supabase: </strong>
                            <span className="block sm:inline">{errorReceitas instanceof Error ? errorReceitas.message : JSON.stringify(errorReceitas)}</span>
                        </div>
                    )}

                    {/* KPI Headers */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Receitas</span>
                            <span className="text-2xl font-black text-gray-800">{kpis.count}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Valor Total</span>
                            <span className="text-2xl font-black text-blue-600">R$ {kpis.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Recebido</span>
                            <span className="text-2xl font-black text-emerald-600">R$ {kpis.recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col">
                            <span className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">Em Aberto</span>
                            <span className="text-2xl font-black text-orange-500">R$ {kpis.aberto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-transparent shadow-sm flex flex-col bg-red-50 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2"><AlertCircle className="h-4 w-4 text-red-300" /></div>
                            <span className="text-red-700 text-xs font-bold uppercase tracking-wider mb-1">Vencidas</span>
                            <span className="text-2xl font-black text-red-600">R$ {kpis.vencidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 py-3 border-y border-border/60">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('CAIXA_IMEDIATO')}
                                    className={cn("h-9 px-4 gap-2 text-sm font-medium", activeTab === 'CAIXA_IMEDIATO' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700')}
                                >
                                    <Zap className="h-4 w-4" /> Caixa Imediato
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('DUPLICATA')}
                                    className={cn("h-9 px-4 gap-2 text-sm font-medium", activeTab === 'DUPLICATA' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700')}
                                >
                                    <FileText className="h-4 w-4" /> Duplicata
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setActiveTab('FATURAMENTO_MENSAL')}
                                    className={cn("h-9 px-4 gap-2 text-sm font-medium", activeTab === 'FATURAMENTO_MENSAL' ? 'bg-white shadow-sm text-gray-900 border border-gray-200' : 'text-gray-500 hover:text-gray-700')}
                                >
                                    <Calendar className="h-4 w-4" /> Faturamento Mensal
                                </Button>
                            </div>

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
                    </div>

                    <div className={cn("grid gap-6 items-start", currentKanbanStages.length <= 2 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2' : currentKanbanStages.length === 3 ? 'grid-cols-1 md:grid-cols-3 xl:grid-cols-3' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4')}>
                        {currentKanbanStages.map((col) => {
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
                                            items.map((r: any) => {
                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                let isVencido = false;
                                                let isVenceHoje = false;
                                                let isVenceBreve = false;

                                                if (r.vencimento && r.status !== 'recebido') {
                                                    const [ano, mes, dia] = r.vencimento.split('-');
                                                    const vDate = new Date(Number(ano), Number(mes) - 1, Number(dia));
                                                    const diffDays = Math.ceil((vDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                                                    if (diffDays < 0) isVencido = true;
                                                    else if (diffDays === 0) isVenceHoje = true;
                                                    else if (diffDays <= 3) isVenceBreve = true;
                                                }

                                                let indicatorColor = 'bg-gray-300';
                                                if (r.status === 'recebido') indicatorColor = 'bg-emerald-500';
                                                else if (isVencido) indicatorColor = 'bg-red-500';
                                                else if (isVenceHoje) indicatorColor = 'bg-amber-400';
                                                else if (isVenceBreve) indicatorColor = 'bg-orange-500';

                                                const itens = r.receitas_operacionais_itens || [];
                                                const itemCount = itens.length;
                                                const itemOps = itens[0]?.operacoes_producao;

                                                let servicoNome = itemCount > 1
                                                    ? `Operação Consolidada (${itemCount} lançamentos)`
                                                    : (itemOps?.servicos?.nome || 'Operação Avulsa');

                                                const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
                                                let compStr = "Sem Competência";
                                                if (r.competencia) {
                                                    const ano = r.competencia.slice(0, 4);
                                                    const mes = r.competencia.slice(5, 7);
                                                    compStr = `${meses[parseInt(mes) - 1] || mes}/${ano}`;
                                                }

                                                let vencStr = "Não definido";
                                                if (r.modalidade === 'CAIXA_IMEDIATO') {
                                                    vencStr = "Recebimento imediato";
                                                } else if (r.vencimento) {
                                                    vencStr = new Date(r.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                                                }
                                                return (
                                                    <div
                                                        key={r.id}
                                                        onClick={() => setSelectedReceita(r)}
                                                        className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 hover:shadow-md transition-all group relative cursor-pointer"
                                                    >
                                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 rounded-l-xl", indicatorColor)} title={
                                                            r.status === 'recebido' ? "Recebido" : isVencido ? "Vencido" : isVenceHoje ? "Vence hoje" : isVenceBreve ? "Vence em breve" : "No prazo"
                                                        } />
                                                        <div className="pl-2 flex flex-col gap-2">
                                                            <div>
                                                                <p className="font-bold text-gray-800 leading-tight truncate text-sm" title={r.empresas?.nome}>
                                                                    {r.empresas?.nome || "Empresa não vinculada"}
                                                                </p>
                                                            </div>

                                                            <div className="flex flex-col text-sm text-gray-600 bg-gray-50 border border-gray-100 p-2 rounded-lg">
                                                                <p className="font-semibold text-gray-800">{servicoNome.toUpperCase()}</p>
                                                            </div>

                                                            <div className="grid grid-cols-2 text-xs text-gray-500 gap-y-1">
                                                                <div>
                                                                    <span className="font-semibold block text-gray-400">Competência</span>
                                                                    <span>{compStr}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="font-semibold block text-gray-400">Vencimento</span>
                                                                    <span className={cn("font-medium", isVencido ? "text-red-600" : isVenceHoje ? "text-amber-600" : "")}>{vencStr}</span>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center justify-between mt-1 pt-3 border-t border-gray-100">
                                                                <span className={cn("px-2 py-0.5 rounded text-[10px] uppercase font-bold",
                                                                    r.modalidade === 'CAIXA_IMEDIATO' ? 'bg-purple-100 text-purple-700' :
                                                                        r.modalidade === 'DUPLICATA' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                                                                )}>
                                                                    {r.modalidade === 'FATURAMENTO_MENSAL' ? 'MENSAL' : r.modalidade?.replace('_', ' ')}
                                                                </span>
                                                                <span className="font-black text-gray-800 text-[15px]">
                                                                    R$ {Number(r.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {selectedReceita && (
                        <ModalReceitaOperacional
                            isOpen={!!selectedReceita}
                            receita={selectedReceita}
                            onClose={() => setSelectedReceita(null)}
                            onSuccess={handleRefresh}
                        />
                    )}
                </div>
            )}
        </AppShell>
    );
}
