import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  PlayCircle,
  RefreshCw,
  Upload,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { RightPanel } from "@/components/layout/RightPanel";
import { JustificationModal } from "@/components/modals/JustificationModal";
import { MetricCard } from "@/components/painel/MetricCard";
import { StatusChip } from "@/components/painel/StatusChip";
import { PontoOperacoesBlock } from "@/components/painel/PontoOperacoesBlock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useAdminOverride } from "@/hooks/useAdminOverride";
import {
  AIService,
  ColaboradorService,
  EmpresaService,
  LogSincronizacaoService,
  OperacaoService,
} from "@/services/base.service";

const statusMap = {
  sucesso: { label: "Sucesso", icon: CheckCircle2, cls: "bg-success-soft text-success-strong" },
  erro: { label: "Erro", icon: XCircle, cls: "bg-destructive-soft text-destructive-strong" },
  parcial: { label: "Parcial", icon: AlertCircle, cls: "bg-warning-soft text-warning-strong" },
};

const CentralOperacional = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");

  const dateValue = format(selectedDate, "yyyy-MM-dd");

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<any[]>({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  useEffect(() => {
    if (empresas.length > 0 && !selectedEmpresaId) {
      setSelectedEmpresaId("all");
    }
  }, [empresas, selectedEmpresaId]);

  const { data: colaboradores = [], isLoading: isLoadingCols } = useQuery<any[]>({
    queryKey: ["colaboradores", selectedEmpresaId],
    queryFn: () => ColaboradorService.getWithEmpresa(selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: operacoes = [], isLoading: isLoadingOps } = useQuery<any[]>({
    queryKey: ["operacoes", dateValue, selectedEmpresaId],
    queryFn: () => OperacaoService.getPainelByDate(dateValue, selectedEmpresaId === "all" ? undefined : selectedEmpresaId),
    enabled: !!selectedEmpresaId,
  });

  const { data: logsImportacao = [], isLoading: isLoadingLogs } = useQuery<any[]>({
    queryKey: ["importacoes"],
    queryFn: () => LogSincronizacaoService.getWithEmpresa(),
  });

  const { data: issues = [], isLoading: isLoadingIssues } = useQuery<any[]>({
    queryKey: ["inconsistencias"],
    queryFn: () => OperacaoService.getInconsistencies(),
  });

  const {
    isOpen,
    isUpdating,
    pendingStatus,
    checkAndExecute,
    handleConfirm,
    handleClose,
  } = useAdminOverride({
    onUpdate: async (id, payload, justification) => {
      await OperacaoService.updateWithOverride(id, payload, justification);
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
    },
  });

  const filteredIssues = useMemo(
    () =>
      issues.filter((issue) => {
        const sameDate = issue.data === dateValue;
        const sameEmpresa = selectedEmpresaId === "all" || issue.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [issues, dateValue, selectedEmpresaId]
  );

  const filteredLogs = useMemo(
    () =>
      logsImportacao.filter((log) => {
        const sameDate = String(log.data || "").startsWith(dateValue);
        const sameEmpresa = selectedEmpresaId === "all" || log.empresa_id === selectedEmpresaId;
        return sameDate && sameEmpresa;
      }),
    [logsImportacao, dateValue, selectedEmpresaId]
  );

  const totalCalculado = operacoes.reduce(
    (acc, op) => acc + Number(op.valor_total_label ?? (Number(op.quantidade) * Number(op.valor_unitario || 0))),
    0
  );

  const ultimaImportacao = filteredLogs[0];
  const isLoading =
    isLoadingEmpresas ||
    isLoadingCols ||
    isLoadingOps ||
    isLoadingLogs ||
    isLoadingIssues;

  const processMutation = useMutation({
    mutationFn: (empresaId: string) => AIService.processDay(dateValue, empresaId),
    onSuccess: (res) => {
      toast.success("Processamento concluído", {
        description: `Resultado consolidado: R$ ${res.resultado?.[0]?.valor_total_calculado?.toLocaleString("pt-BR") || "0,00"}`,
      });
      queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      queryClient.invalidateQueries({ queryKey: ["ponto"] });
      queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
      queryClient.invalidateQueries({ queryKey: ["importacoes"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_mensais"] });
      queryClient.invalidateQueries({ queryKey: ["resultados_processamento"] });
    },
    onError: (err: any) => {
      toast.error("Erro ao processar", { description: err.message });
    },
  });

  const handleProcessar = () => {
    if (!selectedEmpresaId || selectedEmpresaId === "all") {
      toast.warning("Selecione uma empresa específica", {
        description: "O processamento precisa de uma unidade operacional definida.",
      });
      return;
    }
    processMutation.mutate(selectedEmpresaId);
  };

  const handleResolve = async (issue: any) => {
    const payload = { status: "ok" };
    const needsOverride = checkAndExecute(issue.id, payload, issue.status);

    if (!needsOverride) {
      try {
        await OperacaoService.update(issue.id, payload);
        toast.success("Inconsistência resolvida com sucesso");
        queryClient.invalidateQueries({ queryKey: ["inconsistencias"] });
        queryClient.invalidateQueries({ queryKey: ["operacoes"] });
      } catch (error: any) {
        toast.error(error.message || "Erro ao resolver inconsistência");
      }
    }
  };

  return (
    <AppShell
      title="Central Operacional"
      subtitle={`Importar, validar e corrigir o dia operacional · ${format(selectedDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
      rightPanel={<RightPanel />}
    >
      <div className="space-y-6">
        <section className="esc-card p-4 md:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal h-10 px-4 esc-card-hover border-border border",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                    {format(selectedDate, "dd/MM/yyyy")}
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>

              <Select value={selectedEmpresaId} onValueChange={setSelectedEmpresaId}>
                <SelectTrigger className="w-[280px] h-10 border-border border bg-card hover:bg-secondary transition-colors font-display font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <SelectValue placeholder="Selecione a empresa" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as empresas</SelectItem>
                  {empresas.map((empresa) => (
                    <SelectItem key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge
                className={cn(
                  "h-10 px-3 rounded-md font-semibold",
                  filteredIssues.length > 0
                    ? "bg-warning-soft text-warning-strong"
                    : "bg-success-soft text-success-strong"
                )}
              >
                {filteredIssues.length > 0
                  ? `${filteredIssues.length} inconsistência(s) em aberto`
                  : "Dia consistente até o momento"}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/relatorios")}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Relatórios
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/importacoes")}>
                <UploadCloud className="h-4 w-4 mr-2" />
                Histórico completo
              </Button>
              <Button
                size="sm"
                className="shadow-lg shadow-primary/20"
                onClick={handleProcessar}
                disabled={processMutation.isPending || isLoading}
              >
                {processMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-2" />
                )}
                {processMutation.isPending ? "Processando..." : "Processar dia"}
              </Button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-24 esc-card border-dashed">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
            <p className="text-sm font-medium text-muted-foreground animate-pulse">
              Carregando o contexto operacional consolidado...
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              <MetricCard label="Colaboradores" value={colaboradores.length.toString()} icon={Building2} />
              <MetricCard label="Operações" value={operacoes.length.toString()} icon={UploadCloud} />
              <MetricCard
                label="Total do dia"
                value={`R$ ${totalCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
                icon={PlayCircle}
                accent
              />
              <MetricCard label="Inconsistências" value={filteredIssues.length.toString()} icon={AlertTriangle} />
              <MetricCard
                label="Última sincronização"
                value={ultimaImportacao ? new Date(ultimaImportacao.data).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "Sem sync"}
                icon={Upload}
              />
            </div>

            <Tabs defaultValue="processamento" className="space-y-4">
              <TabsList className="bg-muted/50 p-1 rounded-xl border border-border/50 flex flex-wrap h-auto">
                <TabsTrigger value="processamento">Processamento</TabsTrigger>
                <TabsTrigger value="importacoes">Importações</TabsTrigger>
                <TabsTrigger value="inconsistencias">Inconsistências</TabsTrigger>
              </TabsList>

              <TabsContent value="processamento" className="space-y-5">
                <section className="esc-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Resumo do dia operacional</h2>
                      <p className="text-sm text-muted-foreground">
                        Dados operacionais na tela principal. Resultado consolidado e status inteligente aparecem ao selecionar um colaborador.
                      </p>
                    </div>
                    {selectedEmpresaId === "all" && (
                      <Badge className="bg-info-soft text-info-strong">
                        Selecione uma empresa para processar
                      </Badge>
                    )}
                  </div>
                  <PontoOperacoesBlock date={dateValue} empresaId={selectedEmpresaId} />
                </section>
              </TabsContent>

              <TabsContent value="importacoes" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Importações e sincronizações</h2>
                      <p className="text-sm text-muted-foreground">
                        Acompanhamento do que entrou hoje antes do processamento.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm">
                        <Upload className="h-4 w-4 mr-2" />
                        Importar CSV
                      </Button>
                      <Button size="sm">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Sincronizar agora
                      </Button>
                    </div>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Data / hora</th>
                        <th className="px-3 h-11 font-medium">Origem</th>
                        <th className="px-3 h-11 font-medium">Empresa</th>
                        <th className="px-3 h-11 font-medium text-center">Registros</th>
                        <th className="px-3 h-11 font-medium text-center">Duração</th>
                        <th className="px-5 h-11 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((item) => {
                        const status = statusMap[item.status as keyof typeof statusMap] || statusMap.parcial;
                        const Icon = status.icon;
                        return (
                          <tr key={item.id} className="border-t border-muted hover:bg-background">
                            <td className="px-5 h-[52px] text-muted-foreground">
                              {new Date(item.data).toLocaleString("pt-BR")}
                            </td>
                            <td className="px-3 text-foreground">{item.origem}</td>
                            <td className="px-3 text-muted-foreground">{item.empresas?.nome || "—"}</td>
                            <td className="px-3 text-center font-display font-medium">{item.contagem_registros}</td>
                            <td className="px-3 text-center text-muted-foreground">{item.duracao}</td>
                            <td className="px-5 text-center">
                              <span className={cn("esc-chip inline-flex items-center gap-1", status.cls)}>
                                <Icon className="h-3 w-3" />
                                {status.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredLogs.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-muted-foreground italic">
                            Nenhuma importação registrada para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>

              <TabsContent value="inconsistencias" className="space-y-4">
                <section className="esc-card overflow-hidden">
                  <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                    <div>
                      <h2 className="font-display font-semibold text-foreground">Correções no mesmo fluxo</h2>
                      <p className="text-sm text-muted-foreground">
                        Revise, corrija e volte a processar sem sair do contexto.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => navigate("/inconsistencias")}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir visão completa
                    </Button>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="esc-table-header">
                      <tr className="text-left">
                        <th className="px-5 h-11 font-medium">Tipo</th>
                        <th className="px-3 h-11 font-medium">Colaborador</th>
                        <th className="px-3 h-11 font-medium">Descrição</th>
                        <th className="px-3 h-11 font-medium text-center">Status</th>
                        <th className="px-5 h-11 font-medium text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredIssues.map((issue, index) => (
                        <tr key={issue.id || index} className="border-t border-muted hover:bg-background">
                          <td className="px-5 h-[60px]">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-warning-strong" />
                              <span className="font-medium text-foreground">{issue.tipo_servico}</span>
                            </div>
                          </td>
                          <td className="px-3 text-foreground">{issue.colaboradores?.nome || "—"}</td>
                          <td className="px-3 text-muted-foreground">
                            {issue.quantidade} {issue.tipo_servico === "Volume" ? "volumes" : "carros"} lançados por{" "}
                            {issue.colaboradores?.nome}
                          </td>
                          <td className="px-3 text-center">
                            <StatusChip status={issue.status} />
                          </td>
                          <td className="px-5 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 hover:bg-success-soft hover:text-success-strong border-muted"
                              onClick={() => handleResolve(issue)}
                            >
                              Corrigir
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {filteredIssues.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                            Nenhuma inconsistência encontrada para os filtros atuais.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </section>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <JustificationModal
        isOpen={isOpen}
        onClose={handleClose}
        onConfirm={handleConfirm}
        status={pendingStatus}
        isLoading={isUpdating}
      />
    </AppShell>
  );
};

export default CentralOperacional;
