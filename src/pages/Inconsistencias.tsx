import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Search,
  RotateCcw,
  Building2,
  Calendar,
  Layers,
  Users,
  Package,
  Wrench,
  Wallet,
  Clock,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InconsistenciaDrawer } from "@/components/inconsistencias/InconsistenciaDrawer";
import {
  InconsistenciasTransversaisService,
  ItemInconsistenciaNormalizado,
  DominioInconsistencia,
} from "@/services/inconsistenciasTransversais.service";
import { EmpresaService } from "@/services/base.service";
import { toast } from "sonner";

interface InconsistenciasProps {
  flowType?: string;
  lockedFlow?: boolean;
}

export default function Inconsistencias({ flowType, lockedFlow }: InconsistenciasProps = {}) {
  const isIntermitenteLocked = flowType === "INTERMITENTE";

  // 1. Filtros de Contexto e Trabalho
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("all");
  const [dominioFiltro, setDominioFiltro] = useState<string>(
    isIntermitenteLocked ? "INTERMITENTE" : "TODAS"
  );
  const [naturezaFiltro, setNaturezaFiltro] = useState<string>("ALL");
  const [responsavelFiltro, setResponsavelFiltro] = useState<string>("ALL");
  const [busca, setBusca] = useState<string>("");
  const [filtroRapidoKpi, setFiltroRapidoKpi] = useState<string | null>(null);

  // 2. Drawer de Diagnóstico
  const [selectedItem, setSelectedItem] = useState<ItemInconsistenciaNormalizado | null>(null);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

  // 3. Query Oficial de Empresas
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  // 4. Query Oficial de Inconsistências Transversais (Read-Only Adapter)
  const {
    data: allItens = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["inconsistencias-transversais", empresaFiltro],
    queryFn: () =>
      InconsistenciasTransversaisService.getTodasInconsistencias({
        empresaId: empresaFiltro !== "all" ? empresaFiltro : undefined,
      }),
  });

  // Formatação de Data
  const formatRelativeTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })}`;
    } catch {
      return isoStr;
    }
  };

  // 5. Universo Contextual (definido por Empresa)
  const itensContextuais = useMemo(() => {
    return allItens.filter((item) => {
      if (empresaFiltro !== "all" && item.empresaId && item.empresaId !== empresaFiltro) {
        return false;
      }
      return true;
    });
  }, [allItens, empresaFiltro]);

  // 6. Contagens por Domínio (Baseadas no Universo Contextual)
  const contagensPorDominio = useMemo(() => {
    return {
      TODAS: itensContextuais.length,
      OPERACAO: itensContextuais.filter((i) => i.dominio === "OPERACAO").length,
      SERVICO_EXTRA: itensContextuais.filter((i) => i.dominio === "SERVICO_EXTRA").length,
      CUSTO_EXTRA: itensContextuais.filter((i) => i.dominio === "CUSTO_EXTRA").length,
      DIARISTA: itensContextuais.filter((i) => i.dominio === "DIARISTA").length,
      INTERMITENTE: itensContextuais.filter((i) => i.dominio === "INTERMITENTE").length,
      PONTO_CLT: itensContextuais.filter((i) => i.dominio === "PONTO_CLT").length,
    };
  }, [itensContextuais]);

  // 7. KPIs Operacionais (Contexto Macro sem oscilar por busca exploratória)
  const kpiStats = useMemo(() => {
    return {
      totalAtivos: itensContextuais.length,
      bloqueantes: itensContextuais.filter((i) => i.bloqueante).length,
      aguardandoCampo: itensContextuais.filter((i) => i.responsavel === "ENCARREGADO").length,
      aguardandoRhCadastro: itensContextuais.filter(
        (i) => i.responsavel === "RH" || i.responsavel === "ADMIN"
      ).length,
    };
  }, [itensContextuais]);

  // 8. Filtragem Exploratória da Fila
  const itensFiltrados = useMemo(() => {
    return itensContextuais.filter((item) => {
      // Domínio (Pílula)
      if (dominioFiltro !== "TODAS" && item.dominio !== dominioFiltro) {
        return false;
      }

      // Natureza
      if (naturezaFiltro !== "ALL" && item.natureza !== naturezaFiltro) {
        return false;
      }

      // Responsável
      if (responsavelFiltro !== "ALL" && item.responsavel !== responsavelFiltro) {
        return false;
      }

      // Filtro Rápido por KPI Card
      if (filtroRapidoKpi === "bloqueantes") {
        if (!item.bloqueante) return false;
      } else if (filtroRapidoKpi === "campo") {
        if (item.responsavel !== "ENCARREGADO") return false;
      } else if (filtroRapidoKpi === "rh_cadastro") {
        if (item.responsavel !== "RH" && item.responsavel !== "ADMIN") return false;
      }

      // Busca Textual
      if (busca.trim()) {
        const query = busca.toLowerCase();
        const matchCodigo = item.codigo.toLowerCase().includes(query);
        const matchTitulo = item.tituloHumano.toLowerCase().includes(query);
        const matchErrado = item.oqueEstaErrado.toLowerCase().includes(query);
        const matchEmpresa = item.empresaNome.toLowerCase().includes(query);
        const matchRef = item.referencia.toLowerCase().includes(query);
        const matchResp = item.responsavelLabel.toLowerCase().includes(query);

        if (!matchCodigo && !matchTitulo && !matchErrado && !matchEmpresa && !matchRef && !matchResp) {
          return false;
        }
      }

      return true;
    });
  }, [
    itensContextuais,
    dominioFiltro,
    naturezaFiltro,
    responsavelFiltro,
    filtroRapidoKpi,
    busca,
  ]);

  const handleRestaurarPadrao = () => {
    setEmpresaFiltro("all");
    setDominioFiltro(isIntermitenteLocked ? "INTERMITENTE" : "TODAS");
    setNaturezaFiltro("ALL");
    setResponsavelFiltro("ALL");
    setBusca("");
    setFiltroRapidoKpi(null);
    toast.success("Fila padrão restaurada", {
      description: "Exibindo todos os impedimentos ativos.",
    });
  };

  const handleAbrirDrawer = (item: ItemInconsistenciaNormalizado) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  const getDominioIcon = (dom: DominioInconsistencia) => {
    switch (dom) {
      case "OPERACAO":
        return <Package className="w-3.5 h-3.5" />;
      case "SERVICO_EXTRA":
        return <Wrench className="w-3.5 h-3.5" />;
      case "CUSTO_EXTRA":
        return <Wallet className="w-3.5 h-3.5" />;
      case "DIARISTA":
        return <Users className="w-3.5 h-3.5" />;
      case "INTERMITENTE":
        return <Calendar className="w-3.5 h-3.5" />;
      case "PONTO_CLT":
        return <Clock className="w-3.5 h-3.5" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5" />;
    }
  };

  return (
    <AppShell
      title="Central de Inconsistências"
      subtitle="Impedimentos que precisam ser corrigidos para o fluxo continuar."
    >
      <div className="space-y-6">
        {/* =========================================================================
            HEADER DE CONTEXTO & SELETOR DE EMPRESA
           ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card shadow-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">Escopo de Trabalho</span>
              <span className="text-xs text-muted-foreground font-mono">
                {isIntermitenteLocked ? "Sub-rota: Intermitentes" : "Fila Transversal (6 Domínios)"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Selecione uma empresa para isolar impedimentos contextuais ou mantenha consolidado.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-[260px]">
              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
                <SelectTrigger className="h-9 text-xs bg-muted/20 border-border w-full">
                  <SelectValue placeholder="Todas as Empresas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Empresas</SelectItem>
                  {empresas.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.nome || emp.razao_social}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* =========================================================================
            1. SÍNTESE OPERACIONAL (4 CARDS INTERATIVOS DE TRABALHO)
           ========================================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* CARD 1: IMPEDIMENTOS ATIVOS */}
          <button
            type="button"
            className={`text-left p-4 rounded-xl border transition-all duration-200 ${
              filtroRapidoKpi === null
                ? "bg-card border-[#2563EB]/40 ring-1 ring-[#2563EB]/30 shadow-sm"
                : "bg-card/70 hover:bg-card border-border hover:border-border/80"
            }`}
            onClick={() => setFiltroRapidoKpi(null)}
          >
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <span>Impedimentos Ativos</span>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {kpiStats.totalAtivos}
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-[#2563EB]" />
              Fila factual consolidada
            </div>
          </button>

          {/* CARD 2: BLOQUEANTES */}
          <button
            type="button"
            className={`text-left p-4 rounded-xl border transition-all duration-200 ${
              filtroRapidoKpi === "bloqueantes"
                ? "bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/40 shadow-sm"
                : "bg-card/70 hover:bg-card border-border hover:border-rose-500/30"
            }`}
            onClick={() =>
              setFiltroRapidoKpi(filtroRapidoKpi === "bloqueantes" ? null : "bloqueantes")
            }
          >
            <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">
              <span>Bloqueantes</span>
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
              {kpiStats.bloqueantes}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Impedem o fluxo de continuar
            </div>
          </button>

          {/* CARD 3: AÇÃO DE CAMPO */}
          <button
            type="button"
            className={`text-left p-4 rounded-xl border transition-all duration-200 ${
              filtroRapidoKpi === "campo"
                ? "bg-card border-[#2563EB]/40 ring-1 ring-[#2563EB]/30 shadow-sm"
                : "bg-card/70 hover:bg-card border-border hover:border-border/80"
            }`}
            onClick={() =>
              setFiltroRapidoKpi(filtroRapidoKpi === "campo" ? null : "campo")
            }
          >
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <span>Ação de Campo</span>
              <Wrench className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {kpiStats.aguardandoCampo}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Encarregados e equipes de operação
            </div>
          </button>

          {/* CARD 4: AÇÃO RH / CADASTRO */}
          <button
            type="button"
            className={`text-left p-4 rounded-xl border transition-all duration-200 ${
              filtroRapidoKpi === "rh_cadastro"
                ? "bg-card border-[#2563EB]/40 ring-1 ring-[#2563EB]/30 shadow-sm"
                : "bg-card/70 hover:bg-card border-border hover:border-border/80"
            }`}
            onClick={() =>
              setFiltroRapidoKpi(filtroRapidoKpi === "rh_cadastro" ? null : "rh_cadastro")
            }
          >
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              <span>Ação RH / Cadastro</span>
              <UserCheck className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {kpiStats.aguardandoRhCadastro}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Regularizações, vínculos e cadastros
            </div>
          </button>
        </div>

        {/* =========================================================================
            2. FILAS POR DOMÍNIO (7 PÍLULAS INSTITUCIONAIS COM CONTADORES)
           ========================================================================= */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-border text-xs">
          {[
            { id: "TODAS", label: "Todas as Filas", count: contagensPorDominio.TODAS },
            { id: "OPERACAO", label: "Operações", count: contagensPorDominio.OPERACAO },
            { id: "SERVICO_EXTRA", label: "Serviços Extras", count: contagensPorDominio.SERVICO_EXTRA },
            { id: "CUSTO_EXTRA", label: "Custos Extras", count: contagensPorDominio.CUSTO_EXTRA },
            { id: "DIARISTA", label: "Diaristas", count: contagensPorDominio.DIARISTA },
            { id: "INTERMITENTE", label: "Intermitentes", count: contagensPorDominio.INTERMITENTE },
            { id: "PONTO_CLT", label: "Ponto CLT", count: contagensPorDominio.PONTO_CLT },
          ].map((pill) => {
            const isActive = dominioFiltro === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? "bg-[#2563EB] text-white shadow-sm font-semibold"
                    : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setDominioFiltro(pill.id)}
              >
                <span>{pill.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    isActive
                      ? "bg-white/20 text-white font-bold"
                      : "bg-muted text-muted-foreground font-medium"
                  }`}
                >
                  {pill.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            3. BARRA DE FILTROS INTEGRADA
           ========================================================================= */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* BUSCA TEXTUAL */}
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Buscar por referência, colaborador, empresa ou impedimento..."
                className="pl-9 h-9 text-xs bg-muted/20 border-border"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>

            {/* NATUREZA */}
            <div className="md:col-span-3">
              <Select value={naturezaFiltro} onValueChange={setNaturezaFiltro}>
                <SelectTrigger className="h-9 text-xs bg-muted/20 border-border">
                  <SelectValue placeholder="Natureza do Impedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todas as Naturezas</SelectItem>
                  <SelectItem value="CADASTRAL_VINCULO">Cadastral & Vínculo</SelectItem>
                  <SelectItem value="DOCUMENTAL">Documental & Anexos</SelectItem>
                  <SelectItem value="OPERACIONAL">Operacional de Campo</SelectItem>
                  <SelectItem value="RH_PONTO">RH & Ponto</SelectItem>
                  <SelectItem value="FINANCEIRO_PAGAMENTO">Financeiro & Pagamento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* RESPONSÁVEL */}
            <div className="md:col-span-3">
              <Select value={responsavelFiltro} onValueChange={setResponsavelFiltro}>
                <SelectTrigger className="h-9 text-xs bg-muted/20 border-border">
                  <SelectValue placeholder="Responsável pela Ação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos os Responsáveis</SelectItem>
                  <SelectItem value="ENCARREGADO">Encarregado (Campo)</SelectItem>
                  <SelectItem value="RH">RH / Departamento Pessoal</SelectItem>
                  <SelectItem value="FINANCEIRO">Financeiro</SelectItem>
                  <SelectItem value="ADMIN">Administrador / Configuração</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* BOTÃO RESTAURAR PADRÃO */}
            <div className="md:col-span-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs gap-1.5 w-full hover:bg-muted"
                onClick={handleRestaurarPadrao}
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
                Restaurar Padrão
              </Button>
            </div>
          </div>
        </div>

        {/* =========================================================================
            4. FILA PRINCIPAL (TABELA DIAGNÓSTICA SEM MUTAÇÃO DIRETA)
           ========================================================================= */}
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
              <p className="text-xs text-muted-foreground font-medium">
                Carregando impedimentos dos 6 domínios operacionais...
              </p>
            </div>
          ) : isError ? (
            <div className="p-12 text-center space-y-3">
              <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto" />
              <div className="text-sm font-semibold text-foreground">
                Erro ao carregar inconsistências operacionais
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                {(error as any)?.message || "Não foi possível sincronizar os registros. Tente novamente."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="text-xs mt-2"
                onClick={() => refetch()}
              >
                Tentar Novamente
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4 w-[220px]">Impedimento / Referência</th>
                    <th className="py-3 px-4 w-[200px]">Empresa / Unidade</th>
                    <th className="py-3 px-4">O que está errado</th>
                    <th className="py-3 px-4 w-[240px]">Impacto no Fluxo</th>
                    <th className="py-3 px-3 w-[120px] text-center">Responsável</th>
                    <th className="py-3 px-3 w-[150px]">Detectado em</th>
                    <th className="py-3 px-4 w-[110px] text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {itensFiltrados.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-muted/20 transition-colors group cursor-pointer"
                      onClick={() => handleAbrirDrawer(item)}
                    >
                      {/* COLUNA 1: IMPEDIMENTO & REFERÊNCIA */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-foreground border border-border font-mono">
                              {getDominioIcon(item.dominio)}
                              {item.codigo}
                            </span>
                            {item.bloqueante ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                Bloqueante
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                Atenção
                              </span>
                            )}
                          </div>
                          <div className="font-medium text-foreground text-xs line-clamp-1">
                            {item.referencia}
                          </div>
                        </div>
                      </td>

                      {/* COLUNA 2: EMPRESA / UNIDADE */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-foreground text-xs line-clamp-1">
                          {item.empresaNome}
                        </div>
                        <div className="text-muted-foreground text-[11px] line-clamp-1 mt-0.5">
                          {item.unidadeNome}
                        </div>
                      </td>

                      {/* COLUNA 3: O QUE ESTÁ ERRADO */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-semibold text-foreground text-xs leading-snug">
                          {item.tituloHumano}
                        </div>
                        <div className="text-muted-foreground text-[11px] leading-relaxed mt-0.5 line-clamp-2">
                          {item.oqueEstaErrado}
                        </div>
                      </td>

                      {/* COLUNA 4: IMPACTO NO FLUXO */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="text-xs font-medium text-foreground leading-snug flex items-start gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                          <span>{item.impactoNoFluxo}</span>
                        </div>
                      </td>

                      {/* COLUNA 5: RESPONSÁVEL */}
                      <td className="py-3.5 px-3 align-top text-center">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-foreground border border-border">
                          {item.responsavelLabel}
                        </span>
                      </td>

                      {/* COLUNA 6: DETECTADO EM */}
                      <td className="py-3.5 px-3 align-top text-muted-foreground text-[11px]">
                        {formatRelativeTime(item.detectadoEm)}
                      </td>

                      {/* COLUNA 7: AÇÃO (ANALISAR) */}
                      <td
                        className="py-3.5 px-4 align-top text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2.5 gap-1 hover:bg-[#2563EB] hover:text-white hover:border-[#2563EB] transition-colors"
                          onClick={() => handleAbrirDrawer(item)}
                        >
                          <span>Analisar</span>
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}

                  {/* ESTADO VAZIO */}
                  {itensFiltrados.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 px-4 text-center">
                        <div className="max-w-md mx-auto space-y-2">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <div className="text-sm font-semibold text-foreground">
                            {itensContextuais.length === 0
                              ? "Fluxos sem impedimentos ativos."
                              : "Nenhum impedimento encontrado para os filtros selecionados."}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {itensContextuais.length === 0
                              ? "Todos os registros operacionais, cadastrais e de ponto estão íntegros e fluindo normalmente."
                              : "Tente redefinir os filtros de busca ou empresa para localizar ocorrências."}
                          </p>
                          {itensContextuais.length > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="mt-3 text-xs"
                              onClick={handleRestaurarPadrao}
                            >
                              Restaurar Fila Padrão
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* RODAPÉ DA TABELA */}
          <div className="p-3 border-t border-border bg-muted/20 text-xs text-muted-foreground flex items-center justify-between">
            <div>
              Exibindo <span className="font-bold text-foreground">{itensFiltrados.length}</span> de{" "}
              <span className="font-bold text-foreground">{itensContextuais.length}</span> impedimentos
              ativos
            </div>
            <div className="text-[11px] font-mono">
              Central de Inconsistências Oficial · Diagnóstico & Despacho
            </div>
          </div>
        </div>
      </div>

      {/* DRAWER OFICIAL DE DIAGNÓSTICO E DESPACHO */}
      <InconsistenciaDrawer
        item={selectedItem}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </AppShell>
  );
}
