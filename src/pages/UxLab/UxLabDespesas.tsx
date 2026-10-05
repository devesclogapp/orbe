import React, { useState, useMemo } from "react";
import {
  Wallet,
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
  Banknote,
  FileText,
  Users,
  ShieldCheck,
  Check,
  ChevronRight,
  TrendingDown,
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabMetricCard } from "@/components/ux-lab/UxLabMetricCard";
import { UxLabDespesaDrawer } from "@/components/ux-lab/UxLabDespesaDrawer";
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
  DespesaObrigacaoMock,
  OrigemDespesa,
  TipoDespesa,
  SituacaoFinanceiraUX,
  MOCK_DESPESAS_OBRIGACOES,
  calculateDespesasKpiStats,
  getSituacaoBadge,
  getOrigemLabel,
  getTipoLabel,
  calcularDiasVencimento,
} from "./despesasMockData";

export default function UxLabDespesas() {
  const navigate = useNavigate();

  // 1. Dataset State (Mock Only — mutações locais determinísticas)
  const [despesas, setDespesas] = useState<DespesaObrigacaoMock[]>(MOCK_DESPESAS_OBRIGACOES);

  // 2. Filtros de Interface
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>("TODAS");
  const [origemFiltro, setOrigemFiltro] = useState<string>("TODAS");
  const [tipoFiltro, setTipoFiltro] = useState<string>("TODOS");
  const [beneficiarioFiltro, setBeneficiarioFiltro] = useState<string>("ALL");
  const [busca, setBusca] = useState<string>("");

  // Contexto Topbar
  const [empresaContexto, setEmpresaContexto] = useState<string>("emp-castanhal");
  const [competenciaContexto, setCompetenciaContexto] = useState<string>("2026-10");

  // 3. Drawer de Detalhes
  const [selectedDespesa, setSelectedDespesa] = useState<DespesaObrigacaoMock | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  const formatCurrency = (val: number) => {
    return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  };

  // 4. KPIs Principais (Integridade Matemática com Helpers Derivados)
  const kpiStats = useMemo(() => {
    return calculateDespesasKpiStats(despesas);
  }, [despesas]);

  // 5. Lista Única de Beneficiários para Dropdown
  const beneficiariosOptions = useMemo(() => {
    const list = Array.from(new Set(despesas.map((d) => d.beneficiarioNome))).sort();
    return list;
  }, [despesas]);

  // 6. Filtragem Reativa da Tabela
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((item) => {
      // 1. Filtro de Situação (Pills Rápidas)
      if (situacaoFiltro !== "TODAS") {
        if (situacaoFiltro === "AGUARDANDO_LIBERACAO" && item.situacao !== "AGUARDANDO_LIBERACAO") {
          return false;
        }
        if (situacaoFiltro === "A_PAGAR" && item.situacao !== "A_PAGAR") {
          return false;
        }
        if (situacaoFiltro === "PRONTA_BANCO" && item.situacao !== "PRONTA_BANCO") {
          return false;
        }
        if (situacaoFiltro === "PAGA" && item.situacao !== "PAGA") {
          return false;
        }
      }

      // 2. Filtro de Origem
      if (origemFiltro !== "TODAS" && item.origem !== origemFiltro) {
        return false;
      }

      // 3. Filtro de Tipo
      if (tipoFiltro !== "TODOS" && item.tipo !== tipoFiltro) {
        return false;
      }

      // 4. Filtro de Beneficiário
      if (beneficiarioFiltro !== "ALL" && item.beneficiarioNome !== beneficiarioFiltro) {
        return false;
      }

      // 5. Busca Textual
      if (busca.trim() !== "") {
        const query = busca.toLowerCase();
        const matchCodigo = item.codigo.toLowerCase().includes(query);
        const matchBeneficiario = item.beneficiarioNome.toLowerCase().includes(query);
        const matchTitulo = item.titulo.toLowerCase().includes(query);
        const matchDescricao = item.descricao.toLowerCase().includes(query);
        const matchDoc = item.beneficiarioDocumento?.toLowerCase().includes(query) || false;

        if (!matchCodigo && !matchBeneficiario && !matchTitulo && !matchDescricao && !matchDoc) {
          return false;
        }
      }

      return true;
    });
  }, [despesas, situacaoFiltro, origemFiltro, tipoFiltro, beneficiarioFiltro, busca]);

  const handleOpenDrawer = (item: DespesaObrigacaoMock) => {
    setSelectedDespesa(item);
    setDrawerOpen(true);
  };

  const handleDespesaUpdated = (atualizada: DespesaObrigacaoMock) => {
    setDespesas((prev) => prev.map((d) => (d.id === atualizada.id ? atualizada : d)));
    setSelectedDespesa(atualizada);
  };

  const handleResetFilters = () => {
    setSituacaoFiltro("TODAS");
    setOrigemFiltro("TODAS");
    setTipoFiltro("TODOS");
    setBeneficiarioFiltro("ALL");
    setBusca("");
    toast.info("Filtros redefinidos");
  };

  return (
    <UxLabShell
      title="Central de Despesas & Contas a Pagar"
      subtitle="Gestão de obrigações, desembolsos e contas a pagar."
      activeItem="despesas"
      periodoLabel="Período Financeiro"
      empresa={empresaContexto}
      onEmpresaChange={setEmpresaContexto}
      competencia={competenciaContexto}
      onCompetenciaChange={setCompetenciaContexto}
      onRefresh={() => {
        setDespesas(MOCK_DESPESAS_OBRIGACOES);
        toast.success("Dados recarregados com sucesso");
      }}
    >
      <div className="space-y-6">
        {/* ── 4 KPIS PRINCIPAIS ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: DESPESAS NO PERÍODO (Royal Blue Institucional) */}
          <UxLabMetricCard
            label="Despesas no Período"
            value={formatCurrency(kpiStats.despesasNoPeriodo)}
            subtitle="Obrigações e desembolsos movimentados no período financeiro"
            icon={TrendingDown}
            badge={{ text: "ECONÔMICO", variant: "neutral" }}
            className="cursor-pointer hover:border-primary/60 transition-all"
            onClick={() => setSituacaoFiltro("TODAS")}
          />

          {/* KPI 2: A PAGAR (Obrigações ativas pendentes) */}
          <UxLabMetricCard
            label="A Pagar"
            value={formatCurrency(kpiStats.aPagar)}
            subtitle={`${kpiStats.qtdAPagar} pendentes de liquidação`}
            icon={Wallet}
            badge={{ text: "PENDENTE", variant: "warning" }}
            className="cursor-pointer hover:border-amber-400 transition-all"
            onClick={() => setSituacaoFiltro("A_PAGAR")}
          />

          {/* KPI 3: PRONTAS PARA EXECUÇÃO (Validadas para avanço financeiro) */}
          <UxLabMetricCard
            label="Prontas para Execução"
            value={formatCurrency(kpiStats.prontasExecucao)}
            subtitle={`${formatCurrency(kpiStats.prontasLiquidacaoDireta)} liquidação direta • ${formatCurrency(kpiStats.prontasViaBanco)} via banco`}
            icon={Clock}
            badge={{ text: "ELEGÍVEL", variant: "info" }}
            className="cursor-pointer hover:border-blue-400 transition-all"
            onClick={() => setSituacaoFiltro("PRONTA_BANCO")}
          />

          {/* KPI 4: PAGAS / LIQUIDADAS (Emerald Semantic) */}
          <UxLabMetricCard
            label="Pagas / Liquidadas"
            value={formatCurrency(kpiStats.pagasLiquidadas)}
            subtitle={`${kpiStats.qtdPagasLiquidadas} liquidadas ou desembolsadas`}
            icon={CheckCircle2}
            badge={{ text: "LIQUIDADO", variant: "success" }}
            className="cursor-pointer hover:border-emerald-400 transition-all"
            onClick={() => setSituacaoFiltro("PAGA")}
          />
        </div>

        {/* ── INDICADOR SECUNDÁRIO BANCÁRIO ───────────────────────────────────── */}
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in duration-300">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
              <Banknote className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-indigo-950 dark:text-indigo-200">
                <strong className="font-bold text-foreground">
                  {formatCurrency(kpiStats.maoDeObraProntaBanco)}
                </strong>{" "}
                em obrigações de mão de obra estão prontas para processamento bancário.
              </p>
              <p className="text-indigo-800/80 dark:text-indigo-300/80 text-[11px] mt-0.5">
                {kpiStats.qtdProntasBanco} lote(s) homologados pelo RH aguardando geração de Remessa CNAB 240.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold bg-white hover:bg-indigo-100/60 text-indigo-900 border-indigo-300 dark:bg-card dark:text-indigo-200 dark:border-indigo-800 shrink-0 gap-1.5 shadow-2xs"
            onClick={() => navigate("/bancario")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir Central Bancária
          </Button>
        </div>

        {/* ── PAINEL DE CONTROLE / FILTROS E TABELA ──────────────────────────── */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-xs">
          {/* BARRA SUPERIOR: PILLS DE SITUAÇÃO FINANCEIRA */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-border">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
              {[
                { id: "TODAS", label: "Todas", count: despesas.length },
                {
                  id: "AGUARDANDO_LIBERACAO",
                  label: "Aguardando Liberação",
                  count: despesas.filter((d) => d.situacao === "AGUARDANDO_LIBERACAO").length,
                },
                {
                  id: "A_PAGAR",
                  label: "A Pagar",
                  count: despesas.filter((d) => d.situacao === "A_PAGAR").length,
                },
                {
                  id: "PRONTA_BANCO",
                  label: "Prontas p/ Banco",
                  count: despesas.filter((d) => d.situacao === "PRONTA_BANCO").length,
                },
                {
                  id: "PAGA",
                  label: "Pagas",
                  count: despesas.filter((d) => d.situacao === "PAGA").length,
                },
              ].map((pill) => (
                <button
                  key={pill.id}
                  onClick={() => setSituacaoFiltro(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                    situacaoFiltro === pill.id
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      situacaoFiltro === pill.id
                        ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                        : "bg-muted-foreground/15 text-muted-foreground"
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="text-xs text-muted-foreground self-end md:self-auto font-medium">
              Exibindo <strong className="text-foreground">{despesasFiltradas.length}</strong> de{" "}
              {despesas.length} obrigações
            </div>
          </div>

          {/* BARRA DE FILTROS AVANÇADOS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            {/* 1. Busca */}
            <div className="lg:col-span-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Buscar referência, beneficiário ou documento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-8 text-xs h-9 bg-background"
              />
            </div>

            {/* 2. Filtro de Origem */}
            <div className="lg:col-span-2">
              <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODAS">Todas as Origens</SelectItem>
                  <SelectItem value="CUSTOS_EXTRAS">Custos Extras</SelectItem>
                  <SelectItem value="DIARISTAS">Diaristas</SelectItem>
                  <SelectItem value="INTERMITENTES">Intermitentes</SelectItem>
                  <SelectItem value="CLT">CLT / Folha</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Filtro de Tipo */}
            <div className="lg:col-span-2">
              <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="Tipo de Gasto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos os Tipos</SelectItem>
                  <SelectItem value="PAGO_EMPRESA">Pago pela Empresa</SelectItem>
                  <SelectItem value="REEMBOLSO_COLABORADOR">Reembolso</SelectItem>
                  <SelectItem value="PAGAMENTO_PENDENTE">Fornecedor / Boleto</SelectItem>
                  <SelectItem value="MAO_DE_OBRA">Mão de Obra</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 4. Filtro de Beneficiário */}
            <div className="lg:col-span-3">
              <Select value={beneficiarioFiltro} onValueChange={setBeneficiarioFiltro}>
                <SelectTrigger className="text-xs h-9 bg-background">
                  <SelectValue placeholder="Beneficiário" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Beneficiários</SelectItem>
                  {beneficiariosOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 5. Botão Reset */}
            <div className="lg:col-span-1">
              <Button
                variant="outline"
                size="sm"
                className="w-full h-9 text-xs"
                onClick={handleResetFilters}
                title="Limpar filtros"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* TABELA FINANCEIRA DENSA */}
          <div className="rounded-xl border border-border overflow-x-auto bg-background">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Obrigação / Referência</th>
                  <th className="py-3 px-3">Origem</th>
                  <th className="py-3 px-4">Beneficiário</th>
                  <th className="py-3 px-3 text-center">Competência</th>
                  <th className="py-3 px-3">Vencimento / Período</th>
                  <th className="py-3 px-4 text-right">Valor</th>
                  <th className="py-3 px-3 text-center">Situação</th>
                  <th className="py-3 px-4 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {despesasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground italic">
                      Nenhuma obrigação encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  despesasFiltradas.map((item) => {
                    const badge = getSituacaoBadge(item.situacao, item.dataVencimento);
                    const { isVencido, diasAtraso } = calcularDiasVencimento(
                      item.dataVencimento,
                      item.situacao
                    );

                    return (
                      <tr
                        key={item.id}
                        onClick={() => handleOpenDrawer(item)}
                        className="hover:bg-muted/30 transition-colors cursor-pointer group"
                      >
                        {/* 1. Obrigação / Referência */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                            <span className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                              {item.codigo}
                            </span>
                            <span className="truncate max-w-[200px]">{item.titulo}</span>
                          </div>
                          <span className="text-[11px] text-muted-foreground block truncate max-w-[240px] mt-0.5">
                            {item.descricao}
                          </span>
                        </td>

                        {/* 2. Origem */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {getOrigemLabel(item.origem)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            {getTipoLabel(item.tipo)}
                          </span>
                        </td>

                        {/* 3. Beneficiário */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-foreground block truncate max-w-[180px]">
                            {item.beneficiarioNome}
                          </span>
                          {item.beneficiarioDocumento && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {item.beneficiarioDocumento}
                            </span>
                          )}
                        </td>

                        {/* 4. Competência */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-medium text-muted-foreground">
                          {item.competenciaFormatada}
                        </td>

                        {/* 5. Vencimento / Período */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.tipo === "PAGAMENTO_PENDENTE" ? (
                            <div>
                              <span className="font-mono text-foreground font-medium">
                                {formatDate(item.dataVencimento)}
                              </span>
                              {isVencido && item.situacao !== "PAGA" && (
                                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold block">
                                  Vencido há {diasAtraso}d
                                </span>
                              )}
                            </div>
                          ) : item.tipo === "MAO_DE_OBRA" ? (
                            <span className="text-muted-foreground font-medium">
                              {item.periodoReferencia || item.competenciaFormatada}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>

                        {/* 6. Valor */}
                        <td className="py-3 px-4 text-right whitespace-nowrap font-display font-bold text-foreground">
                          {formatCurrency(item.valor)}
                        </td>

                        {/* 7. Situação */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <Badge className={badge.className}>{badge.label}</Badge>
                        </td>

                        {/* 8. Ação */}
                        <td className="py-3 px-4 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1"
                            onClick={() => handleOpenDrawer(item)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Abrir
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── DRAWER DE DETALHES DA DESPESA / OBRIGAÇÃO ────────────────────────── */}
      <UxLabDespesaDrawer
        despesa={selectedDespesa}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onDespesaUpdated={handleDespesaUpdated}
      />
    </UxLabShell>
  );
}
