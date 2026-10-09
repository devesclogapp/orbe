import React, { useMemo, useState, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { DrawerPrimarioShell } from "@/components/continuity/DrawerPrimarioShell";
import {
    DrawerReaberturaDiarista,
    DrawerEdicaoDiarista,
    DrawerFechamentoDiarista,
} from "@/components/diaristas/drawers";
import {
    Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import {
    DiaristaCicloService,
    EmpresaService,
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService,
    UnidadeOperacionalService,
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { buildDiaristasPipeline, buildDiaristasDevolvidoPipeline, useOperationalPipeline } from "@/contexts/OperationalPipelineContext";
import { ExecutiveMetricCard } from "@/components/dashboard/ExecutiveMetricCard";
import {
    CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Lock,
    RefreshCw, Users, Calendar, Table as TableIcon, Settings, Send, FileCheck, History,
    CalendarClock, Banknote, FileCode2, Laptop, Building2, Filter, Search, SlidersHorizontal,
    AlertTriangle, ShieldCheck
} from "lucide-react";

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
    format(new Date(d + "T12:00:00"), "dd/MM", { locale: ptBR });

// ─── Mapa de status: cobre todos os valores conhecidos (DB default lowercase + governança uppercase + legado) ───
const STATUS_DIARISTA_MAP: Record<string, { label: string; cls: string; opacity: string }> = {
    em_aberto: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    EM_ABERTO: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    AGUARDANDO_VALIDACAO_RH: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-[0.95]" },
    VALIDADO_RH: { label: "🟢 Validado RH", cls: "bg-cyan-50 text-cyan-600 border-cyan-100", opacity: "opacity-[0.95]" },
    FECHADO_FINANCEIRO: { label: "🔵 Financeiro", cls: "bg-emerald-50 text-emerald-600 border-emerald-100", opacity: "opacity-[0.90]" },
    AGUARDANDO_FINANCEIRO: { label: "🔵 Financeiro", cls: "bg-emerald-50 text-emerald-600 border-emerald-100", opacity: "opacity-[0.90]" },
    CNAB_GERADO: { label: "🟣 CNAB Gerado", cls: "bg-indigo-50 text-indigo-600 border-indigo-100", opacity: "opacity-[0.80]" },
    PAGO: { label: "💰 Pago", cls: "bg-blue-50 text-blue-600 border-blue-100", opacity: "opacity-[0.70]" },
    DEVOLVIDO: { label: "Devolvido", cls: "bg-rose-50 text-rose-600 border-rose-100", opacity: "opacity-100" },
    cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground", opacity: "opacity-100" },
    CANCELADO: { label: "Cancelado", cls: "bg-muted text-muted-foreground", opacity: "opacity-100" },
    fechado_para_pagamento: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    fechado: { label: "🟡 Em análise RH", cls: "bg-amber-50 text-amber-600 border-amber-100", opacity: "opacity-100" },
    CONCLUIDO: { label: "⚫ Concluído", cls: "bg-zinc-100 text-zinc-500 border-zinc-200", opacity: "opacity-[0.60]" },
};

const StatusDiaristaBadge = ({ status }: { status?: string }) => {
    if (!status) return null;
    const entry = STATUS_DIARISTA_MAP[status];
    return (
        <Badge variant="outline" className={cn(
            "h-6 px-2 text-[11px] font-medium border shadow-none",
            entry?.cls ?? "bg-muted text-muted-foreground"
        )}>
            {entry?.label ?? status}
        </Badge>
    );
};


type StatusFilter = "todos" | "em_aberto" | "AGUARDANDO_VALIDACAO_RH" | "VALIDADO_RH" | "FECHADO_FINANCEIRO" | "PAGO";

type Visao = "diarista" | "data" | "grade_semanal";
type TabPrincipal = "grade_semanal" | "diarista" | "lotes" | "auditoria";
type PeriodoRapido = "semana_atual" | "semana_anterior" | "personalizado";

// (CycleManagementSection removed — logic inlined into RhDiaristasPainel for proper data access)

const RhDiaristasPainel = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { openPipeline } = useOperationalPipeline();

    const [tabPrincipal, setTabPrincipal] = useState<TabPrincipal>("grade_semanal");
    const [periodoRapido, setPeriodoRapido] = useState<PeriodoRapido>("semana_atual");

    // Inicializa com semana atual em vez de mês atual, se o filtro rápido for "semana_atual"
    const [inicio, setInicio] = useState(format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));
    const [fim, setFim] = useState(format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"));

    const [visao, setVisao] = useState<Visao>("grade_semanal");
    const [statusFiltro, setStatusFiltro] = useState<StatusFilter>("todos");
    const [nomeFiltro, setNomeFiltro] = useState("");
    const [funcaoFiltro, setFuncaoFiltro] = useState("todos");
    // Filtro de empresa — "todos" = visão consolidada de todas as empresas
    const [empresaFiltroId, setEmpresaFiltroId] = useState<string>("todos");
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [openFechamento, setOpenFechamento] = useState(false);
    const [obsLote, setObsLote] = useState("");
    const [confirmText, setConfirmText] = useState("");
    const [cicloTab, setCicloTab] = useState<"ciclos" | "lotes" | "historico" | "configuracao">("ciclos");

    // ── Estado: Modal Reabertura ────────────────────────────────────────────
    const [openReabertura, setOpenReabertura] = useState(false);
    const [motivoReabertura, setMotivoReabertura] = useState("");
    const [tipoReabertura, setTipoReabertura] = useState<'operacional' | 'administrativa'>('operacional');

    // ─── Intelligent Period Detection ───────────────────────────────────────────
    useQuery({
        queryKey: ["latest-active-cycle"],
        queryFn: async () => {
            const latest = await DiaristaCicloService.getLatestActiveWeek();
            if (latest && periodoRapido === "semana_atual") {
                const now = new Date();
                const startOfNow = startOfWeek(now, { weekStartsOn: 1 });
                const currentStartStr = format(startOfNow, "yyyy-MM-dd");

                if (currentStartStr !== latest.data_inicio) {
                    setInicio(latest.data_inicio);
                    setFim(latest.data_fim);
                    setPeriodoRapido("personalizado");
                }
            }
            return latest;
        },
        staleTime: Infinity,
        enabled: periodoRapido === "semana_atual"
    });
    const [loteParaReabrir, setLoteParaReabrir] = useState<any>(null);
    // ──────────────────────────────────────────────────────────────────

    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data, error } = await supabase.from("profiles").select("role, tenant_id, full_name").eq("user_id", user.id).maybeSingle();
            if (error) throw error;
            return data as any;
        },
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas"],
        queryFn: () => EmpresaService.getAll(),
    });

    // Buscar unidades para resolução de nomes no painel
    const { data: unidadesRes = [] } = useQuery({
        queryKey: ["unidades_operacionais_todas"],
        queryFn: async () => {
            // Se tiver muitas empresas, pode ser pesado, mas para o painel de RH é necessário
            // por ora buscamos todas as unidades para o mapeamento
            const { data, error } = await supabase.from('unidades_operacionais').select('id, nome');
            if (error) return [];
            return data;
        }
    });

    const unidadeMap = useMemo(() => {
        const map = new Map<string, string>();
        (unidadesRes as any[]).forEach(u => map.set(u.id, u.nome));
        return map;
    }, [unidadesRes]);

    const rawRole = perfil?.role || user?.user_metadata?.role || user?.app_metadata?.role || user?.role || "";
    const role = (typeof rawRole === "string" ? rawRole : "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrador" || role.includes("admin");
    const isRh = role === "rh" || role === "recursos humanos" || role === "recursos_humanos" || role.includes("rh");
    // Empresa do usuário — Como empresa_id não está no profile base, tentamos ler do tenant context ou ignoramos
    const empresaIdDoUsuario = perfil?.tenant_id ?? ((empresas as any[])[0]?.id ?? "");

    // ── Busca de lotes: usa interseção de período (já corrigida no service) ──────────────────
    const { data: lotes = [], refetch: refetchLotes, isLoading: isLoadingLotes } = useQuery({
        queryKey: ["lotes_fechamento_painel", inicio, fim, empresaFiltroId],
        queryFn: () => LoteFechamentoDiaristaService.getLotesPorPeriodo(
            inicio,
            fim,
            empresaFiltroId === "todos" ? null : empresaFiltroId
        ),
        enabled: true,
    });

    // ── Busca de lotes para o Histórico Consolidado de Ciclos (janela ampla de 26 semanas) ──
    const { data: todosLotesHistorico = [] } = useQuery({
        queryKey: ["lotes_historico_consolidado", empresaFiltroId],
        queryFn: () => {
            const dFim = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
            const dInicio = format(subWeeks(new Date(), 26), "yyyy-MM-dd");
            return LoteFechamentoDiaristaService.getLotesPorPeriodo(
                dInicio,
                dFim,
                empresaFiltroId === "todos" ? null : empresaFiltroId
            );
        },
        enabled: true,
    });

    const lotesHistoricoParaTabela = useMemo(() => {
        const map = new Map<string, any>();
        (todosLotesHistorico as any[]).forEach(l => map.set(l.id, l));
        (lotes as any[]).forEach(l => map.set(l.id, l));
        return Array.from(map.values());
    }, [todosLotesHistorico, lotes]);

    // ── Lançamentos: estratégia dupla para cobrir ciclos consolidados ─────────────────────────
    // 1) Busca por período: captura registros EM_ABERTO dentro do filtro UI
    // 2) Busca por lote IDs: captura todos os registros dos lotes que intersectam o período,
    //    independentemente de o data_lancamento estar dentro do filtro da UI
    // Ambos são mesclados e deduplicados por ID para garantir visão completa.
    const loteIds = useMemo(() => (lotes as any[]).map(l => l.id).filter(Boolean), [lotes]);

    const { data: lancamentosPorPeriodo = [], isLoading: isLoadingPorPeriodo, isFetching: isFetchingPorPeriodo } = useQuery({
        queryKey: ["lancamentos_diaristas_painel_periodo", inicio, fim, statusFiltro, empresaFiltroId],
        queryFn: async () => {
            const empId = empresaFiltroId === "todos" ? null : empresaFiltroId;
            const result = await LancamentoDiaristaService.getByPeriodo(
                empId,
                inicio,
                fim,
                statusFiltro !== "todos" ? { status: statusFiltro as any } : undefined,
            );
            console.log(`[PainelRH][período] ${result?.length || 0} registros | empresa: ${empresaFiltroId} | período: ${inicio}→${fim}`);
            return result ?? [];
        },
        enabled: !!inicio && !!fim,
    });

    const { data: lancamentosPorLote = [], isLoading: isLoadingPorLote, isFetching: isFetchingPorLote } = useQuery({
        queryKey: ["lancamentos_diaristas_painel_lotes", loteIds],
        queryFn: async () => {
            if (!loteIds.length) return [];
            const result = await LoteFechamentoDiaristaService.getLancamentosByLoteIds(loteIds);
            console.log(`[PainelRH][lotes] ${result?.length || 0} registros | loteIds: ${loteIds.length}`);
            return result ?? [];
        },
        enabled: loteIds.length > 0,
    });

    // Mescla e deduplicação por ID — precedência para registro do lote (mais completo/atualizado)
    const lancamentos = useMemo(() => {
        const map = new Map<string, any>();
        // Primeiro insere os lançamentos por período (podem estar em_aberto)
        for (const l of lancamentosPorPeriodo as any[]) {
            map.set(l.id, l);
        }
        // Depois sobrescreve com os lançamentos dos lotes (status atualizado)
        for (const l of lancamentosPorLote as any[]) {
            // Aplica filtro de status aqui também para manter consistência
            if (statusFiltro !== "todos") {
                const s = l.status?.toLowerCase();
                const f = statusFiltro.toLowerCase();
                if (s !== f) continue;
            }
            map.set(l.id, l);
        }
        const merged = Array.from(map.values());
        console.log(`[PainelRH][merged] ${merged.length} registros únicos (${lancamentosPorPeriodo.length} por período + ${lancamentosPorLote.length} por lote)`);
        return merged;
    }, [lancamentosPorPeriodo, lancamentosPorLote, statusFiltro]);

    const isLoading = isLoadingPorPeriodo || isLoadingPorLote;
    const isFetching = isFetchingPorPeriodo || isFetchingPorLote;

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_periodo"] });
        queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_lotes"] });
    };

    const periodoBloqueado = useMemo(() => {
        if (empresaFiltroId === "todos") return false;

        const loteAtivo = (lotes as any[]).find(l =>
            l.empresa_id === empresaFiltroId &&
            [
                "AGUARDANDO_VALIDACAO_RH",
                "VALIDADO_RH",
                "AGUARDANDO_FINANCEIRO",
                "FECHADO_FINANCEIRO",
                "PAGO"
            ].includes(l.status)
        );

        if (loteAtivo && loteAtivo.tipo_reabertura === "administrativa" && (isAdmin || isRh)) {
            return false;
        }

        return !!loteAtivo;
    }, [lotes, empresaFiltroId, isAdmin, isRh]);

    // periodoBloqueadoAdministrativo: verdadeiro quando o lote foi reaberto
    // em modo administrativo - usado para exibir aviso diferenciado
    const loteEmCorrecaoAdmin = useMemo(() => {
        if (empresaFiltroId === "todos") return null;
        return (lotes as any[]).find(l =>
            l.empresa_id === empresaFiltroId &&
            l.status === "AGUARDANDO_VALIDACAO_RH" &&
            l.tipo_reabertura === "administrativa"
        ) ?? null;
    }, [lotes, empresaFiltroId]);

    const statusCicloAtual = useMemo(() => {
        if ((lotes as any[]).length === 0) return "EM ANDAMENTO";
        const statuses = new Set((lotes as any[]).map((l: any) => l.status));
        if (statuses.has("AGUARDANDO_VALIDACAO_RH")) return "PENDENTE RH";
        if (statuses.has("VALIDADO_RH") || statuses.has("AGUARDANDO_FINANCEIRO")) return "PENDENTE FINANCEIRO";
        if ((lotes as any[]).every((l: any) => ["PAGO", "FECHADO_FINANCEIRO"].includes(l.status))) return "FINALIZADO";
        return "EM ANDAMENTO";
    }, [lotes]);

    const { data: regraFechamento, refetch: refetchRegra } = useQuery({
        queryKey: ["regra_fechamento_diaristas"],
        queryFn: () => DiaristaCicloService.getRegraFechamento(),
    });

    const { data: logsFechamento = [], refetch: refetchHistorico, isFetching: isFetchingLogs } = useQuery({
        queryKey: ["diaristas_logs_fechamento", empresaFiltroId, perfil?.tenant_id],
        queryFn: async () => {
            if (!perfil?.tenant_id) return [];

            let q = supabase
                .from("diaristas_logs_fechamento")
                .select("*")
                .eq("tenant_id", perfil.tenant_id)
                .order("created_at", { ascending: false })
                .limit(200);

            if (empresaFiltroId !== "todos") {
                q = q.eq("empresa_id", empresaFiltroId);
            }

            const { data, error } = await q;
            if (error) {
                console.error("Erro ao buscar histórico:", error);
                throw error;
            }
            return data ?? [];
        },
        enabled: !!perfil?.tenant_id,
    });


    const groupedLogs = useMemo(() => {
        if (!logsFechamento) return [];
        const grouped = [];
        let currentGroup: any = null;

        for (const log of logsFechamento as any[]) {
            if (!currentGroup) {
                currentGroup = { ...log, count: 1, grouped_ids: [log.id] };
                grouped.push(currentGroup);
                continue;
            }

            // Group if same action, same user, same period, within 5 minutes
            const timeDiff = Math.abs(new Date(currentGroup.created_at).getTime() - new Date(log.created_at).getTime());
            const isWithin5Minutes = timeDiff <= 5 * 60 * 1000;

            if (
                currentGroup.acao === log.acao &&
                currentGroup.usuario_id === log.usuario_id &&
                currentGroup.periodo_inicio === log.periodo_inicio &&
                currentGroup.periodo_fim === log.periodo_fim &&
                isWithin5Minutes
            ) {
                currentGroup.count += 1;
                currentGroup.grouped_ids.push(log.id);
                // Concatenate motivos if different
                if (log.motivo && currentGroup.motivo && !currentGroup.motivo.includes(log.motivo)) {
                    currentGroup.motivo = `${currentGroup.motivo} | ${log.motivo}`;
                } else if (log.motivo && !currentGroup.motivo) {
                    currentGroup.motivo = log.motivo;
                }
            } else {
                currentGroup = { ...log, count: 1, grouped_ids: [log.id] };
                grouped.push(currentGroup);
            }
        }
        return grouped;
    }, [logsFechamento]);

    const exportarAuditoriaXlsx = async () => {
        if (!logsFechamento || logsFechamento.length === 0) {
            toast.warning("Nenhum log para exportar.");
            return;
        }
        try {
            const { utils, writeFile } = await import("xlsx");
            const rows = (logsFechamento as any[]).map(log => ({
                "Data/Hora": format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss"),
                "Ação": log.acao,
                "Usuário": log.usuario_nome || "Sistema",
                "Perfil": log.usuario_role || "sistema",
                "Período Início": log.periodo_inicio ? format(new Date(log.periodo_inicio + "T12:00:00"), "dd/MM/yyyy") : "-",
                "Período Fim": log.periodo_fim ? format(new Date(log.periodo_fim + "T12:00:00"), "dd/MM/yyyy") : "-",
                "Motivo/Obs": log.motivo || "-",
                "IP": log.ip_address || "-",
                "Dispositivo": log.user_agent || "-",
                "Empresa ID": log.empresa_id || "-",
            }));

            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Auditoria");
            writeFile(wb, `Auditoria_Fechamentos_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
            toast.success("Trilha de auditoria exportada com sucesso.");
        } catch {
            toast.error("Erro ao exportar a planilha de auditoria.");
        }
    };

    const [loteParaEdicao, setLoteParaEdicao] = useState<any>(null);
    const [openEdicao, setOpenEdicao] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [lancamentoEditando, setLancamentoEditando] = useState<any>(null);
    const [valorAnterior, setValorAnterior] = useState(0);

    const loteContext = useMemo(() => {
        if (!lancamentoEditando?.lote_fechamento_id) return null;
        return (lotes as any[]).find(l => l.id === lancamentoEditando.lote_fechamento_id);
    }, [lancamentoEditando, lotes]);

    const editarMutation = useMutation({
        mutationFn: async (payload: any) => {
            if (!lancamentoEditando) throw new Error("Lançamento não encontrado.");
            if (!payload.motivo_edicao || payload.motivo_edicao.trim().length < 5) {
                throw new Error("Motivo da alteração é obrigatório e deve ter ao menos 5 caracteres.");
            }

            // ── PASSO 1: Capturar snapshot ANTES de qualquer mutação ──────────────
            // Busca direto do banco (nunca do cache React Query)
            // para garantir que os valores "anteriores" são os reais do DB.
            const { data: snapshotDb, error: errSnapshot } = await supabase
                .from("lancamentos_diaristas")
                .select("valor_calculado, codigo_marcacao, lote_fechamento_id, empresa_id")
                .eq("id", lancamentoEditando.id)
                .single();

            if (errSnapshot || !snapshotDb) {
                throw new Error("Falha ao capturar o estado original do lançamento para auditoria.");
            }

            // Snapshot imutável — reflete exatamente o estado do DB pré-edição
            const snapshotAnterior = {
                valor: Number(snapshotDb.valor_calculado || 0),
                marcacao: String(snapshotDb.codigo_marcacao || ""),
                lote_id: snapshotDb.lote_fechamento_id as string | null,
                empresa_id: snapshotDb.empresa_id as string
            };

            // ── PASSO 2: Buscar dados do lote do DB (não do cache) para auditoria ─
            let loteDb: { id: string; periodo_inicio: string; periodo_fim: string } | null = null;

            if (snapshotAnterior.lote_id) {
                const { data: loteRaw } = await supabase
                    .from("diaristas_lotes_fechamento")
                    .select("id, periodo_inicio, periodo_fim")
                    .eq("id", snapshotAnterior.lote_id)
                    .maybeSingle();
                loteDb = loteRaw ?? null;
            }

            // Fallback: tenta encontrar lote pelo empresa_id + data do lançamento
            if (!loteDb && snapshotAnterior.empresa_id) {
                const { data: loteByEmpresa } = await (supabase as any)
                    .from("diaristas_lotes_fechamento")
                    .select("id, periodo_inicio, periodo_fim")
                    .eq("empresa_id", snapshotAnterior.empresa_id)
                    .lte("periodo_inicio", lancamentoEditando.data_lancamento)
                    .gte("periodo_fim", lancamentoEditando.data_lancamento)
                    .maybeSingle();
                loteDb = loteByEmpresa ?? null;
            }

            // ── PASSO 3: Executar o update no banco ────────────────────────────────
            const result = await LancamentoDiaristaService.updateAdmin(lancamentoEditando.id, {
                data_lancamento: payload.data_lancamento,
                codigo_marcacao: payload.codigo_marcacao,
                quantidade_diaria: payload.quantidade_diaria,
                valor_diaria_base: payload.valor_diaria_base,
                valor_calculado: payload.valor_calculado,
                observacao: payload.observacao,
                editado_admin: true,
                editado_por: user?.id,
                editado_em: new Date().toISOString(),
                motivo_edicao: payload.motivo_edicao,
            });


            // ── PASSO 4: Registrar auditoria com valores pré-mutação ───────────────
            // snapshotAnterior foi capturado ANTES do updateAdmin — correto.
            const msgAuditoria =
                `Editou lançamento do colaborador ${lancamentoEditando.nome_colaborador} ` +
                `(Data: ${formatDate(lancamentoEditando.data_lancamento)}). ` +
                `Valor: ${formatCurrency(snapshotAnterior.valor)} -> ${formatCurrency(payload.valor_calculado)}. ` +
                `Marcação: ${snapshotAnterior.marcacao} -> ${payload.codigo_marcacao}. ` +
                `Motivo: ${payload.motivo_edicao}`;


            const { error: logError } = await supabase.from("diaristas_logs_fechamento").insert({
                empresa_id: snapshotAnterior.empresa_id,
                tenant_id: perfil?.tenant_id,
                usuario_id: user?.id,
                usuario_nome: perfil?.full_name || perfil?.nome_completo || user?.email || "Admin",
                usuario_role: role || "admin",
                acao: "EDITOU_LANCAMENTO_ADMIN",
                periodo_inicio: loteDb?.periodo_inicio ?? lancamentoEditando.data_lancamento,
                periodo_fim: loteDb?.periodo_fim ?? lancamentoEditando.data_lancamento,
                motivo: msgAuditoria
            });

            if (logError) {
                console.error("[ADMIN EDIT] Erro ao inserir log de auditoria:", logError);
            }

            // ── PASSO 5: Recalcular via RPC SECURITY DEFINER ─────────────────────
            // A RPC recalcular_valor_lote soma TODOS os lançamentos do lote
            // (por lote_fechamento_id + por período) com SECURITY DEFINER,
            // contornando qualquer RLS que possa bloquear o cliente.
            const loteIdParaRecalculo = loteDb?.id ?? snapshotAnterior.lote_id;

            if (loteIdParaRecalculo) {
                const { data: rpcResult, error: rpcError } = await (supabase as any).rpc(
                    "recalcular_valor_lote",
                    { p_lote_id: loteIdParaRecalculo }
                );

                if (rpcError) {
                    // RPC ainda não deployada — usa fallback direto
                    console.warn("[ADMIN EDIT] RPC falhou, usando fallback direto:", rpcError);

                    if (loteDb?.periodo_inicio && loteDb?.periodo_fim) {
                        const { data: allLancs } = await (supabase as any)
                            .from("lancamentos_diaristas")
                            .select("valor_calculado")
                            .eq("empresa_id", snapshotAnterior.empresa_id)
                            .gte("data_lancamento", loteDb.periodo_inicio)
                            .lte("data_lancamento", loteDb.periodo_fim);

                        if (allLancs && allLancs.length > 0) {
                            const novoTotal = allLancs.reduce(
                                (acc: number, l: any) => acc + Number(l.valor_calculado || 0), 0
                            );

                            const { error: updateErr } = await (supabase as any)
                                .from("diaristas_lotes_fechamento")
                                .update({ valor_total: novoTotal, updated_at: new Date().toISOString() })
                                .eq("id", loteIdParaRecalculo);

                        }
                    }
                }
            } else {
                console.warn("[ADMIN EDIT] Sem lote para recalcular. loteDb:", loteDb, "lote_id:", snapshotAnterior.lote_id);
            }

            return result;
        },
        onSuccess: () => {
            toast.success("Edição administrativa registrada e totais recalculados.");
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_periodo"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_lotes"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_producao"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_semana"] });
            queryClient.invalidateQueries({ queryKey: ["historico_recente_diaristas"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_lancamento"] });
            queryClient.invalidateQueries({ queryKey: ["central_bancaria_diaristas"] });
            refetchHistorico();
            refetchLotes();
            setOpenEdicao(false);
        },
        onError: (err: any) => toast.error("Erro na edição admin.", { description: err.message }),
    });

    // Recálculo automático
    const recalcularValor = (qtd: number, base: number) => {
        const novoValor = qtd * base;
        setEditForm((prev: any) => ({ ...prev, quantidade_diaria: qtd, valor_diaria_base: base, valor_calculado: novoValor }));
    };

    // Agrupar lançamentos por diarista
    const dadosAgrupados = useMemo(() => {
        let items = lancamentos as any[];

        // Filtro de empresa (client-side)
        if (empresaFiltroId !== "todos") {
            items = items.filter((l) => l.empresa_id === empresaFiltroId);
        }
        if (nomeFiltro) {
            const q = nomeFiltro.toLowerCase();
            items = items.filter((l) => (l.nome_colaborador ?? "").toLowerCase().includes(q));
        }
        if (funcaoFiltro !== "todos") {
            items = items.filter((l) => l.funcao_colaborador === funcaoFiltro);
        }

        const map: Record<string, {
            diarista_id: string;
            nome: string;
            funcao: string;
            lancamentos: any[];
            contagem: Record<string, number>;
            totalDiarias: number;
            valorTotal: number;
            status: string;
            unidade_id: string | null;
            local_id: string | null;
            cliente_unidade_fallback: string | null;
        }> = {};

        items.forEach((l) => {
            const key = l.diarista_id;
            if (!map[key]) {
                map[key] = {
                    diarista_id: l.diarista_id,
                    nome: l.nome_colaborador ?? "(Sem nome)",
                    funcao: l.funcao_colaborador ?? "—",
                    lancamentos: [],
                    contagem: {},
                    totalDiarias: 0,
                    valorTotal: 0,
                    status: l.status,
                    unidade_id: l.unidade_id,
                    local_id: l.local_id,
                    cliente_unidade_fallback: l.cliente_unidade,
                };
            }
            map[key].lancamentos.push(l);
            map[key].contagem[l.codigo_marcacao] = (map[key].contagem[l.codigo_marcacao] || 0) + 1;
            map[key].totalDiarias += Number(l.quantidade_diaria || 0);
            map[key].valorTotal += Number(l.valor_calculado || 0);

            // SINCRONIZAÇÃO VISUAL: Se o lançamento ainda estiver 'em_aberto' no banco mas o lote já avançou,
            // usamos o status do lote para garantir consistência visual imediata.
            // Nota: O backend (RPC) já cuida da persistência, mas os dados locais podem estar em transição.
            const loteRelacionado = (lotes as any[]).find(lote => lote.empresa_id === l.empresa_id);
            if (loteRelacionado && (l.status === "EM_ABERTO" || l.status === "em_aberto")) {
                map[key].status = loteRelacionado.status;
            } else {
                map[key].status = l.status;
            }
        });


        return Object.values(map).sort((a, b) => (a.nome ?? "").localeCompare(b.nome ?? ""));
    }, [lancamentos, nomeFiltro, funcaoFiltro, empresaFiltroId, lotes]);

    // Agrupar lançamentos por data
    const dadosAgrupadosPorData = useMemo(() => {
        let items = lancamentos as any[];

        // Filtro de empresa (client-side)
        if (empresaFiltroId !== "todos") {
            items = items.filter((l) => l.empresa_id === empresaFiltroId);
        }
        if (nomeFiltro) {
            const q = nomeFiltro.toLowerCase();
            items = items.filter((l) => (l.nome_colaborador ?? "").toLowerCase().includes(q));
        }
        if (funcaoFiltro !== "todos") {
            items = items.filter((l) => l.funcao_colaborador === funcaoFiltro);
        }

        const map: Record<string, {
            data_lancamento: string;
            lancamentos: any[];
            totalDiaristas: number;
            totalDiarias: number;
            valorTotal: number;
        }> = {};

        items.forEach((l) => {
            const key = l.data_lancamento;
            if (!map[key]) {
                map[key] = {
                    data_lancamento: key,
                    lancamentos: [],
                    totalDiaristas: 0,
                    totalDiarias: 0,
                    valorTotal: 0,
                };
            }
            map[key].lancamentos.push(l);
            map[key].totalDiarias += Number(l.quantidade_diaria || 0);
            map[key].valorTotal += Number(l.valor_calculado || 0);
        });

        return Object.values(map)
            .sort((a, b) => new Date(b.data_lancamento).getTime() - new Date(a.data_lancamento).getTime())
            .map(g => ({
                ...g,
                totalDiaristas: new Set(g.lancamentos.map((l) => l.diarista_id)).size
            }));
    }, [lancamentos, nomeFiltro, funcaoFiltro, empresaFiltroId]);

    // KPIs baseados nos dados filtrados (reagem ao statusFiltro e filtros de nome/função)
    const totalGeral = useMemo(() => {
        // Para KPIs, usa os lancamentos filtrados por status (mas sem filtro de nome/função)
        // para preservar a semântica: "total do que está visível no status selecionado"
        const lancsFiltradosPorStatus = statusFiltro !== "todos"
            ? (lancamentos as any[]).filter((l) => l.status === statusFiltro)
            : (lancamentos as any[]);

        const openStatuses = ["em_aberto", "EM_ABERTO", "AGUARDANDO_VALIDACAO_RH"];

        return {
            valorTotal: dadosAgrupados.reduce((a, g) => a + g.valorTotal, 0),
            totalDiaristas: dadosAgrupados.length,
            totalRegistros: lancsFiltradosPorStatus.length,
            emAberto: (lancamentos as any[]).filter((l) => {
                // SINCRONIZAÇÃO: Usa status do lote se o registro ainda estiver 'em_aberto' no DB
                const loteRelacionado = (lotes as any[]).find(lote => lote.empresa_id === l.empresa_id);
                const effectiveStatus = (loteRelacionado && (l.status === "EM_ABERTO" || l.status === "em_aberto"))
                    ? loteRelacionado.status
                    : l.status;
                return openStatuses.includes(effectiveStatus);
            }).length,
        };
    }, [dadosAgrupados, lancamentos, statusFiltro, lotes]);

    // rawEmAberto: conta apenas registros da empresa do usuário em aberto (para o fechamento)
    const rawEmAberto = useMemo(() => {
        return (lancamentos as any[]).filter((l) => {
            const loteRelacionado = (lotes as any[]).find(lote => lote.empresa_id === l.empresa_id);
            const effectiveStatus = (loteRelacionado && (l.status === "EM_ABERTO" || l.status === "em_aberto"))
                ? loteRelacionado.status
                : l.status;
            return (effectiveStatus === "em_aberto" || effectiveStatus === "EM_ABERTO") && l.empresa_id === empresaIdDoUsuario;
        }).length;
    }, [lancamentos, empresaIdDoUsuario, lotes]);

    const lotesPendentesRh = useMemo(() => {
        return (lotes as any[]).filter(l => l.status === "AGUARDANDO_VALIDACAO_RH").length;
    }, [lotes]);

    const lotesPendentesFin = useMemo(() => {
        return (lotes as any[]).filter(l => l.status === "VALIDADO_RH" || l.status === "AGUARDANDO_FINANCEIRO").length;
    }, [lotes]);

    const totalDiariasApuradas = useMemo(() => {
        return dadosAgrupados.reduce((acc, g) => acc + g.totalDiarias, 0);
    }, [dadosAgrupados]);

    const temFiltroAtivo = nomeFiltro.trim() !== "" || funcaoFiltro !== "todos";

    const diasDaSemanaBase = useMemo(() => {
        try {
            return eachDayOfInterval({ start: new Date(inicio + "T12:00:00"), end: new Date(fim + "T12:00:00") });
        } catch {
            return [];
        }
    }, [inicio, fim]);

    const funcoes = useMemo(() => {
        const set = new Set((lancamentos as any[]).map((l) => l.funcao_colaborador).filter(Boolean));
        return Array.from(set);
    }, [lancamentos]);

    const possivelmenteIncompleto = useMemo(() => {
        // Alerta O3: Verifica se algum diarista possui menos lançamentos de diárias do que dias úteis no período
        const totalDiasUteis = diasDaSemanaBase.filter(d => d.getDay() !== 0 && d.getDay() !== 6).length;
        if (totalDiasUteis <= 0) return false;
        return dadosAgrupados.some((g) => g.lancamentos.length < totalDiasUteis);
    }, [dadosAgrupados, diasDaSemanaBase]);

    const changePeriodoRapido = (periodo: PeriodoRapido) => {
        setPeriodoRapido(periodo);
        const hoje = new Date();
        switch (periodo) {
            case "semana_atual":
                setInicio(format(startOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setFim(format(endOfWeek(hoje, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                break;
            case "semana_anterior":
                const semanaAnterior = subWeeks(hoje, 1);
                setInicio(format(startOfWeek(semanaAnterior, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                setFim(format(endOfWeek(semanaAnterior, { weekStartsOn: 1 }), "yyyy-MM-dd"));
                break;
            default:
                break;
        }
    };

    const fecharMutation = useMutation({
        mutationFn: () => {
            if (!user?.id) throw new Error("Usuário não identificado.");
            if (!empresaIdDoUsuario) throw new Error("Nenhuma empresa associada ao seu perfil.");
            return LoteFechamentoDiaristaService.fecharPeriodo({
                empresaId: empresaIdDoUsuario,
                periodoInicio: inicio,
                periodoFim: fim,
                fechadoPor: user.id,
                fechadoPorNome: perfil?.full_name || perfil?.nome_completo || user.email || "",
                fechadoPorRole: role || "encarregado",
                observacoes: obsLote || undefined,
            });
        },
        onSuccess: (lote) => {
            toast.success(`Período fechado. Aguardando validação do RH.`);
            setOpenFechamento(false);
            setObsLote("");
            setConfirmText("");
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_periodo"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_lotes"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            refetchHistorico();
        },
        onError: (err: any) => toast.error("Erro ao fechar período.", { description: err.message }),
    });

    const validarMutation = useMutation({
        mutationFn: async (loteId: string) => {
            if (!user?.id) throw new Error("Usuário não identificado.");

            const bypassFinanceiro = (regraFechamento as any)?.enviar_financeiro === false;

            if (bypassFinanceiro) {
                const finalStatus = (regraFechamento as any)?.auto_fechar ? "PAGO" : "FECHADO_FINANCEIRO";
                await LoteFechamentoDiaristaService.validarEEncerrar(
                    loteId,
                    user.id,
                    perfil?.nome_completo || user.email || "RH",
                    role || "rh",
                    finalStatus
                );
            } else {
                await LoteFechamentoDiaristaService.validarPeriodo(
                    loteId,
                    user.id,
                    perfil?.nome_completo || user.email || "RH",
                    role || "rh"
                );
            }
        },
        onSuccess: () => {
            const isAutoFinalizado = (regraFechamento as any)?.enviar_financeiro === false;
            toast.success("Lote validado pelo RH" + (isAutoFinalizado ? " e finalizado." : "."));
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_periodo"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_lotes"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            refetchHistorico();

            // Pipeline: conduzir ao Financeiro (ou Dashboard se auto-finalizado)
            const empresa = (empresas as any[])[0];
            const empresaNome = empresa?.nome || "Empresa";
            const competencia = format(new Date(inicio + "T12:00:00"), "yyyy-MM");
            if (!isAutoFinalizado) {
                openPipeline(buildDiaristasPipeline({
                    competencia,
                    empresa: empresaNome,
                    currentStep: "validacao_rh",
                }));
            }
        },
        onError: (err: any) => toast.error("Erro ao validar lote.", { description: err.message }),
    });

    const reabrirMutation = useMutation({
        mutationFn: ({ loteId, motivo, tipo }: { loteId: string; motivo: string; tipo: 'operacional' | 'administrativa' }) => {
            if (!user?.id) throw new Error("Usuário não identificado.");
            return LoteFechamentoDiaristaService.reabrirPeriodo(
                loteId, user.id,
                perfil?.nome_completo || user.email || "",
                role || "rh",
                motivo,
                tipo
            );
        },
        onSuccess: (_data, variables) => {
            const msg = variables.tipo === 'administrativa'
                ? "Lote reaberto em modo administrativo. Encarregado bloqueado — RH/Admin assume a correção."
                : "Lote reaberto com sucesso. Registros voltaram a Em Aberto.";
            toast.success(msg);
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_periodo"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_lotes"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_producao"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_semana"] });
            queryClient.invalidateQueries({ queryKey: ["historico_recente_diaristas"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_lancamento"] });
            refetchHistorico();
            refetchLotes();
            refetch();
            // Fechar modal
            setOpenReabertura(false);
            setMotivoReabertura("");
            setTipoReabertura('operacional');

            // Pipeline: se foi devolução operacional, mostrar estado devolvido
            if (variables.tipo === 'operacional') {
                const empresa = (empresas as any[])[0];
                const empresaNome = empresa?.nome || "Empresa";
                const competencia = format(new Date(inicio + "T12:00:00"), "yyyy-MM");
                openPipeline(buildDiaristasDevolvidoPipeline({
                    competencia,
                    empresa: empresaNome,
                    motivo: variables.motivo,
                }));
            }

            setLoteParaReabrir(null);
        },
        onError: (err: any) => toast.error("Erro ao reabrir lote.", { description: err.message }),
    });

    const aprovarMutation = useMutation({
        mutationFn: async (loteId: string) => {
            if (!user?.id) throw new Error("Usuário não identificado.");
            await LoteFechamentoDiaristaService.aprovarFinanceiro(loteId, user.id, perfil?.nome_completo || user.email, role || "admin");

            // Regra de Encerramento Automático (Problema 5)
            if ((regraFechamento as any)?.auto_fechar) {
                const { error: updateError } = await supabase
                    .from("diaristas_lotes_fechamento")
                    .update({ status: "PAGO", updated_at: new Date().toISOString() })
                    .eq("id", loteId);

                if (updateError) throw updateError;

                await supabase
                    .from("lancamentos_diaristas")
                    .update({ status: "PAGO", updated_at: new Date().toISOString() })
                    .eq("lote_fechamento_id", loteId);

                // Log adicional de encerramento automático
                await supabase.from("diaristas_logs_fechamento").insert({
                    empresa_id: (lotes as any[]).find(l => l.id === loteId)?.empresa_id,
                    tenant_id: perfil?.tenant_id,
                    usuario_id: user.id,
                    usuario_nome: "SISTEMA (Auto)",
                    usuario_role: "sistema",
                    acao: "ENCERROU",
                    periodo_inicio: (lotes as any[]).find(l => l.id === loteId)?.periodo_inicio,
                    periodo_fim: (lotes as any[]).find(l => l.id === loteId)?.periodo_fim,
                    motivo: "Encerramento automático após aprovação financeira"
                });
            }
        },
        onSuccess: () => {
            const autoFechou = (regraFechamento as any)?.auto_fechar;
            toast.success("Lote aprovado" + (autoFechou ? " e encerrado automaticamente." : "."));
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_periodo"] });
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel_lotes"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            refetchHistorico();

            // Pipeline: avançar estado
            const empresa = (empresas as any[]).find(e => e.id === empresaFiltroId) || (empresas as any[])[0];
            const empresaNome = empresa?.nome || "Empresa";
            const reqCompetencia = format(new Date(inicio + "T12:00:00"), "yyyy-MM");
            openPipeline(buildDiaristasPipeline({
                competencia: reqCompetencia,
                empresa: empresaNome,
                currentStep: autoFechou ? "concluido" : "aprovacao_financeira"
            }));
        },
        onError: (err: any) => toast.error("Erro ao aprovar lote.", { description: err.message }),
    });

    const updateRegraMutation = useMutation({
        mutationFn: (payload: any) => DiaristaCicloService.updateRegraFechamento((regraFechamento as any)?.id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["regra_fechamento_diaristas"] });
            toast.success("Configuração atualizada com sucesso.");
        },
        onError: (err: any) => toast.error("Erro ao salvar configuração.", { description: err.message })
    });

    const exportarXlsx = async () => {
        try {
            const { utils, writeFile } = await import("xlsx");
            const rows = dadosAgrupados.flatMap((g) =>
                g.lancamentos.map((l: any) => ({
                    Colaborador: l.nome_colaborador,
                    CPF: l.cpf_colaborador ?? "",
                    Função: l.funcao_colaborador ?? "",
                    Data: l.data_lancamento,
                    Marcação: l.codigo_marcacao,
                    "Qtd Diárias": l.quantidade_diaria,
                    "Valor Diária Base": l.valor_diaria_base,
                    "Valor Calculado": l.valor_calculado,
                    "Cliente/Unidade": l.cliente_unidade ?? "",
                    "Operação/Serviço": l.operacao_servico ?? "",
                    Encarregado: l.encarregado_nome ?? "",
                    Status: l.status,
                    Observação: l.observacao ?? "",
                })),
            );

            const ws = utils.json_to_sheet(rows);
            const wb = utils.book_new();
            utils.book_append_sheet(wb, ws, "Diaristas");
            writeFile(wb, `diaristas_${inicio}_${fim}.xlsx`);
            toast.success("Planilha exportada com sucesso.");
        } catch {
            toast.error("Instale a dependência: npm install xlsx");
        }
    };

    return (
        <AppShell title="Diaristas" subtitle="Acompanhe os lançamentos semanais, confira as apurações e valide os lotes da operação.">
            <div className="max-w-[1560px] mx-auto p-4 md:p-6 space-y-6">

                {/* ========================================================================= */}
                {/* REGIÃO 01 — CABEÇALHO, CONTEXTO & FILTROS COMPACTOS                     */}
                {/* ========================================================================= */}

                {/* Cabeçalho da Página Oficial no Conteúdo Principal com Ações à Direita (CONV-16 FIX 05) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-border/40">
                    <div>
                        <h1 className="text-xl font-bold font-display text-foreground tracking-tight">
                            Diaristas
                        </h1>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Acompanhe os lançamentos semanais, confira as apurações e valide os lotes da operação.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 sm:h-9 text-xs font-semibold"
                            onClick={() => refetch()}
                            title="Recarregar lançamentos"
                        >
                            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetching && "animate-spin text-blue-600")} />
                            Atualizar
                        </Button>

                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 sm:h-9 text-xs font-semibold"
                            onClick={exportarXlsx}
                            disabled={dadosAgrupados.length === 0}
                            title="Exportar dados para Excel"
                        >
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Exportar
                        </Button>
                    </div>
                </div>

                {/* Banners Informativos de Estado e Governança */}
                {loteEmCorrecaoAdmin && !isAdmin && !isRh && (
                    <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                        <p className="text-xs text-rose-800 font-semibold flex items-center gap-2">
                            <Lock className="h-4 w-4 text-rose-600" />
                            Período em revisão administrativa
                        </p>
                        <p className="text-[11px] text-rose-700/80 mt-0.5">
                            Este período está sendo ajustado pelo RH/Admin. O fechamento operacional pelo encarregado está bloqueado.
                        </p>
                    </div>
                )}

                {loteEmCorrecaoAdmin && (isAdmin || isRh) && (
                    <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                        <Settings className="h-4 w-4 text-amber-600 shrink-0" />
                        <div className="flex-1">
                            <span className="text-xs font-bold text-amber-900">🔒 Correção Administrativa ativa</span>
                            <p className="text-[11px] text-amber-800/80 mt-0.5">
                                Edite os lançamentos na tabela e revalide o período diretamente. O encarregado está temporariamente bloqueado.
                            </p>
                        </div>
                    </div>
                )}

                {periodoBloqueado && !loteEmCorrecaoAdmin && (
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-muted/60 rounded-xl border border-border">
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">Período Bloqueado para novos lançamentos</span>
                    </div>
                )}

                {/* Barra de Filtros Compacta em Linha Única (CONV-16 FIX 05) */}
                <div className="p-3.5 rounded-xl border border-border bg-card shadow-xs space-y-2.5">
                    <div className="flex flex-wrap xl:flex-nowrap items-end gap-2 xl:gap-2.5">

                        {/* 1. Empresa */}
                        <div className="space-y-1 w-full sm:w-[165px] xl:w-[180px] shrink-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Empresa</Label>
                            <Select value={empresaFiltroId} onValueChange={setEmpresaFiltroId}>
                                <SelectTrigger className="h-9 w-full text-xs font-medium bg-background border-border">
                                    <Building2 className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                    <SelectValue placeholder="Empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos" className="text-xs font-semibold">Todas as empresas</SelectItem>
                                    {(empresas as any[]).map((e) => (
                                        <SelectItem key={e.id} value={e.id} className="text-xs">{e.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 2. Período (Largura Ampliada para Legibilidade) */}
                        <div className="space-y-1 w-full sm:w-[155px] xl:w-[168px] shrink-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Período</Label>
                            <Select value={periodoRapido} onValueChange={(v) => changePeriodoRapido(v as PeriodoRapido)}>
                                <SelectTrigger className="h-9 w-full text-xs font-medium bg-background border-border">
                                    <Calendar className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="semana_atual" className="text-xs">Semana atual</SelectItem>
                                    <SelectItem value="semana_anterior" className="text-xs">Semana anterior</SelectItem>
                                    <SelectItem value="personalizado" className="text-xs">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 3. Início */}
                        <div className="space-y-1 w-[115px] xl:w-[122px] shrink-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Início</Label>
                            <Input
                                type="date"
                                className="h-9 w-full text-xs font-mono bg-background border-border"
                                value={inicio}
                                onChange={(e) => { setInicio(e.target.value); setPeriodoRapido("personalizado"); }}
                            />
                        </div>

                        {/* 4. Fim */}
                        <div className="space-y-1 w-[115px] xl:w-[122px] shrink-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Fim</Label>
                            <Input
                                type="date"
                                className="h-9 w-full text-xs font-mono bg-background border-border"
                                value={fim}
                                onChange={(e) => { setFim(e.target.value); setPeriodoRapido("personalizado"); }}
                            />
                        </div>

                        {/* 5. Situação */}
                        <div className="space-y-1 w-full sm:w-[175px] xl:w-[190px] shrink-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Situação</Label>
                            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFilter)}>
                                <SelectTrigger className="h-9 w-full text-xs font-medium bg-background border-border">
                                    <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground shrink-0" />
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos" className="text-xs font-semibold">Todas as situações</SelectItem>
                                    <SelectItem value="em_aberto" className="text-xs">Em aberto</SelectItem>
                                    <SelectItem value="AGUARDANDO_VALIDACAO_RH" className="text-xs font-bold text-amber-700">Aguardando Validação RH</SelectItem>
                                    <SelectItem value="VALIDADO_RH" className="text-xs font-bold text-cyan-700">Validado RH</SelectItem>
                                    <SelectItem value="FECHADO_FINANCEIRO" className="text-xs font-bold text-emerald-700">Fechado Financeiro</SelectItem>
                                    <SelectItem value="PAGO" className="text-xs font-bold text-blue-700">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 6. Função */}
                        <div className="space-y-1 w-full sm:w-[130px] xl:w-[145px] shrink-0">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Função</Label>
                            <Select value={funcaoFiltro} onValueChange={setFuncaoFiltro}>
                                <SelectTrigger className="h-9 w-full text-xs font-medium bg-background border-border">
                                    <SelectValue placeholder="Todas as funções" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos" className="text-xs font-semibold">Todas as funções</SelectItem>
                                    {funcoes.map((f) => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* 7. Colaborador (Expansível para preencher a largura útil da tela) */}
                        <div className="space-y-1 min-w-[160px] flex-1">
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Colaborador</Label>
                            <div className="relative">
                                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                                <Input
                                    className="h-9 pl-8 text-xs bg-background border-border w-full"
                                    placeholder="Buscar por colaborador..."
                                    value={nomeFiltro}
                                    onChange={(e) => setNomeFiltro(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* 8. Fechar Período — Extremo Direito da Seção */}
                        {!(loteEmCorrecaoAdmin && !isAdmin && !isRh) && (
                            (() => {
                                const podeFecharPerfil = isAdmin || isRh;
                                if (!podeFecharPerfil) return null;

                                const isBloqueadoPeriodo = periodoBloqueado;
                                const isSemRegistros = rawEmAberto === 0;
                                const isFechamentoDesabilitado = isBloqueadoPeriodo || isSemRegistros;

                                const tooltipFechamentoMsg = isBloqueadoPeriodo
                                    ? "Fechamento indisponível: este período já possui lote homologado ou em processamento financeiro."
                                    : isSemRegistros
                                        ? `Fechamento indisponível: não existem apontamentos em aberto para este período.${temFiltroAtivo ? " Ajuste os filtros ativos para verificar registros." : ""}`
                                        : "Fechar período operacional e consolidar lote para validação do RH.";

                                return (
                                    <div className="space-y-1 shrink-0">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-transparent select-none hidden sm:block">
                                            Ação
                                        </Label>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <span tabIndex={0} className={cn("inline-flex", isFechamentoDesabilitado ? "cursor-not-allowed" : "")}>
                                                    <Button
                                                        size="sm"
                                                        className={cn(
                                                            "h-9 text-xs font-bold transition-all shadow-xs shrink-0 whitespace-nowrap",
                                                            !isFechamentoDesabilitado
                                                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                                : "bg-muted text-muted-foreground/80 border border-border/50 cursor-not-allowed pointer-events-none"
                                                        )}
                                                        onClick={() => !isFechamentoDesabilitado && setOpenFechamento(true)}
                                                        disabled={isFechamentoDesabilitado}
                                                    >
                                                        <Lock className="h-3.5 w-3.5 mr-1.5" /> Fechar Período
                                                        {rawEmAberto > 0 && (
                                                            <span className="ml-1.5 bg-white/25 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded-full">
                                                                {rawEmAberto}
                                                            </span>
                                                        )}
                                                    </Button>
                                                </span>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" align="end" className="text-xs max-w-xs p-2">
                                                {tooltipFechamentoMsg}
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    {statusFiltro !== "todos" && (
                        <div className="flex items-center gap-2 pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                                Filtrando por: {statusFiltro === "em_aberto" ? "Em aberto" : statusFiltro === "AGUARDANDO_VALIDACAO_RH" ? "Aguardando Validação RH" : statusFiltro === "VALIDADO_RH" ? "Validado RH" : statusFiltro === "FECHADO_FINANCEIRO" ? "Fechado Financeiro" : statusFiltro === "PAGO" ? "Pago" : statusFiltro}
                            </span>
                            <span>Os indicadores abaixo refletem o escopo do filtro ativo.</span>
                        </div>
                    )}
                </div>

                {/* ========================================================================= */}
                {/* REGIÃO 02 — INDICADORES EXECUTIVOS (4 KPIS)                              */}
                {/* ========================================================================= */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ExecutiveMetricCard
                        label="Diárias Apuradas"
                        value={totalDiariasApuradas.toFixed(1)}
                        subtitle={`${totalGeral.totalRegistros} apontamentos no escopo`}
                        icon={CalendarDays}
                    />

                    <ExecutiveMetricCard
                        label="Diaristas Ativos"
                        value={String(totalGeral.totalDiaristas)}
                        subtitle="Colaboradores apurados"
                        icon={Users}
                    />

                    <ExecutiveMetricCard
                        label="Valor Apurado"
                        value={formatCurrency(totalGeral.valorTotal)}
                        subtitle={statusFiltro !== "todos" ? "Valor apurado filtrado" : "Custo total de diárias"}
                        icon={Banknote}
                    />

                    <ExecutiveMetricCard
                        label="Situação dos Lotes"
                        value={
                            lotesPendentesRh > 0
                                ? `${lotesPendentesRh} pendente(s) RH`
                                : (lotes as any[]).length > 0
                                    ? `${(lotes as any[]).length} lote(s) no ciclo`
                                    : totalGeral.emAberto > 0
                                        ? `${totalGeral.emAberto} diárias abertas`
                                        : "Sem lotes ativos"
                        }
                        subtitle={
                            lotesPendentesFin > 0
                                ? `${lotesPendentesFin} lote(s) no Financeiro`
                                : `Ciclo: ${statusCicloAtual}`
                        }
                        badge={
                            lotesPendentesRh > 0
                                ? { text: "Pendente RH", variant: "warning" }
                                : (lotes as any[]).length > 0
                                    ? { text: "Regular", variant: "success" }
                                    : undefined
                        }
                        icon={FileCheck}
                    />
                </div>

                {/* ========================================================================= */}
                {/* REGIÃO 03 — ÁREA PRINCIPAL DE TRABALHO (NAVEGAÇÃO COMPACTA)              */}
                {/* ========================================================================= */}
                <div className="space-y-4">
                    {/* Barra de Abas Compacta */}
                    <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border w-fit">
                        <button
                            type="button"
                            onClick={() => { setTabPrincipal("grade_semanal"); setVisao("grade_semanal"); }}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                tabPrincipal === "grade_semanal"
                                    ? "bg-card text-foreground shadow-xs border border-border font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <TableIcon className="h-3.5 w-3.5 text-blue-600" />
                            Grade Semanal
                        </button>

                        <button
                            type="button"
                            onClick={() => { setTabPrincipal("diarista"); setVisao("diarista"); }}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                tabPrincipal === "diarista"
                                    ? "bg-card text-foreground shadow-xs border border-border font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Users className="h-3.5 w-3.5 text-blue-600" />
                            Por Diarista
                            {dadosAgrupados.length > 0 && (
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded-full",
                                    tabPrincipal === "diarista" ? "bg-blue-50 text-blue-700 font-bold" : "bg-muted text-muted-foreground"
                                )}>
                                    {dadosAgrupados.length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setTabPrincipal("lotes")}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                tabPrincipal === "lotes"
                                    ? "bg-card text-foreground shadow-xs border border-border font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                            Lotes & Ciclos
                            {(lotes as any[]).length > 0 && (
                                <span className={cn(
                                    "text-[10px] px-1.5 py-0.2 rounded-full",
                                    tabPrincipal === "lotes" ? "bg-blue-50 text-blue-700 font-bold" : "bg-muted text-muted-foreground"
                                )}>
                                    {(lotes as any[]).length}
                                </span>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => setTabPrincipal("auditoria")}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
                                tabPrincipal === "auditoria"
                                    ? "bg-card text-foreground shadow-xs border border-border font-bold"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <History className="h-3.5 w-3.5 text-blue-600" />
                            Auditoria & Governança
                        </button>
                    </div>

                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* ABA 1: GRADE SEMANAL                                          */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    {tabPrincipal === "grade_semanal" && (
                        <div className="space-y-3">
                            {/* Legenda compacta e status */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-card p-3 rounded-xl border border-border">
                                <div className="flex items-center gap-4">
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span>
                                        <b>P</b> = Diária completa (1.0)
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span>
                                        <b>MP</b> = Meia diária (0.5)
                                    </span>
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <span className="font-bold text-foreground">–</span>
                                        Sem apontamento
                                    </span>
                                </div>
                                <span className="text-[11px] text-muted-foreground">
                                    Exibindo apuração consolidada de segunda a domingo.
                                </span>
                            </div>

                            {/* Tabela de Grade Semanal */}
                            <div className="esc-card overflow-hidden">
                                {(isLoading || isLoadingLotes) ? (
                                    <div className="flex flex-col items-center justify-center p-12 gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Carregando grade semanal...</p>
                                    </div>
                                ) : dadosAgrupados.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                                        <CalendarDays className="h-10 w-10 text-muted-foreground/40" />
                                        <p className="font-semibold text-foreground">Nenhum lançamento no período selecionado</p>
                                        <p className="text-xs text-muted-foreground max-w-sm">
                                            Ajuste os filtros de período e empresa ou certifique-se de que o encarregado realizou os lançamentos.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border rounded-xl border-border/80 bg-card shadow-xs">
                                        <table className="w-full text-sm border-collapse min-w-max">
                                            <thead className="esc-table-header">
                                                <tr className="text-left border-b border-border/80">
                                                    <th className="sticky left-0 z-20 bg-background/95 backdrop-blur-xs px-5 h-12 font-semibold min-w-[240px] max-w-[260px] text-xs uppercase tracking-wider text-muted-foreground border-r border-border/80 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                                                        Colaborador
                                                    </th>
                                                    {diasDaSemanaBase.map((d) => (
                                                        <th
                                                            key={d.toISOString()}
                                                            className={cn(
                                                                "px-3 h-12 text-center whitespace-nowrap min-w-[68px]",
                                                                isToday(d) && "bg-blue-500/10 border-b-2 border-b-blue-600"
                                                            )}
                                                        >
                                                            <div className="flex flex-col items-center">
                                                                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                                                                    {format(d, "eeeeee", { locale: ptBR })}
                                                                </span>
                                                                <span className="font-mono text-xs font-bold text-foreground">
                                                                    {format(d, "dd/MM")}
                                                                </span>
                                                            </div>
                                                        </th>
                                                    ))}
                                                    <th className="px-3 h-12 font-semibold text-center text-xs uppercase tracking-wider text-muted-foreground min-w-[90px]">
                                                        Diárias
                                                    </th>
                                                    <th className="px-5 h-12 font-semibold text-right text-xs uppercase tracking-wider text-muted-foreground min-w-[130px]">
                                                        Valor
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/60">
                                                {dadosAgrupados.map((g) => (
                                                    <tr
                                                        key={g.diarista_id}
                                                        className={cn(
                                                            "group hover:bg-muted/30 transition-colors",
                                                            STATUS_DIARISTA_MAP[g.status]?.opacity ?? "opacity-100"
                                                        )}
                                                    >
                                                        <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/50 transition-colors px-5 py-3 min-w-[240px] max-w-[260px] border-r border-border/60 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                                                            <div className="flex flex-col">
                                                                <span className="font-semibold text-sm text-foreground truncate max-w-[210px]" title={g.nome}>
                                                                    {g.nome}
                                                                </span>
                                                                <span className="text-[11px] text-muted-foreground truncate max-w-[210px]" title={g.funcao}>
                                                                    {g.funcao}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        {diasDaSemanaBase.map((d) => {
                                                            const strDate = format(d, "yyyy-MM-dd");
                                                            const diaLancamentos = g.lancamentos.filter((l: any) => l.data_lancamento === strDate);

                                                            if (diaLancamentos.length === 0) {
                                                                return (
                                                                    <td
                                                                        key={d.toISOString()}
                                                                        className={cn(
                                                                            "px-3 py-3 text-center text-muted-foreground/30 font-medium text-sm",
                                                                            isToday(d) && "bg-blue-500/5"
                                                                        )}
                                                                    >
                                                                        –
                                                                    </td>
                                                                );
                                                            }

                                                            const codes = Array.from(new Set(diaLancamentos.map((l: any) => l.codigo_marcacao)));
                                                            const tooltipVal = diaLancamentos.map((l: any) => `${l.quantidade_diaria}x ${l.codigo_marcacao} = ${formatCurrency(l.valor_calculado)}`).join(' | ');

                                                            return (
                                                                <td
                                                                    key={d.toISOString()}
                                                                    className={cn("px-3 py-3 text-center", isToday(d) && "bg-blue-500/5")}
                                                                    title={tooltipVal}
                                                                >
                                                                    <div className="flex flex-col items-center justify-center cursor-help">
                                                                        <span className={cn(
                                                                            "text-xs uppercase font-extrabold px-2 py-0.5 rounded-md",
                                                                            codes.includes("P") && "text-emerald-700 bg-emerald-500/15 border border-emerald-500/20",
                                                                            codes.includes("MP") && "text-amber-700 bg-amber-500/15 border border-amber-500/20",
                                                                            (!codes.includes("P") && !codes.includes("MP")) && "bg-muted text-foreground"
                                                                        )}>
                                                                            {codes.join("+")}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                            );
                                                        })}
                                                        <td className="px-3 py-3 text-center font-mono font-bold text-sm">
                                                            {g.totalDiarias.toFixed(1)}
                                                        </td>
                                                        <td className="px-5 py-3 text-right font-mono font-bold text-foreground text-sm">
                                                            {formatCurrency(g.valorTotal)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* ABA 2: POR DIARISTA (CONSOLIDAÇÃO & DETALHAMENTO)             */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    {tabPrincipal === "diarista" && (
                        <div className="space-y-3">
                            {/* Sub-controles de visualização */}
                            <div className="flex items-center justify-between bg-card p-3 rounded-xl border border-border">
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant={visao === "diarista" ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs font-semibold"
                                        onClick={() => setVisao("diarista")}
                                    >
                                        <Users className="h-3.5 w-3.5 mr-1.5" />
                                        Agrupado por Diarista
                                    </Button>
                                    <Button
                                        variant={visao === "data" ? "default" : "outline"}
                                        size="sm"
                                        className="h-8 text-xs font-semibold"
                                        onClick={() => setVisao("data")}
                                    >
                                        <Calendar className="h-3.5 w-3.5 mr-1.5" />
                                        Agrupado por Data
                                    </Button>
                                </div>
                                <span className="text-xs text-muted-foreground">
                                    Clique em uma linha para expandir e gerenciar apontamentos.
                                </span>
                            </div>

                            <div className="esc-card overflow-hidden">
                                {(isLoading || isLoadingLotes) ? (
                                    <div className="flex flex-col items-center justify-center p-12 gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-[#2563EB]" />
                                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Carregando dados...</p>
                                    </div>
                                ) : dadosAgrupados.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                                        <Users className="h-10 w-10 text-muted-foreground/40" />
                                        <p className="font-semibold text-foreground">Nenhum diarista encontrado</p>
                                        <p className="text-xs text-muted-foreground max-w-sm">Verifique os filtros selecionados.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="esc-table-header">
                                                {visao === "diarista" ? (
                                                    <tr className="text-left border-b border-border/80">
                                                        <th className="px-5 h-11 w-10"></th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Diarista</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Função</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Resumo Marcações</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Total Diárias</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Valor Total</th>
                                                        <th className="px-5 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</th>
                                                    </tr>
                                                ) : (
                                                    <tr className="text-left border-b border-border/80">
                                                        <th className="px-5 h-11 w-10"></th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Data</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Diaristas</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Total Diárias</th>
                                                        <th className="px-3 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Valor Total</th>
                                                        <th className="px-5 h-11"></th>
                                                    </tr>
                                                )}
                                            </thead>
                                            <tbody className="divide-y divide-border/60">
                                                {visao === "diarista" ? (
                                                    dadosAgrupados.map((g) => (
                                                        <Fragment key={g.diarista_id}>
                                                            <tr
                                                                className={cn(
                                                                    "hover:bg-muted/30 cursor-pointer transition-colors",
                                                                    STATUS_DIARISTA_MAP[g.status]?.opacity ?? "opacity-100"
                                                                )}
                                                                onClick={() => setExpandedId(expandedId === g.diarista_id ? null : g.diarista_id)}
                                                            >
                                                                <td className="px-5 h-12 w-10 text-muted-foreground">
                                                                    {expandedId === g.diarista_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                </td>
                                                                <td className="px-3 font-semibold text-foreground">{g.nome}</td>
                                                                <td className="px-3 text-muted-foreground text-xs">{g.funcao}</td>
                                                                <td className="px-3 text-center min-w-[120px]">
                                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                                        {Object.entries(g.contagem).map(([cod, qtd]) => (
                                                                            <span key={cod} className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                                                                {qtd as number}x {cod}
                                                                            </span>
                                                                        ))}
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 text-center font-mono font-bold">
                                                                    {g.totalDiarias.toFixed(1)}
                                                                </td>
                                                                <td className="px-3 text-right font-mono font-bold text-foreground">
                                                                    {formatCurrency(g.valorTotal)}
                                                                </td>
                                                                <td className="px-5 text-center">
                                                                    <StatusDiaristaBadge status={g.status} />
                                                                </td>
                                                            </tr>
                                                            {expandedId === g.diarista_id && (() => {
                                                                const isPago = g.status === "PAGO" || g.status === "pago" || g.status === "CONCILIADO" || g.status === "conciliado";
                                                                const podeEditarAdmin = (isAdmin || isRh) && !isPago;

                                                                return (
                                                                    <tr className="bg-muted/20 border-y border-border">
                                                                        <td colSpan={7} className="px-5 py-4">
                                                                            <div className="space-y-2.5">
                                                                                <div className="flex items-center justify-between pb-1 border-b border-border/60">
                                                                                    <span className="text-xs font-bold text-foreground">
                                                                                        Apontamentos de {g.nome} ({g.lancamentos.length} registro(s))
                                                                                    </span>
                                                                                    {isPago ? (
                                                                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                                                                                            <Lock className="h-3 w-3 text-muted-foreground/70" />
                                                                                            Registros liquidados — edição bloqueada pela política financeira.
                                                                                        </span>
                                                                                    ) : !podeEditarAdmin ? (
                                                                                        <span className="text-[11px] text-muted-foreground">
                                                                                            Visualização de conferência — edição administrativa restrita ao RH/Admin.
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                                                                            <Settings className="h-3 w-3 text-amber-600" />
                                                                                            Clique no ícone de engrenagem para realizar edição administrativa autorizada.
                                                                                        </span>
                                                                                    )}
                                                                                </div>

                                                                                <div className="grid grid-cols-8 gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border/40">
                                                                                    <span>Data</span>
                                                                                    <span className="text-center">Marcação</span>
                                                                                    <span className="text-center">Qtd</span>
                                                                                    <span className="text-right">Diária Base</span>
                                                                                    <span className="text-right">Valor Final</span>
                                                                                    <span className="col-span-2">Cliente / Local</span>
                                                                                    <span className="text-right">Ação</span>
                                                                                </div>

                                                                                {g.lancamentos.map((l: any) => (
                                                                                    <div key={l.id} className="grid grid-cols-8 gap-2 text-xs items-center py-1 hover:bg-muted/40 rounded px-1">
                                                                                        <span className="font-mono text-muted-foreground">{formatDate(l.data_lancamento)}</span>
                                                                                        <div className="text-center">
                                                                                            <span className={cn(
                                                                                                "font-bold px-1.5 py-0.5 rounded text-[11px]",
                                                                                                l.codigo_marcacao === "P" && "text-emerald-700 bg-emerald-500/15",
                                                                                                l.codigo_marcacao === "MP" && "text-amber-700 bg-amber-500/15",
                                                                                            )}>{l.codigo_marcacao}</span>
                                                                                        </div>
                                                                                        <span className="font-mono text-center">{l.quantidade_diaria}</span>
                                                                                        <span className="font-mono text-right text-muted-foreground">{formatCurrency(l.valor_diaria_base)}</span>
                                                                                        <span className="font-mono text-right font-bold text-foreground">{formatCurrency(l.valor_calculado)}</span>
                                                                                        <span className="col-span-2 text-muted-foreground text-[11px] truncate">{l.cliente_unidade ?? "—"}</span>
                                                                                        <div className="flex justify-end">
                                                                                            {(() => {
                                                                                                const podeEditarPerfil = isAdmin || isRh;
                                                                                                if (!podeEditarPerfil) return null;

                                                                                                if (isPago) {
                                                                                                    return (
                                                                                                        <Tooltip>
                                                                                                            <TooltipTrigger asChild>
                                                                                                                <span tabIndex={0} className="inline-flex cursor-not-allowed">
                                                                                                                    <Button
                                                                                                                        variant="ghost"
                                                                                                                        size="sm"
                                                                                                                        className="h-7 w-7 p-0 text-muted-foreground/30 pointer-events-none"
                                                                                                                        disabled
                                                                                                                        title="Registro liquidado — edição bloqueada"
                                                                                                                        aria-label="Registro liquidado — edição bloqueada"
                                                                                                                    >
                                                                                                                        <Settings className="h-3.5 w-3.5" />
                                                                                                                    </Button>
                                                                                                                </span>
                                                                                                            </TooltipTrigger>
                                                                                                            <TooltipContent side="top" className="text-xs max-w-xs p-2">
                                                                                                                Edição indisponível: registro pertencente a lote pago.
                                                                                                            </TooltipContent>
                                                                                                        </Tooltip>
                                                                                                    );
                                                                                                }

                                                                                                return (
                                                                                                    <Tooltip>
                                                                                                        <TooltipTrigger asChild>
                                                                                                            <Button
                                                                                                                variant="ghost"
                                                                                                                size="sm"
                                                                                                                className="h-7 w-7 p-0 hover:bg-amber-500/10 text-muted-foreground hover:text-amber-700 cursor-pointer"
                                                                                                                onClick={(e) => {
                                                                                                                    e.stopPropagation();
                                                                                                                    setLancamentoEditando(l);
                                                                                                                    setValorAnterior(Number(l.valor_calculado));
                                                                                                                    setEditForm({ ...l, motivo_edicao: "" });
                                                                                                                    setOpenEdicao(true);
                                                                                                                }}
                                                                                                            >
                                                                                                                <Settings className="h-3.5 w-3.5" />
                                                                                                            </Button>
                                                                                                        </TooltipTrigger>
                                                                                                        <TooltipContent side="top" className="text-xs max-w-xs p-2">
                                                                                                            Editar lançamento administrativamente com recálculo e justificativa.
                                                                                                        </TooltipContent>
                                                                                                    </Tooltip>
                                                                                                );
                                                                                            })()}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })()}
                                                        </Fragment>
                                                    ))
                                                ) : (
                                                    dadosAgrupadosPorData.map((g) => (
                                                        <Fragment key={g.data_lancamento}>
                                                            <tr
                                                                className="hover:bg-muted/30 cursor-pointer transition-colors"
                                                                onClick={() => setExpandedId(expandedId === g.data_lancamento ? null : g.data_lancamento)}
                                                            >
                                                                <td className="px-5 h-12 w-10 text-muted-foreground">
                                                                    {expandedId === g.data_lancamento ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                </td>
                                                                <td className="px-3 font-mono font-bold text-foreground">{formatDate(g.data_lancamento)}</td>
                                                                <td className="px-3 text-center">{g.totalDiaristas}</td>
                                                                <td className="px-3 text-center font-mono font-bold">{g.totalDiarias.toFixed(1)}</td>
                                                                <td className="px-3 text-right font-mono font-bold text-foreground">{formatCurrency(g.valorTotal)}</td>
                                                                <td className="px-5 text-center"></td>
                                                            </tr>
                                                            {expandedId === g.data_lancamento && (
                                                                <tr className="bg-muted/20 border-y border-border">
                                                                    <td colSpan={6} className="px-5 py-4">
                                                                        <div className="space-y-2">
                                                                            {g.lancamentos.map((l: any) => (
                                                                                <div key={l.id} className="grid grid-cols-7 gap-2 text-xs items-center py-1">
                                                                                    <span className="font-semibold">{l.nome_colaborador}</span>
                                                                                    <span className="text-muted-foreground text-[11px]">{l.funcao_colaborador}</span>
                                                                                    <span className="font-bold text-center">{l.codigo_marcacao} ({l.quantidade_diaria})</span>
                                                                                    <span className="font-mono text-right font-bold">{formatCurrency(l.valor_calculado)}</span>
                                                                                    <span className="text-muted-foreground text-[11px] truncate">{l.cliente_unidade ?? "—"}</span>
                                                                                    <span className="text-muted-foreground text-[11px] truncate">{l.observacao ?? "—"}</span>
                                                                                    <div className="text-right">
                                                                                        <StatusDiaristaBadge status={l.status} />
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Fragment>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* ABA 3: LOTES & CICLOS                                         */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    {tabPrincipal === "lotes" && (
                        <div className="space-y-6">
                            {/* Card Resumo do Ciclo de Operação Selecionado */}
                            <div className="esc-card p-5 border-l-4 border-l-[#2563EB] bg-gradient-to-r from-background to-muted/20">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                                            Ciclo de Operação Selecionado
                                        </p>
                                        <h3 className="text-xl font-display font-bold text-foreground">
                                            {formatDate(inicio)} a {formatDate(fim)}
                                        </h3>
                                    </div>
                                    <div>
                                        <span className={cn(
                                            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                                            statusCicloAtual === "FINALIZADO" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"
                                        )}>
                                            {statusCicloAtual !== "FINALIZADO" && (
                                                <span className="relative flex h-2 w-2">
                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75"></span>
                                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                                                </span>
                                            )}
                                            {statusCicloAtual}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6 pt-5 border-t border-border/50">
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Diaristas</p>
                                        <p className="text-lg font-mono font-bold text-foreground">{totalGeral.totalDiaristas}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Período</p>
                                        <p className="text-lg font-mono font-bold text-foreground">
                                            {formatCurrency((lotes as any[]).reduce((acc, l) => acc + Number(l.valor_total || l.total_valor || 0), 0))}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Lotes</p>
                                        <p className="text-lg font-mono font-bold text-foreground">{(lotes as any[]).length}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-amber-600">Pendências RH</p>
                                        <p className="text-lg font-mono font-bold text-amber-600">{lotesPendentesRh}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase font-bold text-blue-600">Pend. Financeiro</p>
                                        <p className="text-lg font-mono font-bold text-blue-600">{lotesPendentesFin}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Tabela de Lotes da Semana */}
                            <div id="secao-lotes-periodo" className="space-y-3 scroll-mt-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                            Lotes do Período Selecionado
                                        </h3>
                                        <Badge variant="outline" className="text-[11px] font-mono bg-primary/5 text-primary border-primary/20">
                                            {formatDate(inicio)} a {formatDate(fim)}
                                        </Badge>
                                    </div>
                                </div>

                                <div className="esc-card overflow-hidden">
                                    {(lotes as any[]).length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                                            <FileCheck className="h-10 w-10 text-muted-foreground/40" />
                                            <p className="font-semibold text-foreground">Nenhum lote gerado para este período</p>
                                            <p className="text-xs text-muted-foreground max-w-sm">
                                                Lotes são gerados quando o encarregado ou administrador clica em "Fechar Período".
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="esc-table-header">
                                                    <tr className="text-left border-b border-border/80">
                                                        <th className="px-4 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Período</th>
                                                        <th className="px-4 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Empresa</th>
                                                        <th className="px-4 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Registros</th>
                                                        <th className="px-4 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Valor Total</th>
                                                        <th className="px-4 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</th>
                                                        <th className="px-4 h-11 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Ações</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/60">
                                                    {(lotes as any[]).map((lote: any) => {
                                                        const podeValidar = (isAdmin || isRh) && lote.status === "AGUARDANDO_VALIDACAO_RH";
                                                        const loteValidadoRh = lote.status === "VALIDADO_RH";
                                                        const loteAptoRemessa = ["FECHADO_FINANCEIRO", "AGUARDANDO_PAGAMENTO", "cnab_gerado", "CNAB_GERADO"].includes(lote.status);
                                                        const lotePago = ["PAGO", "pago", "CONCILIADO", "conciliado"].includes(lote.status);
                                                        const podeReabrir = (isAdmin || isRh) && ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status);
                                                        const competenciaLote = lote.periodo_inicio ? lote.periodo_inicio.slice(0, 7) : "";

                                                        return (
                                                            <tr key={lote.id} className="hover:bg-muted/30 transition-colors">
                                                                <td className="px-4 py-3 font-mono text-xs font-semibold">
                                                                    {lote.periodo_inicio ? format(new Date(lote.periodo_inicio + "T12:00:00"), "dd/MM/yy") : "—"}
                                                                    {" → "}
                                                                    {lote.periodo_fim ? format(new Date(lote.periodo_fim + "T12:00:00"), "dd/MM/yy") : "—"}
                                                                </td>
                                                                <td className="px-4 py-3 text-muted-foreground font-medium">
                                                                    {lote.empresa?.nome ?? lote.empresa_id ?? "—"}
                                                                </td>
                                                                <td className="px-4 py-3 text-center font-mono font-bold">
                                                                    {lote.total_registros ?? "—"}
                                                                </td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                                                                    {lote.valor_total != null ? formatCurrency(lote.valor_total) : "—"}
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <StatusDiaristaBadge status={lote.status} />
                                                                </td>
                                                                <td className="px-4 py-3">
                                                                    <div className="flex items-center justify-center gap-2">
                                                                        {podeValidar && (
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-8 text-xs font-semibold bg-[#2563EB] hover:bg-blue-700 text-white"
                                                                                disabled={validarMutation.isPending}
                                                                                onClick={() => validarMutation.mutate(lote.id)}
                                                                            >
                                                                                {validarMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3.5 w-3.5 mr-1" />Validar RH</>}
                                                                            </Button>
                                                                        )}
                                                                        {/* Lote VALIDADO_RH: segue para aprovação financeira na Central Financeira oficial */}
                                                                        {loteValidadoRh && (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                                                                                onClick={() => {
                                                                                    const params = new URLSearchParams();
                                                                                    params.set("tab", "lotes-rh");
                                                                                    if (lote.id) params.set("rhLoteId", lote.id);
                                                                                    if (lote.empresa_id) params.set("empresaId", lote.empresa_id);
                                                                                    if (competenciaLote) params.set("competencia", competenciaLote);
                                                                                    navigate(`/financeiro?${params.toString()}`);
                                                                                }}
                                                                                title="Acompanhar e aprovar na Central Financeira (Lotes RH)"
                                                                            >
                                                                                <Send className="h-3.5 w-3.5 mr-1 text-emerald-600" />
                                                                                Ver no Financeiro
                                                                            </Button>
                                                                        )}
                                                                        {/* Lote aprovado financeiramente: segue para remessa bancária oficial */}
                                                                        {loteAptoRemessa && (
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                className="h-8 text-xs font-semibold text-indigo-700 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                                                                onClick={() => {
                                                                                    const params = new URLSearchParams();
                                                                                    params.set("tab", "diaristas");
                                                                                    params.set("origem", "DIARISTA");
                                                                                    if (lote.empresa_id) params.set("empresaId", lote.empresa_id);
                                                                                    if (competenciaLote) params.set("competencia", competenciaLote);
                                                                                    navigate(`/bancario?${params.toString()}`);
                                                                                }}
                                                                                title="Acompanhar remessa e pagamentos na Central Bancária"
                                                                            >
                                                                                <Banknote className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                                                                                Ver no Bancário
                                                                            </Button>
                                                                        )}
                                                                        {/* Lote PAGO: consulta e rastreabilidade na conciliação */}
                                                                        {lotePago && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                                                onClick={() => {
                                                                                    const params = new URLSearchParams();
                                                                                    params.set("tab", "CONCILIACAO");
                                                                                    params.set("origem", "DIARISTA");
                                                                                    if (lote.empresa_id) params.set("empresaId", lote.empresa_id);
                                                                                    if (competenciaLote) params.set("competencia", competenciaLote);
                                                                                    navigate(`/bancario?${params.toString()}`);
                                                                                }}
                                                                                title="Consultar conciliação bancária"
                                                                            >
                                                                                <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                                                                                Conciliado
                                                                            </Button>
                                                                        )}
                                                                        {(() => {
                                                                            const podeReabrirPerfil = isAdmin || isRh;
                                                                            if (!podeReabrirPerfil) return null;

                                                                            const isStatusReabrivel = ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status);
                                                                            const podeReabrirConfig = (regraFechamento as any)?.permitir_reabertura !== false;
                                                                            const reaberturasLote = (logsFechamento as any[]).filter(log =>
                                                                                log.acao === 'REABRIU' &&
                                                                                log.periodo_inicio === lote.periodo_inicio &&
                                                                                log.periodo_fim === lote.periodo_fim &&
                                                                                log.empresa_id === lote.empresa_id
                                                                            ).length;
                                                                            const limiteAtingido = reaberturasLote >= ((regraFechamento as any)?.limite_reabertura || 2);

                                                                            // Se não for status reabrível, exibir desabilitado com Tooltip contextual
                                                                            if (!isStatusReabrivel) {
                                                                                const tooltipBloqueioStatus = lotePago
                                                                                    ? "Reabertura indisponível: lote liquidado financeiramente."
                                                                                    : loteAptoRemessa
                                                                                        ? "Reabertura indisponível: lote em processamento ou remessa bancária."
                                                                                        : `Reabertura indisponível: status do lote (${lote.status}) não permite reabertura.`;

                                                                                return (
                                                                                    <Tooltip>
                                                                                        <TooltipTrigger asChild>
                                                                                            <span tabIndex={0} className="inline-flex cursor-not-allowed">
                                                                                                <Button
                                                                                                    size="sm"
                                                                                                    variant="outline"
                                                                                                    className="h-8 text-xs font-semibold text-muted-foreground/50 border-border/60 opacity-60 pointer-events-none"
                                                                                                    disabled
                                                                                                >
                                                                                                    <RefreshCw className="h-3 w-3 mr-1" />Reabrir
                                                                                                </Button>
                                                                                            </span>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent side="top" className="text-xs max-w-xs p-2">
                                                                                            {tooltipBloqueioStatus}
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                );
                                                                            }

                                                                            const isDisabled = reabrirMutation.isPending || !podeReabrirConfig || limiteAtingido;
                                                                            const tooltipMsg = !podeReabrirConfig
                                                                                ? "Reabertura desabilitada nas configurações do ciclo."
                                                                                : limiteAtingido
                                                                                    ? `Limite de ${regraFechamento?.limite_reabertura} reaberturas atingido para este lote.`
                                                                                    : "Reabrir período operacional ou administrativo";

                                                                            return (
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <span tabIndex={0} className={cn("inline-flex", isDisabled ? "cursor-not-allowed" : "")}>
                                                                                            <Button
                                                                                                size="sm"
                                                                                                variant="outline"
                                                                                                className={cn(
                                                                                                    "h-8 text-xs font-semibold",
                                                                                                    isDisabled && "pointer-events-none opacity-60"
                                                                                                )}
                                                                                                disabled={isDisabled}
                                                                                                onClick={() => {
                                                                                                    setLoteParaReabrir(lote);
                                                                                                    setMotivoReabertura("");
                                                                                                    setTipoReabertura('operacional');
                                                                                                    setOpenReabertura(true);
                                                                                                }}
                                                                                            >
                                                                                                <RefreshCw className="h-3 w-3 mr-1" />Reabrir
                                                                                                {reaberturasLote > 0 && <span className="ml-1 opacity-60 font-mono">({reaberturasLote})</span>}
                                                                                            </Button>
                                                                                        </span>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent side="top" className="text-xs max-w-xs p-2">
                                                                                        {tooltipMsg}
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tabela de Histórico Consolidado de Ciclos */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                                    Histórico Consolidado de Ciclos
                                </h3>
                                <div className="esc-card overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="esc-table-header">
                                                <tr className="text-left border-b border-border/80">
                                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">Ciclo / Período</th>
                                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Status</th>
                                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-center">Lotes no Ciclo</th>
                                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Valor Consolidado</th>
                                                    <th className="px-4 py-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground text-right">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border/60">
                                                {(() => {
                                                    const ciclosMap = new Map();
                                                    lotesHistoricoParaTabela.forEach(l => {
                                                        const key = `${l.periodo_inicio}_${l.periodo_fim}`;
                                                        if (!ciclosMap.has(key)) {
                                                            ciclosMap.set(key, { periodo_inicio: l.periodo_inicio, periodo_fim: l.periodo_fim, lotesCount: 0, valorTotal: 0, status: 'FINALIZADO' });
                                                        }
                                                        const c = ciclosMap.get(key);
                                                        c.lotesCount++;
                                                        c.valorTotal += Number(l.valor_total || l.total_valor || 0);

                                                        if (l.status === 'AGUARDANDO_VALIDACAO_RH') {
                                                            c.status = 'PENDENTE RH';
                                                        } else if (l.status === 'VALIDADO_RH' && c.status !== 'PENDENTE RH') {
                                                            c.status = 'PENDENTE FINANCEIRO';
                                                        } else if (!['PAGO', 'FECHADO_FINANCEIRO'].includes(l.status) && c.status === 'FINALIZADO') {
                                                            c.status = 'EM ANDAMENTO';
                                                        }
                                                    });
                                                    const list = Array.from(ciclosMap.values());
                                                    if (list.length === 0) {
                                                        return <tr><td colSpan={5} className="p-8 text-center text-xs text-muted-foreground">Nenhum ciclo histórico processado.</td></tr>;
                                                    }
                                                    // Ordena por data decrescente
                                                    list.sort((a, b) => (b.periodo_inicio || "").localeCompare(a.periodo_inicio || ""));

                                                    return list.map((c, i) => {
                                                        const isCicloAtivo = inicio === c.periodo_inicio && fim === c.periodo_fim;
                                                        return (
                                                            <tr key={i} className={cn(
                                                                "transition-colors",
                                                                isCicloAtivo ? "bg-primary/5 font-medium border-l-2 border-l-primary" : "hover:bg-muted/20"
                                                            )}>
                                                                <td className="px-4 py-3 font-mono font-medium text-xs">
                                                                    <div className="flex items-center gap-2">
                                                                        <span>{formatDate(c.periodo_inicio)} → {formatDate(c.periodo_fim)}</span>
                                                                        {isCicloAtivo && (
                                                                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-primary/10 text-primary border-primary/20">
                                                                                Ativo no painel
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-center">
                                                                    <span className={cn(
                                                                        "px-2.5 py-0.5 text-[10px] font-bold rounded-full",
                                                                        c.status === "FINALIZADO" ? "bg-emerald-100 text-emerald-800" :
                                                                            c.status === "PENDENTE RH" ? "bg-amber-100 text-amber-800" :
                                                                                "bg-blue-100 text-blue-800"
                                                                    )}>
                                                                        {c.status}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 text-center text-muted-foreground text-xs">{c.lotesCount} emp.</td>
                                                                <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(c.valorTotal)}</td>
                                                                <td className="px-4 py-3 text-right">
                                                                    {isCicloAtivo ? (
                                                                        <span className="inline-flex items-center gap-1 text-xs text-primary font-bold px-2 py-1 bg-primary/10 rounded">
                                                                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Visualizando
                                                                        </span>
                                                                    ) : (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            className="h-7 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10"
                                                                            onClick={() => {
                                                                                setInicio(c.periodo_inicio);
                                                                                setFim(c.periodo_fim);
                                                                                setPeriodoRapido("personalizado");
                                                                                setTabPrincipal("lotes");
                                                                                setTimeout(() => {
                                                                                    const el = document.getElementById("secao-lotes-periodo");
                                                                                    if (el) {
                                                                                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                                                                                    }
                                                                                }, 50);
                                                                                toast.info(`Exibindo lotes do ciclo ${formatDate(c.periodo_inicio)} a ${formatDate(c.periodo_fim)}`);
                                                                            }}
                                                                        >
                                                                            Ver Lotes
                                                                        </Button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    });
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ───────────────────────────────────────────────────────────── */}
                    {/* ABA 4: AUDITORIA & GOVERNANÇA                                 */}
                    {/* ───────────────────────────────────────────────────────────── */}
                    {tabPrincipal === "auditoria" && (
                        <div className="space-y-6">
                            {/* Seção 1: Timeline de Governança */}
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border border-border">
                                    <div>
                                        <h3 className="text-base font-bold text-foreground">Timeline de Governança</h3>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Rastreamento cronológico de fechamentos, validações, aprovações e reaberturas.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={exportarAuditoriaXlsx}>
                                            <Download className="h-3.5 w-3.5 mr-1.5" />
                                            Exportar Planilha
                                        </Button>
                                        <Button variant="outline" size="sm" className="h-8 text-xs font-semibold" onClick={() => refetchHistorico()} disabled={isFetchingLogs}>
                                            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetchingLogs && "animate-spin text-blue-600")} />
                                            Sincronizar
                                        </Button>
                                    </div>
                                </div>

                                {groupedLogs.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-xl border border-dashed border-border">
                                        <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                        <p className="text-sm font-semibold text-foreground">Nenhuma atividade registrada</p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                                            Ações de fechamento, validação e reabertura aparecerão aqui automaticamente.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="max-h-[540px] overflow-y-auto pr-3 relative pl-6 space-y-4 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {groupedLogs.map((log: any, idx: number) => {
                                            const isSistema = log.usuario_role === 'sistema';
                                            const isFechou = log.acao === 'FECHOU';
                                            const isValidou = log.acao === 'VALIDOU';
                                            const isAprovou = log.acao === 'APROVOU' || log.acao === 'APROVOU_FINANCEIRO';
                                            const isReabriu = log.acao === 'REABRIU';
                                            const isEncerrou = log.acao === 'ENCERROU';
                                            const isPagamento = log.acao === 'MARCOU_PAGO';
                                            const isCnab = log.acao === 'GEROU_CNAB';

                                            return (
                                                <div key={log.id ?? idx} className="relative">
                                                    <div className={cn(
                                                        "absolute -left-[29px] top-1.5 h-6 w-6 rounded-full border-4 border-background flex items-center justify-center shadow-xs z-10",
                                                        isFechou && "bg-amber-500",
                                                        isValidou && "bg-blue-600",
                                                        isAprovou && "bg-emerald-600",
                                                        isReabriu && "bg-rose-500",
                                                        isPagamento && "bg-emerald-600",
                                                        isCnab && "bg-indigo-600",
                                                        isEncerrou && "bg-slate-700",
                                                        (!isFechou && !isValidou && !isAprovou && !isReabriu && !isEncerrou && !isPagamento && !isCnab) && "bg-muted-foreground"
                                                    )}>
                                                        {isFechou && <Lock className="h-3 w-3 text-white" />}
                                                        {isValidou && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                        {isAprovou && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                        {isReabriu && <RefreshCw className="h-3 w-3 text-white" />}
                                                        {isPagamento && <Banknote className="h-3 w-3 text-white" />}
                                                        {isCnab && <FileCode2 className="h-3 w-3 text-white" />}
                                                        {isEncerrou && <FileCheck className="h-3 w-3 text-white" />}
                                                    </div>

                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={cn(
                                                                "text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                                                isFechou && "bg-amber-100 text-amber-800",
                                                                isValidou && "bg-blue-100 text-blue-800",
                                                                isAprovou && "bg-emerald-100 text-emerald-800",
                                                                isReabriu && "bg-rose-100 text-rose-800",
                                                                isPagamento && "bg-emerald-100 text-emerald-800",
                                                                isCnab && "bg-indigo-100 text-indigo-800",
                                                                isEncerrou && "bg-slate-200 text-slate-800",
                                                            )}>
                                                                {log.acao}
                                                            </span>
                                                            <span className="text-xs font-semibold text-foreground">
                                                                {isSistema ? "Ação Automática" : log.usuario_nome}
                                                                {!isSistema && <span className="text-[11px] text-muted-foreground ml-1 font-normal">({log.usuario_role})</span>}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-muted-foreground ml-auto">
                                                                {log.created_at ? format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                                                            </span>
                                                            {log.count > 1 && (
                                                                <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                                                                    {log.count}x
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="esc-card p-3 bg-card shadow-xs border-border/80 text-xs space-y-1.5">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                                                                <span className="text-xs">
                                                                    Período: <span className="font-mono font-semibold text-foreground">{formatDate(log.periodo_inicio)} → {formatDate(log.periodo_fim)}</span>
                                                                </span>
                                                                {(log.ip_address || log.user_agent) && (
                                                                    <span className="text-[10px] font-mono opacity-60 flex items-center gap-1.5">
                                                                        {log.ip_address && <span className="flex items-center gap-1"><Laptop className="w-2.5 h-2.5" />{log.ip_address}</span>}
                                                                        {log.user_agent && <span className="truncate max-w-[140px]" title={log.user_agent}>({log.user_agent})</span>}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {log.motivo && (
                                                                <div className="p-2 bg-muted/40 rounded border-l-2 border-primary/40 text-xs italic text-foreground/90">
                                                                    "{log.motivo}"
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            {/* Seção 2: Configurações do Ciclo (Apenas Administradores e RH) */}
                            {(isAdmin || isRh) ? (
                                <div className="space-y-4 pt-4 border-t border-border">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-base font-bold text-foreground">Políticas & Parâmetros do Ciclo</h4>
                                            <p className="text-xs text-muted-foreground">Regras de fechamento automático, limites de reabertura e travas financeiras.</p>
                                        </div>
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 border border-primary/10 rounded-lg">
                                            <Settings className="h-3.5 w-3.5 text-primary" />
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Configurações Administrativas</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        {/* Card: Calendário e Ciclo */}
                                        <div className="esc-card p-4 space-y-4">
                                            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">Calendário e Bloqueios</h5>
                                            </div>

                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-semibold">Dia padrão de fechamento</Label>
                                                <Select
                                                    value={(regraFechamento as any)?.dia_fechamento?.toString() || "0"}
                                                    onValueChange={(val) => updateRegraMutation.mutate({ dia_fechamento: Number(val) })}
                                                >
                                                    <SelectTrigger className="h-9 text-xs">
                                                        <SelectValue placeholder="Selecione o dia..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="5" className="text-xs">Toda Sexta-feira</SelectItem>
                                                        <SelectItem value="6" className="text-xs">Todo Sábado</SelectItem>
                                                        <SelectItem value="0" className="text-xs">Fechamento Manual (sempre aberto)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex items-center justify-between gap-4 pt-1">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-semibold">Bloqueio Operacional</span>
                                                    <p className="text-[11px] text-muted-foreground">Bloquear edição da grade pelo encarregado após o fechamento.</p>
                                                </div>
                                                <Switch
                                                    checked={(regraFechamento as any)?.bloquear_edicao ?? true}
                                                    onCheckedChange={(val) => updateRegraMutation.mutate({ bloquear_edicao: val })}
                                                />
                                            </div>
                                        </div>

                                        {/* Card: Políticas de Reabertura */}
                                        <div className="esc-card p-4 space-y-4">
                                            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                                <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                                <h5 className="text-xs font-bold uppercase tracking-wider text-foreground">Políticas de Reabertura</h5>
                                            </div>

                                            <div className="flex items-center justify-between gap-4">
                                                <div className="space-y-0.5">
                                                    <span className="text-xs font-semibold">Permitir reabertura</span>
                                                    <p className="text-[11px] text-muted-foreground">Habilita a função de reabrir lotes após validação do RH.</p>
                                                </div>
                                                <Switch
                                                    checked={(regraFechamento as any)?.permitir_reabertura ?? true}
                                                    onCheckedChange={(val) => updateRegraMutation.mutate({ permitir_reabertura: val })}
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 pt-1">
                                                <div className="p-3 bg-muted/20 rounded-lg border border-border/50 space-y-1">
                                                    <span className="text-[10px] font-bold text-foreground uppercase tracking-tight">Limite por Período</span>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            value={(regraFechamento as any)?.limite_reabertura || 2}
                                                            onChange={(e) => updateRegraMutation.mutate({ limite_reabertura: Number(e.target.value) })}
                                                            className="h-8 w-16 text-xs font-mono font-bold text-center"
                                                        />
                                                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Máximo</span>
                                                    </div>
                                                </div>

                                                <div className="p-3 bg-muted/20 rounded-lg border border-border/50 space-y-1">
                                                    <span className="text-[10px] font-bold text-foreground uppercase tracking-tight">Justificativa</span>
                                                    <div className="flex items-center justify-between pt-1">
                                                        <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Obrigatória</span>
                                                        <Switch
                                                            checked={(regraFechamento as any)?.exigir_motivo ?? true}
                                                            onCheckedChange={(val) => updateRegraMutation.mutate({ exigir_motivo: val })}
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="p-4 bg-muted/20 border border-border/80 rounded-xl text-xs text-muted-foreground text-center">
                                    Configurações e parâmetros de ciclo são restritos à equipe de RH e Administradores.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ========================================================================= */}
                {/* REGIÃO 04 — DETALHES CONTEXTUAIS & DRAWERS FUNCIONAIS (CONV-16 ETAPA 02B) */}
                {/* ========================================================================= */}

                {/* 1. Drawer Reabertura de Período */}
                <DrawerReaberturaDiarista
                    isOpen={openReabertura && !!loteParaReabrir}
                    onClose={() => {
                        setOpenReabertura(false);
                        setMotivoReabertura("");
                        setTipoReabertura('operacional');
                        setLoteParaReabrir(null);
                    }}
                    lote={loteParaReabrir}
                    usuarioNome={perfil?.full_name || user?.email}
                    isPending={reabrirMutation.isPending}
                    onConfirm={(data) => {
                        reabrirMutation.mutate(data);
                    }}
                />

                {/* 2. Drawer Edição Administrativa de Lançamento */}
                <DrawerEdicaoDiarista
                    isOpen={openEdicao && !!lancamentoEditando}
                    onClose={() => {
                        setOpenEdicao(false);
                        setTimeout(() => {
                            setLancamentoEditando(null);
                            setEditForm({});
                        }, 200);
                    }}
                    lancamento={lancamentoEditando}
                    loteContext={loteContext}
                    valorAnterior={valorAnterior}
                    isPending={editarMutation.isPending}
                    onConfirm={(formData) => {
                        editarMutation.mutate(formData);
                    }}
                />

                {/* 3. Drawer Confirmação de Fechamento de Período */}
                <DrawerFechamentoDiarista
                    isOpen={openFechamento}
                    onClose={() => {
                        setOpenFechamento(false);
                        setConfirmText("");
                        setObsLote("");
                    }}
                    empresaNome={(empresas as any[]).find(e => e.id === empresaIdDoUsuario)?.nome ?? "Empresa Atual"}
                    periodoInicio={inicio}
                    periodoFim={fim}
                    totalEmAberto={rawEmAberto}
                    isPending={fecharMutation.isPending}
                    onConfirm={(obs) => {
                        setObsLote(obs);
                        fecharMutation.mutate();
                    }}
                />

            </div>
        </AppShell>
    );
};

export default RhDiaristasPainel;
