import { AppShell } from "@/components/layout/AppShell";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "@/services/report.service";
import { OperacaoService, ConsolidadoService } from "@/services/base.service";
import { AuditoriaService } from "@/services/v4.service";
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
    Loader2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

    const { data: report, isLoading: loadingCatalog, error: catalogError } = useQuery({
        queryKey: ["report_catalog_item", id],
        queryFn: async () => {
            if (!id || id === 'new') return null;
            // Validação de UUID simples para evitar 400 do Supabase
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(id)) {
                throw new Error("Identificador de relatório inválido");
            }
            return await ReportService.getById(id);
        },
        enabled: !!id && id !== 'new',
        retry: false
    });

    const { data: reportData = [] as any[], isLoading: loadingData } = useQuery({
        queryKey: ["report_data_preview", id, report?.nome],
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
                    const currentMonth = format(new Date(), "yyyy-MM");
                    const data = await ConsolidadoService.getByCompetencia(currentMonth);
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

        const content = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${report?.nome || 'relatorio'}-${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Relatório exportado em ${formatType}`);
    };

    if (loadingCatalog || !report) return (
        <AppShell title="Carregando..." subtitle="Preparando relatório">
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        </AppShell>
    );

    return (
        <AppShell
            title={report?.nome || "Visualização de Relatório"}
            subtitle={report?.descricao}
            backPath="/relatorios"
        >
            <div className="space-y-6">
                {/* Cabeçalho de Ações e Filtros Aplicados */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="bg-background">Competência: Abril 2024</Badge>
                        <Badge variant="outline" className="bg-background">Filtro: Todos os Colaboradores</Badge>
                        <Button variant="ghost" size="sm" className="h-8 text-primary font-semibold">
                            <Filter className="h-3 w-3 mr-2" /> Editar Filtros
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => window.print()}>
                            <Printer className="h-4 w-4 mr-2" /> Imprimir
                        </Button>
                        <div className="flex border rounded-lg overflow-hidden">
                            <Button variant="ghost" size="sm" className="rounded-none border-r" onClick={() => handleExport('CSV')}>
                                <FileText className="h-4 w-4 mr-2" /> PDF / CSV
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-none" onClick={() => handleExport('Excel')}>
                                <Download className="h-4 w-4 mr-2" /> Excel
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Indicadores do Relatório */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Métrica label="Total de Registros" value={String(reportData.length)} />
                    <Métrica label="Valor Consolidado" value="R$ 14.520,00" />
                    <Métrica label="Inconsistências" value="0" status="success" />
                    <Métrica label="Data da Geração" value="19/04/2024" />
                </div>

                {/* Tabela Principal */}
                <section className="esc-card overflow-hidden">
                    <header className="px-5 py-4 border-b border-border flex justify-between items-center bg-muted/20">
                        <h3 className="font-display font-semibold">Dataset Consolidado</h3>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8"><LayoutGrid className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 select-none bg-background border shadow-sm"><TableIcon className="h-4 w-4" /></Button>
                        </div>
                    </header>
                    <div className="overflow-x-auto">
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
