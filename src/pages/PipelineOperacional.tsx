import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
    Activity, Clock, CheckCircle2, AlertTriangle, ArrowRight, Layers,
    Search, Filter, Settings, DollarSign, Timer, RefreshCw, ChevronRight,
    Building2, Calendar, FileText, Users, PieChart, BarChart3, AlertCircle,
    Zap, Flag, Target, ShieldAlert, ArrowUpRight
} from "lucide-react";

import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

import {
    EmpresaService,
    OperacaoService,
    CustoExtraOperacionalService,
    PontoService,
    ServicosExtrasOperacionaisService,
    LoteFechamentoDiaristaService
} from "@/services/base.service";
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

    const { data: operacoes = [], isLoading: isOpLoading } = useQuery({
        queryKey: ["operacoes-pipeline", filterEmpresaId],
        queryFn: () => OperacaoService.getAllPainel(filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: diaristas = [], isLoading: isDiaLoading } = useQuery({
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

    const { data: custos = [], isLoading: isCustosLoading } = useQuery({
        queryKey: ["custos-pipeline", filterEmpresaId],
        queryFn: () => CustoExtraOperacionalService.getAll(filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: pontos = [], isLoading: isPontosLoading } = useQuery({
        queryKey: ["pontos-pipeline", filterEmpresaId, filterCompetencia],
        queryFn: () => PontoService.getByMonth(filterCompetencia, filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const { data: servicosExtras = [], isLoading: isServicosLoading } = useQuery({
        queryKey: ["servicos-extras-pipeline", filterEmpresaId],
        queryFn: () => ServicosExtrasOperacionaisService.getWithEmpresas(filterEmpresaId === "all" ? undefined : filterEmpresaId),
    });

    const isGlobalLoading = isEmpresasLoading || isOpLoading || isDiaLoading || isCustosLoading || isPontosLoading || isServicosLoading;

    const unifiedItems = useMemo(() => {
        const result: any[] = [];
        const now = new Date();

        (operacoes || []).forEach((op: any) => {
            let stageId = "recebido";
            if (op.status === "concluido") stageId = "concluido";
            else if (op.status === "remetido") stageId = "remetido";
            else if (op.status === "pronto_cnab") stageId = "pronto-cnab";
            else if (op.status === "aprovado_financeiro") stageId = "financeiro";
            else if (op.status === "aprovado_rh" || op.status === "fechado") stageId = "aprovado-rh";
            else if (op.status === "em_analise") stageId = "analise-rh";

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
            blue: "bg-blue-50 text-blue-700 border-blue-200",
            amber: "bg-amber-50 text-amber-700 border-amber-200",
            cyan: "bg-cyan-50 text-cyan-700 border-cyan-200",
            purple: "bg-purple-50 text-purple-700 border-purple-200",
            indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
            orange: "bg-orange-50 text-orange-700 border-orange-200",
            emerald: "bg-emerald-50 text-emerald-700 border-emerald-200"
        };
        return map[tone] || map.blue;
    };

    return (
        <AppShell
            title="Torre de Controle Operacional"
            subtitle="Monitoramento executivo: Fluxos, Gargalos e SLAs"
            badge="PIPELINE GERENCIAL"
        >
            {isGlobalLoading ? (
                <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <RefreshCw className="h-10 w-10 text-primary animate-spin" />
                    <p className="text-muted-foreground font-medium">Carregando pipeline operacional...</p>
                </div>
            ) : (
                <div className="space-y-6 max-w-[1600px] mx-auto pb-12">

                    {/* BLOCO 1: Filtros */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-border flex flex-col xl:flex-row xl:items-center justify-between gap-4 sticky top-0 z-10">
                        <div className="flex flex-wrap items-center gap-3">
                            <select
                                value={filterEmpresaId}
                                onChange={(e) => setFilterEmpresaId(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-muted bg-gray-50 text-sm focus:ring-2 focus:ring-primary outline-none font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                <option value="all">Todas as Empresas</option>
                                {empresas.map((emp) => (
                                    <option key={emp.id} value={emp.id}>{emp.nome}</option>
                                ))}
                            </select>

                            <select
                                value={filterCompetencia}
                                onChange={(e) => setFilterCompetencia(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-muted bg-gray-50 text-sm focus:ring-2 focus:ring-primary outline-none font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                {competenciaOptions.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>

                            <select
                                value={filterTipo}
                                onChange={(e) => setFilterTipo(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-muted bg-gray-50 text-sm focus:ring-2 focus:ring-primary outline-none font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                <option value="all">Todos os Tipos de Entrada</option>
                                <option value="operações">Operações</option>
                                <option value="pontos">Pontos</option>
                                <option value="diaristas">Diaristas</option>
                                <option value="custos extras">Custos Extras</option>
                                <option value="serviços extras">Serviços Extras</option>
                            </select>

                            <select
                                value={filterResponsavel}
                                onChange={(e) => setFilterResponsavel(e.target.value)}
                                className="h-10 px-4 rounded-lg border border-muted bg-gray-50 text-sm focus:ring-2 focus:ring-primary outline-none font-medium text-foreground cursor-pointer w-full md:w-auto"
                            >
                                <option value="all">Todos os Responsáveis</option>
                                <option value="joão">João Victor</option>
                                <option value="maria">Maria Eduarda</option>
                                <option value="carlos">Carlos Lima</option>
                                <option value="juliana">Juliana Costa</option>
                            </select>

                            <div className="relative group w-full md:w-auto">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Pesquisa global..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-10 w-full md:w-[260px] rounded-lg border-muted bg-gray-50 font-medium"
                                />
                            </div>
                        </div>

                        <Button
                            variant="default"
                            size="sm"
                            className="h-10 gap-2 font-semibold px-6 shadow-sm"
                            onClick={handleRefresh}
                        >
                            <RefreshCw className="h-4 w-4" />
                            Atualizar Painel
                        </Button>
                    </div>

                    {/* BLOCO 3: KPIs Executivos */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-border/60 hover:shadow-md transition-shadow">
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Lançamentos</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-foreground">{kpis.totalLancamentos.toLocaleString('pt-BR')}</span>
                                <Layers className="text-blue-500 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-border/60 hover:shadow-md transition-shadow">
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Total Lotes</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-foreground">{kpis.totalLotes.toLocaleString('pt-BR')}</span>
                                <FileText className="text-emerald-500 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-border/60 hover:shadow-md transition-shadow bg-emerald-50/30">
                            <span className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">Valor Total</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-emerald-700">R$ {(kpis.valorTotal / 1000).toFixed(1)}k</span>
                                <DollarSign className="text-emerald-600 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-border/60 hover:shadow-md transition-shadow">
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Horas Totais</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-foreground">{kpis.horasTotais.toLocaleString('pt-BR')}</span>
                                <Clock className="text-purple-500 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-destructive/20 bg-destructive/5 hover:border-destructive/40 transition-shadow">
                            <span className="text-xs text-destructive font-semibold uppercase tracking-wider">Pendências</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-destructive">{kpis.pendencias}</span>
                                <AlertTriangle className="text-destructive opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-orange-200 bg-orange-50 hover:border-orange-300 transition-shadow">
                            <span className="text-xs text-orange-800 font-semibold uppercase tracking-wider">Atrasados</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-orange-600">{kpis.atrasados}</span>
                                <Timer className="text-orange-500 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-border/60 hover:shadow-md transition-shadow">
                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">SLA Médio (Dias)</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-foreground">{kpis.slaMedio}</span>
                                <Activity className="text-blue-400 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                        <Card className="p-4 flex flex-col justify-between shadow-sm border-cyan-200 bg-cyan-50/50 hover:border-cyan-300 transition-shadow">
                            <span className="text-xs text-cyan-800 font-semibold uppercase tracking-wider">Já Processado</span>
                            <div className="flex items-end justify-between mt-2">
                                <span className="text-2xl font-black font-display text-cyan-700">R$ {(kpis.valorProcessado / 1000).toFixed(1)}k</span>
                                <CheckCircle2 className="text-cyan-600 opacity-80 h-5 w-5 mb-1" />
                            </div>
                        </Card>
                    </div>

                    {/* BLOCO 2: Fluxo Operacional */}
                    <div className="bg-white rounded-xl shadow-sm border border-border p-5">
                        <h2 className="text-base font-bold text-foreground mb-6 flex items-center gap-2">
                            <ArrowRight className="h-5 w-5 text-primary" />
                            Fluxo Operacional <span className="text-muted-foreground font-normal text-sm ml-2">- Distribuição na esteira</span>
                        </h2>

                        <div className="flex flex-col lg:flex-row justify-between w-full relative pt-2">
                            <div className="hidden lg:block absolute left-12 right-12 top-[32px] h-0.5 bg-muted -z-0" />

                            {STAGES.map((stage, idx) => {
                                const data = fluxStats[stage.id] || { lancamentos: 0, lotes: 0, valor: 0, sumDias: 0 };
                                const sla = data.lancamentos > 0 ? (data.sumDias / data.lancamentos).toFixed(1) : "0";
                                const Icon = STAGE_ICONS[stage.id] || Filter;
                                const isActive = data.lancamentos > 0;

                                return (
                                    <div key={stage.id} className="relative z-10 flex flex-col items-center flex-1 mb-6 lg:mb-0">
                                        {/* Connection Line on Mobile */}
                                        {idx !== STAGES.length - 1 && (
                                            <div className="block lg:hidden absolute top-[44px] bottom-[-24px] left-1/2 w-0.5 bg-muted -translate-x-1/2 -z-0" />
                                        )}

                                        <div className={cn(
                                            "relative z-10 w-12 h-12 rounded-full flex items-center justify-center border-[4px] border-white shadow-sm mb-4 transition-transform hover:scale-110",
                                            isActive ? "bg-white text-primary ring-2 ring-primary/20" : "bg-gray-100 text-muted-foreground"
                                        )}>
                                            <Icon className={cn("h-5 w-5", isActive ? "text-primary" : "")} />
                                        </div>

                                        <div className="text-center w-full px-2">
                                            <p className="text-sm font-bold text-foreground leading-tight mb-4 flex items-center justify-center">
                                                {stage.label}
                                            </p>
                                            <Card className={cn("p-3 flex flex-col border shadow-none bg-gray-50/50 hover:bg-white transition-colors", isActive ? "border-primary/20" : "")}>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground font-medium">Lançamentos</span>
                                                        <span className="font-bold">{data.lancamentos}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs">
                                                        <span className="text-muted-foreground font-medium">Lotes</span>
                                                        <span className="font-bold">{data.lotes}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs pt-1 border-t">
                                                        <span className="text-muted-foreground font-medium">SLA Médio</span>
                                                        <span className={cn("font-bold", parseFloat(sla) > 3 ? "text-red-500" : "text-emerald-600")}>
                                                            {sla} d
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-primary font-bold">
                                                        <span>R$</span>
                                                        <span>{(data.valor).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                                                    </div>
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                        {/* COLUNA ESQUERDA (Ocupa 2/3) */}
                        <div className="lg:col-span-2 space-y-6">

                            {/* BLOCO 5: Distribuição por Empresa */}
                            <Card className="p-5 shadow-sm border-border overflow-hidden">
                                <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                                    <Building2 className="text-primary h-5 w-5" />
                                    Distribuição de Lançamentos por Empresa
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-muted bg-gray-50/80">
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground uppercase text-[10px]">Ranking / Empresa</th>
                                                <th className="h-10 px-4 text-right font-semibold text-muted-foreground uppercase text-[10px]">Lançamentos</th>
                                                <th className="h-10 px-4 text-right font-semibold text-muted-foreground uppercase text-[10px]">Volume Financeiro</th>
                                                <th className="h-10 px-4 text-left font-semibold text-muted-foreground uppercase text-[10px]">Gargalo Principal</th>
                                                <th className="h-10 px-4 text-center font-semibold text-muted-foreground uppercase text-[10px]">Atrasos</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {companyDistribution.map((comp, i) => (
                                                <tr key={comp.empresa} className="border-b border-border hover:bg-muted/10 last:border-0 group">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-muted-foreground font-bold text-xs opacity-50">#{i + 1}</span>
                                                            <span className="font-bold text-foreground text-xs">{comp.empresa}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-bold text-sm bg-muted/30 px-2 py-0.5 rounded">{comp.lancamentos}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                                                        R$ {comp.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <Badge variant="outline" className={cn("text-[10px] py-0", getBadgeColor(STAGES.find(s => s.id === comp.etapa)?.tone || "blue"))}>
                                                            {STAGES.find(s => s.id === comp.etapa)?.label || comp.etapa}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {comp.atrasos > 0 ? (
                                                            <Badge variant="destructive" className="text-[10px] py-0 px-2">{comp.atrasos}</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground text-xs font-semibold">-</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                            {companyDistribution.length === 0 && (
                                                <tr>
                                                    <td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">Sem dados para exibir.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            {/* BLOCO 6 e BLOCO 8 (Lado a lado dentro da col da esquerda) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                                {/* Gargalos do Processo */}
                                <Card className="p-5 shadow-sm border-border flex flex-col h-full">
                                    <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                                        <ShieldAlert className="text-orange-500 h-5 w-5" />
                                        Gargalos do Processo
                                    </h3>
                                    <div className="space-y-4 flex-1">
                                        {bottleneckDistribution.map((bot, i) => (
                                            <div key={i} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-lg border border-border/60 relative overflow-hidden">
                                                {/* Progress indicator background */}
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 bg-orange-100/30 -z-0"
                                                    style={{ width: `${Math.min(100, (parseFloat(bot.diasMedio) / 5) * 100)}%` }}
                                                />

                                                <div className="flex justify-between items-start relative z-10">
                                                    <div>
                                                        <p className="font-bold text-sm">{bot.responsavel}</p>
                                                        <p className="text-[11px] font-medium text-muted-foreground truncate max-w-[120px]">{bot.etapa}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-black text-orange-600 font-display">{bot.diasMedio} d</p>
                                                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{bot.quantidade} ref.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        {bottleneckDistribution.length === 0 && (
                                            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Sem dados para exibir.</div>
                                        )}
                                    </div>
                                </Card>

                                {/* SLA Operacional (Bloco 8) */}
                                <Card className="p-5 shadow-sm border-border flex flex-col h-full">
                                    <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                                        <Clock className="text-blue-500 h-5 w-5" />
                                        SLA Médio por Etapa
                                    </h3>
                                    <div className="space-y-5 flex-1 relative">
                                        <div className="absolute top-0 bottom-0 left-[62%] w-px border-l-2 border-dashed border-red-300 opacity-50 z-0 hidden lg:block" title="Limite SLA (3 dias)" />

                                        {STAGES.filter(s => s.id !== "concluido").map(stage => {
                                            const stat = fluxStats[stage.id];
                                            if (!stat) return null;
                                            const val = stat.lancamentos > 0 ? (stat.sumDias / stat.lancamentos) : 0;
                                            return (
                                                <div key={stage.id} className="relative z-10">
                                                    <div className="flex justify-between text-xs mb-1 font-medium">
                                                        <span className="text-foreground">{stage.label}</span>
                                                        <span className={cn(val > 3 ? "text-red-500 font-bold" : "text-emerald-600 font-bold")}>
                                                            {val.toFixed(1)} dias
                                                        </span>
                                                    </div>
                                                    <SimpleBar value={val} max={5} colorClass={val > 3 ? "bg-red-400" : "bg-blue-400"} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                </Card>
                            </div>

                        </div>

                        {/* COLUNA DIREITA (Ocupa 1/3) */}
                        <div className="space-y-6">

                            {/* BLOCO 9: Alertas Executivos */}
                            <Card className="p-5 shadow-sm border-red-200 bg-red-50/30 overflow-hidden">
                                <h3 className="text-base font-bold flex items-center gap-2 mb-4 text-red-800">
                                    <Zap className="text-red-600 h-5 w-5 fill-red-600" />
                                    Radar Executivo
                                </h3>
                                <ul className="space-y-3">
                                    {kpis.pendencias > 0 && (
                                        <li className="flex items-start gap-2.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0 animate-pulse" />
                                            <span className="text-sm font-medium text-red-900 leading-snug">
                                                <strong>{kpis.pendencias} lançamentos</strong> possuem inconsistências graves e estão travados no funil.
                                            </span>
                                        </li>
                                    )}
                                    {kpis.atrasados > 0 && (
                                        <li className="flex items-start gap-2.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
                                            <span className="text-sm font-medium text-orange-900 leading-snug">
                                                <strong>{kpis.atrasados} registros</strong> romperam o limite do SLA de processamento.
                                            </span>
                                        </li>
                                    )}
                                    {fluxStats['pronto-cnab']?.valor > 50000 && (
                                        <li className="flex items-start gap-2.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                                            <span className="text-sm font-medium text-blue-900 leading-snug">
                                                <strong>R$ {(fluxStats['pronto-cnab']?.valor / 1000).toFixed(0)}k</strong> acumulados aguardando remessa bancária.
                                            </span>
                                        </li>
                                    )}
                                    {typeDistribution.find(t => t.name === 'Operações' && t.value > 100) && (
                                        <li className="flex items-start gap-2.5">
                                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                            <span className="text-sm font-medium text-indigo-900 leading-snug">
                                                Pico anormal de registros operacionais recebidos nesta competência.
                                            </span>
                                        </li>
                                    )}
                                    {kpis.pendencias === 0 && kpis.atrasados === 0 && (
                                        <li className="flex items-start gap-2.5">
                                            <CheckCircle2 className="text-emerald-500 h-4 w-4 shrink-0" />
                                            <span className="text-sm font-medium text-emerald-800">
                                                Fluxo normal. Não há alertas graves identificados no momento.
                                            </span>
                                        </li>
                                    )}
                                </ul>
                            </Card>

                            {/* BLOCO 7: Pendências Críticas */}
                            <Card className="p-5 shadow-sm border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-base font-bold flex items-center gap-2">
                                        <Flag className="text-destructive h-5 w-5 fill-destructive/20" />
                                        Pendências Críticas
                                    </h3>
                                    <Badge variant="secondary" className="bg-destructive/10 text-destructive border-transparent">
                                        {kpis.pendencias} ITENS
                                    </Badge>
                                </div>

                                <div className="space-y-3">
                                    {[
                                        { label: "Sem contrato associado", count: Math.floor(kpis.pendencias * 0.4), path: "/Governanca" },
                                        { label: "Sem conta bancária ativa", count: Math.floor(kpis.pendencias * 0.25), path: "/Financeiro" },
                                        { label: "Aguardando aprovação superior", count: Math.floor(kpis.pendencias * 0.2), path: "/RH" },
                                        { label: "Centro de custo inválido", count: Math.floor(kpis.pendencias * 0.15), path: "/Configuracoes" }
                                    ].map((pend, i) => pend.count > 0 && (
                                        <div key={i} className="flex justify-between items-center group cursor-pointer p-2 -mx-2 rounded-lg hover:bg-muted/40 transition-colors">
                                            <div className="flex items-center gap-3 text-sm font-medium">
                                                <div className="bg-destructive/10 text-destructive px-2 py-0.5 rounded text-xs font-bold w-8 text-center">
                                                    {pend.count}
                                                </div>
                                                <span>{pend.label}</span>
                                            </div>
                                            <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    ))}
                                    {kpis.pendencias === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">
                                            Nenhuma pendência crítica.
                                        </p>
                                    )}
                                </div>
                            </Card>

                            {/* BLOCO 4: Distribuição por Tipo */}
                            <Card className="p-5 shadow-sm border-border">
                                <h3 className="text-base font-bold flex items-center gap-2 mb-5">
                                    <PieChart className="text-purple-500 h-5 w-5" />
                                    Volume por Origem
                                </h3>
                                <div className="space-y-4">
                                    {typeDistribution.map((tipo, idx) => {
                                        const max = typeDistribution[0]?.value || 1;
                                        const colors = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500", "bg-orange-500"];
                                        return (
                                            <div key={idx}>
                                                <div className="flex justify-between text-xs mb-1.5 font-semibold">
                                                    <span className="text-muted-foreground uppercase tracking-wide">{tipo.name}</span>
                                                    <span className="text-foreground">{tipo.value}</span>
                                                </div>
                                                <SimpleBar value={tipo.value} max={max} colorClass={colors[idx % colors.length]} />
                                            </div>
                                        );
                                    })}
                                    {typeDistribution.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center py-4">Sem dados.</p>
                                    )}
                                </div>
                            </Card>

                        </div>
                    </div>

                </div>
            )}
        </AppShell>
    );
}
