import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, ArrowUpRight, ArrowDownRight, Filter, Download, History } from "lucide-react";
import { BHEventoService } from "@/services/v4.service";
import { ColaboradorService } from "@/services/base.service";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const ExtratoColaborador = () => {
    const { id } = useParams();

    const { data: colaborador } = useQuery({
        queryKey: ["colaborador", id],
        queryFn: () => ColaboradorService.getById(id!),
        enabled: !!id,
    });

    const { data: eventos = [], isLoading } = useQuery({
        queryKey: ["bh_eventos", id],
        queryFn: () => BHEventoService.getByColaborador(id!),
        enabled: !!id,
    });

    const totalMinutos = eventos.reduce((acc, curr) => acc + (curr.quantidade_minutos || 0), 0);
    const formatTime = (mins: number) => {
        const abs = Math.abs(mins);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${mins < 0 ? '-' : ''}${h}h ${m}m`;
    };

    return (
        <AppShell
            title="Extrato do Colaborador"
            subtitle={colaborador ? `${colaborador.nome} — Mat. ${colaborador.matricula}` : "Carregando..."}
        >
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" asChild className="pl-0 hover:bg-transparent">
                        <Link to="/banco-horas" className="flex items-center gap-2">
                            <ChevronLeft className="h-4 w-4" /> Voltar para o Painel
                        </Link>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm"><Filter className="h-4 w-4 mr-1.5" /> Filtrar Período</Button>
                        <Button variant="outline" size="sm"><Download className="h-4 w-4 mr-1.5" /> PDF</Button>
                    </div>
                </div>

                {/* Resumo */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="esc-card p-5 bg-primary-soft border-primary/20">
                        <p className="text-[11px] font-semibold text-primary uppercase tracking-wider mb-1">Saldo Atual</p>
                        <h3 className="text-2xl font-bold font-display text-primary">{formatTime(totalMinutos)}</h3>
                    </div>
                    <div className="esc-card p-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Saldo Vencido</p>
                        <h3 className="text-xl font-bold font-display text-error">0h 00m</h3>
                    </div>
                    <div className="esc-card p-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">A Vencer (30 dias)</p>
                        <h3 className="text-xl font-bold font-display text-warning">0h 00m</h3>
                    </div>
                    <div className="esc-card p-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Créditos</p>
                        <h3 className="text-xl font-bold font-display text-success">
                            {formatTime(eventos.filter(e => e.quantidade_minutos > 0).reduce((a, b) => a + b.quantidade_minutos, 0))}
                        </h3>
                    </div>
                </div>

                {/* Linha do Tempo */}
                <section className="esc-card p-0">
                    <div className="esc-table-header px-5 py-3 border-b border-muted flex items-center gap-2">
                        <History className="h-4 w-4 text-muted-foreground" />
                        <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Linha do Tempo de Eventos</span>
                    </div>

                    <div className="divide-y divide-muted">
                        {isLoading ? (
                            <div className="p-10 flex justify-center"><Clock className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : eventos.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground italic">Nenhum evento registrado no banco de horas.</div>
                        ) : (
                            eventos.map((e) => (
                                <div key={e.id} className="p-4 flex items-center justify-between hover:bg-background transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={cn(
                                            "p-2 rounded-full",
                                            e.tipo === 'credito' ? "bg-success-soft text-success" :
                                                e.tipo === 'debito' ? "bg-destructive-soft text-destructive" :
                                                    "bg-info-soft text-info"
                                        )}>
                                            {e.tipo === 'credito' ? <ArrowUpRight className="h-4 w-4" /> :
                                                e.tipo === 'debito' ? <ArrowDownRight className="h-4 w-4" /> :
                                                    <Clock className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <div className="font-medium text-foreground capitalize">{e.tipo}: {e.origem}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(e.data), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                                {e.descricao && ` • ${e.descricao}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className={cn(
                                            "font-display font-bold",
                                            e.quantidade_minutos > 0 ? "text-success" : "text-error"
                                        )}>
                                            {formatTime(e.quantidade_minutos)}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>
            </div>
        </AppShell>
    );
};

export default ExtratoColaborador;
