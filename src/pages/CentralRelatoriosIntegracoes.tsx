import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
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

const categories = [
  { id: "Operacional", icon: Clock },
  { id: "Financeiro", icon: ArrowUpRight },
  { id: "Faturamento", icon: ArrowUpRight },
  { id: "Banco de horas", icon: Clock },
  { id: "Auditoria", icon: Database },
  { id: "Contábil/Fiscal", icon: FileSpreadsheet },
];

const CentralRelatoriosIntegracoes = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");

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

  const filteredReports = useMemo(
    () =>
      reports.filter(
        (report) =>
          report.nome.toLowerCase().includes(search.toLowerCase()) ||
          report.categoria.toLowerCase().includes(search.toLowerCase())
      ),
    [reports, search]
  );

  const activeSchedules = schedules.filter((schedule) => schedule.status === "ativo").length;
  const activeIntegrations = accountingConfigs.filter((config) => config.status === "ativo").length;
  const successfulLogs = accountingLogs.filter((log) => log.status === "sucesso").length;
  const failedLogs = accountingLogs.filter((log) => log.status !== "sucesso").length;

  const handleToggleFavorite = (event: React.MouseEvent, reportId: string) => {
    event.stopPropagation();
    toggleFavoriteMutation.mutate(reportId);
  };

  return (
    <AppShell
      title="Central de Relatórios e Integrações"
      subtitle="Catálogo, automações e conectividade no mesmo contexto"
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Inteligência operacional unificada</h2>
              <p className="text-sm text-muted-foreground">
                Gere relatórios, configure layouts, acompanhe integrações e investigue falhas sem sair do fluxo.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/detalhe/" + reports[0]?.id)} disabled={!reports.length}>
                <Play className="h-4 w-4 mr-2" />
                Gerar agora
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/agendamentos")}>
                <Clock className="h-4 w-4 mr-2" />
                Agendamentos
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/integracao")}>
                <Server className="h-4 w-4 mr-2" />
                Integrações
              </Button>
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

        <Tabs defaultValue="catalogo" className="space-y-4">
          <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
            <TabsTrigger value="catalogo">Catálogo</TabsTrigger>
            <TabsTrigger value="automacoes">Agendamentos e layouts</TabsTrigger>
            <TabsTrigger value="integracoes">Integrações e logs</TabsTrigger>
          </TabsList>

          <TabsContent value="catalogo" className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border/50">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar relatório..."
                  className="pl-9 bg-background border-border/60"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto flex-wrap">
                {categories.map((category) => (
                  <Button key={category.id} variant="outline" size="sm" onClick={() => setSearch(category.id)}>
                    <category.icon className="h-4 w-4 mr-2" />
                    {category.id}
                  </Button>
                ))}
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((item) => (
                  <Skeleton key={item} className="h-32 w-full rounded-xl" />
                ))}
              </div>
            ) : reportError ? (
              <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-destructive/20 bg-destructive/5 text-destructive">
                <AlertTriangle className="h-10 w-10 mb-4 opacity-50" />
                <h3 className="font-semibold">Erro ao carregar catálogo</h3>
                <p className="text-xs opacity-80">Não foi possível conectar ao servidor de relatórios.</p>
              </div>
            ) : filteredReports.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredReports.map((report) => (
                  <div
                    key={report.id}
                    className="esc-card group hover:border-primary/50 transition-all cursor-pointer p-5 flex flex-col justify-between"
                    onClick={() => navigate(`/relatorios/detalhe/${report.id}`)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground">
                          {report.categoria}
                        </span>
                        <h4 className="font-display font-semibold text-lg group-hover:text-primary transition-colors">
                          {report.nome}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">{report.descricao}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-8 w-8 transition-colors",
                            favoriteIds.includes(report.id) ? "text-warning fill-warning" : "text-muted-foreground hover:text-warning"
                          )}
                          onClick={(event) => handleToggleFavorite(event, report.id)}
                        >
                          <Star className={cn("h-4 w-4", favoriteIds.includes(report.id) && "fill-current")} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={(event) => {
                            event.stopPropagation();
                            toast.success(`Relatório "${report.nome}" gerado com sucesso!`);
                          }}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between pt-4 border-t border-border/50">
                      <div className="flex gap-1">
                        {report.formatos_disponiveis?.map((formatItem: string) => (
                          <Badge key={formatItem} variant="secondary" className="text-[9px] uppercase h-5">
                            {formatItem}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Última geração: Hoje
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-20 border border-dashed rounded-xl border-border/60 text-muted-foreground">
                <Filter className="h-10 w-10 mb-4 opacity-20" />
                <p>Nenhum relatório encontrado para "{search}"</p>
                <Button variant="link" onClick={() => setSearch("")}>Limpar filtros</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="automacoes" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="esc-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-foreground">Agendamentos ativos</h2>
                    <p className="text-sm text-muted-foreground">Disparo recorrente de relatórios por e-mail.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/agendamentos")}>
                    Abrir gestão completa <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="esc-table-header">
                    <tr className="text-left">
                      <th className="px-5 h-11 font-medium">Nome</th>
                      <th className="px-3 h-11 font-medium">Relatório</th>
                      <th className="px-3 h-11 font-medium text-center">Frequência</th>
                      <th className="px-5 h-11 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.slice(0, 6).map((schedule) => (
                      <tr key={schedule.id} className="border-t border-muted hover:bg-background">
                        <td className="px-5 h-[56px] font-medium text-foreground">{schedule.nome}</td>
                        <td className="px-3 text-muted-foreground">{schedule.relatorios_catalogo?.nome}</td>
                        <td className="px-3 text-center capitalize">{schedule.frequencia}</td>
                        <td className="px-5 text-center">
                          <Badge className={schedule.status === "ativo" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"}>
                            {schedule.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {schedules.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground italic">
                          Nenhum agendamento configurado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </section>

              <section className="esc-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-foreground">Layouts de exportação</h2>
                    <p className="text-sm text-muted-foreground">Padrões de saída para clientes e sistemas externos.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/layouts")}>
                    Abrir editor <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                <div className="p-5 grid grid-cols-1 gap-3">
                  {layouts.slice(0, 6).map((layout) => (
                    <article key={layout.id} className="rounded-xl border border-border p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-foreground">{layout.nome}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {layout.tipo} · {layout.destino}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={layout.status === "ativo" ? "default" : "secondary"} className="text-[9px] uppercase">
                          {layout.status}
                        </Badge>
                        <div className="text-xs text-primary font-semibold flex items-center gap-1">
                          <LayoutTemplate className="h-3.5 w-3.5" />
                          {(layout.colunas || []).length} colunas
                        </div>
                      </div>
                    </article>
                  ))}
                  {layouts.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic border border-dashed rounded-xl">
                      Nenhum layout customizado registrado.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </TabsContent>

          <TabsContent value="integracoes" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="esc-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-foreground">Sistemas conectados</h2>
                    <p className="text-sm text-muted-foreground">Estado atual das integrações contábeis.</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/integracao")}>
                    Abrir integrações <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
                <div className="p-5 space-y-3">
                  {accountingConfigs.map((config) => (
                    <div key={config.id} className="rounded-xl border border-border p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("h-2.5 w-2.5 rounded-full", config.status === "ativo" ? "bg-success animate-pulse" : "bg-muted-foreground")} />
                        <div>
                          <div className="font-medium text-foreground">{config.sistema_destino}</div>
                          <div className="text-xs text-muted-foreground">Último envio monitorado pelo hub</div>
                        </div>
                      </div>
                      <Badge className={config.status === "ativo" ? "bg-success-soft text-success-strong" : "bg-muted text-muted-foreground"}>
                        {config.status}
                      </Badge>
                    </div>
                  ))}
                  {accountingConfigs.length === 0 && (
                    <div className="p-12 text-center text-muted-foreground italic border border-dashed rounded-xl">
                      Nenhuma integração configurada.
                    </div>
                  )}
                </div>
              </section>

              <section className="esc-card overflow-hidden">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display font-semibold text-foreground">Logs e rastreabilidade</h2>
                    <p className="text-sm text-muted-foreground">Últimas execuções para diagnóstico rápido.</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-success-strong font-semibold flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {successfulLogs} sucessos
                    </span>
                    <span className="text-destructive-strong font-semibold flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {failedLogs} falhas
                    </span>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="esc-table-header">
                    <tr className="text-left">
                      <th className="px-5 h-11 font-medium">Execução</th>
                      <th className="px-3 h-11 font-medium">Sistema</th>
                      <th className="px-3 h-11 font-medium">Tipo</th>
                      <th className="px-5 h-11 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountingLogs.slice(0, 6).map((log) => (
                      <tr key={log.id} className="border-t border-muted hover:bg-background">
                        <td className="px-5 h-[56px]">
                          <div className="font-medium text-foreground">
                            {new Date(log.execucao_data).toLocaleDateString("pt-BR")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(log.execucao_data).toLocaleTimeString("pt-BR")}
                          </div>
                        </td>
                        <td className="px-3 text-muted-foreground">{log.sistema_destino}</td>
                        <td className="px-3">
                          <Badge variant="outline" className="font-normal text-[10px] uppercase">{log.tipo_envio}</Badge>
                        </td>
                        <td className="px-5 text-center">
                          <Badge className={log.status === "sucesso" ? "bg-success-soft text-success-strong" : "bg-destructive-soft text-destructive-strong"}>
                            {log.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {accountingLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground italic">
                          Nenhuma execução registrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="px-5 py-4 border-t border-border flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/mapeamento")}>
                    <Database className="h-4 w-4 mr-2" />
                    Mapeamento contábil
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/integracao/logs")}>
                    <History className="h-4 w-4 mr-2" />
                    Logs completos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate("/relatorios/integracao")}>
                    <Send className="h-4 w-4 mr-2" />
                    Disparar integração
                  </Button>
                </div>
              </section>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
};

export default CentralRelatoriosIntegracoes;
