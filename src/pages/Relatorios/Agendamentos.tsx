/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ReportService } from "@/services/report.service";
import { ContabilOficialService, ContabilLogItem } from "@/services/contabilOficial.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { formatBRL } from "@/services/adapters/relatoriosOficialAdapter";
import {
  Clock,
  Plus,
  Play,
  Pause,
  Trash2,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  History,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  RefreshCw,
  Mail,
  Lock,
  ExternalLink,
  ChevronRight,
  Info,
  HelpCircle,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { FerramentasContabeisMenu } from "@/pages/Relatorios/components/FerramentasContabeisMenu";
import { GuiaUsoDrawer } from "@/pages/Relatorios/components/GuiaUsoDrawer";
import { GUIA_AGENDAMENTOS_CONTABEIS } from "@/pages/Relatorios/components/guiasContabeisData";
import { useContadorScope } from "@/hooks/useContadorScope";

interface AgendamentoItem {
  id: string;
  nome: string;
  empresa_id?: string;
  frequencia: string;
  status: "aguardando_ativacao" | "ativo" | "pausado" | "cancelado";
  destinatarios?: string[] | any;
  relatorio_id?: string;
  created_at?: string;
  updated_at?: string;
}

const Agendamentos: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { role, isAdmin } = useAccessControl();
  const { isContador, filterEmpresas, validateOrFallbackEmpresaId, empresasAutorizadasIds } = useContadorScope();

  const isAuthorized = useMemo(() => {
    if (isAdmin) return true;
    const normalized = (role || "").toLowerCase();
    return normalized === "admin" || normalized === "financeiro" || normalized === "contador";
  }, [role, isAdmin]);

  const paramEmpresaId = searchParams.get("empresa_id") || "";
  const paramCompetencia = searchParams.get("competencia") || "";

  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(
    paramEmpresaId || "TODAS"
  );
  const [isGuiaOpen, setIsGuiaOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [historyEmpresa, setHistoryEmpresa] = useState<{ id: string; nome: string } | null>(null);

  // Form de criação de agendamento mensal
  const [formEmpresaId, setFormEmpresaId] = useState<string>("");
  const [formNome, setFormNome] = useState<string>("");
  const [formDia, setFormDia] = useState<number>(5);
  const [formHorario, setFormHorario] = useState<string>("08:00");
  const [formDestinatarios, setFormDestinatarios] = useState<string>("");

  // Carregar lista de empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_agendamentos"],
    queryFn: async () => {
      const data = await EmpresaService.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  const availableEmpresas = useMemo(() => {
    return filterEmpresas(empresas);
  }, [empresas, filterEmpresas]);

  // Query dos agendamentos persistidos
  const {
    data: agendamentos = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery<AgendamentoItem[]>({
    queryKey: ["report_schedules", selectedEmpresaId],
    queryFn: () => ReportService.getAgendamentos(selectedEmpresaId),
    enabled: isAuthorized,
  });

  const displayedAgendamentos = useMemo(() => {
    if (!isContador || empresasAutorizadasIds.length === 0) return agendamentos;
    return agendamentos.filter((a) => !a.empresa_id || empresasAutorizadasIds.includes(a.empresa_id));
  }, [agendamentos, isContador, empresasAutorizadasIds]);

  // Carregar histórico de execuções (contabil_logs_integracao) para a empresa selecionada
  const { data: logsEmpresa = [], isLoading: isLoadingLogs } = useQuery({
    queryKey: ["accounting_logs", historyEmpresa?.id],
    queryFn: () => ContabilOficialService.getLogs(historyEmpresa?.id),
    enabled: !!historyEmpresa?.id,
  });

  // Mutações de Criação, Atualização e Cancelamento
  const createMutation = useMutation({
    mutationFn: (data: any) => ReportService.createAgendamento(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_schedules"] });
      setIsAddOpen(false);
      setFormNome("");
      setFormEmpresaId("");
      setFormDia(5);
      setFormHorario("08:00");
      setFormDestinatarios("");
      toast.success(
        "Agendamento mensal configurado com sucesso! Registrado com status 'Aguardando ativação' conforme governança."
      );
    },
    onError: (err: any) => {
      toast.error(`Falha ao salvar agendamento: ${err.message || "Erro desconhecido"}`);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AgendamentoItem["status"] }) =>
      ReportService.updateAgendamento(id, { status }),
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["report_schedules"] });
      const label =
        vars.status === "ativo"
          ? "Agendamento ativado!"
          : vars.status === "pausado"
          ? "Agendamento pausado."
          : "Agendamento cancelado.";
      toast.success(label);
    },
    onError: (err: any) => {
      toast.error(`Falha ao alterar status: ${err.message || "Erro desconhecido"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ReportService.deleteAgendamento(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report_schedules"] });
      toast.success("Agendamento excluído com sucesso.");
    },
    onError: (err: any) => {
      toast.error(`Falha ao excluir agendamento: ${err.message || "Erro desconhecido"}`);
    },
  });

  // Handler de abertura do modal
  const handleOpenCreate = () => {
    const defaultEmp =
      selectedEmpresaId !== "TODAS"
        ? selectedEmpresaId
        : empresas[0]?.id || "";
    setFormEmpresaId(defaultEmp);
    const empNome = empresas.find((e) => e.id === defaultEmp)?.nome || "";
    setFormNome(empNome ? `Exportação Contábil Mensal — ${empNome}` : "Exportação Contábil Mensal");
    setFormDia(5);
    setFormHorario("08:00");
    setFormDestinatarios("");
    setIsAddOpen(true);
  };

  const handleEmpresaSelectChange = (empId: string) => {
    setFormEmpresaId(empId);
    const empNome = empresas.find((e) => e.id === empId)?.nome || "";
    if (empNome) {
      setFormNome(`Exportação Contábil Mensal — ${empNome}`);
    }
  };

  const handleSaveSchedule = () => {
    if (!formNome.trim()) {
      toast.error("O nome do agendamento é obrigatório.");
      return;
    }
    if (!formEmpresaId) {
      toast.error("Selecione a empresa vinculada ao agendamento.");
      return;
    }

    // Formatar destinatários e metadados de execução
    const emails = formDestinatarios
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    const destinatariosPayload = [
      `dia:${formDia}`,
      `horario:${formHorario}`,
      ...emails,
    ];

    createMutation.mutate({
      empresa_id: formEmpresaId,
      nome: formNome.trim(),
      frequencia: "mensal",
      status: "aguardando_ativacao",
      destinatarios: destinatariosPayload,
    });
  };

  // Cálculo determinístico do Próximo Processamento
  const computeProximoProcessamento = (item: AgendamentoItem) => {
    if (item.status === "pausado") return "Pausado (Suspenso)";
    if (item.status === "cancelado") return "Cancelado";

    // Extrair dia e horário das tags em destinatários ou padrão dia 5
    let dia = 5;
    let hora = 8;
    let minuto = 0;

    if (Array.isArray(item.destinatarios)) {
      for (const d of item.destinatarios) {
        if (typeof d === "string") {
          if (d.startsWith("dia:")) {
            const parsedDia = parseInt(d.replace("dia:", ""), 10);
            if (!isNaN(parsedDia)) dia = parsedDia;
          } else if (d.startsWith("horario:")) {
            const [h, m] = d.replace("horario:", "").split(":");
            if (!isNaN(parseInt(h, 10))) hora = parseInt(h, 10);
            if (!isNaN(parseInt(m, 10))) minuto = parseInt(m, 10);
          }
        }
      }
    }

    const now = new Date();
    const candidate = new Date(now.getFullYear(), now.getMonth(), dia, hora, minuto, 0);

    let nextDate: Date;
    if (candidate > now) {
      nextDate = candidate;
    } else {
      nextDate = new Date(now.getFullYear(), now.getMonth() + 1, dia, hora, minuto, 0);
    }

    return `${nextDate.toLocaleDateString("pt-BR")} às ${String(hora).padStart(2, "0")}:${String(
      minuto
    ).padStart(2, "0")}`;
  };

  const handleBackToHub = () => {
    const params = new URLSearchParams();
    if (selectedEmpresaId && selectedEmpresaId !== "TODAS") {
      params.set("empresa_id", selectedEmpresaId);
    }
    if (paramCompetencia) {
      params.set("competencia", paramCompetencia);
    }
    const qs = params.toString();
    if (isContador) {
      navigate(`/relatorios/integracao${qs ? `?${qs}` : ""}`);
    } else {
      navigate(`/relatorios${qs ? `?${qs}` : ""}`);
    }
  };

  if (!isAuthorized) {
    return (
      <AppShell
        title="Agendamentos Contábeis"
        subtitle="Automação de rotinas contábeis mensais com governança e conformidade"
        backPath={isContador ? "/relatorios/integracao" : "/relatorios"}
      >
        <div className="p-8 max-w-2xl mx-auto border border-border rounded-xl bg-card text-center space-y-4 my-12">
          <Lock className="h-12 w-12 text-destructive mx-auto" />
          <h3 className="text-lg font-bold text-foreground">Acesso Restrito aos Agendamentos Contábeis</h3>
          <p className="text-sm text-muted-foreground">
            O gerenciamento de rotinas e agendamentos contábeis é restrito aos perfis Administrativo e Financeiro.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate(isContador ? "/relatorios/integracao" : "/relatorios")}>
            Voltar para Central de Relatórios
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Agendamentos Contábeis"
      subtitle="Automação de rotinas contábeis mensais com governança, regras de fechamento e conformidade"
      backPath={isContador ? `/relatorios/integracao?empresa_id=${selectedEmpresaId}&competencia=${paramCompetencia}` : `/relatorios?empresa_id=${selectedEmpresaId}&competencia=${paramCompetencia}`}
    >
      <div className="space-y-4 pb-16">
        {/* BARRA SUPERIOR DE COMANDOS */}
        <header className="rounded-xl border border-border/80 bg-card p-3 shadow-xs backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {availableEmpresas.length > 0 && (
              <div className="w-64">
                <Select
                  value={selectedEmpresaId}
                  onValueChange={(val) => {
                    setSelectedEmpresaId(val);
                    const next = new URLSearchParams(searchParams);
                    if (val !== "TODAS") next.set("empresa_id", val);
                    else next.delete("empresa_id");
                    setSearchParams(next, { replace: true });
                  }}
                >
                  <SelectTrigger className="h-9 text-sm bg-background/60 font-medium">
                    <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground" />
                    <SelectValue placeholder="Filtrar por Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODAS">Todas as Empresas</SelectItem>
                    {availableEmpresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="text-sm">
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-normal bg-muted/40 border-border/60">
              <Clock className="h-3.5 w-3.5 text-primary" />
              Rotinas Recorrentes
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Auxiliares */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 gap-2 text-sm font-medium text-muted-foreground hover:text-foreground border-border/70 hover:bg-muted/50"
              onClick={() => setIsGuiaOpen(true)}
            >
              <HelpCircle className="h-4 w-4 text-primary" />
              <span>Guia de Uso</span>
            </Button>

            <FerramentasContabeisMenu
              empresaId={selectedEmpresaId !== "TODAS" ? selectedEmpresaId : undefined}
              competencia={paramCompetencia}
            />

            {/* Secundárias */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              <span>Atualizar</span>
            </Button>

            {/* Primária */}
            <Button
              size="sm"
              className="h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              onClick={handleOpenCreate}
            >
              <Plus className="h-4 w-4" />
              <span>Novo Agendamento Mensal</span>
            </Button>
          </div>
        </header>

        {/* Aviso de Governança Obrigatório */}
        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 dark:bg-amber-950/20 text-xs text-foreground flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold block text-amber-700 dark:text-amber-300">
              Diretriz de Conformidade e Proteção de Dados (CONT-04)
            </span>
            <p className="text-muted-foreground leading-relaxed">
              Nenhuma exportação contábil definitiva ocorre sem que o fechamento financeiro da competência esteja homologado e o mapeamento de contas de partidas dobradas esteja 100% completo. Caso o worker de automação em segundo plano ainda não esteja homologado em produção, os agendamentos são registrados e mantidos como <strong>Aguardando ativação</strong> para assegurar conformidade e auditoria sem simulações fictícias.
            </p>
          </div>
        </div>

      {/* Tabela de Agendamentos */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[30%]">Nome do Agendamento</TableHead>
              <TableHead className="w-[20%]">Empresa Vinculada</TableHead>
              <TableHead className="w-[12%] text-center">Frequência</TableHead>
              <TableHead className="w-[18%]">Próximo Processamento</TableHead>
              <TableHead className="w-[10%] text-center">Status</TableHead>
              <TableHead className="w-[10%] text-right pr-4">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-14 animate-pulse bg-muted/20" />
                </TableRow>
              ))
            ) : agendamentos.length > 0 ? (
              displayedAgendamentos.map((item) => {
                const emp = empresas.find((e) => e.id === item.empresa_id);
                const empNome = emp?.nome || "Todas as Empresas";
                const proximo = computeProximoProcessamento(item);

                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted text-muted-foreground shrink-0 mt-0.5">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">{item.nome}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {Array.isArray(item.destinatarios) && item.destinatarios.length > 0 ? (
                              <span className="flex items-center gap-1 mt-0.5">
                                <Mail className="h-3 w-3" />
                                {item.destinatarios.filter((d: any) => typeof d === "string" && !d.includes(":")).length > 0
                                  ? `${item.destinatarios.filter((d: any) => typeof d === "string" && !d.includes(":")).length} destinatário(s)`
                                  : "Sem e-mails externos"}
                              </span>
                            ) : (
                              "Notificação no sistema"
                            )}
                          </div>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate max-w-[180px]" title={empNome}>
                          {empNome}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground">
                        {item.frequencia}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-foreground">{proximo}</span>
                        {item.status === "aguardando_ativacao" && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400">
                            Aguardando liberação do worker
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {item.status === "ativo" ? (
                        <Badge
                          variant="default"
                          className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-normal"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ativo
                        </Badge>
                      ) : item.status === "aguardando_ativacao" ? (
                        <Badge
                          variant="secondary"
                          className="bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 text-[10px] font-normal"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Aguardando ativação
                        </Badge>
                      ) : item.status === "pausado" ? (
                        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                          <Pause className="h-3 w-3 mr-1" />
                          Pausado
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] font-normal">
                          Cancelado
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right pr-4">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver Histórico */}
                        {item.empresa_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            title="Consultar Histórico de Execuções"
                            onClick={() =>
                              setHistoryEmpresa({ id: item.empresa_id!, nome: empNome })
                            }
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        )}

                        {/* Ativar / Pausar */}
                        {item.status === "pausado" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            title="Ativar Agendamento"
                            onClick={() =>
                              updateStatusMutation.mutate({ id: item.id, status: "ativo" })
                            }
                            disabled={updateStatusMutation.isPending}
                          >
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                        ) : item.status === "ativo" || item.status === "aguardando_ativacao" ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            title="Pausar Agendamento"
                            onClick={() =>
                              updateStatusMutation.mutate({ id: item.id, status: "pausado" })
                            }
                            disabled={updateStatusMutation.isPending}
                          >
                            <Pause className="h-3.5 w-3.5" />
                          </Button>
                        ) : null}

                        {/* Excluir / Cancelar */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          title="Excluir Agendamento"
                          onClick={() => {
                            if (confirm("Deseja realmente remover esta rotina de agendamento?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-36 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">
                      Nenhum agendamento mensal configurado
                    </p>
                    <p className="text-xs max-w-sm">
                      Cadastre rotinas mensais para geração e conferência dos lotes contábeis por empresa.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenCreate}
                      className="mt-2 h-8 text-xs font-semibold"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      Criar Agendamento Mensal
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modal de Criação de Agendamento Mensal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Novo Agendamento Mensal Contábil
            </DialogTitle>
            <DialogDescription>
              Configure o ciclo mensal de geração e sincronização contábil por empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Empresa Contábil
              </Label>
              <Select value={formEmpresaId} onValueChange={handleEmpresaSelectChange}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a empresa..." />
                </SelectTrigger>
                <SelectContent>
                  {availableEmpresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Nome de Identificação da Rotina
              </Label>
              <Input
                placeholder="Ex: Exportação Contábil Mensal — ESC LOG"
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Dia da Execução Mensal
                </Label>
                <Select
                  value={String(formDia)}
                  onValueChange={(val) => setFormDia(parseInt(val, 10))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Dia" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        Dia {d} de cada mês
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Recomendado após o 5º dia útil.
                </p>
              </div>

              <div>
                <Label className="text-xs font-bold text-foreground block mb-1.5">
                  Horário de Execução
                </Label>
                <Input
                  type="time"
                  value={formHorario}
                  onChange={(e) => setFormHorario(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">Horário de Brasília (BRT).</p>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-foreground block mb-1.5">
                Destinatários para Alertas e Arquivo (Opcional)
              </Label>
              <Input
                placeholder="contabilidade@esclog.com.br, financeiro@esclog.com.br"
                value={formDestinatarios}
                onChange={(e) => setFormDestinatarios(e.target.value)}
                className="text-xs"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                E-mails separados por vírgula para recebimento do log de apuração.
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/60 border border-border text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                Status Inicial: Aguardando ativação
              </div>
              <p>
                A rotina será salva na tabela de agendamentos com validação de governança. O processamento automático ocorrerá após homologação do executor background.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-sm font-medium"
              onClick={() => setIsAddOpen(false)}
              disabled={createMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              onClick={handleSaveSchedule}
              disabled={createMutation.isPending}
            >
              <Save className="h-4 w-4" />
              <span>{createMutation.isPending ? "Salvando..." : "Salvar Agendamento"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Consulta de Histórico de Execuções */}
      <Dialog open={!!historyEmpresa} onOpenChange={(open) => !open && setHistoryEmpresa(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Histórico de Execuções Contábeis — {historyEmpresa?.nome}
            </DialogTitle>
            <DialogDescription>
              Registros reais de apurações e exportações gravadas em <code>contabil_logs_integracao</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {isLoadingLogs ? (
              <div className="py-12 text-center text-xs text-muted-foreground animate-pulse">
                Carregando histórico do Supabase...
              </div>
            ) : logsEmpresa.length > 0 ? (
              <div className="rounded-lg border border-border overflow-hidden max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="text-xs">Data / Horário</TableHead>
                      <TableHead className="text-xs">Competência</TableHead>
                      <TableHead className="text-xs">Tipo</TableHead>
                      <TableHead className="text-xs text-right">Lançamentos</TableHead>
                      <TableHead className="text-xs text-right">Valor</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logsEmpresa.map((log) => (
                      <TableRow key={log.id} className="text-xs">
                        <TableCell className="font-mono text-[11px]">
                          {new Date(log.execucao_data).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-bold">{log.competencia}</TableCell>
                        <TableCell className="text-muted-foreground">{log.tipo_envio}</TableCell>
                        <TableCell className="text-right font-mono">
                          {log.total_lancamentos}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {formatBRL(log.total_valor || 0)}
                        </TableCell>
                        <TableCell className="text-center">
                          {log.status === "sucesso" ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300"
                            >
                              Sucesso
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              Falha
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-xs">
                Nenhuma execução contábil gravada até o momento para esta empresa.
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-sm font-medium"
              onClick={() => setHistoryEmpresa(null)}
            >
              Fechar Histórico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      {/* Guia de Uso Contextual (CONT-06) */}
      <GuiaUsoDrawer
        isOpen={isGuiaOpen}
        onClose={() => setIsGuiaOpen(false)}
        data={GUIA_AGENDAMENTOS_CONTABEIS}
      />
    </AppShell>
  );
};

export default Agendamentos;
