import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
    FileBox,
    Download,
    Search,
    Filter,
    Eye,
    FileText,
    Calendar
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

const ClientReports = () => {
    const reports = [
        { id: "REP-01", type: "Fechamento Operacional", period: "Abril 2024", date: "15/04/2024", size: "2.4 MB" },
        { id: "REP-02", type: "Detalhamento por Colaborador", period: "Abril 2024", date: "14/04/2024", size: "1.8 MB" },
        { id: "REP-03", type: "Consolidado de Horas", period: "Março 2024", date: "05/04/2024", size: "3.1 MB" },
        { id: "REP-04", type: "Relatório Financeiro", period: "Março 2024", date: "02/04/2024", size: "1.2 MB" },
    ];

    return (
        <PortalShell title="Relatórios e Documentos">
            <div className="space-y-6">
                {/* Filters and Search */}
                <div className="flex flex-wrap gap-4 items-center justify-between">
                    <div className="flex items-center gap-3 bg-card border border-border px-4 py-2.5 rounded-xl flex-1 max-w-md shadow-sm">
                        <Search className="w-5 h-5 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Pesquisar relatórios..."
                            className="bg-transparent border-none outline-none text-sm w-full font-medium"
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" className="rounded-xl border-border font-bold gap-2">
                            <Calendar className="w-4 h-4" /> Período
                        </Button>
                        <Button variant="outline" className="rounded-xl border-border font-bold gap-2">
                            <Filter className="w-4 h-4" /> Tipo
                        </Button>
                    </div>
                </div>

                {/* Reports Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {reports.slice(0, 4).map((rep) => (
                        <Card key={rep.id} className="p-5 border-none shadow-sm shadow-gray-100 group hover:shadow-md transition-all">
                            <div className="w-12 h-12 bg-muted/30 text-muted-foreground rounded-xl flex items-center justify-center mb-4 group-hover:bg-primary/5 group-hover:text-brand transition-colors">
                                <FileText className="w-6 h-6" />
                            </div>
                            <h4 className="font-bold text-gray-900 text-sm mb-1">{rep.type}</h4>
                            <p className="text-xs text-muted-foreground mb-4">{rep.period}</p>
                            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                <span className="text-[10px] font-bold text-gray-300 uppercase">{rep.size}</span>
                                <button className="text-brand hover:bg-brand/10 p-1.5 rounded-lg transition-colors">
                                    <Download className="w-4 h-4" />
                                </button>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Detailed List */}
                <Card className="border-none shadow-sm shadow-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-border/50">
                        <h3 className="font-bold text-gray-900">Todos os Arquivos</h3>
                    </div>
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow>
                                <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Documento</TableHead>
                                <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Competência</TableHead>
                                <TableHead className="font-bold text-muted-foreground uppercase text-[10px]">Data de Publicação</TableHead>
                                <TableHead className="font-bold text-muted-foreground uppercase text-[10px] text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {reports.map((rep) => (
                                <TableRow key={rep.id} className="hover:bg-muted/20">
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-muted text-muted-foreground rounded flex items-center justify-center">
                                                <FileBox className="w-4 h-4" />
                                            </div>
                                            <span className="font-bold text-gray-700 text-sm">{rep.type}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted border-none">
                                            {rep.period}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">{rep.date}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground border border-transparent hover:border-border">
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-9 w-9 text-brand hover:bg-brand/10 border border-transparent hover:border-brand/20">
                                                <Download className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </Card>
            </div>
        </PortalShell>
    );
};

export default ClientReports;
