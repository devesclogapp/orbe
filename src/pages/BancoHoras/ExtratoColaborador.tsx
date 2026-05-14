import { useMemo, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  ChevronLeft,
  Download,
  Edit3,
  Filter,
  HandCoins,
  History,
  Loader2,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { ColaboradorService } from "@/services/base.service";
import { BHEventoService } from "@/services/v4.service";

const getEventMinutes = (evento: any) => Number(evento?.minutos ?? evento?.quantidade_minutos ?? 0);
const getEventType = (evento: any) => String(evento?.tipo_evento ?? evento?.tipo ?? "").trim().toLowerCase();
const getEventDate = (evento: any) => String(evento?.data_evento ?? evento?.data ?? evento?.created_at ?? "");
const getEventDescription = (evento: any) => String(evento?.observacao ?? evento?.descricao ?? "").trim();
const getEventBalance = (evento: any) => Number(evento?.saldo_resultante ?? evento?.saldo_atual ?? 0);
const getEventStatus = (evento: any) => String(evento?.status ?? "ativo").trim().toLowerCase();
const getEventSource = (evento: any) => String(evento?.origem ?? "manual").trim();

type ActionType = "ajuste_manual" | "compensacao" | "pagamento" | "folga";

type ActionDialogState = {
  action: ActionType;
  evento: any;
} | null;

const formatMinutes = (mins: number) => {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${mins < 0 ? "-" : "+"}${h}h${m > 0 ? ` ${String(m).padStart(2, "0")}m` : " 00m"}`;
};

const formatBalance = (mins: number) => {
  const abs = Math.abs(mins);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = mins < 0 ? "-" : "+";
  return `${sign}${h}h${String(m).padStart(2, "0")}m`;
};

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return format(new Date(`${value}T00:00:00`), "dd/MM/yyyy", { locale: ptBR });
};

const toTitle = (value: string) =>
  value
    .replaceAll("_", " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const getVisualType = (evento: any) => {
  const tipo = getEventType(evento);
  const minutos = getEventMinutes(evento);

  if (tipo === "compensacao") return "compensacao";
  if (tipo === "folga") return "folga";
  if (tipo === "pagamento") return "pagamento";
  if (tipo === "ajuste_manual") return "ajuste_manual";
  if (tipo === "vencimento") return "debito";
  if (minutos >= 0) return "credito";
  return "debito";
};

const visualTypeMap = {
  credito: {
    label: "Credito",
    icon: ArrowUpRight,
    chip: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amount: "text-emerald-700",
  },
  debito: {
    label: "Debito",
    icon: ArrowDownRight,
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    amount: "text-rose-700",
  },
  compensacao: {
    label: "Compensacao",
    icon: HandCoins,
    chip: "bg-sky-50 text-sky-700 border-sky-200",
    amount: "text-sky-700",
  },
  folga: {
    label: "Folga",
    icon: CalendarClock,
    chip: "bg-violet-50 text-violet-700 border-violet-200",
    amount: "text-violet-700",
  },
  pagamento: {
    label: "Pagamento",
    icon: Banknote,
    chip: "bg-amber-50 text-amber-700 border-amber-200",
    amount: "text-amber-700",
  },
  ajuste_manual: {
    label: "Ajuste Manual",
    icon: Edit3,
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    amount: "text-slate-700",
  },
} as const;

const statusMap: Record<string, string> = {
  ativo: "Ativo",
  compensado: "Compensado",
  pago: "Pago",
  ajustado: "Ajustado",
  vencido: "Vencido",
  cancelado: "Cancelado",
};

const statusClassMap: Record<string, string> = {
  ativo: "bg-slate-100 text-slate-700 border-slate-200",
  compensado: "bg-sky-50 text-sky-700 border-sky-200",
  pago: "bg-amber-50 text-amber-700 border-amber-200",
  ajustado: "bg-violet-50 text-violet-700 border-violet-200",
  vencido: "bg-rose-50 text-rose-700 border-rose-200",
  cancelado: "bg-slate-100 text-slate-500 border-slate-200",
};

const actionMetaMap: Record<ActionType, { label: string; title: string; description: string; confirmLabel: string; examples: { cause: string; effect: string }[] }> = {
  ajuste_manual: {
    label: "Ajustar",
    title: "Ajuste manual",
    description: "Informe minutos positivos ou negativos e registre a observacao obrigatoria para auditoria.",
    confirmLabel: "Salvar ajuste",
    examples: [
      { cause: "colaborador esqueceu de bater ponto", effect: "RH adiciona +30min manualmente" },
      { cause: "ponto foi lançado errado", effect: "RH remove -1h manualmente" },
      { cause: "acordo interno aprovado pela gestão", effect: "RH ajusta saldo conforme autorização" },
      { cause: "erro de importação da planilha", effect: "RH corrige o banco sem reprocessar tudo" },
      { cause: "compensação excepcional", effect: "gestor autorizou abatimento específico" },
    ],
  },
  compensacao: {
    label: "Compensar",
    title: "Compensar horas",
    description: "O sistema lancara uma compensacao incremental abatendo o saldo disponivel do evento selecionado.",
    confirmLabel: "Confirmar compensacao",
    examples: [
      { cause: "colaborador saiu mais cedo", effect: "saldo positivo abatido" },
      { cause: "colaborador utilizou horas acumuladas", effect: "banco reduzido internamente" },
      { cause: "acordo de compensação aprovado", effect: "RH consome o saldo disponível" },
    ],
  },
  pagamento: {
    label: "Pagar",
    title: "Pagar horas",
    description: "O saldo sera abatido, o evento ficara marcado como pago e o reflexo futuro no financeiro sera sinalizado.",
    confirmLabel: "Confirmar pagamento",
    examples: [
      { cause: "empresa decidiu pagar horas extras", effect: "saldo convertido em pagamento" },
      { cause: "fechamento mensal aprovado", effect: "horas positivas enviadas ao financeiro" },
      { cause: "colaborador não irá compensar", effect: "saldo encerrado via pagamento" },
    ],
  },
  folga: {
    label: "Folga",
    title: "Lancar folga",
    description: "Informe a data da folga para registrar o abatimento do banco de horas com trilha de auditoria.",
    confirmLabel: "Confirmar folga",
    examples: [
      { cause: "colaborador tirou folga usando banco", effect: "saldo abatido automaticamente" },
      { cause: "folga compensatória aprovada", effect: "horas convertidas em descanso" },
      { cause: "banco utilizado para ausência autorizada", effect: "sistema registra abatimento" },
    ],
  },
};

const getAvailableActions = (evento: any): Array<{ key: ActionType; label: string }> => {
  const status = getEventStatus(evento);
  const tipo = getEventType(evento);
  const minutos = getEventMinutes(evento);

  if (["pago", "compensado", "ajustado", "cancelado"].includes(status)) {
    return [];
  }

  const actions: Array<{ key: ActionType; label: string }> = [];

  if (minutos > 0 && tipo !== "pagamento") {
    actions.push({ key: "compensacao", label: "Compensar" });
    actions.push({ key: "pagamento", label: "Pagar" });
    actions.push({ key: "folga", label: "Folga" });
  }

  if (tipo !== "ajuste_manual") {
    actions.push({ key: "ajuste_manual", label: "Ajustar" });
  }

  return actions;
};

const ExtratoColaborador = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });
  const [actionLoading, setActionLoading] = useState<Record<string, ActionType | null>>({});
  const isExecuting = useRef(false);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>(null);
  const [actionMinutes, setActionMinutes] = useState("0");
  const [actionObservation, setActionObservation] = useState("");
  const [actionDate, setActionDate] = useState(new Date().toISOString().slice(0, 10));

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

  const { data: todosEventos = [] } = useQuery({
    queryKey: ["bh_eventos_all", id],
    queryFn: () => BHEventoService.getByColaborador(id!),
    enabled: !!id,
  });

  const processedEventos = useMemo(() => {
    return [...eventos]
      .sort((a: any, b: any) => {
        const dateA = new Date(getEventDate(a)).getTime();
        const dateB = new Date(getEventDate(b)).getTime();
        if (dateA !== dateB) return dateB - dateA;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      })
      .map((evento: any) => {
        const visualType = getVisualType(evento);
        const visual = visualTypeMap[visualType];
        return {
          ...evento,
          visualType,
          visual,
          displayDate: formatDate(getEventDate(evento).slice(0, 10)),
          displayType: visual.label,
          displayOrigin: toTitle(getEventSource(evento)),
          displayMinutes: formatMinutes(getEventMinutes(evento)),
          displayBalance: formatBalance(getEventBalance(evento)),
          displayDueDate: formatDate(evento.data_vencimento),
          displayStatus: statusMap[getEventStatus(evento)] || toTitle(getEventStatus(evento)),
          description: getEventDescription(evento),
          actions: getAvailableActions(evento),
        };
      });
  }, [eventos]);

  const totalMinutos = todosEventos.reduce((acc, curr) => acc + getEventMinutes(curr), 0);
  const totalCreditosPeriodo = processedEventos
    .filter((evento) => getEventMinutes(evento) > 0)
    .reduce((acc, evento) => acc + getEventMinutes(evento), 0);
  const totalDebitosPeriodo = processedEventos
    .filter((evento) => getEventMinutes(evento) < 0)
    .reduce((acc, evento) => acc + Math.abs(getEventMinutes(evento)), 0);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const in30Days = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 30);
    return date;
  }, [today]);

  const minutosVencidos = todosEventos.reduce((acc, evento) => {
    if (evento.data_vencimento && new Date(`${evento.data_vencimento}T00:00:00`) < today && getEventMinutes(evento) > 0) {
      return acc + getEventMinutes(evento);
    }
    return acc;
  }, 0);

  const minutosAVencer30d = todosEventos.reduce((acc, evento) => {
    const vencimento = evento.data_vencimento ? new Date(`${evento.data_vencimento}T00:00:00`) : null;
    if (vencimento && vencimento >= today && vencimento <= in30Days && getEventMinutes(evento) > 0) {
      return acc + getEventMinutes(evento);
    }
    return acc;
  }, 0);

  const openActionDialog = (evento: any, action: ActionType) => {
    setActionDialog({ evento, action });
    setActionObservation("");
    setActionMinutes("0");
    setActionDate(new Date().toISOString().slice(0, 10));
  };

  const closeActionDialog = () => {
    setActionDialog(null);
    setActionObservation("");
    setActionMinutes("0");
    setActionDate(new Date().toISOString().slice(0, 10));
  };

  const handleConfirmAction = async () => {
    if (!actionDialog || isExecuting.current) return;
    isExecuting.current = true;

    const { evento, action } = actionDialog;
    setActionLoading((current) => ({ ...current, [evento.id]: action }));

    try {
      await BHEventoService.registrarAcaoExtrato({
        eventoId: evento.id,
        tipo: action,
        observacao: actionObservation,
        minutos: action === "ajuste_manual" ? Number(actionMinutes) : undefined,
        dataFolga: action === "folga" ? actionDate : undefined,
      });

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["bh_eventos", id] }),
        queryClient.invalidateQueries({ queryKey: ["bh_eventos_all", id] }),
        queryClient.invalidateQueries({ queryKey: ["bh_saldos"] }),
      ]);

      toast.success(`${actionMetaMap[action].label} registrado`, {
        description: `A movimentacao de ${formatDate(getEventDate(evento).slice(0, 10))} foi aplicada de forma incremental.`,
      });
      closeActionDialog();
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : (error as { message?: string })?.message || "A acao foi cancelada e o historico nao foi alterado.";
      toast.error("Nao foi possivel concluir a acao", {
        description: msg,
      });
    } finally {
      setActionLoading((current) => ({ ...current, [evento.id]: null }));
      isExecuting.current = false;
    }
  };

  const handleExportPDF = () => {
    if (!colaborador) return;

    const doc = new jsPDF("l", "mm", "a4");

    doc.setFillColor(245, 246, 248);
    doc.rect(0, 0, 297, 34, "F");
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("Extrato de Banco de Horas", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`${colaborador.nome} | Matricula ${colaborador.matricula || "-"}`, 14, 25);

    const periodText =
      dateRange?.from && dateRange?.to
        ? `${format(dateRange.from, "dd/MM/yyyy")} a ${format(dateRange.to, "dd/MM/yyyy")}`
        : "Periodo completo";
    doc.text(`Periodo: ${periodText}`, 205, 18);
    doc.text(`Saldo atual: ${formatBalance(totalMinutos)}`, 205, 25);

    const tableData = processedEventos.map((evento) => [
      evento.displayDate,
      `${evento.displayType} ${evento.displayOrigin}`,
      evento.displayMinutes,
      evento.displayBalance,
      evento.displayDueDate,
      evento.displayStatus,
    ]);

    autoTable(doc, {
      startY: 42,
      head: [["Data", "Evento", "Minutos", "Saldo apos", "Vencimento", "Status"]],
      body: tableData,
      headStyles: { fillColor: [51, 65, 85] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    const fileName = `extrato_bh_${colaborador.nome.replace(/\s+/g, "_").toLowerCase()}_${format(new Date(), "yyyy-MM-dd")}.pdf`;
    doc.save(fileName);
  };

  const clearFilter = () => setDateRange(undefined);

  return (
    <AppShell
      title="Extrato do Colaborador"
      subtitle={colaborador ? `${colaborador.nome} - Mat. ${colaborador.matricula || "Sem matricula"}` : "Carregando..."}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild className="pl-0 hover:bg-transparent">
            <Link to="/banco-horas" className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              Voltar para o Painel
            </Link>
          </Button>

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn("justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                >
                  <Filter className="mr-1.5 h-4 w-4" />
                  {dateRange?.from ? (
                    dateRange.to ? (
                      <>
                        {format(dateRange.from, "dd/MM/yy")} - {format(dateRange.to, "dd/MM/yy")}
                      </>
                    ) : (
                      format(dateRange.from, "dd/MM/yy")
                    )
                  ) : (
                    <span>Filtrar periodo</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <div className="flex items-center justify-between border-b border-muted bg-muted/20 p-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Selecionar periodo
                  </span>
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

            <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={processedEventos.length === 0}>
              <Download className="mr-1.5 h-4 w-4" />
              PDF
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="esc-card border-primary/20 bg-primary-soft p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-primary">Saldo Atual</p>
            <h3 className="font-display text-2xl font-bold text-primary">{formatBalance(totalMinutos)}</h3>
          </div>
          <div className="esc-card p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Creditos no Periodo</p>
            <h3 className="font-display text-xl font-bold text-emerald-700">+{formatBalance(totalCreditosPeriodo).replace("+", "")}</h3>
          </div>
          <div className="esc-card p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Debitos no Periodo</p>
            <h3 className="font-display text-xl font-bold text-rose-700">-{formatBalance(totalDebitosPeriodo).replace("+", "").replace("-", "")}</h3>
          </div>
          <div className="esc-card p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Atencao de Vencimento</p>
            <h3 className="font-display text-lg font-bold text-amber-700">
              {formatBalance(minutosAVencer30d)} / {formatBalance(minutosVencidos)}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">A vencer em 30 dias / ja vencido</p>
          </div>
        </div>

        <section className="esc-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-muted px-5 py-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Extrato Bancario de Horas
              </span>
            </div>
            {dateRange?.from && (
              <span className="text-[10px] font-medium italic text-muted-foreground">
                Mostrando de {format(dateRange.from, "dd/MM/yyyy")}
                {dateRange.to ? ` ate ${format(dateRange.to, "dd/MM/yyyy")}` : ""}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : processedEventos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-12 text-center italic text-muted-foreground">
              <History className="h-8 w-8 opacity-20" />
              <p>Nenhum evento registrado no periodo selecionado.</p>
              {dateRange && (
                <Button variant="link" size="sm" onClick={clearFilter}>
                  Limpar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead className="esc-table-header">
                  <tr className="text-left">
                    <th className="h-11 px-5 font-medium">Data</th>
                    <th className="h-11 px-3 font-medium">Evento</th>
                    <th className="h-11 px-3 font-medium">Origem</th>
                    <th className="h-11 px-3 text-center font-medium">Minutos</th>
                    <th className="h-11 px-3 text-center font-medium">Saldo Apos</th>
                    <th className="h-11 px-3 text-center font-medium">Vencimento</th>
                    <th className="h-11 px-3 text-center font-medium">Status</th>
                    <th className="h-11 px-5 text-right font-medium">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {processedEventos.map((evento) => {
                    const Icon = evento.visual.icon;
                    const loadingAction = actionLoading[evento.id];

                    return (
                      <tr key={evento.id} className="border-t border-muted align-top hover:bg-background">
                        <td className="px-5 py-4">
                          <div className="font-medium text-foreground">{evento.displayDate}</div>
                          <div className="text-xs text-muted-foreground">
                            {evento.description || "Sem observacao"}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="flex items-center gap-2">
                            <span className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold", evento.visual.chip)}>
                              <span className="inline-flex items-center gap-1.5">
                                <Icon className="h-3.5 w-3.5" />
                                {evento.displayType}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-4 text-muted-foreground">{evento.displayOrigin}</td>
                        <td className="px-3 py-4 text-center">
                          <span className={cn("font-display font-semibold", evento.visual.amount)}>
                            {evento.displayMinutes}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span className="font-display font-semibold text-foreground">{evento.displayBalance}</span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
                              evento.data_vencimento ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-500",
                            )}
                          >
                            {evento.displayDueDate}
                          </span>
                        </td>
                        <td className="px-3 py-4 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold",
                              statusClassMap[getEventStatus(evento)] || statusClassMap.ativo,
                            )}
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {evento.displayStatus}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            {evento.actions.length === 0 ? (
                              <span className="text-xs text-muted-foreground">Sem acao</span>
                            ) : (
                              evento.actions.map((action) => (
                                <Button
                                  key={action.key}
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  disabled={Boolean(loadingAction)}
                                  onClick={() => openActionDialog(evento, action.key)}
                                >
                                  {loadingAction === action.key ? (
                                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                  ) : null}
                                  {action.label}
                                </Button>
                              ))
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Dialog open={Boolean(actionDialog)} onOpenChange={(open) => !open && closeActionDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionDialog ? actionMetaMap[actionDialog.action].title : "Acao operacional"}</DialogTitle>
            <DialogDescription>
              {actionDialog ? actionMetaMap[actionDialog.action].description : ""}
            </DialogDescription>
          </DialogHeader>

          {actionDialog && (
            <div className="space-y-4">
              <div className="rounded-lg border border-muted bg-muted/30 p-3 text-sm">
                <p className="font-medium text-foreground">{actionDialog.evento.displayDate}</p>
                <p className="text-muted-foreground">
                  Evento {actionDialog.evento.displayType} · saldo atual {formatBalance(totalMinutos)}
                </p>
                <p className="text-muted-foreground">
                  Referencia selecionada: {actionDialog.evento.displayMinutes}
                </p>
              </div>

              {actionDialog.action === "ajuste_manual" && (
                <div className="space-y-2">
                  <Label htmlFor="bh_action_minutes">Minutos do ajuste</Label>
                  <Input
                    id="bh_action_minutes"
                    type="number"
                    step="1"
                    value={actionMinutes}
                    onChange={(event) => setActionMinutes(event.target.value)}
                    placeholder="Ex: 30 ou -15"
                  />
                </div>
              )}

              {actionDialog.action === "folga" && (
                <div className="space-y-2">
                  <Label htmlFor="bh_action_date">Data da folga</Label>
                  <Input
                    id="bh_action_date"
                    type="date"
                    value={actionDate}
                    onChange={(event) => setActionDate(event.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="bh_action_observation">Observacao</Label>
                <Textarea
                  id="bh_action_observation"
                  value={actionObservation}
                  onChange={(event) => setActionObservation(event.target.value)}
                  placeholder="Descreva o motivo da acao para auditoria."
                  rows={4}
                />
              </div>

              {actionMetaMap[actionDialog.action].examples && actionMetaMap[actionDialog.action].examples.length > 0 && (
                <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 text-sm">
                  <p className="mb-2 font-medium text-primary">Exemplos de uso:</p>
                  <ul className="space-y-2">
                    {actionMetaMap[actionDialog.action].examples.map((example, i) => (
                      <li key={i} className="flex gap-2 text-muted-foreground leading-tight">
                        <span className="text-primary/70 shrink-0 mt-0.5">•</span>
                        <span>
                          <span className="font-medium text-foreground/80">{example.cause}</span>
                          <span className="opacity-75"> → {example.effect}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeActionDialog}
              disabled={Boolean(actionDialog ? actionLoading[actionDialog.evento.id] : null)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmAction}
              disabled={Boolean(
                !actionDialog ||
                !actionObservation.trim() ||
                (actionDialog.action === "ajuste_manual" && Number(actionMinutes) === 0) ||
                (actionDialog.action === "folga" && !actionDate) ||
                (actionDialog ? actionLoading[actionDialog.evento.id] : null),
              )}
            >
              {actionDialog && actionLoading[actionDialog.evento.id] === actionDialog.action ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {actionDialog ? actionMetaMap[actionDialog.action].confirmLabel : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default ExtratoColaborador;
