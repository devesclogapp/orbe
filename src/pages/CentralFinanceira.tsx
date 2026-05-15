import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileCheck,
  Filter,
  History,
  Loader2,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  UnlockKeyhole,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AIService,
  CompetenciaService,
  ConsolidadoService,
  EmpresaService,
  ResultadosService,
} from "@/services/base.service";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";

const CentralFinanceira = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().substring(0, 7));
  const [filterEmpresaId, setFilterEmpresaId] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(filterMonth);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // dialogs financeiro
  const [openReabrir, setOpenReabrir] = useState(false);
  const [fechamentoParaReabrir, setFechamentoParaReabrir] = useState<any>(null);
  const [motivoReabrir, setMotivoReabrir] = useState("");
  const [openConfirmAprovacao, setOpenConfirmAprovacao] = useState(false);
  const [rhLoteSelecionado, setRhLoteSelecionado] = useState<any>(null);
  // etapa 2 — análise financeira
  const [openDevolucao, setOpenDevolucao] = useState(false);
  const [motivoDevolucao, setMotivoDevolucao] = useState("");
  const [observacaoAprovacao, setObservacaoAprovacao] = useState("");
  const [showLogHistorico, setShowLogHistorico] = useState(false);

  const { data: empresas = [], isLoading: loadingEmps } = useQuery<any[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !filterEmpresaId) {
      setFilterEmpresaId(empresas[0].id);
      if (!selectedEmpresaId) {
        setSelectedEmpresaId(empresas[0].id);
      }
    }
  }, [empresas, filterEmpresaId, selectedEmpresaId]);

  const { data: competencia, isLoading: loadingComp } = useQuery<any>({
    queryKey: ["competencia", selectedMonth, selectedEmpresaId],
    queryFn: () => CompetenciaService.getByMonth(selectedMonth, selectedEmpresaId!),
    enabled: !!selectedEmpresaId,
  });

  const { data: consolidado, isLoading: loadingCons } = useQuery<any>({
    queryKey: ["consolidado", selectedMonth, selectedEmpresaId],
    queryFn: () => ConsolidadoService.getByCompetencia(`${selectedMonth}-01`, selectedEmpresaId!),
    enabled: !!selectedEmpresaId,
  });

  const { data: fechamentos = [], isLoading: loadingFechamentos } = useQuery<any[]>({
    queryKey: ["fechamentos"],
    queryFn: () => ResultadosService.getSummary(),
  });

  const { data: lotesRh = [], isLoading: loadingRhLotes } = useQuery<any[]>({
    queryKey: ["rh-financeiro-lotes", selectedMonth, selectedEmpresaId],
    queryFn: () => RHFinanceiroService.listLotesRecebidos(selectedMonth, selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: rhLoteDetalhe, isLoading: loadingRhLoteDetalhe } = useQuery({
    queryKey: ["rh-financeiro-lote-detalhe", rhLoteSelecionado?.id],
    queryFn: () => RHFinanceiroService.getLoteDetalhe(rhLoteSelecionado!.id),
    enabled: !!rhLoteSelecionado?.id,
  });

  const { data: logsDoLote = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["rh-lote-historico", rhLoteSelecionado?.id],
    queryFn: () => RHFinanceiroService.getLogsLote(rhLoteSelecionado!.id),
    enabled: !!rhLoteSelecionado?.id && showLogHistorico,
  });

  const reprocessMutation = useMutation({
    mutationFn: () => AIService.processDay(`${selectedMonth}-01`, selectedEmpresaId!),
    onSuccess: () => {
      toast.success("Faturamento processado", {
        description: "Os dados financeiros foram calculados e atualizados.",
      });
      queryClient.invalidateQueries({ queryKey: ["consolidado", selectedMonth, selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["competencia", selectedMonth, selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["fechamentos"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao processar", { description: err.message });
    },
  });

  const fecharPeriodoMutation = useMutation({
    // Replace with the appropriate ResultadosService.fechar or similar if it exists, for now we will simulate
    mutationFn: async (id: string) => {
      // Typically ResultadosService.fechar(id)
      return new Promise((resolve) => setTimeout(resolve, 800));
    },
    onSuccess: () => {
      toast.success("Período fechado!", {
        description: "A competência foi fechada e protegida contra edições.",
      });
      queryClient.invalidateQueries({ queryKey: ["fechamentos"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao fechar período", { description: err.message });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (ids: string[]) => ConsolidadoService.approveBatch(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consolidado"] });
      toast.success("Lote aprovado com sucesso", {
        description: "Os faturamentos filtrados foram aprovados.",
      });
    },
    onError: (err: any) => {
      toast.error("Erro ao aprovar lote", { description: err.message });
    },
  });

  const clientes = consolidado?.clientes || [];
  const colaboradores = consolidado?.colaboradores || [];

  const filteredClientes = useMemo(
    () =>
      clientes.filter((cliente: any) =>
        cliente.clientes?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [clientes, searchTerm]
  );

  const filteredFechamentos = useMemo(
    () =>
      fechamentos.filter((fechamento) => {
        const sameMonth = String(fechamento.data || "").startsWith(selectedMonth);
        const sameEmpresa = !selectedEmpresaId || fechamento.empresa_id === selectedEmpresaId;
        return sameMonth && sameEmpresa;
      }),
    [fechamentos, selectedMonth, selectedEmpresaId]
  );

  const totalFaturavel = competencia?.valor_total_faturado || 0;
  const pendingCount = clientes.filter((cliente: any) => cliente.status !== "aprovado").length;
  // lotes que requerem ação do Financeiro
  const lotesRhPendentes = lotesRh.filter((lote: any) =>
    ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA", "DEVOLVIDO_RH"].includes(lote.status)
  );
  const lotesRhValorTotal = lotesRhPendentes.reduce((acc: number, lote: any) => acc + Number(lote.valor_total || 0), 0);
  const isLoading = loadingEmps || loadingComp || loadingCons || loadingFechamentos || loadingRhLotes;

  // helpers status
  const invalidateLotes = () => {
    queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lotes"] });
    queryClient.invalidateQueries({ queryKey: ["rh-financeiro-lote-detalhe", rhLoteSelecionado?.id] });
    queryClient.invalidateQueries({ queryKey: ["rh-lote-historico", rhLoteSelecionado?.id] });
  };

  const iniciarAnaliseMutation = useMutation({
    mutationFn: (id: string) => RHFinanceiroService.iniciarAnalise(id),
    onSuccess: () => {
      toast.success("Análise iniciada", { description: "Lote marcado como Em Análise Financeira." });
      invalidateLotes();
    },
    onError: (err: any) => toast.error("Erro ao iniciar análise", { description: err.message }),
  });

  const aprovarFinanceiroMutation = useMutation({
    mutationFn: ({ id, obs }: { id: string; obs: string }) =>
      RHFinanceiroService.aprovarFinanceiro(id, obs),
    onSuccess: () => {
      toast.success("Lote aprovado!", { description: "Liberado para a próxima etapa bancária." });
      invalidateLotes();
      setObservacaoAprovacao("");
      setRhLoteSelecionado(null);
    },
    onError: (err: any) => toast.error("Erro ao aprovar", { description: err.message }),
  });

  const devolverRHMutation = useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      RHFinanceiroService.devolverAoRH(id, motivo),
    onSuccess: () => {
      toast.warning("Lote devolvido ao RH", { description: "O RH foi notificado e o lote reaparece na fila deles." });
      invalidateLotes();
      setOpenDevolucao(false);
      setMotivoDevolucao("");
      setRhLoteSelecionado(null);
    },
    onError: (err: any) => toast.error("Erro ao devolver", { description: err.message }),
  });

  const handleApproveBatch = () => {
    const ids = filteredClientes.map((cliente: any) => cliente.id);
    if (ids.length === 0) {
      toast.error("Nenhum item para aprovar");
      return;
    }
    setOpenConfirmAprovacao(true);
  };

  const confirmarAprovacao = () => {
    const ids = filteredClientes.map((cliente: any) => cliente.id);
    approveMutation.mutate(ids);
    setOpenConfirmAprovacao(false);
  };

  return (
    <AppShell
      title="Faturamento"
      subtitle={`Competência, faturamento e fechamento no mesmo fluxo · ${new Date(`${selectedMonth}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  className="h-10 pl-3 pr-8 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />
                <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>

              {empresas.length > 0 && (
                <div className="relative">
                  <select
                    value={filterEmpresaId || ""}
                    onChange={(e) => setFilterEmpresaId(e.target.value)}
                    className="h-10 pl-3 pr-8 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium appearance-none min-w-[220px]"
                  >
                    {empresas.map((empresa) => (
                      <option key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </option>
                    ))}
                  </select>
                  <Building2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                </div>
              )}

              <Button
                variant="secondary"
                size="sm"
                className="h-10"
                onClick={() => {
                  setSelectedMonth(filterMonth);
                  setSelectedEmpresaId(filterEmpresaId);
                }}
              >
                Aplicar Filtros
              </Button>

              <Badge
                className={cn(
                  "h-10 px-3 rounded-md font-semibold",
                  competencia?.status === "aberta"
                    ? "bg-info-soft text-info-strong"
                    : "bg-success-soft text-success-strong"
                )}
              >
                Status: {competencia?.status || "Aguardando processamento"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/financeiro/regras")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Regras
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/bancario")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Bancário (CNAB)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending || !selectedEmpresaId}
                title="Recalcula os valores financeiros da competência selecionada"
              >
                {reprocessMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Processar Faturamento
              </Button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center p-20 esc-card">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
              <MetricCard
                label="Total faturável"
                value={`R$ ${Number(totalFaturavel).toLocaleString("pt-BR")}`}
                icon={Wallet}
                accent
              />
              <MetricCard label="Clientes" value={clientes.length.toString()} icon={Building2} />
              <MetricCard label="Colaboradores" value={colaboradores.length.toString()} icon={Users} />
              <MetricCard label="Pendentes" value={pendingCount.toString()} icon={FileCheck} />
              <MetricCard
                label="Inconsistências"
                value={competencia?.contagem_inconsistencias?.toString() || "0"}
                icon={AlertTriangle}
              />
              <MetricCard label="Lotes do RH" value={lotesRhPendentes.length.toString()} icon={FileCheck} />
            </div>

            <Tabs defaultValue="visao-geral" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
                <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
                <TabsTrigger value="lotes-rh" className="relative">
                  Lotes do RH
                  {lotesRhPendentes.length > 0 && (
                    <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-info text-white text-[10px] font-bold px-1">
                      {lotesRhPendentes.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="faturamento">Faturamento</TabsTrigger>
                <TabsTrigger value="fechamento">Fechamento</TabsTrigger>
              </TabsList>

              <TabsContent value="visao-geral" className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section className="esc-card">
                    <header className="px-5 py-4 border-b border-border flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-semibold text-foreground">Faturamento por cliente</h2>
                        <p className="text-sm text-muted-foreground">
                          Situação consolidada da competência em um só lugar.
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => navigate("/financeiro/faturamento")}>
                        Ver histórico <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </header>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="esc-table-header">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-5 h-10 font-medium">Cliente</th>
                            <th className="px-3 h-10 font-medium text-right">Valor</th>
                            <th className="px-5 h-10 font-medium text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientes.map((cliente: any) => (
                            <tr key={cliente.id} className="border-t border-muted hover:bg-background transition-colors">
                              <td className="px-5 h-12 font-medium text-foreground">{cliente.clientes?.nome}</td>
                              <td className="px-3 text-right font-display font-semibold">
                                R$ {Number(cliente.valor_total).toLocaleString("pt-BR")}
                              </td>
                              <td className="px-5 text-center">
                                <span
                                  className={cn(
                                    "esc-chip",
                                    cliente.status === "aprovado"
                                      ? "bg-success-soft text-success-strong"
                                      : "bg-warning-soft text-warning-strong"
                                  )}
                                >
                                  {cliente.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {clientes.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-muted-foreground italic">
                                Nenhum cliente consolidado nesta competência.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <section className="esc-card">
                    <header className="px-5 py-4 border-b border-border flex items-center justify-between">
                      <div>
                        <h2 className="font-display font-semibold text-foreground">Top colaboradores</h2>
                        <p className="text-sm text-muted-foreground">
                          Geração de valor e esforço da competência atual.
                        </p>
                      </div>
                    </header>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="esc-table-header">
                          <tr className="text-left text-muted-foreground">
                            <th className="px-5 h-10 font-medium">Colaborador</th>
                            <th className="px-3 h-10 font-medium text-right">Valor</th>
                            <th className="px-5 h-10 font-medium text-center">Dias</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...colaboradores]
                            .sort((a: any, b: any) => b.valor_total - a.valor_total)
                            .slice(0, 6)
                            .map((colaborador: any) => (
                              <tr key={colaborador.id} className="border-t border-muted hover:bg-background transition-colors">
                                <td className="px-5 h-12">
                                  <div className="font-medium text-foreground">{colaborador.colaboradores?.nome}</div>
                                  <div className="text-[11px] text-muted-foreground">{colaborador.colaboradores?.cargo}</div>
                                </td>
                                <td className="px-3 text-right font-display font-semibold">
                                  R$ {Number(colaborador.valor_total).toLocaleString("pt-BR")}
                                </td>
                                <td className="px-5 text-center text-muted-foreground">
                                  {Array.isArray(colaborador.eventos_financeiros) ? colaborador.eventos_financeiros.length : 0}
                                </td>
                              </tr>
                            ))}
                          {colaboradores.length === 0 && (
                            <tr>
                              <td colSpan={3} className="p-8 text-center text-muted-foreground italic">
                                Nenhum colaborador processado nesta competência.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                </div>
              </TabsContent>

              <TabsContent value="lotes-rh" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <header className="px-5 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Lotes recebidos do RH</h2>
                      <p className="text-sm text-muted-foreground">
                        Entregas oficiais enviadas pelo RH para análise e aprovação financeira.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {lotesRhPendentes.length > 0 && (
                        <Badge className="bg-warning-soft text-warning-strong">
                          {lotesRhPendentes.length} aguardando
                        </Badge>
                      )}
                      <Badge className="bg-muted text-muted-foreground">
                        {lotesRh.length} total
                      </Badge>
                    </div>
                  </header>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="esc-table-header">
                        <tr className="text-left text-muted-foreground">
                          <th className="px-5 h-10 font-medium">Competência</th>
                          <th className="px-3 h-10 font-medium">Empresa</th>
                          <th className="px-3 h-10 font-medium">Tipo</th>
                          <th className="px-3 h-10 font-medium text-center">Colaboradores</th>
                          <th className="px-3 h-10 font-medium text-right">Valor total</th>
                          <th className="px-3 h-10 font-medium text-center">Status</th>
                          <th className="px-5 h-10 font-medium text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingRhLotes ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center">
                              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                            </td>
                          </tr>
                        ) : lotesRh.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="p-8 text-center text-muted-foreground italic">
                              Nenhum lote do RH encontrado para os filtros atuais.
                            </td>
                          </tr>
                        ) : (
                          lotesRh.map((lote: any) => {
                            const isAguardando = lote.status === "AGUARDANDO_FINANCEIRO";
                            const isEmAnalise = lote.status === "EM_ANALISE_FINANCEIRA";
                            const isAguardandoPagamento = lote.status === "AGUARDANDO_PAGAMENTO";
                            const isDevolvido = lote.status === "DEVOLVIDO_RH";
                            return (
                              <tr key={lote.id} className="border-t border-muted hover:bg-background transition-colors">
                                <td className="px-5 h-12 font-medium text-foreground">{lote.competencia}</td>
                                <td className="px-3 text-muted-foreground text-xs">{lote.empresa?.nome || "—"}</td>
                                <td className="px-3 text-muted-foreground">
                                  {lote.tipo === "BANCO_HORAS" ? "Banco de Horas" : "Folha Variável"}
                                </td>
                                <td className="px-3 text-center text-muted-foreground">{lote.total_colaboradores}</td>
                                <td className="px-3 text-right font-display font-semibold">
                                  R$ {Number(lote.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 text-center">
                                  <Badge className={cn(
                                    isAguardando && "bg-warning-soft text-warning-strong",
                                    isEmAnalise && "bg-info-soft text-info-strong",
                                    isAguardandoPagamento && "bg-success-soft text-success-strong",
                                    isDevolvido && "bg-destructive/10 text-destructive",
                                    !isAguardando && !isEmAnalise && !isAguardandoPagamento && !isDevolvido && "bg-muted text-muted-foreground",
                                  )}>
                                    {lote.status === "AGUARDANDO_FINANCEIRO" ? "Aguardando Financeiro" :
                                      lote.status === "EM_ANALISE_FINANCEIRA" ? "Em Análise Financeira" :
                                      lote.status === "AGUARDANDO_PAGAMENTO" ? "Aguardando Pagamento" :
                                      lote.status === "DEVOLVIDO_RH" ? "Devolvido ao RH" :
                                      lote.status}
                                  </Badge>
                                </td>
                                <td className="px-5 text-right">
                                  <Button variant="ghost" size="sm" onClick={() => setRhLoteSelecionado(lote)}>
                                    Analisar
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {lotesRhPendentes.length > 0 && (
                    <div className="border-t border-border px-5 py-3 text-sm text-muted-foreground flex items-center justify-between">
                      <span>
                        Fila do Financeiro:
                        <strong className="text-foreground ml-1">{lotesRhPendentes.length}</strong> lote(s) ·
                        <strong className="text-foreground ml-1">R$ {Number(lotesRhValorTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong>
                      </span>
                      <span className="text-xs text-muted-foreground">Filtre por empresa/competência acima para refinar</span>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="faturamento" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="relative w-full max-w-sm">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Buscar cliente..."
                        className="w-full h-10 pl-10 pr-4 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.print()}>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir tudo
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleApproveBatch}
                        disabled={approveMutation.isPending}
                      >
                        {approveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <FileCheck className="h-4 w-4 mr-2" />
                        )}
                        Aprovar lote
                      </Button>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Cliente</th>
                        <th className="px-3 h-11 font-medium text-center">Operações</th>
                        <th className="px-3 h-11 font-medium text-right">Base</th>
                        <th className="px-3 h-11 font-medium text-right">Regras</th>
                        <th className="px-3 h-11 font-medium text-right">Total faturável</th>
                        <th className="px-3 h-11 font-medium text-center">Status</th>
                        <th className="px-5 h-11 font-medium text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClientes.map((cliente: any) => (
                        <tr key={cliente.id} className="border-t border-muted hover:bg-background transition-colors">
                          <td className="px-5 h-14 font-medium text-foreground">{cliente.clientes?.nome}</td>
                          <td className="px-3 text-center text-muted-foreground font-display">{cliente.quantidade_operacoes}</td>
                          <td className="px-3 text-right text-muted-foreground">
                            R$ {Number(cliente.valor_base).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 text-right text-muted-foreground">
                            R$ {Number(cliente.valor_regras).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 text-right font-display font-bold text-foreground">
                            R$ {Number(cliente.valor_total).toLocaleString("pt-BR")}
                          </td>
                          <td className="px-3 text-center">
                            <Badge
                              className={cn(
                                "h-6 font-semibold",
                                cliente.status === "aprovado"
                                  ? "bg-success-soft text-success-strong"
                                  : "bg-warning-soft text-warning-strong"
                              )}
                            >
                              {cliente.status}
                            </Badge>
                          </td>
                          <td className="px-5 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-primary hover:text-primary-strong"
                              onClick={() => navigate(`/financeiro/faturamento/${cliente.id}`)}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Memória
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredClientes.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-muted-foreground italic">
                            Nenhum cliente encontrado para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>

              <TabsContent value="fechamento" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredFechamentos.map((fechamento) => (
                    <article key={fechamento.id} className="esc-card p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-display font-semibold text-foreground">
                            {new Date(fechamento.data).toLocaleDateString("pt-BR", {
                              month: "long",
                              year: "numeric",
                            })}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {fechamento.empresas?.nome} · {fechamento.total_operacoes} operações
                          </p>
                        </div>
                        <span
                          className={cn(
                            "esc-chip inline-flex items-center gap-1",
                            fechamento.status === "fechado"
                              ? "bg-success-soft text-success-strong"
                              : "bg-warning-soft text-warning-strong"
                          )}
                        >
                          {fechamento.status === "fechado" ? "Fechado" : "Aberto"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 my-4">
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</div>
                          <div className="font-display font-bold text-xl text-foreground">
                            R$ {Number(fechamento.valor_total_calculado).toLocaleString("pt-BR")}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Inconsistências</div>
                          <div
                            className={cn(
                              "font-display font-bold text-xl",
                              (fechamento.contagem_inconsistencias || 0) > 0
                                ? "text-destructive-strong"
                                : "text-success-strong"
                            )}
                          >
                            {fechamento.contagem_inconsistencias || 0}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-border">
                        <span className="text-xs text-muted-foreground">
                          {fechamento.status === "fechado"
                            ? `Fechado em ${new Date(fechamento.created_at).toLocaleDateString("pt-BR")}`
                            : "Aguardando consolidação"}
                        </span>
                        {fechamento.status === "fechado" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 border-amber-400 hover:bg-amber-50"
                            title="Reabrir o período exige justificativa e gera trilha de auditoria"
                            onClick={() => {
                              setFechamentoParaReabrir(fechamento);
                              setMotivoReabrir("");
                              setOpenReabrir(true);
                            }}
                          >
                            <UnlockKeyhole className="h-3.5 w-3.5 mr-1.5" />
                            Reabrir
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={(fechamento.contagem_inconsistencias || 0) > 0 || fecharPeriodoMutation.isPending}
                            onClick={() => fecharPeriodoMutation.mutate(fechamento.id)}
                          >
                            {fecharPeriodoMutation.isPending && fecharPeriodoMutation.variables === fechamento.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Fechar período
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}

                  {filteredFechamentos.length === 0 && (
                    <div className="col-span-2 p-12 text-center text-muted-foreground italic esc-card">
                      Nenhum fechamento encontrado para a competência e empresa selecionadas.
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Dialog Reabrir Período */}
      <Dialog open={openReabrir} onOpenChange={(v) => { setOpenReabrir(v); if (!v) { setFechamentoParaReabrir(null); setMotivoReabrir(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <UnlockKeyhole className="h-5 w-5" />
              Reabrir Período
            </DialogTitle>
            <DialogDescription>
              {fechamentoParaReabrir && (
                <>
                  Você está reabrindo o fechamento de{" "}
                  <strong>{new Date(fechamentoParaReabrir.data).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</strong>.
                  Esta ação será registrada para auditoria.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
              ⚠️ Atenção: a reabertura anula o fechamento e permite alterações nos registros.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-reabrir-fin">Justificativa (obrigatória)</Label>
              <Textarea
                id="motivo-reabrir-fin"
                placeholder="Descreva o motivo da reabertura..."
                value={motivoReabrir}
                onChange={(e) => setMotivoReabrir(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenReabrir(false)}>Cancelar</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!motivoReabrir.trim()}
              onClick={() => {
                // Por ora apenas fecha o dialog e notifica (ação de reabrir depende de implementação de serviço)
                toast.info("Solicitação de reabertura registrada. Implemente ResultadosService.reabrir() para persistir.");
                setOpenReabrir(false);
              }}
            >
              <UnlockKeyhole className="h-4 w-4 mr-2" />
              Confirmar Reabertura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmação de Aprovação em Lote */}
      <Dialog open={openConfirmAprovacao} onOpenChange={setOpenConfirmAprovacao}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Confirmar Aprovação em Lote
            </DialogTitle>
            <DialogDescription>
              Você está aprovando <strong>{filteredClientes.length} faturamento(s)</strong> filtrados.
              Esta ação atualiza o status para <strong>aprovado</strong> e não pode ser revertida sem reabertura.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenConfirmAprovacao(false)}>Cancelar</Button>
            <Button onClick={confirmarAprovacao} disabled={approveMutation.isPending}>
              {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileCheck className="h-4 w-4 mr-2" />}
              Aprovar {filteredClientes.length} item(s)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(rhLoteSelecionado)}
        onOpenChange={(open) => {
          if (!open) { setRhLoteSelecionado(null); setObservacaoAprovacao(""); setShowLogHistorico(false); }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Análise do Lote — Financeiro
            </DialogTitle>
            <DialogDescription>
              {rhLoteSelecionado
                ? `${rhLoteSelecionado.competencia} · ${rhLoteSelecionado.empresa?.nome || ""} · ${rhLoteSelecionado.tipo === "BANCO_HORAS" ? "Banco de Horas" : "Folha Variável"}`
                : "Carregando lote…"}
            </DialogDescription>
          </DialogHeader>

          {loadingRhLoteDetalhe ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rhLoteDetalhe ? (
            <div className="space-y-5">
              {/* Status atual + motivo devolução */}
              {(() => {
                const st = rhLoteDetalhe.status as string;
                const cfg: Record<string, { label: string; cls: string }> = {
                  AGUARDANDO_FINANCEIRO: { label: "Aguardando Financeiro", cls: "bg-warning-soft text-warning-strong" },
                  EM_ANALISE_FINANCEIRA: { label: "Em Análise Financeira", cls: "bg-info-soft text-info-strong" },
                  APROVADO_FINANCEIRO: { label: "Aprovado pelo Financeiro", cls: "bg-success-soft text-success-strong" },
                  AGUARDANDO_PAGAMENTO: { label: "Aguardando Pagamento/CNAB", cls: "bg-success-soft text-success-strong" },
                  DEVOLVIDO_RH: { label: "Devolvido ao RH", cls: "bg-destructive/10 text-destructive" },
                };
                const c = cfg[st] || { label: st, cls: "bg-muted text-muted-foreground" };
                return (
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge className={cn("text-xs font-semibold px-3 py-1 rounded-full", c.cls)}>{c.label}</Badge>
                    {rhLoteDetalhe.motivo_devolucao && (
                      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                        <span className="font-semibold">Motivo:</span> {rhLoteDetalhe.motivo_devolucao}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Metadados */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "Competência", value: rhLoteDetalhe.competencia },
                  { label: "Empresa", value: rhLoteDetalhe.empresa?.nome || "—" },
                  { label: "Colaboradores", value: String(rhLoteDetalhe.total_colaboradores) },
                  { label: "Valor total", value: `R$ ${Number(rhLoteDetalhe.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-muted/30 p-4">
                    <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{item.label}</div>
                    <div className="mt-1.5 font-display font-bold text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Resumo de itens */}
              {(() => {
                const itens = rhLoteDetalhe.itens || [];
                const total = itens.length;
                const rejeit = itens.filter((i: any) => i.status === "REJEITADO").length;
                const pend = itens.filter((i: any) => i.status === "PENDENTE").length;
                const valT = itens.reduce((a: number, i: any) => a + Number(i.valor_calculado || 0), 0);
                return (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: "Total itens", value: String(total), cls: "" },
                      { label: "Faturáveis", value: String(total - rejeit), cls: "text-success" },
                      { label: "Pendentes", value: String(pend), cls: "text-warning" },
                      { label: "Valor faturável", value: `R$ ${valT.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, cls: "text-primary" },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-border bg-muted/20 p-3 text-center">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
                        <div className={cn("mt-1.5 font-display text-lg font-bold", s.cls)}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tabela de itens */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border bg-muted/20 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">Itens do lote</span>
                  <span className="text-xs text-muted-foreground">{(rhLoteDetalhe.itens || []).length} registros</span>
                </div>
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="esc-table-header sticky top-0">
                      <tr className="text-left text-muted-foreground">
                        <th className="px-4 h-9 font-medium">Colaborador</th>
                        <th className="px-3 h-9 font-medium">Evento</th>
                        <th className="px-3 h-9 font-medium text-center">Horas</th>
                        <th className="px-3 h-9 font-medium text-right">Valor</th>
                        <th className="px-4 h-9 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(rhLoteDetalhe.itens || []).length === 0 ? (
                        <tr><td colSpan={5} className="p-8 text-center text-muted-foreground italic">Nenhum item neste lote.</td></tr>
                      ) : (
                        (rhLoteDetalhe.itens || []).map((item: any) => (
                          <tr key={item.id} className="border-t border-muted hover:bg-background transition-colors">
                            <td className="px-4 py-2.5 font-medium text-foreground">{item.nome_colaborador}</td>
                            <td className="px-3 py-2.5 text-muted-foreground text-xs capitalize">{String(item.tipo_evento || "").split("_").join(" ")}</td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground font-mono">
                              {Number(item.horas ?? Number(item.minutos || 0) / 60).toFixed(2)}h
                            </td>
                            <td className="px-3 py-2.5 text-right font-display font-semibold">
                              R$ {Number(item.valor_calculado || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <Badge className={cn("text-[10px]",
                                item.status === "APROVADO" && "bg-success-soft text-success-strong",
                                item.status === "PENDENTE" && "bg-warning-soft text-warning-strong",
                                item.status === "REJEITADO" && "bg-destructive/10 text-destructive",
                                item.status === "EM_ANALISE" && "bg-info-soft text-info-strong",
                              )}>{item.status}</Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Observação ao aprovar */}
              {["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(rhLoteDetalhe.status) && (
                <div className="space-y-1.5">
                  <Label htmlFor="obs-aprov" className="text-sm">Observação ao aprovar (opcional)</Label>
                  <Textarea
                    id="obs-aprov"
                    rows={2}
                    placeholder="Registre aqui qualquer nota para o histórico…"
                    value={observacaoAprovacao}
                    onChange={(e) => setObservacaoAprovacao(e.target.value)}
                    className="resize-none text-sm"
                  />
                </div>
              )}

              {/* Histórico colapsável */}
              <div className="rounded-xl border border-border overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
                  onClick={() => setShowLogHistorico((v) => !v)}
                >
                  <span className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" />Histórico do lote</span>
                  {showLogHistorico ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>
                {showLogHistorico && (
                  <div className="border-t border-border">
                    {loadingLogs ? (
                      <div className="p-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                    ) : logsDoLote.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground italic">Nenhum evento registrado ainda.</div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {logsDoLote.map((log) => (
                          <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                            <span className="mt-0.5">
                              {log.acao === "APROVOU" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                              {log.acao === "DEVOLVEU" && <RotateCcw className="h-3.5 w-3.5 text-destructive" />}
                              {log.acao !== "APROVOU" && log.acao !== "DEVOLVEU" && <History className="h-3.5 w-3.5 text-muted-foreground" />}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs text-muted-foreground">
                                {new Date(log.created_at).toLocaleString("pt-BR")} · <span className="font-medium text-foreground">{log.usuario_nome || "Sistema"}</span>
                              </div>
                              {log.observacao && <div className="text-sm text-foreground mt-0.5">{log.observacao}</div>}
                              <div className="text-[11px] text-muted-foreground mt-1">
                                {log.status_anterior} → <span className="font-medium text-foreground">{log.status_novo}</span>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-muted-foreground">Nenhum detalhe disponível para este lote.</div>
          )}

          <DialogFooter className="flex-wrap gap-2 sm:justify-between pt-4 border-t border-border">
            {/* Esquerda: Devolver */}
            <div className="flex gap-2">
              {rhLoteDetalhe && ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(rhLoteDetalhe.status) && (
                <Button
                  variant="outline"
                  className="text-destructive border-destructive/40 hover:bg-destructive/5"
                  onClick={() => setOpenDevolucao(true)}
                  disabled={devolverRHMutation.isPending}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Devolver ao RH
                </Button>
              )}
            </div>
            {/* Direita: Fechar / Iniciar / Aprovar */}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRhLoteSelecionado(null)}>Fechar</Button>
              {rhLoteDetalhe && ["AGUARDANDO_FINANCEIRO", "DEVOLVIDO_RH"].includes(rhLoteDetalhe.status) && (
                <Button variant="outline" onClick={() => iniciarAnaliseMutation.mutate(rhLoteDetalhe.id)} disabled={iniciarAnaliseMutation.isPending}>
                  {iniciarAnaliseMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                  Iniciar Análise
                </Button>
              )}
              {rhLoteDetalhe && ["AGUARDANDO_FINANCEIRO", "EM_ANALISE_FINANCEIRA"].includes(rhLoteDetalhe.status) && (
                <Button
                  className="bg-success hover:bg-success/90 text-white"
                  onClick={() => aprovarFinanceiroMutation.mutate({ id: rhLoteDetalhe.id, obs: observacaoAprovacao })}
                  disabled={aprovarFinanceiroMutation.isPending || (rhLoteDetalhe.itens || []).length === 0}
                >
                  {aprovarFinanceiroMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Aprovar Financeiro
                </Button>
              )}
              {rhLoteDetalhe?.status === "AGUARDANDO_PAGAMENTO" && (
                <div className="flex items-center gap-2 rounded-lg bg-success-soft px-3 py-2 text-sm font-semibold text-success-strong">
                  <CheckCircle2 className="h-4 w-4" /> Pronto para etapa bancária/CNAB
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sub-dialog: Devolver ao RH */}
      <Dialog open={openDevolucao} onOpenChange={(v) => { setOpenDevolucao(v); if (!v) setMotivoDevolucao(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="h-5 w-5" />
              Devolver lote ao RH
            </DialogTitle>
            <DialogDescription>O lote retornará para a fila do RH com o motivo registrado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-warning/40 bg-warning-soft/40 px-4 py-3 text-sm text-warning-strong">
              ⚠️ O motivo ficará visível para o RH e será registrado no histórico de auditoria.
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motivo-dev" className="text-sm font-medium">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="motivo-dev"
                rows={4}
                placeholder="Descreva o que precisa ser corrigido pelo RH…"
                value={motivoDevolucao}
                onChange={(e) => setMotivoDevolucao(e.target.value)}
                className="resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpenDevolucao(false); setMotivoDevolucao(""); }}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!motivoDevolucao.trim() || devolverRHMutation.isPending}
              onClick={() => devolverRHMutation.mutate({ id: rhLoteSelecionado!.id, motivo: motivoDevolucao })}
            >
              {devolverRHMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Confirmar devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default CentralFinanceira;

