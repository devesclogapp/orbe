import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Clock, ArrowUpRight, ArrowDownRight, Filter, Download, History, Calendar as CalendarIcon, X } from "lucide-react";
import { BHEventoService } from "@/services/v4.service";
import { ColaboradorService } from "@/services/base.service";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ExtratoColaborador = () => {
    const { id } = useParams();
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const { data: colaborador } = useQuery({
        queryKey: ["colaborador", id],
        queryFn: () => ColaboradorService.getById(id!),
        enabled: !!id,
    });

    const { data: eventos = [], isLoading } = useQuery({
        queryKey: ["bh_eventos", id, dateRange?.from, dateRange?.to],
        queryFn: () => BHEventoService.getByColaborador(id!, dateRange?.from, dateRange?.to),
        enabled: !!id,
    });

    // Saldos para exibição nos cards (geralmente saldo total acumulado)
    // Mas aqui vamos recalcular based on all events if we want the current real balance, 
    // or keep the filtered ones for "period totals".
    // A pedido do usuário para "fazer funcionar", vou manter os cards de saldo como globais 
    // (buscando todos os eventos sem filtro para os cards de saldo, ou via RPC se disponível)
    // Mas para simplificar e garantir que os cards reflitam o "Saldo Atual" real:
    const { data: todosEventos = [] } = useQuery({
        queryKey: ["bh_eventos_all", id],
        queryFn: () => BHEventoService.getByColaborador(id!),
        enabled: !!id,
    });

    const totalMinutos = todosEventos.reduce((acc, curr) => acc + (curr.quantidade_minutos || 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30Days = new Date(today); in30Days.setDate(today.getDate() + 30);

    const minutosVencidos = todosEventos.reduce((acc, e) => {
        if (e.data_vencimento && new Date(e.data_vencimento) < today && e.quantidade_minutos > 0)
            return acc + e.quantidade_minutos;
        return acc;
    }, 0);

    const minutosAVencer30d = todosEventos.reduce((acc, e) => {
        const venc = e.data_vencimento ? new Date(e.data_vencimento) : null;
        if (venc && venc >= today && venc <= in30Days && e.quantidade_minutos > 0)
            return acc + e.quantidade_minutos;
        return acc;
    }, 0);

    const totalCreditosPeriodo = eventos.filter(e => e.quantidade_minutos > 0).reduce((a, b) => a + b.quantidade_minutos, 0);

    const formatTime = (mins: number) => {
        const abs = Math.abs(mins);
        const h = Math.floor(abs / 60);
        const m = abs % 60;
        return `${mins < 0 ? '-' : ''}${h}h ${m}m`;
    };

    const handleExportPDF = () => {
        if (!colaborador) return;

        const doc = new jsPDF();

        // Header
        doc.setFillColor(240, 240, 240);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setFontSize(22);
        doc.setTextColor(239, 68, 68); // primary color
        doc.text("ORBE ERP", 14, 25);

        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text("EXTRATO DE BANCO DE HORAS", 140, 25);

        // Colaborador Info
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(12);
        doc.text(`Colaborador: ${colaborador.nome}`, 14, 50);
        doc.setFontSize(10);
        doc.text(`Matrícula: ${colaborador.matricula}`, 14, 56);

        const periodText = dateRange?.from && dateRange?.to
            ? `${format(dateRange.from, 'dd/MM/yyyy')} a ${format(dateRange.to, 'dd/MM/yyyy')}`
            : 'Período Completo';
        doc.text(`Período: ${periodText}`, 14, 62);

        // Summary Box
        doc.setDrawColor(200, 200, 200);
        doc.rect(140, 45, 56, 25);
        doc.setFontSize(9);
        doc.text("SALDO ATUAL", 145, 52);
        doc.setFontSize(14);
        doc.text(formatTime(totalMinutos), 145, 62);

        // Table
        const tableData = eventos.map((e) => [
            format(new Date(e.data), "dd/MM/yyyy HH:mm"),
            `${e.tipo.toUpperCase()}: ${e.origem}${e.descricao ? ` - ${e.descricao}` : ''}`,
            { content: formatTime(e.quantidade_minutos), styles: { textColor: e.quantidade_minutos > 0 ? [34, 197, 94] : [239, 68, 68] } }
        ]);

        autoTable(doc, {
            startY: 75,
            head: [['Data', 'Evento / Descrição', 'Quantidade']],
            body: tableData,
            headStyles: { fillColor: [60, 60, 60] },
            alternateRowStyles: { fillColor: [250, 250, 250] },
            margin: { top: 75 },
        });

        const fileName = `extrato_bh_${colaborador.nome.replace(/\s+/g, '_').toLowerCase()}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
        doc.save(fileName);
    };

    const clearFilter = () => setDateRange(undefined);

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
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className={cn(
                                    "justify-start text-left font-normal",
                                    !dateRange && "text-muted-foreground"
                                )}>
                                    <Filter className="h-4 w-4 mr-1.5" />
                                    {dateRange?.from ? (
                                        dateRange.to ? (
                                            <>
                                                {format(dateRange.from, "dd/MM/yy")} -{" "}
                                                {format(dateRange.to, "dd/MM/yy")}
                                            </>
                                        ) : (
                                            format(dateRange.from, "dd/MM/yy")
                                        )
                                    ) : (
                                        <span>Filtrar Período</span>
                                    )}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="end">
                                <div className="p-3 border-b border-muted flex items-center justify-between bg-muted/20">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selecionar Período</span>
                                    {dateRange && (
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearFilter}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    )}
                                </div>
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                    locale={ptBR}
                                />
                            </PopoverContent>
                        </Popover>

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleExportPDF}
                            disabled={eventos.length === 0}
                        >
                            <Download className="h-4 w-4 mr-1.5" /> PDF
                        </Button>
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
                        <h3 className="text-xl font-bold font-display text-error">{formatTime(minutosVencidos)}</h3>
                    </div>
                    <div className="esc-card p-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">A Vencer (30 dias)</p>
                        <h3 className="text-xl font-bold font-display text-warning">{formatTime(minutosAVencer30d)}</h3>
                    </div>
                    <div className="esc-card p-5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Créditos no Período</p>
                        <h3 className="text-xl font-bold font-display text-success">{formatTime(totalCreditosPeriodo)}</h3>
                    </div>
                </div>

                {/* Linha do Tempo */}
                <section className="esc-card p-0">
                    <div className="esc-table-header px-5 py-3 border-b border-muted flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Linha do Tempo de Eventos</span>
                        </div>
                        {dateRange?.from && (
                            <span className="text-[10px] font-medium text-muted-foreground italic">
                                Mostrando de {format(dateRange.from, "dd/MM/yyyy")} {dateRange.to ? `até ${format(dateRange.to, "dd/MM/yyyy")}` : ''}
                            </span>
                        )}
                    </div>

                    <div className="divide-y divide-muted">
                        {isLoading ? (
                            <div className="p-10 flex justify-center"><Clock className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : eventos.length === 0 ? (
                            <div className="p-12 text-center text-muted-foreground italic flex flex-col items-center gap-2">
                                <History className="h-8 w-8 opacity-20" />
                                <p>Nenhum evento registrado no período selecionado.</p>
                                {dateRange && (
                                    <Button variant="link" size="sm" onClick={clearFilter}>Limpar Filtros</Button>
                                )}
                            </div>
                        ) : (
                            eventos.map((e) => (
                                <div key={e.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
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
