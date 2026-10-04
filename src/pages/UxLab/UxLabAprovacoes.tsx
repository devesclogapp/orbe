import React, { useState, useMemo } from "react";
import {
  Shield,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Receipt,
  Building2,
  Calendar,
  Layers,
  RotateCcw,
  Sparkles,
  Users,
  Coins,
  Package,
  Wrench,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Ban,
  Eye,
  Check,
  Info
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabAprovacaoDrawer } from "@/components/ux-lab/UxLabAprovacaoDrawer";
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
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import {
  ItemAprovacaoMock,
  DominioAprovacao,
  SituacaoDecisao,
  MOCK_EMPRESAS_APROVACOES,
  MOCK_ITENS_APROVACOES,
} from "./aprovacoesMockData";

export default function UxLabAprovacoes() {
  // Estado de Dados (com mutação local simulada)
  const [itens, setItens] = useState<ItemAprovacaoMock[]>(MOCK_ITENS_APROVACOES);

  // Filtros de Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("all");
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [dominioFiltro, setDominioFiltro] = useState<string>("TODAS");
  // Abertura Padrão: exclusivamente registros aguardando decisão acionável
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>("PENDENTE");
  const [busca, setBusca] = useState<string>("");

  // Card de Síntese Clicável / Filtro Rápido
  const [filtroRapidoKpi, setFiltroRapidoKpi] = useState<string | null>(null);

  // Drawer de Detalhes
  const [selectedItem, setSelectedItem] = useState<ItemAprovacaoMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // Formatação de Moeda
  const formatCurrency = (val?: number) => {
    if (val === undefined || val === null) return "—";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  // Formatação de Data
  const formatRelativeTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return isoStr;
    }
  };

  // Filtragem dos Itens
  const itensFiltrados = useMemo(() => {
    return itens.filter((item) => {
      // 1. Empresa
      if (empresaFiltro !== "all" && item.empresaId !== empresaFiltro) {
        return false;
      }

      // 2. Domínio (Pílulas superiores)
      if (dominioFiltro !== "TODAS" && item.dominio !== dominioFiltro) {
        return false;
      }

      // 3. Filtro Rápido por KPI Card
      if (filtroRapidoKpi === "aguardando_decisao") {
        if (item.situacao === "DEVOLVIDO" || item.isFailClosed || item.situacao === "BLOQUEADO_INCONSISTENCIA" || item.situacao === "APROVADO") {
          return false;
        }
      } else if (filtroRapidoKpi === "mais_antigos") {
        if (item.situacao === "DEVOLVIDO" || item.isFailClosed || item.situacao === "APROVADO") {
          return false;
        }
        if (item.criadoEm > "2026-10-04T10:00:00Z" && item.situacao !== "REQUER_ATENCAO") {
          return false;
        }
      } else if (filtroRapidoKpi === "devolvidos") {
        if (item.situacao !== "DEVOLVIDO") {
          return false;
        }
      } else {
        // 4. Situação / Status (Filosofia da Fila Padrão)
        if (situacaoFiltro === "PENDENTE") {
          // Fila padrão: apenas decisões acionáveis (sem devolvidos, sem itens fail-closed bloqueados)
          if (item.situacao === "DEVOLVIDO" || item.isFailClosed || item.situacao === "BLOQUEADO_INCONSISTENCIA" || item.situacao === "APROVADO") {
            return false;
          }
        } else if (situacaoFiltro === "MAIS_ANTIGOS") {
          if (item.situacao === "DEVOLVIDO" || item.isFailClosed || item.situacao === "APROVADO") {
            return false;
          }
          if (item.criadoEm > "2026-10-04T10:00:00Z" && item.situacao !== "REQUER_ATENCAO") {
            return false;
          }
        } else if (situacaoFiltro === "DEVOLVIDO") {
          if (item.situacao !== "DEVOLVIDO") {
            return false;
          }
        } else if (situacaoFiltro === "REQUER_CORRECAO") {
          if (!item.isFailClosed && item.situacao !== "BLOQUEADO_INCONSISTENCIA") {
            return false;
          }
        } else if (situacaoFiltro === "todos") {
          if (item.situacao === "APROVADO") {
            return false;
          }
        }
      }

      // 5. Filtro Temporal Híbrido Reutilizado (data de criação)
      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje" && !item.criadoEm.startsWith("2026-10-04")) {
          return false;
        }
        if (filtroTemporal.preset === "setembro" && !item.criadoEm.startsWith("2026-09")) {
          return false;
        }
        if (filtroTemporal.preset === "outubro" && !item.criadoEm.startsWith("2026-10")) {
          return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const itemDate = new Date(item.criadoEm);
        const targetYear = filtroTemporal.data.getFullYear();
        const targetMonth = filtroTemporal.data.getMonth();
        const targetDay = filtroTemporal.data.getDate();
        if (
          itemDate.getFullYear() !== targetYear ||
          itemDate.getMonth() !== targetMonth ||
          itemDate.getDate() !== targetDay
        ) {
          return false;
        }
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const itemDate = new Date(item.criadoEm);
        const fromDate = new Date(filtroTemporal.range.from);
        fromDate.setHours(0, 0, 0, 0);

        const toDate = filtroTemporal.range.to
          ? new Date(filtroTemporal.range.to)
          : new Date(filtroTemporal.range.from);
        toDate.setHours(23, 59, 59, 999);

        if (itemDate < fromDate || itemDate > toDate) {
          return false;
        }
      }

      // 6. Busca textual
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const matchCodigo = item.codigo.toLowerCase().includes(query);
        const matchTitulo = item.titulo.toLowerCase().includes(query);
        const matchDesc = item.descricaoResumida.toLowerCase().includes(query);
        const matchEmpresa = item.empresaNome.toLowerCase().includes(query);
        const matchOrigem = item.origem.toLowerCase().includes(query);
        const matchCriador = item.criadoPor.toLowerCase().includes(query);

        if (!matchCodigo && !matchTitulo && !matchDesc && !matchEmpresa && !matchOrigem && !matchCriador) {
          return false;
        }
      }

      return true;
    });
  }, [itens, empresaFiltro, dominioFiltro, situacaoFiltro, filtroRapidoKpi, filtroTemporal, busca]);

  // Contadores por Fila (baseados no conjunto de decisões acionáveis pendentes)
  const contadoresPorDominio = useMemo(() => {
    const base = itens.filter((i) => {
      if (empresaFiltro !== "all" && i.empresaId !== empresaFiltro) return false;
      // Contabiliza apenas decisões acionáveis pendentes
      return !i.isFailClosed && i.situacao !== "DEVOLVIDO" && i.situacao !== "BLOQUEADO_INCONSISTENCIA" && i.situacao !== "APROVADO";
    });

    return {
      TODAS: base.length,
      OPERACAO: base.filter((i) => i.dominio === "OPERACAO").length,
      SERVICO_EXTRA: base.filter((i) => i.dominio === "SERVICO_EXTRA").length,
      CUSTO_EXTRA: base.filter((i) => i.dominio === "CUSTO_EXTRA").length,
      DIARISTA: base.filter((i) => i.dominio === "DIARISTA").length,
      INTERMITENTE: base.filter((i) => i.dominio === "INTERMITENTE").length,
    };
  }, [itens, empresaFiltro]);

  // 4 Indicadores Operacionais Compactos (Conforme Contrato Semântico Oficial)
  const kpis = useMemo(() => {
    const baseGeral = itens.filter((i) => {
      if (empresaFiltro !== "all" && i.empresaId !== empresaFiltro) return false;
      return true;
    });

    // 1. Aguardando Decisão (apenas decisões pendentes acionáveis)
    const aguardandoDecisao = baseGeral.filter(
      (i) => !i.isFailClosed && i.situacao !== "DEVOLVIDO" && i.situacao !== "BLOQUEADO_INCONSISTENCIA" && i.situacao !== "APROVADO"
    ).length;

    // 2. Aguardando há mais tempo (registros acionáveis com maior antiguidade real, sem SLA fictício)
    const maisAntigos = baseGeral.filter(
      (i) =>
        !i.isFailClosed &&
        i.situacao !== "DEVOLVIDO" &&
        i.situacao !== "BLOQUEADO_INCONSISTENCIA" &&
        i.situacao !== "APROVADO" &&
        (i.criadoEm < "2026-10-04T10:00:00Z" || i.situacao === "REQUER_ATENCAO")
    ).length;

    // 3. Devolvidos (Contexto Operacional/Histórico)
    const devolvidos = baseGeral.filter((i) => i.situacao === "DEVOLVIDO").length;

    // 4. Impacto Financeiro Real da Fila Acionável (Apenas soma de itens com R$ real)
    const impactoFinanceiro = baseGeral
      .filter((i) => !i.isFailClosed && i.situacao !== "DEVOLVIDO" && i.situacao !== "BLOQUEADO_INCONSISTENCIA" && i.situacao !== "APROVADO")
      .reduce((acc, curr) => acc + (curr.valorMonetario || 0), 0);

    return {
      aguardandoDecisao,
      maisAntigos,
      devolvidos,
      impactoFinanceiro,
    };
  }, [itens, empresaFiltro]);

  // Ações de Despacho (Mutação de Estado no Mock)
  const handleAprovar = (id: string) => {
    setItens((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          return {
            ...i,
            situacao: "APROVADO" as SituacaoDecisao,
            rawStatusOriginal: "APROVADO_OPERACAO",
            historico: [
              ...i.historico,
              {
                id: `h-${Date.now()}`,
                data: new Date().toISOString(),
                usuario: "Gestor Autenticado",
                papel: "RH / Operações",
                acao: "Aprovação Concedida",
                descricao: "Decisão aprovada na Central de Aprovações transversal.",
              },
            ],
          };
        }
        return i;
      })
    );
    toast.success("Decisão aprovada com sucesso!", {
      description: "O registro avançou para a próxima etapa do pipeline.",
    });
  };

  const handleDevolver = (id: string, motivo: string) => {
    setItens((prev) =>
      prev.map((i) => {
        if (i.id === id) {
          return {
            ...i,
            situacao: "DEVOLVIDO" as SituacaoDecisao,
            rawStatusOriginal: "DEVOLVIDO",
            historico: [
              ...i.historico,
              {
                id: `h-${Date.now()}`,
                data: new Date().toISOString(),
                usuario: "Gestor Autenticado",
                papel: "RH / Operações",
                acao: "Devolução Registrada",
                descricao: "Item devolvido para ajuste no ponto de captura.",
                motivo,
              },
            ],
          };
        }
        return i;
      })
    );
    toast.warning("Registro devolvido para correção.", {
      description: `Motivo registrado: "${motivo}"`,
    });
  };

  const handleRefresh = () => {
    setItens(MOCK_ITENS_APROVACOES);
    toast.success("Fila de aprovações sincronizada com sucesso.");
  };

  const handleRowClick = (item: ItemAprovacaoMock) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  // Helper de Badges de Domínio (Monocromático institucional DS-02 para categorias)
  const renderDominioBadge = (dom: DominioAprovacao) => {
    switch (dom) {
      case "OPERACAO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
            <Package className="w-3 h-3 text-muted-foreground" />
            Operação
          </span>
        );
      case "SERVICO_EXTRA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
            <Wrench className="w-3 h-3 text-muted-foreground" />
            Serviço Extra
          </span>
        );
      case "CUSTO_EXTRA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
            <Wallet className="w-3 h-3 text-muted-foreground" />
            Custo Extra
          </span>
        );
      case "DIARISTA":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
            <Users className="w-3 h-3 text-muted-foreground" />
            Lote Diaristas
          </span>
        );
      case "INTERMITENTE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-foreground border border-border">
            <Users className="w-3 h-3 text-muted-foreground" />
            Lote Intermitentes
          </span>
        );
    }
  };

  // Helper de Badges de Situação (Semântico para estados)
  const renderSituacaoBadge = (sit: SituacaoDecisao, isFailClosed: boolean) => {
    if (isFailClosed) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
          <Ban className="w-3 h-3" />
          Requer Correção
        </span>
      );
    }

    switch (sit) {
      case "PENDENTE":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
            <Clock className="w-3 h-3" />
            Aguardando Decisão
          </span>
        );
      case "REQUER_ATENCAO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40">
            <AlertTriangle className="w-3 h-3" />
            Atenção
          </span>
        );
      case "DEVOLVIDO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
            <RotateCcw className="w-3 h-3" />
            Devolvido
          </span>
        );
      case "APROVADO":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">
            <CheckCircle2 className="w-3 h-3" />
            Aprovado
          </span>
        );
      default:
        return <Badge variant="outline">{sit}</Badge>;
    }
  };

  const DOMINIOS_TABS: Array<{ id: string; label: string; count: number; icon: any }> = [
    { id: "TODAS", label: "Todas as Filas", count: contadoresPorDominio.TODAS, icon: Layers },
    { id: "SERVICO_EXTRA", label: "Serviços Extras", count: contadoresPorDominio.SERVICO_EXTRA, icon: Wrench },
    { id: "CUSTO_EXTRA", label: "Custos Extras", count: contadoresPorDominio.CUSTO_EXTRA, icon: Wallet },
    { id: "DIARISTA", label: "Diaristas (Lotes)", count: contadoresPorDominio.DIARISTA, icon: Users },
    { id: "INTERMITENTE", label: "Intermitentes", count: contadoresPorDominio.INTERMITENTE, icon: Users },
    { id: "OPERACAO", label: "Operações", count: contadoresPorDominio.OPERACAO, icon: Package },
  ];

  const isDevolvidosView = filtroRapidoKpi === "devolvidos" || situacaoFiltro === "DEVOLVIDO";
  const isRequerCorrecaoView = situacaoFiltro === "REQUER_CORRECAO";

  return (
    <UxLabShell
      title="Central de Aprovações"
      subtitle="Decisões pendentes que aguardam autorização para o fluxo continuar."
      activeItem="aprovacoes"
      empresa={empresaFiltro}
      onEmpresaChange={setEmpresaFiltro}
      onRefresh={handleRefresh}
    >
      <div className="space-y-5">
        {/* 1. INDICADORES OPERACIONAIS COMPACTOS (4 CARDS OFICIAIS) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Card 1: Aguardando Decisão */}
          <button
            type="button"
            onClick={() => {
              setFiltroRapidoKpi(filtroRapidoKpi === "aguardando_decisao" ? null : "aguardando_decisao");
              setSituacaoFiltro("PENDENTE");
            }}
            className={`text-left p-3.5 rounded-xl border transition-all duration-200 bg-card hover:bg-muted/40 ${
              filtroRapidoKpi === "aguardando_decisao" || (situacaoFiltro === "PENDENTE" && !filtroRapidoKpi)
                ? "border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-sm"
                : "border-border shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Aguardando Decisão
              </span>
              <Clock className="w-4 h-4 text-[#2563EB] dark:text-blue-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-display font-extrabold text-foreground">
                {kpis.aguardandoDecisao}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">decisões</span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Itens aptos para autorização imediata
            </span>
          </button>

          {/* Card 2: Aguardando há mais tempo (Substituição de Requer Atenção / SLA Fictício) */}
          <button
            type="button"
            onClick={() => setFiltroRapidoKpi(filtroRapidoKpi === "mais_antigos" ? null : "mais_antigos")}
            className={`text-left p-3.5 rounded-xl border transition-all duration-200 bg-card hover:bg-muted/40 ${
              filtroRapidoKpi === "mais_antigos"
                ? "border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                : "border-border shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Aguardando há mais tempo
              </span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-display font-extrabold text-amber-700 dark:text-amber-400">
                {kpis.maisAntigos}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">mais antigos</span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Maior antiguidade na fila de espera
            </span>
          </button>

          {/* Card 3: Devolvidos (Contexto Histórico) */}
          <button
            type="button"
            onClick={() => {
              const next = filtroRapidoKpi === "devolvidos" ? null : "devolvidos";
              setFiltroRapidoKpi(next);
              setSituacaoFiltro(next ? "DEVOLVIDO" : "PENDENTE");
            }}
            className={`text-left p-3.5 rounded-xl border transition-all duration-200 bg-card hover:bg-muted/40 ${
              filtroRapidoKpi === "devolvidos" || situacaoFiltro === "DEVOLVIDO"
                ? "border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                : "border-border shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Devolvidos
              </span>
              <RotateCcw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-display font-extrabold text-rose-700 dark:text-rose-400">
                {kpis.devolvidos}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">em correção</span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Registros devolvidos para ajuste
            </span>
          </button>

          {/* Card 4: Impacto Financeiro da Fila */}
          <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Impacto Financeiro
              </span>
              <Coins className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-display font-extrabold text-foreground font-mono">
                {formatCurrency(kpis.impactoFinanceiro)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Soma real dos itens com valor monetário
            </span>
          </div>
        </div>

        {/* 2. PÍLULAS DE DOMÍNIO (FILTROS DE FILA COM CONTADORES DE DECISÕES ACIONÁVEIS) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {DOMINIOS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = dominioFiltro === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDominioFiltro(tab.id)}
                className={`h-9 px-3.5 rounded-lg flex items-center gap-2 border text-xs font-semibold whitespace-nowrap transition-all duration-200 ${
                  isSelected
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs dark:bg-blue-600 dark:border-blue-600"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                <span>{tab.label}</span>
                <span
                  className={`ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. BARRA DE FILTROS TRANSVERSAIS */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Seletor de Empresa */}
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger className="h-9 w-[190px] text-xs font-semibold bg-background border-border">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                {MOCK_EMPRESAS_APROVACOES.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Temporal Oficial do UX Lab */}
            <UxLabFiltroTemporal
              value={filtroTemporal}
              onChange={setFiltroTemporal}
              compact
            />

            {/* Seletor de Situação / Visão */}
            <Select value={situacaoFiltro} onValueChange={(v) => {
              setSituacaoFiltro(v);
              if (v === "DEVOLVIDO") setFiltroRapidoKpi("devolvidos");
              else if (v === "MAIS_ANTIGOS") setFiltroRapidoKpi("mais_antigos");
              else if (v === "PENDENTE") setFiltroRapidoKpi(null);
            }}>
              <SelectTrigger className="h-9 w-[200px] text-xs font-semibold bg-background border-border">
                <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDENTE" className="text-xs font-bold text-[#2563EB] dark:text-blue-400">
                  Aguardando Decisão (Padrão)
                </SelectItem>
                <SelectItem value="MAIS_ANTIGOS" className="text-xs">
                  Aguardando há mais tempo
                </SelectItem>
                <SelectItem value="DEVOLVIDO" className="text-xs text-rose-600 dark:text-rose-400">
                  Devolvidos (Histórico)
                </SelectItem>
                <SelectItem value="REQUER_CORRECAO" className="text-xs text-amber-600 dark:text-amber-400">
                  Requer Correção (Inconsistência)
                </SelectItem>
                <SelectItem value="todos" className="text-xs">
                  Todos os Registros
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Busca Rápida */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por referência, título, empresa, responsável..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 h-9 text-xs bg-background border-border"
              />
            </div>
          </div>

          {/* Reset de Filtros Rápidos */}
          {(filtroRapidoKpi || situacaoFiltro !== "PENDENTE" || busca || empresaFiltro !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFiltroRapidoKpi(null);
                setSituacaoFiltro("PENDENTE");
                setBusca("");
                setEmpresaFiltro("all");
              }}
              className="h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1.5" />
              Restaurar Fila Padrão
            </Button>
          )}
        </div>

        {/* BANNER CONTEXTUAL PARA VISÃO DE DEVOLVIDOS */}
        {isDevolvidosView && (
          <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300 font-medium">
            <RotateCcw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">VISÃO CONTEXTUAL DE HISTÓRICO:</span> Registros devolvidos para ajuste no ponto de origem. Itens devolvidos não possuem ação de aprovação direta na Central de Aprovações.
            </div>
          </div>
        )}

        {/* BANNER CONTEXTUAL PARA REQUER CORREÇÃO (FAIL-CLOSED) */}
        {isRequerCorrecaoView && (
          <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 font-medium">
            <Ban className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">REGISTROS COM INCONSISTÊNCIA (FAIL-CLOSED):</span> Itens com pendências cadastrais ou horários incompletos não podem ser aprovados diretamente. Devem ser regularizados no módulo especialista correspondente.
            </div>
          </div>
        )}

        {/* 4. TABELA PRINCIPAL DE ALTA DENSIDADE (FILA DOMINANTE) */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          {/* Header da Tabela Desktop */}
          <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-3 bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider items-center">
            <div className="col-span-2">Domínio & Referência</div>
            <div className="col-span-2">Empresa / Unidade</div>
            <div className="col-span-3">O que está sendo aprovado</div>
            <div className="col-span-2">Valor / Grandeza</div>
            <div className="col-span-2">Aguardando desde</div>
            <div className="col-span-1 text-right">Ação</div>
          </div>

          {/* Linhas da Fila */}
          <div className="divide-y divide-border">
            {itensFiltrados.map((item) => {
              return (
                <div
                  key={item.id}
                  onClick={() => handleRowClick(item)}
                  className={`group p-4 lg:px-4 lg:py-3 transition-colors cursor-pointer hover:bg-muted/30 ${
                    item.isFailClosed ? "bg-rose-50/20 dark:bg-rose-950/10" : ""
                  }`}
                >
                  {/* Visão Desktop (Grid 12 colunas) */}
                  <div className="hidden lg:grid grid-cols-12 gap-3 items-center text-xs">
                    {/* Col 1-2: Domínio & Código */}
                    <div className="col-span-2 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderDominioBadge(item.dominio)}
                      </div>
                      <span className="font-mono text-xs font-bold text-foreground block">
                        {item.codigo}
                      </span>
                    </div>

                    {/* Col 3-4: Empresa */}
                    <div className="col-span-2">
                      <span className="font-semibold text-foreground block truncate">
                        {item.empresaNome}
                      </span>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {item.unidadeNome || item.origem}
                      </span>
                    </div>

                    {/* Col 5-7: Título & Resumo */}
                    <div className="col-span-3 space-y-0.5">
                      <span className="font-bold text-foreground block leading-tight truncate">
                        {item.titulo}
                      </span>
                      <span className="text-[11px] text-muted-foreground block line-clamp-1">
                        {item.descricaoResumida}
                      </span>
                    </div>

                    {/* Col 8-9: Valor / Grandeza */}
                    <div className="col-span-2 space-y-0.5">
                      <span className="font-mono font-bold text-sm text-foreground block">
                        {item.valorFormatado || formatCurrency(item.valorMonetario)}
                      </span>
                      {item.grandezaFisica && (
                        <span className="text-[11px] text-muted-foreground block">
                          {item.grandezaFisica}
                        </span>
                      )}
                    </div>

                    {/* Col 10-11: Data & Situação */}
                    <div className="col-span-2 space-y-1">
                      <div className="text-[11px] text-muted-foreground font-mono">
                        {formatRelativeTime(item.criadoEm)}
                      </div>
                      <div>
                        {renderSituacaoBadge(item.situacao, item.isFailClosed)}
                      </div>
                    </div>

                    {/* Col 12: Ação */}
                    <div className="col-span-1 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(item);
                        }}
                        className="h-8 text-xs font-bold border-border group-hover:border-[#2563EB] group-hover:text-[#2563EB] dark:group-hover:text-blue-400"
                      >
                        {item.situacao === "DEVOLVIDO"
                          ? "Consultar"
                          : item.isFailClosed
                          ? "Ver Bloqueio"
                          : "Analisar"}
                      </Button>
                    </div>
                  </div>

                  {/* Visão Mobile / Tablet (Cards Compactos) */}
                  <div className="lg:hidden space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {renderDominioBadge(item.dominio)}
                        <span className="font-mono text-xs font-bold text-foreground">
                          {item.codigo}
                        </span>
                      </div>
                      {renderSituacaoBadge(item.situacao, item.isFailClosed)}
                    </div>

                    <div>
                      <h4 className="font-bold text-sm text-foreground leading-tight">
                        {item.titulo}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {item.descricaoResumida}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Empresa:</span>
                        <span className="font-medium text-foreground">{item.empresaNome}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] text-muted-foreground block">Valor / Total:</span>
                        <span className="font-mono font-bold text-foreground">
                          {item.valorFormatado || formatCurrency(item.valorMonetario)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {itensFiltrados.length === 0 && (
              <div className="p-12 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
                <h3 className="text-sm font-bold text-foreground">Nenhuma decisão pendente encontrada</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  Não há itens aguardando autorização com os filtros selecionados no momento.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFiltroRapidoKpi(null);
                    setSituacaoFiltro("todos");
                    setDominioFiltro("TODAS");
                    setBusca("");
                    setEmpresaFiltro("all");
                  }}
                  className="text-xs mt-2"
                >
                  Restaurar Filtros Globais
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Drawer Lateral de Decisão Adaptativo */}
      <UxLabAprovacaoDrawer
        item={selectedItem}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAprovar={handleAprovar}
        onDevolver={handleDevolver}
      />
    </UxLabShell>
  );
}
