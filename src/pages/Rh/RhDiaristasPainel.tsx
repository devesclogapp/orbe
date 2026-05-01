import { useMemo, useState } from "react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
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
import {
    CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Lock, RefreshCw,
} from "lucide-react";

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
    format(new Date(d + "T12:00:00"), "dd/MM", { locale: ptBR });

type StatusFilter = "todos" | "em_aberto" | "fechado_para_pagamento" | "pago";

const RhDiaristasPainel = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [inicio, setInicio] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
    const [fim, setFim] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
    const [statusFiltro, setStatusFiltro] = useState<StatusFilter>("todos");
    const [nomeFiltro, setNomeFiltro] = useState("");
    const [funcaoFiltro, setFuncaoFiltro] = useState("todos");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [openFechamento, setOpenFechamento] = useState(false);
    const [obsLote, setObsLote] = useState("");

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

    const totalGeral = useMemo(() => ({
        valorTotal: dadosAgrupados.reduce((a, g) => a + g.valorTotal, 0),
        totalDiaristas: dadosAgrupados.length,
        totalRegistros: (lancamentos as any[]).length,
        emAberto: (lancamentos as any[]).filter((l) => l.status === "em_aberto").length,
    }), [dadosAgrupados, lancamentos]);

    const funcoes = useMemo(() => {
        const set = new Set((lancamentos as any[]).map((l) => l.funcao_colaborador).filter(Boolean));
        return Array.from(set);
    }, [lancamentos]);

    const fecharMutation = useMutation({
        mutationFn: () => {
            if (!user?.id) throw new Error("Usuário não identificado.");
            return LoteFechamentoDiaristaService.fecharPeriodo({
                empresaId: empresaId,
                periodoInicio: inicio,
                periodoFim: fim,
                fechadoPor: user.id,
                observacoes: obsLote || undefined,
            });
        },
        onSuccess: (lote) => {
            toast.success(`Período fechado. ${lote.total_registros} registros · ${formatCurrency(lote.valor_total)}`);
            setOpenFechamento(false);
            setObsLote("");
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
                <div className="esc-card p-4 flex flex-wrap gap-3 items-end">
                    <div className="space-y-1">
                        <Label className="text-xs">Início</Label>
                        <Input type="date" className="h-8 text-sm w-36" value={inicio} onChange={(e) => setInicio(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Fim</Label>
                        <Input type="date" className="h-8 text-sm w-36" value={fim} onChange={(e) => setFim(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Status</Label>
                        <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFilter)}>
                            <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos</SelectItem>
                                <SelectItem value="em_aberto">Em aberto</SelectItem>
                                <SelectItem value="fechado_para_pagamento">Fechado</SelectItem>
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
                        <Button size="sm" className="h-8 font-bold" onClick={() => setOpenFechamento(true)} disabled={totalGeral.emAberto === 0}>
                            <Lock className="h-3.5 w-3.5 mr-1" /> Fechar período
                        </Button>
                    </div>
                </div>

                {/* Tabela consolidada */}
                <section className="esc-card overflow-hidden">
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
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium"></th>
                                    <th className="px-3 h-11 font-medium">Diarista</th>
                                    <th className="px-3 h-11 font-medium">Função</th>
                                    <th className="px-3 h-11 font-medium text-center">Resumo Marcações</th>
                                    <th className="px-3 h-11 font-medium text-center">Total diárias</th>
                                    <th className="px-3 h-11 font-medium text-right">Valor total</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dadosAgrupados.map((g) => (
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
                                                    {g.lancamentos[0]?.status === "fechado_para_pagamento" && "Fechado"}
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
                                ))}
                            </tbody>
                            <tfoot className="border-t-2 border-border bg-muted/30">
                                <tr>
                                    <td className="px-5 h-11" />
                                    <td className="px-3 font-bold text-foreground">{dadosAgrupados.length} diaristas</td>
                                    <td className="px-3" />
                                    <td className="px-3 text-center text-xs text-muted-foreground">—</td>
                                    <td className="px-3 text-center font-mono font-bold">
                                        {dadosAgrupados.reduce((a, g) => a + g.totalDiarias, 0).toFixed(1)}
                                    </td>
                                    <td className="px-3 text-right font-mono font-bold text-foreground text-base">
                                        {formatCurrency(totalGeral.valorTotal)}
                                    </td>
                                    <td className="px-5" />
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
                                        <td className="px-3 text-muted-foreground text-xs">{l.fechado_por ?? "—"}</td>
                                        <td className="px-5 text-center">
                                            <span className={cn(
                                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
                                                l.status === "fechado" && "bg-blue-500/15 text-blue-700",
                                                l.status === "pago" && "bg-emerald-500/15 text-emerald-700",
                                                l.status === "cancelado" && "bg-muted text-muted-foreground",
                                            )}>
                                                {l.status === "fechado" && "Fechado"}
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
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpenFechamento(false)}>Cancelar</Button>
                        <Button
                            onClick={() => fecharMutation.mutate()}
                            disabled={fecharMutation.isPending}
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
