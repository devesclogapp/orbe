import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ExternalLink,
  FileCheck,
  Filter,
  Layers,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { MetricCard } from "@/components/painel/MetricCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AIService,
  CompetenciaService,
  ConsolidadoService,
  EmpresaService,
  ResultadosService,
} from "@/services/base.service";

const CentralFinanceira = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7));
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: empresas = [], isLoading: loadingEmps } = useQuery<any[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId(empresas[0].id);
    }
  }, [empresas, selectedEmpresaId]);

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

  const reprocessMutation = useMutation({
    mutationFn: () => AIService.processDay(`${selectedMonth}-01`, selectedEmpresaId!),
    onSuccess: () => {
      toast.success("Reprocessamento concluído", {
        description: "Os dados financeiros foram atualizados.",
      });
      queryClient.invalidateQueries({ queryKey: ["consolidado", selectedMonth, selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["competencia", selectedMonth, selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["fechamentos"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao reprocessar", { description: err.message });
    },
  });

  const consolidarMutation = useMutation({
    mutationFn: () => AIService.processDay(`${selectedMonth}-01`, selectedEmpresaId!),
    onSuccess: () => {
      toast.success("Faturamento consolidado", {
        description: "A competência foi processada e os valores atualizados.",
      });
      queryClient.invalidateQueries({ queryKey: ["consolidado", selectedMonth, selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["competencia", selectedMonth, selectedEmpresaId] });
      queryClient.invalidateQueries({ queryKey: ["fechamentos"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao consolidar", { description: err.message });
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
  const isLoading = loadingEmps || loadingComp || loadingCons || loadingFechamentos;

  const handleApproveBatch = () => {
    const ids = filteredClientes.map((cliente: any) => cliente.id);
    if (ids.length === 0) {
      toast.error("Nenhum item para aprovar");
      return;
    }
    if (confirm(`Deseja aprovar ${ids.length} faturamentos?`)) {
      approveMutation.mutate(ids);
    }
  };

  return (
    <AppShell
      title="Central Financeira"
      subtitle={`Competência, faturamento e fechamento no mesmo fluxo · ${new Date(`${selectedMonth}-01`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="h-10 pl-3 pr-8 rounded-md border border-border bg-card text-sm focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                />
                <Filter className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              </div>

              {empresas.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedEmpresaId || ""}
                    onChange={(e) => setSelectedEmpresaId(e.target.value)}
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
              <Button variant="outline" size="sm" onClick={() => navigate("/financeiro/remessa")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Remessa CNAB
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => reprocessMutation.mutate()}
                disabled={reprocessMutation.isPending || !selectedEmpresaId}
              >
                {reprocessMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Reprocessar
              </Button>
              <Button
                size="sm"
                onClick={() => consolidarMutation.mutate()}
                disabled={consolidarMutation.isPending || !selectedEmpresaId}
              >
                {consolidarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4 mr-2" />
                )}
                Consolidar faturamento
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
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
            </div>

            <Tabs defaultValue="visao-geral" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
                <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
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
                          <Button size="sm" variant="outline">
                            Reabrir
                          </Button>
                        ) : (
                          <Button size="sm" disabled={(fechamento.contagem_inconsistencias || 0) > 0}>
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
    </AppShell>
  );
};

export default CentralFinanceira;
