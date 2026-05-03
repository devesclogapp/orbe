import { AppShell } from "@/components/layout/AppShell";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
    Play,
    AlertTriangle,
    X
} from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const RelatoriosHub = () => {

    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

    const userId = user?.id;

    const { data: reports = [], isLoading, error: reportError } = useQuery({
        queryKey: ["reports_catalog"],
        queryFn: () => ReportService.getAll(),
        retry: 1
    });

    const { data: favorites = [] } = useQuery({
        queryKey: ["reports_favorites", userId],
        queryFn: () => userId ? ReportService.getFavorites(userId) : Promise.resolve([]),
        enabled: !!userId,
    });

    const favoriteIds = favorites.map((f: any) => f.relatorio_id);

    const toggleFavoriteMutation = useMutation({
        mutationFn: (reportId: string) => ReportService.toggleFavorite(userId, reportId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["reports_favorites"] });
        }
    });

    const handleToggleFavorite = (e: React.MouseEvent, reportId: string) => {
        e.stopPropagation();
        toggleFavoriteMutation.mutate(reportId);
    };

    const categories = [
        { id: 'Operacional', icon: Clock },
        { id: 'Financeiro', icon: ArrowUpRight },
        { id: 'Faturamento', icon: ArrowUpRight },
        { id: 'Banco de horas', icon: Clock },
        { id: 'Auditoria', icon: Database },
        { id: 'Contábil/Fiscal', icon: FileSpreadsheet },
    ];

    const filteredReports = reports.filter(r => {
        const matchesCategory = categoryFilter ? r.categoria === categoryFilter : true;
        const matchesSearch = r.nome.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <AppShell title="Central de Relatórios" subtitle="Hub de inteligência e exportação de dados">
            <div className="space-y-6">
                {/* Barra de Ações Rápidas */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar relatório..."
                            className="pl-9 pr-9 bg-background border-border/60"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        {search && (
                            <button
                                onClick={() => setSearch('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
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
                        <div className="flex items-center justify-between px-3 mb-2">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Categorias</h3>
                            {categoryFilter && (
                                <button onClick={() => setCategoryFilter(null)} className="text-[10px] text-primary hover:underline">
                                    Limpar
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setCategoryFilter(null)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                categoryFilter === null ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Database className="h-4 w-4" />
                            Todos
                        </button>
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                onClick={() => setCategoryFilter(cat.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                                    categoryFilter === cat.id ? "bg-primary/10 text-primary" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
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
                        ) : reportError ? (
                            <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-destructive/20 bg-destructive/5 text-destructive">
                                <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
                                <h3 className="font-semibold">Erro ao carregar catálogo</h3>
                                <p className="text-xs opacity-80">Não foi possível conectar ao servidor de relatórios.</p>
                                <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
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
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-8 w-8 transition-colors",
                                                        favoriteIds.includes(report.id) ? "text-warning fill-warning" : "text-muted-foreground hover:text-warning"
                                                    )}
                                                    onClick={(e) => handleToggleFavorite(e, report.id)}
                                                >
                                                    <Star className={cn("h-4 w-4", favoriteIds.includes(report.id) && "fill-current")} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        navigate(`/relatorios/detalhe/${report.id}`);
                                                    }}
                                                >
                                                    <Play className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>

                                        <div className="mt-4 flex items-center justify-between pt-4 border-t border-border/50">
                                            <div className="flex gap-1">
                                                {report.formatos_disponiveis?.map((f: string) => (
                                                    <Badge key={f} variant="secondary" className="text-[9px] uppercase h-5">
                                                        {f}
                                                    </Badge>
                                                ))}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                {report.updated_at ? (
                                                    <>
                                                        <Clock className="h-3 w-3" />
                                                        Atualizado
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-border/60 text-muted-foreground">
                                <Filter className="h-10 w-10 mb-4 opacity-20" />
                                <p className="mb-2">Nenhum relatório encontrado{(search || categoryFilter) ? ` para os filtros atuais` : ''}</p>
                                {(search || categoryFilter) && (
                                    <Button variant="link" onClick={() => { setSearch(""); setCategoryFilter(null); }}>
                                        Limpar filtros
                                    </Button>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </AppShell>
    );
};

export default RelatoriosHub;
