import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, endOfMonth, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CalendarClock,
  ChevronRight,
  ChevronLeft,
  Download,
  Edit3,
  Filter,
  RefreshCcw,
  HandCoins,
  History,
  Loader2,
  ShieldCheck,
  X,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
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
    label: "Financeiro",
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
  pago: "Encaminhado ao financeiro",
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

const actionMetaMap: Record<ActionType, { label: string; title: string; description: string; confirmLabel: string; icon: any; examples: { cause: string; effect: string }[] }> = {
  ajuste_manual: {
    label: "Ajustar",
    title: "Ajuste manual",
    description: "Informe minutos positivos ou negativos e registre a observacao obrigatoria para auditoria.",
    confirmLabel: "Salvar ajuste",
    icon: Edit3,
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
    icon: RefreshCcw,
    examples: [
      { cause: "colaborador saiu mais cedo", effect: "saldo positivo abatido" },
      { cause: "colaborador utilizou horas acumuladas", effect: "banco reduzido internamente" },
      { cause: "acordo de compensação aprovado", effect: "RH consome o saldo disponível" },
    ],
  },
  pagamento: {
    label: "Marcar para pagamento",
    title: "Marcar saldo para pagamento",
    description: "O saldo sera abatido no banco de horas e sinalizado para continuidade na esteira financeira, sem executar pagamento nesta tela.",
    confirmLabel: "Marcar para pagamento",
    icon: Banknote,
    examples: [
      { cause: "empresa decidiu liquidar o saldo via folha", effect: "horas positivas enviadas ao financeiro" },
      { cause: "fechamento mensal aprovado", effect: "saldo marcado para reflexo financeiro" },
      { cause: "colaborador nao ira compensar", effect: "saldo encerrado e liberado para analise financeira" },
    ],
  },
  folga: {
    label: "Folga",
    title: "Lancar folga",
    description: "Informe a data da folga para registrar o abatimento do banco de horas com trilha de auditoria.",
    confirmLabel: "Confirmar folga",
    icon: CalendarClock,
    examples: [
      { cause: "colaborador tirou folga usando banco", effect: "saldo abatido automaticamente" },
      { cause: "folga compensatória aprovada", effect: "horas convertidas em descanso" },
      { cause: "banco utilizado para ausência autorizada", effect: "sistema registra abatimento" },
    ],
  },
};

const AJUSTE_QUICK_ACTIONS = [
  { label: "+ 1 dia (8h)", minutes: 480 },
  { label: "+ Meio dia (4h)", minutes: 240 },
  { label: "- Hora de almoço", minutes: -60 },
];

const AJUSTE_QUICK_MOTIVOS = [
  "Abono de falta justificada (Atestado verificado)",
  "Erro no registro do relógio (Batida dupla / Falha app)",
  "Acordo interno de compensação excepcional aprovado",
  "Esquecimento da marcação verificado com líder",
];

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
    actions.push({ key: "pagamento", label: "Marcar para pagamento" });
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const highlightId = searchParams.get("highlight");
  const fromContext = searchParams.get("from");
  const contextDate = searchParams.get("data");
  const isFromProcessamentoRH = fromContext === "processamento-rh";

  const [highlightDismissed, setHighlightDismissed] = useState(false);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    if (contextDate) {
      const d = new Date(`${contextDate}T00:00:00`);
      return { from: startOfMonth(d), to: endOfMonth(d) };
    }
    return { from: startOfMonth(new Date()), to: endOfMonth(new Date()) };
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
  const valorHoraEstimado = useMemo(() => {
    const directValue = Number(colaborador?.valor_hora ?? 0);
    if (directValue > 0) return directValue;

    const salaryBase = Number(colaborador?.salario_base ?? 0);
    if (salaryBase > 0) return salaryBase / 220;

    const dailyValue = Number(colaborador?.valor_diaria ?? 0);
    if (dailyValue > 0) return dailyValue / 8;

    const baseValue = Number(colaborador?.valor_base ?? 0);
    if (baseValue > 0) return baseValue / 8;

    return 0;
  }, [colaborador]);
  const impactoFinanceiroAtual = Math.max(totalMinutos, 0) / 60 * valorHoraEstimado;
  const competenciaReferencia = processedEventos[0]?.displayDate ? processedEventos[0].displayDate.slice(3, 10) : "-";

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

  const dismissHighlight = useCallback(() => {
    setHighlightDismissed(true);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("highlight");
    newParams.delete("data");
    newParams.delete("from");
    setSearchParams(newParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (highlightId && !highlightDismissed && highlightedRowRef.current) {
      const timer = setTimeout(() => {
        highlightedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [highlightId, highlightDismissed, processedEventos]);

  return (
    <AppShell
      title="Extrato do Colaborador"
      subtitle={colaborador ? `${colaborador.nome} - Mat. ${colaborador.matricula || "Sem matricula"}` : "Carregando..."}
    >
      <div className="space-y-6">
        {isFromProcessamentoRH && (
          <div className="rounded-xl border border-amber-300/70 bg-amber-50/60 p-4 flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 space-y-1">
              <p className="font-semibold text-foreground text-sm">Bloqueio detectado pelo Processamento RH</p>
              <p className="text-xs text-muted-foreground">
                Resolva o evento destacado abaixo e volte ao Processamento RH para revalidar a aprovação da competência.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5"
              onClick={() => navigate("/banco-horas/processamento")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Processamento
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" asChild className="pl-0 hover:bg-transparent">
            <Link to={isFromProcessamentoRH ? "/banco-horas/processamento" : "/banco-horas"} className="flex items-center gap-2">
              <ChevronLeft className="h-4 w-4" />
              {isFromProcessamentoRH ? "Voltar ao Processamento RH" : "Voltar para o Painel"}
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

        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
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
          <div className="esc-card p-5">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Impacto Financeiro</p>
            <h3 className="font-display text-lg font-bold text-foreground">
              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(impactoFinanceiroAtual || 0)}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">Competencia de referencia {competenciaReferencia}</p>
          </div>
        </div>

        <section className="esc-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-muted px-5 py-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Historico do Banco de Horas
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
                    const isHighlighted = !highlightDismissed && highlightId && (
                      evento.id === highlightId ||
                      evento.referencia_evento_id === highlightId ||
                      evento.registro_ponto_id === highlightId
                    );

                    return (
                      <tr
                        key={evento.id}
                        ref={isHighlighted ? highlightedRowRef : undefined}
                        className={cn(
                          "border-t border-muted align-top hover:bg-background transition-all",
                          isHighlighted && "bg-amber-50 ring-2 ring-amber-400/60 ring-inset animate-pulse",
                        )}
                      >
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
                              evento.actions.map((action) => {
                                const ActionIcon = actionMetaMap[action.key].icon;

                                return (
                                  <Button
                                    key={action.key}
                                    variant="outline"
                                    size="sm"
                                    className="h-8 gap-1.5"
                                    disabled={Boolean(loadingAction)}
                                    onClick={() => openActionDialog(evento, action.key)}
                                  >
                                    {loadingAction === action.key ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <ActionIcon className="h-3.5 w-3.5" />
                                    )}
                                    {action.label}
                                  </Button>
                                );
                              })
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-end gap-1 text-[11px] font-medium text-muted-foreground">
                            <span>Fluxo rastreável</span>
                            <ChevronRight className="h-3.5 w-3.5" />
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
        <DialogContent className="sm:max-w-lg max-h-[96vh] flex flex-col p-5 gap-4">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              {actionDialog ? (
                <>
                  {(() => {
                    const DialogIcon = actionMetaMap[actionDialog.action].icon;
                    return <DialogIcon className="h-4 w-4 text-primary" />;
                  })()}
                  {actionMetaMap[actionDialog.action].title}
                </>
              ) : (
                "Acao operacional"
              )}
            </DialogTitle>
            <DialogDescription>
              {actionDialog ? actionMetaMap[actionDialog.action].description : ""}
            </DialogDescription>
          </DialogHeader>

          {actionDialog && (
            <div className="flex-1 overflow-y-auto pr-1 space-y-3">
              {actionDialog.action !== "ajuste_manual" && (
                <div className="rounded-lg border border-muted bg-muted/30 p-2.5 text-sm shrink-0">
                  <p className="font-medium text-foreground">{actionDialog.evento.displayDate}</p>
                  <p className="text-muted-foreground">
                    Evento {actionDialog.evento.displayType} · saldo atual {formatBalance(totalMinutos)}
                  </p>
                  <p className="text-muted-foreground">
                    Referencia selecionada: {actionDialog.evento.displayMinutes}
                  </p>
                </div>
              )}

              {actionDialog.action === "ajuste_manual" && (
                <div className="space-y-4">
                  {(() => {
                    const evtMins = getEventMinutes(actionDialog.evento);
                    const needsZero = evtMins < 0 ? Math.abs(evtMins) : -evtMins;
                    if (needsZero === 0) return null;
                    return (
                      <div
                        className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 flex flex-col gap-2 cursor-pointer hover:border-emerald-300 hover:shadow-sm transition-all group"
                        onClick={() => setActionMinutes(String(needsZero))}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-emerald-700">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase tracking-wider">Recomendado pelo sistema</span>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 border-none px-2 group-hover:bg-emerald-200 transition-colors">
                            Zerar pêndencia ({needsZero > 0 ? '+' : ''}{needsZero}m)
                          </Badge>
                        </div>
                        <p className="text-xs text-emerald-800/80 font-medium leading-snug">
                          Aplica a exata contrapartida na matriz de cálculo. A resolução desta operação estabiliza o evento e o libera automaticamente da fila operacional.
                        </p>
                      </div>
                    );
                  })()}

                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bh_action_minutes">Ou informe o tempo personalizado</Label>
                      {actionMinutes && (
                        <div className="text-xs font-semibold text-primary/80 bg-primary/10 px-2 py-0.5 rounded">
                          {formatMinutes(Number(actionMinutes) || 0)}
                          {Math.abs(Number(actionMinutes) || 0) === 480 ? " (≈ 1 jornada)" : ""}
                        </div>
                      )}
                    </div>
                    <Input
                      id="bh_action_minutes"
                      type="number"
                      step="1"
                      value={actionMinutes}
                      onChange={(event) => setActionMinutes(event.target.value)}
                      placeholder="Ex: 480 (8h) ou -60 (-1h)"
                      className="font-mono text-base"
                    />

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {AJUSTE_QUICK_ACTIONS.map(qa => (
                        <Badge
                          key={qa.label}
                          variant="outline"
                          className="cursor-pointer hover:bg-muted transition-colors"
                          onClick={() => setActionMinutes(String(qa.minutes))}
                        >
                          {qa.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-sm">
                    <h4 className="font-semibold text-sky-900 mb-2.5 text-[10px] uppercase tracking-widest">Impacto Projetado Operacional</h4>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-sky-800 text-xs">
                        <span>Ponto processado na data:</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="opacity-60 line-through decoration-rose-400/50">{formatMinutes(getEventMinutes(actionDialog.evento))}</span>
                          <ArrowRight className="h-3 w-3 opacity-60" />
                          <span className="font-semibold px-1 rounded bg-sky-100 text-sky-900">
                            {formatMinutes(getEventMinutes(actionDialog.evento) + (Number(actionMinutes) || 0))}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sky-800 text-[11px] border-t border-sky-100 pt-1.5">
                        <span>Saldo geral acumulado:</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="opacity-60">{formatBalance(totalMinutos)}</span>
                          <ArrowRight className="h-3 w-3 opacity-60" />
                          <span className="font-bold">
                            {formatBalance(totalMinutos + (Number(actionMinutes) || 0))}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
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
                <Label htmlFor="bh_action_observation">Observacao para Auditoria</Label>
                <Textarea
                  id="bh_action_observation"
                  value={actionObservation}
                  onChange={(event) => setActionObservation(event.target.value)}
                  placeholder="Descreva o motivo da acao obrigatoriamente."
                  rows={actionDialog.action === "ajuste_manual" ? 2 : 4}
                  className="resize-none"
                />

                {actionDialog.action === "ajuste_manual" && (
                  <div className="pt-1 select-none">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">Justificativas Rápidas:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {AJUSTE_QUICK_MOTIVOS.map(txt => (
                        <Badge
                          key={txt}
                          variant="outline"
                          className="cursor-pointer text-[10px] py-0.5 hover:bg-primary/5 transition-colors border-dashed"
                          onClick={() => {
                            const current = actionObservation.trim();
                            setActionObservation(current ? `${current} - ${txt}` : txt);
                          }}
                        >
                          + {txt}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {actionDialog.action !== "ajuste_manual" && actionMetaMap[actionDialog.action].examples && actionMetaMap[actionDialog.action].examples.length > 0 && (
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

          <DialogFooter className="shrink-0 pt-2">
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
              ) : actionDialog ? (
                (() => {
                  const ConfirmIcon = actionMetaMap[actionDialog.action].icon;
                  return <ConfirmIcon className="mr-2 h-4 w-4" />;
                })()
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
