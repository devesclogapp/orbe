import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck,
  Lock,
  Unlock,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  AlertTriangle,
  Layers,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { RHFinanceiroService } from "@/services/rhFinanceiro.service";
import { toast } from "sonner";
import {
  buildOperationalFailurePipeline,
  buildOperationalStagePipeline,
  useOperationalPipeline,
} from "@/contexts/OperationalPipelineContext";
import {
  FechamentoMensalCltAdapter,
  EmpresaFechamentoClt,
} from "@/services/adapters/fechamentoMensalCltAdapter";
import { FechamentoDrawer } from "@/components/fechamento/FechamentoDrawer";
import { CicloFechamentoItem } from "@/services/fechamentoCiclosOficial.service";
import { OrbeKpiCard } from "@/components/ux-lab/design-system";

const StatusBadge = ({
  label,
  status,
  type,
}: {
  label: string;
  status?: string | boolean | null;
  type: string;
}) => {
  const safeStatus = String(status || "pendente");
  let color = "bg-secondary text-secondary-foreground border border-border";
  let Icon = Clock;

  const normalized = safeStatus.toLowerCase();

  if (
    normalized === "pendente" ||
    normalized === "aberto" ||
    normalized === "em_aberto"
  ) {
    color = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
    Icon = Clock;
  } else if (
    normalized === "fechado" ||
    normalized === "true" ||
    normalized === "validado" ||
    normalized === "liberado" ||
    normalized === "concluido" ||
    normalized === "pago"
  ) {
    color = "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
    Icon = CheckCircle2;
  } else if (
    normalized === "rejeitado" ||
    normalized === "inconsistente" ||
    normalized === "false" ||
    normalized === "devolvido" ||
    normalized === "bloqueado"
  ) {
    color = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
    Icon = XCircle;
  } else if (
    normalized === "aguardando_financeiro" ||
    normalized === "em_analise_financeira" ||
    normalized === "aguardando_pagamento"
  ) {
    color = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20";
    Icon = Clock;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
        {label}
      </span>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold w-fit",
          color
        )}
      >
        <Icon className="h-3 w-3" />
        {safeStatus.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
      </span>
    </div>
  );
};

const FechamentoMensalCLT = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openPipeline } = useOperationalPipeline();

  // 1. Estado Temporal e de Contexto
  const currentMonthDefault = new Date().toISOString().substring(0, 7);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>(currentMonthDefault);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("all");
  const [selectedEmpresaWorkspaceId, setSelectedEmpresaWorkspaceId] = useState<string | null>(null);

  // 2. Drawer Contextual de Fechamento Oficial
  const [selectedCiclo, setSelectedCiclo] = useState<CicloFechamentoItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Lista de competências formatadas para o dropdown
  const competenciasDisponiveis = useMemo(() => {
    return FechamentoMensalCltAdapter.getCompetenciasDisponiveis();
  }, []);

  // 3. Query: Lista de Empresas do Tenant Ativo
  const { data: companies = [], isLoading: loadingCompanies } = useQuery<EmpresaFechamentoClt[]>({
    queryKey: ["fechamento_empresas"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return [];

      const { data: list, error } = await supabase
        .from("empresas")
        .select("id, nome")
        .eq("tenant_id", tenantId)
        .order("nome", { ascending: true });

      if (error) throw error;
      return (list || []) as EmpresaFechamentoClt[];
    },
  });

  // 4. Query: Validações de RH / Domínio por Empresa
  const {
    data: validations = [],
    isLoading: loadingValidations,
    isRefetching: refetchingValidations,
    refetch: refetchValidations,
  } = useQuery({
    queryKey: [
      "fechamento_validations",
      competenciaSelecionada,
      companies.map((c) => c.id).join(","),
    ],
    enabled: companies.length > 0,
    queryFn: async () => {
      const results = [];
      for (const empresa of companies) {
        try {
          const val = await RHFinanceiroService.validateCompetenciaApproval(
            empresa.id,
            competenciaSelecionada
          );

          // Filtra empresas vazias sem pontos e sem pendências para evitar ruído na tela
          const isEmpty = val.impedimentos.includes(
            "Nenhum registro processado foi encontrado para a competencia selecionada."
          );

          if (
            !isEmpty ||
            val.resumo.pendenciasCadastrais > 0 ||
            val.resumo.bloqueiosCriticos > 0
          ) {
            results.push(val);
          }
        } catch (e) {
          console.error(`Erro validando ${empresa.nome}:`, e);
        }
      }
      return results;
    },
  });

  // 5. Query: Lotes Atuais em rh_financeiro_lotes para a Competência
  const { data: lotesAtuais = [] } = useQuery({
    queryKey: ["fechamento_lotes", competenciaSelecionada],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from("rh_financeiro_lotes")
        .select("id, empresa_id, status, origem, tipo, total_colaboradores, valor_total, aprovado_em, aprovado_por")
        .eq("tenant_id", tenantId)
        .eq("competencia", competenciaSelecionada)
        .eq("origem", "RH");

      if (error) throw error;
      return data || [];
    },
  });

  // 6. Mutação Oficial de Homologação / Fechamento de Competência
  const actionMutation = useMutation({
    mutationFn: async ({ empresaId }: { empresaId: string }) => {
      return RHFinanceiroService.approveCompetencia(empresaId, competenciaSelecionada);
    },
    onSuccess: (data, variables) => {
      toast.success(`Fechamento concluído: ${data.totalItens} itens gerados.`);
      queryClient.invalidateQueries({ queryKey: ["fechamento_validations"] });
      queryClient.invalidateQueries({ queryKey: ["fechamento_lotes"] });

      const empNome = companies.find((c) => c.id === variables.empresaId)?.nome || "Operação";

      openPipeline(
        buildOperationalStagePipeline({
          competencia: competenciaSelecionada,
          empresa: empNome,
          completedStage: "fechamento_mensal",
        })
      );

      setDrawerOpen(false);
      setSelectedCiclo(null);
    },
    onError: (err: any) => {
      toast.error("Impossível fechar a competência", { description: err.message });

      openPipeline(
        buildOperationalFailurePipeline({
          competencia: competenciaSelecionada,
          empresa: "Operação",
          currentStage: "fechamento_mensal",
          failureStatus: "blocked",
          failureTitle: "Inconsistências impeditivas",
          failureDescription: err.message || "Existem fatores bloqueando o fechamento.",
          nextAction: {
            label: "Entendi",
            description: "Analise os bloqueios listados e corrija-os na central respectiva.",
            route: "/banco-horas/fechamento",
          },
        })
      );
    },
  });

  // Helpers de Status do Lote
  const getLoteStatus = (empresaId: string) => {
    const lote = lotesAtuais.find((l: any) => l.empresa_id === empresaId);
    return lote?.status || "pendente";
  };

  const isLoteLocked = (empresaId: string) => {
    const s = String(getLoteStatus(empresaId)).toUpperCase();
    return [
      "AGUARDANDO_FINANCEIRO",
      "EM_ANALISE_FINANCEIRA",
      "EM_PROCESSAMENTO",
      "AGUARDANDO_PAGAMENTO",
      "CONCLUIDO",
      "PAGO",
    ].includes(s);
  };

  // 7. KPIs Consolidados via Adapter Oficial
  const kpiStats = useMemo(() => {
    return FechamentoMensalCltAdapter.calcularKpis(validations, lotesAtuais);
  }, [validations, lotesAtuais]);

  // 8. Lista Filtrada por Empresa
  const validationsFiltradas = useMemo(() => {
    if (selectedEmpresaId === "all") return validations;
    return validations.filter((v: any) => v.empresaId === selectedEmpresaId);
  }, [validations, selectedEmpresaId]);

  // Empresa Ativa no Workspace de Diagnóstico (Coluna Direita)
  const selectedValidation = useMemo(() => {
    if (!validationsFiltradas.length) return null;
    if (selectedEmpresaWorkspaceId) {
      const found = validationsFiltradas.find((v: any) => v.empresaId === selectedEmpresaWorkspaceId);
      if (found) return found;
    }
    return validationsFiltradas[0];
  }, [validationsFiltradas, selectedEmpresaWorkspaceId]);

  // Handler para abrir o Drawer Contextual de uma Empresa
  const handleAbrirDrawer = (v: any) => {
    const ciclo = FechamentoMensalCltAdapter.toCicloFechamentoItem({
      validation: v,
      lotes: lotesAtuais,
      competencia: competenciaSelecionada,
    });
    setSelectedCiclo(ciclo);
    setDrawerOpen(true);
  };

  // Handler de confirmação no Drawer
  const handleConfirmarFechamentoNoDrawer = (ciclo: CicloFechamentoItem) => {
    actionMutation.mutate({ empresaId: ciclo.empresaId });
  };

  // 9. Referência do Container da Lista (CONV-15-FIX05)
  const listContainerRef = useRef<HTMLDivElement>(null);

  const isLoading = loadingCompanies || (companies.length > 0 && loadingValidations);

  return (
    <AppShell
      title="Fechamento Mensal CLT"
      subtitle={`Workspace operacional de apuração, diagnóstico de bloqueios e homologação de competência: ${FechamentoMensalCltAdapter.formatCompetencia(
        competenciaSelecionada
      )}`}
    >
      <div className="flex flex-col gap-3.5 lg:h-[calc(100dvh-104px)] min-h-0">
        {/* Barra de Filtros de Contexto (Padrão Oficial de Fechamento de Ciclos) */}
        <section className="bg-card border border-border rounded-xl p-3.5 sm:p-4 shadow-xs shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* Seletor de Competência Mensal */}
              <div className="flex flex-col gap-1.5 min-w-[200px]">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Competência Mensal
                </label>
                <Select
                  value={competenciaSelecionada}
                  onValueChange={(val) => setCompetenciaSelecionada(val)}
                >
                  <SelectTrigger className="h-9 bg-background border-border text-foreground font-medium">
                    <SelectValue placeholder="Selecione o mês" />
                  </SelectTrigger>
                  <SelectContent>
                    {competenciasDisponiveis.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Seletor de Empresa */}
              <div className="flex flex-col gap-1.5 min-w-[240px]">
                <label className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                  Unidade / Empresa
                </label>
                <Select
                  value={selectedEmpresaId}
                  onValueChange={(val) => setSelectedEmpresaId(val)}
                >
                  <SelectTrigger className="h-9 bg-background border-border text-foreground font-medium">
                    <SelectValue placeholder="Todas as Unidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as Empresas (Consolidado)</SelectItem>
                    {companies.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Ações da Barra */}
            <div className="flex items-center gap-2 self-end md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchValidations()}
                disabled={refetchingValidations}
                className="h-9 gap-1.5 text-xs font-medium"
              >
                <RefreshCw
                  className={cn("h-3.5 w-3.5", refetchingValidations && "animate-spin")}
                />
                Atualizar
              </Button>
            </div>
          </div>
        </section>

        {/* Síntese Executiva Superior — 4 Indicadores Oficiais Compactos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
          <OrbeKpiCard
            label="Unidades em Apuração"
            value={kpiStats.totalEmpresas}
            subValue="Com atividade no período"
            icon={Building2}
            status="neutral"
          />
          <OrbeKpiCard
            label="Prontas para Homologar"
            value={kpiStats.prontosParaFechar}
            subValue="Zero bloqueios impeditivos"
            icon={CheckCircle2}
            status={kpiStats.prontosParaFechar > 0 ? "success" : "neutral"}
          />
          <OrbeKpiCard
            label="Bloqueios Críticos"
            value={kpiStats.bloqueiosCriticos}
            subValue="Ocorrências impeditivas"
            icon={ShieldAlert}
            status={kpiStats.bloqueiosCriticos > 0 ? "danger" : "neutral"}
          />
          <OrbeKpiCard
            label="Lotes Liberados"
            value={kpiStats.lotesLiberados}
            subValue="Encaminhados ao Financeiro"
            icon={Lock}
            status={kpiStats.lotesLiberados > 0 ? "info" : "neutral"}
          />
        </div>

        {/* Workspace Operacional 50/50 */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-20 gap-3 bg-card border border-border rounded-xl">
            <Loader2 className="h-9 w-9 animate-spin text-primary" />
            <span className="text-sm font-medium text-muted-foreground">
              Auditando prontidão e consistência das unidades CLT...
            </span>
          </div>
        ) : validationsFiltradas.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground italic bg-card border border-border rounded-xl">
            Nenhuma empresa encontrada com movimento ou pendências para a competência{" "}
            {FechamentoMensalCltAdapter.formatCompetencia(competenciaSelecionada)}.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch flex-1 min-h-0 pb-1">
            {/* COLUNA ESQUERDA: Empresas em Apuração (50%) */}
            <section className="flex flex-col gap-2 min-h-0 h-full">
              <div className="flex items-center justify-between pb-1 shrink-0">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Empresas em Apuração
                  </h2>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {validationsFiltradas.length}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Selecione para diagnosticar
                </span>
              </div>

              {/* Região com Scroll Vertical Independente e Contenção Rigorosa ao Viewport (CONV-15-FIX05) */}
              <div
                data-testid="empresas-scroll-container"
                ref={listContainerRef}
                className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-2.5 pr-1.5 max-h-[420px] lg:max-h-none"
              >
                {validationsFiltradas.map((v: any) => {
                  const isSelected = selectedValidation?.empresaId === v.empresaId;
                  const hasErrors = (v.impedimentos || []).length > 0;
                  const statusLote = getLoteStatus(v.empresaId);
                  const isFechado = ["PAGO", "CONCLUIDO"].includes(statusLote.toUpperCase());
                  const isAguardando = [
                    "AGUARDANDO_FINANCEIRO",
                    "EM_ANALISE_FINANCEIRA",
                  ].includes(statusLote.toUpperCase());

                  return (
                    <article
                      key={v.empresaId}
                      onClick={() => setSelectedEmpresaWorkspaceId(v.empresaId)}
                      role="button"
                      tabIndex={0}
                      className={cn(
                        "p-3 rounded-xl border transition-all text-left cursor-pointer flex flex-col gap-1.5 select-none",
                        isSelected
                          ? "border-[#2563EB] bg-blue-50/40 dark:bg-blue-950/20 shadow-xs border-l-4 border-l-[#2563EB]"
                          : "border-border bg-card hover:bg-muted/30 hover:border-border/80"
                      )}
                    >
                      {/* Linha Superior: Nome da Empresa + Indicador Compacto Único */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                              isSelected
                                ? "bg-[#2563EB]/15 text-[#2563EB]"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Building2 className="h-3.5 w-3.5" />
                          </div>
                          <span className="font-semibold text-sm text-foreground truncate">
                            {v.empresaNome || "Empresa"}
                          </span>
                        </div>

                        {/* Indicador Compacto Único (Sem Duplicidade de Badges Vermelhos) */}
                        {hasErrors ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50 shrink-0">
                            <AlertTriangle className="h-3 w-3" />
                            {v.resumo.bloqueiosCriticos} impedimento{v.resumo.bloqueiosCriticos > 1 ? "s" : ""}
                          </span>
                        ) : isFechado ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Fechado
                          </span>
                        ) : isAguardando ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50 shrink-0">
                            <Clock className="h-3 w-3" />
                            Aguardando aprovação
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-[#2563EB] border border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/50 shrink-0">
                            <CheckCircle2 className="h-3 w-3" />
                            Pronto para fechar
                          </span>
                        )}
                      </div>

                      {/* Linha Inferior: Competência + Realce de Seleção */}
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                        <span className="text-muted-foreground text-[11px]">
                          Competência: {FechamentoMensalCltAdapter.formatCompetencia(v.competencia)}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-semibold text-[#2563EB] flex items-center gap-0.5">
                            Ativa para diagnóstico →
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* COLUNA DIREITA: Diagnóstico da Empresa Selecionada (50%) - Contenção Simétrica (CONV-15-FIX05) */}
            <section className="flex flex-col gap-2 min-h-0 h-full">
              <div className="flex items-center justify-between pb-1 shrink-0">
                <div className="flex items-center gap-2">
                  <CalendarCheck className="h-4 w-4 text-[#2563EB]" />
                  <h2 className="text-sm font-semibold text-foreground">
                    Diagnóstico da Empresa
                  </h2>
                </div>
                {selectedValidation && (
                  <span className="text-[11px] font-medium text-muted-foreground truncate max-w-[220px]">
                    {selectedValidation.empresaNome}
                  </span>
                )}
              </div>

              {selectedValidation ? (() => {
                const v = selectedValidation;
                const hasErrors = (v.impedimentos || []).length > 0;
                const statusLote = getLoteStatus(v.empresaId);
                const isLocked = isLoteLocked(v.empresaId);
                const isFechado = ["PAGO", "CONCLUIDO"].includes(statusLote.toUpperCase());
                const isAguardando = [
                  "AGUARDANDO_FINANCEIRO",
                  "EM_ANALISE_FINANCEIRA",
                ].includes(statusLote.toUpperCase());

                let estadoBadgeText = "PRONTO PARA FECHAR";
                let estadoBadgeClass =
                  "bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25";
                let EstadoIcon = CheckCircle2;

                if (isFechado) {
                  estadoBadgeText = "FECHADO";
                  estadoBadgeClass =
                    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20";
                  EstadoIcon = CheckCircle2;
                } else if (isAguardando) {
                  estadoBadgeText = "AGUARDANDO APROVAÇÃO";
                  estadoBadgeClass =
                    "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20";
                  EstadoIcon = Clock;
                } else if (hasErrors) {
                  estadoBadgeText = "BLOQUEADO";
                  estadoBadgeClass =
                    "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20";
                  EstadoIcon = ShieldAlert;
                }

                return (
                  <article className="flex-1 min-h-0 overflow-y-auto bg-card border border-border rounded-xl p-4 sm:p-5 shadow-xs flex flex-col gap-4">
                    {/* 1. Identificação */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
                      <div>
                        <h3 className="font-display font-semibold text-base text-foreground">
                          {v.empresaNome || "Empresa"}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Competência: {FechamentoMensalCltAdapter.formatCompetencia(v.competencia)}
                        </p>
                      </div>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold tracking-wide w-fit shrink-0",
                          estadoBadgeClass
                        )}
                      >
                        <EstadoIcon className="w-3.5 h-3.5" />
                        {estadoBadgeText}
                      </span>
                    </div>

                    {/* 2. Situação Operacional */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
                        Situação Operacional
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block truncate">
                            Cadastros Pendentes
                          </span>
                          <div
                            className={cn(
                              "font-display font-semibold text-lg mt-0.5",
                              v.resumo.pendenciasCadastrais > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-foreground"
                            )}
                          >
                            {v.resumo.pendenciasCadastrais}
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {v.resumo.pendenciasCadastrais > 0
                              ? "Complemento pendente"
                              : "Cadastros íntegros"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block truncate">
                            Inconsistências Ponto
                          </span>
                          <div
                            className={cn(
                              "font-display font-semibold text-lg mt-0.5",
                              v.resumo.inconsistenciasAbertas > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-foreground"
                            )}
                          >
                            {v.resumo.inconsistenciasAbertas}
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            {v.resumo.inconsistenciasAbertas > 0
                              ? "Apontamentos com erro"
                              : "Pontos regularizados"}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block truncate">
                            Folha Variável / HE
                          </span>
                          <div className="font-display font-semibold text-lg mt-0.5 text-foreground">
                            {v.resumo.financeiroPrevisto?.variaveis || 0}
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            Eventos monetizados
                          </span>
                        </div>

                        <div className="p-2.5 rounded-lg bg-muted/20 border border-border/50">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block truncate">
                            Banco de Horas
                          </span>
                          <div className="font-display font-semibold text-lg mt-0.5 text-foreground">
                            {v.resumo.financeiroPrevisto?.bancoHoras || 0}
                          </div>
                          <span className="text-[10px] text-muted-foreground block truncate">
                            Reflexos monetizados
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Impedimentos Objetivos */}
                    <div className="rounded-lg border border-border bg-card p-3.5 space-y-2.5 shrink-0">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          {hasErrors ? (
                            <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" />
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-emerald-600 shrink-0" />
                          )}
                          Impedimentos Identificados ({v.impedimentos.length})
                        </span>

                        {/* Destinos de Resolução Contextuais */}
                        <div className="flex items-center gap-1.5">
                          {v.resumo.pendenciasCadastrais > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/cadastros?from=fechamento-clt")}
                              className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Central de Cadastros ({v.resumo.pendenciasCadastrais})
                            </Button>
                          )}
                          {v.resumo.inconsistenciasAbertas > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate("/inconsistencias")}
                              className="h-7 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Central de Inconsistências
                            </Button>
                          )}
                        </div>
                      </div>

                      {hasErrors ? (
                        <ul className="space-y-1.5 pt-1 max-h-[140px] overflow-y-auto pr-1">
                          {v.impedimentos.map((item: string, idx: number) => (
                            <li
                              key={`${v.empresaId}-blocker-${idx}`}
                              className="text-xs text-muted-foreground flex items-start gap-2"
                            >
                              <span className="text-rose-600 dark:text-rose-400 font-bold shrink-0">
                                •
                              </span>
                              <span className="leading-relaxed">{item}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 pt-1">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>
                            Nenhum impedimento impeditivo. Unidade apta para revisão e liberação.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 4. Próxima Ação & Governança */}
                    <div className="pt-2 border-t border-border flex flex-col gap-3 shrink-0 mt-auto">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          {isLocked ? (
                            <Lock className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Unlock className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          {isLocked
                            ? "Competência trancada. Lotes encaminhados ao financeiro."
                            : "Competência sob apuração operacional e cadastral."}
                        </span>
                        <span className="font-mono text-[11px]">
                          Lote: {statusLote}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAbrirDrawer(v)}
                          className="h-9 text-xs font-medium gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Ver Detalhes do Fechamento
                        </Button>

                        <Button
                          size="sm"
                          disabled={hasErrors || actionMutation.isPending || isLocked}
                          onClick={() => handleAbrirDrawer(v)}
                          variant={isLocked ? "secondary" : "default"}
                          className={cn(
                            "h-9 text-xs font-medium",
                            !hasErrors &&
                              !isLocked &&
                              "bg-[#2563EB] hover:bg-[#1d4ed8] text-white"
                          )}
                        >
                          {actionMutation.isPending
                            ? "Processando..."
                            : isLocked
                            ? "Liberado (Financeiro)"
                            : hasErrors
                            ? "Bloqueado por Pendências"
                            : "Revisar e Liberar Competência →"}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })() : (
                <div className="p-8 text-center text-muted-foreground italic bg-card border border-border rounded-xl">
                  Selecione uma empresa na lista ao lado para visualizar o diagnóstico.
                </div>
              )}
            </section>
          </div>
        )}

        {/* Drawer Contextual Oficial de Fechamento (Compatível com UX Lab) */}
        <FechamentoDrawer
          ciclo={selectedCiclo}
          open={drawerOpen}
          onOpenChange={(v) => {
            setDrawerOpen(v);
            if (!v) setSelectedCiclo(null);
          }}
          onConfirmarFechamento={handleConfirmarFechamentoNoDrawer}
          isConfirming={actionMutation.isPending}
        />
      </div>
    </AppShell>
  );
};

export default FechamentoMensalCLT;
