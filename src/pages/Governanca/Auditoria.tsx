import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { History, Search, Download, Filter, Info, AlertCircle, ShieldAlert, LayoutGrid, List } from "lucide-react";
import { AuditoriaService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const AuditoriaLogs = () => {
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterModulo, setFilterModulo] = useState<string>("todos");
    const [filterImpacto, setFilterImpacto] = useState<string>("todos");
    const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

    const { data: logs = [], isLoading } = useQuery({
        queryKey: ["auditoria_logs"],
        queryFn: () => AuditoriaService.getAll(),
    });

    const modulos = Array.from(new Set(logs.map((l: any) => l.modulo)));
    const impactos = ["critico", "medio", "baixo"];

    const filteredLogs = logs.filter((l: any) => {
        const matchesSearch = l.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (l.user_id && l.user_id.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesModulo = filterModulo === "todos" || l.modulo === filterModulo;
        const matchesImpacto = filterImpacto === "todos" || l.impacto === filterImpacto;
        return matchesSearch && matchesModulo && matchesImpacto;
    });

    const handleExport = () => {
        if (filteredLogs.length === 0) {
            toast.error("Não há logs para exportar");
            return;
        }

        const headers = ["ID", "Data", "Hora", "Usuario", "Ação", "Modulo", "Impacto"];
        const rows = filteredLogs.map(l => [
            l.id,
            format(new Date(l.created_at), "dd/MM/yyyy"),
            format(new Date(l.created_at), "HH:mm:ss"),
            l.user_id || "Sistema",
            `"${l.acao}"`, // Quote for CSV safety
            l.modulo,
            l.impacto
        ]);

        // Use delimiter ; and UTF-8 BOM for Excel compatibility
        const csvContent = "\uFEFF" + [
            headers.join(";"),
            ...rows.map(r => r.join(";"))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `auditoria-orbe-${format(new Date(), "yyyy-MM-dd")}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Logs exportados com sucesso");
    };

    const getImpactIcon = (impacto: string) => {
        switch (impacto) {
            case 'critico': return <ShieldAlert className="h-4 w-4 text-error" />;
            case 'medio': return <AlertCircle className="h-4 w-4 text-warning" />;
            default: return <Info className="h-4 w-4 text-info" />;
        }
    };

    return (
        <AppShell title="Auditoria de Ações" subtitle="Registro imutável de todas as atividades críticas do sistema">
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row gap-3 justify-between items-center bg-background p-2 rounded-lg border border-border/50">
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <div className="flex border rounded-lg overflow-hidden bg-background">
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-9 w-9 rounded-none border-r transition-all", viewMode === 'grid' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                                onClick={() => setViewMode('grid')}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={cn("h-9 w-9 rounded-none transition-all", viewMode === 'table' ? "bg-muted text-primary" : "text-muted-foreground hover:text-primary")}
                                onClick={() => setViewMode('table')}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                        </div>

                        <div className="relative flex-1 md:w-64 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                            <Input
                                className="h-9 w-full pl-9 bg-card border-border"
                                placeholder="Buscar usuários ou ações..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <Select value={filterModulo} onValueChange={setFilterModulo}>
                            <SelectTrigger className="h-9 w-[150px] bg-card">
                                <SelectValue placeholder="Módulo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Módulo: Todos</SelectItem>
                                {modulos.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                            </SelectContent>
                        </Select>

                        <Select value={filterImpacto} onValueChange={setFilterImpacto}>
                            <SelectTrigger className="h-9 w-[150px] bg-card">
                                <SelectValue placeholder="Impacto" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Impacto: Todos</SelectItem>
                                {impactos.map(i => <SelectItem key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 font-semibold"
                        onClick={handleExport}
                    >
                        <Download className="h-4 w-4 mr-1.5" /> Exportar CSV
                    </Button>
                </div>

                <section className={cn(viewMode === 'table' ? "esc-card p-0 overflow-hidden" : "")}>
                    {isLoading ? (
                        <div className="p-20 text-center"><History className="h-10 w-10 animate-spin mx-auto text-primary opacity-50" /></div>
                    ) : viewMode === 'table' ? (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Data / Hora</th>
                                    <th className="px-3 h-11 font-medium">Usuário</th>
                                    <th className="px-3 h-11 font-medium">Ação Realizada</th>
                                    <th className="px-3 h-11 font-medium text-center">Módulo</th>
                                    <th className="px-3 h-11 font-medium text-center">Impacto</th>
                                    <th className="px-5 h-11 font-medium text-right">Detalhes</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-muted">
                                {filteredLogs.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-muted-foreground italic">Nenhum log encontrado para os filtros selecionados.</td></tr>
                                ) : (
                                    filteredLogs.map((l: any) => (
                                        <tr key={l.id} className="hover:bg-background group">
                                            <td className="px-5 h-14 whitespace-nowrap">
                                                <div className="font-medium text-foreground">
                                                    {format(new Date(l.created_at), "dd/MM/yyyy")}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {format(new Date(l.created_at), "HH:mm:ss")}
                                                </div>
                                            </td>
                                            <td className="px-3">
                                                <div className="font-medium text-foreground truncate w-32">{l.user_id || "Sistema"}</div>
                                            </td>
                                            <td className="px-3">
                                                <div className="text-foreground">{l.acao}</div>
                                            </td>
                                            <td className="px-3 text-center">
                                                <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
                                                    {l.modulo}
                                                </span>
                                            </td>
                                            <td className="px-3">
                                                <div className="flex justify-center">
                                                    <div className={cn(
                                                        "px-2 py-0.5 rounded-full flex items-center gap-1.5 text-[11px] font-medium border",
                                                        l.impacto === 'critico' ? "bg-destructive-soft text-destructive border-destructive-strong/10" :
                                                            l.impacto === 'medio' ? "bg-warning-soft text-warning border-warning-strong/10" :
                                                                "bg-info-soft text-info border-info-strong/10"
                                                    )}>
                                                        {getImpactIcon(l.impacto)}
                                                        <span className="capitalize">{l.impacto}</span>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => setSelectedLog(l)}>Ver JSON</Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredLogs.map((l: any) => (
                                <article key={l.id} className="esc-card p-5 group flex flex-col justify-between border-l-4" style={{
                                    borderLeftColor: l.impacto === 'critico' ? 'hsl(var(--destructive))' :
                                        l.impacto === 'medio' ? 'hsl(var(--warning))' : 'hsl(var(--info))'
                                }}>
                                    <div>
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                                                {l.modulo}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(l.created_at), "dd/MM/yy HH:mm")}
                                            </div>
                                        </div>
                                        <h4 className="font-semibold text-foreground text-sm line-clamp-2 mb-2">{l.acao}</h4>
                                        <p className="text-xs text-muted-foreground font-medium">Por: {l.user_id || "Sistema"}</p>
                                    </div>
                                    <div className="mt-6 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all border-t pt-3">
                                        <span className={cn("text-[9px] font-bold uppercase tracking-tighter",
                                            l.impacto === 'critico' ? 'text-destructive' : l.impacto === 'medio' ? 'text-warning' : 'text-info'
                                        )}>
                                            Impacto {l.impacto}
                                        </span>
                                        <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => setSelectedLog(l)}>Detalhes Técnicos</Button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <Dialog open={!!selectedLog} onOpenChange={(val) => !val && setSelectedLog(null)}>
                <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Detalhes do Evento</DialogTitle>
                        <DialogDescription>
                            Dados técnicos brutos registrados para auditoria.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-muted/30 rounded-md p-4 mt-2">
                        <pre className="text-[11px] font-mono text-foreground leading-relaxed">
                            {selectedLog ? JSON.stringify(selectedLog, null, 2) : ""}
                        </pre>
                    </div>
                </DialogContent>
            </Dialog>
        </AppShell>
    );
};

export default AuditoriaLogs;
