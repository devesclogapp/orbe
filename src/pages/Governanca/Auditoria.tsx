import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { History, Search, Download, Filter, Info, AlertCircle, ShieldAlert } from "lucide-react";
import { AuditoriaService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const AuditoriaLogs = () => {
    const { data: logs = [], isLoading } = useQuery({
        queryKey: ["auditoria_logs"],
        queryFn: () => AuditoriaService.getAll(),
    });

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
                <div className="flex flex-col md:flex-row gap-2 justify-between">
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                className="esc-input h-9 w-full pl-9"
                                placeholder="Buscar por usuário ou ação..."
                            />
                        </div>
                        <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1.5" /> Filtros</Button>
                    </div>
                    <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" /> Exportar Logs</Button>
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
                            ) : logs.length === 0 ? (
                                <tr><td colSpan={6} className="p-12 text-center text-muted-foreground italic">Nenhum log registrado ainda.</td></tr>
                            ) : (
                                logs.map((l: any) => (
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
                                            <Button variant="ghost" size="sm">Ver JSON</Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </section>
            </div>
        </AppShell>
    );
};

export default AuditoriaLogs;
