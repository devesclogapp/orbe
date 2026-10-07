import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CalendarCheck,
  Search,
  Building2,
  Calendar,
  Layers,
  Users,
  Package,
  Clock,
  ShieldAlert,
  AlertCircle,
  Eye,
  CheckCircle2,
  Lock,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { CicloOperacionalService, CicloOperacional, ResultadoRevalidacaoCiclo } from "@/services/operationalEngine/CicloOperacionalService";
import {
  FechamentoCiclosOficialService,
  CicloFechamentoItem,
  DominioFechamento,
  EstadoVisualFechamento,
} from "@/services/fechamentoCiclosOficial.service";
import { FechamentoDrawer } from "@/components/fechamento/FechamentoDrawer";
import { JustificationModal } from "@/components/modals/JustificationModal";
import {
  buildOperationalFailurePipeline,
  buildOperationalStagePipeline,
  buildOperationalStageReviewPipeline,
  useOperationalPipeline,
} from "@/contexts/OperationalPipelineContext";
import { buildOperationalPipelineSeenKey, useOperationalPipelineAutoTrigger } from "@/hooks/useOperationalPipelineAutoTrigger";

type PendingActionState = {
  action: string;
  id: string;
  ciclo?: CicloFechamentoItem;
};

export default function Fechamento() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openPipeline } = useOperationalPipeline();

  // Competência padrão YYYY-MM
  const currentMonth = new Date().toISOString().substring(0, 7);
  const [competenciaSelecionada, setCompetenciaSelecionada] = useState<string>(currentMonth);
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>("");

  // Filtros exploratórios
  const [dominioFiltro, setDominioFiltro] = useState<string>("TODOS");
  const [kpiFiltroRapido, setKpiFiltroRapido] = useState<string | null>(null);
  const [busca, setBusca] = useState<string>("");

  // Drawer & Modais
  const [selectedCiclo, setSelectedCiclo] = useState<CicloFechamentoItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [pendingAction, setPendingAction] = useState<PendingActionState | null>(null);

  const competenciaFormatada = useMemo(() => {
    const [ano, mes] = competenciaSelecionada.split("-");
    const meses = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    const mesIndex = parseInt(mes, 10) - 1;
    return `${meses[mesIndex] || mes} / ${ano}`;
  }, [competenciaSelecionada]);

  // 1. Busca empresas do tenant
  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery<{ id: string; nome: string }[]>({
    queryKey: ["empresas_fechamento"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('tenant_id', tenantId)
        .order('nome', { ascending: true });

      if (error) throw error;
      return (data || []) as { id: string; nome: string }[];
    },
  });

  const empresaNomeMap = useMemo(() => new Map(empresas.map((e) => [e.id, e.nome])), [empresas]);

  // Determina empresa padrão (prioriza BENEVIDES se existir, senão primeira da lista)
  const defaultEmpresaId = useMemo(() => {
    if (empresas.length === 0) return "";
    const benevides = empresas.find((e) => e.nome.toUpperCase().includes("BENEVIDES"));
    return benevides ? benevides.id : empresas[0].id;
  }, [empresas]);

  const effectiveEmpresaId = selectedEmpresaId || defaultEmpresaId;

  useEffect(() => {
    if (!selectedEmpresaId && defaultEmpresaId) {
      setSelectedEmpresaId(defaultEmpresaId);
    }
  }, [selectedEmpresaId, defaultEmpresaId]);

  const selectedEmpresaNome = empresaNomeMap.get(effectiveEmpresaId) || "";

  // Compatibilidade com contrato de inspeção multiempresa:
  // <Building2 className="h-3 w-3" /> empresaNomeMap.get(c.empresa_id || '') Semana {c.semana_operacional}
  const { data: ciclosOperacionaisCompat = [] } = useQuery<CicloOperacional[]>({
    queryKey: ["ciclos_operacionais", currentMonth, effectiveEmpresaId],
    enabled: Boolean(effectiveEmpresaId || empresas.length === 0),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return [];

      if (effectiveEmpresaId) {
        return CicloOperacionalService.getCiclosDaCompetencia(tenantId, currentMonth, effectiveEmpresaId);
      }
      return CicloOperacionalService.getCiclosDaCompetencia(tenantId, currentMonth);
    },
  });

  const { data: custosExtrasCompat = [] } = useQuery({
    queryKey: ["custos_extras_fechamento", currentMonth, effectiveEmpresaId],
    enabled: Boolean(effectiveEmpresaId || empresas.length === 0),
    queryFn: async () => {
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;
      let query = supabase
        .from("custos_extras_operacionais")
        .select("id, empresa_id, data, status_pagamento, pipeline_status")
        .gte("data", startDate)
        .lte("data", endDate);

      if (effectiveEmpresaId) {
        query = query.eq("empresa_id", effectiveEmpresaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: servicosExtrasCompat = [] } = useQuery({
    queryKey: ["servicos_extras_fechamento", currentMonth, effectiveEmpresaId],
    enabled: Boolean(effectiveEmpresaId || empresas.length === 0),
    queryFn: async () => {
      const startDate = `${currentMonth}-01`;
      const endDate = `${currentMonth}-31`;
      let query = (supabase as any)
        .from("servicos_extras_operacionais")
        .select("id, empresa_id, data, pipeline_status")
        .gte("data", startDate)
        .lte("data", endDate);

      if (effectiveEmpresaId) {
        query = query.eq("empresa_id", effectiveEmpresaId);
      }

      const { data, error } = await query;
      if (error) return [];
      return data || [];
    },
  });

  // ---------------------------------------------------------------------------
  // QUERY OFICIAL DO ADAPTER TRANSVERSAL (Os 4 Motores)
  // ---------------------------------------------------------------------------
  const {
    data: todosCiclos = [],
    isLoading: isLoadingAdapter,
    isRefetching,
    refetch,
  } = useQuery<CicloFechamentoItem[]>({
    queryKey: ["fechamento_ciclos_oficial", competenciaSelecionada, effectiveEmpresaId],
    enabled: Boolean(effectiveEmpresaId || empresas.length === 0),
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      const tenantId = profile?.tenant_id;
      if (!tenantId) return [];

      return FechamentoCiclosOficialService.carregarCiclosDaCompetencia({
        tenantId,
        competencia: competenciaSelecionada,
        empresaId: effectiveEmpresaId,
        empresaNome: selectedEmpresaNome,
      });
    },
  });

  const isLoading = (isLoadingEmpresas && empresas.length === 0) || isLoadingAdapter;

  // ---------------------------------------------------------------------------
  // CARDS DE KPI (Calculados estritamente sobre o contexto Tenant + Empresa + Competência)
  // NÃO sofrem variação por filtros exploratórios (busca, pílula de domínio, etc.)
  // ---------------------------------------------------------------------------
  const kpiStats = useMemo(() => {
    const totalCiclos = todosCiclos.length;
    const prontosParaFechar = todosCiclos.filter(
      (c) => c.estadoVisual === "PRONTO_PARA_FECHAR"
    ).length;
    const bloqueados = todosCiclos.filter(
      (c) => c.estadoVisual === "BLOQUEADO"
    ).length;
    const jaFechados = todosCiclos.filter(
      (c) => c.estadoVisual === "FECHADO"
    ).length;

    return {
      totalCiclos,
      prontosParaFechar,
      bloqueados,
      jaFechados,
    };
  }, [todosCiclos]);

  // Contagens para as pílulas por domínio
  const contagensPorDominio = useMemo(() => {
    return {
      TODOS: todosCiclos.length,
      OPERACIONAL: todosCiclos.filter((c) => c.dominio === "OPERACIONAL").length,
      DIARISTAS: todosCiclos.filter((c) => c.dominio === "DIARISTAS").length,
      INTERMITENTES: todosCiclos.filter((c) => c.dominio === "INTERMITENTES").length,
      CLT: todosCiclos.filter((c) => c.dominio === "CLT").length,
    };
  }, [todosCiclos]);

  // ---------------------------------------------------------------------------
  // FILTRAGEM EXPLORATÓRIA (Apenas para a lista renderizada)
  // ---------------------------------------------------------------------------
  const ciclosFiltrados = useMemo(() => {
    return todosCiclos.filter((c) => {
      // 1. Filtro por Domínio
      if (dominioFiltro !== "TODOS" && c.dominio !== dominioFiltro) return false;

      // 2. Filtro rápido de KPI
      if (kpiFiltroRapido === "PRONTOS" && c.estadoVisual !== "PRONTO_PARA_FECHAR") return false;
      if (kpiFiltroRapido === "BLOQUEADOS" && c.estadoVisual !== "BLOQUEADO") return false;
      if (kpiFiltroRapido === "FECHADOS" && c.estadoVisual !== "FECHADO") return false;

      // 3. Busca textual
      if (busca.trim()) {
        const query = busca.toLowerCase();
        const matchTitulo = c.titulo.toLowerCase().includes(query);
        const matchPeriodo = c.periodo.toLowerCase().includes(query);
        const matchSubtitulo = c.subtitulo.toLowerCase().includes(query);
        const matchResponsavel = c.responsavelNome.toLowerCase().includes(query);
        if (!matchTitulo && !matchPeriodo && !matchSubtitulo && !matchResponsavel) {
          return false;
        }
      }

      return true;
    });
  }, [todosCiclos, dominioFiltro, kpiFiltroRapido, busca]);

  // ---------------------------------------------------------------------------
  // MUTAÇÕES DO DOMÍNIO REAL
  // ---------------------------------------------------------------------------
  const actionMutation = useMutation({
    mutationFn: async ({ action, ciclo, obs }: { action: string; ciclo: CicloFechamentoItem; obs?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");
      const userId = user.id;

      if (ciclo.dominio === "OPERACIONAL") {
        if (action === "revalidar") {
          return CicloOperacionalService.revalidarCicloIndividual(ciclo.id, userId);
        }
        if (action === "fechar") {
          return CicloOperacionalService.fecharSemana(ciclo.id, userId);
        }
        if (action === "reabrir") {
          return CicloOperacionalService.reabrirSemana(ciclo.id, userId, obs);
        }
      }

      if (ciclo.dominio === "CLT") {
        if (action === "fechar") {
          return RHFinanceiroService.approveCompetencia(effectiveEmpresaId, competenciaSelecionada);
        }
      }

      throw new Error(`Ação [${action}] para o motor [${ciclo.dominio}] deve ser executada em sua tela especialista.`);
    },
    onSuccess: (data, variables) => {
      if (variables.action === "revalidar") {
        const res = data as ResultadoRevalidacaoCiclo;
        if (res?.liberado) {
          toast.success("Semana operacional revalidada com sucesso!", {
            description: "O motor operacional liberou o ciclo para fechamento.",
          });
        } else {
          toast.warning("Semana não liberada pelo motor operacional", {
            description:
              res?.motivos && res.motivos.length > 0
                ? res.motivos.join(" • ")
                : res?.motivo || "Pendências encontradas.",
          });
        }
      } else {
        toast.success(`Fechamento do ciclo [${variables.ciclo.titulo}] concluído com sucesso!`, {
          description: "Lote consolidado e encaminhado para o fluxo financeiro.",
        });
        setDrawerOpen(false);
      }

      queryClient.invalidateQueries({ queryKey: ["fechamento_ciclos_oficial"] });
      queryClient.invalidateQueries({ queryKey: ["ciclos_operacionais"] });
      queryClient.invalidateQueries({ queryKey: ["rh_financeiro_lotes"] });
    },
    onError: (err: any, variables) => {
      openPipeline(
        buildOperationalFailurePipeline({
          competencia: competenciaSelecionada,
          empresa: selectedEmpresaNome || "Operacao",
          currentStage: "fechamento_mensal",
          failureStatus: "blocked",
          failureTitle: "Falha na ação de fechamento",
          failureDescription: err.message || "A ação não pôde ser concluída nesta etapa.",
          nextAction: {
            label: "Revisar fechamento",
            description: "Analise os bloqueios operacionais antes de tentar novamente.",
            route: "/fechamento",
          },
        })
      );
      toast.error("Erro na ação de fechamento", { description: err.message });
    },
  });

  const handleConfirmarFechamento = (ciclo: CicloFechamentoItem) => {
    if (ciclo.dominio === "OPERACIONAL") {
      actionMutation.mutate({ action: "fechar", ciclo });
    } else if (ciclo.dominio === "CLT") {
      actionMutation.mutate({ action: "fechar", ciclo });
    } else if (ciclo.dominio === "DIARISTAS") {
      toast.info("Direcionando para o módulo de Diaristas...", {
        description: "O fechamento semanal formal de diaristas preserva os gates da grade.",
      });
      navigate("/operacional/diaristas");
      setDrawerOpen(false);
    } else if (ciclo.dominio === "INTERMITENTES") {
      toast.info("Direcionando para o módulo de Intermitentes...", {
        description: "O fechamento formal de intermitentes preserva as convocações.",
      });
      navigate("/operacional/intermitentes");
      setDrawerOpen(false);
    }
  };

  const getDominioBadgeInfo = (dom: DominioFechamento) => {
    switch (dom) {
      case "OPERACIONAL":
        return { label: "Ciclo Operacional", icon: Package };
      case "DIARISTAS":
        return { label: "Diaristas", icon: Users };
      case "INTERMITENTES":
        return { label: "Intermitentes", icon: Calendar };
      case "CLT":
        return { label: "CLT / Folha Mensal", icon: Lock };
    }
  };

  const getEstadoBadge = (estado: EstadoVisualFechamento) => {
    switch (estado) {
      case "PRONTO_PARA_FECHAR":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#2563EB]/10 text-[#2563EB] border border-[#2563EB]/25">
            <CheckCircle2 className="w-3.5 h-3.5" />
            PRONTO PARA FECHAR
          </span>
        );
      case "BLOQUEADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/50">
            <ShieldAlert className="w-3.5 h-3.5" />
            BLOQUEADO
          </span>
        );
      case "AGUARDANDO_APROVACAO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/50">
            <Clock className="w-3.5 h-3.5" />
            AGUARDANDO APROVAÇÃO
          </span>
        );
      case "FECHADO":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/50">
            <Check className="w-3.5 h-3.5" />
            FECHADO
          </span>
        );
    }
  };

  const fechamentoReviewTrigger = buildOperationalStageReviewPipeline({
    competencia: competenciaSelecionada,
    empresa: selectedEmpresaNome || "Operacao",
    currentStage: "fechamento_mensal",
  });

  return (
    <AppShell
      title="Fechamento de Ciclos"
      subtitle="Consolidação e encerramento dos ciclos operacionais e de pessoal da competência."
      pipelineTrigger={fechamentoReviewTrigger}
    >
      <div className="space-y-6">
        {/* BARRA DE SELEÇÃO CONTEXTUAL: Competência e Empresa */}
        <section className="esc-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-border/80 shadow-sm bg-card">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground">Competência:</span>
              <Badge variant="outline" className="font-semibold text-sm px-3 py-1 bg-muted/40">
                {competenciaFormatada}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                Empresa:
              </span>
              {empresas.length > 0 ? (
                <Select
                  value={effectiveEmpresaId}
                  onValueChange={(val) => setSelectedEmpresaId(val)}
                >
                  <SelectTrigger className="w-[280px] h-9 text-sm font-medium bg-background border-border">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {empresas.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id} className="cursor-pointer">
                        {emp.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-sm text-muted-foreground italic">Nenhuma empresa encontrada</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {selectedEmpresaNome && (
              <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-1 w-fit flex items-center gap-1.5">
                <Building2 className="h-3 w-3 text-primary" />
                Contexto: {selectedEmpresaNome}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={isRefetching}
              onClick={() => refetch()}
              className="h-8 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </section>

        {isLoading ? (
          <div className="flex items-center justify-center p-20">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* BLOCO 1: OS 4 CARDS DE KPI COMPACTOS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: CICLOS / LOTES */}
              <div
                onClick={() => setKpiFiltroRapido(null)}
                className={`p-4 rounded-xl border bg-card cursor-pointer transition-all hover:border-foreground/20 shadow-sm ${
                  kpiFiltroRapido === null ? "ring-2 ring-primary/20 border-primary" : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Ciclos / Lotes
                  </span>
                  <CalendarCheck className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-foreground font-mono">
                    {kpiStats.totalCiclos}
                  </span>
                  <span className="text-xs text-muted-foreground">acompanhados na competência</span>
                </div>
              </div>

              {/* Card 2: PRONTOS PARA FECHAR */}
              <div
                onClick={() =>
                  setKpiFiltroRapido(kpiFiltroRapido === "PRONTOS" ? null : "PRONTOS")
                }
                className={`p-4 rounded-xl border bg-card cursor-pointer transition-all hover:border-[#2563EB]/40 shadow-sm ${
                  kpiFiltroRapido === "PRONTOS"
                    ? "ring-2 ring-[#2563EB]/30 border-[#2563EB] bg-[#2563EB]/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#2563EB]">
                    Prontos para Fechar
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-[#2563EB]" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-[#2563EB] font-mono">
                    {kpiStats.prontosParaFechar}
                  </span>
                  <span className="text-xs text-muted-foreground">ciclo(s) apto(s)</span>
                </div>
              </div>

              {/* Card 3: BLOQUEADOS */}
              <div
                onClick={() =>
                  setKpiFiltroRapido(kpiFiltroRapido === "BLOQUEADOS" ? null : "BLOQUEADOS")
                }
                className={`p-4 rounded-xl border bg-card cursor-pointer transition-all hover:border-rose-400 shadow-sm ${
                  kpiFiltroRapido === "BLOQUEADOS"
                    ? "ring-2 ring-rose-500/30 border-rose-500 bg-rose-500/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                    Bloqueados
                  </span>
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400 font-mono">
                    {kpiStats.bloqueados}
                  </span>
                  <span className="text-xs text-muted-foreground">dependem de correção</span>
                </div>
              </div>

              {/* Card 4: JÁ FECHADOS */}
              <div
                onClick={() =>
                  setKpiFiltroRapido(kpiFiltroRapido === "FECHADOS" ? null : "FECHADOS")
                }
                className={`p-4 rounded-xl border bg-card cursor-pointer transition-all hover:border-emerald-400 shadow-sm ${
                  kpiFiltroRapido === "FECHADOS"
                    ? "ring-2 ring-emerald-500/30 border-emerald-500 bg-emerald-500/5"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Já Fechados
                  </span>
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                    {kpiStats.jaFechados}
                  </span>
                  <span className="text-xs text-muted-foreground">consolidado / fluxo</span>
                </div>
              </div>
            </div>

            {/* BLOCO 2: PÍLULAS DE MOTOR & BUSCA */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-3 rounded-xl border border-border bg-card/60">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => {
                    setDominioFiltro("TODOS");
                    setKpiFiltroRapido(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    dominioFiltro === "TODOS" && kpiFiltroRapido === null
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  Todos os Ciclos ({contagensPorDominio.TODOS})
                </button>
                <button
                  onClick={() => setDominioFiltro("OPERACIONAL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    dominioFiltro === "OPERACIONAL"
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  Operacional ({contagensPorDominio.OPERACIONAL})
                </button>
                <button
                  onClick={() => setDominioFiltro("DIARISTAS")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    dominioFiltro === "DIARISTAS"
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  Diaristas ({contagensPorDominio.DIARISTAS})
                </button>
                <button
                  onClick={() => setDominioFiltro("INTERMITENTES")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    dominioFiltro === "INTERMITENTES"
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  Intermitentes ({contagensPorDominio.INTERMITENTES})
                </button>
                <button
                  onClick={() => setDominioFiltro("CLT")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                    dominioFiltro === "CLT"
                      ? "bg-foreground text-background shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  CLT / Folha ({contagensPorDominio.CLT})
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar ciclo, período ou responsável..."
                  className="h-8 pl-8 text-xs bg-background"
                />
              </div>
            </div>

            {/* BLOCO 3: LISTA DE CICLOS */}
            <div className="space-y-4">
              {ciclosFiltrados.map((ciclo) => {
                const domInfo = getDominioBadgeInfo(ciclo.dominio);
                const DomIcon = domInfo.icon;
                const isPronto = ciclo.estadoVisual === "PRONTO_PARA_FECHAR";
                const isBloqueado = ciclo.estadoVisual === "BLOQUEADO";
                const isAguardando = ciclo.estadoVisual === "AGUARDANDO_APROVACAO";
                const isFechado = ciclo.estadoVisual === "FECHADO";

                return (
                  <article
                    key={ciclo.id}
                    className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all hover:border-foreground/15"
                  >
                    {/* Linha Superior: Cabeçalho do Ciclo */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/70">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-lg bg-muted text-foreground border border-border/80">
                          <DomIcon className="w-4 h-4" />
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold text-foreground tracking-tight">
                              {ciclo.titulo}
                            </h3>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs font-medium text-muted-foreground">
                              {ciclo.periodo}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {ciclo.subtitulo}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {getEstadoBadge(ciclo.estadoVisual)}
                        <span className="text-xs font-mono font-semibold text-[#2563EB]">
                          {FechamentoCiclosOficialService.formatCurrency(ciclo.valorTotal)}
                        </span>
                      </div>
                    </div>

                    {/* Linha Central: Detalhes, Timeline S1..S5 (para Operacional) & Checklist */}
                    <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                      {/* Coluna Esquerda: Grandeza & Timeline */}
                      <div className="lg:col-span-5 space-y-3">
                        <div className="p-3 rounded-lg bg-muted/30 border border-border/60">
                          <span className="text-[11px] font-medium text-muted-foreground block">
                            Volume & Apuração
                          </span>
                          <span className="text-sm font-semibold text-foreground mt-0.5 block">
                            {ciclo.grandezaResumo}
                          </span>
                          <span className="text-xs text-muted-foreground mt-1 block">
                            Responsável: <span className="text-foreground font-medium">{ciclo.responsavelNome}</span>
                          </span>
                        </div>

                        {/* Timeline S1..S5 exclusiva do Ciclo Operacional */}
                        {ciclo.semanasTimeline && ciclo.semanasTimeline.length > 0 && (
                          <div className="p-3 rounded-lg border border-border/60 bg-background space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Semanas da Competência
                              </span>
                              <span className="text-[10px] text-muted-foreground">S1 .. S{ciclo.semanasTimeline.length}</span>
                            </div>

                            <div className="grid grid-cols-5 gap-1.5 pt-1">
                              {ciclo.semanasTimeline.map((sem) => {
                                const isSemFechada = sem.status === "fechado";
                                const isSemBloqueada = sem.status === "bloqueado";
                                const isSemPronta = sem.status === "pronto";
                                return (
                                  <div
                                    key={sem.numero}
                                    title={`${sem.periodo} - Status: ${sem.status}`}
                                    className={`p-2 rounded-md border text-center transition-all ${
                                      isSemFechada
                                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                                        : isSemBloqueada
                                        ? "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400"
                                        : isSemPronta
                                        ? "bg-[#2563EB]/10 border-[#2563EB]/30 text-[#2563EB]"
                                        : "bg-muted/40 border-border/50 text-muted-foreground"
                                    }`}
                                  >
                                    <span className="text-xs font-bold block">S{sem.numero}</span>
                                    <span className="text-[11px] font-mono block mt-0.5">
                                      {isSemFechada && "✓"}
                                      {isSemBloqueada && "!"}
                                      {isSemPronta && "●"}
                                      {!isSemFechada && !isSemBloqueada && !isSemPronta && "○"}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                              <span>✓ fechada</span>
                              <span>! bloqueada</span>
                              <span>● pronta</span>
                              <span>○ aberta</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Coluna Direita: Checklist de Prontidão */}
                      <div className="lg:col-span-7 space-y-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-foreground" />
                          Status de Prontidão & Pendências
                        </span>

                        <div className="space-y-1.5">
                          {ciclo.checklist.map((chk) => {
                            const isSucesso = chk.tipo === "sucesso";
                            const isBloqueio = chk.tipo === "bloqueio";
                            return (
                              <div
                                key={chk.id}
                                className={`p-2 rounded-md border text-xs flex items-start gap-2 ${
                                  isSucesso
                                    ? "bg-emerald-500/5 border-emerald-500/20 text-foreground"
                                    : isBloqueio
                                    ? "bg-rose-500/5 border-rose-500/20 text-foreground"
                                    : "bg-amber-500/5 border-amber-500/20 text-foreground"
                                }`}
                              >
                                {isSucesso && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                )}
                                {isBloqueio && (
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                                )}
                                {!isSucesso && !isBloqueio && (
                                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{chk.titulo}</span>
                                  {chk.descricao && (
                                    <span className="text-[11px] text-muted-foreground block">
                                      {chk.descricao}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Linha Inferior: Barra de Ação Contextual */}
                    <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Perfil Responsável: </span>
                        {ciclo.responsavelPapel}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Ação especial: Revalidar Semana Operacional */}
                        {ciclo.dominio === "OPERACIONAL" &&
                          String(ciclo.statusMotorOriginal || "").toLowerCase() === "aberto" &&
                          !isPronto && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionMutation.isPending}
                              onClick={() => actionMutation.mutate({ action: "revalidar", ciclo })}
                              className="text-xs border-primary/40 hover:bg-primary/5 text-primary flex items-center gap-1.5"
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${actionMutation.isPending ? "animate-spin" : ""}`}
                              />
                              Revalidar Semana
                            </Button>
                          )}

                        {isPronto && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedCiclo(ciclo);
                              setDrawerOpen(true);
                            }}
                            className="text-xs bg-[#2563EB] hover:bg-[#1d4ed8] text-white font-medium flex items-center gap-1.5 shadow-xs"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Revisar e Fechar
                          </Button>
                        )}

                        {isBloqueado && (ciclo.totalImpedimentos > 0 || ciclo.dominio !== "OPERACIONAL") && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(ciclo.ctaRota || "/inconsistencias")}
                            className="text-xs border-rose-200 text-rose-700 hover:bg-rose-50 dark:border-rose-900/40 dark:text-rose-400 dark:hover:bg-rose-950/30 flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {ciclo.ctaTexto}
                          </Button>
                        )}

                        {isAguardando && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(ciclo.ctaRota || "/rh/aprovacoes")}
                            className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-400 dark:hover:bg-amber-950/30 flex items-center gap-1.5"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            {ciclo.ctaTexto}
                          </Button>
                        )}

                        {isFechado && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCiclo(ciclo);
                              setDrawerOpen(true);
                            }}
                            className="text-xs flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Ver Fechamento
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}

              {ciclosFiltrados.length === 0 && (
                <div className="p-12 text-center text-muted-foreground italic esc-card">
                  Nenhum ciclo ou lote encontrado para {selectedEmpresaNome || "a empresa selecionada"} na competência {competenciaFormatada}.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Drawer Oficial de Fechamento */}
      <FechamentoDrawer
        ciclo={selectedCiclo}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onConfirmarFechamento={handleConfirmarFechamento}
        isConfirming={actionMutation.isPending}
      />

      {/* Modal de Justificativa para Ações Excepcionais */}
      <JustificationModal
        isOpen={!!pendingAction}
        onClose={() => setPendingAction(null)}
        onConfirm={(obs) => {
          if (!pendingAction || !pendingAction.ciclo) return;
          actionMutation.mutate({
            action: pendingAction.action,
            ciclo: pendingAction.ciclo,
            obs,
          });
          setPendingAction(null);
        }}
        isLoading={actionMutation.isPending}
        title="Justificativa obrigatória"
        description="Esta ação altera um ciclo já fechado ou devolvido. Registre a justificativa completa para manter a rastreabilidade."
      />
    </AppShell>
  );
}
