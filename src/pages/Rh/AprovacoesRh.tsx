import React, { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Search,
  RotateCcw,
  Coins,
  Package,
  Wrench,
  Wallet,
  Layers,
  Building2,
  Filter,
  Check,
  Ban,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  Eye,
  RefreshCw,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate, useSearchParams } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UxLabFiltroTemporal,
  FiltroTemporalValue,
} from "@/components/ux-lab/UxLabFiltroTemporal";
import {
  AprovacaoDecisaoDrawer,
  ApprovalItem,
  TipoItem,
  SituacaoItem,
  renderDominioBadge,
  SITUACAO_BADGES,
} from "@/components/aprovacoes/AprovacaoDecisaoDrawer";
import { EmpresaService } from "@/services/domain/cadastros.service";
import { OperacaoProducaoService } from "@/services/domain/producao.service";
import { IntermitentesLoteService } from "@/services/domain/intermitentes.service";
import { AprovacoesService } from "@/services/domain/aprovacoes.service";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useTenant } from "@/contexts/TenantContext";
import { useOperationalPipeline, buildServicosExtrasPipeline } from "@/contexts/OperationalPipelineContext";
import { cn } from "@/lib/utils";

// ────────────────────────────────────────────────────
// Formatadores
// ────────────────────────────────────────────────────
const fmt = (v?: number) => v?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00";

const fmtDate = (d?: string) => {
  if (!d) return "—";
  try {
    return format(new Date(d.includes("T") ? d : d + "T12:00:00"), "dd/MM/yyyy HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
};

const getMaisAntigoInfo = (pendentes: ApprovalItem[]) => {
  if (!pendentes || pendentes.length === 0) {
    return {
      valor: "—",
      descricao: "Nenhum item aguardando decisão",
    };
  }

  // Ordena por data_recebimento ascendente (mais antigo primeiro)
  const sorted = [...pendentes].sort((a, b) => {
    const timeA = a.data_recebimento ? new Date(a.data_recebimento.includes("T") ? a.data_recebimento : a.data_recebimento + "T12:00:00").getTime() : Infinity;
    const timeB = b.data_recebimento ? new Date(b.data_recebimento.includes("T") ? b.data_recebimento : b.data_recebimento + "T12:00:00").getTime() : Infinity;
    return timeA - timeB;
  });

  const oldest = sorted[0];
  if (!oldest || !oldest.data_recebimento) {
    return {
      valor: "—",
      descricao: "Data de recebimento indisponível",
    };
  }

  try {
    const oldestDate = new Date(oldest.data_recebimento.includes("T") ? oldest.data_recebimento : oldest.data_recebimento + "T12:00:00");
    if (isNaN(oldestDate.getTime())) {
      return {
        valor: "—",
        descricao: "Data de recebimento indisponível",
      };
    }

    const now = new Date();
    const diffMs = now.getTime() - oldestDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let valor = "Hoje";
    if (diffDays === 1) valor = "1 dia";
    else if (diffDays > 1) valor = `${diffDays} dias`;

    const formattedDate = format(oldestDate, "dd/MM/yyyy", { locale: ptBR });
    return {
      valor,
      descricao: `Recebido em ${formattedDate}`,
    };
  } catch {
    return {
      valor: "—",
      descricao: "Data de recebimento indisponível",
    };
  }
};

export default function AprovacoesRh({ flowType, lockedFlow }: { flowType?: string; lockedFlow?: boolean } = {}) {
  const { user } = useAuth();
  const { role, isAdmin } = useTenant();
  const { openPipeline } = useOperationalPipeline();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Context Mode (Props ou URL SearchParams) ──
  const effectiveFlowType = flowType || searchParams.get("tipo") || searchParams.get("flowType") || undefined;
  const isLocked = lockedFlow ?? (searchParams.get("locked") === "true" || !!effectiveFlowType);

  // ── Filtros de Trabalho ──
  const [empresaFiltro, setEmpresaFiltro] = useState<string>("all");
  const [filtroTemporal, setFiltroTemporal] = useState<FiltroTemporalValue>({
    type: "preset",
    preset: "todos",
  });
  const [dominioFiltro, setDominioFiltro] = useState<string>(effectiveFlowType || "TODAS");
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>("PENDENTE");
  const [busca, setBusca] = useState<string>("");

  // ── Filtro Rápido por KPI ──
  const [filtroRapidoKpi, setFiltroRapidoKpi] = useState<string | null>(null);

  // ── Paginação ──
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // ── Seleção e Drawer ──
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<ApprovalItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    if (effectiveFlowType) {
      setDominioFiltro(effectiveFlowType);
      setCurrentPage(1);
    }
  }, [effectiveFlowType]);

  // ── Queries de Dados Reais ──
  const { data: empresas = [] } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => EmpresaService.getAll(),
  });

  const { data: results, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["aprovacoes-rh", empresaFiltro],
    queryFn: async () => {
      const res = await AprovacoesService.getAprovacoesRh({
        page: 1,
        itemsPerPage: 1000,
        tipo: "all",
        empresaId: empresaFiltro === "all" ? "" : empresaFiltro,
        searchTerm: "",
        situacao: undefined as any,
      });
      return (res?.data || []) as unknown as ApprovalItem[];
    },
  });

  const itensRaw = useMemo(() => results || [], [results]);

  // ── Contexto Macro (Empresa + Filtro Temporal) ──
  const aprovacoesContextuais = useMemo(() => {
    return itensRaw.filter((item) => {
      // 1. Filtro Temporal
      if (filtroTemporal.type === "preset") {
        if (filtroTemporal.preset === "hoje") {
          const today = format(new Date(), "yyyy-MM-dd");
          if (!String(item.data_recebimento || "").startsWith(today)) return false;
        } else if (filtroTemporal.preset === "setembro") {
          if (!String(item.data_recebimento || "").includes("-09-") && !String(item.competencia || "").includes("-09")) return false;
        } else if (filtroTemporal.preset === "outubro" || filtroTemporal.preset === "mes-atual") {
          if (!String(item.data_recebimento || "").includes("-10-") && !String(item.competencia || "").includes("-10")) return false;
        }
      } else if (filtroTemporal.type === "data" && filtroTemporal.data) {
        const itemDate = new Date(item.data_recebimento);
        const target = filtroTemporal.data;
        if (
          itemDate.getFullYear() !== target.getFullYear() ||
          itemDate.getMonth() !== target.getMonth() ||
          itemDate.getDate() !== target.getDate()
        ) {
          return false;
        }
      } else if (filtroTemporal.type === "range" && filtroTemporal.range?.from) {
        const itemDate = new Date(item.data_recebimento);
        const fromDate = new Date(filtroTemporal.range.from);
        fromDate.setHours(0, 0, 0, 0);
        const toDate = filtroTemporal.range.to ? new Date(filtroTemporal.range.to) : new Date(filtroTemporal.range.from);
        toDate.setHours(23, 59, 59, 999);
        if (itemDate < fromDate || itemDate > toDate) return false;
      }

      return true;
    });
  }, [itensRaw, filtroTemporal]);

  // ── 4 KPIs Oficiais UX08 (Calculados sobre o Contexto Macro) ──
  const kpis = useMemo(() => {
    // 1. Aguardando Decisão
    const pendentes = aprovacoesContextuais.filter(
      (i) => i.situacao !== "Aprovado" && i.situacao !== "Devolvido"
    );
    const aguardandoDecisao = pendentes.length;

    // 2. Mais Antigo na Fila (Antiguidade factual do item mais antigo)
    const maisAntigo = getMaisAntigoInfo(pendentes);

    // 3. Devolvidos
    const devolvidos = aprovacoesContextuais.filter((i) => i.situacao === "Devolvido").length;

    // 4. Impacto Financeiro (Apenas registros com valor monetário real)
    const impactoFinanceiro = pendentes.reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);

    return {
      aguardandoDecisao,
      maisAntigo,
      devolvidos,
      impactoFinanceiro,
    };
  }, [aprovacoesContextuais]);

  // ── Contadores por Domínio (Pílulas de Fila) ──
  const contadoresPorDominio = useMemo(() => {
    const pendentes = aprovacoesContextuais.filter(
      (i) => i.situacao !== "Aprovado" && i.situacao !== "Devolvido"
    );

    return {
      TODAS: pendentes.length,
      OPERACAO: pendentes.filter((i) => i.tipo === "OPERAÇÃO").length,
      SERVICO_EXTRA: pendentes.filter((i) => i.tipo === "SERVIÇO EXTRA").length,
      CUSTO_EXTRA: pendentes.filter((i) => i.tipo === "CUSTO EXTRA").length,
      DIARISTA: pendentes.filter((i) => i.tipo === "DIARISTA").length,
      INTERMITENTE: pendentes.filter((i) => i.tipo === "INTERMITENTE").length,
      PONTO: pendentes.filter((i) => i.tipo === "PONTO").length,
    };
  }, [aprovacoesContextuais]);

  // ── Filtragem Exploratória para a Tabela ──
  const aprovacoesFiltradas = useMemo(() => {
    return aprovacoesContextuais.filter((item) => {
      // 1. Domínio (Pílulas)
      if (dominioFiltro !== "TODAS" && item.tipo !== dominioFiltro) {
        return false;
      }

      // 2. Filtro Rápido por KPI Card
      if (filtroRapidoKpi === "aguardando_decisao") {
        if (item.situacao === "Aprovado" || item.situacao === "Devolvido") return false;
      } else if (filtroRapidoKpi === "mais_antigos") {
        if (item.situacao === "Aprovado" || item.situacao === "Devolvido") return false;
      } else if (filtroRapidoKpi === "devolvidos") {
        if (item.situacao !== "Devolvido") return false;
      } else {
        // 3. Situação / Visão
        if (situacaoFiltro === "PENDENTE") {
          if (item.situacao === "Aprovado" || item.situacao === "Devolvido") return false;
        } else if (situacaoFiltro === "DEVOLVIDO") {
          if (item.situacao !== "Devolvido") return false;
        } else if (situacaoFiltro === "MAIS_ANTIGOS") {
          if (item.situacao === "Aprovado" || item.situacao === "Devolvido") return false;
        }
      }

      // 4. Busca Textual
      if (busca.trim()) {
        const query = busca.toLowerCase().trim();
        const matchRef = String(item.referencia || "").toLowerCase().includes(query);
        const matchColab = String(item.colaborador || "").toLowerCase().includes(query);
        const matchEmp = String(item.empresa || "").toLowerCase().includes(query);
        const matchOp = String(item.operacao || "").toLowerCase().includes(query);
        const matchDesc = String(item.descricao || "").toLowerCase().includes(query);
        const matchTipo = String(item.tipo || "").toLowerCase().includes(query);

        if (!matchRef && !matchColab && !matchEmp && !matchOp && !matchDesc && !matchTipo) {
          return false;
        }
      }

      return true;
    });
  }, [aprovacoesContextuais, dominioFiltro, situacaoFiltro, filtroRapidoKpi, busca]);

  // ── Paginação ──
  const totalPages = Math.ceil((aprovacoesFiltradas.length || 0) / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return aprovacoesFiltradas.slice(start, start + itemsPerPage);
  }, [aprovacoesFiltradas, currentPage, itemsPerPage]);

  // ── Mutações de Domínio Homologadas (Preservadas com Fail-Closed) ──
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["aprovacoes-rh"] });
    queryClient.invalidateQueries({ queryKey: ["aprovacoes-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["custos-extras"], refetchType: "all" });
    queryClient.invalidateQueries({ queryKey: ["dashboard-custos-extras"] });
    queryClient.invalidateQueries({ queryKey: ["financeiro-despesas"] });
    queryClient.invalidateQueries({ queryKey: ["operacoes-base"] });
  };

  const openServicoExtraContinuity = async (item: ApprovalItem) => {
    setActiveItem(null);
    setDrawerOpen(false);

    const { data: seData, error: seErr } = await supabase
      .from("servicos_extras_operacionais" as any)
      .select("id, empresa_id, data, descricao_servico, total, modalidade_financeira, pipeline_status")
      .eq("id", item.id)
      .maybeSingle();

    if (seErr || !seData) {
      toast.error("Não foi possível carregar os detalhes do serviço extra.");
      return;
    }

    const candidateCompetencia = item.competencia || item.data_recebimento || "";
    const parsedData = (seData as any).data || (candidateCompetencia ? candidateCompetencia.substring(0, 10) : "");

    openPipeline(
      buildServicosExtrasPipeline({
        registroId: (seData as any).id,
        empresaId: (seData as any).empresa_id || "",
        data: parsedData,
        descricao: (seData as any).descricao_servico || "",
        valorTotal: Number((seData as any).total || 0),
        modalidade: (seData as any).modalidade_financeira || "CAIXA_IMEDIATO",
        pipelineStatus: (seData as any).pipeline_status || "APROVADO_OPERACAO",
      })
    );
  };

  const aprovarMutation = useMutation({
    mutationFn: async (item: ApprovalItem) => {
      // 1. DIARISTA
      if (item.tipo === "DIARISTA" && item.raw_lote_id) {
        const { error } = await supabase
          .from("diaristas_lotes_fechamento" as any)
          .update({ status: "VALIDADO_RH", updated_at: new Date().toISOString() })
          .eq("id", item.raw_lote_id);
        if (error) throw error;

        await supabase
          .from("lancamentos_diaristas")
          .update({ status: "VALIDADO_RH" })
          .eq("lote_fechamento_id", item.raw_lote_id);
        return;
      }

      // 2. INTERMITENTE
      if (item.tipo === "INTERMITENTE") {
        await IntermitentesLoteService.validarLote(item.id, user?.id || "");
        return;
      }

      // 3. PONTO
      if (item.tipo === "PONTO") {
        const { error } = await supabase
          .from("registros_ponto")
          .update({ status_processamento: "PROCESSADO" })
          .eq("id", item.id);
        if (error) throw error;
        return;
      }

      // 4. CUSTO EXTRA
      if (item.tipo === "CUSTO EXTRA") {
        const { data: custoData, error: fetchErr } = await supabase
          .from("custos_extras_operacionais" as any)
          .select("id, atualizado_em")
          .eq("id", item.id)
          .single();
        if (fetchErr) throw fetchErr;

        const { data: result, error } = await supabase.rpc("rpc_custo_extra_transicionar" as any, {
          p_id: item.id,
          p_acao: "aprovar",
          p_updated_at: custoData?.atualizado_em || null,
          p_justificativa: null,
        });
        if (error) throw error;
        return result;
      }

      // 5. SERVIÇO EXTRA
      if (item.tipo === "SERVIÇO EXTRA") {
        const { data: updated, error } = await supabase
          .from("servicos_extras_operacionais" as any)
          .update({ pipeline_status: "APROVADO_OPERACAO", atualizado_em: new Date().toISOString() })
          .eq("id", item.id)
          .select("id, empresa_id, data, descricao_servico, total, modalidade_financeira, pipeline_status")
          .maybeSingle();
        if (error) throw error;

        const currentItem = item;
        openPipeline(
          buildServicosExtrasPipeline({
            registroId: currentItem.id,
            empresaId: (updated as any)?.empresa_id || "",
            data: (updated as any)?.data || "",
            descricao: (updated as any)?.descricao_servico || "",
            valorTotal: Number((updated as any)?.total || 0),
            modalidade: (updated as any)?.modalidade_financeira || "CAIXA_IMEDIATO",
            pipelineStatus: (updated as any)?.pipeline_status || "APROVADO_OPERACAO",
          })
        );
        return updated;
      }

      // 6. OPERAÇÃO
      if (item.tipo === "OPERAÇÃO") {
        const { data: opData, error: opCheckErr } = await supabase
          .from("operacoes_producao")
          .select("id, status, entrada_ponto, saida_ponto")
          .eq("id", item.id)
          .single();

        if (opCheckErr) throw opCheckErr;

        if (opData?.status === "EM_RESTRICAO" || !opData?.entrada_ponto || !opData?.saida_ponto) {
          throw new Error("Esta operação possui restrições de horários e deve ser corrigida em Pendências antes de ser aprovada pelo RH.");
        }

        const { error } = await supabase.rpc("rpc_rh_aprovar_operacao", {
          p_operacao_id: item.id,
        });
        if (error) throw error;
        return;
      }

      // Fail-Closed para tipos não mapeados
      throw new Error(`Não foi possível identificar o fluxo de aprovação deste registro (tipo: "${(item as any)?.tipo || 'desconhecido'}"). Nenhuma alteração foi realizada.`);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Decisão aprovada com sucesso!", {
        description: "O registro avançou no fluxo operacional.",
      });
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao aprovar.", { description: err?.message });
    },
  });

  const devolverMutation = useMutation({
    mutationFn: async ({ item, motivo }: { item: ApprovalItem; motivo?: string }) => {
      // 1. DIARISTA
      if (item.tipo === "DIARISTA" && item.raw_lote_id) {
        const { error } = await supabase
          .from("diaristas_lotes_fechamento" as any)
          .update({ status: "AGUARDANDO_VALIDACAO_RH", updated_at: new Date().toISOString() })
          .eq("id", item.raw_lote_id);
        if (error) throw error;

        await supabase
          .from("lancamentos_diaristas")
          .update({ status: "AGUARDANDO_VALIDACAO_RH" })
          .eq("lote_fechamento_id", item.raw_lote_id);
        return;
      }

      // 2. INTERMITENTE
      if (item.tipo === "INTERMITENTE") {
        await IntermitentesLoteService.devolverLote(item.id, motivo || "Devolvido pelo RH via Painel Global");
        return;
      }

      // 3. PONTO
      if (item.tipo === "PONTO") {
        const { error } = await supabase
          .from("registros_ponto")
          .update({ status_processamento: "INCONSISTENTE" })
          .eq("id", item.id);
        if (error) throw error;
        return;
      }

      // 4. CUSTO EXTRA
      if (item.tipo === "CUSTO EXTRA") {
        const { error } = await supabase
          .from("custos_extras_operacionais" as any)
          .update({ pipeline_status: "REPROVADO", atualizado_em: new Date().toISOString() })
          .eq("id", item.id);
        if (error) throw error;
        return;
      }

      // 5. SERVIÇO EXTRA
      if (item.tipo === "SERVIÇO EXTRA") {
        const { error } = await supabase
          .from("servicos_extras_operacionais" as any)
          .update({ pipeline_status: "DEVOLVIDO", atualizado_em: new Date().toISOString() })
          .eq("id", item.id);
        if (error) throw error;
        return;
      }

      // 6. OPERAÇÃO
      if (item.tipo === "OPERAÇÃO") {
        const { error } = await supabase.rpc("rpc_rh_devolver_operacao", {
          p_operacao_id: item.id,
          p_motivo: motivo || null,
        });
        if (error) throw error;
        return;
      }

      // Fail-Closed para tipos não mapeados
      throw new Error(`Não foi possível identificar o fluxo de devolução deste registro (tipo: "${(item as any)?.tipo || 'desconhecido'}"). Nenhuma alteração foi realizada.`);
    },
    onSuccess: () => {
      invalidate();
      toast.warning("Registro devolvido para correção na origem.");
      setDrawerOpen(false);
    },
    onError: (err: any) => {
      toast.error("Erro ao devolver.", { description: err?.message });
    },
  });

  // ── Ações em Lote ──
  const handleBulkAprovar = async () => {
    const items = paginatedItems.filter((i) => selectedItems.includes(i.id));
    const aprovados: string[] = [];
    const falhas: string[] = [];

    for (const item of items) {
      try {
        await aprovarMutation.mutateAsync(item);
        aprovados.push(item.referencia);
      } catch (err: any) {
        falhas.push(`[${item.referencia}] ${err?.message || "Erro"}`);
      }
    }

    if (falhas.length > 0) {
      toast.warning(`${aprovados.length} aprovado(s). ${falhas.length} falharam.`, {
        description: falhas.join(" | "),
      });
    } else if (aprovados.length > 0) {
      toast.success(`${aprovados.length} itens aprovados com sucesso!`);
    }

    invalidate();
    setSelectedItems([]);
  };

  const handleBulkDevolver = async () => {
    const items = paginatedItems.filter((i) => selectedItems.includes(i.id));
    for (const item of items) {
      await devolverMutation.mutateAsync({ item }).catch(() => null);
    }
    toast.success("Itens devolvidos com sucesso.");
    invalidate();
    setSelectedItems([]);
  };

  // ── Seleção ──
  const toggleSelectAll = () => {
    if (selectedItems.length === paginatedItems.length) setSelectedItems([]);
    else setSelectedItems(paginatedItems.map((i) => i.id));
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleRowClick = (item: ApprovalItem) => {
    const isApproved = item.situacao === "Aprovado" || String(item.raw_status || "").toUpperCase() === "APROVADO_OPERACAO";
    if (item.tipo === "SERVIÇO EXTRA" && isApproved) {
      openServicoExtraContinuity(item);
      return;
    }
    setActiveItem(item);
    setDrawerOpen(true);
  };

  // ── 6 Pílulas de Domínio ──
  const DOMINIOS_TABS: Array<{ id: string; label: string; count: number; icon: any }> = [
    { id: "TODAS", label: "Todas as Filas", count: contadoresPorDominio.TODAS, icon: Layers },
    { id: "SERVIÇO EXTRA", label: "Serviços Extras", count: contadoresPorDominio.SERVICO_EXTRA, icon: Wrench },
    { id: "CUSTO EXTRA", label: "Custos Extras", count: contadoresPorDominio.CUSTO_EXTRA, icon: Wallet },
    { id: "DIARISTA", label: "Diaristas (Lotes)", count: contadoresPorDominio.DIARISTA, icon: Users },
    { id: "INTERMITENTE", label: "Intermitentes", count: contadoresPorDominio.INTERMITENTE, icon: Users },
    { id: "OPERAÇÃO", label: "Operações", count: contadoresPorDominio.OPERACAO, icon: Package },
    { id: "PONTO", label: "Pontos CLT", count: contadoresPorDominio.PONTO, icon: Clock },
  ];

  const isDevolvidosView = filtroRapidoKpi === "devolvidos" || situacaoFiltro === "DEVOLVIDO";

  return (
    <AppShell>
      <div className="max-w-[1560px] mx-auto p-4 md:p-6 space-y-5">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-display font-bold text-foreground tracking-tight">
                Central de Aprovações
              </h1>
              {isLocked && (
                <Badge variant="outline" className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/40 border-blue-200">
                  Modo Contextual: {dominioFiltro}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fila transversal de decisões que aguardam autorização para o fluxo continuar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedItems.length > 0 && (
              <div className="flex items-center gap-2 bg-muted/60 p-1 rounded-lg border border-border">
                <span className="text-xs font-semibold px-2 text-muted-foreground">
                  {selectedItems.length} selecionado(s)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDevolver}
                  disabled={devolverMutation.isPending}
                  className="h-8 text-xs font-bold text-rose-700 border-rose-200 hover:bg-rose-50 dark:text-rose-400"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Devolver
                </Button>
                <Button
                  size="sm"
                  onClick={handleBulkAprovar}
                  disabled={aprovarMutation.isPending}
                  className="h-8 text-xs font-bold bg-[#2563EB] hover:bg-[#2563EB]/90 text-white"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Aprovar
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 text-xs font-semibold"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isFetching && "animate-spin")} />
              Sincronizar
            </Button>
          </div>
        </div>

        {/* 1. Indicadores Operacionais Compactos (4 Cards UX08) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {/* Card 1: Aguardando Decisão */}
          <button
            type="button"
            onClick={() => {
              setFiltroRapidoKpi(filtroRapidoKpi === "aguardando_decisao" ? null : "aguardando_decisao");
              setSituacaoFiltro("PENDENTE");
            }}
            className={cn(
              "text-left p-3.5 rounded-xl border transition-all duration-200 bg-card hover:bg-muted/40",
              filtroRapidoKpi === "aguardando_decisao" || (situacaoFiltro === "PENDENTE" && !filtroRapidoKpi)
                ? "border-[#2563EB] ring-2 ring-[#2563EB]/20 shadow-sm"
                : "border-border shadow-xs"
            )}
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

          {/* Card 2: Mais Antigo na Fila */}
          <button
            type="button"
            onClick={() => setFiltroRapidoKpi(filtroRapidoKpi === "mais_antigos" ? null : "mais_antigos")}
            className={cn(
              "text-left p-3.5 rounded-xl border transition-all duration-200 bg-card hover:bg-muted/40",
              filtroRapidoKpi === "mais_antigos"
                ? "border-amber-500 ring-2 ring-amber-500/20 shadow-sm"
                : "border-border shadow-xs"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                Mais Antigo na Fila
              </span>
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-display font-extrabold text-amber-700 dark:text-amber-400">
                {kpis.maisAntigo.valor}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              {kpis.maisAntigo.descricao}
            </span>
          </button>

          {/* Card 3: Devolvidos */}
          <button
            type="button"
            onClick={() => {
              const next = filtroRapidoKpi === "devolvidos" ? null : "devolvidos";
              setFiltroRapidoKpi(next);
              setSituacaoFiltro(next ? "DEVOLVIDO" : "PENDENTE");
            }}
            className={cn(
              "text-left p-3.5 rounded-xl border transition-all duration-200 bg-card hover:bg-muted/40",
              filtroRapidoKpi === "devolvidos" || situacaoFiltro === "DEVOLVIDO"
                ? "border-rose-500 ring-2 ring-rose-500/20 shadow-sm"
                : "border-border shadow-xs"
            )}
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
                {fmt(kpis.impactoFinanceiro)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground block mt-0.5">
              Soma real dos itens com valor monetário
            </span>
          </div>
        </div>

        {/* 2. Pílulas de Domínio (6 Domínios Reais) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {DOMINIOS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isSelected = dominioFiltro === tab.id;
            const isTabDisabled = isLocked && tab.id !== dominioFiltro;

            if (isTabDisabled) return null;

            return (
              <button
                key={tab.id}
                type="button"
                disabled={isTabDisabled}
                onClick={() => {
                  if (!isLocked) {
                    setDominioFiltro(tab.id);
                    setCurrentPage(1);
                  }
                }}
                className={cn(
                  "h-9 px-3.5 rounded-lg flex items-center gap-2 border text-xs font-semibold whitespace-nowrap transition-all duration-200",
                  isSelected
                    ? "bg-[#2563EB] text-white border-[#2563EB] shadow-xs dark:bg-blue-600 dark:border-blue-600"
                    : "bg-card text-muted-foreground border-border hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className={cn("w-3.5 h-3.5", isSelected ? "text-white" : "text-muted-foreground")} />
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "ml-1 text-[10px] font-bold px-1.5 py-0.2 rounded-full",
                    isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3. Barra de Filtros Transversais */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            {/* Seletor de Empresa */}
            <Select value={empresaFiltro} onValueChange={setEmpresaFiltro}>
              <SelectTrigger className="h-9 w-[190px] text-xs font-semibold bg-background border-border">
                <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                <SelectValue placeholder="Empresa" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs font-semibold">Todas as Empresas</SelectItem>
                {empresas.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id} className="text-xs">
                    {emp.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Filtro Temporal */}
            <UxLabFiltroTemporal
              value={filtroTemporal}
              onChange={setFiltroTemporal}
              compact
            />

            {/* Seletor de Situação / Visão */}
            <Select
              value={situacaoFiltro}
              onValueChange={(v) => {
                setSituacaoFiltro(v);
                if (v === "DEVOLVIDO") setFiltroRapidoKpi("devolvidos");
                else if (v === "MAIS_ANTIGOS") setFiltroRapidoKpi("mais_antigos");
                else if (v === "PENDENTE") setFiltroRapidoKpi(null);
                setCurrentPage(1);
              }}
            >
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
                <SelectItem value="todos" className="text-xs">
                  Todos os Registros
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Busca Rápida */}
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por referência, colaborador, empresa, operação..."
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setCurrentPage(1);
                }}
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
                if (!isLocked) setDominioFiltro("TODAS");
              }}
              className="h-9 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Restaurar Fila Padrão
            </Button>
          )}
        </div>

        {/* Banner Contextual para Devolvidos */}
        {isDevolvidosView && (
          <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex items-start gap-3 text-xs text-rose-800 dark:text-rose-300 font-medium">
            <RotateCcw className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">VISÃO CONTEXTUAL DE HISTÓRICO:</span> Registros devolvidos para ajuste no ponto de origem. Itens devolvidos não possuem aprovação direta sem nova validação.
            </div>
          </div>
        )}

        {/* 4. Tabela Densa de Alta Densidade (Fila Dominante) */}
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-xs">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin" />
              <p className="text-xs text-muted-foreground font-medium">Carregando decisões da Central de Aprovações...</p>
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <div className="p-3 rounded-full bg-muted/60 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                {busca || situacaoFiltro !== "PENDENTE"
                  ? "Nenhum registro encontrado com os filtros selecionados."
                  : "Nenhuma aprovação pendente para o contexto selecionado."}
              </p>
              {(busca || situacaoFiltro !== "PENDENTE" || empresaFiltro !== "all") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBusca("");
                    setSituacaoFiltro("PENDENTE");
                    setFiltroRapidoKpi(null);
                    setEmpresaFiltro("all");
                  }}
                  className="text-xs font-semibold"
                >
                  Restaurar Fila Padrão
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Header Desktop */}
              <div className="hidden lg:grid grid-cols-12 gap-3 px-4 py-3 bg-muted/50 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider items-center">
                <div className="col-span-1 flex items-center gap-2">
                  <Checkbox
                    checked={selectedItems.length === paginatedItems.length && paginatedItems.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span>Ref</span>
                </div>
                <div className="col-span-2">Domínio</div>
                <div className="col-span-2">Empresa / Unidade</div>
                <div className="col-span-3">O que está sendo aprovado</div>
                <div className="col-span-2">Valor / Horas</div>
                <div className="col-span-1">Recebido</div>
                <div className="col-span-1 text-right">Ação</div>
              </div>

              {/* Linhas */}
              <div className="divide-y divide-border">
                {paginatedItems.map((item) => {
                  const isSelected = selectedItems.includes(item.id);
                  const sitBadge = SITUACAO_BADGES[item.situacao] || SITUACAO_BADGES["Em análise"];

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className={cn(
                        "group p-4 lg:px-4 lg:py-3 transition-colors cursor-pointer hover:bg-muted/30",
                        isSelected && "bg-muted/40"
                      )}
                    >
                      {/* Layout Desktop */}
                      <div className="hidden lg:grid grid-cols-12 gap-3 items-center text-xs">
                        {/* Col 1: Checkbox + Código */}
                        <div className="col-span-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectItem(item.id)}
                          />
                          <span className="font-mono text-xs font-bold text-foreground">
                            {item.referencia}
                          </span>
                        </div>

                        {/* Col 2: Domínio Badge */}
                        <div className="col-span-2">
                          {renderDominioBadge(item.tipo)}
                        </div>

                        {/* Col 3: Empresa / Unidade */}
                        <div className="col-span-2">
                          <span className="font-semibold text-foreground block truncate">
                            {item.empresa}
                          </span>
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {item.operacao || "Operacional"}
                          </span>
                        </div>

                        {/* Col 4: Colaborador + Descrição */}
                        <div className="col-span-3 space-y-0.5">
                          <span className="font-bold text-foreground block leading-tight truncate">
                            {item.colaborador}
                          </span>
                          <span className="text-[11px] text-muted-foreground block line-clamp-1">
                            {item.descricao}
                          </span>
                        </div>

                        {/* Col 5: Valor / Horas */}
                        <div className="col-span-2 space-y-0.5">
                          <span className="font-mono font-bold text-sm text-foreground block">
                            {fmt(item.valor)}
                          </span>
                          {item.horas && (
                            <span className="text-[11px] text-muted-foreground font-medium block">
                              {item.horas}
                            </span>
                          )}
                        </div>

                        {/* Col 6: Data Recebimento */}
                        <div className="col-span-1">
                          <span className="text-[11px] text-muted-foreground block">
                            {fmtDate(item.data_recebimento)}
                          </span>
                        </div>

                        {/* Col 7: Ação Rápida */}
                        <div className="col-span-1 text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRowClick(item)}
                            className="h-8 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Ver
                          </Button>
                        </div>
                      </div>

                      {/* Layout Mobile */}
                      <div className="lg:hidden space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {renderDominioBadge(item.tipo)}
                            <span className="font-mono text-xs font-bold">{item.referencia}</span>
                          </div>
                          <span className="font-mono font-bold text-sm text-foreground">
                            {fmt(item.valor)}
                          </span>
                        </div>
                        <div>
                          <span className="font-bold text-foreground text-xs block">{item.colaborador}</span>
                          <span className="text-xs text-muted-foreground block">{item.empresa} · {item.descricao}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Paginação */}
              <div className="px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between border-t border-border bg-muted/20 gap-3">
                <span className="text-xs text-muted-foreground font-medium">
                  Mostrando {paginatedItems.length} de {aprovacoesFiltradas.length} decisões
                </span>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Itens por página</span>
                    <Select value={String(itemsPerPage)} onValueChange={(v) => setItemsPerPage(Number(v))}>
                      <SelectTrigger className="h-8 w-16 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 25, 50].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(1)}
                      >
                        «
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                      >
                        <ChevronRight className="h-4 w-4 rotate-180" />
                      </Button>
                      <span className="text-xs font-semibold px-2">
                        {currentPage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage(totalPages)}
                      >
                        »
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Drawer Decisório Oficial */}
      <AprovacaoDecisaoDrawer
        item={activeItem}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onAprovar={(item) => aprovarMutation.mutate(item)}
        onDevolver={(item, motivo) => devolverMutation.mutate({ item, motivo })}
        isAprovando={aprovarMutation.isPending}
        isDevolvendo={devolverMutation.isPending}
      />
    </AppShell>
  );
}
