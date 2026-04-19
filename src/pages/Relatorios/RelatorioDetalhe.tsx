import { AppShell } from "@/components/layout/AppShell";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "@/services/report.service";
import { OperacaoService } from "@/services/base.service";
import { Button } from "@/components/ui/button";
import {
    ArrowLeft,
    Download,
    Printer,
    Share2,
    Filter,
    LayoutGrid,
    FileText,
    Table as TableIcon
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

    const { data: report, isLoading: loadingCatalog } = useQuery({
        queryKey: ["report_catalog_item", id],
        queryFn: () => ReportService.getById(id!),
        enabled: !!id,
    });

    // Simulando carregamento de dados reais baseando-se no tipo de relatório
    // No MVP usaremos operações recentes como dados genéricos para visualização
    const { data: reportData = [], isLoading: loadingData } = useQuery({
        queryKey: ["report_data_preview", id],
        queryFn: () => OperacaoService.getAll(),
    });

    if (loadingCatalog) return null;

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
                        <Button variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" /> Imprimir
                        </Button>
                        <div className="flex border rounded-lg overflow-hidden">
                            <Button variant="ghost" size="sm" className="rounded-none border-r">
                                <FileText className="h-4 w-4 mr-2" /> PDF
                            </Button>
                            <Button variant="ghost" size="sm" className="rounded-none">
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
                                <TableRow>
                                    <TableHead className="px-5">Identificador</TableHead>
                                    <TableHead>Colaborador</TableHead>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Serviço</TableHead>
                                    <TableHead className="text-right px-5">Valor</TableHead>
                                </TableRow>
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
                                        <TableRow key={row.id} className="hover:bg-muted/30 transition-colors">
                                            <TableCell className="px-5 font-mono text-xs text-muted-foreground">{row.id.substring(0, 8)}</TableCell>
                                            <TableCell className="font-medium">{row.transportadora || "N/A"}</TableCell>
                                            <TableCell>{new Date(row.data).toLocaleDateString('pt-BR')}</TableCell>
                                            <TableCell><Badge variant="secondary" className="font-normal">{row.tipo_servico}</Badge></TableCell>
                                            <TableCell className="text-right px-5 font-semibold">R$ {(Number(row.quantidade) * Number(row.valor_unitario || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</TableCell>
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
