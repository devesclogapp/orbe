import { useDeferredValue, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  History,
  LayoutTemplate,
  Play,
  Search,
  Send,
  Server,
  Sparkles,
  Star,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { ReportService, LayoutService } from "@/services/report.service";
import { AccountingService } from "@/services/accounting.service";
import Agendamentos from "./Relatorios/Agendamentos";
import LayoutsExportacao from "./Relatorios/LayoutsExportacao";
import IntegracaoContabil from "./Relatorios/IntegracaoContabil";
import MapeamentoContabil from "./Relatorios/MapeamentoContabil";
import LogsIntegracao from "./Relatorios/LogsIntegracao";

const categories = [
  { id: "Operacional", icon: Clock },
  { id: "Financeiro", icon: ArrowUpRight },
  { id: "Faturamento", icon: ArrowUpRight },
  { id: "Banco de horas", icon: Clock },
  { id: "Auditoria", icon: Database },
  { id: "Contábil/Fiscal", icon: FileSpreadsheet },
];

const focusModes = [
  { id: "all", label: "Todos" },
  { id: "favorites", label: "Favoritos" },
  { id: "decision", label: "Decisão rápida" },
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const CentralRelatoriosIntegracoes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [focusMode, setFocusMode] = useState<"all" | "favorites" | "decision">("all");
  const [activeTab, setActiveTab] = useState("catalogo");
  const deferredSearch = useDeferredValue(search);

  const userId = user?.id;

  const { data: reports = [], isLoading, error: reportError } = useQuery<any[]>({
    queryKey: ["reports_catalog"],
    queryFn: () => ReportService.getAll(),
    retry: 1,
  });

  const { data: favorites = [] } = useQuery<any[]>({
    queryKey: ["reports_favorites", userId],
    queryFn: () => (userId ? ReportService.getFavorites(userId) : Promise.resolve([])),
    enabled: !!userId,
  });

  const { data: schedules = [] } = useQuery<any[]>({
    queryKey: ["report_schedules"],
    queryFn: () => ReportService.getAgendamentos(),
  });

  const { data: layouts = [] } = useQuery<any[]>({
    queryKey: ["report_layouts"],
    queryFn: () => LayoutService.getLayouts(),
  });

  const { data: accountingConfigs = [] } = useQuery<any[]>({
    queryKey: ["accounting_configs"],
    queryFn: () => AccountingService.getAll(),
  });

  const { data: accountingLogs = [] } = useQuery<any[]>({
    queryKey: ["accounting_logs"],
    queryFn: () => AccountingService.getLogs(),
  });

  const favoriteIds = favorites.map((favorite: any) => favorite.relatorio_id);

  const toggleFavoriteMutation = useMutation({
    mutationFn: (reportId: string) => ReportService.toggleFavorite(userId, reportId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports_favorites"] });
    },
  });

  const activeSchedules = schedules.filter((schedule) => schedule.status === "ativo").length;
  const activeIntegrations = accountingConfigs.filter((config) => config.status === "ativo").length;
  const successfulLogs = accountingLogs.filter((log) => log.status === "sucesso").length;
  const failedLogs = accountingLogs.filter((log) => log.status !== "sucesso").length;

  const reportsWithMeta = useMemo(
    () =>
      reports.map((report) => ({
        ...report,
        isFavorite: favoriteIds.includes(report.id),
        searchable: `${report.nome} ${report.categoria} ${report.descricao || ""}`,
      })),
    [reports, favoriteIds]
  );

  const decisionReports = useMemo(
    () =>
      reportsWithMeta.filter((report) => {
        const key = normalize(report.searchable);
        return (
          key.includes("inconsist") ||
          key.includes("auditoria") ||
          key.includes("faturamento") ||
          key.includes("movimentacao") ||
          key.includes("banco de horas")
        );
      }),
    [reportsWithMeta]
  );

  const filteredReports = useMemo(() => {
    const searchTerm = normalize(deferredSearch);

    return reportsWithMeta
      .filter((report) => {
        const categoryMatch = activeCategory === "all" || report.categoria === activeCategory;
        const searchMatch = !searchTerm || normalize(report.searchable).includes(searchTerm);
        const focusMatch =
          focusMode === "all" ||
          (focusMode === "favorites" && report.isFavorite) ||
          (focusMode === "decision" && decisionReports.some((item) => item.id === report.id));

        return categoryMatch && searchMatch && focusMatch;
      })
      .sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.nome.localeCompare(b.nome);
      });
  }, [activeCategory, decisionReports, deferredSearch, focusMode, reportsWithMeta]);

  const reportsByCategory = useMemo(
    () =>
      categories
        .map((category) => ({
          ...category,
          reports: filteredReports.filter((report) => report.categoria === category.id),
        }))
        .filter((category) => category.reports.length > 0),
    [filteredReports]
  );

  const favoriteReports = reportsWithMeta.filter((report) => report.isFavorite).slice(0, 3);
  const quickReports = (favoriteReports.length > 0 ? favoriteReports : decisionReports).slice(0, 3);
  const reportsCountLabel = `${filteredReports.length} relatório${filteredReports.length === 1 ? "" : "s"}`;

  const handleToggleFavorite = (event: React.MouseEvent, reportId: string) => {
    event.stopPropagation();
    toggleFavoriteMutation.mutate(reportId);
  };

  return (
    <AppShell
      title="Central de Relatórios e Integrações"
      subtitle="Menos varredura, mais decisão: catálogo priorizado, atalhos e monitoramento no mesmo fluxo"
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary-soft/40 px-3 py-1 text-[11px] font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                Centro de decisão para relatórios e integrações
              </div>
              <h2 className="font-display font-semibold text-foreground mt-3">Encontre rápido o que precisa agir agora</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-[620px]">
              <QuickActionCard
                title="Gerar relatório"
                description={quickReports[0]?.nome || "Abrir catálogo priorizado"}
                icon={Play}
                onClick={() =>
                  quickReports[0]
                    ? navigate(`/relatorios/detalhe/${quickReports[0].id}`)
                    : navigate("/relatorios")
                }
              />
              <QuickActionCard
                title="Ajustar automação"
                description={`${activeSchedules} agendamento(s) ativo(s)`}
                icon={Clock}
                onClick={() => setActiveTab("agendamentos")}
              />
              <QuickActionCard
                title="Ver integração"
                description={failedLogs > 0 ? `${failedLogs} falha(s) recente(s)` : "Sem falhas recentes"}
                icon={Server}
                tone={failedLogs > 0 ? "alert" : "default"}
                onClick={() => setActiveTab(failedLogs > 0 ? "logs" : "integracao")}
              />
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <MetricCard label="Relatórios" value={reports.length.toString()} icon={FileSpreadsheet} />
          <MetricCard label="Favoritos" value={favoriteIds.length.toString()} icon={Star} />
          <MetricCard label="Agendamentos ativos" value={activeSchedules.toString()} icon={Clock} />
          <MetricCard label="Integrações ativas" value={activeIntegrations.toString()} icon={Server} />
          <MetricCard label="Falhas recentes" value={failedLogs.toString()} icon={AlertTriangle} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="agendamentos">Agendamentos</TabsTrigger>
            <TabsTrigger value="layouts">Layouts</TabsTrigger>
            <TabsTrigger value="integracao">Integração Contábil</TabsTrigger>
            <TabsTrigger value="mapeamento">Mapeamento</TabsTrigger>
            <TabsTrigger value="logs">Logs do Sistema</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="space-y-6">
            <section className="esc-card p-4 md:p-5 space-y-4">
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div className="relative w-full xl:max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar relatório por nome, categoria ou uso..."
                    className="pl-9 bg-background border-border/60"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  {focusModes.map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setFocusMode(mode.id as "all" | "favorites" | "decision")}
                      className={cn(
                        "h-9 rounded-full px-4 text-sm transition-colors border",
                        focusMode === mode.id
                          ? "border-primary bg-primary-soft/50 text-primary font-medium"
                          : "border-border bg-background text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <CategoryPill
                    label="Todas"
                    active={activeCategory === "all"}
                    onClick={() => setActiveCategory("all")}
                  />
                  {categories.map((category) => (
                    <CategoryPill
                      key={category.id}
                      label={category.id}
                      icon={category.icon}
                      active={activeCategory === category.id}
                      onClick={() => setActiveCategory(category.id)}
                    />
                  ))}
                </div>

                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  {reportsCountLabel}
                  {search && <span className="text-foreground">para "{search}"</span>}
                </div>
              </div>
            </section>

            {!isLoading && !reportError && quickReports.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-foreground">Atalhos do dia</h3>
                    <p className="text-sm text-muted-foreground">Acesso rápido aos relatórios que tendem a gerar ação imediata.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {quickReports.map((report) => (
                    <QuickReportCard
                      key={report.id}
                      report={report}
                      isFavorite={report.isFavorite}
                      onOpen={() => navigate(`/relatorios/detalhe/${report.id}`)}
                      onRun={() => toast.success(`Relatório "${report.nome}" gerado com sucesso!`)}
                      onToggleFavorite={(event) => handleToggleFavorite(event, report.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            {isLoading ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-40 w-full rounded-xl" />
                ))}
              </div>
            ) : reportError ? (
              <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-destructive/20 bg-destructive/5 text-destructive">
                <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
                <h3 className="font-semibold">Erro ao carregar catálogo</h3>
                <p className="text-xs opacity-80">Não foi possível conectar ao servidor de relatórios.</p>
              </div>
            ) : reportsByCategory.length > 0 ? (
              <div className="space-y-6">
                {reportsByCategory.map((group) => (
                  <section key={group.id} className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <group.icon className="h-4 w-4 text-primary" />
                        <h3 className="font-display font-semibold text-foreground">{group.id}</h3>
                        <Badge variant="secondary" className="rounded-full px-2.5">
                          {group.reports.length}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                      {group.reports.map((report) => (
                        <ReportRowCard
                          key={report.id}
                          report={report}
                          isFavorite={report.isFavorite}
                          onOpen={() => navigate(`/relatorios/detalhe/${report.id}`)}
                          onRun={() => toast.success(`Relatório "${report.nome}" gerado com sucesso!`)}
                          onToggleFavorite={(event) => handleToggleFavorite(event, report.id)}
                        />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-border/60 text-muted-foreground">
                <Filter className="h-10 w-10 mb-4 opacity-20" />
                <p>Nenhum relatório encontrado para os filtros atuais.</p>
                <Button
                  variant="link"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("all");
                    setFocusMode("all");
                  }}
                >
                  Limpar filtros
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="agendamentos" className="space-y-6">
            <Agendamentos />
          </TabsContent>
          <TabsContent value="layouts" className="space-y-6">
            <LayoutsExportacao />
          </TabsContent>
          <TabsContent value="integracao" className="space-y-6">
            <IntegracaoContabil onNavigateTab={setActiveTab} />
          </TabsContent>
          <TabsContent value="mapeamento" className="space-y-6">
            <MapeamentoContabil />
          </TabsContent>
          <TabsContent value="logs" className="space-y-6">
            <LogsIntegracao />
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

const CategoryPill = ({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon?: any;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "h-9 rounded-full px-4 text-sm transition-colors border inline-flex items-center gap-2",
      active
        ? "border-primary bg-primary-soft/50 text-primary font-medium"
        : "border-border bg-background text-muted-foreground hover:text-foreground"
    )}
  >
    {Icon && <Icon className="h-4 w-4" />}
    {label}
  </button>
);

const QuickActionCard = ({
  title,
  description,
  icon: Icon,
  tone = "default",
  onClick,
}: {
  title: string;
  description: string;
  icon: any;
  tone?: "default" | "alert";
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5",
      tone === "alert"
        ? "border-destructive/20 bg-destructive-soft/30 hover:border-destructive/40"
        : "border-border bg-background hover:border-primary/30 hover:bg-primary-soft/10"
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-1">{description}</div>
      </div>
      <div className={cn("rounded-full p-2", tone === "alert" ? "bg-destructive-soft text-destructive-strong" : "bg-primary-soft text-primary")}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <div className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-foreground">
      Abrir
      <ArrowRight className="h-3.5 w-3.5" />
    </div>
  </button>
);

const QuickReportCard = ({
  report,
  isFavorite,
  onOpen,
  onRun,
  onToggleFavorite,
}: {
  report: any;
  isFavorite: boolean;
  onOpen: () => void;
  onRun: () => void;
  onToggleFavorite: (event: React.MouseEvent) => void;
}) => (
  <div className="esc-card p-5 border-primary/15 bg-gradient-to-br from-primary-soft/15 via-background to-background">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{report.categoria}</div>
        <h4 className="font-display font-semibold text-lg text-foreground mt-1">{report.nome}</h4>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{report.descricao}</p>
      </div>
      <button
        className={cn(
          "h-9 w-9 rounded-full border flex items-center justify-center transition-colors",
          isFavorite ? "border-warning/20 bg-warning-soft text-warning" : "border-border text-muted-foreground hover:text-warning"
        )}
        onClick={onToggleFavorite}
      >
        <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
      </button>
    </div>

    <div className="mt-4 flex flex-wrap gap-1.5">
      {report.formatos_disponiveis?.map((formatItem: string) => (
        <Badge key={formatItem} variant="secondary" className="text-[9px] uppercase h-5">
          {formatItem}
        </Badge>
      ))}
    </div>

    <div className="mt-5 flex items-center gap-2">
      <Button size="sm" className="h-8" onClick={onRun}>
        <Play className="h-3.5 w-3.5 mr-1.5" />
        Gerar agora
      </Button>
      <Button size="sm" variant="outline" className="h-8" onClick={onOpen}>
        Abrir detalhe
      </Button>
    </div>
  </div>
);

const ReportRowCard = ({
  report,
  isFavorite,
  onOpen,
  onRun,
  onToggleFavorite,
}: {
  report: any;
  isFavorite: boolean;
  onOpen: () => void;
  onRun: () => void;
  onToggleFavorite: (event: React.MouseEvent) => void;
}) => (
  <article className="esc-card p-5 hover:border-primary/40 transition-all">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-display font-semibold text-base text-foreground">{report.nome}</h4>
          {isFavorite && (
            <Badge className="bg-warning-soft text-warning-strong border-0">
              Favorito
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{report.descricao}</p>
      </div>

      <button
        className={cn(
          "h-9 w-9 rounded-full border flex items-center justify-center transition-colors shrink-0",
          isFavorite ? "border-warning/20 bg-warning-soft text-warning" : "border-border text-muted-foreground hover:text-warning"
        )}
        onClick={onToggleFavorite}
      >
        <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
      </button>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <div className="flex gap-1.5 flex-wrap">
        {report.formatos_disponiveis?.map((formatItem: string) => (
          <Badge key={formatItem} variant="secondary" className="text-[9px] uppercase h-5">
            {formatItem}
          </Badge>
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
        <Clock className="h-3 w-3" />
        Última geração: Hoje
      </span>
    </div>

    <div className="mt-5 flex items-center justify-between gap-3">
      <Button variant="ghost" className="px-0 h-auto text-primary hover:text-primary" onClick={onOpen}>
        Ver configuração e detalhe
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>

      <Button size="sm" className="h-8" onClick={onRun}>
        <Play className="h-3.5 w-3.5 mr-1.5" />
        Gerar
      </Button>
    </div>
  </article>
);

export default CentralRelatoriosIntegracoes;
