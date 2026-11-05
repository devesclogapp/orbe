import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ContabilOficialService,
  PreviaContabilConsolidada,
  ContabilLogItem,
} from "@/services/contabilOficial.service";
import { EmpresaService } from "@/services/base.service";
import { useAccessControl } from "@/contexts/AccessControlContext";
import { useAuth } from "@/contexts/AuthContext";
import { formatBRL } from "@/services/adapters/relatoriosOficialAdapter";

import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Download,
  AlertTriangle,
  FileSpreadsheet,
  Lock,
  Layers,
  ArrowRightLeft,
  History,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  Hash,
  AlertCircle,
  Clock,
  Filter,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { GUIA_INTEGRACAO_CONTABIL } from "@/pages/Relatorios/components/guiasContabeisData";

import MapeamentoContabil from "./MapeamentoContabil";
import LogsIntegracao from "./LogsIntegracao";
import { useContadorScope } from "@/hooks/useContadorScope";

interface IntegracaoContabilProps {
  onNavigateTab?: (tab: string) => void;
}

const IntegracaoContabil: React.FC<IntegracaoContabilProps> = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { role, isAdmin } = useAccessControl();

  const [isGuiaOpen, setIsGuiaOpen] = useState(false);

  // Controle de Abas
  const activeTab = searchParams.get("tab") || "previa";
  const setActiveTab = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  // Governança Contábil (CONT-07)
  const { isContador, filterEmpresas, validateOrFallbackEmpresaId } = useContadorScope();

  // Carregar lista de empresas cadastradas
  const { data: rawEmpresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas_integracao_contabil"],
    queryFn: async () => {
      const data = await EmpresaService.getAll();
      return Array.isArray(data) ? data : [];
    },
  });

  // Empresas autorizadas (se contador, filtra rigorosamente as empresas autorizadas)
  const empresas = useMemo(() => filterEmpresas(rawEmpresas), [rawEmpresas, filterEmpresas]);

  // Empresa ativa: query param validada contra o escopo autorizado
  const paramEmpresaId = searchParams.get("empresa_id") || "";
  const activeEmpresaId = useMemo(() => {
    return validateOrFallbackEmpresaId(paramEmpresaId, empresas);
  }, [paramEmpresaId, empresas, validateOrFallbackEmpresaId]);

  const activeEmpresa = empresas.find((e) => e.id === activeEmpresaId);
  const activeEmpresaNome = activeEmpresa?.nome || "Empresa Homologada";

  // Competência ativa: query param > mês anterior padrão (YYYY-MM)
  const defaultCompetencia = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, "0");
    return `${yr}-${mo}`;
  }, []);

  const competencia = searchParams.get("competencia") || defaultCompetencia;

  // Lista de competências para seleção (últimos 12 meses)
  const competenciasOptions = useMemo(() => {
    const list: string[] = [];
    const base = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const yr = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      list.push(`${yr}-${mo}`);
    }
    return list;
  }, []);

  // Mudança de Empresa e Competência
  const handleEmpresaChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("empresa_id", val);
    setSearchParams(next, { replace: true });
  };

  const handleCompetenciaChange = (val: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("competencia", val);
    setSearchParams(next, { replace: true });
  };

  // RBAC: apenas admin e financeiro possuem autorização
  const isAuthorizedRole = useMemo(() => {
    if (isAdmin) return true;
    const normalized = (role || "").toLowerCase();
    return normalized === "admin" || normalized === "financeiro" || normalized === "contador";
  }, [role, isAdmin]);

  // Consulta de Prévia Contábil
  const {
    data: previa,
    isLoading: isLoadingPrevia,
    isFetching: isFetchingPrevia,
    refetch: refetchPrevia,
  } = useQuery<PreviaContabilConsolidada>({
    queryKey: ["contabil_previa", activeEmpresaId, competencia],
    queryFn: () =>
      ContabilOficialService.gerarPreviaContabil(
        activeEmpresaId,
        competencia,
        activeEmpresaNome
      ),
    enabled: !!activeEmpresaId && !!competencia && isAuthorizedRole,
  });

  // Estado do modal de confirmação de duplicidade
  const [duplicateWarning, setDuplicateWarning] = useState<{
    open: boolean;
    logAnterior?: ContabilLogItem;
  }>({ open: false });

  // Mutação para exportar CSV
  const exportMutation = useMutation({
    mutationFn: async (previaData: PreviaContabilConsolidada) => {
      return ContabilOficialService.exportarCSV(
        previaData,
        user?.email || "usuario_orbe"
      );
    },
    onSuccess: (res) => {
      toast.success(`Arquivo contábil gerado com sucesso: ${res.fileName}`);
      queryClient.invalidateQueries({ queryKey: ["accounting_logs"] });
      setDuplicateWarning({ open: false });
    },
    onError: (err: any) => {
      toast.error(`Falha ao exportar CSV: ${err.message || "Erro desconhecido"}`);
    },
  });

  // Gatilho de Exportação com checagem de duplicidade
  const handleTriggerExport = async () => {
    if (!previa) return;
    if (!previa.elegivel_exportacao) {
      toast.error(
        `Exportação bloqueada: ${previa.bloqueios.join(" | ")}`
      );
      return;
    }

    try {
      const dupCheck = await ContabilOficialService.verificarDuplicidadeExportacao(
        previa.empresa_id,
        previa.competencia,
        previa.content_hash
      );

      if (dupCheck.duplicado) {
        setDuplicateWarning({ open: true, logAnterior: dupCheck.logAnterior });
        return;
      }

      exportMutation.mutate(previa);
    } catch {
      exportMutation.mutate(previa);
    }
  };

  // Download de CSV de Prévia para conferência contábil (CONT-09)
  const handleDownloadPreviaCSV = () => {
    if (!previa) return;
    try {
      const res = ContabilOficialService.gerarCSVPrevia(previa);
      toast.success(`CSV de prévia gerado para conferência: ${res.fileName}`);
    } catch (err: any) {
      toast.error(`Falha ao gerar CSV de prévia: ${err?.message || "Erro desconhecido"}`);
    }
  };

  return (
    <AppShell
      title="Integração Contábil"
      subtitle="Apuração consolidada de partidas dobradas e exportação contábil oficial"
      backPath={isContador ? undefined : `/relatorios?empresa_id=${activeEmpresaId}&competencia=${competencia}`}
    >
      <div className="space-y-4 pb-16">
        {/* BARRA SUPERIOR DE COMANDOS */}
        <header className="rounded-xl border border-border/80 bg-card p-3 shadow-xs backdrop-blur flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Seletor de Empresa */}
            <div className="w-56">
              <Select
                value={activeEmpresaId}
                onValueChange={handleEmpresaChange}
                disabled={isLoadingEmpresas || empresas.length === 0}
              >
                <SelectTrigger className="h-9 text-sm bg-background/60 font-medium">
                  <Building2 className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Selecione a Empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {empresas.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id} className="text-sm">
                      {emp.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Seletor de Competência */}
            <div className="w-44">
              <Select value={competencia} onValueChange={handleCompetenciaChange}>
                <SelectTrigger className="h-9 text-sm bg-background/60 font-medium font-mono">
                  <Calendar className="h-4 w-4 mr-1.5 text-muted-foreground shrink-0" />
                  <SelectValue placeholder="Competência" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {competenciasOptions.map((c) => (
                    <SelectItem key={c} value={c} className="text-sm font-mono">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Perfil Ativo */}
            <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-normal bg-muted/40 border-border/60">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Perfil: <strong className="uppercase">{role || "Admin"}</strong>
            </Badge>

            <Badge variant="outline" className="h-9 text-xs gap-1.5 px-3 font-bold text-primary border-primary/30 bg-primary/5">
              Partidas Dobradas
            </Badge>
          </div>

          {/* Ações Globais */}
          {isAuthorizedRole && (
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
                empresaId={activeEmpresaId}
                competencia={competencia}
              />

              {/* Secundárias */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60"
                onClick={() => refetchPrevia()}
                disabled={isFetchingPrevia}
              >
                <RefreshCw className={`h-4 w-4 ${isFetchingPrevia ? "animate-spin" : ""}`} />
                <span>Atualizar</span>
              </Button>

              {/* Baixar CSV de Prévia (CONT-09) */}
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 gap-2 text-sm font-medium text-foreground border-border hover:bg-muted/60"
                onClick={handleDownloadPreviaCSV}
                disabled={isLoadingPrevia || !previa}
                title="Baixar CSV preliminar para conferência contábil (sem efeito oficial)"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Baixar CSV de Prévia</span>
              </Button>

              {/* Primária */}
              <Button
                size="sm"
                className="h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
                onClick={handleTriggerExport}
                disabled={exportMutation.isPending || isLoadingPrevia || !previa?.elegivel_exportacao}
              >
                {exportMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>{exportMutation.isPending ? "Exportando..." : "Exportar CSV Contábil"}</span>
              </Button>
            </div>
          )}
        </header>

        {/* Conteúdo Principal */}
        <div className="space-y-4">
          {/* Alerta de Governança se papel não for autorizado */}
          {!isAuthorizedRole && (
            <div className="p-6 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive space-y-3">
              <div className="flex items-center gap-2 font-bold text-base">
                <Lock className="h-5 w-5" />
                Acesso Restrito à Controladoria e Administração
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                O seu perfil de acesso atual (<strong>{role || "Usuário"}</strong>) não possui permissão para visualizar dados contábeis ou realizar a exportação oficial de partidas dobradas. Solicite acesso ao Administrador do ERP ORBE.
              </p>
            </div>
          )}

          {isAuthorizedRole && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted/60 p-1 border border-border/60">
              <TabsTrigger value="previa" className="text-xs font-semibold gap-2">
                <Activity className="h-3.5 w-3.5" />
                Conferência & Prévia Contábil
              </TabsTrigger>
              <TabsTrigger value="mapeamento" className="text-xs font-semibold gap-2">
                <ArrowRightLeft className="h-3.5 w-3.5" />
                Mapeamento De-Para
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs font-semibold gap-2">
                <History className="h-3.5 w-3.5" />
                Histórico & Logs
              </TabsTrigger>
            </TabsList>

            {/* ABA 1: CONFERÊNCIA & PRÉVIA */}
            <TabsContent value="previa" className="space-y-6 animate-in fade-in duration-300">
              {/* Barra de Status da Competência & Ação de Exportação */}
              <div className="p-5 rounded-xl border border-border bg-card shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
                      previa?.status_fechamento === "FECHADO_FINANCEIRO"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                    }`}
                  >
                    {previa?.status_fechamento === "FECHADO_FINANCEIRO" ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <Clock className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">
                        Situação da Competência: {competencia}
                      </span>
                      {isLoadingPrevia ? (
                        <Badge variant="outline" className="text-[10px] animate-pulse">
                          Verificando...
                        </Badge>
                      ) : previa?.status_fechamento === "FECHADO_FINANCEIRO" ? (
                        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-[10px]">
                          Fechamento Homologado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-[10px]">
                          Competência em Aberto
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {previa?.fechamento_detalhe || "Carregando situação operacional..."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bloqueios de Exportação (se houver) */}
              {previa && previa.bloqueios.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-300/40 bg-amber-500/5 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <div className="font-bold flex items-center gap-2 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    Impedimentos para a Exportação Definitiva
                  </div>
                  <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                    {previa.bloqueios.map((b, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {b}
                      </li>
                    ))}
                  </ul>
                  <div className="text-[11px] text-muted-foreground pt-1 italic flex flex-wrap items-center justify-between gap-2">
                    <span>A conferência preliminar permanece totalmente acessível na tabela abaixo.</span>
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0 text-amber-700 dark:text-amber-300 underline font-semibold text-xs"
                      onClick={handleDownloadPreviaCSV}
                    >
                      Baixar CSV de Prévia para conferência
                    </Button>
                  </div>
                </div>
              )}

              {/* KPIs de Conferência */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Lançamentos
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    {isLoadingPrevia ? "..." : previa?.total_lancamentos || 0}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Fatos financeiros apurados
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Total a Débito
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    {isLoadingPrevia ? "..." : formatBRL(previa?.total_debito || 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Aplicações de recursos
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Total a Crédito
                  </div>
                  <div className="text-2xl font-black text-foreground">
                    {isLoadingPrevia ? "..." : formatBRL(previa?.total_credito || 0)}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Origens de recursos
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-border bg-card">
                  <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                    Status de Mapeamento
                  </div>
                  <div className="flex items-center gap-2">
                    {isLoadingPrevia ? (
                      <span className="text-2xl font-black text-muted-foreground">...</span>
                    ) : !previa || (previa.total_lancamentos || 0) === 0 ? (
                      <span className="text-2xl font-black text-muted-foreground">
                        —
                      </span>
                    ) : (previa?.lancamentos_nao_mapeados || 0) === 0 ? (
                      <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                        100%
                      </span>
                    ) : (
                      <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                        {previa?.lancamentos_nao_mapeados} pendente(s)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {isLoadingPrevia
                      ? "Calculando cobertura..."
                      : !previa || (previa.total_lancamentos || 0) === 0
                      ? "Sem lançamentos na competência para apurar cobertura"
                      : (previa?.lancamentos_nao_mapeados || 0) === 0
                      ? "Todas as contas configuradas"
                      : "Exige configuração na aba De-Para"}
                  </div>
                </div>
              </div>

              {/* Tabela Analítica de Lançamentos em Partidas Dobradas */}
              <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
                <div className="px-5 py-3 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    <h3 className="font-bold text-sm text-foreground">
                      Lançamentos Contábeis da Competência (Prévia)
                    </h3>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Formato: Partidas Dobradas (Débito e Crédito)
                  </div>
                </div>

                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="w-[10%]">Data</TableHead>
                      <TableHead className="w-[14%]">Origem</TableHead>
                      <TableHead className="w-[14%]">Documento</TableHead>
                      <TableHead className="w-[24%]">Histórico</TableHead>
                      <TableHead className="w-[13%]">Conta Débito</TableHead>
                      <TableHead className="w-[13%]">Conta Crédito</TableHead>
                      <TableHead className="w-[12%] text-right pr-4">Valor (R$)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingPrevia ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={7} className="h-12 animate-pulse bg-muted/20" />
                        </TableRow>
                      ))
                    ) : previa && previa.lancamentos.length > 0 ? (
                      previa.lancamentos.map((lanc) => (
                        <TableRow
                          key={lanc.id}
                          className={`hover:bg-muted/30 transition-colors ${
                            !lanc.mapeado ? "bg-amber-50/30 dark:bg-amber-950/20" : ""
                          }`}
                        >
                          <TableCell className="font-mono text-xs font-semibold text-foreground">
                            <div>{lanc.data}</div>
                            {lanc.data_vencimento && lanc.data_vencimento !== lanc.data && (
                              <div className="text-[10px] text-muted-foreground font-normal">
                                Venc: {lanc.data_vencimento}
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                              {lanc.origem}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="font-mono text-xs font-bold text-primary truncate block" title={lanc.documento}>
                              {lanc.documento}
                            </span>
                          </TableCell>

                          <TableCell>
                            <span className="text-xs text-foreground truncate block max-w-xs" title={lanc.historico}>
                              {lanc.historico}
                            </span>
                          </TableCell>

                          <TableCell>
                            {lanc.conta_debito ? (
                              <div className="flex items-center gap-1 font-mono text-xs text-foreground">
                                <Hash className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate" title={lanc.conta_debito}>
                                  {lanc.conta_debito}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold italic">
                                Não configurada
                              </span>
                            )}
                          </TableCell>

                          <TableCell>
                            {lanc.conta_credito ? (
                              <div className="flex items-center gap-1 font-mono text-xs text-foreground">
                                <Hash className="h-3 w-3 text-primary shrink-0" />
                                <span className="truncate" title={lanc.conta_credito}>
                                  {lanc.conta_credito}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold italic">
                                Não configurada
                              </span>
                            )}
                          </TableCell>

                          <TableCell className="text-right font-mono font-bold text-xs pr-4">
                            {formatBRL(lanc.valor)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={7} className="h-40 text-center text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileSpreadsheet className="h-8 w-8 opacity-20" />
                            <p className="font-medium text-sm">
                              Nenhum lançamento financeiro apurado para a competência {competencia} na empresa {activeEmpresaNome}.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Verifique se os fechamentos de diaristas, faturamentos ou custos extras foram gerados na Central Operacional.
                            </p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            {/* ABA 2: MAPEAMENTO DE-PARA */}
            <TabsContent value="mapeamento" className="animate-in fade-in duration-300">
              <MapeamentoContabil
                isEmbedded
                empresaId={activeEmpresaId}
                empresaNome={activeEmpresaNome}
                competencia={competencia}
                onMapeamentoAtualizado={() => refetchPrevia()}
              />
            </TabsContent>

            {/* ABA 3: HISTÓRICO & LOGS */}
            <TabsContent value="logs" className="animate-in fade-in duration-300">
              <LogsIntegracao isEmbedded empresaId={activeEmpresaId} competencia={competencia} />
            </TabsContent>
          </Tabs>
        )}
        </div>
      </div>

      {/* Modal de Alerta de Duplicidade */}
      <Dialog
        open={duplicateWarning.open}
        onOpenChange={(open) => !open && setDuplicateWarning({ open: false })}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Alerta de Reexportação de Lote
            </DialogTitle>
            <DialogDescription>
              Esta competência já possui uma exportação idêntica registrada anteriormente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Foi identificada uma exportação anterior em{" "}
              <strong>
                {duplicateWarning.logAnterior?.execucao_data
                  ? new Date(duplicateWarning.logAnterior.execucao_data).toLocaleString("pt-BR")
                  : "data anterior"}
              </strong>{" "}
              contendo exatamente os mesmos lançamentos e valores para a empresa{" "}
              <strong>{activeEmpresaNome}</strong> ({competencia}).
            </p>
            <div className="p-3 rounded-lg border border-border bg-muted/30">
              <span className="text-[11px] text-muted-foreground block">Arquivo anterior:</span>
              <span className="font-mono text-xs font-semibold text-foreground">
                {duplicateWarning.logAnterior?.arquivo_nome || "Arquivo registrado"}
              </span>
            </div>
            <p className="text-muted-foreground">
              Deseja reexportar e registrar um novo histórico de lote no sistema?
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3.5 text-sm font-medium"
              onClick={() => setDuplicateWarning({ open: false })}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="h-9 px-4 gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              onClick={() => {
                if (previa) exportMutation.mutate(previa);
              }}
              disabled={exportMutation.isPending}
            >
              {exportMutation.isPending ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              <span>{exportMutation.isPending ? "Exportando..." : "Confirmar Reexportação"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Guia de Uso Contextual (CONT-06) */}
      <GuiaUsoDrawer
        isOpen={isGuiaOpen}
        onClose={() => setIsGuiaOpen(false)}
        data={GUIA_INTEGRACAO_CONTABIL}
      />
    </AppShell>
  );
};

export default IntegracaoContabil;
