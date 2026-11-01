import React, { useState, useMemo } from "react";
import {
  CalendarCheck,
  Search,
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Users,
  Package,
  Wrench,
  Wallet,
  Clock,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Eye,
  CheckCircle2,
  Info,
  UserCheck,
  FileText,
  Lock,
  Check,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabFechamentoDrawer } from "@/components/ux-lab/UxLabFechamentoDrawer";
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
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  CicloFechamentoItemMock,
  DominioFechamento,
  EstadoVisualFechamento,
  MOCK_EMPRESAS_FECHAMENTO,
  MOCK_CICLOS_FECHAMENTO,
} from "./fechamentoCiclosMockData";

export default function UxLabFechamentoCiclos() {
  const navigate = useNavigate();

  // 1. Estado de Dados Mock
  const [ciclos, setCiclos] = useState<CicloFechamentoItemMock[]>(MOCK_CICLOS_FECHAMENTO);

  // 2. Filtros de Contexto
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("emp-castanhal");
  const [competenciaFiltro, setCompetenciaFiltro] = useState<string>("2026-10");
  const [dominioFiltro, setDominioFiltro] = useState<string>("TODOS");
  const [kpiFiltroRapido, setKpiFiltroRapido] = useState<string | null>(null);
  const [busca, setBusca] = useState<string>("");

  // 3. Drawer de Fechamento
  const [selectedCiclo, setSelectedCiclo] = useState<CicloFechamentoItemMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Formatação Monetária
  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // 4. Cálculos dos 4 Cards de KPI
  const kpiStats = useMemo(() => {
    const totalCiclos = ciclos.length; // 5 ciclos/lotes no dataset
    const prontosParaFechar = ciclos.filter(
      (c) => c.estadoVisual === "PRONTO_PARA_FECHAR"
    ).length;
    const bloqueados = ciclos.filter(
      (c) => c.estadoVisual === "BLOQUEADO"
    ).length;
    const jaFechados = ciclos.filter((c) => c.estadoVisual === "FECHADO").length;

    return {
      totalCiclos,
      prontosParaFechar,
      bloqueados,
      jaFechados,
    };
  }, [ciclos]);

  // 5. Contagens por Domínio
  const contagensPorDominio = useMemo(() => {
    return {
      TODOS: ciclos.length,
      OPERACIONAL: ciclos.filter((c) => c.dominio === "OPERACIONAL").length,
      DIARISTAS: ciclos.filter((c) => c.dominio === "DIARISTAS").length,
      INTERMITENTES: ciclos.filter((c) => c.dominio === "INTERMITENTES").length,
      CLT: ciclos.filter((c) => c.dominio === "CLT").length,
    };
  }, [ciclos]);

  // 6. Filtragem dos Itens
  const ciclosFiltrados = useMemo(() => {
    return ciclos.filter((c) => {
      // Filtro por domínio
      if (dominioFiltro !== "TODOS" && c.dominio !== dominioFiltro) return false;

      // Filtro rápido por KPI
      if (kpiFiltroRapido === "PRONTOS" && c.estadoVisual !== "PRONTO_PARA_FECHAR") return false;
      if (kpiFiltroRapido === "BLOQUEADOS" && c.estadoVisual !== "BLOQUEADO") return false;
      if (kpiFiltroRapido === "FECHADOS" && c.estadoVisual !== "FECHADO") return false;

      // Busca textual
      if (busca.trim()) {
        const query = busca.toLowerCase();
        const matchTitulo = c.titulo.toLowerCase().includes(query);
        const matchPeriodo = c.periodo.toLowerCase().includes(query);
        const matchSubtitulo = c.subtitulo.toLowerCase().includes(query);
        const matchResponsavel = c.responsavelNome.toLowerCase().includes(query);
        if (!matchTitulo && !matchPeriodo && !matchSubtitulo && !matchResponsavel) return false;
      }

      return true;
    });
  }, [ciclos, dominioFiltro, kpiFiltroRapido, busca]);

  // Ação de fechamento confirmada no Drawer
  const handleConfirmarFechamento = (cicloId: string) => {
    setCiclos((prev) =>
      prev.map((c) => {
        if (c.id === cicloId) {
          return {
            ...c,
            estadoVisual: "FECHADO",
            statusMotorOriginal: "FECHADO_FINANCEIRO",
            statusFinanceiroOriginal: "PAGO",
            ctaTexto: "Ver Fechamento",
            ctaTipo: "CONSULTA",
            rastreabilidade: {
              ...c.rastreabilidade,
              fechadoEm: new Date().toISOString(),
              fechadoPor: "Juliana Santos (RH Master)",
            },
          };
        }
        return c;
      })
    );
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

  return (
    <UxLabShell
      title="Fechamento de Ciclos"
      subtitle="Consolidação e encerramento dos ciclos operacionais e de pessoal da competência."
      activeSidebarItem="fechamento-ciclos"
      competencia={competenciaFiltro}
      onCompetenciaChange={setCompetenciaFiltro}
      empresa={empresaFiltro}
      onEmpresaChange={setEmpresaFiltro}
      onRefresh={() => {
        toast.info("Contexto da competência atualizado.");
      }}
    >
      <div className="space-y-6">
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
              <span className="text-xs text-muted-foreground">ciclo apto neste momento</span>
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
              <span className="text-xs text-muted-foreground">consolidado / quitado</span>
            </div>
          </div>
        </div>

        {/* BLOCO 2: BARRA DE CONTEXTO E FILTROS */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-3 rounded-xl border border-border bg-card/60">
          {/* Categorias Monocromáticas Institucionais */}
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

          {/* Busca Textual */}
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

        {/* BLOCO 3: ÁREA PRINCIPAL — MAPA DE FECHAMENTOS (LISTA DE CICLOS) */}
        <div className="space-y-4">
          {ciclosFiltrados.map((ciclo) => {
            const domInfo = getDominioBadgeInfo(ciclo.dominio);
            const DomIcon = domInfo.icon;
            const isPronto = ciclo.estadoVisual === "PRONTO_PARA_FECHAR";
            const isBloqueado = ciclo.estadoVisual === "BLOQUEADO";
            const isAguardando = ciclo.estadoVisual === "AGUARDANDO_APROVACAO";
            const isFechado = ciclo.estadoVisual === "FECHADO";

            return (
              <div
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
                      {formatCurrency(ciclo.valorTotal)}
                    </span>
                  </div>
                </div>

                {/* Linha Central: Detalhes, Timeline S1..S5 (para Operacional) & Checklist */}
                <div className="py-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Coluna Esquerda / Grandeza & Timeline */}
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

                    {/* Timeline S1..S5 para o Ciclo Operacional Semanal */}
                    {ciclo.semanasTimeline && (
                      <div className="p-3 rounded-lg border border-border/60 bg-background space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Semanas da Competência
                          </span>
                          <span className="text-[10px] text-muted-foreground">S1 .. S5</span>
                        </div>

                        {/* Grade de Semanas */}
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

                  {/* Coluna Direita / Checklist de Prontidão */}
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

                {/* Linha Inferior: Barra de Ação Operacional Específica */}
                <div className="pt-3 border-t border-border/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Perfil Responsável: </span>
                    {ciclo.responsavelPapel}
                  </div>

                  <div className="flex items-center gap-2">
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

                    {isBloqueado && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate("/ux-lab/inconsistencias")}
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
                        onClick={() => navigate("/ux-lab/aprovacoes")}
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
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer Especialista de Revisão e Confirmação de Fechamento */}
      <UxLabFechamentoDrawer
        ciclo={selectedCiclo}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onConfirmarFechamento={handleConfirmarFechamento}
      />
    </UxLabShell>
  );
}
