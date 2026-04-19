import { AppShell } from "@/components/layout/AppShell";
import { useQuery } from "@tanstack/react-query";
import { ReportService } from "@/services/report.service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Search,
    Star,
    Clock,
    FileSpreadsheet,
    Settings,
    Database,
    ArrowUpRight,
    Filter,
    MoreVertical
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const RelatoriosHub = () => {
    const navigate = useNavigate();
    const [search, setSearch] = useState("");

    const { data: reports = [], isLoading } = useQuery({
        queryKey: ["reports_catalog"],
        queryFn: () => ReportService.getAll(),
    });

    const categories = [
        { id: 'Operacional', icon: Clock },
        { id: 'Financeiro', icon: ArrowUpRight },
        { id: 'Faturamento', icon: ArrowUpRight },
        { id: 'Banco de horas', icon: Clock },
        { id: 'Auditoria', icon: Database },
        { id: 'Contábil/Fiscal', icon: FileSpreadsheet },
    ];

    const filteredReports = reports.filter(r =>
        r.nome.toLowerCase().includes(search.toLowerCase()) ||
        r.categoria.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <AppShell title="Central de Relatórios" subtitle="Hub de inteligência e exportação de dados">
            <div className="space-y-6">
                {/* Barra de Ações Rápidas */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar relatório..."
                            className="pl-9 bg-background border-border/60"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" onClick={() => navigate('/relatorios/agendamentos')}>
                            <Clock className="h-4 w-4 mr-2" /> Agendamentos
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('/relatorios/layouts')}>
                            <Settings className="h-4 w-4 mr-2" /> Layouts
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => navigate('/relatorios/integracao')}>
                            <Database className="h-4 w-4 mr-2" /> Integração Contábil
                        </Button>
                    </div>
                </div>

                {/* Categorias e Lista */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Sidebar de Categorias */}
                    <div className="lg:col-span-1 space-y-1">
                        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-3 mb-2">Categorias</h3>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setSearch(cat.id)}
                                className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                            >
                                <cat.icon className="h-4 w-4" />
                                {cat.id}
                            </button>
                        ))}
                    </div>

                    {/* Grid de Relatórios */}
                    <div className="lg:col-span-3">
                        {isLoading ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
                            </div>
                        ) : filteredReports.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredReports.map((report) => (
                                    <div
                                        key={report.id}
                                        className="esc-card group hover:border-primary/50 transition-all cursor-pointer p-5 flex flex-col justify-between"
                                        onClick={() => navigate(`/relatorios/detalhe/${report.id}`)}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                                                    {report.categoria}
                                                </span>
                                                <h4 className="font-display font-semibold text-lg group-hover:text-primary transition-colors">
                                                    {report.nome}
                                                </h4>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {report.descricao}
                                                </p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-warning h-8 w-8">
                                                <Star className="h-4 w-4" />
                                            </Button>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between pt-4 border-t border-border/50">
                                            <div className="flex gap-1">
                                                {report.formatos_disponiveis?.map(f => (
                                                    <Badge key={f} variant="secondary" className="text-[9px] uppercase h-5">
                                                        {f}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                Última geração: Hoje
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-border/60 text-muted-foreground">
                                <Filter className="h-10 w-10 mb-4 opacity-20" />
                                <p>Nenhum relatório encontrado para "{search}"</p>
                                <Button variant="link" onClick={() => setSearch("")}>Limpar filtros</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default RelatoriosHub;
