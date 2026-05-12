import { useMemo, useState } from "react";
import { format, startOfWeek, endOfWeek, subWeeks, eachDayOfInterval, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService,
    DiaristaCicloService,
    EmpresaService,
} from "@/services/base.service";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CalendarDays, CheckCircle2, ChevronDown, ChevronRight, Download, Loader2, Lock, RefreshCw, Users, Calendar, Table as TableIcon, Settings, Send, FileCheck, History, CalendarClock } from "lucide-react";

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatDate = (d: string) =>
    format(new Date(d + "T12:00:00"), "dd/MM", { locale: ptBR });

// ─── Mapa de status: cobre todos os valores conhecidos (DB default lowercase + governança uppercase + legado) ───
const STATUS_DIARISTA_MAP: Record<string, { label: string; cls: string }> = {
    em_aberto: { label: "Em aberto", cls: "bg-amber-500/15 text-amber-700" },
    EM_ABERTO: { label: "Em aberto", cls: "bg-amber-500/15 text-amber-700" },
    AGUARDANDO_VALIDACAO_RH: { label: "⏳ Ag. Validação RH", cls: "bg-blue-500/15 text-blue-800" },
    VALIDADO_RH: { label: "✅ Validado RH", cls: "bg-indigo-500/15 text-indigo-700" },
    FECHADO_FINANCEIRO: { label: "💰 Aprovado Financeiro", cls: "bg-emerald-500/15 text-emerald-800" },
    PAGO: { label: "✔ Pago", cls: "bg-emerald-600/15 text-emerald-800" },
    cancelado: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
    CANCELADO: { label: "Cancelado", cls: "bg-muted text-muted-foreground" },
    // legado — migrado via migration mas mantido como fallback defensivo
    fechado_para_pagamento: { label: "⏳ Ag. Validação RH", cls: "bg-blue-500/15 text-blue-800" },
    fechado: { label: "⏳ Ag. Validação RH", cls: "bg-blue-500/15 text-blue-800" },
};

const StatusDiaristaBadge = ({ status }: { status?: string }) => {
    if (!status) return null;
    const entry = STATUS_DIARISTA_MAP[status];
    return (
        <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap",
            entry?.cls ?? "bg-muted text-muted-foreground"
        )}>
            {entry?.label ?? status}
        </span>
    );
};


type StatusFilter = "todos" | "em_aberto" | "AGUARDANDO_VALIDACAO_RH" | "VALIDADO_RH" | "FECHADO_FINANCEIRO" | "PAGO";

type Visao = "diarista" | "data" | "grade_semanal";
type PeriodoRapido = "semana_atual" | "semana_anterior" | "personalizado";

// (CycleManagementSection removed — logic inlined into RhDiaristasPainel for proper data access)

const RhDiaristasPainel = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();


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

    const rawRole = perfil?.role || user?.user_metadata?.role || user?.app_metadata?.role || user?.role || "";
    const role = (typeof rawRole === "string" ? rawRole : "").toLowerCase();
    const isAdmin = role === "admin" || role === "administrador" || role.includes("admin");
    const isRh = role === "rh" || role === "recursos humanos" || role === "recursos_humanos" || role.includes("rh");
    // Empresa do usuário — Como empresa_id não está no profile base, tentamos ler do tenant context ou ignoramos
    const empresaIdDoUsuario = perfil?.tenant_id ?? ((empresas as any[])[0]?.id ?? "");

    // Visão consolidada: busca lançamentos sem filtro de empresa.
    // O filtro de empresa da UI é aplicado client-side nos dados já carregados.
    const { data: lancamentos = [], isLoading, isFetching, refetch } = useQuery({
        queryKey: ["lancamentos_diaristas_painel", inicio, fim, statusFiltro === "todos" ? undefined : statusFiltro],
        queryFn: () =>
            LancamentoDiaristaService.getByPeriodo(
                null, // null = todas as empresas
                inicio,
                fim,
                statusFiltro !== "todos" ? { status: statusFiltro as any } : undefined,
            ),
        enabled: true,
    });

    const { data: lotes = [], refetch: refetchLotes, isLoading: isLoadingLotes } = useQuery({
        queryKey: ["lotes_fechamento_painel", inicio, fim, empresaFiltroId],
        queryFn: () => LoteFechamentoDiaristaService.getLotesPorPeriodo(
            inicio,
            fim,
            empresaFiltroId === "todos" ? null : empresaFiltroId
        ),
        enabled: true,
    });

    const periodoBloqueado = useMemo(() => {
        if (empresaFiltroId === "todos") return false;
        const loteAtivo = (lotes as any[]).find(l =>
            l.empresa_id === empresaFiltroId &&
            ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH", "AGUARDANDO_FINANCEIRO", "FECHADO_FINANCEIRO", "PAGO"].includes(l.status)
        );
        return !!loteAtivo;
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


    const [cicloTab, setCicloTab] = useState<"ciclos" | "lotes" | "historico" | "configuracao">("lotes");

    const updateRegraMutation = useMutation({
        mutationFn: (payload: any) => {
            if (!(regraFechamento as any)?.id) {
                // Se não existir, podemos tentar criar uma ou avisar. 
                // Assumindo que deve existir via migration.
                throw new Error("Regra de fechamento não encontrada no banco.");
            }
            return DiaristaCicloService.updateRegraFechamento((regraFechamento as any).id, payload);
        },
        onSuccess: () => { 
            toast.success("Configuração atualizada com sucesso."); 
            refetchRegra(); 
        },
        onError: (err: any) => toast.error("Erro ao atualizar regra.", { description: err.message }),
    });

    // Agrupar lançamentos por diarista
    const dadosAgrupados = useMemo(() => {
        let items = lancamentos as any[];

        // Filtro de empresa (client-side)
        if (empresaFiltroId !== "todos") {
            items = items.filter((l) => l.empresa_id === empresaFiltroId);
        }
        if (nomeFiltro) {
            const q = nomeFiltro.toLowerCase();
            items = items.filter((l) => l.nome_colaborador.toLowerCase().includes(q));
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
        }> = {};

        items.forEach((l) => {
            const key = l.diarista_id;
            if (!map[key]) {
                map[key] = {
                    diarista_id: l.diarista_id,
                    nome: l.nome_colaborador,
                    funcao: l.funcao_colaborador ?? "—",
                    lancamentos: [],
                    contagem: {},
                    totalDiarias: 0,
                    valorTotal: 0,
                    status: l.status,
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


        return Object.values(map).sort((a, b) => a.nome.localeCompare(b.nome));
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
            items = items.filter((l) => l.nome_colaborador.toLowerCase().includes(q));
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
        return {
            valorTotal: dadosAgrupados.reduce((a, g) => a + g.valorTotal, 0),
            totalDiaristas: dadosAgrupados.length,
            totalRegistros: lancsFiltradosPorStatus.length,
            emAberto: (lancamentos as any[]).filter((l) => l.status === "em_aberto" || l.status === "EM_ABERTO").length,
        };
    }, [dadosAgrupados, lancamentos, statusFiltro]);

    // rawEmAberto: conta apenas registros da empresa do usuário em aberto (para o fechamento)
    const rawEmAberto = useMemo(
        () => (lancamentos as any[]).filter((l) => (l.status === "em_aberto" || l.status === "EM_ABERTO") && l.empresa_id === empresaIdDoUsuario).length,
        [lancamentos, empresaIdDoUsuario],
    );
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
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel"] });
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
            await LoteFechamentoDiaristaService.validarPeriodo(loteId, user.id, perfil?.nome_completo || user.email, role || "rh");

            // Se não exigir aprovação financeira, já pula para o próximo status ou finaliza
            if ((regraFechamento as any)?.enviar_financeiro === false) {
                const finalStatus = (regraFechamento as any)?.auto_fechar ? "PAGO" : "FECHADO_FINANCEIRO";
                
                await supabase
                    .from("diaristas_lotes_fechamento")
                    .update({ status: finalStatus, updated_at: new Date().toISOString() })
                    .eq("id", loteId);

                await supabase
                    .from("lancamentos_diaristas")
                    .update({ status: finalStatus, updated_at: new Date().toISOString() })
                    .eq("lote_fechamento_id", loteId);
                
                await supabase.from("diaristas_logs_fechamento").insert({
                    empresa_id: (lotes as any[]).find(l => l.id === loteId)?.empresa_id,
                    tenant_id: perfil?.tenant_id,
                    usuario_id: user.id,
                    usuario_nome: "SISTEMA (Auto)",
                    usuario_role: "sistema",
                    acao: finalStatus === "PAGO" ? "ENCERROU" : "APROVOU",
                    periodo_inicio: (lotes as any[]).find(l => l.id === loteId)?.periodo_inicio,
                    periodo_fim: (lotes as any[]).find(l => l.id === loteId)?.periodo_fim,
                    motivo: finalStatus === "PAGO" ? "Encerramento automático (Configuração)" : "Aprovação financeira automática (Configuração)"
                });
            }
        },
        onSuccess: () => {
            toast.success("Lote validado pelo RH" + ((regraFechamento as any)?.enviar_financeiro === false ? " e finalizado." : "."));
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            refetchHistorico();
        },
        onError: (err: any) => toast.error("Erro ao validar lote.", { description: err.message }),
    });

    const reabrirMutation = useMutation({
        mutationFn: ({ loteId, motivo }: { loteId: string, motivo: string }) => {
            if (!user?.id) throw new Error("Usuário não identificado.");
            return LoteFechamentoDiaristaService.reabrirPeriodo(loteId, user.id, perfil?.nome_completo || user.email, role || "rh", motivo);
        },
        onSuccess: () => {
            toast.success("Lote reaberto com sucesso. Registros voltaram a Em Aberto.");
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            refetchHistorico();
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
            toast.success("Lote aprovado" + ((regraFechamento as any)?.auto_fechar ? " e encerrado automaticamente." : "."));
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento_painel"] });
            queryClient.invalidateQueries({ queryKey: ["lotes_fechamento"] });
            queryClient.invalidateQueries({ queryKey: ["diaristas_logs_fechamento"] });
            refetchHistorico();
        },
        onError: (err: any) => toast.error("Erro ao aprovar lote.", { description: err.message }),
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
        <AppShell title="Painel de Diaristas" subtitle="Acompanhamento consolidado · formato planilha">
            <div className="space-y-4">

                {/* KPIs rápidos — reagem aos filtros ativos */}
                {statusFiltro !== "todos" && (
                    <div className="flex items-center gap-2 px-1">
                        <span className="inline-flex items-center gap-1.5 bg-blue-500/10 text-blue-700 border border-blue-500/30 text-xs font-semibold px-2.5 py-1 rounded-full">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            KPIs refletem o filtro: {statusFiltro === "em_aberto" ? "Em aberto" : statusFiltro === "AGUARDANDO_VALIDACAO_RH" ? "Aguardando Validação RH" : statusFiltro === "VALIDADO_RH" ? "Validado RH" : statusFiltro === "FECHADO_FINANCEIRO" ? "Fechado Financeiro" : statusFiltro === "PAGO" ? "Pago" : "Filtrado"}
                        </span>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: "Diaristas", value: totalGeral.totalDiaristas },
                        { label: statusFiltro !== "todos" ? `Registros (${statusFiltro === "em_aberto" ? "abertos" : statusFiltro === "PAGO" ? "pagos" : "fechados"})` : "Registros totais", value: totalGeral.totalRegistros },
                        { label: "Em aberto", value: totalGeral.emAberto, color: totalGeral.emAberto > 0 ? "text-amber-600" : "text-emerald-600" },
                        { label: statusFiltro !== "todos" ? "Valor (filtrado)" : "Valor total", value: formatCurrency(totalGeral.valorTotal), large: true },
                    ].map((k) => (
                        <div key={k.label} className="esc-card p-4 text-center">
                            <p className="text-xs text-muted-foreground mb-1">{k.label}</p>
                            <p className={cn("font-bold text-foreground", k.color, k.large ? "text-lg font-mono" : "text-2xl")}>{k.value}</p>
                        </div>
                    ))}
                </div>

                {/* Filtros */}
                <div className="space-y-4 esc-card p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="space-y-1">
                            <Label className="text-xs">Filtro rápido</Label>
                            <Select value={periodoRapido} onValueChange={(v) => changePeriodoRapido(v as PeriodoRapido)}>
                                <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="semana_atual">Semana atual</SelectItem>
                                    <SelectItem value="semana_anterior">Semana anterior</SelectItem>
                                    <SelectItem value="personalizado">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Início</Label>
                            <Input type="date" className="h-8 text-sm w-36" value={inicio} onChange={(e) => { setInicio(e.target.value); setPeriodoRapido("personalizado"); }} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Fim</Label>
                            <Input type="date" className="h-8 text-sm w-36" value={fim} onChange={(e) => { setFim(e.target.value); setPeriodoRapido("personalizado"); }} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Status</Label>
                            <Select value={statusFiltro} onValueChange={(v) => setStatusFiltro(v as StatusFilter)}>
                                <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="em_aberto">Em aberto</SelectItem>
                                    <SelectItem value="AGUARDANDO_VALIDACAO_RH">Aguardando Validação RH</SelectItem>
                                    <SelectItem value="VALIDADO_RH">Validado RH</SelectItem>
                                    <SelectItem value="FECHADO_FINANCEIRO">Fechado Financeiro</SelectItem>
                                    <SelectItem value="PAGO">Pago</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Empresa</Label>
                            <Select value={empresaFiltroId} onValueChange={setEmpresaFiltroId}>
                                <SelectTrigger className="h-8 text-sm w-48"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todas as empresas</SelectItem>
                                    {(empresas as any[]).map((e) => (
                                        <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs">Função</Label>
                            <Select value={funcaoFiltro} onValueChange={setFuncaoFiltro}>
                                <SelectTrigger className="h-8 text-sm w-44"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todas</SelectItem>
                                    {funcoes.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1 flex-1 min-w-[160px]">
                            <Label className="text-xs">Nome</Label>
                            <Input className="h-8 text-sm" placeholder="Filtrar por nome..." value={nomeFiltro} onChange={(e) => setNomeFiltro(e.target.value)} />
                        </div>
                        <div className="flex gap-2 ml-auto">
                            <Button variant="outline" size="sm" className="h-8" onClick={() => refetch()}>
                                <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} /> Atualizar
                            </Button>
                            <Button variant="outline" size="sm" className="h-8" onClick={exportarXlsx} disabled={dadosAgrupados.length === 0}>
                                <Download className="h-3.5 w-3.5 mr-1" /> Exportar
                            </Button>
                            {/* C5: desabilitado baseado no rawEmAberto (sem filtros) + hint de explicação */}
                            {/* UX: cor amber/warning para diferenciar de ação primária comum */}
                            {!periodoBloqueado && (
                                <div className="relative group">
                                    <Button
                                        size="sm"
                                        className={cn(
                                            "h-8 font-bold transition-colors",
                                            rawEmAberto > 0
                                                ? "bg-amber-600 hover:bg-amber-700 text-white"
                                                : "bg-muted text-muted-foreground cursor-not-allowed"
                                        )}
                                        onClick={() => setOpenFechamento(true)}
                                        disabled={rawEmAberto === 0}
                                    >
                                        <Lock className="h-3.5 w-3.5 mr-1" /> Fechar período
                                        {rawEmAberto > 0 && (
                                            <span className="ml-1.5 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                                                {rawEmAberto}
                                            </span>
                                        )}
                                    </Button>
                                    {rawEmAberto === 0 && (
                                        <div className="absolute bottom-full right-0 mb-2 hidden group-hover:block w-56 bg-popover border border-border rounded-lg shadow-lg p-2.5 text-xs text-muted-foreground z-50">
                                            Nenhum lançamento <strong>em aberto</strong> no período selecionado.
                                            {temFiltroAtivo && " (Você tem filtros ativos — limpe-os para ver todos.)"}
                                        </div>
                                    )}
                                </div>
                            )}
                            {periodoBloqueado && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md border border-border">
                                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-xs font-semibold text-muted-foreground">Período Bloqueado</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                    {/* Alternância de Visão */}
                    <div className="flex bg-muted p-1 rounded-lg w-max mb-1 sm:mb-0">
                        <button
                            className={cn(
                                "flex items-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                visao === "grade_semanal" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setVisao("grade_semanal")}
                            title="Visão sugerida para conferência diária presencial"
                        >
                            <TableIcon className="h-4 w-4 mr-2" />
                            Grade Semanal
                        </button>
                        <button
                            className={cn(
                                "flex items-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                visao === "diarista" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setVisao("diarista")}
                            title="Visão totalizadora por pessoa (útil para fechamento financeiro)"
                        >
                            <Users className="h-4 w-4 mr-2" />
                            Agrupar por Diarista
                        </button>
                        <button
                            className={cn(
                                "flex items-center px-4 py-1.5 text-sm font-medium rounded-md transition-colors",
                                visao === "data" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setVisao("data")}
                            title="Visão de custo diário isolado da operação"
                        >
                            <Calendar className="h-4 w-4 mr-2" />
                            Agrupar por Data
                        </button>
                    </div>

                    {visao === "grade_semanal" && (
                        <div className="flex items-center gap-3 text-xs bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-emerald-500"></span> <b>P</b> = Diária completa</span>
                            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-amber-500"></span> <b>MP</b> = Meia diária</span>
                            <span className="flex items-center gap-1.5"><span className="text-muted-foreground font-bold leading-none">-</span> Sem lançamento</span>
                        </div>
                    )}
                </div>

                {/* Tabela consolidada */}
                <section className="esc-card overflow-x-auto">
                    {(isLoading || isLoadingLotes) ? (
                        <div className="flex flex-col items-center justify-center p-12 gap-3">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-xs text-muted-foreground uppercase tracking-widest">Carregando...</p>
                        </div>
                    ) : dadosAgrupados.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-16 gap-3 text-center">
                            <CalendarDays className="h-10 w-10 text-muted-foreground" />
                            <p className="font-medium text-foreground">Nenhum lançamento encontrado</p>
                            <p className="text-sm text-muted-foreground">Ajuste os filtros ou peça ao encarregado para registrar as presenças.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="esc-table-header">
                                {visao === "diarista" ? (
                                    <tr className="text-left">
                                        <th className="px-5 h-11 font-medium"></th>
                                        <th className="px-3 h-11 font-medium">Diarista</th>
                                        <th className="px-3 h-11 font-medium">Função</th>
                                        <th className="px-3 h-11 font-medium text-center">Resumo Marcações</th>
                                        <th className="px-3 h-11 font-medium text-center">Total diárias</th>
                                        <th className="px-3 h-11 font-medium text-right">Valor total</th>
                                        <th className="px-5 h-11 font-medium text-center">Status</th>
                                    </tr>
                                ) : visao === "grade_semanal" ? (
                                    <tr className="text-left">
                                        <th className="px-5 h-12 font-medium min-w-[220px] text-sm">Diarista</th>
                                        {diasDaSemanaBase.map((d) => (
                                            <th key={d.toISOString()} className={cn("px-3 h-12 text-center whitespace-nowrap min-w-[64px]", isToday(d) && "bg-blue-50/50 border-b-2 border-b-blue-400")}>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold uppercase text-muted-foreground tracking-wider">{format(d, "eeeeee", { locale: ptBR })}</span>
                                                    <span className="font-mono text-xs text-foreground">{format(d, "dd/MM")}</span>
                                                </div>
                                            </th>
                                        ))}
                                        <th className="px-3 h-12 font-medium text-center text-sm">Diárias</th>
                                        <th className="px-5 h-12 font-medium text-right text-sm">Valor</th>
                                    </tr>
                                ) : (
                                    <tr className="text-left">
                                        <th className="px-5 h-11 font-medium"></th>
                                        <th className="px-3 h-11 font-medium">Data</th>
                                        <th className="px-3 h-11 font-medium text-center">Diaristas</th>
                                        <th className="px-3 h-11 font-medium text-center">Total diárias</th>
                                        <th className="px-3 h-11 font-medium text-right">Valor total</th>
                                        <th className="px-5 h-11 font-medium text-center"></th>
                                    </tr>
                                )}
                            </thead>
                            <tbody>
                                {visao === "diarista" ? (
                                    dadosAgrupados.map((g) => (
                                        <>
                                            <tr
                                                key={g.diarista_id}
                                                className="border-t border-muted hover:bg-background cursor-pointer"
                                                onClick={() => setExpandedId(expandedId === g.diarista_id ? null : g.diarista_id)}
                                            >
                                                <td className="px-5 h-12 w-8 text-muted-foreground">
                                                    {expandedId === g.diarista_id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="px-3 font-medium text-foreground">{g.nome}</td>
                                                <td className="px-3 text-muted-foreground">{g.funcao}</td>
                                                <td className="px-3 text-center min-w-[120px]">
                                                    <div className="flex flex-wrap gap-1 justify-center">
                                                        {Object.entries(g.contagem).map(([cod, qtd]) => (
                                                            <span key={cod} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border">
                                                                {qtd as number}x {cod}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-3 text-center font-mono">
                                                    {g.totalDiarias.toFixed(1)}
                                                </td>
                                                <td className="px-3 text-right font-mono font-semibold text-foreground">
                                                    {formatCurrency(g.valorTotal)}
                                                </td>
                                                <td className="px-5 text-center">
                                                    <StatusDiaristaBadge status={g.status} />
                                                </td>
                                            </tr>
                                            {expandedId === g.diarista_id && (
                                                <tr key={`${g.diarista_id}-detail`} className="border-t border-muted/50 bg-muted/20">
                                                    <td colSpan={8} className="px-5 py-4">
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-7 gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border/50">
                                                                <span>Data</span>
                                                                <span>Marcação</span>
                                                                <span>Qtd</span>
                                                                <span className="text-right">Diária base</span>
                                                                <span className="text-right">Valor</span>
                                                                <span>Cliente</span>
                                                                <span>Observação</span>
                                                            </div>
                                                            {g.lancamentos.map((l: any) => (
                                                                <div key={l.id} className="grid grid-cols-7 gap-2 text-xs items-center">
                                                                    <span className="font-mono text-muted-foreground">{formatDate(l.data_lancamento)}</span>
                                                                    <span className={cn(
                                                                        "font-bold",
                                                                        l.codigo_marcacao === "P" && "text-emerald-600",
                                                                        l.codigo_marcacao === "MP" && "text-amber-600",
                                                                    )}>{l.codigo_marcacao}</span>
                                                                    <span className="font-mono">{l.quantidade_diaria}</span>
                                                                    <span className="font-mono text-right text-muted-foreground">{formatCurrency(l.valor_diaria_base)}</span>
                                                                    <span className="font-mono text-right font-semibold text-foreground">{formatCurrency(l.valor_calculado)}</span>
                                                                    <span className="text-muted-foreground truncate">{l.cliente_unidade ?? "—"}</span>
                                                                    <span className="text-muted-foreground truncate">{l.observacao ?? "—"}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))
                                ) : visao === "grade_semanal" ? (
                                    dadosAgrupados.map((g) => (
                                        <tr key={g.diarista_id} className="border-t border-muted hover:bg-background">
                                            <td className="px-5 h-14">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-sm text-foreground truncate max-w-[220px]">{g.nome}</span>
                                                    <span className="text-xs text-muted-foreground truncate max-w-[220px]">{g.funcao}</span>
                                                </div>
                                            </td>
                                            {diasDaSemanaBase.map((d) => {
                                                const strDate = format(d, "yyyy-MM-dd");
                                                const diaLancamentos = g.lancamentos.filter((l: any) => l.data_lancamento === strDate);

                                                if (diaLancamentos.length === 0) {
                                                    return (
                                                        <td key={d.toISOString()} className={cn("px-3 text-center text-muted-foreground/40 font-medium text-sm", isToday(d) && "bg-blue-50/50")}>
                                                            –
                                                        </td>
                                                    );
                                                }

                                                const codes = Array.from(new Set(diaLancamentos.map((l: any) => l.codigo_marcacao)));
                                                const tooltipVal = diaLancamentos.map((l: any) => `${l.quantidade_diaria}x ${l.codigo_marcacao} = ${formatCurrency(l.valor_calculado)}`).join(' | ');

                                                return (
                                                    <td key={d.toISOString()} className={cn("px-3 text-center", isToday(d) && "bg-blue-50/50")} title={tooltipVal}>
                                                        <div className="flex flex-col items-center gap-0.5 cursor-help">
                                                            <span className={cn(
                                                                "text-xs uppercase font-bold px-2 py-0.5 rounded",
                                                                codes.includes("P") && "text-emerald-700 bg-emerald-500/15",
                                                                codes.includes("MP") && "text-amber-700 bg-amber-500/15",
                                                                (!codes.includes("P") && !codes.includes("MP")) && "bg-muted text-foreground"
                                                            )}>
                                                                {codes.join("+")}
                                                            </span>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                            <td className="px-3 text-center font-mono font-bold text-sm">
                                                {g.totalDiarias.toFixed(1)}
                                            </td>
                                            <td className="px-5 text-right font-mono font-semibold text-foreground text-sm">
                                                {formatCurrency(g.valorTotal)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    dadosAgrupadosPorData.map((g) => (
                                        <>
                                            <tr
                                                key={g.data_lancamento}
                                                className="border-t border-muted hover:bg-background cursor-pointer"
                                                onClick={() => setExpandedId(expandedId === g.data_lancamento ? null : g.data_lancamento)}
                                            >
                                                <td className="px-5 h-12 w-8 text-muted-foreground">
                                                    {expandedId === g.data_lancamento ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </td>
                                                <td className="px-3 font-mono font-bold text-foreground">{formatDate(g.data_lancamento)}</td>
                                                <td className="px-3 text-center">{g.totalDiaristas}</td>
                                                <td className="px-3 text-center font-mono">{g.totalDiarias.toFixed(1)}</td>
                                                <td className="px-3 text-right font-mono font-semibold text-foreground">
                                                    {formatCurrency(g.valorTotal)}
                                                </td>
                                                <td className="px-5 text-center"></td>
                                            </tr>
                                            {expandedId === g.data_lancamento && (
                                                <tr key={`${g.data_lancamento}-detail`} className="border-t border-muted/50 bg-muted/20">
                                                    <td colSpan={6} className="px-5 py-4">
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-7 gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pb-1 border-b border-border/50">
                                                                <span className="col-span-2">Colaborador / Função</span>
                                                                <span className="text-center">Marcação / Qtd</span>
                                                                <span className="text-right">Valor</span>
                                                                <span>Cliente / Op.</span>
                                                                <span className="text-center">Status</span>
                                                            </div>
                                                            {g.lancamentos.map((l: any) => (
                                                                <div key={l.id} className="grid grid-cols-7 gap-2 text-xs items-center">
                                                                    <div className="col-span-2 flex flex-col pt-1 pb-1">
                                                                        <span className="font-bold text-foreground truncate">{l.nome_colaborador}</span>
                                                                        <span className="text-[10px] text-muted-foreground truncate">{l.funcao_colaborador ?? "—"}</span>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <span className={cn(
                                                                            "font-bold mr-2",
                                                                            l.codigo_marcacao === "P" && "text-emerald-600",
                                                                            l.codigo_marcacao === "MP" && "text-amber-600",
                                                                        )}>{l.codigo_marcacao}</span>
                                                                        <span className="font-mono text-muted-foreground">{l.quantidade_diaria}</span>
                                                                    </div>
                                                                    <div className="text-right flex flex-col pt-1 pb-1">
                                                                        <span className="font-mono font-semibold">{formatCurrency(l.valor_calculado)}</span>
                                                                        <span className="text-[10px] font-mono text-muted-foreground">{formatCurrency(l.valor_diaria_base)} bs.</span>
                                                                    </div>
                                                                    <div className="flex flex-col pt-1 pb-1">
                                                                        <span className="truncate text-muted-foreground">{l.cliente_unidade ?? "—"}</span>
                                                                        <span className="truncate text-[10px] text-muted-foreground">{l.operacao_servico ?? "—"}</span>
                                                                    </div>
                                                                    <div className="text-center">
                                                                        <StatusDiaristaBadge status={(() => {
                                                                            // Sincronização visual profunda para o detalhamento
                                                                            if (l.status === "EM_ABERTO" || l.status === "em_aberto") {
                                                                                const loteRel = (lotes as any[]).find(lote => lote.empresa_id === l.empresa_id);
                                                                                return loteRel ? loteRel.status : l.status;
                                                                            }
                                                                            return l.status;
                                                                        })()} />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </section>

                {/* ─── Ciclo de Fechamento ─────────────────────── */}
                <section className="esc-card">
                    <div className="px-5 pt-4 pb-3 border-b border-border/60 flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold text-foreground">Ciclo de Fechamento</h2>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-border/60 px-2">
                        {(["ciclos", "lotes", "historico", "configuracao"] as const).map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setCicloTab(tab)}
                                className={cn(
                                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                                    cicloTab === tab
                                        ? "border-primary text-primary"
                                        : "border-transparent text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {tab === "ciclos" && <><RefreshCw className="h-3.5 w-3.5" /> Ciclos</>}
                                {tab === "lotes" && <><FileCheck className="h-3.5 w-3.5" /> Lotes</>}
                                {tab === "historico" && <><History className="h-3.5 w-3.5" /> Histórico</>}
                                {tab === "configuracao" && <><Settings className="h-3.5 w-3.5" /> Configuração</>}
                            </button>
                        ))}
                    </div>

                    <div className="p-5">
                        {/* ── Aba: Ciclos ── */}
                        {cicloTab === "ciclos" && (
                            <div className="space-y-6">
                                {/* Card Ciclo Atual (Semana atual baseada no seletor, ou o mais recente) */}
                                <div className="esc-card p-5 border-l-4 border-l-primary/70 bg-gradient-to-r from-background to-muted/20">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-1">
                                                Ciclo de Operação Selecionado
                                            </p>
                                            <h3 className="text-xl font-display font-medium text-foreground">
                                                {formatDate(inicio)} a {formatDate(fim)}
                                            </h3>
                                        </div>
                                        <div>
                                                <span className={cn(
                                                    "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold",
                                                    statusCicloAtual === "FINALIZADO" ? "bg-emerald-100 text-emerald-700" : "bg-primary/10 text-primary"
                                                )}>
                                                    {statusCicloAtual !== "FINALIZADO" && (
                                                        <span className="relative flex h-2 w-2">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
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
                                            <p className="text-lg font-mono font-bold text-foreground">{formatCurrency(
                                                (lotes as any[]).reduce((acc, l) => acc + Number(l.valor_total || l.total_valor || 0), 0)
                                            )}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Total Lotes</p>
                                            <p className="text-lg font-mono font-bold text-foreground">{(lotes as any[]).length}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-amber-600/70">Pendências RH</p>
                                            <p className="text-lg font-mono font-bold text-amber-600">{
                                                (lotes as any[]).filter(l => l.status === "AGUARDANDO_VALIDACAO_RH").length
                                            }</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-blue-600/70">Pend. Financeiro</p>
                                            <p className="text-lg font-mono font-bold text-blue-600">{
                                                (lotes as any[]).filter(l => l.status === "VALIDADO_RH" || l.status === "AGUARDANDO_FINANCEIRO").length
                                            }</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold text-foreground">Histórico Consolidado de Ciclos</h3>
                                    <div className="overflow-hidden rounded-lg border border-border">
                                        <table className="w-full text-sm">
                                            <thead className="esc-table-header">
                                                <tr className="text-left">
                                                    <th className="px-4 py-3 font-medium">Ciclo / Período</th>
                                                    <th className="px-4 py-3 font-medium text-center">Status</th>
                                                    <th className="px-4 py-3 font-medium text-center">Lotes no Ciclo</th>
                                                    <th className="px-4 py-3 font-medium text-right">Valor Consolidado</th>
                                                    <th className="px-4 py-3 font-medium text-right">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {/* Simulated grouping using available lotes for demonstration purposes of UI until a true model is defined */}
                                                {(() => {
                                                    const ciclosMap = new Map();
                                                    (lotes as any[]).forEach(l => {
                                                        const key = `${l.periodo_inicio}_${l.periodo_fim}`;
                                                        if (!ciclosMap.has(key)) {
                                                            ciclosMap.set(key, { periodo_inicio: l.periodo_inicio, periodo_fim: l.periodo_fim, lotesCount: 0, valorTotal: 0, status: 'FINALIZADO' });
                                                        }
                                                        const c = ciclosMap.get(key);
                                                        c.lotesCount++;
                                                        c.valorTotal += Number(l.valor_total || l.total_valor || 0);
                                                        
                                                        // Regra de status do ciclo histórico
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
                                                        return <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nenhum ciclo histórico processado.</td></tr>;
                                                    }
                                                    return list.map((c, i) => (
                                                        <tr key={i} className="border-t border-border hover:bg-muted/20">
                                                            <td className="px-4 py-3 font-mono font-medium">{formatDate(c.periodo_inicio)} → {formatDate(c.periodo_fim)}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className={cn(
                                                                    "px-2 py-0.5 text-[10px] font-bold rounded-full",
                                                                    c.status === "FINALIZADO" ? "bg-emerald-100 text-emerald-700" : 
                                                                    c.status === "PENDENTE RH" ? "bg-amber-100 text-amber-700" :
                                                                    "bg-blue-100 text-blue-700"
                                                                )}>
                                                                    {c.status}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-muted-foreground">{c.lotesCount} emp.</td>
                                                            <td className="px-4 py-3 text-right font-mono font-semibold">{formatCurrency(c.valorTotal)}</td>
                                                            <td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setInicio(c.periodo_inicio); setFim(c.periodo_fim); setCicloTab("lotes"); }}>Ver lotes</Button></td>
                                                        </tr>
                                                    ));
                                                })()}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Aba: Lotes ── */}
                        {cicloTab === "lotes" && (
                            <div className="overflow-x-auto">
                                {(lotes as any[]).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
                                        <FileCheck className="h-10 w-10 text-muted-foreground/40" />
                                        <p className="font-medium text-foreground">Nenhum lote encontrado</p>
                                        <p className="text-sm text-muted-foreground">Feche um período para gerar um lote de governança.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead className="esc-table-header">
                                            <tr className="text-left">
                                                <th className="px-4 h-10 font-medium">Período</th>
                                                <th className="px-4 h-10 font-medium">Empresa</th>
                                                <th className="px-4 h-10 font-medium text-center">Registros</th>
                                                <th className="px-4 h-10 font-medium text-right">Valor Total</th>
                                                <th className="px-4 h-10 font-medium text-center">Status</th>
                                                <th className="px-4 h-10 font-medium text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(lotes as any[]).map((lote: any) => {
                                                const podeValidar = (isAdmin || isRh) && lote.status === "AGUARDANDO_VALIDACAO_RH";
                                                const podeAprovar = isAdmin && lote.status === "VALIDADO_RH";
                                                const podeReabrir = (isAdmin || isRh) && ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status);
                                                return (
                                                    <tr key={lote.id} className="border-t border-muted hover:bg-muted/30">
                                                        <td className="px-4 py-3 font-mono text-xs">
                                                            {lote.periodo_inicio ? format(new Date(lote.periodo_inicio + "T12:00:00"), "dd/MM/yy") : "—"}
                                                            {" → "}
                                                            {lote.periodo_fim ? format(new Date(lote.periodo_fim + "T12:00:00"), "dd/MM/yy") : "—"}
                                                        </td>
                                                        <td className="px-4 py-3 text-muted-foreground">{lote.empresa?.nome ?? lote.empresa_id ?? "—"}</td>
                                                        <td className="px-4 py-3 text-center font-mono">{lote.total_registros ?? "—"}</td>
                                                        <td className="px-4 py-3 text-right font-mono font-semibold">{lote.valor_total != null ? formatCurrency(lote.valor_total) : "—"}</td>
                                                        <td className="px-4 py-3 text-center">
                                                            <StatusDiaristaBadge status={lote.status} />
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {podeValidar && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                                                                        disabled={validarMutation.isPending}
                                                                        onClick={() => validarMutation.mutate(lote.id)}
                                                                    >
                                                                        {validarMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><CheckCircle2 className="h-3 w-3 mr-1" />Validar RH</>}
                                                                    </Button>
                                                                )}
                                                                {podeAprovar && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                                        disabled={aprovarMutation.isPending}
                                                                        onClick={() => aprovarMutation.mutate(lote.id)}
                                                                    >
                                                                        {aprovarMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Send className="h-3 w-3 mr-1" />Aprovar Financeiro</>}
                                                                    </Button>
                                                                )}
                                                                {(() => {
                                                                    const podeReabrirConfig = (regraFechamento as any)?.permitir_reabertura !== false;
                                                                    const reaberturasLote = (logsFechamento as any[]).filter(log => 
                                                                        log.acao === 'REABRIU' && 
                                                                        log.periodo_inicio === lote.periodo_inicio && 
                                                                        log.periodo_fim === lote.periodo_fim &&
                                                                        log.empresa_id === lote.empresa_id
                                                                    ).length;
                                                                    const limiteAtingido = reaberturasLote >= ((regraFechamento as any)?.limite_reabertura || 2);
                                                                    const exibirBotaoReabrir = (isAdmin || isRh) && ["AGUARDANDO_VALIDACAO_RH", "VALIDADO_RH"].includes(lote.status);

                                                                    if (!exibirBotaoReabrir) return null;

                                                                    const isDisabled = reabrirMutation.isPending || !podeReabrirConfig || limiteAtingido;
                                                                    const tooltipMsg = !podeReabrirConfig ? "Reabertura desabilitada nas configurações" : limiteAtingido ? `Limite de ${regraFechamento?.limite_reabertura} reaberturas atingido` : "";

                                                                    return (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="h-7 text-xs"
                                                                            disabled={isDisabled}
                                                                            title={tooltipMsg}
                                                                            onClick={() => {
                                                                                const exigirMotivo = (regraFechamento as any)?.exigir_motivo !== false;
                                                                                const motivo = prompt("Motivo da reabertura:" + (exigirMotivo ? " (Obrigatório)" : ""));
                                                                                
                                                                                if (exigirMotivo && !motivo) {
                                                                                    toast.error("É obrigatório informar o motivo para reabrir.");
                                                                                    return;
                                                                                }
                                                                                
                                                                                reabrirMutation.mutate({ loteId: lote.id, motivo: motivo || "Não informado" });
                                                                            }}
                                                                        >
                                                                            <RefreshCw className="h-3 w-3 mr-1" />Reabrir
                                                                            {reaberturasLote > 0 && <span className="ml-1 opacity-60">({reaberturasLote})</span>}
                                                                        </Button>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}

                        {/* ── Aba: Histórico ── */}
                        {cicloTab === "historico" && (
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-base font-semibold text-foreground">Timeline de Governança</h3>
                                    <Button variant="outline" size="sm" onClick={() => refetchHistorico()} disabled={isFetchingLogs}>
                                        <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isFetchingLogs && "animate-spin")} />
                                        Sincronizar
                                    </Button>
                                </div>
                                
                                {(logsFechamento as any[]).length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 bg-muted/20 rounded-xl border border-dashed">
                                        <History className="h-10 w-10 text-muted-foreground/30 mb-3" />
                                        <p className="text-sm font-medium text-foreground">Nenhuma atividade registrada</p>
                                        <p className="text-xs text-muted-foreground mt-1 max-w-[280px] text-center">
                                            Ações de fechamento, validação e aprovação aparecerão aqui em ordem cronológica.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                                        {(logsFechamento as any[]).map((log: any, idx: number) => {
                                            const isSistema = log.usuario_role === 'sistema';
                                            const isFechou = log.acao === 'FECHOU';
                                            const isValidou = log.acao === 'VALIDOU';
                                            const isAprovou = log.acao === 'APROVOU';
                                            const isReabriu = log.acao === 'REABRIU';
                                            const isEncerrou = log.acao === 'ENCERROU';

                                            return (
                                                <div key={log.id ?? idx} className="relative">
                                                    {/* Dot */}
                                                    <div className={cn(
                                                        "absolute -left-[29px] top-1.5 h-6 w-6 rounded-full border-4 border-background flex items-center justify-center shadow-sm z-10",
                                                        isFechou && "bg-amber-500",
                                                        isValidou && "bg-indigo-500",
                                                        isAprovou && "bg-emerald-500",
                                                        isReabriu && "bg-rose-500",
                                                        isEncerrou && "bg-slate-700",
                                                        (!isFechou && !isValidou && !isAprovou && !isReabriu && !isEncerrou) && "bg-muted-foreground"
                                                    )}>
                                                        {isFechou && <Lock className="h-3 w-3 text-white" />}
                                                        {isValidou && <CheckCircle2 className="h-3 w-3 text-white" />}
                                                        {isAprovou && <Send className="h-3 w-3 text-white" />}
                                                        {isReabriu && <RefreshCw className="h-3 w-3 text-white" />}
                                                        {isEncerrou && <FileCheck className="h-3 w-3 text-white" />}
                                                    </div>

                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={cn(
                                                                "text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded",
                                                                isFechou && "bg-amber-100 text-amber-800",
                                                                isValidou && "bg-indigo-100 text-indigo-800",
                                                                isAprovou && "bg-emerald-100 text-emerald-800",
                                                                isReabriu && "bg-rose-100 text-rose-800",
                                                                isEncerrou && "bg-slate-200 text-slate-800",
                                                            )}>
                                                                {log.acao}
                                                            </span>
                                                            <span className="text-[10px] font-mono text-muted-foreground">
                                                                {log.created_at ? format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR }) : "—"}
                                                            </span>
                                                        </div>
                                                        <div className="esc-card p-3 bg-card shadow-sm border-border/60">
                                                            <div className="flex justify-between items-start gap-4">
                                                                <div className="space-y-1">
                                                                    <p className="text-sm font-medium text-foreground">
                                                                        {isSistema ? "Ação Automática" : log.usuario_nome}
                                                                        {!isSistema && <span className="text-[10px] text-muted-foreground ml-1.5 opacity-60">({log.usuario_role})</span>}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        Período: <span className="font-mono font-semibold text-foreground">{formatDate(log.periodo_inicio)} → {formatDate(log.periodo_fim)}</span>
                                                                    </p>
                                                                    {log.motivo && (
                                                                        <div className="mt-2 p-2 bg-muted/30 rounded border-l-2 border-primary/30 text-xs italic italic text-muted-foreground">
                                                                            "{log.motivo}"
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Aba: Configuração ── */}
                        {cicloTab === "configuracao" && (
                            <div className="space-y-6 py-4">
                                <div className="flex items-center justify-between mb-2">
                                    <div>
                                        <h3 className="text-lg font-bold text-foreground">Configurações do Ciclo</h3>
                                        <p className="text-sm text-muted-foreground">Gerencie as regras operacionais e automações do fechamento de diaristas.</p>
                                    </div>
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 border border-primary/10 rounded-lg">
                                        <Settings className="h-4 w-4 text-primary" />
                                        <span className="text-xs font-bold text-primary uppercase tracking-wider">Aba Operacional</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Card 1: Calendário e Fluxo */}
                                    <div className="esc-card p-5 space-y-6 flex flex-col justify-between">
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Calendário e Ciclo</h4>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                <Label className="text-sm font-semibold">Dia padrão de fechamento</Label>
                                                <span className="text-xs text-muted-foreground mb-1">Define quando o ciclo encerra ou sugere o fechamento automático.</span>
                                                <Select
                                                    value={(regraFechamento as any)?.dia_fechamento?.toString() || "0"}
                                                    onValueChange={(val) => {
                                                        updateRegraMutation.mutate({ dia_fechamento: Number(val) });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full h-10 text-sm">
                                                        <SelectValue placeholder="Selecione o dia..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="5">Toda Sexta-feira</SelectItem>
                                                        <SelectItem value="6">Todo Sábado</SelectItem>
                                                        <SelectItem value="0">Fechamento Manual (sempre aberto)</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="flex items-center justify-between gap-4 pt-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-sm font-semibold">Bloqueio Operacional</span>
                                                    <span className="text-xs text-muted-foreground">Bloquear edição da grade pelo encarregado após o fechamento.</span>
                                                </div>
                                                <Switch 
                                                    checked={(regraFechamento as any)?.bloquear_edicao ?? true} 
                                                    onCheckedChange={(val) => updateRegraMutation.mutate({ bloquear_edicao: val })}
                                                />
                                            </div>
                                        </div>

                                        <div className="bg-muted/30 p-3 rounded-lg border border-border/50">
                                            <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tighter">
                                                Dica: O fechamento manual permite maior flexibilidade para operações sazonais.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Card 2: Regras de Reabertura */}
                                    <div className="esc-card p-5 space-y-6">
                                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                            <RefreshCw className="h-4 w-4 text-muted-foreground" />
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Políticas de Reabertura</h4>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-semibold">Permitir reabertura</span>
                                                <span className="text-xs text-muted-foreground">Habilita a função de reabrir lotes após validação do RH.</span>
                                            </div>
                                            <Switch 
                                                checked={(regraFechamento as any)?.permitir_reabertura ?? true} 
                                                onCheckedChange={(val) => updateRegraMutation.mutate({ permitir_reabertura: val })}
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                            <div className="flex flex-col gap-2 p-3 bg-muted/20 rounded-lg border border-border/50">
                                                <span className="text-xs font-bold text-foreground uppercase tracking-tight">Limite por Período</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Input 
                                                        type="number" 
                                                        value={(regraFechamento as any)?.limite_reabertura || 2} 
                                                        onChange={(e) => updateRegraMutation.mutate({ limite_reabertura: Number(e.target.value) })}
                                                        className="h-9 w-20 text-sm font-mono font-bold text-center" 
                                                    />
                                                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Máximo</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2 p-3 bg-muted/20 rounded-lg border border-border/50">
                                                <span className="text-xs font-bold text-foreground uppercase tracking-tight">Justificativa</span>
                                                <div className="flex items-center justify-between mt-1">
                                                    <span className="text-[10px] uppercase font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Obrigatório</span>
                                                    <Switch 
                                                        checked={(regraFechamento as any)?.exigir_motivo ?? true} 
                                                        onCheckedChange={(val) => updateRegraMutation.mutate({ exigir_motivo: val })}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Card 3: Governança e Financeiro */}
                                    <div className="esc-card p-5 space-y-6">
                                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                                            <FileCheck className="h-4 w-4 text-muted-foreground" />
                                            <h4 className="text-sm font-bold uppercase tracking-wider text-foreground">Governança & Financeiro</h4>
                                        </div>

                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-semibold">Aprovação Financeira Obrigatória</span>
                                                <span className="text-xs text-muted-foreground">Exigir validação do financeiro antes de liberar pagamento.</span>
                                            </div>
                                            <Switch 
                                                checked={(regraFechamento as any)?.enviar_financeiro ?? true} 
                                                onCheckedChange={(val) => updateRegraMutation.mutate({ enviar_financeiro: val })}
                                            />
                                        </div>

                                        <div className="flex flex-col gap-3 pt-2">
                                            <div className="flex flex-col gap-1">
                                                <span className="text-sm font-semibold">Encerramento automático do fluxo</span>
                                                <span className="text-xs text-muted-foreground mb-1">Define quando o lote é considerado <strong>CONCLUÍDO (PAGO)</strong>.</span>
                                            </div>
                                            <Select 
                                                value={(regraFechamento as any)?.auto_fechar ? "pago" : "aprovado"}
                                                onValueChange={(val) => updateRegraMutation.mutate({ auto_fechar: val === "pago" })}
                                            >
                                                <SelectTrigger className="w-full h-10 text-sm">
                                                    <SelectValue placeholder="Selecione o gatilho..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pago">Imediatamente após Aprovação Fin. → Status PAGO</SelectItem>
                                                    <SelectItem value="aprovado">Aguardar confirmação bancária (Manual)</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* Card 4: Status do Sistema (Informativo) */}
                                    <div className="esc-card p-5 bg-gradient-to-br from-background to-muted/10 border-dashed border-2 flex flex-col justify-center items-center text-center">
                                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                                            <Loader2 className={cn("h-6 w-6 text-primary", updateRegraMutation.isPending && "animate-spin")} />
                                        </div>
                                        <h4 className="text-sm font-bold text-foreground">Sincronização em Tempo Real</h4>
                                        <p className="text-xs text-muted-foreground max-w-[200px] mt-1">Todas as alterações são aplicadas instantaneamente ao fluxo de trabalho.</p>
                                        {updateRegraMutation.isPending && (
                                            <span className="text-[10px] font-bold text-primary animate-pulse mt-4 uppercase">Salvando no banco...</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </section>

                {/* Diálogo de Confirmação de Fechamento */}
                <Dialog open={openFechamento} onOpenChange={setOpenFechamento}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Confirmar Fechamento de Período</DialogTitle>
                            <DialogDescription>
                                Você está prestes a fechar o período de <strong>{inicio}</strong> a <strong>{fim}</strong>.
                                Isso irá consolidar <strong>{rawEmAberto}</strong> lançamentos em aberto.
                                Após o fechamento, o lote será enviado para validação do RH.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            <Label>Observações (opcional)</Label>
                            <Input value={obsLote} onChange={(e) => setObsLote(e.target.value)} placeholder="Ex: Ajustes manuais aplicados" />
                        </div>
                        <div className="space-y-2">
                            <Label>Para confirmar, digite <span className="font-bold text-amber-600">FECHAR</span></Label>
                            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="ghost" onClick={() => setOpenFechamento(false)}>Cancelar</Button>
                            <Button
                                className="bg-amber-600 hover:bg-amber-700"
                                disabled={confirmText !== "FECHAR" || fecharMutation.isPending}
                                onClick={() => fecharMutation.mutate()}
                            >
                                {fecharMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar e Fechar"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </AppShell>
    );
};

export default RhDiaristasPainel;
