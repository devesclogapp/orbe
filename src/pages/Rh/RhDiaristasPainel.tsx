import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, subWeeks, addWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService,
    PerfilUsuarioService,
    EmpresaService,
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Lock, RefreshCw, Users, Calendar, Table as TableIcon } from "lucide-react";

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
    format(new Date(d + "T12:00:00"), "dd/MM", { locale: ptBR });

type StatusFilter = "todos" | "em_aberto" | "fechado_para_pagamento" | "pago";

type Visao = "diarista" | "data" | "grade_semanal";
type PeriodoRapido = "semana_atual" | "semana_anterior" | "proxima_semana" | "personalizado";

const RhDiaristasPainel = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("semana_atual");

    // Inicializa com semana atual em vez de mês atual, se o filtro rápido for "semana_atual"
    const [inicio, setInicio] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    const [fim, setFim] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));

    const [visao, setVisao] = useState<Visao>("diarista");
    const [statusFiltro, setStatusFiltro] = useState<StatusFilter>("todos");
    const [nomeFiltro, setNomeFiltro] = useState("");
    const [funcaoFiltro, setFuncaoFiltro] = useState("todos");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [openFechamento, setOpenFechamento] = useState(false);
    const [obsLote, setObsLote] = useState("");
    const [confirmText, setConfirmText] = useState("");

    const { data: perfil } = useQuery({
        queryKey: ["perfil_usuario", user?.id],
        queryFn: () => (user?.id ? PerfilUsuarioService.getByUserId(user.id) : Promise.resolve(null)),
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    const empresaId = perfil?.empresa_id ?? ((empresas as any[])[0]?.id ?? "");

    const { data: lancamentos = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ["lancamentos_diaristas_painel", empresaId, inicio, fim, statusFiltro === "todos" ? undefined : statusFiltro],
        queryFn: () =>
            LancamentoDiaristaService.getByPeriodo(
                empresaId,
                inicio,
                fim,
                statusFiltro !== "todos" ? { status: statusFiltro as any } : undefined,
            ),
        enabled: !!empresaId,
    });

    const { data: lotes = [], refetch: refetchLotes } = useQuery({
        queryKey: ["lotes_fechamento", empresaId],
        queryFn: () => LoteFechamentoDiaristaService.getByEmpresa(empresaId),
        enabled: !!empresaId,
    });

    // Agrupar lançamentos por diarista
    const dadosAgrupados = useMemo(() => {
        let items = lancamentos as any[];

        if (nomeFiltro) {
            const q = nomeFiltro.toLowerCase();
            items = items.filter((l) => l.nome_colaborador.toLowerCase().includes(q));
        }
        if (funcaoFiltro !== "todos") {
            items = items.filter((l) => l.funcao_colaborador === funcaoFiltro);
        }

        const map: Record<string, {
            diarista_id: string;
            nome: string;
            funcao: string;
            lancamentos: any[];
            contagem: Record<string, number>;
            totalDiarias: number;
            valorTotal: number;
            status: string;
        }> = {};

        items.forEach((l) => {
            const key = l.diarista_id;
            if (!map[key]) {
                map[key] = {
                    diarista_id: l.diarista_id,
                    nome: l.nome_colaborador,
                    funcao: l.funcao_colaborador ?? "—",
                    lancamentos: [],
                    contagem: {},
                    totalDiarias: 0,
                    valorTotal: 0,
                    status: l.status,
                };
            }
            map[key].lancamentos.push(l);
            map[key].contagem[l.codigo_marcacao] = (map[key].contagem[l.codigo_marcacao] || 0) + 1;
            map[key].totalDiarias += Number(l.quantidade_diaria || 0);
            map[key].valorTotal += Number(l.valor_calculado || 0);
        });

        return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [lancamentos, nomeFiltro, funcaoFiltro]);

    // Agrupar lançamentos por data
    const dadosAgrupadosPorData = useMemo(() => {
        let items = lancamentos as any[];

        if (nomeFiltro) {
            const q = nomeFiltro.toLowerCase();
            items = items.filter((l) => l.nome_colaborador.toLowerCase().includes(q));
        }
        if (funcaoFiltro !== "todos") {
            items = items.filter((l) => l.funcao_colaborador === funcaoFiltro);
        }

        const map: Record<string, {
            data_lancamento: string;
            lancamentos: any[];
            totalDiaristas: number;
            totalDiarias: number;
            valorTotal: number;
        }> = {};

        items.forEach((l) => {
            const key = l.data_lancamento;
            if (!map[key]) {
                map[key] = {
                    data_lancamento: key,
                    lancamentos: [],
                    totalDiaristas: 0,
                    totalDiarias: 0,
                    valorTotal: 0,
                };
            }
            map[key].lancamentos.push(l);
            map[key].totalDiarias += Number(l.quantidade_diaria || 0);
            map[key].valorTotal += Number(l.valor_calculado || 0);
        });

        return Object.values(map)
            .sort((a, b) => new Date(b.data_lancamento).getTime() - new Date(a.data_lancamento).getTime())
            .map(g => ({
                ...g,
                totalDiaristas: new Set(g.lancamentos.map((l) => l.diarista_id)).size
            }));
    }, [lancamentos, nomeFiltro, funcaoFiltro]);

    const totalGeral = useMemo(() => ({
        valorTotal: dadosAgrupados.reduce((a, g) => a + g.valorTotal, 0),
        totalDiaristas: dadosAgrupados.length,
        totalRegistros: (lancamentos as any[]).length,
        emAberto: (lancamentos as any[]).filter((l) => l.status === "em_aberto").length,
    }), [dadosAgrupados, lancamentos]);

    const diasDaSemanaBase = useMemo(() => {
        try {
            return eachDayOfInterval({ start: new Date(inicio + "T12:00:00"), end: new Date(fim + "T12:00:00") });
        } catch {
            return [];
        }
    }, [inicio, fim]);

    const funcoes = useMemo(() => {
        const set = new Set((lancamentos as any[]).map((l) => l.funcao_colaborador).filter(Boolean));
        return Array.from(set);
    }, [lancamentos]);

    const changePeriodoRapido = (periodo: PeriodoRapido) => {
        setPeriodoRapido(periodo);
        const hoje = new Date();
        switch (periodo) {
            case "semana_atual":
                setInicio(format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setFim(format(endOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                break;
            case "semana_anterior":
                const semanaAnterior = subWeeks(hoje, 1);
                setInicio(format(startOfWeek(semanaAnterior, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setFim(format(endOfWeek(semanaAnterior, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                break;
            case "proxima_semana":
                const proximaSemana = addWeeks(hoje, 1);
                setInicio(format(startOfWeek(proximaSemana, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setFim(format(endOfWeek(proximaSemana, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                break;
            default:
                break;
        }
    };

    const fecharMutation = useMutation({
        mutationFn: () => {
            if (!user?.id) throw new Error("Usuário não identificado.");
            return LoteFechamentoDiaristaService.fecharPeriodo({
                empresaId: empresaId,
                periodoInicio: inicio,
                periodoFim: fim,
                fechadoPor: user.id,
                fechadoPorNome: perfil?.nome_completo || user.email,
                observacoes: obsLote || undefined,
            });
        },
        onSuccess: (lote) => {
            toast.success(`Período fechado. ${lote.total_registros} registros · ${formatCurrency(lote.valor_total)}`);
            setOpenFechamento(false);
            setObsLote("");
            setConfirmText("");
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
        },
        onError: (err: any) => toast.error("Erro ao fechar período.", { description: err.message }),
    });

    const exportarXlsx = async () => {
        try {
            const { utils, writeFile } = await import("xlsx");
            const rows = dadosAgrupados.flatMap((g) =>
                g.lancamentos.map((l: any) => ({
                    Colaborador: l.nome_colaborador,
                    CPF: l.cpf_colaborador ?? "",
                    Função: l.funcao_colaborador ?? "",
                    Data: l.data_lancamento,
                    Marcação: l.codigo_marcacao,
                    "Qtd Diárias": l.quantidade_diaria,
                    "Valor Diária Base": l.valor_diaria_base,
                    "Valor Calculado": l.valor_calculado,
                    "Cliente/Unidade": l.cliente_unidade ?? "",
                    "Operação/Serviço": l.operacao_servico ?? "",
                    Encarregado: l.encarregado_nome ?? "",
                    Status: l.status,
                    Observação: l.observacao ?? "",
                })),
            );

            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Diaristas");
            writeFile(wb, `diaristas_${inicio}_${fim}.xlsx`);
            toast.success("Planilha exportada com sucesso.");
        } catch {
            toast.error("Instale a dependência: npm install xlsx");
        }
    };

    return (
        <AppShell title="Painel de Diaristas" subtitle="Acompanhamento consolidado · formato planilha">
            <div className="space-y-4">

                {/* KPIs rápidos */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "Diaristas no período", value: totalGeral.totalDiaristas },
                        { label: "Registros totais", value: totalGeral.totalRegistros },
                        { label: "Em aberto", value: totalGeral.emAberto, color: totalGeral.emAberto > 0 ? "text-amber-600" : "text-emerald-600" },
                        { label: "Valor total", value: formatCurrency(totalGeral.valorTotal), large: true },
                    ].map((k) => (
                        <div key={k.label} className="esc-card p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                            <p className={cn("font-bold text-foreground", k.color, k.large ? "text-lg font-mono" : "text-2xl")}>{k.value}</p>
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div className="space-y-4 esc-card p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1">
                            <Label className="text-xs">Filtro rápido</Label>
                            <Select value={periodoRapido} onValueChange={(v) => changePeriodoRapido(v as PeriodoRapido)}>
                                <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="semana_atual">Semana atual</SelectItem>
                                    <SelectItem value="semana_anterior">Semana anterior</SelectItem>
                                    <SelectItem value="proxima_semana">Próxima semana</SelectItem>
                                    <SelectItem value="personalizado">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Início</Label>
                            <Input type="date" className="h-8 text-sm w-36" value={inicio} onChange={(e) => { setInicio(e.target.value); setPeriodoRapido("personalizado"); }} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Fim</Label>
                            <Input type="date" className="h-8 text-sm w-36" value={fim} onChange={(e) => { setFim(e.target.value); setPeriodoRapido("personalizado"); }} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFilter)}>
                                <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="em_aberto">Em aberto</SelectItem>
                                    <SelectItem value="fechado_para_pagamento">Fechado / aguardando pagamento</SelectItem>
                                    <SelectItem value="pago">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Função</Label>
                            <Select value={funcaoFiltro} onValueChange={setFuncaoFiltro}>
                                <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todas</SelectItem>
                                    {funcoes.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[160px]">
                            <Label className="text-xs">Nome</Label>
                            <Input className="h-8 text-sm" placeholder="Filtrar por nome..." value={nomeFiltro} onChange={(e) => setNomeFiltro(e.target.value)} />
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => refetch()}>
                                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} /> Atualizar
                            </Button>
                            <Button variant="outline" size="sm" className="h-8" onClick={exportarXlsx} disabled={dadosAgrupados.length === 0}>
                                <Download className="h-3.5 w-3.5 mr-1" /> Exportar
                            </Button>
                            <Button size="sm" className="h-8 font-bold bg-blue-600 hover:bg-blue-700" onClick={() => setOpenFechamento(true)} disabled={totalGeral.emAberto === 0}>
                                <Lock className="h-3.5 w-3.5 mr-1" /> Fechar período
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    {/* Alternância de Visão */}
                    <div className="flex bg-muted p-1 rounded-lg w-max mb-1 sm:mb-0">
                        <button
                            className={cn(
                                "flex items-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                visao === "diarista" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setVisao("diarista")}
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Agrupar por Diarista
                        </button>
                        <button
                            className={cn(
                                "flex items-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                visao === "data" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setVisao("data")}
                        >
                            <Calendar className="h-4 w-4 mr-2" />
                            Agrupar por Data
                        </button>
                        <button
                            className={cn(
                                "flex items-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                visao === "grade_semanal" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setVisao("grade_semanal")}
                        >
                            <TableIcon className="h-4 w-4 mr-2" />
                            Grade Semanal
                        </button>
                    </div>

                    {visao === "grade_semanal" && (
                        <div className="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500"></span> <b>P</b> = Diária completa</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500"></span> <b>MP</b> = Meia diária</span>
                            <span className="flex items-center gap-1.5"><span className="text-muted-foreground font-bold leading-none">-</span> Sem lançamento</span>
                        </div>
                    )}
                </div>

                {/* Tabela consolidada */}
                <section className="esc-card overflow-x-auto">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Carregando...</p>
                        </div>
                    ) : dadosAgrupados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                            <CalendarDays className="h-10 w-10 text-muted-foreground" />
                            <p className="font-medium text-foreground">Nenhum lançamento encontrado</p>
                            <p className="text-sm text-muted-foreground">Ajuste os filtros ou peça ao encarregado para registrar as presenças.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                {visao === "diarista" ? (
                                    <tr className="text-left">
                                        <th className="px-5 h-11 font-medium"></th>
                                        <th className="px-3 h-11 font-medium">Diarista</th>
                                        <th className="px-3 h-11 font-medium">Função</th>
                                        <th className="px-3 h-11 font-medium text-center">Resumo Marcações</th>
                                        <th className="px-3 h-11 font-medium text-center">Total diárias</th>
                                        <th className="px-3 h-11 font-medium text-right">Valor total</th>
                                        <th className="px-5 h-11 font-medium text-center">Status</th>
                                    </tr>
                                ) : visao === "grade_semanal" ? (
                                    <tr className="text-left">
                                        <th className="px-5 h-11 font-medium min-w-[200px]">Diarista</th>
                                        {diasDaSemanaBase.map((d) => (
                                            <th key={d.toISOString()} className={cn("px-2 h-11 text-center whitespace-nowrap", isToday(d) && "bg-blue-50/50 border-b-2 border-b-blue-400")}>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider">{format(d, "eeeeee", { locale: ptBR })}</span>
                                                    <span className="font-mono text-[10px] text-foreground">{format(d, "dd/MM")}</span>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-3 h-11 font-medium text-center">Diárias</th>
                                        <th className="px-5 h-11 font-medium text-right">Valor</th>
                                    </tr>
                                ) : (
                                    <tr className="text-left">
                                        <th className="px-5 h-11 font-medium"></th>
                                        <th className="px-3 h-11 font-medium">Data</th>
                                        <th className="px-3 h-11 font-medium text-center">Diaristas</th>
                                        <th className="px-3 h-11 font-medium text-center">Total diárias</th>
                                        <th className="px-3 h-11 font-medium text-right">Valor total</th>
                                        <th className="px-5 h-11 font-medium text-center"></th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {visao === "diarista" ? (
                                    dadosAgrupados.map((g) => (
                                        <>
                                            <tr
                                                key={g.diarista_id}
                                                className="border-t border-muted hover:bg-background cursor-pointer"
                                                onClick={() => setExpandedId(expandedId === g.diarista_id ? null : g.diarista_id)}
                                            >
                                                <td className="px-5 h-12 w-8 text-muted-foreground">
                                                    {expandedId === g.diarista_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="px-3 font-medium text-foreground">{g.nome}</td>
                                                <td className="px-3 text-muted-foreground">{g.funcao}</td>
                                                <td className="px-3 text-center min-w-[120px]">
                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                        {Object.entries(g.contagem).map(([cod, qtd]) => (
                                                            <span key={cod} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                                                {qtd as number}x {cod}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 text-center font-mono">
                                                    {g.totalDiarias.toFixed(1)}
                                                </td>
                                                <td className="px-3 text-right font-mono font-semibold text-foreground">
                                                    {formatCurrency(g.valorTotal)}
                                                </td>
                                                <td className="px-5 text-center">
                                                    <span className={cn(
                                                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
                                                        g.lancamentos[0]?.status === "em_aberto" && "bg-amber-500/15 text-amber-700",
                                                        g.lancamentos[0]?.status === "fechado_para_pagamento" && "bg-blue-500/15 text-blue-700",
                                                        g.lancamentos[0]?.status === "pago" && "bg-emerald-500/15 text-emerald-700",
                                                        g.lancamentos[0]?.status === "cancelado" && "bg-muted text-muted-foreground",
                                                    )}>
                                                        {g.lancamentos[0]?.status === "em_aberto" && "Em aberto"}
                                                        {g.lancamentos[0]?.status === "fechado_para_pagamento" && "Fechado / aguardando pagamento"}
                                                        {g.lancamentos[0]?.status === "pago" && "Pago"}
                                                        {g.lancamentos[0]?.status === "cancelado" && "Cancelado"}
                                                    </span>
                                                </td>
                                            </tr>
                                            {expandedId === g.diarista_id && (
                                                <tr key={`${g.diarista_id}-detail`} className="border-t border-muted/50 bg-muted/20">
                                                    <td colSpan={8} className="px-5 py-4">
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-7 gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border/50">
                                                                <span>Data</span>
                                                                <span>Marcação</span>
                                                                <span>Qtd</span>
                                                                <span className="text-right">Diária base</span>
                                                                <span className="text-right">Valor</span>
                                                                <span>Cliente</span>
                                                                <span>Observação</span>
                                                            </div>
                                                            {g.lancamentos.map((l: any) => (
                                                                <div key={l.id} className="grid grid-cols-7 gap-2 text-xs items-center">
                                                                    <span className="font-mono text-muted-foreground">{formatDate(l.data_lancamento)}</span>
                                                                    <span className={cn(
                                                                        "font-bold",
                                                                        l.codigo_marcacao === "P" && "text-emerald-600",
                                                                        l.codigo_marcacao === "MP" && "text-amber-600",
                                                                    )}>{l.codigo_marcacao}</span>
                                                                    <span className="font-mono">{l.quantidade_diaria}</span>
                                                                    <span className="font-mono text-right text-muted-foreground">{formatCurrency(l.valor_diaria_base)}</span>
                                                                    <span className="font-mono text-right font-semibold text-foreground">{formatCurrency(l.valor_calculado)}</span>
                                                                    <span className="text-muted-foreground truncate">{l.cliente_unidade ?? "—"}</span>
                                                                    <span className="text-muted-foreground truncate">{l.observacao ?? "—"}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))
                                ) : visao === "grade_semanal" ? (
                                    dadosAgrupados.map((g) => (
                                        <tr key={g.diarista_id} className="border-t border-muted hover:bg-background">
                                            <td className="px-5 h-12">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-foreground truncate max-w-[200px]">{g.nome}</span>
                                                    <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{g.funcao}</span>
                                                </div>
                                            </td>
                                            {diasDaSemanaBase.map((d) => {
                                                const strDate = format(d, "yyyy-MM-dd");
                                                const diaLancamentos = g.lancamentos.filter((l: any) => l.data_lancamento === strDate);

                                                if (diaLancamentos.length === 0) {
                                                    return (
                                                        <td key={d.toISOString()} className={cn("px-2 text-center text-muted-foreground/30 font-medium", isToday(d) && "bg-blue-50/50")}>
                                                            -
                                                        </td>
                                                    );
                                                }

                                                const totalDia = diaLancamentos.reduce((a: number, l: any) => a + Number(l.quantidade_diaria || 0), 0);
                                                const codes = Array.from(new Set(diaLancamentos.map((l: any) => l.codigo_marcacao)));
                                                const tooltipVal = diaLancamentos.map((l: any) => `${l.quantidade_diaria}x ${l.codigo_marcacao} = ${formatCurrency(l.valor_calculado)}`).join(' | ');

                                                return (
                                                    <td key={d.toISOString()} className={cn("px-2 text-center", isToday(d) && "bg-blue-50/50")} title={tooltipVal}>
                                                        <div className="flex flex-col items-center gap-0.5 mt-1 cursor-help">
                                                            <span className={cn(
                                                                "text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                                                                codes.includes("P") && "text-emerald-700 bg-emerald-500/15",
                                                                codes.includes("MP") && "text-amber-700 bg-amber-500/15",
                                                                (!codes.includes("P") && !codes.includes("MP")) && "bg-muted text-foreground"
                                                            )}>
                                                                {codes.join("+")}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 text-center font-mono font-bold">
                                                {g.totalDiarias.toFixed(1)}
                                            </td>
                                            <td className="px-5 text-right font-mono font-semibold text-foreground">
                                                {formatCurrency(g.valorTotal)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    dadosAgrupadosPorData.map((g) => (
                                        <>
                                            <tr
                                                key={g.data_lancamento}
                                                className="border-t border-muted hover:bg-background cursor-pointer"
                                                onClick={() => setExpandedId(expandedId === g.data_lancamento ? null : g.data_lancamento)}
                                            >
                                                <td className="px-5 h-12 w-8 text-muted-foreground">
                                                    {expandedId === g.data_lancamento ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="px-3 font-mono font-bold text-foreground">{formatDate(g.data_lancamento)}</td>
                                                <td className="px-3 text-center">{g.totalDiaristas}</td>
                                                <td className="px-3 text-center font-mono">{g.totalDiarias.toFixed(1)}</td>
                                                <td className="px-3 text-right font-mono font-semibold text-foreground">
                                                    {formatCurrency(g.valorTotal)}
                                                </td>
                                                <td className="px-5 text-center"></td>
                                            </tr>
                                            {expandedId === g.data_lancamento && (
                                                <tr key={`${g.data_lancamento}-detail`} className="border-t border-muted/50 bg-muted/20">
                                                    <td colSpan={6} className="px-5 py-4">
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-7 gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border/50">
                                                                <span className="col-span-2">Colaborador / Função</span>
                                                                <span className="text-center">Marcação / Qtd</span>
                                                                <span className="text-right">Valor</span>
                                                                <span>Cliente / Op.</span>
                                                                <span className="text-center">Status</span>
                                                            </div>
                                                            {g.lancamentos.map((l: any) => (
                                                                <div key={l.id} className="grid grid-cols-7 gap-2 text-xs items-center">
                                                                    <div className="col-span-2 flex flex-col pt-1 pb-1">
                                                                        <span className="font-bold text-foreground truncate">{l.nome_colaborador}</span>
                                                                        <span className="text-[10px] text-muted-foreground truncate">{l.funcao_colaborador ?? "—"}</span>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className={cn(
                                                                            "font-bold mr-2",
                                                                            l.codigo_marcacao === "P" && "text-emerald-600",
                                                                            l.codigo_marcacao === "MP" && "text-amber-600",
                                                                        )}>{l.codigo_marcacao}</span>
                                                                        <span className="font-mono text-muted-foreground">{l.quantidade_diaria}</span>
                                                                    </div>
                                                                    <div className="text-right flex flex-col pt-1 pb-1">
                                                                        <span className="font-mono font-semibold">{formatCurrency(l.valor_calculado)}</span>
                                                                        <span className="text-[10px] font-mono text-muted-foreground">{formatCurrency(l.valor_diaria_base)} bs.</span>
                                                                    </div>
                                                                    <div className="flex flex-col pt-1 pb-1">
                                                                        <span className="truncate text-muted-foreground">{l.cliente_unidade ?? "—"}</span>
                                                                        <span className="truncate text-[10px] text-muted-foreground">{l.operacao_servico ?? "—"}</span>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className={cn(
                                                                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                                                                            l.status === "em_aberto" && "bg-amber-500/15 text-amber-700",
                                                                            l.status === "fechado_para_pagamento" && "bg-blue-500/15 text-blue-700",
                                                                            l.status === "pago" && "bg-emerald-500/15 text-emerald-700",
                                                                            l.status === "cancelado" && "bg-muted text-muted-foreground",
                                                                        )}>
                                                                            {l.status === "em_aberto" && "Aberto"}
                                                                            {l.status === "fechado_para_pagamento" && "Fechado"}
                                                                            {l.status === "pago" && "Pago"}
                                                                            {l.status === "cancelado" && "Canc"}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="border-t-2 border-border bg-muted/30">
                                <tr>
                                    {visao === "diarista" ? (
                                        <>
                                            <td className="px-5 h-11" />
                                            <td className="px-3 font-bold text-foreground">{dadosAgrupados.length} diaristas</td>
                                            <td className="px-3" />
                                            <td className="px-3 text-center text-xs text-muted-foreground">—</td>
                                        </>
                                    ) : visao === "grade_semanal" ? (
                                        <>
                                            <td className="px-5 h-11 font-bold text-foreground py-2 align-bottom">
                                                <div className="flex flex-col gap-1">
                                                    <span>Totais dia</span>
                                                    <span className="text-xs text-muted-foreground font-normal">Valor</span>
                                                </div>
                                            </td>
                                            {diasDaSemanaBase.map((d) => {
                                                const strDate = format(d, "yyyy-MM-dd");
                                                const dadosDoDia = dadosAgrupadosPorData.find(g => g.data_lancamento === strDate);
                                                const sumDia = dadosDoDia?.totalDiarias || 0;
                                                const valorDia = dadosDoDia?.valorTotal || 0;
                                                return (
                                                    <td key={d.toISOString()} className={cn("px-2 text-center py-2 align-bottom", isToday(d) && "bg-blue-50/50")}>
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-mono text-[10px] font-bold text-foreground">
                                                                {sumDia > 0 ? sumDia.toFixed(1) : "0"}
                                                            </span>
                                                            <span className="font-mono text-[9px] text-muted-foreground whitespace-nowrap">
                                                                {valorDia > 0 ? formatCurrency(valorDia) : "R$ 0,00"}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-5 h-11" />
                                            <td className="px-3 font-bold text-foreground">{dadosAgrupadosPorData.length} dias</td>
                                            <td className="px-3 text-center font-bold">{dadosAgrupadosPorData.reduce((a, g) => a + g.totalDiaristas, 0)} diaristas totais</td>
                                        </>
                                    )}
                                    <td className="px-3 text-center font-mono font-bold">
                                        {(visao === "diarista" ? dadosAgrupados : dadosAgrupadosPorData).reduce((a, g) => a + g.totalDiarias, 0).toFixed(1)}
                                    </td>
                                    <td className="px-5 text-right font-mono font-bold text-foreground text-base">
                                        {formatCurrency(totalGeral.valorTotal)}
                                    </td>
                                    {visao !== "grade_semanal" && <td className="px-5" />}
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </section>

                {/* Histórico de lotes */}
                {(lotes as any[]).length > 0 && (
                    <section className="esc-card overflow-hidden">
                        <div className="p-4 border-b border-border flex items-center gap-2">
                            <Lock className="h-4 w-4 text-muted-foreground" />
                            <h3 className="font-display font-bold text-foreground">Histórico de fechamentos</h3>
                        </div>
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-10 font-medium">Período</th>
                                    <th className="px-3 h-10 font-medium text-center">Registros</th>
                                    <th className="px-3 h-10 font-medium text-right">Valor total</th>
                                    <th className="px-3 h-10 font-medium">Fechado por</th>
                                    <th className="px-5 h-10 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(lotes as any[]).map((l: any) => (
                                    <tr key={l.id} className="border-t border-muted hover:bg-background">
                                        <td className="px-5 h-12 font-mono text-xs text-muted-foreground">
                                            {formatDate(l.periodo_inicio)} → {formatDate(l.periodo_fim)}
                                        </td>
                                        <td className="px-3 text-center font-mono">{l.total_registros}</td>
                                        <td className="px-3 text-right font-mono font-semibold">{formatCurrency(Number(l.valor_total))}</td>
                                        <td className="px-3 text-muted-foreground text-xs">{l.fechado_por_nome ?? l.fechado_por ?? "—"}</td>
                                        <td className="px-5 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
                                                l.status === "fechado_para_pagamento" && "bg-blue-500/15 text-blue-700",
                                                l.status === "pago" && "bg-emerald-500/15 text-emerald-700",
                                                l.status === "cancelado" && "bg-muted text-muted-foreground",
                                            )}>
                                                {l.status === "fechado_para_pagamento" && "Aguardando Pgto"}
                                                {l.status === "pago" && "Pago"}
                                                {l.status === "cancelado" && "Cancelado"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                )}
            </div>

            {/* Dialog de fechamento */}
            <Dialog open={openFechamento} onOpenChange={setOpenFechamento}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Fechar período para pagamento</DialogTitle>
                        <DialogDescription>
                            Isso irá agrupar <strong>{totalGeral.emAberto} registro(s) em aberto</strong> no período
                            {" "}<span className="font-mono">{formatDate(inicio)}</span> → <span className="font-mono">{formatDate(fim)}</span>{" "}
                            e alterar o status para <strong>fechado_para_pagamento</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="esc-card p-4 flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Valor a fechar</span>
                            <span className="font-mono font-bold text-foreground text-lg">{formatCurrency(totalGeral.valorTotal)}</span>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Observações (opcional)</Label>
                            <Input
                                placeholder="Ex: Pagamento quinzenário referente a 1ª quinzena de maio"
                                value={obsLote}
                                onChange={(e) => setObsLote(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5 pt-2">
                            <Label>Para confirmar, digite <span className="font-mono text-blue-600 bg-blue-50 px-1 py-0.5 rounded">CONFIRMAR</span> abaixo:</Label>
                            <Input
                                value={confirmText}
                                onChange={(e) => setConfirmText(e.target.value)}
                                placeholder="CONFIRMAR"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setOpenFechamento(false); setConfirmText(""); }}>Cancelar</Button>
                        <Button
                            onClick={() => fecharMutation.mutate()}
                            disabled={fecharMutation.isPending || confirmText !== "CONFIRMAR"}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Lock className="h-4 w-4 mr-2" />
                            {fecharMutation.isPending ? "Fechando..." : "Confirmar fechamento"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default RhDiaristasPainel;
