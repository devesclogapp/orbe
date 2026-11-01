import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  DollarSign,
  Download,
  Filter,
  Layers,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  TrendingUp,
  UserCheck,
  X,
  FileText,
  AlertTriangle,
  ArrowUpDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import {
  MOCK_TITULOS_INADIMPLENTES,
  TituloInadimplenteMock,
  ClienteInadimplenteResumo,
  FaixaAging,
  StatusReceitaInadimplente,
  ModalidadeReceitaReal,
  DATA_REFERENCIA_UX14,
  calcularDiasAtraso,
  calcularKpisInadimplencia,
  agruparInadimplenciaPorCliente,
  getFaixaAging,
  getFaixaAgingBadgeClass,
  getFaixaAgingLabel,
  getStatusCobrancaBadgeClass,
  getStatusCobrancaLabel,
  getModalidadeLabel,
} from "./inadimplenciaMockData";
import { UxLabInadimplenciaDrawer } from "@/components/ux-lab/UxLabInadimplenciaDrawer";
import { UxLabClienteInadimplenciaDrawer } from "@/components/ux-lab/UxLabClienteInadimplenciaDrawer";

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val || 0);

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "—";
  const [ano, mes, dia] = dateStr.split("-");
  return `${dia}/${mes}/${ano}`;
};

export default function UxLabInadimplencia() {
  const navigate = useNavigate();

  // Estado dos títulos (reativo para simulações locais)
  const [titulos, setTitulos] = useState<TituloInadimplenteMock[]>(MOCK_TITULOS_INADIMPLENTES);

  // Navegação de Visão (Tabs)
  const [activeTab, setActiveTab] = useState<"clientes" | "titulos">("clientes");

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCliente, setFilterCliente] = useState<string>("all");
  const [filterFaixa, setFilterFaixa] = useState<string>("all");
  const [filterModalidade, setFilterModalidade] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCompetencia, setFilterCompetencia] = useState<string>("all");

  // Ordenação
  const [sortOrder, setSortOrder] = useState<"maior_atraso" | "maior_valor" | "mais_antigo">("maior_atraso");

  // Drawers
  const [selectedCliente, setSelectedCliente] = useState<ClienteInadimplenteResumo | null>(null);
  const [selectedTitulo, setSelectedTitulo] = useState<TituloInadimplenteMock | null>(null);

  // 1. Títulos estritamente inadimplentes na data de referência
  const titulosInadimplentes = useMemo(() => {
    return titulos.filter((t) => {
      const dias = calcularDiasAtraso(t.vencimento, DATA_REFERENCIA_UX14);
      return dias >= 1;
    });
  }, [titulos]);

  // 2. KPIs de Aging Canônico
  const kpis = useMemo(() => {
    return calcularKpisInadimplencia(titulosInadimplentes, DATA_REFERENCIA_UX14);
  }, [titulosInadimplentes]);

  // 3. Clientes Agrupados
  const clientesAgrupados = useMemo(() => {
    return agruparInadimplenciaPorCliente(titulosInadimplentes, DATA_REFERENCIA_UX14);
  }, [titulosInadimplentes]);

  // Listas para Selects de Filtros
  const uniqueClientes = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of titulosInadimplentes) {
      map.set(t.empresaId, t.clienteNome);
    }
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [titulosInadimplentes]);

  const uniqueCompetencias = useMemo(() => {
    const set = new Set<string>();
    for (const t of titulosInadimplentes) {
      set.add(t.competencia);
    }
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [titulosInadimplentes]);

  // 4. Filtragem da Visão Por Cliente
  const filteredClientes = useMemo(() => {
    return clientesAgrupados.filter((c) => {
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesName = c.clienteNome.toLowerCase().includes(term);
        const matchesTitulo = c.titulos.some((t) => t.id.toLowerCase().includes(term));
        if (!matchesName && !matchesTitulo) return false;
      }
      if (filterCliente !== "all" && c.empresaId !== filterCliente) return false;
      if (filterFaixa !== "all") {
        if (filterFaixa === "1_30" && c.qtd_1_30 === 0) return false;
        if (filterFaixa === "31_60" && c.qtd_31_60 === 0) return false;
        if (filterFaixa === "61_90" && c.qtd_61_90 === 0) return false;
        if (filterFaixa === "mais_90" && c.qtd_mais_90 === 0) return false;
      }
      return true;
    });
  }, [clientesAgrupados, searchTerm, filterCliente, filterFaixa]);

  // 5. Filtragem da Visão Títulos em Atraso
  const filteredTitulos = useMemo(() => {
    let result = titulosInadimplentes.filter((t) => {
      const dias = calcularDiasAtraso(t.vencimento, DATA_REFERENCIA_UX14);
      const faixa = getFaixaAging(dias);

      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchesRef = t.id.toLowerCase().includes(term);
        const matchesCli = t.clienteNome.toLowerCase().includes(term);
        if (!matchesRef && !matchesCli) return false;
      }

      if (filterCliente !== "all" && t.empresaId !== filterCliente) return false;
      if (filterFaixa !== "all" && faixa !== filterFaixa) return false;
      if (filterModalidade !== "all" && t.modalidade !== filterModalidade) return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCompetencia !== "all" && t.competencia !== filterCompetencia) return false;

      return true;
    });

    // Ordenação
    if (sortOrder === "maior_atraso") {
      result.sort((a, b) => calcularDiasAtraso(b.vencimento, DATA_REFERENCIA_UX14) - calcularDiasAtraso(a.vencimento, DATA_REFERENCIA_UX14));
    } else if (sortOrder === "maior_valor") {
      result.sort((a, b) => b.valorTotal - a.valorTotal);
    } else if (sortOrder === "mais_antigo") {
      result.sort((a, b) => a.vencimento.localeCompare(b.vencimento));
    }

    return result;
  }, [titulosInadimplentes, searchTerm, filterCliente, filterFaixa, filterModalidade, filterStatus, filterCompetencia, sortOrder]);

  const hasActiveFilters =
    searchTerm !== "" ||
    filterCliente !== "all" ||
    filterFaixa !== "all" ||
    filterModalidade !== "all" ||
    filterStatus !== "all" ||
    filterCompetencia !== "all";

  const handleClearFilters = () => {
    setSearchTerm("");
    setFilterCliente("all");
    setFilterFaixa("all");
    setFilterModalidade("all");
    setFilterStatus("all");
    setFilterCompetencia("all");
  };

  // Simulação de Ação: Registrar Envio da Cobrança
  const handleRegistrarEnvio = (tituloId: string, observacao?: string) => {
    setTitulos((prev) =>
      prev.map((t) => {
        if (t.id === tituloId) {
          return {
            ...t,
            status: "cobranca_enviada" as StatusReceitaInadimplente,
            historico: [
              ...t.historico,
              {
                dataHora: "Hoje 10:00",
                acao: "Cobrança registrada como enviada",
                usuario: "Operador Financeiro",
                detalhes: observacao || "Registro de envio declarado no sistema.",
              },
            ],
          };
        }
        return t;
      })
    );

    // Atualizar título selecionado se estiver no drawer
    if (selectedTitulo && selectedTitulo.id === tituloId) {
      setSelectedTitulo((prev) =>
        prev
          ? {
              ...prev,
              status: "cobranca_enviada",
              historico: [
                ...prev.historico,
                {
                  dataHora: "Hoje 10:00",
                  acao: "Cobrança registrada como enviada",
                  usuario: "Operador Financeiro",
                  detalhes: observacao || "Registro de envio declarado no sistema.",
                },
              ],
            }
          : null
      );
    }
  };

  // Simulação de Ação: Alterar Vencimento
  const handleAlterarVencimento = (tituloId: string, novoVenc: string, justificativa?: string) => {
    const novosDias = calcularDiasAtraso(novoVenc, DATA_REFERENCIA_UX14);

    setTitulos((prev) =>
      prev.map((t) => {
        if (t.id === tituloId) {
          return {
            ...t,
            vencimento: novoVenc,
            historico: [
              ...t.historico,
              {
                dataHora: "Hoje 10:15",
                acao: "Vencimento alterado",
                usuario: "Operador Financeiro",
                detalhes: `Novo vencimento: ${formatDate(novoVenc)}. Justificativa: ${justificativa || "Acordo comercial"}`,
              },
            ],
          };
        }
        return t;
      })
    );

    if (novosDias <= 0) {
      toast.success("Vencimento alterado com sucesso!", {
        description: `O título #${tituloId} agora vence em ${formatDate(novoVenc)} e deixou de integrar a carteira inadimplente.`,
      });
      setSelectedTitulo(null);
    } else {
      toast.success("Vencimento atualizado com sucesso!", {
        description: `Novo atraso recalculado: ${novosDias} dias (${getFaixaAgingLabel(getFaixaAging(novosDias))}).`,
      });
      if (selectedTitulo && selectedTitulo.id === tituloId) {
        setSelectedTitulo((prev) =>
          prev
            ? {
                ...prev,
                vencimento: novoVenc,
                historico: [
                  ...prev.historico,
                  {
                    dataHora: "Hoje 10:15",
                    acao: "Vencimento alterado",
                    usuario: "Operador Financeiro",
                    detalhes: `Novo vencimento: ${formatDate(novoVenc)}. Justificativa: ${justificativa || "Acordo comercial"}`,
                  },
                ],
              }
            : null
        );
      }
    }
  };

  const handleResetDataset = () => {
    setTitulos(MOCK_TITULOS_INADIMPLENTES);
    toast.success("Dataset do UX Lab restaurado para o estado inicial.");
  };

  return (
    <UxLabShell activeItem="inadimplencia">
      <div className="w-full max-w-[1560px] mx-auto p-6 space-y-6">
        {/* Header da Página */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Inadimplência & Cobrança
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Gestão de títulos em atraso e aging de recebíveis.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3 py-1.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground flex items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>Data de Análise: <strong className="text-foreground">31/10/2026</strong> (Fotografia do Lab)</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs text-muted-foreground"
              onClick={handleResetDataset}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Dados
            </Button>
          </div>
        </div>

        {/* 1. KPI STRIP — 5 KPIs DE AGING CANÔNICO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* KPI 1: TOTAL INADIMPLENTE */}
          <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Inadimplente
              </span>
              <DollarSign className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground">
                {formatCurrency(kpis.totalInadimplente)}
              </p>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {kpis.quantidadeTotal} {kpis.quantidadeTotal === 1 ? "título em atraso" : "títulos em atraso"}
              </span>
            </div>
          </div>

          {/* KPI 2: 1 A 30 DIAS */}
          <div className="p-4 rounded-xl bg-card border border-amber-500/20 flex flex-col justify-between space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                1 a 30 dias
              </span>
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
                {formatCurrency(kpis.dias_1_30)}
              </p>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {kpis.qtd_1_30} {kpis.qtd_1_30 === 1 ? "título" : "títulos"} (Atraso Leve)
              </span>
            </div>
          </div>

          {/* KPI 3: 31 A 60 DIAS */}
          <div className="p-4 rounded-xl bg-card border border-orange-500/20 flex flex-col justify-between space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-700 dark:text-orange-400 uppercase tracking-wider">
                31 a 60 dias
              </span>
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-orange-700 dark:text-orange-300">
                {formatCurrency(kpis.dias_31_60)}
              </p>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {kpis.qtd_31_60} {kpis.qtd_31_60 === 1 ? "título" : "títulos"} (Atenção)
              </span>
            </div>
          </div>

          {/* KPI 4: 61 A 90 DIAS */}
          <div className="p-4 rounded-xl bg-card border border-rose-500/20 flex flex-col justify-between space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                61 a 90 dias
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-rose-700 dark:text-rose-300">
                {formatCurrency(kpis.dias_61_90)}
              </p>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {kpis.qtd_61_90} {kpis.qtd_61_90 === 1 ? "título" : "títulos"} (Grave)
              </span>
            </div>
          </div>

          {/* KPI 5: +90 DIAS */}
          <div className="p-4 rounded-xl bg-card border border-red-500/30 flex flex-col justify-between space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wider">
                +90 dias
              </span>
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                {formatCurrency(kpis.dias_mais_90)}
              </p>
              <span className="text-xs text-muted-foreground mt-0.5 block">
                {kpis.qtd_mais_90} {kpis.qtd_mais_90 === 1 ? "título" : "títulos"} (Crítico)
              </span>
            </div>
          </div>
        </div>

        {/* 2. INDICADOR SECUNDÁRIO — CONCENTRAÇÃO DA CARTEIRA */}
        <div className="p-3.5 rounded-xl bg-muted/30 border border-border flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">{formatCurrency(kpis.totalAcima60Dias)}</strong> ({kpis.percentualAcima60Dias}%) da carteira vencida está concentrada em títulos com mais de 60 dias de atraso ({kpis.qtdAcima60Dias} títulos).
            </span>
          </div>
        </div>

        {/* 3. NAVEGAÇÃO INTERNA & BARRA DE FILTROS */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Tabs de Visão */}
            <div className="inline-flex p-1 bg-muted/60 border border-border rounded-xl">
              <button
                type="button"
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "clientes"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("clientes")}
              >
                Por Cliente ({clientesAgrupados.length})
              </button>
              <button
                type="button"
                className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === "titulos"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setActiveTab("titulos")}
              >
                Títulos em Atraso ({titulosInadimplentes.length})
              </button>
            </div>

            {/* Ordenação rápida para Títulos */}
            {activeTab === "titulos" && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Ordenar:</span>
                <Select value={sortOrder} onValueChange={(v: any) => setSortOrder(v)}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="maior_atraso" className="text-xs">Maior atraso</SelectItem>
                    <SelectItem value="maior_valor" className="text-xs">Maior valor</SelectItem>
                    <SelectItem value="mais_antigo" className="text-xs">Vencimento antigo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* FilterBar Compacta */}
          <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por referência ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 pl-8 text-xs"
              />
            </div>

            {/* Filtro Cliente */}
            <Select value={filterCliente} onValueChange={setFilterCliente}>
              <SelectTrigger className="h-8 w-[170px] text-xs">
                <SelectValue placeholder="Todos os clientes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os clientes</SelectItem>
                {uniqueClientes.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-xs">{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Faixa de Aging */}
            <Select value={filterFaixa} onValueChange={setFilterFaixa}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Todas as faixas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todas as faixas</SelectItem>
                <SelectItem value="1_30" className="text-xs">1 a 30 dias</SelectItem>
                <SelectItem value="31_60" className="text-xs">31 a 60 dias</SelectItem>
                <SelectItem value="61_90" className="text-xs">61 a 90 dias</SelectItem>
                <SelectItem value="mais_90" className="text-xs">+90 dias</SelectItem>
              </SelectContent>
            </Select>

            {/* Filtros específicos para visualização de Títulos */}
            {activeTab === "titulos" && (
              <>
                {/* Modalidade */}
                <Select value={filterModalidade} onValueChange={setFilterModalidade}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue placeholder="Todas modalidades" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas modalidades</SelectItem>
                    <SelectItem value="CAIXA_IMEDIATO" className="text-xs">Caixa Imediato</SelectItem>
                    <SelectItem value="DUPLICATA" className="text-xs">Duplicata</SelectItem>
                    <SelectItem value="FATURAMENTO_MENSAL" className="text-xs">Faturamento Mensal</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status da Cobrança */}
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="h-8 w-[160px] text-xs">
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
                    <SelectItem value="pendente_cobranca" className="text-xs">Cobrança Pendente</SelectItem>
                    <SelectItem value="cobranca_gerada" className="text-xs">Cobrança Gerada</SelectItem>
                    <SelectItem value="cobranca_enviada" className="text-xs">Cobrança Enviada</SelectItem>
                    <SelectItem value="pendente_recebimento" className="text-xs">Aguardando Recebimento</SelectItem>
                    <SelectItem value="aguardando_fechamento" className="text-xs">Aguardando Fechamento</SelectItem>
                  </SelectContent>
                </Select>

                {/* Competência */}
                <Select value={filterCompetencia} onValueChange={setFilterCompetencia}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder="Competência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas competências</SelectItem>
                    {uniqueCompetencias.map((comp) => (
                      <SelectItem key={comp} value={comp} className="text-xs">{comp}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClearFilters}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>

        {/* 4. CONTEÚDO PRINCIPAL (TABELAS DENSAS) */}
        {activeTab === "clientes" ? (
          /* TABELA: VISÃO POR CLIENTE */
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-[320px] font-bold text-xs uppercase tracking-wider">Cliente (Tomador)</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Títulos</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Total em Atraso</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Título Mais Antigo</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Maior Atraso</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Faixa Mais Crítica</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      Nenhum cliente inadimplente encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClientes.map((c) => (
                    <TableRow
                      key={c.empresaId}
                      className="hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedCliente(c)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-foreground block">{c.clienteNome}</span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-medium text-xs text-foreground">
                        {c.quantidadeTitulos}
                      </TableCell>

                      <TableCell className="text-right font-bold text-xs text-red-600 dark:text-red-400">
                        {formatCurrency(c.totalInadimplente)}
                      </TableCell>

                      <TableCell className="text-center text-xs text-muted-foreground">
                        {formatDate(c.tituloMaisAntigoVencimento)}
                      </TableCell>

                      <TableCell className="text-center">
                        <span className="font-semibold text-xs text-amber-600 dark:text-amber-400">
                          {c.maiorAtrasoDias} dias
                        </span>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={`text-[11px] px-2 py-0.5 ${getFaixaAgingBadgeClass(c.faixaMaisCritica)}`}
                        >
                          {c.faixaMaisCriticaLabel}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCliente(c);
                          }}
                        >
                          Ver Posição
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        ) : (
          /* TABELA: VISÃO TÍTULOS EM ATRASO */
          <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Referência</TableHead>
                  <TableHead className="w-[280px] font-bold text-xs uppercase tracking-wider">Cliente</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Competência</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Vencimento</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Dias em Atraso</TableHead>
                  <TableHead className="font-bold text-xs uppercase tracking-wider">Modalidade</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Valor Total</TableHead>
                  <TableHead className="text-center font-bold text-xs uppercase tracking-wider">Status da Cobrança</TableHead>
                  <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTitulos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-sm">
                      Nenhum título em atraso encontrado com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTitulos.map((t) => {
                    const dias = calcularDiasAtraso(t.vencimento, DATA_REFERENCIA_UX14);
                    const faixa = getFaixaAging(dias);

                    return (
                      <TableRow
                        key={t.id}
                        className="hover:bg-muted/30 cursor-pointer transition-colors"
                        onClick={() => setSelectedTitulo(t)}
                      >
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-primary">{t.id}</span>
                        </TableCell>

                        <TableCell>
                          <span className="font-semibold text-xs text-foreground block truncate">{t.clienteNome}</span>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {t.competenciaFormatada}
                        </TableCell>

                        <TableCell className="text-xs text-foreground font-medium">
                          {formatDate(t.vencimento)}
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[11px] px-2 py-0.5 ${getFaixaAgingBadgeClass(faixa)}`}>
                            {dias} {dias === 1 ? "dia" : "dias"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-xs text-muted-foreground">
                          {getModalidadeLabel(t.modalidade)}
                        </TableCell>

                        <TableCell className="text-right font-bold text-xs text-red-600 dark:text-red-400">
                          {formatCurrency(t.valorTotal)}
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${getStatusCobrancaBadgeClass(t.status)}`}>
                            {getStatusCobrancaLabel(t.status)}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTitulo(t);
                            }}
                          >
                            Ver Título
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 5. DRAWERS DE DETALHAMENTO */}
        <UxLabClienteInadimplenciaDrawer
          isOpen={!!selectedCliente}
          onClose={() => setSelectedCliente(null)}
          cliente={selectedCliente}
          dataReferencia={DATA_REFERENCIA_UX14}
          onSelectTitulo={(titulo) => {
            setSelectedCliente(null);
            setSelectedTitulo(titulo);
          }}
        />

        <UxLabInadimplenciaDrawer
          isOpen={!!selectedTitulo}
          onClose={() => setSelectedTitulo(null)}
          titulo={selectedTitulo}
          dataReferencia={DATA_REFERENCIA_UX14}
          onRegistrarEnvio={handleRegistrarEnvio}
          onAlterarVencimento={handleAlterarVencimento}
          onNavigateToReceitas={(id) => {
            setSelectedTitulo(null);
            navigate("/ux-lab/receitas");
          }}
        />
      </div>
    </UxLabShell>
  );
}
