import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Briefcase,
  FileText,
  History,
  PauseCircle,
  PiggyBank,
  RefreshCcw,
  ShieldAlert,
  Wallet,
  XCircle,
  Download
} from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { GovernanceService } from "@/services/governance.service";

const PAGE_SIZE = 50;

const CentralGovernanca = () => {
  const navigate = useNavigate();

  // Filters state
  const [filterModulo, setFilterModulo] = useState<string>("TODOS");
  const [filterImpacto, setFilterImpacto] = useState<string>("TODOS");
  const [page, setPage] = useState(1);

  const { data: indicadores, isLoading: loadingDocs } = useQuery({
    queryKey: ["governance_indicadores"],
    queryFn: () => GovernanceService.getIndicadoresGlobais(),
  });

  const { data: timeline = [], isLoading: loadingTimeline } = useQuery({
    queryKey: ["governance_timeline", filterModulo, filterImpacto, page],
    queryFn: () => GovernanceService.getTimelineCorporativa({
      modulo: filterModulo,
      impacto: filterImpacto,
      limit: PAGE_SIZE * page, // Load all items up to current page to simplify logic instead of infinite scroll for now
      offset: 0
    }),
  });
  const { data: transicoesDia, isLoading: loadingTransicoesDia } = useQuery({
    queryKey: ["governance_transicoes_diarias"],
    queryFn: () => GovernanceService.getTransicoesDiarias(),
  });

  const loading = loadingDocs && loadingTimeline; // Just initial load

  // Hardcode modulos conhecidos para evitar query extra cara, ou manter como lista dinamica via outra RPC futuramente
  const modulosUnicos = ["WORKFLOW", "AUTOMACAO", "FINANCEIRO", "RH", "OPERACIONAL", "SISTEMA"];

  const handleExportarXLS = async () => {
    await GovernanceService.exportTimelineToXLS({ modulo: filterModulo, impacto: filterImpacto });
    alert("Exportação preparada para XLS. Implementação completa na Fase 8.");
  };

  const handleExportarPDF = async () => {
    await GovernanceService.exportTimelineToPDF({ modulo: filterModulo, impacto: filterImpacto });
    alert("Exportação preparada para PDF. Implementação completa na Fase 8.");
  };

  return (
    <AppShell
      title="Governança Executiva"
      subtitle="Central Global de Auditoria e Monitoramento Corporativo"
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="font-display font-semibold text-foreground">Visão Global</h2>
              <p className="text-sm text-muted-foreground">
                Acompanhamento completo de fluxos operacionais, fechamentos e auditoria central.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/governanca/automacao")}>
                <RefreshCcw className="h-4 w-4 mr-2" />
                Automação Operacional
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/governanca/auditoria")}>
                <History className="h-4 w-4 mr-2" />
                Logs Genéricos
              </Button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center p-20 esc-card">
            <History className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* PAINEL EXECUTIVO */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Painel Executivo</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <MetricCard
                  label="Total Operacional"
                  value={formatCurrency(indicadores?.totalOperacional || 0)}
                  icon={Briefcase}
                />
                <MetricCard
                  label="Total Faturável"
                  value={formatCurrency(indicadores?.totalFaturavel || 0)}
                  icon={Wallet}
                />
                <MetricCard
                  label="Total Folha (Custos)"
                  value={formatCurrency(indicadores?.totalFolha || 0)}
                  icon={PiggyBank}
                />
                <MetricCard
                  label="Ciclos Totais (Mês)"
                  value={indicadores?.totalCiclos?.toString() || "0"}
                  icon={RefreshCcw}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Ciclos Pendentes"
                  value={indicadores?.ciclosPendentes?.toString() || "0"}
                  icon={PauseCircle}
                  delta={{ value: "Ação requerida", positive: false }}
                />
                <MetricCard
                  label="Ciclos Rejeitados"
                  value={indicadores?.ciclosRejeitados?.toString() || "0"}
                  icon={XCircle}
                  delta={{ value: "Revisão crítica", positive: false }}
                />
                <MetricCard
                  label="Remessas Prontas"
                  value={indicadores?.remessasProntas?.toString() || "0"}
                  icon={FileText}
                  delta={{ value: "Aguardando envio", positive: true }}
                />
                <MetricCard
                  label="Inconsistências Críticas"
                  value={indicadores?.inconsistenciasCriticas?.toString() || "0"}
                  icon={ShieldAlert}
                  delta={{ value: "Atenção imediata", positive: false }}
                />
              </div>
            </div>

            {/* ALERTAS EXECUTIVOS */}
            {(indicadores?.ciclosRejeitados || 0) > 0 && (
              <div className="bg-destructive-soft border border-destructive-strong text-destructive-strong p-4 rounded-xl flex items-center gap-3">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <strong className="block text-sm">Alerta Executivo:</strong>
                  <span className="text-xs">Existem {indicadores?.ciclosRejeitados} ciclos operacionais rejeitados no fluxo de RH ou Financeiro impedindo o faturamento.</span>
                </div>
              </div>
            )}

            {/* TRANSIÇÕES DIÁRIAS RH -> FINANCEIRO -> CNAB */}
            <section className="esc-card p-4 md:p-5">
              <div className="mb-3">
                <h3 className="font-display font-semibold text-foreground">Transições Diárias do Fluxo</h3>
                <p className="text-xs text-muted-foreground">
                  Contadores de hoje para aprovação RH, aprovação financeira, preparo CNAB e devoluções ao RH.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard
                  label="Aprovou RH"
                  value={loadingTransicoesDia ? "..." : String(transicoesDia?.aprovouRh || 0)}
                  icon={RefreshCcw}
                />
                <MetricCard
                  label="Aprovou Financeiro"
                  value={loadingTransicoesDia ? "..." : String(transicoesDia?.aprovouFinanceiro || 0)}
                  icon={Wallet}
                />
                <MetricCard
                  label="Preparou CNAB"
                  value={loadingTransicoesDia ? "..." : String(transicoesDia?.preparouCnab || 0)}
                  icon={FileText}
                />
                <MetricCard
                  label="Devolveu ao RH"
                  value={loadingTransicoesDia ? "..." : String(transicoesDia?.devolveuRh || 0)}
                  icon={XCircle}
                />
              </div>
            </section>

            {/* TIMELINE CORPORATIVA */}
            <section className="esc-card overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display font-semibold text-foreground">Timeline Corporativa</h2>
                  <p className="text-sm text-muted-foreground">Auditoria global unificada, otimizada para alto volume.</p>
                </div>

                <div className="flex gap-2">
                  <Select value={filterModulo} onValueChange={(v) => { setFilterModulo(v); setPage(1); }}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Módulo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Todos Módulos</SelectItem>
                      {modulosUnicos.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterImpacto} onValueChange={(v) => { setFilterImpacto(v); setPage(1); }}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Impacto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TODOS">Qualquer Risco</SelectItem>
                      <SelectItem value="critico">Crítico</SelectItem>
                      <SelectItem value="medio">Médio</SelectItem>
                      <SelectItem value="baixo">Baixo</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex gap-1 ml-2 border-l border-border pl-3">
                    <Button variant="outline" size="icon" onClick={handleExportarXLS} title="Exportar XLS">
                      <Download className="h-4 w-4" />
                      <span className="sr-only">XLS</span>
                    </Button>
                    <Button variant="outline" size="icon" onClick={handleExportarPDF} title="Exportar PDF">
                      <FileText className="h-4 w-4" />
                      <span className="sr-only">PDF</span>
                    </Button>
                  </div>
                </div>
              </div>

              <div className="max-h-[500px] overflow-y-auto w-full">
                <table className="w-full text-sm">
                  <thead className="esc-table-header sticky top-0 z-10 bg-muted/80 backdrop-blur-md">
                    <tr className="text-left">
                      <th className="px-5 h-11 font-medium">Data / Hora</th>
                      <th className="px-3 h-11 font-medium">Usuário</th>
                      <th className="px-3 h-11 font-medium">Módulo</th>
                      <th className="px-3 h-11 font-medium">Ação / Evento</th>
                      <th className="px-3 h-11 font-medium text-center">Competência</th>
                      <th className="px-5 h-11 font-medium text-center">Impacto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timeline.map((item, idx) => (
                      <tr key={`${item.id}-${idx}`} className="border-t border-muted hover:bg-background">
                        <td className="px-5 py-3 align-top">
                          <div className="font-medium text-foreground whitespace-nowrap">
                            {new Date(item.data_hora).toLocaleDateString("pt-BR")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(item.data_hora).toLocaleTimeString("pt-BR")}
                          </div>
                        </td>
                        <td className="px-3 py-3 align-top text-muted-foreground truncate max-w-[120px]" title={item.usuario || "Sistema"}>
                          {item.usuario || "Sistema"}
                        </td>
                        <td className="px-3 py-3 align-top">
                          <span className="bg-muted px-2 py-1 rounded text-[10px] uppercase font-bold tracking-tight text-muted-foreground">
                            {item.modulo}
                          </span>
                        </td>
                        <td className="px-3 py-3 align-top max-w-[250px]">
                          <div className="font-medium text-foreground">{item.acao}</div>
                          {item.observacao && (
                            <div className="text-xs text-muted-foreground mt-1 truncate" title={item.observacao}>
                              {item.observacao}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 align-top text-center text-muted-foreground">
                          {item.competencia || "-"}
                        </td>
                        <td className="px-5 py-3 align-top text-center">
                          <Badge
                            className={
                              item.impacto === "critico"
                                ? "bg-destructive-soft text-destructive-strong"
                                : item.impacto === "medio"
                                  ? "bg-warning-soft text-warning-strong"
                                  : "bg-info-soft text-info-strong"
                            }
                          >
                            {item.impacto.toUpperCase()}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {timeline.length === 0 && !loadingTimeline && (
                      <tr>
                        <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                          Nenhum evento corresponde aos filtros.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Botão de Lazy Load */}
                {timeline.length >= PAGE_SIZE * page && (
                  <div className="p-4 flex justify-center border-t border-border">
                    <Button
                      variant="outline"
                      onClick={() => setPage(p => p + 1)}
                      disabled={loadingTimeline}
                    >
                      {loadingTimeline ? "Carregando..." : "Carregar mais eventos"}
                    </Button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
};

export default CentralGovernanca;
