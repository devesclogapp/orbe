import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
    Activity, Clock, CheckCircle2, AlertTriangle, ArrowRight, Layers,
    Search, Filter, Settings, DollarSign, Timer, RefreshCw, ChevronRight,
    Building2, Calendar, FileText, Users, PieChart, BarChart3, AlertCircle,
    Zap, Flag, Target, ShieldAlert, ArrowUpRight, Rocket, ClipboardCheck,
    UserCheck, Wallet, Wrench
} from "lucide-react";

import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { EmpresaService } from "@/services/domain/cadastros.service";
import { OperacaoService } from "@/services/domain/core.service";
import { CustoExtraOperacionalService, ServicosExtrasOperacionaisService } from "@/services/domain/despesas.service";
import { PontoService } from "@/services/domain/producao.service";
import { LoteFechamentoDiaristaService } from "@/services/domain/diaristas.service";
import { cn } from "@/lib/utils";

const STAGES = [
    { id: "recebido", label: "Recebido", tone: "blue" },
    { id: "analise-rh", label: "Em Análise RH", tone: "amber" },
    { id: "aprovado-rh", label: "Aprovado RH", tone: "cyan" },
    { id: "financeiro", label: "Financeiro", tone: "purple" },
    { id: "pronto-cnab", label: "Pronto p/ CNAB", tone: "indigo" },
    { id: "remetido", label: "Remetido", tone: "orange" },
    { id: "concluido", label: "Concluído", tone: "emerald" },
];

const STAGE_ICONS: Record<string, any> = {
    "recebido": FileText,
    "analise-rh": Timer,
    "aprovado-rh": CheckCircle2,
    "financeiro": DollarSign,
    "pronto-cnab": Layers,
    "remetido": Activity,
    "concluido": Target
};

function SimpleBar({ value, max, colorClass }: { value: number, max: number, colorClass: string }) {
    const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
    return (
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-500", colorClass)} style={{ width: `${percent}%` }} />
        </div>
    );
}

export default function PipelineOperacional() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
    const [filterCompetencia, setFilterCompetencia] = useState(new Date().toISOString().substring(0, 7));
    const [filterTipo, setFilterTipo] = useState("all");
    const [filterResponsavel, setFilterResponsavel] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");

    const { data: empresas = [], isLoading: isEmpresasLoading } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: operacoes = [], isLoading: isOpLoading, isError: isOpError } = useQuery({
        queryKey: ["pipeline-operacoes", filterEmpresaId, filterCompetencia],
        queryFn: () => OperacaoService.getAllPainel(
            filterEmpresaId === "all" ? undefined : filterEmpresaId,
            null,
            filterCompetencia
        ),
    });

    const { data: diaristas = [], isLoading: isDiaLoading, isError: isDiaError } = useQuery({
        queryKey: ["diaristas-pipeline", filterEmpresaId, filterCompetencia],
        queryFn: () => {
            // calcular o intervalo do mês selecionado
            const [year, mo] = filterCompetencia.split('-').map(Number);
            const inicio = `${filterCompetencia}-01`;
            const lastDay = new Date(year, mo, 0).getDate();
            const fim = `${filterCompetencia}-${String(lastDay).padStart(2, '0')}`;
            return LoteFechamentoDiaristaService.getLotesPorPeriodo(
                inicio,
                fim,
                filterEmpresaId === "all" ? undefined : filterEmpresaId
            );
        },
    });

    const { data: custos = [], isLoading: isCustosLoading, isError: isCustosError } = useQuery({
        queryKey: ["custos-pipeline", filterEmpresaId, filterCompetencia],
        queryFn: () => CustoExtraOperacionalService.getByCompetencia(
            filterCompetencia,
            filterEmpresaId === "all" ? undefined : filterEmpresaId
        ),
    });

    const { data: pontos = [], isLoading: isPontosLoading, isError: isPontosError } = useQuery({
        queryKey: ["pontos-pipeline", filterEmpresaId, filterCompetencia],
        queryFn: () => PontoService.getByMonth(filterCompetencia, filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: servicosExtras = [], isLoading: isServicosLoading, isError: isServicosError } = useQuery({
        queryKey: ["servicos-extras-pipeline", filterEmpresaId, filterCompetencia],
        queryFn: () => ServicosExtrasOperacionaisService.getWithEmpresas(
            filterEmpresaId === "all" ? undefined : filterEmpresaId,
            filterCompetencia
        ),
    });

    const isAnyError = isOpError || isDiaError || isCustosError || isPontosError || isServicosError;
    const isGlobalLoading = (isEmpresasLoading || isOpLoading || isDiaLoading || isCustosLoading || isPontosLoading || isServicosLoading) && !isAnyError;

    const unifiedItems = useMemo(() => {
        const result: any[] = [];
        const now = new Date();

        (operacoes || []).forEach((op: any) => {
            let stageId = "recebido";
            const s = op.status?.toUpperCase() || "";
            if (s === "CONCLUIDO") stageId = "concluido";
            else if (s === "RECEBIDO_FINANCEIRO") stageId = "remetido";
            else if (s === "FATURADO") stageId = "pronto-cnab";
            else if (s === "AGUARDANDO_FATURAMENTO") stageId = "financeiro";
            else if (s === "EM_VALIDACAO") stageId = "analise-rh"; // Use este visual apenas como genérico para análise
            else if (s === "RECEBIDO") stageId = "recebido";

            const createdDate = new Date(op.created_at || op.data_operacao || Date.now());

            result.push({
                id: op.id,
                tipo: "Operações",
                empresa: op.empresa?.nome || "Sem Empresa",
                competencia: op.data_operacao ? op.data_operacao.substring(0, 7) : filterCompetencia,
                stageId: stageId,
                valor: Number(op.valor_total) || 0,
                horas: 0,
                lotes: 1,
                lancamentos: Number(op.quantidade_colaboradores) || 1,
                dias_parado: stageId === "concluido" ? 0 : Math.max(0, differenceInDays(now, createdDate)),
                responsavel: "Operacional",
                critico: !op.empresa_id || op.status === "inconsistente" || op.status === "bloqueado"
            });
        });

        (diaristas || []).forEach((d: any) => {
            let stageId = "analise-rh";
            if (d.status === "PAGO") stageId = "concluido";
            else if (d.status === "PRONTO_CNAB") stageId = "pronto-cnab";
            else if (d.status === "VALIDADO_FINANCEIRO") stageId = "financeiro";
            else if (d.status === "VALIDADO_RH") stageId = "aprovado-rh";
            else if (d.status === "AGUARDANDO_VALIDACAO_RH") stageId = "analise-rh";

            const createdDate = new Date(d.created_at || d.periodo_inicio || Date.now());

            result.push({
                id: d.id,
                tipo: "Diaristas",
                empresa: d.empresa?.nome || "Sem Empresa",
                competencia: d.periodo_inicio ? d.periodo_inicio.substring(0, 7) : filterCompetencia,
                stageId: stageId,
                valor: Number(d.valor_total) || 0,
                horas: 0,
                lotes: 1,
                lancamentos: d.diaristas?.length || d.quantidade_lancamentos || 1,
                dias_parado: stageId === "concluido" ? 0 : Math.max(0, differenceInDays(now, createdDate)),
                responsavel: "RH",
                critico: !d.empresa_id || d.status === "INCONSISTENTE"
            });
        });

        (custos || []).forEach((c: any) => {
            let stageId = "financeiro";
            if (c.status_pagamento === "PAGO" || c.status === "PAGO") stageId = "concluido";
            else if (c.status_pagamento === "AGUARDANDO_PAGAMENTO") stageId = "pronto-cnab";

            const createdDate = new Date(c.created_at || c.data_competencia || Date.now());

            result.push({
                id: c.id,
                tipo: "Custos Extras",
                empresa: c.empresa?.nome || "Sem Empresa",
                competencia: c.data_competencia ? c.data_competencia.substring(0, 7) : filterCompetencia,
                stageId: stageId,
                valor: Number(c.valor || c.total) || 0,
                horas: 0,
                lotes: 1,
                lancamentos: 1,
                dias_parado: stageId === "concluido" ? 0 : Math.max(0, differenceInDays(now, createdDate)),
                responsavel: "Financeiro",
                critico: !c.empresa_id
            });
        });

        (pontos || []).forEach((p: any) => {
            let stageId = "analise-rh";
            if (p.status_processamento === "PROCESSADO") stageId = "concluido";
            else if (p.status_processamento === "APROVADO_RH") stageId = "aprovado-rh";

            const createdDate = new Date(p.created_at || p.data || Date.now());

            result.push({
                id: p.id,
                tipo: "Pontos",
                empresa: p.colaboradores?.empresas?.nome || "Sem Empresa",
                competencia: p.competencia || filterCompetencia,
                stageId: stageId,
                valor: 0,
                horas: 8,
                lotes: 0,
                lancamentos: 1,
                dias_parado: stageId === "concluido" ? 0 : Math.max(0, differenceInDays(now, createdDate)),
                responsavel: "RH",
                critico: p.status_processamento === "INCONSISTENTE" || p.status_processamento === "ERRO" || !p.colaborador_id
            });
        });

        (servicosExtras || []).forEach((s: any) => {
            let stageId = "recebido";
            if (s.status === "CONCLUIDO" || s.status === "PAGO") stageId = "concluido";
            else if (s.status === "APROVADO") stageId = "financeiro";

            const createdDate = new Date(s.created_at || s.data || Date.now());

            result.push({
                id: s.id,
                tipo: "Serviços Extras",
                empresa: s.empresas?.nome || "Sem Empresa",
                competencia: s.data ? s.data.substring(0, 7) : filterCompetencia,
                stageId: stageId,
                valor: Number(s.valor || s.total) || 0,
                horas: 0,
                lotes: 1,
                lancamentos: 1,
                dias_parado: stageId === "concluido" ? 0 : Math.max(0, differenceInDays(now, createdDate)),
                responsavel: "Operacional",
                critico: !s.empresas
            });
        });

        return result;
    }, [operacoes, diaristas, custos, pontos, servicosExtras, filterCompetencia]);

    // Apply Filter & Search
    const filteredItems = useMemo(() => {
        return unifiedItems.filter(item => {
            const matchEmpresa = filterEmpresaId === "all" || item.empresa === empresas.find(e => e.id === filterEmpresaId)?.nome;
            const matchTipo = filterTipo === "all" || item.tipo.toLowerCase().includes(filterTipo);
            const matchResp = filterResponsavel === "all" || item.responsavel.toLowerCase().includes(filterResponsavel.toLowerCase());
            const matchComp = !filterCompetencia || item.competencia === filterCompetencia;
            const matchSearch = !searchTerm || item.empresa.toLowerCase().includes(searchTerm.toLowerCase());
            return matchEmpresa && matchTipo && matchResp && matchComp && matchSearch;
        });
    }, [unifiedItems, filterEmpresaId, filterTipo, filterResponsavel, filterCompetencia, searchTerm, empresas]);

    const kpis = useMemo(() => {
        let totalLancamentos = 0;
        let totalLotes = 0;
        let valorTotal = 0;
        let horasTotais = 0;
        let pendencias = 0;
        let atrasados = 0;
        let valorProcessado = 0;
        let totalDiasParado = 0;

        filteredItems.forEach(i => {
            totalLancamentos += i.lancamentos;
            totalLotes += i.lotes;
            valorTotal += i.valor;
            horasTotais += i.horas;
            if (i.critico) pendencias++;
            if (i.dias_parado > 3) atrasados++; // Regra mockada > 3 dias = atrasado
            if (i.stageId === "concluido" || i.stageId === "pronto-cnab" || i.stageId === "remetido") {
                valorProcessado += i.valor;
            }
            totalDiasParado += i.dias_parado;
        });

        return {
            totalLancamentos,
            totalLotes,
            valorTotal,
            horasTotais,
            pendencias,
            atrasados,
            valorProcessado,
            slaMedio: filteredItems.length > 0 ? (totalDiasParado / filteredItems.length).toFixed(1) : "0",
        };
    }, [filteredItems]);

    const fluxStats = useMemo(() => {
        const stats: Record<string, { lancamentos: number, lotes: number, valor: number, sumDias: number }> = {};
        STAGES.forEach(s => stats[s.id] = { lancamentos: 0, lotes: 0, valor: 0, sumDias: 0 });

        filteredItems.forEach(i => {
            if (stats[i.stageId]) {
                stats[i.stageId].lancamentos += i.lancamentos;
                stats[i.stageId].lotes += i.lotes;
                stats[i.stageId].valor += i.valor;
                stats[i.stageId].sumDias += i.dias_parado;
            }
        });

        return stats;
    }, [filteredItems]);

    // Bloco 4 - Tipos
    const typeDistribution = useMemo(() => {
        const types: Record<string, number> = {};
        filteredItems.forEach(i => {
            types[i.tipo] = (types[i.tipo] || 0) + i.lancamentos;
        });
        return Object.entries(types).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    }, [filteredItems]);

    // Bloco 5 - Empresas
    const companyDistribution = useMemo(() => {
        const comps: Record<string, { lancamentos: number, valor: number, atrasos: number, etapa: string }> = {};
        filteredItems.forEach(i => {
            if (!comps[i.empresa]) comps[i.empresa] = { lancamentos: 0, valor: 0, atrasos: 0, etapa: i.stageId };
            comps[i.empresa].lancamentos += i.lancamentos;
            comps[i.empresa].valor += i.valor;
            if (i.dias_parado > 3) comps[i.empresa].atrasos++;
            // overwrite etepas to find a common one or just take the last
            comps[i.empresa].etapa = i.stageId;
        });
        return Object.entries(comps)
            .map(([empresa, data]) => ({ empresa, ...data }))
            .sort((a, b) => b.lancamentos - a.lancamentos)
            .slice(0, 6);
    }, [filteredItems]);

    // Bloco 6 - Gargalos
    const bottleneckDistribution = useMemo(() => {
        const bottles: Record<string, { quantidade: number, sumDias: number, etapa: string }> = {};
        filteredItems.forEach(i => {
            const key = `${i.responsavel}_${i.stageId}`;
            if (!bottles[key]) bottles[key] = { quantidade: 0, sumDias: 0, etapa: i.stageId };
            bottles[key].quantidade += i.lancamentos;
            bottles[key].sumDias += i.dias_parado;
        });
        return Object.entries(bottles)
            .map(([responsavel_etapa, data]) => ({
                responsavel: responsavel_etapa.split('_')[0],
                etapa: STAGES.find(s => s.id === data.etapa)?.label || data.etapa,
                quantidade: data.quantidade,
                diasMedio: data.quantidade > 0 ? (data.sumDias / data.quantidade).toFixed(1) : "0"
            }))
            .sort((a, b) => parseFloat(b.diasMedio) - parseFloat(a.diasMedio))
            .slice(0, 5);
    }, [filteredItems]);

    const handleRefresh = () => {
        const t = toast.loading("Atualizando pipeline gerencial...");
        queryClient.invalidateQueries().then(() => {
            toast.success("Torre de controle atualizada!", { id: t });
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

    // Color definitions for UI mapping
    const getBadgeColor = (tone: string) => {
        const map: any = {
            blue: "bg-info-soft text-info-strong border-info/20",
            amber: "bg-warning-soft text-warning-strong border-warning/20",
            cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
            purple: "bg-purple-50 text-purple-700 border-purple-200",
            indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
            orange: "bg-orange-50 text-orange-700 border-orange-200",
            emerald: "bg-success-soft text-success-strong border-success/20"
        };
        return map[tone] || map.blue;
    };

    const INPUT_TYPES = [
        { id: "all", label: "Visão Geral", icon: Rocket, color: "text-primary" },
        { id: "operações", label: "Operações por Volume", icon: ClipboardCheck, color: "text-orange-500" },
        { id: "pontos", label: "Pontos Recebidos", icon: Clock, color: "text-blue-500" },
        { id: "diaristas", label: "Diaristas Recebidos", icon: UserCheck, color: "text-yellow-600" },
        { id: "custos extras", label: "Custos Extras", icon: Wallet, color: "text-purple-500" },
        { id: "serviços extras", label: "Serviços Extras", icon: Zap, color: "text-indigo-500" },
    ];

    return (
        <AppShell
            title="Torre de Controle Operacional"
            subtitle="Monitoramento executivo: Fluxos, Gargalos e SLAs"
        >
            {isAnyError ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4 px-4 text-center">
                    <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2">
                        <AlertTriangle className="h-8 w-8" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground">Falha ao sincronizar dados</h2>
                    <Button variant="outline" onClick={() => window.location.reload()} className="mt-4 gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Tentar Novamente
                    </Button>
                </div>
            ) : isGlobalLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Carregando pipeline operacional...</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-[1700px] mx-auto pb-12 px-4 md:px-6">
                    {/* ALERTAS TÉCNICOS */}
                    {(kpis.pendencias > 0 || kpis.atrasados > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
                            {kpis.pendencias > 0 && (
                                <div className="flex items-center gap-4 p-4 rounded-xl border border-red-100 bg-red-50/50">
                                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                                        <Zap className="h-5 w-5 fill-red-600" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-red-900 leading-none">Radar Executivo: Pendências</p>
                                        <p className="text-xs text-red-800/70 mt-1">Existem <strong>{kpis.pendencias} lançamentos</strong> com inconsistências.</p>
                                    </div>
                                </div>
                            )}
                            {kpis.atrasados > 0 && (
                                <div className="flex items-center gap-4 p-4 rounded-xl border border-orange-100 bg-orange-50/50">
                                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 shrink-0">
                                        <Timer className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-orange-900 leading-none">Atrasos de Processamento</p>
                                        <p className="text-xs text-orange-800/70 mt-1">Identificamos <strong>{kpis.atrasados} registros</strong> fora do SLA.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* FILTROS TIPO */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {INPUT_TYPES.map((type) => {
                            const Icon = type.icon;
                            const isActive = filterTipo === type.id;
                            const count = type.id === "all"
                                ? unifiedItems.length
                                : unifiedItems.filter(i => i.tipo.toLowerCase().includes(type.id)).length;

                            return (
                                <button
                                    key={type.id}
                                    onClick={() => setFilterTipo(type.id)}
                                    className={cn(
                                        "h-9 px-4 rounded-full flex items-center gap-2 border transition-all whitespace-nowrap text-xs font-medium",
                                        isActive
                                            ? "bg-[#FFF1EC] text-[#FD4C00] border-[#FD4C00]/20 shadow-sm"
                                            : "bg-white text-muted-foreground border-border hover:bg-bg-subtle"
                                    )}
                                >
                                    <Icon className={cn("h-3.5 w-3.5", isActive ? "text-[#FD4C00]" : "text-muted-foreground/60")} />
                                    <span>{type.label}</span>
                                    {count > 0 && (
                                        <span className={cn(
                                            "ml-1 h-4 min-w-[16px] px-1 rounded-full text-[9px] flex items-center justify-center font-bold",
                                            isActive ? "bg-[#FD4C00] text-white" : "bg-gray-100 text-gray-600"
                                        )}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* FILTROS GERAIS */}
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

                            <select
                                value={filterCompetencia}
                                onChange={(e) => setFilterCompetencia(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-border bg-card text-sm font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                {competenciaOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>

                            <div className="relative group w-full md:w-auto">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                                <Input
                                    placeholder="Pesquisa rápida..."
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
                            Atualizar Painel
                        </Button>
                    </div>

                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="esc-card p-5">
                            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Total Lançamentos</span>
                            <div className="flex items-end justify-between mt-3">
                                <span className="text-3xl font-bold font-display">{kpis.totalLancamentos.toLocaleString('pt-BR')}</span>
                                <Layers className="text-blue-500 h-6 w-6 opacity-40" />
                            </div>
                        </div>
                        <div className="esc-card p-5">
                            <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Valor Total</span>
                            <div className="flex items-end justify-between mt-3">
                                <span className="text-3xl font-bold font-display text-emerald-600">R$ {(kpis.valorTotal / 1000).toFixed(1)}k</span>
                                <DollarSign className="text-emerald-500 h-6 w-6 opacity-40" />
                            </div>
                        </div>
                        <div className="esc-card p-5 border-destructive/20">
                            <span className="text-[11px] text-destructive font-semibold uppercase tracking-wider">Pendências</span>
                            <div className="flex items-end justify-between mt-3">
                                <span className="text-3xl font-bold font-display text-destructive">{kpis.pendencias}</span>
                                <AlertTriangle className="text-destructive h-6 w-6 opacity-40" />
                            </div>
                        </div>
                        <div className="esc-card p-5 border-blue-200">
                            <span className="text-[11px] text-blue-600 font-semibold uppercase tracking-wider">SLA Médio (Dias)</span>
                            <div className="flex items-end justify-between mt-3">
                                <span className="text-3xl font-bold font-display text-blue-600">{kpis.slaMedio}</span>
                                <Activity className="text-blue-500 h-6 w-6 opacity-40" />
                            </div>
                        </div>
                    </div>

                    {/* PIPELINE VISUAL */}
                    <div className="esc-card p-6 overflow-hidden">
                        <h2 className="font-display font-semibold text-lg text-foreground mb-8 flex items-center gap-2">
                            <ArrowRight className="h-5 w-5 text-[#FD4C00]" />
                            Esteira Operacional <span className="text-gray-500 font-normal text-sm ml-2">· Fluxo de processamento</span>
                        </h2>

                        <div className="flex flex-col lg:flex-row justify-between w-full relative pt-2 gap-4 lg:gap-0 overflow-x-auto pb-4 scrollbar-hide">
                            <div className="hidden lg:block absolute left-12 right-12 top-[32px] h-px bg-border -z-0" />

                            {STAGES.map((stage) => {
                                const data = fluxStats[stage.id] || { lancamentos: 0, lotes: 0, valor: 0, sumDias: 0 };
                                const sla = data.lancamentos > 0 ? (data.sumDias / data.lancamentos).toFixed(1) : "0";
                                const Icon = STAGE_ICONS[stage.id] || Filter;
                                const isActive = data.lancamentos > 0;

                                return (
                                    <div key={stage.id} className="relative z-10 flex flex-col items-center flex-1 min-w-[140px]">
                                        <div className={cn(
                                            "relative z-10 w-14 h-14 rounded-full flex items-center justify-center border-4 border-[#F7F7F7] shadow-sm mb-4 transition-all",
                                            isActive ? "bg-white text-[#FD4C00] ring-1 ring-border" : "bg-gray-100 text-gray-400"
                                        )}>
                                            <Icon className={cn("h-6 w-6", isActive ? "text-[#FD4C00]" : "")} />
                                        </div>

                                        <div className="text-center w-full px-2">
                                            <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4 border-b border-border/40 pb-2 truncate">
                                                {stage.label}
                                            </p>
                                            <div className={cn("p-4 rounded-xl border space-y-3 bg-gray-50/50", isActive ? "border-border shadow-sm bg-white" : "border-transparent opacity-60")}>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-gray-500 font-medium">Itens</span>
                                                    <span className="font-bold">{data.lancamentos}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px] pt-1 border-t border-border/40">
                                                    <span className="text-gray-500 font-medium text-left">SLA</span>
                                                    <span className={cn("font-bold", parseFloat(sla) > 3 ? "text-destructive" : "text-success-strong")}>
                                                        {sla}d
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* TABELAS COMPLEMENTARES */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="esc-card p-6">
                            <h3 className="font-display font-semibold text-base flex items-center gap-2 mb-6">
                                <Building2 className="text-[#FD4C00] h-5 w-5" />
                                Top 5 por Empresa
                            </h3>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="esc-table-header">
                                            <th className="px-4 text-left">Empresa</th>
                                            <th className="px-2 text-right">Itens</th>
                                            <th className="px-4 text-right">Volume</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {companyDistribution.slice(0, 5).map((comp, i) => (
                                            <tr key={comp.empresa} className="esc-table-row">
                                                <td className="px-4 py-4 font-semibold text-foreground">{comp.empresa}</td>
                                                <td className="px-2 py-4 text-right">
                                                    <span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">{comp.lancamentos}</span>
                                                </td>
                                                <td className="px-4 py-4 text-right font-semibold text-emerald-600">
                                                    R${comp.valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="esc-card p-6">
                            <h3 className="font-display font-semibold text-base flex items-center gap-2 mb-6">
                                <ShieldAlert className="text-orange-500 h-5 w-5" />
                                Gargalos Operacionais
                            </h3>
                            <div className="space-y-4">
                                {bottleneckDistribution.map((bot, i) => (
                                    <div key={i} className="flex flex-col gap-2 p-3 bg-gray-50/50 rounded-xl border border-border relative overflow-hidden">
                                        <div
                                            className="absolute left-0 top-0 bottom-0 bg-orange-100/20 -z-0"
                                            style={{ width: `${Math.min(100, (parseFloat(bot.diasMedio) / 5) * 100)}%` }}
                                        />
                                        <div className="flex justify-between items-start relative z-10">
                                            <div>
                                                <p className="font-bold text-xs uppercase text-gray-700">{bot.responsavel}</p>
                                                <p className="text-[10px] font-medium text-gray-500 truncate mt-0.5">{bot.etapa}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-orange-600 font-display leading-tight">{bot.diasMedio}d</p>
                                                <p className="text-[10px] text-gray-400 font-semibold uppercase">{bot.quantidade} itens</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </AppShell>
    );
}
