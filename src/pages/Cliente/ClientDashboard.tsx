import React, { useState, useMemo } from "react";
import PortalShell from "@/components/layout/PortalShell";
import { Card } from "@/components/ui/card";
import {
  Boxes,
  Layers,
  Clock,
  Building2,
  Calendar,
  ArrowRight,
  TrendingUp,
  Inbox,
  Truck,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { PortalOperacionalService, PortalOperacaoItem } from "@/services/portal/portalOperacional.service";
import { useClient } from "@/contexts/ClientContext";
import { Link } from "react-router-dom";

export const ClientDashboard = () => {
  const { cliente, selectedAdminEmpresaId } = useClient();

  // Competência selecionada (padrão: mês atual 'YYYY-MM')
  const currentMonthStr = useMemo(() => new Date().toISOString().slice(0, 7), []);
  const [competencia, setCompetencia] = useState(currentMonthStr);

  // Calcular datas de início e fim com base na competência selecionada
  const { dataInicio, dataFim } = useMemo(() => {
    const inicio = `${competencia}-01`;
    const ano = parseInt(competencia.split("-")[0], 10);
    const mes = parseInt(competencia.split("-")[1], 10);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const fim = `${competencia}-${String(ultimoDia).padStart(2, "0")}`;
    return { dataInicio: inicio, dataFim: fim };
  }, [competencia]);

  // Lista de meses recentes para o filtro de período
  const periodOptions = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      list.push({ value: val, label: label.charAt(0).toUpperCase() + label.slice(1) });
    }
    return list;
  }, []);

  // 1. Consulta de KPIs Agregados
  const {
    data: stats,
    isLoading: loadingStats,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ["portal_cliente_stats", competencia, selectedAdminEmpresaId],
    queryFn: () => PortalOperacionalService.fetchStats(competencia, selectedAdminEmpresaId),
  });

  // 2. Consulta Exaustiva de Operações do Período (distribuição completa e resumo recente sem truncamento)
  const {
    data: operacoesData,
    isLoading: loadingOps,
    refetch: refetchOps,
  } = useQuery({
    queryKey: ["portal_cliente_recent_ops", dataInicio, dataFim, selectedAdminEmpresaId],
    queryFn: () =>
      PortalOperacionalService.fetchAllPeriodOperacoes(
        {
          dataInicio,
          dataFim,
        },
        selectedAdminEmpresaId,
      ),
  });

  const allPeriodOps: PortalOperacaoItem[] = operacoesData?.itens || [];
  const recentOps: PortalOperacaoItem[] = allPeriodOps.slice(0, 10);
  const totalCount = stats?.total_operacoes ?? operacoesData?.total ?? 0;

  // 3. Distribuição por Tipo de Serviço no período (abrangência total da competência)
  const servicosDistribuicao = useMemo(() => {
    if (!allPeriodOps || allPeriodOps.length === 0) return [];
    const countMap: Record<string, { count: number; volume: number }> = {};
    allPeriodOps.forEach((op) => {
      const rawNome = op.tipo_servico_nome?.trim();
      const nome =
        rawNome && rawNome !== "Operação Padrão" && rawNome !== "-"
          ? rawNome
          : "Não classificado";

      if (!countMap[nome]) countMap[nome] = { count: 0, volume: 0 };
      countMap[nome].count += 1;
      countMap[nome].volume += Number(op.quantidade || 0);
    });

    const totalOps = allPeriodOps.length;
    return Object.entries(countMap).map(([servico, data]) => ({
      servico,
      count: data.count,
      volume: data.volume,
      percent: totalOps > 0 ? Math.round((data.count / totalOps) * 100) : 0,
    }));
  }, [allPeriodOps]);

  const nomeEmpresa = stats?.empresa_nome || cliente?.nome || "Empresa Contratante";

  const handleRefresh = () => {
    refetchStats();
    refetchOps();
  };

  return (
    <PortalShell title="Visão Geral Operacional">
      <div className="space-y-6">
        {/* Cabeçalho de Identificação & Filtro por Período */}
        <div className="rounded-3xl border border-border bg-card p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground truncate">{nomeEmpresa}</h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Acompanhamento de descargas, movimentações e serviços executados pela ESC LOG.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Select value={competencia} onValueChange={setCompetencia}>
                <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl bg-background border-border">
                  <SelectValue placeholder="Competência..." />
                </SelectTrigger>
                <SelectContent>
                  {periodOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-xl border-border"
              onClick={handleRefresh}
              title="Atualizar dados"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Indicadores Principais (KPIs Operacionais) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6 border-border bg-card shadow-sm rounded-3xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Operações no Período
              </span>
              <div className="w-10 h-10 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-foreground">
                {loadingStats ? "..." : (stats?.total_operacoes ?? totalCount)}
              </h3>
              <span className="text-xs text-muted-foreground">lançamentos validados</span>
            </div>
          </Card>

          <Card className="p-6 border-border bg-card shadow-sm rounded-3xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Volume Total Movimentado
              </span>
              <div className="w-10 h-10 bg-emerald-500/10 text-emerald-600 rounded-2xl flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-foreground">
                {loadingStats
                  ? "..."
                  : Number(stats?.volume_total || 0).toLocaleString("pt-BR")}
              </h3>
              <span className="text-xs text-muted-foreground">unidades / volumes</span>
            </div>
          </Card>

          <Card className="p-6 border-border bg-card shadow-sm rounded-3xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Operações de Hoje
              </span>
              <div className="w-10 h-10 bg-blue-500/10 text-blue-600 rounded-2xl flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <h3 className="text-3xl font-extrabold text-foreground">
                {loadingStats ? "..." : (stats?.operacoes_hoje ?? 0)}
              </h3>
              <span className="text-xs text-muted-foreground">dia atual</span>
            </div>
          </Card>
        </div>

        {/* Distribuição por Tipo de Serviço & Histórico Recente */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna 1: Distribuição por Tipo de Serviço */}
          <Card className="p-6 border-border bg-card shadow-sm rounded-3xl lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-foreground text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Distribuição por Serviço
              </h4>
              <Badge variant="outline" className="text-xs font-normal">
                {servicosDistribuicao.length} tipo(s)
              </Badge>
            </div>

            {loadingOps ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Carregando serviços...</p>
            ) : servicosDistribuicao.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <Inbox className="w-8 h-8 text-muted-foreground mx-auto stroke-1" />
                <p className="text-xs text-muted-foreground">Sem serviços no período.</p>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                {servicosDistribuicao.map((item) => (
                  <div key={item.servico} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground truncate max-w-[180px]">
                        {item.servico}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {item.count} op ({item.percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(item.percent, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Coluna 2 e 3: Histórico Recente de Operações */}
          <Card className="border-border bg-card shadow-sm rounded-3xl lg:col-span-2 overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <h4 className="font-bold text-foreground text-sm">Operações Recentes</h4>
                <p className="text-xs text-muted-foreground">
                  Últimos apontamentos processados e validados no período.
                </p>
              </div>
              <Link to="/cliente/operacoes">
                <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-primary font-semibold">
                  Ver todas <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </Link>
            </div>

            <div className="overflow-x-auto flex-1">
              {loadingOps ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  Carregando operações...
                </div>
              ) : recentOps.length === 0 ? (
                <div className="p-12 text-center space-y-3">
                  <Inbox className="w-10 h-10 text-muted-foreground mx-auto stroke-1" />
                  <p className="text-sm font-semibold text-foreground">
                    Nenhuma operação registrada no período
                  </p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Assim que a equipe operacional da ESC LOG processar os serviços realizados para sua empresa, eles serão exibidos aqui.
                  </p>
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/30 text-left">
                    <tr>
                      <th className="px-5 py-3 font-medium text-muted-foreground">Data</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Serviço / Produto</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Transportadora</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground text-right">Qtd</th>
                      <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {recentOps.map((op) => (
                      <tr key={op.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5 font-medium text-foreground whitespace-nowrap">
                          {new Date(op.data_operacao + "T00:00:00").toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-semibold text-foreground truncate max-w-[200px]">
                            {op.tipo_servico_nome}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                            {op.produto_nome}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5 truncate max-w-[160px]">
                            <Truck className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{op.transportadora_nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-foreground whitespace-nowrap">
                          {Number(op.quantidade || 0).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            {op.status_operacional}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </PortalShell>
  );
};

export default ClientDashboard;
