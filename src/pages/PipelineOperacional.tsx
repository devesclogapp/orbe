import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Search,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { EmpresaService } from "@/services/domain/cadastros.service";
import {
  TorreOperacionalService,
  TorreData,
  TrilhaOperacional,
  EtapaOperacional,
  SituacaoEtapa,
} from "@/services/torreOperacional.service";
import { ExecutiveTorreDrawer } from "@/components/torre/ExecutiveTorreDrawer";

export default function PipelineOperacional() {
  const queryClient = useQueryClient();

  const [filterEmpresaId, setFilterEmpresaId] = useState<string>("all");
  const [filterCompetencia, setFilterCompetencia] = useState(
    new Date().toISOString().substring(0, 7)
  );
  const [filterTrilha, setFilterTrilha] = useState<"todas" | "trilha-receitas" | "trilha-custos">("todas");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStage, setSelectedStage] = useState<EtapaOperacional | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Consulta de empresas para o filtro canônico
  const { data: empresas = [], isLoading: isEmpresasLoading } = useQuery({
    queryKey: ["empresas-torre"],
    queryFn: () => EmpresaService.getAll(),
  });

  // Consulta principal da Torre Operacional (Zero Mock)
  const {
    data: torreData,
    isLoading: isTorreLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery<TorreData>({
    queryKey: ["torre-operacional-dados", filterCompetencia, filterEmpresaId],
    queryFn: () =>
      TorreOperacionalService.getTorreData(
        filterCompetencia,
        filterEmpresaId === "all" ? undefined : filterEmpresaId
      ),
  });

  const handleRefresh = () => {
    const t = toast.loading("Atualizando radar operacional...");
    refetch().then(() => {
      toast.success("Torre Operacional sincronizada com dados reais!", { id: t });
    });
  };

  const competenciaOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 6; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const value = date.toISOString().substring(0, 7);
      const label = format(date, "MMMM 'de' yyyy", { locale: ptBR });
      options.push({ value, label });
    }
    return options;
  }, []);

  const handleOpenStage = (stage: EtapaOperacional) => {
    setSelectedStage(stage);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setSelectedStage(null);
  };

  // Filtragem local por texto de busca nos nós exibidos
  const filteredTrilhaReceitas = useMemo(() => {
    if (!torreData?.trilhaReceitas) return null;
    if (filterTrilha === "trilha-custos") return null;
    if (!searchTerm.trim()) return torreData.trilhaReceitas;

    const q = searchTerm.toLowerCase();
    const etapas = torreData.trilhaReceitas.etapas.map((et) => {
      const matchEtapa =
        et.nome.toLowerCase().includes(q) ||
        et.subtitulo.toLowerCase().includes(q) ||
        et.responsavelSetorial.toLowerCase().includes(q);
      const matchedItens = et.itens.filter(
        (i) =>
          i.codigo.toLowerCase().includes(q) ||
          i.cliente.toLowerCase().includes(q) ||
          i.tipo.toLowerCase().includes(q)
      );
      if (matchEtapa || matchedItens.length > 0) {
        return et;
      }
      return { ...et, totalProcessos: 0, itens: [] };
    });

    return { ...torreData.trilhaReceitas, etapas };
  }, [torreData, filterTrilha, searchTerm]);

  const filteredTrilhaCustos = useMemo(() => {
    if (!torreData?.trilhaCustos) return null;
    if (filterTrilha === "trilha-receitas") return null;
    if (!searchTerm.trim()) return torreData.trilhaCustos;

    const q = searchTerm.toLowerCase();
    const etapas = torreData.trilhaCustos.etapas.map((et) => {
      const matchEtapa =
        et.nome.toLowerCase().includes(q) ||
        et.subtitulo.toLowerCase().includes(q) ||
        et.responsavelSetorial.toLowerCase().includes(q);
      const matchedItens = et.itens.filter(
        (i) =>
          i.codigo.toLowerCase().includes(q) ||
          i.cliente.toLowerCase().includes(q) ||
          i.tipo.toLowerCase().includes(q)
      );
      if (matchEtapa || matchedItens.length > 0) {
        return et;
      }
      return { ...et, totalProcessos: 0, itens: [] };
    });

    return { ...torreData.trilhaCustos, etapas };
  }, [torreData, filterTrilha, searchTerm]);

  const totalProcessosVisiveis = useMemo(() => {
    let count = 0;
    if (filteredTrilhaReceitas) {
      filteredTrilhaReceitas.etapas.forEach((e) => (count += e.totalProcessos));
    }
    if (filteredTrilhaCustos) {
      filteredTrilhaCustos.etapas.forEach((e) => (count += e.totalProcessos));
    }
    return count;
  }, [filteredTrilhaReceitas, filteredTrilhaCustos]);

  return (
    <AppShell
      title="Torre de Controle Operacional"
      subtitle="Monitoramento executivo de fluxos operacionais e despesas em tempo real"
    >
      <div className="space-y-6 max-w-[1700px] mx-auto pb-16 px-4 md:px-6">
        {/* ─── 1. BARRA DE CONTROLE & FILTROS CANÔNICOS ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 py-3.5 px-4 rounded-xl border border-border/70 bg-card dark:bg-[#111419] dark:border-white/[0.05] shadow-xs">
          <div className="flex flex-wrap items-center gap-3">
            {/* Empresa */}
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterEmpresaId}
                onChange={(e) => setFilterEmpresaId(e.target.value)}
                disabled={isEmpresasLoading}
                className="h-9 px-3 rounded-lg border border-border bg-card dark:bg-[#15191F] dark:border-white/[0.08] text-xs font-medium text-foreground cursor-pointer"
              >
                <option value="all">Todas as Empresas</option>
                {empresas.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nome}
                  </option>
                ))}
              </select>
            </div>

            {/* Competência */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterCompetencia}
                onChange={(e) => setFilterCompetencia(e.target.value)}
                className="h-9 px-3 rounded-lg border border-border bg-card dark:bg-[#15191F] dark:border-white/[0.08] text-xs font-medium text-foreground cursor-pointer"
              >
                {competenciaOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Filtro de Trilha */}
            <div className="flex items-center rounded-lg border border-border bg-muted/40 dark:bg-[#15191F] dark:border-white/[0.08] p-0.5">
              <button
                type="button"
                onClick={() => setFilterTrilha("todas")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  filterTrilha === "todas"
                    ? "bg-card dark:bg-[#1F242D] text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Todas as Trilhas
              </button>
              <button
                type="button"
                onClick={() => setFilterTrilha("trilha-receitas")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  filterTrilha === "trilha-receitas"
                    ? "bg-card dark:bg-[#1F242D] text-blue-600 dark:text-blue-400 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Trilha A · Receitas
              </button>
              <button
                type="button"
                onClick={() => setFilterTrilha("trilha-custos")}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                  filterTrilha === "trilha-custos"
                    ? "bg-card dark:bg-[#1F242D] text-purple-600 dark:text-purple-400 font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Trilha B · Custos
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
              <Input
                placeholder="Filtrar por etapa..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-9 pl-8 text-xs font-medium bg-card dark:bg-[#15191F] dark:border-white/[0.08]"
              />
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-9 gap-2 text-xs font-medium dark:border-white/[0.08]"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin text-primary")} />
            Sincronizar
          </Button>
        </div>

        {/* ─── 2. ESTADO DE ERRO ─── */}
        {isError && (
          <div className="flex items-center gap-4 p-4 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive">
            <AlertTriangle className="h-6 w-6 shrink-0" />
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Erro ao carregar dados da Torre Operacional</p>
              <p className="text-xs text-muted-foreground font-mono">{String(error)}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="ml-auto text-xs"
            >
              Tentar Novamente
            </Button>
          </div>
        )}

        {/* ─── 3. RADAR OPERACIONAL (4 INDICADORES FACTUAIS) ─── */}
        {isTorreLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : torreData ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Indicador 1: Aguardando Ação */}
            <div className="p-4 rounded-xl border border-border/80 bg-card dark:bg-[#111419] dark:border-white/[0.05] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Aguardando Ação</span>
                <Clock className="h-4 w-4 text-amber-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-display text-foreground">
                  {torreData.radar.aguardandoAcao}
                </span>
                <span className="text-[11px] text-muted-foreground">processos na fila</span>
              </div>
            </div>

            {/* Indicador 2: Maior Espera (Métrica Observacional) */}
            <div className="p-4 rounded-xl border border-border/80 bg-card dark:bg-[#111419] dark:border-white/[0.05] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Maior Espera</span>
                <Activity className="h-4 w-4 text-blue-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-display text-foreground">
                  {torreData.radar.maiorEspera}
                </span>
                <span className="text-[11px] text-muted-foreground">tempo máximo observado</span>
              </div>
            </div>

            {/* Indicador 3: Inconsistências Impeditivas */}
            <div className="p-4 rounded-xl border border-border/80 bg-card dark:bg-[#111419] dark:border-white/[0.05] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Inconsistências Impeditivas</span>
                <AlertTriangle className="h-4 w-4 text-rose-600" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-display text-destructive">
                  {torreData.radar.inconsistenciasImpeditivas}
                </span>
                <span className="text-[11px] text-muted-foreground">bloqueios detectados</span>
              </div>
            </div>

            {/* Indicador 4: Em Andamento Regular */}
            <div className="p-4 rounded-xl border border-border/80 bg-card dark:bg-[#111419] dark:border-white/[0.05] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Em Andamento Regular</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-display text-foreground">
                  {torreData.radar.emAndamento}
                </span>
                <span className="text-[11px] text-muted-foreground">processando normalmente</span>
              </div>
            </div>
          </div>
        ) : null}

        {/* ─── 4. SKELETON LOADING PARA AS TRILHAS ─── */}
        {isTorreLoading && (
          <div className="space-y-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        )}

        {/* ─── 5. EMPTY STATE CASO NENHUM PROCESSO ENCONTRADO ─── */}
        {!isTorreLoading && totalProcessosVisiveis === 0 && (
          <div className="p-12 text-center rounded-xl border border-dashed border-border bg-card/50 dark:bg-[#111419]/50 space-y-3">
            <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">
              Nenhum processo em andamento para esta competência e filtros selecionados.
            </p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Utilize os seletores de empresa e competência acima para navegar no histórico ou sincronize para verificar novas entradas.
            </p>
          </div>
        )}

        {/* ─── 6. TRILHA A: OPERAÇÕES & RECEITAS ─── */}
        {!isTorreLoading && filteredTrilhaReceitas && (
          <TrilhaContainer
            trilha={filteredTrilhaReceitas}
            onOpenStage={handleOpenStage}
          />
        )}

        {/* ─── 7. TRILHA B: MÃO DE OBRA & CUSTOS ─── */}
        {!isTorreLoading && filteredTrilhaCustos && (
          <TrilhaContainer
            trilha={filteredTrilhaCustos}
            onOpenStage={handleOpenStage}
          />
        )}
      </div>

      {/* ─── 8. DRAWER OFICIAL DA TORRE (DIAGNÓSTICO + DESPACHO) ─── */}
      <ExecutiveTorreDrawer
        stage={selectedStage}
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
      />
    </AppShell>
  );
}

// ─── COMPONENTE DA TRILHA OPERACIONAL (4 NÓS CONECTADOS) ─────────────────────────────

interface TrilhaContainerProps {
  trilha: TrilhaOperacional;
  onOpenStage: (stage: EtapaOperacional) => void;
}

function TrilhaContainer({ trilha, onOpenStage }: TrilhaContainerProps) {
  return (
    <div className="rounded-xl border border-border/80 bg-card dark:bg-[#111419] dark:border-white/[0.05] p-5 space-y-4 shadow-xs">
      {/* Cabeçalho da Trilha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-border/60 dark:border-white/[0.04]">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-bold text-base text-foreground tracking-tight">
              {trilha.titulo}
            </h2>
            <Badge
              variant="outline"
              className="text-[10px] font-semibold px-2 py-0 border-border bg-muted/40 dark:bg-white/[0.03] dark:border-white/[0.05]"
            >
              {trilha.badgeTrilha}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{trilha.descricao}</p>
        </div>
      </div>

      {/* Grid com os 4 Nós da Trilha */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 relative">
        {trilha.etapas.map((etapa, idx) => (
          <EtapaCard
            key={etapa.id}
            etapa={etapa}
            isLast={idx === trilha.etapas.length - 1}
            onClick={() => onOpenStage(etapa)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── CARD DE ETAPA / NÓ DA TRILHA ───────────────────────────────────────────────────

interface EtapaCardProps {
  etapa: EtapaOperacional;
  isLast: boolean;
  onClick: () => void;
}

function EtapaCard({ etapa, isLast, onClick }: EtapaCardProps) {
  const isBloqueado = etapa.situacao === "bloqueado";
  const isAtencao = etapa.situacao === "atencao";
  const isConcluido = etapa.situacao === "concluido";

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "rounded-xl border p-4 space-y-3 transition-all cursor-pointer text-left relative group",
        "bg-card dark:bg-[#15191F] hover:border-primary/50 dark:hover:border-primary/50 hover:shadow-md",
        isBloqueado && "border-rose-300/80 bg-rose-50/10 dark:border-rose-900/40",
        isAtencao && "border-amber-300/80 bg-amber-50/10 dark:border-amber-900/40",
        isConcluido && "border-emerald-300/40 dark:border-emerald-900/20"
      )}
    >
      {/* Header do Card: Número e Status Badge */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-bold text-muted-foreground">
          0{etapa.ordem}
        </span>
        <div className="flex items-center gap-1.5">
          {etapa.processosEmAtencao > 0 && (
            <Badge
              variant="outline"
              className="text-[9px] font-bold px-1.5 py-0 border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30"
            >
              {etapa.processosEmAtencao} em atenção
            </Badge>
          )}
          <EtapaStatusPill situacao={etapa.situacao} />
        </div>
      </div>

      {/* Identificação da Etapa */}
      <div className="space-y-0.5">
        <h3 className="font-display text-sm font-bold text-foreground group-hover:text-primary transition-colors">
          {etapa.nome}
        </h3>
        <p className="text-[11px] text-muted-foreground line-clamp-1">
          {etapa.subtitulo}
        </p>
      </div>

      {/* Contagem e Situação Resumida */}
      <div className="pt-2 border-t border-border/50 dark:border-white/[0.04] space-y-1.5 text-xs">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] text-muted-foreground">Processos ativos</span>
          <span className="font-bold text-foreground text-sm">
            {etapa.totalProcessos}
          </span>
        </div>

        <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
          {etapa.resumoSituacao}
        </p>
      </div>

      {/* Responsável e CTA para Abrir Drawer */}
      <div className="flex items-center justify-between pt-2 border-t border-border/50 dark:border-white/[0.04] text-[11px]">
        <span className="text-muted-foreground">
          Resp:{" "}
          <strong
            className={cn(
              etapa.responsavelSetorial === "Operação" && "text-blue-700 dark:text-blue-400",
              etapa.responsavelSetorial === "RH" && "text-purple-700 dark:text-purple-400",
              etapa.responsavelSetorial === "Financeiro" && "text-emerald-700 dark:text-emerald-400",
              etapa.responsavelSetorial === "Governança" && "text-amber-700 dark:text-amber-400"
            )}
          >
            {etapa.responsavelSetorial}
          </strong>
        </span>

        <span className="inline-flex items-center gap-1 font-semibold text-primary opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all text-[11px]">
          Diagnosticar
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

// ─── PÍLULA DE STATUS COMPACTA DA ETAPA (DETERMINÍSTICA) ─────────────────────────────

function EtapaStatusPill({ situacao }: { situacao: SituacaoEtapa }) {
  switch (situacao) {
    case "bloqueado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-800/40 bg-rose-100 dark:bg-rose-950/40 px-1.5 py-0.5 text-[9px] font-bold text-rose-800 dark:text-rose-300">
          <AlertTriangle className="h-2 w-2" />
          Bloqueio
        </span>
      );
    case "atencao":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Atenção
        </span>
      );
    case "concluido":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-2 w-2" />
          Concluído
        </span>
      );
    case "normal":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 dark:bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          Regular
        </span>
      );
  }
}
