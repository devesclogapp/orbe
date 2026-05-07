import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle,
  Clock,
  FileCheck,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useTenant } from "@/contexts/TenantContext";
import { ColaboradorService, EmpresaService } from "@/services/base.service";
import { BHRegraService } from "@/services/v4.service";
import { processRhPeriod, reprocessRhPeriod, rhProcessingUtils } from "@/services/rhProcessing.service";

const minutesToTime = (totalMinutes: number) => {
  const hours = Math.floor(Math.abs(totalMinutes) / 60);
  const minutes = Math.abs(totalMinutes) % 60;
  const sign = totalMinutes < 0 ? "-" : "";
  return `${sign}${hours}h ${minutes}m`;
};

const ProcessamentoRH = () => {
  const queryClient = useQueryClient();
  const { tenantId } = useTenant();
  const [selectedEmpresa, setSelectedEmpresa] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [searchTerm, setSearchTerm] = useState("");
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("pontos");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingResult, setProcessingResult] = useState<any>(null);

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: colaboradores = [] } = useQuery({
    queryKey: ["colaboradores_all"],
    queryFn: () => ColaboradorService.getWithEmpresa(),
  });

  const { data: regras = [] } = useQuery({
    queryKey: ["bh_regras_all"],
    queryFn: () => BHRegraService.getWithEmpresa(),
  });

  const { data: pontos = [], isLoading: isLoadingPontos, refetch } = useQuery({
    queryKey: ["rh_pontos_periodo", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString().split("T")[0];
      const endDate = new Date(year, month, 0).toISOString().split("T")[0];

      let query = supabase
        .from("registros_ponto")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("data", startDate)
        .lte("data", endDate)
        .order("data", { ascending: true })
        .order("created_at", { ascending: true });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: saldos = [] } = useQuery({
    queryKey: ["banco_horas_saldos", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("banco_horas_saldos")
        .select("*")
        .eq("tenant_id", tenantId);
      if (error) return [];
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["processamento_rh_logs", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);

      let query = (supabase as any)
        .from("processamento_rh_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("periodo_mes", month)
        .eq("periodo_ano", year)
        .order("executado_em", { ascending: false });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  const { data: inconsistencias = [] } = useQuery({
    queryKey: ["processamento_rh_inconsistencias", selectedMonth, selectedEmpresa, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const [year, month] = selectedMonth.split("-").map(Number);
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0).toISOString();

      let query = (supabase as any)
        .from("processamento_rh_inconsistencias")
        .select("*")
        .eq("tenant_id", tenantId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: false });

      if (selectedEmpresa !== "all") {
        query = query.eq("empresa_id", selectedEmpresa);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  const saldoMap = useMemo(
    () => new Map((saldos as any[]).map((saldo) => [saldo.colaborador_id, saldo])),
    [saldos],
  );

  const empresaMap = useMemo(
    () => new Map((empresas as any[]).map((empresa) => [empresa.id, empresa.nome])),
    [empresas],
  );

  const filteredPontos = useMemo(() => {
    return (pontos as any[]).filter((ponto) => {
      const nome = ponto.nome_colaborador || "";
      if (!searchTerm) return true;
      return rhProcessingUtils
        .normalizeText(nome)
        .includes(rhProcessingUtils.normalizeText(searchTerm));
    });
  }, [pontos, searchTerm]);

  const groupedColaboradores = useMemo(() => {
    const groups = new Map<string, any>();

    filteredPontos.forEach((ponto: any) => {
      const key = ponto.colaborador_id || ponto.matricula_colaborador || ponto.cpf_colaborador || ponto.nome_colaborador || ponto.id;
      const current = groups.get(key) || {
        key,
        colaborador_id: ponto.colaborador_id || null,
        nome: ponto.nome_colaborador || "Sem vínculo",
        empresa_id: ponto.empresa_id || null,
        diasProcessados: 0,
        positivas: 0,
        negativas: 0,
        saldoPeriodo: 0,
        saldoAtual: 0,
        ultimoProcessamento: null as string | null,
      };

      if (ponto.status_processamento === "processado" || ponto.status_processamento === "inconsistente") {
        current.diasProcessados += 1;
      }

      const saldoDia = Number(ponto.saldo_dia || 0);
      current.positivas += Math.max(saldoDia, 0);
      current.negativas += Math.max(-saldoDia, 0);
      current.saldoPeriodo += saldoDia;

      const saldoAtual = saldoMap.get(ponto.colaborador_id || "")?.saldo_atual_minutos;
      if (typeof saldoAtual === "number") {
        current.saldoAtual = saldoAtual;
      }

      if (ponto.processado_em) {
        if (!current.ultimoProcessamento || new Date(ponto.processado_em) > new Date(current.ultimoProcessamento)) {
          current.ultimoProcessamento = ponto.processado_em;
        }
      }

      groups.set(key, current);
    });

    return Array.from(groups.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [filteredPontos, saldoMap]);

  const pendingCount = useMemo(
    () => filteredPontos.filter((ponto: any) => ponto.status_processamento === "pendente").length,
    [filteredPontos],
  );

  const stats = useMemo(() => {
    const processados = (pontos as any[]).filter((ponto) => ponto.status_processamento === "processado").length;
    const inconsistentes = (pontos as any[]).filter((ponto) => ponto.status_processamento === "inconsistente").length;
    const pendentes = (pontos as any[]).filter((ponto) => ponto.status_processamento === "pendente").length;
    const horasPositivas = (pontos as any[]).reduce((acc, ponto) => acc + Math.max(Number(ponto.saldo_dia || 0), 0), 0);
    const horasNegativas = (pontos as any[]).reduce((acc, ponto) => acc + Math.max(-Number(ponto.saldo_dia || 0), 0), 0);
    const faltas = (pontos as any[]).filter((ponto) => ponto.status === "Ausente" || ponto.status === "Falta").length;
    const saldoAcumuladoTotal = (saldos as any[]).reduce((acc, saldo) => acc + Number(saldo.saldo_atual_minutos || 0), 0);
    const colaboradoresPositivos = (saldos as any[]).filter((saldo) => Number(saldo.saldo_atual_minutos || 0) > 0).length;
    const colaboradoresNegativos = (saldos as any[]).filter((saldo) => Number(saldo.saldo_atual_minutos || 0) < 0).length;

    return {
      total: (pontos as any[]).length,
      processados,
      inconsistentes,
      pendentes,
      regrasAtivas: (regras as any[]).filter((regra) => regra.bh_ativo !== false).length,
      horasPositivas,
      horasNegativas,
      faltas,
      saldoAcumuladoTotal,
      colaboradoresPositivos,
      colaboradoresNegativos,
    };
  }, [pontos, regras, saldos]);

  const invalidateRhQueries = async () => {
    await Promise.all([
      refetch(),
      queryClient.invalidateQueries({ queryKey: ["processamento_rh_logs"] }),
      queryClient.invalidateQueries({ queryKey: ["processamento_rh_inconsistencias"] }),
      queryClient.invalidateQueries({ queryKey: ["banco_horas_saldos"] }),
      queryClient.invalidateQueries({ queryKey: ["bh_saldos"] }),
    ]);
  };

  const processarPontos = async () => {
    if (!tenantId) {
      toast.error("Tenant nÃ£o identificado");
      return;
    }

    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const result = await processRhPeriod({
        tenantId,
        month: selectedMonth,
        empresaId: selectedEmpresa === "all" ? null : selectedEmpresa,
        empresas: empresas as any[],
        colaboradores: colaboradores as any[],
        regras: regras as any[],
      });

      setProcessingResult(result);
      await invalidateRhQueries();

      if (result.totalProcessados === 0) {
        toast.info("Nenhum registro pendente encontrado para processar.");
      } else {
        toast.success(`Processamento concluÃ­do: ${result.totalProcessados} registros processados.`);
      }

      setProcessModalOpen(false);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao processar: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const reprocessarPontos = async () => {
    if (!tenantId) {
      toast.error("Tenant nÃ£o identificado");
      return;
    }

    setIsProcessing(true);
    setProcessingResult(null);

    try {
      const result = await reprocessRhPeriod({
        tenantId,
        month: selectedMonth,
        empresaId: selectedEmpresa === "all" ? null : selectedEmpresa,
        colaboradores: colaboradores as any[],
      });

      await invalidateRhQueries();
      toast.warning(`PerÃ­odo reaberto: ${result.registrosLimpados} registros limpos para novo processamento.`);
    } catch (error: any) {
      console.error(error);
      toast.error(`Erro ao reprocessar: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const isLoading = isLoadingEmpresas || isLoadingPontos;

  return (
    <AppShell title="Processamento RH" subtitle="Fluxo diário acumulativo de ponto, banco de horas e fechamento mensal">
      <div className="space-y-6">
        <section className="esc-card p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar colaborador..."
                className="pl-9 h-10"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Select value={selectedEmpresa} onValueChange={setSelectedEmpresa}>
              <SelectTrigger className="w-[220px] h-10">
                <Building2 className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Empresas</SelectItem>
                {(empresas as any[]).map((empresa) => (
                  <SelectItem key={empresa.id} value={empresa.id}>
                    {empresa.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-10">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Mês" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, index) => {
                  const date = new Date(2026, index, 1);
                  return (
                    <SelectItem key={index} value={format(date, "yyyy-MM")}>
                      {format(date, "MMMM/yyyy", { locale: ptBR })}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            <Button onClick={() => setProcessModalOpen(true)} disabled={isLoading || pendingCount === 0 || isProcessing}>
              <Play className="mr-2 h-4 w-4" />
              Processar Pendentes
            </Button>

            <Button variant="outline" onClick={reprocessarPontos} disabled={isLoading || isProcessing || stats.total === 0}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reprocessar Período
            </Button>

            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-soft">
              <FileCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Pontos</p>
              <p className="text-xl font-bold font-display">{stats.total}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-soft">
              <CheckCircle className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Processados</p>
              <p className="text-xl font-bold font-display text-success">{stats.processados}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-soft">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Inconsistências</p>
              <p className="text-xl font-bold font-display text-warning">{stats.inconsistentes}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <Clock className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold font-display">{stats.pendentes}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info-soft">
              <Users className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Positivos</p>
              <p className="text-xl font-bold font-display">{stats.colaboradoresPositivos}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-error-soft">
              <XCircle className="h-5 w-5 text-error" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Negativos</p>
              <p className="text-xl font-bold font-display text-error">{stats.colaboradoresNegativos}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-soft">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Positivas</p>
              <p className="text-xl font-bold font-display text-success">{minutesToTime(stats.horasPositivas)}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-error-soft">
              <TrendingDown className="h-5 w-5 text-error" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Horas Negativas</p>
              <p className="text-xl font-bold font-display text-error">{minutesToTime(stats.horasNegativas)}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-soft">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-xl font-bold font-display text-warning">{stats.faltas}</p>
            </div>
          </div>
          <div className="esc-card p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-soft">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Banco Total</p>
              <p className={cn("text-xl font-bold font-display", stats.saldoAcumuladoTotal >= 0 ? "text-primary" : "text-error")}>
                {minutesToTime(stats.saldoAcumuladoTotal)}
              </p>
            </div>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="pontos">Histórico Diário</TabsTrigger>
            <TabsTrigger value="colaboradores">Acumulado por Colaborador</TabsTrigger>
            <TabsTrigger value="inconsistencias">Inconsistências ({inconsistencias.length})</TabsTrigger>
            <TabsTrigger value="logs">Logs ({logs.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="pontos" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted flex items-center justify-between">
                <h3 className="font-semibold text-sm">Histórico diário processado</h3>
                <span className="text-xs text-muted-foreground">O saldo acumulado segue entre os meses até compensação ou ajuste.</span>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/30">
                      <tr className="text-left">
                        <th className="px-4 py-3 font-medium">Data</th>
                        <th className="px-4 py-3 font-medium">Colaborador</th>
                        <th className="px-4 py-3 font-medium">Empresa</th>
                        <th className="px-4 py-3 font-medium text-center">Entrada</th>
                        <th className="px-4 py-3 font-medium text-center">Saída</th>
                        <th className="px-4 py-3 font-medium text-center">Horas</th>
                        <th className="px-4 py-3 font-medium text-center">Extra</th>
                        <th className="px-4 py-3 font-medium text-center">Atraso</th>
                        <th className="px-4 py-3 font-medium text-center">Saldo Dia</th>
                        <th className="px-4 py-3 font-medium text-center">Saldo Acum.</th>
                        <th className="px-4 py-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPontos.map((ponto: any) => {
                        const workedMinutes = rhProcessingUtils.calculateWorkedMinutes(ponto);
                        const saldoDia = Number(ponto.saldo_dia || 0);
                        const saldoAcumulado = Number(ponto.saldo_acumulado_minutos || 0);
                        const empresaNome =
                          empresaMap.get(ponto.empresa_id) || ponto.empresa_nome || ponto.nome_empresa || "—";

                        return (
                          <tr key={ponto.id} className="border-t border-muted hover:bg-muted/20">
                            <td className="px-4 py-3">{format(new Date(ponto.data), "dd/MM/yyyy")}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{ponto.nome_colaborador || "Sem vínculo"}</div>
                              <div className="text-xs text-muted-foreground">{ponto.matricula_colaborador || "-"}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{empresaNome}</td>
                            <td className="px-4 py-3 text-center font-mono">{ponto.entrada?.slice(0, 5) || "-"}</td>
                            <td className="px-4 py-3 text-center font-mono">{ponto.saida?.slice(0, 5) || "-"}</td>
                            <td className="px-4 py-3 text-center">{minutesToTime(workedMinutes)}</td>
                            <td className="px-4 py-3 text-center text-success">{minutesToTime(Number(ponto.minutos_extra || 0))}</td>
                            <td className="px-4 py-3 text-center text-error">{minutesToTime(Number(ponto.minutos_atraso || 0))}</td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("font-display font-semibold", saldoDia > 0 ? "text-success" : saldoDia < 0 ? "text-error" : "text-muted-foreground")}>
                                {minutesToTime(saldoDia)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={cn("font-display font-semibold", saldoAcumulado > 0 ? "text-primary" : saldoAcumulado < 0 ? "text-error" : "text-muted-foreground")}>
                                {minutesToTime(saldoAcumulado)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge className={cn(
                                ponto.status_processamento === "processado" && "bg-success-soft text-success",
                                ponto.status_processamento === "inconsistente" && "bg-warning-soft text-warning",
                                ponto.status_processamento === "pendente" && "bg-muted text-muted-foreground",
                              )}>
                                {ponto.status_processamento || "pendente"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredPontos.length === 0 && (
                        <tr>
                          <td colSpan={11} className="p-12 text-center text-muted-foreground">
                            Nenhum ponto encontrado no período selecionado.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </TabsContent>

          <TabsContent value="colaboradores" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Visão agrupada por colaborador</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Colaborador</th>
                      <th className="px-4 py-3 font-medium">Empresa</th>
                      <th className="px-4 py-3 font-medium text-center">Dias Processados</th>
                      <th className="px-4 py-3 font-medium text-center">Positivas</th>
                      <th className="px-4 py-3 font-medium text-center">Negativas</th>
                      <th className="px-4 py-3 font-medium text-center">Saldo no Período</th>
                      <th className="px-4 py-3 font-medium text-center">Saldo Atual</th>
                      <th className="px-4 py-3 font-medium text-center">Último Processamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedColaboradores.map((item) => (
                      <tr key={item.key} className="border-t border-muted">
                        <td className="px-4 py-3 font-medium">{item.nome}</td>
                        <td className="px-4 py-3 text-muted-foreground">{empresaMap.get(item.empresa_id) || "—"}</td>
                        <td className="px-4 py-3 text-center">{item.diasProcessados}</td>
                        <td className="px-4 py-3 text-center text-success">{minutesToTime(item.positivas)}</td>
                        <td className="px-4 py-3 text-center text-error">{minutesToTime(item.negativas)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-display font-semibold", item.saldoPeriodo > 0 ? "text-success" : item.saldoPeriodo < 0 ? "text-error" : "text-muted-foreground")}>
                            {minutesToTime(item.saldoPeriodo)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={cn("font-display font-semibold", item.saldoAtual > 0 ? "text-primary" : item.saldoAtual < 0 ? "text-error" : "text-muted-foreground")}>
                            {minutesToTime(item.saldoAtual)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground">
                          {item.ultimoProcessamento ? format(new Date(item.ultimoProcessamento), "dd/MM/yyyy HH:mm") : "—"}
                        </td>
                      </tr>
                    ))}

                    {groupedColaboradores.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-muted-foreground">
                          Nenhum colaborador encontrado para o filtro atual.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="inconsistencias" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Histórico de inconsistências</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Data</th>
                      <th className="px-4 py-3 font-medium">Tipo</th>
                      <th className="px-4 py-3 font-medium">Descrição</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inconsistencias as any[]).map((item) => (
                      <tr key={item.id} className="border-t border-muted">
                        <td className="px-4 py-3">{item.created_at ? format(new Date(item.created_at), "dd/MM/yyyy HH:mm") : "—"}</td>
                        <td className="px-4 py-3">{item.tipo}</td>
                        <td className="px-4 py-3">{item.descricao}</td>
                        <td className="px-4 py-3">
                          <Badge className={cn(item.resolvida ? "bg-success-soft text-success" : "bg-warning-soft text-warning")}>
                            {item.resolvida ? "Resolvida" : item.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}

                    {(inconsistencias as any[]).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-muted-foreground">
                          Nenhuma inconsistência encontrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <section className="esc-card overflow-hidden">
              <div className="esc-table-header px-5 py-3 border-b border-muted">
                <h3 className="font-semibold text-sm">Logs de execução</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr className="text-left">
                      <th className="px-4 py-3 font-medium">Execução</th>
                      <th className="px-4 py-3 font-medium">Registros</th>
                      <th className="px-4 py-3 font-medium">Processados</th>
                      <th className="px-4 py-3 font-medium">Inconsistências</th>
                      <th className="px-4 py-3 font-medium">Horas +</th>
                      <th className="px-4 py-3 font-medium">Horas -</th>
                      <th className="px-4 py-3 font-medium">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(logs as any[]).map((log) => (
                      <tr key={log.id} className="border-t border-muted">
                        <td className="px-4 py-3">
                          <div>{log.executado_em ? format(new Date(log.executado_em), "dd/MM/yyyy HH:mm") : "—"}</div>
                          <div className="text-xs text-muted-foreground">{log.reprocessado ? "Reprocessamento" : "Processamento incremental"}</div>
                        </td>
                        <td className="px-4 py-3">{log.total_registros}</td>
                        <td className="px-4 py-3 text-success">{log.total_processados}</td>
                        <td className="px-4 py-3 text-warning">{log.total_inconsistencias}</td>
                        <td className="px-4 py-3 text-success">{minutesToTime(Number(log.total_horas_positivas || 0))}</td>
                        <td className="px-4 py-3 text-error">{minutesToTime(Number(log.total_horas_negativas || 0))}</td>
                        <td className="px-4 py-3 text-muted-foreground">{Number(log.duracao_ms || 0) > 0 ? `${(Number(log.duracao_ms) / 1000).toFixed(1)}s` : "—"}</td>
                      </tr>
                    ))}

                    {(logs as any[]).length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-muted-foreground">
                          Nenhum log de processamento encontrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={processModalOpen} onOpenChange={setProcessModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar processamento diário</DialogTitle>
            <DialogDescription>
              O motor processará apenas registros com status <strong>pendente</strong> no mês {format(new Date(`${selectedMonth}-01`), "MMMM/yyyy", { locale: ptBR })}, manterá o histórico diário e continuará acumulando o banco de horas por colaborador.
            </DialogDescription>
          </DialogHeader>

          {processingResult && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="rounded-lg bg-success-soft p-4 text-center">
                <p className="text-sm text-success">Processados</p>
                <p className="text-2xl font-bold text-success">{processingResult.totalProcessados}</p>
              </div>
              <div className="rounded-lg bg-warning-soft p-4 text-center">
                <p className="text-sm text-warning">Inconsistências</p>
                <p className="text-2xl font-bold text-warning">{processingResult.totalInconsistencias}</p>
              </div>
              <div className="rounded-lg bg-primary-soft p-4 text-center">
                <p className="text-sm text-primary">Créditos</p>
                <p className="text-2xl font-bold text-primary">{minutesToTime(Number(processingResult.totalCreditos || 0))}</p>
              </div>
              <div className="rounded-lg bg-destructive-soft p-4 text-center">
                <p className="text-sm text-destructive">Débitos</p>
                <p className="text-2xl font-bold text-destructive">{minutesToTime(Number(processingResult.totalDebitos || 0))}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setProcessModalOpen(false)} disabled={isProcessing}>
              Cancelar
            </Button>
            <Button onClick={processarPontos} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Iniciar Processamento
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default ProcessamentoRH;
