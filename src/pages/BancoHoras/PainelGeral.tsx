import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarClock,
  CheckSquare,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Loader2,
  Maximize2,
  RefreshCcw,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { StatusChip } from "@/components/painel/StatusChip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { BHEventoService } from "@/services/v4.service";

const formatTotal = (mins: number) => {
  const h = Math.floor(Math.abs(mins) / 60);
  const m = Math.abs(mins) % 60;
  const sign = mins < 0 ? "-" : "";
  return `${sign}${h}h${m > 0 ? ` ${m}m` : ""}`;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value || 0);

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
};

const csvEscape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const statusOptions = [
  { value: "all", label: "Todos Status" },
  { value: "saldo_positivo", label: "Saldo Positivo" },
  { value: "debito_leve", label: "Debito Leve" },
  { value: "debito_critico", label: "Debito Critico" },
  { value: "horas_a_vencer", label: "Horas a vencer" },
  { value: "excesso_banco", label: "Excesso de banco" },
  { value: "aguardando_rh", label: "Aguardando acao RH" },
  { value: "ok", label: "OK" },
];

const timelineOptions = [
  { value: "all", label: "Todos eventos" },
  { value: "pagamentos", label: "Somente pagamentos" },
  { value: "creditos_rh", label: "Somente creditos RH" },
  { value: "ajustes", label: "Somente ajustes" },
  { value: "vencimentos", label: "Somente vencimentos" },
  { value: "folgas", label: "Somente folgas" },
];

const rowPriorityClass = (saldo: any) => {
  if (saldo.status === "debito_critico") return "bg-rose-50/70";
  if (saldo.status === "horas_a_vencer") return "bg-orange-50/60";
  if (saldo.status === "aguardando_rh") return "bg-violet-50/60";
  return "";
};

const getTimelineCardClass = (item: any) => {
  if (item.status_timeline === "vencido" || item.status_timeline === "critico") {
    return "border-rose-200 bg-rose-50/70";
  }
  if (item.status_timeline === "proximo_vencimento") {
    return "border-amber-200 bg-amber-50/70";
  }
  if (item.status_timeline === "pago") {
    return "border-emerald-200 bg-emerald-50/70";
  }
  if (item.status_timeline === "folga_lancada") {
    return "border-indigo-200 bg-indigo-50/70";
  }
  return "border-border/70 bg-background";
};

const compactBullet = "mt-1 flex items-center gap-2 text-xs leading-5 text-muted-foreground";

const PainelGeral = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    search: "",
    empresa_id: "all",
    status: "all",
    showWithoutMovement: false,
  });
  const [timelineFilter, setTimelineFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedTimelineEvent, setSelectedTimelineEvent] = useState<any | null>(null);
  const [isPriorizacaoModalOpen, setIsPriorizacaoModalOpen] = useState(false);

  const { data: saldos = [], isLoading } = useQuery({
    queryKey: ["bh_saldos", filters.showWithoutMovement],
    queryFn: () =>
      BHEventoService.getSaldosGerais({
        includeWithoutMovement: filters.showWithoutMovement,
      }),
  });

  const { data: timeline = [], isLoading: isLoadingTimeline } = useQuery({
    queryKey: ["bh_timeline_operacional"],
    queryFn: () => BHEventoService.getTimelineOperacional(120),
  });

  const empresas = Array.from(new Set(saldos.map((saldo: any) => saldo.empresa).filter(Boolean))) as string[];

  const filteredSaldos = useMemo(() => {
    const search = filters.search.toLowerCase();

    const smartSaldos = saldos.map((saldo: any) => {
      let smartStatus = "ok";
      let smartStatusLabel = "OK";
      let smartPriority = 5;

      if (saldo.saldo_minutos < -60) {
        smartStatus = "debito_critico";
        smartStatusLabel = "Débito crítico";
        smartPriority = 1;
      } else if (saldo.saldo_minutos < 0) {
        smartStatus = "debito_pendente";
        smartStatusLabel = "Débito pendente";
        smartPriority = 4;
      } else if (Number(saldo.minutos_a_vencer_30d || 0) > 0 || Number(saldo.minutos_vencidos || 0) > 0) {
        smartStatus = "horas_a_vencer";
        smartStatusLabel = "A vencer";
        smartPriority = 2;
      } else if (saldo.saldo_minutos > 0) {
        smartStatus = "saldo_positivo";
        smartStatusLabel = "Saldo positivo";
        smartPriority = 3;
      }

      return {
        ...saldo,
        status: smartStatus,
        status_label: smartStatusLabel,
        status_priority: smartPriority
      };
    });

    return smartSaldos
      .filter((saldo: any) => {
        const matchesSearch =
          saldo.nome?.toLowerCase().includes(search) ||
          saldo.matricula?.toLowerCase().includes(search);
        const matchesEmpresa = filters.empresa_id === "all" || saldo.empresa === filters.empresa_id;
        const matchesStatus = filters.status === "all" || saldo.status === filters.status;

        return matchesSearch && matchesEmpresa && matchesStatus;
      })
      .sort((a: any, b: any) => {
        if (a.status_priority !== b.status_priority) {
          return a.status_priority - b.status_priority;
        }

        if (a.status === "debito_critico" || a.status === "debito_pendente") {
          return a.saldo_minutos - b.saldo_minutos; // Maior negativo primeiro
        }

        if (a.status === "horas_a_vencer") {
          const aVencerA = Number(a.minutos_vencidos || 0) + Number(a.minutos_a_vencer_30d || 0);
          const aVencerB = Number(b.minutos_vencidos || 0) + Number(b.minutos_a_vencer_30d || 0);
          return aVencerB - aVencerA; // Maior quantidade a vencer primeiro
        }

        if (a.status === "saldo_positivo") {
          return b.saldo_minutos - a.saldo_minutos; // Maior positivo primeiro
        }

        return String(a.nome || "").localeCompare(String(b.nome || ""));
      });
  }, [filters.empresa_id, filters.search, filters.status, saldos]);

  const selectedRows = useMemo(
    () => filteredSaldos.filter((saldo: any) => selectedIds.includes(saldo.id)),
    [filteredSaldos, selectedIds],
  );

  const allFilteredSelected =
    filteredSaldos.length > 0 && filteredSaldos.every((saldo: any) => selectedIds.includes(saldo.id));

  const totalMinutosAcumulados = filteredSaldos.reduce(
    (acc, saldo: any) => acc + (saldo.saldo_minutos > 0 ? saldo.saldo_minutos : 0),
    0,
  );
  const totalDebitos = filteredSaldos.reduce(
    (acc, saldo: any) => acc + (saldo.saldo_minutos < 0 ? Math.abs(saldo.saldo_minutos) : 0),
    0,
  );
  const totalMinutosAVencer = filteredSaldos.reduce(
    (acc, saldo: any) => acc + Number(saldo.minutos_a_vencer_30d || 0),
    0,
  );
  const totalCompensadas = timeline.reduce((acc: number, item: any) => {
    if (["pagamentos", "folgas", "ajustes"].includes(item.categoria) && item.minutos < 0) {
      return acc + Math.abs(Number(item.minutos || 0));
    }
    return acc;
  }, 0);
  const colaboradoresEmRisco = filteredSaldos.filter((saldo: any) =>
    ["debito_critico", "horas_a_vencer", "aguardando_rh"].includes(saldo.status),
  ).length;
  const riscoFinanceiroMes = filteredSaldos.reduce((acc, saldo: any) => {
    if (["debito_critico", "horas_a_vencer", "excesso_banco"].includes(saldo.status)) {
      return acc + Number(saldo.estimativa_valor || 0);
    }
    return acc;
  }, 0);

  const soonestDue = filteredSaldos
    .filter((saldo: any) => typeof saldo.dias_para_vencer === "number" && saldo.dias_para_vencer >= 0)
    .sort((a: any, b: any) => Number(a.dias_para_vencer) - Number(b.dias_para_vencer))[0];

  const colaboradoresSaldoAntigo = filteredSaldos.filter(
    (saldo: any) => Number(saldo.saldo_antigo_minutos || 0) > 0 || Number(saldo.minutos_vencidos || 0) > 0,
  );

  const timelineFiltered = useMemo(() => {
    return timeline.filter((item: any) => {
      const matchesCategory = timelineFilter === "all" || item.categoria === timelineFilter;
      const matchesEmpresa = filters.empresa_id === "all" || item.empresa_nome === filters.empresa_id;
      const searchTerm = filters.search.toLowerCase();
      const matchesSearch =
        !filters.search ||
        String(item.colaborador_nome || "").toLowerCase().includes(searchTerm) ||
        String(item.descricao || "").toLowerCase().includes(searchTerm) ||
        String(item.tipo_evento || "").toLowerCase().includes(searchTerm) ||
        String(item.status_timeline_label || "").toLowerCase().includes(searchTerm);

      return matchesCategory && matchesEmpresa && matchesSearch;
    });
  }, [filters.empresa_id, filters.search, timeline, timelineFilter]);

  const custoPorColaborador = useMemo(
    () =>
      [...filteredSaldos]
        .filter((saldo: any) => Number(saldo.estimativa_valor || 0) > 0)
        .sort((a: any, b: any) => Number(b.estimativa_valor || 0) - Number(a.estimativa_valor || 0))
        .slice(0, 5),
    [filteredSaldos],
  );

  const custoPorEmpresa = useMemo(() => {
    const grouped = new Map<string, { empresa: string; valor: number; horas: number; pessoas: number }>();

    filteredSaldos.forEach((saldo: any) => {
      const key = saldo.empresa || "Sem empresa";
      const current = grouped.get(key) || { empresa: key, valor: 0, horas: 0, pessoas: 0 };
      current.valor += Number(saldo.estimativa_valor || 0);
      current.horas += Math.max(Number(saldo.saldo_minutos || 0), 0);
      current.pessoas += 1;
      grouped.set(key, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.valor - a.valor).slice(0, 4);
  }, [filteredSaldos]);

  const exportRows = (rows: any[], kind: "fechamento" | "financeiro") => {
    if (rows.length === 0) {
      toast.warning("Nenhum colaborador selecionado para exportacao.");
      return;
    }

    const headers =
      kind === "financeiro"
        ? ["Colaborador", "Matricula", "Empresa", "Saldo", "Status", "Valor Hora", "Custo Estimado"]
        : ["Colaborador", "Matricula", "Empresa", "Saldo", "Vencido", "A Vencer", "Status"];

    const payload = rows.map((saldo) =>
      kind === "financeiro"
        ? [
          saldo.nome,
          saldo.matricula,
          saldo.empresa,
          saldo.saldo_formatado,
          saldo.status_label,
          Number(saldo.valor_hora_estimado || 0).toFixed(2),
          Number(saldo.estimativa_valor || 0).toFixed(2),
        ]
        : [
          saldo.nome,
          saldo.matricula,
          saldo.empresa,
          saldo.saldo_formatado,
          saldo.vencido_formatado,
          saldo.a_vencer_formatado,
          saldo.status_label,
        ],
    );

    const csvContent =
      "\uFEFF" +
      [headers, ...payload]
        .map((row) => row.map((value) => csvEscape(value)).join(";"))
        .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${kind}-banco-horas-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const handleToggleSelectAll = () => {
    setSelectedIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredSaldos.some((saldo: any) => saldo.id === id));
      }

      const next = new Set(current);
      filteredSaldos.forEach((saldo: any) => next.add(saldo.id));
      return Array.from(next);
    });
  };

  const handleMassPlaceholder = (action: string) => {
    if (selectedRows.length === 0) {
      toast.warning("Selecione ao menos um colaborador para usar a acao em massa.");
      return;
    }

    toast.info(`${action} preparado para ${selectedRows.length} colaborador(es).`, {
      description: "Fluxo operacional habilitado na interface. Integracao final fica para o proximo passo.",
    });
  };

  const setFilterAndScroll = (newStatus: string) => {
    setFilters((current) => ({ ...current, status: newStatus }));
    setTimeout(() => {
      window.scrollTo({
        top: document.getElementById("bh-table-section")?.offsetTop ? document.getElementById("bh-table-section")!.offsetTop - 100 : 0,
        behavior: "smooth",
      });
    }, 100);
  };

  const stats = [
    {
      label: "Total horas a pagar",
      value: isLoading ? "..." : formatTotal(totalMinutosAcumulados),
      icon: Clock,
      color: "text-primary",
      bg: "bg-primary-soft",
      action: () => setFilterAndScroll("saldo_positivo"),
    },
    {
      label: "Total compensadas",
      value: isLoadingTimeline ? "..." : formatTotal(totalCompensadas),
      icon: CheckSquare,
      color: "text-emerald-700",
      bg: "bg-emerald-100",
      action: () => {
        setTimelineFilter("all");
        setTimeout(() => {
          window.scrollTo({
            top: document.getElementById("bh-timeline-section")?.offsetTop ? document.getElementById("bh-timeline-section")!.offsetTop - 100 : 0,
            behavior: "smooth",
          });
        }, 100);
      },
    },
    {
      label: "Debitos colaboradores",
      value: isLoading ? "..." : formatTotal(totalDebitos),
      icon: ShieldAlert,
      color: "text-rose-700",
      bg: "bg-rose-100",
      action: () => setFilterAndScroll("debito_critico"),
    },
    {
      label: "Risco financeiro do mes",
      value: isLoading ? "..." : formatCurrency(riscoFinanceiroMes),
      icon: Wallet,
      color: "text-orange-700",
      bg: "bg-orange-100",
      action: () => {
        setTimeout(() => {
          window.scrollTo({
            top: document.getElementById("bh-financial-section")?.offsetTop ? document.getElementById("bh-financial-section")!.offsetTop - 100 : 0,
            behavior: "smooth",
          });
        }, 100);
      },
    },
  ];

  const emptyMessage =
    saldos.length === 0
      ? "Nenhum saldo de banco de horas encontrado para este periodo."
      : "Nenhum colaborador encontrado com os filtros atuais.";

  return (
    <AppShell title="Banco de Horas" subtitle="Painel geral de saldos, vencimentos e risco operacional">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <button
              key={stat.label}
              onClick={stat.action}
              className="esc-card flex min-h-[92px] items-start justify-between p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground group-hover:text-foreground">
                  {stat.label}
                </p>
                <h3 className="font-display text-xl font-bold text-foreground md:text-2xl">{stat.value}</h3>
              </div>
              <div className={cn("rounded-lg p-2 transition-colors", stat.bg)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <section className="esc-card border border-orange-200 bg-orange-50/70 p-3 h-[130px] flex flex-col justify-center transition-colors hover:border-orange-300">
            <div className="flex items-start gap-2">
              <div className="rounded-lg bg-orange-100 p-1.5 shrink-0">
                <CalendarClock className="h-3.5 w-3.5 text-orange-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-orange-700">
                    Alerta de vencimento
                  </p>
                  {soonestDue && !isLoading ? (
                    <span className="text-[10px] font-medium text-orange-700">
                      {soonestDue.dias_para_vencer} dia(s)
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1 mt-1.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  <div className={compactBullet}>
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">
                      {isLoading
                        ? "Carregando alertas..."
                        : soonestDue
                          ? `${soonestDue.a_vencer_7d_formatado} vencem em ${soonestDue.dias_para_vencer} dia(s)`
                          : "Nenhum vencimento critico"}
                    </span>
                  </div>
                  <div className={compactBullet}>
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="truncate">
                      {totalMinutosAVencer > 0
                        ? `${formatTotal(totalMinutosAVencer)} vencem em ate 30 dias`
                        : "Nenhuma hora vence em 30 dias"}
                    </span>
                  </div>
                  <div className={compactBullet}>
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
                    <span className="truncate">
                      {colaboradoresSaldoAntigo.length > 0
                        ? `${colaboradoresSaldoAntigo.length} colaborador(es) com saldo antigo`
                        : "Nenhum saldo antigo no recorte"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="esc-card p-3 h-[130px] flex flex-col hover:border-rose-200 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-rose-100 p-1.5 shrink-0">
                <Users className="h-3.5 w-3.5 text-rose-700" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                  Priorizacao visual
                </p>
                <h2 className="font-display text-sm font-semibold text-foreground leading-tight mt-0.5">
                  {colaboradoresEmRisco} colaborador(es) no radar
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 ml-1"
                onClick={() => setIsPriorizacaoModalOpen(true)}
                title="Expandir lista de priorização"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
              {filteredSaldos.slice(0, 3).map((saldo: any) => (
                <div
                  key={saldo.id}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/50 transition-colors",
                    saldo.status === "debito_critico"
                      ? "bg-rose-50/50"
                      : saldo.status === "horas_a_vencer"
                        ? "bg-orange-50/50"
                        : "bg-transparent",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium leading-5 text-foreground">{saldo.nome}</p>
                    <p className="text-xs text-muted-foreground">{saldo.empresa || "Sem empresa"}</p>
                  </div>
                  <div className="text-right">
                    <p
                      className={cn(
                        "font-medium text-sm leading-tight text-right",
                        saldo.saldo_minutos < 0 ? "text-rose-700" : "text-foreground",
                      )}
                    >
                      {saldo.saldo_formatado}
                    </p>
                    <div className="scale-75 origin-right -mt-0.5 -mb-1">
                      <StatusChip status={saldo.status} label={saldo.status_label} />
                    </div>
                  </div>
                </div>
              ))}
              {filteredSaldos.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                  Nenhum colaborador priorizado no momento.
                </div>
              )}
            </div>
          </section>

          <section className="esc-card p-3 h-[130px] flex flex-col hover:border-primary/20 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-emerald-100 p-1.5 shrink-0">
                <Wallet className="h-3.5 w-3.5 text-emerald-700" />
              </div>
              <div className="flex-1 flex justify-between items-center pr-1">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                    Visão financeira
                  </p>
                  <h2 className="font-display text-sm font-semibold text-foreground leading-tight mt-0.5">
                    Contabilidade de horas
                  </h2>
                </div>
                <div className="text-right">
                  <p className="font-display text-base font-semibold text-primary leading-none">
                    {formatCurrency(
                      filteredSaldos.reduce(
                        (acc, saldo: any) => acc + Number(saldo.estimativa_valor || 0),
                        0,
                      ),
                    )}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-primary/70 mt-0.5">Impacto folha</p>
                </div>
              </div>
            </div>


            <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {custoPorColaborador.map((saldo: any) => (
                <div key={saldo.id} className="flex flex-col justify-center rounded-md px-2 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium leading-tight text-foreground">{saldo.nome}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {saldo.empresa || "Sem empresa"} • {saldo.saldo_formatado}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm text-foreground leading-tight">{formatCurrency(saldo.estimativa_valor)}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatCurrency(saldo.valor_hora_estimado)}/h
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {custoPorColaborador.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                  Sem exposicao financeira calculavel no recorte atual.
                </div>
              )}
            </div>
          </section>

          <section className="esc-card p-3 h-[130px] flex flex-col hover:border-indigo-200 transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-lg bg-indigo-100 p-1.5 shrink-0">
                <Building2 className="h-3.5 w-3.5 text-indigo-700" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-tight">
                  Custo por empresa
                </p>
                <h2 className="font-display text-sm font-semibold text-foreground leading-tight mt-0.5">
                  Análise consolidada
                </h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {custoPorEmpresa.map((empresa) => (
                <div key={empresa.empresa} className="flex flex-col justify-center rounded-md px-2 py-1.5 border-b border-border/40 last:border-0 hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium leading-tight text-foreground">{empresa.empresa}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatTotal(empresa.horas)} em banco • {empresa.pessoas} colab.
                      </p>
                    </div>
                    <p className="font-medium text-sm text-foreground">{formatCurrency(empresa.valor)}</p>
                  </div>
                </div>
              ))}

              {custoPorEmpresa.length === 0 && (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-xs text-muted-foreground">
                  Sem custo consolidado por empresa neste momento.
                </div>
              )}
            </div>
          </section>
        </div >

        <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-background/70 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex w-full flex-1 flex-col gap-3 md:w-auto">
              <div className="flex items-center gap-3">
                <Switch
                  checked={filters.showWithoutMovement}
                  onCheckedChange={(checked) =>
                    setFilters((current) => ({ ...current, showWithoutMovement: checked }))
                  }
                  aria-label="Mostrar colaboradores sem movimento"
                />
                <span className="text-sm text-muted-foreground">Mostrar colaboradores sem movimento</span>
              </div>

              <div className="flex w-full flex-1 flex-col gap-2 md:flex-row">
                <div className="relative flex-1 md:max-w-xs">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar colaborador..."
                    className="h-9 pl-9"
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((current) => ({ ...current, search: event.target.value }))
                    }
                  />
                </div>

                <Select
                  value={filters.empresa_id}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, empresa_id: value }))
                  }
                >
                  <SelectTrigger className="h-9 w-full md:w-[200px]">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa} value={empresa}>
                        {empresa}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={filters.status}
                  onValueChange={(value) =>
                    setFilters((current) => ({ ...current, status: value }))
                  }
                >
                  <SelectTrigger className="h-9 w-full md:w-[220px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportRows(filteredSaldos, "fechamento")} className="h-9">
                <Download className="mr-2 h-4 w-4" />
                Exportar fechamento
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["bh_saldos"] });
                  queryClient.invalidateQueries({ queryKey: ["bh_timeline_operacional"] });
                }}
                title="Atualizar dados"
              >
                <RefreshCw className={cn("h-4 w-4", (isLoading || isLoadingTimeline) && "animate-spin")} />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3">
            <span className="text-sm font-medium text-foreground mr-2">
              {selectedRows.length} selecionado(s)
            </span>
            <Button variant="outline" size="sm" className="h-8 gap-2 hover:bg-muted" onClick={() => handleMassPlaceholder("Compensacao multipla")}>
              <RefreshCcw className="h-3.5 w-3.5 text-muted-foreground" />
              Compensar multiplos
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2 hover:bg-muted" onClick={() => exportRows(selectedRows, "fechamento")}>
              <Download className="h-3.5 w-3.5 text-muted-foreground" />
              Exportar fechamento
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2 hover:bg-muted" onClick={() => handleMassPlaceholder("Aprovacao de pagamentos")}>
              <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Aprovar pagamentos
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-2 hover:bg-muted" onClick={() => exportRows(selectedRows, "financeiro")}>
              <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
              Gerar relatorio financeiro
            </Button>
          </div>
        </div>

        <section className="esc-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="esc-table-header">
                  <tr className="text-left">
                    <th className="h-11 px-4 text-center font-medium">
                      <input
                        type="checkbox"
                        checked={allFilteredSelected}
                        onChange={handleToggleSelectAll}
                        aria-label="Selecionar todos"
                      />
                    </th>
                    <th className="h-11 px-5 font-medium">Colaborador</th>
                    <th className="h-11 px-3 font-medium">Empresa</th>
                    <th className="h-11 px-3 text-center font-medium">Saldo Atual</th>
                    <th className="h-11 px-3 text-center font-medium">Vencido</th>
                    <th className="h-11 px-3 text-center font-medium">A Vencer</th>
                    <th className="h-11 px-3 text-center font-medium">Custo Est.</th>
                    <th className="h-11 px-5 text-center font-medium">Status</th>
                    <th className="h-11 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSaldos.map((saldo: any) => (
                    <tr
                      key={saldo.id}
                      className={cn(
                        "group border-t border-muted hover:bg-muted/40 hover:shadow-[inset_4px_0_0_0_rgba(253,76,0,0.95)] cursor-pointer transition-all duration-150 relative",
                        rowPriorityClass(saldo),
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).tagName !== "INPUT") {
                          navigate(`/banco-horas/extrato/${saldo.id}`);
                        }
                      }}
                    >
                      <td className="px-4 text-center relative z-10" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(saldo.id)}
                          onChange={() => handleToggleSelection(saldo.id)}
                          aria-label={`Selecionar ${saldo.nome}`}
                        />
                      </td>
                      <td className="h-[60px] px-5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-foreground group-hover:text-primary transition-colors">{saldo.nome}</div>
                          {saldo.status === "debito_critico" && (
                            <span className="rounded-full bg-rose-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                              Critico
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <div className="text-xs text-muted-foreground">Mat. {saldo.matricula || "-"}</div>
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-primary/0 transition-colors group-hover:text-primary/70 font-medium">
                            <Eye className="h-3 w-3" />
                            Clique para abrir extrato
                          </div>
                        </div>
                      </td>
                      <td className="px-3 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5" />
                          <span>{saldo.empresa || "-"}</span>
                        </div>
                      </td>
                      <td className="px-3 text-center">
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 font-display font-semibold",
                            saldo.saldo_minutos > 0
                              ? "text-success"
                              : saldo.saldo_minutos < 0
                                ? "text-rose-700"
                                : "text-muted-foreground",
                          )}
                        >
                          {saldo.saldo_minutos > 0 && <ArrowUpRight className="h-3 w-3" />}
                          {saldo.saldo_minutos < 0 && <ArrowDownRight className="h-3 w-3" />}
                          {saldo.saldo_formatado}
                        </div>
                      </td>
                      <td className="px-3 text-center font-display font-medium text-rose-700">
                        {saldo.vencido_formatado || "0h 0m"}
                      </td>
                      <td className="px-3 text-center">
                        <div className="font-display text-muted-foreground">{saldo.a_vencer_formatado || "0h 0m"}</div>
                        {Number(saldo.minutos_a_vencer_7d || 0) > 0 && (
                          <div className="text-[11px] font-medium text-orange-700">
                            {saldo.a_vencer_7d_formatado} em ate 7d
                          </div>
                        )}
                      </td>
                      <td className="px-3 text-center font-medium text-foreground">
                        {formatCurrency(Number(saldo.estimativa_valor || 0))}
                      </td>
                      <td className="px-5 text-center">
                        <StatusChip status={saldo.status} label={saldo.status_label} />
                      </td>
                      <td className="px-4 text-right">
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors ml-auto" />
                      </td>
                    </tr>
                  ))}

                  {filteredSaldos.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-12 text-center italic text-muted-foreground">
                        {emptyMessage}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="esc-card p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Linha do tempo operacional
              </p>
              <h3 className="font-display text-xl font-semibold text-foreground">
                Eventos recentes de banco de horas
              </h3>
            </div>

            <div className="flex flex-wrap gap-2">
              {timelineOptions.map((option) => (
                <Button
                  key={option.value}
                  variant={timelineFilter === option.value ? "default" : "outline"}
                  size="sm"
                  className="h-8"
                  onClick={() => setTimelineFilter(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingTimeline ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="mt-4 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar space-y-3">
              {timelineFiltered.slice(0, 18).map((item: any) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedTimelineEvent(item)}
                  className={cn(
                    "flex w-full flex-col gap-3 rounded-2xl border px-4 py-4 text-left transition hover:shadow-sm md:flex-row md:items-center md:justify-between",
                    getTimelineCardClass(item),
                  )}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusChip status={item.status_timeline} label={item.status_timeline_label} />
                      <span className="font-medium text-foreground">{item.colaborador_nome}</span>
                      <span className="text-xs text-muted-foreground">{item.empresa_nome}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.categoria_label} • origem {item.origem || "nao informada"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "font-display text-lg font-semibold",
                        Number(item.minutos || 0) < 0 ? "text-rose-700" : "text-emerald-700",
                      )}
                    >
                      {item.minutos_formatados}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.data_evento || item.created_at?.slice(0, 10) || "Sem data"}
                    </p>
                  </div>
                </button>
              ))}

              {timelineFiltered.length === 0 && (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum evento encontrado para os filtros atuais.
                </div>
              )}
            </div>
          )}
        </section>
      </div >

      <Dialog open={Boolean(selectedTimelineEvent)} onOpenChange={(open) => !open && setSelectedTimelineEvent(null)}>
        <DialogContent className="max-w-3xl">
          {selectedTimelineEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span>{selectedTimelineEvent.colaborador_nome}</span>
                  <StatusChip
                    status={selectedTimelineEvent.status_timeline}
                    label={selectedTimelineEvent.status_timeline_label}
                  />
                </DialogTitle>
                <DialogDescription>
                  {selectedTimelineEvent.categoria_label} • {selectedTimelineEvent.empresa_nome}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Origem</p>
                  <p className="mt-1 font-medium text-foreground">{selectedTimelineEvent.origem || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Usuario executor</p>
                  <p className="mt-1 font-medium text-foreground">{selectedTimelineEvent.executado_por_nome || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Observacao</p>
                  <p className="mt-1 text-sm text-foreground">{selectedTimelineEvent.observacao || selectedTimelineEvent.descricao || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Antes</p>
                  <p className="mt-1 font-display text-lg font-semibold text-foreground">
                    {selectedTimelineEvent.saldo_anterior_formatado}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Depois</p>
                  <p className="mt-1 font-display text-lg font-semibold text-foreground">
                    {selectedTimelineEvent.saldo_resultante_formatado}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Referencia vinculada</p>
                  <p className="mt-1 break-all text-sm text-foreground">
                    {selectedTimelineEvent.referencia_evento_id || selectedTimelineEvent.registro_ponto_id || "-"}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Executado em</p>
                  <p className="mt-1 text-sm text-foreground">{formatDateTime(selectedTimelineEvent.created_at)}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Data do evento</p>
                  <p className="mt-1 text-sm text-foreground">{selectedTimelineEvent.data_evento || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Vencimento</p>
                  <p className="mt-1 text-sm text-foreground">{selectedTimelineEvent.data_vencimento || "-"}</p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Tipo e valor</p>
                  <p className="mt-1 text-sm text-foreground">
                    {selectedTimelineEvent.tipo_evento} • {selectedTimelineEvent.minutos_formatados}
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background px-4 py-3 md:col-span-2">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Contexto operacional</p>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-muted/40 p-3 text-xs text-foreground">
                    {JSON.stringify(selectedTimelineEvent.contexto_operacao || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isPriorizacaoModalOpen} onOpenChange={setIsPriorizacaoModalOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl flex flex-col gap-0 p-0 overflow-hidden">
          <div className="p-6 pb-4 border-b border-border/50 shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-rose-700" />
                Priorização visual — Lista Completa
              </DialogTitle>
              <DialogDescription>
                Colaboradores com débitos críticos, horas a vencer ou aguardando ação do RH.
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-4 space-y-2 custom-scrollbar">
            {filteredSaldos.filter((s: any) => rowPriorityClass(s) !== "").length > 0 ? (
              filteredSaldos
                .filter((s: any) => rowPriorityClass(s) !== "")
                .map((saldo: any) => (
                  <div
                    key={saldo.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-4 py-3 cursor-pointer hover:opacity-80 transition-opacity",
                      saldo.status === "debito_critico"
                        ? "border-rose-300 bg-rose-50/70"
                        : saldo.status === "horas_a_vencer"
                          ? "border-orange-200 bg-orange-50/70"
                          : "border-violet-200 bg-violet-50/70"
                    )}
                    onClick={() => navigate(`/banco-horas/extrato/${saldo.id}`)}
                  >
                    <div>
                      <p className="text-sm font-medium leading-5 text-foreground flex items-center gap-2">
                        {saldo.nome}
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-50" />
                      </p>
                      <p className="text-xs text-muted-foreground">{saldo.empresa || "Sem empresa"} • Mat. {saldo.matricula || "-"}</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-display text-base font-semibold",
                          saldo.saldo_minutos < 0 ? "text-rose-700" : "text-foreground",
                        )}
                      >
                        {saldo.saldo_formatado}
                      </p>
                      <StatusChip status={saldo.status} label={saldo.status_label} />
                    </div>
                  </div>
                ))
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum colaborador priorizado no momento. Todos os saldos estão sob controle.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </AppShell >
  );
};

export default PainelGeral;
