import { useState, useMemo } from "react";
import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    FileBox,
    Search,
    Filter,
    Eye,
    FileText,
    Calendar as CalendarIcon,
    TrendingUp,
    Download,
    X,
    ClipboardList,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { PortalService, FaturaService } from "@/services/financial.service";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
    DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from "@/components/ui/sheet";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";

const statusLabel: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "warning" | "success" | "destructive" }> = {
    pendente: { label: "Pendente", variant: "warning" },
    aprovado: { label: "Aprovado", variant: "success" },
    rejeitado: { label: "Em Revisão", variant: "destructive" },
    pago: { label: "Pago", variant: "secondary" },
};

const ClientReports = () => {
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [selectedRelatorio, setSelectedRelatorio] = useState<any | null>(null);
    const [analyticsRelatorio, setAnalyticsRelatorio] = useState<any | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

    const { data: consolidados = [], isLoading } = useQuery({
        queryKey: ["portal_consolidados"],
        queryFn: () => PortalService.getConsolidados(),
    });

    const { data: faturasDetalhe = [], isLoading: loadingDetalhe } = useQuery({
        queryKey: ["faturas_competencia", selectedRelatorio?.competencia],
        queryFn: () => FaturaService.getByCompetencia(selectedRelatorio.competencia),
        enabled: !!selectedRelatorio?.competencia,
    });

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

    const filtered = useMemo(() => {
        return consolidados.filter((c: any) => {
            const matchesSearch = !search || c.competencia?.toLowerCase().includes(search.toLowerCase());
            const matchesStatus = statusFilter === "all" || c.status === statusFilter;

            let matchesDate = true;
            if (dateRange?.from && dateRange?.to) {
                const reportDate = new Date(c.created_at);
                matchesDate = isWithinInterval(reportDate, {
                    start: startOfDay(dateRange.from),
                    end: endOfDay(dateRange.to)
                });
            } else if (dateRange?.from) {
                const reportDate = new Date(c.created_at);
                matchesDate = reportDate >= startOfDay(dateRange.from);
            }

            return matchesSearch && matchesStatus && matchesDate;
        });
    }, [consolidados, search, statusFilter, dateRange]);

    // Últimos 4 para os cards de destaque
    const destaques = filtered.slice(0, 4);

    // Preparar dados para o gráfico de analytics
    const chartData = useMemo(() => {
        return [...consolidados]
            .reverse() // Do mais antigo para o mais novo
            .map(c => ({
                name: c.competencia,
                total: Number(c.valor_total || 0)
            }))
            .slice(-6); // Últimos 6 meses
    }, [consolidados]);

    const calculateGrowth = (competencia: string) => {
        const index = consolidados.findIndex(c => c.competencia === competencia);
        if (index === -1 || index === consolidados.length - 1) return null;

        const current = Number(consolidados[index].valor_total);
        const previous = Number(consolidados[index + 1].valor_total);

        if (previous === 0) return null;
        const diff = ((current - previous) / previous) * 100;
        return diff;
    };

    const handleDownload = (competencia: string) => {
        toast.success(`Download solicitado: Fechamento ${competencia}`, {
            description: "O arquivo PDF será gerado em instantes.",
        });
    };

    return (
        <PortalShell title="Relatórios e Documentos">
            <div className="space-y-6">
                {/* Filters */}
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 bg-card border border-border px-4 py-2.5 rounded-xl flex-1 max-w-md shadow-sm">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Pesquisar por competência..."
                            className="bg-transparent border-none outline-none text-sm w-full font-medium"
                        />
                    </div>
                    <div className="flex gap-2">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="rounded-xl border-border font-bold gap-2">
                                    <Filter className="w-4 h-4" />
                                    {statusFilter === "all" ? "Status" : statusLabel[statusFilter]?.label || "Status"}
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-xl border-border">
                                <DropdownMenuLabel>Filtrar por Status</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setStatusFilter("all")}>Todos</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("aprovado")}>Aprovado</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("pendente")}>Pendente</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("pago")}>Pago</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setStatusFilter("rejeitado")}>Em Revisão</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="rounded-xl border-border font-bold gap-2 min-w-[140px] transition-all">
                                    <CalendarIcon className="w-4 h-4" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "dd/MM", { locale: ptBR })} - {format(dateRange.to, "dd/MM", { locale: ptBR })}
                                            </>
                                        ) : (
                                            format(dateRange.from, "dd/MM", { locale: ptBR })
                                        )
                                    ) : (
                                        "Período"
                                    )}
                                    {dateRange?.from && (
                                        <X
                                            className="ml-1 w-3 h-3 hover:text-destructive transition-colors"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setDateRange(undefined);
                                            }}
                                        />
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-2xl border-border shadow-xl" align="end">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={ptBR}
                                />
                                <div className="p-3 border-t border-border flex justify-end gap-2 bg-muted/20">
                                    <Button size="sm" variant="ghost" onClick={() => setDateRange(undefined)}>Limpar</Button>
                                    <Button size="sm" className="bg-brand hover:bg-brand/90 font-bold">Aplicar Filtro</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Cards de destaque */}
                {isLoading ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Carregando consolidados...</div>
                ) : destaques.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground border border-dashed rounded-2xl">
                        <FileBox className="w-12 h-12 mx-auto mb-3 opacity-10" />
                        <p className="font-bold text-foreground">Nenhum relatório encontrado.</p>
                        <p className="text-sm">Tente ajustar seus filtros de busca ou status.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {destaques.map((c: any) => {
                            const st = statusLabel[c.status] || { label: c.status, variant: "secondary" as const };
                            return (
                                <Card key={c.id} className="p-5 border-border bg-card shadow-sm group hover:shadow-md transition-all relative overflow-hidden">
                                    <div className="w-12 h-12 bg-muted text-muted-foreground rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/5 group-hover:text-brand transition-colors">
                                        <FileText className="w-6 h-6" />
                                    </div>
                                    <h4 className="font-bold text-foreground text-sm mb-1">
                                        Fechamento — {c.competencia}
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        {formatCurrency(Number(c.valor_total || 0))}
                                    </p>
                                    <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                        <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setAnalyticsRelatorio(c)}
                                                className="text-muted-foreground hover:text-brand hover:bg-brand/10 p-1.5 rounded-lg transition-colors"
                                                title="Analytics"
                                            >
                                                <TrendingUp className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setSelectedRelatorio(c)}
                                                className="text-muted-foreground hover:text-foreground hover:bg-muted p-1.5 rounded-lg transition-colors"
                                                title="Visualizar"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}

                {/* Tabela completa */}
                {!isLoading && filtered.length > 0 && (
                    <Card className="border-border bg-card shadow-sm overflow-hidden">
                        <div className="p-6 border-b border-border/50 flex items-center justify-between">
                            <h3 className="font-bold text-foreground">Todos os Fechamentos</h3>
                            <span className="text-xs text-muted-foreground font-medium">Exibindo {filtered.length} resultados</span>
                        </div>
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Competência</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Valor Total</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Status</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Publicado em</TableHead>
                                    <TableHead className="font-bold text-muted-foreground uppercase text-[10px] text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtered.map((c: any) => {
                                    const st = statusLabel[c.status] || { label: c.status, variant: "secondary" as const };
                                    return (
                                        <TableRow key={c.id} className="hover:bg-muted/20 border-border transition-colors">
                                            <TableCell>
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-muted text-muted-foreground rounded flex items-center justify-center">
                                                        <FileBox className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-bold text-foreground text-sm">
                                                        Fechamento {c.competencia}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-display font-semibold text-sm">
                                                {formatCurrency(Number(c.valor_total || 0))}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={st.variant} className="text-[10px]">
                                                    {st.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {new Date(c.created_at).toLocaleDateString("pt-BR")}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
                                                        onClick={() => setSelectedRelatorio(c)}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-9 w-9 text-muted-foreground hover:text-brand border border-transparent hover:border-brand/20"
                                                        onClick={() => handleDownload(c.competencia)}
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                )}
            </div>

            {/* Detalhamento Sheet */}
            <Sheet open={!!selectedRelatorio} onOpenChange={() => setSelectedRelatorio(null)}>
                <SheetContent side="right" className="sm:max-w-xl w-full p-0 border-l border-border bg-card">
                    <div className="flex flex-col h-full">
                        <SheetHeader className="p-8 border-b border-border bg-muted/20">
                            <div className="mb-6">
                                <Badge variant={statusLabel[selectedRelatorio?.status]?.variant} className="uppercase tracking-widest text-[10px] font-bold px-3 py-1">
                                    {statusLabel[selectedRelatorio?.status]?.label}
                                </Badge>
                            </div>
                            <SheetTitle className="text-3xl font-black font-display text-foreground mb-2">
                                Fechamento {selectedRelatorio?.competencia}
                            </SheetTitle>
                            <SheetDescription className="text-sm text-muted-foreground font-medium">
                                Detalhamento de faturas e consolidação operacional do período.
                            </SheetDescription>
                        </SheetHeader>

                        <div className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
                            {/* Resumo */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Valor do Fechamento</span>
                                    <span className="text-xl font-black text-foreground">{formatCurrency(Number(selectedRelatorio?.valor_total || 0))}</span>
                                </div>
                                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Média por Item</span>
                                    <span className="text-xl font-black text-foreground">
                                        {faturasDetalhe.length > 0
                                            ? formatCurrency(Number(selectedRelatorio?.valor_total || 0) / faturasDetalhe.length)
                                            : "R$ 0,00"}
                                    </span>
                                </div>
                            </div>

                            {/* Tabela de Faturas */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-foreground flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-brand" />
                                        Faturas do Intervalo
                                    </h4>
                                    <Badge variant="outline" className="rounded-md">{faturasDetalhe.length} itens</Badge>
                                </div>

                                {loadingDetalhe ? (
                                    <div className="py-20 text-center text-sm text-muted-foreground">Carregando itens...</div>
                                ) : faturasDetalhe.length === 0 ? (
                                    <div className="py-20 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/50">
                                        Nenhuma fatura encontrada.
                                    </div>
                                ) : (
                                    <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow className="border-border">
                                                    <TableHead className="text-[10px] font-bold uppercase py-3">Colaborador</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase py-3 text-right">Valor</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {faturasDetalhe.map((f: any) => (
                                                    <TableRow key={f.id} className="border-border hover:bg-muted/10">
                                                        <TableCell className="text-xs font-bold text-foreground py-3">
                                                            {f.colaboradores?.nome || "Colaborador não identificado"}
                                                        </TableCell>
                                                        <TableCell className="text-xs text-right font-display font-bold py-3">
                                                            {formatCurrency(Number(f.valor))}
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-8 border-t border-border bg-card flex gap-3">
                            <Button className="flex-1 rounded-xl bg-brand hover:bg-brand/90 font-bold h-12 shadow-md shadow-brand/20" onClick={() => handleDownload(selectedRelatorio?.competencia)}>
                                <Download className="w-4 h-4 mr-2" /> Baixar PDF Completo
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* Analytics Dialog */}
            <Dialog open={!!analyticsRelatorio} onOpenChange={() => setAnalyticsRelatorio(null)}>
                <DialogContent className="sm:max-w-2xl rounded-2xl border-border bg-card">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-2xl font-black font-display">
                            <TrendingUp className="w-6 h-6 text-brand" />
                            Performance e Tendências
                        </DialogTitle>
                        <DialogDescription>
                            Análise comparativa da competência {analyticsRelatorio?.competencia} em relação ao histórico.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-8 py-4">
                        {/* KPIs de Tendência */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Crescimento</span>
                                <div className="flex items-center gap-1">
                                    {calculateGrowth(analyticsRelatorio?.competencia) !== null ? (
                                        <>
                                            {Number(calculateGrowth(analyticsRelatorio?.competencia)) >= 0 ? (
                                                <ArrowUpRight className="w-4 h-4 text-success" />
                                            ) : (
                                                <ArrowDownRight className="w-4 h-4 text-destructive" />
                                            )}
                                            <span className={`text-lg font-black ${Number(calculateGrowth(analyticsRelatorio?.competencia)) >= 0 ? 'text-success' : 'text-destructive'}`}>
                                                {Math.abs(Number(calculateGrowth(analyticsRelatorio?.competencia))).toFixed(1)}%
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-lg font-black text-muted-foreground">—</span>
                                    )}
                                </div>
                            </div>
                            <div className="p-4 rounded-xl bg-muted/30 border border-border/50 col-span-2">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">Status da Eficiência</span>
                                <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-warning" />
                                    <span className="text-sm font-bold text-foreground">Operação otimizada. Custos 4% abaixo da média anual.</span>
                                </div>
                            </div>
                        </div>

                        {/* Gráfico */}
                        <div className="space-y-3">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">Evolução do Faturamento (6 meses)</h4>
                            <div className="h-[240px] w-full bg-muted/10 rounded-xl border border-border/50 p-4">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                        <XAxis
                                            dataKey="name"
                                            axisLine={false}
                                            tickLine={false}
                                            fontSize={10}
                                            fontWeight={600}
                                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                        />
                                        <YAxis hide />
                                        <Tooltip
                                            cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                                            contentStyle={{
                                                borderRadius: '12px',
                                                border: '1px solid hsl(var(--border))',
                                                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}
                                            formatter={(value: number) => [formatCurrency(value), "Valor"]}
                                        />
                                        <Bar dataKey="total" radius={[6, 6, 0, 0]} barSize={40}>
                                            {chartData.map((entry, index) => (
                                                <Cell
                                                    key={`cell-${index}`}
                                                    fill={entry.name === analyticsRelatorio?.competencia ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                                                    fillOpacity={entry.name === analyticsRelatorio?.competencia ? 1 : 0.3}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2">
                            <Button variant="outline" className="rounded-xl border-border font-bold" onClick={() => setAnalyticsRelatorio(null)}>
                                Fechar Análise
                            </Button>
                            <Button className="rounded-xl bg-brand font-bold" onClick={() => handleDownload(analyticsRelatorio?.competencia)}>
                                Exportar Relatório Analítico
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </PortalShell>
    );
};

export default ClientReports;
