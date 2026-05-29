import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
    Rocket,
    Clock,
    CheckCircle2,
    AlertTriangle,
    ArrowRight,
    FileText,
    Users,
    Calendar,
    Layers,
    Search,
    Filter,
    Settings,
    Activity,
    DollarSign,
    AlertCircle,
    Timer,
    RefreshCw,
    PlayCircle,
    ChevronRight,
    Building2,
    History,
    RotateCcw,
    ChevronDown,
    CalendarDays,
    GitBranch,
    ArrowLeft,
    CornerUpLeft
} from "lucide-react";

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOperationalPulse } from "@/hooks/useOperationalPulse";
import {
    EmpresaService,
    OperacaoService,
    CustoExtraOperacionalService,
    PontoService,
    ServicosExtrasOperacionaisService,
    LoteFechamentoDiaristaService
} from "@/services/base.service";
import { cn } from "@/lib/utils";

// Mock/Fallback para serviços que podem não estar no base.service ainda ou precisam de tipos específicos
// De acordo com as regras, não alteramos os services, apenas usamos o que existe.

function PipelineTable({
    items,
    navigate,
    filterCompetencia,
    currentPage,
    itemsPerPage,
    onPageChange
}: {
    items: any[],
    navigate: any,
    filterCompetencia: string,
    currentPage: number,
    itemsPerPage: number,
    onPageChange: (page: number) => void
}) {
    const totalPages = Math.ceil(items.length / itemsPerPage);

    const paginatedItems = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return items.slice(start, start + itemsPerPage);
    }, [items, currentPage, itemsPerPage]);

    return (
        <div className="bg-white rounded-xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-muted bg-muted/20">
                            <th className="h-12 px-6 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Tipo</th>
                            <th className="h-12 px-6 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Lote / Referência</th>
                            <th className="h-12 px-6 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Empresa / Operação</th>
                            <th className="h-12 px-6 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Competência</th>
                            <th className="h-12 px-6 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Etapa Atual</th>
                            <th className="h-12 px-6 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Responsável</th>
                            <th className="h-12 px-6 text-left font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Prazo</th>
                            <th className="h-12 px-6 text-right font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Valor / Horas</th>
                            <th className="h-12 px-6 text-center font-bold text-muted-foreground uppercase tracking-wider text-[10px]">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedItems.length > 0 ? (
                            paginatedItems.map((item) => (
                                <tr key={item.id} className="border-b border-border hover:bg-muted/10 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "p-2 rounded-lg",
                                                item.tipo === "Operação" ? "bg-blue-50 text-blue-600" :
                                                    item.tipo === "Diaristas" ? "bg-emerald-50 text-emerald-600" :
                                                        item.tipo === "Pontos" ? "bg-amber-50 text-amber-600" :
                                                            item.tipo === "Custo Extra" ? "bg-orange-50 text-orange-600" :
                                                                "bg-purple-50 text-purple-600"
                                            )}>
                                                {item.tipo === "Operação" ? <Layers size={16} /> :
                                                    item.tipo === "Diaristas" ? <Users size={16} /> :
                                                        item.tipo === "Pontos" ? <Clock size={16} /> :
                                                            item.tipo === "Custo Extra" ? <DollarSign size={16} /> :
                                                                <Activity size={16} />}
                                            </div>
                                            <span className="font-bold text-foreground">{item.tipo}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground">L#{item.referencia}</span>
                                            <span className="text-[11px] text-muted-foreground">{item.tipo} - {item.operacao.split(' ')[0]}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground uppercase text-xs">{item.empresa}</span>
                                            <span className="text-[11px] text-muted-foreground">{item.operacao}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="font-medium text-foreground">{item.competencia.replace('-', '/')}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <Badge
                                                className={cn(
                                                    "text-[10px] uppercase font-bold border-none shadow-none px-2",
                                                    item.etapa === "Recebido" ? "bg-blue-50 text-blue-600" :
                                                        item.etapa === "Financeiro" ? "bg-purple-50 text-purple-600" :
                                                            item.etapa === "Concluído" ? "bg-emerald-50 text-emerald-600" :
                                                                item.etapa === "Em análise RH" ? "bg-amber-50 text-amber-600" :
                                                                    item.etapa === "Aprovado RH" ? "bg-emerald-50 text-emerald-600" :
                                                                        "bg-blue-50 text-blue-600"
                                                )}
                                            >
                                                <div className="flex items-center gap-1.5">
                                                    {item.etapa === "Recebido" && <Rocket size={12} />}
                                                    {item.etapa === "Financeiro" && <DollarSign size={12} />}
                                                    {item.etapa === "Concluído" && <CheckCircle2 size={12} />}
                                                    {item.etapa === "Em análise RH" && <Timer size={12} />}
                                                    {item.etapa}
                                                </div>
                                            </Badge>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-foreground text-xs">{item.responsavel}</span>
                                            <span className="text-[11px] text-muted-foreground uppercase font-bold">
                                                {item.etapa.includes("RH") ? "RH" : item.etapa.includes("Financeiro") ? "Financeiro" : "Encarregado"}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={cn(
                                            "font-bold text-xs",
                                            item.critico ? "text-destructive" : "text-foreground"
                                        )}>{item.prazo}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-bold text-foreground">R$ {item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                                            <span className="text-[11px] text-muted-foreground">2 colaboradores</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-2">
                                            <Button variant="outline" size="sm" className="h-8 gap-2 border-border text-xs font-bold" onClick={() => navigate(item.rota)}>
                                                <Search size={14} className="text-muted-foreground" />
                                                Visualizar
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                                                <Settings size={14} />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">
                                    <Activity className="h-8 w-8 mx-auto mb-3 opacity-20" />
                                    <p>Nenhum registro encontrado no pipeline.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Paginação Real */}
            <div className="px-6 py-4 flex items-center justify-between border-t border-border bg-gray-50/50">
                <span className="text-xs text-muted-foreground">Mostrando {items.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0} a {Math.min(currentPage * itemsPerPage, items.length)} de {items.length} registros</span>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === 1}
                        onClick={() => onPageChange(currentPage - 1)}
                    >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                    </Button>
                    <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => (
                            <Button
                                key={i}
                                variant={currentPage === i + 1 ? "default" : "ghost"}
                                size="sm"
                                className="h-8 w-8 p-0 text-xs font-bold"
                                onClick={() => onPageChange(i + 1)}
                            >
                                {i + 1}
                            </Button>
                        ))}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage >= totalPages}
                        onClick={() => onPageChange(currentPage + 1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function PipelineOperacional() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { items, stages, totalAttention, isLoading: loadingPulse, refetch } = useOperationalPulse();

    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterCompetencia, setFilterCompetencia] = useState(new Date().toISOString().substring(0, 7));
    const [filterTipo, setFilterTipo] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("visao-geral");
    const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: operacoes = [] } = useQuery({
        queryKey: ["operacoes-pipeline", filterEmpresaId],
        queryFn: () => OperacaoService.getAllPainel(filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: diaristas = [] } = useQuery({
        queryKey: ["diaristas-pipeline", filterEmpresaId],
        queryFn: () => LoteFechamentoDiaristaService.getByEmpresaParaFinanceiro(filterEmpresaId === "all" ? undefined : filterEmpresaId),
        enabled: true
    });

    const { data: custos = [] } = useQuery({
        queryKey: ["custos-pipeline", filterEmpresaId],
        queryFn: () => CustoExtraOperacionalService.getAll(filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: pontos = [] } = useQuery({
        queryKey: ["pontos-pipeline", filterEmpresaId, filterCompetencia],
        queryFn: () => PontoService.getByMonth(filterCompetencia, filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: servicosExtras = [] } = useQuery({
        queryKey: ["servicos-extras-pipeline", filterEmpresaId],
        queryFn: () => ServicosExtrasOperacionaisService.getWithEmpresas(filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const unifiedItems = useMemo(() => {
        const result: any[] = [];

        (operacoes || []).forEach((op: any) => {
            const etapa = op.status === "pendente" ? "Recebido" : "Processado";
            const stageId = etapa === "Recebido" ? "recebido" : "concluido";

            result.push({
                id: op.id,
                tipo: "Operação",
                referencia: op.lote_id || op.id.substring(0, 8),
                empresa: op.empresa?.nome || "Unidade",
                operacao: op.tipo_servico?.nome || "Operação por Volume",
                competencia: op.data_operacao ? op.data_operacao.substring(0, 7) : filterCompetencia,
                etapa: etapa,
                stageId: stageId,
                valor: op.valor_total || 0,
                rota: "/operacional/operacoes",
                created_at: op.created_at,
                atencao: op.status === "bloqueado" || op.status === "com_alerta",
                critico: op.status === "inconsistente",
                responsavel: "João Victor",
                prazo: "24/05/2026"
            });
        });

        (diaristas || []).forEach((d: any) => {
            const etapa = d.status === "VALIDADO_RH" ? "Financeiro" : "Em análise RH";
            const stageId = d.status === "VALIDADO_RH" ? "financeiro" : "analise-rh";

            result.push({
                id: d.id,
                tipo: "Diaristas",
                referencia: `Lote ${d.id.substring(0, 6)}`,
                empresa: d.empresa?.nome || "Unidade",
                operacao: "Diárias Operacionais",
                competencia: d.periodo_inicio ? d.periodo_inicio.substring(0, 7) : filterCompetencia,
                etapa: etapa,
                stageId: stageId,
                valor: d.valor_total || 0,
                rota: "/rh/diaristas",
                created_at: d.created_at,
                atencao: d.status === "AGUARDANDO_VALIDACAO_RH",
                critico: false,
                responsavel: "Maria Eduarda",
                prazo: "23/05/2026"
            });
        });

        (custos || []).forEach((c: any) => {
            result.push({
                id: c.id,
                tipo: "Custo Extra",
                referencia: `Custo ${c.id.substring(0, 6)}`,
                empresa: c.empresa?.nome || "Unidade",
                operacao: c.descricao || "Custo Extra",
                competencia: c.data_competencia ? c.data_competencia.substring(0, 7) : filterCompetencia,
                etapa: c.status || c.status_pagamento || "Financeiro",
                stageId: "financeiro",
                valor: c.valor || c.total || 0,
                rota: "/financeiro/custos-extras",
                created_at: c.created_at,
                responsavel: "Carlos Lima",
                prazo: "22/05/2026"
            });
        });

        (pontos || []).forEach((p: any) => {
            result.push({
                id: p.id,
                tipo: "Pontos",
                referencia: `Ponto ${p.id.substring(0, 6)}`,
                empresa: p.colaboradores?.empresas?.nome || "Unidade",
                operacao: `Ponto: ${p.colaboradores?.nome || 'Colaborador'}`,
                competencia: p.competencia || filterCompetencia,
                etapa: p.status_processamento === "PROCESSADO" ? "Processado" : "Em análise RH",
                stageId: p.status_processamento === "PROCESSADO" ? "aprovado-rh" : "analise-rh",
                valor: 0,
                rota: "/rh/pontos",
                created_at: p.created_at || p.data,
                atencao: p.status_processamento === "INCONSISTENTE",
                critico: p.status_processamento === "ERRO",
                responsavel: "João Victor",
                prazo: "24/05/2026"
            });
        });

        (servicosExtras || []).forEach((s: any) => {
            result.push({
                id: s.id,
                tipo: "Serviço Extra",
                referencia: `Serviço ${s.id.substring(0, 6)}`,
                empresa: s.empresas?.nome || "Unidade",
                operacao: s.descricao || "Serviço Extra",
                competencia: s.data ? s.data.substring(0, 7) : filterCompetencia,
                etapa: s.status || "Recebido",
                stageId: "recebido",
                valor: s.valor || s.total || 0,
                rota: "/operacional/servicos-extras",
                created_at: s.created_at || s.data,
                responsavel: "Juliana Costa",
                prazo: "21/05/2026"
            });
        });

        return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }, [operacoes, diaristas, custos, pontos, servicosExtras, filterCompetencia]);

    const stats = useMemo(() => {
        const unfiltered = unifiedItems.filter(item => {
            const matchesSearch = !searchTerm ||
                item.referencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.empresa.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesTipo = filterTipo === "all" ||
                (filterTipo === "diaristas" && item.tipo === "Diaristas") ||
                (filterTipo === "operacoes" && item.tipo === "Operação") ||
                (filterTipo === "pontos" && item.tipo === "Pontos") ||
                (filterTipo === "custos" && item.tipo === "Custo Extra") ||
                (filterTipo === "servicos" && item.tipo === "Serviço Extra");

            const matchesCompetencia = !filterCompetencia || item.competencia === filterCompetencia;

            return matchesSearch && matchesTipo && matchesCompetencia;
        });

        const counts: Record<string, number> = {
            recebido: 0,
            "analise-rh": 0,
            "aprovado-rh": 0,
            financeiro: 0,
            "pronto-cnab": 0,
            remetido: 0,
            concluido: 0
        };

        let totalValue = 0;
        let totalHours = 0;
        let totalAttentionCount = 0;
        let totalDelayedCount = 0;

        unfiltered.forEach(item => {
            if (counts[item.stageId] !== undefined) counts[item.stageId]++;
            totalValue += item.valor || 0;
            if (item.tipo === "Pontos") totalHours += 8;
            if (item.atencao || item.critico) totalAttentionCount++;

            if (item.prazo && item.stageId !== "concluido") {
                const [day, month, year] = item.prazo.split('/');
                const deadlineDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                if (deadlineDate < new Date()) totalDelayedCount++;
            }
        });

        return {
            counts,
            totalValue,
            totalItems: unfiltered.length,
            totalHours,
            totalAttentionCount,
            totalDelayedCount,
            unfiltered
        };
    }, [unifiedItems, searchTerm, filterTipo, filterCompetencia]);

    const pipelineStages = useMemo(() => [
        { id: "recebido", label: "Recebido", count: stats.counts.recebido, tone: "blue", icon: Rocket, description: "Aguardando triagem" },
        { id: "analise-rh", label: "Em análise RH", count: stats.counts["analise-rh"], tone: "amber", icon: Timer, description: "Em validação e conferência" },
        { id: "aprovado-rh", label: "Aprovado RH", count: stats.counts["aprovado-rh"], tone: "emerald", icon: CheckCircle2, description: "Aguardando financeiro" },
        { id: "financeiro", label: "Financeiro", count: stats.counts.financeiro, tone: "purple", icon: DollarSign, description: "Em análise financeira" },
        { id: "pronto-cnab", label: "Pronto para CNAB", count: stats.counts["pronto-cnab"], tone: "blue", icon: FileText, description: "Aguardando remessa" },
        { id: "remetido", label: "Remetido", count: stats.counts.remetido, tone: "zinc", icon: Rocket, description: "Aguardando retorno" },
        { id: "concluido", label: "Concluído", count: stats.counts.concluido, tone: "emerald", icon: CheckCircle2, description: "Processados e finalizados" },
    ], [stats.counts]);

    const filteredItems = useMemo(() => {
        return unifiedItems.filter(item => {
            const matchesSearch = !searchTerm ||
                item.referencia.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.empresa.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStage = !selectedStageId || item.stageId === selectedStageId;
            const matchesTipo = filterTipo === "all" ||
                (filterTipo === "diaristas" && item.tipo === "Diaristas") ||
                (filterTipo === "operacoes" && item.tipo === "Operação") ||
                (filterTipo === "pontos" && item.tipo === "Pontos") ||
                (filterTipo === "custos" && item.tipo === "Custo Extra") ||
                (filterTipo === "servicos" && item.tipo === "Serviço Extra");
            const matchesCompetencia = !filterCompetencia || item.competencia === filterCompetencia;
            return matchesSearch && matchesStage && matchesTipo && matchesCompetencia;
        });
    }, [unifiedItems, searchTerm, selectedStageId, filterTipo, filterCompetencia]);

    const handleStageToggle = (stageId: string) => {
        setSelectedStageId(prev => prev === stageId ? null : stageId);
    };

    const handleRefresh = () => {
        const t = toast.loading("Atualizando pipeline...");
        refetch().then(() => {
            queryClient.invalidateQueries({ queryKey: ["operacoes-pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas-pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["custos-pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["pontos-pipeline"] });
            queryClient.invalidateQueries({ queryKey: ["servicos-extras-pipeline"] });
            toast.success("Dashboard atualizado!", { id: t });
        }).catch(() => {
            toast.error("Erro ao atualizar dados.", { id: t });
        });
    };

    const handleReprocessPeriod = () => {
        toast.promise(new Promise(resolve => setTimeout(resolve, 1500)), {
            loading: "Reprocessando competência...",
            success: "Período reprocessado com sucesso!",
            error: "Erro no reprocessamento."
        });
    };

    const competenciaOptions = useMemo(() => {
        const options = [];
        const today = new Date();
        for (let i = 0; i < 6; i++) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const value = date.toISOString().substring(0, 7);
            const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
            options.push({ value, label });
        }
        return options;
    }, []);

    return (
        <AppShell
            title="Processamento Operacional"
            subtitle="Visão centralizada do pipeline de todas as entradas operacionais"
            badge="PROCESSAMENTO"
        >
            <div className="space-y-8">
                <section className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="relative">
                            <select
                                value={filterEmpresaId}
                                onChange={(e) => setFilterEmpresaId(e.target.value)}
                                className="h-10 pl-10 pr-10 rounded-lg border border-muted bg-white text-sm focus:ring-2 focus:ring-primary appearance-none min-w-[220px] font-bold text-foreground overflow-hidden"
                            >
                                <option value="all">Todas as Empresas</option>
                                {empresas.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                ))}
                            </select>
                            <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90" />
                        </div>

                        <div className="relative">
                            <select
                                value={filterCompetencia}
                                onChange={(e) => setFilterCompetencia(e.target.value)}
                                className="h-10 pl-10 pr-10 rounded-lg border border-muted bg-white text-sm focus:ring-2 focus:ring-primary appearance-none min-w-[160px] font-bold text-foreground"
                            >
                                {competenciaOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90" />
                        </div>

                        <div className="relative">
                            <select
                                value={filterTipo}
                                onChange={(e) => setFilterTipo(e.target.value)}
                                className="h-10 pl-10 pr-10 rounded-lg border border-muted bg-white text-sm focus:ring-2 focus:ring-primary appearance-none min-w-[180px] font-bold text-foreground"
                            >
                                <option value="all">Todos os Tipos</option>
                                <option value="operacoes">Operações</option>
                                <option value="pontos">Pontos</option>
                                <option value="diaristas">Diaristas</option>
                                <option value="custos">Custos Extras</option>
                                <option value="servicos">Serviços Extras</option>
                            </select>
                            <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90" />
                        </div>

                        <div className="relative group">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                            <Input
                                placeholder="Buscar lote, colaborador, operação..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 w-[320px] rounded-lg border-muted bg-white font-medium"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 gap-2 border-muted font-bold px-4 hover:bg-muted/10"
                            onClick={handleReprocessPeriod}
                        >
                            <RotateCcw className="h-4 w-4 text-muted-foreground" />
                            Reprocessar Período
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-10 gap-2 border-muted font-bold px-4 hover:bg-muted/10"
                            onClick={handleRefresh}
                        >
                            <RefreshCw className={cn("h-4 w-4 text-muted-foreground", loadingPulse && "animate-spin")} />
                            Atualizar
                        </Button>
                    </div>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {pipelineStages.map((stage, idx) => {
                        const isActive = selectedStageId === stage.id;
                        const isLast = idx === pipelineStages.length - 1;
                        return (
                            <div key={stage.id} className="flex items-center gap-2">
                                <Card
                                    onClick={() => handleStageToggle(stage.id)}
                                    className={cn(
                                        "flex-1 p-4 flex flex-col items-start gap-1 cursor-pointer transition-all border shadow-sm",
                                        isActive ? "ring-2 ring-primary border-transparent bg-white" : "hover:bg-muted/5 bg-white border-border",
                                        stage.tone === "blue" ? "bg-blue-50/10 border-blue-100" :
                                            stage.tone === "amber" ? "bg-amber-50/10 border-amber-100" :
                                                stage.tone === "emerald" ? "bg-emerald-50/10 border-emerald-100" :
                                                    stage.tone === "purple" ? "bg-purple-50/10 border-purple-100" : "bg-white"
                                    )}
                                >
                                    <div className="flex items-center gap-2 mb-1 w-full">
                                        <div className={cn(
                                            "p-1.5 rounded-md",
                                            stage.tone === "blue" ? "bg-blue-100 text-blue-600" :
                                                stage.tone === "amber" ? "bg-amber-100 text-amber-600" :
                                                    stage.tone === "emerald" ? "bg-emerald-100 text-emerald-600" :
                                                        stage.tone === "purple" ? "bg-purple-100 text-purple-600" : "bg-zinc-100 text-zinc-600"
                                        )}>
                                            <stage.icon size={16} />
                                        </div>
                                        <span className="text-[11px] font-bold text-foreground truncate">{stage.label}</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5 mt-1">
                                        <span className="text-2xl font-bold font-display">{stage.count}</span>
                                        <span className="text-[10px] font-medium text-muted-foreground">lotes</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground mt-1 font-medium">{stage.description}</span>
                                </Card>
                                {!isLast && <ChevronRight className="text-muted-foreground/30 h-5 w-5 shrink-0" />}
                            </div>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center gap-12 px-6 py-4 border-y border-border/40 bg-gray-50/30">
                    {[
                        { label: "Total de Lotes", value: stats.totalItems, icon: Layers, color: "text-blue-600", colorBg: "bg-blue-50" },
                        { label: "Valor Total", value: `R$ ${stats.totalValue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, icon: DollarSign, color: "text-emerald-600", colorBg: "bg-emerald-50" },
                        { label: "Horas Totais", value: `${stats.totalHours}h 00m`, icon: Clock, color: "text-blue-500", colorBg: "bg-blue-50" },
                        { label: "Pendências", value: stats.totalAttentionCount, icon: AlertCircle, color: "text-orange-600", colorBg: "bg-orange-50" },
                        { label: "Atrasados", value: stats.totalDelayedCount, icon: Timer, color: "text-red-600", colorBg: "bg-red-50" }
                    ].map((idx, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg", idx.colorBg, idx.color)}>
                                <idx.icon size={18} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{idx.label}</span>
                                <span className="text-sm font-black text-foreground font-display">{idx.value}</span>
                            </div>
                        </div>
                    ))}
                    <div className="ml-auto text-[10px] text-muted-foreground font-bold flex items-center gap-1.5 opacity-60">
                        <History size={12} />
                        Atualizado agora
                    </div>
                </div>

                <div className="space-y-4">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <div className="flex items-center justify-between border-b border-border pb-1">
                            <TabsList className="bg-transparent h-10 p-0 gap-8">
                                <TabsTrigger value="visao-geral" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-xs font-bold px-0 h-10">Visão Geral</TabsTrigger>
                                <TabsTrigger value="tipo-entrada" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-xs font-bold px-0 h-10">Por Tipo de Entrada</TabsTrigger>
                                <TabsTrigger value="empresa" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-xs font-bold px-0 h-10">Por Empresa</TabsTrigger>
                                <TabsTrigger value="competencia" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-xs font-bold px-0 h-10">Por Competência</TabsTrigger>
                                <TabsTrigger value="critico" className="bg-transparent border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none rounded-none text-xs font-bold px-0 h-10">Pendências Críticas</TabsTrigger>
                            </TabsList>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground font-medium">Exibir</span>
                                <div className="relative">
                                    <select
                                        value={itemsPerPage}
                                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                        className="h-8 pl-3 pr-8 rounded border border-muted bg-white text-[11px] font-bold appearance-none min-w-[60px]"
                                    >
                                        <option value={10}>10</option>
                                        <option value={25}>25</option>
                                        <option value={50}>50</option>
                                        <option value={100}>100</option>
                                    </select>
                                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                </div>
                                <span className="text-xs text-muted-foreground font-medium">registros</span>
                            </div>
                        </div>

                        <TabsContent value="visao-geral" className="mt-0">
                            <PipelineTable
                                items={filteredItems}
                                navigate={navigate}
                                filterCompetencia={filterCompetencia}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </TabsContent>

                        <TabsContent value="empresa">
                            <div className="grid grid-cols-1 gap-4">
                                {Object.entries(
                                    unifiedItems.reduce((acc: any, item: any) => {
                                        if (!acc[item.empresa]) acc[item.empresa] = { items: [], valor: 0 };
                                        acc[item.empresa].items.push(item);
                                        acc[item.empresa].valor += (item.valor || 0);
                                        return acc;
                                    }, {})
                                ).sort((a: any, b: any) => b[1].valor - a[1].valor).map(([empresa, data]: [string, any]) => (
                                    <div key={empresa} className="esc-card p-0 overflow-hidden">
                                        <div className="bg-muted/30 p-3 border-b border-border flex justify-between items-center">
                                            <span className="font-bold flex items-center gap-2">
                                                <Building2 size={16} /> {empresa}
                                            </span>
                                            <span className="text-sm font-semibold text-emerald-600">
                                                R$ {data.valor.toLocaleString("pt-BR")}
                                            </span>
                                        </div>
                                        <div className="p-2">
                                            {data.items.slice(0, 3).map((item: any) => (
                                                <div key={item.id} className="text-xs py-1 border-b border-border last:border-0 flex justify-between items-center px-2">
                                                    <span>{item.referencia} - {item.operacao}</span>
                                                    <Badge variant="outline" className="text-[9px]">{item.etapa}</Badge>
                                                </div>
                                            ))}
                                            {data.items.length > 3 && (
                                                <div className="text-[10px] text-center pt-2 text-muted-foreground">
                                                    + {data.items.length - 3} itens nesta empresa
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="competencia">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {Object.entries(
                                    unifiedItems.reduce((acc: any, item: any) => {
                                        if (!acc[item.competencia]) acc[item.competencia] = { count: 0, valor: 0 };
                                        acc[item.competencia].count++;
                                        acc[item.competencia].valor += (item.valor || 0);
                                        return acc;
                                    }, {})
                                ).sort((a: any, b: any) => b[0].localeCompare(a[0])).map(([comp, data]: [string, any]) => (
                                    <Card key={comp} className="p-4 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="text-primary h-5 w-5" />
                                            <div>
                                                <p className="font-bold">{comp}</p>
                                                <p className="text-xs text-muted-foreground">{data.count} lançamentos</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-emerald-600">R$ {data.valor.toLocaleString("pt-BR")}</p>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="critico">
                            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 mb-4 flex items-center gap-3">
                                <AlertCircle className="text-destructive h-5 w-5" />
                                <div className="text-sm">
                                    <p className="font-bold text-destructive">Pendências Críticas</p>
                                    <p>Abaixo estão listados apenas os itens com inconsistências operacionais ou atrasos que exigem atenção imediata.</p>
                                </div>
                            </div>
                            <PipelineTable
                                items={filteredItems.filter(i => i.atencao || i.critico)}
                                navigate={navigate}
                                filterCompetencia={filterCompetencia}
                                currentPage={currentPage}
                                itemsPerPage={itemsPerPage}
                                onPageChange={setCurrentPage}
                            />
                        </TabsContent>
                    </Tabs>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8 opacity-60 hover:opacity-100 transition-opacity">
                    <Button variant="outline" className="h-16 flex items-center justify-between px-6 group" asChild>
                        <Link to="/relatorios">
                            <div className="flex items-center gap-3">
                                <FileText size={18} className="text-muted-foreground group-hover:text-primary" />
                                <span className="font-medium">Relatórios</span>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </Link>
                    </Button>
                    <Button variant="outline" className="h-16 flex items-center justify-between px-6 group" asChild>
                        <Link to="/governanca/automacao">
                            <div className="flex items-center gap-3">
                                <Rocket size={18} className="text-muted-foreground group-hover:text-primary" />
                                <span className="font-medium">Automação</span>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </Link>
                    </Button>
                    <Button variant="outline" className="h-16 flex items-center justify-between px-6 group" asChild>
                        <Link to="/admin/usuarios-acessos">
                            <div className="flex items-center gap-3">
                                <Users size={18} className="text-muted-foreground group-hover:text-primary" />
                                <span className="font-medium">Usuários</span>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </Link>
                    </Button>
                    <Button variant="outline" className="h-16 flex items-center justify-between px-6 group" asChild>
                        <Link to="/configuracoes">
                            <div className="flex items-center gap-3">
                                <Settings size={18} className="text-muted-foreground group-hover:text-primary" />
                                <span className="font-medium">Configurações</span>
                            </div>
                            <ChevronRight size={16} className="text-muted-foreground" />
                        </Link>
                    </Button>
                </div>
            </div>
        </AppShell>
    );
}

