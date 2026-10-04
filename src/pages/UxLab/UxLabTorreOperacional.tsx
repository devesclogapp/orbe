import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { useUxLabTheme } from "@/components/ux-lab/UxLabThemeContext";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  MOCK_RADAR_OPERACIONAL,
  MOCK_TRILHA_RECEITAS,
  MOCK_TRILHA_CUSTOS,
  EtapaOperacional,
  SituacaoEtapa,
} from "./torreMockData";
import { UxLabTorreDrawer } from "@/components/ux-lab/UxLabTorreDrawer";

export default function UxLabTorreOperacional() {
  const navigate = useNavigate();
  const { isDark } = useUxLabTheme();

  // Filtros de Contexto do Topbar e Locais
  const [competencia, setCompetencia] = useState("2026-10");
  const [empresa, setEmpresa] = useState("all");
  const [fluxoFiltro, setFluxoFiltro] = useState<"todos" | "receitas" | "custos">("todos");
  const [searchTerm, setSearchTerm] = useState("");

  // Estado de Interatividade do Protótipo 2 (Seleção de Nó e Drawer)
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Resolução da etapa selecionada para o Drawer Operacional
  const selectedStage = useMemo<EtapaOperacional | null>(() => {
    if (!selectedStageId) return null;
    const allStages = [...MOCK_TRILHA_RECEITAS.etapas, ...MOCK_TRILHA_CUSTOS.etapas];
    return allStages.find((s) => s.id === selectedStageId) || null;
  }, [selectedStageId]);

  const handleStageClick = (etapa: EtapaOperacional) => {
    setSelectedStageId(etapa.id);
    setIsDrawerOpen(true);
  };

  const handleRefresh = () => {
    toast.success("Torre Operacional sincronizada", {
      description: "Fluxos e tempos recalculados com sucesso.",
    });
  };

  const handleSidebarSelect = (id: string, label: string) => {
    if (id === "dashboard") {
      navigate("/ux-lab");
      return;
    }
    if (id === "torre-operacional") {
      return;
    }
    if (id === "operacoes-volume") {
      navigate("/ux-lab/operacoes-volume");
      return;
    }
    if (id === "dre") {
      navigate("/ux-lab/dre");
      return;
    }
    if (id === "relatorios") {
      navigate("/ux-lab/relatorios");
      return;
    }
    toast.info(`Módulo em planejamento: ${label}`, {
      description: "Este módulo especialista será prototipado em sua própria fase do UX Lab.",
    });
  };

  // Filtragem de trilhas conforme busca e filtro rápido
  const trilhasExibidas = useMemo(() => {
    let result = [];
    if (fluxoFiltro === "todos" || fluxoFiltro === "receitas") {
      result.push(MOCK_TRILHA_RECEITAS);
    }
    if (fluxoFiltro === "todos" || fluxoFiltro === "custos") {
      result.push(MOCK_TRILHA_CUSTOS);
    }
    return result;
  }, [fluxoFiltro]);

  return (
    <UxLabShell
      title="Torre Operacional"
      subtitle="Acompanhe o fluxo operacional, gargalos e responsabilidades."
      activeItem="torre-operacional"
      onSelectItem={handleSidebarSelect}
      competencia={competencia}
      onCompetenciaChange={setCompetencia}
      empresa={empresa}
      onEmpresaChange={setEmpresa}
      onRefresh={handleRefresh}
    >
      <div className="space-y-5">
        {/* ─── 1. RADAR OPERACIONAL COMPACTO (Superfície única horizontal) ─── */}
        <section
          aria-label="Radar Operacional"
          className="rounded-xl border border-border bg-card dark:bg-[#111419] dark:border-white/[0.05] p-3 px-4 shadow-xs transition-colors"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Indicadores Semânticos em Linha */}
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-semibold text-foreground">
                  {MOCK_RADAR_OPERACIONAL.aguardandoAcao}
                </span>
                <span className="text-muted-foreground">aguardando ação</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-600" />
                <span className="font-semibold text-foreground">
                  {MOCK_RADAR_OPERACIONAL.foraDoSla}
                </span>
                <span className="text-muted-foreground">fora do SLA</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                <span className="font-semibold text-foreground">
                  {MOCK_RADAR_OPERACIONAL.inconsistenciasImpeditivas}
                </span>
                <span className="text-muted-foreground">inconsistências impeditivas</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500" />
                <span className="font-semibold text-foreground">
                  {MOCK_RADAR_OPERACIONAL.emAndamento}
                </span>
                <span className="text-muted-foreground">em andamento regular</span>
              </div>
            </div>

            {/* Metadado Sóbrio à Direita */}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 shrink-0">
              <Clock className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span>SLA Padrão: 24h interno · 48h fechamento</span>
            </div>
          </div>
        </section>

        {/* ─── 2. SUB-CABEÇALHO OPERACIONAL: FILTROS RÁPIDOS E BUSCA ─── */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-1">
          {/* Pílulas de Seleção de Trilha */}
          <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-muted/50 border border-border/60 dark:bg-[#111419] dark:border-white/[0.05]">
            <button
              type="button"
              onClick={() => setFluxoFiltro("todos")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                fluxoFiltro === "todos"
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border/80 dark:bg-[#1A1F27] dark:border-white/[0.08] dark:shadow-none"
                  : "text-muted-foreground hover:text-foreground dark:hover:text-[#F1F3F5]"
              )}
            >
              Todos os Fluxos (2 Trilhas)
            </button>
            <button
              type="button"
              onClick={() => setFluxoFiltro("receitas")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                fluxoFiltro === "receitas"
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border/80 dark:bg-[#1A1F27] dark:border-white/[0.08] dark:shadow-none"
                  : "text-muted-foreground hover:text-foreground dark:hover:text-[#F1F3F5]"
              )}
            >
              Trilha A · Receitas
            </button>
            <button
              type="button"
              onClick={() => setFluxoFiltro("custos")}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                fluxoFiltro === "custos"
                  ? "bg-card text-foreground font-semibold shadow-xs border border-border/80 dark:bg-[#1A1F27] dark:border-white/[0.08] dark:shadow-none"
                  : "text-muted-foreground hover:text-foreground dark:hover:text-[#F1F3F5]"
              )}
            >
              Trilha B · Custos & Mão de Obra
            </button>
          </div>

          {/* Campo de Busca Rápida */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              placeholder="Buscar processo, lote ou cliente..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs font-medium bg-card text-foreground border-border dark:bg-[#111419] dark:border-white/[0.05] dark:text-[#F1F3F5] dark:focus:border-blue-500"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        {/* ─── 3. ELEMENTO PRINCIPAL: DUAS TRILHAS OPERACIONAIS ─── */}
        <div className="space-y-6">
          {trilhasExibidas.map((trilha) => {
            const isReceita = trilha.id === "trilha-receitas";
            const totalTrilha = trilha.etapas.reduce((acc, curr) => acc + curr.totalProcessos, 0);

            return (
              <section
                key={trilha.id}
                aria-label={trilha.titulo}
                className="rounded-xl border border-border bg-card dark:bg-[#111419] dark:border-white/[0.05] p-4 md:p-5 shadow-xs transition-colors"
              >
                {/* Cabeçalho da Trilha */}
                <div className="flex flex-col gap-1 pb-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 dark:border-white/[0.04]">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-lg text-white font-bold text-xs shadow-xs",
                        isReceita ? "bg-blue-600 dark:bg-blue-600" : "bg-slate-700 dark:bg-slate-800"
                      )}
                    >
                      {isReceita ? "A" : "B"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-sm font-bold tracking-tight text-foreground md:text-base">
                          {trilha.titulo}
                        </h2>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {trilha.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="text-left sm:text-right mt-1 sm:mt-0">
                    <span className="text-[11px] text-muted-foreground font-medium">Volume Ativo: </span>
                    <span className="text-xs font-bold text-foreground font-display">
                      {totalTrilha} processos
                    </span>
                  </div>
                </div>

                {/* Grade de Nós Operacionais Conectados */}
                <div className="pt-4 overflow-x-auto pb-1 scrollbar-thin">
                  <div className="flex items-stretch gap-3 min-w-[860px]">
                    {trilha.etapas.map((etapa, idx) => {
                      const isSelected = selectedStageId === etapa.id;
                      const isLast = idx === trilha.etapas.length - 1;

                      return (
                        <React.Fragment key={etapa.id}>
                          {/* Card do Nó Operacional */}
                          <div
                            onClick={() => handleStageClick(etapa)}
                            className={cn(
                              "flex-1 rounded-xl border p-3.5 transition-all text-left flex flex-col justify-between cursor-pointer select-none",
                              isSelected
                                ? "border-blue-600 bg-blue-50/30 ring-2 ring-blue-600/20 shadow-sm dark:border-blue-500 dark:bg-[#15191F] dark:ring-1 dark:ring-blue-500/40 dark:shadow-none"
                                : "border-border bg-card/70 hover:border-slate-300 hover:bg-card shadow-xs dark:bg-[#15191F] dark:border-white/[0.04] dark:hover:bg-[#1A1F27] dark:hover:border-white/[0.08] dark:shadow-none"
                            )}
                          >
                            {/* Topo do Nó: Ordem, Nome e Chip de Situação */}
                            <div>
                              <div className="flex items-start justify-between gap-1 mb-1">
                                <span className="font-mono text-[10px] font-bold text-muted-foreground/80 tracking-wider">
                                  ETAPA 0{etapa.ordem}
                                </span>
                                <StageStatusBadge situacao={etapa.situacao} />
                              </div>

                              <h3 className="font-display text-xs font-bold text-foreground leading-tight tracking-tight">
                                {etapa.nome}
                              </h3>
                              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                                {etapa.subtitulo}
                              </p>
                            </div>

                            {/* Centro do Nó: Quantidade, Situação e Tempo */}
                            <div className="my-2.5 py-1.5 border-y border-border/40 dark:border-white/[0.03] space-y-1">
                              <div className="flex items-baseline justify-between">
                                <span className="font-display text-lg font-black text-foreground">
                                  {etapa.totalProcessos}
                                </span>
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  processos
                                </span>
                              </div>

                              <p
                                className={cn(
                                  "text-[11px] font-medium leading-tight",
                                  etapa.situacao === "atrasado" && "text-rose-600 dark:text-rose-400 font-semibold",
                                  etapa.situacao === "bloqueado" && "text-rose-700 dark:text-rose-300 font-semibold",
                                  etapa.situacao === "atencao" && "text-amber-700 dark:text-amber-400 font-semibold",
                                  etapa.situacao === "concluido" && "text-emerald-700 dark:text-emerald-400 font-semibold",
                                  etapa.situacao === "normal" && "text-muted-foreground"
                                )}
                              >
                                {etapa.resumoSituacao}
                              </p>

                              <div className="flex items-center justify-between text-[10px] text-muted-foreground/80 pt-0.5">
                                <span>Tempo médio</span>
                                <span className="font-medium text-foreground">{etapa.tempoMedio}</span>
                              </div>
                            </div>

                            {/* Base do Nó: Responsabilidade Setorial */}
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex items-center gap-1.5 text-[10px]">
                                <span className="text-muted-foreground/80">Responsável:</span>
                                <span
                                  className={cn(
                                    "font-semibold",
                                    etapa.responsavelSetorial === "Operação" && "text-blue-700 dark:text-blue-400",
                                    etapa.responsavelSetorial === "RH" && "text-purple-700 dark:text-purple-400",
                                    etapa.responsavelSetorial === "Financeiro" && "text-emerald-700 dark:text-emerald-400"
                                  )}
                                >
                                  {etapa.responsavelSetorial}
                                </span>
                              </div>

                              {isSelected && (
                                <span className="flex h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-ping" />
                              )}
                            </div>
                          </div>

                          {/* Conector Fluido Discreto entre Etapas */}
                          {!isLast && (
                            <div className="flex items-center justify-center shrink-0 px-0.5 text-muted-foreground/30">
                              <ArrowRight className="h-4 w-4" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Drawer Operacional de Diagnóstico e Despacho (Protótipo 2) */}
      <UxLabTorreDrawer
        stage={selectedStage}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />
    </UxLabShell>
  );
}

// ─── COMPONENTE AUXILIAR: BADGE SEMÂNTICO DE SITUAÇÃO DA ETAPA ──────────────────

function StageStatusBadge({ situacao }: { situacao: SituacaoEtapa }) {
  switch (situacao) {
    case "atrasado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 px-1.5 py-0.2 text-[9px] font-bold text-rose-700 dark:text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
          Fora SLA
        </span>
      );
    case "bloqueado":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-300 dark:border-rose-800/40 bg-rose-100 dark:bg-rose-950/40 px-1.5 py-0.2 text-[9px] font-bold text-rose-800 dark:text-rose-300">
          <AlertTriangle className="h-2.5 w-2.5" />
          Bloqueado
        </span>
      );
    case "atencao":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-700 dark:text-amber-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Atenção
        </span>
      );
    case "concluido":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-2.5 w-2.5" />
          Concluído
        </span>
      );
    case "normal":
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-border/80 dark:border-white/[0.05] bg-muted/60 dark:bg-white/[0.03] px-1.5 py-0.2 text-[9px] font-semibold text-muted-foreground dark:text-[#A0A7B2]">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400" />
          Regular
        </span>
      );
  }
}
