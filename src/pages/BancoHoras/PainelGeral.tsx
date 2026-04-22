import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, ArrowUpRight, ArrowDownRight, Users, Clock, AlertCircle, Search, Download } from "lucide-react";
import { BHEventoService } from "@/services/v4.service";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PainelGeral = () => {
    const queryClient = useQueryClient();

    const { data: saldos = [], isLoading } = useQuery({
        queryKey: ["bh_saldos"],
        queryFn: () => BHEventoService.getSaldosGerais(),
    });

    const [filters, setFilters] = useState({
        search: "",
        empresa_id: "all",
        status: "all"
    });

    const empresas = Array.from(new Set(saldos.map((s: any) => s.empresa))).filter(Boolean) as string[];

    const filteredSaldos = saldos.filter((s: any) => {
        const matchesSearch = (s.nome?.toLowerCase().includes(filters.search.toLowerCase()) ||
            s.matricula?.toLowerCase().includes(filters.search.toLowerCase()));
        const matchesEmpresa = filters.empresa_id === "all" || s.empresa === filters.empresa_id;
        const matchesStatus = filters.status === "all" || s.status === filters.status;
        return matchesSearch && matchesEmpresa && matchesStatus;
    });

    // KPIs calculados a partir dos dados filtrados
    const totalMinutosAcumulados = filteredSaldos.reduce((acc, s: any) => acc + (s.saldo_minutos > 0 ? s.saldo_minutos : 0), 0);
    const totalMinutosAVencer = filteredSaldos.reduce((acc, s: any) => acc + (s.minutos_a_vencer_30d || 0), 0);
    const colaboradoresEmRisco = filteredSaldos.filter((s: any) => s.status === 'crítico').length;
    const formatTotal = (mins: number) => { const h = Math.floor(mins / 60); const m = mins % 60; return `${h}h${m > 0 ? ` ${m}m` : ''}`; };

    const handleExport = () => {
        toast.info("Gerando relatório para exportação", {
            description: "O layout CSV será baixado em instantes."
        });

        const headers = ["Colaborador", "Matricula", "Empresa", "Saldo (Minutos)", "Status"];
        const rows = filteredSaldos.map((s: any) => [
            s.nome, s.matricula, s.empresa, s.saldo_minutos, s.status
        ]);

        // Use delimiter ; for better Excel compatibility in PT-BR
        const csvContent = "\uFEFF" + [headers, ...rows].map(e => e.join(";")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `banco-horas-${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const stats = [
        {
            label: "Total Acumulado",
            value: isLoading ? "..." : formatTotal(totalMinutosAcumulados),
            icon: Clock,
            color: "text-primary",
            bg: "bg-primary-soft",
        },
        {
            label: "Prestes a Vencer (30d)",
            value: isLoading ? "..." : formatTotal(totalMinutosAVencer),
            icon: AlertCircle,
            color: "text-warning",
            bg: "bg-warning-soft",
        },
        {
            label: "Colaboradores em Risco",
            value: isLoading ? "..." : colaboradoresEmRisco.toString(),
            icon: Users,
            color: "text-error",
            bg: "bg-destructive-soft",
        },
    ];

    return (
        <AppShell title="Banco de Horas" subtitle="Painel geral de saldos e compensações">
            <div className="space-y-6">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {stats.map((s, i) => (
                        <div key={i} className="esc-card p-5 flex items-start justify-between">
                            <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                    {s.label}
                                </p>
                                <h3 className="text-2xl font-bold font-display text-foreground">{s.value}</h3>
                            </div>
                            <div className={cn("p-2 rounded-lg", s.bg)}>
                                <s.icon className={cn("h-5 w-5", s.color)} />
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-1 w-full md:w-auto gap-2">
                        <div className="relative flex-1 md:max-w-xs">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar colaborador..."
                                className="pl-9 h-9"
                                value={filters.search}
                                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                            />
                        </div>
                        <Select value={filters.empresa_id} onValueChange={(v) => setFilters(f => ({ ...f, empresa_id: v }))}>
                            <SelectTrigger className="h-9 w-[180px]">
                                <SelectValue placeholder="Empresa" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todas as Empresas</SelectItem>
                                {empresas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filters.status} onValueChange={(v) => setFilters(f => ({ ...f, status: v }))}>
                            <SelectTrigger className="h-9 w-[140px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos Status</SelectItem>
                                <SelectItem value="ok">OK</SelectItem>
                                <SelectItem value="positivo">Positivo</SelectItem>
                                <SelectItem value="critico">Crítico</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExport}
                            className="h-9"
                        >
                            <Download className="h-4 w-4 mr-2" />
                            Exportar
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => queryClient.invalidateQueries({ queryKey: ["bh_saldos"] })}
                        >
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </Button>
                    </div>
                </div>

                <section className="esc-card overflow-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                <tr className="text-left">
                                    <th className="px-5 h-11 font-medium">Colaborador</th>
                                    <th className="px-3 h-11 font-medium">Empresa</th>
                                    <th className="px-3 h-11 font-medium text-center">Saldo Atual</th>
                                    <th className="px-3 h-11 font-medium text-center">Vencido</th>
                                    <th className="px-3 h-11 font-medium text-center">A Vencer</th>
                                    <th className="px-5 h-11 font-medium text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSaldos.map((s: any) => (
                                    <tr key={s.id} className="border-t border-muted hover:bg-background group">
                                        <td className="px-5 h-[52px]">
                                            <Link to={`/banco-horas/extrato/${s.id}`} className="hover:underline">
                                                <div className="font-medium text-foreground">{s.nome}</div>
                                                <div className="text-xs text-muted-foreground">Mat. {s.matricula}</div>
                                            </Link>
                                        </td>
                                        <td className="px-3 text-muted-foreground">{s.empresa || "—"}</td>
                                        <td className="px-3 text-center">
                                            <div className={cn(
                                                "inline-flex items-center gap-1 font-display font-semibold",
                                                s.saldo_minutos > 0 ? "text-success" : s.saldo_minutos < 0 ? "text-error" : "text-muted-foreground"
                                            )}>
                                                {s.saldo_minutos > 0 && <ArrowUpRight className="h-3 w-3" />}
                                                {s.saldo_minutos < 0 && <ArrowDownRight className="h-3 w-3" />}
                                                {s.saldo_formatado}
                                            </div>
                                        </td>
                                        <td className="px-3 text-center text-error font-display font-medium">{s.vencido_formatado || '0h 0m'}</td>
                                        <td className="px-3 text-center text-muted-foreground font-display">{s.a_vencer_formatado || '0h 0m'}</td>
                                        <td className="px-5 text-center">
                                            <StatusChip status={s.status} />
                                        </td>
                                    </tr>
                                ))}
                                {filteredSaldos.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                                            Nenhum saldo processado ainda.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    )}
                </section>
            </div>
        </AppShell>
    );
};

export default PainelGeral;
