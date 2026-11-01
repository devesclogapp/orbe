import React, { useState, useMemo } from "react";
import {
  Receipt,
  Search,
  Filter,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  Sparkles,
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
  Send,
  FileText,
  Zap,
  Check,
  ChevronRight,
  HelpCircle,
  ShieldCheck,
  LayoutList
} from "lucide-react";
import { UxLabShell } from "@/components/ux-lab/UxLabShell";
import { UxLabReceitaDrawer } from "@/components/ux-lab/UxLabReceitaDrawer";
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
  ReceitaOperacionalMock,
  EstagioFinanceiroUX,
  ModalidadeReceitaReal,
  OrigemReceitaReal,
  MOCK_RECEITAS_OPERACIONAIS,
  getEstagioUX,
  getEstagioUXLabel,
  getModalidadeLabel,
  getStatusLabel,
  getSituacaoVencimento,
} from "./receitasMockData";

export default function UxLabReceitas() {
  const navigate = useNavigate();

  // 1. Dataset State (Mock Only)
  const [receitas, setReceitas] = useState<ReceitaOperacionalMock[]>(MOCK_RECEITAS_OPERACIONAIS);

  // 2. Filtros
  const [estagioFiltro, setEstagioFiltro] = useState<EstagioFinanceiroUX>("TODOS");
  const [modalidadeFiltro, setModalidadeFiltro] = useState<string>("TODAS");
  const [origemFiltro, setOrigemFiltro] = useState<string>("TODAS");
  const [vencimentoFiltro, setVencimentoFiltro] = useState<string>("TODOS");
  const [clienteFiltro, setClienteFiltro] = useState<string>("ALL");
  const [busca, setBusca] = useState<string>("");

  // Contexto Topbar
  const [empresaContexto, setEmpresaContexto] = useState<string>("emp-castanhal");
  const [competenciaContexto, setCompetenciaContexto] = useState<string>("2026-10");

  // 3. Drawer de Detalhes
  const [selectedReceita, setSelectedReceita] = useState<ReceitaOperacionalMock | null>(null);
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

  // 4. Cálculos dos 4 Cards de KPI Canônicos
  // REGRA MATEMÁTICA: Receita Reconhecida = A Faturar/Cobrar + A Receber + Recebido
  const kpiStats = useMemo(() => {
    const ativas = receitas.filter((r) => r.status !== "cancelado");

    let totalReconhecido = 0;
    let valorAFaturarFechar = 0;
    let valorCobrancaPendente = 0;
    let aReceber = 0;
    let recebido = 0;
    let conciliado = 0;

    ativas.forEach((r) => {
      const valor = r.valorTotal;
      totalReconhecido += valor;

      const est = getEstagioUX(r.status);
      if (est === "A_FATURAR_FECHAR") {
        valorAFaturarFechar += valor;
      } else if (est === "COBRANCA_PENDENTE") {
        valorCobrancaPendente += valor;
      } else if (est === "A_RECEBER") {
        aReceber += valor;
      } else if (est === "RECEBIDAS") {
        recebido += valor;
        if (r.status === "conciliado") {
          conciliado += valor;
        }
      }
    });

    const aFaturarCobrar = valorAFaturarFechar + valorCobrancaPendente;

    return {
      totalReconhecido,
      valorAFaturarFechar,
      valorCobrancaPendente,
      aFaturarCobrar,
      aReceber,
      recebido,
      conciliado,
    };
  }, [receitas]);

  // 5. Contagens dos Pills de Estágio
  const contagensEstagio = useMemo(() => {
    const ativas = receitas.filter((r) => r.status !== "cancelado");
    return {
      TODOS: ativas.length,
      A_FATURAR_FECHAR: ativas.filter((r) => getEstagioUX(r.status) === "A_FATURAR_FECHAR").length,
      COBRANCA_PENDENTE: ativas.filter((r) => getEstagioUX(r.status) === "COBRANCA_PENDENTE").length,
      A_RECEBER: ativas.filter((r) => getEstagioUX(r.status) === "A_RECEBER").length,
      RECEBIDAS: ativas.filter((r) => getEstagioUX(r.status) === "RECEBIDAS").length,
    };
  }, [receitas]);

  // 6. Lista de Clientes Únicos para Filtro
  const clientesDisponiveis = useMemo(() => {
    const map = new Map<string, string>();
    receitas.forEach((r) => {
      map.set(r.clienteId, r.clienteNome);
    });
    return Array.from(map.entries()).map(([id, nome]) => ({ id, nome }));
  }, [receitas]);

  // 7. Filtragem da Tabela Principal
  const receitasFiltradas = useMemo(() => {
    return receitas.filter((r) => {
      // Filtro de Estágio UX
      if (estagioFiltro !== "TODOS") {
        const est = getEstagioUX(r.status);
        if (est !== estagioFiltro) return false;
      }

      // Filtro de Modalidade
      if (modalidadeFiltro !== "TODAS") {
        if (r.modalidade !== modalidadeFiltro) return false;
      }

      // Filtro de Origem
      if (origemFiltro !== "TODAS") {
        if (r.origemPrincipal !== origemFiltro) return false;
      }

      // Filtro de Cliente
      if (clienteFiltro !== "ALL") {
        if (r.clienteId !== clienteFiltro) return false;
      }

      // Filtro de Vencimento
      if (vencimentoFiltro !== "TODOS") {
        const sit = getSituacaoVencimento(r);
        if (vencimentoFiltro === "VENCIDOS" && !sit.isVencido) return false;
        if (vencimentoFiltro === "A_VENCER" && sit.isVencido) return false;
      }

      // Busca Textual
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const matchNome = r.clienteNome.toLowerCase().includes(termo);
        const matchId = r.id.toLowerCase().includes(termo);
        const matchObs = (r.observacao || "").toLowerCase().includes(termo);
        const matchItens = r.itens.some(
          (it) =>
            it.refOrigem.toLowerCase().includes(termo) ||
            it.descricao.toLowerCase().includes(termo)
        );
        if (!matchNome && !matchId && !matchObs && !matchItens) return false;
      }

      return true;
    });
  }, [
    receitas,
    estagioFiltro,
    modalidadeFiltro,
    origemFiltro,
    clienteFiltro,
    vencimentoFiltro,
    busca,
  ]);

  const handleOpenDrawer = (rec: ReceitaOperacionalMock) => {
    setSelectedReceita(rec);
    setDrawerOpen(true);
  };

  const handleReceitaUpdated = (recAtualizada: ReceitaOperacionalMock) => {
    setReceitas((prev) =>
      prev.map((r) => (r.id === recAtualizada.id ? recAtualizada : r))
    );
    setSelectedReceita(recAtualizada);
  };

  const handleRefresh = () => {
    setReceitas([...MOCK_RECEITAS_OPERACIONAIS]);
    toast.success("Dados do funil financeiro atualizados com sucesso!");
  };

  return (
    <UxLabShell
      title="Central de Receitas & Contas a Receber"
      subtitle="Gestão do faturamento, cobranças e recebimentos originados das operações da empresa."
      activeSidebarItem="receitas"
      competencia={competenciaContexto}
      onCompetenciaChange={setCompetenciaContexto}
      empresa={empresaContexto}
      onEmpresaChange={setEmpresaContexto}
      onRefresh={handleRefresh}
    >
      <div className="space-y-5">

        {/* 1. PRIMEIRO BLOCO — 4 KPIS FINANCEIROS CANÔNICOS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* KPI 1: RECEITA RECONHECIDA */}
          <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Receita Reconhecida
              </span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Receipt className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-display text-blue-600 dark:text-blue-400 tracking-tight">
              {formatCurrency(kpiStats.totalReconhecido)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              competência selecionada (Outubro / 2026)
            </p>
          </div>

          {/* KPI 2: A FATURAR / COBRAR */}
          <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                A Faturar / Cobrar
              </span>
              <div className="h-7 w-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-display text-foreground tracking-tight">
              {formatCurrency(kpiStats.aFaturarCobrar)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {formatCurrency(kpiStats.valorAFaturarFechar).replace(",00", "")} a fechar • {formatCurrency(kpiStats.valorCobrancaPendente).replace(",00", "")} em cobrança
            </p>
          </div>

          {/* KPI 3: A RECEBER */}
          <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                A Receber
              </span>
              <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-display text-foreground tracking-tight">
              {formatCurrency(kpiStats.aReceber)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              cobranças enviadas e caixa pendente
            </p>
          </div>

          {/* KPI 4: RECEBIDO */}
          <div className="bg-card p-4 rounded-xl border border-border/80 shadow-2xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Recebido
              </span>
              <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-display text-emerald-600 dark:text-emerald-400 tracking-tight">
              {formatCurrency(kpiStats.recebido)}
            </div>
            <p className="text-[11px] text-muted-foreground">
              liquidado no período
            </p>
          </div>
        </div>

        {/* 2. INDICADOR SECUNDÁRIO DISCRETO DE CONCILIAÇÃO */}
        <div className="bg-muted/30 border border-border/70 rounded-lg px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>
              Do valor recebido, <strong className="text-foreground font-semibold">{formatCurrency(kpiStats.conciliado)}</strong> já está conciliado no extrato bancário.
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2.5 text-xs text-primary hover:text-primary-strong hover:bg-primary/5 font-semibold shrink-0 gap-1"
            onClick={() => {
              toast.info("Direcionando para Central Bancária (CNAB & Retorno)...");
              navigate("/financeiro/retorno");
            }}
          >
            Acessar Central Bancária <ChevronRight className="h-3 w-3" />
          </Button>
        </div>

        {/* 3. NAVEGAÇÃO POR ESTÁGIO (PILLS COMPACTOS) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border/50">
          {(
            [
              { id: "TODOS", label: "Todos", count: contagensEstagio.TODOS },
              { id: "A_FATURAR_FECHAR", label: "A Faturar / Fechar", count: contagensEstagio.A_FATURAR_FECHAR },
              { id: "COBRANCA_PENDENTE", label: "Cobrança Pendente", count: contagensEstagio.COBRANCA_PENDENTE },
              { id: "A_RECEBER", label: "A Receber", count: contagensEstagio.A_RECEBER },
              { id: "RECEBIDAS", label: "Recebidas", count: contagensEstagio.RECEBIDAS },
            ] as const
          ).map((tab) => {
            const isSelected = estagioFiltro === tab.id;
            return (
              <Button
                key={tab.id}
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEstagioFiltro(tab.id)}
                className={`h-8 px-3 text-xs font-semibold rounded-lg transition-colors gap-2 shrink-0 ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-2xs hover:bg-primary/90 hover:text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {tab.count}
                </span>
              </Button>
            );
          })}
        </div>

        {/* 4. BARRA COMPACTA DE FILTROS & BUSCA */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-2xs">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
              <Input
                placeholder="Buscar cliente, referência, operação ou documento..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9 h-8.5 text-xs bg-background"
              />
            </div>

            {/* Modalidade */}
            <Select value={modalidadeFiltro} onValueChange={setModalidadeFiltro}>
              <SelectTrigger className="h-8.5 w-[160px] text-xs bg-background">
                <SelectValue placeholder="Modalidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as Modalidades</SelectItem>
                <SelectItem value="CAIXA_IMEDIATO">Caixa Imediato</SelectItem>
                <SelectItem value="DUPLICATA">Duplicata</SelectItem>
                <SelectItem value="FATURAMENTO_MENSAL">Faturamento Mensal</SelectItem>
              </SelectContent>
            </Select>

            {/* Origem */}
            <Select value={origemFiltro} onValueChange={setOrigemFiltro}>
              <SelectTrigger className="h-8.5 w-[170px] text-xs bg-background">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas as Origens</SelectItem>
                <SelectItem value="Operação por Volume">Operação por Volume</SelectItem>
                <SelectItem value="Serviço Extra">Serviço Extra</SelectItem>
              </SelectContent>
            </Select>

            {/* Vencimento */}
            <Select value={vencimentoFiltro} onValueChange={setVencimentoFiltro}>
              <SelectTrigger className="h-8.5 w-[140px] text-xs bg-background">
                <SelectValue placeholder="Vencimento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos Vencimentos</SelectItem>
                <SelectItem value="VENCIDOS">Apenas Vencidos</SelectItem>
                <SelectItem value="A_VENCER">A Vencer / No Prazo</SelectItem>
              </SelectContent>
            </Select>

            {/* Cliente */}
            <Select value={clienteFiltro} onValueChange={setClienteFiltro}>
              <SelectTrigger className="h-8.5 w-[180px] text-xs bg-background">
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos os Clientes</SelectItem>
                {clientesDisponiveis.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {(modalidadeFiltro !== "TODAS" ||
              origemFiltro !== "TODAS" ||
              vencimentoFiltro !== "TODOS" ||
              clienteFiltro !== "ALL" ||
              busca.trim() !== "" ||
              estagioFiltro !== "TODOS") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setModalidadeFiltro("TODAS");
                  setOrigemFiltro("TODAS");
                  setVencimentoFiltro("TODOS");
                  setClienteFiltro("ALL");
                  setBusca("");
                  setEstagioFiltro("TODOS");
                }}
              >
                Limpar Filtros
              </Button>
            )}
            <span className="text-xs text-muted-foreground font-medium">
              {receitasFiltradas.length} {receitasFiltradas.length === 1 ? "receita" : "receitas"}
            </span>
          </div>
        </div>

        {/* 5. TABELA FINANCEIRA PRINCIPAL (DENSA & OPERACIONAL) */}
        <div className="bg-card rounded-xl border border-border shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/60 bg-muted/20 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                  <th className="px-4 py-3.5">Cliente / Referência</th>
                  <th className="px-4 py-3.5">Origem</th>
                  <th className="px-4 py-3.5">Modalidade</th>
                  <th className="px-4 py-3.5">Competência</th>
                  <th className="px-4 py-3.5">Vencimento</th>
                  <th className="px-4 py-3.5 text-right">Valor</th>
                  <th className="px-4 py-3.5 text-center">Estágio</th>
                  <th className="px-4 py-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30 font-medium">
                {receitasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p className="font-semibold text-foreground text-sm">Nenhuma receita localizada</p>
                      <p className="text-xs text-muted-foreground">Tente ajustar os filtros ou termos da busca.</p>
                    </td>
                  </tr>
                ) : (
                  receitasFiltradas.map((r) => {
                    const estagioRow = getEstagioUX(r.status);
                    const sitVenc = getSituacaoVencimento(r);

                    // Badge de Estágio UX
                    let badgeClass = "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300";
                    if (estagioRow === "COBRANCA_PENDENTE") {
                      badgeClass = "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300";
                    } else if (estagioRow === "A_RECEBER") {
                      badgeClass = "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300";
                    } else if (estagioRow === "RECEBIDAS") {
                      badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300";
                    }

                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleOpenDrawer(r)}
                        className="hover:bg-muted/20 cursor-pointer transition-colors group"
                      >
                        {/* CLIENTE / REFERÊNCIA */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground group-hover:text-primary transition-colors text-[13px]">
                                {r.clienteNome}
                              </span>
                              {r.observacao === "FATURA_COMPLEMENTAR" && (
                                <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 font-bold">
                                  COMPLEMENTAR
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                              <span>{r.id}</span>
                              {r.itens.length === 1 && (
                                <>
                                  <span>•</span>
                                  <span>{r.itens[0].refOrigem}</span>
                                </>
                              )}
                              {r.itens.length > 1 && (
                                <>
                                  <span>•</span>
                                  <span>{r.itens.length} lançamentos</span>
                                </>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* ORIGEM */}
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground text-xs">
                          {r.origemPrincipal}
                        </td>

                        {/* MODALIDADE */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <Badge variant="outline" className="text-[11px] font-medium bg-muted/30 border-border">
                            {getModalidadeLabel(r.modalidade)}
                          </Badge>
                        </td>

                        {/* COMPETÊNCIA */}
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground font-medium text-xs">
                          {r.competenciaFormatada}
                        </td>

                        {/* VENCIMENTO COM SITUAÇÃO DERIVADA */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="text-foreground font-medium block">
                              {formatDate(r.vencimento)}
                            </span>
                            {sitVenc.isVencido && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 font-bold">
                                {sitVenc.label}
                              </Badge>
                            )}
                          </div>
                        </td>

                        {/* VALOR */}
                        <td className="px-4 py-3 whitespace-nowrap text-right font-display font-bold text-foreground text-[13px]">
                          {formatCurrency(r.valorTotal)}
                        </td>

                        {/* ESTÁGIO */}
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <Badge variant="outline" className={`text-[10px] font-semibold uppercase px-2 py-0.5 ${badgeClass}`}>
                            {getEstagioUXLabel(estagioRow)}
                          </Badge>
                        </td>

                        {/* AÇÃO */}
                        <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2.5 text-xs text-primary hover:text-primary-strong hover:bg-primary/5 font-semibold"
                            onClick={() => handleOpenDrawer(r)}
                          >
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

        {/* 6. DRAWER DA RECEITA */}
        <UxLabReceitaDrawer
          receita={selectedReceita}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onReceitaUpdated={handleReceitaUpdated}
        />
      </div>
    </UxLabShell>
  );
}
