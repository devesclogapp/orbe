import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ContabilOficialService, ContabilLogItem } from "@/services/contabilOficial.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { formatBRL } from "@/services/adapters/relatoriosOficialAdapter";
import {
  CheckCircle2,
  XCircle,
  Terminal,
  FileSpreadsheet,
  Calendar,
  Building2,
  ExternalLink,
  RefreshCw,
  Hash,
  ShieldCheck,
  Search,
  Filter,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  User,
  AlertTriangle,
  Lock,
  X,
  HelpCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AppShell } from "@/components/layout/AppShell";
import { FerramentasContabeisMenu } from "@/pages/Relatorios/components/FerramentasContabeisMenu";
import { GuiaUsoDrawer } from "@/pages/Relatorios/components/GuiaUsoDrawer";
import { GUIA_LOGS_INTEGRACAO } from "@/pages/Relatorios/components/guiasContabeisData";
import { useContadorScope } from "@/hooks/useContadorScope";

interface LogsIntegracaoProps {
  empresaId?: string;
  competencia?: string;
  isEmbedded?: boolean;
}

const ITEMS_PER_PAGE = 10;

const LogsIntegracao: React.FC<LogsIntegracaoProps> = ({
  empresaId: propEmpresaId,
  competencia: propCompetencia,
  isEmbedded = false,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, isAdmin } = useAccessControl();
  const { isContador, filterEmpresas, validateOrFallbackEmpresaId, empresasAutorizadasIds } = useContadorScope();

  const isStandalone = !isEmbedded && propEmpresaId === undefined;

  const isAuthorized = useMemo(() => {
    if (isAdmin) return true;
    const normalized = (role || "").toLowerCase();
    return normalized === "admin" || normalized === "financeiro" || normalized === "contador";
  }, [role, isAdmin]);

  const paramEmpresaId = searchParams.get("empresa_id") || "";
  const paramCompetencia = searchParams.get("competencia") || "";

  // Filtros de busca
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>(
    propEmpresaId || paramEmpresaId || "TODAS"
  );
  const [selectedCompetencia, setSelectedCompetencia] = useState<string>(
    propCompetencia || paramCompetencia || ""
  );
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedLog, setSelectedLog] = useState<ContabilLogItem | null>(null);
  const [isGuiaOpen, setIsGuiaOpen] = useState(false);

  // Carregar lista de empresas para filtro
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas_logs_integracao"],
    queryFn: async () => {
      const data = await EmpresaService.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  const availableEmpresas = useMemo(() => {
    return filterEmpresas(empresas);
  }, [empresas, filterEmpresas]);

  // Query dos logs oficiais reais do Supabase (contabil_logs_integracao)
  const queryEmpresaId = selectedEmpresaId === "TODAS" ? undefined : selectedEmpresaId;
  const queryCompetencia = selectedCompetencia.trim() ? selectedCompetencia.trim() : undefined;

  const {
    data: rawLogs = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["accounting_logs", queryEmpresaId, queryCompetencia],
    queryFn: () => ContabilOficialService.getLogs(queryEmpresaId, queryCompetencia),
    enabled: isAuthorized,
  });

  // Aplicar filtros locais: Período, Status, Busca textual
  const filteredLogs = useMemo(() => {
    return rawLogs.filter((log) => {
      // Isolamento estrito Contador
      if (isContador && empresasAutorizadasIds.length > 0) {
        if (log.empresa_id && !empresasAutorizadasIds.includes(log.empresa_id)) return false;
      }

      // Filtro Status
      if (statusFilter !== "TODOS") {
        if (statusFilter === "SUCESSO" && log.status !== "sucesso") return false;
        if (statusFilter === "FALHA" && log.status === "sucesso") return false;
      }

      // Filtro Período (Data)
      if (dataInicio) {
        const logDate = new Date(log.execucao_data).toISOString().split("T")[0];
        if (logDate < dataInicio) return false;
      }
      if (dataFim) {
        const logDate = new Date(log.execucao_data).toISOString().split("T")[0];
        if (logDate > dataFim) return false;
      }

      // Busca por texto
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchEmpresa = log.empresa_nome?.toLowerCase().includes(term);
        const matchArquivo = log.arquivo_nome?.toLowerCase().includes(term);
        const matchUser = log.solicitante?.toLowerCase().includes(term);
        const matchHash = log.content_hash?.toLowerCase().includes(term);
        const matchTipo = log.tipo_envio?.toLowerCase().includes(term);
        if (!matchEmpresa && !matchArquivo && !matchUser && !matchHash && !matchTipo) {
          return false;
        }
      }

      return true;
    });
  }, [rawLogs, statusFilter, dataInicio, dataFim, searchTerm]);

  // Paginação determinística
  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLogs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLogs, currentPage]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleClearFilters = () => {
    setSelectedEmpresaId("TODAS");
    setSelectedCompetencia("");
    setStatusFilter("TODOS");
    setDataInicio("");
    setDataFim("");
    setSearchTerm("");
    setCurrentPage(1);
    if (isStandalone) {
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  };

  // Métricas dinâmicas reais
  const totalExecucoes = filteredLogs.length;
  const totalSucessos = filteredLogs.filter((l) => l.status === "sucesso").length;
  const totalFalhas = totalExecucoes - totalSucessos;
  const totalValorMovimentado = filteredLogs.reduce(
    (acc, curr) => acc + (curr.total_valor || 0),
    0
  );
  const totalLancamentos = filteredLogs.reduce(
    (acc, curr) => acc + (curr.total_lancamentos || 0),
    0
  );

  const backUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedEmpresaId && selectedEmpresaId !== "TODAS") {
      params.set("empresa_id", selectedEmpresaId);
    }
    if (selectedCompetencia) {
      params.set("competencia", selectedCompetencia);
    }
    const qs = params.toString();
    if (isContador) {
      return `/relatorios/integracao${qs ? `?${qs}` : ""}`;
    }
    return `/relatorios${qs ? `?${qs}` : ""}`;
  }, [selectedEmpresaId, selectedCompetencia]);

  if (!isAuthorized) {
    const unauthorizedCard = (
      <div className="p-8 max-w-2xl mx-auto border border-border rounded-xl bg-card text-center space-y-4 my-12 shadow-xs">
        <Lock className="h-12 w-12 text-destructive mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Acesso Restrito aos Logs de Integração</h3>
        <p className="text-sm text-muted-foreground">
          A auditoria de logs e históricos contábeis é restrita aos perfis Administrativo e Financeiro.
        </p>
        <Button variant="outline" size="sm" onClick={() => navigate(isContador ? "/relatorios/integracao" : "/relatorios")}>
          {isContador ? "Voltar para Integração Contábil" : "Voltar para Central de Relatórios"}
        </Button>
      </div>
    );

    if (isStandalone) {
      return (
        <AppShell
          title="Logs de Integração Contábil"
          subtitle="Auditoria determinística e rastreabilidade dos lotes contábeis gravados no Supabase"
          backPath={backUrl}
        >
          {unauthorizedCard}
        </AppShell>
      );
    }

    return unauthorizedCard;
  }

  const renderContent = () => (
    <div className="space-y-4">
      {/* Cards de Métricas Reais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Total de Registros
          </div>
          <div className="text-2xl font-black text-foreground">{totalExecucoes}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totalSucessos} com sucesso
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Lançamentos Gravados
          </div>
          <div className="text-2xl font-black text-foreground">{totalLancamentos}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Partidas dobradas</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Volume Movimentado
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatBRL(totalValorMovimentado)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">Lotes filtrados</div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card">
          <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
            Falhas / Erros
          </div>
          <div
            className={`text-2xl font-black ${
              totalFalhas > 0 ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {totalFalhas}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {totalFalhas === 0 ? "100% de integridade" : "Requer atenção"}
          </div>
        </div>
      </div>

      {/* Barra de Filtros Completos */}
      <div className="p-4 rounded-xl border border-border bg-card space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-border text-xs font-semibold text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-primary" />
            <span>Filtros de Auditoria</span>
          </div>
          {(selectedEmpresaId !== "TODAS" ||
            selectedCompetencia ||
            statusFilter !== "TODOS" ||
            dataInicio ||
            dataFim ||
            searchTerm) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="h-6 text-[11px] text-muted-foreground hover:text-foreground gap-1"
            >
              <X className="h-3 w-3" />
              Limpar Filtros
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Empresa */}
          <div>
            <label className="text-[11px] font-bold text-foreground block mb-1">Empresa</label>
            <Select
              value={selectedEmpresaId}
              onValueChange={(val) => {
                setSelectedEmpresaId(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8.5 text-xs">
                <Building2 className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Todas as Empresas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as Empresas</SelectItem>
                {availableEmpresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Competência */}
          <div>
            <label className="text-[11px] font-bold text-foreground block mb-1">Competência (AAAA-MM)</label>
            <Input
              placeholder="Ex: 2026-09"
              value={selectedCompetencia}
              onChange={(e) => {
                setSelectedCompetencia(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 text-xs font-mono"
            />
          </div>

          {/* Status */}
          <div>
            <label className="text-[11px] font-bold text-foreground block mb-1">Status</label>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8.5 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos os Status</SelectItem>
                <SelectItem value="SUCESSO">Apenas Sucesso</SelectItem>
                <SelectItem value="FALHA">Apenas Falhas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Período De */}
          <div>
            <label className="text-[11px] font-bold text-foreground block mb-1">De (Data)</label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 text-xs"
            />
          </div>

          {/* Período Até */}
          <div>
            <label className="text-[11px] font-bold text-foreground block mb-1">Até (Data)</label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8.5 text-xs"
            />
          </div>
        </div>

        {/* Busca por texto */}
        <div className="relative pt-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome do arquivo, solicitante, tipo de envio ou hash..."
            className="pl-8.5 h-8.5 text-xs"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      {/* Tabela de Eventos */}
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-xs">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-bold text-sm text-foreground">Registro de Lotes e Exportações</h3>
          </div>
          <div className="text-xs text-muted-foreground">
            {totalItems} {totalItems === 1 ? "registro encontrado" : "registros encontrados"}
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead className="w-[16%]">Data / Horário</TableHead>
              <TableHead className="w-[20%]">Empresa</TableHead>
              <TableHead className="w-[10%]">Competência</TableHead>
              <TableHead className="w-[14%]">Operação</TableHead>
              <TableHead className="w-[14%]">Usuário</TableHead>
              <TableHead className="w-[12%] text-right">Valor Total</TableHead>
              <TableHead className="w-[8%] text-center">Resultado</TableHead>
              <TableHead className="w-[6%] text-right pr-4">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8} className="h-12 animate-pulse bg-muted/20" />
                </TableRow>
              ))
            ) : paginatedLogs.length > 0 ? (
              paginatedLogs.map((log) => {
                const dataFormatada = new Date(log.execucao_data);
                const hasError = log.status !== "sucesso" || !!log.erro_detalhe;

                return (
                  <TableRow key={log.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold text-xs text-foreground">
                          {dataFormatada.toLocaleDateString("pt-BR")}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {dataFormatada.toLocaleTimeString("pt-BR")}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span
                          className="text-xs font-semibold text-foreground truncate max-w-[180px]"
                          title={log.empresa_nome}
                        >
                          {log.empresa_nome}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                        {log.competencia}
                      </span>
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs font-medium text-foreground">
                          {log.tipo_envio}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground truncate max-w-[130px]">
                          {log.sistema_destino}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate max-w-[140px]" title={log.solicitante}>
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{log.solicitante || "Sistema"}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex flex-col items-end">
                        <span className="font-mono text-xs font-bold text-foreground">
                          {formatBRL(log.total_valor || 0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {log.total_lancamentos} part.
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-center">
                      {!hasError ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 font-normal"
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />
                          Sucesso
                        </Badge>
                      ) : (
                        <Badge
                          variant="destructive"
                          className="text-[10px] font-normal"
                          title={log.erro_detalhe || "Falha na integração"}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Falha
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right pr-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => setSelectedLog(log)}
                      >
                        Detalhes
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-36 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground space-y-2">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm font-medium text-foreground">
                      Nenhum registro de log encontrado
                    </p>
                    <p className="text-xs max-w-sm">
                      Nenhuma exportação ou lote contábil corresponde aos critérios e filtros informados.
                    </p>
                    {(selectedEmpresaId !== "TODAS" ||
                      selectedCompetencia ||
                      statusFilter !== "TODOS" ||
                      dataInicio ||
                      dataFim ||
                      searchTerm) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClearFilters}
                        className="mt-2 h-7 text-xs"
                      >
                        Limpar Filtros
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/10">
            <div>
              Mostrando {Math.min(totalItems, (currentPage - 1) * ITEMS_PER_PAGE + 1)} até{" "}
              {Math.min(totalItems, currentPage * ITEMS_PER_PAGE)} de {totalItems} registros
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
              >
                <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                Anterior
              </Button>
              <span className="font-semibold text-foreground px-1">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
              >
                Próximo
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Lote */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog?.status === "sucesso" ? (
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-destructive" />
              )}
              Detalhes do Lote Contábil Exportado
            </DialogTitle>
            <DialogDescription>
              Registro determinístico de auditoria gravado em <code>contabil_logs_integracao</code>
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">ID do Registro:</span>
                  <span
                    className="font-mono font-bold text-foreground text-[11px] truncate block"
                    title={selectedLog.id}
                  >
                    {selectedLog.id}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Data / Horário:</span>
                  <span className="font-medium text-foreground">
                    {new Date(selectedLog.execucao_data).toLocaleString("pt-BR")}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Empresa:</span>
                  <span className="font-bold text-foreground">{selectedLog.empresa_nome}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Competência:</span>
                  <span className="font-mono font-bold text-foreground">
                    {selectedLog.competencia}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Total Lançamentos:</span>
                  <span className="font-bold text-foreground">
                    {selectedLog.total_lancamentos}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Valor Consolidado:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatBRL(selectedLog.total_valor || 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Solicitante / Usuário:</span>
                  <span className="font-medium text-foreground">
                    {selectedLog.solicitante || "Sistema"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Status:</span>
                  <span className="font-bold uppercase text-foreground">
                    {selectedLog.status}
                  </span>
                </div>
              </div>

              {selectedLog.erro_detalhe && (
                <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive space-y-1">
                  <span className="font-bold text-[11px] block">Detalhes do Erro Registrado:</span>
                  <p className="font-mono text-xs break-all">{selectedLog.erro_detalhe}</p>
                </div>
              )}

              {selectedLog.arquivo_nome && (
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-muted-foreground block text-[11px] mb-1">
                    Nome do Arquivo CSV:
                  </span>
                  <div className="font-mono text-xs font-semibold text-primary break-all">
                    {selectedLog.arquivo_nome}
                  </div>
                </div>
              )}

              {selectedLog.content_hash && (
                <div className="p-3 rounded-lg border border-border bg-card">
                  <span className="text-muted-foreground block text-[11px] mb-1">
                    Assinatura de Conteúdo (Hash):
                  </span>
                  <div className="font-mono text-xs text-muted-foreground flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{selectedLog.content_hash}</span>
                  </div>
                </div>
              )}

              <div>
                <span className="text-muted-foreground block text-[11px] mb-1">
                  Payload Técnico Gravado:
                </span>
                <pre className="p-3 rounded-lg bg-muted text-[10px] font-mono overflow-x-auto max-h-40 border border-border">
                  {JSON.stringify(selectedLog.payload || {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Guia de Uso Contextual (CONT-06) */}
      <GuiaUsoDrawer
        isOpen={isGuiaOpen}
        onClose={() => setIsGuiaOpen(false)}
        data={GUIA_LOGS_INTEGRACAO}
      />
    </div>
  );

  if (isStandalone) {
    return (
      <AppShell
        title="Logs de Integração Contábil"
        subtitle="Auditoria determinística e rastreabilidade dos lotes contábeis gravados no Supabase"
        backPath={backUrl}
      >
        <div className="space-y-4">
          {/* Barra de Comandos Superior */}
          <header className="rounded-xl border border-border/80 bg-card p-3 shadow-xs backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              {availableEmpresas.length > 0 && (
                <div className="w-64">
                  <Select
                    value={selectedEmpresaId}
                    onValueChange={(val) => {
                      setSelectedEmpresaId(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm bg-background/60 font-medium">
                      <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground" />
                      <SelectValue placeholder="Todas as Empresas" />
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

              {selectedCompetencia && (
                <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-mono bg-muted/40 border-border/60">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  Competência: {selectedCompetencia}
                </Badge>
              )}

              <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-normal bg-muted/40 border-border/60">
                <Terminal className="h-3.5 w-3.5 text-primary" />
                Auditoria de Lotes Supabase
              </Badge>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                empresaId={selectedEmpresaId === "TODAS" ? undefined : selectedEmpresaId}
                competencia={selectedCompetencia || undefined}
              />

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
            </div>
          </header>

          {renderContent()}
        </div>
      </AppShell>
    );
  }

  return (
    <div className="space-y-4">
      {renderContent()}
    </div>
  );
};

export default LogsIntegracao;
