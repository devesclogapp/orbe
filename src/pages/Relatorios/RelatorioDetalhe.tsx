/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { ReportService } from "@/services/report.service";
import { OperacaoService, ConsolidadoService } from "@/services/base.service";
import { AuditoriaService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";
import {
    ArrowLeft,
    Download,
    Printer,
    Share2,
    Filter,
    LayoutGrid,
    FileText,
    Table as TableIcon,
    Loader2,
    Clock,
    Settings
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const RelatorioDetalhe = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    // Estados de Filtro
    const [competencia, setCompetencia] = useState(format(new Date(), "yyyy-MM"));
    const [isFilterOpen, setIsModalFilterOpen] = useState(false);

    const { data: report, isLoading: loadingCatalog, error: catalogError } = useQuery({
        queryKey: ["report_catalog_item", id],
        queryFn: async () => {
            if (!id || id === 'new') return null;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                throw new Error("Identificador de relatório inválido");
            }
            return await ReportService.getById(id);
        },
        enabled: !!id && id !== 'new',
        retry: false
    });

    const { data: reportData = [] as any[], isLoading: loadingData, refetch } = useQuery({
        queryKey: ["report_data_preview", id, report?.nome, competencia],
        queryFn: async () => {
            try {
                if (!report) return [];

                // Lógica de roteamento de dados por tipo de relatório
                if (report.nome === "Log de Auditoria") {
                    const logs = await AuditoriaService.getAll();
                    return Array.isArray(logs) ? logs : [];
                }
                if (report.nome === "Inconsistências de Ponto") {
                    const incs = await OperacaoService.getInconsistencies();
                    return Array.isArray(incs) ? incs : [];
                }
                if (report.nome === "Faturamento por Cliente") {
                    const data = await ConsolidadoService.getByCompetencia(competencia);
                    return (data as any)?.colaboradores || (data as any)?.clientes || [];
                }

                const ops = await OperacaoService.getAll();
                return Array.isArray(ops) ? ops : [];
            } catch (err) {
                console.error("Report data fetch error:", err);
                return [];
            }
        },
        enabled: !!report
    });

    const handleExport = (formatType: 'CSV' | 'Excel') => {
        if (reportData.length === 0) {
            toast.error("Não há dados para exportar");
            return;
        }

        let headers: string[] = [];
        let rows: any[] = [];

        if (report?.nome === "Log de Auditoria") {
            headers = ["Data", "Usuário", "Ação", "Módulo", "Impacto"];
            rows = reportData.map((l: any) => [
                format(new Date(l.created_at), "dd/MM/yyyy HH:mm"),
                l.user_id || "Sistema",
                l.acao,
                l.modulo,
                l.impacto
            ]);
        } else {
            headers = ["ID", "Colaborador", "Data", "Serviço", "Valor"];
            rows = reportData.map((row: any) => [
                row.id,
                row.transportadora || "N/A",
                format(new Date(row.data), "dd/MM/yyyy"),
                row.tipo_servico,
                (Number(row.quantidade) * Number(row.valor_unitario || 0)).toFixed(2)
            ]);
        }

        const content = "\uFEFF" + [
            headers.join(";"),
            ...rows.map(r => r.join(";"))
        ].join("\n");

        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${report?.nome || 'relatorio'}-${competencia}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Relatório exportado em ${formatType} para competencia ${competencia}`);
    };

    if (loadingCatalog || !report) return (
        <AppShell title="Carregando..." subtitle="Preparando relatório">
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </AppShell>
    );

    const meses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];

    const currentYear = new Date().getFullYear();
    const anos = [currentYear - 1, currentYear, currentYear + 1];

    return (
        <AppShell
            title={report?.nome || "Visualização de Relatório"}
            subtitle={report?.descricao}
            backPath="/relatorios"
        >
            <div className="space-y-6">
                {/* Cabeçalho de Ações e Filtros Aplicados */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/20 p-4 rounded-xl border border-border/50">
                    <div className="flex flex-wrap gap-2 items-center">
                        <Badge variant="outline" className="bg-background border-border/60 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 capitalize">
                            {meses[parseInt(competencia.split('-')[1]) - 1]} {competencia.split('-')[0]}
                        </Badge>
                        <Badge variant="outline" className="bg-background border-border/60 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5">Consolidado</Badge>
                        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

                        <Popover open={isFilterOpen} onOpenChange={setIsModalFilterOpen}>
                            <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 text-muted-foreground hover:text-primary transition-colors">
                                    <Filter className="h-3.5 w-3.5 mr-2" /> Editar Filtros
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 p-4" align="start">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="font-medium text-sm">Competência Financeira</h4>
                                        <p className="text-[11px] text-muted-foreground leading-tight">Selecione o mês de referência para os dados.</p>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <select
                                                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                                                value={competencia.split('-')[1]}
                                                onChange={(e) => {
                                                    const [y] = competencia.split('-');
                                                    setCompetencia(`${y}-${e.target.value}`);
                                                }}
                                            >
                                                {meses.map((m, i) => (
                                                    <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                                                ))}
                                            </select>
                                            <select
                                                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
                                                value={competencia.split('-')[0]}
                                                onChange={(e) => {
                                                    const [, m] = competencia.split('-');
                                                    setCompetencia(`${e.target.value}-${m}`);
                                                }}
                                            >
                                                {anos.map(a => (
                                                    <option key={a} value={String(a)}>{a}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full text-xs font-bold h-9"
                                        onClick={() => setIsModalFilterOpen(false)}
                                    >
                                        Aplicar Filtros
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-9 font-semibold bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                            onClick={() => navigate('/relatorios/agendamentos')}
                        >
                            <Clock className="h-4 w-4 mr-2" /> Agendar
                        </Button>
                        <Button
                            className="h-9 font-semibold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90"
                            onClick={() => handleExport('Excel')}
                        >
                            <Download className="h-4 w-4 mr-2" /> Exportar EXCEL
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground"
                            onClick={() => navigate('/relatorios/layouts')}
                        >
                            <Settings className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Indicadores do Relatório */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Métrica label="Total de Registros" value={String(reportData.length)} />
                    <Métrica
                        label="Valor Consolidado"
                        value={`R$ ${reportData.reduce((acc, curr) => acc + (Number(curr.valor_total || (curr.quantidade * curr.valor_unitario)) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    />
                    <Métrica
                        label="Inconsistências"
                        value={String(reportData.filter(r => r.status === 'inconsistente').length)}
                        status={reportData.filter(r => r.status === 'inconsistente').length > 0 ? 'warning' : 'success'}
                    />
                    <Métrica label="Competência Ref." value={`${meses[parseInt(competencia.split('-')[1]) - 1]} / ${competencia.split('-')[0]}`} />
                </div>

                {/* Tabela Principal */}
                <section className="esc-card overflow-hidden">
                    <header className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
                        <h3 className="font-display font-semibold">Dataset Consolidado</h3>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8 transition-all", viewMode === 'grid' ? "bg-background border shadow-sm text-primary" : "text-muted-foreground")}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-8 w-8 transition-all", viewMode === 'table' ? "bg-background border shadow-sm text-primary" : "text-muted-foreground")}
                                onClick={() => setViewMode('table')}
                            >
                                <TableIcon className="h-4 w-4" />
                            </Button>
                        </div>
                    </header>
                    <div className="overflow-x-auto">
                        {viewMode === 'table' ? (
                            <Table>
                                <TableHeader className="esc-table-header">
                                    {report?.nome === "Log de Auditoria" ? (
                                        <TableRow>
                                            <TableHead className="px-5">Data/Hora</TableHead>
                                            <TableHead>Usuário</TableHead>
                                            <TableHead>Módulo</TableHead>
                                            <TableHead>Ação</TableHead>
                                            <TableHead className="text-right px-5">Impacto</TableHead>
                                        </TableRow>
                                    ) : (
                                        <TableRow>
                                            <TableHead className="px-5">Identificador</TableHead>
                                            <TableHead>Colaborador</TableHead>
                                            <TableHead>Data</TableHead>
                                            <TableHead>Serviço</TableHead>
                                            <TableHead className="text-right px-5">Valor</TableHead>
                                        </TableRow>
                                    )}
                                </TableHeader>
                                <TableBody>
                                    {loadingData ? (
                                        Array.from({ length: 5 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={5}><Skeleton className="h-8 w-full" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : reportData.length > 0 ? (
                                        reportData.map((row: any) => (
                                            <TableRow key={row.id} className="hover:bg-muted/30 transition-colors text-xs">
                                                {report?.nome === "Log de Auditoria" ? (
                                                    <>
                                                        <TableCell className="px-5 font-medium">{format(new Date(row.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                                                        <TableCell>{row.user_id || "Sistema"}</TableCell>
                                                        <TableCell><Badge variant="outline" className="text-[9px] uppercase">{row.modulo}</Badge></TableCell>
                                                        <TableCell className="max-w-[200px] truncate" title={row.acao}>{row.acao}</TableCell>
                                                        <TableCell className="text-right px-5">
                                                            <Badge variant={row.impacto === 'critico' ? 'destructive' : row.impacto === 'medio' ? 'warning' : 'secondary'} className="h-5">
                                                                {row.impacto}
                                                            </Badge>
                                                        </TableCell>
                                                    </>
                                                ) : (
                                                    <>
                                                        <TableCell className="px-5 font-mono text-muted-foreground">{row.id.substring(0, 8)}</TableCell>
                                                        <TableCell className="font-medium">{row.transportadora || row.colaboradores?.nome || "N/A"}</TableCell>
                                                        <TableCell>{format(new Date(row.data), "dd/MM/yyyy")}</TableCell>
                                                        <TableCell><Badge variant="secondary" className="font-normal">{row.tipo_servico || row.status}</Badge></TableCell>
                                                        <TableCell className="text-right px-5 font-semibold">
                                                            R$ {(Number(row.quantidade || 0) * Number(row.valor_unitario || 0) || Number(row.valor_total || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                        </TableCell>
                                                    </>
                                                )}
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic">
                                                Nenhum dado encontrado para os filtros selecionados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                                {loadingData ? (
                                    Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
                                ) : reportData.map((row: any) => (
                                    <div key={row.id} className="p-4 rounded-xl border border-border/50 bg-muted/5 flex flex-col justify-between hover:border-primary/30 transition-all group">
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-tighter opacity-70">
                                                    #{row.id.substring(0, 8)}
                                                </Badge>
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {format(new Date(row.data || row.created_at), "dd/MM/yyyy")}
                                                </span>
                                            </div>
                                            <h4 className="font-semibold text-sm group-hover:text-primary transition-colors">
                                                {row.transportadora || row.colaboradores?.nome || row.user_id || "Sistema"}
                                            </h4>
                                            <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                                                {row.acao || row.tipo_servico || row.status || "Operação padrão"}
                                            </p>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                                            <Badge variant={row.impacto === 'critico' ? 'destructive' : 'secondary'} className="h-4 text-[9px]">
                                                {row.impacto || "Geral"}
                                            </Badge>
                                            <span className="font-display font-bold text-sm text-foreground">
                                                {row.valor_total ?
                                                    `R$ ${Number(row.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` :
                                                    "Snapshot"}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <footer className="px-5 py-3 border-t border-border bg-muted/10 flex justify-between items-center text-xs text-muted-foreground uppercase tracking-widest font-medium">
                        <span>Snapshot em Tempo Real</span>
                        <span>Exibindo 1 a {reportData.length} de {reportData.length} registros</span>
                    </footer>
                </section>
            </div>
        </AppShell>
    );
};

const Métrica = ({ label, value, status }: { label: string; value: string; status?: 'success' | 'warning' | 'default' }) => (
    <div className="esc-card p-4">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className={`mt-1 font-display font-bold text-xl ${status === 'success' ? 'text-success' : 'text-foreground'}`}>
            {value}
        </div>
    </div>
);

export default RelatorioDetalhe;
