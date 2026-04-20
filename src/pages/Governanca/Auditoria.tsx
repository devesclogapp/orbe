import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { History, Search, Download, Filter, Info, AlertCircle, ShieldAlert } from "lucide-react";
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

const AuditoriaLogs = () => {
    const [selectedLog, setSelectedLog] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterModulo, setFilterModulo] = useState<string>("todos");
    const [filterImpacto, setFilterImpacto] = useState<string>("todos");

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

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
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
                <div className="flex flex-col md:flex-row gap-3 justify-between">
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64 min-w-[200px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                className="esc-input h-9 w-full pl-9"
                                placeholder="Buscar usuários ou ações..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        <select
                            className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={filterModulo}
                            onChange={(e) => setFilterModulo(e.target.value)}
                        >
                            <option value="todos">Todos os Módulos</option>
                            {modulos.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>

                        <select
                            className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            value={filterImpacto}
                            onChange={(e) => setFilterImpacto(e.target.value)}
                        >
                            <option value="todos">Todos os Impactos</option>
                            {impactos.map(i => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
                        </select>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        className="hidden sm:flex"
                        onClick={handleExport}
                    >
                        <Download className="h-4 w-4 mr-1.5" /> Exportar
                    </Button>
                </div>

                <section className="esc-card p-0 overflow-hidden">
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
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-10 text-center"><History className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></td></tr>
                            ) : filteredLogs.length === 0 ? (
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
