import React, { useState, useMemo } from "react";
import {
  Banknote,
  Search,
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  ArrowRight,
  AlertCircle,
  AlertTriangle,
  Eye,
  CheckCircle2,
  Info,
  Clock,
  ExternalLink,
  DollarSign,
  Download,
  Send,
  FileSpreadsheet,
  Check,
  ChevronRight,
  RefreshCw,
  XCircle,
  ShieldCheck,
  FileCheck,
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabMetricCard } from "@/components/ux-lab/UxLabMetricCard";
import { UxLabCentralBancariaDrawer } from "@/components/ux-lab/UxLabCentralBancariaDrawer";
import { UxLabImportarRetornoModal } from "@/components/ux-lab/UxLabImportarRetornoModal";
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
  ItemObrigacaoBancariaMock,
  OrigemBancaria,
  SituacaoBancaria,
  EstagioBancarioTab,
  MOCK_CENTRAL_BANCARIA_ITENS,
  calculateCentralBancariaKpiStats,
  getSituacaoBadge,
  getOrigemBadge,
} from "./centralBancariaMockData";

export default function UxLabCentralBancaria() {
  const navigate = useNavigate();

  // 1. Dataset State (Mock isolado com mutações locais determinísticas)
  const [items, setItems] = useState<ItemObrigacaoBancariaMock[]>(MOCK_CENTRAL_BANCARIA_ITENS);

  // 2. Filtros de Interface
  const [activeTab, setActiveTab] = useState<EstagioBancarioTab>("TODAS");
  const [busca, setBusca] = useState<string>("");
  const [origemFiltro, setOrigemFiltro] = useState<string>("TODAS");
  const [bancoFiltro, setBancoFiltro] = useState<string>("TODOS");
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>("TODAS");
  const [contaPagadoraFiltro, setContaPagadoraFiltro] = useState<string>("ALL");

  // Contexto Topbar
  const [empresaContexto, setEmpresaContexto] = useState<string>("emp-castanhal");
  const [competenciaContexto, setCompetenciaContexto] = useState<string>("2026-10");

  // 3. Modais & Drawers
  const [selectedItem, setSelectedItem] = useState<ItemObrigacaoBancariaMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [retornoModalOpen, setRetornoModalOpen] = useState<boolean>(false);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  // 4. KPIs Principais (Integridade Matemática Derivada do Dataset)
  const kpiStats = useMemo(() => {
    return calculateCentralBancariaKpiStats(items);
  }, [items]);

  // 5. Lista de Contas Pagadoras para Filtro
  const contasPagadorasOptions = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((it) => {
      const label = `${it.contaPagadora.bancoNome} (${it.contaPagadora.contaMascarada})`;
      map.set(it.contaPagadora.id, label);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [items]);

  // 6. Filtragem Reativa da Tabela
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Filtro por Tab de Estágio
      if (activeTab === "PRONTAS_BANCO" && item.situacao !== "PRONTO_BANCO") {
        return false;
      }
      if (
        activeTab === "REMESSAS" &&
        item.situacao !== "REMESSA_GERADA" &&
        item.situacao !== "ARQUIVO_BAIXADO"
      ) {
        return false;
      }
      if (
        activeTab === "AGUARDANDO_RETORNO" &&
        item.situacao !== "ENVIADO_MANUAL"
      ) {
        return false;
      }
      if (
        activeTab === "CONCILIACAO" &&
        item.situacao !== "LIQUIDADO" &&
        item.situacao !== "CONCILIADO"
      ) {
        return false;
      }
      if (
        activeTab === "PENDENCIAS" &&
        item.situacao !== "REJEITADO" &&
        item.situacao !== "DIVERGENTE"
      ) {
        return false;
      }

      // Filtro por Origem
      if (origemFiltro !== "TODAS" && item.origemTipo !== origemFiltro) {
        return false;
      }

      // Filtro por Banco
      if (bancoFiltro !== "TODOS" && item.contaPagadora.bancoCodigo !== bancoFiltro) {
        return false;
      }

      // Filtro por Situação
      if (situacaoFiltro !== "TODAS" && item.situacao !== situacaoFiltro) {
        return false;
      }

      // Filtro por Conta Pagadora
      if (contaPagadoraFiltro !== "ALL" && item.contaPagadora.id !== contaPagadoraFiltro) {
        return false;
      }

      // Filtro por Busca Textual (referência, lote, favorecido, remessa, nsa)
      if (busca.trim() !== "") {
        const query = busca.toLowerCase();
        const matchRef = item.referencia.toLowerCase().includes(query);
        const matchLote = item.loteCodigo ? item.loteCodigo.toLowerCase().includes(query) : false;
        const matchRemessa = item.remessaNumero ? item.remessaNumero.toLowerCase().includes(query) : false;
        const matchNsa = item.remessaNsa ? item.remessaNsa.toString().includes(query) : false;
        const matchFavorecido = item.favorecidoDescricao.toLowerCase().includes(query);
        const matchEmpresa = item.empresaNome.toLowerCase().includes(query);

        if (!matchRef && !matchLote && !matchRemessa && !matchNsa && !matchFavorecido && !matchEmpresa) {
          return false;
        }
      }

      return true;
    });
  }, [items, activeTab, origemFiltro, bancoFiltro, situacaoFiltro, contaPagadoraFiltro, busca]);

  // Contadores por Tab
  const tabCounts = useMemo(() => {
    return {
      TODAS: items.length,
      PRONTAS_BANCO: items.filter((i) => i.situacao === "PRONTO_BANCO").length,
      REMESSAS: items.filter((i) => i.situacao === "REMESSA_GERADA" || i.situacao === "ARQUIVO_BAIXADO").length,
      AGUARDANDO_RETORNO: items.filter((i) => i.situacao === "ENVIADO_MANUAL").length,
      CONCILIACAO: items.filter((i) => i.situacao === "LIQUIDADO" || i.situacao === "CONCILIADO").length,
      PENDENCIAS: items.filter((i) => i.situacao === "REJEITADO" || i.situacao === "DIVERGENTE").length,
    };
  }, [items]);

  const openDrawer = (item: ItemObrigacaoBancariaMock) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const handleItemUpdated = (updated: ItemObrigacaoBancariaMock) => {
    setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
    setSelectedItem(updated);
  };

  const resetFilters = () => {
    setActiveTab("TODAS");
    setBusca("");
    setOrigemFiltro("TODAS");
    setBancoFiltro("TODOS");
    setSituacaoFiltro("TODAS");
    setContaPagadoraFiltro("ALL");
    toast.info("Filtros redefinidos");
  };

  return (
    <UxLabShell
      activeItem="central-bancaria"
      title="Central Bancária & CNAB"
      subtitle="Remessas, retornos e conciliação dos pagamentos bancarizados."
      breadcrumbs={[
        { label: "Financeiro & Controladoria", href: "/ux-lab/receitas" },
        { label: "Central Bancária & CNAB", active: true },
      ]}
      topbarActions={
        <div className="flex items-center gap-2">
          {/* Empresa Contexto Mock */}
          <Select value={empresaContexto} onValueChange={setEmpresaContexto}>
            <SelectTrigger className="h-8 text-xs w-[210px] bg-background border-border/80">
              <Building2 className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Selecione a Empresa" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="emp-castanhal" className="text-xs">
                ESC Logística — Matriz Castanhal
              </SelectItem>
              <SelectItem value="emp-belem" className="text-xs">
                ESC Logística — Filial Belém
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Período Contexto Mock */}
          <Select value={competenciaContexto} onValueChange={setCompetenciaContexto}>
            <SelectTrigger className="h-8 text-xs w-[140px] bg-background border-border/80">
              <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Competência" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026-10" className="text-xs">
                Outubro / 2026
              </SelectItem>
              <SelectItem value="2026-09" className="text-xs">
                Setembro / 2026
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Botão Atualizar */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setItems(MOCK_CENTRAL_BANCARIA_ITENS);
              toast.success("Dados da Central Bancária atualizados (Mock)");
            }}
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            Atualizar
          </Button>

          {/* Botão Importar Retorno CTA Direto */}
          <Button
            size="sm"
            onClick={() => setRetornoModalOpen(true)}
            className="h-8 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white"
          >
            <UploadCloudIcon className="h-3.5 w-3.5 mr-1.5" />
            Importar Retorno
          </Button>
        </div>
      }
    >
      <div className="max-w-[1560px] mx-auto space-y-5 px-6 py-5">
        {/* ========================================================================= */}
        {/* 1. SEÇÃO DE KPIS PRINCIPAIS (DERIVADOS MATEMATICAMENTE DO DATASET) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: PRONTAS PARA BANCO */}
          <UxLabMetricCard
            label="PRONTAS PARA BANCO"
            value={formatCurrency(kpiStats.prontasValor)}
            subtitle={`${kpiStats.prontasQtdLotes} lotes homologados sem remessa`}
            icon={Clock}
            badge={{ text: "Aguardando Remessa", variant: "neutral" }}
          />

          {/* KPI 2: EM TRÂNSITO BANCÁRIO */}
          <UxLabMetricCard
            label="EM TRÂNSITO BANCÁRIO"
            value={formatCurrency(kpiStats.emTransitoValor)}
            subtitle={`${kpiStats.emTransitoBaixadasQtd} remessas baixadas • ${kpiStats.emTransitoEnviadasQtd} enviadas`}
            icon={Send}
            badge={{ text: "No Banco / Em Trânsito", variant: "info" }}
          />

          {/* KPI 3: LIQUIDADAS NO PERÍODO */}
          <UxLabMetricCard
            label="LIQUIDADAS NO PERÍODO"
            value={formatCurrency(kpiStats.liquidadasValor)}
            subtitle={`${kpiStats.liquidadasQtdItens} pagamentos com retorno confirmado`}
            icon={CheckCircle2}
            badge={{ text: "Retorno OK", variant: "success" }}
          />

          {/* KPI 4: PENDÊNCIAS BANCÁRIAS (BREAKDOWN OBRIGATÓRIO) */}
          <UxLabMetricCard
            label="PENDÊNCIAS BANCÁRIAS"
            value={formatCurrency(kpiStats.pendenciasValor)}
            subtitle={`${kpiStats.pendenciasRejeitadosQtd} rejeitados • ${kpiStats.pendenciasDivergentesQtd} divergentes`}
            icon={AlertTriangle}
            badge={{
              text: kpiStats.pendenciasQtdTotal > 0 ? "Atenção Operacional" : "Sem Pendências",
              variant: kpiStats.pendenciasQtdTotal > 0 ? "destructive" : "neutral",
            }}
          />
        </div>

        {/* ========================================================================= */}
        {/* 2. FAIXA OPERACIONAL SECUNDÁRIA (INDICADOR DE ATENÇÃO / RETORNO) */}
        {/* ========================================================================= */}
        {kpiStats.emTransitoEnviadasQtd > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-blue-200/80 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                <FileCheck className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-foreground">
                  {kpiStats.emTransitoEnviadasQtd} remessas enviadas aguardam arquivo de retorno bancário
                </span>
                <span className="text-[11px] text-muted-foreground block sm:inline sm:ml-2">
                  (Total em trânsito com envio confirmado: {formatCurrency(items.filter(i => i.situacao === 'ENVIADO_MANUAL').reduce((acc, c) => acc + c.valorTotal, 0))})
                </span>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setRetornoModalOpen(true)}
              className="h-7 text-xs font-semibold border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-950/50 shrink-0"
            >
              <UploadCloudIcon className="mr-1.5 h-3.5 w-3.5 text-blue-600" />
              Importar Retorno
            </Button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TABS DE ESTÁGIO BANCÁRIO (NÃO FRAGMENTAR POR ORIGEM!) */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-1 border-b border-border/80 pb-2 overflow-x-auto">
          {[
            { id: "TODAS", label: "Todas as Obrigações", count: tabCounts.TODAS },
            { id: "PRONTAS_BANCO", label: "Prontas para Banco", count: tabCounts.PRONTAS_BANCO },
            { id: "REMESSAS", label: "Remessas", count: tabCounts.REMESSAS },
            { id: "AGUARDANDO_RETORNO", label: "Aguardando Retorno", count: tabCounts.AGUARDANDO_RETORNO },
            { id: "CONCILIACAO", label: "Conciliação / Liquidadas", count: tabCounts.CONCILIACAO },
            { id: "PENDENCIAS", label: "Pendências (Rejeições / Divergências)", count: tabCounts.PENDENCIAS, isCritical: tabCounts.PENDENCIAS > 0 },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as EstagioBancarioTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold shadow-sm dark:bg-white/[0.08] dark:text-[#F1F3F5] dark:border dark:border-blue-500/40"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`inline-flex items-center justify-center text-[10px] font-bold rounded-full px-1.5 py-0.2 ${
                    isActive
                      ? "bg-white/20 text-white dark:bg-blue-500/30 dark:text-blue-200"
                      : tab.isCritical
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 4. LINHA COMPACTA DE FILTROS */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 p-3 rounded-lg border border-border bg-card">
          {/* Busca textual */}
          <div className="md:col-span-4 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar por ref., lote, favorecido, remessa, NSA..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 text-xs bg-background"
            />
          </div>

          {/* Filtro Origem */}
          <div className="md:col-span-2">
            <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS" className="text-xs">Origem: Todas</SelectItem>
                <SelectItem value="CLT" className="text-xs">CLT</SelectItem>
                <SelectItem value="DIARISTAS" className="text-xs">Diaristas</SelectItem>
                <SelectItem value="INTERMITENTES" className="text-xs">Intermitentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Banco */}
          <div className="md:col-span-2">
            <Select value={bancoFiltro} onValueChange={setBancoFiltro}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Banco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS" className="text-xs">Banco: Todos</SelectItem>
                <SelectItem value="001" className="text-xs">001 — Banco do Brasil</SelectItem>
                <SelectItem value="341" className="text-xs">341 — Itaú Unibanco</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Situação */}
          <div className="md:col-span-2">
            <Select value={situacaoFiltro} onValueChange={setSituacaoFiltro}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS" className="text-xs">Situação: Todas</SelectItem>
                <SelectItem value="PRONTO_BANCO" className="text-xs">Pronto para Banco</SelectItem>
                <SelectItem value="REMESSA_GERADA" className="text-xs">Remessa Gerada</SelectItem>
                <SelectItem value="ARQUIVO_BAIXADO" className="text-xs">Arquivo Baixado</SelectItem>
                <SelectItem value="ENVIADO_MANUAL" className="text-xs">Enviado ao Banco</SelectItem>
                <SelectItem value="LIQUIDADO" className="text-xs">Liquidado</SelectItem>
                <SelectItem value="CONCILIADO" className="text-xs">Conciliado</SelectItem>
                <SelectItem value="REJEITADO" className="text-xs">Rejeitado</SelectItem>
                <SelectItem value="DIVERGENTE" className="text-xs">Divergente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Filtro Conta Pagadora / Botão Limpar */}
          <div className="md:col-span-2 flex items-center gap-1.5">
            <Select value={contaPagadoraFiltro} onValueChange={setContaPagadoraFiltro}>
              <SelectTrigger className="h-8 text-xs bg-background flex-1">
                <SelectValue placeholder="Conta Pagadora" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">Conta: Todas</SelectItem>
                {contasPagadorasOptions.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id} className="text-xs">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="ghost"
              size="icon"
              onClick={resetFilters}
              title="Limpar Filtros"
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. TABELA PRINCIPAL DENSA E PROFISSIONAL (DESKTOP-FIRST) */}
        {/* ========================================================================= */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/50 border-b border-border text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3">REFERÊNCIA / LOTE</th>
                  <th className="py-2.5 px-3">ORIGEM</th>
                  <th className="py-2.5 px-3">EMPRESA / FAVORECIDOS</th>
                  <th className="py-2.5 px-3">BANCO / CONTA PAGADORA</th>
                  <th className="py-2.5 px-3">COMPETÊNCIA</th>
                  <th className="py-2.5 px-3 text-right">VALOR</th>
                  <th className="py-2.5 px-3 text-center">SITUAÇÃO BANCÁRIA</th>
                  <th className="py-2.5 px-3 text-right">AÇÃO</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-sans">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/50 stroke-[1.5]" />
                        <p className="text-xs font-medium text-foreground">Nenhuma obrigação bancária encontrada.</p>
                        <p className="text-[11px] text-muted-foreground">
                          Ajuste os filtros ou selecione outra aba de estágio bancário.
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={resetFilters}
                          className="mt-2 h-7 text-xs"
                        >
                          Limpar Filtros
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const sitBadge = getSituacaoBadge(item.situacao);
                    const origBadge = getOrigemBadge(item.origemTipo);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-muted/30 transition-colors group cursor-pointer"
                        onClick={() => openDrawer(item)}
                      >
                        {/* 1. Referência / Lote */}
                        <td className="py-2.5 px-3 font-mono font-medium text-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{item.referencia}</span>
                            {item.remessaNumero && (
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({item.remessaNumero})
                              </span>
                            )}
                          </div>
                          {item.remessaNsa && (
                            <div className="text-[10px] text-muted-foreground font-mono">
                              NSA: {String(item.remessaNsa).padStart(6, "0")}
                            </div>
                          )}
                        </td>

                        {/* 2. Origem (Badge Neutro) */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${origBadge.className}`}
                          >
                            {origBadge.label}
                          </span>
                        </td>

                        {/* 3. Empresa / Favorecidos */}
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-foreground truncate max-w-[200px]">
                            {item.empresaNome}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                            {item.favorecidoDescricao}
                          </div>
                        </td>

                        {/* 4. Banco / Conta Pagadora Mascarada */}
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-foreground font-medium">
                            <Building2 className="h-3 w-3 text-blue-600 shrink-0" />
                            <span>{item.contaPagadora.bancoNome}</span>
                          </div>
                          <div className="text-[10px] font-mono text-muted-foreground">
                            {item.contaPagadora.agenciaMascarada} • {item.contaPagadora.contaMascarada}
                          </div>
                        </td>

                        {/* 5. Competência */}
                        <td className="py-2.5 px-3 text-muted-foreground whitespace-nowrap font-mono text-[11px]">
                          {item.competencia}
                        </td>

                        {/* 6. Valor */}
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground whitespace-nowrap">
                          {formatCurrency(item.valorTotal)}
                          {item.situacao === "DIVERGENTE" && item.valorRetornado && (
                            <div className="text-[10px] text-amber-600 dark:text-amber-400 font-normal">
                              Retornado: {formatCurrency(item.valorRetornado)}
                            </div>
                          )}
                        </td>

                        {/* 7. Situação Bancária (Badge Semântico) */}
                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${sitBadge.className}`}
                          >
                            {sitBadge.label}
                          </span>
                          {item.situacao === "REJEITADO" && item.motivoRejeicaoCodigo && (
                            <div className="text-[10px] text-rose-600 dark:text-rose-400 font-mono mt-0.5">
                              Cód. {item.motivoRejeicaoCodigo}
                            </div>
                          )}
                        </td>

                        {/* 8. Ação Contextual */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          {item.situacao === "PRONTO_BANCO" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-semibold text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              Gerar Remessa
                              <ChevronRight className="ml-1 h-3 w-3" />
                            </Button>
                          )}

                          {item.situacao === "REMESSA_GERADA" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-semibold text-foreground hover:bg-muted"
                            >
                              <Download className="mr-1 h-3 w-3 text-blue-600" />
                              Baixar Arquivo
                            </Button>
                          )}

                          {item.situacao === "ARQUIVO_BAIXADO" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-semibold text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                            >
                              <Send className="mr-1 h-3 w-3 text-blue-600" />
                              Marcar Enviado
                            </Button>
                          )}

                          {item.situacao === "ENVIADO_MANUAL" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              Aguardando Retorno
                            </Button>
                          )}

                          {(item.situacao === "LIQUIDADO" || item.situacao === "CONCILIADO") && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            >
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                              Ver Detalhes
                            </Button>
                          )}

                          {item.situacao === "REJEITADO" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-bold text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                            >
                              <XCircle className="mr-1 h-3 w-3 text-rose-600" />
                              Tratar Rejeição
                            </Button>
                          )}

                          {item.situacao === "DIVERGENTE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openDrawer(item)}
                              className="h-7 text-[11px] font-bold text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-900 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                            >
                              <AlertTriangle className="mr-1 h-3 w-3 text-amber-600" />
                              Revisar Conciliação
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer da Tabela com Resumo de Linhas e Totalizador */}
          <div className="p-3 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between text-xs text-muted-foreground gap-2">
            <div>
              Mostrando <span className="font-semibold text-foreground">{filteredItems.length}</span> de{" "}
              <span className="font-semibold text-foreground">{items.length}</span> obrigações bancárias
            </div>
            <div className="flex items-center gap-3">
              <span>Soma dos Itens Filtrados:</span>
              <span className="font-mono font-bold text-foreground text-sm">
                {formatCurrency(filteredItems.reduce((acc, curr) => acc + curr.valorTotal, 0))}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 6. DRAWER MULTI-ESTÁGIO E MODAIS */}
        {/* ========================================================================= */}
        <UxLabCentralBancariaDrawer
          item={selectedItem}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onItemUpdated={handleItemUpdated}
          onOpenImportarRetorno={() => setRetornoModalOpen(true)}
        />

        <UxLabImportarRetornoModal
          open={retornoModalOpen}
          onOpenChange={setRetornoModalOpen}
          onProcessedSuccess={() => {
            // Em caso de sucesso, movemos o item ENVIADO_MANUAL de teste para retorno
            setItems((prev) =>
              prev.map((it) => {
                if (it.situacao === "ENVIADO_MANUAL" && it.id === "OBR-ENV-001") {
                  return {
                    ...it,
                    situacao: "LIQUIDADO",
                    retornoData: new Date().toISOString().split("T")[0],
                  };
                }
                return it;
              })
            );
          }}
        />
      </div>
    </UxLabShell>
  );
}

function UploadCloudIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}
