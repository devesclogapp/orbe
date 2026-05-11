import { useState, useMemo, useEffect, useCallback } from "react";
import {
    format,
    startOfWeek,
    addDays,
    subWeeks,
    addWeeks,
    parseISO,
    isToday,
    isFuture,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Building2,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Lock,
    Save,
    Users,
    History,
    ArrowLeft,
    AlertCircle,
    TrendingUp,
    CalendarDays,
    XCircle,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

import { OperationalShell } from "@/components/layout/OperationalShell";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import {
    ColaboradorService,
    EmpresaService,
    LancamentoDiaristaPayload,
    LancamentoDiaristaService,
    LoteFechamentoDiaristaService,
    RegraMarcacaoDiaristaService,
} from "@/services/base.service";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Tipos ──────────────────────────────────────────────────────────────────

type CodigoMarcacao = string; // dinâmico — vem das regras
type GradeMap = Record<string, Record<string, CodigoMarcacao>>; // [diarista_id][data_ISO] = codigo

interface DiaristaRow {
    id: string;
    nome: string;
    cpf: string | null;
    funcao: string;
    valor_diaria: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const calcularValor = (codigo: CodigoMarcacao, valorDiaria: number, regras: any[]): number => {
    if (!codigo) return 0;
    const regra = regras.find((r: any) => r.codigo === codigo);
    if (!regra) return 0;
    return valorDiaria * Number(regra.multiplicador ?? 0);
};

/** Gera os 7 dias da semana a partir do início (segunda-feira) */
const gerarDiasSemana = (inicioSemana: Date): Date[] =>
    Array.from({ length: 7 }, (_, i) => addDays(inicioSemana, i));

/** Retorna o rótulo curto do dia (Seg, Ter, ...) */
const labelDia = (d: Date) => format(d, "EEE", { locale: ptBR }).replace(".", "").toUpperCase().substring(0, 3);

// ─── Componente ─────────────────────────────────────────────────────────────

const DiaristasLancamento = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    /* Semana selecionada — começa no domingo da semana atual mas exibe de seg–dom */
    const [semanaInicio, setSemanaInicio] = useState<Date>(() =>
        startOfWeek(new Date(), { weekStartsOn: 1 })
    );

    const [empresaIdSelecionada, setEmpresaIdSelecionada] = useState("");
    const [clienteUnidade, setClienteUnidade] = useState("");

    /* grade[diarista_id][data_ISO] = codigo */
    const [grade, setGrade] = useState<GradeMap>({});

    const [openHistorico, setOpenHistorico] = useState(false);
    const [fechandoPeriodo, setFechandoPeriodo] = useState(false);

    const today = format(new Date(), "yyyy-MM-dd");
    const semanaFim = useMemo(() => addDays(semanaInicio, 6), [semanaInicio]);

    const diasSemana = useMemo(() => gerarDiasSemana(semanaInicio), [semanaInicio]);
    const inicioISO = format(semanaInicio, "yyyy-MM-dd");
    const fimISO = format(semanaFim, "yyyy-MM-dd");
    const labelSemana = `${format(semanaInicio, "dd/MM", { locale: ptBR })} – ${format(semanaFim, "dd/MM/yyyy", { locale: ptBR })}`;

    // ── Queries ─────────────────────────────────────────────────────────────

    const { data: perfil } = useQuery({
        queryKey: ["profile_usuario", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
            return data;
        },
        enabled: !!user?.id,
    });

    const { data: empresas = [] } = useQuery({
        queryKey: ["empresas_all"],
        queryFn: () => EmpresaService.getAll(),
    });

    const { data: diaristas = [], isLoading: isLoadingDiaristas } = useQuery({
        queryKey: ["diaristas_lancamento", empresaIdSelecionada],
        queryFn: () => ColaboradorService.getDiaristas(empresaIdSelecionada, true),
        enabled: !!empresaIdSelecionada,
        throwOnError: false,
        retry: 0,
    });

    const { data: regrasMarcacao = [], isLoading: isLoadingRegras } = useQuery({
        queryKey: ["regras_marcacao_diaristas", empresaIdSelecionada],
        queryFn: () => RegraMarcacaoDiaristaService.getByEmpresa(empresaIdSelecionada),
        enabled: !!empresaIdSelecionada,
        throwOnError: false,
        retry: 0,
    });

    /* Lançamentos já existentes na semana (para indicador visual) */
    const { data: lancamentosExistentes = [] } = useQuery({
        queryKey: ["lancamentos_diaristas_semana", empresaIdSelecionada, inicioISO, fimISO],
        queryFn: () =>
            LancamentoDiaristaService.getByPeriodo(empresaIdSelecionada, inicioISO, fimISO),
        enabled: !!empresaIdSelecionada,
        throwOnError: false,
        retry: 0,
    });

    /* Histórico 14 dias */
    const fourteenDaysAgo = format(subWeeks(new Date(), 2), "yyyy-MM-dd");
    const { data: historicoRecente = [], isLoading: isLoadingHistorico } = useQuery({
        queryKey: ["historico_recente_diaristas", empresaIdSelecionada],
        queryFn: () =>
            LancamentoDiaristaService.getByPeriodo(empresaIdSelecionada, fourteenDaysAgo, today, {
                encarregado_id: user?.id,
            }),
        enabled: !!empresaIdSelecionada && openHistorico,
        throwOnError: false,
        retry: 0,
    });

    // Mapa de lançamentos existentes: [diarista_id][data_ISO] = status
    const lancamentosExistentesMap = useMemo(() => {
        const map: Record<string, Record<string, any>> = {};
        (lancamentosExistentes as any[]).forEach((l: any) => {
            if (!map[l.diarista_id]) map[l.diarista_id] = {};
            const dateKey = l.data_lancamento;
            map[l.diarista_id][dateKey] = {
                count: (map[l.diarista_id][dateKey]?.count || 0) + 1,
                status: l.status
            };
        });
        return map;
    }, [lancamentosExistentes]);

    const isSemanaFechada = useMemo(() => {
        return (lancamentosExistentes as any[]).some((l: any) => l.status === 'fechado_para_pagamento');
    }, [lancamentosExistentes]);

    const regrasMarcacaoAtivas = useMemo(() => {
        const regrasDB = regrasMarcacao as any[];
        if (!regrasDB || regrasDB.length === 0) {
            // ProjectStabilizer: Fallback base caso a empresa não tenha regras populadas (Evita bloqueio da UI)
            return [
                { id: "fallback-p", codigo: "P", descricao: "Presença Integral", multiplicador: 1 },
                { id: "fallback-mp", codigo: "MP", descricao: "Meio Período", multiplicador: 0.5 },
                { id: "fallback-f", codigo: "F", descricao: "Falta", multiplicador: 0 },
                { id: "fallback-au", codigo: "AUSENTE", descricao: "Ausente / Não escalado", multiplicador: 0 },
            ];
        }
        return regrasDB;
    }, [regrasMarcacao]);

    // Regras ordenadas excluindo AUSENTE (usado apenas como estado padrão "vazio")
    const regrasCodigos = useMemo(
        () =>
            regrasMarcacaoAtivas
                .filter((r: any) => r.codigo !== "AUSENTE" && Number(r.multiplicador) >= 0)
                .sort((a: any, b: any) => b.multiplicador - a.multiplicador)
                .map((r: any) => r.codigo as string),
        [regrasMarcacaoAtivas]
    );

    // ── Inicializar grade quando diaristas mudam ─────────────────────────────
    useEffect(() => {
        if (!(diaristas as any[]).length) return;
        setGrade((prev) => {
            const next: GradeMap = {};
            (diaristas as any[]).forEach((d: any) => {
                next[d.id] = prev[d.id] ?? {};
            });
            return next;
        });
    }, [diaristas]);

    // ── Ciclo de toque ───────────────────────────────────────────────────────
    const toggleMarcacao = useCallback(
        (diaristaId: string, dateISO: string) => {
            if (!regrasCodigos.length) return;
            setGrade((prev) => {
                const atual = prev[diaristaId]?.[dateISO] ?? "";
                const idx = regrasCodigos.indexOf(atual);
                // "" (vazio) → primeiro código → ... → último código → "" (vazio)
                let next: string;
                if (idx === -1) {
                    // Estava vazio: vai para o primeiro código da lista
                    next = regrasCodigos[0];
                } else if (idx === regrasCodigos.length - 1) {
                    // Estava no último: volta para vazio
                    next = "";
                } else {
                    // Avança para o próximo
                    next = regrasCodigos[idx + 1];
                }
                return {
                    ...prev,
                    [diaristaId]: {
                        ...(prev[diaristaId] ?? {}),
                        [dateISO]: next,
                    },
                };
            });
        },
        [regrasCodigos]
    );

    // ── Resumo em tempo real ─────────────────────────────────────────────────
    const resumo = useMemo(() => {
        const diaristasArr = diaristas as DiaristaRow[];
        let valorTotal = 0;
        const contadorCodigos: Record<string, number> = {};
        let totalCelulasPreenchidas = 0;

        diaristasArr.forEach((d) => {
            const diasDiarista = grade[d.id] ?? {};
            Object.entries(diasDiarista).forEach(([, codigo]) => {
                if (!codigo) return;
                const val = calcularValor(codigo, d.valor_diaria, regrasMarcacaoAtivas as any[]);
                valorTotal += val;
                contadorCodigos[codigo] = (contadorCodigos[codigo] || 0) + 1;
                totalCelulasPreenchidas++;
            });
        });

        return { valorTotal, contadorCodigos, totalCelulasPreenchidas };
    }, [grade, diaristas, regrasMarcacaoAtivas]);

    // ── Salvar ───────────────────────────────────────────────────────────────
    const salvarMutation = useMutation({
        mutationFn: async () => {
            if (!empresaIdSelecionada) throw new Error("Empresa não identificada.");

            const diaristasArr = diaristas as DiaristaRow[];
            const registros: LancamentoDiaristaPayload[] = [];

            diaristasArr.forEach((d) => {
                const diasDiarista = grade[d.id] ?? {};
                Object.entries(diasDiarista).forEach(([dateISO, codigo]) => {
                    if (!codigo) return;
                    const regra = regrasMarcacaoAtivas.find((r: any) => r.codigo === codigo);
                    registros.push({
                        empresa_id: empresaIdSelecionada,
                        diarista_id: d.id,
                        nome_colaborador: d.nome,
                        cpf_colaborador: d.cpf,
                        funcao_colaborador: d.funcao,
                        data_lancamento: dateISO,
                        tipo_lancamento: "diarista",
                        codigo_marcacao: codigo as any,
                        quantidade_diaria: Number(regra?.multiplicador ?? 0),
                        valor_diaria_base: d.valor_diaria,
                        valor_calculado: calcularValor(codigo, d.valor_diaria, regrasMarcacaoAtivas as any[]),
                        cliente_unidade: clienteUnidade || null,
                        encarregado_id: user?.id ?? null,
                        encarregado_nome: perfil?.full_name || user?.email || null,
                    });
                });
            });

            if (registros.length === 0) throw new Error("Nenhuma marcação preenchida na semana.");
            return LancamentoDiaristaService.createBatch(registros);
        },
        onSuccess: (data) => {
            toast.success(`${data.length} lançamento(s) salvos com sucesso.`);
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_semana", empresaIdSelecionada] });
            // Limpar apenas as células salvas
            setGrade((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => { next[k] = {}; });
                return next;
            });
        },
        onError: (err: any) => toast.error("Erro ao salvar.", { description: err.message }),
    });

    // ── Fechar período ────────────────────────────────────────────────────────
    const fecharMutation = useMutation({
        mutationFn: async () => {
            if (!empresaIdSelecionada) throw new Error("Empresa não identificada.");
            return LoteFechamentoDiaristaService.fecharPeriodo({
                empresaId: empresaIdSelecionada,
                periodoInicio: inicioISO,
                periodoFim: fimISO,
                fechadoPor: user?.id ?? "",
                fechadoPorNome: perfil?.full_name || user?.email || "Encarregado",
                observacoes: `Fechamento semanal: ${labelSemana}`,
            });
        },
        onSuccess: (lote: any) => {
            toast.success(`Período fechado. ${lote.total_registros} registro(s). ${formatCurrency(lote.valor_total)}`);
            queryClient.invalidateQueries({ queryKey: ["lancamentos_diaristas_semana", empresaIdSelecionada] });
            setFechandoPeriodo(false);
        },
        onError: (err: any) => toast.error("Erro ao fechar período.", { description: err.message }),
    });

    const diaristasArr = diaristas as DiaristaRow[];
    const temMarcacoesNovaBatch = Object.values(grade).some((dias) =>
        Object.values(dias).some((c) => !!c)
    );

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <OperationalShell title="Lançamento de Diaristas" showBack={false} onBack={() => navigate("/producao")} hideFab={true}>
            <div className="max-w-5xl mx-auto space-y-5 pb-28">

                {/* Header: seletor de empresa + semana */}
                <section className="esc-card p-5 space-y-4">
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate("/producao")} className="text-muted-foreground hover:text-foreground p-1">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <div>
                            <h2 className="font-display font-bold text-foreground leading-tight">Grade Semanal de Diaristas</h2>
                            <p className="text-xs text-muted-foreground">{perfil?.full_name || user?.email}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Empresa */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Cliente / Empresa
                            </label>
                            <Select
                                value={clienteUnidade}
                                onValueChange={(nome) => {
                                    const temMarcacoes = Object.values(grade).some((d) =>
                                        Object.values(d).some((c) => !!c)
                                    );
                                    if (temMarcacoes && !window.confirm("Você tem marcações preenchidas. Trocar a empresa irá resetar. Continuar?")) return;
                                    const empresa = (empresas as any[]).find((e: any) => e.nome === nome);
                                    setClienteUnidade(nome);
                                    setEmpresaIdSelecionada(empresa?.id ?? "");
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione a Empresa" />
                                </SelectTrigger>
                                <SelectContent>
                                    {(empresas as any[]).map((e: any) => (
                                        <SelectItem key={e.id} value={e.nome}>{e.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Navegação de semana */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                Semana de Referência
                            </label>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0 h-10 w-10"
                                    onClick={() => setSemanaInicio((d) => subWeeks(d, 1))}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <div className="flex-1 flex h-10 items-center justify-center border border-border rounded-md bg-muted/30 text-sm font-mono font-semibold text-foreground px-3">
                                    {labelSemana}
                                </div>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="shrink-0 h-10 w-10"
                                    disabled={addWeeks(semanaInicio, 1) > new Date()}
                                    onClick={() => setSemanaInicio((d) => addWeeks(d, 1))}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Legenda das siglas */}
                    {regrasMarcacaoAtivas.length > 0 && (
                        <div className="rounded-lg bg-muted/20 border border-border/40 px-3 py-2.5">
                            <p className="text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 mb-2">
                                Legenda de marcações
                            </p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {regrasMarcacaoAtivas.map((r: any) => (
                                    <div key={r.id} className="flex items-center gap-2 min-w-0">
                                        <span className={cn(
                                            "h-[18px] min-w-[28px] px-1 rounded-[3px] text-[8px] font-black flex items-center justify-center tracking-wide shrink-0",
                                            r.codigo === "P" && "bg-green-500 text-white",
                                            r.codigo === "MP" && "bg-yellow-400 text-yellow-900",
                                            r.codigo === "F" && "bg-red-500 text-white",
                                            r.codigo !== "P" && r.codigo !== "MP" && r.codigo !== "F" && "bg-slate-400 dark:bg-slate-600 text-white"
                                        )}>
                                            {r.codigo}
                                        </span>
                                        <span className="text-[10px] text-foreground/60 truncate">{r.descricao}</span>
                                        {Number(r.multiplicador) > 0 && (
                                            <span className="text-[9px] font-mono text-muted-foreground ml-auto shrink-0">×{r.multiplicador}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* Estado vazio — sem empresa */}
                {!empresaIdSelecionada ? (
                    <div className="esc-card p-16 text-center space-y-3">
                        <Building2 className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
                        <p className="text-sm font-medium text-foreground">Selecione uma empresa para começar</p>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            Escolha o <span className="font-semibold text-primary">Cliente / Empresa</span> acima para carregar a grade semanal.
                        </p>
                    </div>
                ) : isLoadingDiaristas || isLoadingRegras ? (
                    <div className="esc-card p-12 text-center text-muted-foreground text-sm animate-pulse">
                        Carregando diaristas e regras...
                    </div>
                ) : diaristasArr.length === 0 ? (
                    <div className="esc-card p-16 text-center space-y-3">
                        <Users className="h-10 w-10 text-muted-foreground mx-auto opacity-30" />
                        <p className="text-sm font-medium text-foreground">Nenhum diarista cadastrado</p>
                        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                            O RH ou Admin precisa cadastrar colaboradores do tipo <span className="font-semibold text-primary">DIARISTA</span> e ativar{" "}
                            <em>Permitir lançamento operacional</em>.
                        </p>
                    </div>
                ) : (
                    /* ── Grade semanal ── */
                    <section className="esc-card overflow-hidden">
                        {/* Cabeçalho */}
                        <div className="p-4 border-b border-border flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            <h2 className="font-display font-bold text-foreground">Grade da Semana</h2>
                            <span className="ml-auto text-xs text-muted-foreground">{diaristasArr.length} diarista(s)</span>
                        </div>

                        {/* Cabeçalho da grade — labels dos dias */}
                        <div className="overflow-x-auto relative">
                            <table className="w-full min-w-[600px]">
                                <thead>
                                    <tr className="border-b border-border bg-muted">
                                        <th className="text-left text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2.5 w-[200px] sticky left-0 bg-muted z-20 border-r border-border">
                                            Diarista
                                        </th>
                                        {diasSemana.map((dia) => {
                                            const dateISO = format(dia, "yyyy-MM-dd");
                                            const futuro = isFuture(dia) && dateISO !== today;
                                            return (
                                                <th
                                                    key={dateISO}
                                                    className={cn(
                                                        "text-center text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-1 py-2.5 w-[80px]",
                                                        isToday(dia) && "text-primary"
                                                    )}
                                                >
                                                    <div>{labelDia(dia)}</div>
                                                    <div className={cn(
                                                        "text-[11px] font-mono mt-0.5",
                                                        isToday(dia) && "text-primary font-black",
                                                        futuro && "opacity-40"
                                                    )}>
                                                        {format(dia, "dd/MM")}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                        <th className="text-right text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 py-2.5 w-[110px]">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {diaristasArr.map((d) => {
                                        const diasDiarista = grade[d.id] ?? {};
                                        const totalDiarista = diasSemana.reduce((acc, dia) => {
                                            const dateISO = format(dia, "yyyy-MM-dd");
                                            const codigo = diasDiarista[dateISO] ?? "";
                                            return acc + calcularValor(codigo, d.valor_diaria, regrasMarcacaoAtivas as any[]);
                                        }, 0);
                                        const teveAlgumaCelulaAtiva = Object.values(diasDiarista).some((c) => !!c);

                                        return (
                                            <tr
                                                key={d.id}
                                                className={cn(
                                                    "hover:bg-muted/10 transition-colors",
                                                    teveAlgumaCelulaAtiva && "bg-primary/5"
                                                )}
                                            >
                                                {/* Nome + valor base */}
                                                <td className="px-4 py-3 sticky left-0 bg-card z-10 border-r border-border shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                                            {d.nome?.substring(0, 1).toUpperCase()}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="font-bold text-xs text-foreground truncate max-w-[110px]">{d.nome}</p>
                                                            <p className="text-[10px] text-muted-foreground font-mono">
                                                                {formatCurrency(d.valor_diaria)}/dia
                                                            </p>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Células dos dias */}
                                                {diasSemana.map((dia) => {
                                                    const dateISO = format(dia, "yyyy-MM-dd");
                                                    const codigo = diasDiarista[dateISO] ?? "";
                                                    const futuro = isFuture(dia) && dateISO !== today;
                                                    const jaLancado = !!(lancamentosExistentesMap[d.id]?.[dateISO]);
                                                    const regra = (regrasMarcacao as any[]).find((r: any) => r.codigo === codigo);
                                                    const isPresente = codigo === "P";
                                                    const isMeia = codigo === "MP";
                                                    const isFalta = codigo === "F";

                                                    const statusDia = lancamentosExistentesMap[d.id]?.[dateISO]?.status;
                                                    const isFechado = isSemanaFechada || statusDia === 'fechado_para_pagamento';
                                                    const isDisabled = futuro || isFechado;

                                                    return (
                                                        <td key={dateISO} className="px-1 py-2 text-center">
                                                            <button
                                                                type="button"
                                                                disabled={isDisabled}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    if (!isDisabled) toggleMarcacao(d.id, dateISO);
                                                                }}
                                                                className={cn(
                                                                    "mx-auto flex flex-col items-center justify-center rounded-lg transition-all select-none",
                                                                    "w-14 h-12 text-xs font-black uppercase tracking-wider border-2",
                                                                    isDisabled && "cursor-not-allowed",
                                                                    isFechado && "pointer-events-none",
                                                                    futuro
                                                                        ? "opacity-20 border-transparent bg-transparent text-muted-foreground"
                                                                        : !codigo
                                                                            ? cn(
                                                                                "border-dashed border-border text-muted-foreground bg-transparent",
                                                                                !isDisabled && "hover:border-primary/40 hover:bg-primary/5",
                                                                                jaLancado && "border-amber-400/60 bg-amber-50/50 dark:bg-amber-900/10"
                                                                            )
                                                                            : isPresente
                                                                                ? "border-green-500 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 shadow-sm"
                                                                                : isMeia
                                                                                    ? "border-yellow-500 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 shadow-sm"
                                                                                    : isFalta
                                                                                        ? "border-red-500 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 shadow-sm"
                                                                                        : "border-primary bg-primary/10 text-primary shadow-sm",
                                                                    isFechado && codigo && "opacity-80 saturate-50"
                                                                )}
                                                                title={
                                                                    isFechado ? "Período fechado" :
                                                                        futuro ? "Data futura" :
                                                                            jaLancado ? `Já lançado (clique p/ alterar)` :
                                                                                regra ? `${regra.descricao} (×${regra.multiplicador})` :
                                                                                    "Clique para marcar"
                                                                }
                                                            >
                                                                {codigo ? (
                                                                    <>
                                                                        <span className="leading-none">{codigo}</span>
                                                                        {regra && Number(regra.multiplicador) > 0 && (
                                                                            <span className="text-[8px] font-medium opacity-70 mt-0.5">
                                                                                {formatCurrency(calcularValor(codigo, d.valor_diaria, regrasMarcacaoAtivas as any[])).replace("R$\u00a0", "")}
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <span className="text-[10px] font-medium opacity-40">
                                                                        {jaLancado ? "✓" : "—"}
                                                                    </span>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}

                                                {/* Total do diarista */}
                                                <td className="px-4 py-3 text-right">
                                                    <p className={cn(
                                                        "font-mono font-bold text-sm",
                                                        totalDiarista > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                                                    )}>
                                                        {formatCurrency(totalDiarista)}
                                                    </p>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* ── Bottom dock mobile-first ── */}
                {empresaIdSelecionada && diaristasArr.length > 0 && (
                    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/98 backdrop-blur-md shadow-2xl safe-bottom">
                        {/* KPI strip — horizontal scroll on mobile */}
                        <div className="flex overflow-x-auto gap-1.5 px-4 pt-2 pb-1 scrollbar-hide">
                            {/* Diaristas */}
                            <div className="flex flex-col items-center justify-center shrink-0 bg-muted/40 rounded-lg min-w-[64px] py-1.5 px-2">
                                <p className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold leading-none">Diaristas</p>
                                <p className="text-sm font-black text-foreground leading-tight">{diaristasArr.length}</p>
                            </div>

                            {/* Separador */}
                            <div className="shrink-0 w-px bg-border mx-0.5 self-stretch" />

                            {/* Códigos marcados */}
                            {Object.entries(resumo.contadorCodigos).map(([codigo, qtd]) => {
                                const isP = codigo === "P";
                                const isMP = codigo === "MP";
                                const isF = codigo === "F" || codigo === "FERIADO";
                                return (
                                    <div key={codigo} className={cn(
                                        "flex items-center gap-1.5 shrink-0 rounded-lg px-2.5 py-1.5",
                                        isP && "bg-green-50 dark:bg-green-900/20",
                                        isMP && "bg-yellow-50 dark:bg-yellow-900/20",
                                        isF && "bg-red-50 dark:bg-red-900/20",
                                        !isP && !isMP && !isF && "bg-primary/10"
                                    )}>
                                        <span className={cn(
                                            "min-w-[18px] h-[18px] rounded text-[9px] font-black flex items-center justify-center px-0.5",
                                            isP && "bg-green-500 text-white",
                                            isMP && "bg-yellow-500 text-white",
                                            isF && "bg-red-500 text-white",
                                            !isP && !isMP && !isF && "bg-primary text-primary-foreground"
                                        )}>{codigo}</span>
                                        <span className={cn(
                                            "text-sm font-black leading-tight",
                                            isP && "text-green-700 dark:text-green-300",
                                            isMP && "text-yellow-700 dark:text-yellow-300",
                                            isF && "text-red-700 dark:text-red-300",
                                            !isP && !isMP && !isF && "text-primary"
                                        )}>{qtd}</span>
                                    </div>
                                );
                            })}

                            {/* Separador */}
                            <div className="shrink-0 w-px bg-border mx-0.5 self-stretch" />

                            {/* Total */}
                            <div className="flex flex-col items-center justify-center shrink-0 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg min-w-[100px] py-1.5 px-3 ml-auto">
                                <p className="text-[8px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-bold leading-none">Total</p>
                                <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 font-mono leading-tight">{formatCurrency(resumo.valorTotal)}</p>
                            </div>
                        </div>

                        {/* Action bar */}
                        <div className="flex items-center gap-2 px-4 py-2.5">
                            {/* Histórico */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setOpenHistorico(true)}
                                className="h-11 w-11 p-0 rounded-xl shrink-0"
                                title="Histórico"
                            >
                                <History className="h-4 w-4" />
                            </Button>

                            {/* Fechar período */}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setFechandoPeriodo(true)}
                                disabled={isSemanaFechada || !empresaIdSelecionada || (lancamentosExistentes as any[]).length === 0}
                                className={cn(
                                    "h-11 w-11 p-0 rounded-xl shrink-0 border-amber-300",
                                    isSemanaFechada ? "text-muted-foreground bg-muted border-border" : "text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                )}
                                title={isSemanaFechada ? "Semana já fechada" : "Fechar período"}
                            >
                                <Lock className="h-4 w-4" />
                            </Button>

                            {/* Salvar - expande */}
                            <Button
                                type="button"
                                size="sm"
                                className="flex-1 h-11 gap-2 font-display font-bold rounded-xl text-sm"
                                onClick={() => salvarMutation.mutate()}
                                disabled={salvarMutation.isPending || (!temMarcacoesNovaBatch && !isSemanaFechada) || !empresaIdSelecionada || isSemanaFechada}
                            >
                                {isSemanaFechada ? <Lock className="h-4 w-4 shrink-0" /> : <Save className="h-4 w-4 shrink-0" />}
                                {salvarMutation.isPending ? "Salvando..." : isSemanaFechada ? "Período Fechado" : temMarcacoesNovaBatch ? "Salvar lançamentos" : "Preencha a grade"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal: Histórico ── */}
            <Dialog open={openHistorico} onOpenChange={setOpenHistorico}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Meus Lançamentos — Últimos 14 dias</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {isLoadingHistorico ? (
                            <div className="text-center p-8 text-muted-foreground animate-pulse text-sm">Carregando...</div>
                        ) : (historicoRecente as any[]).length === 0 ? (
                            <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                                Nenhum lançamento nos últimos 14 dias para esta empresa.
                            </div>
                        ) : (
                            <div className="divide-y divide-border border rounded-lg overflow-hidden">
                                {(historicoRecente as any[]).map((h: any) => (
                                    <div key={h.id} className="p-4 bg-card flex items-center justify-between hover:bg-muted/50 transition-colors">
                                        <div>
                                            <p className="font-bold text-sm text-foreground">{h.nome_colaborador}</p>
                                            <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                                                <span>Data: <b className="text-foreground">{format(parseISO(h.data_lancamento), "dd/MM/yy")}</b></span>
                                                <span>•</span>
                                                <span>Código: <b className="text-foreground">{h.codigo_marcacao}</b></span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={cn(
                                                "px-2 py-0.5 rounded text-xs font-bold",
                                                h.status === "em_aberto" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                                            )}>
                                                {h.status === "em_aberto" ? "Em Aberto" : "Processado"}
                                            </span>
                                            <span className="font-mono font-semibold text-sm text-foreground">
                                                {formatCurrency(Number(h.valor_calculado ?? 0))}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Modal: Fechar Período ── */}
            <Dialog open={fechandoPeriodo} onOpenChange={setFechandoPeriodo}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Lock className="h-5 w-5 text-amber-600" />
                            Fechar Período
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 space-y-2">
                            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Resumo do fechamento</p>
                            <div className="grid grid-cols-2 gap-2 text-xs text-amber-700 dark:text-amber-400">
                                <div>
                                    <p className="font-bold uppercase tracking-wider opacity-70">Período</p>
                                    <p className="font-mono text-sm font-semibold">{labelSemana}</p>
                                </div>
                                <div>
                                    <p className="font-bold uppercase tracking-wider opacity-70">Empresa</p>
                                    <p className="font-semibold truncate">{clienteUnidade}</p>
                                </div>
                            </div>
                        </div>
                        <div className="bg-muted/30 rounded-lg p-4 border border-border text-sm text-muted-foreground space-y-1">
                            <p className="flex items-center gap-2 text-foreground font-medium">
                                <AlertCircle className="h-4 w-4 text-primary shrink-0" /> O que acontece ao fechar:
                            </p>
                            <ul className="list-disc list-inside space-y-0.5 pl-1">
                                <li>Todos os lançamentos <span className="font-semibold text-foreground">em_aberto</span> do período serão bloqueados</li>
                                <li>Status alterado para <span className="font-semibold text-amber-700">fechado_para_pagamento</span></li>
                                <li>Um lote de fechamento é gerado para o financeiro</li>
                                <li>A ação <span className="underline">não pode ser desfeita</span> pelo encarregado</li>
                            </ul>
                        </div>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                onClick={() => setFechandoPeriodo(false)}
                                disabled={fecharMutation.isPending}
                            >
                                <XCircle className="h-4 w-4 mr-1.5" /> Cancelar
                            </Button>
                            <Button
                                className="bg-amber-600 hover:bg-amber-700 text-white"
                                onClick={() => fecharMutation.mutate()}
                                disabled={fecharMutation.isPending}
                            >
                                <Lock className="h-4 w-4 mr-1.5" />
                                {fecharMutation.isPending ? "Fechando..." : "Confirmar Fechamento"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </OperationalShell>
    );
};

export default DiaristasLancamento;
